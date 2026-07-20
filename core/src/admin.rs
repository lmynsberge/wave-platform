//! SPEC-023: wave-internal account merge. Reassignment + invariant repair in one
//! transaction; scores/signal recompute at read time, so this IS the reprocessing.
use axum::extract::State;
use axum::http::StatusCode;
use axum::{routing::post, Json, Router};
use deadpool_postgres::Pool;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

type ApiResult = Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)>;

fn err(status: StatusCode, code: &str) -> (StatusCode, Json<Value>) {
    (status, Json(json!({ "error": code })))
}
fn internal(e: impl std::fmt::Display) -> (StatusCode, Json<Value>) {
    eprintln!("internal error: {e}");
    err(StatusCode::INTERNAL_SERVER_ERROR, "internal")
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeUsers {
    from_user_id: Uuid,
    into_user_id: Uuid,
}

pub fn routes(pool: Pool) -> Router {
    Router::new()
        .route("/v1/admin/merge-users", post(merge_users))
        .with_state(pool)
}

async fn merge_users(State(pool): State<Pool>, Json(body): Json<MergeUsers>) -> ApiResult {
    if body.from_user_id == body.into_user_id {
        return Err(err(StatusCode::BAD_REQUEST, "same_user"));
    }
    let from = body.from_user_id;
    let into = body.into_user_id;
    let mut client = pool.get().await.map_err(internal)?;
    let tx = client.transaction().await.map_err(internal)?;

    // R3(a): a system of record reports one truth per person-period — INTO's row wins
    let metric_conflicts_dropped = tx
        .execute(
            "DELETE FROM core.evidence e
             WHERE e.subject_user_id = $1 AND e.source IS NOT NULL
               AND EXISTS (SELECT 1 FROM core.evidence i
                           WHERE i.org_id = e.org_id AND i.subject_user_id = $2
                             AND i.attribute_id = e.attribute_id
                             AND i.source = e.source AND i.period = e.period)",
            &[&from, &into],
        )
        .await
        .map_err(internal)?;
    let evidence_subjects_reassigned = tx
        .execute(
            "UPDATE core.evidence SET subject_user_id = $2 WHERE subject_user_id = $1",
            &[&from, &into],
        )
        .await
        .map_err(internal)?;
    let evidence_authors_reassigned = tx
        .execute(
            "UPDATE core.evidence SET author_user_id = $2 WHERE author_user_id = $1",
            &[&from, &into],
        )
        .await
        .map_err(internal)?;
    // R3(b): author == subject is self-evidence (SPEC-003 R3) — drop, don't delete
    let self_evidence_dropped = tx
        .execute(
            "UPDATE core.evidence SET state = 'dropped'
             WHERE subject_user_id = $1 AND author_user_id = $1 AND state <> 'dropped'",
            &[&into],
        )
        .await
        .map_err(internal)?;
    // R3(c): both accounts validated the same evidence — INTO's row wins
    let duplicate_validations_dropped = tx
        .execute(
            "DELETE FROM core.validations v
             WHERE v.validator_user_id = $1
               AND EXISTS (SELECT 1 FROM core.validations i
                           WHERE i.evidence_id = v.evidence_id AND i.validator_user_id = $2)",
            &[&from, &into],
        )
        .await
        .map_err(internal)?;
    let validations_reassigned = tx
        .execute(
            "UPDATE core.validations SET validator_user_id = $2 WHERE validator_user_id = $1",
            &[&from, &into],
        )
        .await
        .map_err(internal)?;
    // R3(d): validator == author/subject is structurally invalid (SPEC-003 R4)
    let invalid_validations_dropped = tx
        .execute(
            "DELETE FROM core.validations v
             USING core.evidence e
             WHERE v.evidence_id = e.id AND v.validator_user_id = $1
               AND (e.author_user_id = $1 OR e.subject_user_id = $1)",
            &[&into],
        )
        .await
        .map_err(internal)?;

    tx.commit().await.map_err(internal)?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "evidenceSubjectsReassigned": evidence_subjects_reassigned,
            "evidenceAuthorsReassigned": evidence_authors_reassigned,
            "metricConflictsDropped": metric_conflicts_dropped,
            "selfEvidenceDropped": self_evidence_dropped,
            "validationsReassigned": validations_reassigned,
            "duplicateValidationsDropped": duplicate_validations_dropped,
            "invalidValidationsDropped": invalid_validations_dropped
        })),
    ))
}

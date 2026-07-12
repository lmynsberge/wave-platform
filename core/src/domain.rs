use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::{routing::get, routing::post, Json, Router};
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
pub struct CreateAttribute {
    key: String,
    name: String,
    kind: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEvidence {
    org_id: Uuid,
    subject_user_id: Uuid,
    author_user_id: Option<Uuid>,
    attribute_key: String,
    value_numeric: Option<f64>,
    note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateValidation {
    validator_user_id: Uuid,
    outcome: String,
    validator_relationship: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryQuery {
    org_id: Uuid,
}

pub fn routes(pool: Pool) -> Router {
    Router::new()
        .route("/v1/attributes", post(create_attribute).get(list_attributes))
        .route("/v1/evidence", post(create_evidence))
        .route("/v1/evidence/:id", get(get_evidence))
        .route("/v1/evidence/:id/validations", post(create_validation))
        .route("/v1/users/:user_id/attributes", get(user_attribute_summary))
        .route("/v1/signal-policy", get(signal_policy))
        .with_state(pool)
}

async fn create_attribute(State(pool): State<Pool>, Json(body): Json<CreateAttribute>) -> ApiResult {
    if body.kind != "objective" && body.kind != "subjective" {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_kind"));
    }
    let client = pool.get().await.map_err(internal)?;
    let row = client
        .query_one(
            "INSERT INTO core.attributes(key, name, kind) VALUES ($1,$2,$3)
             ON CONFLICT (key) DO NOTHING RETURNING id",
            &[&body.key, &body.name, &body.kind],
        )
        .await;
    match row {
        Ok(r) => {
            let id: Uuid = r.get(0);
            Ok((StatusCode::CREATED, Json(json!({ "id": id, "key": body.key, "name": body.name, "kind": body.kind }))))
        }
        Err(_) => Err(err(StatusCode::CONFLICT, "key_taken")),
    }
}

async fn list_attributes(State(pool): State<Pool>) -> ApiResult {
    let client = pool.get().await.map_err(internal)?;
    let rows = client
        .query("SELECT id, key, name, kind FROM core.attributes ORDER BY key", &[])
        .await
        .map_err(internal)?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| json!({ "id": r.get::<_, Uuid>(0), "key": r.get::<_, String>(1), "name": r.get::<_, String>(2), "kind": r.get::<_, String>(3) }))
        .collect();
    Ok((StatusCode::OK, Json(json!(list))))
}

async fn create_evidence(State(pool): State<Pool>, Json(body): Json<CreateEvidence>) -> ApiResult {
    let client = pool.get().await.map_err(internal)?;
    let attr = client
        .query_opt("SELECT id, kind FROM core.attributes WHERE key = $1", &[&body.attribute_key])
        .await
        .map_err(internal)?
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "unknown_attribute"))?;
    let attr_id: Uuid = attr.get(0);
    let kind: String = attr.get(1);

    // Structural rules (SPEC-003 R3)
    match kind.as_str() {
        "subjective" => {
            let author = body
                .author_user_id
                .ok_or_else(|| err(StatusCode::BAD_REQUEST, "subjective_requires_author"))?;
            if author == body.subject_user_id {
                return Err(err(StatusCode::BAD_REQUEST, "self_evidence"));
            }
            if body.value_numeric.is_some() {
                return Err(err(StatusCode::BAD_REQUEST, "kind_mismatch"));
            }
        }
        "objective" => {
            if body.author_user_id.is_some() {
                // Hard metrics self-originate from systems (brief: origination logic)
                return Err(err(StatusCode::BAD_REQUEST, "objective_requires_system"));
            }
            if body.value_numeric.is_none() {
                return Err(err(StatusCode::BAD_REQUEST, "objective_requires_value"));
            }
        }
        _ => unreachable!(),
    }

    let row = client
        .query_one(
            "INSERT INTO core.evidence(org_id, subject_user_id, author_user_id, attribute_id, kind, value_numeric, note)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
            &[&body.org_id, &body.subject_user_id, &body.author_user_id, &attr_id, &kind, &body.value_numeric, &body.note],
        )
        .await
        .map_err(internal)?;
    let id: Uuid = row.get(0);
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": id, "orgId": body.org_id, "subjectUserId": body.subject_user_id,
            "authorUserId": body.author_user_id, "attributeKey": body.attribute_key,
            "kind": kind, "valueNumeric": body.value_numeric, "note": body.note
        })),
    ))
}

async fn get_evidence(State(pool): State<Pool>, Path(id): Path<Uuid>) -> ApiResult {
    let client = pool.get().await.map_err(internal)?;
    let row = client
        .query_opt(
            "SELECT id, org_id, subject_user_id, author_user_id, kind FROM core.evidence WHERE id = $1",
            &[&id],
        )
        .await
        .map_err(internal)?
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "not_found"))?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "id": row.get::<_, Uuid>(0), "orgId": row.get::<_, Uuid>(1),
            "subjectUserId": row.get::<_, Uuid>(2), "authorUserId": row.get::<_, Option<Uuid>>(3),
            "kind": row.get::<_, String>(4)
        })),
    ))
}

async fn create_validation(
    State(pool): State<Pool>,
    Path(evidence_id): Path<Uuid>,
    Json(body): Json<CreateValidation>,
) -> ApiResult {
    if !["yes", "no", "no_signal"].contains(&body.outcome.as_str()) {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_outcome"));
    }
    if !["peer", "manager_chain"].contains(&body.validator_relationship.as_str()) {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_relationship"));
    }
    let client = pool.get().await.map_err(internal)?;
    let ev = client
        .query_opt(
            "SELECT subject_user_id, author_user_id, kind FROM core.evidence WHERE id = $1",
            &[&evidence_id],
        )
        .await
        .map_err(internal)?
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "not_found"))?;
    let subject: Uuid = ev.get(0);
    let author: Option<Uuid> = ev.get(1);
    let kind: String = ev.get(2);

    // Structural rules (SPEC-003 R4)
    if kind == "objective" {
        return Err(err(StatusCode::BAD_REQUEST, "objective_evidence"));
    }
    if Some(body.validator_user_id) == author {
        return Err(err(StatusCode::BAD_REQUEST, "own_evidence"));
    }
    if body.validator_user_id == subject {
        return Err(err(StatusCode::BAD_REQUEST, "own_subject"));
    }

    let row = client
        .query_one(
            "INSERT INTO core.validations(evidence_id, validator_user_id, outcome, validator_relationship)
             VALUES ($1,$2,$3,$4) ON CONFLICT (evidence_id, validator_user_id) DO NOTHING RETURNING id",
            &[&evidence_id, &body.validator_user_id, &body.outcome, &body.validator_relationship],
        )
        .await;
    match row {
        Ok(r) => {
            let id: Uuid = r.get(0);
            Ok((
                StatusCode::CREATED,
                Json(json!({ "id": id, "evidenceId": evidence_id, "validatorUserId": body.validator_user_id, "outcome": body.outcome })),
            ))
        }
        Err(_) => Err(err(StatusCode::CONFLICT, "duplicate_validation")),
    }
}

/// SPEC-004: significance engine. Status/score computed at read time.
/// INVARIANT 1: manager_chain 'no' outcomes are DROPPED from counted_no.
/// INVARIANT 2: score is null below `established`.
/// INVARIANT 5: zero-evidence attributes are simply absent (absence is neutral).
pub struct Policy {
    pub subj_emerging_min_evidence: i64,
    pub subj_emerging_min_authors: i64,
    pub subj_established_min_validators: i64,
    pub obj_emerging_min: i64,
    pub obj_established_min: i64,
}
pub const POLICY: Policy = Policy {
    subj_emerging_min_evidence: 5,
    subj_emerging_min_authors: 3,
    subj_established_min_validators: 5,
    obj_emerging_min: 1,
    obj_established_min: 3,
};

async fn signal_policy() -> Json<Value> {
    Json(json!({
        "subjective": {
            "emerging": { "minEvidence": POLICY.subj_emerging_min_evidence, "minAuthors": POLICY.subj_emerging_min_authors },
            "established": { "minValidators": POLICY.subj_established_min_validators }
        },
        "objective": {
            "emerging": { "minDatapoints": POLICY.obj_emerging_min },
            "established": { "minDatapoints": POLICY.obj_established_min }
        }
    }))
}

fn compute_status_score(
    kind: &str, evidence_count: i64, distinct_authors: i64, distinct_validators: i64,
    yes: i64, counted_no: i64, mean_value: Option<f64>,
) -> (&'static str, Option<f64>) {
    match kind {
        "objective" => {
            if evidence_count >= POLICY.obj_established_min {
                ("established", mean_value)
            } else if evidence_count >= POLICY.obj_emerging_min {
                ("emerging", None)
            } else {
                ("insufficient_signal", None)
            }
        }
        _ => {
            let emerging = evidence_count >= POLICY.subj_emerging_min_evidence
                && distinct_authors >= POLICY.subj_emerging_min_authors;
            if !emerging {
                return ("insufficient_signal", None);
            }
            // §5: established additionally requires at least one countable validation
            if distinct_validators >= POLICY.subj_established_min_validators && (yes + counted_no) >= 1 {
                let score = 100.0 * yes as f64 / (yes + counted_no) as f64;
                ("established", Some(score))
            } else {
                ("emerging", None)
            }
        }
    }
}

async fn user_attribute_summary(
    State(pool): State<Pool>,
    Path(user_id): Path<Uuid>,
    Query(q): Query<SummaryQuery>,
) -> ApiResult {
    let client = pool.get().await.map_err(internal)?;
    let rows = client
        .query(
            "SELECT a.key, a.name, a.kind,
                    count(DISTINCT e.id) AS evidence_count,
                    count(DISTINCT e.author_user_id) AS distinct_authors,
                    count(v.id) FILTER (WHERE v.outcome = 'yes') AS yes,
                    count(v.id) FILTER (WHERE v.outcome = 'no') AS no_all,
                    count(v.id) FILTER (WHERE v.outcome = 'no' AND v.validator_relationship <> 'manager_chain') AS counted_no,
                    count(v.id) FILTER (WHERE v.outcome = 'no_signal') AS no_signal,
                    count(DISTINCT v.validator_user_id) AS distinct_validators,
                    avg(e.value_numeric) AS mean_value
             FROM core.evidence e
             JOIN core.attributes a ON a.id = e.attribute_id
             LEFT JOIN core.validations v ON v.evidence_id = e.id
             WHERE e.subject_user_id = $1 AND e.org_id = $2
             GROUP BY a.key, a.name, a.kind ORDER BY a.key",
            &[&user_id, &q.org_id],
        )
        .await
        .map_err(internal)?;
    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            let kind: String = r.get(2);
            let evidence_count: i64 = r.get(3);
            let distinct_authors: i64 = r.get(4);
            let yes: i64 = r.get(5);
            let no_all: i64 = r.get(6);
            let counted_no: i64 = r.get(7);
            let no_signal: i64 = r.get(8);
            let distinct_validators: i64 = r.get(9);
            let mean_value: Option<f64> = r.get(10);
            let (status, score) = compute_status_score(
                &kind, evidence_count, distinct_authors, distinct_validators, yes, counted_no, mean_value,
            );
            json!({
                "key": r.get::<_, String>(0), "name": r.get::<_, String>(1), "kind": kind,
                "evidenceCount": evidence_count, "distinctAuthors": distinct_authors,
                "validations": { "yes": yes, "no": no_all, "noSignal": no_signal },
                "distinctValidators": distinct_validators,
                "status": status, "score": score
            })
        })
        .collect();
    Ok((StatusCode::OK, Json(json!({ "attributes": list }))))
}

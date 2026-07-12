use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

async fn setup() -> axum::Router {
    let url = "postgres://wave:wave@localhost:5432/wave_core_test";
    // recreate db fresh
    let (admin, conn) = tokio_postgres::connect(
        "postgres://wave:wave@localhost:5432/postgres",
        tokio_postgres::NoTls,
    )
    .await
    .unwrap();
    tokio::spawn(conn);
    let _ = admin.execute("DROP DATABASE IF EXISTS wave_core_test WITH (FORCE)", &[]).await;
    admin.execute("CREATE DATABASE wave_core_test", &[]).await.unwrap();

    let pool = wave_core::db::create_pool(url);
    wave_core::db::migrate(&pool, "migrations").await.unwrap();
    wave_core::db::migrate(&pool, "migrations").await.unwrap(); // AC6 idempotence
    wave_core::app_with_db(pool)
}

async fn call(app: &axum::Router, method: &str, path: &str, body: Option<Value>) -> (StatusCode, Value) {
    let req = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .body(body.map(|b| Body::from(b.to_string())).unwrap_or_else(Body::empty))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let val = if bytes.is_empty() { json!(null) } else { serde_json::from_slice(&bytes).unwrap() };
    (status, val)
}

#[tokio::test]
async fn structural_rules_and_summary() {
    let app = setup().await;
    let org = Uuid::new_v4();
    let alice = Uuid::new_v4();
    let bob = Uuid::new_v4();
    let carol = Uuid::new_v4();

    // seed attributes
    for (key, kind) in [("leadership", "subjective"), ("billable_hours", "objective")] {
        let (s, _) = call(&app, "POST", "/v1/attributes",
            Some(json!({"key": key, "name": key, "kind": kind}))).await;
        assert_eq!(s, StatusCode::CREATED);
    }
    let (s, _) = call(&app, "POST", "/v1/attributes",
        Some(json!({"key": "leadership", "name": "dup", "kind": "subjective"}))).await;
    assert_eq!(s, StatusCode::CONFLICT);

    // AC1: R3 structural rules
    let cases = [
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": null, "attributeKey": "leadership", "note": "x"}), "subjective_requires_author"),
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": alice, "attributeKey": "leadership", "note": "x"}), "self_evidence"),
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": bob, "attributeKey": "leadership", "valueNumeric": 5.0}), "kind_mismatch"),
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": bob, "attributeKey": "billable_hours", "valueNumeric": 100.0}), "objective_requires_system"),
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": null, "attributeKey": "billable_hours"}), "objective_requires_value"),
        (json!({"orgId": org, "subjectUserId": alice, "authorUserId": bob, "attributeKey": "nope", "note": "x"}), "unknown_attribute"),
    ];
    for (body, code) in cases {
        let (s, v) = call(&app, "POST", "/v1/evidence", Some(body)).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "expected 400 {code}");
        assert_eq!(v["error"], code);
    }

    // happy paths
    let (s, ev) = call(&app, "POST", "/v1/evidence",
        Some(json!({"orgId": org, "subjectUserId": alice, "authorUserId": bob, "attributeKey": "leadership", "note": "ran the retro well"}))).await;
    assert_eq!(s, StatusCode::CREATED);
    let ev_id = ev["id"].as_str().unwrap().to_string();
    let (s, _) = call(&app, "POST", "/v1/evidence",
        Some(json!({"orgId": org, "subjectUserId": alice, "authorUserId": null, "attributeKey": "billable_hours", "valueNumeric": 120.0}))).await;
    assert_eq!(s, StatusCode::CREATED);

    // AC1: R4 validation rules
    let val_cases = [
        (json!({"validatorUserId": bob, "outcome": "yes"}), StatusCode::BAD_REQUEST, "own_evidence"),
        (json!({"validatorUserId": alice, "outcome": "yes"}), StatusCode::BAD_REQUEST, "own_subject"),
        (json!({"validatorUserId": carol, "outcome": "maybe"}), StatusCode::BAD_REQUEST, "invalid_outcome"),
    ];
    for (body, status, code) in val_cases {
        let (s, v) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"), Some(body)).await;
        assert_eq!(s, status);
        assert_eq!(v["error"], code);
    }
    let (s, _) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"),
        Some(json!({"validatorUserId": carol, "outcome": "yes"}))).await;
    assert_eq!(s, StatusCode::CREATED);
    let (s, v) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"),
        Some(json!({"validatorUserId": carol, "outcome": "no"}))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(v["error"], "duplicate_validation");
    let (s, _) = call(&app, "POST", &format!("/v1/evidence/{}/validations", Uuid::new_v4()),
        Some(json!({"validatorUserId": carol, "outcome": "yes"}))).await;
    assert_eq!(s, StatusCode::NOT_FOUND);

    // AC2: summary
    let (s, v) = call(&app, "GET", &format!("/v1/users/{alice}/attributes?orgId={org}"), None).await;
    assert_eq!(s, StatusCode::OK);
    let attrs = v["attributes"].as_array().unwrap();
    assert_eq!(attrs.len(), 2);
    let lead = attrs.iter().find(|a| a["key"] == "leadership").unwrap();
    assert_eq!(lead["evidenceCount"], 1);
    assert_eq!(lead["validations"]["yes"], 1);
    assert_eq!(lead["status"], "insufficient_signal");
    let bill = attrs.iter().find(|a| a["key"] == "billable_hours").unwrap();
    assert_eq!(bill["status"], "insufficient_signal");

    // empty user → empty list
    let (s, v) = call(&app, "GET", &format!("/v1/users/{}/attributes?orgId={org}", Uuid::new_v4()), None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(v["attributes"].as_array().unwrap().len(), 0);
}

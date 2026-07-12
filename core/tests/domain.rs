use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

async fn setup() -> axum::Router { setup2("wave_core_test").await }

async fn setup2(db: &str) -> axum::Router {
    let url = format!("postgres://wave:wave@localhost:5432/{db}");
    // recreate db fresh
    let (admin, conn) = tokio_postgres::connect(
        "postgres://wave:wave@localhost:5432/postgres",
        tokio_postgres::NoTls,
    )
    .await
    .unwrap();
    tokio::spawn(conn);
    let _ = admin.execute(&format!("DROP DATABASE IF EXISTS {db} WITH (FORCE)"), &[]).await;
    admin.execute(&format!("CREATE DATABASE {db}"), &[]).await.unwrap();

    let pool = wave_core::db::create_pool(&url);
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
        (json!({"validatorUserId": bob, "outcome": "yes", "validatorRelationship": "peer"}), StatusCode::BAD_REQUEST, "own_evidence"),
        (json!({"validatorUserId": alice, "outcome": "yes", "validatorRelationship": "peer"}), StatusCode::BAD_REQUEST, "own_subject"),
        (json!({"validatorUserId": carol, "outcome": "maybe", "validatorRelationship": "peer"}), StatusCode::BAD_REQUEST, "invalid_outcome"),
    ];
    for (body, status, code) in val_cases {
        let (s, v) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"), Some(body)).await;
        assert_eq!(s, status);
        assert_eq!(v["error"], code);
    }
    let (s, _) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"),
        Some(json!({"validatorUserId": carol, "outcome": "yes", "validatorRelationship": "peer"}))).await;
    assert_eq!(s, StatusCode::CREATED);
    let (s, v) = call(&app, "POST", &format!("/v1/evidence/{ev_id}/validations"),
        Some(json!({"validatorUserId": carol, "outcome": "no", "validatorRelationship": "peer"}))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(v["error"], "duplicate_validation");
    let (s, _) = call(&app, "POST", &format!("/v1/evidence/{}/validations", Uuid::new_v4()),
        Some(json!({"validatorUserId": carol, "outcome": "yes", "validatorRelationship": "peer"}))).await;
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
    // SPEC-004: 1 objective datapoint = emerging (score still null: invariant 2)
    assert_eq!(bill["status"], "emerging");
    assert!(bill["score"].is_null());

    // empty user → empty list
    let (s, v) = call(&app, "GET", &format!("/v1/users/{}/attributes?orgId={org}", Uuid::new_v4()), None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(v["attributes"].as_array().unwrap().len(), 0);
}


// ---- SPEC-004: significance engine ----

async fn seed_attr(app: &axum::Router, key: &str, kind: &str) {
    let (_s, _) = call(app, "POST", "/v1/attributes", Some(json!({"key": key, "name": key, "kind": kind}))).await;
}

async fn add_subjective(app: &axum::Router, org: Uuid, subject: Uuid, author: Uuid, key: &str) -> String {
    let (s, v) = call(app, "POST", "/v1/evidence",
        Some(json!({"orgId": org, "subjectUserId": subject, "authorUserId": author, "attributeKey": key, "note": "n"}))).await;
    assert_eq!(s, StatusCode::CREATED);
    v["id"].as_str().unwrap().to_string()
}

async fn validate(app: &axum::Router, ev: &str, validator: Uuid, outcome: &str, rel: &str) {
    let (s, _) = call(app, "POST", &format!("/v1/evidence/{ev}/validations"),
        Some(json!({"validatorUserId": validator, "outcome": outcome, "validatorRelationship": rel}))).await;
    assert_eq!(s, StatusCode::CREATED, "validation {outcome}/{rel}");
}

async fn attr_of(app: &axum::Router, user: Uuid, org: Uuid, key: &str) -> Value {
    let (s, v) = call(app, "GET", &format!("/v1/users/{user}/attributes?orgId={org}"), None).await;
    assert_eq!(s, StatusCode::OK);
    v["attributes"].as_array().unwrap().iter().find(|a| a["key"] == key).unwrap().clone()
}

#[tokio::test]
async fn significance_thresholds_and_drop_not_negative() {
    let app = setup2("wave_core_test_sig").await;
    let org = Uuid::new_v4();
    let subj = Uuid::new_v4();
    let authors: Vec<Uuid> = (0..5).map(|_| Uuid::new_v4()).collect();
    let validators: Vec<Uuid> = (0..6).map(|_| Uuid::new_v4()).collect();
    seed_attr(&app, "leadership", "subjective").await;
    seed_attr(&app, "hours", "objective").await;

    // AC2: volume without diversity — 6 evidence from 2 authors
    let subj2 = Uuid::new_v4();
    for i in 0..6 {
        add_subjective(&app, org, subj2, authors[i % 2], "leadership").await;
    }
    assert_eq!(attr_of(&app, subj2, org, "leadership").await["status"], "insufficient_signal");

    // AC1: 4 evidence / 3 authors → insufficient
    let mut evs = vec![];
    for i in 0..4 {
        evs.push(add_subjective(&app, org, subj, authors[i % 3], "leadership").await);
    }
    assert_eq!(attr_of(&app, subj, org, "leadership").await["status"], "insufficient_signal");
    // 5th evidence, 3 distinct authors → emerging, score null
    evs.push(add_subjective(&app, org, subj, authors[3], "leadership").await);
    let a = attr_of(&app, subj, org, "leadership").await;
    assert_eq!(a["status"], "emerging");
    assert!(a["score"].is_null());

    // AC3: 3 peer yes + 2 manager_chain no across 5 distinct validators → established, counted_no=0, score=100
    validate(&app, &evs[0], validators[0], "yes", "peer").await;
    validate(&app, &evs[1], validators[1], "yes", "peer").await;
    validate(&app, &evs[2], validators[2], "yes", "peer").await;
    validate(&app, &evs[3], validators[3], "no", "manager_chain").await;
    validate(&app, &evs[4], validators[4], "no", "manager_chain").await;
    let a = attr_of(&app, subj, org, "leadership").await;
    assert_eq!(a["status"], "established");
    assert_eq!(a["distinctValidators"], 5);
    assert_eq!(a["validations"]["no"], 2); // raw data visible
    assert_eq!(a["score"], 100.0);         // but dropped from score (invariant 1)

    // peer no added → score 3/(3+1)=75
    validate(&app, &evs[0], validators[5], "no", "peer").await;
    let a = attr_of(&app, subj, org, "leadership").await;
    assert_eq!(a["score"], 75.0);

    // AC4: objective — 1 datapoint emerging/null; 3 → established, mean
    for (i, v) in [100.0].iter().enumerate() {
        let (s, _) = call(&app, "POST", "/v1/evidence",
            Some(json!({"orgId": org, "subjectUserId": subj, "authorUserId": null, "attributeKey": "hours", "valueNumeric": v}))).await;
        assert_eq!(s, StatusCode::CREATED, "obj {i}");
    }
    let a = attr_of(&app, subj, org, "hours").await;
    assert_eq!(a["status"], "emerging");
    assert!(a["score"].is_null());
    for v in [120.0, 140.0] {
        call(&app, "POST", "/v1/evidence",
            Some(json!({"orgId": org, "subjectUserId": subj, "authorUserId": null, "attributeKey": "hours", "valueNumeric": v}))).await;
    }
    let a = attr_of(&app, subj, org, "hours").await;
    assert_eq!(a["status"], "established");
    assert_eq!(a["score"], 120.0);

    // AC5: policy endpoint
    let (s, v) = call(&app, "GET", "/v1/signal-policy", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(v["subjective"]["emerging"]["minEvidence"], 5);
}

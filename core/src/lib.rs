pub mod db;
pub mod domain;

use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/ping", get(ping))
}

pub fn app_with_db(pool: deadpool_postgres::Pool) -> Router {
    app().merge(domain::routes(pool))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn ping() -> Json<Value> {
    Json(json!({ "service": "core", "status": "ok" }))
}

use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/ping", get(ping))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn ping() -> Json<Value> {
    Json(json!({ "service": "core", "status": "ok" }))
}

#[tokio::main]
async fn main() {
    let port = std::env::var("CORE_PORT").unwrap_or_else(|_| "8081".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");
    println!("wave-core listening on {addr}");
    axum::serve(listener, app()).await.expect("server error");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn get_json(path: &str) -> (StatusCode, Value) {
        let res = app()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let (status, body) = get_json("/health").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "status": "ok" }));
    }

    #[tokio::test]
    async fn ping_returns_exact_contract() {
        let (status, body) = get_json("/v1/ping").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "service": "core", "status": "ok" }));
    }
}

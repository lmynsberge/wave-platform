use deadpool_postgres::{Config, Pool, Runtime};
use tokio_postgres::NoTls;

pub fn create_pool(url: &str) -> Pool {
    let mut cfg = Config::new();
    cfg.url = Some(url.to_string());
    cfg.create_pool(Some(Runtime::Tokio1), NoTls)
        .expect("failed to create pool")
}

pub fn database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://wave:wave@localhost:5432/wave".to_string())
}

/// Idempotent migration runner: applies migrations/*.sql in name order,
/// tracking applied files in core._migrations.
pub async fn migrate(pool: &Pool, dir: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;
    client
        .batch_execute(
            "CREATE SCHEMA IF NOT EXISTS core;
             CREATE TABLE IF NOT EXISTS core._migrations (
               name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
        )
        .await?;
    let applied: Vec<String> = client
        .query("SELECT name FROM core._migrations", &[])
        .await?
        .iter()
        .map(|r| r.get(0))
        .collect();
    let mut files: Vec<_> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".sql"))
        .collect();
    files.sort();
    for file in files {
        if applied.contains(&file) {
            continue;
        }
        let sql = std::fs::read_to_string(format!("{dir}/{file}"))?;
        let mut owned = pool.get().await?;
        let tx = owned.transaction().await?;
        tx.batch_execute(&sql).await?;
        tx.execute("INSERT INTO core._migrations(name) VALUES ($1)", &[&file])
            .await?;
        tx.commit().await?;
        println!("applied {file}");
    }
    Ok(())
}

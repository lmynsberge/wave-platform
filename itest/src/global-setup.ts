import { execSync, spawn, type ChildProcess } from "node:child_process";

const CORE_PORT = 8181;
const SERVER_PORT = 8180;
const CORE_DB = "postgres://wave:wave@localhost:5432/wave_it_core";
const SERVER_DB = "postgres://wave:wave@localhost:5432/wave_it_srv";
const PG_ENV = { ...process.env, PGPASSWORD: "wave" };

let procs: ChildProcess[] = [];

async function waitFor(url: string, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`service at ${url} did not come up`);
}

export async function setup() {
  // Fail fast with an actionable message if Postgres is absent (SPEC-QA-001 §5)
  try {
    execSync(`psql -h localhost -U wave -d postgres -c "select 1"`, { env: PG_ENV, stdio: "pipe" });
  } catch {
    throw new Error(
      "Postgres is not reachable at localhost:5432 (user wave). Start it (docker compose up postgres, or pg_ctlcluster 16 main start) and retry.",
    );
  }
  execSync(
    `psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_it_core WITH (FORCE)" -c "CREATE DATABASE wave_it_core" -c "DROP DATABASE IF EXISTS wave_it_srv WITH (FORCE)" -c "CREATE DATABASE wave_it_srv"`,
    { env: PG_ENV, stdio: "pipe" },
  );

  // Build core if the binary is missing (SPEC-QA-001 §5)
  execSync("cargo build -q", { cwd: "../core", stdio: "inherit" });

  // Server migrations via the component's own runner (R2)
  execSync("npx tsx src/migrate.ts", {
    cwd: "../server",
    env: { ...process.env, DATABASE_URL: SERVER_DB },
    stdio: "pipe",
  });

  // Core migrates itself on boot (R2)
  const core = spawn("./target/debug/wave-core", [], {
    cwd: "../core",
    env: { ...process.env, CORE_PORT: String(CORE_PORT), DATABASE_URL: CORE_DB },
    stdio: "ignore",
  });
  const server = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: "../server",
    env: {
      ...process.env,
      DATABASE_URL: SERVER_DB,
      CORE_URL: `http://127.0.0.1:${CORE_PORT}`,
      PORT: String(SERVER_PORT),
    },
    stdio: "ignore",
  });
  procs = [core, server];
  await waitFor(`http://127.0.0.1:${CORE_PORT}/health`);
  await waitFor(`http://127.0.0.1:${SERVER_PORT}/health`);
  process.env.IT_SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
  process.env.IT_CORE_URL = `http://127.0.0.1:${CORE_PORT}`;
}

export async function teardown() {
  for (const p of procs) p.kill();
}

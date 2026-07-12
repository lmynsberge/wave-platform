import { execSync, spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

/** TRUE E2E: real Rust core binary + real Postgres on both sides. */
const CORE_PORT = 8099;
const CORE_URL = `http://127.0.0.1:${CORE_PORT}`;
const SERVER_DB = "postgres://wave:wave@localhost:5432/wave_e2e_srv";
const CORE_DB = "postgres://wave:wave@localhost:5432/wave_e2e_core";

const pool = createPool(SERVER_DB);
const app = buildApp({ coreUrl: CORE_URL, pool });
let coreProc: ChildProcess;

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  return (Array.isArray(raw) ? raw[0] : (raw as string)).split(";")[0]!;
}
async function signup(email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { email, password: "password123", name: email } });
  return { id: res.json().user.id as string, cookie: cookieOf(res) };
}

let orgId: string;
let ceo: Awaited<ReturnType<typeof signup>>, mgr: typeof ceo, ic1: typeof ceo, ic2: typeof ceo, ic3: typeof ceo, ic4: typeof ceo;

beforeAll(async () => {
  execSync(
    `psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_e2e_srv" -c "CREATE DATABASE wave_e2e_srv" -c "DROP DATABASE IF EXISTS wave_e2e_core WITH (FORCE)" -c "CREATE DATABASE wave_e2e_core"`,
    { env: { ...process.env, PGPASSWORD: "wave" } },
  );
  await migrate("migrations", pool);
  coreProc = spawn("../core/target/debug/wave-core", [], {
    env: { ...process.env, CORE_PORT: String(CORE_PORT), DATABASE_URL: CORE_DB },
    cwd: "../core", stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${CORE_URL}/health`);
      if (r.ok) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  await fetch(`${CORE_URL}/v1/attributes`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "leadership", name: "Leadership", kind: "subjective" }),
  });

  ceo = await signup("ceo@e.com"); mgr = await signup("mgr@e.com");
  ic1 = await signup("ic1@e.com"); ic2 = await signup("ic2@e.com");
  ic3 = await signup("ic3@e.com"); ic4 = await signup("ic4@e.com");
  const org = await app.inject({ method: "POST", url: "/api/orgs", headers: { cookie: ceo.cookie }, payload: { name: "E", slug: "e2e" } });
  orgId = org.json().org.id;
  for (const u of [mgr, ic1, ic2, ic3, ic4]) {
    await app.inject({ method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: ceo.cookie }, payload: { userId: u.id, role: "member" } });
  }
  // ic1, ic2 → mgr → ceo (root). ic3, ic4 unmanaged peers.
  for (const [u, m] of [[ic1, mgr], [ic2, mgr], [mgr, ceo]] as const) {
    await app.inject({ method: "PUT", url: `/api/orgs/${orgId}/reporting`, headers: { cookie: ceo.cookie }, payload: { userId: u.id, managerId: m.id } });
  }
}, 30000);

afterAll(async () => { coreProc?.kill(); await app.close(); await pool.end(); });

const feedback = (author: typeof ceo, subjectId: string, note: string) =>
  app.inject({
    method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: author.cookie },
    payload: { subjectUserId: subjectId, attributeKey: "leadership", note },
  });

describe("AC1+AC2: validation queue + inbox", () => {
  it("queue shows unvalidated evidence of reports; validating clears it; inbox hides author", async () => {
    const fb = await feedback(ic2, ic1.id, "ran standup well");
    expect(fb.statusCode).toBe(201);
    const evId = fb.json().evidence.id as string;

    let q = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/validation-queue`, headers: { cookie: mgr.cookie } });
    expect(q.statusCode).toBe(200);
    expect(q.json().items.map((i: { evidenceId: string }) => i.evidenceId)).toContain(evId);
    expect(q.json().items[0].authorUserId).toBeUndefined();

    const inbox = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/inbox`, headers: { cookie: ic1.cookie } });
    expect(inbox.statusCode).toBe(200);
    const mine = inbox.json().items.find((i: { evidenceId: string }) => i.evidenceId === evId);
    expect(mine.authorKnown).toBe(true);
    expect(mine.authorUserId).toBeUndefined();

    const v = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback/${evId}/validations`,
      headers: { cookie: mgr.cookie }, payload: { outcome: "yes" },
    });
    expect(v.statusCode).toBe(201);
    q = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/validation-queue`, headers: { cookie: mgr.cookie } });
    expect(q.json().items.map((i: { evidenceId: string }) => i.evidenceId)).not.toContain(evId);
  });
});

describe("AC3+AC4: assessments, upward chain, drop-not-negative", () => {
  it("non-manager 403; pending invisible; upward yes activates; upward no leaves no trace", async () => {
    const notMgr = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments`, headers: { cookie: ic2.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "peer cannot assess" },
    });
    expect(notMgr.statusCode).toBe(403);

    const summaryBefore = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic1.id}/attributes`, headers: { cookie: mgr.cookie },
    });
    const before = JSON.stringify(summaryBefore.json());

    const a1 = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments`, headers: { cookie: mgr.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "shows real leadership" },
    });
    expect(a1.statusCode).toBe(201);
    const ev1 = a1.json().evidence.id as string;

    // pending → summary unchanged (invariant 2/5)
    const mid = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic1.id}/attributes`, headers: { cookie: mgr.cookie },
    });
    expect(JSON.stringify(mid.json())).toBe(before);

    // ceo sees it in upward queue (mgr is ceo's report)
    const uq = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/upward-queue`, headers: { cookie: ceo.cookie } });
    expect(uq.json().items.map((i: { evidenceId: string }) => i.evidenceId)).toContain(ev1);
    // author cannot decide own
    const own = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments/${ev1}/decision`,
      headers: { cookie: mgr.cookie }, payload: { outcome: "yes" },
    });
    expect(own.statusCode).toBe(403);

    const yes = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments/${ev1}/decision`,
      headers: { cookie: ceo.cookie }, payload: { outcome: "yes" },
    });
    expect(yes.statusCode).toBe(201);
    expect(yes.json().state).toBe("active");
    const after = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic1.id}/attributes`, headers: { cookie: mgr.cookie },
    });
    expect(JSON.stringify(after.json())).not.toBe(before); // now counted

    // AC6: double-decide 409
    const twice = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments/${ev1}/decision`,
      headers: { cookie: ceo.cookie }, payload: { outcome: "no" },
    });
    expect(twice.statusCode).toBe(409);

    // upward NO → dropped, no trace (AC4 second half)
    const a2 = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments`, headers: { cookie: mgr.cookie },
      payload: { subjectUserId: ic2.id, attributeKey: "leadership", note: "overreach" },
    });
    const ev2 = a2.json().evidence.id as string;
    const base2 = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic2.id}/attributes`, headers: { cookie: mgr.cookie },
    });
    const no = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments/${ev2}/decision`,
      headers: { cookie: ceo.cookie }, payload: { outcome: "no" },
    });
    expect(no.statusCode).toBe(201);
    expect(no.json().state).toBe("dropped");
    const after2 = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic2.id}/attributes`, headers: { cookie: mgr.cookie },
    });
    expect(JSON.stringify(after2.json())).toBe(JSON.stringify(base2.json()));
  });
});

describe("AC5: root author decided by admin", () => {
  it("ceo (root) assessment decidable by an admin, not by ceo", async () => {
    await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: ceo.cookie },
      payload: { userId: ic3.id, role: "admin" },
    }).catch(() => null);
    await app.inject({
      method: "PUT", url: `/api/orgs/${orgId}/reporting`, headers: { cookie: ceo.cookie },
      payload: { userId: ic4.id, managerId: ceo.id },
    });
    // promote ic3 to admin (was member) — update path: re-add fails 409, so use PUT-like: direct SQL
    await pool.query("UPDATE memberships SET role = 'admin' WHERE user_id = $1", [ic3.id]);

    const a = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments`, headers: { cookie: ceo.cookie },
      payload: { subjectUserId: ic4.id, attributeKey: "leadership", note: "root assessment" },
    });
    expect(a.statusCode).toBe(201);
    const evId = a.json().evidence.id as string;

    const uq = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/upward-queue`, headers: { cookie: ic3.cookie } });
    expect(uq.json().items.map((i: { evidenceId: string }) => i.evidenceId)).toContain(evId);

    const dec = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/assessments/${evId}/decision`,
      headers: { cookie: ic3.cookie }, payload: { outcome: "yes" },
    });
    expect(dec.statusCode).toBe(201);
  });
});

describe("AC6 (SPEC-006): signal-policy passthrough", () => {
  it("returns core policy when authed; 401 otherwise", async () => {
    const anon = await app.inject({ method: "GET", url: "/api/signal-policy" });
    expect(anon.statusCode).toBe(401);
    const ok = await app.inject({ method: "GET", url: "/api/signal-policy", headers: { cookie: ceo.cookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().subjective.emerging.minEvidence).toBe(5);
  });
});

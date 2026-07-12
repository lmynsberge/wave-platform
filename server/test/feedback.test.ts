import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

const TEST_DB_URL = "postgres://wave:wave@localhost:5432/wave_fb_test";
const pool = createPool(TEST_DB_URL);

/** Fake core: implements just enough of SPEC-003 §4.2 to test the proxy. */
const store = {
  evidence: new Map<string, { author: string; subject: string; org: string }>(),
  seq: 0,
  lastValidation: null as null | { validatorRelationship: string; outcome: string },
};
const fakeCore: typeof fetch = async (input, init) => {
  const url = String(input);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const respond = (status: number, json: unknown) =>
    new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  if (url.endsWith("/v1/evidence") && init?.method === "POST") {
    const id = `ev-${++store.seq}`;
    store.evidence.set(id, { author: body.authorUserId, subject: body.subjectUserId, org: body.orgId });
    return respond(201, { id, ...body });
  }
  const single = url.match(/\/v1\/evidence\/([^/?]+)$/);
  if (single && (init?.method ?? "GET") === "GET") {
    const ev = store.evidence.get(single[1]!);
    if (!ev) return respond(404, { error: "not_found" });
    return respond(200, { id: single[1], orgId: ev.org, subjectUserId: ev.subject, authorUserId: ev.author, kind: "subjective" });
  }
  const val = url.match(/\/v1\/evidence\/([^/]+)\/validations$/);
  if (val && init?.method === "POST") {
    const ev = store.evidence.get(val[1]!);
    if (!ev) return respond(404, { error: "not_found" });
    if (body.validatorUserId === ev.author) return respond(400, { error: "own_evidence" });
    if (body.validatorUserId === ev.subject) return respond(400, { error: "own_subject" });
    store.lastValidation = { validatorRelationship: body.validatorRelationship, outcome: body.outcome };
    return respond(201, { id: "v-1", evidenceId: val[1], outcome: body.outcome });
  }
  if (/\/v1\/users\/.+\/attributes\?orgId=/.test(url)) {
    return respond(200, { attributes: [{ key: "leadership", status: "insufficient_signal" }] });
  }
  return respond(404, { error: "not_found" });
};

const app = buildApp({ coreUrl: "http://fake-core", fetchImpl: fakeCore, pool });

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  return (Array.isArray(raw) ? raw[0] : (raw as string)).split(";")[0]!;
}
async function signup(email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { email, password: "password123", name: email } });
  return { id: res.json().user.id as string, cookie: cookieOf(res) };
}

let orgId: string;
let ceo: Awaited<ReturnType<typeof signup>>, mgr: typeof ceo, ic1: typeof ceo, ic2: typeof ceo, outsider: typeof ceo;

beforeAll(async () => {
  execSync(`psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_fb_test" -c "CREATE DATABASE wave_fb_test"`, {
    env: { ...process.env, PGPASSWORD: "wave" },
  });
  await migrate("migrations", pool);
  ceo = await signup("ceo@x.com"); mgr = await signup("mgr@x.com");
  ic1 = await signup("ic1@x.com"); ic2 = await signup("ic2@x.com");
  outsider = await signup("out@x.com");
  const org = await app.inject({ method: "POST", url: "/api/orgs", headers: { cookie: ceo.cookie }, payload: { name: "X", slug: "x" } });
  orgId = org.json().org.id;
  for (const u of [mgr, ic1, ic2]) {
    await app.inject({ method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: ceo.cookie }, payload: { userId: u.id, role: "member" } });
  }
  // chain: ic1 → mgr → ceo
  await app.inject({ method: "PUT", url: `/api/orgs/${orgId}/reporting`, headers: { cookie: ceo.cookie }, payload: { userId: ic1.id, managerId: mgr.id } });
  await app.inject({ method: "PUT", url: `/api/orgs/${orgId}/reporting`, headers: { cookie: ceo.cookie }, payload: { userId: mgr.id, managerId: ceo.id } });
});
afterAll(async () => { await app.close(); await pool.end(); });

describe("AC3: feedback submission + manager gate", () => {
  it("peer feedback 201; self 400; direct manager 403; transitive manager (ceo) 403", async () => {
    const peer = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ic2.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "led the incident call well" },
    });
    expect(peer.statusCode).toBe(201);

    const self = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ic1.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "I am great" },
    });
    expect(self.statusCode).toBe(400);
    expect(self.json().error).toBe("self_feedback");

    const direct = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: mgr.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "strong leader" },
    });
    expect(direct.statusCode).toBe(403);
    expect(direct.json().error).toBe("manager_cannot_originate");

    const transitive = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ceo.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "future exec" },
    });
    expect(transitive.statusCode).toBe(403);

    // upward feedback is allowed (report about manager)
    const upward = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ic1.cookie },
      payload: { subjectUserId: mgr.id, attributeKey: "leadership", note: "unblocks the team" },
    });
    expect(upward.statusCode).toBe(201);
  });
});

describe("AC4: validations via proxy", () => {
  it("author 400 own_evidence; subject 400 own_subject; third party 201", async () => {
    const fb = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ic2.cookie },
      payload: { subjectUserId: ic1.id, attributeKey: "leadership", note: "solid" },
    });
    const evId = fb.json().evidence.id as string;
    const base = { method: "POST" as const, url: `/api/orgs/${orgId}/feedback/${evId}/validations` };

    const own = await app.inject({ ...base, headers: { cookie: ic2.cookie }, payload: { outcome: "yes" } });
    expect(own.statusCode).toBe(400);
    expect(own.json().error).toBe("own_evidence");

    const subj = await app.inject({ ...base, headers: { cookie: ic1.cookie }, payload: { outcome: "yes" } });
    expect(subj.statusCode).toBe(400);
    expect(subj.json().error).toBe("own_subject");

    const ok = await app.inject({ ...base, headers: { cookie: mgr.cookie }, payload: { outcome: "yes" } });
    expect(ok.statusCode).toBe(201);
    // AC6: mgr is in ic1's chain → relationship forwarded as manager_chain
    expect(store.lastValidation?.validatorRelationship).toBe("manager_chain");

    const peerV = await app.inject({ ...base, headers: { cookie: ceo.cookie }, payload: { outcome: "no_signal" } });
    expect(peerV.statusCode).toBe(201);
    expect(store.lastValidation?.validatorRelationship).toBe("manager_chain"); // ceo transitive

    const fb2 = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback`, headers: { cookie: ic1.cookie },
      payload: { subjectUserId: ic2.id, attributeKey: "leadership", note: "great pairing" },
    });
    const ev2 = fb2.json().evidence.id as string;
    const p = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/feedback/${ev2}/validations`,
      headers: { cookie: mgr.cookie }, payload: { outcome: "yes" },
    });
    expect(p.statusCode).toBe(201);
    // mgr is NOT in ic2's chain (ic2 has no manager) → peer
    expect(store.lastValidation?.validatorRelationship).toBe("peer");

    const bad = await app.inject({ ...base, headers: { cookie: mgr.cookie }, payload: { outcome: "definitely" } });
    expect(bad.statusCode).toBe(400);
  });
});

describe("AC5: attribute summary proxy + R5", () => {
  it("member reads summary; non-member 404", async () => {
    const ok = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic1.id}/attributes`, headers: { cookie: ic2.cookie },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().attributes[0].status).toBe("insufficient_signal");

    const probe = await app.inject({
      method: "GET", url: `/api/orgs/${orgId}/members/${ic1.id}/attributes`, headers: { cookie: outsider.cookie },
    });
    expect(probe.statusCode).toBe(404);
  });
});

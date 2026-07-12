// SPEC-002 — Identity & tenancy. Locked to spec (SPEC-QA-001 R3).
import { describe, expect, it } from "vitest";
import { client, post, put, signupUser, uniq } from "../src/client.js";

describe("SPEC-002 AC1+AC2: auth lifecycle", () => {
  it("signup → me → logout → 401 → login → me", async () => {
    const email = `${uniq("ac1")}@it.test`;
    const c = client();
    expect((await c.json("/api/auth/signup", post({ email, password: "password123", name: "AC1" }))).status).toBe(201);
    expect((await c.json("/api/me")).status).toBe(200);
    expect((await c.fetch("/api/auth/logout", { method: "POST" })).status).toBe(204);
    // fresh client: no cookie
    expect((await client().json("/api/me")).status).toBe(401);
    const c2 = client();
    expect((await c2.json("/api/auth/login", post({ email, password: "password123" }))).status).toBe(200);
    expect((await c2.json("/api/me")).status).toBe(200);
  });
  it("wrong password 401; duplicate email 409; short password 400", async () => {
    const email = `${uniq("ac2")}@it.test`;
    await client().json("/api/auth/signup", post({ email, password: "password123", name: "A" }));
    expect((await client().json("/api/auth/login", post({ email, password: "wrong-password" }))).status).toBe(401);
    expect((await client().json("/api/auth/signup", post({ email, password: "password123", name: "B" }))).status).toBe(409);
    expect((await client().json("/api/auth/signup", post({ email: `${uniq("s")}@it.test`, password: "short", name: "C" }))).status).toBe(400);
  });
});

describe("SPEC-002 AC3+AC4: orgs, membership, RBAC edge", () => {
  it("creator owner; member reads; non-member 404; member insufficient role 403", async () => {
    const owner = await signupUser("owner");
    const member = await signupUser("member");
    const outsider = await signupUser("outsider");
    const org = await owner.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "Acme", slug: uniq("acme") }));
    expect(org.status).toBe(201);
    const orgId = org.body.org.id;
    expect((await owner.c.json(`/api/orgs/${orgId}/members`, post({ userId: member.id, role: "member" }))).status).toBe(201);
    expect((await member.c.json(`/api/orgs/${orgId}/members`)).status).toBe(200);
    expect((await outsider.c.json(`/api/orgs/${orgId}/members`)).status).toBe(404);
    const forbidden = await member.c.json<{ error: string }>(`/api/orgs/${orgId}/members`, post({ userId: outsider.id, role: "member" }));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toBe("insufficient_role");
  });
});

describe("SPEC-002 AC5: reporting chain", () => {
  it("chain A→B→C; self-edge 400; cycle 400; null clears", async () => {
    const admin = await signupUser("admin");
    const [a, b, cc] = [await signupUser("a"), await signupUser("b"), await signupUser("c")];
    const org = await admin.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "Rep", slug: uniq("rep") }));
    const orgId = org.body.org.id;
    for (const u of [a, b, cc]) await admin.c.json(`/api/orgs/${orgId}/members`, post({ userId: u.id, role: "member" }));
    const setMgr = (userId: string, managerId: string | null) =>
      admin.c.json<{ error?: string }>(`/api/orgs/${orgId}/reporting`, put({ userId, managerId }));
    expect((await setMgr(a.id, b.id)).status).toBe(200);
    expect((await setMgr(b.id, cc.id)).status).toBe(200);
    const chain = await a.c.json<{ chain: string[] }>(`/api/orgs/${orgId}/reporting/${a.id}/chain`);
    expect(chain.body.chain).toEqual([b.id, cc.id]);
    expect((await setMgr(a.id, a.id)).body.error).toBe("self_edge");
    expect((await setMgr(cc.id, a.id)).body.error).toBe("cycle_detected");
    expect((await setMgr(a.id, null)).status).toBe(200);
    expect((await a.c.json<{ chain: string[] }>(`/api/orgs/${orgId}/reporting/${a.id}/chain`)).body.chain).toEqual([]);
  });
});
// AC6 (migration idempotence) exercised by the harness itself: component runners execute on every boot.

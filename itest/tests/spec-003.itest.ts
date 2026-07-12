// SPEC-003 — Attribute taxonomy & evidence model. Locked to spec (SPEC-QA-001 R3).
import { beforeAll, describe, expect, it } from "vitest";
import { client, post, put, seedAttribute, signupUser, uniq } from "../src/client.js";

let orgId: string;
let ceo: Awaited<ReturnType<typeof signupUser>>, mgr: typeof ceo, ic1: typeof ceo, ic2: typeof ceo, outsider: typeof ceo;

beforeAll(async () => {
  await seedAttribute("leadership", "subjective");
  ceo = await signupUser("ceo"); mgr = await signupUser("mgr");
  ic1 = await signupUser("ic1"); ic2 = await signupUser("ic2"); outsider = await signupUser("out");
  const org = await ceo.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "S3", slug: uniq("s3") }));
  orgId = org.body.org.id;
  for (const u of [mgr, ic1, ic2]) await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: u.id, role: "member" }));
  await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: ic1.id, managerId: mgr.id }));
  await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: mgr.id, managerId: ceo.id }));
});

describe("SPEC-003 AC3: feedback + invariant-1 manager gate", () => {
  it("peer 201; self 400; direct manager 403; transitive manager 403; upward allowed", async () => {
    const fb = (author: typeof ceo, subjectUserId: string, note: string) =>
      author.c.json<{ error?: string; evidence?: { id: string } }>(
        `/api/orgs/${orgId}/feedback`, post({ subjectUserId, attributeKey: "leadership", note }));
    expect((await fb(ic2, ic1.id, "ran the retro")).status).toBe(201);
    expect((await fb(ic1, ic1.id, "self")).body.error).toBe("self_feedback");
    expect((await fb(mgr, ic1.id, "direct")).body.error).toBe("manager_cannot_originate");
    expect((await fb(ceo, ic1.id, "transitive")).body.error).toBe("manager_cannot_originate");
    expect((await fb(ic1, mgr.id, "upward")).status).toBe(201);
  });
});

describe("SPEC-003 AC4: validation rules via proxy", () => {
  it("author own_evidence; subject own_subject; third-party 201; bad outcome 400", async () => {
    const fb = await ic2.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/feedback`, post({ subjectUserId: ic1.id, attributeKey: "leadership", note: "solid" }));
    const evId = fb.body.evidence.id;
    const val = (u: typeof ceo, outcome: string) =>
      u.c.json<{ error?: string }>(`/api/orgs/${orgId}/feedback/${evId}/validations`, post({ outcome }));
    expect((await val(ic2, "yes")).body.error).toBe("own_evidence");
    expect((await val(ic1, "yes")).body.error).toBe("own_subject");
    expect((await val(mgr, "yes")).status).toBe(201);
    expect((await val(ceo, "definitely")).status).toBe(400);
  });
});

describe("SPEC-003 AC5: summary proxy + R5 probing", () => {
  it("member reads; non-member 404; empty user gets empty attribute list, no negative marker", async () => {
    const ok = await ic2.c.json<{ attributes: unknown[] }>(`/api/orgs/${orgId}/members/${ic1.id}/attributes`);
    expect(ok.status).toBe(200);
    expect((await outsider.c.json(`/api/orgs/${orgId}/members/${ic1.id}/attributes`)).status).toBe(404);
    const empty = await ic2.c.json<{ attributes: unknown[] }>(`/api/orgs/${orgId}/members/${ic2.id}/attributes`);
    expect(empty.body.attributes).toEqual([]);
  });
});
// AC1/AC2 (core structural-rule matrix) remain covered white-box in core/tests/domain.rs by spec design
// (core API is server-internal; black-box surface asserts the proxied subset above). AC6: harness boot.

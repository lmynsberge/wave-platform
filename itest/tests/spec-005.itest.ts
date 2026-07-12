// SPEC-005 — Feedback capture & validation flows. Locked to spec (SPEC-QA-001 R3).
import { beforeAll, describe, expect, it } from "vitest";
import { post, put, seedAttribute, signupUser, uniq } from "../src/client.js";

let orgId: string;
let ceo: Awaited<ReturnType<typeof signupUser>>, mgr: typeof ceo, ic1: typeof ceo, ic2: typeof ceo, admin: typeof ceo, root_report: typeof ceo;

beforeAll(async () => {
  await seedAttribute("mentorship", "subjective");
  ceo = await signupUser("ceo5"); mgr = await signupUser("mgr5");
  ic1 = await signupUser("ic1x"); ic2 = await signupUser("ic2x");
  admin = await signupUser("adm5"); root_report = await signupUser("rr5");
  const org = await ceo.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "S5", slug: uniq("s5") }));
  orgId = org.body.org.id;
  for (const [u, role] of [[mgr, "member"], [ic1, "member"], [ic2, "member"], [admin, "admin"], [root_report, "member"]] as const) {
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: u.id, role }));
  }
  await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: ic1.id, managerId: mgr.id }));
  await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: mgr.id, managerId: ceo.id }));
  await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: root_report.id, managerId: ceo.id }));
});

describe("SPEC-005 AC1+AC2: validation queue and inbox", () => {
  it("queue holds unvalidated report evidence, clears on validation; inbox anonymous with state", async () => {
    const fb = await ic2.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/feedback`, post({ subjectUserId: ic1.id, attributeKey: "mentorship", note: "paired patiently" }));
    const evId = fb.body.evidence.id;
    let q = await mgr.c.json<{ items: Array<{ evidenceId: string; authorUserId?: string }> }>(`/api/orgs/${orgId}/validation-queue`);
    const item = q.body.items.find((i) => i.evidenceId === evId);
    expect(item).toBeDefined();
    expect(item?.authorUserId).toBeUndefined();

    const inbox = await ic1.c.json<{ items: Array<{ evidenceId: string; authorKnown: boolean; authorUserId?: string; state: string }> }>(`/api/orgs/${orgId}/inbox`);
    const mine = inbox.body.items.find((i) => i.evidenceId === evId);
    expect(mine?.authorKnown).toBe(true);
    expect(mine?.authorUserId).toBeUndefined();
    expect(mine?.state).toBe("active");

    await mgr.c.json(`/api/orgs/${orgId}/feedback/${evId}/validations`, post({ outcome: "yes" }));
    q = await mgr.c.json(`/api/orgs/${orgId}/validation-queue`);
    expect(q.body.items.find((i) => i.evidenceId === evId)).toBeUndefined();
  });
});

describe("SPEC-005 AC3+AC4+AC6: assessments and the upward chain", () => {
  it("non-manager 403; pending invisible; yes activates; no leaves summary byte-identical; double-decide 409", async () => {
    const notMgr = await ic2.c.json<{ error: string }>(
      `/api/orgs/${orgId}/assessments`, post({ subjectUserId: ic1.id, attributeKey: "mentorship", note: "x" }));
    expect(notMgr.status).toBe(403);

    const summary = () => mgr.c.json(`/api/orgs/${orgId}/members/${ic1.id}/attributes`);
    const before = JSON.stringify((await summary()).body);

    const a1 = await mgr.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/assessments`, post({ subjectUserId: ic1.id, attributeKey: "mentorship", note: "grows juniors" }));
    expect(a1.status).toBe(201);
    const ev1 = a1.body.evidence.id;
    expect(JSON.stringify((await summary()).body)).toBe(before); // pending invisible

    const uq = await ceo.c.json<{ items: Array<{ evidenceId: string }> }>(`/api/orgs/${orgId}/upward-queue`);
    expect(uq.body.items.map((i) => i.evidenceId)).toContain(ev1);
    expect((await mgr.c.json(`/api/orgs/${orgId}/assessments/${ev1}/decision`, post({ outcome: "yes" }))).status).toBe(403); // author

    expect((await ceo.c.json<{ state: string }>(`/api/orgs/${orgId}/assessments/${ev1}/decision`, post({ outcome: "yes" }))).body.state).toBe("active");
    expect(JSON.stringify((await summary()).body)).not.toBe(before);
    expect((await ceo.c.json(`/api/orgs/${orgId}/assessments/${ev1}/decision`, post({ outcome: "no" }))).status).toBe(409);

    // upward NO → traceless
    const a2 = await mgr.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/assessments`, post({ subjectUserId: ic1.id, attributeKey: "mentorship", note: "overstated" }));
    const base2 = JSON.stringify((await summary()).body);
    expect((await ceo.c.json<{ state: string }>(`/api/orgs/${orgId}/assessments/${a2.body.evidence.id}/decision`, post({ outcome: "no" }))).body.state).toBe("dropped");
    expect(JSON.stringify((await summary()).body)).toBe(base2);
  });
});

describe("SPEC-005 AC5: root-author assessments decided by admin", () => {
  it("ceo assessment lands in admin upward queue; admin decides; ceo cannot", async () => {
    const a = await ceo.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/assessments`, post({ subjectUserId: root_report.id, attributeKey: "mentorship", note: "root view" }));
    const evId = a.body.evidence.id;
    const uq = await admin.c.json<{ items: Array<{ evidenceId: string }> }>(`/api/orgs/${orgId}/upward-queue`);
    expect(uq.body.items.map((i) => i.evidenceId)).toContain(evId);
    expect((await ceo.c.json(`/api/orgs/${orgId}/assessments/${evId}/decision`, post({ outcome: "yes" }))).status).toBe(403);
    expect((await admin.c.json(`/api/orgs/${orgId}/assessments/${evId}/decision`, post({ outcome: "yes" }))).status).toBe(201);
  });
});

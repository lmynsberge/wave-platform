// SPEC-004 — Significance engine. Locked to spec (SPEC-QA-001 R3).
import { beforeAll, describe, expect, it } from "vitest";
import { client, post, put, seedAttribute, signupUser, uniq, CORE } from "../src/client.js";

interface Attr {
  key: string; status: string; score: number | null;
  distinctValidators: number; validations: { yes: number; no: number; noSignal: number };
}

let orgId: string;
let ceo: Awaited<ReturnType<typeof signupUser>>;
const subjSummary = async (viewer: typeof ceo, userId: string, key: string): Promise<Attr | undefined> => {
  const r = await viewer.c.json<{ attributes: Attr[] }>(`/api/orgs/${orgId}/members/${userId}/attributes`);
  return r.body.attributes.find((a) => a.key === key);
};

beforeAll(async () => {
  await seedAttribute("collaboration", "subjective");
  ceo = await signupUser("ceo4");
  const org = await ceo.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "S4", slug: uniq("s4") }));
  orgId = org.body.org.id;
});

describe("SPEC-004 AC1+AC2+AC3: thresholds, diversity gate, drop-not-negative", () => {
  it("volume without diversity stays insufficient; 5/3 → emerging; validators establish; manager-no dropped", async () => {
    const subject = await signupUser("subject4");
    const mgr = await signupUser("mgr4");
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: subject.id, role: "member" }));
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: mgr.id, role: "member" }));
    await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: subject.id, managerId: mgr.id }));

    // AC2: two authors, many evidence → still insufficient
    const twoAuthors = [await signupUser("a4"), await signupUser("b4")];
    for (const u of twoAuthors) await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: u.id, role: "member" }));
    const evIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await twoAuthors[i % 2]!.c.json<{ evidence: { id: string } }>(
        `/api/orgs/${orgId}/feedback`, post({ subjectUserId: subject.id, attributeKey: "collaboration", note: `n${i}` }));
      evIds.push(r.body.evidence.id);
    }
    expect((await subjSummary(ceo, subject.id, "collaboration"))?.status).toBe("insufficient_signal");

    // AC1: third distinct author tips it to emerging (now 7 evidence / 3 authors); score still null
    const third = await signupUser("c4");
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: third.id, role: "member" }));
    const r7 = await third.c.json<{ evidence: { id: string } }>(
      `/api/orgs/${orgId}/feedback`, post({ subjectUserId: subject.id, attributeKey: "collaboration", note: "n7" }));
    evIds.push(r7.body.evidence.id);
    let a = await subjSummary(ceo, subject.id, "collaboration");
    expect(a?.status).toBe("emerging");
    expect(a?.score).toBeNull();

    // AC3: 3 peer-yes + 2 manager-no (5 distinct validators) → established, score 100
    const peers = [await signupUser("p1"), await signupUser("p2"), await signupUser("p3")];
    for (const p of peers) await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: p.id, role: "member" }));
    await peers[0]!.c.json(`/api/orgs/${orgId}/feedback/${evIds[0]}/validations`, post({ outcome: "yes" }));
    await peers[1]!.c.json(`/api/orgs/${orgId}/feedback/${evIds[1]}/validations`, post({ outcome: "yes" }));
    await peers[2]!.c.json(`/api/orgs/${orgId}/feedback/${evIds[2]}/validations`, post({ outcome: "yes" }));
    await mgr.c.json(`/api/orgs/${orgId}/feedback/${evIds[3]}/validations`, post({ outcome: "no" }));   // manager_chain
    await ceo.c.json(`/api/orgs/${orgId}/feedback/${evIds[4]}/validations`, post({ outcome: "no" }));   // transitive manager? ceo has no edge — peer!
    a = await subjSummary(ceo, subject.id, "collaboration");
    // ceo is NOT in subject's chain (subject→mgr only), so ceo's no counts: 3 yes / (3+1) = 75
    expect(a?.status).toBe("established");
    expect(a?.score).toBe(75);
    expect(a?.validations.no).toBe(2); // raw transparency

    // and a manager-chain no did NOT hurt: remove ambiguity by adding one more mgr no on a fresh evidence
    await mgr.c.json(`/api/orgs/${orgId}/feedback/${evIds[5]}/validations`, post({ outcome: "no" }));
    const after = await subjSummary(ceo, subject.id, "collaboration");
    expect(after?.score).toBe(75); // unchanged (dropped)
  });
});

describe("SPEC-004 AC4: objective datapoints", () => {
  it("1 datapoint emerging/null; 3 established with mean", async () => {
    await seedAttribute("hours4", "objective");
    const subject = await signupUser("obj4");
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: subject.id, role: "member" }));
    const addObj = (v: number) =>
      fetch(`${CORE()}/v1/evidence`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId, subjectUserId: subject.id, authorUserId: null, attributeKey: "hours4", valueNumeric: v }),
      });
    await addObj(100);
    let a = await subjSummary(ceo, subject.id, "hours4");
    expect(a?.status).toBe("emerging");
    expect(a?.score).toBeNull();
    await addObj(120); await addObj(140);
    a = await subjSummary(ceo, subject.id, "hours4");
    expect(a?.status).toBe("established");
    expect(a?.score).toBe(120);
  });
});

describe("SPEC-004 AC5: policy endpoint", () => {
  it("authed policy matches active thresholds; anonymous 401", async () => {
    expect((await client().json("/api/signal-policy")).status).toBe(401);
    const p = await ceo.c.json<{ subjective: { emerging: { minEvidence: number } } }>("/api/signal-policy");
    expect(p.status).toBe(200);
    expect(p.body.subjective.emerging.minEvidence).toBe(5);
  });
});
// AC6 (relationship forwarding mechanics) covered white-box in server/test/feedback.test.ts by spec design;
// its observable effect (manager-no dropped from score) is asserted black-box above.

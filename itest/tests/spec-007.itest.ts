// SPEC-007 — Segmented chat companion (API). Locked to spec (SPEC-QA-001 R3).
// WRITTEN PRE-IMPLEMENTATION (TDD per SPEC-QA-001 R4): red at spec review, green defines done.
import { beforeAll, describe, expect, it } from "vitest";
import { post, put, signupUser, uniq } from "../src/client.js";

interface Message { id: string; role: "user" | "companion"; content: string; seq: number }
interface Companion { segmentId: string; messages: Message[] }
interface Share { id: string; content: string; createdAt: string }

let orgId: string;
let ceo: Awaited<ReturnType<typeof signupUser>>, mgr: typeof ceo, alice: typeof ceo, quietQuinn: typeof ceo, privatePat: typeof ceo, adminOutside: typeof ceo;

const companion = (u: typeof ceo) => u.c.json<Companion>(`/api/orgs/${orgId}/companion`);
const say = (u: typeof ceo, content: string) =>
  u.c.json<{ reply: Message }>(`/api/orgs/${orgId}/companion/messages`, post({ content }));
const share = (u: typeof ceo, messageId: string) =>
  u.c.json<{ share: Share; error?: string }>(`/api/orgs/${orgId}/companion/share`, post({ messageId }));
const sharesOf = (viewer: typeof ceo, userId: string) =>
  viewer.c.json<{ shares: Share[] }>(`/api/orgs/${orgId}/members/${userId}/shares`);

beforeAll(async () => {
  ceo = await signupUser("ceo7"); mgr = await signupUser("mgr7");
  alice = await signupUser("alice7"); quietQuinn = await signupUser("quinn7");
  privatePat = await signupUser("pat7"); adminOutside = await signupUser("admout7");
  const org = await ceo.c.json<{ org: { id: string } }>("/api/orgs", post({ name: "S7", slug: uniq("s7") }));
  orgId = org.body.org.id;
  for (const [u, role] of [[mgr, "member"], [alice, "member"], [quietQuinn, "member"], [privatePat, "member"], [adminOutside, "admin"]] as const) {
    await ceo.c.json(`/api/orgs/${orgId}/members`, post({ userId: u.id, role }));
  }
  // alice → mgr → ceo; quinn and pat also report to mgr; adminOutside has NO chain relation to them
  for (const [u, m] of [[alice, mgr], [quietQuinn, mgr], [privatePat, mgr], [mgr, ceo]] as const) {
    await ceo.c.json(`/api/orgs/${orgId}/reporting`, put({ userId: u.id, managerId: m.id }));
  }
});

describe("SPEC-007 AC1: private segment lifecycle and isolation", () => {
  it("first GET creates a segment with an opening question; second GET is stable; segments never cross users", async () => {
    const first = await companion(alice);
    expect(first.status).toBe(200);
    expect(first.body.messages).toHaveLength(1);
    expect(first.body.messages[0]!.role).toBe("companion");
    const again = await companion(alice);
    expect(again.body.segmentId).toBe(first.body.segmentId);

    const ceos = await companion(ceo); // even the org owner only ever reaches their OWN segment
    expect(ceos.body.segmentId).not.toBe(first.body.segmentId);
    expect(ceos.body.messages[0]!.role).toBe("companion");
  });
});

describe("SPEC-007 AC2: guided interview loop", () => {
  it("answers advance through the sequence; the 7th yields a synthesis quoting the user; cycle restarts", async () => {
    const answers = [
      "feeling steady", "reflecting on ownership", "shipped the tide meter",
      "learned to trust thresholds", "hard part was the reset", "paired well with sam", "adopt red-first tests",
    ];
    let lastReply: Message | null = null;
    for (const a of answers) {
      const r = await say(alice, a);
      expect(r.status).toBe(201);
      lastReply = r.body.reply;
    }
    // 7th reply is the synthesis and must weave the user's own words
    expect(lastReply!.content).toContain("tide meter");
    expect(lastReply!.content).toContain("red-first");
    const next = await say(alice, "starting a fresh week");
    expect(next.status).toBe(201);
    expect(next.body.reply.content).not.toContain("tide meter"); // cycle restarted: a question, not another synthesis
  });
  it("empty message is a 400", async () => {
    expect((await say(alice, "")).status).toBe(400);
  });
});

describe("SPEC-007 AC3+AC4: share-forward with chain visibility and copy semantics", () => {
  let synthesisId: string;
  it("manager sees nothing before a share; the shared synthesis after; transitive chain sees it; outside admin gets 404", async () => {
    const before = await sharesOf(mgr, alice.id);
    expect(before.status).toBe(200);
    expect(before.body.shares).toEqual([]);

    const conv = await companion(alice);
    const synthesis = conv.body.messages.filter((m) => m.role === "companion").at(-2)!; // last companion msg before restart question
    synthesisId = synthesis.id;
    const s = await share(alice, synthesisId);
    expect(s.status).toBe(201);

    const mgrView = await sharesOf(mgr, alice.id);
    expect(mgrView.body.shares).toHaveLength(1);
    expect(mgrView.body.shares[0]!.content).toContain("tide meter");
    const ceoView = await sharesOf(ceo, alice.id); // transitive
    expect(ceoView.body.shares).toHaveLength(1);
    expect((await sharesOf(adminOutside, alice.id)).status).toBe(404); // admin outside chain: existence denied
    expect((await sharesOf(alice, alice.id)).status).toBe(200); // self always
  });
  it("shares are copies: further conversation never mutates a share", async () => {
    const snapshot = (await sharesOf(mgr, alice.id)).body.shares[0]!.content;
    for (const m of ["a", "b", "c", "d", "e", "f", "g"]) await say(alice, `later ${m}`);
    expect((await sharesOf(mgr, alice.id)).body.shares[0]!.content).toBe(snapshot);
  });
});

describe("SPEC-007 AC5: invariant-4 byte parity", () => {
  it("a heavy private user who shared nothing is byte-identical to a never-used user", async () => {
    // pat uses the companion heavily, shares nothing; quinn never opens it
    await companion(privatePat);
    for (const m of ["one", "two", "three", "four"]) await say(privatePat, m);
    const patView = await sharesOf(mgr, privatePat.id);
    const quinnView = await sharesOf(mgr, quietQuinn.id);
    expect(patView.status).toBe(200);
    expect(JSON.stringify(patView.body)).toBe(JSON.stringify(quinnView.body));
  });
});

describe("SPEC-007 AC6: request hygiene", () => {
  it("foreign messageId 400; unauthenticated 401", async () => {
    const conv = await companion(alice);
    const someMsg = conv.body.messages[0]!.id;
    const foreign = await share(ceo, someMsg); // ceo trying to share alice's message from ceo's own account
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toBe("unknown_message");
    const { client } = await import("../src/client.js");
    expect((await client().json(`/api/orgs/${orgId}/companion`)).status).toBe(401);
  });
});

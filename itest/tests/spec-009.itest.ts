// SPEC-009 — Nudges. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, seedAttribute, uniq } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface Gap { attributeKey: string; status: string; suggestedRecipients: Array<{ userId: string; name: string }> }
interface Ask { id: string; requester: { userId: string; name: string }; attributeKey: string }
interface OutReq { id: string; recipientId: string; attributeKey: string; status: string }

let fx: Fixture;
let attrKey: string;

const nudges = (u: Fixture["owner"]) => u.c.json<{ gaps: Gap[] }>(`/api/orgs/${fx.orgId}/nudges`);
const request = (u: Fixture["owner"], recipientId: string, attributeKey: string) =>
  u.c.json<{ request: OutReq; error?: string }>(`/api/orgs/${fx.orgId}/feedback-requests`, post({ recipientId, attributeKey }));
const asks = (u: Fixture["owner"]) => u.c.json<{ asks: Ask[] }>(`/api/orgs/${fx.orgId}/asks`);
const outgoing = (u: Fixture["owner"]) => u.c.json<{ requests: OutReq[] }>(`/api/orgs/${fx.orgId}/feedback-requests`);

beforeAll(async () => {
  attrKey = uniq("facilitation");
  await seedAttribute(attrKey, "subjective");
  fx = await orgWithChain("s9", [
    { name: "mgr" }, { name: "subject" }, { name: "author1" }, { name: "fresh1" }, { name: "fresh2" },
  ]);
  await fx.setManager("subject", "mgr");
  // seed one piece of evidence so 'subject' has a below-established attribute row
  await fx.members.author1!.c.json(
    `/api/orgs/${fx.orgId}/feedback`,
    post({ subjectUserId: fx.members.subject!.id, attributeKey: attrKey, note: "ran the workshop" }),
  );
});

describe("SPEC-009 AC1+AC5: gap feed, suggestion exclusions, self-scoping", () => {
  it("gap lists the attribute; suggestions exclude self, upward chain, and existing authors", async () => {
    const r = await nudges(fx.members.subject!);
    expect(r.status).toBe(200);
    const gap = r.body.gaps.find((g) => g.attributeKey === attrKey);
    expect(gap).toBeDefined();
    expect(gap!.status).not.toBe("established");
    const ids = gap!.suggestedRecipients.map((s) => s.userId);
    expect(ids).toContain(fx.members.fresh1!.id);
    expect(ids).not.toContain(fx.members.subject!.id);   // self
    expect(ids).not.toContain(fx.members.mgr!.id);       // direct manager
    expect(ids).toContain(fx.owner.id);                  // owner is NOT in subject's chain → eligible per R2
    expect(ids).not.toContain(fx.members.author1!.id);   // existing author
  });
  it("routes are self-scoped: another member's nudges are not addressable", async () => {
    // No userId parameter exists; each caller sees only their own. A different member's view differs.
    const other = await nudges(fx.members.fresh2!);
    expect(other.body.gaps.find((g) => g.attributeKey === attrKey)).toBeUndefined();
  });
});

describe("SPEC-009 AC3: request validity rules", () => {
  it("self, managers (direct+transitive), and non-members are invalid; duplicates 409", async () => {
    const subject = fx.members.subject!;
    expect((await request(subject, subject.id, attrKey)).body.error).toBe("invalid_recipient");
    expect((await request(subject, fx.members.mgr!.id, attrKey)).body.error).toBe("invalid_recipient");
    // make the chain transitive: mgr → owner, then owner is transitive manager of subject
    await fx.setManager("mgr", "fresh2"); // fresh2 becomes transitive manager of subject
    expect((await request(subject, fx.members.fresh2!.id, attrKey)).body.error).toBe("invalid_recipient");
    await fx.setManager("mgr", null);

    const stranger = await client();
    const outsider = await (async () => {
      const email = `${uniq("out9")}@it.test`;
      const res = await stranger.json<{ user: { id: string } }>("/api/auth/signup", post({ email, password: "password123", name: "out9" }));
      return res.body.user.id;
    })();
    expect((await request(subject, outsider, attrKey)).body.error).toBe("not_member");

    expect((await request(subject, fx.members.fresh1!.id, attrKey)).status).toBe(201);
    expect((await request(subject, fx.members.fresh1!.id, attrKey)).status).toBe(409);
  });
});

describe("SPEC-009 AC2+AC4: asks, outgoing, behavioral fulfillment", () => {
  it("recipient sees the ask with requester name; fulfillment via actual feedback clears it", async () => {
    const subject = fx.members.subject!;
    const fresh1 = fx.members.fresh1!;
    const askList = await asks(fresh1);
    const mine = askList.body.asks.find((a) => a.attributeKey === attrKey);
    expect(mine).toBeDefined();
    expect(mine!.requester.userId).toBe(subject.id);

    let out = await outgoing(subject);
    expect(out.body.requests.find((r) => r.recipientId === fresh1.id)!.status).toBe("open");

    // R5: fulfillment is behavioral — fresh1 simply gives the feedback
    const fb = await fresh1.c.json(
      `/api/orgs/${fx.orgId}/feedback`,
      post({ subjectUserId: subject.id, attributeKey: attrKey, note: "clear facilitator in the retro" }),
    );
    expect(fb.status).toBe(201);

    const after = await asks(fresh1);
    expect(after.body.asks.find((a) => a.attributeKey === attrKey && a.requester.userId === subject.id)).toBeUndefined();
    out = await outgoing(subject);
    expect(out.body.requests.find((r) => r.recipientId === fresh1.id)!.status).toBe("fulfilled");
  });
});

describe("SPEC-009 AC6: auth", () => {
  it("anonymous 401 on all four routes", async () => {
    const anon = client();
    for (const [method, path] of [
      ["GET", "nudges"], ["GET", "asks"], ["GET", "feedback-requests"],
    ] as const) {
      expect((await anon.json(`/api/orgs/${fx.orgId}/${path}`, method === "GET" ? {} : post({}))).status).toBe(401);
    }
    expect((await anon.json(`/api/orgs/${fx.orgId}/feedback-requests`, post({ recipientId: fx.owner.id, attributeKey: attrKey }))).status).toBe(401);
  });
});

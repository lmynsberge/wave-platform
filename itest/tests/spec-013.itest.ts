// SPEC-013 — Outbound nudge delivery. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orgWithChain, post, seedAttribute, signupUser, uniq, SERVER } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface Delivery { externalId: string; text: string }

let fx: Fixture;
let attrKey: string;
let listener: Server;
const deliveries: Delivery[] = [];

async function bridgeIn(externalId: string, text: string) {
  await fetch(`${SERVER()}/api/bridge/test/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Bridge-Secret": "itest-bridge-secret" },
    body: JSON.stringify({ externalId, text }),
  });
}
const dispatch = (u: Fixture["owner"]) =>
  u.c.json<{ notified: number }>(`/api/orgs/${fx.orgId}/nudge-dispatch`, post({}));
const settle = () => new Promise((r) => setTimeout(r, 150));

beforeAll(async () => {
  listener = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      deliveries.push(JSON.parse(raw) as Delivery);
      res.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((r) => listener.listen(8189, "127.0.0.1", r));

  attrKey = uniq("planning");
  await seedAttribute(attrKey, "subjective");
  fx = await orgWithChain("s13", [{ name: "linkedGap" }, { name: "unlinkedGap" }, { name: "askHaver" }, { name: "author" }, { name: "plain" }]);

  // gaps for linkedGap and unlinkedGap (one piece of evidence each → below established)
  for (const name of ["linkedGap", "unlinkedGap"]) {
    await fx.members.author!.c.json(`/api/orgs/${fx.orgId}/feedback`,
      post({ subjectUserId: fx.members[name]!.id, attributeKey: attrKey, note: `plans well (${name})` }));
  }
  // open ask for askHaver
  await fx.members.author!.c.json(`/api/orgs/${fx.orgId}/feedback-requests`,
    post({ recipientId: fx.members.askHaver!.id, attributeKey: attrKey }));

  // link linkedGap and askHaver; leave unlinkedGap unlinked
  for (const name of ["linkedGap", "askHaver"] as const) {
    const code = (await fx.members[name]!.c.json<{ code: string }>(`/api/bridge/link-codes`, post({ orgId: fx.orgId }))).body.code;
    await bridgeIn(`ext-${name}`, `link ${code}`);
  }
  deliveries.length = 0; // ignore any linking chatter
});

afterAll(() => new Promise<void>((r) => listener.close(() => r())));

describe("SPEC-013 AC5: trigger authz", () => {
  it("member 403; anonymous 401", async () => {
    expect((await fx.members.plain!.c.json(`/api/orgs/${fx.orgId}/nudge-dispatch`, post({}))).status).toBe(403);
    const anon = await signupUser("anon13"); // fresh user, not a member → 404 per SPEC-002 semantics
    expect((await anon.c.json(`/api/orgs/${fx.orgId}/nudge-dispatch`, post({}))).status).toBe(404);
    const raw = await fetch(`${SERVER()}/api/orgs/${fx.orgId}/nudge-dispatch`, { method: "POST" });
    expect(raw.status).toBe(401);
  });
});

describe("SPEC-013 AC1+AC2+AC3+AC6: dispatch delivers to linked owners only", () => {
  it("gap holder gets a checkin invite, ask haver gets an asks reminder, unlinked gets nothing, closed response", async () => {
    const r = await dispatch(fx.owner);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body)).toEqual(["notified"]); // R3 closed schema
    expect(r.body.notified).toBeGreaterThanOrEqual(2);
    await settle();

    const toLinkedGap = deliveries.filter((d) => d.externalId === "ext-linkedGap");
    expect(toLinkedGap.length).toBeGreaterThanOrEqual(1);
    expect(toLinkedGap.some((d) => d.text.includes("checkin"))).toBe(true);

    const toAskHaver = deliveries.filter((d) => d.externalId === "ext-askHaver");
    expect(toAskHaver.some((d) => d.text.includes("asks"))).toBe(true);

    // AC3+AC6: only the two linked identities ever appear
    const ids = new Set(deliveries.map((d) => d.externalId));
    expect([...ids].sort()).toEqual(["ext-askHaver", "ext-linkedGap"]);
  });
});

describe("SPEC-013 AC4: dedup window", () => {
  it("immediate re-dispatch notifies zero and delivers nothing new", async () => {
    const before = deliveries.length;
    const r = await dispatch(fx.owner);
    expect(r.body.notified).toBe(0);
    await settle();
    expect(deliveries.length).toBe(before);
  });
});

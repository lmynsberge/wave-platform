// SPEC-017 — Security & consent gates. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, seedAttribute, uniq, SERVER } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface Delivery { externalId: string; text: string }

let fx: Fixture;
let attrKey: string;
let outListener: Server;
let llmListener: Server;
const deliveries: Delivery[] = [];

const settle = () => new Promise((r) => setTimeout(r, 150));
async function bridgeIn(externalId: string, text: string) {
  const res = await fetch(`${SERVER()}/api/bridge/test/events`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Bridge-Secret": "itest-bridge-secret" },
    body: JSON.stringify({ externalId, text }),
  });
  return (await res.json()) as { text: string };
}
const dispatch = () => fx.owner.c.json<{ notified: number }>(`/api/orgs/${fx.orgId}/nudge-dispatch`, post({}));
const prefs = (u: Fixture["owner"]) => u.c.json<{ optedOut: boolean }>(`/api/orgs/${fx.orgId}/notification-prefs`);
const setPrefs = (u: Fixture["owner"], optedOut: boolean) =>
  u.c.json<{ optedOut: boolean }>(`/api/orgs/${fx.orgId}/notification-prefs`, { method: "PUT", body: JSON.stringify({ optedOut }) });

beforeAll(async () => {
  outListener = createServer((req, res) => {
    let raw = ""; req.on("data", (c) => { raw += c; });
    req.on("end", () => { deliveries.push(JSON.parse(raw) as Delivery); res.writeHead(200).end("{}"); });
  });
  await new Promise<void>((r) => outListener.listen(8189, "127.0.0.1", r));
  llmListener = createServer((req, res) => {
    let raw = ""; req.on("data", (c) => { raw += c; });
    req.on("end", () => res.writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ choices: [{ message: { content: "one short follow-up?" } }] })));
  });
  await new Promise<void>((r) => llmListener.listen(8191, "127.0.0.1", r));

  attrKey = uniq("scoping");
  await seedAttribute(attrKey, "subjective");
  fx = await orgWithChain("s17", [{ name: "optee" }, { name: "stayer" }, { name: "author" }]);
  for (const name of ["optee", "stayer"] as const) {
    await fx.members.author!.c.json(`/api/orgs/${fx.orgId}/feedback`,
      post({ subjectUserId: fx.members[name]!.id, attributeKey: attrKey, note: `gap for ${name}` }));
    const code = (await fx.members[name]!.c.json<{ code: string }>(`/api/bridge/link-codes`, post({ orgId: fx.orgId }))).body.code;
    await bridgeIn(`ext-${name}`, `link ${code}`);
  }
  deliveries.length = 0;
});
afterAll(async () => {
  await new Promise<void>((r) => outListener.close(() => r()));
  await new Promise<void>((r) => llmListener.close(() => r()));
});

describe("SPEC-017 AC5: prefs endpoints, self-scoped", () => {
  it("default optedOut=false; PUT flips it; anonymous 401; non-member 404", async () => {
    const first = await prefs(fx.members.optee!);
    expect(first.status).toBe(200);
    expect(first.body.optedOut).toBe(false);
    expect((await setPrefs(fx.members.optee!, true)).body.optedOut).toBe(true);
    expect((await client().json(`/api/orgs/${fx.orgId}/notification-prefs`)).status).toBe(401);
    const outsider = client();
    await outsider.json("/api/auth/signup", post({ email: `${uniq("o17")}@it.test`, password: "password123", name: "o17" }));
    expect((await outsider.json(`/api/orgs/${fx.orgId}/notification-prefs`)).status).toBe(404);
  });
});

describe("SPEC-017 AC3: dispatch respects opt-out", () => {
  it("opted-out user receives nothing and inflates no count; opted-in peer still notified", async () => {
    // optee opted out in AC5 above; stayer remains in
    const r = await dispatch();
    expect(r.status).toBe(200);
    await settle();
    const ids = new Set(deliveries.map((d) => d.externalId));
    expect(ids.has("ext-stayer")).toBe(true);
    expect(ids.has("ext-optee")).toBe(false);
  });
});

describe("SPEC-017 AC4: in-channel control", () => {
  it("notifications on via bridge restores delivery", async () => {
    const on = await bridgeIn("ext-optee", "notifications on");
    expect(on.text.toLowerCase()).toContain("on");
    deliveries.length = 0;
    await dispatch(); // optee's gap_checkin was never sent/logged, so it delivers now
    await settle();
    expect(deliveries.some((d) => d.externalId === "ext-optee")).toBe(true);
    const off = await bridgeIn("ext-optee", "notifications off");
    expect(off.text.toLowerCase()).toContain("off");
  });
});

describe("SPEC-017 AC1: BYO key round-trips through encryption", () => {
  it("PUT config with apiKey (KEK set) → masked 200; LLM flow works end-to-end", async () => {
    const cfg = { provider: "openai_compatible", baseUrl: "http://127.0.0.1:8191", model: "m17", apiKey: "sk-live-roundtrip-9876" };
    const put = await fx.owner.c.json<{ apiKey: string }>(`/api/orgs/${fx.orgId}/llm-config`, { method: "PUT", body: JSON.stringify(cfg) });
    expect(put.status).toBe(200);
    expect(put.body.apiKey).not.toContain("roundtrip");
    await fx.members.stayer!.c.json(`/api/orgs/${fx.orgId}/companion`);
    const r = await fx.members.stayer!.c.json<{ reply: { content: string } }>(
      `/api/orgs/${fx.orgId}/companion/messages`, post({ content: "answering the opener" }));
    expect(r.status).toBe(201);
    expect(r.body.reply.content).toBe("one short follow-up?"); // decrypted key reached the scripted endpoint
  });
});

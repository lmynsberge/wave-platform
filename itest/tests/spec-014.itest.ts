// SPEC-014 — LLM companion provider. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orgWithChain, post, uniq } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;

// --- scriptable OpenAI-compatible endpoint ---
interface Captured { body: { model: string; messages: Array<{ role: string; content: string }> }; auth?: string }
const captured: Captured[] = [];
let script: Array<{ status?: number; content?: string }> = [];
let llmServer: Server;

const SKELETON_Q2 = "What's on your mind when you look back at this stretch of work?";

let fx: Fixture;
const say = (u: Fixture["owner"], content: string) =>
  u.c.json<{ reply: { content: string } }>(`/api/orgs/${fx.orgId}/companion/messages`, post({ content }));

beforeAll(async () => {
  llmServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      captured.push({ body: JSON.parse(raw), auth: req.headers.authorization });
      const step = script.shift() ?? {};
      if (step.status && step.status !== 200) { res.writeHead(step.status).end("{}"); return; }
      res.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ choices: [{ message: { content: step.content ?? "scripted default" } }] }));
    });
  });
  await new Promise<void>((r) => llmServer.listen(8190, "127.0.0.1", r));
  fx = await orgWithChain("s14", [{ name: "alice" }, { name: "bob" }, { name: "plain" }]);
});
afterAll(() => new Promise<void>((r) => llmServer.close(() => r())));

describe("SPEC-014 AC6: BYO config authz + masking", () => {
  it("member PUT 403; admin PUT 200; GET masks the key", async () => {
    const cfg = { provider: "openai_compatible", baseUrl: "http://127.0.0.1:8190", model: "test-model", apiKey: "sk-secret-abcd1234" };
    expect((await fx.members.plain!.c.json(`/api/orgs/${fx.orgId}/llm-config`, { method: "PUT", body: JSON.stringify(cfg) })).status).toBe(403);
    const put = await fx.owner.c.json<{ apiKey: string }>(`/api/orgs/${fx.orgId}/llm-config`, { method: "PUT", body: JSON.stringify(cfg) });
    expect(put.status).toBe(200);
    expect(put.body.apiKey).not.toContain("secret");
    const get = await fx.owner.c.json<{ apiKey: string; model: string }>(`/api/orgs/${fx.orgId}/llm-config`);
    expect(get.body.model).toBe("test-model");
    expect(get.body.apiKey).toContain("1234");
    expect(get.body.apiKey).not.toContain("sk-secret-abcd1234");
  });
});

describe("SPEC-014 AC1+AC3: hybrid flow with placeholder restore", () => {
  it("skeleton answer → scripted follow-up (restored); follow-up answer → skeleton Q2 verbatim", async () => {
    const alice = fx.members.alice!;
    await alice.c.json(`/api/orgs/${fx.orgId}/companion`); // opens with skeleton Q1
    script = [{ content: "You mentioned energy — what's giving [P1] that steadiness?" }];
    const r1 = await say(alice, "feeling steady and clear");
    expect(r1.body.reply.content).toContain("what's giving");
    expect(r1.body.reply.content).not.toContain("[P1]"); // AC3: restored
    const r2 = await say(alice, "mostly good sleep honestly");
    expect(r2.body.reply.content).toBe(SKELETON_Q2); // deterministic skeleton resumes
  });
});

describe("SPEC-014 AC2: redaction on the wire", () => {
  it("captured LLM requests never contain member names or emails", async () => {
    const alice = fx.members.alice!;
    const bobName = "s14-bob"; // orgWithChain names users `${prefix}-${name}`
    captured.length = 0;
    script = [{ content: "noted." }];
    await say(alice, `working closely with ${bobName}, reach him at bob@example.com`);
    expect(captured.length).toBeGreaterThanOrEqual(1);
    const wire = JSON.stringify(captured.map((c) => c.body));
    expect(wire).not.toContain(bobName);
    expect(wire).not.toContain("bob@example.com");
    expect(wire).toContain("[P");
    expect(wire).toContain("[EMAIL]");
  });
});

describe("SPEC-014 AC4: fail-closed to guided", () => {
  it("LLM 500 → the turn yields the guided next question, not an error — and the LLM WAS attempted", async () => {
    const alice = fx.members.alice!;
    captured.length = 0;
    script = [{ status: 500 }];
    const r = await say(alice, "shipped the ingestion gateway");
    expect(r.status).toBe(201);
    expect(captured.length).toBeGreaterThanOrEqual(1); // proves the LLM path ran and failed closed (red pre-impl)
    expect(r.body.reply.content.length).toBeGreaterThan(10);
    expect(r.body.reply.content.toLowerCase()).not.toContain("error");
  });
});

describe("SPEC-014 AC5: synthesis guard", () => {
  it("non-conforming LLM synthesis is replaced by the deterministic one (marker always present)", async () => {
    // fresh user completes a full interview with the LLM scripted to misbehave at synthesis
    const code = uniq("x"); void code;
    const bob = fx.members.bob!;
    await bob.c.json(`/api/orgs/${fx.orgId}/companion`);
    const answers = ["a-one", "a-two", "a-three", "a-four", "a-five", "a-six", "a-seven"];
    let last = "";
    for (let i = 0; i < answers.length; i++) {
      // one scripted follow-up + advance per skeleton question; final turn scripts a BAD synthesis
      script = i < answers.length - 1
        ? [{ content: `follow-${i}` }]
        : [{ content: "I refuse to quote you and I lack the marker." }];
      const r = await say(bob, answers[i]!);
      last = r.body.reply.content;
      if (i < answers.length - 1) {
        expect(last).toBe(`follow-${i}`);
        const adv = await say(bob, `detail-${i}`);
        last = adv.body.reply.content;
      }
    }
    expect(last.startsWith("Here's your reflection")).toBe(true); // deterministic fallback used
    expect(last).toContain("a-one"); // quotes the user (fallback guarantees it)
  });
});
// AC7 delegation: SPEC-007 locked itest (guided behavior) remains the regression guard for the no-config path.

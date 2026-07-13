// SPEC-012 AC6 (delegated from itest): Slack v0 signing verification.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { slackAdapter } from "../src/bridge.js";

const SECRET = "test-signing-secret";

function signed(bodyObj: unknown, tsSeconds: number) {
  const raw = JSON.stringify(bodyObj);
  const sig = "v0=" + createHmac("sha256", SECRET).update(`v0:${tsSeconds}:${raw}`).digest("hex");
  return {
    headers: { "x-slack-request-timestamp": String(tsSeconds), "x-slack-signature": sig },
    body: bodyObj,
    rawBody: raw,
  } as never;
}

const NOW = 1_800_000_000_000;
const adapter = slackAdapter(SECRET, () => NOW);
const event = { event: { user: "U123", text: "checkin" } };

describe("SPEC-012 AC6: Slack v0 signatures", () => {
  it("accepts a valid signature", () => {
    expect(adapter.verifyAndNormalize(signed(event, NOW / 1000))).toEqual({ externalId: "U123", text: "checkin" });
  });
  it("rejects a tampered body", () => {
    const req = signed(event, NOW / 1000) as { body: unknown; rawBody: string };
    req.rawBody = JSON.stringify({ event: { user: "U123", text: "feedback 1 evil" } });
    expect(adapter.verifyAndNormalize(req as never)).toBeNull();
  });
  it("rejects a stale timestamp (replay window)", () => {
    expect(adapter.verifyAndNormalize(signed(event, NOW / 1000 - 600))).toBeNull();
  });
  it("rejects missing headers", () => {
    expect(adapter.verifyAndNormalize({ headers: {}, body: event } as never)).toBeNull();
  });
});

// SPEC-018 (G4) — WRITTEN PRE-IMPLEMENTATION: byte-exact verification through the real app.
import { buildApp } from "../src/app.js";

describe("SPEC-018 AC1+AC3: verification over true raw bytes", () => {
  it("non-canonical raw JSON signed over exact bytes verifies end-to-end", async () => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
    const app = buildApp({ coreUrl: "http://core.invalid" });
    // spacing + key order JSON.stringify would never reproduce
    const raw = `{  "event" : {"text":"asks","user":"U-raw"} ,"weird_order": true }`;
    const ts = Math.floor(Date.now() / 1000);
    const sig = "v0=" + createHmac("sha256", SECRET).update(`v0:${ts}:${raw}`).digest("hex");
    const res = await app.inject({
      method: "POST", url: "/api/bridge/slack/events",
      headers: { "content-type": "application/json", "x-slack-request-timestamp": String(ts), "x-slack-signature": sig },
      payload: raw,
    });
    expect(res.statusCode).toBe(200); // verified → linking guidance for the unlinked user
    expect((res.json() as { text: string }).text.toLowerCase()).toContain("link");
    await app.close();
    delete process.env.SLACK_SIGNING_SECRET;
  });

  it("adapter with no rawBody fails closed (fallback removed)", () => {
    const req = { headers: signed(event, NOW / 1000).headers, body: event } as never; // rawBody absent
    expect(adapter.verifyAndNormalize(req)).toBeNull();
  });
});

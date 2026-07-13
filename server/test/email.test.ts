// SPEC-021 AC3+AC4 — WRITTEN PRE-IMPLEMENTATION (noop/metrics are process-internal; recorded delegation).
import { describe, expect, it } from "vitest";
import { noopProvider, resolveEmailProvider, testProvider } from "../src/email.js";
import { metrics } from "../src/metrics.js";

describe("SPEC-021 AC3: noop provider + resolution", () => {
  it("noop returns true and increments email.sent.noop", async () => {
    const before = metrics.snapshot()["email.sent.noop"] ?? 0;
    const ok = await noopProvider().send({ to: "a@b.c", subject: "s", text: "t" });
    expect(ok).toBe(true);
    expect(metrics.snapshot()["email.sent.noop"]).toBe(before + 1);
  });
  it("resolve defaults to noop; unknown provider → noop (fail soft)", async () => {
    expect((await resolveEmailProvider({}).send({ to: "a@b.c", subject: "s", text: "t" }))).toBe(true);
    expect((await resolveEmailProvider({ EMAIL_PROVIDER: "carrier-pigeon" }).send({ to: "a@b.c", subject: "s", text: "t" }))).toBe(true);
  });
});

describe("SPEC-021 AC4: failure counting, never throws", () => {
  it("unreachable test provider returns false and increments email.failed.test", async () => {
    const before = metrics.snapshot()["email.failed.test"] ?? 0;
    const p = testProvider("http://127.0.0.1:1/void", fetch);
    expect(await p.send({ to: "a@b.c", subject: "s", text: "t" })).toBe(false);
    expect(metrics.snapshot()["email.failed.test"]).toBe(before + 1);
  });
});

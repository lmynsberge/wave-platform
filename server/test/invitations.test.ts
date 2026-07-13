// SPEC-020 delegated unit: the expiry predicate (black-box tests can't age tokens).
import { describe, expect, it } from "vitest";
import { isPending } from "../src/invitations.js";

describe("SPEC-020 expiry predicate", () => {
  const now = new Date("2026-07-13T12:00:00Z");
  it("pending only when unaccepted and unexpired", () => {
    expect(isPending(new Date("2026-07-14T12:00:00Z"), null, now)).toBe(true);
    expect(isPending(new Date("2026-07-13T11:59:59Z"), null, now)).toBe(false); // expired
    expect(isPending(new Date("2026-07-14T12:00:00Z"), new Date("2026-07-12T00:00:00Z"), now)).toBe(false); // accepted
  });
});

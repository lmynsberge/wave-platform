// SPEC-006 — Individual profile. Locked to spec (SPEC-QA-001 R3).
// Delegated per AC5 of SPEC-QA-001:
//   AC1 (auth screens), AC2/AC4 (render invariants), AC3 (hint math), AC5 (inbox render)
//     → web/test/profile.test.tsx and web component suites (render-level, not black-box)
// This file covers the API-level slice: AC6.
import { describe, expect, it } from "vitest";
import { client, signupUser } from "../src/client.js";

describe("SPEC-006 AC6: signal-policy surface", () => {
  it("anonymous 401; authed user receives full policy shape", async () => {
    expect((await client().json("/api/signal-policy")).status).toBe(401);
    const u = await signupUser("prof6");
    const { status, body } = await u.c.json<{
      subjective: { emerging: { minEvidence: number; minAuthors: number }; established: { minValidators: number } };
      objective: { emerging: { minDatapoints: number }; established: { minDatapoints: number } };
    }>("/api/signal-policy");
    expect(status).toBe(200);
    expect(body.subjective.emerging.minAuthors).toBeGreaterThan(1); // diversity is policy, not accident
    expect(body.objective.established.minDatapoints).toBeGreaterThan(body.objective.emerging.minDatapoints);
  });
});

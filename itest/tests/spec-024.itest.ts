// SPEC-024 — Demo mode (read-only persona session). Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
// Harness contract: server runs with DEMO_PERSONA_EMAIL=priya@demo.itest (global-setup env).
import { describe, expect, it } from "vitest";
import { client, post, signupUser, uniq, SERVER } from "../src/client.js";

const PERSONA_EMAIL = "priya@demo.itest";

const availability = async () => {
  const res = await fetch(`${SERVER()}/api/demo`);
  return { status: res.status, body: (await res.json().catch(() => null)) as { available?: boolean } | null };
};

describe("SPEC-024 demo mode lifecycle", () => {
  it("AC1+AC5+AC2+AC3+AC4: availability flips, enter/exit swap identity, demo is read-only", async () => {
    // AC1 (first half): persona does not exist yet
    const before = await availability();
    expect(before.status).toBe(200);
    expect(before.body?.available).toBe(false);

    // AC5 (second half): entering while unavailable → 404
    const early = await signupUser("early24");
    const earlyEnter = await early.c.json<{ error?: string }>("/api/demo/enter", post({}));
    expect(earlyEnter.status).toBe(404);
    expect(earlyEnter.body.error).toBe("demo_unavailable");

    // Build the persona through public APIs: exact configured email + a populated org
    const persona = client();
    const su = await persona.json<{ user: { id: string } }>("/api/auth/signup",
      post({ email: PERSONA_EMAIL, password: "password123", name: "Priya Demo" }));
    expect(su.status).toBe(201);
    const org = await persona.json<{ org: { id: string } }>("/api/orgs",
      post({ name: "Demo Org 24", slug: uniq("demo24") }));
    const orgId = org.body.org.id;

    // AC1 (second half)
    const after = await availability();
    expect(after.body?.available).toBe(true);

    // AC5 (first half): unauthenticated enter → 401
    expect((await client().json("/api/demo/enter", post({}))).status).toBe(401);

    // AC2: zero-org viewer becomes the persona, read surfaces work
    const viewer = await signupUser("viewer24");
    const enter = await viewer.c.json<{ demo?: boolean }>("/api/demo/enter", post({}));
    expect(enter.status).toBe(200);

    const me = await viewer.c.json<{ user: { email: string }; memberships: Array<{ orgId: string }>; demo?: boolean }>("/api/me");
    expect(me.body.demo).toBe(true);
    expect(me.body.user.email).toBe(PERSONA_EMAIL);
    expect(me.body.memberships.some((m) => m.orgId === orgId)).toBe(true);

    const members = await viewer.c.json<{ members: unknown[] }>(`/api/orgs/${orgId}/members`);
    expect(members.status).toBe(200);

    // AC3: mutations blocked at the choke point
    const write = await viewer.c.json<{ error?: string }>(`/api/orgs/${orgId}/feedback`,
      post({ subjectUserId: su.body.user.id, attributeKey: "anything", note: "should never land" }));
    expect(write.status).toBe(403);
    expect(write.body.error).toBe("demo_read_only");

    // AC4: exit restores the real (zero-org) user
    const exit = await viewer.c.json<{ demo?: boolean }>("/api/demo/exit", post({}));
    expect(exit.status).toBe(200);
    const meAfter = await viewer.c.json<{ user: { email: string }; memberships: unknown[]; demo?: boolean }>("/api/me");
    expect(meAfter.body.demo ?? false).toBe(false);
    expect(meAfter.body.user.email).toBe(viewer.email);
    expect(meAfter.body.memberships).toHaveLength(0);
  });
});

// AC6 (web rendering) delegated to web/test/demo.test.tsx per SPEC-024 §9.

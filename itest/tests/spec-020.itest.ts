// SPEC-020 — Invitations & org join. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, signupUser, uniq, SERVER } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface Invitation { id: string; email: string; role: string; token: string; expiresAt: string }

let fx: Fixture;
const invite = (u: Fixture["owner"], email: string, role = "member") =>
  u.c.json<{ invitation: Invitation; error?: string }>(`/api/orgs/${fx.orgId}/invitations`, post({ email, role }));
const pending = (u: Fixture["owner"]) =>
  u.c.json<{ invitations: Invitation[] }>(`/api/orgs/${fx.orgId}/invitations`);
const inspect = (token: string) => fetch(`${SERVER()}/api/invites/${token}`);
const accept = (u: { c: ReturnType<typeof client> }, token: string) =>
  u.c.json<{ orgId?: string; role?: string; error?: string }>(`/api/invites/${token}/accept`, post({}));

beforeAll(async () => {
  fx = await orgWithChain("s20", [{ name: "plain" }, { name: "adm", role: "admin" }]);
});

describe("SPEC-020 AC1+AC6: the full join path", () => {
  it("invite (mixed-case) → signup lowercase → inspect → accept → membership with role; pending empties", async () => {
    const email = `${uniq("Joiner")}@It.Test`;
    const inv = await invite(fx.members.adm!, email, "member");
    expect(inv.status).toBe(201);
    const token = inv.body.invitation.token;

    const pub = await inspect(token);
    expect(pub.status).toBe(200);
    const info = (await pub.json()) as { orgName: string; email: string; role: string };
    expect(info.orgName).toBeTruthy();
    expect(info.role).toBe("member");

    const joiner = client();
    const su = await joiner.json<{ user: { id: string } }>("/api/auth/signup",
      post({ email: email.toLowerCase(), password: "password123", name: "Joiner" }));
    expect(su.status).toBe(201);
    const acc = await accept({ c: joiner }, token);
    expect(acc.status).toBe(201);
    expect(acc.body.orgId).toBe(fx.orgId);

    const members = await joiner.json<{ members: Array<{ userId: string; role: string }> }>(`/api/orgs/${fx.orgId}/members`);
    expect(members.status).toBe(200); // membership real: RBAC edge passes
    expect(members.body.members.some((m) => m.userId === su.body.user.id && m.role === "member")).toBe(true);

    const p = await pending(fx.members.adm!);
    expect(p.body.invitations.find((i) => i.token === token)).toBeUndefined();
  });
});

describe("SPEC-020 AC2: authz + replacement", () => {
  it("member 403; outsider 404; re-invite replaces (old token 404s)", async () => {
    expect((await invite(fx.members.plain!, "x@it.test")).status).toBe(403);
    const out = await signupUser("out20");
    expect((await out.c.json(`/api/orgs/${fx.orgId}/invitations`, post({ email: "x@it.test", role: "member" }))).status).toBe(404);

    const email = `${uniq("re")}@it.test`;
    const first = await invite(fx.owner, email);
    const second = await invite(fx.owner, email);
    expect(second.status).toBe(201);
    expect((await inspect(first.body.invitation.token)).status).toBe(404);
    expect((await inspect(second.body.invitation.token)).status).toBe(200);
  });
});

describe("SPEC-020 AC3+AC4: acceptance guards", () => {
  it("wrong email 403; unauthenticated 401; garbage token 404; already-member 409; accepted token gone", async () => {
    const email = `${uniq("guard")}@it.test`;
    const inv = await invite(fx.owner, email);
    const token = inv.body.invitation.token;

    const wrong = await signupUser("wrong20"); // different email
    expect((await accept(wrong, token)).body.error).toBe("email_mismatch");
    expect((await client().json(`/api/invites/${token}/accept`, post({}))).status).toBe(401);
    expect((await inspect("deadbeef".repeat(4))).status).toBe(404);

    const right = client();
    await right.json("/api/auth/signup", post({ email, password: "password123", name: "G" }));
    expect((await accept({ c: right }, token)).status).toBe(201);
    expect((await inspect(token)).status).toBe(404); // accepted = indistinguishable from never-existed

    const inv2 = await invite(fx.owner, email); // invite an existing member
    expect((await accept({ c: right }, inv2.body.invitation.token)).status).toBe(409);
  });
});

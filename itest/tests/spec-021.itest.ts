// SPEC-021 — Injectable email provider. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, uniq } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface Email { to: string; subject: string; text: string }

let fx: Fixture;
let listener: Server;
const emails: Email[] = [];
const settle = () => new Promise((r) => setTimeout(r, 150));

beforeAll(async () => {
  listener = createServer((req, res) => {
    let raw = ""; req.on("data", (c) => { raw += c; });
    req.on("end", () => { emails.push(JSON.parse(raw) as Email); res.writeHead(200).end("{}"); });
  });
  await new Promise<void>((r) => listener.listen(8192, "127.0.0.1", r));
  fx = await orgWithChain("s21", [{ name: "adm", role: "admin" }]);
});
afterAll(() => new Promise<void>((r) => listener.close(() => r())));

describe("SPEC-021 AC1: invites deliver mail via the injected provider", () => {
  it("captured email goes to the invitee with the real token link and the org name in the subject", async () => {
    const email = `${uniq("mail")}@it.test`;
    const inv = await fx.members.adm!.c.json<{ invitation: { token: string } }>(
      `/api/orgs/${fx.orgId}/invitations`, post({ email, role: "member" }));
    expect(inv.status).toBe(201);
    await settle();
    const sent = emails.find((e) => e.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).toContain(`/invite/${inv.body.invitation.token}`);
    expect(sent!.subject.toLowerCase()).toContain("s21");
  });
});

describe("SPEC-021 AC2: email failure never breaks the flow", () => {
  it("listener down → invite still 201 and acceptance works end-to-end", async () => {
    await new Promise<void>((r) => listener.close(() => r()));
    const email = `${uniq("down")}@it.test`;
    const inv = await fx.owner.c.json<{ invitation: { token: string } }>(
      `/api/orgs/${fx.orgId}/invitations`, post({ email, role: "member" }));
    expect(inv.status).toBe(201);

    const joiner = client();
    await joiner.json("/api/auth/signup", post({ email, password: "password123", name: "Down" }));
    const acc = await joiner.json<{ orgId: string }>(`/api/invites/${inv.body.invitation.token}/accept`, post({}));
    expect(acc.status).toBe(201);
    expect(acc.body.orgId).toBe(fx.orgId);

    // restore for any later files
    listener = createServer((req, res) => { req.resume(); req.on("end", () => res.writeHead(200).end("{}")); });
    await new Promise<void>((r) => listener.listen(8192, "127.0.0.1", r));
  });
});

// SPEC-022 — Org access requests. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, signupUser } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface DirEntry { id: string; name: string; slug: string; membership: string | null; requestStatus: string | null }
interface OwnRequest { id: string; orgId: string; orgName: string; slug: string; status: string; createdAt: string }
interface AdminRequest { id: string; userId: string; name: string; email: string; createdAt: string }

let orgA: Fixture;
let orgB: Fixture;

const directory = (u: { c: ReturnType<typeof client> }) =>
  u.c.json<{ orgs: DirEntry[] }>("/api/orgs/directory");
const request = (u: { c: ReturnType<typeof client> }, orgId: string) =>
  u.c.json<{ request?: { id: string; orgId: string; status: string }; error?: string }>(
    `/api/orgs/${orgId}/join-requests`, post({}));
const ownList = (u: { c: ReturnType<typeof client> }) =>
  u.c.json<{ requests: OwnRequest[] }>("/api/me/join-requests");
const adminList = (u: { c: ReturnType<typeof client> }, orgId: string) =>
  u.c.json<{ requests: AdminRequest[]; error?: string }>(`/api/orgs/${orgId}/join-requests`);
const approve = (u: { c: ReturnType<typeof client> }, orgId: string, id: string) =>
  u.c.json<{ membership?: { userId: string; orgId: string; role: string }; error?: string }>(
    `/api/orgs/${orgId}/join-requests/${id}/approve`, post({}));
const decline = (u: { c: ReturnType<typeof client> }, orgId: string, id: string) =>
  u.c.json<{ request?: { id: string; status: string }; error?: string }>(
    `/api/orgs/${orgId}/join-requests/${id}/decline`, post({}));

beforeAll(async () => {
  orgA = await orgWithChain("s22a", [{ name: "plain" }, { name: "adm", role: "admin" }]);
  orgB = await orgWithChain("s22b", []);
});

describe("SPEC-022 AC1: directory + multi-org requests", () => {
  it("zero-org user sees the directory, requests two orgs, duplicate 409s, own list shows pending", async () => {
    const newbie = await signupUser("newbie22");

    const dir = await directory(newbie);
    expect(dir.status).toBe(200);
    const a = dir.body.orgs.find((o) => o.id === orgA.orgId)!;
    const b = dir.body.orgs.find((o) => o.id === orgB.orgId)!;
    expect(a.name).toBeTruthy();
    expect(a.slug).toBeTruthy();
    expect(a.membership).toBeNull();
    expect(a.requestStatus).toBeNull();

    expect((await request(newbie, orgA.orgId)).status).toBe(201);
    expect((await request(newbie, orgB.orgId)).status).toBe(201);
    const dup = await request(newbie, orgA.orgId);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("already_requested");

    const own = await ownList(newbie);
    expect(own.status).toBe(200);
    const statuses = own.body.requests.filter((r) => [orgA.orgId, orgB.orgId].includes(r.orgId));
    expect(statuses).toHaveLength(2);
    expect(statuses.every((r) => r.status === "pending")).toBe(true);
    expect(statuses.every((r) => r.orgName.length > 0)).toBe(true);

    const dir2 = await directory(newbie);
    expect(dir2.body.orgs.find((o) => o.id === orgA.orgId)!.requestStatus).toBe("pending");
    void b;
  });
});

describe("SPEC-022 AC2: admin approval path", () => {
  it("admin sees requester, approves → member; pending list empties; requester sees approved", async () => {
    const seeker = await signupUser("seeker22");
    await request(seeker, orgA.orgId);

    const list = await adminList(orgA.members.adm!, orgA.orgId);
    expect(list.status).toBe(200);
    const row = list.body.requests.find((r) => r.userId === seeker.id)!;
    expect(row.email).toBe(seeker.email);
    expect(row.name).toBeTruthy();

    const ap = await approve(orgA.members.adm!, orgA.orgId, row.id);
    expect(ap.status).toBe(200);
    expect(ap.body.membership).toMatchObject({ userId: seeker.id, orgId: orgA.orgId, role: "member" });

    const me = await seeker.c.json<{ memberships: Array<{ orgId: string; role: string }> }>("/api/me");
    expect(me.body.memberships.some((m) => m.orgId === orgA.orgId && m.role === "member")).toBe(true);

    const after = await adminList(orgA.members.adm!, orgA.orgId);
    expect(after.body.requests.find((r) => r.userId === seeker.id)).toBeUndefined();

    const own = await ownList(seeker);
    expect(own.body.requests.find((r) => r.orgId === orgA.orgId)?.status).toBe("approved");
  });
});

describe("SPEC-022 AC3: decline and re-request", () => {
  it("decline → declined in own list; re-request creates a fresh pending", async () => {
    const seeker = await signupUser("declined22");
    const rq = await request(seeker, orgA.orgId);
    const id = rq.body.request!.id;

    const de = await decline(orgA.owner, orgA.orgId, id);
    expect(de.status).toBe(200);
    expect(de.body.request?.status).toBe("declined");

    const own = await ownList(seeker);
    expect(own.body.requests.find((r) => r.id === id)?.status).toBe("declined");

    const again = await request(seeker, orgA.orgId);
    expect(again.status).toBe(201);
    expect(again.body.request!.id).not.toBe(id);
  });
});

describe("SPEC-022 AC4: authz boundaries", () => {
  it("member 403, outsider 404, unauthenticated 401, self-org request 409, decided request 404", async () => {
    const seeker = await signupUser("bound22");
    const rq = await request(seeker, orgA.orgId);
    const id = rq.body.request!.id;

    expect((await adminList(orgA.members.plain!, orgA.orgId)).status).toBe(403);
    expect((await approve(orgA.members.plain!, orgA.orgId, id)).status).toBe(403);

    const outsider = await signupUser("outsider22");
    expect((await adminList(outsider, orgA.orgId)).status).toBe(404);

    expect((await client().json("/api/orgs/directory")).status).toBe(401);

    const selfReq = await request(orgA.members.plain!, orgA.orgId);
    expect(selfReq.status).toBe(409);
    expect(selfReq.body.error).toBe("already_member");

    await decline(orgA.owner, orgA.orgId, id);
    expect((await approve(orgA.owner, orgA.orgId, id)).status).toBe(404);
    expect((await decline(orgA.owner, orgA.orgId, id)).status).toBe(404);
  });
});

describe("SPEC-022 AC6: multi-org membership via requests", () => {
  it("a member of org A gains org B through a request", async () => {
    const seeker = await signupUser("multi22");
    const r1 = await request(seeker, orgA.orgId);
    await approve(orgA.owner, orgA.orgId, r1.body.request!.id);

    const r2 = await request(seeker, orgB.orgId);
    expect(r2.status).toBe(201);
    const ap = await approve(orgB.owner, orgB.orgId, r2.body.request!.id);
    expect(ap.status).toBe(200);

    const me = await seeker.c.json<{ memberships: Array<{ orgId: string }> }>("/api/me");
    const orgIds = me.body.memberships.map((m) => m.orgId);
    expect(orgIds).toContain(orgA.orgId);
    expect(orgIds).toContain(orgB.orgId);
  });
});

// AC5 (web rendering) delegated to web/test/join.test.tsx per SPEC-022 §9.

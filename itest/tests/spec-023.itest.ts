// SPEC-023 — Account merge tool. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
// The CLI is the tool's public interface (spec §4.1/§9): the test drives it via execSync
// against the harness stack and asserts outcomes through public APIs only.
import { execSync } from "node:child_process";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, seedAttribute, signupUser, CORE } from "../src/client.js";

const SCRIPT = join(process.cwd(), "..", "scripts", "merge-accounts.mjs");
const SERVER_DB = process.env.IT_SERVER_DB ?? "postgres://wave:wave@localhost:5432/wave_it_srv";
const ATTR = "merge_attr_23";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
let org1: Fixture;
let org2: Fixture;
let from: Awaited<ReturnType<typeof signupUser>>;
let into: Awaited<ReturnType<typeof signupUser>>;

function runMerge(args: string): string {
  return execSync(`node ${SCRIPT} ${args}`, {
    env: { ...process.env, DATABASE_URL: SERVER_DB, CORE_URL: CORE() },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const feedback = (author: { c: ReturnType<typeof client> }, orgId: string, subjectUserId: string, note: string) =>
  author.c.json<{ evidence: { id: string } }>(`/api/orgs/${orgId}/feedback`,
    post({ subjectUserId, attributeKey: ATTR, note }));

beforeAll(async () => {
  await seedAttribute(ATTR, "subjective");
  org1 = await orgWithChain("s23a", [{ name: "other" }]);
  org2 = await orgWithChain("s23b", []);
  from = await signupUser("merge-from");
  into = await signupUser("merge-into");

  // AC1 fixture: role collision in org1 (from=admin beats into=member); org2 is from-only
  await org1.owner.c.json(`/api/orgs/${org1.orgId}/members`, post({ userId: from.id, role: "admin" }));
  await org1.owner.c.json(`/api/orgs/${org1.orgId}/members`, post({ userId: into.id, role: "member" }));
  await org2.owner.c.json(`/api/orgs/${org2.orgId}/members`, post({ userId: from.id, role: "member" }));

  const other = org1.members.other!;
  // AC2 fixture: evidence split across the two accounts (2 about from, 1 about into)
  expect((await feedback(other, org1.orgId, from.id, "split evidence A")).status).toBe(201);
  expect((await feedback(other, org1.orgId, from.id, "split evidence B")).status).toBe(201);
  expect((await feedback(other, org1.orgId, into.id, "split evidence C")).status).toBe(201);
  // AC3 fixture: into authors about other; from validates it (valid pre-merge, own_evidence post-merge)
  const ev = await feedback(into, org1.orgId, other.id, "authored by into");
  expect((await from.c.json(`/api/orgs/${org1.orgId}/feedback/${ev.body.evidence.id}/validations`, post({ outcome: "yes" }))).status).toBe(201);
  // AC3 fixture: from authors about into (self-evidence post-merge → dropped)
  expect((await feedback(from, org1.orgId, into.id, "will become self-evidence")).status).toBe(201);
  // AC4 fixture: both accounts have private companion messages in org1
  await into.c.json(`/api/orgs/${org1.orgId}/companion`);
  await into.c.json(`/api/orgs/${org1.orgId}/companion/messages`, post({ content: "into-own-note-23" }));
  await from.c.json(`/api/orgs/${org1.orgId}/companion`);
  await from.c.json(`/api/orgs/${org1.orgId}/companion/messages`, post({ content: "from-secret-note-23" }));
});

describe("SPEC-023 AC5 (dry-run) then AC1-AC4 (merge)", () => {
  it("dry-run changes nothing; merge combines accounts and repairs invariants", async () => {
    const dry = runMerge(`--from ${from.email} --into ${into.email} --dry-run`);
    expect(dry.toLowerCase()).toContain("dry");
    // unchanged: from still authenticates
    expect((await from.c.json("/api/me")).status).toBe(200);

    const out = runMerge(`--from ${from.email} --into ${into.email}`);
    expect(out.length).toBeGreaterThan(0);

    // AC1: memberships union, higher role wins; from is dead
    const me = await into.c.json<{ memberships: Array<{ orgId: string; role: string }> }>("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.memberships.find((m) => m.orgId === org1.orgId)?.role).toBe("admin");
    expect(me.body.memberships.some((m) => m.orgId === org2.orgId)).toBe(true);

    expect((await from.c.json("/api/me")).status).toBe(401); // sessions deleted
    const deadLogin = await client().json("/api/auth/login", post({ email: from.email, password: "password123" }));
    expect(deadLogin.status).toBe(401); // email freed by tombstone

    // AC2: combined evidence on into's profile: 2 (about from) + 1 (about into); self-evidence row dropped
    const attrs = await into.c.json<{ attributes: Array<{ key: string; evidenceCount: number }> }>(
      `/api/orgs/${org1.orgId}/members/${into.id}/attributes`);
    expect(attrs.status).toBe(200);
    expect(attrs.body.attributes.find((a) => a.key === ATTR)?.evidenceCount).toBe(3);

    // AC3: from's validation of into-authored evidence is gone (own_evidence repair)
    const other = org1.members.other!;
    const otherAttrs = await into.c.json<{ attributes: Array<{ key: string; validations: { yes: number } }> }>(
      `/api/orgs/${org1.orgId}/members/${other.id}/attributes`);
    expect(otherAttrs.body.attributes.find((a) => a.key === ATTR)?.validations.yes ?? 0).toBe(0);

    // AC4: from's private companion messages re-parented into into's segment, after into's own
    const thread = await into.c.json<{ messages: Array<{ role: string; content: string }> }>(
      `/api/orgs/${org1.orgId}/companion`);
    const contents = thread.body.messages.map((m) => m.content);
    const ownIdx = contents.indexOf("into-own-note-23");
    const mergedIdx = contents.indexOf("from-secret-note-23");
    expect(ownIdx).toBeGreaterThanOrEqual(0);
    expect(mergedIdx).toBeGreaterThan(ownIdx);
  });

  it("AC5: re-running is refused (already merged) and self-merge is refused", async () => {
    const refusal = (args: string): string => {
      try {
        runMerge(args);
        return "";
      } catch (e) {
        return String((e as { stderr?: unknown }).stderr ?? "");
      }
    };
    // tombstoned email no longer resolves — refused, not re-run
    expect(refusal(`--from ${from.email} --into ${into.email}`)).toMatch(/not found|already merged/i);
    expect(refusal(`--from ${into.email} --into ${into.email}`)).toMatch(/itself|same/i);
  });
});

// AC6 (GitHub Action) delegated to workflow review per SPEC-023 §9 (not itest-runnable).

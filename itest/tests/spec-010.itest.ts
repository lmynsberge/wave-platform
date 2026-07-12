// SPEC-010 — Thin org view. Locked (SPEC-QA-001 R3). WRITTEN PRE-IMPLEMENTATION.
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, seedAttribute, uniq } from "../src/client.js";

type Fixture = Awaited<ReturnType<typeof orgWithChain>>;
interface TeamRow { userId: string; name: string; attributesEstablished: number; attributesEmerging: number; pendingValidations: number }

let fx: Fixture;
let attrKey: string;
const team = (u: Fixture["owner"]) => u.c.json<{ team: TeamRow[] }>(`/api/orgs/${fx.orgId}/team-signal`);

beforeAll(async () => {
  attrKey = uniq("writing");
  await seedAttribute(attrKey, "subjective");
  fx = await orgWithChain("s10", [
    { name: "mgr" }, { name: "r1" }, { name: "r2" }, { name: "peerOnly" },
  ]);
  await fx.setManager("r1", "mgr");
  await fx.setManager("r2", "r1"); // transitive under mgr
  // peerOnly gives r1 feedback → lands in mgr's validation queue
  await fx.members.peerOnly!.c.json(
    `/api/orgs/${fx.orgId}/feedback`,
    post({ subjectUserId: fx.members.r1!.id, attributeKey: attrKey, note: "crisp design doc" }),
  );
});

describe("SPEC-010 AC1+AC2: team scoping", () => {
  it("manager sees direct + transitive reports only; non-manager sees empty team", async () => {
    const r = await team(fx.members.mgr!);
    expect(r.status).toBe(200);
    const ids = r.body.team.map((t) => t.userId);
    expect(ids).toContain(fx.members.r1!.id);
    expect(ids).toContain(fx.members.r2!.id); // transitive
    expect(ids).not.toContain(fx.members.peerOnly!.id);
    expect(ids).not.toContain(fx.members.mgr!.id);
    const flat = await team(fx.members.peerOnly!);
    expect(flat.status).toBe(200);
    expect(flat.body.team).toEqual([]);
  });
});

describe("SPEC-010 AC3: pending validations track the queue", () => {
  it("count reflects unvalidated items for that report and decrements after validating", async () => {
    let r = await team(fx.members.mgr!);
    const r1row = r.body.team.find((t) => t.userId === fx.members.r1!.id)!;
    expect(r1row.pendingValidations).toBe(1);

    const q = await fx.members.mgr!.c.json<{ items: Array<{ evidenceId: string }> }>(`/api/orgs/${fx.orgId}/validation-queue`);
    const evId = q.body.items[0]!.evidenceId;
    await fx.members.mgr!.c.json(`/api/orgs/${fx.orgId}/feedback/${evId}/validations`, post({ outcome: "yes" }));

    r = await team(fx.members.mgr!);
    expect(r.body.team.find((t) => t.userId === fx.members.r1!.id)!.pendingValidations).toBe(0);
  });
});

describe("SPEC-010 AC4: closed schema — the negative-space contract", () => {
  it("every team row carries exactly the five contracted keys", async () => {
    const r = await team(fx.members.mgr!);
    for (const row of r.body.team) {
      expect(Object.keys(row).sort()).toEqual(
        ["attributesEmerging", "attributesEstablished", "name", "pendingValidations", "userId"],
      );
    }
  });
});

describe("SPEC-010 AC5: edge semantics", () => {
  it("anonymous 401; non-member 404", async () => {
    expect((await client().json(`/api/orgs/${fx.orgId}/team-signal`)).status).toBe(401);
    const outsider = client();
    await outsider.json("/api/auth/signup", post({ email: `${uniq("o10")}@it.test`, password: "password123", name: "o10" }));
    expect((await outsider.json(`/api/orgs/${fx.orgId}/team-signal`)).status).toBe(404);
  });
});

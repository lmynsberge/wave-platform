// SPEC-008 — Hard-metric ingestion & within-org normalization. Locked (SPEC-QA-001 R3).
// WRITTEN PRE-IMPLEMENTATION. Fixtures via helpers (A2); assertions contract-only (R4 formula in spec).
import { beforeAll, describe, expect, it } from "vitest";
import { client, orgWithChain, post, seedAttribute, uniq } from "../src/client.js";

interface Attr { key: string; status: string; score: number | null; normalizedScore: number | null; evidenceCount: number }
type Fixture = Awaited<ReturnType<typeof orgWithChain>>;

let fx: Fixture;
let metricKey: string;

const ingest = (u: { c: ReturnType<typeof client> } | Fixture["owner"], body: unknown) =>
  (u as Fixture["owner"]).c.json<{ ingested: number; skipped: Array<{ email: string; reason: string }> }>(
    `/api/orgs/${fx.orgId}/ingest/metrics`, post(body));
const attrOf = async (userName: string): Promise<Attr | undefined> => {
  const id = fx.members[userName]!.id;
  const r = await fx.owner.c.json<{ attributes: Attr[] }>(`/api/orgs/${fx.orgId}/members/${id}/attributes`);
  return r.body.attributes.find((a) => a.key === metricKey);
};

beforeAll(async () => {
  metricKey = uniq("billable");
  await seedAttribute(metricKey, "objective");
  await seedAttribute(`${metricKey}-subj`, "subjective");
  fx = await orgWithChain("s8", [
    { name: "ana" }, { name: "ben" }, { name: "cy" }, { name: "dee" }, { name: "plainMember" },
  ]);
});

describe("SPEC-008 AC1+AC6: ingestion authz and shape", () => {
  it("member 403; non-member 404; anonymous 401; malformed 400; admin 200", async () => {
    const body = { source: "billing", period: "2026-06", metrics: [{ email: fx.members.ana!.email, attributeKey: metricKey, value: 100 }] };
    expect((await ingest(fx.members.plainMember!, body)).status).toBe(403);
    const outsiderC = client();
    await outsiderC.json("/api/auth/signup", post({ email: `${uniq("out8")}@it.test`, password: "password123", name: "out" }));
    expect((await outsiderC.json(`/api/orgs/${fx.orgId}/ingest/metrics`, post(body))).status).toBe(404);
    expect((await client().json(`/api/orgs/${fx.orgId}/ingest/metrics`, post(body))).status).toBe(401);
    expect((await ingest(fx.owner, { source: "billing", metrics: [{ email: "x", attributeKey: metricKey, value: "NaN-ish" }] })).status).toBe(400);
    const ok = await ingest(fx.owner, body);
    expect(ok.status).toBe(200);
    expect(ok.body.ingested).toBe(1);
  });
});

describe("SPEC-008 AC2: partial success with skip reasons", () => {
  it("unknown email and subjective attribute rows are skipped with reasons; valid rows land", async () => {
    const r = await ingest(fx.owner, {
      source: "billing", period: "2026-06",
      metrics: [
        { email: fx.members.ben!.email, attributeKey: metricKey, value: 200 },
        { email: "ghost@nowhere.test", attributeKey: metricKey, value: 300 },
        { email: fx.members.cy!.email, attributeKey: `${metricKey}-subj`, value: 5 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.ingested).toBe(1);
    expect(r.body.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: "ghost@nowhere.test", reason: "unknown_user" }),
      expect.objectContaining({ email: fx.members.cy!.email, reason: "subjective_attribute" }),
    ]));
  });
});

describe("SPEC-008 AC3: idempotent re-ingestion", () => {
  it("same source+period updates in place — evidenceCount stable, value corrected", async () => {
    const period = "2026-07";
    const send = (value: number) =>
      ingest(fx.owner, { source: "billing", period, metrics: [{ email: fx.members.dee!.email, attributeKey: metricKey, value }] });
    await send(500);
    const first = await attrOf("dee");
    await send(510); // correction run
    const second = await attrOf("dee");
    expect(second!.evidenceCount).toBe(first!.evidenceCount);
  });
});

describe("SPEC-008 AC4+AC5: within-org percentile normalization", () => {
  it("established cohort ranks by mean per the R4 formula; emerging users null; absent users out of cohort", async () => {
    // establish ana/ben/cy with 3 periods each; dee stays at 1 period (emerging); plainMember absent
    const values: Record<string, number[]> = { ana: [100, 100, 100], ben: [200, 200, 200], cy: [300, 300, 300] };
    for (const [name, vals] of Object.entries(values)) {
      for (let i = 0; i < vals.length; i++) {
        await ingest(fx.owner, {
          source: "billing", period: `2026-1${i}`,
          metrics: [{ email: fx.members[name]!.email, attributeKey: metricKey, value: vals[i]! }],
        });
      }
    }
    const [ana, ben, cy, dee] = [await attrOf("ana"), await attrOf("ben"), await attrOf("cy"), await attrOf("dee")];
    expect(ana!.status).toBe("established");
    // R4: percentile = strictly-lower peers / established cohort * 100, rounded. Cohort ≥ 3 (ana, ben, cy).
    expect(ana!.normalizedScore).toBeLessThan(ben!.normalizedScore!);
    expect(ben!.normalizedScore).toBeLessThan(cy!.normalizedScore!);
    expect(ana!.normalizedScore).toBe(0); // nobody strictly below
    expect(dee!.status).not.toBe("established");
    expect(dee!.normalizedScore).toBeNull(); // invariant 2
    expect(await attrOf("plainMember")).toBeUndefined(); // invariant 5: absent, unmarked
  });
});

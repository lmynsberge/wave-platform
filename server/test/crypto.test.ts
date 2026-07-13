// SPEC-017 AC2 — at-rest proof (delegated from itest; DB inspection is outside black-box scope).
// WRITTEN PRE-IMPLEMENTATION.
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/crypto.js";
import { buildApp } from "../src/app.js";
import { createPool, type Pool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

const KEK = Buffer.from("unit-kek-32-bytes-padded-0000000").toString("base64");
const DB_URL = "postgres://wave:wave@localhost:5432/wave_test_crypto";
let pool: Pool;

beforeAll(async () => {
  execSync(`psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_test_crypto" -c "CREATE DATABASE wave_test_crypto"`, { env: { ...process.env, PGPASSWORD: "wave" }, stdio: "pipe" });
  pool = createPool(DB_URL);
  await migrate("migrations", pool);
});
afterAll(async () => { await pool.end(); });

describe("SPEC-017 AC2: crypto module", () => {
  it("round-trips; unique IVs; tampering yields null, never throws", () => {
    const a = encrypt("sk-super-secret", KEK);
    const b = encrypt("sk-super-secret", KEK);
    expect(a).toMatch(/^enc:v1:/);
    expect(a).not.toBe(b); // random IV per value
    expect(a).not.toContain("sk-super-secret");
    expect(decrypt(a, KEK)).toBe("sk-super-secret");
    const parts = a.split(":");
    parts[4] = Buffer.from("tampered-ciphertext!").toString("base64");
    expect(decrypt(parts.join(":"), KEK)).toBeNull();
    expect(decrypt("garbage", KEK)).toBe("garbage"); // legacy plaintext tolerance (R3)
  });
});

describe("SPEC-017 AC2: at-rest + fail-closed via the endpoint", () => {
  const putCfg = async (app: ReturnType<typeof buildApp>, orgId: string, cookie: string) =>
    app.inject({ method: "PUT", url: `/api/orgs/${orgId}/llm-config`, headers: { cookie },
      payload: { provider: "openai_compatible", baseUrl: "http://x.invalid", model: "m", apiKey: "sk-plain-visible" } });

  it("stored row is enc:v1-prefixed and free of the plaintext; PUT without KEK → 400 encryption_unavailable", async () => {
    const withKek = buildApp({ coreUrl: "http://core.invalid", pool, keyEncryptionKey: KEK });
    const su = await withKek.inject({ method: "POST", url: "/api/auth/signup", payload: { email: "k17@it.test", password: "password123", name: "K" } });
    const cookie = String(su.headers["set-cookie"]).split(";")[0]!;
    const org = await withKek.inject({ method: "POST", url: "/api/orgs", headers: { cookie }, payload: { name: "K17", slug: "k17" } });
    const orgId = (org.json() as { org: { id: string } }).org.id;

    expect((await putCfg(withKek, orgId, cookie)).statusCode).toBe(200);
    const { rows } = await pool.query("SELECT api_key FROM org_llm_config WHERE org_id = $1", [orgId]);
    expect(rows[0].api_key).toMatch(/^enc:v1:/);
    expect(rows[0].api_key).not.toContain("sk-plain-visible");
    await withKek.close();

    const noKek = buildApp({ coreUrl: "http://core.invalid", pool });
    const res = await putCfg(noKek, orgId, cookie);
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe("encryption_unavailable");
    await noKek.close();
  });
});

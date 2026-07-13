// SPEC-016 H01 — WRITTEN PRE-IMPLEMENTATION (red at spec review).
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

const DB_URL = "postgres://wave:wave@localhost:5432/wave_test_static";
let webDist: string;
beforeAll(async () => {
  execSync(`psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_test_static" -c "CREATE DATABASE wave_test_static"`, { env: { ...process.env, PGPASSWORD: "wave" }, stdio: "pipe" });
  webDist = mkdtempSync(join(tmpdir(), "wave-dist-"));
  writeFileSync(join(webDist, "index.html"), "<html><body>WAVE-SPA</body></html>");
  mkdirSync(join(webDist, "assets"));
  writeFileSync(join(webDist, "assets", "app.js"), "console.log('wave')");
});

describe("SPEC-016 AC1: static SPA serving", () => {
  it("serves index at /, SPA-falls-back on unknown routes, serves assets, keeps /api JSON 404", async () => {
    const app = buildApp({ coreUrl: "http://core.invalid", webDist });
    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.body).toContain("WAVE-SPA");
    const spa = await app.inject({ method: "GET", url: "/team/some/deep/route" });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain("WAVE-SPA");
    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain("wave");
    const api = await app.inject({ method: "GET", url: "/api/does-not-exist" });
    expect(api.statusCode).toBe(404);
    expect(api.headers["content-type"]).toContain("application/json");
    await app.close();
  });
});

describe("SPEC-016 AC2: Secure cookies behind the flag", () => {
  it("set-cookie carries Secure on signup and on logout-clear when enabled; absent when not", async () => {
    const pool = createPool(DB_URL);
    await migrate("migrations", pool);
    const secure = buildApp({ coreUrl: "http://core.invalid", pool, secureCookies: true });
    const su = await secure.inject({
      method: "POST", url: "/api/auth/signup",
      payload: { email: "sec@it.test", password: "password123", name: "Sec" },
    });
    expect(su.statusCode).toBe(201);
    expect(String(su.headers["set-cookie"])).toContain("Secure");
    const cookie = String(su.headers["set-cookie"]).split(";")[0]!;
    const lo = await secure.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(String(lo.headers["set-cookie"])).toContain("Secure");
    await secure.close();

    const plain = buildApp({ coreUrl: "http://core.invalid", pool });
    const su2 = await plain.inject({
      method: "POST", url: "/api/auth/signup",
      payload: { email: "plain@it.test", password: "password123", name: "Plain" },
    });
    expect(String(su2.headers["set-cookie"])).not.toContain("Secure");
    await plain.close();
    await pool.end();
  });
});

describe("SPEC-016 AC2b: system bearer for nudge-dispatch (Cloud Scheduler path)", () => {
  it("valid bearer dispatches without a session; wrong bearer 401", async () => {
    const pool = createPool(DB_URL);
    const app = buildApp({ coreUrl: "http://core.invalid", pool, dispatchToken: "sched-token-1" });
    // create an org so the route has something to scan; use the session path for setup
    const su = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { email: "d16@it.test", password: "password123", name: "D" } });
    const cookie = String(su.headers["set-cookie"]).split(";")[0]!;
    const org = await app.inject({ method: "POST", url: "/api/orgs", headers: { cookie }, payload: { name: "D16", slug: "d16" } });
    const orgId = (org.json() as { org: { id: string } }).org.id;

    const ok = await app.inject({ method: "POST", url: `/api/orgs/${orgId}/nudge-dispatch`, headers: { authorization: "Bearer sched-token-1" } });
    expect(ok.statusCode).toBe(200);
    expect(Object.keys(ok.json() as object)).toEqual(["notified"]);
    const bad = await app.inject({ method: "POST", url: `/api/orgs/${orgId}/nudge-dispatch`, headers: { authorization: "Bearer wrong" } });
    expect(bad.statusCode).toBe(401);
    await app.close();
    await pool.end();
  });
});

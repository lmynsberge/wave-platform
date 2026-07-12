import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

const TEST_DB_URL = "postgres://wave:wave@localhost:5432/wave_test";
const pool = createPool(TEST_DB_URL);
const app = buildApp({ coreUrl: "http://unused", pool });

function cookieOf(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : (raw as string);
  return first.split(";")[0]!;
}

async function signup(email: string, name: string) {
  const res = await app.inject({
    method: "POST", url: "/api/auth/signup",
    payload: { email, password: "password123", name },
  });
  expect(res.statusCode).toBe(201);
  return { user: res.json().user as { id: string }, cookie: cookieOf(res) };
}

beforeAll(async () => {
  execSync(`psql -h localhost -U wave -d postgres -c "DROP DATABASE IF EXISTS wave_test" -c "CREATE DATABASE wave_test"`, {
    env: { ...process.env, PGPASSWORD: "wave" },
  });
  await migrate("migrations", pool);
});
afterAll(async () => { await app.close(); await pool.end(); });

describe("AC1+AC2: auth lifecycle", () => {
  it("signup → me → logout → 401 → login → me", async () => {
    const { cookie } = await signup("a@example.com", "Alice");
    let me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("a@example.com");

    const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(out.statusCode).toBe(204);
    me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST", url: "/api/auth/login",
      payload: { email: "a@example.com", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookieOf(login) } });
    expect(me.statusCode).toBe(200);
  });

  it("wrong password 401; dup email 409; short password 400", async () => {
    const bad = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@example.com", password: "wrong-password" } });
    expect(bad.statusCode).toBe(401);
    const dup = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { email: "A@EXAMPLE.COM", password: "password123", name: "A2" } });
    expect(dup.statusCode).toBe(409);
    const short = await app.inject({ method: "POST", url: "/api/auth/signup", payload: { email: "s@example.com", password: "short", name: "S" } });
    expect(short.statusCode).toBe(400);
  });
});

describe("AC3+AC4: orgs, membership, RBAC edge", () => {
  it("owner creates org, adds member; member reads; non-member 404; member POST 403", async () => {
    const owner = await signup("owner@example.com", "Owner");
    const member = await signup("member@example.com", "Member");
    const outsider = await signup("out@example.com", "Outsider");

    const org = await app.inject({
      method: "POST", url: "/api/orgs", headers: { cookie: owner.cookie },
      payload: { name: "Acme", slug: "acme" },
    });
    expect(org.statusCode).toBe(201);
    const orgId = org.json().org.id as string;

    const add = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: owner.cookie },
      payload: { userId: member.user.id, role: "member" },
    });
    expect(add.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/members`, headers: { cookie: member.cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().members).toHaveLength(2);

    const probe = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/members`, headers: { cookie: outsider.cookie } });
    expect(probe.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: member.cookie },
      payload: { userId: outsider.user.id, role: "member" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error).toBe("insufficient_role");
  });
});

describe("AC5: reporting edges + chain", () => {
  it("chain A→B→C; self-edge 400; cycle 400; null clears", async () => {
    const admin = await signup("admin2@example.com", "Admin2");
    const a = await signup("ua@example.com", "UA");
    const b = await signup("ub@example.com", "UB");
    const c = await signup("uc@example.com", "UC");

    const org = await app.inject({ method: "POST", url: "/api/orgs", headers: { cookie: admin.cookie }, payload: { name: "Rep", slug: "rep" } });
    const orgId = org.json().org.id as string;
    for (const u of [a, b, c]) {
      await app.inject({ method: "POST", url: `/api/orgs/${orgId}/members`, headers: { cookie: admin.cookie }, payload: { userId: u.user.id, role: "member" } });
    }
    const put = (userId: string, managerId: string | null) =>
      app.inject({ method: "PUT", url: `/api/orgs/${orgId}/reporting`, headers: { cookie: admin.cookie }, payload: { userId, managerId } });

    expect((await put(a.user.id, b.user.id)).statusCode).toBe(200);
    expect((await put(b.user.id, c.user.id)).statusCode).toBe(200);

    const chain = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/reporting/${a.user.id}/chain`, headers: { cookie: a.cookie } });
    expect(chain.statusCode).toBe(200);
    expect(chain.json().chain).toEqual([b.user.id, c.user.id]);

    const self = await put(a.user.id, a.user.id);
    expect(self.statusCode).toBe(400);
    expect(self.json().error).toBe("self_edge");

    const cycle = await put(c.user.id, a.user.id);
    expect(cycle.statusCode).toBe(400);
    expect(cycle.json().error).toBe("cycle_detected");

    const clear = await put(a.user.id, null);
    expect(clear.statusCode).toBe(200);
    const chain2 = await app.inject({ method: "GET", url: `/api/orgs/${orgId}/reporting/${a.user.id}/chain`, headers: { cookie: a.cookie } });
    expect(chain2.json().chain).toEqual([]);
  });
});

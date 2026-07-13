import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Pool } from "./db.js";

const SESSION_COOKIE = "wave_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthedUser { id: string; email: string; name: string }

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

let SECURE_COOKIES = false;
export function configureAuthCookies(opts: { secureCookies: boolean }) {
  SECURE_COOKIES = opts.secureCookies;
}
const secureSuffix = () => (SECURE_COOKIES ? "; Secure" : "");

function setSessionCookie(reply: FastifyReply, token: string, expires: Date) {
  reply.header(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}${secureSuffix()}`,
  );
}
function clearSessionCookie(reply: FastifyReply) {
  reply.header("set-cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureSuffix()}`);
}
function readToken(req: FastifyRequest): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m?.[1] ?? null;
}

async function createSession(pool: Pool, userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query("INSERT INTO sessions(user_id, token_hash, expires_at) VALUES ($1,$2,$3)", [
    userId, sha256(token), expires,
  ]);
  setSessionCookie(reply, token, expires);
}

export async function currentUser(pool: Pool, req: FastifyRequest): Promise<AuthedUser | null> {
  const token = readToken(req);
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, s.expires_at, s.id AS session_id
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [row.session_id]);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

export function requireAuth(pool: Pool) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<AuthedUser | undefined> => {
    const user = await currentUser(pool, req);
    if (!user) { await reply.status(401).send({ error: "unauthenticated" }); return undefined; }
    return user;
  };
}

const signupSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function registerAuthRoutes(app: FastifyInstance, pool: Pool, opts?: { secureCookies: boolean }) {
  if (opts) configureAuthCookies(opts);
  app.post("/api/auth/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { email, password, name } = parsed.data;
    const salt = randomBytes(16).toString("hex");
    try {
      const { rows } = await pool.query(
        "INSERT INTO users(email, name, password_hash, password_salt) VALUES ($1,$2,$3,$4) RETURNING id, email, name",
        [email, name, hashPassword(password, salt), salt],
      );
      await createSession(pool, rows[0].id, reply);
      return reply.status(201).send({ user: rows[0] });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return reply.status(409).send({ error: "email_taken" });
      throw err;
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      "SELECT id, email, name, password_hash, password_salt FROM users WHERE email = $1",
      [parsed.data.email],
    );
    const row = rows[0];
    if (!row) return reply.status(401).send({ error: "bad_credentials" });
    const candidate = Buffer.from(hashPassword(parsed.data.password, row.password_salt), "hex");
    const actual = Buffer.from(row.password_hash as string, "hex");
    if (candidate.length !== actual.length || !timingSafeEqual(candidate, actual))
      return reply.status(401).send({ error: "bad_credentials" });
    await createSession(pool, row.id, reply);
    return reply.send({ user: { id: row.id, email: row.email, name: row.name } });
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const token = readToken(req);
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get("/api/me", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows } = await pool.query(
      `SELECT m.org_id AS "orgId", o.slug, o.name, m.role
       FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = $1`,
      [user.id],
    );
    return reply.send({ user, memberships: rows });
  });
}

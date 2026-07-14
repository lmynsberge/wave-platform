import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import { resolveEmailProvider } from "./email.js";
import type { Pool } from "./db.js";

/**
 * SPEC-020. The token is an INVITATION, not a bearer credential: acceptance
 * requires the authenticated user's email to match (R4). Invalid, expired,
 * and accepted tokens are one indistinguishable 404 (R3/R6).
 */

export const isPending = (expiresAt: Date, acceptedAt: Date | null, now = new Date()): boolean =>
  acceptedAt === null && expiresAt > now;

const createSchema = z.object({ email: z.string().email(), role: z.enum(["member", "admin"]) });

export function registerInvitationRoutes(app: FastifyInstance, pool: Pool) {
  const mailer = resolveEmailProvider(process.env);
  const appBase = process.env.APP_BASE_URL ?? "";
  const adminGate = async (req: Parameters<typeof currentUser>[1], orgId: string) => {
    const user = await currentUser(pool, req);
    if (!user) return { code: 401 as const };
    const { rows } = await pool.query("SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, user.id]);
    const role = rows[0]?.role as string | undefined;
    if (!role) return { code: 404 as const };
    if (role !== "owner" && role !== "admin") return { code: 403 as const };
    return { code: 200 as const, userId: user.id };
  };
  const sendGateError = (reply: { status: (n: number) => { send: (b: unknown) => unknown } }, code: 401 | 403 | 404) =>
    reply.status(code).send({ error: code === 401 ? "unauthenticated" : code === 403 ? "insufficient_role" : "not_found" });

  app.post("/api/orgs/:orgId/invitations", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const g = await adminGate(req, orgId);
    if (g.code !== 200) return sendGateError(reply, g.code);
    const raw = typeof req.body === "string" ? JSON.parse(String(req.body)) : req.body;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const email = parsed.data.email.toLowerCase();
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    // R1: re-invite replaces the pending invitation
    await pool.query("DELETE FROM org_invitations WHERE org_id = $1 AND lower(email) = $2 AND accepted_at IS NULL", [orgId, email]);
    const { rows } = await pool.query(
      `INSERT INTO org_invitations(org_id, email, role, token, created_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, role, token, expires_at AS "expiresAt"`,
      [orgId, email, parsed.data.role, token, g.userId, expiresAt],
    );
    // SPEC-021 R3: send AFTER durable creation; failure never surfaces
    const { rows: orgRows } = await pool.query("SELECT name FROM organizations WHERE id = $1", [orgId]);
    void mailer.send({
      to: rows[0].email,
      subject: `You're invited to join ${orgRows[0]?.name ?? "your team"} on Wave`,
      text: `You've been invited to join ${orgRows[0]?.name ?? "your team"} on Wave as a ${rows[0].role}.\n\nAccept here: ${appBase}/invite/${rows[0].token}\n\nThis link is bound to ${rows[0].email} and expires in 7 days.`,
    }).catch(() => { /* fail soft */ });
    return reply.status(201).send({ invitation: rows[0] });
  });

  app.get("/api/orgs/:orgId/invitations", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const g = await adminGate(req, orgId);
    if (g.code !== 200) return sendGateError(reply, g.code);
    const { rows } = await pool.query(
      `SELECT id, email, role, token, expires_at AS "expiresAt" FROM org_invitations
       WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > now() ORDER BY expires_at DESC`,
      [orgId],
    );
    return reply.send({ invitations: rows });
  });

  const pendingByToken = async (token: string) => {
    const { rows } = await pool.query(
      `SELECT i.id, i.org_id AS "orgId", i.email, i.role, o.name AS "orgName"
       FROM org_invitations i JOIN organizations o ON o.id = i.org_id
       WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
      [token],
    );
    return rows[0] as { id: string; orgId: string; email: string; role: string; orgName: string } | undefined;
  };

  app.get("/api/invites/:token", async (req, reply) => {
    const inv = await pendingByToken((req.params as { token: string }).token);
    if (!inv) return reply.status(404).send({ error: "not_found" });
    return reply.send({ orgName: inv.orgName, email: inv.email, role: inv.role });
  });

  app.post("/api/invites/:token/accept", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const inv = await pendingByToken((req.params as { token: string }).token);
    if (!inv) return reply.status(404).send({ error: "not_found" });
    if (user.email.toLowerCase() !== inv.email.toLowerCase())
      return reply.status(403).send({ error: "email_mismatch" }); // R4: not a bearer credential
    const existing = await pool.query("SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2", [inv.orgId, user.id]);
    await pool.query("UPDATE org_invitations SET accepted_at = now() WHERE id = $1", [inv.id]);
    if (existing.rows[0]) return reply.status(409).send({ error: "already_member" });
    await pool.query("INSERT INTO memberships(org_id, user_id, role) VALUES ($1,$2,$3)", [inv.orgId, user.id, inv.role]);
    return reply.status(201).send({ orgId: inv.orgId, role: inv.role });
  });
}

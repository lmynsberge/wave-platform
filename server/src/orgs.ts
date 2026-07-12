import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { currentUser, type AuthedUser } from "./auth.js";
import type { Pool } from "./db.js";

const ROLES = ["owner", "admin", "manager", "member"] as const;
type Role = (typeof ROLES)[number];
const ADMIN_ROLES: Role[] = ["owner", "admin"];

async function membershipRole(pool: Pool, orgId: string, userId: string): Promise<Role | null> {
  const { rows } = await pool.query(
    "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return (rows[0]?.role as Role) ?? null;
}

/** R5: non-members and unknown orgs get 404; members with insufficient role get 403. */
async function gate(
  pool: Pool, req: FastifyRequest, reply: FastifyReply, orgId: string, allowed?: Role[],
): Promise<{ user: AuthedUser; role: Role } | null> {
  const user = await currentUser(pool, req);
  if (!user) { await reply.status(401).send({ error: "unauthenticated" }); return null; }
  const role = await membershipRole(pool, orgId, user.id).catch(() => null);
  if (!role) { await reply.status(404).send({ error: "not_found" }); return null; }
  if (allowed && !allowed.includes(role)) {
    await reply.status(403).send({ error: "insufficient_role" }); return null;
  }
  return { user, role };
}

const createOrgSchema = z.object({ name: z.string().min(1), slug: z.string().min(1).regex(/^[a-z0-9-]+$/) });
const addMemberSchema = z.object({ userId: z.string().uuid(), role: z.enum(ROLES) });
const reportingSchema = z.object({ userId: z.string().uuid(), managerId: z.string().uuid().nullable() });
const MAX_CHAIN = 100;

export function registerOrgRoutes(app: FastifyInstance, pool: Pool) {
  app.post("/api/orgs", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    try {
      const { rows } = await pool.query(
        "INSERT INTO organizations(name, slug) VALUES ($1,$2) RETURNING id, name, slug",
        [parsed.data.name, parsed.data.slug],
      );
      await pool.query("INSERT INTO memberships(user_id, org_id, role) VALUES ($1,$2,'owner')", [user.id, rows[0].id]);
      return reply.status(201).send({ org: rows[0] });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return reply.status(409).send({ error: "slug_taken" });
      throw err;
    }
  });

  app.get("/api/orgs/:orgId/members", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!(await gate(pool, req, reply, orgId))) return;
    const { rows } = await pool.query(
      `SELECT u.id AS "userId", u.name, u.email, m.role
       FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.name`,
      [orgId],
    );
    return reply.send({ members: rows });
  });

  app.post("/api/orgs/:orgId/members", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!(await gate(pool, req, reply, orgId, ADMIN_ROLES))) return;
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO memberships(user_id, org_id, role) VALUES ($1,$2,$3) RETURNING user_id AS "userId", org_id AS "orgId", role`,
        [parsed.data.userId, orgId, parsed.data.role],
      );
      return reply.status(201).send({ membership: rows[0] });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return reply.status(409).send({ error: "already_member" });
      if (code === "23503") return reply.status(400).send({ error: "unknown_user" });
      throw err;
    }
  });

  app.put("/api/orgs/:orgId/reporting", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!(await gate(pool, req, reply, orgId, ADMIN_ROLES))) return;
    const parsed = reportingSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { userId, managerId } = parsed.data;

    if (managerId === null) {
      await pool.query("DELETE FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, userId]);
      return reply.send({ userId, managerId: null });
    }
    if (userId === managerId) return reply.status(400).send({ error: "self_edge" });
    for (const id of [userId, managerId]) {
      if (!(await membershipRole(pool, orgId, id))) return reply.status(400).send({ error: "not_member" });
    }
    // cycle check: walk up from managerId; if we reach userId, adding edge closes a cycle
    let cursor: string | null = managerId;
    for (let hops = 0; cursor; hops++) {
      if (hops > MAX_CHAIN) return reply.status(400).send({ error: "chain_too_deep" });
      if (cursor === userId) return reply.status(400).send({ error: "cycle_detected" });
      const res: { rows: { manager_id: string }[] } = await pool.query(
        "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, cursor],
      );
      cursor = res.rows[0]?.manager_id ?? null;
    }
    await pool.query(
      `INSERT INTO reporting_edges(org_id, user_id, manager_id) VALUES ($1,$2,$3)
       ON CONFLICT (org_id, user_id) DO UPDATE SET manager_id = EXCLUDED.manager_id, updated_at = now()`,
      [orgId, userId, managerId],
    );
    return reply.send({ userId, managerId });
  });

  app.get("/api/orgs/:orgId/reporting/:userId/chain", async (req, reply) => {
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    if (!(await gate(pool, req, reply, orgId))) return;
    const chain: string[] = [];
    let cursor: string | null = userId;
    for (let hops = 0; ; hops++) {
      if (hops > MAX_CHAIN) return reply.status(400).send({ error: "chain_too_deep" });
      const res: { rows: { manager_id: string }[] } = await pool.query(
        "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, cursor],
      );
      cursor = res.rows[0]?.manager_id ?? null;
      if (!cursor) break;
      chain.push(cursor);
    }
    return reply.send({ chain });
  });
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { currentUser, type AuthedUser } from "./auth.js";
import type { Pool } from "./db.js";

type Role = "owner" | "admin" | "manager" | "member";
const ADMIN_ROLES: Role[] = ["owner", "admin"];

async function membershipRole(pool: Pool, orgId: string, userId: string): Promise<Role | null> {
  const { rows } = await pool.query(
    "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return (rows[0]?.role as Role) ?? null;
}

/** SPEC-002 R5 semantics: non-members and unknown orgs get 404; insufficient role 403. */
async function adminGate(
  pool: Pool, req: FastifyRequest, reply: FastifyReply, orgId: string,
): Promise<AuthedUser | null> {
  const user = await currentUser(pool, req);
  if (!user) { await reply.status(401).send({ error: "unauthenticated" }); return null; }
  const role = await membershipRole(pool, orgId, user.id).catch(() => null);
  if (!role) { await reply.status(404).send({ error: "not_found" }); return null; }
  if (!ADMIN_ROLES.includes(role)) {
    await reply.status(403).send({ error: "insufficient_role" }); return null;
  }
  return user;
}

export function registerJoinRequestRoutes(app: FastifyInstance, pool: Pool) {
  // R1: full directory with the caller's own relationship — and nothing else's
  app.get("/api/orgs/directory", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows } = await pool.query(
      `SELECT o.id, o.name, o.slug,
              m.role AS membership,
              r.status AS "requestStatus"
       FROM organizations o
       LEFT JOIN memberships m ON m.org_id = o.id AND m.user_id = $1
       LEFT JOIN LATERAL (
         SELECT status FROM org_join_requests
         WHERE org_id = o.id AND user_id = $1 AND status <> 'approved'
         ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 1
       ) r ON true
       ORDER BY o.name`,
      [user.id],
    );
    return reply.send({ orgs: rows });
  });

  // R2: request access (non-member); pending-uniqueness enforced by partial index
  app.post("/api/orgs/:orgId/join-requests", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (await membershipRole(pool, orgId, user.id).catch(() => null))
      return reply.status(409).send({ error: "already_member" });
    try {
      const { rows } = await pool.query(
        `INSERT INTO org_join_requests(org_id, user_id)
         VALUES ($1, $2) RETURNING id, org_id AS "orgId", status, created_at AS "createdAt"`,
        [orgId, user.id],
      );
      return reply.status(201).send({ request: rows[0] });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") return reply.status(409).send({ error: "already_requested" });
      if (code === "23503" || code === "22P02") return reply.status(404).send({ error: "not_found" });
      throw err;
    }
  });

  // R3: the requester's own view
  app.get("/api/me/join-requests", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows } = await pool.query(
      `SELECT r.id, r.org_id AS "orgId", o.name AS "orgName", o.slug, r.status, r.created_at AS "createdAt"
       FROM org_join_requests r JOIN organizations o ON o.id = r.org_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
      [user.id],
    );
    return reply.send({ requests: rows });
  });

  // R4: admin list of pending requests
  app.get("/api/orgs/:orgId/join-requests", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!(await adminGate(pool, req, reply, orgId))) return;
    const { rows } = await pool.query(
      `SELECT r.id, r.user_id AS "userId", u.name, u.email, r.created_at AS "createdAt"
       FROM org_join_requests r JOIN users u ON u.id = r.user_id
       WHERE r.org_id = $1 AND r.status = 'pending' ORDER BY r.created_at`,
      [orgId],
    );
    return reply.send({ requests: rows });
  });

  // R5: approve → membership at the lowest role
  app.post("/api/orgs/:orgId/join-requests/:requestId/approve", async (req, reply) => {
    const { orgId, requestId } = req.params as { orgId: string; requestId: string };
    const admin = await adminGate(pool, req, reply, orgId);
    if (!admin) return;
    const { rows } = await pool.query(
      `UPDATE org_join_requests SET status = 'approved', decided_at = now(), decided_by = $3
       WHERE id = $1 AND org_id = $2 AND status = 'pending' RETURNING user_id`,
      [requestId, orgId, admin.id],
    ).catch(() => ({ rows: [] as Array<{ user_id: string }> }));
    if (!rows[0]) return reply.status(404).send({ error: "request_not_found" });
    try {
      const ins = await pool.query(
        `INSERT INTO memberships(user_id, org_id, role) VALUES ($1, $2, 'member')
         RETURNING user_id AS "userId", org_id AS "orgId", role`,
        [rows[0].user_id, orgId],
      );
      return reply.send({ membership: ins.rows[0] });
    } catch (err) {
      // Raced by an invite acceptance: the request's intent is already satisfied (spec §5)
      if ((err as { code?: string }).code === "23505") return reply.status(409).send({ error: "already_member" });
      throw err;
    }
  });

  // R6: decline; requester may try again later
  app.post("/api/orgs/:orgId/join-requests/:requestId/decline", async (req, reply) => {
    const { orgId, requestId } = req.params as { orgId: string; requestId: string };
    const admin = await adminGate(pool, req, reply, orgId);
    if (!admin) return;
    const { rows } = await pool.query(
      `UPDATE org_join_requests SET status = 'declined', decided_at = now(), decided_by = $3
       WHERE id = $1 AND org_id = $2 AND status = 'pending' RETURNING id, status`,
      [requestId, orgId, admin.id],
    ).catch(() => ({ rows: [] as Array<{ id: string; status: string }> }));
    if (!rows[0]) return reply.status(404).send({ error: "request_not_found" });
    return reply.send({ request: rows[0] });
  });
}

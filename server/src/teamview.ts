import type { FastifyInstance } from "fastify";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";
import { coreRequest, type CoreClient } from "./feedback.js";

/**
 * SPEC-010. CLOSED SCHEMA (R4): each team row is exactly
 * {userId, name, attributesEstablished, attributesEmerging, pendingValidations}.
 * Adding any field requires a spec amendment — the locked itest asserts the key set.
 * No chat/share/absence data may ever be joined here (invariants 3/4/5).
 */
export function registerTeamViewRoutes(app: FastifyInstance, pool: Pool, core: CoreClient) {
  app.get("/api/orgs/:orgId/team-signal", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, user.id],
    );
    if (!roleRows[0]) return reply.status(404).send({ error: "not_found" });

    const { rows: reports } = await pool.query(
      `WITH RECURSIVE down AS (
         SELECT user_id FROM reporting_edges WHERE org_id = $1 AND manager_id = $2
         UNION
         SELECT r.user_id FROM reporting_edges r JOIN down d ON r.manager_id = d.user_id AND r.org_id = $1
       )
       SELECT u.id AS "userId", u.name FROM down JOIN users u ON u.id = down.user_id
       ORDER BY u.name ASC`,
      [orgId, user.id],
    );
    if (reports.length === 0) return reply.send({ team: [] });

    // pendingValidations: the caller's unvalidated active subjective items per subject
    const qs = new URLSearchParams({
      orgId,
      subjectUserIds: (reports as Array<{ userId: string }>).map((r) => r.userId).join(","),
      state: "active",
      unvalidatedBy: user.id,
      limit: "50",
    });
    const pendingRes = await coreRequest(core, "GET", `/v1/evidence?${qs}`);
    if (!pendingRes || pendingRes.status !== 200) return reply.status(502).send({ error: "core_unreachable" });
    const pending = (pendingRes.json as { items: Array<{ subjectUserId: string }> }).items;
    const pendingBySubject = new Map<string, number>();
    for (const it of pending) pendingBySubject.set(it.subjectUserId, (pendingBySubject.get(it.subjectUserId) ?? 0) + 1);

    const team = [];
    for (const r of reports as Array<{ userId: string; name: string }>) {
      const summary = await coreRequest(core, "GET", `/v1/users/${r.userId}/attributes?orgId=${orgId}`);
      if (!summary || summary.status !== 200) return reply.status(502).send({ error: "core_unreachable" });
      const attrs = (summary.json as { attributes: Array<{ status: string }> }).attributes;
      team.push({
        userId: r.userId,
        name: r.name,
        attributesEstablished: attrs.filter((a) => a.status === "established").length,
        attributesEmerging: attrs.filter((a) => a.status === "emerging").length,
        pendingValidations: pendingBySubject.get(r.userId) ?? 0,
      });
    }
    return reply.send({ team });
  });
}

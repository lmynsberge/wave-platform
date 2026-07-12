import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";
import { coreRequest, type CoreClient } from "./feedback.js";

const batchSchema = z.object({
  source: z.string().min(1),
  period: z.string().min(1),
  metrics: z.array(z.object({
    email: z.string().email(),
    attributeKey: z.string().min(1),
    value: z.number().finite(),
  })).min(1),
});

/** SPEC-008: hard metrics self-originate from systems — authorUserId is always null here. */
export function registerIngestRoutes(app: FastifyInstance, pool: Pool, core: CoreClient) {
  app.post("/api/orgs/:orgId/ingest/metrics", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, user.id],
    );
    const role = roleRows[0]?.role as string | undefined;
    if (!role) return reply.status(404).send({ error: "not_found" });
    if (role !== "owner" && role !== "admin") return reply.status(403).send({ error: "insufficient_role" });

    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { source, period, metrics } = parsed.data;

    const attrs = await coreRequest(core, "GET", "/v1/attributes");
    if (!attrs || attrs.status !== 200) return reply.status(502).send({ error: "core_unreachable" });
    const kinds = new Map((attrs.json as Array<{ key: string; kind: string }>).map((a) => [a.key, a.kind]));

    let ingested = 0;
    const skipped: Array<{ email: string; reason: string }> = [];
    for (const m of metrics) {
      const kind = kinds.get(m.attributeKey);
      if (!kind) { skipped.push({ email: m.email, reason: "unknown_attribute" }); continue; }
      if (kind !== "objective") { skipped.push({ email: m.email, reason: "subjective_attribute" }); continue; }
      const { rows } = await pool.query(
        `SELECT u.id FROM users u JOIN memberships ms ON ms.user_id = u.id
         WHERE u.email = $1 AND ms.org_id = $2`, [m.email, orgId],
      );
      const subject = rows[0]?.id as string | undefined;
      if (!subject) { skipped.push({ email: m.email, reason: "unknown_user" }); continue; }
      const res = await coreRequest(core, "POST", "/v1/evidence", {
        orgId, subjectUserId: subject, authorUserId: null,
        attributeKey: m.attributeKey, valueNumeric: m.value, note: null, source, period,
      });
      if (res?.status === 201) ingested++;
      else skipped.push({ email: m.email, reason: "core_rejected" });
    }
    return reply.send({ ingested, skipped });
  });
}

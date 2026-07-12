import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";
import { isManagerOf, type CoreClient } from "./feedback.js";

async function coreGet(core: CoreClient, path: string) {
  try {
    const res = await core.fetchImpl(`${core.coreUrl}${path}`, { method: "GET" });
    return { status: res.status, json: await res.json().catch(() => null) };
  } catch {
    return null;
  }
}
async function corePost(core: CoreClient, path: string, body: unknown) {
  try {
    const res = await core.fetchImpl(`${core.coreUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  } catch {
    return null;
  }
}

async function orgRole(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return rows[0]?.role ?? null;
}

/** All users whose upward chain contains managerId (direct + transitive reports). */
async function reportsOf(pool: Pool, orgId: string, managerId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `WITH RECURSIVE down AS (
       SELECT user_id FROM reporting_edges WHERE org_id = $1 AND manager_id = $2
       UNION
       SELECT r.user_id FROM reporting_edges r JOIN down d ON r.manager_id = d.user_id AND r.org_id = $1
     ) SELECT user_id FROM down`,
    [orgId, managerId],
  );
  return rows.map((r: { user_id: string }) => r.user_id);
}

async function managerOf(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return rows[0]?.manager_id ?? null;
}

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime({ offset: true }).optional(),
});
const assessmentSchema = z.object({
  subjectUserId: z.string().uuid(),
  attributeKey: z.string().min(1),
  note: z.string().min(1),
});
const decisionSchema = z.object({ outcome: z.enum(["yes", "no", "no_signal"]) });

export function registerFlowRoutes(app: FastifyInstance, pool: Pool, core: CoreClient) {
  // R1: manager validation queue
  app.get("/api/orgs/:orgId/validation-queue", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await orgRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const page = pageSchema.safeParse(req.query);
    if (!page.success) return reply.status(400).send({ error: "invalid_query" });

    const reports = await reportsOf(pool, orgId, user.id);
    if (reports.length === 0) return reply.send({ items: [], nextBefore: null });
    const qs = new URLSearchParams({
      orgId, subjectUserIds: reports.join(","), state: "active",
      unvalidatedBy: user.id, limit: String(page.data.limit),
    });
    if (page.data.before) qs.set("before", page.data.before);
    const res = await coreGet(core, `/v1/evidence?${qs}`);
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    // strip author identity from queue view
    const body = res.json as { items: Array<Record<string, unknown>>; nextBefore: string | null };
    for (const it of body.items) delete it.authorUserId;
    return reply.status(res.status).send(body);
  });

  // R2: individual inbox (own evidence; author identity hidden)
  app.get("/api/orgs/:orgId/inbox", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await orgRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const page = pageSchema.safeParse(req.query);
    if (!page.success) return reply.status(400).send({ error: "invalid_query" });
    const qs = new URLSearchParams({ orgId, subjectUserIds: user.id, limit: String(page.data.limit) });
    if (page.data.before) qs.set("before", page.data.before);
    const res = await coreGet(core, `/v1/evidence?${qs}`);
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    const body = res.json as { items: Array<Record<string, unknown>>; nextBefore: string | null };
    const items = body.items.map((it) => ({
      evidenceId: it.evidenceId, attributeKey: it.attributeKey, note: it.note,
      authorKnown: it.authorUserId != null, createdAt: it.createdAt, state: it.state,
    }));
    return reply.send({ items, nextBefore: body.nextBefore });
  });

  // R3: manager assessment → pending_upward
  app.post("/api/orgs/:orgId/assessments", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await orgRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const parsed = assessmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { subjectUserId, attributeKey, note } = parsed.data;
    if (!(await isManagerOf(pool, orgId, user.id, subjectUserId)))
      return reply.status(403).send({ error: "not_manager" });
    const res = await corePost(core, "/v1/evidence", {
      orgId, subjectUserId, authorUserId: user.id, attributeKey,
      valueNumeric: null, note, state: "pending_upward",
    });
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    if (res.status === 201) return reply.status(201).send({ evidence: res.json });
    return reply.status(res.status).send(res.json);
  });

  // upward queue: pending assessments authored by callers' reports (R5) or by root authors if caller owner/admin (R6)
  app.get("/api/orgs/:orgId/upward-queue", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const role = await orgRole(pool, orgId, user.id);
    if (!role) return reply.status(404).send({ error: "not_found" });
    const page = pageSchema.safeParse(req.query);
    if (!page.success) return reply.status(400).send({ error: "invalid_query" });

    const qs = new URLSearchParams({ orgId, state: "pending_upward", limit: "50" });
    const res = await coreGet(core, `/v1/evidence?${qs}`);
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    const body = res.json as { items: Array<Record<string, unknown>> };
    const myReports = new Set(await reportsOf(pool, orgId, user.id));
    const isAdmin = role === "owner" || role === "admin";
    const items = [];
    for (const it of body.items) {
      const author = it.authorUserId as string | null;
      if (!author || author === user.id) continue;
      if (myReports.has(author)) { items.push(it); continue; }
      if (isAdmin && (await managerOf(pool, orgId, author)) === null) items.push(it); // R6 root author
    }
    return reply.send({ items: items.slice(0, page.data.limit), nextBefore: null });
  });

  // R5/R6: decide
  app.post("/api/orgs/:orgId/assessments/:evidenceId/decision", async (req, reply) => {
    const { orgId, evidenceId } = req.params as { orgId: string; evidenceId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const role = await orgRole(pool, orgId, user.id);
    if (!role) return reply.status(404).send({ error: "not_found" });
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });

    const ev = await coreGet(core, `/v1/evidence/${evidenceId}`);
    if (!ev) return reply.status(502).send({ error: "core_unreachable" });
    if (ev.status !== 200) return reply.status(ev.status).send(ev.json);
    const author = (ev.json as { authorUserId: string | null }).authorUserId;
    if (!author || author === user.id) return reply.status(403).send({ error: "not_eligible" });

    const authorIsMine = await isManagerOf(pool, orgId, user.id, author);
    const authorIsRoot = (await managerOf(pool, orgId, author)) === null;
    const isAdmin = role === "owner" || role === "admin";
    if (!authorIsMine && !(authorIsRoot && isAdmin))
      return reply.status(403).send({ error: "not_eligible" });

    const res = await corePost(core, `/v1/evidence/${evidenceId}/decide`, {
      deciderUserId: user.id, outcome: parsed.data.outcome,
    });
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    if (res.status === 200) return reply.status(201).send(res.json);
    return reply.status(res.status).send(res.json);
  });
}

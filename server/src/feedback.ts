import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { currentUser, type AuthedUser } from "./auth.js";
import type { Pool } from "./db.js";

/** Options threaded from app: core base url + fetch (injectable for tests). */
export interface CoreClient {
  coreUrl: string;
  fetchImpl: typeof fetch;
}

async function coreRequest(
  core: CoreClient, method: string, path: string, body?: unknown,
): Promise<{ status: number; json: unknown } | null> {
  try {
    const res = await core.fetchImpl(`${core.coreUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
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

/** SPEC-002 R5 semantics: 401 unauth, 404 non-member/unknown org. */
async function gateMember(
  pool: Pool, req: FastifyRequest, reply: FastifyReply, orgId: string,
): Promise<AuthedUser | null> {
  const user = await currentUser(pool, req);
  if (!user) { await reply.status(401).send({ error: "unauthenticated" }); return null; }
  const role = await orgRole(pool, orgId, user.id).catch(() => null);
  if (!role) { await reply.status(404).send({ error: "not_found" }); return null; }
  return user;
}

/** Walk subject's upward chain; true if candidate is one of their (transitive) managers. */
export async function isManagerOf(
  pool: Pool, orgId: string, candidateId: string, subjectId: string,
): Promise<boolean> {
  let cursor: string | null = subjectId;
  for (let hops = 0; hops <= 100; hops++) {
    const res: { rows: { manager_id: string }[] } = await pool.query(
      "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, cursor],
    );
    cursor = res.rows[0]?.manager_id ?? null;
    if (!cursor) return false;
    if (cursor === candidateId) return true;
  }
  return false;
}

const feedbackSchema = z.object({
  subjectUserId: z.string().uuid(),
  attributeKey: z.string().min(1),
  note: z.string().min(1),
});
const validationSchema = z.object({ outcome: z.enum(["yes", "no", "no_signal"]) });

export function registerFeedbackRoutes(app: FastifyInstance, pool: Pool, core: CoreClient) {
  app.post("/api/orgs/:orgId/feedback", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await gateMember(pool, req, reply, orgId);
    if (!user) return;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { subjectUserId, attributeKey, note } = parsed.data;

    if (subjectUserId === user.id) return reply.status(400).send({ error: "self_feedback" });
    if (!(await orgRole(pool, orgId, subjectUserId)))
      return reply.status(400).send({ error: "not_member" });

    // TRUST INVARIANT 1 (SPEC-003 R5): managers cannot originate subjective
    // evidence about anyone in their downward chain.
    if (await isManagerOf(pool, orgId, user.id, subjectUserId))
      return reply.status(403).send({ error: "manager_cannot_originate" });

    const res = await coreRequest(core, "POST", "/v1/evidence", {
      orgId, subjectUserId, authorUserId: user.id, attributeKey, valueNumeric: null, note,
    });
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    if (res.status === 201) return reply.status(201).send({ evidence: res.json });
    return reply.status(res.status).send(res.json);
  });

  app.post("/api/orgs/:orgId/feedback/:evidenceId/validations", async (req, reply) => {
    const { orgId, evidenceId } = req.params as { orgId: string; evidenceId: string };
    const user = await gateMember(pool, req, reply, orgId);
    if (!user) return;
    const parsed = validationSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });

    const res = await coreRequest(core, "POST", `/v1/evidence/${evidenceId}/validations`, {
      validatorUserId: user.id, outcome: parsed.data.outcome,
    });
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    if (res.status === 201) return reply.status(201).send({ validation: res.json });
    return reply.status(res.status).send(res.json);
  });

  app.get("/api/orgs/:orgId/members/:userId/attributes", async (req, reply) => {
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    const user = await gateMember(pool, req, reply, orgId);
    if (!user) return;
    const res = await coreRequest(core, "GET", `/v1/users/${userId}/attributes?orgId=${orgId}`);
    if (!res) return reply.status(502).send({ error: "core_unreachable" });
    return reply.status(res.status).send(res.json);
  });
}

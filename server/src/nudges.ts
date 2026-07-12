import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";
import { coreRequest, isManagerOf, type CoreClient } from "./feedback.js";

/**
 * SPEC-009. Gaps are the individual's information (R1): no route here accepts
 * a target userId — every response is scoped to the authenticated caller.
 */

async function memberRole(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return rows[0]?.role ?? null;
}

async function upwardChain(pool: Pool, orgId: string, userId: string): Promise<Set<string>> {
  const chain = new Set<string>();
  let cursor: string | null = userId;
  for (let hops = 0; hops <= 100 && cursor; hops++) {
    const res: { rows: Array<{ manager_id: string }> } = await pool.query(
      "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, cursor],
    );
    cursor = res.rows[0]?.manager_id ?? null;
    if (cursor) chain.add(cursor);
  }
  return chain;
}

interface EvidenceItem { authorUserId: string | null; attributeKey: string; createdAt: string }

async function activeEvidenceAbout(core: CoreClient, orgId: string, userId: string): Promise<EvidenceItem[]> {
  const qs = new URLSearchParams({ orgId, subjectUserIds: userId, state: "active", limit: "50" });
  const res = await coreRequest(core, "GET", `/v1/evidence?${qs}`);
  if (!res || res.status !== 200) return [];
  return (res.json as { items: EvidenceItem[] }).items;
}

const requestSchema = z.object({ recipientId: z.string().uuid(), attributeKey: z.string().min(1) });

export function registerNudgeRoutes(app: FastifyInstance, pool: Pool, core: CoreClient) {
  // R1+R2: gap feed with invariant-aware suggestions
  app.get("/api/orgs/:orgId/nudges", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });

    const summary = await coreRequest(core, "GET", `/v1/users/${user.id}/attributes?orgId=${orgId}`);
    if (!summary || summary.status !== 200) return reply.status(502).send({ error: "core_unreachable" });
    const attrs = (summary.json as { attributes: Array<Record<string, unknown>> }).attributes;
    const gaps = attrs.filter((a) => a.status !== "established" && a.kind === "subjective");
    if (gaps.length === 0) return reply.send({ gaps: [] });

    const chain = await upwardChain(pool, orgId, user.id);
    const evidence = await activeEvidenceAbout(core, orgId, user.id);
    const { rows: members } = await pool.query(
      `SELECT u.id AS "userId", u.name FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1 ORDER BY u.name`, [orgId],
    );
    const result = gaps.map((g) => {
      const authors = new Set(
        evidence.filter((e) => e.attributeKey === g.key && e.authorUserId).map((e) => e.authorUserId as string),
      );
      const suggestedRecipients = (members as Array<{ userId: string; name: string }>).filter(
        (m) => m.userId !== user.id && !chain.has(m.userId) && !authors.has(m.userId),
      );
      return {
        attributeKey: g.key, status: g.status, evidenceCount: g.evidenceCount,
        distinctAuthors: g.distinctAuthors, distinctValidators: g.distinctValidators,
        suggestedRecipients,
      };
    });
    return reply.send({ gaps: result });
  });

  // R3: create request
  app.post("/api/orgs/:orgId/feedback-requests", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { recipientId, attributeKey } = parsed.data;

    if (recipientId === user.id) return reply.status(400).send({ error: "invalid_recipient" });
    if (await isManagerOf(pool, orgId, recipientId, user.id))
      return reply.status(400).send({ error: "invalid_recipient" }); // INVARIANT 1: managers can't originate
    if (!(await memberRole(pool, orgId, recipientId))) return reply.status(400).send({ error: "not_member" });

    try {
      const { rows } = await pool.query(
        `INSERT INTO feedback_requests(org_id, requester_id, recipient_id, attribute_key)
         VALUES ($1,$2,$3,$4) RETURNING id, recipient_id AS "recipientId", attribute_key AS "attributeKey"`,
        [orgId, user.id, recipientId, attributeKey],
      );
      return reply.status(201).send({ request: { ...rows[0], status: "open" } });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return reply.status(409).send({ error: "duplicate_request" });
      throw err;
    }
  });

  // R5 helper: fulfilled iff recipient authored active evidence about requester on the attribute after creation
  async function withStatus(core: CoreClient, orgId: string, rows: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown> & { status: string }>> {
    const byRequester = new Map<string, EvidenceItem[]>();
    const out: Array<Record<string, unknown> & { status: string }> = [];
    for (const r of rows) {
      const requester = r.requesterId as string;
      if (!byRequester.has(requester)) byRequester.set(requester, await activeEvidenceAbout(core, orgId, requester));
      const ev = byRequester.get(requester)!;
      const fulfilled = ev.some(
        (e) => e.authorUserId === r.recipientId && e.attributeKey === r.attributeKey &&
               new Date(e.createdAt) >= new Date(r.createdAt as string),
      );
      out.push({ ...r, status: fulfilled ? "fulfilled" : "open" } as Record<string, unknown> & { status: string });
    }
    return out;
  }

  // R4: asks (recipient view, open only)
  app.get("/api/orgs/:orgId/asks", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const { rows } = await pool.query(
      `SELECT r.id, r.requester_id AS "requesterId", r.recipient_id AS "recipientId",
              r.attribute_key AS "attributeKey", r.created_at AS "createdAt", u.name AS "requesterName"
       FROM feedback_requests r JOIN users u ON u.id = r.requester_id
       WHERE r.org_id = $1 AND r.recipient_id = $2 ORDER BY r.created_at DESC`,
      [orgId, user.id],
    );
    const withS = await withStatus(core, orgId, rows);
    const asks = withS
      .filter((r) => r.status === "open")
      .map((r) => ({
        id: r.id, attributeKey: r.attributeKey, createdAt: r.createdAt,
        requester: { userId: r.requesterId, name: r.requesterName },
      }));
    return reply.send({ asks });
  });

  // R6: outgoing (requester view, with status)
  app.get("/api/orgs/:orgId/feedback-requests", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const { rows } = await pool.query(
      `SELECT id, requester_id AS "requesterId", recipient_id AS "recipientId",
              attribute_key AS "attributeKey", created_at AS "createdAt"
       FROM feedback_requests WHERE org_id = $1 AND requester_id = $2 ORDER BY created_at DESC`,
      [orgId, user.id],
    );
    const withS = await withStatus(core, orgId, rows);
    const requests = withS.map((r) => ({
      id: r.id, recipientId: r.recipientId, attributeKey: r.attributeKey, status: r.status, createdAt: r.createdAt,
    }));
    return reply.send({ requests });
  });
}

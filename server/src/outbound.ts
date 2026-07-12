import type { FastifyInstance } from "fastify";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";
import { coreRequest, type CoreClient } from "./feedback.js";

/**
 * SPEC-013. Proactive delivery. INVARIANT 5 hinge: the dispatch response is
 * count-only — the org learns HOW MANY messages went out, never WHO has gaps.
 * Content flows solely to each individual's own verified binding (invariant 3).
 */

export interface OutboundTransport {
  send(externalId: string, text: string): Promise<boolean>;
}

export function testTransport(url: string, fetchImpl: typeof fetch): OutboundTransport {
  return {
    async send(externalId, text) {
      try {
        const res = await fetchImpl(url, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ externalId, text }),
        });
        return res.ok;
      } catch { return false; }
    },
  };
}

export function slackTransport(botToken: string, fetchImpl: typeof fetch): OutboundTransport {
  return {
    async send(externalId, text) {
      try {
        const res = await fetchImpl("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${botToken}` },
          body: JSON.stringify({ channel: externalId, text }),
        });
        return res.ok;
      } catch { return false; }
    },
  };
}

export function teamsTransport(webhookUrl: string, fetchImpl: typeof fetch): OutboundTransport {
  return {
    async send(externalId, text) {
      try {
        const res = await fetchImpl(webhookUrl, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ recipient: externalId, text }),
        });
        return res.ok;
      } catch { return false; }
    },
  };
}

const DEDUP_DAYS = 7;
const GAP_TEXT = "You've got signal building — a quick `checkin` with your companion is a good way to keep it moving.";
const ASKS_TEXT = "A colleague asked for your perspective. Send `asks` to see what's waiting.";

export function registerOutboundRoutes(app: FastifyInstance, pool: Pool, core: CoreClient, fetchImpl: typeof fetch) {
  const transports = new Map<string, OutboundTransport>();
  if (process.env.BRIDGE_TEST_OUTBOUND_URL) transports.set("test", testTransport(process.env.BRIDGE_TEST_OUTBOUND_URL, fetchImpl));
  if (process.env.SLACK_BOT_TOKEN) transports.set("slack", slackTransport(process.env.SLACK_BOT_TOKEN, fetchImpl));
  if (process.env.TEAMS_WEBHOOK_URL) transports.set("teams", teamsTransport(process.env.TEAMS_WEBHOOK_URL, fetchImpl));

  app.post("/api/orgs/:orgId/nudge-dispatch", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, user.id],
    );
    const role = roleRows[0]?.role as string | undefined;
    if (!role) return reply.status(404).send({ error: "not_found" });
    if (role !== "owner" && role !== "admin") return reply.status(403).send({ error: "insufficient_role" });

    const { rows: bindings } = await pool.query(
      "SELECT platform, external_id AS \"externalId\", user_id AS \"userId\" FROM bridge_bindings WHERE org_id = $1",
      [orgId],
    );

    let notified = 0;
    for (const b of bindings as Array<{ platform: string; externalId: string; userId: string }>) {
      const transport = transports.get(b.platform);
      if (!transport) continue;

      const candidates: Array<{ kind: string; text: string }> = [];

      // gap_checkin: any subjective attribute below established
      const summary = await coreRequest(core, "GET", `/v1/users/${b.userId}/attributes?orgId=${orgId}`);
      const attrs = ((summary?.json as { attributes?: Array<{ status: string; kind: string }> })?.attributes) ?? [];
      if (attrs.some((a) => a.kind === "subjective" && a.status !== "established"))
        candidates.push({ kind: "gap_checkin", text: GAP_TEXT });

      // asks_reminder: any open (unfulfilled) request addressed to them
      const { rows: reqs } = await pool.query(
        "SELECT requester_id AS \"requesterId\", attribute_key AS \"attributeKey\", created_at AS \"createdAt\" FROM feedback_requests WHERE org_id = $1 AND recipient_id = $2",
        [orgId, b.userId],
      );
      let hasOpen = false;
      for (const r of reqs as Array<{ requesterId: string; attributeKey: string; createdAt: string }>) {
        const qs = new URLSearchParams({ orgId, subjectUserIds: r.requesterId, state: "active", limit: "50" });
        const list = await coreRequest(core, "GET", `/v1/evidence?${qs}`);
        const items = ((list?.json as { items?: Array<{ authorUserId: string | null; attributeKey: string; createdAt: string }> })?.items) ?? [];
        const fulfilled = items.some(
          (e) => e.authorUserId === b.userId && e.attributeKey === r.attributeKey && new Date(e.createdAt) >= new Date(r.createdAt),
        );
        if (!fulfilled) { hasOpen = true; break; }
      }
      if (hasOpen) candidates.push({ kind: "asks_reminder", text: ASKS_TEXT });

      for (const c of candidates) {
        // R4 dedup window
        const { rows: logRows } = await pool.query(
          `SELECT 1 FROM bridge_nudge_log WHERE user_id = $1 AND org_id = $2 AND kind = $3
           AND sent_at > now() - interval '${DEDUP_DAYS} days'`,
          [b.userId, orgId, c.kind],
        );
        if (logRows[0]) continue;
        const ok = await transport.send(b.externalId, c.text);
        if (!ok) continue; // uncounted + unlogged → retried next dispatch (§5)
        await pool.query(
          `INSERT INTO bridge_nudge_log(user_id, org_id, kind) VALUES ($1,$2,$3)
           ON CONFLICT (user_id, org_id, kind) DO UPDATE SET sent_at = now()`,
          [b.userId, orgId, c.kind],
        );
        notified++;
      }
    }
    return reply.send({ notified });
  });
}

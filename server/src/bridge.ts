import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";

/**
 * SPEC-012. Binding-as-authorization: the acting user is resolved from the
 * VERIFIED platform identity — never from message content. Companion data
 * flows only to the linked owner's externalId (invariant 3 across the bridge).
 */

export interface NormalizedEvent { externalId: string; text: string }

export interface PlatformAdapter {
  /** Verify authenticity and normalize; null = reject (401). */
  verifyAndNormalize(req: FastifyRequest): NormalizedEvent | null;
}

/** Slack: v0 signing scheme — HMAC-SHA256 over `v0:{ts}:{rawBody}`, 5-minute replay window. */
export function slackAdapter(signingSecret: string, now: () => number = Date.now): PlatformAdapter {
  return {
    verifyAndNormalize(req) {
      const ts = req.headers["x-slack-request-timestamp"] as string | undefined;
      const sig = req.headers["x-slack-signature"] as string | undefined;
      if (!ts || !sig) return null;
      if (Math.abs(now() / 1000 - Number(ts)) > 300) return null; // replay window
      const raw = (req as unknown as { rawBody?: string }).rawBody;
      if (!raw) return null; // SPEC-018 R2: never verify reconstructed bytes — fail closed
      const expected = "v0=" + createHmac("sha256", signingSecret).update(`v0:${ts}:${raw}`).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(sig);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      const body = req.body as { event?: { user?: string; text?: string } };
      if (!body.event?.user || typeof body.event.text !== "string") return null;
      return { externalId: body.event.user, text: body.event.text };
    },
  };
}

/** Teams v1: shared-secret header (AAD JWT verification is a tracked follow-up). */
export function teamsAdapter(secret: string): PlatformAdapter {
  return {
    verifyAndNormalize(req) {
      const given = req.headers["x-teams-secret"] as string | undefined;
      if (!given || given !== secret) return null;
      const body = req.body as { from?: { id?: string }; text?: string };
      if (!body.from?.id || typeof body.text !== "string") return null;
      return { externalId: body.from.id, text: body.text };
    },
  };
}

/** Test adapter — active ONLY when BRIDGE_TEST_SECRET is configured. */
export function testAdapter(secret: string): PlatformAdapter {
  return {
    verifyAndNormalize(req) {
      if ((req.headers["x-bridge-secret"] as string | undefined) !== secret) return null;
      const body = req.body as { externalId?: string; text?: string };
      if (!body.externalId || typeof body.text !== "string") return null;
      return { externalId: body.externalId, text: body.text };
    },
  };
}

const LINK_GUIDANCE =
  "This identity isn't linked yet. In Wave on the web, open Settings → mint a link code, then send: link <code>";

interface Binding { user_id: string; org_id: string }

export function registerBridgeRoutes(app: FastifyInstance, pool: Pool, coreUrl: string, fetchImpl: typeof fetch) {
  const adapters = new Map<string, PlatformAdapter>();
  if (process.env.SLACK_SIGNING_SECRET) adapters.set("slack", slackAdapter(process.env.SLACK_SIGNING_SECRET));
  if (process.env.TEAMS_SHARED_SECRET) adapters.set("teams", teamsAdapter(process.env.TEAMS_SHARED_SECRET));
  if (process.env.BRIDGE_TEST_SECRET) adapters.set("test", testAdapter(process.env.BRIDGE_TEST_SECRET));

  // R1: mint a link code (web session)
  app.post("/api/bridge/link-codes", async (req, reply) => {
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    const parsed = z.object({ orgId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { rows } = await pool.query(
      "SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2", [parsed.data.orgId, user.id],
    );
    if (!rows[0]) return reply.status(404).send({ error: "not_found" });
    const code = randomBytes(4).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      "INSERT INTO bridge_link_codes(code, user_id, org_id, expires_at) VALUES ($1,$2,$3,$4)",
      [code, user.id, parsed.data.orgId, expiresAt],
    );
    return reply.status(201).send({ code, expiresAt });
  });

  // R2: inbound gateway
  app.post("/api/bridge/:platform/events", async (req, reply) => {
    const { platform } = req.params as { platform: string };
    const adapter = adapters.get(platform);
    if (!adapter) return reply.status(400).send({ error: "unknown_platform" });
    const ev = adapter.verifyAndNormalize(req);
    if (!ev) return reply.status(401).send({ error: "verification_failed" });

    const text = ev.text.trim();
    const [keyword, ...rest] = text.split(/\s+/);
    const kw = (keyword ?? "").toLowerCase();

    // linking works pre-binding
    if (kw === "link") {
      const code = rest[0] ?? "";
      const { rows } = await pool.query(
        "UPDATE bridge_link_codes SET used = true WHERE code = $1 AND used = false AND expires_at > now() RETURNING user_id, org_id",
        [code],
      );
      if (!rows[0]) return reply.send({ text: "That code isn't valid anymore — mint a fresh one in Wave on the web and try again." });
      await pool.query(
        `INSERT INTO bridge_bindings(platform, external_id, user_id, org_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (platform, external_id) DO UPDATE SET user_id = EXCLUDED.user_id, org_id = EXCLUDED.org_id`,
        [platform, ev.externalId, rows[0].user_id, rows[0].org_id],
      );
      return reply.send({ text: "Linked ✓ — you're connected to Wave. Try `checkin`, `asks`, or `nudges`." });
    }

    const { rows: bRows } = await pool.query(
      "SELECT user_id, org_id FROM bridge_bindings WHERE platform = $1 AND external_id = $2",
      [platform, ev.externalId],
    );
    const binding = bRows[0] as Binding | undefined;
    if (!binding) return reply.send({ text: LINK_GUIDANCE }); // R3: nothing before linking
    const { user_id: userId, org_id: orgId } = binding;

    const serverBase = `http://127.0.0.1:${process.env.PORT ?? 8080}`;
    // Internal call helper acting AS the bound user — direct DB session shortcut is avoided;
    // we call domain functions via HTTP would need a session. Instead: reuse logic via direct queries/core.
    const core = async (method: string, path: string, body?: unknown) => {
      const res = await fetchImpl(`${coreUrl}${path}`, {
        method, headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, json: (await res.json().catch(() => null)) as unknown };
    };
    void serverBase;

    if (kw === "unlink") {
      await pool.query("DELETE FROM bridge_bindings WHERE platform = $1 AND external_id = $2", [platform, ev.externalId]);
      return reply.send({ text: "Unlinked. Your Wave data stays put; this identity just can't reach it anymore." });
    }

    if (kw === "asks") {
      const { rows } = await pool.query(
        `SELECT r.id, r.attribute_key, u.name FROM feedback_requests r JOIN users u ON u.id = r.requester_id
         WHERE r.org_id = $1 AND r.recipient_id = $2 ORDER BY r.created_at DESC`, [orgId, userId],
      );
      // filter fulfilled: recipient has authored active evidence post-request — reuse simple check
      const open: Array<{ id: string; attribute_key: string; name: string }> = [];
      for (const r of rows) {
        const qs = new URLSearchParams({ orgId, state: "active", limit: "50" });
        const list = await core("GET", `/v1/evidence?${qs}`);
        const items = ((list.json as { items?: Array<{ authorUserId: string | null; attributeKey: string }> })?.items) ?? [];
        const fulfilled = items.some((e) => e.authorUserId === userId && e.attributeKey === r.attribute_key);
        if (!fulfilled) open.push(r);
      }
      if (open.length === 0) return reply.send({ text: "No open asks. When a colleague requests your perspective, it lands here." });
      await pool.query(
        `INSERT INTO bridge_ask_context(platform, external_id, ask_ids) VALUES ($1,$2,$3)
         ON CONFLICT (platform, external_id) DO UPDATE SET ask_ids = EXCLUDED.ask_ids`,
        [platform, ev.externalId, open.map((o) => o.id)],
      );
      return reply.send({
        text: open.map((o, i) => `${i + 1}. ${o.name} asked about ${o.attribute_key} — reply: feedback ${i + 1} <your observation>`).join("\n"),
      });
    }

    if (kw === "feedback") {
      const n = Number(rest[0]);
      const note = rest.slice(1).join(" ");
      const { rows: ctx } = await pool.query(
        "SELECT ask_ids FROM bridge_ask_context WHERE platform = $1 AND external_id = $2", [platform, ev.externalId],
      );
      const askIds: string[] = ctx[0]?.ask_ids ?? [];
      if (!Number.isInteger(n) || n < 1 || n > askIds.length || !note)
        return reply.send({ text: "Send `asks` first, then `feedback <number> <your observation>`." });
      const { rows: reqRows } = await pool.query(
        "SELECT requester_id, attribute_key FROM feedback_requests WHERE id = $1", [askIds[n - 1]],
      );
      if (!reqRows[0]) return reply.send({ text: "That ask isn't available anymore — send `asks` for a fresh list." });
      // invariant 1 still enforced: manager-origination check identical to the web path
      const { isManagerOf } = await import("./feedback.js");
      if (await isManagerOf(pool, orgId, userId, reqRows[0].requester_id))
        return reply.send({ text: "As their manager you validate rather than originate — you'll see their feedback in your validation queue instead." });
      const res = await core("POST", "/v1/evidence", {
        orgId, subjectUserId: reqRows[0].requester_id, authorUserId: userId,
        attributeKey: reqRows[0].attribute_key, valueNumeric: null, note,
      });
      if (res.status !== 201) return reply.send({ text: "That didn't go through — try again shortly." });
      return reply.send({ text: "Feedback delivered ✓ — thank you for adding your voice." });
    }

    if (kw === "notifications") {
      const arg = (rest[0] ?? "").toLowerCase();
      if (arg !== "on" && arg !== "off")
        return reply.send({ text: "Use `notifications off` to pause Wave's proactive messages here, or `notifications on` to resume." });
      const { setOptedOut } = await import("./outbound.js");
      await setOptedOut(pool, orgId, userId, arg === "off");
      return reply.send({ text: arg === "off"
        ? "Notifications off — Wave won't message you first. Everything else still works; `notifications on` any time."
        : "Notifications on — Wave can nudge you again when there's something worth your attention." });
    }

    if (kw === "nudges") {
      const summary = await core("GET", `/v1/users/${userId}/attributes?orgId=${orgId}`);
      const attrs = ((summary.json as { attributes?: Array<{ key: string; status: string; kind: string }> })?.attributes) ?? [];
      const gaps = attrs.filter((a) => a.status !== "established" && a.kind === "subjective");
      if (gaps.length === 0) return reply.send({ text: "Your signal is established across the board — nicely done." });
      return reply.send({ text: gaps.map((g) => `${g.key}: ${g.status.replace("_", " ")}`).join("\n") });
    }

    // companion path helpers
    const ensureSegmentAndMessages = async () => {
      const seg = await pool.query(
        "SELECT id FROM chat_segments WHERE user_id = $1 AND org_id = $2 AND kind = 'growth'", [userId, orgId],
      );
      return seg.rows[0]?.id as string | undefined;
    };

    if (text.toLowerCase() === "share") {
      const segId = await ensureSegmentAndMessages();
      if (!segId) return reply.send({ text: "Nothing to share yet — run a `checkin` first." });
      const { rows } = await pool.query(
        `SELECT id FROM chat_messages WHERE segment_id = $1 AND role = 'companion'
         AND content LIKE 'Here''s your reflection%' ORDER BY seq DESC LIMIT 1`, [segId],
      );
      if (!rows[0]) return reply.send({ text: "No synthesis to share yet — finish a `checkin` first." });
      return reply.send({ text: "Ready to share your latest reflection with your manager. Reply `share confirm` to send it, or keep talking to keep it private." });
    }
    if (text.toLowerCase() === "share confirm") {
      const segId = await ensureSegmentAndMessages();
      if (!segId) return reply.send({ text: "Nothing to share yet — run a `checkin` first." });
      const { rows } = await pool.query(
        `SELECT content FROM chat_messages WHERE segment_id = $1 AND role = 'companion'
         AND content LIKE 'Here''s your reflection%' ORDER BY seq DESC LIMIT 1`, [segId],
      );
      if (!rows[0]) return reply.send({ text: "No synthesis to share yet — finish a `checkin` first." });
      await pool.query(
        "INSERT INTO reflection_shares(org_id, user_id, content) VALUES ($1,$2,$3)", [orgId, userId, rows[0].content],
      );
      return reply.send({ text: "Shared ✓ — your manager can now see this reflection." });
    }

    // default verb: conversation (checkin or any text) → SPEC-007 engine, same segment
    const { companionTurn } = await import("./companion.js");
    const content = kw === "checkin" ? (rest.join(" ") || "checking in") : text;
    const replyText = await companionTurn(pool, orgId, userId, content);
    return reply.send({ text: replyText });
  });
}

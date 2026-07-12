import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import { buildRedactor, resolveLlm, type LlmMessage } from "./llm.js";
import type { Pool } from "./db.js";

/**
 * SPEC-007. TRUST INVARIANT 3: these tables are reachable ONLY through the
 * owner-gated routes below — no org-facing surface may join them.
 * TRUST INVARIANT 4: share listings expose shared content only; nothing here
 * may emit counts, flags, or timestamps derived from private activity.
 */

export interface CompanionProvider {
  /** Reply to the latest user message given the running interview state. */
  reply(userAnswersSinceSynthesis: string[], latest: string): string;
  opening(): string;
}

/** Deterministic guided provider — the journaling interview (SPEC-007 §4.4). */
export const QUESTIONS = [
  "How are you arriving today — what's your energy and mood?",
  "What's on your mind when you look back at this stretch of work?",
  "What did you ship or move forward?",
  "What did you learn — about the work or yourself?",
  "What was genuinely hard?",
  "Who did you work with, and how did that go?",
  "If you changed one thing about how you work next week, what would it be?",
] as const;

export function deterministicSynthesis(answers: string[]): string {
  const [mood, reflection, shipped, learned, hard, people, change] = answers;
  return [
    "Here's your reflection, in your own words:",
    `Arriving: ${mood}`,
    `On your mind: ${reflection}`,
    `Shipped: ${shipped}`,
    `Learned: ${learned}`,
    `Hard: ${hard}`,
    `People: ${people}`,
    `One change: ${change}`,
  ].join("\n");
}

export const guidedProvider: CompanionProvider = {
  opening: () => QUESTIONS[0],
  reply(answers, latest) {
    const all = [...answers, latest];
    if (all.length < QUESTIONS.length) return QUESTIONS[all.length]!;
    // Synthesis: weave the user's own words (§4.4)
    return deterministicSynthesis(all);
  },
};

function provider(): CompanionProvider {
  // env-selected (R5); only 'guided' ships in v1
  return guidedProvider;
}

async function memberRole(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId],
  );
  return rows[0]?.role ?? null;
}

async function ensureSegment(pool: Pool, orgId: string, userId: string): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM chat_segments WHERE user_id = $1 AND org_id = $2 AND kind = 'growth'", [userId, orgId],
  );
  if (found.rows[0]) return found.rows[0].id as string;
  const { rows } = await pool.query(
    "INSERT INTO chat_segments(user_id, org_id) VALUES ($1,$2) RETURNING id", [userId, orgId],
  );
  const segId = rows[0].id as string;
  await pool.query(
    "INSERT INTO chat_messages(segment_id, role, content, seq) VALUES ($1,'companion',$2,1)",
    [segId, provider().opening()],
  );
  return segId;
}

/** User answers since (and excluding) the last synthesis-completing turn. */
async function answersSinceSynthesis(pool: Pool, segId: string): Promise<string[]> {
  const { rows } = await pool.query(
    "SELECT role, content FROM chat_messages WHERE segment_id = $1 ORDER BY seq", [segId],
  );
  const answers: string[] = [];
  for (const r of rows as Array<{ role: string; content: string }>) {
    if (r.role === "user") answers.push(r.content);
    if (r.role === "companion" && r.content.startsWith("Here's your reflection")) answers.length = 0;
  }
  return answers;
}

/** Interview state derived from history (SPEC-014 §5): skeleton answers vs follow-up answers. */
async function interviewState(pool: Pool, segId: string): Promise<{ skeletonAnswers: string[]; lastWasFollowup: boolean }> {
  const { rows } = await pool.query(
    "SELECT role, content FROM chat_messages WHERE segment_id = $1 ORDER BY seq", [segId],
  );
  const skeletonAnswers: string[] = [];
  let lastCompanionWasSkeleton = false;
  let lastCompanionWasFollowup = false;
  for (const r of rows as Array<{ role: string; content: string }>) {
    if (r.role === "companion") {
      if (r.content.startsWith("Here's your reflection")) {
        skeletonAnswers.length = 0;
        lastCompanionWasSkeleton = false; lastCompanionWasFollowup = false;
      } else if ((QUESTIONS as readonly string[]).includes(r.content)) {
        lastCompanionWasSkeleton = true; lastCompanionWasFollowup = false;
      } else {
        lastCompanionWasFollowup = true; lastCompanionWasSkeleton = false;
      }
    } else if (lastCompanionWasSkeleton) {
      skeletonAnswers.push(r.content);
    }
  }
  return { skeletonAnswers, lastWasFollowup: lastCompanionWasFollowup };
}

/** Reusable HYBRID turn engine (SPEC-012 one-companion-many-doors; SPEC-014 R3-R6). */
export async function companionTurn(pool: Pool, orgId: string, userId: string, content: string): Promise<string> {
  const segId = await ensureSegment(pool, orgId, userId);
  const state = await interviewState(pool, segId);
  const isSkeletonAnswer = !state.lastWasFollowup;
  const skeletonAnswers = isSkeletonAnswer ? [...state.skeletonAnswers, content] : state.skeletonAnswers;

  let replyText: string | null = null;
  const llm = await resolveLlm(pool, orgId, (globalThis as { fetch: typeof fetch }).fetch);

  if (skeletonAnswers.length >= QUESTIONS.length && isSkeletonAnswer) {
    // SYNTHESIS turn (R4): LLM-composed with marker + quote-the-user guard, else deterministic
    if (llm) {
      const red = await buildRedactor(pool, orgId);
      const msgs: LlmMessage[] = [{
        role: "user",
        content: `Compose a short reflection from these answers, quoting the person's own words. Begin with the exact line "Here's your reflection". Answers:\n${skeletonAnswers.map((a) => `- ${red.redact(a)}`).join("\n")}`,
      }];
      const out = await llm.complete("You are a thoughtful growth companion.", msgs);
      if (out) {
        const restored = red.restore(out);
        const quotes = skeletonAnswers.filter((a) => restored.includes(a)).length;
        if (restored.startsWith("Here's your reflection") && quotes >= 2) replyText = restored;
      }
    }
    replyText ??= deterministicSynthesis(skeletonAnswers);
  } else if (isSkeletonAnswer && llm) {
    // FOLLOW-UP turn (R3): exactly one LLM follow-up after a skeleton answer
    const red = await buildRedactor(pool, orgId);
    const out = await llm.complete(
      "You are a thoughtful growth companion. Ask exactly one short follow-up question that deepens the person's last answer. No preamble.",
      [{ role: "user", content: red.redact(content) }],
    );
    if (out) replyText = red.restore(out);
    replyText ??= QUESTIONS[Math.min(skeletonAnswers.length, QUESTIONS.length - 1)]!; // R6 fail-closed
  } else {
    // after a follow-up answer (or no LLM): deterministic skeleton advance (R3/R7)
    replyText = skeletonAnswers.length >= QUESTIONS.length
      ? deterministicSynthesis(skeletonAnswers)
      : QUESTIONS[skeletonAnswers.length]!;
  }
  await pool.query(
    `INSERT INTO chat_messages(segment_id, role, content, seq)
     VALUES ($1,'user',$2,(SELECT coalesce(max(seq),0)+1 FROM chat_messages WHERE segment_id = $1))`,
    [segId, content],
  );
  await pool.query(
    `INSERT INTO chat_messages(segment_id, role, content, seq)
     VALUES ($1,'companion',$2,(SELECT coalesce(max(seq),0)+1 FROM chat_messages WHERE segment_id = $1))`,
    [segId, replyText],
  );
  return replyText;
}

const msgSchema = z.object({ content: z.string().min(1) });
const shareSchema = z.object({ messageId: z.string().uuid() });

export function registerCompanionRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/api/orgs/:orgId/companion", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const segId = await ensureSegment(pool, orgId, user.id);
    const { rows } = await pool.query(
      "SELECT id, role, content, seq FROM chat_messages WHERE segment_id = $1 ORDER BY seq", [segId],
    );
    return reply.send({ segmentId: segId, messages: rows });
  });

  app.post("/api/orgs/:orgId/companion/messages", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const parsed = msgSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    await companionTurn(pool, orgId, user.id, parsed.data.content);
    const segId = await ensureSegment(pool, orgId, user.id);
    const { rows } = await pool.query(
      "SELECT id, role, content, seq FROM chat_messages WHERE segment_id = $1 AND role = 'companion' ORDER BY seq DESC LIMIT 1",
      [segId],
    );
    return reply.status(201).send({ reply: rows[0] });
  });

  app.post("/api/orgs/:orgId/companion/share", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    const parsed = shareSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    // §5: "not yours" and "not real" are one indistinguishable 400
    const { rows } = await pool.query(
      `SELECT m.content FROM chat_messages m
       JOIN chat_segments s ON s.id = m.segment_id
       WHERE m.id = $1 AND s.user_id = $2 AND s.org_id = $3`,
      [parsed.data.messageId, user.id, orgId],
    );
    if (!rows[0]) return reply.status(400).send({ error: "unknown_message" });
    const ins = await pool.query(
      `INSERT INTO reflection_shares(org_id, user_id, content) VALUES ($1,$2,$3)
       RETURNING id, content, created_at AS "createdAt"`,
      [orgId, user.id, rows[0].content],
    );
    return reply.status(201).send({ share: ins.rows[0] });
  });

  app.get("/api/orgs/:orgId/members/:userId/shares", async (req, reply) => {
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    const user = await currentUser(pool, req);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await memberRole(pool, orgId, user.id))) return reply.status(404).send({ error: "not_found" });
    // visibility: self or upward chain of :userId (R3); everyone else 404 (R4)
    if (user.id !== userId) {
      let cursor: string | null = userId;
      let inChain = false;
      for (let hops = 0; hops <= 100 && cursor; hops++) {
        const res: { rows: Array<{ manager_id: string }> } = await pool.query(
          "SELECT manager_id FROM reporting_edges WHERE org_id = $1 AND user_id = $2", [orgId, cursor],
        );
        cursor = res.rows[0]?.manager_id ?? null;
        if (cursor === user.id) { inChain = true; break; }
      }
      if (!inChain) return reply.status(404).send({ error: "not_found" });
    }
    const { rows } = await pool.query(
      `SELECT id, content, created_at AS "createdAt" FROM reflection_shares
       WHERE org_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [orgId, userId],
    );
    return reply.send({ shares: rows });
  });
}

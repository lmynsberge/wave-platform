import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { currentUser } from "./auth.js";
import type { Pool } from "./db.js";

/**
 * SPEC-014. LLM abstraction + redaction. INVARIANT 3 at the trust boundary:
 * redact() runs before ANY text leaves for a model; restore() on the way back.
 * Every path fails closed to guided (return null → caller falls back).
 */

export interface LlmMessage { role: "user" | "assistant"; content: string }
export interface LlmClient { complete(system: string, messages: LlmMessage[]): Promise<string | null> }

export interface LlmConfig { provider: "anthropic" | "openai_compatible"; baseUrl?: string | null; model: string; apiKey?: string | null }

export function openAiCompatibleClient(cfg: LlmConfig, fetchImpl: typeof fetch): LlmClient {
  return {
    async complete(system, messages) {
      try {
        const res = await fetchImpl(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return json.choices?.[0]?.message?.content ?? null;
      } catch { return null; }
    },
  };
}

export function anthropicClient(cfg: LlmConfig, fetchImpl: typeof fetch): LlmClient {
  return {
    async complete(system, messages) {
      try {
        const res = await fetchImpl(`${cfg.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": cfg.apiKey ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({ model: cfg.model, max_tokens: 1024, system, messages }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        return json.content?.find((c) => c.type === "text")?.text ?? null;
      } catch { return null; }
    },
  };
}

/** Resolution: org BYO → platform env → null (pure guided). */
export async function resolveLlm(pool: Pool, orgId: string, fetchImpl: typeof fetch): Promise<LlmClient | null> {
  const { rows } = await pool.query(
    "SELECT provider, base_url AS \"baseUrl\", model, api_key AS \"apiKey\" FROM org_llm_config WHERE org_id = $1",
    [orgId],
  );
  let cfg: LlmConfig | null = rows[0] ?? null;
  if (!cfg && process.env.LLM_PROVIDER) {
    cfg = {
      provider: process.env.LLM_PROVIDER as LlmConfig["provider"],
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL ?? "",
      apiKey: process.env.LLM_API_KEY,
    };
  }
  if (!cfg) return null;
  return cfg.provider === "anthropic" ? anthropicClient(cfg, fetchImpl) : openAiCompatibleClient(cfg, fetchImpl);
}

// ---------- redaction (R5) ----------
export interface Redactor { redact(text: string): string; restore(text: string): string }

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export async function buildRedactor(pool: Pool, orgId: string): Promise<Redactor> {
  const { rows } = await pool.query(
    `SELECT u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1`, [orgId],
  );
  // longest names first so partial overlaps redact correctly
  const names: string[] = rows.map((r: { name: string }) => r.name).filter((n: string) => n.length >= 3)
    .sort((a: string, b: string) => b.length - a.length);
  const forward = new Map<string, string>();
  const backward = new Map<string, string>();
  names.forEach((n, i) => { const p = `[P${i + 1}]`; forward.set(n, p); backward.set(p, n); });
  return {
    redact(text) {
      let out = text.replace(EMAIL_RE, "[EMAIL]");
      for (const [name, ph] of forward) out = out.split(name).join(ph);
      return out;
    },
    restore(text) {
      let out = text;
      for (const [ph, name] of backward) out = out.split(ph).join(name);
      return out;
    },
  };
}

// ---------- config endpoints (R2) ----------
const putSchema = z.object({
  provider: z.enum(["anthropic", "openai_compatible"]),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
});
const mask = (k?: string | null) => (k ? `…${k.slice(-4)}` : null);

export function registerLlmConfigRoutes(app: FastifyInstance, pool: Pool) {
  const gate = async (req: Parameters<typeof currentUser>[1], orgId: string) => {
    const user = await currentUser(pool, req);
    if (!user) return { status: 401 as const };
    const { rows } = await pool.query(
      "SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, user.id],
    );
    const role = rows[0]?.role as string | undefined;
    if (!role) return { status: 404 as const };
    if (role !== "owner" && role !== "admin") return { status: 403 as const };
    return { status: 200 as const };
  };

  app.put("/api/orgs/:orgId/llm-config", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const g = await gate(req, orgId);
    if (g.status !== 200) return reply.status(g.status).send({ error: g.status === 403 ? "insufficient_role" : g.status === 401 ? "unauthenticated" : "not_found" });
    const raw = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_body" });
    const { provider, baseUrl, model, apiKey } = parsed.data;
    await pool.query(
      `INSERT INTO org_llm_config(org_id, provider, base_url, model, api_key) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (org_id) DO UPDATE SET provider = $2, base_url = $3, model = $4, api_key = $5, updated_at = now()`,
      [orgId, provider, baseUrl ?? null, model, apiKey ?? null],
    );
    return reply.send({ provider, baseUrl: baseUrl ?? null, model, apiKey: mask(apiKey) });
  });

  app.get("/api/orgs/:orgId/llm-config", async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const g = await gate(req, orgId);
    if (g.status !== 200) return reply.status(g.status).send({ error: g.status === 403 ? "insufficient_role" : g.status === 401 ? "unauthenticated" : "not_found" });
    const { rows } = await pool.query(
      "SELECT provider, base_url AS \"baseUrl\", model, api_key AS \"apiKey\" FROM org_llm_config WHERE org_id = $1", [orgId],
    );
    if (!rows[0]) return reply.status(404).send({ error: "no_config" });
    return reply.send({ ...rows[0], apiKey: mask(rows[0].apiKey) });
  });
}

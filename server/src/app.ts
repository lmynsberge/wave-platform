import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./auth.js";
import { registerFeedbackRoutes } from "./feedback.js";
import { registerCompanionRoutes } from "./companion.js";
import { registerFlowRoutes } from "./flows.js";
import { registerIngestRoutes } from "./ingest.js";
import { registerNudgeRoutes } from "./nudges.js";
import { registerBridgeRoutes } from "./bridge.js";
import { registerLlmConfigRoutes } from "./llm.js";
import { registerOutboundRoutes } from "./outbound.js";
import { registerTeamViewRoutes } from "./teamview.js";
import type { Pool } from "./db.js";
import { registerOrgRoutes } from "./orgs.js";

export interface AppOptions {
  coreUrl: string;
  fetchImpl?: typeof fetch;
  pool?: Pool;
  /** SPEC-016 R1: serve the built web app from this directory (SPA fallback for non-/api GETs). */
  webDist?: string;
  /** SPEC-016 R2 (gate G3): mark session cookies Secure. */
  secureCookies?: boolean;
}

export function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: false });
  const fetchImpl = opts.fetchImpl ?? fetch;

  if (process.env.NODE_ENV === "development") {
    void app.register(cors, { origin: ["http://localhost:5173"] });
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/ping", async (_req, reply) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetchImpl(`${opts.coreUrl}/v1/ping`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`core status ${res.status}`);
      const core: unknown = await res.json();
      return { server: "ok", core };
    } catch {
      return reply
        .status(502)
        .send({ server: "ok", core: null, error: "core_unreachable" });
    }
  });

  if (opts.pool) {
    registerAuthRoutes(app, opts.pool, { secureCookies: opts.secureCookies ?? false });
    registerOrgRoutes(app, opts.pool);
    registerFeedbackRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
    registerFlowRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
    registerCompanionRoutes(app, opts.pool);
    registerIngestRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
    registerNudgeRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
    registerTeamViewRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
    registerBridgeRoutes(app, opts.pool, opts.coreUrl, fetchImpl);
    registerOutboundRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl }, fetchImpl);
    registerLlmConfigRoutes(app, opts.pool);
  }

  if (opts.webDist && existsSync(opts.webDist)) {
    void app.register(fastifyStatic, { root: opts.webDist, wildcard: false });
    // SPA fallback — never shadows /api JSON 404s (SPEC-016 §5)
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api")) {
        return reply.type("text/html").send(readFileSync(join(opts.webDist!, "index.html"), "utf8"));
      }
      return reply.status(404).send({ error: "not_found" });
    });
  }

  return app;
}

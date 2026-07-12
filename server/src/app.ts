import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAuthRoutes } from "./auth.js";
import { registerFeedbackRoutes } from "./feedback.js";
import type { Pool } from "./db.js";
import { registerOrgRoutes } from "./orgs.js";

export interface AppOptions {
  coreUrl: string;
  fetchImpl?: typeof fetch;
  pool?: Pool;
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
    registerAuthRoutes(app, opts.pool);
    registerOrgRoutes(app, opts.pool);
    registerFeedbackRoutes(app, opts.pool, { coreUrl: opts.coreUrl, fetchImpl });
  }

  return app;
}

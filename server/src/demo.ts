import type { FastifyInstance } from "fastify";
import { currentSession, demoPersona } from "./auth.js";
import type { Pool } from "./db.js";

/** SPEC-024 R4: mutation escape hatches available to a demo-flagged session. */
const DEMO_WRITE_ALLOWLIST = ["/api/demo/exit", "/api/auth/logout", "/api/auth/login", "/api/auth/signup"];

/** SPEC-024 R4: single choke point — demo sessions cannot mutate anything. */
export function registerDemoGuard(app: FastifyInstance, pool: Pool) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.method === "GET" || !req.url.startsWith("/api")) return;
    const path = req.url.split("?")[0]!;
    if (DEMO_WRITE_ALLOWLIST.includes(path)) return;
    const session = await currentSession(pool, req);
    if (session?.demo) return reply.status(403).send({ error: "demo_read_only" });
  });
}

export function registerDemoRoutes(app: FastifyInstance, pool: Pool) {
  // R2: availability probe — config present AND persona resolvable
  app.get("/api/demo", async (_req, reply) => {
    const available = (await demoPersona(pool)) !== null;
    return reply.send({ available });
  });

  // R3: flag the caller's session; identity swaps to the persona
  app.post("/api/demo/enter", async (req, reply) => {
    const session = await currentSession(pool, req);
    if (!session) return reply.status(401).send({ error: "unauthenticated" });
    if (!(await demoPersona(pool))) return reply.status(404).send({ error: "demo_unavailable" });
    await pool.query("UPDATE sessions SET demo = true WHERE id = $1", [session.id]);
    return reply.send({ demo: true });
  });

  // R5: clear the flag; the real user is back on the next request
  app.post("/api/demo/exit", async (req, reply) => {
    const session = await currentSession(pool, req);
    if (!session) return reply.status(401).send({ error: "unauthenticated" });
    await pool.query("UPDATE sessions SET demo = false WHERE id = $1", [session.id]);
    return reply.send({ demo: false });
  });
}

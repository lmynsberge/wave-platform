import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const okFetch: typeof fetch = async () =>
  new Response(JSON.stringify({ service: "core", status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const downFetch: typeof fetch = async () => {
  throw new Error("connection refused");
};

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp({ coreUrl: "http://core", fetchImpl: okFetch });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/ping", () => {
  it("returns combined shape when core is up", async () => {
    const app = buildApp({ coreUrl: "http://core", fetchImpl: okFetch });
    const res = await app.inject({ method: "GET", url: "/api/ping" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      server: "ok",
      core: { service: "core", status: "ok" },
    });
  });

  it("returns 502 contract shape when core is unreachable", async () => {
    const app = buildApp({ coreUrl: "http://core", fetchImpl: downFetch });
    const res = await app.inject({ method: "GET", url: "/api/ping" });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      server: "ok",
      core: null,
      error: "core_unreachable",
    });
  });
});

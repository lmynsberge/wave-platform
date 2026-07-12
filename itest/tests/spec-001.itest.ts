// SPEC-001 — Foundation & walking skeleton
// Locked to spec (SPEC-QA-001 R3). Delegated per AC5:
//   AC1/AC2 web render states → web/test/PingStatus.test.tsx
//   AC3 (CI green) → .github/workflows/ci.yml itself
//   AC4 (READMEs) → repo inspection, non-executable
import { describe, expect, it } from "vitest";
import { client, CORE } from "../src/client.js";

describe("SPEC-001 AC1: full path is up", () => {
  it("server /api/ping returns the combined contract with core ok", async () => {
    const { status, body } = await client().json<{ server: string; core: { service: string; status: string } }>("/api/ping");
    expect(status).toBe(200);
    expect(body).toEqual({ server: "ok", core: { service: "core", status: "ok" } });
  });
  it("core /health and /v1/ping answer their exact contracts", async () => {
    const health = await (await fetch(`${CORE()}/health`)).json();
    expect(health).toEqual({ status: "ok" });
    const ping = await (await fetch(`${CORE()}/v1/ping`)).json();
    expect(ping).toEqual({ service: "core", status: "ok" });
  });
});

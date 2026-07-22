// SPEC-024 AC6 — explore button on the zero-org panel + demo banner exit.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinOrgs } from "../src/JoinOrgs";
import { DemoBanner } from "../src/App";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

type Call = { url: string; method: string };
const ok = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function stubFetch(routes: (u: string, method: string) => Response | null) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, method });
    return routes(u, method) ?? new Response(JSON.stringify({}), { status: 404 });
  }));
  return calls;
}

function wrap(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
}

describe("SPEC-024 AC6: explore entry point", () => {
  it("shows Explore demo mode when available and fires enter", async () => {
    const calls = stubFetch((u, method) => {
      if (u === "/api/demo") return ok({ available: true });
      if (u === "/api/demo/enter" && method === "POST") return ok({ demo: true });
      if (u === "/api/orgs/directory") return ok({ orgs: [] });
      return null;
    });
    wrap(<JoinOrgs />);
    fireEvent.click(await screen.findByRole("button", { name: /explore demo mode/i }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === "/api/demo/enter" && c.method === "POST")).toBe(true);
    });
  });

  it("hides the button when demo is unavailable", async () => {
    stubFetch((u) => {
      if (u === "/api/demo") return ok({ available: false });
      if (u === "/api/orgs/directory") return ok({ orgs: [] });
      return null;
    });
    wrap(<JoinOrgs />);
    await screen.findByText(/no organizations to join yet/i);
    expect(screen.queryByRole("button", { name: /explore demo mode/i })).toBeNull();
  });
});

describe("SPEC-024 AC6: demo banner", () => {
  it("renders the read-only notice and Exit fires /api/demo/exit", async () => {
    const calls = stubFetch((u, method) =>
      u === "/api/demo/exit" && method === "POST" ? ok({ demo: false }) : null);
    wrap(<DemoBanner />);
    expect(screen.getByRole("status").textContent).toMatch(/read-only/i);
    fireEvent.click(screen.getByRole("button", { name: /exit demo/i }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === "/api/demo/exit" && c.method === "POST")).toBe(true);
    });
  });
});

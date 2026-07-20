// SPEC-022 AC5 — zero-org join panel + Settings join-request admin section.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinOrgs } from "../src/JoinOrgs";
import { SettingsView } from "../src/SettingsView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

type Call = { url: string; method: string; body?: unknown };

function stubFetch(routes: (u: string, method: string) => Response | null) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return routes(u, method) ?? new Response(JSON.stringify({}), { status: 404 });
  }));
  return calls;
}
const ok = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function wrap(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
}

describe("SPEC-022 AC5: JoinOrgs panel", () => {
  it("renders the directory and fires a join request", async () => {
    const calls = stubFetch((u, method) => {
      if (u === "/api/orgs/directory")
        return ok({ orgs: [
          { id: "o1", name: "Meridian", slug: "meridian", membership: null, requestStatus: null },
          { id: "o2", name: "Northwind", slug: "northwind", membership: null, requestStatus: "pending" },
        ] });
      if (u === "/api/orgs/o1/join-requests" && method === "POST")
        return ok({ request: { id: "r1", orgId: "o1", status: "pending" } }, 201);
      return null;
    });
    wrap(<JoinOrgs />);

    expect(await screen.findByText("Meridian")).toBeDefined();
    expect(screen.getByText(/request pending/i)).toBeDefined(); // Northwind's state
    fireEvent.click(screen.getByRole("button", { name: /request access/i }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === "/api/orgs/o1/join-requests" && c.method === "POST")).toBe(true);
    });
  });

  it("declined orgs offer a re-request", async () => {
    stubFetch((u) => u === "/api/orgs/directory"
      ? ok({ orgs: [{ id: "o3", name: "Acme", slug: "acme", membership: null, requestStatus: "declined" }] })
      : null);
    wrap(<JoinOrgs />);
    expect(await screen.findByRole("button", { name: /request again/i })).toBeDefined();
    expect(screen.getByText(/previous request declined/i)).toBeDefined();
  });
});

describe("SPEC-022 AC5: Settings join-request decisions", () => {
  it("admin sees pending requesters and approve/decline fire the endpoints", async () => {
    const calls = stubFetch((u, method) => {
      if (u.includes("/join-requests/") && method === "POST") return ok({});
      if (u.endsWith("/join-requests")) return ok({ requests: [
        { id: "jr1", userId: "u1", name: "New Person", email: "new@x.test", createdAt: "2026-07-19" },
      ] });
      if (u.includes("notification-prefs")) return ok({ optedOut: false });
      if (u.includes("llm-config")) return ok({ error: "no_config" }, 404);
      if (u.endsWith("/invitations")) return ok({ invitations: [] });
      return null;
    });
    wrap(<SettingsView orgId="org-1" role="admin" />);

    expect(await screen.findByText(/new@x\.test/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === "/api/orgs/org-1/join-requests/jr1/approve" && c.method === "POST")).toBe(true);
    });
    fireEvent.click(screen.getByRole("button", { name: /decline/i }));
    await vi.waitFor(() => {
      expect(calls.some((c) => c.url === "/api/orgs/org-1/join-requests/jr1/decline" && c.method === "POST")).toBe(true);
    });
  });
});

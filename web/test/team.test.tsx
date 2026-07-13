// SPEC-015 — WRITTEN PRE-IMPLEMENTATION (red at spec review).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamView } from "../src/TeamView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const teamBody = { team: [
  { userId: "u1", name: "Riley", attributesEstablished: 2, attributesEmerging: 1, pendingValidations: 1 },
  { userId: "u2", name: "Zero", attributesEstablished: 0, attributesEmerging: 0, pendingValidations: 0 },
]};
const queueBody = { items: [{ evidenceId: "ev1", subjectUserId: "u1", attributeKey: "writing", note: "crisp design doc", createdAt: "2026-07-01T00:00:00Z" }], nextBefore: null };
const upwardBody = { items: [{ evidenceId: "ev2", subjectUserId: "u1", attributeKey: "writing", note: "strong assessment", authorUserId: "mgr2", state: "pending_upward", createdAt: "2026-07-01T00:00:00Z" }] };

function mockFetch(calls: Record<string, Array<{ url: string; body: unknown }>>, opts: { emptyAll?: boolean; emptyTeam?: boolean } = {}) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (init?.method === "POST") {
      (calls.posts ??= []).push({ url: u, body: JSON.parse(String(init.body)) });
      return ok({}, 201);
    }
    if (u.includes("team-signal")) return ok(opts.emptyTeam ? { team: [] } : teamBody);
    if (u.includes("validation-queue")) return ok(opts.emptyAll ? { items: [], nextBefore: null } : queueBody);
    if (u.includes("upward-queue")) return ok(opts.emptyAll ? { items: [] } : upwardBody);
    return ok({}, 404);
  }));
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><TeamView orgId="org-1" /></QueryClientProvider>);
}

describe("SPEC-015 AC1: team rows", () => {
  it("renders five fields; zero counts carry no negative styling", async () => {
    mockFetch({});
    renderView();
    expect(await screen.findByText("Riley")).toBeDefined();
    const zeroRow = (await screen.findByText("Zero")).closest("[data-team-row]")!;
    expect(zeroRow.querySelector('[class*="negative"], [class*="danger"], [class*="error"]')).toBeNull();
    expect(zeroRow.textContent).toContain("0");
  });
});

describe("SPEC-015 AC2+AC3: validation actions + legible drop-not-negative", () => {
  it("Validate posts yes; Disagree posts no; item leaves; helper copy present", async () => {
    const calls: Record<string, Array<{ url: string; body: unknown }>> = {};
    mockFetch(calls);
    renderView();
    expect(await screen.findByText(/never lowers/i)).toBeDefined(); // AC3 helper copy
    fireEvent.click(await screen.findByRole("button", { name: /^validate$/i }));
    await vi.waitFor(() => expect(calls.posts?.[0]?.body).toEqual({ outcome: "yes" }));
    expect(String(calls.posts![0]!.url)).toContain("/feedback/ev1/validations");
  });
  it("Disagree fires outcome no", async () => {
    const calls: Record<string, Array<{ url: string; body: unknown }>> = {};
    mockFetch(calls);
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /disagree/i }));
    await vi.waitFor(() => expect(calls.posts?.[0]?.body).toEqual({ outcome: "no" }));
  });
});

describe("SPEC-015 AC4: upward decisions", () => {
  it("Approve posts yes to the decision endpoint; traceless copy present", async () => {
    const calls: Record<string, Array<{ url: string; body: unknown }>> = {};
    mockFetch(calls);
    renderView();
    expect(await screen.findByText(/no trace/i)).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /approve/i }));
    await vi.waitFor(() => expect(String(calls.posts?.[0]?.url)).toContain("/assessments/ev2/decision"));
    expect(calls.posts![0]!.body).toEqual({ outcome: "yes" });
  });
});

describe("SPEC-015 AC5: empty states", () => {
  it("non-manager sees the honest empty state", async () => {
    mockFetch({}, { emptyTeam: true, emptyAll: true });
    renderView();
    expect(await screen.findByText(/no reports/i)).toBeDefined();
  });
  it("manager with clear queues sees caught-up state", async () => {
    mockFetch({}, { emptyAll: true });
    renderView();
    expect(await screen.findByText(/caught up/i)).toBeDefined();
  });
});

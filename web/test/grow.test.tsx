// SPEC-011 grow suite — WRITTEN PRE-IMPLEMENTATION (red at spec review).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GrowView } from "../src/GrowView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const gaps = { gaps: [{ attributeKey: "facilitation", status: "emerging", evidenceCount: 5, distinctAuthors: 3, distinctValidators: 2, suggestedRecipients: [{ userId: "u-9", name: "Noor" }] }] };
const asksBody = { asks: [{ id: "a1", requester: { userId: "u-2", name: "Sam" }, attributeKey: "facilitation", createdAt: "2026-07-01T00:00:00Z" }] };

function mockFetch(calls: Record<string, unknown[]>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/nudges")) return ok(gaps);
    if (u.includes("/asks")) return ok(asksBody);
    if (u.includes("/feedback-requests")) { (calls.requests ??= []).push(JSON.parse(String(init?.body))); return ok({ request: { id: "r1" } }, 201); }
    if (u.includes("/feedback")) { (calls.feedback ??= []).push(JSON.parse(String(init?.body))); return ok({ evidence: { id: "e1" } }, 201); }
    return ok({}, 404);
  }));
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GrowView orgId="org-1" />
    </QueryClientProvider>,
  );
}

describe("SPEC-011 AC3: gaps with one-tap ask", () => {
  it("renders the gap with neutral status language and fires the request on Ask", async () => {
    const calls: Record<string, unknown[]> = {};
    mockFetch(calls);
    renderView();
    expect(await screen.findByText("facilitation")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /ask noor/i }));
    await vi.waitFor(() => expect(calls.requests).toEqual([{ recipientId: "u-9", attributeKey: "facilitation" }]));
  });
});

describe("SPEC-011 AC4: inline feedback on an ask", () => {
  it("composer submits with the requester as subject and the ask's attribute", async () => {
    const calls: Record<string, unknown[]> = {};
    mockFetch(calls);
    renderView();
    const composer = await screen.findByLabelText(/feedback for sam/i);
    fireEvent.change(composer, { target: { value: "great facilitation in the retro" } });
    fireEvent.click(screen.getByRole("button", { name: /send feedback/i }));
    await vi.waitFor(() =>
      expect(calls.feedback).toEqual([{ subjectUserId: "u-2", attributeKey: "facilitation", note: "great facilitation in the retro" }]));
  });
});

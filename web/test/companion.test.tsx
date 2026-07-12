// SPEC-011 companion suite — WRITTEN PRE-IMPLEMENTATION (red at spec review).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanionView } from "../src/CompanionView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const thread = {
  segmentId: "seg-1",
  messages: [
    { id: "m1", role: "companion", content: "How are you arriving today — what's your energy and mood?", seq: 1 },
    { id: "m2", role: "user", content: "steady", seq: 2 },
    { id: "m3", role: "companion", content: "Here's your reflection, in your own words:\nArriving: steady", seq: 3 },
  ],
};

function mockFetch(routes: Record<string, (init?: RequestInit) => unknown>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    for (const [k, fn] of Object.entries(routes)) {
      if (String(url).includes(k)) {
        return new Response(JSON.stringify(fn(init)), { status: 200, headers: { "content-type": "application/json" } });
      }
    }
    return new Response("{}", { status: 404 });
  }));
}

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CompanionView orgId="org-1" />
    </QueryClientProvider>,
  );
}

describe("SPEC-011 AC1: thread rendering", () => {
  it("renders roles with side classes; only synthesis messages offer Share", async () => {
    mockFetch({ "/companion": () => thread });
    renderView();
    const synth = await screen.findByText(/Here's your reflection/);
    expect(synth.closest("[data-role='companion']")).not.toBeNull();
    expect(screen.getByText("steady").closest("[data-role='user']")).not.toBeNull();
    const shareButtons = screen.getAllByRole("button", { name: /share with your manager/i });
    expect(shareButtons).toHaveLength(1); // m3 only, never m1
  });
});

describe("SPEC-011 AC2: two-step share", () => {
  it("intent then confirm; confirm POSTs messageId; marker appears", async () => {
    const shareCalls: unknown[] = [];
    mockFetch({
      "/companion/share": (init) => { shareCalls.push(JSON.parse(String(init?.body))); return { share: { id: "s1" } }; },
      "/companion": () => thread,
    });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /share with your manager/i }));
    expect(shareCalls).toHaveLength(0); // first click is intent only
    fireEvent.click(screen.getByRole("button", { name: /confirm share/i }));
    expect(await screen.findByText(/^shared$/i)).toBeDefined();
    expect(shareCalls).toEqual([{ messageId: "m3" }]);
  });
});

describe("SPEC-011 AC5: pending send", () => {
  it("input disabled while a send is in flight", async () => {
    let resolveReply: (v: Response) => void;
    mockFetch({ "/companion": () => thread });
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/messages")) return new Promise<Response>((r) => { resolveReply = r; });
      return (base as typeof fetch)(url, init);
    }));
    renderView();
    const input = await screen.findByLabelText(/message/i);
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect((input as HTMLInputElement).disabled).toBe(true);
    resolveReply!(new Response(JSON.stringify({ reply: { id: "m4", role: "companion", content: "next?", seq: 4 } }), { status: 201, headers: { "content-type": "application/json" } }));
  });
});

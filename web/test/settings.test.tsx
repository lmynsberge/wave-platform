// SPEC-019 — WRITTEN PRE-IMPLEMENTATION (red at spec review).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "../src/SettingsView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mockFetch(calls: Record<string, Array<{ url: string; method: string; body?: unknown }>>, opts: { llm404?: boolean } = {}) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    (calls.all ??= []).push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const ok = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u.includes("link-codes")) return ok({ code: "abcd1234", expiresAt: "2026-07-13T00:00:00Z" }, 201);
    if (u.includes("notification-prefs")) return method === "PUT" ? ok(JSON.parse(String(init!.body))) : ok({ optedOut: false });
    if (u.includes("llm-config")) {
      if (method === "PUT") return ok({ provider: "openai_compatible", model: "m1", baseUrl: "http://x", apiKey: "…7890" });
      return opts.llm404 ? ok({ error: "no_config" }, 404) : ok({ provider: "anthropic", model: "claude-x", baseUrl: null, apiKey: "…4321" });
    }
    return ok({}, 404);
  }));
}

function renderView(role: string, opts: { llm404?: boolean } = {}) {
  const calls: Record<string, Array<{ url: string; method: string; body?: unknown }>> = {};
  mockFetch(calls, opts);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><SettingsView orgId="org-1" role={role} /></QueryClientProvider>);
  return calls;
}

describe("SPEC-019 AC1: link code minting", () => {
  it("mints and renders the code with the bot instruction", async () => {
    const calls = renderView("member");
    fireEvent.click(await screen.findByRole("button", { name: /generate link code/i }));
    expect(await screen.findByText(/link abcd1234/i)).toBeDefined();
    expect(calls.all!.some((c) => c.url.includes("link-codes") && c.method === "POST")).toBe(true);
  });
});

describe("SPEC-019 AC2: notifications toggle", () => {
  it("reflects GET state and PUTs the flipped value", async () => {
    const calls = renderView("member");
    const toggle = await screen.findByRole("checkbox", { name: /proactive messages/i });
    expect((toggle as HTMLInputElement).checked).toBe(true); // optedOut=false → messages ON
    fireEvent.click(toggle);
    await vi.waitFor(() => {
      const put = calls.all!.find((c) => c.url.includes("notification-prefs") && c.method === "PUT");
      expect(put?.body).toEqual({ optedOut: true });
    });
  });
});

describe("SPEC-019 AC3+AC4: LLM config gating and flow", () => {
  it("member role: section absent", async () => {
    renderView("member");
    await screen.findByRole("button", { name: /generate link code/i });
    expect(screen.queryByText(/ai companion/i)).toBeNull();
  });
  it("admin sees masked current config and can save a new one", async () => {
    const calls = renderView("admin");
    expect(await screen.findByText(/…4321/)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: "http://x" } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await vi.waitFor(() => {
      const put = calls.all!.find((c) => c.url.includes("llm-config") && c.method === "PUT");
      expect(put?.body).toMatchObject({ model: "m1", baseUrl: "http://x", apiKey: "sk-new" });
    });
  });
  it("unconfigured (404) renders the setup prompt, not an error", async () => {
    renderView("owner", { llm404: true });
    expect(await screen.findByText(/not configured/i)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

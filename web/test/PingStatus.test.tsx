import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PingStatus } from "../src/PingStatus";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("PingStatus", () => {
  it("renders ok state when core is up", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ server: "ok", core: { service: "core", status: "ok" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderWithClient(<PingStatus />);
    expect(await screen.findByText(/core: ok \(core\)/)).toBeDefined();
    expect(screen.getByText(/server: ok/)).toBeDefined();
  });

  it("renders degraded state when core is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ server: "ok", core: null, error: "core_unreachable" }),
          { status: 502, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderWithClient(<PingStatus />);
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/degraded/)).toBeDefined();
  });
});

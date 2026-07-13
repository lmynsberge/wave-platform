// SPEC-020 web (AC5) — WRITTEN PRE-IMPLEMENTATION.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteAccept } from "../src/InviteAccept";
import { SettingsView } from "../src/SettingsView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function wrap(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
}

describe("SPEC-020 AC5: invite form in Settings (admin)", () => {
  it("POSTs {email, role} and renders the shareable /invite/<token> link + pending list", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
      if (u.includes("/invitations") && init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return ok({ invitation: { id: "i1", email: "new@x.test", role: "member", token: "tok123", expiresAt: "2026-07-20" } }, 201);
      }
      if (u.includes("/invitations")) return ok({ invitations: [{ id: "i0", email: "old@x.test", role: "admin", token: "tokOld", expiresAt: "2026-07-19" }] });
      if (u.includes("notification-prefs")) return ok({ optedOut: false });
      if (u.includes("llm-config")) return ok({ error: "no_config" }, 404);
      return ok({}, 404);
    }));
    wrap(<SettingsView orgId="org-1" role="admin" />);
    expect(await screen.findByText(/old@x\.test/)).toBeDefined(); // pending list
    fireEvent.change(screen.getByLabelText(/invite email/i), { target: { value: "new@x.test" } });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
    expect(await screen.findByText(/\/invite\/tok123/)).toBeDefined();
    expect(posts).toEqual([{ email: "new@x.test", role: "member" }]);
  });
});

describe("SPEC-020 AC5: accept screen", () => {
  it("renders org info from the token and fires accept when logged in", async () => {
    const accepts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
      if (u.endsWith("/accept")) { accepts.push(u); return ok({ orgId: "org-9", role: "member" }, 201); }
      if (u.includes("/api/invites/")) return ok({ orgName: "Meridian", email: "p@x.test", role: "member" });
      if (u.includes("/api/me")) return ok({ user: { id: "u1", email: "p@x.test", name: "P" }, memberships: [] });
      return ok({}, 404);
    }));
    wrap(<InviteAccept token="tok9" onJoined={() => {}} />);
    expect(await screen.findByRole("heading", { name: /join meridian/i })).toBeDefined();
    fireEvent.click(await screen.findByRole("button", { name: /join/i }));
    await vi.waitFor(() => expect(accepts).toHaveLength(1));
    expect(accepts[0]).toContain("/api/invites/tok9/accept");
  });
});

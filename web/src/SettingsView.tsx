import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface LlmConfig { provider: string; baseUrl: string | null; model: string; apiKey: string | null }
interface Invitation { id: string; email: string; role: string; token: string; expiresAt: string }

export function SettingsView({ orgId, role }: { orgId: string; role: string }) {
  const qc = useQueryClient();
  const isAdmin = role === "owner" || role === "admin";
  const [code, setCode] = useState<string | null>(null);

  const mint = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bridge/link-codes`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orgId }),
      });
      if (!res.ok) throw new Error("mint failed");
      return (await res.json()) as { code: string };
    },
    onSuccess: (d) => setCode(d.code),
  });

  const prefs = useQuery({
    queryKey: ["prefs", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/notification-prefs`)).json() as Promise<{ optedOut: boolean }>,
    retry: false,
  });
  const setPrefs = useMutation({
    mutationFn: async (optedOut: boolean) => {
      const res = await fetch(`/api/orgs/${orgId}/notification-prefs`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ optedOut }),
      });
      if (!res.ok) throw new Error("prefs failed");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["prefs", orgId] }),
  });

  const llm = useQuery({
    queryKey: ["llm", orgId],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/llm-config`);
      if (res.status === 404) return null; // unconfigured, not an error
      if (!res.ok) throw new Error("llm load failed");
      return (await res.json()) as LlmConfig;
    },
    retry: false,
  });
  const [form, setForm] = useState({ provider: "openai_compatible", baseUrl: "", model: "", apiKey: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" });
  const [lastLink, setLastLink] = useState<string | null>(null);
  const invites = useQuery({
    queryKey: ["invites", orgId],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/invitations`);
      if (!res.ok) throw new Error("invites load failed");
      return (await res.json()) as { invitations: Invitation[] };
    },
    retry: false,
  });
  const createInvite = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orgs/${orgId}/invitations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(inviteForm),
      });
      if (!res.ok) throw new Error("invite failed");
      return (await res.json()) as { invitation: Invitation };
    },
    onSuccess: (d) => { setLastLink(`/invite/${d.invitation.token}`); setInviteForm({ email: "", role: "member" }); void qc.invalidateQueries({ queryKey: ["invites", orgId] }); },
  });
  const saveLlm = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { provider: form.provider, model: form.model };
      if (form.baseUrl) body.baseUrl = form.baseUrl;
      if (form.apiKey) body.apiKey = form.apiKey;
      const res = await fetch(`/api/orgs/${orgId}/llm-config`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
    },
    onSuccess: () => { setForm((f) => ({ ...f, apiKey: "" })); void qc.invalidateQueries({ queryKey: ["llm", orgId] }); },
  });

  return (
    <div className="settings">
      <section>
        <h2>Connect your chat app</h2>
        <p className="hint">Link Slack or Teams to check in with your companion where you already work. Codes are single-use and expire in 10 minutes.</p>
        <button onClick={() => mint.mutate()}>Generate link code</button>
        {mint.isError && <div className="banner" role="alert">Couldn't mint a code — try again.</div>}
        {code && (
          <div className="card">
            <p>Send this to the Wave bot:</p>
            <code>link {code}</code>
          </div>
        )}
      </section>

      <section>
        <h2>Notifications</h2>
        <p className="hint">When on, Wave may message you first — a check-in invite when your signal is building, or a reminder when a colleague asks for your perspective. Turning this off pauses those; everything else keeps working.</p>
        {prefs.isSuccess && (
          <label>
            <input
              type="checkbox"
              aria-label="Proactive messages"
              checked={!prefs.data.optedOut}
              onChange={() => setPrefs.mutate(!prefs.data.optedOut)}
            />{" "}
            Proactive messages
          </label>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2>Invite teammates</h2>
          <p className="hint">Invitations are email-bound — the link only works for the address you invite. No email is sent yet; copy the link and share it yourself.</p>
          <div className="card">
            <label>Invite email <input aria-label="Invite email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} /></label>
            <label>Role{" "}
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button disabled={!inviteForm.email || createInvite.isPending} onClick={() => createInvite.mutate()}>Send invite</button>
            {lastLink && <p>Share this link: <code>{lastLink}</code></p>}
            {createInvite.isError && <div className="banner" role="alert">Invite failed — try again.</div>}
          </div>
          {invites.isSuccess && (invites.data.invitations ?? []).length > 0 && (
            <div>
              <h3>Pending</h3>
              {invites.data.invitations.map((i) => (
                <div className="card" key={i.id}>{i.email} · {i.role} · <code>/invite/{i.token}</code></div>
              ))}
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <section>
          <h2>AI companion</h2>
          <p className="hint">Bring your own model. Member names and emails are redacted before anything reaches the provider, and API keys are encrypted at rest.</p>
          {llm.isSuccess && llm.data && (
            <p>Current: {llm.data.provider} · {llm.data.model} · key {llm.data.apiKey ?? "none"}</p>
          )}
          {llm.isSuccess && !llm.data && <p>Not configured — the guided companion runs without a model until you add one.</p>}
          <div className="card">
            <label>Provider{" "}
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="openai_compatible">OpenAI-compatible (incl. self-hosted)</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label>Base URL <input aria-label="Base URL" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></label>
            <label>Model <input aria-label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
            <label>API key <input aria-label="API key" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} /></label>
            <button disabled={!form.model || saveLlm.isPending} onClick={() => saveLlm.mutate()}>Save</button>
            {saveLlm.isError && <div className="banner" role="alert">Save failed — your entries are still here, try again.</div>}
          </div>
        </section>
      )}
    </div>
  );
}

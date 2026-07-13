import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "./api";
import { CompanionView } from "./CompanionView";
import { GrowView } from "./GrowView";
import { SettingsView } from "./SettingsView";
import { TeamView } from "./TeamView";
import { InboxPanel } from "./InboxPanel";
import { InviteAccept } from "./InviteAccept";
import { ProfileCards } from "./ProfileCards";

function AuthScreen() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const res = mode === "login" ? await api.login(email, password) : await api.signup(email, password, name);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error === "bad_credentials" ? "Email or password doesn't match." : "Couldn't sign you in — check the details and try again.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="auth">
      <h1>Wave</h1>
      <p className="sub">Signal you can carry with you.</p>
      {mode === "signup" && (
        <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      )}
      <input aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input aria-label="Password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <div role="alert" className="hint">{error}</div>}
      <button onClick={submit}>{mode === "login" ? "Log in" : "Create account"}</button>
      <button className="ghost" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
      </button>
    </div>
  );
}

export default function App() {
  const invitePath = window.location.pathname.match(/^\/invite\/([a-f0-9]+)$/);
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const [orgId, setOrgId] = useState<string | null>(null);
  const [view, setView] = useState<"profile" | "companion" | "grow" | "team" | "settings">("profile");

  if (invitePath) {
    return (
      <div className="auth-shell">
        <InviteAccept token={invitePath[1]!} onJoined={() => { window.location.href = "/"; }} />
      </div>
    );
  }

  if (me.isPending) return <p style={{ padding: 24 }}>Loading…</p>;
  if (me.isError || !me.data) return <AuthScreen />;

  const orgs = me.data.memberships;
  const activeOrg = orgId ?? orgs[0]?.orgId ?? null;

  return (
    <div className="shell">
      <nav className="rail">
        <div className="who">{me.data.user.name}</div>
        {orgs.length > 0 ? (
          <select aria-label="Organization" value={activeOrg ?? ""} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((m) => (
              <option key={m.orgId} value={m.orgId}>{m.name}</option>
            ))}
          </select>
        ) : (
          <div className="empty">You're not part of an organization yet. Ask an admin to add you.</div>
        )}
        <div className="views">
          <button className={view === "profile" ? "" : "ghost"} onClick={() => setView("profile")}>Profile</button>
          <button className={view === "companion" ? "" : "ghost"} onClick={() => setView("companion")}>Companion</button>
          <button className={view === "grow" ? "" : "ghost"} onClick={() => setView("grow")}>Give & Grow</button>
          <button className={view === "team" ? "" : "ghost"} onClick={() => setView("team")}>Team</button>
          <button className={view === "settings" ? "" : "ghost"} onClick={() => setView("settings")}>Settings</button>
        </div>
        <button
          className="ghost"
          onClick={async () => { await api.logout(); await qc.invalidateQueries({ queryKey: ["me"] }); }}
        >
          Log out
        </button>
      </nav>
      <main>
        {view === "profile" && (<><h2>Your signal</h2>{activeOrg ? <ProfileCards orgId={activeOrg} userId={me.data.user.id} /> : null}</>)}
        {view === "companion" && activeOrg ? <CompanionView orgId={activeOrg} /> : null}
        {view === "grow" && activeOrg ? <GrowView orgId={activeOrg} /> : null}
        {view === "team" && activeOrg ? <TeamView orgId={activeOrg} /> : null}
        {view === "settings" && activeOrg ? (
          <SettingsView orgId={activeOrg} role={me.data.memberships.find((m) => m.orgId === activeOrg)?.role ?? "member"} />
        ) : null}
      </main>
      <aside className="inbox">
        {activeOrg ? <InboxPanel orgId={activeOrg} /> : null}
      </aside>
    </div>
  );
}

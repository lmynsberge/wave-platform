import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "./api";

export function InviteAccept({ token, onJoined }: { token: string; onJoined: (orgId: string) => void }) {
  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      const res = await fetch(`/api/invites/${token}`);
      if (!res.ok) throw new Error("invalid");
      return (await res.json()) as { orgName: string; email: string; role: string };
    },
    retry: false,
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch(`/api/me`);
      return res.ok ? ((await res.json()) as { user: { email: string } }) : null;
    },
    retry: false,
  });
  const [creds, setCreds] = useState({ password: "", name: "", mode: "login" as "login" | "signup" });
  const [authError, setAuthError] = useState(false);

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error("accept failed");
      return (await res.json()) as { orgId: string };
    },
    onSuccess: (d) => onJoined(d.orgId),
  });
  const auth = useMutation({
    mutationFn: async () => {
      setAuthError(false);
      const email = invite.data!.email;
      if (creds.mode === "signup") await api.signup(email, creds.password, creds.name || email.split("@")[0]!);
      else await api.login(email, creds.password);
    },
    onSuccess: () => accept.mutate(),
    onError: () => setAuthError(true),
  });

  if (invite.isPending) return <p>Checking your invitation…</p>;
  if (invite.isError) return <div className="empty">This invitation isn't valid anymore. Ask your admin for a fresh one.</div>;

  return (
    <div className="invite-accept">
      <h2>Join {invite.data.orgName} on Wave</h2>
      <p>You've been invited as a <strong>{invite.data.role}</strong> ({invite.data.email}).</p>
      {me.data?.user ? (
        <>
          <button onClick={() => accept.mutate()}>Join {invite.data.orgName}</button>
          {accept.isError && <div className="banner" role="alert">Joining failed — make sure you're signed in as {invite.data.email}.</div>}
        </>
      ) : (
        <div className="card">
          <p>{creds.mode === "signup" ? "Create your account to join:" : "Sign in to join:"}</p>
          {creds.mode === "signup" && (
            <label>Name <input value={creds.name} onChange={(e) => setCreds({ ...creds, name: e.target.value })} /></label>
          )}
          <label>Password <input type="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} /></label>
          <button disabled={!creds.password || auth.isPending} onClick={() => auth.mutate()}>
            {creds.mode === "signup" ? "Sign up & join" : "Sign in & join"}
          </button>
          <button className="ghost" onClick={() => setCreds({ ...creds, mode: creds.mode === "signup" ? "login" : "signup" })}>
            {creds.mode === "signup" ? "I already have an account" : "I'm new here"}
          </button>
          {authError && <div className="banner" role="alert">That didn't work — check the password and try again.</div>}
        </div>
      )}
    </div>
  );
}

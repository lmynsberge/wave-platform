import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Msg { id: string; role: "user" | "companion"; content: string; seq: number }
const isSynthesis = (m: Msg) => m.role === "companion" && m.content.startsWith("Here's your reflection");

export function CompanionView({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [shareIntent, setShareIntent] = useState<string | null>(null);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [shareError, setShareError] = useState(false);

  const thread = useQuery({
    queryKey: ["companion", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/companion`)).json() as Promise<{ segmentId: string; messages: Msg[] }>,
    retry: false,
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/orgs/${orgId}/companion/messages`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("send failed");
      return res.json();
    },
    onSuccess: () => { setDraft(""); void qc.invalidateQueries({ queryKey: ["companion", orgId] }); },
  });

  const share = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/orgs/${orgId}/companion/share`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId }),
      });
      if (!res.ok) throw new Error("share failed");
      return messageId;
    },
    onSuccess: (id) => { setShared((s) => new Set(s).add(id)); setShareIntent(null); },
    onError: () => setShareError(true),
  });

  if (thread.isPending) return <p>Opening your space…</p>;
  if (thread.isError) return <div className="banner" role="alert">Your companion is unreachable right now — nothing is lost, try again shortly.</div>;

  return (
    <div className="companion">
      <div className="thread">
        {thread.data.messages.map((m) => (
          <div key={m.id} data-role={m.role} className={`msg ${m.role} ${isSynthesis(m) ? "synthesis" : ""}`}>
            <div className="content">{m.content}</div>
            {isSynthesis(m) && !shared.has(m.id) && (
              shareIntent === m.id ? (
                <span>
                  <button onClick={() => share.mutate(m.id)}>Confirm share</button>
                  <button className="ghost" onClick={() => setShareIntent(null)}>Keep private</button>
                </span>
              ) : (
                <button className="ghost" onClick={() => { setShareError(false); setShareIntent(m.id); }}>
                  Share with your manager
                </button>
              )
            )}
            {shared.has(m.id) && <span className="badge established">Shared</span>}
          </div>
        ))}
        {shareError && <div className="banner" role="alert">The share didn't go through — your reflection stays private. Try again when you're ready.</div>}
      </div>
      <div className="composer">
        <input
          aria-label="Message"
          value={draft}
          disabled={send.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) send.mutate(draft); }}
          placeholder="Reply to your companion…"
        />
        <button disabled={send.isPending || !draft.trim()} onClick={() => send.mutate(draft)}>Send</button>
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Gap { attributeKey: string; status: string; evidenceCount: number; distinctAuthors: number; distinctValidators: number; suggestedRecipients: Array<{ userId: string; name: string }> }
interface Ask { id: string; requester: { userId: string; name: string }; attributeKey: string; createdAt: string }

const STATUS_LABEL: Record<string, string> = { insufficient_signal: "building signal", emerging: "emerging" };

export function GrowView({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const gaps = useQuery({
    queryKey: ["nudges", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/nudges`)).json() as Promise<{ gaps: Gap[] }>,
    retry: false,
  });
  const asks = useQuery({
    queryKey: ["asks", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/asks`)).json() as Promise<{ asks: Ask[] }>,
    retry: false,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [asked, setAsked] = useState<Set<string>>(new Set());

  const requestFeedback = useMutation({
    mutationFn: async (v: { recipientId: string; attributeKey: string }) => {
      const res = await fetch(`/api/orgs/${orgId}/feedback-requests`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v),
      });
      if (!res.ok) throw new Error("request failed");
      return v;
    },
    onSuccess: (v) => setAsked((s) => new Set(s).add(`${v.recipientId}:${v.attributeKey}`)),
  });

  const giveFeedback = useMutation({
    mutationFn: async (v: { subjectUserId: string; attributeKey: string; note: string }) => {
      const res = await fetch(`/api/orgs/${orgId}/feedback`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v),
      });
      if (!res.ok) throw new Error("feedback failed");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["asks", orgId] }),
  });

  return (
    <div className="grow">
      <section>
        <h2>Grow your signal</h2>
        {gaps.isPending ? <p>…</p> : gaps.isError ? null : gaps.data.gaps.length === 0 ? (
          <div className="empty">Your signal is established across the board — nicely done.</div>
        ) : gaps.data.gaps.map((g) => (
          <article className="card" key={g.attributeKey}>
            <header>
              <h3>{g.attributeKey}</h3>
              <span className={`badge ${g.status === "insufficient_signal" ? "insufficient" : g.status}`}>
                {STATUS_LABEL[g.status] ?? g.status}
              </span>
            </header>
            <div className="counts">{g.evidenceCount} evidence · {g.distinctAuthors} voices · {g.distinctValidators} validators</div>
            <div className="suggested">
              {g.suggestedRecipients.slice(0, 5).map((s) => (
                <button
                  key={s.userId}
                  className="ghost"
                  disabled={asked.has(`${s.userId}:${g.attributeKey}`)}
                  onClick={() => requestFeedback.mutate({ recipientId: s.userId, attributeKey: g.attributeKey })}
                >
                  {asked.has(`${s.userId}:${g.attributeKey}`) ? `Asked ${s.name}` : `Ask ${s.name}`}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
      <section>
        <h2>Asks of you</h2>
        {asks.isPending ? <p>…</p> : asks.isError ? null : asks.data.asks.length === 0 ? (
          <div className="empty">No open asks. When a colleague requests your perspective, it lands here.</div>
        ) : asks.data.asks.map((a) => (
          <article className="card" key={a.id}>
            <header><h3>{a.requester.name} asked about {a.attributeKey}</h3></header>
            <textarea
              aria-label={`Feedback for ${a.requester.name}`}
              value={drafts[a.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
              placeholder="What did you observe?"
            />
            <button
              disabled={!(drafts[a.id] ?? "").trim() || giveFeedback.isPending}
              onClick={() => giveFeedback.mutate({ subjectUserId: a.requester.userId, attributeKey: a.attributeKey, note: drafts[a.id]! })}
            >
              Send feedback
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

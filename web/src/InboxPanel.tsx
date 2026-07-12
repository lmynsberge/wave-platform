import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function InboxPanel({ orgId }: { orgId: string }) {
  const inbox = useQuery({ queryKey: ["inbox", orgId], queryFn: () => api.inbox(orgId), retry: false });
  if (inbox.isPending) return <p>…</p>;
  if (inbox.isError) return null;
  return (
    <>
      <h2>Feedback about you</h2>
      {inbox.data.items.length === 0 ? (
        <div className="empty">Nothing yet. Feedback lands here the moment someone shares it.</div>
      ) : (
        inbox.data.items.map((it) => (
          <div className="item" key={it.evidenceId}>
            <div>{it.note}</div>
            <div className="meta">
              <span>{it.attributeKey}</span>
              <span>{it.authorKnown ? "peer feedback" : "system"}</span>
              {it.state === "pending_upward" ? <span>awaiting upward validation</span> : null}
            </div>
          </div>
        ))
      )}
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api, meterProgress, nextStepHint, type AttributeSummary, type SignalPolicy } from "./api";

const STATUS_LABEL = {
  insufficient_signal: "building signal",
  emerging: "emerging",
  established: "established",
} as const;

export function AttributeCard({ a, policy }: { a: AttributeSummary; policy: SignalPolicy }) {
  const hint = nextStepHint(a, policy);
  const progress = meterProgress(a, policy);
  const cls = a.status === "insufficient_signal" ? "insufficient" : a.status;
  return (
    <article className="card" data-status={a.status}>
      <header>
        <h3>{a.name}</h3>
        <span className={`badge ${cls}`}>{STATUS_LABEL[a.status]}</span>
      </header>
      {a.status === "established" && a.score !== null ? (
        <div className="score" aria-label={`score ${Math.round(a.score)}`}>{Math.round(a.score)}</div>
      ) : null}
      <div className="meter" role="img" aria-label={`signal progress ${Math.round(progress * 100)} percent`}>
        <div className="fill" style={{ width: `${progress * 100}%` }} />
        <span className="tick" style={{ left: "35%" }} />
        <span className="tick" style={{ left: "60%" }} />
      </div>
      <div className="counts">
        {a.evidenceCount} evidence · {a.distinctAuthors} voices · {a.distinctValidators} validators
      </div>
      {hint ? <div className="hint">{hint}</div> : null}
    </article>
  );
}

export function ProfileCards({ orgId, userId }: { orgId: string; userId: string }) {
  const attrs = useQuery({ queryKey: ["attrs", orgId, userId], queryFn: () => api.attributes(orgId, userId), retry: false });
  const policy = useQuery({ queryKey: ["policy"], queryFn: api.policy, retry: false, staleTime: Infinity });

  if (attrs.isPending || policy.isPending) return <p>Reading the water…</p>;
  if (attrs.isError || policy.isError)
    return <div className="banner" role="alert">Signal service is unreachable right now — your data is safe, try again shortly.</div>;
  if (attrs.data.attributes.length === 0)
    return <div className="empty">No signal yet — it starts when a colleague shares feedback about you.</div>;

  return (
    <div className="cards">
      {attrs.data.attributes.map((a) => (
        <AttributeCard key={a.key} a={a} policy={policy.data} />
      ))}
    </div>
  );
}

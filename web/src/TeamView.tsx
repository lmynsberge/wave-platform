import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface TeamRow { userId: string; name: string; attributesEstablished: number; attributesEmerging: number; pendingValidations: number }
interface QueueItem { evidenceId: string; subjectUserId: string; attributeKey: string; note: string | null; createdAt: string }
interface UpwardItem extends QueueItem { authorUserId?: string | null }

export function TeamView({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["team", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/team-signal`)).json() as Promise<{ team: TeamRow[] }>,
    retry: false,
  });
  const queue = useQuery({
    queryKey: ["vqueue", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/validation-queue`)).json() as Promise<{ items: QueueItem[] }>,
    retry: false,
  });
  const upward = useQuery({
    queryKey: ["uqueue", orgId],
    queryFn: async () => (await fetch(`/api/orgs/${orgId}/upward-queue`)).json() as Promise<{ items: UpwardItem[] }>,
    retry: false,
  });

  const refetchAll = () => {
    void qc.invalidateQueries({ queryKey: ["team", orgId] });
    void qc.invalidateQueries({ queryKey: ["vqueue", orgId] });
    void qc.invalidateQueries({ queryKey: ["uqueue", orgId] });
  };

  const validate = useMutation({
    mutationFn: async (v: { evidenceId: string; outcome: "yes" | "no" | "no_signal" }) => {
      const res = await fetch(`/api/orgs/${orgId}/feedback/${v.evidenceId}/validations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome: v.outcome }),
      });
      if (!res.ok) throw new Error("validation failed");
    },
    onSuccess: refetchAll,
  });
  const decide = useMutation({
    mutationFn: async (v: { evidenceId: string; outcome: "yes" | "no" | "no_signal" }) => {
      const res = await fetch(`/api/orgs/${orgId}/assessments/${v.evidenceId}/decision`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome: v.outcome }),
      });
      if (!res.ok) throw new Error("decision failed");
    },
    onSuccess: refetchAll,
  });

  if (team.isPending || queue.isPending || upward.isPending) return <p>Gathering your team…</p>;
  if (team.isError) return <div className="banner" role="alert">Team data is unreachable right now — try again shortly.</div>;
  if (team.data.team.length === 0)
    return <div className="empty">You have no reports right now — and that's a perfectly normal state. This view wakes up when someone reports to you.</div>;

  const queueItems = queue.isError ? [] : queue.data.items;
  const upwardItems = upward.isError ? [] : upward.data.items;
  const allClear = queueItems.length === 0 && upwardItems.length === 0;
  const nameOf = (id: string) => team.data.team.find((t) => t.userId === id)?.name ?? "a teammate";

  return (
    <div className="teamview">
      <section>
        <h2>Team signal</h2>
        {team.data.team.map((t) => (
          <article className="card" data-team-row key={t.userId}>
            <header><h3>{t.name}</h3>
              {t.pendingValidations > 0 && <span className="badge emerging">{t.pendingValidations} to validate</span>}
            </header>
            <div className="counts">{t.attributesEstablished} established · {t.attributesEmerging} emerging</div>
          </article>
        ))}
      </section>

      {allClear ? (
        <div className="empty">All caught up — nothing waiting on you.</div>
      ) : (
        <>
          <section>
            <h2>Waiting on your validation</h2>
            <p className="hint">Validating adds signal. Disagreeing simply drops it from scoring — it never lowers anyone's score.</p>
            {queueItems.map((it) => (
              <article className="card" key={it.evidenceId}>
                <header><h3>{nameOf(it.subjectUserId)} · {it.attributeKey}</h3></header>
                <p>{it.note}</p>
                <div className="suggested">
                  <button onClick={() => validate.mutate({ evidenceId: it.evidenceId, outcome: "yes" })}>Validate</button>
                  <button className="ghost" onClick={() => validate.mutate({ evidenceId: it.evidenceId, outcome: "no_signal" })}>No signal</button>
                  <button className="ghost" onClick={() => validate.mutate({ evidenceId: it.evidenceId, outcome: "no" })}>Disagree</button>
                </div>
              </article>
            ))}
            {queueItems.length === 0 && <div className="empty">Nothing waiting on you here.</div>}
          </section>

          <section>
            <h2>Assessments awaiting your decision</h2>
            <p className="hint">Approving activates the assessment. Dropping leaves no trace — identical to never submitted.</p>
            {upwardItems.map((it) => (
              <article className="card" key={it.evidenceId}>
                <header><h3>About {nameOf(it.subjectUserId)} · {it.attributeKey}</h3></header>
                <p>{it.note}</p>
                <div className="suggested">
                  <button onClick={() => decide.mutate({ evidenceId: it.evidenceId, outcome: "yes" })}>Approve</button>
                  <button className="ghost" onClick={() => decide.mutate({ evidenceId: it.evidenceId, outcome: "no_signal" })}>No signal</button>
                  <button className="ghost" onClick={() => decide.mutate({ evidenceId: it.evidenceId, outcome: "no" })}>Drop</button>
                </div>
              </article>
            ))}
            {upwardItems.length === 0 && <div className="empty">No pending assessments.</div>}
          </section>
        </>
      )}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface DirEntry { id: string; name: string; slug: string; membership: string | null; requestStatus: string | null }

/** SPEC-022 R8: the zero-org empty state becomes an actionable join flow. */
export function JoinOrgs() {
  const qc = useQueryClient();
  const dir = useQuery({
    queryKey: ["orgDirectory"],
    queryFn: async () => {
      const res = await fetch("/api/orgs/directory");
      if (!res.ok) throw new Error("directory load failed");
      return (await res.json()) as { orgs: DirEntry[] };
    },
    retry: false,
  });
  const requestAccess = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch(`/api/orgs/${orgId}/join-requests`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("request failed");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["orgDirectory"] }),
  });

  const joinable = (dir.data?.orgs ?? []).filter((o) => !o.membership);

  return (
    <div className="join-orgs">
      <h2>Find your organization</h2>
      <p className="hint">
        Request access to any organization below — you can ask more than one. An organization admin
        has to approve your request before you're in; you'll see the org appear here once they do.
      </p>
      {dir.isError && <div className="banner" role="alert">Couldn't load organizations — try again shortly.</div>}
      {dir.isSuccess && joinable.length === 0 && <p>No organizations to join yet.</p>}
      {joinable.map((o) => (
        <div className="card" key={o.id}>
          <strong>{o.name}</strong> <span className="hint">({o.slug})</span>{" "}
          {o.requestStatus === "pending" ? (
            <em>Request pending</em>
          ) : (
            <button
              disabled={requestAccess.isPending}
              onClick={() => requestAccess.mutate(o.id)}
            >
              {o.requestStatus === "declined" ? "Request again" : "Request access"}
            </button>
          )}
          {o.requestStatus === "declined" && <span className="hint"> · previous request declined</span>}
        </div>
      ))}
      {requestAccess.isError && <div className="banner" role="alert">Request didn't go through — try again.</div>}
    </div>
  );
}

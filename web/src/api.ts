export interface Me {
  user: { id: string; email: string; name: string };
  memberships: Array<{ orgId: string; slug: string; name: string; role: string }>;
}
export interface AttributeSummary {
  key: string; name: string; kind: "objective" | "subjective";
  evidenceCount: number; distinctAuthors: number;
  validations: { yes: number; no: number; noSignal: number };
  distinctValidators: number;
  status: "insufficient_signal" | "emerging" | "established";
  score: number | null;
}
export interface SignalPolicy {
  subjective: { emerging: { minEvidence: number; minAuthors: number }; established: { minValidators: number } };
  objective: { emerging: { minDatapoints: number }; established: { minDatapoints: number } };
}
export interface InboxItem {
  evidenceId: string; attributeKey: string; note: string | null;
  authorKnown: boolean; createdAt: string; state: "active" | "pending_upward" | "dropped";
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new Error("unauthenticated");
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  me: () => fetch("/api/me").then((r) => json<Me>(r)),
  login: (email: string, password: string) =>
    fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }),
  signup: (email: string, password: string, name: string) =>
    fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, name }) }),
  logout: () => fetch("/api/auth/logout", { method: "POST" }),
  attributes: (orgId: string, userId: string) =>
    fetch(`/api/orgs/${orgId}/members/${userId}/attributes`).then((r) => json<{ attributes: AttributeSummary[] }>(r)),
  policy: () => fetch("/api/signal-policy").then((r) => json<SignalPolicy>(r)),
  inbox: (orgId: string) => fetch(`/api/orgs/${orgId}/inbox`).then((r) => json<{ items: InboxItem[] }>(r)),
};

/** SPEC-006 R4: hint math is policy-derived, never hardcoded. */
export function nextStepHint(a: AttributeSummary, p: SignalPolicy): string | null {
  if (a.status === "established") return null;
  if (a.kind === "objective") {
    const need = p.objective.established.minDatapoints - a.evidenceCount;
    return need > 0 ? `${need} more datapoint${need === 1 ? "" : "s"} to established` : null;
  }
  const needEv = p.subjective.emerging.minEvidence - a.evidenceCount;
  const needAu = p.subjective.emerging.minAuthors - a.distinctAuthors;
  if (needEv > 0 || needAu > 0) {
    const parts = [];
    if (needEv > 0) parts.push(`${needEv} more piece${needEv === 1 ? "" : "s"} of feedback`);
    if (needAu > 0) parts.push(`${needAu} more distinct ${needAu === 1 ? "voice" : "voices"}`);
    return `${parts.join(" and ")} to emerging`;
  }
  const needVal = p.subjective.established.minValidators - a.distinctValidators;
  if (needVal > 0) return `${needVal} more validator${needVal === 1 ? "" : "s"} to established`;
  return `1 countable validation to established`;
}

/** Meter progress 0..1 across the threshold journey. */
export function meterProgress(a: AttributeSummary, p: SignalPolicy): number {
  if (a.status === "established") return 1;
  if (a.kind === "objective") {
    return Math.min(1, a.evidenceCount / p.objective.established.minDatapoints);
  }
  const evPart = Math.min(1, a.evidenceCount / p.subjective.emerging.minEvidence);
  const auPart = Math.min(1, a.distinctAuthors / p.subjective.emerging.minAuthors);
  const valPart = Math.min(1, a.distinctValidators / p.subjective.established.minValidators);
  return Math.min(0.99, evPart * 0.35 + auPart * 0.25 + valPart * 0.4);
}

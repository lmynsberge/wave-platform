# Backlog — enhancements, fixes, optimizations
_Harvested from every handoff follow-up, review finding, issue, and the founding brief. Last groomed: July 12, 2026._

## 🚧 Launch gates (REQUIRED before design-partner deployment)
| # | Item | Origin |
|---|---|---|
| ~~G1~~ | ~~BYO key encryption~~ **CLOSED by SPEC-017** (AES-256-GCM, TF-generated KEK, fail-closed) | SPEC-017 |
| ~~G2~~ | ~~Notification opt-out~~ **CLOSED by SPEC-017** (self-only prefs, bridge command, unsent/unlogged/uncounted skip) | SPEC-017 |
| ~~G3~~ | ~~Session cookie Secure flag~~ **CLOSED by SPEC-016** (COOKIE_SECURE, TF-enforced) | SPEC-016 |
| ~~G4~~ | ~~Slack raw-body signatures~~ **CLOSED by SPEC-018** (exact-bytes-only verification, fail-open fallback removed) | SPEC-018 |
| ~~G5~~ | ~~Test adapter absent from prod~~ **CLOSED STRUCTURALLY by SPEC-016** (TF env allowlist) | SPEC-016 |
| G6 | Staging verification — DECIDED POSTURE (~$0): the demo deployment IS staging; Slack via free workspace; openai_compatible via local Ollama; Anthropic pennies with any key; **Teams DEFERRED until a partner demands it** | SPEC-012/013/014 |
| G7 | Rate limiting: auth, bridge events, dispatch — **DEFERRED by decision** (revisit before public exposure beyond demo) | decision |

## 🔐 Security & trust (post-gate)
- Re-encrypt sweep for any legacy plaintext BYO keys at first real org (SPEC-017 R3 debt); KMS-managed KEK as design-partner upgrade
- Teams AAD JWT verification replacing shared-secret v1 (SPEC-012)
- Redaction scope: phone numbers, org-specific terms, configurable dictionaries (SPEC-014)
- Password reset flow; SSO/OIDC (brief Layer 1 — the actual design-partner requirement)
- Core pool exhaustion → 503 not 500 (SPEC-003)
- Contract tests: server's fake core validated against the real binary per release (SPEC-003)

## 🐞 Fixes & debt
- Pagination cursor is created_at only; ORDER BY has id tiebreak but the cursor doesn't carry it → duplicate/skip risk at identical timestamps (SPEC-005 listing)
- Synthesis detection via marker-string is provider-coupled in interviewState/share paths; move to a message metadata column (SPEC-007→014, contract now spec-stated but the column is still the right fix)
- interviewState re-derives from full history every turn → O(history); add a cursor once metadata lands
- ENGINEERING says sqlx is the target; core runs tokio-postgres (A2). Decide: adopt sqlx w/ `sqlx prepare` in CI, or amend the target to tokio-postgres permanently
- Meter tick positions hardcoded percents; derive from live policy (SPEC-006)
- Self-host web fonts (Google CDN dependency) (SPEC-006)
- Harness: kill stray processes on fixed ports before boot (SPEC-QA-001 §5, unimplemented)

## ⚡ Optimizations (trigger: first real-org traffic)
- Materialize signal state; read-time aggregation is O(evidence) per profile view (SPEC-004/006)
- Normalization cohort query per objective attribute per read → cache or materialize (SPEC-008)
- isManagerOf per-hop queries → recursive CTE (teamview already does this; feedback.ts doesn't) (SPEC-002/003)
- Upward-queue per-item root-author lookups → batch (SPEC-005)
- Asks-fulfillment N+1 core calls (bridge, nudges, outbound each re-derive) → core batch endpoint "evidence by author across subjects" (SPEC-009/012/013)

## ✨ Enhancements — product
**Manager experience (biggest UI gap):** validation queue UI, upward-decision UI, team-signal dashboard view — the APIs exist (SPEC-005/010), no screens do.
**Individual:** trajectory/history on profile (needs longitudinal storage) · inbox read-state · anonymity preferences UI · share revocation · "first in cohort" copy for percentile 0 · ~~link-code UI~~ (SPEC-019) · re-request after a fulfilled pair · ~~invitations~~ (SPEC-020; EMAIL DELIVERY still open) · invite revoke UI
**Companion/LLM:** LLM-composed nudge & ask messages · streaming replies · token budgeting · content moderation pass · nudges for never-touched attributes (needs the AI layer to propose attributes)
**Feedback engine:** multi-validator upward consensus (single-decider today) · per-org/env-configurable significance thresholds · shares-as-evidence (MUST route through SPEC-003 rules — SPEC-007 review finding 5)
**Ingestion:** CSV upload UI · named source adapters (Culture Amp first, per wave-preview) · scheduled connector pulls · cron wrapper for nudge-dispatch · digest batching for notifications

## 📦 Shelved (deliberately, with wake conditions)
- **Design-partner target list** (Decision #2 profile: 150–1,000 employees, growth culture, objective-metric industry). WAKE CONDITION: working demo deployment exists. Do not start outreach research before then.

## 🔭 Founding-brief bets not yet started (the moat work)
- **Cross-org normalization** — the core product bet; unblocs when org #2 exists
- **Cohort segmentation** (role/seniority/industry) for fair within- and cross-org comparison
- **Collusion-ring detection** (reciprocity analysis, validator-independence weighting)
- **Universal-bias instrumentation**: outcome-anchoring, counterfactual auditing, cold-start subjective down-weighting
- **Arbitration process** (pinned since the founding conversation: chain-up until both parties accept an arbiter; evidence rules that avoid coercive reveal of private context)
- **Score lifecycle**: "drop worst of last X," disputed-score dropping (ties into arbitration)
- **Premium tier** boundary per pricing decision #3 (outward-facing free; self-serve depth paid)

## 🏗️ Infrastructure (agent environment)
- ISS-001: GitHub App write access (unblocks direct push/PR; retires the bundle protocol)
- ISS-002: docker in agent env (unblocks compose-level AC verification)
- ISS-003: durable workspace (bundle protocol remains the mitigation)

# Backlog — enhancements, fixes, optimizations
_Harvested from every handoff follow-up, review finding, issue, and the founding brief. Last groomed: July 12, 2026._

## 🚧 Launch gates (REQUIRED before design-partner deployment)
| # | Item | Origin |
|---|---|---|
| G1 | Envelope encryption for BYO LLM keys (plaintext-at-rest today) | SPEC-014 |
| G2 | Per-user notification opt-out for outbound nudges | SPEC-013 review |
| G3 | Session cookie `Secure` flag behind env; HTTPS everywhere | SPEC-002 |
| G4 | Verify Slack raw-body signature path under fastify raw-body handling (current fallback re-serializes req.body — fragile against canonicalization) | SPEC-012 |
| G5 | Ensure BRIDGE_TEST_SECRET / test adapter absent from production config (deployment checklist) | SPEC-012 review |
| G6 | Staging verification: Anthropic + OpenAI + one self-hosted model; Slack chat.postMessage; Teams webhook | SPEC-012/013/014 |
| G7 | Rate limiting: auth endpoints, bridge events, dispatch trigger | never specced |

## 🔐 Security & trust (post-gate)
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
**Individual:** trajectory/history on profile (needs longitudinal storage) · inbox read-state · anonymity preferences UI · share revocation · "first in cohort" copy for percentile 0 · link-code UI in settings (API exists) · re-request after a fulfilled pair · org create/join + invitations (email)
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

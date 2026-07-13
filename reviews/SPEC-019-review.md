---
id: SPEC-019-review
subject: SPEC-019
reviewer: spec-reviewer
verdict: approved
cycle: 1
---

# Review: SPEC-019 (Settings UI)

## Verdict
`approved`

## Findings
1. (verified, A2 web-equivalence) RED: missing SettingsView module. Recorded.
2. (major, resolved in draft) The notifications toggle is presented as "proactive messages ON/OFF" (positive framing) with consent-clear copy rather than an "opt out" checkbox — R3's neutrality requirement done right.
3. (minor) LLM section gates on role passed from the shell's already-fetched /api/me — no new authz surface invented client-side; server 403s remain the enforcement.
4. (minor) 404-as-unconfigured (AC4) prevents the classic error-banner-on-first-visit papercut.

## Checklist results
- [x] Red recorded; delegation explicit (no new contracts)
- [x] Trust legibility copy required (R4) per SPEC-015 precedent

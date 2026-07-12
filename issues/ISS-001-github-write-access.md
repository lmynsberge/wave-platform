---
id: ISS-001
severity: degraded
raised_by: workstream-lead
relates_to: SPEC-001
status: open
---

# ISS-001: GitHub App integration lacks write access to wave-platform

## Problem
The GitHub MCP integration authenticates and can read `lmynsberge/wave-platform`, but all write operations (create/update file, branch push, PR creation) return `403 Resource not accessible by integration`. Repo creation also 403s. Root cause: the GitHub App installation grant does not include write (Contents) permission for this repository.

## Impact
Agents cannot push branches or open PRs directly. Work is NOT stopped (severity: degraded).

## Workaround (active)
Implement SPEC-001 fully in the local workspace as a proper git repository (branch `spec-001/walking-skeleton` off `main`), deliver as an archive. A human pushes with:

```
git remote add origin git@github.com:lmynsberge/wave-platform.git
git push -u origin main spec-001/walking-skeleton
```

then opens the PR from the branch.

## Fix required
In GitHub → Settings → Installations → (Claude/GitHub app) → Configure:
- Repository access must include `wave-platform` (or All repositories)
- Permissions must include Contents: Read and write (and Pull requests: Read and write)

## Resolution
_Open. Close when an agent successfully pushes a commit and opens a PR._

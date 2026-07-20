#!/usr/bin/env node
/**
 * SPEC-023: wave-internal account merge (combines + reprocesses).
 * Usage: node scripts/merge-accounts.mjs --from <email|uuid> --into <email|uuid> [--dry-run]
 * Env:   DATABASE_URL (server DB), CORE_URL (internal core service)
 *
 * Order (R7): core merge first (idempotent), then ONE server transaction ending with the
 * tombstone — so a crash anywhere is repaired by simply re-running.
 * Wave-internal by construction (R1): needs direct DB + internal-core access.
 */
import { createRequire } from "node:module";
const require = createRequire(new URL("../server/package.json", import.meta.url));
const { Client } = require("pg");

const die = (msg) => { console.error(`merge-accounts: ${msg}`); process.exit(1); };

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fromRef = flag("--from");
const intoRef = flag("--into");
const dryRun = args.includes("--dry-run");
if (!fromRef || !intoRef) die("usage: --from <email|uuid> --into <email|uuid> [--dry-run]");
if (!process.env.DATABASE_URL) die("DATABASE_URL is required");
const CORE_URL = process.env.CORE_URL ?? "http://localhost:8081";

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveUser(ref, label) {
  const by = UUID_RE.test(ref) ? "id = $1" : "email = $1";
  const { rows } = await db.query(`SELECT id, email, name, merged_into FROM users WHERE ${by}`, [ref]);
  if (!rows[0]) die(`${label} account not found: ${ref}`);
  if (rows[0].merged_into) die(`${label} account was already merged (${ref} -> ${rows[0].merged_into})`);
  return rows[0];
}

const from = await resolveUser(fromRef, "from");
const into = await resolveUser(intoRef, "into");
if (from.id === into.id) die("refusing to merge an account into itself (same user)");

const count = async (sql, params) => Number((await db.query(sql, params)).rows[0].n);

if (dryRun) {
  console.log(`DRY RUN — would merge ${from.email} (${from.id}) into ${into.email} (${into.id})`);
  const report = {
    memberships: await count("SELECT count(*) n FROM memberships WHERE user_id = $1", [from.id]),
    reportingEdges: await count(
      "SELECT count(*) n FROM reporting_edges WHERE user_id = $1 OR manager_id = $1", [from.id]),
    chatSegments: await count("SELECT count(*) n FROM chat_segments WHERE user_id = $1", [from.id]),
    reflectionShares: await count("SELECT count(*) n FROM reflection_shares WHERE user_id = $1", [from.id]),
    feedbackRequests: await count(
      "SELECT count(*) n FROM feedback_requests WHERE requester_id = $1 OR recipient_id = $1", [from.id]),
    sessions: await count("SELECT count(*) n FROM sessions WHERE user_id = $1", [from.id]),
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("No changes made (core untouched in dry-run).");
  await db.end();
  process.exit(0);
}

// ---- R7 step 1: core-owned data via core's own transactional endpoint ----
const coreRes = await fetch(`${CORE_URL}/v1/admin/merge-users`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ fromUserId: from.id, intoUserId: into.id }),
}).catch((e) => die(`core unreachable at ${CORE_URL}: ${e.message}`));
if (!coreRes.ok) die(`core merge failed: ${coreRes.status} ${await coreRes.text()}`);
const coreCounts = await coreRes.json();

// ---- R7 step 2: server-owned data, one transaction, tombstone last ----
const run = async (sql, params = [from.id, into.id]) => (await db.query(sql, params)).rowCount;
const counts = { core: coreCounts };
await db.query("BEGIN");
try {
  // memberships: union; on collision the HIGHER role survives (R4)
  counts.membershipRolesRaised = await run(
    `UPDATE memberships i SET role = f.role
     FROM memberships f
     WHERE f.user_id = $1 AND i.user_id = $2 AND i.org_id = f.org_id
       AND array_position(ARRAY['owner','admin','manager','member'], f.role)
         < array_position(ARRAY['owner','admin','manager','member'], i.role)`);
  counts.membershipCollisionsDropped = await run(
    "DELETE FROM memberships f WHERE f.user_id = $1 AND EXISTS (SELECT 1 FROM memberships i WHERE i.user_id = $2 AND i.org_id = f.org_id)");
  counts.membershipsMoved = await run("UPDATE memberships SET user_id = $2 WHERE user_id = $1");

  // reporting edges: INTO's own edge wins; manager side reassigns; self-edges dropped (R4)
  counts.reportingCollisionsDropped = await run(
    "DELETE FROM reporting_edges f WHERE f.user_id = $1 AND EXISTS (SELECT 1 FROM reporting_edges i WHERE i.user_id = $2 AND i.org_id = f.org_id)");
  counts.reportingSelfEdgesDropped = await run(
    "DELETE FROM reporting_edges WHERE (user_id = $1 AND manager_id = $2) OR (user_id = $2 AND manager_id = $1)");
  counts.reportingUserMoved = await run("UPDATE reporting_edges SET user_id = $2 WHERE user_id = $1");
  counts.reportingManagerMoved = await run("UPDATE reporting_edges SET manager_id = $2 WHERE manager_id = $1");

  // chat: on (org, kind) collision, FROM's messages append after INTO's max seq (R4; invariant 3 — own data only)
  const { rows: segPairs } = await db.query(
    `SELECT f.id AS from_seg, i.id AS into_seg
     FROM chat_segments f JOIN chat_segments i
       ON i.org_id = f.org_id AND i.kind = f.kind AND i.user_id = $2
     WHERE f.user_id = $1`, [from.id, into.id]);
  counts.chatSegmentsAppended = 0;
  for (const p of segPairs) {
    await db.query(
      `UPDATE chat_messages SET segment_id = $2,
         seq = seq + (SELECT coalesce(max(seq), 0) FROM chat_messages WHERE segment_id = $2)
       WHERE segment_id = $1`, [p.from_seg, p.into_seg]);
    await db.query("DELETE FROM chat_segments WHERE id = $1", [p.from_seg]);
    counts.chatSegmentsAppended++;
  }
  counts.chatSegmentsMoved = await run("UPDATE chat_segments SET user_id = $2 WHERE user_id = $1");

  counts.reflectionSharesMoved = await run("UPDATE reflection_shares SET user_id = $2 WHERE user_id = $1");

  // feedback requests: keyed collisions keep INTO's; post-merge self-requests dropped (R4)
  counts.feedbackRequestCollisionsDropped = await run(
    `DELETE FROM feedback_requests f
     WHERE (f.requester_id = $1 OR f.recipient_id = $1)
       AND EXISTS (SELECT 1 FROM feedback_requests i
                   WHERE i.org_id = f.org_id AND i.attribute_key = f.attribute_key
                     AND i.requester_id = CASE WHEN f.requester_id = $1 THEN $2 ELSE f.requester_id END
                     AND i.recipient_id = CASE WHEN f.recipient_id = $1 THEN $2 ELSE f.recipient_id END)`);
  counts.feedbackRequestsMoved =
    (await run("UPDATE feedback_requests SET requester_id = $2 WHERE requester_id = $1")) +
    (await run("UPDATE feedback_requests SET recipient_id = $2 WHERE recipient_id = $1"));
  counts.feedbackSelfRequestsDropped = await run(
    "DELETE FROM feedback_requests WHERE requester_id = $1 AND recipient_id = $1", [into.id]);

  // bridge + prefs: keyed collisions keep INTO's (R4)
  counts.bridgeMoved = 0;
  counts.bridgeMoved += await run("UPDATE bridge_link_codes SET user_id = $2 WHERE user_id = $1");
  counts.bridgeMoved += await run("UPDATE bridge_bindings SET user_id = $2 WHERE user_id = $1");
  counts.bridgeMoved += await run(
    "DELETE FROM bridge_nudge_log f WHERE f.user_id = $1 AND EXISTS (SELECT 1 FROM bridge_nudge_log i WHERE i.user_id = $2 AND i.org_id = f.org_id AND i.kind = f.kind)");
  counts.bridgeMoved += await run("UPDATE bridge_nudge_log SET user_id = $2 WHERE user_id = $1");
  counts.bridgeMoved += await run(
    "DELETE FROM bridge_notification_prefs f WHERE f.user_id = $1 AND EXISTS (SELECT 1 FROM bridge_notification_prefs i WHERE i.user_id = $2 AND i.org_id = f.org_id)");
  counts.bridgeMoved += await run("UPDATE bridge_notification_prefs SET user_id = $2 WHERE user_id = $1");

  counts.invitationsReauthored = await run("UPDATE org_invitations SET created_by = $2 WHERE created_by = $1");

  // SPEC-022 join requests, if that migration is present (merge-order independence)
  const { rows: [jr] } = await db.query("SELECT to_regclass('org_join_requests') IS NOT NULL AS present");
  if (jr.present) {
    counts.joinRequestCollisionsDropped = await run(
      "DELETE FROM org_join_requests f WHERE f.user_id = $1 AND f.status = 'pending' AND EXISTS (SELECT 1 FROM org_join_requests i WHERE i.user_id = $2 AND i.org_id = f.org_id AND i.status = 'pending')");
    counts.joinRequestsMoved = await run("UPDATE org_join_requests SET user_id = $2 WHERE user_id = $1");
    await run("UPDATE org_join_requests SET decided_by = $2 WHERE decided_by = $1");
    // a request for an org the user is now a member of is moot
    counts.joinRequestsMooted = await run(
      "DELETE FROM org_join_requests r WHERE r.user_id = $1 AND r.status = 'pending' AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = $1 AND m.org_id = r.org_id)",
      [into.id]);
  }

  // R5: kill sessions, then tombstone LAST (it arms the R6 already-merged guard)
  counts.sessionsDeleted = await run("DELETE FROM sessions WHERE user_id = $1", [from.id]);
  await db.query(
    "UPDATE users SET merged_into = $2, email = 'merged-' || $1 || '@merged.wave.invalid' WHERE id = $1",
    [from.id, into.id]);

  await db.query("COMMIT");
} catch (e) {
  await db.query("ROLLBACK");
  die(`server-side merge failed (rolled back; core already merged — re-run after fixing): ${e.message}`);
}

console.log(`Merged ${from.email} (${from.id}) into ${into.email} (${into.id})`);
console.log(JSON.stringify(counts, null, 2));
await db.end();

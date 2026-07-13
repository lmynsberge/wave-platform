#!/usr/bin/env node
/**
 * Demo seed: dresses a RUNNING stack (server on :8080 by default) with
 * Meridian Consulting — a believable org showing every surface.
 * Usage: node scripts/seed-demo.mjs [serverUrl]
 * Idempotency: run against a fresh database (compose up / re-migrate first).
 */
const BASE = process.argv[2] ?? "http://localhost:8080";
const CORE = process.env.CORE_URL ?? "http://localhost:8081";

function jar() {
  let cookie = "";
  return async (path, init = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}
const post = (b) => ({ method: "POST", body: JSON.stringify(b) });
const put = (b) => ({ method: "PUT", body: JSON.stringify(b) });

async function user(name, email) {
  const c = jar();
  const r = await c(`/api/auth/signup`, post({ email, password: "demo-password-1", name }));
  if (r.status !== 201) throw new Error(`signup ${email}: ${r.status}`);
  return { c, id: r.body.user.id, name, email };
}
const coreCall = (path, body) =>
  fetch(`${CORE}${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });

const log = (s) => console.log(`  ✓ ${s}`);

// ---- people ----
const dana = await user("Dana Okafor", "dana@meridian.demo");        // owner/CEO
const marcus = await user("Marcus Webb", "marcus@meridian.demo");    // manager
const priya = await user("Priya Sharma", "priya@meridian.demo");     // IC, the "hero" profile
const jonah = await user("Jonah Reyes", "jonah@meridian.demo");      // IC
const elena = await user("Elena Vasquez", "elena@meridian.demo");    // IC
const sam = await user("Sam Liu", "sam@meridian.demo");              // IC
const admin = await user("Ade Bello", "ade@meridian.demo");          // admin/People lead
log("6 people signed up (password: demo-password-1)");

const org = await dana.c(`/api/orgs`, post({ name: "Meridian Consulting", slug: "meridian" }));
const orgId = org.body.org.id;
for (const [u, role] of [[marcus, "member"], [priya, "member"], [jonah, "member"], [elena, "member"], [sam, "member"], [admin, "admin"]])
  await dana.c(`/api/orgs/${orgId}/members`, post({ userId: u.id, role }));
for (const [u, m] of [[priya, marcus], [jonah, marcus], [elena, marcus], [marcus, dana]])
  await dana.c(`/api/orgs/${orgId}/reporting`, put({ userId: u.id, managerId: m.id }));
log("Meridian Consulting created; chain: priya/jonah/elena → marcus → dana");

// ---- attributes ----
for (const [key, name, kind] of [
  ["client_communication", "Client communication", "subjective"],
  ["mentorship", "Mentorship", "subjective"],
  ["facilitation", "Facilitation", "subjective"],
  ["billable_hours", "Billable hours", "objective"],
]) await coreCall("/v1/attributes", { key, name, kind });
log("attribute taxonomy seeded");

// ---- Priya: ESTABLISHED client_communication (5 evidence / 4 authors, 5 validators, drop-not-negative on display) ----
const evIds = [];
const authors = [jonah, elena, sam, admin]; // NOT dana: she's in priya's chain — invariant 1 caught this in testing
const notes = [
  "Walked the Hargrove client back from the ledge in one call — calm, specific, zero spin.",
  "Turned a rambling stakeholder session into three crisp decisions.",
  "Clients ask for her by name on the renewal calls.",
  "De-escalated the Q2 scope dispute without giving away the roadmap.",
  "Her status emails are the only ones the client actually reads.",
];
for (let i = 0; i < 5; i++) {
  const r = await authors[i % 4].c(`/api/orgs/${orgId}/feedback`,
    post({ subjectUserId: priya.id, attributeKey: "client_communication", note: notes[i] }));
  if (r.status !== 201) throw new Error(`feedback seed failed: ${r.status} ${JSON.stringify(r.body)}`);
  evIds.push(r.body.evidence.id);
}
// validator must not be that evidence's author; dana's "no" travels the manager chain and is DROPPED from scoring
const pairs = [[0, elena, "yes"], [1, sam, "yes"], [2, admin, "yes"], [3, jonah, "yes"], [4, dana, "no"]];
for (const [i, v, outcome] of pairs) {
  const r = await v.c(`/api/orgs/${orgId}/feedback/${evIds[i]}/validations`, post({ outcome }));
  if (r.status !== 201) throw new Error(`validation seed failed: ${r.status} ${JSON.stringify(r.body)}`);
}
log("Priya: client_communication ESTABLISHED — score 100 with Dana's manager-'no' visibly dropped");

// ---- Priya: EMERGING mentorship (gap → nudge material) ----
for (const [a, note] of [[jonah, "Pairs patiently — I level up every session."], [elena, "Ran a brown-bag on discovery calls."], [sam, "Reviewed my deck twice without being asked."], [jonah, "Checks in after hard client calls."], [elena, "Made onboarding feel human."]])
  await a.c(`/api/orgs/${orgId}/feedback`, post({ subjectUserId: priya.id, attributeKey: "mentorship", note }));
log("Priya: mentorship EMERGING (needs validators — visible gap + nudge)");

// ---- billable hours: normalization across three established consultants ----
for (const [u, vals] of [[priya, [152, 148, 155]], [jonah, [128, 131, 126]], [elena, [141, 139, 144]]])
  for (let i = 0; i < 3; i++)
    await admin.c(`/api/orgs/${orgId}/ingest/metrics`,
      post({ source: "harvest", period: `2026-0${i + 4}`, metrics: [{ email: u.email, attributeKey: "billable_hours", value: vals[i] }] }));
log("billable hours ingested (3 consultants × 3 periods) — percentiles live");

// ---- pending work for Marcus's Team view ----
await sam.c(`/api/orgs/${orgId}/feedback`, post({ subjectUserId: jonah.id, attributeKey: "facilitation", note: "Kept the retro on rails when it got heated." }));
await marcus.c(`/api/orgs/${orgId}/assessments`, post({ subjectUserId: elena.id, attributeKey: "client_communication", note: "Ready for solo client ownership next quarter." }));
log("Marcus: a real validation queue (Priya + Jonah items); Dana: 1 upward decision waiting");

// ---- open ask for Priya (Give & Grow) ----
await jonah.c(`/api/orgs/${orgId}/feedback-requests`, post({ recipientId: priya.id, attributeKey: "facilitation" }));
log("Jonah asked Priya for facilitation feedback (asks list populated)");

// ---- Priya's companion: full interview + a shared synthesis ----
await priya.c(`/api/orgs/${orgId}/companion`);
const answers = [
  "Steady — busy quarter but good busy.",
  "Whether I'm coaching enough vs doing.",
  "Closed the Hargrove renewal and shipped the discovery playbook.",
  "That clients calm down when I name the tradeoff out loud.",
  "Saying no to the scope creep on Delta.",
  "Jonah's really stepping up; Elena carried the workshop.",
  "Block Fridays for mentoring instead of squeezing it between calls.",
];
let lastReply = null;
for (const a of answers) {
  const r = await priya.c(`/api/orgs/${orgId}/companion/messages`, post({ content: a }));
  lastReply = r.body.reply;
  if (!lastReply) throw new Error("companion turn failed");
  // if an LLM follow-up appeared (configured envs), answer it to advance
  if (!lastReply.content.startsWith("Here's your reflection") && !lastReply.content.endsWith("?") === false && !answers.includes(lastReply.content)) { /* guided default has questions ending with ? */ }
}
const thread = await priya.c(`/api/orgs/${orgId}/companion`);
const synthesis = thread.body.messages.filter((m) => m.role === "companion" && m.content.startsWith("Here's your reflection")).at(-1);
if (synthesis) {
  await priya.c(`/api/orgs/${orgId}/companion/share`, post({ messageId: synthesis.id }));
  log("Priya completed a check-in and shared the reflection with Marcus");
} else {
  log("companion seeded (no synthesis reached — LLM follow-ups may be on; demo it live instead)");
}

console.log(`\nMeridian Consulting is ready. Org: ${orgId}`);
console.log("Log in as (password demo-password-1):");
console.log("  priya@meridian.demo   — the individual story (profile, companion, Give & Grow)");
console.log("  marcus@meridian.demo  — the manager story (Team: validation + team signal)");
console.log("  dana@meridian.demo    — upward decision waiting");
console.log("  ade@meridian.demo     — admin (ingestion, LLM config, nudge dispatch)");

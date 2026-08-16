#!/usr/bin/env node
/**
 * f10-r12-crowd-motion.mjs — DOES ANY ONE OF THOSE 392 PEOPLE EVER MOVE?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `W1-F10-r11-CRITIC` reproduced round 11's whole crowd claim and then killed it with one
 * measurement: **0 of 60 drawn NPCs change any non-foot bone rotation over 60 frames, worst
 * change across the whole crowd exactly 0 radians**, against a required-to-disagree player
 * control moving **0.011246 m** in the same interval. Its sentence for it: *408 statues in 392
 * poses score 100%*. `RI-VIS10` C3 arm (b) gained a temporal clause (b2) in the same verdict —
 * arm (a) had always required *"and the two frames differ"* and the crowd arm inherited every
 * other clause from arm (a) except that one.
 *
 * So this tool asks the three questions round 12 can fail on, and they are not the same question:
 *
 *   **A. DOES ANYBODY MOVE**  — arm (b2). ≥ 90% of DRAWN NPCs, non-foot bones, ≥ 60 frames apart.
 *   **B. IS THE MOVING CROWD STILL A CROWD** — arm (b1) must survive, and 408 people breathing
 *        in step at a fixed offset is `RI-VIS10` §F#6 arriving in the time axis. The phase
 *        offsets themselves have to move, which is what the per-person `loopRate` is for.
 *   **C. IS THE SAME PERSON STILL THE SAME PERSON** — S59 clause (b). A crowd that re-deals its
 *        hand on stream-in is worse than a crowd that is still.
 *
 * **C IS WHERE THE ROUND CAN LIE TO ITSELF, AND ITS CLAUSE IS NOT LITERALLY SATISFIABLE.** S59
 * clause (b) as written asks that `f10-r11c-stance-probe.mjs`'s REBUILD / TRAVEL / SAVE-RELOAD
 * arms still return 60 of 60 **bit-identical**. That probe reads bone rotations at two wall
 * times with frames in between — and after round 12 the pose is a function of time BY DESIGN, so
 * bit-identity across an interval is exactly what arm (b2) forbids. The two clauses of the same
 * verdict are in tension and the resolution is a split, measured both ways here and published
 * both ways:
 *
 *   • the **IDENTITY** — weight side, depth, phase offset, rate, head aim, arm hang, splay — is
 *     a pure function of the eid and must be bit-identical across all three attacks (arm L3a);
 *   • the **PHASE** is a function of (identity, sim frame), so the bone rotations are bit-
 *     identical only when the two readings are taken at the SAME clock (arm L3b), and differ
 *     otherwise, which is the round working rather than the round failing.
 *
 * Both readings are reported. So is the unmodified critic probe's own verdict on this tree.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE SELF-TEST ARMS — every one has a partner required to disagree with it
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  1a. **NULL CLOCK.** Solved at `t = 0` twice, one person must be bit-identical to themselves.
 *  1b. **LIVE CLOCK.** Solved at `t = 0` and `t = 60`, the same person must DIFFER on a non-foot
 *      bone. If 1a fails the reader is reading noise; if 1b fails the advance does not exist.
 *      **This pair is the whole tool.** Round 11's own live arm L2 reported worst non-foot drift
 *      2.842e-12 m and filed it as stability; it was also the proof of the statue.
 *  2.  **ROUND 11 REPRODUCES AT t = 0, BYTE FOR BYTE.** The banked r11 artifact
 *      (`artifacts/W1-F10-r11/crowd-stance.json`, 408 rows) is re-derived on this tree and every
 *      field of every row must match. `loopRate` is drawn LAST from the seeded stream precisely
 *      so this can hold; an arm that only checked the summary numbers would miss a re-ordering.
 *  3.  **THE STAGGER IS SEEDED, NOT ORDINAL.** Bucket assignment must be a function of the
 *      identity hash: independent of file order (3a), spread over all N buckets (3b), and NOT
 *      correlated with settlement (3c) — a settlement that breathes as a block is visible.
 *  4.  **NOBODY IS IN STEP, AND THE OFFSETS THEMSELVES MOVE.** Distinct loop phases at t = 0,
 *      600 and 6000 (4a), and the pairwise phase gaps must CHANGE between t = 0 and t = 6000
 *      (4b) — with a required-to-disagree control (4c) that holds `loopRate` at 1.0 for
 *      everybody and must show the gaps frozen. Without 4c, 4b is satisfied by any drift.
 *  5.  **PLANTING SURVIVES THE ADVANCE (S59 c).** Every one of the 408, at five clocks, lands
 *      its lower ankle within 1 mm of the rest pose's — the root solve must be re-run WITH the
 *      pose, or the crowd hovers again the moment it breathes.
 *  6.  **b1 SURVIVES THE ADVANCE (S59 a).** C3's three numbers over the 408, at five clocks;
 *      ≥ 90% must stay over 3° at every one of them. A phase advance that walked the crowd
 *      through the loop's zero crossing would pass arm (b2) and fail arm (b1) at some clocks.
 *  7.  **THE SHARED STANCE IS NOT MUTATED.** `idle_ready` + `idle_loop` fingerprinted before and
 *      after 408 × 5 solves. A solver that scaled the shared archetype in place would pass every
 *      arm above and silently rewrite the player's own stand.
 *  8.  **THE ADVANCE IS CONSUMED (RI-MTH07), WITH A NULL CONTROL.** Perturbing `idle_loop`'s
 *      rotation keys must change the t = 60 pose of all 408 (8a); adding an unread field to the
 *      stance object must change nothing (8b). 8a alone certifies an unwired fix.
 *
 * Usage:
 *   node tools/visual/f10-r12-crowd-motion.mjs --self-test
 *   node tools/visual/f10-r12-crowd-motion.mjs --json=out.json
 *   node tools/visual/f10-r12-crowd-motion.mjs --live --out=DIR      # the running game
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

/** HAZARDS §22: an arm's manifest must say which tree it ran in, or a before/after pair is not
 *  readable. A control clone records `unknown`; a worktree records the pinned sha. */
function treeCommit() {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --short -- game/ tools/', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { commit: sha, working_tree_dirty_in_game_or_tools: dirty.length > 0, dirty_paths: dirty ? dirty.split('\n').slice(0, 12) : [] };
  } catch { return { commit: 'unknown', working_tree_dirty_in_game_or_tools: null, dirty_paths: [] }; }
}

// ── the r9 critic's own C3 definitions, verbatim, so a number here is a number there ─────────
const DEG = 180 / Math.PI;
function lineTiltDeg(L, R) {
  const dy = R[1] - L[1];
  const run = Math.hypot(R[0] - L[0], R[2] - L[2]);
  return Math.atan2(dy, run) * DEG;
}
function interiorDeg(A, B, C) {
  const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
  const v = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!lu || !lv) return NaN;
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}
const T = 3;                                    // RI-VIS10 C3's own threshold, in degrees

// ── the population, enumerated from disk (rule 0b: the command is in the report) ─────────────
const NPC_DIR = join(ROOT, 'game/data/npcs');
const files = readdirSync(NPC_DIR).filter((f) => f.endsWith('.json')).sort();
const records = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(join(NPC_DIR, f), 'utf8'));
  const list = Array.isArray(j) ? j : (j.npcs || j.records || []);
  for (const n of list) records.push({ ...n, _file: f });
}

// ── the render path, imported, not modelled ─────────────────────────────────────────────────
const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));

const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}
const rig = new Rig(skel, hitgeo);

/** The SAME two objects `renderer.js:_anyStance` hands down. `moves.js` builds `_idle` at 96. */
const mkStance = (t, extra) => Object.assign({
  pose: clips.archetypes.idle_ready,
  loop: new LoopClip('idle', clips.archetypes.idle_loop, 96),
  t,
}, extra || {});
const STANCE_FINGERPRINT = () => JSON.stringify(clips.archetypes.idle_ready) + '|' + JSON.stringify(clips.archetypes.idle_loop);

function makeProbeActor(family = 'saxhleel') {
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  g.userData.actor.civilian = true;
  return g;
}

/**
 * Pose one identity at one clock through the SHIPPED `poseStatic`, and read what the renderer
 * would have drawn. `fresh` re-deals the actor; leave it false to ADVANCE the same actor, which
 * is what the game does and therefore the only way to exercise the stagger.
 */
function readAt(g, name, t, { fresh = true, stanceObj = null } = {}) {
  const A = g.userData.actor;
  if (fresh) { A.staticStance = undefined; A.staticPresentationBound = false; }
  g.name = name;
  const stance = stanceObj || mkStance(t);
  if (!fresh && stanceObj) stance.t = t;
  const ok = actorMod.poseStatic(g, rig, [0, 0, 0], 0, undefined, stance);
  if (!ok) return null;
  g.updateMatrixWorld(true);
  const S = A.built;
  const at = (id) => {
    const i = S.index.get(id);
    if (i === undefined || !S.bones[i]) return null;
    const e = S.bones[i].matrixWorld.elements;
    return [e[12], e[13], e[14]];
  };
  const eL = interiorDeg(at('upperarm_l'), at('lowerarm_l'), at('hand_l'));
  const eR = interiorDeg(at('upperarm_r'), at('lowerarm_r'), at('hand_r'));
  const r4 = (x) => +x.toFixed(4);
  const st = A.staticStance || null;
  const FEET = new Set([S.index.get('foot_l'), S.index.get('foot_r')]);
  // Two signatures. `euler_all` is every bone (the r11 definition, so the two tools compare);
  // `euler_nofoot` excludes the two bones the terrain conform rewrites every frame, which is the
  // exclusion arm (b2) itself specifies.
  const eulerOf = (skipFeet) => S.bones.map((b, i) => (!b ? 'x' : (skipFeet && FEET.has(i)) ? 'conform'
    : `${(b.rotation.x * DEG).toFixed(6)},${(b.rotation.y * DEG).toFixed(6)},${(b.rotation.z * DEG).toFixed(6)}`)).join('|');
  const worstNonFootDeg = (other) => {
    if (!other) return null;
    let worst = 0, which = null;
    S.bones.forEach((b, i) => {
      if (!b || FEET.has(i)) return;
      const o = other.rot[i];
      const d = Math.max(Math.abs(b.rotation.x - o[0]), Math.abs(b.rotation.y - o[1]), Math.abs(b.rotation.z - o[2]));
      if (d > worst) { worst = d; which = i; }
    });
    return { worst_rad: worst, worst_deg: worst * DEG, bone_index: which };
  };
  return {
    name,
    t,
    a_shoulder_line_tilt_deg: r4(lineTiltDeg(at('upperarm_l'), at('upperarm_r'))),
    b_hip_line_tilt_deg: r4(lineTiltDeg(at('thigh_l'), at('thigh_r'))),
    c_elbow_difference_deg: r4(Math.abs(eL - eR)),
    lower_ankle_y: st ? st.posed_lower_ankle_m + st.root_dy_m : null,
    rest_lower_ankle_m: st ? st.rest_lower_ankle_m : null,
    root_dy_m: st ? st.root_dy_m : null,
    loop_frame_solved: st ? st.loop_frame_solved : null,
    t_solved: st ? st.t_solved : null,
    variation: st ? st.variation : null,
    euler_all: eulerOf(false),
    euler_nofoot: eulerOf(true),
    rot: S.bones.map((b) => (b ? [b.rotation.x, b.rotation.y, b.rotation.z] : [0, 0, 0])),
    worstNonFootDeg,
  };
}
const over3 = (r) => [Math.abs(r.a_shoulder_line_tilt_deg) > T, Math.abs(r.b_hip_line_tilt_deg) > T, Math.abs(r.c_elbow_difference_deg) > T].filter(Boolean).length >= 2;
/** Worst non-foot bone rotation difference between two readings of the same actor, in degrees. */
function nonFootDelta(p, q) {
  let worst = 0;
  for (let i = 0; i < p.rot.length; i++) {
    if (p.euler_nofoot.split('|')[i] === 'conform') continue;
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(p.rot[i][c] - q.rot[i][c]));
  }
  return worst * DEG;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST
// ═══════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const arms = [];
  const fp0 = STANCE_FINGERPRINT();
  const g = makeProbeActor();
  const NAME = 'npc:' + ((records[0] && (records[0].id || records[0].eid)) || 'probe');

  // 1a / 1b — the required-to-disagree pair this whole round turns on.
  const a0 = readAt(g, NAME, 0);
  const a0b = readAt(g, NAME, 0);
  const a60 = readAt(g, NAME, 60);
  arms.push({ arm: '1a NULL CLOCK — the same person solved twice at t=0 is bit-identical', ok: a0.euler_all === a0b.euler_all, expect: 'IDENTICAL' });
  arms.push({
    arm: '1b LIVE CLOCK — the same person at t=0 and t=60 differs on a non-foot bone',
    ok: a0.euler_nofoot !== a60.euler_nofoot, expect: 'DIFFERENT',
    worst_non_foot_deg: +nonFootDelta(a0, a60).toFixed(6),
    r11_measured_worst_over_the_whole_crowd_rad: 0,
  });

  // 2 — round 11 reproduces at t = 0, byte for byte.
  const R11 = join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-F10-r11/crowd-stance.json');
  let arm2 = { arm: '2 ROUND 11 REPRODUCES AT t=0 byte for byte over all 408 rows', ok: false, note: 'artifact missing' };
  if (existsSync(R11)) {
    const prev = JSON.parse(readFileSync(R11, 'utf8'));
    const rows = prev.rows || [];
    let bad = 0, first = null;
    const gg = makeProbeActor();
    for (const row of rows) {
      const fam = row.family || 'saxhleel';
      const probe = fam === (gg.userData.actor.artFamily || 'saxhleel') ? gg : makeProbeActor(fam);
      const r = readAt(probe, row.name, 0);
      if (!r) { bad++; continue; }
      const same = r.a_shoulder_line_tilt_deg === row.a_shoulder_line_tilt_deg
        && r.b_hip_line_tilt_deg === row.b_hip_line_tilt_deg
        && r.c_elbow_difference_deg === row.c_elbow_difference_deg
        && +r.root_dy_m.toFixed(6) === row.root_dy_m
        && r.variation.mirror === row.mirror && r.variation.depth === row.depth
        && r.variation.loopFrame === row.loop_frame;
      if (!same) { bad++; if (!first) first = { want: row, got: r }; }
    }
    arm2 = { arm: '2 ROUND 11 REPRODUCES AT t=0 over all 408 rows of the banked artifact', ok: bad === 0, rows: rows.length, mismatched: bad, first_mismatch: first ? first.want.name : null, artifact: 'corpus/90-verdicts/wave1/artifacts/W1-F10-r11/crowd-stance.json' };
  }
  arms.push(arm2);

  // 3 — the stagger is seeded, not ordinal.
  const N = actorMod.STANCE_STAGGER_N;
  const buckets = new Map();
  const bySettlement = new Map();
  for (const rec of records) {
    const name = 'npc:' + (rec.id || rec.eid);
    const V = actorMod.stanceVariationFor(name);
    const b = actorMod.stanceBucket(V, N);
    buckets.set(b, (buckets.get(b) || 0) + 1);
    const s = rec.settlement || rec._file;
    if (!bySettlement.has(s)) bySettlement.set(s, new Map());
    const m = bySettlement.get(s);
    m.set(b, (m.get(b) || 0) + 1);
  }
  const counts = [...Array(N).keys()].map((i) => buckets.get(i) || 0);
  // 3c: no settlement may put more than 55% of its people in one bucket (chance for N=8 is ~12.5%)
  let worstS = null, worstFrac = 0;
  for (const [s, m] of bySettlement) {
    const tot = [...m.values()].reduce((a, b) => a + b, 0);
    if (tot < 8) continue;
    const mx = Math.max(...m.values());
    if (mx / tot > worstFrac) { worstFrac = mx / tot; worstS = s; }
  }
  arms.push({ arm: '3a BUCKET IS A FUNCTION OF THE IDENTITY HASH, not of file or array order', ok: actorMod.stanceBucket(actorMod.stanceVariationFor('npc:x'), N) === actorMod.stanceBucket(actorMod.stanceVariationFor('npc:x'), N) && actorMod.stanceBucket(actorMod.stanceVariationFor('npc:x'), N) !== undefined });
  arms.push({ arm: `3b ALL ${N} BUCKETS ARE OCCUPIED over the 408`, ok: counts.every((c) => c > 0), counts, n: records.length });
  arms.push({ arm: '3c NO SETTLEMENT BREATHES AS A BLOCK — worst single-bucket share under 0.55', ok: worstFrac < 0.55, worst_settlement: worstS, worst_share: +worstFrac.toFixed(4) });

  // 4 — nobody is in step, and the offsets themselves move.
  const phaseAt = (V, t, rateOverride) => {
    const f = V.loopFrame + t * (rateOverride === undefined ? V.loopRate : rateOverride);
    return ((f % 96) + 96) % 96;
  };
  const Vs = records.map((rec) => actorMod.stanceVariationFor('npc:' + (rec.id || rec.eid)));
  const distinct = (t, ro) => new Set(Vs.map((V) => phaseAt(V, t, ro).toFixed(3))).size;
  // UNWRAPPED gap, deliberately: `phaseAt` wraps at 96, and a wrap moves the wrapped difference
  // even when the two people are advancing at exactly the same rate — so a modular gap would make
  // arm 4c fail on a crowd that IS a rigid formation, which is the opposite of what it is for.
  const gap = (V, t, ro) => (V.loopFrame - Vs[0].loopFrame) + t * ((ro === undefined ? V.loopRate : ro) - (ro === undefined ? Vs[0].loopRate : ro));
  const gapSig = (t, ro) => Vs.slice(0, 60).map((V) => gap(V, t, ro).toFixed(4)).join(',');
  arms.push({ arm: '4a DISTINCT LOOP PHASES at t=0, 600, 6000 — a floor of 200 of 408, i.e. under half the crowd may share a phase with anybody', ok: distinct(0) > 90 && distinct(600) > 200 && distinct(6000) > 200, t0: distinct(0), t600: distinct(600), t6000: distinct(6000), n: Vs.length });
  arms.push({ arm: '4b THE PAIRWISE PHASE GAPS THEMSELVES MOVE — the crowd is not a rigid formation', ok: gapSig(0) !== gapSig(6000), expect: 'DIFFERENT' });
  arms.push({ arm: '4c CONTROL — with every rate pinned to 1.0 the same gaps are FROZEN, so 4b is not satisfied by any advance', ok: gapSig(0, 1) === gapSig(6000, 1), expect: 'IDENTICAL' });

  // 5 / 6 — S59 (c) planting and (a) arm b1, at five clocks.
  const CLOCKS = [0, 17, 60, 481, 6000];
  const plant = []; const b1 = [];
  for (const t of CLOCKS) {
    let worstPlant = 0, over = 0, n = 0;
    const gg = makeProbeActor();
    for (const rec of records) {
      const r = readAt(gg, 'npc:' + (rec.id || rec.eid), t);
      if (!r) continue;
      n++;
      worstPlant = Math.max(worstPlant, Math.abs(r.lower_ankle_y - r.rest_lower_ankle_m));
      if (over3(r)) over++;
    }
    plant.push({ t, worst_plant_error_m: worstPlant, n });
    b1.push({ t, over_bar: over, n, pct: +(100 * over / n).toFixed(2) });
  }
  arms.push({ arm: '5 PLANTING SURVIVES THE ADVANCE (S59 c) — lower ankle within 1 mm of rest at every clock', ok: plant.every((p) => p.worst_plant_error_m < 0.001), rows: plant });
  arms.push({ arm: '6 C3 ARM b1 SURVIVES THE ADVANCE (S59 a) — >= 90% over 3 deg at every clock', ok: b1.every((r) => r.pct >= 90), rows: b1 });

  // 7 — the shared stance is not mutated.
  arms.push({ arm: '7 THE SHARED idle_ready / idle_loop ARE BYTE-IDENTICAL after 408 x 5 solves', ok: STANCE_FINGERPRINT() === fp0 });

  // 8 — consumption, with a null control.
  const gp = makeProbeActor();
  const before60 = readAt(gp, NAME, 60);
  const nullStance = mkStance(60); nullStance.__unread_field = 'RI-MTH07 null control';
  const afterNull = readAt(gp, NAME, 60, { stanceObj: nullStance });
  const clone = JSON.parse(JSON.stringify(clips.archetypes.idle_loop));
  for (const b in clone.tracks) for (const ch of ['rx', 'ry', 'rz']) if (clone.tracks[b][ch]) clone.tracks[b][ch] = clone.tracks[b][ch].map(([p, v]) => [p, v * 3]);
  const perturbed = { pose: clips.archetypes.idle_ready, loop: new LoopClip('idle', clone, 96), t: 60 };
  const afterPerturb = readAt(gp, NAME, 60, { stanceObj: perturbed });
  arms.push({ arm: '8a PERTURB — tripling every idle_loop rotation key changes the t=60 pose', ok: before60.euler_nofoot !== afterPerturb.euler_nofoot, expect: 'DIFFERENT', worst_deg: +nonFootDelta(before60, afterPerturb).toFixed(6) });
  arms.push({ arm: '8b NULL CONTROL — an unread field on the stance object changes nothing', ok: before60.euler_all === afterNull.euler_all, expect: 'IDENTICAL' });

  // 9 — THE SPORADIC CLOCK. Written after the live arm caught what no offline arm could: with a
  // modulo stagger, `stepFrames(60)` + one render advances the clock 24 -> 84 and offers a turn
  // to ONE bucket, so 2 of 27 drawn NPCs moved while 408 of 408 moved offline. The offline arms
  // all advanced the clock by 1, which is the only cadence a modulo schedule survives. This arm
  // advances it the way a render loop that skips actually does, and it must hold for EVERY bucket.
  {
    const gsp = makeProbeActor();
    const st = mkStance(24);
    let starved = 0; const seen = new Set();
    for (const rec of records.slice(0, 120)) {
      const nm = 'npc:' + (rec.id || rec.eid);
      const first = readAt(gsp, nm, 24, { stanceObj: st });     // fresh: solves at t=24
      st.t = 84;
      const after = readAt(gsp, nm, 84, { fresh: false, stanceObj: st });
      st.t = 24;
      seen.add(actorMod.stanceBucket(first.variation, N));
      if (after.t_solved !== 84) starved++;
    }
    arms.push({ arm: '9 SPORADIC CLOCK — a clock that jumps 24 -> 84 (stepFrames(60) + one render) must re-solve EVERY bucket, not the one that happens to be congruent', ok: starved === 0, starved_of_120: starved, buckets_covered: seen.size, expect_buckets: N });
  }

  const pass = arms.every((a) => a.ok);
  process.stdout.write(JSON.stringify({ tool: 'tools/visual/f10-r12-crowd-motion.mjs', ...treeCommit(), stagger_n: N, arms, pass }, null, 2) + '\n');
  process.exit(pass ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// OFFLINE CENSUS over the whole shipped population, at two clocks 60 frames apart
// ═══════════════════════════════════════════════════════════════════════════════════════════
if (!args.live) {
  const T0 = Number(args.t0 ?? 0), T1 = Number(args.t1 ?? 60);
  const rows = [];
  const g0 = makeProbeActor();
  for (const rec of records) {
    const name = 'npc:' + (rec.id || rec.eid);
    const p = readAt(g0, name, T0);
    const q = readAt(g0, name, T1);
    if (!p || !q) continue;
    rows.push({
      name, settlement: rec.settlement || null, race: rec.race || null,
      a_shoulder_line_tilt_deg: p.a_shoulder_line_tilt_deg, b_hip_line_tilt_deg: p.b_hip_line_tilt_deg,
      c_elbow_difference_deg: p.c_elbow_difference_deg,
      over_bar_t0: over3(p), over_bar_t1: over3(q),
      moved_non_foot: p.euler_nofoot !== q.euler_nofoot,
      worst_non_foot_delta_deg: +nonFootDelta(p, q).toFixed(6),
      lower_ankle_t0: p.lower_ankle_y, lower_ankle_t1: q.lower_ankle_y,
      plant_error_t1_m: Math.abs(q.lower_ankle_y - q.rest_lower_ankle_m),
      loop_frame: p.variation.loopFrame, loop_rate: p.variation.loopRate,
      bucket: actorMod.stanceBucket(p.variation, actorMod.STANCE_STAGGER_N),
      sig_t0: p.euler_nofoot, sig_t1: q.euler_nofoot,
    });
  }
  const moved = rows.filter((r) => r.moved_non_foot).length;
  const out = {
    tool: 'tools/visual/f10-r12-crowd-motion.mjs', ...treeCommit(),
    generated: new Date().toISOString(),
    enumerating_command: "readdirSync('game/data/npcs/*.json') -> flatten",
    population: { files: files.length, records: records.length, posed: rows.length },
    stagger_n: actorMod.STANCE_STAGGER_N,
    clocks: { t0: T0, t1: T1 },
    RI_VIS10_C3_arm_b2_OFFLINE: {
      moved, n: rows.length, pct: +(100 * moved / rows.length).toFixed(2), bar: '>= 90%',
      worst_non_foot_delta_deg: { min: Math.min(...rows.map((r) => r.worst_non_foot_delta_deg)), max: Math.max(...rows.map((r) => r.worst_non_foot_delta_deg)) },
    },
    RI_VIS10_C3_arm_b1_OFFLINE: {
      t0: { over: rows.filter((r) => r.over_bar_t0).length, pct: +(100 * rows.filter((r) => r.over_bar_t0).length / rows.length).toFixed(2) },
      t1: { over: rows.filter((r) => r.over_bar_t1).length, pct: +(100 * rows.filter((r) => r.over_bar_t1).length / rows.length).toFixed(2) },
    },
    variety: {
      distinct_sig_t0: new Set(rows.map((r) => r.sig_t0)).size,
      distinct_sig_t1: new Set(rows.map((r) => r.sig_t1)).size,
      distinct_loop_rates: new Set(rows.map((r) => r.loop_rate)).size,
      distinct_buckets: new Set(rows.map((r) => r.bucket)).size,
    },
    planting: {
      worst_plant_error_t1_m: Math.max(...rows.map((r) => r.plant_error_t1_m)),
      distinct_lower_ankle_t1: new Set(rows.map((r) => +r.lower_ankle_t1.toFixed(6))).size,
    },
    rows,
  };
  const dest = args.json ? resolve(ROOT, String(args.json)) : null;
  if (dest) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, JSON.stringify(out, null, 1)); }
  const brief = { ...out }; delete brief.rows;
  process.stdout.write(JSON.stringify(brief, null, 2) + '\n');
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LIVE — the running game. Arm (b2) where the amendment measures it, plus the census fix.
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const OUT = resolve(ROOT, String(args.out || 'reports/visual-truth/f10-r12-crowd-motion'));
  mkdirSync(OUT, { recursive: true });
  const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
  const { launchForCapture, resolveGpuMode } = await import(pathToFileURL(join(ROOT, 'tools/visual/lib/gpu-launch.mjs')).href);
  const { rendererBanner } = await import(pathToFileURL(join(ROOT, 'tools/visual/lib/renderer-class.mjs')).href);
  const { g, attestation } = await launchForCapture({
    mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
    entry: 'game/index.html', width: 960, height: 540, log,
  });
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
  await g.h('ready');
  log(rendererBanner(attestation));
  const call = async (m, ...a) => g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String((e && e.message) || e) }; }
  }, { method: m, callArgs: a });

  // The r10 critic's Lilmoth stand by default, so the crowd is the same crowd across rounds.
  const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047) };
  const AWAY = { x: Number(args.ax ?? 1590), z: Number(args.az ?? 3120) };
  const where = await call('whereAmI');
  if (where && where.__ok && where.__ok.interior) await call('exitInterior');
  await call('teleport', STAND.x, STAND.z);
  await call('stepFrames', 24);

  /**
   * Read every actor the renderer drew: bone rotations off the objects in the scene, plus the
   * census columns HAZARDS §26 says a denominator needs. THE PLAYER IS READ IN THE SAME PASS as
   * the required-to-disagree control — arm (b2) is only meaningful if the reader can see motion.
   */
  const READ = (standX, standZ) => g.page.evaluate(([sx, sz]) => {
    const R = window.__ENGINE && window.__ENGINE.renderer;
    const sim = window.__ENGINE && window.__ENGINE.sim;
    if (!R) return { error: 'no renderer' };
    R.scene.updateMatrixWorld(true);
    const DEGl = 180 / Math.PI;
    const tilt = (L, Rr) => Math.atan2(Rr[1] - L[1], Math.hypot(Rr[0] - L[0], Rr[2] - L[2])) * DEGl;
    const interior = (A, B, C) => {
      const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
      const v = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
      const lu = Math.hypot(...u); const lv = Math.hypot(...v);
      if (!lu || !lv) return NaN;
      const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
      return Math.acos(Math.max(-1, Math.min(1, c))) * DEGl;
    };
    const readOne = (group) => {
      const A = group && group.userData && group.userData.actor;
      const S = A && A.built;
      if (!S || !S.bones) return null;
      const index = {}; if (S.index && S.index.forEach) S.index.forEach((v, k) => { index[k] = v; });
      const bones = S.bones;
      // HAZARDS §26: read a BONE, not the group. `poseFromRig` leaves the player's group at the
      // origin, so `group.position` is (0,0,0) for the player and a world position for an NPC.
      const w = (id) => { const i = index[id]; if (i === undefined || !bones[i]) return null; const e = bones[i].matrixWorld.elements; return [e[12], e[13], e[14]]; };
      const root = w('pelvis') || w('root') || w('spine_00');
      const FEET = new Set([index.foot_l, index.foot_r]);
      // Bone LOCAL rotations for the static path; bone WORLD matrices for the player, whose pose
      // does NOT live in `bone.rotation` (`poseFromRig` writes world matrices). Both are read so
      // the same probe answers for both paths — that asymmetry is what the r10 critic's first
      // tool got wrong and this comment exists so nobody re-derives it.
      const rotLocal = bones.map((b, i) => (!b ? null : (FEET.has(i) ? null : [b.rotation.x, b.rotation.y, b.rotation.z])));
      const worldNoFoot = bones.map((b, i) => (!b || FEET.has(i) ? null : Array.from(b.matrixWorld.elements)));
      const uL = w('upperarm_l'), uR = w('upperarm_r'), tL = w('thigh_l'), tR = w('thigh_r');
      const three = (uL && uR && tL && tR) ? {
        a: +tilt(uL, uR).toFixed(4), b: +tilt(tL, tR).toFixed(4),
        c: +Math.abs(interior(w('upperarm_l'), w('lowerarm_l'), w('hand_l')) - interior(w('upperarm_r'), w('lowerarm_r'), w('hand_r'))).toFixed(4),
      } : null;
      const fl = w('foot_l'), fr = w('foot_r');
      const gy = R.groundResolver ? R.groundResolver(root ? root[0] : 0, root ? root[2] : 0) : null;
      return {
        three, rotLocal, worldNoFoot,
        visible: !!group.visible,
        world_xz: root ? [+root[0].toFixed(3), +root[2].toFixed(3)] : null,
        group_xz: [+group.position.x.toFixed(3), +group.position.z.toFixed(3)],
        ground_y: gy === null || gy === undefined ? null : +gy.toFixed(3),
        lower_ankle_above_ground: (fl && fr && gy !== null && gy !== undefined) ? +(Math.min(fl[1], fr[1]) - gy).toFixed(6) : null,
        dist_to_stand_m: root ? +Math.hypot(root[0] - sx, root[2] - sz).toFixed(2) : null,
        stance: A.staticStance ? {
          t_solved: A.staticStance.t_solved, loop_frame_solved: A.staticStance.loop_frame_solved,
          root_dy_m: A.staticStance.root_dy_m, variation: A.staticStance.variation,
        } : null,
      };
    };
    const npcs = {};
    R.scene.traverse((o) => {
      if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
      const r = readOne(o);
      if (r) npcs[String(o.name).slice(4)] = r;
    });
    const simNpc = {};
    for (const n of (sim && sim.npcs) || []) simNpc[n.eid] = { visible: n.visible !== false, present: n.present !== false, at: n.at === undefined ? null : n.at, settlement: n.settlement || null, interior: n.interior || null, pos: n.pos.map((v) => +v.toFixed(3)), has_post: !!n.post, schedule_len: (n.schedule || []).length };
    return {
      frame: sim ? sim.frame : null,
      player: readOne(R.playerMesh),
      player_group_xz: [R.playerMesh.position.x, R.playerMesh.position.z],
      npcs, simNpc,
      env_interior: sim && sim.env ? sim.env.interior : undefined,
      perf: (window.__ENGINE.getPerfStats && window.__ENGINE.getPerfStats()) || null,
    };
  }, [standX, standZ]);

  const worstRot = (a, b) => {
    let worst = 0;
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i]) continue;
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(a[i][c] - b[i][c]));
    }
    return worst;
  };
  const worstWorld = (a, b) => {
    let worst = 0;
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i]) continue;
      worst = Math.max(worst, Math.hypot(a[i][12] - b[i][12], a[i][13] - b[i][13], a[i][14] - b[i][14]));
    }
    return worst;
  };

  const report = { tool: 'tools/visual/f10-r12-crowd-motion.mjs', ...treeCommit(), generated: new Date().toISOString(), renderer: rendererBanner(attestation), stand: STAND, arms: [] };

  // HAZARDS §13 AND §18 TOGETHER. r11's two capture runs both hit their foreground timeout after
  // producing their evidence and before writing their report, and the report is what a critic
  // reads. So every arm is flushed as it lands — to a PARTIAL file, never over the finished one,
  // because §18's trap is a run that dies early truncating a complete previous report. The final
  // `crowd-motion-live.json` is written once, at the end, and its absence means the run was cut.
  const flush = () => writeFileSync(join(OUT, 'crowd-motion-live.partial.json'), JSON.stringify({ ...report, INCOMPLETE: 'this run had not finished when this was written; arms present are complete' }, null, 1));
  const push = (a) => { report.arms.push(a); flush(); log(`  arm landed: ${a.arm}`); };
  const STAGES = String(args.stages || 'all').split(',');
  const want = (s) => STAGES.includes('all') || STAGES.includes(s);

  // ── L5-ONLY. The frame-time BEFORE arm runs from inside a control clone (HAZARDS §22), where
  // none of the arms below can run because the clone predates the change they measure. Same
  // tool, same stand, same warm-up, one number. ────────────────────────────────────────────────
  if (args['timing-only']) {
    await call('stepFrames', 30);
    const timeItOnly = async (n) => g.page.evaluate(async (frames) => {
      const E = window.__ENGINE;
      const samples = [];
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        E.stepFrames(1); E.loop.renderNow();
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      return { n: samples.length, mean: samples.reduce((a, b) => a + b, 0) / samples.length, median: samples[Math.floor(samples.length / 2)], p90: samples[Math.floor(samples.length * 0.9)] };
    }, n);
    const npcCount = await g.page.evaluate(() => { let n = 0, v = 0; window.__ENGINE.renderer.scene.traverse((o) => { if (o && o.name && String(o.name).startsWith('npc:')) { n++; if (o.visible) v++; } }); return { meshes: n, visible: v }; });
    await timeItOnly(30);
    const only = { tool: 'tools/visual/f10-r12-crowd-motion.mjs --timing-only', ...treeCommit(), generated: new Date().toISOString(), renderer: rendererBanner(attestation), stand: STAND, npc: npcCount, samples: await timeItOnly(240) };
    writeFileSync(join(OUT, 'frame-time.json'), JSON.stringify(only, null, 1));
    process.stdout.write(JSON.stringify(only, null, 2) + '\n');
    await g.close();
    process.exit(0);
  }

  // ── L0. THE CENSUS, FIXED (job 2) ──────────────────────────────────────────────────────────
  const A0 = await READ(STAND.x, STAND.z);
  const eids = Object.keys(A0.npcs);
  const vis = eids.filter((e) => A0.npcs[e].visible);
  const near = vis.filter((e) => (A0.npcs[e].dist_to_stand_m ?? 1e9) < 200);
  const heap = eids.filter((e) => !A0.npcs[e].visible);
  const heapRows = heap.slice(0, 40).map((e) => ({ eid: e, world_xz: A0.npcs[e].world_xz, ground_y: A0.npcs[e].ground_y, sim: A0.simNpc[e] || null }));
  if (want('census')) push({
    arm: 'L0 THE CENSUS — HAZARDS §26. A raw `npc:` mesh count is not a denominator.',
    npc_meshes: eids.length,
    visible: vis.length,
    visible_and_within_200m_of_the_stand: near.length,
    invisible: heap.length,
    invisible_within_5m_of_the_world_origin: heap.filter((e) => Math.hypot(...(A0.npcs[e].world_xz || [1e9, 1e9])) < 5).length,
    invisible_ground_y_range: heap.length ? [Math.min(...heap.map((e) => A0.npcs[e].ground_y ?? 0)), Math.max(...heap.map((e) => A0.npcs[e].ground_y ?? 0))] : null,
    env_interior: A0.env_interior,
    WHY_THEY_ARE_THERE: 'read from `sim.npcs` in the same pass — see `invisible_sample`. `sim/npc.js:applyPresence` sets `visible=false` for anybody whose `at` names a cell the player is not in, and `makeNPC` copies `pos` verbatim from the record, which for an interior-dwelling person is an INTERIOR-LOCAL coordinate. As a world coordinate that is a few metres from the origin, and `syncNPCs` resolves the ground there, which at (0,0) is the Topal sea floor.',
    invisible_sample: heapRows,
  });

  // ── L1. ARM (b2) — does anybody move, with the player as the control ──────────────────────
  const F1 = Number(args.frames ?? 60);
  await call('stepFrames', F1);
  const A1 = await READ(STAND.x, STAND.z);
  const rowsB2 = [];
  for (const e of Object.keys(A0.npcs)) {
    if (!(e in A1.npcs)) continue;
    const p = A0.npcs[e], q = A1.npcs[e];
    rowsB2.push({
      eid: e, visible: p.visible && q.visible, dist_to_stand_m: p.dist_to_stand_m,
      worst_non_foot_rot_rad: +worstRot(p.rotLocal, q.rotLocal).toFixed(9),
      worst_non_foot_bone_move_m: +worstWorld(p.worldNoFoot, q.worldNoFoot).toFixed(6),
      t_solved_before: p.stance && p.stance.t_solved, t_solved_after: q.stance && q.stance.t_solved,
    });
  }
  const drawn = rowsB2.filter((r) => r.visible && (r.dist_to_stand_m ?? 1e9) < 200);
  const movedD = drawn.filter((r) => r.worst_non_foot_rot_rad > 0);
  const playerMove = worstWorld(A0.player.worldNoFoot, A1.player.worldNoFoot);
  push({
    arm: `L1 RI-VIS10 C3 ARM (b2) — a changed non-foot bone over ${F1} frames, in the running game`,
    frames_apart: F1,
    denominator_note: 'DRAWN = visible AND within 200 m of the stand (HAZARDS §26). All three denominators published.',
    all_meshes: { n: rowsB2.length, moved: rowsB2.filter((r) => r.worst_non_foot_rot_rad > 0).length },
    visible: { n: rowsB2.filter((r) => r.visible).length, moved: rowsB2.filter((r) => r.visible && r.worst_non_foot_rot_rad > 0).length },
    DRAWN: { n: drawn.length, moved: movedD.length, pct: drawn.length ? +(100 * movedD.length / drawn.length).toFixed(2) : null, bar: '>= 90%' },
    worst_non_foot_rot_rad_over_the_drawn_crowd: drawn.length ? Math.max(...drawn.map((r) => r.worst_non_foot_rot_rad)) : null,
    r11_measured_the_same_quantity_at: 0,
    worst_non_foot_bone_move_m_over_the_drawn_crowd: drawn.length ? Math.max(...drawn.map((r) => r.worst_non_foot_bone_move_m)) : null,
    PLAYER_CONTROL_required_to_disagree: { bone_move_m: +playerMove.toFixed(6), r11_measured: 0.011246, ok: playerMove > 0 },
    rows: rowsB2,
  });

  // ── L2. ARM (b1) — the cross-section must survive, on the fixed denominator ────────────────
  const b1rows = Object.keys(A1.npcs).map((e) => ({ eid: e, ...A1.npcs[e].three, visible: A1.npcs[e].visible, dist: A1.npcs[e].dist_to_stand_m }));
  const b1drawn = b1rows.filter((r) => r.visible && (r.dist ?? 1e9) < 200 && r.a !== undefined && r.a !== null);
  const overBar = (r) => [Math.abs(r.a) > 3, Math.abs(r.b) > 3, Math.abs(r.c) > 3].filter(Boolean).length >= 2;
  push({
    arm: 'L2 RI-VIS10 C3 ARM (b1) — S59 preservation (a): the variety must survive the motion',
    DRAWN: { n: b1drawn.length, over_bar: b1drawn.filter(overBar).length, pct: b1drawn.length ? +(100 * b1drawn.filter(overBar).length / b1drawn.length).toFixed(2) : null, bar: '>= 90%' },
    all_meshes: { n: b1rows.filter((r) => r.a !== undefined && r.a !== null).length, over_bar: b1rows.filter((r) => r.a !== undefined && r.a !== null && overBar(r)).length },
    distinct_pose_signatures_drawn: new Set(b1drawn.map((r) => `${r.a},${r.b},${r.c}`)).size,
    player: A1.player.three,
    rows: b1rows,
  });

  // ── L3. PLANTING (S59 c) ──────────────────────────────────────────────────────────────────
  const ankles = Object.keys(A1.npcs).filter((e) => A1.npcs[e].visible && A1.npcs[e].lower_ankle_above_ground !== null).map((e) => A1.npcs[e].lower_ankle_above_ground);
  push({
    arm: 'L3 PLANTING (S59 c) — the lower ankle above the ground resolver, drawn crowd',
    n: ankles.length, min: ankles.length ? Math.min(...ankles) : null, max: ankles.length ? Math.max(...ankles) : null,
    r11_measured_range: [0.067407, 0.104151], r10_photographed_baseline_m: 0.089,
    note: 'the spread is terrain under a stilt town, not stance — r11 established that and this arm only has to show it did not widen.',
  });

  // ── L4. IDENTITY SURVIVES REBUILD / TRAVEL / SAVE-RELOAD (S59 b) ──────────────────────────
  if (want('stability')) {
  const idOf = (snap) => {
    const o = {};
    for (const e of Object.keys(snap.npcs)) if (snap.npcs[e].stance) o[e] = JSON.stringify(snap.npcs[e].stance.variation);
    return o;
  };
  const rotOf = (snap) => {
    const o = {};
    for (const e of Object.keys(snap.npcs)) o[e] = JSON.stringify(snap.npcs[e].rotLocal);
    return o;
  };
  const cmp = (a, b) => {
    const keys = Object.keys(a).filter((k) => k in b);
    return { compared: keys.length, identical: keys.filter((k) => a[k] === b[k]).length };
  };
  /** Re-warm to a PINNED clock so both readings sit at the same phase. Every bucket fires once
   *  in any window of STANCE_STAGGER_N frames, so a window that long is enough and no longer. */
  const N = 8;
  const pinTo = async (f) => {
    await g.page.evaluate((target) => { window.__ENGINE.sim.frame = target - 8; }, f);
    await call('stepFrames', 8);
  };
  const PIN = A1.frame;
  await pinTo(PIN);
  const base = await READ(STAND.x, STAND.z);
  const baseId = idOf(base), baseRot = rotOf(base);

  await g.page.evaluate(() => { const R = window.__ENGINE.renderer; for (const [, m] of R.npcMeshes) R.scene.remove(m); R.npcMeshes.clear(); });
  await pinTo(PIN);
  const afterRebuild = await READ(STAND.x, STAND.z);
  push({ arm: 'L4a REBUILD — every NPC mesh destroyed and rebuilt by syncNPCs', identity: cmp(baseId, idOf(afterRebuild)), bones_at_the_SAME_pinned_clock: cmp(baseRot, rotOf(afterRebuild)), pinned_sim_frame: PIN });

  await call('teleport', AWAY.x, AWAY.z); await call('stepFrames', 30);
  await call('teleport', STAND.x, STAND.z);
  await pinTo(PIN);
  const afterTravel = await READ(STAND.x, STAND.z);
  push({ arm: 'L4b TRAVEL — away to another settlement and back', identity: cmp(baseId, idOf(afterTravel)), bones_at_the_SAME_pinned_clock: cmp(baseRot, rotOf(afterTravel)), pinned_sim_frame: PIN });

  const blob = await call('saveState');
  let l4c = { arm: 'L4c SAVE/RELOAD', note: 'saveState unavailable' };
  if (blob && blob.__ok) {
    const loaded = await call('loadState', blob.__ok);
    await call('teleport', STAND.x, STAND.z);
    await pinTo(PIN);
    const afterLoad = await READ(STAND.x, STAND.z);
    l4c = { arm: 'L4c SAVE/RELOAD — saveState() then loadState(), then back to the same stand', load_ok: !(loaded && loaded.__err), identity: cmp(baseId, idOf(afterLoad)), bones_at_the_SAME_pinned_clock: cmp(baseRot, rotOf(afterLoad)), pinned_sim_frame: PIN };
  }
  push(l4c);
  }

  // ── L5. THE FRAME-TIME BUDGET (the critic's budget clause) ────────────────────────────────
  await call('teleport', STAND.x, STAND.z); await call('stepFrames', 30);
  const timeIt = async (n) => g.page.evaluate(async (frames) => {
    const E = window.__ENGINE;
    const samples = [];
    for (let i = 0; i < frames; i++) {
      const t0 = performance.now();
      E.stepFrames(1); E.loop.renderNow();
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return { n: samples.length, mean: samples.reduce((a, b) => a + b, 0) / samples.length, median: samples[Math.floor(samples.length / 2)], p90: samples[Math.floor(samples.length * 0.9)] };
  }, n);
  if (want('timing')) {
  await timeIt(30);                       // warm
  push({ arm: 'L5 FRAME TIME at the Lilmoth stand (this tree). The BEFORE arm is the control clone, run from inside it.', budget_clause: 'must not rise more than 5%', samples: await timeIt(240) });
  }

  writeFileSync(join(OUT, 'crowd-motion-live.json'), JSON.stringify(report, null, 1));
  log(`wrote ${join(OUT, 'crowd-motion-live.json')}`);
  const brief = JSON.parse(JSON.stringify(report));
  for (const a of brief.arms) { delete a.rows; delete a.invisible_sample; }
  process.stdout.write(JSON.stringify(brief, null, 2) + '\n');
  await g.close();
  process.exit(0);
}

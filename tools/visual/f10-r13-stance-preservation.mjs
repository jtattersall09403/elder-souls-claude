#!/usr/bin/env node
/**
 * f10-r13-stance-preservation.mjs — what round 13's bodies did to round 11's 408 stands.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: `f10-r12-crowd-motion.mjs --self-test` ARM 2 WENT RED ON THIS TREE
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * That arm re-derives round 11's banked 408 stance rows and requires every field of every row to
 * match. On round 13's tree it reports **268 of 408 mismatched**. That is a preservation signal
 * and it is reported as red rather than explained away — but a number is not a diagnosis, and
 * `HAZARDS §22`'s lesson is that agreement and disagreement are equally worth checking before
 * either is believed.
 *
 * TWO CANDIDATE CAUSES, AND THEY PREDICT DIFFERENT NUMBERS:
 *
 *   (i)  **The intended change.** Round 13 adds an AGE axis whose posture half
 *        (`actor.js:addCharacterPosture`) adds a forward spine curvature for characters that
 *        declare `morph.stoop > 0`. Those people's shoulder line, hip line and elbow difference
 *        legitimately move. That predicts a mismatch count equal to **the number of people whose
 *        own body carries a stoop** — which the body census puts at 73 of 408.
 *   (ii) **An instrument artefact.** `f10-r12-crowd-motion.mjs:165 makeProbeActor` builds ONE
 *        actor per family and re-names it for every row (`readAt` sets `g.name = name`). The
 *        body is built on the first pose and never rebuilt, so all 260 saxhleel rows are read on
 *        whichever single saxhleel body the probe happened to be dealt. That was harmless while
 *        the body could not affect the pose. It cannot be harmless now, and it predicts an
 *        all-or-nothing mismatch per family — 260, or 148, or 408, or 0.
 *
 * **This tool decides between them by giving every row ITS OWN body**, which is what
 * `renderer.js:syncNPCs` does — one actor per NPC, built from that NPC's race and eid. It then
 * runs the arm r12 wrote, unchanged in every other respect.
 *
 * THE CONTROL, AND IT IS REQUIRED TO DISAGREE: the same 408 rows re-derived with the age axis
 * neutralised — every actor forced onto a stoop-free archetype of its own family. If cause (i) is
 * right, that arm must return **0 mismatched**. If it does not, round 13 moved something it did
 * not intend to move and this file has to say so.
 *
 * Usage: node tools/visual/f10-r13-stance-preservation.mjs [--json=out.json]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const rig = new Rig(skel, hitgeo);

const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}
const DEG = 180 / Math.PI;
/** The SAME two objects `renderer.js:_anyStance` hands `poseStatic`, at clock `t`. */
function mkStance(t) {
  return { pose: clips.archetypes.idle_ready, loop: new LoopClip('idle', clips.archetypes.idle_loop, 96), t };
}
const interiorDeg = (a, b, c) => {
  if (!a || !b || !c) return 0;
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const du = Math.hypot(...u), dv = Math.hypot(...v);
  if (!du || !dv) return 0;
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (du * dv);
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
};

/** One person, on their OWN body, solved at clock `t`. `forceId` neutralises the age axis. */
function readOwn(row, t, forceId) {
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, row.family || 'saxhleel', forceId ? null : row.race);
  g.userData.actor.civilian = true;
  if (forceId) g.userData.actor.characterId = forceId;
  g.name = row.name;
  if (!actorMod.poseStatic(g, rig, [0, 0, 0], 0, undefined, mkStance(t))) return null;
  g.updateMatrixWorld(true);
  const A = g.userData.actor; const S = A.built;
  const at = (id) => { const i = S.index.get(id); if (i === undefined || !S.bones[i]) return null; const e = S.bones[i].matrixWorld.elements; return [e[12], e[13], e[14]]; };
  // THE SAME TWO DEFINITIONS r11 AND r12 USE, bone for bone and sign for sign
  // (`f10-r12-crowd-motion.mjs:115 lineTiltDeg`, and `upperarm_*` for the shoulder line, not the
  // clavicles). A comparison against a banked artifact is worth nothing if the estimator moved:
  // the first version of this file used the clavicles and the opposite sign and reported 408 of
  // 408 mismatched on BOTH arms including the control — which is what a broken estimator looks
  // like, and is why the control exists.
  const line = (L, R) => (!L || !R) ? 0 : Math.atan2(R[1] - L[1], Math.hypot(R[0] - L[0], R[2] - L[2])) * DEG;
  const r4 = (x) => +x.toFixed(4);
  return {
    a_shoulder_line_tilt_deg: r4(line(at('upperarm_l'), at('upperarm_r'))),
    b_hip_line_tilt_deg: r4(line(at('thigh_l'), at('thigh_r'))),
    c_elbow_difference_deg: r4(Math.abs(interiorDeg(at('upperarm_l'), at('lowerarm_l'), at('hand_l'))
      - interiorDeg(at('upperarm_r'), at('lowerarm_r'), at('hand_r')))),
    root_dy_m: +(A.staticStance ? A.staticStance.root_dy_m : 0).toFixed(6),
    mirror: A.staticStance.variation.mirror, depth: A.staticStance.variation.depth,
    loop_frame: A.staticStance.variation.loopFrame,
    characterId: A.characterId, stoop: Number((A.character && A.character.morph && A.character.morph.stoop) || 0),
  };
}

const R11 = JSON.parse(readFileSync(join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-F10-r11/crowd-stance.json'), 'utf8'));
const rows = R11.rows || [];

/** The comparison r12's arm 2 makes, field for field. `c_elbow_difference_deg` is compared as an
 *  absolute difference in r11's own rows, so it is recomputed the same way here. */
function compare(row, got) {
  if (!got) return { same: false, why: 'no solve' };
  const why = [];
  if (got.a_shoulder_line_tilt_deg !== row.a_shoulder_line_tilt_deg) why.push('shoulder');
  if (got.b_hip_line_tilt_deg !== row.b_hip_line_tilt_deg) why.push('hip');
  if (Math.abs(got.c_elbow_difference_deg - Math.abs(row.c_elbow_difference_deg)) > 1e-4) why.push('elbow');
  if (got.root_dy_m !== row.root_dy_m) why.push('root_dy');
  if (got.mirror !== row.mirror) why.push('mirror');
  if (got.depth !== row.depth) why.push('depth');
  if (got.loop_frame !== row.loop_frame) why.push('loop_frame');
  return { same: why.length === 0, why };
}

function run(forceStoopFree) {
  // The stoop-free archetype each family falls back to in the control arm. Both are shipped rows
  // that declare no `stoop`, so the control changes ONE axis and nothing else.
  const FREE = { saxhleel: 'sax.marsh-lean', humanoid: 'hum.dunmer-lean', undead: 'hum.drowned', beast: 'beast.slitherfang' };
  let matched = 0; const bad = [];
  const identityOnly = { matched: 0, bad: 0 };
  for (const row of rows) {
    const got = readOwn(row, 0, forceStoopFree ? (FREE[row.family] || FREE.humanoid) : null);
    const c = compare(row, got);
    if (c.same) matched++; else bad.push({ name: row.name, why: c.why, stoop: got ? got.stoop : null, characterId: got ? got.characterId : null });
    // The IDENTITY half of S59 clause (b) on its own: the hand a person is dealt, which round 13
    // must not touch at all whatever it does to their posture.
    if (got && got.mirror === row.mirror && got.depth === row.depth && got.loop_frame === row.loop_frame) identityOnly.matched++;
    else identityOnly.bad++;
  }
  const stooped = bad.filter((b) => b.stoop > 0.01).length;
  return {
    rows: rows.length, matched, mismatched: bad.length,
    mismatched_that_carry_a_stoop: stooped,
    mismatched_that_do_not: bad.length - stooped,
    identity_fields_matched: identityOnly.matched, identity_fields_mismatched: identityOnly.bad,
    reasons: bad.slice(0, 12),
  };
}

const shipped = run(false);
const control = run(true);
const out = {
  tool: 'f10-r13-stance-preservation.mjs', generated: new Date().toISOString(),
  artifact: 'corpus/90-verdicts/wave1/artifacts/W1-F10-r11/crowd-stance.json',
  method: 'every row solved on ITS OWN body through the shipped poseStatic, as renderer.js:syncNPCs does — NOT on one reused probe actor per family',
  shipped_tree: shipped,
  control_age_axis_neutralised: control,
  control_is_required_to_disagree: {
    ok: control.mismatched === 0 && shipped.mismatched > 0,
    reading: control.mismatched === 0
      ? 'the ENTIRE difference from round 11 is the age axis, and it is confined to the people who carry one'
      : 'round 13 moved something the age axis does not explain — see control_age_axis_neutralised.reasons',
  },
  note_on_the_r12_self_test: 'f10-r12-crowd-motion.mjs arm 2 reads every row on ONE reused probe actor per family (makeProbeActor at :165, readAt renaming it at :179). That was sound while the body could not reach the pose. It cannot be sound now, and its 268 is the probe body\'s stoop applied to every name rather than a measurement of 268 people. It is deliberately NOT edited here: a previous round\'s instrument going red on a later tree is evidence, and rewriting it would delete the evidence.',
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
process.exit(out.control_is_required_to_disagree.ok ? 0 : 1);

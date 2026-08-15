#!/usr/bin/env node
/**
 * f10-r11-crowd-stance.mjs — DOES EVERY PERSON IN BLACK MARSH STAND DIFFERENTLY, AND DOES THE
 * SAME PERSON STAND THE SAME WAY TWICE?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `W1-F10-r10-CRITIC` read `bone.matrixWorld` off the objects the renderer had drawn and found
 * **60 of 60 drawn NPCs at hip-line dy exactly 0.000000 m and shoulder-line dy exactly
 * 0.000000 m**, against the player's −0.018289 / +0.047948 in the same frame. It then amended
 * `RI-VIS10` C3 (ADD-only) so the check passes only if **both** arms pass: the player's three
 * numbers, **and** ≥ 90% of drawn NPCs showing ≥ 2 of 3 over 3°.
 *
 * **AND IT NAMED THE TRAP IN THE OBVIOUS FIX, WHICH IS THE WHOLE REASON THIS TOOL EXISTS:**
 * giving all 408 NPCs the *same* contrapposto satisfies arm (b) and produces 408 people standing
 * identically in a new way. `RI-VIS10` §F#6 is about a crowd not being copies. So this measures
 * three things that can each fail independently:
 *
 *   **A. REACH**  — does the stance arrive on the figures the player actually sees?
 *   **B. VARIETY** — are those figures in *different* stands, or one stand printed 408 times?
 *   **C. STABILITY** — does one person hold their stand, or shuffle between frames?
 *
 * C is the one nobody asks for and the one a viewer notices first: a crowd that re-rolls its
 * poses is a crowd of people twitching, which is worse than a crowd of statues.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * HOW IT MEASURES — through the shipped path, not a model of it
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * It imports `game/src/render/actor.js` and calls the real `makeRiggedActor` → `poseStatic`, with
 * the real `idle_ready` / `idle_loop` from `game/data/combat/clips.json`, and then reads the bone
 * matrices off the built object. Nothing here re-implements the pose composition; a test that
 * re-implements the thing it tests is testing its own re-implementation.
 *
 * The C3 quantities use the r9 critic's own definitions, copied verbatim from
 * `tools/visual/f10-r9c-c3-audit.mjs` lines 61-110 (`lineTiltDeg`, `interiorDeg`, and the same
 * bone pairs), so a number here and a number there are the same number.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE SELF-TEST ARMS, AND WHY EACH ONE IS SHAPED THE WAY IT IS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The r10 critic's own first instrument produced a FALSE CONFIRMATION of this very finding: it
 * hashed each bone's LOCAL quaternion, which `poseFromRig` never writes, and reported the player
 * and all 60 NPCs sharing one signature. Its arm 1 caught it. **The arms below are required to
 * disagree with each other** — every one of them has a partner that must come out the other way.
 *
 *   1. **BLINDNESS, the r10 shape.** The reader must separate a POSED actor from a REST one.
 *      `poseStatic` called WITHOUT the stance argument must read exactly 0.000000 on all three C3
 *      numbers; called WITH it, the same actor must read non-zero. If arm 1a is non-zero the
 *      reader is inventing signal; if arm 1b is zero the reader is blind. **This is the arm that
 *      would have caught the r10 critic's first tool** — a local-quaternion reader passes 1a and
 *      fails 1b, because the stance now lives in `bone.rotation` on the static path but does NOT
 *      on the player's path, so a reader that works for one is wrong for the other. Only a reader
 *      taken off `matrixWorld` answers both, and that is what this uses.
 *   2. **INJECTION.** A synthetic bone pair with a known y difference must come back with it, and
 *      a level pair must come back exactly 0 — a reader stuck at any constant fails one of the two.
 *   3. **SIGN.** Mirroring must flip the hip line's sign, not merely change it.
 *   4. **DETERMINISM.** The same name re-solved 64 times must give bit-identical Euler angles.
 *   5. **INDEPENDENCE.** Two different names must give different Euler angles — otherwise arm 4
 *      is satisfied by a constant.
 *   6. **PLANTING.** Every one of the 408 must end with its lower ankle within 0.05 mm of the
 *      REST pose's lower ankle once `root_dy_m` is applied. This is r10's hover, generalised: an
 *      authored constant compensates one stance at one depth, and there are now 408 of them.
 *   7. **PRESERVATION (S59).** The player's own C3 numbers, computed off `poseFromRig`'s
 *      arithmetic, must be BIT-IDENTICAL with and without this change — the static path must not
 *      have reached the combat path. Measured as: the stance archetype and loop are unmutated
 *      after 408 solves (a solver that scaled the shared archetype in place would pass every
 *      other arm and silently rewrite the player's stand).
 *
 * Usage:
 *   node tools/visual/f10-r11-crowd-stance.mjs --self-test
 *   node tools/visual/f10-r11-crowd-stance.mjs --json=out.json
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

// ── the r9 critic's own C3 definitions, copied verbatim so the numbers are comparable ────────
const DEG = 180 / Math.PI;
/** Signed elevation of the ray L→R above horizontal, degrees. Positive = R is higher than L. */
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

// ── arm 2 runs before any import: a pure reader over a synthetic bone set ────────────────────
function armInjection() {
  const known = lineTiltDeg([-0.1, 0.94, 0], [0.1, 0.94 + 0.02, 0]);
  const want = Math.atan2(0.02, 0.2) * DEG;
  const level = lineTiltDeg([-0.1, 0.94, 0], [0.1, 0.94, 0]);
  return [
    { arm: '2a the tilt reader returns an injected known angle', ok: Math.abs(known - want) < 1e-9, want: +want.toFixed(6), got: +known.toFixed(6) },
    { arm: '2b a level pair reads EXACTLY zero, so a non-zero reading is not the reader', ok: level === 0, got: level },
    { arm: '2c a straight arm reads 180 deg at the elbow (known off the geometry)', ok: Math.abs(interiorDeg([0, 1, 0], [0, 0.7, 0], [0, 0.4, 0]) - 180) < 1e-6, got: +interiorDeg([0, 1, 0], [0, 0.7, 0], [0, 0.4, 0]).toFixed(6) },
  ];
}

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

// The SAME two objects `renderer.js:_anyStance` hands down: the archetype and the LoopClip that
// `CombatBody.poseLocomotion` stands the player on. `moves.js:524` builds `_idle` at period 96.
const STANCE = { pose: clips.archetypes.idle_ready, loop: new LoopClip('idle', clips.archetypes.idle_loop, 96) };
/** A frozen deep copy, so arm 7 can prove 408 solves did not mutate the shared stance. */
const STANCE_FINGERPRINT = JSON.stringify(clips.archetypes.idle_ready) + '|' + JSON.stringify(clips.archetypes.idle_loop);

// One actor, built once, re-posed under a new identity each time. That isolates the POSE as the
// only variable — two people in different bodies would confound "the crowd varies" with "the
// bodies vary", which is E1's question and not C3's.
function makeProbeActor(family = 'saxhleel') {
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  g.userData.actor.civilian = true;
  return g;
}

/**
 * Pose one identity on the probe actor through the SHIPPED `poseStatic`, and read the C3
 * quantities off the bone matrices the renderer would have drawn.
 *
 * `stance` omitted reproduces the pre-round-11 behaviour exactly, which is arm 1a.
 */
function readIdentity(g, name, stance) {
  const A = g.userData.actor;
  A.staticStance = undefined;                    // re-deal this actor a new identity
  A.staticPresentationBound = false;
  // §11's shape, found in this tool by its own arm 8: `poseStatic` with no stance argument does
  // not TOUCH the bone rotations, so re-using one probe actor for both arms leaves the previous
  // row's stance standing and the BEFORE arm reads 392 distinct poses instead of 1. Not a defect
  // in the game — the shipped call passes the same argument every frame and an actor is built
  // fresh — but a fatal one in an instrument, so the two arms take two actors and this line is
  // the belt to that pair of braces.
  if (!stance) for (const b of A.built ? A.built.bones : []) if (b) b.rotation.set(0, 0, 0, 'XYZ');
  g.name = name;
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
  // Every bone's Euler, to 1e-6 deg — the POSE SIGNATURE. Two people with the same signature are
  // in literally the same stand. Read off `bone.rotation`, which on THIS path IS where the pose
  // lives (arm 1 is what proves that, rather than it being assumed).
  const euler = S.bones.map((b) => (b
    ? `${(b.rotation.x * DEG).toFixed(6)},${(b.rotation.y * DEG).toFixed(6)},${(b.rotation.z * DEG).toFixed(6)}`
    : 'x')).join('|');
  let h = 2166136261;
  for (let i = 0; i < euler.length; i++) { h ^= euler.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return {
    name,
    a_shoulder_line_tilt_deg: r4(lineTiltDeg(at('upperarm_l'), at('upperarm_r'))),
    b_hip_line_tilt_deg: r4(lineTiltDeg(at('thigh_l'), at('thigh_r'))),
    c_elbow_difference_deg: r4(Math.abs(eL - eR)),
    // The same two quantities the r10 critic published, in METRES, so its table and this one
    // can be laid side by side without a conversion nobody checked.
    hip_line_dy_m: +(at('thigh_l')[1] - at('thigh_r')[1]).toFixed(6),
    shoulder_line_dy_m: +(at('upperarm_l')[1] - at('upperarm_r')[1]).toFixed(6),
    foot_l_y: +at('foot_l')[1].toFixed(6),
    foot_r_y: +at('foot_r')[1].toFixed(6),
    lower_ankle_y: +Math.min(at('foot_l')[1], at('foot_r')[1]).toFixed(6),
    head_y: +at('head')[1].toFixed(6),
    root_dy_m: st ? st.root_dy_m : 0,
    authored_root_dy_m: st ? st.authored_root_dy_m : 0,
    rest_lower_ankle_m: st ? st.rest_lower_ankle_m : null,
    posed_lower_ankle_m: st ? st.posed_lower_ankle_m : null,
    mirror: st ? st.variation.mirror : null,
    depth: st ? st.variation.depth : null,
    loop_frame: st ? st.variation.loopFrame : null,
    euler_sig: (h >>> 0).toString(16),
    euler,
  };
}

const overCount = (r) => [
  Math.abs(r.a_shoulder_line_tilt_deg) > T,
  Math.abs(r.b_hip_line_tilt_deg) > T,
  Math.abs(r.c_elbow_difference_deg) > T,
].filter(Boolean).length;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST
// ═══════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const results = [...armInjection()];
  const g = makeProbeActor();

  // 1 — BLINDNESS, both directions.
  const rest = readIdentity(g, 'npc:probe-a', undefined);
  const posed = readIdentity(g, 'npc:probe-a', STANCE);
  results.push({
    arm: '1a poseStatic WITHOUT a stance reads EXACTLY 0.0000 on all three C3 numbers (pre-r11 behaviour, and a reader that invents signal fails here)',
    ok: rest && rest.a_shoulder_line_tilt_deg === 0 && rest.b_hip_line_tilt_deg === 0 && rest.c_elbow_difference_deg === 0,
    got: rest && [rest.a_shoulder_line_tilt_deg, rest.b_hip_line_tilt_deg, rest.c_elbow_difference_deg],
  });
  results.push({
    arm: '1b the SAME actor WITH a stance reads non-zero on at least 2 of 3 (a blind reader fails here)',
    ok: !!posed && overCount(posed) >= 2,
    got: posed && [posed.a_shoulder_line_tilt_deg, posed.b_hip_line_tilt_deg, posed.c_elbow_difference_deg],
  });

  // 3 — SIGN. Find one mirrored and one un-mirrored identity and require opposite hip signs.
  let mPos = null; let mNeg = null;
  for (let i = 0; i < 400 && !(mPos && mNeg); i++) {
    const r = readIdentity(g, `npc:sign-${i}`, STANCE);
    if (!r) continue;
    if (r.b_hip_line_tilt_deg > 0 && !mPos) mPos = r;
    if (r.b_hip_line_tilt_deg < 0 && !mNeg) mNeg = r;
  }
  results.push({
    arm: '3 the crowd contains BOTH hip-line signs — the mirror is a mirror and not a relabel',
    ok: !!(mPos && mNeg) && Math.sign(mPos.b_hip_line_tilt_deg) === -Math.sign(mNeg.b_hip_line_tilt_deg),
    plus: mPos && { name: mPos.name, hip: mPos.b_hip_line_tilt_deg, mirror: mPos.mirror },
    minus: mNeg && { name: mNeg.name, hip: mNeg.b_hip_line_tilt_deg, mirror: mNeg.mirror },
  });

  // 4 — DETERMINISM. 64 re-solves of one name, bit-identical.
  const base = readIdentity(g, 'npc:stable-one', STANCE);
  let allSame = true; let firstDiff = null;
  for (let i = 0; i < 64; i++) {
    const again = readIdentity(g, 'npc:stable-one', STANCE);
    if (again.euler !== base.euler || again.root_dy_m !== base.root_dy_m) { allSame = false; firstDiff = i; break; }
  }
  results.push({ arm: '4 sixty-four re-solves of ONE name give bit-identical Euler angles and root drop', ok: allSame, first_difference_at: firstDiff, sig: base.euler_sig });

  // 5 — INDEPENDENCE. Arm 4 alone is satisfied by a constant; this is its partner.
  const other = readIdentity(g, 'npc:stable-two', STANCE);
  results.push({ arm: '5 a DIFFERENT name gives a DIFFERENT pose (arm 4 is not satisfied by a constant)', ok: other.euler !== base.euler, sig_a: base.euler_sig, sig_b: other.euler_sig });

  // 6 — PLANTING, over the whole shipped population.
  let worstPlant = 0; let worstName = null;
  for (const n of records) {
    const r = readIdentity(g, `npc:${n.id}`, STANCE);
    if (!r) continue;
    const err = Math.abs((r.posed_lower_ankle_m + r.root_dy_m) - r.rest_lower_ankle_m);
    if (err > worstPlant) { worstPlant = err; worstName = r.name; }
  }
  results.push({
    arm: '6 all 408 land their lower ankle within 0.05 mm of the REST pose (r10 hover, generalised to 408 stances)',
    ok: worstPlant < 5e-5, worst_error_m: +worstPlant.toExponential(3), worst_name: worstName, n: records.length,
  });

  // 7 — PRESERVATION (S59). 408 solves must not have touched the shared stance data.
  const fpNow = JSON.stringify(clips.archetypes.idle_ready) + '|' + JSON.stringify(clips.archetypes.idle_loop);
  results.push({
    arm: '7 the shared idle_ready / idle_loop are byte-identical after 408 solves — the crowd cannot rewrite the player\'s stand',
    ok: fpNow === STANCE_FINGERPRINT,
  });

  // 8 — THE DEFECT ITSELF, REPRODUCED OFFLINE, AND THE CONTAMINATION GUARD IN ONE ARM.
  // The r10 critic measured 60 of 60 drawn NPCs at exactly 0.000000 in the running game. Offline,
  // over the whole 408, the BEFORE arm must therefore read exactly ONE distinct pose signature.
  // It also fails if the before arm has been contaminated by an after-arm run on the same actor,
  // which is how this arm earned its place: it went red and found exactly that.
  const gv = makeProbeActor();
  const beforeSigs = new Set();
  for (const n of records) { const r = readIdentity(gv, `npc:${n.id}`, undefined); if (r) beforeSigs.add(r.euler_sig); }
  results.push({
    arm: '8 WITHOUT the stance, all 408 read ONE identical pose signature — the r10 critic\'s 60-of-60 finding, reproduced offline over the whole population',
    ok: beforeSigs.size === 1, distinct_before: beforeSigs.size, n: records.length,
  });

  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r11-crowd-stance --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE LIVE ARM — RI-VIS10 C3 arm (b) as the amendment writes it, in the RUNNING GAME
// ═══════════════════════════════════════════════════════════════════════════════════════════
//
// WHY THIS EXISTS SEPARATELY FROM THE OFFLINE CENSUS BELOW. C3 arm (b) says *"the same three
// numbers measured on the **drawn NPCs** of the largest settlement"*. The offline census builds
// every one of the 408 records through the real `makeRiggedActor` → `poseStatic`, which is the
// right population but is not *drawn*: it does not prove `renderer.js` passes the stance, and
// `CLAUDE.md`'s own directive is that static inspection is not evidence. The r10 critic made
// exactly this distinction and it is the reason its finding stood up.
//
// AND WHY IT IS HERE RATHER THAN AS AN EDIT TO `f10-r10c-npc-live.mjs`. That is the r10 CRITIC's
// acceptance instrument. r10 refused to edit the r9 critic's audit tool for the same reason and
// the r10 critic said it was right to (S60): editing the instrument that judges you is
// metric-shopping. So the critic's tool runs UNMODIFIED as the anchor — it publishes hip and
// shoulder `dy` in metres and the pose signature — and this arm publishes the three C3 numbers in
// DEGREES plus the elbow difference, which its tool never carried. The two are laid side by side
// in the report and `live.anchor_agreement` requires them to agree on the metres.
//
// THE ANGLES ARE FRAME-INVARIANT AND THAT IS WHY THEY CAN BE READ IN WORLD SPACE. An NPC group
// carries a yaw about Y and a uniform `scale.setScalar(height_scale)`. Yaw preserves both the
// vertical difference and the horizontal run, so `atan2(dy, run)` is unchanged; a uniform scale
// multiplies both and cancels; and the elbow's interior angle is invariant under any similarity.
// Arm L1 below tests exactly this rather than trusting the argument: the same person is read in
// world space and in the actor's own frame and the three numbers must agree to 1e-4 deg.
if (args.live) {
  const OUT = resolve(ROOT, String(args.out || 'reports/visual-truth/f10-r11-crowd-stance-live'));
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
  // The r10 critic's own Lilmoth stand, so this is the same crowd its 60-of-60 was read from.
  const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047) };
  const where = await call('whereAmI');
  if (where && where.__ok && where.__ok.interior) await call('exitInterior');
  await call('teleport', STAND.x, STAND.z);
  await call('stepFrames', 14);

  const readFrame = () => g.page.evaluate(() => {
    const R = window.__ENGINE && window.__ENGINE.renderer;
    if (!R) return { error: 'no renderer' };
    const DEG = 180 / Math.PI;
    const tilt = (L, Rr) => Math.atan2(Rr[1] - L[1], Math.hypot(Rr[0] - L[0], Rr[2] - L[2])) * DEG;
    const interior = (A, B, C) => {
      const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
      const v = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
      const lu = Math.hypot(...u); const lv = Math.hypot(...v);
      if (!lu || !lv) return NaN;
      const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
      return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
    };
    const read = (group) => {
      const A = group && group.userData && group.userData.actor;
      if (!A || !A.built) return null;
      const S = A.built;
      group.updateMatrixWorld(true);
      const index = {}; if (S.index && S.index.forEach) S.index.forEach((v, k) => { index[k] = v; });
      const bones = S.bones || [];
      const w = (id) => { const i = index[id]; if (i === undefined || !bones[i]) return null; const e = bones[i].matrixWorld.elements; return [e[12], e[13], e[14]]; };
      // The same points expressed in the ACTOR's own frame — arm L1's counterpart reading.
      const inv = new (group.matrixWorld.constructor)().copy(group.matrixWorld).invert();
      const tmp = new (group.matrixWorld.constructor)();
      const l = (id) => { const i = index[id]; if (i === undefined || !bones[i]) return null; tmp.multiplyMatrices(inv, bones[i].matrixWorld); const e = tmp.elements; return [e[12], e[13], e[14]]; };
      const three = (f) => {
        const uL = f('upperarm_l'); const uR = f('upperarm_r');
        const tL = f('thigh_l'); const tR = f('thigh_r');
        if (!uL || !uR || !tL || !tR) return null;
        const eL = interior(f('upperarm_l'), f('lowerarm_l'), f('hand_l'));
        const eR = interior(f('upperarm_r'), f('lowerarm_r'), f('hand_r'));
        return { a: +tilt(uL, uR).toFixed(4), b: +tilt(tL, tR).toFixed(4), c: +Math.abs(eL - eR).toFixed(4) };
      };
      const World = three(w); const Local = three(l);
      if (!World) return null;
      // TWO signatures, and the difference between them is the whole of arm L2's diagnosis.
      //  • `pose_sig` — every bone, the r10 critic's own definition, so the two tools compare.
      //  • `stance_sig` — every bone EXCEPT `foot_l` / `foot_r`. Those two are the ONLY bones
      //    `poseStatic`'s terrain conform writes per frame (`actor.js`: `A.footConform` is built
      //    from exactly `['foot_l','foot_r']`), and it recomputes them from the terrain under the
      //    foot every frame — so a person who WALKS over uneven ground changes `pose_sig` while
      //    standing in an unchanged stance. Reported as two numbers rather than one, because
      //    collapsing them would either hide a real re-roll or invent one.
      const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
      const el = (b) => { tmp.multiplyMatrices(inv, b.matrixWorld); return Array.from(tmp.elements).map((n) => n.toFixed(4)).join(','); };
      const sig = bones.map((b) => (b ? el(b) : 'x')).join('|');
      const FEET = new Set([index.foot_l, index.foot_r]);
      const sigStance = bones.map((b, i) => (FEET.has(i) ? 'conform' : (b ? el(b) : 'x'))).join('|');
      const fl = w('foot_l'); const fr = w('foot_r');
      const gr = R.groundResolver ? R.groundResolver(group.position.x, group.position.z)
        : (R.groundAt ? R.groundAt(group.position.x, group.position.z, undefined, R.cell) : null);
      return {
        name: group.name,
        a_shoulder_line_tilt_deg: World.a, b_hip_line_tilt_deg: World.b, c_elbow_difference_deg: World.c,
        local_a: Local ? Local.a : null, local_b: Local ? Local.b : null, local_c: Local ? Local.c : null,
        hip_line_dy_m: +(w('thigh_l')[1] - w('thigh_r')[1]).toFixed(6),
        shoulder_line_dy_m: +(w('upperarm_l')[1] - w('upperarm_r')[1]).toFixed(6),
        lower_ankle_y: fl && fr ? +Math.min(fl[1], fr[1]).toFixed(6) : null,
        ground: (gr === null || gr === undefined) ? null : +gr.toFixed(6),
        group_y: +group.position.y.toFixed(6),
        group_xz: [+group.position.x.toFixed(4), +group.position.z.toFixed(4)],
        pose_sig: hash(sig),
        stance_sig: hash(sigStance),
        // Raw actor-frame matrices, full precision, so the node side can say WHICH bone moved and
        // by HOW MUCH rather than only that a hash changed. A hash tells you something differed
        // and nothing about whether it matters; this is the difference between "31 people
        // shuffled" and "31 people's ankles tracked the ground under them by 0.4 mm".
        bone_ids: Object.keys(index).sort((x, y) => index[x] - index[y]),
        bones_local: (() => { const a = []; for (const b of bones) { if (!b) { for (let k = 0; k < 16; k++) a.push(NaN); continue; } tmp.multiplyMatrices(inv, b.matrixWorld); for (let k = 0; k < 16; k++) a.push(tmp.elements[k]); } return a; })(),
      };
    };
    const out = { npcs: [], player: null };
    R.scene.traverse((o) => { if (o && o.name && o.name.startsWith('npc:')) { const r = read(o); if (r) out.npcs.push(r); } });
    const pm = R.playerMesh || null; if (pm) out.player = read(pm);
    return out;
  });

  const f1 = await readFrame();
  await call('stepFrames', 37);
  const f2 = await readFrame();
  await g.close();

  const rowsL = f1.npcs || [];
  const byName2 = new Map((f2.npcs || []).map((r) => [r.name, r]));
  const over = (r) => [Math.abs(r.a_shoulder_line_tilt_deg) > T, Math.abs(r.b_hip_line_tilt_deg) > T, Math.abs(r.c_elbow_difference_deg) > T].filter(Boolean).length;
  const ok2 = rowsL.filter((r) => over(r) >= 2).length;
  // L1 — frame invariance, measured rather than argued.
  const l1 = rowsL.every((r) => r.local_a !== null
    && Math.abs(r.local_a - r.a_shoulder_line_tilt_deg) < 1e-4
    && Math.abs(r.local_b - r.b_hip_line_tilt_deg) < 1e-4
    && Math.abs(r.local_c - r.c_elbow_difference_deg) < 1e-4);
  // L2 — STABILITY. The same person, 37 frames later, in a bit-identical stand.
  let shuffled = 0; let stanceShuffled = 0; let worstShift = 0; let movers = 0; let stationaryShuffled = 0;
  const boneDrift = new Map();
  for (const r of rowsL) {
    const s = byName2.get(r.name);
    if (!s) continue;
    const moved = Math.hypot(s.group_xz[0] - r.group_xz[0], s.group_xz[1] - r.group_xz[1]) > 1e-6;
    if (moved) movers++;
    if (s.pose_sig !== r.pose_sig) { shuffled++; if (!moved) stationaryShuffled++; }
    if (s.stance_sig !== r.stance_sig) stanceShuffled++;
    // WHICH bone, and by HOW MUCH — the arm that separates a re-roll from a conform.
    if (Array.isArray(r.bones_local) && Array.isArray(s.bones_local)) {
      const ids = r.bone_ids || [];
      for (let bi = 0; bi < ids.length; bi++) {
        let d = 0;
        for (let k = 0; k < 16; k++) {
          const u = r.bones_local[bi * 16 + k]; const v = s.bones_local[bi * 16 + k];
          if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
          d = Math.max(d, Math.abs(u - v));
        }
        const id = ids[bi];
        if (!boneDrift.has(id) || boneDrift.get(id) < d) boneDrift.set(id, d);
      }
    }
    worstShift = Math.max(worstShift, Math.abs(s.b_hip_line_tilt_deg - r.b_hip_line_tilt_deg),
      Math.abs(s.a_shoulder_line_tilt_deg - r.a_shoulder_line_tilt_deg),
      Math.abs(s.c_elbow_difference_deg - r.c_elbow_difference_deg));
  }
  // L3 — PLANTING, in the running game: the lower ankle above the ground under the person.
  const ankles = rowsL.filter((r) => r.lower_ankle_y !== null && r.ground !== null).map((r) => +(r.lower_ankle_y - r.ground).toFixed(6));
  const nonFootDrift = [...boneDrift.entries()].filter(([id]) => id !== 'foot_l' && id !== 'foot_r')
    .reduce((m, [, d]) => Math.max(m, d), 0);
  const rep = {
    tool: 'tools/visual/f10-r11-crowd-stance.mjs --live',
    generated: new Date().toISOString(),
    renderer: attestation,
    stand: STAND,
    n_drawn: rowsL.length,
    RI_VIS10_C3_arm_b: {
      bar: '>= 90% of DRAWN NPCs show >= 2 of 3 C3 numbers over 3 deg',
      n: rowsL.length, over2: ok2,
      pct: +(100 * ok2 / (rowsL.length || 1)).toFixed(2),
      pass: rowsL.length > 0 && ok2 / rowsL.length >= 0.9,
    },
    distinct_pose_signatures: new Set(rowsL.map((r) => r.pose_sig)).size,
    player: f1.player,
    arms: [
      { arm: 'L1 the three numbers are identical read in WORLD space and in the ACTOR frame (frame invariance, measured not argued)', ok: l1 },
      {
        // THE CRITERION IS THE PHYSICAL QUANTITY, NOT THE HASH, AND THAT IS A CORRECTION THIS RUN
        // FORCED. The first version of this arm failed on `stance_sig` and reported 31 of 60
        // people shuffling — while `worst_C3_shift_deg` read 0.000000, which is the tell that the
        // instrument and not the build was talking. The signature rounds `inverse(group) * bone`
        // to 4 dp, and that recomposition carries ~1e-12 m of float round-off, so a value sitting
        // on a rounding boundary flips the hash without anything moving. `worst_drift_per_bone_m`
        // settles it in one look: every bone except the two ankles drifts by ≤ 3e-12 m. So the
        // arm now passes when the STANCE bones are still to within a micron, and the hash counts
        // are still published beside it, because deleting the number that looked bad would be
        // exactly the move this project's doctrine exists to stop.
        arm: 'L2 STABILITY — every drawn person holds their STANCE 37 frames later: no non-foot bone drifts more than 1 micron (a crowd that re-rolls is worse than a crowd of statues)',
        ok: nonFootDrift < 1e-6,
        worst_non_foot_bone_drift_m: +nonFootDrift.toExponential(3),
        stance_sig_changed: stanceShuffled,
        worst_C3_shift_deg: +worstShift.toFixed(6),
        full_pose_sig_changed: shuffled,
        of_which_did_not_move: stationaryShuffled,
        people_who_moved: movers,
        worst_drift_per_bone_m: [...boneDrift.entries()].sort((a, b) => b[1] - a[1]).map(([id, d]) => [id, +d.toExponential(3)]),
        note: '`pose_sig` covers all 20 bones and therefore includes `foot_l`/`foot_r`, which `poseStatic` recomputes from the terrain under each foot EVERY frame. A walking person changes it without changing their stance. `worst_drift_per_bone_m` is the number that decides it: a genuine per-frame re-roll moves an upper-body bone by centimetres, a conform moves only the two ankles and only by the terrain difference under them.',
      },
      { arm: 'L3 PLANTING in the running game — lower ankle above the ground under each person', ok: ankles.length > 0, min_m: ankles.length ? Math.min(...ankles) : null, max_m: ankles.length ? Math.max(...ankles) : null },
    ],
    // The raw per-bone matrices are the input to L2's drift table and are not re-published: 60
    // people x 20 bones x 16 floats x 2 frames is 38,400 numbers whose only consumer is above.
    npcs: rowsL.map((r) => { const { bones_local, bone_ids, ...rest } = r; return rest; }),
  };
  writeFileSync(join(OUT, 'crowd-stance-live.json'), `${JSON.stringify(rep, null, 2)}\n`);
  console.log(JSON.stringify({ ...rep, npcs: `${rowsL.length} rows -> ${join(OUT, 'crowd-stance-live.json')}` }, null, 2));
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE CENSUS — all 408, the whole shipped population, not one settlement
// ═══════════════════════════════════════════════════════════════════════════════════════════
// TWO probe actors, one per arm. See the note inside `readIdentity`: sharing one leaked the
// previous row's stance into the BEFORE arm and made the pre-r11 crowd look varied.
const gBefore = makeProbeActor();
const gAfter = makeProbeActor();
const rows = [];
const before = [];
for (const n of records) {
  const nm = `npc:${n.id}`;
  const b = readIdentity(gBefore, nm, undefined);  // the pre-round-11 arm, same reader
  const a = readIdentity(gAfter, nm, STANCE);
  if (!a || !b) continue;
  rows.push({ ...a, settlement: n.settlement || null, race: n.race || null, actor: n.actor || null, family: artFamilyForRace(n.race) });
  before.push(b);
}

const sigs = new Map();
for (const r of rows) sigs.set(r.euler_sig, (sigs.get(r.euler_sig) || 0) + 1);
const modal = [...sigs.entries()].sort((x, y) => y[1] - x[1])[0] || [null, 0];
const sigsBefore = new Set(before.map((r) => r.euler_sig));

const over2 = rows.filter((r) => overCount(r) >= 2).length;
const over2Before = before.filter((r) => overCount(r) >= 2).length;
const nums = (k) => rows.map((r) => r[k]).sort((a, b) => a - b);
const stat = (k) => {
  const v = nums(k);
  const mean = v.reduce((s, x) => s + x, 0) / (v.length || 1);
  return {
    min: v[0], p25: v[Math.floor(v.length * 0.25)], median: v[Math.floor(v.length / 2)],
    p75: v[Math.floor(v.length * 0.75)], max: v[v.length - 1],
    mean: +mean.toFixed(6), distinct: new Set(v).size,
  };
};

const plantErr = rows.map((r) => Math.abs((r.posed_lower_ankle_m + r.root_dy_m) - r.rest_lower_ankle_m));
const authoredGap = rows.map((r) => Math.abs(r.root_dy_m - r.authored_root_dy_m));

// C3 arm (b), scored as the amendment writes it, on the WHOLE population rather than one stand.
const c3b = {
  bar: '>= 90% of drawn figures show >= 2 of 3 C3 numbers over 3 deg',
  n: rows.length,
  before: { over2: over2Before, pct: +(100 * over2Before / (rows.length || 1)).toFixed(2) },
  after: { over2, pct: +(100 * over2 / (rows.length || 1)).toFixed(2) },
  pass_after: over2 / (rows.length || 1) >= 0.9,
};

const out = {
  tool: 'tools/visual/f10-r11-crowd-stance.mjs',
  generated: new Date().toISOString(),
  what_this_arm_is: 'OFFLINE, over the WHOLE shipped population. The live browser arm (f10-r10c-npc-live.mjs, the r10 critic\'s own unmodified tool) covers one settlement\'s DRAWN figures and is what anchors this one.',
  population: {
    enumerating_command: 'readdirSync(game/data/npcs/*.json) -> flatten',
    files: files.length,
    records: records.length,
    posed: rows.length,
  },
  arms: {
    before: 'poseStatic(g, rig, pos, yaw, undefined, undefined) — identical to the shipped call before round 11',
    after: 'poseStatic(g, rig, pos, yaw, undefined, {pose: idle_ready, loop: LoopClip(idle_loop, 96)}) — identical to the shipped call after it',
    note: 'ONE actor object, re-dealt an identity per row, so the POSE is the only variable. Body identity is E1\'s question and is measured by f10-r10-crowd-draw.mjs.',
  },
  A_reach: {
    before_distinct_pose_signatures: sigsBefore.size,
    after_distinct_pose_signatures: sigs.size,
    after_modal_signature_count: modal[1],
    after_modal_share_pct: +(100 * modal[1] / (rows.length || 1)).toFixed(3),
  },
  B_variety: {
    a_shoulder_line_tilt_deg: stat('a_shoulder_line_tilt_deg'),
    b_hip_line_tilt_deg: stat('b_hip_line_tilt_deg'),
    c_elbow_difference_deg: stat('c_elbow_difference_deg'),
    hip_line_dy_m: stat('hip_line_dy_m'),
    shoulder_line_dy_m: stat('shoulder_line_dy_m'),
    head_y: stat('head_y'),
    weight_on_left_leg: rows.filter((r) => r.mirror).length,
    weight_on_right_leg: rows.filter((r) => !r.mirror).length,
    distinct_depths: new Set(rows.map((r) => r.depth)).size,
    distinct_loop_frames: new Set(rows.map((r) => r.loop_frame)).size,
    hip_sign_positive: rows.filter((r) => r.b_hip_line_tilt_deg > 0).length,
    hip_sign_negative: rows.filter((r) => r.b_hip_line_tilt_deg < 0).length,
  },
  C_planting: {
    what: 'lower ankle after root_dy vs the REST pose lower ankle — r10\'s hover, per individual',
    rest_lower_ankle_m: rows.length ? rows[0].rest_lower_ankle_m : null,
    worst_error_m: +Math.max(...plantErr).toExponential(3),
    mean_error_m: +(plantErr.reduce((s, x) => s + x, 0) / (plantErr.length || 1)).toExponential(3),
    lower_ankle_after_root: stat('lower_ankle_y'),
    root_dy_m: stat('root_dy_m'),
    authored_root_dy_m: stat('authored_root_dy_m'),
    numeric_vs_authored_gap_m: {
      max: +Math.max(...authoredGap).toExponential(3),
      mean: +(authoredGap.reduce((s, x) => s + x, 0) / (authoredGap.length || 1)).toExponential(3),
      why_they_differ: 'the authored constant is -0.00796 scaled by this person\'s depth; the numeric solve also absorbs the loop phase and the per-person variation. They agree to a tenth of a millimetre at depth 1.0 with no variation, which is what says the numeric solve is measuring the same thing.',
    },
  },
  RI_VIS10_C3_arm_b: c3b,
  rows: rows.map((r) => { const { euler, ...rest } = r; return rest; }),
};

const dest = args.json === true || !args.json ? null : resolve(ROOT, String(args.json));
if (dest) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`); }
console.log(JSON.stringify({ ...out, rows: `${out.rows.length} rows${dest ? ` written to ${args.json}` : ' (pass --json= to keep them)'}` }, null, 2));

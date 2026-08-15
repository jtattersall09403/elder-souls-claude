#!/usr/bin/env node
/**
 * f10-r7-appearance.mjs — photograph what round 7 changed, on hardware, in the running game.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS ON TRIAL, AND WHY THE SHOT LIST IS DIFFERENT FROM EVERY EARLIER ROUND'S
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r7.json` landed three changes and photographed none of them. Its
 * own first `what_i_could_not_do` says so: *"I TOOK NO HARDWARE FRAMES AND SO I CANNOT SAY IT
 * LOOKS BETTER."* This file takes those frames. The three claims and where each one is visible:
 *
 *  1. **NPC GROUND PLACEMENT.** At the Lilmoth stand, of 31 drawn NPCs, **12 were more than
 *     0.15 m underground (worst 2.31 m) and 15 were airborne (worst +35.39 m)**; after, 0 and 0.
 *     This is a CROWD effect, so it needs a WIDE frame, not a portrait — the slot `W` below, at
 *     three fixed vantages that do not depend on where anybody is standing, so the two arms get
 *     byte-comparable cameras.
 *
 *  2. **THE EYE**, re-derived as a fraction of each actor's own skin (sclera x0.136, iris x0.712
 *     linear) against a decoded reference plate. Visible only in a face close-up — slot `FA`.
 *
 *  3. **THE FOOT CONFORM**, which now reaches NPCs. Visible ONLY where the ground under one foot
 *     differs from the ground under the other, and round 7 measured that the three stands every
 *     earlier round used offer **at most 0.034 m** of that: *"a capture there is predetermined to
 *     be a null, whatever the GPU."* So slot `FS` shoots two stands found by
 *     `tools/visual/f10-r7a-slope-scan.mjs`, with **0.68 m and 0.24 m** of per-foot difference —
 *     20x and 7x the old stands — and the tool measures the difference again, live, at the actual
 *     foot-bone coordinates, and writes it into the manifest.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SUBJECTS ARE CHOSEN BY VARIANT, WHICH IS THE THING FOUR ROUNDS ASKED FOR AND NONE DID
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `f10-r5-appearance.mjs` picks the NPCs nearest three fixed stands. Both humanoids that happen
 * to stand near those stands hash to `hum.dunmer-lean`, so **`hum.imperial-clerk` has never been
 * in frame across four rounds**, and neither has most of the registry. `tools/visual/
 * f10-r7a-shotlist.mjs` re-derives `characterFor()`'s FNV-1a hash offline and finds **14 of the
 * 16 shipped variants within 60 m of the Lilmoth stand**. This tool reads each drawn NPC's own
 * `userData.actor.characterId` out of the live scene — the built truth, not a re-implementation —
 * and fills a variant quota from it. `selectByProximity()` still does the range filtering, because
 * `listEntities()` is not range-filtered and 148 of 229 NPCs sit 2.9-5.7 km from their stand.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO CAMERA RULES THAT DECIDE WHETHER THE PAIR IS COMPARABLE AT ALL
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * **Every camera in this tool is a pure function of a COORDINATE, never of where a character is
 * drawn.** The change under test MOVES characters by up to 35 m; a camera that follows the
 * subject would silently re-frame between arms and the pair would be measuring the camera.
 *
 * **A face close-up therefore has to be shot at both hypotheses.** For each face subject the tool
 * takes one frame aimed at `authored_y + 1.68` (where the BEFORE arm draws them) and one aimed at
 * `groundAt + 1.68` (where the AFTER arm draws them). In each arm one of the pair contains a face
 * and the other contains empty air or soil — which is itself the placement evidence — and the eye
 * ratio is measured WITHIN each arm's own good frame, so it never depends on the two arms framing
 * the same pixels.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE TRAPS THIS FILE IS BUILT NOT TO REPEAT
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  - **HAZARDS §16 — `setInput` is not a harness verb** and `call()` swallows the failure, so no
 *    capture in this project photographed a moving player until yesterday. Motion goes through
 *    `queueInputs` and every verb the claims depend on goes through `mustCall`, which records the
 *    failure loudly. The border-ring change rate is the check: ~0.2% means it never moved,
 *    ~42-71% means it walked.
 *  - **HAZARDS §16 — `gateBuffer` was called with argument names it does not have** (`{framing,
 *    canvas}` where it takes `{box, subject}`), so subject-presence never ran on any character
 *    frame. The real names are used here and `subject_box.from` is written into every row.
 *  - **HAZARDS §17 — a reused capture tool hard-codes its output path** and overwrites a filed
 *    verdict's artefacts. This tool has NO default under `corpus/`: `--out` is required for
 *    anything but a scratch run, and the default is `reports/`, which is gitignored.
 *
 * Usage:
 *   node tools/visual/f10-r7-appearance.mjs --tag after --gpu hardware --require-hardware \
 *        --out "$RUNPOD_ARTIFACT_DIR/after"
 *   node tools/visual/f10-r7-appearance.mjs --self-test          # no browser, no spend
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const FOV_DEG = 60;                                    // game/src/render/renderer.js
const SUBJECT_HEIGHT = 1.78;                           // game/data/combat/skeleton.json height_m
/** Regions on the body axis, in metres above the feet. skeleton.json offset chain. */
const REGION = {
  face: { centre_y: 1.68, box_m: 0.34, lateral: 0.00 },
  foot: { centre_y: 0.10, box_m: 0.34, lateral: 0.12 },
};

/**
 * THE STANDS. Every coordinate here was produced by a tool in this repo and the number beside it
 * is that tool's output, not an estimate.
 *
 * `crowd-lilmoth` is the centroid of the 49 posted NPCs within 60 m of the `char-player` stand
 * (`f10-r7a-shotlist.mjs`, x range 2724-2810, z range 5025-5070). The old `char-player` stand at
 * 2766,5011 is 38 m from the NEAREST of them, which is part of why four rounds of wide frames
 * showed so little.
 *
 * The two slope stands come from `f10-r7a-slope-scan.mjs --centre 2766,5011 --radius 300 --step 1`
 * over 361,201 points, ranked on the ground difference **between the actual foot bones** — not on
 * the largest difference in any direction, which is a different and useless number. The scan's
 * first version ranked the latter, picked 2978,4746 at 0.6811 m, and `--probe-only` stood the
 * player there and read **0.0258 m**: all of that 0.68 m ran north-south and the feet are separated
 * east-west. Both stands below were then re-probed live before a Pod was rented, and the
 * `expected_` numbers are the scan's prediction, kept so the manifest can be checked against them.
 *
 * `char-player` is kept in the slope list ON PURPOSE, as the null control: it is one of the three
 * stands every earlier round used, its per-foot difference measures 0.0000 m, and having it in the
 * same sheet is what turns "the feet look the same" from a result into a property of the stand.
 */
const STANDS = {
  crowd: { id: 'crowd-lilmoth', x: 2785.6, z: 5047.0 },
  player: { id: 'char-player', x: 2766, z: 5011, expected_per_foot_m: 0.0 },
  slopeStrong: { id: 'slope-strong', x: 3035, z: 4712, expected_per_foot_m: 0.4932, expected_slope_deg: 13.23 },
  slopeModerate: { id: 'slope-moderate', x: 3002, z: 4727, expected_per_foot_m: 0.2530, expected_slope_deg: 6.72 },
};

/**
 * THE VARIANT QUOTA. `hum.imperial-clerk` is first because it is the one the character directive's
 * own round-6 and round-7 notes say has never been photographed. The rest spread the two body
 * families and deliberately include `hum.dunmer-lean` — the variant every earlier round DID shoot —
 * so this round's faces can be compared with theirs.
 */
const VARIANT_QUOTA = [
  'hum.imperial-clerk',
  'hum.breton-stout',
  'hum.dunmer-lean',
  'sax.deep-warden',
  'sax.marsh-lean',
];

/** NDC -> pixels, and a box the liveness gate can actually use. Ported from f10-r5-appearance. */
export function boxFromProjection(bottom, top, lateralM, distM, CW, CH) {
  if (!bottom || !top || !bottom.ndc || !top.ndc) return null;
  const px = (ndc) => [(ndc[0] + 1) / 2 * CW, (1 - ndc[1]) / 2 * CH];
  const [bx, by] = px(bottom.ndc);
  const [tx, ty] = px(top.ndc);
  const halfH = Math.tan((FOV_DEG / 2) * Math.PI / 180) * distM;
  const halfW = halfH * (CW / CH);
  const wPx = Math.max(CW * 0.12, (Math.max(0.06, lateralM + 0.18) / halfW) * (CW / 2));
  const cx = (bx + tx) / 2;
  return {
    x0: Math.round(Math.max(0, cx - wPx)), x1: Math.round(Math.min(CW - 1, cx + wPx)),
    y0: Math.round(Math.max(0, Math.min(by, ty) - CH * 0.03)),
    y1: Math.round(Math.min(CH - 1, Math.max(by, ty) + CH * 0.03)),
  };
}

/**
 * Camera placement for a target point, a bearing and a pitch. Pure — it takes a coordinate, never
 * a character. See the header: a camera that follows a subject cannot compare two arms that move
 * the subject.
 */
export function poseFor(target, boxM, bearingDeg, fill, pitchDeg = 0) {
  const dist = boxM / (2 * fill * Math.tan((FOV_DEG / 2) * Math.PI / 180));
  const yaw = bearingDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  const eye = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] - Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  return { eye: eye.map((n) => +n.toFixed(3)), target: target.map((n) => +n.toFixed(3)), dist: +dist.toFixed(3), fill, bearing_deg: bearingDeg, pitch_deg: pitchDeg };
}

/** Camera for a wide vantage: an explicit eye offset from a ground point, looking at it. */
export function widePose(at, groundY, back, up, lookHeight, bearingDeg) {
  const yaw = bearingDeg * Math.PI / 180;
  return {
    eye: [+(at[0] + Math.sin(yaw) * back).toFixed(3), +(groundY + up).toFixed(3), +(at[1] + Math.cos(yaw) * back).toFixed(3)],
    target: [at[0], +(groundY + lookHeight).toFixed(3), at[1]],
    back_m: back, up_m: up, bearing_deg: bearingDeg,
  };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST. HAZARDS §0: the arms must be required to DISAGREE. Everything below is geometry that
// returns a plausible number when it is wrong, which is the class of defect that has cost this
// project three paid runs.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const fails = [];
  // A camera at bearing 0 must stand on +z from its target and look back along -z.
  const p0 = poseFor([0, 0, 0], 1.78, 0, 0.62, 0);
  if (!(p0.eye[2] > 0 && Math.abs(p0.eye[0]) < 1e-9)) fails.push(`bearing 0 must place the eye on +z, got ${JSON.stringify(p0.eye)}`);
  const p90 = poseFor([0, 0, 0], 1.78, 90, 0.62, 0);
  if (!(p90.eye[0] > 0 && Math.abs(p90.eye[2]) < 1e-9)) fails.push(`bearing 90 must place the eye on +x, got ${JSON.stringify(p90.eye)}`);
  // Fill must actually change the distance, and a bigger subject must need more room.
  const near = poseFor([0, 0, 0], 0.34, 0, 0.62).dist;
  const far = poseFor([0, 0, 0], 1.78, 0, 0.62).dist;
  if (!(far > near * 4)) fails.push(`a 1.78 m subject must sit much further back than a 0.34 m region: ${far} vs ${near}`);
  if (!(poseFor([0, 0, 0], 1.78, 0, 0.31).dist > far * 1.9)) fails.push('halving the fill must roughly double the distance');
  // A negative pitch must raise the eye above the target (looking DOWN).
  if (!(poseFor([0, 5, 0], 1.78, 0, 0.62, -30).eye[1] > 5)) fails.push('a negative pitch must put the eye above the target');
  // The wide pose must NOT depend on any subject, only on the coordinate it is given.
  const w1 = widePose([10, 20], 2.68, 40, 18, 1.6, 45);
  const w2 = widePose([10, 20], 2.68, 40, 18, 1.6, 45);
  if (JSON.stringify(w1) !== JSON.stringify(w2)) fails.push('widePose is not deterministic');
  if (!(w1.eye[1] === 20.68)) fails.push(`widePose up must be ground+up, got ${w1.eye[1]}`);
  // The box projector must reject a missing projection rather than invent a box — the failure
  // that let 17 of 93 frames contain no subject while the tool reported 0 red.
  if (boxFromProjection(null, { ndc: [0, 0] }, 0.3, 5, 960, 540) !== null) fails.push('a missing projection must return null, not a box');
  const box = boxFromProjection({ ndc: [0, -0.5] }, { ndc: [0, 0.5] }, 0.3, 5, 960, 540);
  if (!(box && box.y0 < box.y1 && box.x0 < box.x1)) fails.push(`a real projection must return an ordered box, got ${JSON.stringify(box)}`);
  // And the one that matters: two DIFFERENT projections must give different boxes. A projector
  // that returns the same box for everything passes every test above.
  const box2 = boxFromProjection({ ndc: [0.6, -0.2] }, { ndc: [0.6, 0.2] }, 0.3, 5, 960, 540);
  if (box2.x0 === box.x0) fails.push('boxFromProjection ignores the horizontal position of its input');
  console.log(fails.length ? `SELF-TEST FAILED\n  ${fails.join('\n  ')}`
    : 'SELF-TEST PASSED — 10 checks, arms required to disagree');
  process.exit(fails.length ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
const { launchForCapture, resolveGpuMode } = await import('./lib/gpu-launch.mjs');
const { manifestRendererFields, rendererBanner } = await import('./lib/renderer-class.mjs');
const { selectByProximity, sourceMatchesR3 } = await import('./lib/subject-proximity.mjs');

const TAG = String(args.tag || 'f10-r7');
// NO DEFAULT UNDER corpus/. HAZARDS §17: a reused tool with a hard-coded artefact path overwrote
// three filed verdicts' evidence today. `reports/` is gitignored and disposable.
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-r7-appearance/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260815);
const SETTLE = Number(args.settle || 12);
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;
const MAX_OFFSET_M = Number(args['max-offset'] || 90);
const MOTION_SHOTS = Number(args['motion-shots'] || 16);
const MOTION_STEP = Number(args['motion-step'] || 4);
const MOTION_STICK = Number(args['motion-stick'] || 0.55);   // engine.js: 0.55 is the walk ceiling
const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const log = (...m) => { process.stdout.write(`${m.join(' ')}\n`); };

const PROXIMITY_DRIFT = sourceMatchesR3(fs, path, REPO);
log(`TOOL f10-r7-appearance  out=${OUT}  selectByProximity identical to the r3 copy: ${PROXIMITY_DRIFT.identical}`);

const { g, attestation } = await launchForCapture({
  mode: GPU_MODE, requireHardware: REQUIRE_HARDWARE, entry: 'game/index.html', width: CW, height: CH,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
log(rendererBanner(attestation));

const call = async (m, ...a) => {
  try {
    const res = await g.page.evaluate(async ({ method, callArgs }) => {
      const H = window.__HARNESS;
      if (!H) return { __err: 'window.__HARNESS is not defined' };
      if (typeof H[method] !== 'function') return { __err: `window.__HARNESS.${method} is not a function` };
      try { return { __ok: await H[method](...callArgs) }; }
      catch (e) { return { __err: `${method}() threw: ${e && e.message || e}` }; }
    }, { method: m, callArgs: a });
    if (res && res.__err) return { ok: false, e: String(res.__err).split('\n')[0].slice(0, 240) };
    return { ok: true, v: res ? res.__ok : undefined };
  } catch (e) { return { ok: false, e: `evaluate failed: ${String(e.message).split('\n')[0].slice(0, 200)}` }; }
};

/** A verb whose failure would void a claim. HAZARDS §16 — `call()` swallows a missing method. */
const hardCalls = [];
const mustCall = async (m, ...a) => {
  const r = await call(m, ...a);
  hardCalls.push({ verb: m, ok: r.ok, error: r.ok ? null : r.e });
  if (!r.ok) log(`  HARD-CALL FAILED  ${m}: ${r.e}`);
  return r;
};

const rows = [];
let liveness = null;
try { liveness = await import('./frame-liveness.mjs'); } catch (e) { liveness = null; log(`frame-liveness unavailable: ${e.message}`); }

async function shoot(file, meta, { box = null, subject = false } = {}) {
  const shot = await call('screenshot');
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); log(`  RED ${file}: ${shot.e}`); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  let gate = null;
  if (liveness && typeof liveness.gateBuffer === 'function') {
    // THE CORRECT PARAMETER NAMES (HAZARDS §16). `{framing, canvas}` are ignored by this function
    // and every F10 frame before yesterday was gated with box=null and subject=false.
    try { gate = liveness.gateBuffer(buf, { box, subject, label: file, throwOnDegenerate: false }); }
    catch (e) { gate = { verdict: 'GATE_THREW', why: [String(e.message).slice(0, 200)] }; }
  }
  rows.push({ file, status: 'ok', bytes: buf.length, hash, liveness: gate, subject_box: box, gated_subject: subject, ...meta });
  return hash;
}

async function setCamera(pose) {
  const r = await call('camera', { pos: pose.eye, look: pose.target });
  return { ...pose, camera_ok: r.ok, camera_error: r.e || null };
}

async function projectBox(target, boxM, lateral, dist) {
  const half = boxM / 2;
  const lo = await call('projectPoint', target[0], target[1] - half, target[2]);
  const hi = await call('projectPoint', target[0], target[1] + half, target[2]);
  const raw = { bottom: lo.ok ? lo.v : null, top: hi.ok ? hi.v : null };
  return { raw, box: boxFromProjection(raw.bottom, raw.top, lateral, dist, CW, CH) };
}

async function goTo(x, z) {
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  const r = await call('teleport', x, z);
  if (!r.ok) return `teleport(${x},${z}) refused: ${r.e}`;
  await call('stepFrames', SETTLE);
  return null;
}

/**
 * READ THE SCENE ITSELF, not a re-implementation of it.
 *
 * Every number here comes out of the live renderer: the drawn Y is the actual group transform,
 * the variant is the `characterId` `ensureBuilt()` stamped, and the ground is
 * `renderer.groundResolver` — the same function the placement and the conform read. This is what
 * makes the wide frames captionable: the picture and the census are the same frame.
 */
async function sceneCensus() {
  return g.page.evaluate(() => {
    const E = window.__ENGINE, R = E.renderer, S = E.sim;
    const ground = (x, z) => (R.groundResolver ? R.groundResolver(x, z) : R.groundAt(x, z, undefined, R.cell));
    const out = { cell: R.cell, npcs: [], player: null };
    const p = S.player;
    if (p) out.player = { pos: p.pos.map((n) => +n.toFixed(3)), ground: +ground(p.pos[0], p.pos[2]).toFixed(3) };
    for (const n of (S.npcs || [])) {
      const mesh = R.npcMeshes && R.npcMeshes.get(n.eid);
      if (!mesh) continue;
      const A = mesh.userData.actor || {};
      const gy = ground(n.pos[0], n.pos[2]);
      out.npcs.push({
        eid: n.eid, name: n.name, race: n.race,
        variant: A.characterId || null, family: A.artFamily || null,
        visible: mesh.visible !== false,
        record_y: +n.pos[1].toFixed(3),
        drawn_y: +mesh.position.y.toFixed(3),
        ground_y: +gy.toFixed(3),
        record_error_m: +(n.pos[1] - gy).toFixed(3),
        drawn_error_m: +(mesh.position.y - gy).toFixed(3),
        x: +n.pos[0].toFixed(2), z: +n.pos[2].toFixed(2),
      });
    }
    return out;
  });
}

/** The per-foot ground difference AT THE ACTUAL FOOT BONES — the number the brief asks be stated. */
async function footGroundSpread() {
  return g.page.evaluate(() => {
    const E = window.__ENGINE, R = E.renderer;
    const ground = (x, z) => (R.groundResolver ? R.groundResolver(x, z) : R.groundAt(x, z, undefined, R.cell));
    const mesh = R.playerMesh;
    const A = mesh && mesh.userData && mesh.userData.actor;
    const built = A && A.built;
    // `buildSkeleton()` returns `{ group, bones, index, ... }` (actor.js:899) and `index` is a Map
    // from bone id to array position — the same accessor `f10-r7-ground-truth.mjs` M3 uses. Reading
    // it by name-substring instead would silently match the wrong bone on a renamed rig.
    if (!built || !built.index) return { error: 'player has no built skeleton' };
    const bone = (id) => { const i = built.index.get(id); return i === undefined ? null : built.bones[i]; };
    const fl = bone('foot_l'), fr = bone('foot_r');
    if (!fl || !fr) return { error: `foot_l/foot_r not in the bone index (${built.bones.length} bones)` };
    const wl = fl.matrixWorld.elements, wr = fr.matrixWorld.elements;
    const gl = ground(wl[12], wl[14]), gr = ground(wr[12], wr[14]);
    return {
      foot_l: { x: +wl[12].toFixed(3), y: +wl[13].toFixed(4), z: +wl[14].toFixed(3), ground: +gl.toFixed(4) },
      foot_r: { x: +wr[12].toFixed(3), y: +wr[13].toFixed(4), z: +wr[14].toFixed(3), ground: +gr.toFixed(4) },
      stance_m: +Math.hypot(wl[12] - wr[12], wl[14] - wr[14]).toFixed(4),
      per_foot_ground_difference_m: +Math.abs(gl - gr).toFixed(4),
      per_foot_drawn_difference_m: +Math.abs(wl[13] - wr[13]).toFixed(4),
      rigged: !!A.rigged,
    };
  });
}

await mustCall('setUIVisible', false);
await mustCall('setTimeOfDay', 13);
await mustCall('setWeather', 'clear');

/**
 * `--probe-only` — every scene READER this tool depends on, run against the live game, with no
 * screenshots taken and no Pod rented. It exists because the expensive failures on this project
 * are not bad frames, they are tools that ran, reported success and read the wrong thing: a census
 * pointed one layer away from the change, a gate called with argument names it does not have, a
 * ray that hit the player's own chest. Those are all readable in a few seconds locally on
 * SwiftShader, where a full capture costs ~45 s per frame and an hour of wall clock.
 */
if (args['probe-only']) {
  const probe = { tool: 'f10-r7-appearance --probe-only', generated: new Date().toISOString(), stands: {}, aborted: null };
  // WRITE WHAT IT GOT, EVEN IF IT DIES. The first run of this probe was killed by its own
  // `timeout` while teleporting between stands and left NOTHING on disk, although the crowd census
  // had already completed — the same shape as r7's own aborted ground-truth run. An honest partial
  // result is worth more than a clean nothing (HAZARDS §13), so the write is in a `finally`.
  try {
  const err0 = await goTo(STANDS.crowd.x, STANDS.crowd.z);
  probe.crowd = err0 ? { error: err0 } : await sceneCensus();
  if (!err0) {
    const drawn = probe.crowd.npcs.filter((n) => n.visible);
    probe.crowd_summary = {
      meshes: probe.crowd.npcs.length, visible: drawn.length,
      drawn_buried: drawn.filter((n) => n.drawn_error_m < -0.15).length,
      drawn_airborne: drawn.filter((n) => n.drawn_error_m > 0.15).length,
      record_buried: drawn.filter((n) => n.record_error_m < -0.15).length,
      record_airborne: drawn.filter((n) => n.record_error_m > 0.15).length,
      worst_drawn_m: drawn.length ? Math.max(...drawn.map((n) => Math.abs(n.drawn_error_m))) : null,
      worst_record_m: drawn.length ? Math.max(...drawn.map((n) => Math.abs(n.record_error_m))) : null,
      variants: [...new Set(drawn.map((n) => n.variant))].sort(),
    };
    log(`crowd: ${probe.crowd_summary.visible} visible; AS DRAWN ${probe.crowd_summary.drawn_buried} buried / `
      + `${probe.crowd_summary.drawn_airborne} airborne (worst |${probe.crowd_summary.worst_drawn_m}| m); `
      + `BY RECORD ${probe.crowd_summary.record_buried} / ${probe.crowd_summary.record_airborne} (worst |${probe.crowd_summary.worst_record_m}| m)`);
    log(`variants drawn here: ${probe.crowd_summary.variants.join(', ')}`);
  }
  for (const stand of [STANDS.slopeStrong, STANDS.slopeModerate, STANDS.player]) {
    const err = await goTo(stand.x, stand.z);
    if (err) { probe.stands[stand.id] = { error: err }; log(`RED ${stand.id}: ${err}`); continue; }
    const snap = await call('snapshot');
    const feet = await footGroundSpread();
    probe.stands[stand.id] = { x: stand.x, z: stand.z, expected_per_foot_m: stand.expected_per_foot_m ?? null, player_pos: snap.ok && snap.v.player ? snap.v.player.pos : null, feet };
    log(`${stand.id}: per-foot GROUND difference at the bones ${feet.per_foot_ground_difference_m ?? feet.error} m `
      + `(scan predicted ${stand.expected_per_foot_m ?? 'n/a'}), stance ${feet.stance_m ?? '?'} m, `
      + `drawn foot height difference ${feet.per_foot_drawn_difference_m ?? '?'} m, rigged=${feet.rigged}`);
  }
  } catch (e) {
    probe.aborted = String((e && e.message) || e).split('\n')[0].slice(0, 240);
    log(`ABORTED: ${probe.aborted}`);
  } finally {
    fs.writeFileSync(path.join(OUT, 'probe.json'), `${JSON.stringify(probe, null, 2)}\n`);
    log(`\nwrote ${path.join(OUT, 'probe.json')}${probe.aborted ? ' (PARTIAL — see `aborted`)' : ''}`);
    await g.close?.().catch(() => {});
  }
  process.exit(probe.aborted ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// W — THE CROWD. Three fixed vantages over the Lilmoth crowd centroid. The cameras are computed
// from a coordinate and a constant, so the two arms get identical eyes and identical targets, and
// anything that differs between the frames is the world.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const censuses = {};
const wideErr = await goTo(STANDS.crowd.x, STANDS.crowd.z);
if (wideErr) log(`RED crowd stand: ${wideErr}`);
else {
  const c = await sceneCensus();
  censuses.crowd = c;
  const drawn = c.npcs.filter((n) => n.visible);
  const buried = drawn.filter((n) => n.drawn_error_m < -0.15);
  const air = drawn.filter((n) => n.drawn_error_m > 0.15);
  log(`crowd stand: ${c.npcs.length} npc meshes, ${drawn.length} visible; AS DRAWN ${buried.length} buried, ${air.length} airborne`
    + `  (BY RECORD ${drawn.filter((n) => n.record_error_m < -0.15).length} / ${drawn.filter((n) => n.record_error_m > 0.15).length})`);

  /**
   * THE ANCHOR, AND WHY IT IS ALLOWED TO COME FROM THE LIVE SCENE.
   *
   * A first version of this tool anchored the wide frames on a centroid computed offline from the
   * NPC data files, and the frames came back with nobody in them — the posted records nearest that
   * point are 38 m away and behind buildings. So the anchor is taken from the running game instead.
   *
   * That is only safe because it uses **x and z, which round 7 does not touch.** The status file is
   * explicit: *"`n.pos` — what the stealth cones, `world-collision.js` and the sim read — is not
   * touched"*; only the DRAWN y moves. So this anchor is identical in both arms by construction,
   * and `f10-r7-appearance-read.mjs` checks that it came out identical rather than assuming it.
   * Anchoring on the drawn y would have been the trap: the camera would follow the defect.
   */
  const near = drawn.filter((n) => Math.hypot(n.x - STANDS.crowd.x, n.z - STANDS.crowd.z) <= 45)
    .sort((a, b) => Math.hypot(a.x - STANDS.crowd.x, a.z - STANDS.crowd.z) - Math.hypot(b.x - STANDS.crowd.x, b.z - STANDS.crowd.z));
  const cluster = near.slice(0, 14);
  const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? +(s[Math.floor(s.length / 2)]).toFixed(2) : null; };
  const ax = cluster.length ? med(cluster.map((n) => n.x)) : STANDS.crowd.x;
  const az = cluster.length ? med(cluster.map((n) => n.z)) : STANDS.crowd.z;
  const gy = cluster.length ? med(cluster.map((n) => n.ground_y)) : (c.player ? c.player.ground : 2.68);
  const anchor = { x: ax, z: az, ground_y: gy, cluster_size: cluster.length, from: 'median x/z/ground of the 14 drawn NPCs nearest the crowd stand — all three untouched by round 7' };
  censuses.crowd_anchor = anchor;
  log(`crowd anchor ${ax},${az} ground ${gy} from ${cluster.length} nearest drawn NPCs`
    + ` (nearest ${near.length ? Math.hypot(near[0].x - STANDS.crowd.x, near[0].z - STANDS.crowd.z).toFixed(1) : '?'} m from the stand)`);

  // Close enough that a 1.78 m person is a readable fraction of frame height: at 16 m a whole
  // figure is ~10% of frame height, at 26 m ~6%. The two raised vantages exist for the AIRBORNE
  // half of the defect — a person 4.7 m up leaves a street-level frame, and round 7 measured one
  // at +35.39 m, which needs the `sky` vantage or it is simply off the top of every picture.
  const vantages = [
    { id: 'close-b000', pose: widePose([ax, az], gy, 16, 1.75, 1.40, 0) },
    { id: 'close-b090', pose: widePose([ax, az], gy, 16, 1.75, 1.40, 90) },
    { id: 'close-b180', pose: widePose([ax, az], gy, 16, 1.75, 1.40, 180) },
    { id: 'close-b270', pose: widePose([ax, az], gy, 16, 1.75, 1.40, 270) },
    { id: 'mid-b045', pose: widePose([ax, az], gy, 26, 4.0, 1.40, 45) },
    { id: 'raised-b045', pose: widePose([ax, az], gy, 30, 14, 1.20, 45) },
    { id: 'sky-b045', pose: widePose([ax, az], gy, 52, 40, 1.20, 45) },
  ];
  for (const v of vantages) {
    const pose = await setCamera(v.pose);
    await call('stepFrames', 3);
    // subject:false, and the reason is written down rather than left as a flag. The gate's subject
    // test models ONE figure against a background; a 60 m street with 30 people in it fails that
    // model whether or not anybody is there. The census above is this slot's subject check, and it
    // is a stronger one — it names each person and says where they are drawn.
    await shoot(`W__${v.id}.png`, {
      slot: 'W', vantage: v.id, pose, anchor,
      npcs_visible: drawn.length,
      drawn_buried: buried.length, drawn_airborne: air.length,
      record_buried: drawn.filter((n) => n.record_error_m < -0.15).length,
      record_airborne: drawn.filter((n) => n.record_error_m > 0.15).length,
      subject_gate_note: 'subject:false deliberately — this is a crowd frame, and the scene census in the manifest is its presence check',
    }, { box: null, subject: false });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SUBJECTS, BY VARIANT. The live scene's own `characterId` decides, and `selectByProximity` does
// the range filtering `listEntities()` does not.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const subjects = [];
const selection = { quota: VARIANT_QUOTA, filled: {}, missing: [], pool_size: 0, proximity: null };
{
  const ents = await call('listEntities');
  const npcs = ((ents.ok ? ents.v : []) || []).filter((e) => String(e.kind || '').toLowerCase() === 'npc');
  const sel = selectByProximity(npcs, STANDS.crowd, MAX_OFFSET_M);
  selection.proximity = { enumerated: npcs.length, kept: sel.kept.length, rejected: sel.rejected.length, distances: sel.distances };
  const byEid = new Map((censuses.crowd ? censuses.crowd.npcs : []).map((n) => [n.eid, n]));
  const pool = sel.kept.map((e) => ({ ...e, census: byEid.get(e.eid) })).filter((e) => e.census && e.census.variant);
  selection.pool_size = pool.length;
  for (const want of VARIANT_QUOTA) {
    const hit = pool.filter((e) => e.census.variant === want).sort((a, b) => a.offset_m - b.offset_m)[0];
    if (!hit) { selection.missing.push(want); continue; }
    selection.filled[want] = hit.eid;
    subjects.push({
      id: `npc-${String(hit.eid).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`,
      kind: 'npc', eid: hit.eid, label: hit.name, race: hit.census.race, variant: want,
      family: hit.census.family, x: hit.census.x, z: hit.census.z,
      record_y: hit.census.record_y, ground_y: hit.census.ground_y,
      ground_error_m: hit.census.record_error_m, offset_m: +hit.offset_m.toFixed(1),
    });
  }
  log(`variant quota: filled ${Object.keys(selection.filled).length}/${VARIANT_QUOTA.length} from a pool of ${pool.length}`
    + `${selection.missing.length ? `; MISSING ${selection.missing.join(', ')}` : ''}`);
  for (const s of subjects) log(`  ${s.variant.padEnd(20)} ${s.eid} (${s.race}, ${s.offset_m} m, record error ${s.ground_error_m} m)`);
}
fs.writeFileSync(path.join(OUT, 'subjects.json'), `${JSON.stringify({ subjects, selection }, null, 2)}\n`);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FA — FACES, BOTH HYPOTHESES. See the header: the change under test moves these people, so each
// face is shot once where the BEFORE arm draws them and once where the AFTER arm draws them.
// ══════════════════════════════════════════════════════════════════════════════════════════════
for (const s of subjects) {
  const err = await goTo(s.x, s.z);
  if (err) { rows.push({ subject: s.id, status: 'red', reason: err }); log(`RED ${s.id}: ${err}`); continue; }
  for (const [aimId, baseY] of [['ground', s.ground_y], ['record', s.record_y]]) {
    for (const b of [0, 90]) {
      const target = [s.x, baseY + REGION.face.centre_y, s.z];
      const pose = await setCamera(poseFor(target, REGION.face.box_m, b, 0.62, -8));
      await call('stepFrames', 2);
      const { raw, box } = await projectBox(pose.target, REGION.face.box_m, REGION.face.lateral, pose.dist);
      await shoot(`FA__${s.id}__${aimId}__b${String(b).padStart(3, '0')}.png`, {
        slot: 'FA', part: 'face', subject: s.id, eid: s.eid, variant: s.variant, race: s.race, family: s.family,
        aim: aimId, aim_y: +baseY.toFixed(3), bearing: b, pose, projected: raw,
        aim_note: aimId === 'record' ? 'aimed where the AUTHORED height puts this person — the before arm draws them here'
          : 'aimed where the GROUND puts this person — the after arm draws them here',
      }, { box, subject: true });
    }
  }
  // C4 — the whole figure, eight angles, only for the two variants the judgement most needs: the
  // one that has never been photographed and the one every earlier round did.
  if (s.variant === 'hum.imperial-clerk' || s.variant === 'hum.dunmer-lean') {
    for (const a of ORBIT_ANGLES) {
      const target = [s.x, s.ground_y + SUBJECT_HEIGHT / 2, s.z];
      const pose = await setCamera(poseFor(target, SUBJECT_HEIGHT, a, 0.62, 0));
      await call('stepFrames', 2);
      const { raw, box } = await projectBox(pose.target, SUBJECT_HEIGHT, 0.30, pose.dist);
      await shoot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`, {
        slot: 'C4', subject: s.id, eid: s.eid, variant: s.variant, race: s.race, yaw: a, pose, projected: raw,
      }, { box, subject: true });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FP — THE PLAYER'S FACE, at the player stand. The player is the only subject whose world position
// is IDENTICAL in both arms by construction: `engine.teleport` sets `pos[1] = groundAt(x,z)` and
// that function is the same in both. So this is the one face pair with a byte-comparable camera.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const err = await goTo(STANDS.player.x, STANDS.player.z);
  if (err) log(`RED player stand: ${err}`);
  else {
    const snap = await call('snapshot');
    const p = snap.ok && snap.v.player ? snap.v.player.pos : [STANDS.player.x, 2.68, STANDS.player.z];
    censuses.player_stand = { player_pos: p.map((n) => +n.toFixed(3)) };
    for (const b of [0, 45, 90, 180]) {
      const target = [p[0], p[1] + REGION.face.centre_y, p[2]];
      const pose = await setCamera(poseFor(target, REGION.face.box_m, b, 0.62, -8));
      await call('stepFrames', 2);
      const { raw, box } = await projectBox(pose.target, REGION.face.box_m, 0, pose.dist);
      await shoot(`FP__player__b${String(b).padStart(3, '0')}.png`, {
        slot: 'FP', part: 'face', subject: 'player', variant: 'player.saxhleel', family: 'saxhleel',
        bearing: b, pose, projected: raw,
      }, { box, subject: true });
    }
    for (const a of ORBIT_ANGLES) {
      const target = [p[0], p[1] + SUBJECT_HEIGHT / 2, p[2]];
      const pose = await setCamera(poseFor(target, SUBJECT_HEIGHT, a, 0.62, 0));
      await call('stepFrames', 2);
      const { raw, box } = await projectBox(pose.target, SUBJECT_HEIGHT, 0.30, pose.dist);
      await shoot(`CP__player__yaw${String(a).padStart(3, '0')}.png`, {
        slot: 'CP', subject: 'player', variant: 'player.saxhleel', yaw: a, pose, projected: raw,
      }, { box, subject: true });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FS — THE FEET, ON GROUND THAT ACTUALLY VARIES UNDER THEM. Round 7: the three stands every
// earlier round used offer at most 0.034 m of per-foot difference, so those captures were
// predetermined nulls. These two stands were found by scanning 361,201 points.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const slopeStands = [];
for (const stand of [STANDS.slopeStrong, STANDS.slopeModerate, STANDS.player]) {
  const err = await goTo(stand.x, stand.z);
  if (err) { slopeStands.push({ stand: stand.id, error: err }); log(`RED slope stand ${stand.id}: ${err}`); continue; }
  const snap = await call('snapshot');
  const p = snap.ok && snap.v.player ? snap.v.player.pos : [stand.x, 0, stand.z];
  const feet = await footGroundSpread();
  slopeStands.push({
    stand: stand.id, x: stand.x, z: stand.z, player_pos: p.map((n) => +n.toFixed(3)),
    expected_per_foot_m: stand.expected_per_foot_m ?? null, measured: feet,
  });
  log(`slope stand ${stand.id}: per-foot ground difference AT THE BONES = `
    + `${feet && feet.per_foot_ground_difference_m !== undefined ? feet.per_foot_ground_difference_m : feet.error} m `
    + `(scan predicted ${stand.expected_per_foot_m ?? 'n/a'}); drawn foot height difference `
    + `${feet && feet.per_foot_drawn_difference_m !== undefined ? feet.per_foot_drawn_difference_m : '?'} m`);
  const meta = {
    slot: 'FS', part: 'foot', subject: 'player', stand: stand.id,
    per_foot_ground_difference_m: feet && feet.per_foot_ground_difference_m,
    per_foot_drawn_difference_m: feet && feet.per_foot_drawn_difference_m,
    stance_m: feet && feet.stance_m,
    feet,
  };
  for (const [b, pitch] of [[0, -18], [90, -18], [45, -50]]) {
    const target = [p[0], p[1] + REGION.foot.centre_y, p[2]];
    const pose = await setCamera(poseFor(target, REGION.foot.box_m, b, 0.55, pitch));
    await call('stepFrames', 2);
    const { raw, box } = await projectBox(pose.target, REGION.foot.box_m, REGION.foot.lateral, pose.dist);
    await shoot(`FS__${stand.id}__b${String(b).padStart(3, '0')}p${pitch}.png`,
      { ...meta, bearing: b, pitch, pose, projected: raw }, { box, subject: true });
  }
  // And the whole figure at the same stand: a foot planted 0.25 m off the other is a LEG shape
  // before it is a foot shape, and a 0.34 m crop cannot show that.
  for (const b of [0, 90]) {
    const target = [p[0], p[1] + SUBJECT_HEIGHT / 2, p[2]];
    const pose = await setCamera(poseFor(target, SUBJECT_HEIGHT, b, 0.62, -6));
    await call('stepFrames', 2);
    const { raw, box } = await projectBox(pose.target, SUBJECT_HEIGHT, 0.30, pose.dist);
    await shoot(`FSF__${stand.id}__b${String(b).padStart(3, '0')}.png`,
      { ...meta, slot: 'FSF', part: 'figure', bearing: b, pose, projected: raw }, { box, subject: true });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// M — MOTION, WITH THE STICK ACTUALLY HELD. HAZARDS §16.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const motion = { attempted: false, queued: null, frames: [], stick: MOTION_STICK, note: null, stand: STANDS.player.id };
{
  const err = await goTo(STANDS.player.x, STANDS.player.z);
  if (err) { motion.note = `RED motion: ${err}`; log(motion.note); }
  else {
    motion.attempted = true;
    await mustCall('clearInputs');
    const script = [];
    for (let f = 0; f <= MOTION_SHOTS * MOTION_STEP + 4; f++) script.push({ f, move: [0, MOTION_STICK] });
    const q = await mustCall('queueInputs', script);
    motion.queued = q.ok ? q.v : `FAILED: ${q.e}`;
    const start = await call('snapshot');
    const p0 = start.ok && start.v.player ? start.v.player.pos.slice() : null;
    for (let i = 0; i < MOTION_SHOTS; i++) {
      await call('stepFrames', MOTION_STEP);
      const sn = await call('snapshot');
      const p = sn.ok && sn.v.player ? sn.v.player.pos : null;
      if (!p) continue;
      const simFrame = (i + 1) * MOTION_STEP;
      const moved = p0 ? Math.hypot(p[0] - p0[0], p[2] - p0[2]) : null;
      motion.frames.push({ i, sim_frame: simFrame, pos: p.map((n) => +n.toFixed(3)), travelled_m: moved === null ? null : +moved.toFixed(3) });
      const nm = String(simFrame).padStart(3, '0');
      const target = [p[0], p[1] + SUBJECT_HEIGHT / 2, p[2]];
      const pose = await setCamera(poseFor(target, SUBJECT_HEIGHT, 135, 0.62, 0));
      await call('stepFrames', 1);
      const { raw, box } = await projectBox(pose.target, SUBJECT_HEIGHT, 0.30, pose.dist);
      await shoot(`M__walk__f${nm}.png`, { slot: 'M', subject: 'player', sim_frame: simFrame, travelled_m: moved, pose, projected: raw }, { box, subject: true });
      if (i % 2 === 0) {
        const ft = [p[0], p[1] + REGION.foot.centre_y, p[2]];
        const fpose = await setCamera(poseFor(ft, REGION.foot.box_m, 90, 0.55, -18));
        await call('stepFrames', 1);
        const fp = await projectBox(fpose.target, REGION.foot.box_m, REGION.foot.lateral, fpose.dist);
        await shoot(`MF__walk__f${nm}.png`, { slot: 'MF', part: 'foot', subject: 'player', sim_frame: simFrame, travelled_m: moved, pose: fpose, projected: fp.raw }, { box: fp.box, subject: true });
      }
    }
    await mustCall('clearInputs');
    const total = motion.frames.length ? motion.frames[motion.frames.length - 1].travelled_m : null;
    motion.note = total === null ? 'no player position was returned during the walk'
      : `player travelled ${total} m over ${MOTION_SHOTS * MOTION_STEP} simulated frames with the stick at ${MOTION_STICK}`;
    log(motion.note);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
const ok = rows.filter((r) => r.status === 'ok').length;
const red = rows.filter((r) => r.status === 'red').length;
const verdicts = {};
for (const r of rows) { const v = r.liveness && r.liveness.verdict; if (v) verdicts[v] = (verdicts[v] || 0) + 1; }
const manifest = {
  tool: 'f10-r7-appearance', tag: TAG, generated: new Date().toISOString(),
  ...manifestRendererFields(attestation),
  canvas: [CW, CH], seed: SEED, fov_deg: FOV_DEG, subject_height_m: SUBJECT_HEIGHT,
  out_dir: OUT,
  stands: STANDS,
  variant_quota: VARIANT_QUOTA,
  selection,
  subjects,
  scene_census: censuses,
  slope_stands: slopeStands,
  motion,
  liveness_call_note: 'gateBuffer(buf, {box, subject, throwOnDegenerate:false}) — the real parameter names (HAZARDS §16).',
  liveness_verdicts: verdicts,
  hard_calls: hardCalls,
  proximity_source: { from: 'tools/visual/lib/subject-proximity.mjs', ...PROXIMITY_DRIFT },
  frames: rows, frames_ok: ok, frames_red: red,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n${ok} frames ok, ${red} red — ${OUT}`);
log(`liveness verdicts: ${JSON.stringify(verdicts)}`);
await g.close?.();
// Exit 0 even with red frames: a non-zero exit inside a paid Pod's `set -e` script throws away the
// arm that DID capture. The manifest carries every count.
process.exit(0);

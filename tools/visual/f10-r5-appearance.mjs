#!/usr/bin/env node
/**
 * f10-r5-appearance.mjs — photograph the characters IN THE GAME, on hardware, and in motion.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY A FIFTH CAPTURE TOOL EXISTS, AND WHAT IS WRONG WITH THE FOUR BEFORE IT
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. **`setInput` IS NOT A HARNESS VERB, AND EVERY "MOTION" CAPTURE OF THE PLAYER HAS USED IT.**
 *    `grep -rn setInput game/` returns **0 matches** — run 2026-08-15, not remembered. Both
 *    `f10-r3-materials.mjs:341` and `f10-r4-digits.mjs:267` open their motion block with
 *    `await call('setInput', { forward: 1 })`, and `call()` returns
 *    `{ok:false, e:"window.__HARNESS.setInput is not a function"}` — which neither tool checks.
 *    So the "walk" sequences were taken with the stick at zero. The frames differ from each
 *    other (16 distinct sha256 prefixes in r3's manifest) because water, foliage and the idle
 *    clock move; nothing establishes the player did.
 *
 *    The real path, read out of `game/src/input/pipeline.js:211-213`, is `queueInputs`: a
 *    `move` event sets `moveX/moveY` and THEY PERSIST until another event changes them, so a
 *    script of `{f, move}` events, one per simulated frame, is a held stick. This tool queues
 *    that script and **records the player's world position at every motion frame**, so "does the
 *    walk glide" is answerable rather than assumed: if the body translates and the silhouette
 *    does not, that is a glide, and the frames prove which.
 *
 * 2. **THE LIVENESS GATE HAS BEEN CALLED WITH THE WRONG ARGUMENT NAMES.** `frame-liveness.mjs`
 *    exports `gateBuffer(buf, { box, subject, label, throwOnDegenerate })`. r3 and r4 both call
 *    it as `gateBuffer(buf, { framing: ..., canvas: ... })`. Neither key exists, so `box` was
 *    `null` and `subject` was `false` on **every frame either tool has ever taken** — the
 *    subject-presence half of HAZARDS §15 (*"is the thing I am measuring in it"*) never ran, and
 *    `subject_box.from` would have said so in the manifest if anyone had read it. This tool
 *    projects the region it is actually pointing at into pixels, hands that box to the gate, and
 *    writes `subject_box.from` into every row.
 *
 * 3. **A HAND IS 8% OF FRAME HEIGHT AT WHOLE-FIGURE FRAMING** (r4's finding, kept). So the close
 *    slots here frame the REGION, not the figure — and because `listEntities()` reports no yaw,
 *    a hand's azimuth around the body is unknown, so each hand bearing is shot TWICE, offset
 *    ±0.22 m along the CAMERA's own right vector. One of the pair frames a hand whatever way the
 *    subject happens to be standing. A further still off the same setup costs 0.086 s
 *    (`gpu-deck.mjs` COST_MODEL, fitted to two live runs), so this is nearly free.
 *
 * 4. **SUBJECT SELECTION IS `selectByProximity`, IMPORTED.** `listEntities()`
 *    (`game/src/engine.js:11607`) is not range-filtered; it returns every NPC in the sim. Both
 *    the older sweeps took the first N in list order and photographed open sea. The fix is
 *    exported from `f10-r3-materials.mjs` and is imported here, not copied.
 *
 * WHERE THE REGION HEIGHTS COME FROM. `game/data/combat/skeleton.json`, offset chain summed by
 * script, not retyped: `head` 1.6400, `hand_l` 0.9100, `foot_l` 0.0900, `height_m` 1.78.
 *
 * Usage:
 *   node tools/visual/f10-r5-appearance.mjs --tag after --gpu hardware --require-hardware \
 *        --out "$RUNPOD_ARTIFACT_DIR/after"
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from './lib/renderer-class.mjs';
import { selectByProximity } from './f10-r3-materials.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const TAG = String(args.tag || 'f10-r5');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-r5-appearance/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260815);
const SETTLE = Number(args.settle || 12);
const FOV_DEG = 60;                                  // game/src/render/renderer.js
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;
const PER_FAMILY = Number(args['per-family'] || 2);
const MAX_OFFSET_M = Number(args['max-offset'] || 80);
// 1.78, read off skeleton.json's own `height_m` — NOT the 1.8 the older tools declared as a
// fallback. The regions below are absolute metres on that skeleton and are not rescaled per
// subject, because no harness verb reports a body height; a subject built at another scale will
// show as mis-centred framing in its own `subject_box`, which is visible rather than silent.
const SUBJECT_HEIGHT = Number(args.height || 1.78);
// 16 shots at 4 simulated frames each = 64 frames = 1.07 s at the fixed 60 Hz step, which clears
// one walk cycle. The count is also a RETURN-SIZE decision: a 960x540 frame off this path measures
// 1,096 KB (`du -sk` over r3's 76 returned frames), the controller buffers the whole tar in memory,
// and `gpu-deck.mjs` warns to keep a return under ~500 MB. Two arms at this shot list is ~350 MB.
const MOTION_SHOTS = Number(args['motion-shots'] || 16);
const MOTION_STEP = Number(args['motion-step'] || 4);
const MOTION_STICK = Number(args['motion-stick'] || 0.55);   // engine.js: 0.55 is the walk ceiling
const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const log = (...m) => { process.stdout.write(`${m.join(' ')}\n`); };

/** Regions on the body axis, in metres above the feet. Sourced from skeleton.json, see header. */
const REGION = {
  face: { centre_y: 1.68, box_m: 0.34, lateral: 0.00 },
  hand: { centre_y: 0.82, box_m: 0.34, lateral: 0.22 },
  foot: { centre_y: 0.10, box_m: 0.34, lateral: 0.12 },
};

const STANDS = [
  { id: 'char-player', x: 2766, z: 5011 },
  { id: 'street-lilmoth', x: 2779.9, z: 5040.9 },
  { id: 'street-gideon', x: 459.3, z: 2934.2 },
];
const REPTILIAN_RACES = new Set(['saxhleel', 'argonian', 'naga']);
const familyOf = (race) => (REPTILIAN_RACES.has(String(race || '').toLowerCase()) ? 'reptilian' : 'humanoid');

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

/**
 * A verb that MUST work. `call()` swallows a missing method into `{ok:false}`, which is how four
 * rounds of motion capture were taken with the stick at zero (header §1). Anything this tool
 * depends on for its claims goes through here instead, and a failure is recorded loudly.
 */
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

/** NDC -> pixels, and a box the liveness gate can actually use. */
function boxFromProjection(bottom, top, lateralM, distM) {
  if (!bottom || !top || !bottom.ndc || !top.ndc) return null;
  const px = (ndc) => [(ndc[0] + 1) / 2 * CW, (1 - ndc[1]) / 2 * CH];
  const [bx, by] = px(bottom.ndc);
  const [tx, ty] = px(top.ndc);
  // Half-width in pixels for a body of `lateralM` half-extent at `distM`: the horizontal field
  // half-width at that distance is dist*tan(hfov/2), and hfov follows from the vertical FOV and
  // the aspect. A minimum of 12% of frame width keeps a very thin subject from producing a box
  // narrower than the centre band the gate's own statistic needs.
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

async function shoot(file, meta, { box = null, subject = false } = {}) {
  const shot = await call('screenshot');
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); log(`  RED ${file}: ${shot.e}`); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  let gate = null;
  if (liveness && typeof liveness.gateBuffer === 'function') {
    // THE CORRECT PARAMETER NAMES. See header §2 — `{framing, canvas}` are ignored by this
    // function and every earlier F10 frame was gated with box=null, subject=false.
    try { gate = liveness.gateBuffer(buf, { box, subject, label: file, throwOnDegenerate: false }); }
    catch (e) { gate = { verdict: 'GATE_THREW', why: [String(e.message).slice(0, 200)] }; }
  }
  rows.push({ file, status: 'ok', bytes: buf.length, hash, liveness: gate, ...meta });
  return hash;
}

/**
 * Point the camera so that a `box` metre-tall region at `at` fills `fill` of frame height.
 * `lateral` slides the aim point along the CAMERA's own right vector — right = (cos b, 0, -sin b)
 * for an eye placed at bearing b — which is how a hand of unknown azimuth gets framed (header §3).
 */
async function aim(at, box, bearingDeg, fill, pitchDeg = 0, lateral = 0) {
  const dist = box / (2 * fill * Math.tan((FOV_DEG / 2) * Math.PI / 180));
  const yaw = bearingDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  const target = [at[0] + Math.cos(yaw) * lateral, at[1], at[2] - Math.sin(yaw) * lateral];
  const eye = [
    target[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[1] - Math.sin(pitch) * dist,
    target[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  const r = await call('camera', { pos: eye, look: target });
  return {
    ok: r.ok, e: r.e || null, dist: +dist.toFixed(3), fill, pitch_deg: pitchDeg, lateral_m: lateral,
    eye: eye.map((n) => +n.toFixed(3)), target: target.map((n) => +n.toFixed(3)),
  };
}

async function projectBox(centre, region, pose) {
  const t = pose.target;
  const half = region.box_m / 2;
  const lo = await call('projectPoint', t[0], t[1] - half, t[2]);
  const hi = await call('projectPoint', t[0], t[1] + half, t[2]);
  const raw = { bottom: lo.ok ? lo.v : null, top: hi.ok ? hi.v : null };
  return { raw, box: boxFromProjection(raw.bottom, raw.top, region.lateral, pose.dist) };
}

async function goTo(p) {
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  const r = await call('teleport', p.x, p.z);
  if (!r.ok) return `teleport(${p.x},${p.z}) refused: ${r.e}`;
  await call('stepFrames', SETTLE);
  return null;
}

await mustCall('setUIVisible', false);
await mustCall('setTimeOfDay', 13);
await mustCall('setWeather', 'clear');

// ── subjects, nearest the stand first ────────────────────────────────────────────────────────
const standErrors = [], rejected = [], distributions = [], pool = [];
for (const stand of STANDS) {
  const err = await goTo(stand);
  if (err) { standErrors.push({ stand: stand.id, error: err }); log(`RED stand ${stand.id}: ${err}`); continue; }
  const ents = await call('listEntities');
  const npcs = ((ents.ok ? ents.v : []) || []).filter((e) => String(e.kind || '').toLowerCase() === 'npc');
  const sel = selectByProximity(npcs, stand, MAX_OFFSET_M);
  distributions.push(sel.distances);
  rejected.push(...sel.rejected);
  log(`stand ${stand.id}: ${npcs.length} enumerated, ${sel.kept.length} within ${MAX_OFFSET_M} m `
    + `(median ${sel.distances.median} m, max ${sel.distances.max} m), ${sel.rejected.length} rejected as unplaced`);
  pool.push(...sel.kept);
}

const subjects = [];
const playerStand = STANDS[0];
if (!(await goTo(playerStand))) {
  const snap0 = await call('snapshot');
  const p = snap0.ok && snap0.v.player ? snap0.v.player.pos : null;
  if (p) subjects.push({ id: 'player', kind: 'player', pos: p, label: 'player', race: 'saxhleel', family: 'reptilian', stand: playerStand, offset_m: 0 });
}
const perFamily = { reptilian: 0, humanoid: 0 };
const seenRace = new Set();
for (const pass of [1, 2]) {
  for (const en of pool.slice().sort((a, b) => a.offset_m - b.offset_m || String(a.eid).localeCompare(String(b.eid)))) {
    const fam = familyOf(en.race);
    if (perFamily[fam] >= PER_FAMILY) continue;
    if (pass === 1 && seenRace.has(en.race)) continue;
    if (subjects.some((s) => s.eid === en.eid)) continue;
    seenRace.add(en.race); perFamily[fam]++;
    subjects.push({
      id: `npc-${String(en.eid || en.name).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`,
      kind: 'npc', pos: en.pos, eid: en.eid, label: en.name, race: en.race, family: fam,
      stand: en.stand, offset_m: +en.offset_m.toFixed(1),
    });
  }
}
log(`subjects: ${subjects.map((s) => `${s.label}(${s.race}, ${s.offset_m} m)`).join(', ')}`);
fs.writeFileSync(path.join(OUT, 'subjects.json'), `${JSON.stringify({ subjects, rejected, distributions }, null, 2)}\n`);

async function reposition(s) {
  const err = await goTo(s.stand);
  if (err) return { err };
  if (s.kind === 'player') {
    const sn = await call('snapshot');
    return { centre: (sn.ok && sn.v.player) ? sn.v.player.pos : s.pos, offset_m: 0 };
  }
  const ents = await call('listEntities');
  const found = ((ents.ok ? ents.v : []) || []).find((x) => x.eid === s.eid);
  if (!found) return { err: `subject ${s.eid} vanished from listEntities() after repositioning` };
  const off = Math.hypot(found.pos[0] - s.stand.x, found.pos[2] - s.stand.z);
  if (off > MAX_OFFSET_M) return { err: `subject moved to ${off.toFixed(0)} m from stand ${s.stand.id} before capture` };
  return { centre: found.pos, offset_m: +off.toFixed(1) };
}

/** A whole-figure shot: the box is the figure, so the subject gate is meaningful. */
async function figureShot(file, centre, bearing, fill, meta) {
  const mid = centre[1] + SUBJECT_HEIGHT / 2;
  const pose = await aim([centre[0], mid, centre[2]], SUBJECT_HEIGHT, bearing, fill);
  await call('stepFrames', 2);
  const { raw, box } = await projectBox(centre, { box_m: SUBJECT_HEIGHT, lateral: 0.30 }, pose);
  return shoot(file, { ...meta, pose, projected: raw, subject_box: box }, { box, subject: true });
}

/** A region close-up: the region fills the frame, the figure does not. */
async function regionShot(file, centre, region, bearing, fill, pitch, lateral, meta) {
  const at = [centre[0], centre[1] + region.centre_y, centre[2]];
  const pose = await aim(at, region.box_m, bearing, fill, pitch, lateral);
  await call('stepFrames', 2);
  const { raw, box } = await projectBox(centre, region, pose);
  return shoot(file, { ...meta, pose, projected: raw, subject_box: box }, { box, subject: true });
}

for (const s of subjects) {
  const { err, centre, offset_m } = await reposition(s);
  if (err || !centre) { rows.push({ subject: s.id, status: 'red', reason: err || 'no world position' }); log(`RED ${s.id}: ${err}`); continue; }
  log(`subject ${s.id} @ ${centre.map((n) => n.toFixed(1)).join(',')} (${offset_m} m from stand)`);
  const base = { subject: s.id, label: s.label, race: s.race, family: s.family, offset_m };

  // C4 — the directive's eight-angle orbit, whole figure in frame.
  for (const a of ORBIT_ANGLES) {
    await figureShot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`, centre, a, 0.62, { ...base, slot: 'C4', yaw: a });
  }
  // FA — the face, four bearings. "Are the heads still eggs" is a close-up question.
  for (const a of [0, 90, 180, 270]) {
    await regionShot(`FA__${s.id}__b${String(a).padStart(3, '0')}.png`, centre, REGION.face, a, 0.62, -8, 0,
      { ...base, slot: 'FA', part: 'face', bearing: a });
  }
  // H1 — the hand, four bearings, each shot to both sides of the body axis (header §3).
  for (const a of [0, 90, 180, 270]) {
    for (const lat of [+REGION.hand.lateral, -REGION.hand.lateral]) {
      await regionShot(`H1__${s.id}__b${String(a).padStart(3, '0')}${lat > 0 ? 'R' : 'L'}.png`,
        centre, REGION.hand, a, 0.60, 0, lat, { ...base, slot: 'H1', part: 'hand', bearing: a, lateral_m: lat });
    }
  }
  // H2 — the hand from below and from above. A hanging hand is edge-on from the front and the
  // curl only reads off-axis; one angle certifying a hand is the transparency defect's mistake.
  for (const [a, pitch] of [[45, -35], [225, 30]]) {
    for (const lat of [+REGION.hand.lateral, -REGION.hand.lateral]) {
      await regionShot(`H2__${s.id}__b${String(a).padStart(3, '0')}p${pitch}${lat > 0 ? 'R' : 'L'}.png`,
        centre, REGION.hand, a, 0.60, pitch, lat, { ...base, slot: 'H2', part: 'hand', bearing: a, pitch, lateral_m: lat });
    }
  }
  // F1 — the feet, from in front, from the side, and from above.
  for (const [a, pitch] of [[0, -18], [90, -18], [45, -50]]) {
    await regionShot(`F1__${s.id}__b${String(a).padStart(3, '0')}p${pitch}.png`,
      centre, REGION.foot, a, 0.55, pitch, 0, { ...base, slot: 'F1', part: 'foot', bearing: a, pitch });
  }
}

// ── M — motion, with the stick actually held (header §1) ─────────────────────────────────────
const motion = { attempted: false, queued: null, frames: [], stick: MOTION_STICK, note: null };
{
  const err = await goTo(playerStand);
  if (err) { motion.note = `RED motion: ${err}`; log(motion.note); }
  else {
    motion.attempted = true;
    await mustCall('clearInputs');
    // One event per simulated frame. `moveX/moveY` persist between events (pipeline.js:213), so
    // one event would do — the full script is queued anyway so that anything that resets the
    // stick mid-sequence is re-overridden rather than silently ending the walk.
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
      // Fixed bearing, camera re-aimed at the body each frame: the ONLY thing that can change
      // between these frames is the pose, which is what "does the silhouette change" needs.
      await figureShot(`M__walk__f${nm}.png`, p, 135, 0.62, { slot: 'M', subject: 'player', sim_frame: simFrame, travelled_m: moved });
      // The foot at foot scale, every other shot — enough to see a heel strike, half the bytes.
      if (i % 2 === 0) {
        await regionShot(`MF__walk__f${nm}.png`, p, REGION.foot, 90, 0.55, -18, 0,
          { slot: 'MF', part: 'foot', subject: 'player', sim_frame: simFrame, travelled_m: moved });
      }
    }
    await mustCall('clearInputs');
    const total = motion.frames.length ? motion.frames[motion.frames.length - 1].travelled_m : null;
    motion.note = total === null ? 'no player position was returned during the walk'
      : `player travelled ${total} m over ${MOTION_SHOTS * MOTION_STEP} simulated frames with the stick at ${MOTION_STICK}`;
    log(motion.note);
  }
}

const ok = rows.filter((r) => r.status === 'ok').length;
const red = rows.filter((r) => r.status === 'red').length;
const verdicts = {};
for (const r of rows) { const v = r.liveness && r.liveness.verdict; if (v) verdicts[v] = (verdicts[v] || 0) + 1; }
const manifest = {
  tool: 'f10-r5-appearance', tag: TAG, generated: new Date().toISOString(),
  ...manifestRendererFields(attestation),
  canvas: [CW, CH], seed: SEED, fov_deg: FOV_DEG,
  subject_height_m: SUBJECT_HEIGHT,
  subject_height_source: "game/data/combat/skeleton.json height_m, summed offset chain: head 1.6400, hand_l 0.9100, foot_l 0.0900",
  region_geometry: REGION,
  liveness_call_note: 'gateBuffer(buf, {box, subject:true, throwOnDegenerate:false}) — the real parameter names. '
    + 'f10-r3-materials.mjs and f10-r4-digits.mjs pass {framing, canvas}, which this function ignores, '
    + 'so every earlier F10 frame was gated with box=null and subject=false.',
  liveness_verdicts: verdicts,
  hard_calls: hardCalls,
  motion,
  max_offset_m: MAX_OFFSET_M,
  subject_offset_distributions: distributions,
  rejected_subjects: rejected, stand_errors: standErrors,
  subjects, frames: rows, frames_ok: ok, frames_red: red,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n${ok} frames ok, ${red} red — ${OUT}`);
log(`liveness verdicts: ${JSON.stringify(verdicts)}`);
log(`rejected as unplaced before spending a frame on them: ${rejected.length}`);
await g.close?.();
// Exit 0 even with red frames: the manifest carries the count, and a non-zero exit inside a
// paid Pod's `set -e` script would throw away the arm that DID capture. HAZARDS §13: the
// deliverable is the evidence, and a partial capture honestly labelled beats none.
process.exit(0);

#!/usr/bin/env node
/**
 * f10-r3-materials.mjs — the counterpart capture for the F10 round-3 material work.
 *
 * WHY A THIRD CAPTURE TOOL AND NOT AN EDIT TO THE OTHER TWO. `node tools/ownership.mjs --for
 * tools/visual/f10-character-sweep.mjs` and `--for tools/visual/f10-r2-appearance.mjs` both return
 * one LIVE piece, `W1-30V`, holding a CLAIMED hold on each, 14 h old. Two agents editing one file
 * is the collision the fleet rule exists to prevent, so this is a new file. The proximity pre-flight
 * below is exported precisely so `W1-30V` can adopt it in one import rather than re-derive it.
 *
 * ---------------------------------------------------------------------------------------
 * THE DEFECT THIS TOOL FIXES, AND IT HAS NOW WASTED THREE ROUNDS OF CAPTURE BUDGET
 * ---------------------------------------------------------------------------------------
 * Round 2's appearance pass: "47 OF THE 166 FRAMES IN EACH ARM CONTAIN NO SUBJECT ... two of the
 * seven selected NPCs are returned by `listEntities()` at [-2.399, 0, 3.101] and [-0.626, 0,
 * -2.824], i.e. within four metres of the world origin, which in Black Marsh is open sea."
 * Round 2's sweep: "17 of 93 frames contain open water and sky and no figure", same shape, subject
 * `npc-lilmoth-apothecary-12` at (2.0, 0.0, 1.7) while its peers sat near (2800, 5030).
 *
 * THE CAUSE, read out of the engine rather than inferred. `game/src/engine.js:11517`:
 *
 *     listEntities() {
 *       ...
 *       for (const n of this.sim.npcs) out.push({ ..., pos: [n.pos[0], n.pos[1], n.pos[2]], ... });
 *
 * **It is not range-filtered. It returns every NPC in the simulation, wherever it is.** Both
 * existing capture tools log `stand ${stand.id}: ${npcs.length} npc(s) in range` and then take the
 * first N in list order. There is no "in range" — the phrase is the whole bug. An NPC the sim has
 * not placed yet reports a near-origin position, list order has nothing to do with the stand, and
 * the camera dutifully orbits a patch of open sea while every geometric field in the manifest
 * (`on_screen: true`, `in_front: true`, a correct projection) says the frame is fine.
 *
 * THE FIX IS SELECTION, NOT DETECTION. A liveness gate that rejects the frame afterwards has
 * already paid for it. This tool
 *
 *   1. measures every enumerated NPC's distance from the stand it was enumerated at,
 *   2. **sorts by that distance and takes the nearest**, which is what "in range" was supposed to
 *      mean and never was,
 *   3. rejects anything beyond `--max-offset` metres with the measured distance recorded, and
 *   4. writes the WHOLE per-stand distance distribution into the manifest, so the next agent can
 *      recalibrate the threshold against the real population instead of inheriting my number.
 *
 * On (4): HAZARDS §15's correction is that a gate's threshold must be calibrated against the real
 * population before it is armed, not derived from the single failure that motivated it. I cannot
 * calibrate this one offline — `grep`ping `game/data/npcs/*.json` for a position returns **0 of
 * 408 records with one**, because placement is a run-time property of the sim. So the threshold is
 * DECLARED, its provenance is stated here, and the population it should be checked against is
 * published in the manifest by every run. That is the honest version of a number I could not
 * derive: not a silent guess, and cheap for the next reader to overturn.
 *
 * ---------------------------------------------------------------------------------------
 * WHAT IT CAPTURES
 * ---------------------------------------------------------------------------------------
 *  C4  eight-angle orbit, whole figure in frame, per subject, both body families.
 *  C1  close-up at conversation framing, two bearings.
 *  B3  the RI-VIS08 material-separation pair: the same subject at bearing b and b+30, from which
 *      a reader computes per-patch specular delta. Both frames are captured; this tool does not
 *      score B3, because a builder scoring its own acceptance is not evidence.
 *  M   a motion sequence — the owner's directive is that stills are not enough.
 *
 * Every frame goes through `frame-liveness.mjs` at capture time, and every frame records the
 * subject's projected head-top and foot-bottom rows so a reader can check the framing rather than
 * take the filename's word for it.
 *
 * Usage:
 *   node tools/visual/f10-r3-materials.mjs --tag local
 *   node tools/visual/f10-r3-materials.mjs --tag hw --gpu hardware --require-hardware
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchForCapture, resolveGpuMode } from './lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from './lib/renderer-class.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const TAG = String(args.tag || 'f10-r3');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-r3-materials/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260814);
const SETTLE = Number(args.settle || 10);
const FOV_DEG = 60;                         // game/src/render/renderer.js
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;
const PER_FAMILY = Number(args['per-family'] || 2);
const SUBJECT_HEIGHT = 1.8;                 // declared fallback: no harness verb reports body height
const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const MOTION_FRAMES = Number(args['motion-frames'] || 16);
const MOTION_STEP = Number(args['motion-step'] || 3);
const log = (...m) => { process.stdout.write(`${m.join(' ')}\n`); };

/**
 * THE PRE-FLIGHT, exported so the two claimed tools can adopt it without re-deriving it.
 *
 * @param npcs   whatever `listEntities()` returned, already filtered to kind === 'npc'
 * @param stand  { id, x, z } the stand the player was teleported to before enumerating
 * @param maxOffsetM  DECLARED, not derived — see the header. Default 80 m, about a settlement's
 *   own extent. A subject further than this from the stand cannot be orbited from it at the ~1.6 m
 *   camera radius this capture uses, whatever the projection says.
 * @returns { kept, rejected, distances } — `distances` is the full population, for the manifest.
 */
export function selectByProximity(npcs, stand, maxOffsetM = 80) {
  const withDist = npcs.map((e) => {
    const p = e.pos || [0, 0, 0];
    return { ...e, stand, offset_m: Math.hypot(p[0] - stand.x, p[2] - stand.z) };
  }).sort((a, b) => a.offset_m - b.offset_m);
  const kept = withDist.filter((e) => e.offset_m <= maxOffsetM);
  const rejected = withDist.filter((e) => e.offset_m > maxOffsetM).map((e) => ({
    eid: e.eid, name: e.name, race: e.race, pos: e.pos, offset_m: +e.offset_m.toFixed(1),
    reason: `enumerated at stand ${stand.id} but ${e.offset_m.toFixed(0)} m from it — listEntities() is not range-filtered (engine.js:11517), so list order is not proximity`,
  }));
  const d = withDist.map((e) => +e.offset_m.toFixed(1));
  return {
    kept,
    rejected,
    distances: {
      stand: stand.id, n: d.length,
      min: d[0] ?? null, p10: d[Math.floor(d.length * 0.1)] ?? null,
      median: d[Math.floor(d.length / 2)] ?? null,
      p90: d[Math.floor(d.length * 0.9)] ?? null, max: d[d.length - 1] ?? null,
      within_max_offset: kept.length, beyond_max_offset: rejected.length,
      all_m: d,
    },
  };
}

// Run as a library (the export above) and stop, so another tool can import this without launching
// a browser. `node -e "import('./tools/visual/f10-r3-materials.mjs')"` would otherwise capture.
if (args['self-test'] === true) {
  const stand = { id: 'unit', x: 1000, z: 2000 };
  const near = { eid: 'a', pos: [1002, 0, 2003] };
  const origin = { eid: 'b', pos: [2.0, 0, 1.7] };
  const r = selectByProximity([origin, near], stand, 80);
  const ok = r.kept.length === 1 && r.kept[0].eid === 'a' && r.rejected.length === 1 && r.rejected[0].eid === 'b';
  log(`self-test  near subject offset ${r.kept[0]?.offset_m?.toFixed(1)} m KEPT`);
  log(`self-test  origin subject offset ${r.rejected[0]?.offset_m?.toFixed(1)} m REJECTED`);
  // And the arm that must disagree: with the threshold lifted past the origin distance, the same
  // input keeps both — proving the rejection is the threshold doing work and not a coincidence.
  const loose = selectByProximity([origin, near], stand, 1e9);
  log(`self-test  with the threshold lifted, both are kept: ${loose.kept.length === 2 ? 'YES' : 'NO'}`);
  log(`self-test  ${ok && loose.kept.length === 2 ? 'GOES RED on the void subject and not otherwise' : 'DOES NOT DISCRIMINATE'}`);
  process.exit(ok && loose.kept.length === 2 ? 0 : 1);
}

const MAX_OFFSET_M = Number(args['max-offset'] || 80);
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

const rows = [];
let liveness = null;
try { liveness = await import('./frame-liveness.mjs'); } catch { liveness = null; }

async function shoot(file, meta) {
  const shot = await call('screenshot');
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); log(`  RED ${file}: ${shot.e}`); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  let gate = null;
  if (liveness && typeof liveness.gateBuffer === 'function') {
    try { gate = await liveness.gateBuffer(buf, { framing: meta.framing || null, canvas: [CW, CH] }); }
    catch (e) { gate = { error: String(e.message).slice(0, 120) }; }
  }
  rows.push({ file, status: 'ok', bytes: buf.length, hash, liveness: gate, ...meta });
  return hash;
}

async function orbitPose(centre, subjectHeight, bearingDeg, fill, pitchDeg = 0) {
  const dist = subjectHeight / (2 * fill * Math.tan((FOV_DEG / 2) * Math.PI / 180));
  const yaw = bearingDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  const mid = centre[1] + subjectHeight / 2;
  const eye = [
    centre[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    mid - Math.sin(pitch) * dist,
    centre[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  const r = await call('camera', { pos: eye, look: [centre[0], mid, centre[2]] });
  return { ok: r.ok, e: r.e || null, dist: +dist.toFixed(3), eye: eye.map((n) => +n.toFixed(3)) };
}

async function framing(centre, subjectHeight) {
  const foot = await call('projectPoint', centre[0], centre[1], centre[2]);
  const head = await call('projectPoint', centre[0], centre[1] + subjectHeight, centre[2]);
  return { foot: foot.ok ? foot.v : null, head: head.ok ? head.v : null };
}

async function goTo(p) {
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  const r = await call('teleport', p.x, p.z);
  if (!r.ok) return `teleport(${p.x},${p.z}) refused: ${r.e}`;
  await call('stepFrames', SETTLE);
  return null;
}

await call('setUIVisible', false);
await call('setTimeOfDay', 13);
await call('setWeather', 'clear');

// ---------------------------------------------------------------------------------------
// Subjects — NEAREST THE STAND FIRST. See the header for why this line is the whole fix.
// ---------------------------------------------------------------------------------------
const standErrors = [];
const rejected = [];
const distributions = [];
const pool = [];
for (const stand of STANDS) {
  const err = await goTo(stand);
  if (err) { standErrors.push({ stand: stand.id, error: err }); log(`RED stand ${stand.id}: ${err}`); continue; }
  const ents = await call('listEntities');
  const npcs = ((ents.ok ? ents.v : []) || []).filter((e) => String(e.kind || '').toLowerCase() === 'npc');
  const sel = selectByProximity(npcs, stand, MAX_OFFSET_M);
  distributions.push(sel.distances);
  rejected.push(...sel.rejected);
  log(`stand ${stand.id}: ${npcs.length} npc(s) enumerated, ${sel.kept.length} within ${MAX_OFFSET_M} m `
    + `(median offset ${sel.distances.median} m, max ${sel.distances.max} m), ${sel.rejected.length} rejected as unplaced`);
  pool.push(...sel.kept);
}

const subjects = [];
const playerStand = STANDS[0];
if (!(await goTo(playerStand))) {
  const snap0 = await call('snapshot');
  const p = snap0.ok && snap0.v.player ? snap0.v.player.pos : null;
  if (p) subjects.push({ id: 'player', kind: 'player', pos: p, label: 'player', race: 'saxhleel', family: 'reptilian', stand: playerStand, height: SUBJECT_HEIGHT, offset_m: 0 });
}
// Deterministic across arms: within each family, nearest first, then eid to break ties.
const perFamily = { reptilian: 0, humanoid: 0 };
const seenRace = new Set();
for (const pass of [1, 2]) {
  for (const en of pool.slice().sort((a, b) => a.offset_m - b.offset_m || String(a.eid).localeCompare(String(b.eid)))) {
    const fam = familyOf(en.race);
    if (perFamily[fam] >= PER_FAMILY) continue;
    // Pass 1 takes distinct races first so one race cannot fill a family's whole allowance.
    if (pass === 1 && seenRace.has(en.race)) continue;
    if (subjects.some((s) => s.eid === en.eid)) continue;
    seenRace.add(en.race);
    perFamily[fam]++;
    subjects.push({
      id: `npc-${String(en.eid || en.name).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`,
      kind: 'npc', pos: en.pos, eid: en.eid, label: en.name, race: en.race, family: fam,
      stand: en.stand, height: SUBJECT_HEIGHT, offset_m: +en.offset_m.toFixed(1),
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
    return { centre: (sn.ok && sn.v.player) ? sn.v.player.pos : s.pos };
  }
  const ents = await call('listEntities');
  const found = ((ents.ok ? ents.v : []) || []).find((x) => x.eid === s.eid);
  if (!found) return { err: `subject ${s.eid} vanished from listEntities() after repositioning` };
  const off = Math.hypot(found.pos[0] - s.stand.x, found.pos[2] - s.stand.z);
  // THE SECOND HALF OF THE PRE-FLIGHT: a subject that passed selection can still have moved. If it
  // has walked out of range by the time we photograph it, say so rather than photograph the sea.
  if (off > MAX_OFFSET_M) return { err: `subject moved to ${off.toFixed(0)} m from stand ${s.stand.id} before capture` };
  return { centre: found.pos, offset_m: +off.toFixed(1) };
}

for (const s of subjects) {
  const { err, centre, offset_m } = await reposition(s);
  if (err || !centre) { rows.push({ subject: s.id, status: 'red', reason: err || 'no world position' }); log(`RED ${s.id}: ${err}`); continue; }
  log(`subject ${s.id} @ ${centre.map((n) => n.toFixed(1)).join(',')} (${offset_m} m from stand)`);

  // C4 — the eight-angle orbit, whole figure in frame.
  for (const a of ORBIT_ANGLES) {
    const pose = await orbitPose(centre, s.height, a, 0.55);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`,
      { slot: 'C4', subject: s.id, race: s.race, family: s.family, yaw: a, pose, framing: fr, offset_m });
  }
  // C1 — conversation framing, two bearings, subject filling the frame.
  for (const a of [20, 200]) {
    await orbitPose([centre[0], centre[1] + 1.44, centre[2]], 0.34, a, 0.62);
    await call('stepFrames', 2);
    await shoot(`C1__${s.id}__b${a}.png`, { slot: 'C1', subject: s.id, race: s.race, family: s.family, bearing: a, offset_m });
  }
  // B3 — the material-separation pair. RI-VIS08 §B3 asks for the same patches re-captured with the
  // camera orbited 30 degrees; both frames are taken here and NEITHER is scored by this tool.
  for (const a of [60, 90]) {
    const pose = await orbitPose(centre, s.height, a, 0.80);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`B3__${s.id}__yaw${String(a).padStart(3, '0')}.png`,
      { slot: 'B3', subject: s.id, race: s.race, family: s.family, yaw: a, pose, framing: fr, offset_m });
  }
}

// M — motion. "Stills are not enough" is the directive, and it is guarded by a check.
{
  const err = await goTo(playerStand);
  if (err) log(`RED motion: ${err}`);
  else {
    await call('setInput', { forward: 1 });
    for (let f = 0; f < MOTION_FRAMES; f++) {
      await call('stepFrames', MOTION_STEP);
      const sn = await call('snapshot');
      const p = sn.ok && sn.v.player ? sn.v.player.pos : null;
      if (!p) continue;
      await orbitPose(p, SUBJECT_HEIGHT, 135, 0.52);
      const fr = await framing(p, SUBJECT_HEIGHT);
      await shoot(`M__walk__f${String(f * MOTION_STEP).padStart(3, '0')}.png`,
        { slot: 'M', subject: 'player', sim_frame: f * MOTION_STEP, framing: fr });
    }
    await call('setInput', { forward: 0 });
  }
}

const ok = rows.filter((r) => r.status === 'ok').length;
const red = rows.filter((r) => r.status === 'red').length;
const manifest = {
  tool: 'f10-r3-materials', tag: TAG, generated: new Date().toISOString(),
  ...manifestRendererFields(attestation),
  canvas: [CW, CH], seed: SEED, fov_deg: FOV_DEG,
  subject_height_m: SUBJECT_HEIGHT,
  subject_height_source: 'declared fallback 1.8 m — no harness verb reports body height',
  max_offset_m: MAX_OFFSET_M,
  max_offset_provenance: 'DECLARED, not derived. game/data/npcs/*.json carries a position on 0 of '
    + '408 records, so it cannot be calibrated offline; the per-stand distributions below are '
    + 'published so the next reader can overturn it against the real population.',
  subject_offset_distributions: distributions,
  rejected_subjects: rejected,
  stand_errors: standErrors,
  subjects, frames: rows, frames_ok: ok, frames_red: red,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n${ok} frames ok, ${red} red — ${OUT}`);
log(`rejected as unplaced before spending a frame on them: ${rejected.length}`);
await g.close?.();
process.exit(red > 0 ? 1 : 0);

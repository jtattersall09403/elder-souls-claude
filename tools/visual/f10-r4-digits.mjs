#!/usr/bin/env node
/**
 * f10-r4-digits.mjs — photograph the hands and the feet, at the distance a player meets them.
 *
 * WHY A NEW SHOT LIST AND NOT r3's. Every capture this project has taken of a character has framed
 * the WHOLE FIGURE — `C4` at fill 0.55, `B3` at 0.80, `C1` at 0.62 on a 0.34 m head box. A hand is
 * about 25 cm of a 180 cm figure, so at fill 0.55 it is under 8% of frame height and no defect in it
 * can be seen. That is exactly how three rounds recorded "every close-up shows a stump" without ever
 * establishing WHY, and it is why r3's own status file misdiagnosed the cause as absent geometry
 * when the geometry had been present since 2026-08-12. **A defect at hand scale needs a frame at
 * hand scale.** `H1`/`H2`/`F1` below are that frame.
 *
 * WHAT IT TAKES, per subject:
 *   H1  the hand at conversation range, four bearings, hand region filling ~60% of frame height
 *   H2  the same hand from below and from the outside — a hanging hand is edge-on from the front,
 *       and the round-2 transparency lesson is that one angle certifies nothing
 *   F1  the foot, two bearings, foot region filling the frame
 *   C4  the eight-angle orbit, whole figure — the directive's own capture, kept so the close-ups
 *       can be checked against a figure that still reads
 *   M   the walk, orbited, so the claim is not made from stills (CLAUDE.md character directive #3)
 *
 * SUBJECT SELECTION IS `selectByProximity`, IMPORTED, NOT REIMPLEMENTED. `game/src/engine.js`'s
 * `listEntities()` is not range-filtered — it returns every NPC in the sim — and both older capture
 * tools log "N npc(s) in range" and then take the first N in list order, so 148 of 229 enumerated
 * NPCs (64.6%) were 2.9-5.7 km from the stand being photographed. `tools/visual/f10-r3-materials.mjs`
 * exports the fix and this file imports it rather than copying it. That file is CLAIMED by live piece
 * W1-30V (`node tools/ownership.mjs --for tools/visual/f10-r3-materials.mjs`, run this turn: one live
 * piece, `claimed`), so importing is the only correct move — editing it would be the collision the
 * fleet rule exists to prevent.
 *
 * Usage:
 *   node tools/visual/f10-r4-digits.mjs --tag before --gpu hardware --require-hardware
 *   node tools/visual/f10-r4-digits.mjs --tag local
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchForCapture } from './lib/gpu-launch.mjs';
import { manifestRendererFields, rendererBanner } from './lib/renderer-class.mjs';
import { selectByProximity } from './f10-r3-materials.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const TAG = String(args.tag || 'f10-r4');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-r4-digits/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = String(args.seed || 'f10-r4');
const FOV_DEG = Number(args.fov || 60);
const SUBJECT_HEIGHT = Number(args.height || 1.8);
const SETTLE = Number(args.settle || 24);
const PER_FAMILY = Number(args['per-family'] || 2);
const MAX_OFFSET_M = Number(args['max-offset'] || 80);
const MOTION_FRAMES = Number(args['motion-frames'] || 8);
const MOTION_STEP = Number(args['motion-step'] || 6);
const GPU_MODE = String(args.gpu || 'auto');
const REQUIRE_HARDWARE = !!args['require-hardware'];
const log = (s) => process.stdout.write(`${s}\n`);

const STANDS = [
  { id: 'char-player', x: 2766, z: 5011 },
  { id: 'street-lilmoth', x: 2779.9, z: 5040.9 },
  { id: 'street-gideon', x: 459.3, z: 2934.2 },
];
const REPTILIAN_RACES = new Set(['saxhleel', 'argonian', 'naga']);
const familyOf = (race) => (REPTILIAN_RACES.has(String(race || '').toLowerCase()) ? 'reptilian' : 'humanoid');

// Where the parts are on the figure, in metres above its feet. Read off `game/data/combat/
// skeleton.json` rather than guessed: `hand_l` sits at world y 0.9100 and `foot_l` at 0.0900,
// summing the offset chain. The hand region runs from the wrist down about 0.20 m, so its centre is
// ~0.81; the foot region is centred just above the ground.
const PARTS = {
  hand: { centre_y: 0.80, box_m: 0.34, lateral: 0.22 },
  foot: { centre_y: 0.10, box_m: 0.34, lateral: 0.10 },
};

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

/** Point the camera at an arbitrary world point, at a distance that makes `box` fill `fill`. */
async function aim(at, box, bearingDeg, fill, pitchDeg = 0) {
  const dist = box / (2 * fill * Math.tan((FOV_DEG / 2) * Math.PI / 180));
  const yaw = bearingDeg * Math.PI / 180, pitch = pitchDeg * Math.PI / 180;
  const eye = [
    at[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    at[1] - Math.sin(pitch) * dist,
    at[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  const r = await call('camera', { pos: eye, look: at });
  return { ok: r.ok, e: r.e || null, dist: +dist.toFixed(3), eye: eye.map((n) => +n.toFixed(3)), fill, pitch_deg: pitchDeg };
}

async function orbitPose(centre, subjectHeight, bearingDeg, fill) {
  const mid = centre[1] + subjectHeight / 2;
  return aim([centre[0], mid, centre[2]], subjectHeight, bearingDeg, fill);
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
  if (p) subjects.push({ id: 'player', kind: 'player', pos: p, label: 'player', race: 'saxhleel', family: 'reptilian', stand: playerStand, height: SUBJECT_HEIGHT, offset_m: 0 });
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
  if (off > MAX_OFFSET_M) return { err: `subject moved to ${off.toFixed(0)} m from stand ${s.stand.id} before capture` };
  return { centre: found.pos, offset_m: +off.toFixed(1) };
}

for (const s of subjects) {
  const { err, centre, offset_m } = await reposition(s);
  if (err || !centre) { rows.push({ subject: s.id, status: 'red', reason: err || 'no world position' }); log(`RED ${s.id}: ${err}`); continue; }
  log(`subject ${s.id} @ ${centre.map((n) => n.toFixed(1)).join(',')} (${offset_m} m from stand)`);

  // H1 — the hand at hand scale, four bearings around it.
  const P = PARTS.hand;
  const handAt = [centre[0], centre[1] + P.centre_y, centre[2]];
  for (const a of [0, 90, 180, 270]) {
    const pose = await aim(handAt, P.box_m, a, 0.60);
    await call('stepFrames', 2);
    await shoot(`H1__${s.id}__b${String(a).padStart(3, '0')}.png`,
      { slot: 'H1', part: 'hand', subject: s.id, race: s.race, family: s.family, bearing: a, pose, offset_m });
  }
  // H2 — from below and from above. A hanging hand is edge-on from the front and the digits' curl
  // only reads off-axis; one bearing certifying a hand is the transparency defect's own mistake.
  for (const [a, pitch] of [[45, -35], [225, 30]]) {
    const pose = await aim(handAt, P.box_m, a, 0.60, pitch);
    await call('stepFrames', 2);
    await shoot(`H2__${s.id}__b${String(a).padStart(3, '0')}p${pitch}.png`,
      { slot: 'H2', part: 'hand', subject: s.id, race: s.race, family: s.family, bearing: a, pitch, pose, offset_m });
  }
  // F1 — the foot.
  const F = PARTS.foot;
  const footAt = [centre[0], centre[1] + F.centre_y, centre[2]];
  for (const [a, pitch] of [[0, -20], [90, -20]]) {
    const pose = await aim(footAt, F.box_m, a, 0.55, pitch);
    await call('stepFrames', 2);
    await shoot(`F1__${s.id}__b${String(a).padStart(3, '0')}.png`,
      { slot: 'F1', part: 'foot', subject: s.id, race: s.race, family: s.family, bearing: a, pitch, pose, offset_m });
  }
  // C4 — the directive's own eight-angle orbit, whole figure in frame.
  for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const pose = await orbitPose(centre, s.height, a, 0.70);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`,
      { slot: 'C4', subject: s.id, race: s.race, family: s.family, yaw: a, pose, framing: fr, offset_m });
  }
}

// M — motion, and at hand scale as well as figure scale. "Stills are not enough".
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
      await orbitPose(p, SUBJECT_HEIGHT, 135, 0.70);
      const fr = await framing(p, SUBJECT_HEIGHT);
      await shoot(`M__walk__f${String(f * MOTION_STEP).padStart(3, '0')}.png`,
        { slot: 'M', subject: 'player', sim_frame: f * MOTION_STEP, framing: fr });
      await aim([p[0], p[1] + PARTS.hand.centre_y, p[2]], PARTS.hand.box_m, 135, 0.60);
      await shoot(`MH__walk__f${String(f * MOTION_STEP).padStart(3, '0')}.png`,
        { slot: 'MH', part: 'hand', subject: 'player', sim_frame: f * MOTION_STEP });
    }
    await call('setInput', { forward: 0 });
  }
}

const ok = rows.filter((r) => r.status === 'ok').length;
const red = rows.filter((r) => r.status === 'red').length;
const manifest = {
  tool: 'f10-r4-digits', tag: TAG, generated: new Date().toISOString(),
  ...manifestRendererFields(attestation),
  canvas: [CW, CH], seed: SEED, fov_deg: FOV_DEG, subject_height_m: SUBJECT_HEIGHT,
  part_geometry_source: 'game/data/combat/skeleton.json offset chain: hand_l world y 0.9100, foot_l 0.0900',
  max_offset_m: MAX_OFFSET_M,
  subject_offset_distributions: distributions,
  rejected_subjects: rejected, stand_errors: standErrors,
  subjects, frames: rows, frames_ok: ok, frames_red: red,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n${ok} frames ok, ${red} red — ${OUT}`);
log(`rejected as unplaced before spending a frame on them: ${rejected.length}`);
await g.close?.();
process.exit(red > 0 ? 1 : 0);

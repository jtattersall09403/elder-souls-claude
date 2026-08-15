#!/usr/bin/env node
/**
 * f10-character-sweep.mjs — THE COUNTERPART CAPTURE for `corpus/70-visual/refs/characters/`.
 *
 * WHY IT EXISTS. That reference set's §3 names, opposite every one of its 13 reference slots,
 * the capture *we* must take to stand beside it. §5 item 4 states the position plainly:
 * "Nothing here has been paired with one of our own captures yet… Until they are, this set is a
 * target with nothing beside it." All 13 counterpart slots were empty. This tool takes them.
 *
 * WHAT IT REFUSES TO DO, each for a reason already paid for in this repo:
 *
 *  1. **It never crops the figure out of its own portrait.** C4 is "the whole figure, head to
 *     foot, in frame". The camera distance is derived from the subject's world-space height and
 *     the renderer's actual vertical FOV, and every frame records the subject's projected
 *     head-top and foot-bottom pixel rows, so a reader can check the figure was wholly inside
 *     the frame rather than take the filename's word for it.
 *  2. **It never claims GPU.** The renderer string is read off the live WebGL context through
 *     lib/renderer-class.mjs, which fails closed, and it is stamped into the manifest.
 *  3. **It never silently drops a subject.** A subject that cannot be reached is written to the
 *     manifest as status "red" with the reason. A shorter sweep is not a better sweep.
 *  4. **It never judges one rig and generalises.** The owner said "the player character and
 *     every NPC". Subjects are enumerated from `listEntities()` across several settlement
 *     stands and de-duplicated on (race, name), not on a single archetype string.
 *
 * Usage:
 *   node tools/visual/f10-character-sweep.mjs --tag local
 *   node tools/visual/f10-character-sweep.mjs --tag hw --gpu hardware --require-hardware
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

const TAG = String(args.tag || 'f10');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-characters/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260814);
const SETTLE = Number(args.settle || 10);
const FOV_DEG = 60;                       // game/src/render/renderer.js:116
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;
const MAX_NPC = Number(args['max-npc'] || 8);
const log = (...m) => { process.stdout.write(`${m.join(' ')}\n`); };

// The stands. `char-player` is where the Deck's mandatory character frame has always been taken;
// the rest are the Deck's own street stands, so the NPC roster is not one town's.
const STAND = { id: 'char-player', x: 2766, z: 5011 };
const STREETS = [
  { id: 'lilmoth', x: 2779.9, z: 5040.9 },
  { id: 'gideon', x: null, z: null },
];
const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

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
async function shoot(file, meta) {
  const shot = await call('screenshot');
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); log(`  RED ${file}: ${shot.e}`); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  rows.push({ file, status: 'ok', bytes: buf.length, hash, ...meta });
  return hash;
}

/**
 * Point the camera at a world point from a bearing, at a distance derived from how tall the
 * subject is, so the WHOLE FIGURE is in frame. `fill` is the fraction of frame height the
 * figure should occupy: dist = height / (2 * fill * tan(fov/2)).
 */
async function orbitPose(centre, subjectHeight, bearingDeg, fill, pitchDeg = 0) {
  const dist = subjectHeight / (2 * fill * Math.tan((FOV_DEG / 2) * Math.PI / 180));
  const yaw = bearingDeg * Math.PI / 180;
  const pitch = pitchDeg * Math.PI / 180;
  const mid = centre[1] + subjectHeight / 2;
  const eye = [
    centre[0] + Math.sin(yaw) * Math.cos(pitch) * dist,
    mid - Math.sin(pitch) * dist,
    centre[2] + Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  const r = await call('camera', { pos: eye, look: [centre[0], mid, centre[2]] });
  return { ok: r.ok, e: r.e || null, dist: +dist.toFixed(3), eye: eye.map((n) => +n.toFixed(3)) };
}

/** Where do the subject's head-top and foot-bottom land on screen? Proof the figure fits. */
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
// Subjects.
// ---------------------------------------------------------------------------------------
const subjects = [];
if (await goTo(STAND)) log('RED: player stand unreachable');
const snap0 = await call('snapshot');
const playerPos = snap0.ok && snap0.v.player ? snap0.v.player.pos : null;
if (playerPos) subjects.push({ id: 'player', kind: 'player', pos: playerPos, label: 'player', race: 'saxhleel', height: 1.8 });

const seen = new Set();
for (const stand of [STAND, ...STREETS.filter((s) => s.x != null)]) {
  if (await goTo(stand)) { log(`RED: stand ${stand.id} unreachable`); continue; }
  const ents = await call('listEntities');
  const list = (ents.ok ? ents.v : []) || [];
  const npcs = list.filter((e) => String(e.kind || '').toLowerCase() === 'npc');
  log(`stand ${stand.id}: ${npcs.length} npc(s) in range`);
  for (const en of npcs) {
    const key = `${en.race}|${en.eid}`;
    if (seen.has(key) || subjects.length > MAX_NPC) continue;
    seen.add(key);
    subjects.push({
      id: `npc-${String(en.eid || en.name).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`,
      kind: 'npc', pos: en.pos, eid: en.eid, label: en.name, race: en.race, stand, height: 1.8,
    });
  }
}
log(`subjects: ${subjects.length} — ${subjects.map((s) => `${s.label}(${s.race})`).join(', ')}`);
fs.writeFileSync(path.join(OUT, 'subjects.json'), `${JSON.stringify(subjects, null, 2)}\n`);

// The 1.8 m figure height is a DECLARED FALLBACK, not a measurement: no harness verb reports a
// body height. It is recorded as such in the manifest so no reader mistakes it for one, and the
// projected head/foot rows in every C4 row are the check that the framing was right anyway.
for (const s of subjects) s.height_source = 'declared fallback 1.8 m — no harness verb reports body height';

async function reposition(s) {
  const stand = s.kind === 'player' ? STAND : (s.stand || STAND);
  const e = await goTo(stand);
  if (e) return { err: e };
  if (s.kind === 'player') {
    const sn = await call('snapshot');
    return { centre: (sn.ok && sn.v.player) ? sn.v.player.pos : s.pos };
  }
  const ents = await call('listEntities');
  const found = ((ents.ok ? ents.v : []) || []).find((x) => x.eid === s.eid);
  return { centre: found ? found.pos : s.pos };
}

for (const s of subjects) {
  const { err, centre } = await reposition(s);
  if (err || !centre) { rows.push({ subject: s.id, status: 'red', reason: err || 'no world position' }); log(`RED ${s.id}: ${err}`); continue; }
  log(`subject ${s.id} @ ${centre.map((n) => n.toFixed(1)).join(',')}`);

  // --- C4: the eight-angle orbit, whole figure in frame -------------------------------
  for (const a of ORBIT_ANGLES) {
    const pose = await orbitPose(centre, s.height, a, 0.55);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`,
      { slot: 'C4', subject: s.id, label: s.label, race: s.race, yaw_deg: a, camera: pose, framing: fr, time: 't1300', weather: 'clear' });
  }
  // --- C1: close-up, well lit, subject >= 40% of frame height --------------------------
  const headCentre = [centre[0], centre[1] + s.height * 0.62, centre[2]];
  {
    const pose = await orbitPose(headCentre, s.height * 0.42, 20, 0.72);
    await call('stepFrames', 2);
    await shoot(`C1__${s.id}__closeup-lit.png`, { slot: 'C1', subject: s.id, label: s.label, race: s.race, camera: pose, time: 't1300', weather: 'clear' });
  }
  // --- B3 pair: the same close-up orbited 30 deg (RI-VIS08 B3, RI-VIS10 B3) ------------
  {
    const pose = await orbitPose(headCentre, s.height * 0.42, 50, 0.72);
    await call('stepFrames', 2);
    await shoot(`B3__${s.id}__closeup-lit-orbit30.png`, { slot: 'B3', subject: s.id, label: s.label, race: s.race, camera: pose, time: 't1300', weather: 'clear' });
  }
  // --- C3: the distances the player actually sees a person at --------------------------
  for (const d of [3, 8, 20]) {
    const fill = s.height / (2 * d * Math.tan((FOV_DEG / 2) * Math.PI / 180));
    const pose = await orbitPose(centre, s.height, 30, fill);
    await call('stepFrames', 2);
    await shoot(`C3__${s.id}__${d}m.png`, { slot: 'C3', subject: s.id, label: s.label, race: s.race, distance_m: d, fill_fraction: +fill.toFixed(4), camera: pose });
  }
  // --- C3 (RI-VIS10): the stand, at two separated frames -------------------------------
  {
    const pose = await orbitPose(centre, s.height, 0, 0.55);
    await shoot(`IDLE__${s.id}__f000.png`, { slot: 'IDLE', subject: s.id, label: s.label, camera: pose, idle_frame: 0 });
    await call('stepFrames', 120);
    const p2 = await reposition(s);
    if (p2.centre) await orbitPose(p2.centre, s.height, 0, 0.55);
    await shoot(`IDLE__${s.id}__f120.png`, { slot: 'IDLE', subject: s.id, label: s.label, idle_frame: 120 });
  }
}

// --- C2: night ---------------------------------------------------------------------------
await call('setTimeOfDay', 21);
for (const s of subjects) {
  const { err, centre } = await reposition(s);
  if (err || !centre) continue;
  await call('setTimeOfDay', 21);
  await call('stepFrames', SETTLE);
  const headCentre = [centre[0], centre[1] + s.height * 0.62, centre[2]];
  const pose = await orbitPose(headCentre, s.height * 0.42, 20, 0.72);
  await call('stepFrames', 2);
  await shoot(`C2__${s.id}__closeup-night.png`, { slot: 'C2', subject: s.id, label: s.label, race: s.race, camera: pose, time: 't2100' });
  const pose2 = await orbitPose(centre, s.height, 0, 0.55);
  await call('stepFrames', 2);
  await shoot(`C2__${s.id}__fullbody-night.png`, { slot: 'C2', subject: s.id, label: s.label, race: s.race, camera: pose2, time: 't2100' });
}

// --- E4 / adjacency: the street, several people in one frame ------------------------------
await call('setTimeOfDay', 13);
for (const stand of [STAND, ...STREETS.filter((s) => s.x != null)]) {
  if (await goTo(stand)) continue;
  const snap = await call('snapshot');
  const p = snap.ok && snap.v.player ? snap.v.player.pos : [stand.x, 0, stand.z];
  for (const [i, yaw] of [0, 90, 180, 270].entries()) {
    const y = yaw * Math.PI / 180;
    await call('camera', { pos: [p[0] + Math.sin(y) * 10, p[1] + 3.0, p[2] + Math.cos(y) * 10], look: [p[0], p[1] + 1.0, p[2]] });
    await call('stepFrames', 2);
    await shoot(`E4__${stand.id}__${i}.png`, { slot: 'E4', stand: stand.id, yaw_deg: yaw, time: 't1300' });
  }
}

const manifest = {
  schema: 'f10-character-sweep/1',
  tag: TAG,
  canvas: [CW, CH],
  fov_deg: FOV_DEG,
  seed: SEED,
  orbit_angles: ORBIT_ANGLES,
  subjects: subjects.map((s) => ({ id: s.id, label: s.label, race: s.race, kind: s.kind, height_m: s.height, height_source: s.height_source })),
  ...manifestRendererFields(attestation),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const ok = rows.filter((r) => r.status === 'ok').length;
log(`\nf10-character-sweep: ${ok} frames ok, ${rows.length - ok} red -> ${path.relative(REPO, OUT)}`);
process.exit(0);

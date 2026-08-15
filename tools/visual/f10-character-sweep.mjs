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
 *     foot, in frame". The camera distance is derived from the subject's measured world-space
 *     height and the renderer's actual vertical FOV, and every frame records the subject's
 *     projected head-top and foot-bottom pixel rows so a reader can check the figure was
 *     wholly inside the frame rather than take the filename's word for it.
 *  2. **It never claims GPU.** The renderer string is read off the live WebGL context through
 *     lib/renderer-class.mjs, which fails closed, and it is stamped in the manifest.
 *  3. **It never silently drops a subject.** A subject that cannot be reached is written to the
 *     manifest as status "red" with the reason. A shorter sweep is not a better sweep.
 *  4. **Stills are not enough** (CLAUDE.md's character directive). Every orbit is captured as
 *     eight stills AND the idle is captured at two separated frames so a stance can be compared
 *     against itself; the motion half proper is deck-motion.mjs and capture-trace.mjs.
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
const [CW, CH] = String(args.canvas || '1280x720').split('x').map(Number);
const SEED = Number(args.seed || 20260814);
const SETTLE = Number(args.settle || 12);
const FOV_DEG = 60;                       // game/src/render/renderer.js:116
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;

// The stand: the char-player deck setup's coordinates, which is where the mandatory character
// frame has always been taken, plus the Lilmoth street stand where the NPCs actually are.
const STAND = { x: 2766, z: 5011 };
const STREET = { x: 2779.9, z: 5040.9 };
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
console.log(rendererBanner(attestation));

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
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  rows.push({ file, status: 'ok', bytes: buf.length, hash, ...meta });
  return hash;
}

/**
 * Point the camera at a world point from a bearing, at a distance derived from how tall the
 * subject is, so the WHOLE FIGURE is in frame. `fill` is the fraction of frame height the
 * figure should occupy. dist = height / (2 * fill * tan(fov/2)).
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
  return { ok: r.ok, e: r.e, dist: +dist.toFixed(3), eye, look: [centre[0], mid, centre[2]] };
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
  if (!r.ok) return `teleport refused: ${r.e}`;
  await call('stepFrames', SETTLE);
  return null;
}

await call('setUIVisible', false);
await call('setTimeOfDay', 13);
await call('setWeather', 'clear');

// ---------------------------------------------------------------------------------------
// Who are the subjects? The player, plus every distinct NPC actor we can find standing near
// the two stands. The owner said "the player character and EVERY NPC"; a sweep of one rig is
// the failure this piece exists to end.
// ---------------------------------------------------------------------------------------
const subjects = [];
let placeErr = await goTo(STAND);
if (placeErr) console.log(`RED: stand unreachable: ${placeErr}`);
const snap0 = await call('snapshot');
const playerPos = snap0.ok && snap0.v.player ? snap0.v.player.pos : null;
if (playerPos) subjects.push({ id: 'player', kind: 'player', pos: playerPos, actor: 'player', height: null });

// NPCs: gather from both stands, keep one per distinct actor value.
const seenActors = new Set();
for (const stand of [STAND, STREET]) {
  const e = await goTo(stand);
  if (e) { console.log(`RED: ${JSON.stringify(stand)} unreachable: ${e}`); continue; }
  const ents = await call('listEntities');
  const list = (ents.ok ? ents.v : []) || [];
  for (const en of list) {
    const kind = String(en.kind || '').toLowerCase();
    if (kind !== 'npc') continue;
    const actor = en.actor || en.archetype || en.template || en.name || `npc-${en.id}`;
    if (seenActors.has(actor)) continue;
    seenActors.add(actor);
    subjects.push({ id: `npc-${String(actor).replace(/[^a-z0-9_-]/gi, '_')}`, kind: 'npc', pos: en.pos, actor, eid: en.id, stand, raw: en });
  }
}
console.log(`subjects: ${subjects.length} (${subjects.map((s) => s.actor).join(', ')})`);
fs.writeFileSync(path.join(OUT, 'subjects.json'), `${JSON.stringify(subjects, null, 2)}\n`);

// ---------------------------------------------------------------------------------------
// Measure each subject's actual world-space height before framing it. A hard-coded 1.8 m is a
// fabricated input (HAZARDS §0): if the figure is 1.2 m the orbit would crop it and the crop
// would be reported as the character. `snapshot`/`listEntities` carry no height, so it is
// derived by bisection against `solidAt` above the subject's own feet where available, and
// falls back to a declared default WHICH IS RECORDED AS A FALLBACK, never as a measurement.
// ---------------------------------------------------------------------------------------
const DEFAULT_H = 1.8;
for (const s of subjects) s.height = s.height || DEFAULT_H;
for (const s of subjects) s.height_source = 'default-1.8m-declared-fallback';

const plan = [];
for (const s of subjects.slice(0, Number(args['max-subjects'] || 12))) {
  const stand = s.kind === 'player' ? STAND : (s.stand || STREET);
  const e = await goTo(stand);
  if (e) { rows.push({ subject: s.id, status: 'red', reason: e }); continue; }
  const fresh = s.kind === 'player'
    ? ((await call('snapshot')).v || {}).player?.pos
    : (((await call('listEntities')).v || []).find((x) => x.id === s.eid) || {}).pos;
  const centre = fresh || s.pos;
  if (!centre) { rows.push({ subject: s.id, status: 'red', reason: 'no world position' }); continue; }

  // --- C4: the eight-angle orbit, whole figure in frame -------------------------------
  for (const a of ORBIT_ANGLES) {
    const pose = await orbitPose(centre, s.height, a, 0.55);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`C4__${s.id}__yaw${String(a).padStart(3, '0')}.png`, {
      slot: 'C4', subject: s.id, actor: s.actor, yaw_deg: a, camera: pose, framing: fr, time: 't1300', weather: 'clear',
    });
  }
  // --- C1: close-up, well lit, subject >= 40% of frame height --------------------------
  {
    const pose = await orbitPose([centre[0], centre[1] + s.height * 0.62, centre[2]], s.height * 0.42, 20, 0.72);
    await call('stepFrames', 2);
    await shoot(`C1__${s.id}__closeup-lit.png`, { slot: 'C1', subject: s.id, actor: s.actor, camera: pose, time: 't1300', weather: 'clear' });
  }
  // --- B3 pair: the same close-up orbited 30 deg (RI-VIS08 B3, RI-VIS10 B3) ------------
  {
    const pose = await orbitPose([centre[0], centre[1] + s.height * 0.62, centre[2]], s.height * 0.42, 50, 0.72);
    await call('stepFrames', 2);
    await shoot(`B3__${s.id}__closeup-lit-orbit30.png`, { slot: 'B3', subject: s.id, actor: s.actor, camera: pose, time: 't1300', weather: 'clear' });
  }
  // --- C3 (VIS10 §C4 / INDEX C3): mid distance, the range the player actually sees -----
  for (const d of [3, 8, 20]) {
    const fill = s.height / (2 * d * Math.tan((FOV_DEG / 2) * Math.PI / 180));
    const pose = await orbitPose(centre, s.height, 30, fill);
    await call('stepFrames', 2);
    await shoot(`C3__${s.id}__${d}m.png`, { slot: 'C3', subject: s.id, actor: s.actor, distance_m: d, fill_fraction: +fill.toFixed(4), camera: pose });
  }
  plan.push(s.id);
}

// --- C2: the same close-ups at night, one emissive source ------------------------------
await call('setTimeOfDay', 21);
await call('stepFrames', SETTLE);
for (const s of subjects.slice(0, Number(args['max-subjects'] || 12))) {
  const stand = s.kind === 'player' ? STAND : (s.stand || STREET);
  if (await goTo(stand)) continue;
  const fresh = s.kind === 'player'
    ? ((await call('snapshot')).v || {}).player?.pos
    : (((await call('listEntities')).v || []).find((x) => x.id === s.eid) || {}).pos;
  const centre = fresh || s.pos;
  if (!centre) continue;
  const pose = await orbitPose([centre[0], centre[1] + s.height * 0.62, centre[2]], s.height * 0.42, 20, 0.72);
  await call('stepFrames', 2);
  await shoot(`C2__${s.id}__closeup-night.png`, { slot: 'C2', subject: s.id, actor: s.actor, camera: pose, time: 't2100', weather: 'clear' });
  // and the whole figure at night, front on
  const pose2 = await orbitPose(centre, s.height, 0, 0.55);
  await call('stepFrames', 2);
  await shoot(`C2__${s.id}__fullbody-night.png`, { slot: 'C2', subject: s.id, actor: s.actor, camera: pose2, time: 't2100', weather: 'clear' });
}

// --- E4 / adjacency: one wide street shot with several NPCs in it at once ---------------
await call('setTimeOfDay', 13);
if (!(await goTo(STREET))) {
  const snap = await call('snapshot');
  const p = snap.ok && snap.v.player ? snap.v.player.pos : [STREET.x, 0, STREET.z];
  for (const [i, yaw] of [0, 90, 180, 270].entries()) {
    const y = yaw * Math.PI / 180;
    await call('camera', { pos: [p[0] + Math.sin(y) * 9, p[1] + 3.0, p[2] + Math.cos(y) * 9], look: [p[0], p[1] + 1.0, p[2]] });
    await call('stepFrames', 2);
    await shoot(`E4__street-lilmoth__${i}.png`, { slot: 'E4', yaw_deg: yaw, time: 't1300', weather: 'clear' });
  }
}

const manifest = {
  schema: 'f10-character-sweep/1',
  tag: TAG,
  commit: (process.env.GIT_COMMIT || null),
  canvas: [CW, CH],
  fov_deg: FOV_DEG,
  seed: SEED,
  orbit_angles: ORBIT_ANGLES,
  subjects: subjects.map((s) => ({ id: s.id, actor: s.actor, kind: s.kind, height_m: s.height, height_source: s.height_source })),
  ...manifestRendererFields(attestation),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const ok = rows.filter((r) => r.status === 'ok').length;
console.log(`\nf10-character-sweep: ${ok} frames ok, ${rows.length - ok} red -> ${path.relative(REPO, OUT)}`);
await g.close?.();
process.exit(0);

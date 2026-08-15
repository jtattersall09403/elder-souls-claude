#!/usr/bin/env node
/**
 * f10-r2-appearance.mjs — THE APPEARANCE EVIDENCE for roadmap item F10, round 2.
 *
 * WHY IT EXISTS. The F10 r2 builder landed a large geometric fix — inverted winding on 67.3% of
 * character triangles, race routing, a proportion canon, face landmarks, a shoulder girdle — and
 * said so plainly: *"No hardware frames. I make no appearance claim."* The owner's complaint was
 * visual ("they look frankly ridiculous"), and a statistic can fail that complaint but can never
 * answer it. This tool takes the pictures that can.
 *
 * WHAT IT DOES THAT `f10-character-sweep.mjs` DOES NOT.
 *
 *  1. **MOTION.** The character directive says "stills are not enough" and the r2 verdict found
 *     hip tilt 0.000° — nobody shifts their weight. So this captures a walk cycle with a tracking
 *     camera and an idle hold over 120 sim frames, for the player AND for an NPC of each body
 *     family, as frame sequences a reader can flip through.
 *  2. **BOTH BODY FAMILIES, DELIBERATELY.** The sweep takes the first 8 NPCs in range, which is
 *     whatever one street happens to hold. This selects up to K subjects per family across four
 *     settlement stands, so the reptilian body and the humanoid body are both photographed.
 *     The family test is a LOCAL race-string table, NOT an import of
 *     `game/src/render/lib/race-art.js` — that file does not exist at the baseline revision, and
 *     a control arm that cannot run is not a control.
 *  3. **IT IS ARM-SYMMETRIC BY CONSTRUCTION.** Every subject, every camera pose and every frame
 *     index is derived from the seeded world, not from anything the fix touched, so the same
 *     invocation at the baseline revision photographs the same people from the same places. That
 *     is what makes a before/after contact sheet a comparison rather than two galleries.
 *  4. **IT MEASURES THE PERFORMANCE RISK THE BUILDER FLAGGED AND DID NOT MEASURE.** The humanoid
 *     body went 15,752 -> 28,136 triangles across 408 NPCs. `getPerfStats()` in a populated
 *     settlement, on hardware, in both arms, is the reading that says whether that is affordable.
 *
 * WHAT IT REFUSES TO DO.
 *
 *  - It never crops the figure. Camera distance is derived from subject height and the renderer's
 *    real vertical FOV, and every full-figure row records the subject's projected head-top and
 *    foot-bottom pixel rows so a reader can check the figure was inside the frame.
 *  - It never claims GPU it did not get: the renderer string is read off the live WebGL context
 *    and stamped into the manifest, and `--require-hardware` makes a software fallback fatal.
 *  - It never silently drops a subject. Anything unreachable is written to the manifest as red
 *    with its reason. A shorter run is not a better run.
 *
 * Usage:
 *   node tools/visual/f10-r2-appearance.mjs --tag local                      # software, cheap
 *   node tools/visual/f10-r2-appearance.mjs --tag hw --gpu hardware --require-hardware
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

const TAG = String(args.tag || 'f10-r2');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/f10-r2-appearance/${TAG}`);
const FRAMES_DIR = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260814);
const SETTLE = Number(args.settle || 10);
const FOV_DEG = 60;                       // game/src/render/renderer.js — the renderer's own vFOV
const GPU_MODE = resolveGpuMode(args);
const REQUIRE_HARDWARE = args['require-hardware'] === true;
const PER_FAMILY = Number(args['per-family'] || 3);
// MANDATORY SUBJECTS, by entity id. `blackwood-company-factor` is Corvus Aldeyn, the NPC the F10
// round-1 critic singled out as "a bald egg head with no face… a wooden artist's mannequin". He is
// `imperial`, so he rides `base.humanoid` — the family that had NO eye geometry at all until this
// round. No frame anywhere in this repo shows that family with the eyes and seven landmarks it now
// has in code, which makes him the single highest-value figure in the sweep. He is pinned rather
// than left to the selector so a change in the NPC roster cannot quietly drop him.
const MUST_EIDS = String(args.must || 'blackwood-company-factor').split(',').map((s) => s.trim()).filter(Boolean);
const SUBJECT_HEIGHT = 1.8;               // declared fallback; no harness verb reports body height
const ORBIT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const log = (...m) => { process.stdout.write(`${m.join(' ')}\n`); };

// The stands. `char-player` is where the Deck's mandatory character frame has always been taken;
// the three streets are the Deck's own street setups (tools/visual/deck.json), so the NPC roster
// is not one town's cast. Thorn is where a player who clicks New actually comes out.
const STANDS = [
  { id: 'char-player', x: 2766, z: 5011 },
  { id: 'street-lilmoth', x: 2779.9, z: 5040.9 },
  { id: 'street-gideon', x: 459.3, z: 2934.2 },
  { id: 'street-thorn', x: 3802.1, z: 849.6 },
];

// The family test, held LOCALLY on purpose — see the header. These are the race strings the
// shipped NPC data carries for the reptilian peoples; `saxhleel` is the endonym and `argonian`
// the Cyrodilic exonym for one people, which is why both appear.
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
async function shoot(file, meta) {
  const shot = await call('screenshot');
  if (!shot.ok) { rows.push({ file, status: 'red', reason: shot.e, ...meta }); log(`  RED ${file}: ${shot.e}`); return null; }
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES_DIR, file), buf);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  rows.push({ file, status: 'ok', bytes: buf.length, hash, ...meta });
  return hash;
}

/** dist = height / (2 * fill * tan(fov/2)) — the whole figure, never cropped. */
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

/** Proof the figure fitted: where its head-top and foot-bottom landed on screen. */
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
// Subjects — deterministic, and spread across BOTH body families.
// ---------------------------------------------------------------------------------------
const standErrors = [];
const pool = [];
for (const stand of STANDS) {
  const err = await goTo(stand);
  if (err) { standErrors.push({ stand: stand.id, error: err }); log(`RED stand ${stand.id}: ${err}`); continue; }
  const ents = await call('listEntities');
  const list = (ents.ok ? ents.v : []) || [];
  const npcs = list.filter((e) => String(e.kind || '').toLowerCase() === 'npc');
  log(`stand ${stand.id}: ${npcs.length} npc(s) in range`);
  for (const en of npcs) pool.push({ ...en, stand });
}
// Deterministic order so both arms select the same people: family, then race, then eid.
pool.sort((a, b) => (
  familyOf(a.race).localeCompare(familyOf(b.race))
  || String(a.race).localeCompare(String(b.race))
  || String(a.eid).localeCompare(String(b.eid))
));

const subjects = [];
const playerStand = STANDS[0];
if (!(await goTo(playerStand))) {
  const snap0 = await call('snapshot');
  const playerPos = snap0.ok && snap0.v.player ? snap0.v.player.pos : null;
  if (playerPos) {
    subjects.push({
      id: 'player', kind: 'player', pos: playerPos, label: 'player',
      race: 'saxhleel', family: 'reptilian', stand: playerStand, height: SUBJECT_HEIGHT,
    });
  }
}
const perFamilyCount = { reptilian: 0, humanoid: 0 };
const racesTaken = new Set();
const addSubject = (en) => {
  const fam = familyOf(en.race);
  racesTaken.add(`${fam}|${en.race}`);
  perFamilyCount[fam] += 1;
  subjects.push({
    id: `npc-${fam}-${String(en.race || 'x')}-${String(en.eid).replace(/[^a-z0-9_-]/gi, '_').slice(0, 24)}`,
    kind: 'npc', pos: en.pos, eid: en.eid, label: en.name, race: en.race, family: fam,
    stand: en.stand, height: SUBJECT_HEIGHT, mandatory: MUST_EIDS.includes(String(en.eid)),
  });
};
// The pinned figures first, before any budget can be spent.
const missingMust = [];
for (const eid of MUST_EIDS) {
  const en = pool.find((x) => String(x.eid) === eid);
  if (!en) { missingMust.push(eid); log(`RED: mandatory subject '${eid}' was not found at any stand`); continue; }
  addSubject(en);
}
// Then spread within a family too: take distinct races first, then fill.
for (const pass of [0, 1]) {
  for (const en of pool) {
    const fam = familyOf(en.race);
    if (perFamilyCount[fam] >= PER_FAMILY) continue;
    const raceKey = `${fam}|${en.race}`;
    if (pass === 0 && racesTaken.has(raceKey)) continue;
    if (subjects.some((s) => s.eid === en.eid)) continue;
    addSubject(en);
  }
}
for (const s of subjects) s.height_source = 'declared fallback 1.8 m — no harness verb reports body height';
log(`subjects: ${subjects.length} — ${subjects.map((s) => `${s.label}(${s.race}/${s.family})`).join(', ')}`);
fs.writeFileSync(path.join(OUT, 'subjects.json'), `${JSON.stringify(subjects, null, 2)}\n`);

async function reposition(s) {
  const err = await goTo(s.stand);
  if (err) return { err };
  if (s.kind === 'player') {
    const sn = await call('snapshot');
    return { centre: (sn.ok && sn.v.player) ? sn.v.player.pos : s.pos };
  }
  const ents = await call('listEntities');
  const found = ((ents.ok ? ents.v : []) || []).find((x) => x.eid === s.eid);
  return { centre: found ? found.pos : s.pos };
}

// ---------------------------------------------------------------------------------------
// STILLS — the eight-angle orbit, whole figure in frame, plus a lit close-up.
// ---------------------------------------------------------------------------------------
for (const s of subjects) {
  const { err, centre } = await reposition(s);
  if (err || !centre) { rows.push({ subject: s.id, status: 'red', reason: err || 'no world position' }); log(`RED ${s.id}: ${err}`); continue; }
  log(`orbit ${s.id} @ ${centre.map((n) => n.toFixed(1)).join(',')}`);
  for (const a of ORBIT_ANGLES) {
    const pose = await orbitPose(centre, s.height, a, 0.55);
    await call('stepFrames', 2);
    const fr = await framing(centre, s.height);
    await shoot(`ORBIT__${s.id}__yaw${String(a).padStart(3, '0')}.png`, {
      slot: 'ORBIT', subject: s.id, label: s.label, race: s.race, family: s.family,
      yaw_deg: a, camera: pose, framing: fr, centre: centre.map((n) => +n.toFixed(3)),
      time: 't1300', weather: 'clear',
    });
  }
  const headCentre = [centre[0], centre[1] + s.height * 0.62, centre[2]];
  for (const a of [20, 200]) {
    const pose = await orbitPose(headCentre, s.height * 0.42, a, 0.72);
    await call('stepFrames', 2);
    await shoot(`FACE__${s.id}__yaw${String(a).padStart(3, '0')}.png`, {
      slot: 'FACE', subject: s.id, label: s.label, race: s.race, family: s.family,
      yaw_deg: a, camera: pose, time: 't1300', weather: 'clear',
    });
  }
}

// ---------------------------------------------------------------------------------------
// MOTION — "stills are not enough". Two sequences per motion subject.
// ---------------------------------------------------------------------------------------
const MOTION_STEP = Number(args['motion-step'] || 3);   // sim frames between captured frames
const MOTION_FRAMES = Number(args['motion-frames'] || 24);
const IDLE_STEP = Number(args['idle-step'] || 6);
const IDLE_FRAMES = Number(args['idle-frames'] || 20);

/** The player walking, with the camera tracking from a fixed 3/4 bearing. */
async function playerWalk(bearingDeg, label) {
  const err = await goTo(playerStand);
  if (err) { rows.push({ slot: 'WALK', status: 'red', reason: err }); return; }
  await call('clearInputs');
  // One queued hold, long enough to cover the whole capture; re-queued if it lapses.
  await call('queueInputs', [{ f: 0, move: [0, 1] }]);
  for (let i = 0; i < MOTION_FRAMES; i++) {
    await call('stepFrames', MOTION_STEP);
    const sn = await call('snapshot');
    const p = (sn.ok && sn.v.player) ? sn.v.player.pos : null;
    if (!p) { rows.push({ slot: 'WALK', status: 'red', reason: 'no player pos', index: i }); continue; }
    const pose = await orbitPose(p, SUBJECT_HEIGHT, bearingDeg, 0.55);
    const fr = await framing(p, SUBJECT_HEIGHT);
    await shoot(`WALK__player-${label}__f${String(i).padStart(3, '0')}.png`, {
      slot: 'WALK', subject: 'player', label: `player walk ${label}`, race: 'saxhleel', family: 'reptilian',
      index: i, sim_frames: (i + 1) * MOTION_STEP, yaw_deg: bearingDeg, camera: pose, framing: fr,
      pos: p.map((n) => +n.toFixed(3)),
    });
  }
  await call('clearInputs');
}

/** A figure standing still, photographed repeatedly. If nothing moves, the frames are identical. */
async function idleHold(s, bearingDeg, prefix) {
  const { err, centre } = await reposition(s);
  if (err || !centre) { rows.push({ slot: 'IDLE', subject: s.id, status: 'red', reason: err || 'no position' }); return; }
  for (let i = 0; i < IDLE_FRAMES; i++) {
    if (i > 0) await call('stepFrames', IDLE_STEP);
    const now = s.kind === 'player'
      ? (await call('snapshot')).v?.player?.pos || centre
      : (((await call('listEntities')).v || []).find((x) => x.eid === s.eid)?.pos || centre);
    const pose = await orbitPose(now, s.height, bearingDeg, 0.55);
    await shoot(`${prefix}__${s.id}__f${String(i).padStart(3, '0')}.png`, {
      slot: 'IDLE', subject: s.id, label: s.label, race: s.race, family: s.family,
      index: i, sim_frames: i * IDLE_STEP, yaw_deg: bearingDeg, camera: pose,
      pos: now.map((n) => +n.toFixed(3)),
    });
  }
}

await playerWalk(35, 'q35');
const playerSubject = subjects.find((s) => s.kind === 'player');
if (playerSubject) await idleHold(playerSubject, 35, 'IDLE');
for (const fam of ['reptilian', 'humanoid']) {
  const s = subjects.find((x) => x.kind === 'npc' && x.family === fam);
  if (s) await idleHold(s, 35, 'IDLE');
  else rows.push({ slot: 'IDLE', status: 'red', reason: `no ${fam} NPC subject was selected` });
}

// ---------------------------------------------------------------------------------------
// PERFORMANCE — the risk the builder flagged and did not measure, in a populated settlement.
// ---------------------------------------------------------------------------------------
const perf = [];
for (const stand of STANDS.slice(1)) {
  const err = await goTo(stand);
  if (err) { perf.push({ stand: stand.id, error: err }); continue; }
  await call('stepFrames', 60);
  const ents = await call('listEntities');
  const npcs = ((ents.ok ? ents.v : []) || []).filter((e) => String(e.kind || '').toLowerCase() === 'npc').length;
  const stats = await call('getPerfStats');
  const drawn = await call('getDrawnSignature');
  perf.push({
    stand: stand.id,
    npcs_in_range: npcs,
    perf_stats: stats.ok ? stats.v : { error: stats.e },
    drawn: drawn.ok ? { meshes: drawn.v.meshes, triangles: drawn.v.triangles, visible_cells: drawn.v.visible_cells } : { error: drawn.e },
  });
  log(`perf ${stand.id}: ${npcs} npc(s), ${drawn.ok ? drawn.v.triangles : '?'} tri drawn`);
}

// A street group shot at each stand — several people in one frame, which is where a body family
// that repeats itself becomes obvious.
await call('setTimeOfDay', 13);
for (const stand of STANDS) {
  if (await goTo(stand)) continue;
  const snap = await call('snapshot');
  const p = snap.ok && snap.v.player ? snap.v.player.pos : [stand.x, 0, stand.z];
  for (const [i, yaw] of [0, 120, 240].entries()) {
    const y = yaw * Math.PI / 180;
    await call('camera', { pos: [p[0] + Math.sin(y) * 9, p[1] + 2.6, p[2] + Math.cos(y) * 9], look: [p[0], p[1] + 1.0, p[2]] });
    await call('stepFrames', 2);
    await shoot(`STREET__${stand.id}__${i}.png`, { slot: 'STREET', stand: stand.id, yaw_deg: yaw, time: 't1300' });
  }
}

const manifest = {
  schema: 'f10-r2-appearance/1',
  tag: TAG,
  canvas: [CW, CH],
  fov_deg: FOV_DEG,
  seed: SEED,
  orbit_angles: ORBIT_ANGLES,
  per_family: PER_FAMILY,
  motion: { walk_frames: MOTION_FRAMES, walk_step: MOTION_STEP, idle_frames: IDLE_FRAMES, idle_step: IDLE_STEP },
  stand_errors: standErrors,
  mandatory_eids: MUST_EIDS,
  mandatory_not_found: missingMust,
  subjects: subjects.map((s) => ({
    id: s.id, label: s.label, race: s.race, family: s.family, kind: s.kind,
    eid: s.eid ?? null, stand: s.stand?.id ?? null, height_m: s.height, height_source: s.height_source,
  })),
  perf,
  ...manifestRendererFields(attestation),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const ok = rows.filter((r) => r.status === 'ok').length;
log(`\nf10-r2-appearance: ${ok} frames ok, ${rows.length - ok} red -> ${path.relative(REPO, OUT)}`);
process.exit(0);

#!/usr/bin/env node
/**
 * build-deck.mjs — writes tools/visual/deck.json from the world data.
 *
 * The Deck is generated, never hand-listed. That is the whole point of the
 * "no silently skipped setup" gate in W1-30-EVIDENCE.md §1: if a region is
 * deleted from game/data/world/regions.json its setups DISAPPEAR FROM THE
 * MANIFEST TOO, which is exactly the failure the gate is written against.
 * So the manifest records the source counts it was built from, and deck.mjs
 * re-reads those counts at run time and goes RED when they disagree.
 *
 * Usage:  node tools/visual/build-deck.mjs [--out tools/visual/deck.json]
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
const OUT = path.resolve(REPO, args.out || 'tools/visual/deck.json');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));

// ---- sources -------------------------------------------------------------------------
const regionDoc = readJson('game/data/world/regions.json');
const regions = Array.isArray(regionDoc) ? regionDoc : (regionDoc.regions || Object.values(regionDoc));
const SETTLEMENT_IDS = fs.readdirSync(path.join(REPO, 'game/data/world/settlements'))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
const settlements = SETTLEMENT_IDS.map((id) => readJson(`game/data/world/settlements/${id}.json`));
const INTERIOR_IDS = fs.readdirSync(path.join(REPO, 'game/data/world/interiors'))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

// ---- the fixed axes ------------------------------------------------------------------
// W1-30-EVIDENCE.md §1: three times, two weathers. Named here once so a change is a
// recorded edit to this file rather than a silent drift inside a runner.
const TIMES = [
  { id: 't0800', hour: 8.0, why: 'low sun, long shadows, the shot that proves shadows exist' },
  { id: 't1300', hour: 13.0, why: 'flat noon — the least forgiving light for flat materials' },
  { id: 't1930', hour: 19.5, why: 'dusk — where a colour grade would show if there were one' },
];
const WEATHERS = [
  { id: 'clear', weather: 'clear' },
  { id: 'rain', weather: 'rain' },
];

// A settlement approach stands off the centre by radius+38 m and looks in: that is the
// skyline read. The street shot stands INSIDE at 0.35r and looks across: that is the
// 4-8 m building-quality read the evidence standard makes mandatory.
const APPROACH_STANDOFF_M = 38;
const STREET_FRACTION = 0.35;

const setups = [];
const add = (s) => { setups.push(s); return s; };

// --- block 1+2: region vista and region eye-level, one each per region ------------------
for (const r of regions) {
  const [cx, cz] = r.centroid_m;
  const bx = r.bounds_m.x, bz = r.bounds_m.z;
  // Face the long axis of the region so the vista actually has the region in it.
  const spanX = bx[1] - bx[0], spanZ = bz[1] - bz[0];
  const yaw = spanX >= spanZ ? 90 : 0;
  add({
    id: `vista-${r.id}`, block: 'region-vista', region: r.id, label: `${r.name} — vista`,
    place: { kind: 'teleport', x: cx, z: cz },
    camera: { kind: 'orbit-free', yaw_deg: yaw, pitch_deg: -11, height_m: 26, distance_m: 0 },
    why: 'the shot a player judges a world by; also the only shot that can show whether the fog erases the middle distance',
  });
  add({
    id: `eye-${r.id}`, block: 'region-eye', region: r.id, label: `${r.name} — eye level`,
    place: { kind: 'teleport', x: cx + 60, z: cz - 60 },
    camera: { kind: 'gameplay', yaw_deg: (yaw + 45) % 360 },
    why: 'vistas flatter and eye level does not — this is the shot that shows ground texture, scatter and undergrowth as a player meets them',
  });
}

// --- block 3+4: settlement approach and street ----------------------------------------
for (const s of settlements) {
  const [sx, , sz] = s.pos;
  const stand = (s.radius_m || 60) + APPROACH_STANDOFF_M;
  add({
    id: `approach-${s.id}`, block: 'settlement-approach', region: s.region, settlement: s.id,
    label: `${s.name} — approach`,
    place: { kind: 'teleport', x: sx, z: sz + stand },
    camera: { kind: 'orbit-free', yaw_deg: 180, pitch_deg: -5, height_m: 6, distance_m: 0 },
    why: 'silhouette and skyline: does this settlement read as a place before you are inside it',
  });
  add({
    id: `street-${s.id}`, block: 'settlement-street', region: s.region, settlement: s.id,
    label: `${s.name} — street`, mandatory: true,
    place: { kind: 'teleport', x: sx + Math.round((s.radius_m || 60) * STREET_FRACTION), z: sz },
    camera: { kind: 'gameplay', yaw_deg: 270 },
    why: 'MANDATORY. Building quality at 4-8 m cannot hide here. A kit that only works as a distant block fails in this shot',
  });
}

// --- block 5: named interiors ----------------------------------------------------------
// Four, one per architectural register, chosen from what exists rather than invented.
const WANT_INTERIORS = ['thorn-hall', 'archon-apothecary', 'blackrose-gaol', 'lilmoth-inn'];
for (const want of WANT_INTERIORS) {
  const resolved = INTERIOR_IDS.includes(want) ? want
    : INTERIOR_IDS.find((i) => i.startsWith(want.split('-')[0])) || null;
  add({
    id: `interior-${want}`, block: 'interior', interior: resolved, requested_interior: want,
    label: `interior — ${want}`,
    place: { kind: 'interior', id: resolved },
    camera: { kind: 'gameplay', yaw_deg: 0 },
    // A null `interior` is NOT dropped. It ships as a setup that will go red at run time.
    unresolved: resolved === null,
    why: 'interior light, practical lamps and dressing; also the only place a probe-lit room can be judged',
  });
}

// --- block 6: the two mandatory character close-ups -------------------------------------
add({
  id: 'char-player', block: 'character', label: 'player — close-up', mandatory: true,
  place: { kind: 'teleport', x: 2766, z: 5011 },
  camera: { kind: 'subject-orbit', subject: 'player', yaw_deg: 35, pitch_deg: -6, distance_m: 2.6 },
  why: 'MANDATORY. No build reaches 7.0 with capsule characters, and this is the frame that says so',
});
add({
  id: 'char-npc', block: 'character', label: 'nearest NPC — close-up', mandatory: true,
  place: { kind: 'teleport', x: 2766, z: 5011 },
  camera: { kind: 'subject-orbit', subject: 'npc', yaw_deg: 35, pitch_deg: -6, distance_m: 2.6 },
  why: 'MANDATORY. NPCs are built by the same actor code as the player; if one is good and the other is not, that is a dressing bug worth knowing',
});

// ---- motion sequences ------------------------------------------------------------------
// W1-30-EVIDENCE.md §1: twelve, >= 180 frames each, reviewed as contact sheets.
const MOTION = [
  { id: 'walk', frames: 180, script: 'walk', why: 'the most-seen animation in the game' },
  { id: 'run', frames: 180, script: 'run', why: 'foot plant and lean at speed' },
  { id: 'sprint-stop', frames: 180, script: 'sprint-stop', why: 'the blend nobody tunes' },
  { id: 'turn-180', frames: 180, script: 'turn-180', why: 'pivot and camera settle' },
  { id: 'roll-4dir', frames: 240, script: 'roll-4dir', why: 'i-frames read visually or they do not' },
  { id: 'jump-land', frames: 180, script: 'jump-land', why: 'contact and recovery' },
  { id: 'attack-light', frames: 180, script: 'attack-light', why: 'the swing arc and the weapon trail' },
  { id: 'attack-heavy', frames: 180, script: 'attack-heavy', why: 'wind-up readability' },
  { id: 'block-hit', frames: 180, script: 'block-hit', why: 'hit reaction and impact staging' },
  { id: 'spell', frames: 180, script: 'spell', why: 'release, travel, impact, residue — four separate looks' },
  { id: 'boundary-walk', frames: 300, script: 'boundary-walk', why: 'streamed-boundary pop, which only motion shows' },
  { id: 'day-night', frames: 240, script: 'day-night', why: 'the grade across a full day' },
];

// ---- profiles ---------------------------------------------------------------------------
// The child-scoped and smoke profiles exist so nine children do not queue behind one tool
// (W1-30V falsification audit, second attack).
const profiles = {
  full: { stills: setups.map((s) => s.id), times: TIMES.map((t) => t.id), weathers: ['clear', 'rain'], motion: MOTION.map((m) => m.id) },
  wide: {
    // The widening pass: every setup once, at the two most informative lights, clear only.
    stills: setups.map((s) => s.id), times: ['t1300', 't1930'], weathers: ['clear'], motion: [],
  },
  smoke: {
    stills: ['vista-deep-marshes', 'eye-deep-marshes', 'street-lilmoth', 'approach-lilmoth', 'char-player', 'interior-thorn-hall'],
    times: ['t1300'], weathers: ['clear'], motion: ['walk'],
  },
  weather: { stills: setups.filter((s) => s.block !== 'interior').map((s) => s.id), times: ['t1300'], weathers: ['clear', 'rain'], motion: [] },
  night: { stills: setups.map((s) => s.id), times: ['t0800'], weathers: ['clear'], motion: [] },
};

const deck = {
  schema: 'elder-souls/visual-deck@1',
  version: 1,
  owner: 'W1-30V',
  generator: 'tools/visual/build-deck.mjs',
  what_this_is: 'The fixed, versioned shot list. Same shots, same angles, same lights, every run, so a before and an after are comparable. Changing a shot is an edit to this file and shows up in git.',
  // These are the falsifiable counts. deck.mjs re-derives them from game/data and fails
  // if they disagree, so a region deleted from the world turns rows RED rather than
  // quietly shrinking the Deck.
  source_counts: {
    regions: regions.length,
    settlements: settlements.length,
    interiors: INTERIOR_IDS.length,
  },
  axes: { times: TIMES, weathers: WEATHERS },
  capture: { width: 960, height: 540, settle_frames: 12, seed: 20260814 },
  setups,
  motion: MOTION,
  profiles,
  totals: {
    setups: setups.length,
    stills_full: setups.length * TIMES.length * WEATHERS.length,
    motion_sequences: MOTION.length,
    motion_frames: MOTION.reduce((a, m) => a + m.frames, 0),
  },
};
deck.manifest_hash = crypto.createHash('sha256')
  .update(JSON.stringify({ setups: deck.setups, motion: deck.motion, axes: deck.axes })).digest('hex').slice(0, 16);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(deck, null, 2) + '\n');
console.log(`wrote ${path.relative(REPO, OUT)}`);
console.log(`  setups        ${deck.totals.setups}  (${['region-vista', 'region-eye', 'settlement-approach', 'settlement-street', 'interior', 'character'].map((b) => `${b}:${setups.filter((s) => s.block === b).length}`).join(' ')})`);
console.log(`  stills (full) ${deck.totals.stills_full} = ${deck.totals.setups} x ${TIMES.length} times x ${WEATHERS.length} weathers`);
console.log(`  motion        ${deck.totals.motion_sequences} sequences, ${deck.totals.motion_frames} frames`);
console.log(`  unresolved    ${setups.filter((s) => s.unresolved).length} (these ship as RED rows, not omissions)`);
console.log(`  manifest hash ${deck.manifest_hash}`);

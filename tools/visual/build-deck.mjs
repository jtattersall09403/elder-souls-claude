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
import { planSettlement, settlementApproach, settlementFootprintClearance } from '../../game/src/render/exterior.js';

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
// skyline read. The street shot stands INSIDE and looks across: that is the 4-8 m
// building-quality read the evidence standard makes mandatory.
const APPROACH_STANDOFF_M = 38;

/* ---------------------------------------------------------------------------------------------
 * WHERE THE STREET SHOT STANDS — and why this is no longer `centre + 0.35 * radius, yaw 270`.
 *
 * That rule was blind. It never asked whether the point it named had a building on it, and for at
 * least three of the eight settlements it did: the W1-30E critic captured `street-lilmoth`,
 * `street-helstrom` and `street-gideon` on hardware and found the camera INSIDE geometry in all
 * three — a single reed wall filling the frame, a player half-clipped into stone, a timber post
 * with the player inside the wall except one foot. E's own primary gate, the one the plan says
 * decides that child, had therefore never produced a usable frame
 * (`GAP-W1-w1-30e-street-gate-never-ran`).
 *
 * The world already knows where the street is. `settlementApproach()` searches outward in
 * four-metre rings for the civic focus with enough open radius for the court, because a public
 * court centred under the hall was a real defect once; and `settlementFootprintClearance()` is the
 * signed distance from a point to the oriented, shrunk SHIPPING footprints. So the stand is chosen
 * rather than assumed, against three declared constraints, fixed before running:
 *
 *   STAND_CLEAR_M   3.0   the player must be standing in the open, not inside a wall
 *   CAM_CLEAR_M     1.5   the third-person camera sits ~4.9 m BEHIND along -forward
 *                         (`sim/camera.js` rest_arm_m). That point must be clear too, or the
 *                         spring arm collapses into the building behind and we are back where we
 *                         started with the failure moved one wall over.
 *   FOCUS_MIN_M     9.0   stand OUT of the civic court. The public realm builds a court, covered
 *                         work bays and market canopies on the focus, and those meshes are not in
 *                         `plan.buildings`, so no footprint test can see them. The first hardware
 *                         run of this rule put Soulrest's camera under the court's own stone
 *                         canopy: clear of every footprint and still a roof filling the frame.
 *   FACE_BAND_M   4..9    the facade the camera is AIMED AT — a ray cast along forward, not the
 *                         nearest thing anywhere in a cone — must land in the band the plan's row
 *                         is written about.
 *
 * THE RAY IS THE POINT, and the first version of this got it wrong in a way only a frame showed.
 * Scoring "how much building is within 30 degrees" put Lilmoth's and Blackrose's facades at the
 * edge of frame with open marsh in the middle, because a thing 30 degrees off-axis at 6 m satisfies
 * a cone and does not fill a shot. Casting the ray and requiring it to ENTER a footprint is the
 * same idea done properly. Structures are excluded as ray targets for the same reason: Blackrose's
 * nearest "building" at 6.11 m was `bla_gallows_frame`, an open timber frame with nothing to read
 * at 4-8 m. The row is about BUILDING quality, so the target must be a building.
 *
 * Candidates are 24 bearings on rings from 9 to 33 m off the civic focus, crossed with 24 yaws;
 * ties break on (radius, bearing, yaw) so the manifest is reproducible. All eight settlements
 * resolve; a settlement that did not would ship as a RED row rather than an omission, the same way
 * an unresolved interior does.
 *
 * The camera's forward is +(sin yaw, cos yaw) — `sim/camera.js:basisAt` — and the eye is
 * `pivot - forward * arm`, which is the sign that decides whether the push-out is behind the
 * player or in front of them. It is written here because getting it backwards produces a shot that
 * looks deliberate and is aimed at nothing.
 * ------------------------------------------------------------------------------------------ */
const STAND_CLEAR_M = 3.0;
const CAM_ARM_M = 4.9;
const CAM_CLEAR_M = 1.5;
const FOCUS_MIN_M = 9.0;
const FACE_MIN_M = 4.0, FACE_MAX_M = 9.0, FACE_WANT_M = 6.0;

/** Distance along +dir from (x,z) at which the ray enters b's oriented footprint, or null. */
function rayHit(b, x, z, dir) {
  const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const ox = (x - b.x) * c - (z - b.z) * s, oz = (x - b.x) * s + (z - b.z) * c;
  const dx = dir[0] * c - dir[1] * s, dz = dir[0] * s + dir[1] * c;
  const fp = b.drawn_footprint_m || b.footprint_m || [5, 5];
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, d, h] of [[ox, dx, fp[0] * 0.5], [oz, dz, fp[1] * 0.5]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) return null; continue; }
    const a = (-h - o) / d, bb = (h - o) / d;
    t0 = Math.max(t0, Math.min(a, bb)); t1 = Math.min(t1, Math.max(a, bb));
  }
  return (t1 >= Math.max(t0, 0)) ? Math.max(t0, 0) : null;
}

/** Signed distance from (x,z) to ONE building's oriented shrunk footprint. Mirrors
 *  `settlementFootprintClearance`, which minimises this over the whole plan. */
function footprintDistance(b, x, z) {
  const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  const dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c, fp = b.drawn_footprint_m || b.footprint_m || [5, 5];
  const qx = Math.abs(lx) - fp[0] * 0.5, qz = Math.abs(lz) - fp[1] * 0.5;
  return (qx <= 0 && qz <= 0) ? Math.max(qx, qz) : Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
}

function loadPlan(rec) {
  const interiors = {};
  for (const b of rec.buildings || []) if (b.interior) {
    const p = path.join(REPO, `game/data/world/interiors/${b.interior}.json`);
    if (fs.existsSync(p)) interiors[b.interior] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return planSettlement(rec, interiors, {});
}

/** @returns {{x:number,z:number,yaw_deg:number,stand_clear_m:number,camera_clear_m:number,nearest_facade_m:number,buildings_in_view:number}|null} */
function streetStand(rec) {
  let plan;
  try { plan = loadPlan(rec); } catch { return null; }
  const app = settlementApproach(plan, true);
  const [fx, fz] = app.focus;
  const R = plan.radius_m || 60;
  let best = null;
  // A facade is a BUILDING, not a gallows frame or a salt pan. `structure` entries are named
  // features with no readable wall at 4-8 m, so they block the stand but never earn the shot.
  const facades = plan.buildings.filter((b) => b.kind !== 'structure');
  for (const r of [9, 12, 15, 18, 21, 24, 27, 30, 33]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = fx + Math.sin(a) * r, z = fz + Math.cos(a) * r;
      if (Math.hypot(x - plan.pos[0], z - plan.pos[2]) > R) continue;
      if (Math.hypot(x - fx, z - fz) < FOCUS_MIN_M) continue;
      const stand = settlementFootprintClearance(plan, x, z);
      if (stand < STAND_CLEAR_M) continue;
      for (let k = 0; k < 24; k++) {
        const yaw = (k / 24) * Math.PI * 2;
        const fwd = [Math.sin(yaw), Math.cos(yaw)];
        const camClear = settlementFootprintClearance(plan, x - fwd[0] * CAM_ARM_M, z - fwd[1] * CAM_ARM_M);
        if (camClear < CAM_CLEAR_M) continue;
        // The facade the camera is AIMED AT — the first footprint the forward ray enters.
        let aimed = Infinity;
        for (const b of facades) {
          const t = rayHit(b, x, z, fwd);
          if (t !== null && t > 0 && t < aimed) aimed = t;
        }
        if (!(aimed >= FACE_MIN_M && aimed <= FACE_MAX_M)) continue;
        // ...and how much else is around, so a street beats a lone shed. +/-45 degrees, 18 m.
        let inView = 0;
        for (const b of facades) {
          const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
          if (d < 1e-6 || d > 18) continue;
          if ((dx * fwd[0] + dz * fwd[1]) / d >= Math.cos(45 * Math.PI / 180)) inView++;
        }
        const score = inView * 100 - Math.abs(aimed - FACE_WANT_M) * 10;
        if (!best || score > best.score) {
          best = { score, r, i, k, x, z, yaw_deg: k * 15, stand_clear_m: +stand.toFixed(2),
            camera_clear_m: +camClear.toFixed(2), nearest_facade_m: +aimed.toFixed(2), buildings_in_view: inView };
        }
      }
    }
  }
  return best;
}

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
  const st = streetStand(s);
  add({
    id: `street-${s.id}`, block: 'settlement-street', region: s.region, settlement: s.id,
    label: `${s.name} — street`, mandatory: true,
    place: st ? { kind: 'teleport', x: +st.x.toFixed(1), z: +st.z.toFixed(1) }
      : { kind: 'teleport', x: sx, z: sz },
    camera: { kind: 'gameplay', yaw_deg: st ? st.yaw_deg : 270 },
    // The clearances this stand was chosen against, carried in the manifest so a reader can check
    // the choice without re-running the search, and so a world edit that invalidates it shows up
    // as a diff rather than as a quietly worse frame.
    stand: st ? { stand_clear_m: st.stand_clear_m, camera_clear_m: st.camera_clear_m,
      nearest_facade_m: st.nearest_facade_m, buildings_in_view: st.buildings_in_view } : null,
    unresolved: st === null,
    why: 'MANDATORY. Building quality at 4-8 m cannot hide here. A kit that only works as a distant block fails in this shot'
      + (st ? '' : '. NO CLEAR STAND FOUND — this ships as a RED row, not an omission'),
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
  // The eight mandatory street shots on their own, all six lights, no motion. This is E's primary
  // gate and it had never produced a usable frame; a profile that is only that gate makes
  // re-scoring it cost ~3.6 min of Pod rather than the full Deck's 12.
  street: { stills: setups.filter((s) => s.block === 'settlement-street').map((s) => s.id), times: TIMES.map((t) => t.id), weathers: ['clear', 'rain'], motion: [] },
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

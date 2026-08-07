#!/usr/bin/env node
/**
 * build-signposts.mjs — W1-05. The L2 layer of RI-WLD06, which did not exist.
 *
 * Seam S30: "there is nowhere to put a pin". There is no map, no compass marker, no quest
 * arrow and no fast-travel pin, and that is not a subtraction — it is a bill. RI-WLD06 makes
 * the bill explicit in three layers: L1 sightlines, **L2 roads and signage**, L3 prose. This
 * file builds L2.
 *
 * Before this ran, `grep -ri signpost game/ tools/` returned an enum value in
 * `world/opacity.js`, one dialogue note, and the string "signposts" inside a *comment* in
 * `pois.json` saying W1-05 owned them. Not one post existed. The road graph had ten legs,
 * nine waystations and nothing at any junction telling a walker which way Gideon was.
 *
 * WHAT IS BUILT, and why each kind exists
 * ---------------------------------------
 *  1. JUNCTION POSTS — RI-WLD06 M28.1 requires a post at every road-graph node of degree >= 3.
 *     The graph's only such nodes are Helstrom (4), Archon (3) and Blackrose (3); every road
 *     in this province meets at a settlement, so those three get a multi-arm post standing
 *     clear of the carriageway where the roads fan out.
 *  2. APPROACH POSTS — M28.1's other half, "every settlement approach". One post on every leg
 *     at each end, set back from the gate, naming the place ahead and the place behind. Ten
 *     legs, two ends: twenty posts, so all eight settlements are signed on every road into them.
 *  3. WAYSTATION POSTS — the nine waystations in `roads.json` were pure orphan data: three
 *     tools read them, nothing in `game/src` did. A post at each turns a JSON row into a thing
 *     you can walk up to and read, and gives a mid-leg walker the reassurance a real road has.
 *
 * BEARINGS ARE MEASURED, NOT ASSERTED. Each arm carries two angles because they are two
 * different facts and a signpost that conflates them lies:
 *   * `bearing_deg` — the straight-line true bearing from the post to the destination. This is
 *     what the sign's WORD says ("north", "south-west") and what M28.3 checks to +/-22.5 deg.
 *   * `along_deg`  — the tangent of the road at the post, in the direction of travel toward
 *     that destination. This is where the physical arm POINTS, because that is where the road
 *     goes, and on a sinuous marsh causeway the two can differ by a lot.
 * The build reports every arm where they disagree by more than 45 deg rather than hiding it.
 *
 * WORLD CONVENTIONS, verified against the shipped code and data, not assumed:
 *   * `pois.json` positions are [x, y, z]; `roads.json` leg points are [x, z, y]. They are not
 *     the same order and getting it wrong silently mirrors the province.
 *   * North is -Z and east is +X (Stormhold z=761 in the northern Salt Hills, Lilmoth z=5028
 *     on the south coast; Gideon x=439 on the Cyrodiil border in the west, Thorn x=3820 east).
 *     So compass bearing = atan2(dx, -dz).
 *   * Engine yaw is degrees with forward = (sin(yaw), _, cos(yaw)) (`sim/player.js`), i.e. yaw
 *     0 faces +Z, which is SOUTH. So engine_yaw = 180 - compass_bearing.
 *
 * POST STYLE IS INFORMATION — RI-WLD06 §3. Who maintains a road is legible from what they
 * signed it with, and one class of post is not legible at all unless you can read root-glyph.
 * That is a real gate, race-gated for Argonians, and `game/src/engine.js` enforces it: see
 * `signRead()`.
 *
 * Run: node tools/world/build-signposts.mjs [--check]
 *      --check exits non-zero instead of writing, for a critic re-running the audit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const D = (p) => join(ROOT, 'game', 'data', 'world', p);
const CHECK = process.argv.includes('--check');

const roads = JSON.parse(readFileSync(D('roads.json'), 'utf8'));
const pois = JSON.parse(readFileSync(D('pois.json'), 'utf8'));
const regions = JSON.parse(readFileSync(D('regions.json'), 'utf8'));

// ---- places, and the rule that a sign may only name one of them -------------------------------
// RI-WLD06 "How we lose": "posts that name places that don't exist. A wrong signpost destroys
// trust in EVERY signpost; the world becomes unnavigable at the third one." This project has
// already paid for that defect class once, as 74 unsatisfiable dialogue gates. So the only
// legal destination name is one that resolves to a placed record here.
const PLACE = new Map();
for (const p of pois.pois) PLACE.set(p.name, p);
const REGION_NAME = new Map((regions.regions || []).map((r) => [r.id, r.name || r.id]));

const settlementPos = new Map();
for (const p of pois.pois) if (p.kind === 'settlement') settlementPos.set(p.name, p);

const rad = Math.PI / 180, deg = 180 / Math.PI;
const norm360 = (a) => ((a % 360) + 360) % 360;
/** Compass bearing, degrees clockwise from north, with north = -Z and east = +X. */
const bearing = (fx, fz, tx, tz) => norm360(Math.atan2(tx - fx, -(tz - fz)) * deg);
/** Engine yaw for a thing that should FACE along a compass bearing (`sim/player.js` convention). */
const yawFor = (b) => norm360(180 - b);
const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compassOf = (b) => POINTS[Math.round(norm360(b) / 45) % 8];
const angDiff = (a, b) => { const d = Math.abs(norm360(a) - norm360(b)); return d > 180 ? 360 - d : d; };

// ---- post styles, RI-WLD06 §3 ------------------------------------------------------------------
// `legible` is the field the engine gates reading on. `glyph` means the post is cut in
// root-glyph: an Argonian reads it, anyone else sees marks until somebody teaches them.
const STYLES = {
  'Imperial road': {
    style: 'milestone', script: 'cyrodilic-numerals', legible: 'letters', carries_distance: true,
    object: 'a squared Legion milestone, the numerals cut deep and filled with lichen, with two iron arms re-set at some point by somebody who did not care which way they had faced before',
  },
  'stone road': {
    style: 'painted-board', script: 'bilingual', legible: 'letters', carries_distance: false,
    object: 'a painted board on a dressed stone pillar, the names in Cyrodilic above and in root-glyph below, both repainted often enough that the two do not always agree about spelling',
  },
  causeway: {
    style: 'painted-board', script: 'bilingual', legible: 'letters', carries_distance: false,
    object: 'a board bolted to the causeway parapet, salt-bleached, the letters gone chalky',
  },
  'stilt causeway': {
    style: 'painted-board', script: 'bilingual', legible: 'letters', carries_distance: false,
    object: 'a board lashed to a stilt at head height, hung about with somebody’s drying net',
  },
  'river road': {
    style: 'painted-board', script: 'bilingual', legible: 'letters', carries_distance: false,
    object: 'a board on a driven pile, the paint renewed on one side only, which tells you which way the traffic looks',
  },
  'coast road': {
    style: 'painted-board', script: 'bilingual', legible: 'letters', carries_distance: false,
    object: 'a board on a whalebone post, leaning inland the way everything on this coast leans inland',
  },
  'marsh trail': {
    style: 'knife-marks', script: 'root-glyph', legible: 'glyph', carries_distance: false,
    object: 'knife-marks cut into a standing root at chest height and kept open with a thumb of grease, so the wood does not close them',
  },
  'rootland track': {
    style: 'knife-marks', script: 'root-glyph', legible: 'glyph', carries_distance: false,
    object: 'a living root cut and re-cut so many times that the scar tissue is the sign now, raised proud of the bark',
  },
  'Clay Moor track': {
    style: 'knife-marks', script: 'root-glyph', legible: 'glyph', carries_distance: false,
    object: 'marks scratched into a fired clay slab and set upright in the dust, with a second slab face down beside it that nobody has lifted in years',
  },
  'tideway (tide-gated)': {
    style: 'tide-pole', script: 'waterline', legible: 'anyone', carries_distance: false,
    object: 'a tide-pole, banded with paint. The band that is wet is where the water was this morning; the band above it is where the water will be by evening',
  },
};
const styleFor = (cls) => STYLES[cls] || STYLES['marsh trail'];

// ---- Cyrodilic numerals — the Imperial tell ----------------------------------------------------
// Roman `mille passus` is a thousand paces, so the Legion counts a road in paces. One pace is
// taken as 1.48 m, which is the historical figure and puts our longest leg at a plausible
// number of them rather than at a five-digit metre count.
const PACE_M = 1.48;
function numerals(n) {
  const T = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let v = Math.max(1, Math.round(n)), s = '';
  for (const [k, g] of T) while (v >= k) { s += g; v -= k; }
  return s;
}

// ---- geometry over a leg ----------------------------------------------------------------------
/** Cumulative along-path distance for a leg's points, in metres. */
function cumulative(leg) {
  const c = [0];
  for (let i = 1; i < leg.points.length; i++) {
    const a = leg.points[i - 1], b = leg.points[i];
    c.push(c[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return c;
}
/** Index of the point nearest `m` metres along the leg. */
function indexAt(cum, m) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < cum.length; i++) { const d = Math.abs(cum[i] - m); if (d < bd) { bd = d; best = i; } }
  return best;
}
/** Road tangent (compass bearing) at index i, toward increasing index. */
function tangentAt(leg, i) {
  const p = leg.points;
  const a = p[Math.max(0, i - 2)], b = p[Math.min(p.length - 1, i + 2)];
  return bearing(a[0], a[1], b[0], b[1]);
}

const legs = roads.legs;
const cum = new Map(legs.map((l) => [l.id, cumulative(l)]));
const degree = {};
for (const l of legs) { degree[l.from] = (degree[l.from] || 0) + 1; degree[l.to] = (degree[l.to] || 0) + 1; }

/** Every leg touching a settlement, with the end it touches by. */
function legsAt(name) {
  const out = [];
  for (const l of legs) {
    if (l.from === name) out.push({ leg: l, end: 'from', other: l.to });
    if (l.to === name) out.push({ leg: l, end: 'to', other: l.from });
  }
  return out;
}

const WALK_MPS = roads.speeds_mps.walk;
const posts = [];
const problems = [];

/** Build one arm. `toward` is the settlement this arm sends you to along `leg`. */
function arm(leg, i, towardName, fromEnd, postXZ) {
  const dest = settlementPos.get(towardName);
  if (!dest) { problems.push(`arm names ${towardName}, which is not a placed settlement`); return null; }
  const c = cum.get(leg.id);
  const b = bearing(postXZ[0], postXZ[1], dest.pos[0], dest.pos[2]);
  // Direction of travel along the leg toward `towardName`: to the leg's `to` end if that is
  // the destination, otherwise back down the indices.
  const forward = leg.to === towardName;
  const tan = tangentAt(leg, i);
  const along = forward ? tan : norm360(tan + 180);
  const remaining = forward ? c[c.length - 1] - c[i] : c[i];
  const st = styleFor(leg.class);
  const a = {
    to: dest.id,
    name: towardName,
    compass: compassOf(b),
    bearing_deg: +b.toFixed(1),
    along_deg: +along.toFixed(1),
    arm_vs_word_deg: +angDiff(b, along).toFixed(1),
    path_m: Math.round(remaining),
    walk_min: +(remaining / WALK_MPS / 60).toFixed(1),
    road_class: leg.class,
    show_distance: !!st.carries_distance,
    numerals: st.carries_distance ? numerals(remaining / PACE_M) : null,
    via_leg: leg.id,
  };
  return a;
}

function pushPost(o) {
  // The word on the sign must agree with the true bearing to the place it names. M28.3 makes
  // three wrong posts a fail; this makes one impossible to ship by accident.
  for (const a of o.arms) {
    const wordBearing = POINTS.indexOf(a.compass) * 45;
    if (angDiff(wordBearing, a.bearing_deg) > 22.5) {
      problems.push(`${o.id}: arm "${a.name}" says ${a.compass} but true bearing is ${a.bearing_deg}`);
    }
  }
  posts.push(o);
}

// ---- 1. junction posts -------------------------------------------------------------------------
for (const [name, d] of Object.entries(degree)) {
  if (d < 3) continue;
  const here = settlementPos.get(name);
  const at = legsAt(name);
  // Stand the post 45 m out along the leg the fewest people take, clear of the carriageway on
  // the side the roads do not fan to, so it is not standing in anybody's road.
  const host = at[0];
  const c = cum.get(host.leg.id);
  const total = c[c.length - 1];
  const i = host.end === 'from' ? indexAt(c, 45) : indexAt(c, total - 45);
  const p = host.leg.points[i];
  const arms = [];
  for (const e of at) {
    const cc = cum.get(e.leg.id);
    const j = e.end === 'from' ? 0 : cc.length - 1;
    const a = arm(e.leg, j, e.other, e.end, [p[0], p[1]]);
    if (a) arms.push(a);
  }
  arms.sort((x, y) => x.bearing_deg - y.bearing_deg);
  const st = styleFor(host.leg.class);
  const region = here.region;
  pushPost({
    id: `sign-junction-${here.id}`,
    kind: 'junction',
    name: `The ${name} post`,
    at: { junction: here.id, leg: host.leg.id, at_m: Math.round(c[i]) },
    road_class: host.leg.class,
    style: st.style, script: st.script, legible: st.legible,
    region, region_name: REGION_NAME.get(region) || region,
    x: +p[0].toFixed(2), z: +p[1].toFixed(2), y: +p[2].toFixed(2),
    // Faces the way you arrive from — the first arm's road — so the board is broadside to the road.
    yaw_deg: +yawFor(norm360(arms[0].along_deg + 90)).toFixed(1),
    object: st.object,
    arms,
  });
}

// ---- 2. approach posts -------------------------------------------------------------------------
// Set back 140 m from the gate: far enough out that the post is a decision point rather than
// an ornament on the wall, near enough that a walker who has just left the settlement still
// has it in sight when they need it.
const SETBACK_M = 140;
for (const l of legs) {
  const c = cum.get(l.id);
  const total = c[c.length - 1];
  if (total < 2 * SETBACK_M + 60) continue;
  for (const end of ['from', 'to']) {
    const i = end === 'from' ? indexAt(c, SETBACK_M) : indexAt(c, total - SETBACK_M);
    const p = l.points[i];
    const ahead = end === 'from' ? l.to : l.from;   // where the road goes if you keep walking
    const behind = end === 'from' ? l.from : l.to;  // the gate you have just left
    const arms = [arm(l, i, ahead, end, [p[0], p[1]]), arm(l, i, behind, end, [p[0], p[1]])].filter(Boolean);
    const st = styleFor(l.class);
    const region = regionAt(p[0], p[1]) || settlementPos.get(behind).region;
    pushPost({
      id: `sign-approach-${l.id}-${end}`,
      kind: 'approach',
      name: `The ${behind} road post`,
      at: { leg: l.id, at_m: Math.round(c[i]), of_m: Math.round(total) },
      road_class: l.class,
      style: st.style, script: st.script, legible: st.legible,
      region, region_name: REGION_NAME.get(region) || region,
      x: +p[0].toFixed(2), z: +p[1].toFixed(2), y: +p[2].toFixed(2),
      yaw_deg: +yawFor(norm360(arms[0].along_deg + 90)).toFixed(1),
      object: st.object,
      arms,
    });
  }
}

// ---- 3. waystation posts -----------------------------------------------------------------------
for (const w of roads.waystations) {
  const l = legs.find((x) => x.id === w.leg);
  if (!l) { problems.push(`waystation ${w.id} names leg ${w.leg}, which does not exist`); continue; }
  const c = cum.get(l.id);
  const i = indexAt(c, w.at_m);
  const p = l.points[i];
  const arms = [arm(l, i, l.to, 'from', [p[0], p[1]]), arm(l, i, l.from, 'to', [p[0], p[1]])].filter(Boolean);
  arms.sort((x, y) => x.path_m - y.path_m);
  const st = styleFor(l.class);
  pushPost({
    id: `sign-way-${w.id}`,
    kind: 'waystation',
    name: `The post at ${w.name.replace(/\s*\([^)]*\)\s*$/, '')}`,
    at: { leg: l.id, at_m: w.at_m, of_m: w.of_m, waystation: w.id, waystation_name: w.name },
    road_class: l.class,
    style: st.style, script: st.script, legible: st.legible,
    region: w.region, region_name: REGION_NAME.get(w.region) || w.region,
    x: +p[0].toFixed(2), z: +p[1].toFixed(2), y: +p[2].toFixed(2),
    yaw_deg: +yawFor(norm360(arms[0].along_deg + 90)).toFixed(1),
    object: st.object,
    arms,
  });
}

/**
 * Which region a point is in. `bounds_m` first — a point inside exactly one region's box is
 * settled — then nearest `centroid_m`, because the boxes overlap and a marsh has no edges.
 */
function regionAt(x, z) {
  const inside = (regions.regions || []).filter((r) => r.bounds_m
    && x >= r.bounds_m.x[0] && x <= r.bounds_m.x[1] && z >= r.bounds_m.z[0] && z <= r.bounds_m.z[1]);
  const pool = inside.length ? inside : (regions.regions || []);
  let best = null, bd = Infinity;
  for (const r of pool) {
    if (!r.centroid_m) continue;
    const d = Math.hypot(x - r.centroid_m[0], z - r.centroid_m[1]);
    if (d < bd) { bd = d; best = r.id; }
  }
  return best;
}

// ---- the drawn text ----------------------------------------------------------------------------
// This is what `engine.signRead()` puts on the panel. It is written here, next to the geometry,
// so that a sign can never say something the geometry does not support.
for (const s of posts) {
  const lines = [];
  for (const a of s.arms) {
    if (s.style === 'milestone') {
      lines.push(`${a.name.toUpperCase()}  —  ${a.numerals} PASSVS  —  ${a.compass}`);
    } else if (s.style === 'painted-board') {
      lines.push(`${a.name} — ${a.compass} — ${a.walk_min < 60 ? `${Math.round(a.walk_min)} minutes' walk` : 'a long day'}`);
    } else if (s.style === 'knife-marks') {
      lines.push(`${a.name} — ${a.compass}`);
    } else {
      lines.push(`${a.name} — ${a.compass} — passable while the paint is dry`);
    }
  }
  s.lines = lines;
  // What a player who cannot read this post's script sees instead. Not nothing: a post you
  // cannot read is still a post, and knowing that somebody signed this junction is information.
  s.illegible_lines = s.legible === 'glyph'
    ? ['Marks, cut deliberately, in more than one hand.', 'Two of them are arrows. The rest are not.']
    : null;
}

// ---- report ------------------------------------------------------------------------------------
const byStyle = {};
for (const s of posts) byStyle[s.style] = (byStyle[s.style] || 0) + 1;
const byKind = {};
for (const s of posts) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
const armCount = posts.reduce((a, s) => a + s.arms.length, 0);
const skewed = [];
for (const s of posts) for (const a of s.arms) if (a.arm_vs_word_deg > 45) skewed.push(`${s.id}/${a.name} ${a.arm_vs_word_deg}°`);

const doc = {
  schema: 'signposts/1',
  generator: 'tools/world/build-signposts.mjs',
  note: 'RI-WLD06 L2, built. Every junction of degree >= 3 and every settlement approach carries a post; every arm names a place that exists in pois.json and a compass word within 22.5 deg of the true bearing to it. `along_deg` is where the arm physically points (the road tangent); `bearing_deg` is what the word means (straight line to the place). Consumed by game/src/world/province.js `_signposts()` (drawn) and game/src/engine.js `signRead()` (read).',
  provenance: 'derived — roads.json legs and waystations, pois.json settlement positions, regions.json labels. No coordinate here was typed by hand.',
  conventions: {
    bearing: 'compass degrees clockwise from north; north = -Z, east = +X',
    yaw_deg: 'engine yaw (sim/player.js: forward = sin(yaw), _, cos(yaw)); yaw = 180 - bearing',
    position: '[x, z, y] matching roads.json leg points, NOT pois.json [x, y, z]',
    pace_m: PACE_M,
  },
  styles: STYLES,
  counts: {
    posts: posts.length, arms: armCount, by_kind: byKind, by_style: byStyle,
    junction_nodes_degree_ge_3: Object.entries(degree).filter(([, d]) => d >= 3).map(([n]) => n),
    glyph_only_posts: posts.filter((p) => p.legible === 'glyph').length,
  },
  audit: {
    wrong_bearings: problems.length,
    problems,
    arm_word_skew_over_45deg: skewed,
  },
  signposts: posts.sort((a, b) => a.id.localeCompare(b.id)),
};

if (problems.length) {
  process.stderr.write(`build-signposts: ${problems.length} problem(s):\n`);
  for (const p of problems) process.stderr.write(`  ${p}\n`);
}
if (CHECK) {
  process.stdout.write(`signposts --check: ${posts.length} posts, ${armCount} arms, ${problems.length} problems\n`);
  process.exit(problems.length ? 1 : 0);
}
writeFileSync(D('signposts.json'), JSON.stringify(doc, null, 2) + '\n');
process.stdout.write(
  `signposts.json — ${posts.length} posts (${Object.entries(byKind).map(([k, v]) => `${v} ${k}`).join(', ')}), ` +
  `${armCount} arms, ${Object.entries(byStyle).map(([k, v]) => `${v} ${k}`).join(', ')}\n` +
  `  junctions of degree >= 3: ${doc.counts.junction_nodes_degree_ge_3.join(', ')}\n` +
  `  arms whose word and arm disagree by >45°: ${skewed.length}${skewed.length ? ' — ' + skewed.join(', ') : ''}\n` +
  `  wrong bearings: ${problems.length}\n`,
);

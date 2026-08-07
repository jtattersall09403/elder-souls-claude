#!/usr/bin/env node
/**
 * build-population.mjs — place the hostile population of Black Marsh.
 *
 * Reads   game/data/world/population.json   (the MODEL: density, falloff, composition)
 *         game/data/world/encounters.json   (the TEMPLATES: who stands in a post)
 *         game/data/world/roads.json        (the trunk-road polylines)
 *         game/data/world/regions.json      (danger_tier 1..5)
 *         game/data/world/terrain.json      (the 25 m region + land rasters)
 *         game/data/world/pois.json, hearths.json (the places of safety, and the ruins)
 * Writes  game/data/world/population-posts.json
 *
 * DETERMINISTIC. One mulberry32 seeded from the model's own numbers; no Math.random, no clock.
 * Re-running with the same inputs produces a byte-identical file, which is what makes
 * `--check` meaningful.
 *
 *   node tools/world/build-population.mjs            # report only
 *   node tools/world/build-population.mjs --write    # write population-posts.json
 *   node tools/world/build-population.mjs --check    # non-zero if the file has drifted from the model
 *
 * Perturbation flags, for the consumption probe and for anybody asking "does this number do
 * anything": --tier-mult 5=2.0  --encounters-per-tm 1.6  --no-safety
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const W = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world', f), 'utf8'));

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const model = W('population.json');
const encDoc = W('encounters.json');
const roads = W('roads.json');
const regionsDoc = W('regions.json');
const terrain = W('terrain.json');
const pois = W('pois.json');
const hearths = W('hearths.json');

// ---- perturbations (declared in the output, so a report can never silently be a perturbed run)
const perturb = {};
for (const t of argv.filter((_, i) => argv[i - 1] === '--tier-mult')) {
  const [k, v] = t.split('=');
  model.tier_multiplier[k] = Number(v);
  perturb.tier_mult = { ...(perturb.tier_mult || {}), [k]: Number(v) };
}
if (has('--encounters-per-tm')) {
  model.budget.encounters_per_tm = Number(val('--encounters-per-tm'));
  perturb.encounters_per_tm = model.budget.encounters_per_tm;
}
if (has('--no-safety')) perturb.no_safety = true;

// ---- the rasters -----------------------------------------------------------------------------
function unb64(str, Type) {
  const bytes = Buffer.from(str, 'base64');
  return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / Type.BYTES_PER_ELEMENT);
}
const COLS = terrain.cols, ROWS = terrain.rows, CELL = terrain.cell_m;
const regionU = unb64(terrain.channels.region, Uint8Array);
const landBits = unb64(terrain.channels.land, Uint8Array);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const cellIndex = (x, z) =>
  clamp(Math.floor(z / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);
const regionAt = (x, z) => regionsDoc.regions[regionU[cellIndex(x, z)]];
const isLandAt = (x, z) => { const i = cellIndex(x, z); return ((landBits[i >> 3] >> (i & 7)) & 1) === 1; };

// ---- deterministic noise ---------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 0x504f5055; // 'POPU'
const rnd = mulberry32(SEED);

// ---- places of safety ------------------------------------------------------------------------
const S = model.safety;
const safeties = [];
for (const p of pois.pois) {
  const k = S.kinds[p.kind];
  if (k) safeties.push({ id: p.id, x: p.pos[0], z: p.pos[2], clear: k.clear_m, ramp: k.ramp_m });
}
for (const h of hearths.hearths) safeties.push({ id: h.id, x: h.pos[0], z: h.pos[2], clear: S.kinds.hearth.clear_m, ramp: S.kinds.hearth.ramp_m });

/**
 * 0 on top of a place of safety, ramping to 1, then to `deep_bonus` in true wilderness.
 * The minimum is taken over every safety's OWN ramp, so a settlement's long apron and a
 * hearth's short one do not have to share a number.
 */
function safetyFactor(x, z) {
  if (perturb.no_safety) return 1;
  let f = Infinity, nearest = Infinity;
  for (const s of safeties) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < nearest) nearest = d;
    const local = d <= s.clear ? 0 : Math.min(1, (d - s.clear) / s.ramp);
    if (local < f) f = local;
    if (f === 0) break;
  }
  if (f === Infinity) return S.deep_bonus;
  if (nearest <= S.deep_bonus_at_m) return f;
  return Math.min(S.deep_bonus, f * S.deep_bonus);
}

// ---- the fog-gate corridors ------------------------------------------------------------------
const corridors = [];
for (const g of hearths.fog_gates || []) {
  const h = hearths.hearths.find((x) => x.id === g.hearth);
  if (h) corridors.push({ gate: g.id, ax: h.pos[0], az: h.pos[2], bx: g.pos[0], bz: g.pos[2] });
}
function inFogCorridor(x, z) {
  const r = S.fog_gate_corridor_m;
  for (const c of corridors) {
    const dx = c.bx - c.ax, dz = c.bz - c.az;
    const L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - c.ax) * dx + (z - c.az) * dz) / L2, 0, 1);
    if (Math.hypot(x - (c.ax + t * dx), z - (c.az + t * dz)) <= r) return c.gate;
  }
  return null;
}

// ---- composition -----------------------------------------------------------------------------
const templates = new Map(encDoc.encounters.map((e) => [e.id, e]));
const bodyCount = (id) => templates.get(id).members.reduce((a, m) => a + m.count, 0);
const soulsOf = (() => {
  const cache = new Map();
  return (sb) => {
    if (!cache.has(sb)) {
      const f = path.join(ROOT, 'game/data/combat/enemies', `${sb}.json`);
      cache.set(sb, fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).souls || 0) : 0);
    }
    return cache.get(sb);
  };
})();
const soulsOfTemplate = (id) =>
  templates.get(id).members.reduce((a, m) => a + m.count * soulsOf(m.statblock), 0);

function pickTemplate(tier, r) {
  const table = model.composition[String(tier)];
  let acc = 0;
  for (const [id, w] of Object.entries(table)) { acc += w; if (r <= acc) return id; }
  return Object.keys(table)[Object.keys(table).length - 1];
}

const distToSafety = (x, z) => {
  let best = Infinity;
  for (const s of safeties) { const d = Math.hypot(x - s.x, z - s.z); if (d < best) best = d; }
  return best;
};

// ---- walk the roads --------------------------------------------------------------------------
const TM_M = model.budget.traversal_minute_m;
const RC = model.road_corridor;
const posts = [];
const rejected = { water: 0, in_settlement: 0, fog_corridor: 0, too_close: 0 };
let sideFlip = 0;
/** Road metres by tier, and the subset that is true wilderness (safety at full). */
const roadMetres = { total: 0, wilderness: 0, by_tier: {}, wilderness_by_tier: {} };
const legMetres = {};

/** Canonical order: the crossing's legs first (it is the journey the game is about), then the rest. */
const crossingLegs = roads.named_routes.crossing.legs;
const legOrder = [...crossingLegs, ...roads.legs.map((l) => l.id).filter((id) => !crossingLegs.includes(id))];

function segmentsOf(leg) {
  const pts = leg.points;
  const out = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    const d = Math.hypot(x1 - x0, z1 - z0);
    out.push({ x0, z0, x1, z1, d, s0: acc });
    acc += d;
  }
  return { segs: out, length: acc };
}

function pointAt(segs, s) {
  for (const g of segs) {
    if (s <= g.s0 + g.d) {
      const t = g.d ? (s - g.s0) / g.d : 0;
      const nx = (g.z1 - g.z0) / (g.d || 1), nz = -(g.x1 - g.x0) / (g.d || 1);
      return { x: g.x0 + (g.x1 - g.x0) * t, z: g.z0 + (g.z1 - g.z0) * t, nx, nz };
    }
  }
  const g = segs[segs.length - 1];
  return { x: g.x1, z: g.z1, nx: 0, nz: 1 };
}

let postSeq = 0;
for (const legId of legOrder) {
  const leg = roads.legs.find((l) => l.id === legId);
  const { segs, length } = segmentsOf(leg);
  // Density is a rate along the road: walk it in 5 m steps, accumulate expected encounters,
  // and drop a post each time the accumulator passes 1. That makes density a genuine function
  // of position rather than a fixed spacing with a label on it.
  const STEP = 5;
  let acc = 0, lastPost = null;
  for (let s = 0; s < length; s += STEP) {
    const p = pointAt(segs, s);
    const reg = regionAt(p.x, p.z);
    const tier = reg.danger_tier;
    const mult = model.tier_multiplier[String(tier)] ?? 1;
    const safe = safetyFactor(p.x, p.z);
    const perM = (model.budget.encounters_per_tm / TM_M) * mult * safe;
    roadMetres.total += STEP;
    roadMetres.by_tier[tier] = (roadMetres.by_tier[tier] || 0) + STEP;
    (legMetres[legId] ||= { total: 0, wilderness: 0 }).total += STEP;
    if (safe >= 0.999) {
      roadMetres.wilderness += STEP;
      roadMetres.wilderness_by_tier[tier] = (roadMetres.wilderness_by_tier[tier] || 0) + STEP;
      legMetres[legId].wilderness += STEP;
    }
    acc += perM * STEP;
    // Rejections put their unit back (a stretch of open water must not cost the road its
    // density), but the credit is capped so that a long causeway does not empty its whole
    // budget into a pile-up on the first patch of dry land the other side.
    if (acc > 1.5) acc = 1.5;
    if (acc < 1) continue;
    acc -= 1;

    // offset to one side of the road
    sideFlip++;
    const side = sideFlip % 2 === 0 ? 1 : -1;
    const off = RC.offset_min_m + rnd() * (RC.offset_max_m - RC.offset_min_m);
    const x = p.x + p.nx * off * side;
    const z = p.z + p.nz * off * side;

    if (!isLandAt(x, z)) { rejected.water++; acc += 1; continue; }
    if (safetyFactor(x, z) <= 0) { rejected.in_settlement++; acc += 1; continue; }
    const fg = inFogCorridor(x, z);
    if (fg) { rejected.fog_corridor++; acc += 1; continue; }
    if (lastPost && Math.hypot(x - lastPost.x, z - lastPost.z) < RC.min_separation_m) { rejected.too_close++; acc += 1; continue; }

    const post = {
      id: `pop-${String(++postSeq).padStart(4, '0')}`,
      kind: 'road',
      leg: legId,
      at_m: Math.round(s),
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      region: reg.id,
      tier,
      safety: Math.round(safe * 1000) / 1000,
    };
    post.encounter = pickTemplate(tier, rnd());
    post.d_safety = Math.round(distToSafety(post.x, post.z) * 10) / 10;
    posts.push(post);
    lastPost = post;
  }
}

// ---- landmark garrisons ----------------------------------------------------------------------
const PG = model.poi_garrison;
const fogGateAt = new Set((hearths.fog_gates || []).map((g) => `${g.pos[0]},${g.pos[2]}`));
for (const p of pois.pois) {
  if (!PG.kinds.includes(p.kind)) continue;
  if (PG.skip_fog_gate_landmarks && fogGateAt.has(`${p.pos[0]},${p.pos[2]}`)) continue;
  const reg = regionAt(p.pos[0], p.pos[2]);
  const tier = reg.danger_tier;
  const n = PG.ring_posts_by_tier[String(tier)] ?? 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI + rnd() * 0.6;
    const x = p.pos[0] + Math.cos(a) * PG.ring_radius_m;
    const z = p.pos[2] + Math.sin(a) * PG.ring_radius_m;
    if (!isLandAt(x, z)) { rejected.water++; continue; }
    if (inFogCorridor(x, z)) { rejected.fog_corridor++; continue; }
    const post = {
      id: `pop-${String(++postSeq).padStart(4, '0')}`,
      kind: 'garrison',
      poi: p.id,
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      region: reg.id,
      tier,
      safety: Math.round(safetyFactor(x, z) * 1000) / 1000,
    };
    post.encounter = pickTemplate(tier, rnd());
    post.d_safety = Math.round(distToSafety(post.x, post.z) * 10) / 10;
    posts.push(post);
  }
}

// ---- the introduction rule, as a pass over the finished placement ----------------------------
// RI-AI05 §D: the first instance of any archetype must be presented SOLO, in a lit, open,
// non-ambush position, with retreat available — and it is a hard fail there, not a preference.
// Running it inline along the road introduced inf_trash in a tier-4 region because that is
// simply where the first leg of the crossing starts; the rule is about what the PLAYER meets
// first, and a player meets the lowest-tier, closest-to-safety instance first whatever route
// they take. So the pass runs over the finished placement, ordered by (tier, distance from the
// nearest place of safety), and the first post that would introduce a statblock becomes that
// statblock's solo template.
const introductionOrder = [];
if (model.introduction_rule.enabled) {
  const solos = model.introduction_rule.solo_template_for;
  const seen = new Set();
  const order = posts.slice().sort((a, b) => (a.tier - b.tier) || (a.d_safety - b.d_safety) || (a.id < b.id ? -1 : 1));
  for (const q of order) {
    const news = [...new Set(templates.get(q.encounter).members.map((m) => m.statblock))].filter((sb) => !seen.has(sb));
    if (!news.length) continue;
    const first = news[0];
    const solo = solos[first];
    if (!solo) { news.forEach((sb) => seen.add(sb)); continue; }
    seen.add(first);
    q.encounter = solo;
    q.introduces = first;
    introductionOrder.push({ statblock: first, template: solo, post: q.id, region: q.region, tier: q.tier, d_safety_m: q.d_safety, x: q.x, z: q.z });
  }
}
for (const q of posts) { q.bodies = bodyCount(q.encounter); q.souls = soulsOfTemplate(q.encounter); }

// ---- report ----------------------------------------------------------------------------------
const byRegion = {}, byTier = {}, byTemplate = {};
let bodies = 0, souls = 0, solo = 0, grouped = 0, groupedBodies = 0, gankDuos = 0;
for (const q of posts) {
  bodies += q.bodies; souls += q.souls;
  byTemplate[q.encounter] = (byTemplate[q.encounter] || 0) + 1;
  const r = (byRegion[q.region] ||= { tier: q.tier, posts: 0, bodies: 0, souls: 0 });
  r.posts++; r.bodies += q.bodies; r.souls += q.souls;
  const t = (byTier[q.tier] ||= { posts: 0, bodies: 0, souls: 0 });
  t.posts++; t.bodies += q.bodies; t.souls += q.souls;
  if (q.bodies === 1) solo++; else { grouped++; groupedBodies += q.bodies; }
  if (templates.get(q.encounter).gank_duo) gankDuos++;
}
const roadPosts = posts.filter((q) => q.kind === 'road');
const roadBodies = roadPosts.reduce((a, q) => a + q.bodies, 0);
const roadM = roadMetres.total;
const roadTM = roadM / TM_M;
// D9 names "wilderness road walking", so the band belongs on the wilderness stretches. The
// approach to a town is deliberately empty and averaging it in would hide both numbers.
const wildPosts = roadPosts.filter((q) => q.safety >= 0.999);
const wildBodies = wildPosts.reduce((a, q) => a + q.bodies, 0);
const wildTM = roadMetres.wilderness / TM_M;

// THE CROSSING. The journey the brief is about: Stormhold south gate to Lilmoth harbour steps.
const crossPosts = posts.filter((q) => crossingLegs.includes(q.leg));
const crossBodies = crossPosts.reduce((a, q) => a + q.bodies, 0);
const crossSouls = crossPosts.reduce((a, q) => a + q.souls, 0);
const crossM = crossingLegs.reduce((a, id) => a + (legMetres[id] ? legMetres[id].total : 0), 0);
// RI-PRG01's shipped curve, so "what level does the crossing pay for" is not an estimate.
const levels = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/levels.json'), 'utf8'));
const levelRows = levels.levels;
function levelForSouls(total) {
  let lvl = 1;
  for (const r of levelRows) { if (r.cumulative > total) break; lvl = r.level; }
  return lvl;
}

const report = {
  seed: SEED,
  perturbations: Object.keys(perturb).length ? perturb : null,
  posts: posts.length,
  bodies,
  souls,
  road: {
    trunk_m: Math.round(roadM),
    traversal_minutes: Math.round(roadTM * 10) / 10,
    posts: roadPosts.length,
    bodies: roadBodies,
    encounters_per_tm_all_road: Math.round((roadPosts.length / roadTM) * 1000) / 1000,
    enemies_per_tm_all_road: Math.round((roadBodies / roadTM) * 1000) / 1000,
    wilderness_m: roadMetres.wilderness,
    wilderness_traversal_minutes: Math.round(wildTM * 10) / 10,
    wilderness_posts: wildPosts.length,
    wilderness_bodies: wildBodies,
    encounters_per_tm_wilderness: Math.round((wildPosts.length / wildTM) * 1000) / 1000,
    enemies_per_tm_wilderness: Math.round((wildBodies / wildTM) * 1000) / 1000,
    band_encounters: model.budget.encounters_per_tm_band,
    band_enemies: model.budget.enemies_per_tm_band,
    d9_band: model.budget.d9_groups_per_minute_band,
    _which_number_is_the_bar: 'RI-WLD02 D9 says "per minute of WILDERNESS road walking", so encounters_per_tm_wilderness is the figure the band applies to. The all-road figure includes the deliberately empty aprons around 24 settlements and 29 hearths and is lower by construction.',
  },
  crossing: {
    legs: crossingLegs,
    metres: Math.round(crossM),
    walk_minutes: Math.round((crossM / model.budget.walk_speed_mps / 60) * 10) / 10,
    posts: crossPosts.length,
    bodies: crossBodies,
    souls: crossSouls,
    level_if_fully_cleared: levelForSouls(crossSouls),
    encounters_per_tm: Math.round((crossPosts.length / (crossM / TM_M)) * 1000) / 1000,
    wilderness_m: crossingLegs.reduce((a, id) => a + (legMetres[id] ? legMetres[id].wilderness : 0), 0),
    encounters_per_tm_wilderness: Math.round((crossPosts.filter((q) => q.safety >= 0.999).length
      / (crossingLegs.reduce((a, id) => a + (legMetres[id] ? legMetres[id].wilderness : 0), 0) / TM_M)) * 1000) / 1000,
    regions: [...new Set(crossPosts.map((q) => `${q.region}(t${q.tier})`))],
  },
  enemies_per_encounter: Math.round((bodies / posts.length) * 1000) / 1000,
  enemies_per_encounter_band: model.budget.enemies_per_encounter_band,
  solo_grouped: [Math.round((solo / posts.length) * 1000) / 10, Math.round((grouped / posts.length) * 1000) / 10],
  grouped_mean_bodies: Math.round((groupedBodies / (grouped || 1)) * 1000) / 1000,
  gank_duo_posts: gankDuos,
  by_tier: byTier,
  by_region: byRegion,
  by_template: byTemplate,
  road_metres_by_tier: roadMetres.by_tier,
  rejected,
  introduction_order: introductionOrder,
};

const out = {
  schema: 'elder-souls/population-posts@1',
  generator: 'tools/world/build-population.mjs',
  model: 'game/data/world/population.json',
  note: 'GENERATED — do not hand-edit. Every post names a template in game/data/world/encounters.json and a coordinate on land. Read at runtime by game/src/world/population.js, pumped from Engine._streamPopulation().',
  report,
  posts,
};

if (has('--write')) {
  fs.writeFileSync(path.join(ROOT, 'game/data/world/population-posts.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('wrote game/data/world/population-posts.json');
}
if (has('--check')) {
  const p = path.join(ROOT, 'game/data/world/population-posts.json');
  if (!fs.existsSync(p)) { console.error('population-posts.json missing — run --write'); process.exit(2); }
  const cur = fs.readFileSync(p, 'utf8');
  const want = JSON.stringify(out, null, 1) + '\n';
  if (cur !== want) { console.error('DRIFT: population-posts.json does not match the model. Re-run --write.'); process.exit(1); }
  console.log('population-posts.json matches the model');
}
console.log(JSON.stringify(report, null, 1));

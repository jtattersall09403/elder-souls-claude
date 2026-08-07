#!/usr/bin/env node
/**
 * build-street-life.mjs — put W1-04's own townspeople OUTDOORS, at an hour that varies.
 *
 * WHY THIS EXISTS.
 *
 * The W1-04 round-1 verdict measured the province's streets and found them empty at every hour
 * of every day: of the 347 NPC records in the tree, **38 carry a `post`** — an outdoor station —
 * and **0 of those 38 are in `game/data/npcs/pop-*.json`**. They are quest-givers, mainline
 * characters and faction-givers, placed by `build-giver-posts.mjs`. At noon, 34 of 347 people in
 * the province were outdoors and every one of them was a quest-giver at a post. At 03:00, across
 * eight settlements and 4,825 x 5,540 m of Argonia, **not one person anywhere was outdoors.**
 *
 * The schedule model itself is real and the critic proved it by perturbation: nine of Thorn's
 * twenty-four change cell across the day. But what it schedules is which invisible room an
 * invisible person is invisible in. Morrowind's towns feel inhabited because Balmora at nine in
 * the morning has people crossing the bridge, and this build had a Balmora where the bridge was
 * always empty and everybody was always indoors.
 *
 * WHAT THIS DOES, and what it deliberately does not.
 *
 * It does NOT rewrite anybody's day. `build-giver-posts.mjs` replaces a giver's whole schedule
 * with a three-row one, which is right for a person whose only job is to be findable; doing that
 * to 260 townspeople would throw away the home/work/tavern structure that `residentsPresent()`,
 * the trespass scope and the shop-hours gate all read, and those three were verified working by
 * the round-1 critic. So instead:
 *
 *   1. every record gets a `post` — an outdoor station on their own town's street, derived from
 *      a real building's door, the same arithmetic `build-giver-posts.mjs` uses;
 *   2. each person is assigned a COHORT from a hash of their id, and the cohort's hours are
 *      carved OUT of their existing schedule and replaced with `at: null` — which
 *      `sim/npc.js stepSchedule` reads as "outdoors" for anyone carrying a post. Every other
 *      hour of their day survives byte-identical.
 *
 * The cohorts are chosen so that the street is never empty and the rooms never are either:
 *
 *   market  ~34%   09:00-17:00   the trading day
 *   errand  ~24%   07:00-09:00 and 17:00-19:00   to work and home again
 *   evening ~14%   19:00-22:00   out after the shops shut
 *   watch    ~8%   22:00-05:00   the reason 03:00 is not a dead province
 *   indoors ~20%   never         people who genuinely stay in
 *
 * DETERMINISTIC. One FNV-1a hash of the record id; no `Math.random`, no clock in any output
 * field. Re-running produces a byte-identical file, which is what makes `--check` mean anything.
 *
 *   node tools/world/build-street-life.mjs            # report only, writes nothing
 *   node tools/world/build-street-life.mjs --write    # write the pop-*.json files
 *   node tools/world/build-street-life.mjs --check    # non-zero if the shipped files have drifted
 *
 * IT CAN FAIL, and RULES.md rule 24 is why that matters. It exits non-zero when a town has no
 * placeable building, when a rewritten schedule does not tile all 24 hours, when a post lands
 * outside its own settlement's radius, or — under `--check` — when the tree disagrees with the
 * model. A tool that cannot report the absence of the thing it measures is a rubber stamp.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const SDIR = path.join(ROOT, 'game/data/world/settlements');
const NDIR = path.join(ROOT, 'game/data/npcs');
const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const CHECK = argv.includes('--check');
const REPORT = (() => { const i = argv.indexOf('--report'); return i > 0 ? argv[i + 1] : 'reports/street-life.json'; })();

if (argv.includes('--help')) {
  console.log('node tools/world/build-street-life.mjs [--write] [--check] [--report <path>]');
  process.exit(0);
}

/** The same FNV-1a the Engine, `sim/npc.js` and `render/interior.js` use. */
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const towns = new Map();
for (const f of fs.readdirSync(SDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(SDIR, f), 'utf8'));
  if (d && d.id) towns.set(d.id, d);
}

// ---- the cohorts -------------------------------------------------------------------------------
// Windows are [from, to) in hours. A window that wraps midnight is written as two.
const COHORTS = [
  { id: 'market',  upto: 34,  activity: 'market',  windows: [[9, 17]] },
  { id: 'errand',  upto: 58,  activity: 'errand',  windows: [[7, 9], [17, 19]] },
  { id: 'evening', upto: 72,  activity: 'street',  windows: [[19, 22]] },
  { id: 'watch',   upto: 80,  activity: 'watch',   windows: [[22, 24], [0, 5]] },
  { id: 'indoors', upto: 100, activity: null,      windows: [] },
];
function cohortFor(id) {
  const r = hash(`cohort|${id}`) % 100;
  for (const c of COHORTS) if (r < c.upto) return c;
  return COHORTS[COHORTS.length - 1];
}

/** Which building this person stands outside of, by what their cohort has them doing. */
function pickBuilding(town, rec, cohort) {
  const bs = (town.buildings || []).filter((b) => b.kind !== 'structure' && b.door);
  if (!bs.length) return null;
  const pick = (pred) => bs.filter(pred);
  let pool = [];
  if (cohort.id === 'market') {
    pool = pick((b) => b.service === 'trader' || /market|lowmarket|quay|yard/.test(b.id) || b.building_kind === 'shop');
  } else if (cohort.id === 'watch') {
    pool = pick((b) => ['gate', 'hall', 'prison'].includes(b.building_kind) || /gate|warders|praetorium|gaol|customs/.test(b.id));
  } else if (cohort.id === 'evening') {
    pool = pick((b) => b.building_kind === 'tavern' || b.service === 'inn');
  }
  if (!pool.length) {
    // Their own front door: the building whose interior their record already names.
    const own = bs.find((b) => b.interior === (rec.work_interior || rec.interior) || b.interior === rec.home_interior);
    if (own) return own;
    pool = bs;
  }
  return pool[hash(rec.id) % pool.length];
}

/** Stand outside the door, on the street side, spread laterally so nobody occupies one point. */
function postAt(town, b, id) {
  const c = town.pos, d = b.door;
  let vx = d[0] - c[0], vz = d[2] - c[2];
  const len = Math.hypot(vx, vz) || 1;
  vx /= len; vz /= len;
  const h = hash(`post|${id}`);
  const outStep = 1.8 + ((h % 220) / 100);              // 1.80 .. 4.00 m clear of the doorway
  const lateral = (((h >>> 9) % 700) / 100) - 3.5;      // -3.50 .. +3.49 m along the frontage
  return {
    pos: [
      Math.round((d[0] + vx * outStep - vz * lateral) * 100) / 100,
      Math.round(d[1] * 100) / 100,
      Math.round((d[2] + vz * outStep + vx * lateral) * 100) / 100,
    ],
    yaw: Math.round(((Math.atan2(vx, vz) * 180) / Math.PI + 360) % 360),
  };
}

// ---- the schedule surgery ----------------------------------------------------------------------
const BUCKETS = 48;                     // half-hour resolution
const toH = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s)); if (!m) throw new Error(`bad time ${s}`); return Number(m[1]) + Number(m[2]) / 60; };
const fromH = (h) => { const hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

/** Explode a schedule into 48 half-hour buckets of `{at, activity}`. Throws on a hole. */
function explode(schedule, who) {
  const cells = new Array(BUCKETS).fill(null);
  for (const r of schedule) {
    const a = toH(r.from), b = toH(r.to);
    const i0 = Math.round(a * 2), i1 = Math.round((b === 0 ? 24 : b) * 2);
    if (i1 > i0) { for (let i = i0; i < i1; i++) cells[i % BUCKETS] = { at: r.at ?? null, activity: r.activity ?? null }; } else {
      for (let i = i0; i < BUCKETS; i++) cells[i] = { at: r.at ?? null, activity: r.activity ?? null };
      for (let i = 0; i < i1; i++) cells[i] = { at: r.at ?? null, activity: r.activity ?? null };
    }
  }
  const hole = cells.findIndex((c) => c === null);
  if (hole >= 0) throw new Error(`${who}: schedule has a hole at ${fromH(hole / 2)} — a person must be somewhere at every hour`);
  return cells;
}

/** Re-merge buckets into the fewest rows that describe them. */
function implode(cells) {
  const rows = [];
  let start = 0;
  for (let i = 1; i <= BUCKETS; i++) {
    const cur = cells[i % BUCKETS], prev = cells[i - 1];
    const same = i < BUCKETS && cur.at === prev.at && cur.activity === prev.activity;
    if (!same) { rows.push({ from: fromH(start / 2), to: fromH(i / 2 === 24 ? 0 : i / 2), at: prev.at, activity: prev.activity }); start = i; }
  }
  // A day that is one activity end to end still needs a row that covers it.
  if (!rows.length) rows.push({ from: '00:00', to: '00:00', at: cells[0].at, activity: cells[0].activity });
  return rows;
}

// ---- run ---------------------------------------------------------------------------------------
const out = {
  tool: 'tools/world/build-street-life.mjs',
  model: COHORTS.map((c) => ({ cohort: c.id, share_pct: c.upto, windows: c.windows })),
  towns: {}, cohorts: {}, outdoors_by_hour: {}, posted: 0, skipped: [], errors: [],
};
for (const c of COHORTS) out.cohorts[c.id] = 0;
for (let h = 0; h < 24; h++) out.outdoors_by_hour[h] = 0;

const files = new Map();
const touched = new Set();
for (const f of fs.readdirSync(NDIR).sort()) {
  if (!/^pop-.*\.json$/.test(f)) continue;
  files.set(f, JSON.parse(fs.readFileSync(path.join(NDIR, f), 'utf8')));
}
if (!files.size) { console.error('build-street-life: no game/data/npcs/pop-*.json found. Nothing to place.'); process.exit(2); }

for (const [f, doc] of files) {
  for (const rec of doc.npcs || []) {
    const town = towns.get(rec.settlement);
    if (!town) { out.skipped.push({ id: rec.id, why: `no settlement record for ${JSON.stringify(rec.settlement)}` }); continue; }
    if (!rec.schedule || !rec.schedule.length) { out.skipped.push({ id: rec.id, why: 'no schedule to carve an outdoor window out of' }); continue; }
    const cohort = cohortFor(rec.id);
    out.cohorts[cohort.id]++;
    const b = pickBuilding(town, rec, cohort);
    if (!b) { out.errors.push({ id: rec.id, town: town.id, why: 'town has no building with a door' }); continue; }
    const p = postAt(town, b, rec.id);

    // A post outside its own town's radius is a person standing in the marsh. Fail loudly.
    const dist = Math.hypot(p.pos[0] - town.pos[0], p.pos[2] - town.pos[2]);
    if (dist > (town.radius_m || 60)) {
      out.errors.push({ id: rec.id, town: town.id, why: `post is ${dist.toFixed(1)} m from the town centre, outside radius_m ${town.radius_m}` });
      continue;
    }

    rec.post = {
      settlement: town.id,
      at_building: b.id,
      at_building_name: b.name || b.id,
      pos: p.pos,
      yaw: p.yaw,
      cohort: cohort.id,
      note: `W1-04 r2 street life: an outdoor station derived from ${b.id}'s door. \`at: null\` in the schedule below means HERE, not "everywhere".`,
    };

    if (cohort.windows.length) {
      const cells = explode(rec.schedule, rec.id);
      for (const [a, z] of cohort.windows) {
        for (let i = Math.round(a * 2); i < Math.round(z * 2); i++) cells[i % BUCKETS] = { at: null, activity: cohort.activity };
      }
      const rows = implode(cells);
      // The rewritten day must still tile 24 hours with no hole. Re-explode to prove it.
      explode(rows, `${rec.id} (rewritten)`);
      rec.schedule = rows;
    }

    out.posted++;
    out.towns[town.id] = (out.towns[town.id] || 0) + 1;
    for (const [a, z] of cohort.windows) for (let h = Math.floor(a); h < Math.ceil(z); h++) out.outdoors_by_hour[h % 24]++;
    touched.add(f);
  }
}

if (out.errors.length) {
  console.error(`build-street-life: ${out.errors.length} record(s) could not be placed:`);
  for (const e of out.errors.slice(0, 8)) console.error(`  ${e.id}: ${e.why}`);
  process.exit(3);
}

const NOTE = 'Some records in this file carry a `post` block and outdoor `at: null` schedule rows written by tools/world/build-street-life.mjs. Re-run it after moving a settlement; do not hand-edit `post`.';
const serialise = (doc) => JSON.stringify(doc, null, 2) + '\n';

if (CHECK) {
  let drift = 0;
  for (const f of touched) {
    const onDisk = fs.readFileSync(path.join(NDIR, f), 'utf8');
    const doc = files.get(f);
    doc.street_life_note = NOTE;
    if (serialise(doc) !== onDisk) { drift++; console.error(`  drifted: game/data/npcs/${f}`); }
  }
  console.log(`build-street-life --check: ${touched.size} file(s), ${drift} drifted`);
  process.exit(drift ? 4 : 0);
}

if (WRITE) {
  for (const f of touched) {
    const doc = files.get(f);
    doc.street_life_note = NOTE;
    fs.writeFileSync(path.join(NDIR, f), serialise(doc));
  }
  fs.mkdirSync(path.dirname(path.join(ROOT, REPORT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, REPORT), JSON.stringify(out, null, 2) + '\n');
}

console.log(`posted                 ${out.posted}`);
console.log(`by cohort              ${Object.entries(out.cohorts).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`by town                ${Object.entries(out.towns).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`outdoors at 03:00      ${out.outdoors_by_hour[3]}`);
console.log(`outdoors at 09:00      ${out.outdoors_by_hour[9]}`);
console.log(`outdoors at 12:00      ${out.outdoors_by_hour[12]}`);
console.log(`outdoors at 20:00      ${out.outdoors_by_hour[20]}`);
console.log(`skipped                ${out.skipped.length}`);
if (!WRITE && !CHECK) console.log('\n(report only — pass --write to change the tree)');

#!/usr/bin/env node
/**
 * f10-r9c-crowd-census.mjs — RI-VIS10 §E (E1..E5), published.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r9.json`, the builder's own words: *"E1-E5 are pure counting over
 * `game/data/npcs/*.json` and need nothing but work, and I did none of it."* `RI-VIS10`'s Scoring
 * block fails the whole item at 0 when fewer than 12 of its 18 checks publish a census, so five
 * unpublished counts are worth more to the score than any single measurement in the round.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IT IS NOT "PURE COUNTING", AND THAT IS THE FINDING
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * E1 is counting: it asks about the `actor` field and nothing else. **E2, E3 and E5 ask what is
 * RENDERED**, and in this build the rendered body is not chosen by `actor` at all. Read this turn
 * in `game/src/render/actor.js` (`characterFor`) and `game/src/render/renderer.js:738`: the body is
 * `CHARACTER_SPECS[ pool(artFamilyForRace(race))[ FNV1a('npc:'+eid) % pool.length ] ]`. So `actor`
 * — the field RI-VIS10 §E uses as its denominator throughout — is invisible to the renderer, and a
 * census taken over it would be counting a column no camera reads.
 *
 * So every §E row that says "rendered" is answered by BUILDING THE BODY: each NPC record is put
 * through the real `makeRiggedActor` -> `poseFromRig` path with the same `group.name` the renderer
 * writes, and the `characterId` the actor module stamps on the built meshes is read back off the
 * mesh. That is output, not source (CRITIC-DOCTRINE §1.1).
 *
 * Usage: node tools/visual/f10-r9c-crowd-census.mjs --json=out.json
 *        node tools/visual/f10-r9c-crowd-census.mjs --self-test
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }

// ── the roster, enumerated by command over the shipped files ────────────────────────────────
const files = readdirSync(join(ROOT, 'game/data/npcs')).filter((f) => f.endsWith('.json')).sort();
const npcs = [];
for (const f of files) {
  const doc = JSON.parse(readFileSync(join(ROOT, 'game/data/npcs', f), 'utf8'));
  const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || doc.entries || []);
  for (const r of (Array.isArray(list) ? list : [])) {
    if (!r || typeof r !== 'object' || !r.id) continue;
    npcs.push({ ...r, _file: f });
  }
}
const count = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);

const byActor = count(npcs, (n) => n.actor || 'none');
const byRace = count(npcs, (n) => n.race || 'none');
const N = npcs.length;

// ── the render path, imported, not modelled ─────────────────────────────────────────────────
const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}
const rig = new Rig(skel, hitgeo);
rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
addPose(rig, clips.archetypes.idle_ready, 0, 1);
rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
const body = { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } };

/** Build one NPC exactly as `renderer.syncNPCs` does and read back what was actually stamped. */
function renderedOf(n) {
  const family = artFamilyForRace(n.race);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  g.name = `npc:${n.id}`;
  actorMod.poseFromRig(g, body);
  let characterId = g.userData.actor.characterId || null;
  g.traverse((o) => { if (o.isMesh && o.userData && o.userData.characterId) characterId = o.userData.characterId; });
  const spec = g.userData.actor.character || null;
  return { family, characterId, morph: (spec && spec.morph) || {}, material: (spec && spec.material) || {} };
}

if (args['self-test']) {
  // The one thing that could make every row of this census vacuous: `renderedOf` returning the
  // same body for every input. Two NPCs whose ids hash into different slots MUST differ, and an
  // NPC of a different race MUST land on a different family. Arms required to disagree.
  const sax = npcs.filter((n) => artFamilyForRace(n.race) === 'saxhleel');
  const hum = npcs.filter((n) => artFamilyForRace(n.race) === 'humanoid');
  const ids = new Set(sax.slice(0, 60).map((n) => renderedOf(n).characterId));
  const fams = new Set([renderedOf(sax[0]).family, renderedOf(hum[0]).family]);
  const results = [
    { arm: 'sixty saxhleel records do not all build the same body', ok: ids.size > 1, distinct: ids.size, saw: [...ids] },
    { arm: 'a saxhleel record and a humanoid record land on different families', ok: fams.size === 2, saw: [...fams] },
    { arm: 'the roster is not empty and matches the file count', ok: N > 0 && files.length > 0, n: N, files: files.length },
  ];
  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r9c-crowd-census --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

const rendered = npcs.map((n) => ({ n, r: renderedOf(n) }));

// ══ E1 — visual actors against population (the item's own arithmetic, over `actor`) ══════════
const largestActor = sortDesc(byActor)[0];
const E1 = {
  check: 'E1 — visual actors against population',
  command: "walked game/data/npcs/*.json (18 files) and counted the `actor` field",
  n_npcs: N, distinct_actors: byActor.size,
  npcs_per_actor: +(N / byActor.size).toFixed(2),
  required_actors_at_this_n: Math.ceil(N / 12),
  largest_bucket: { actor: largestActor[0], n: largestActor[1], pct: +(100 * largestActor[1] / N).toFixed(1) },
  ceiling_at_this_n: Math.floor(N * 0.10),
  arm_1_actors_per_12: byActor.size >= Math.ceil(N / 12) ? 'pass' : 'fail',
  arm_2_bucket_ceiling: largestActor[1] <= Math.floor(N * 0.10) ? 'pass' : 'fail',
  census: sortDesc(byActor).map(([a, c]) => ({ actor: a, n: c, pct: +(100 * c / N).toFixed(1) })),
};
E1.verdict = (E1.arm_1_actors_per_12 === 'pass' && E1.arm_2_bucket_ceiling === 'pass') ? 'PASS' : 'FAIL';

// ══ E2 — head/face variety INSIDE the largest actor bucket, as rendered ══════════════════════
const bucket = rendered.filter((x) => (x.n.actor || 'none') === largestActor[0]);
const bucketHeads = count(bucket, (x) => x.r.characterId || 'null');
const E2 = {
  check: 'E2 — head/face variety inside the single largest actor',
  actor: largestActor[0], n_in_bucket: bucket.length,
  measured_by: 'building each record through makeRiggedActor + poseFromRig and reading userData.characterId off the built mesh',
  distinct_rendered_bodies: bucketHeads.size,
  census: sortDesc(bucketHeads).map(([k, c]) => ({ rendered_body: k, n: c })),
  bar: '>= 4 distinct head/face variants; 1 => every townsman is the same man',
  note: 'This build has no head variant axis separate from the body variant — one CHARACTER_SPECS row '
    + 'carries build, crest, snout and material together, so "distinct head" and "distinct body" are the '
    + 'same number here. Reported as the body count, and that is the most generous reading available.',
};
E2.verdict = bucketHeads.size >= 4 ? 'PASS' : 'FAIL';

// ══ E3 — age and build spread, as rendered ═══════════════════════════════════════════════════
const builds = count(rendered, (x) => (x.r.morph && x.r.morph.build !== undefined ? x.r.morph.build : 'default(1.00)'));
const BANDS = [['child', (b) => b < 0.7], ['slight', (b) => b >= 0.7 && b < 0.92], ['average', (b) => b >= 0.92 && b <= 1.08], ['heavy', (b) => b > 1.08], ['stooped-old', () => false]];
const bandsSeen = new Set();
for (const [k] of builds) { const b = typeof k === 'number' ? k : 1.0; for (const [name, f] of BANDS) if (f(b)) bandsSeen.add(name); }
const E3 = {
  check: 'E3 — age and build spread',
  measured_by: 'distinct morph.build values across every rendered NPC body, banded',
  distinct_build_values: [...builds.keys()].sort(),
  band_rule: 'child <0.70 | slight 0.70-0.92 | average 0.92-1.08 | heavy >1.08 | stooped-old requires a spine/neck morph axis',
  bands_present: [...bandsSeen],
  n_bands: bandsSeen.size,
  bar: '>= 4 of {child, slight, average, heavy, stooped-old}; 1 caps the item at 3',
  no_child_axis: !bandsSeen.has('child'),
  no_stoop_axis: 'CHARACTER_SPECS carries no spine curvature or age morph — stooped-old cannot be reached by any shipped row',
  census: sortDesc(builds).map(([k, c]) => ({ build: k, n_npcs: c })),
};
E3.verdict = bandsSeen.size >= 4 ? 'PASS' : 'FAIL';

// ══ E4 — adjacency: identical neighbours standing near each other ════════════════════════════
// METHOD DEVIATION, declared: the item asks for a 60-second walk and pairs ON SCREEN. This is the
// static version over the authored posts — every pair of NPCs in one settlement within 15 m whose
// rendered tuple is identical. It cannot see who is on screen together, so it is neither a superset
// nor a subset of the item's number; it is the strongest thing available without a browser, and it
// is labelled as such rather than passed off as the item's own instrument.
const posOf = (n) => (n.post && Array.isArray(n.post.pos) ? n.post.pos : null);
const placed = rendered.filter((x) => posOf(x.n));
const bySettlement = new Map();
for (const x of placed) { const s = x.n.settlement || (x.n.post && x.n.post.settlement) || 'none'; if (!bySettlement.has(s)) bySettlement.set(s, []); bySettlement.get(s).push(x); }
const e4rows = [];
let e4pairs = 0;
for (const [s, list] of [...bySettlement.entries()].sort((a, b) => b[1].length - a[1].length)) {
  let pairs = 0; const examples = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const pa = posOf(a.n), pb = posOf(b.n);
    const d = Math.hypot(pa[0] - pb[0], pa[2] - pb[2]);
    if (d > 15) continue;
    if (a.r.characterId !== b.r.characterId) continue;
    if ((a.n.race || '') !== (b.n.race || '')) continue;    // race carries the tint
    pairs++;
    if (examples.length < 4) examples.push({ a: a.n.id, b: b.n.id, body: a.r.characterId, race: a.n.race, distance_m: +d.toFixed(1) });
  }
  e4pairs += pairs;
  if (list.length > 1) e4rows.push({ settlement: s, placed_npcs: list.length, identical_pairs_within_15m: pairs, examples });
}
const E4 = {
  check: 'E4 — adjacency',
  method_deviation: 'the item asks for a 60-second walk counting pairs ON SCREEN TOGETHER; this counts authored posts within 15 m in the same settlement, which is the static proxy — declared, not substituted silently',
  tuple: '(rendered characterId, race) — race is what carries the tint at renderer.js:729',
  total_identical_pairs_within_15m: e4pairs,
  bar: '0 pairs; >= 3 pairs => the duplication is visible in one shot',
  census: e4rows,
};
E4.verdict = e4pairs === 0 ? 'PASS' : 'FAIL';

// ══ E5 — does the rendered mix match the data ════════════════════════════════════════════════
const settlementOf = (n) => n.settlement || (n.post && n.post.settlement) || 'none';
const bigSettlement = sortDesc(count(npcs, settlementOf))[0];
const inSettlement = rendered.filter((x) => settlementOf(x.n) === bigSettlement[0]);
const racesHere = sortDesc(count(inSettlement, (x) => x.n.race || 'none'));
const shapeByRace = new Map();
for (const x of inSettlement) { const r = x.n.race || 'none'; if (!shapeByRace.has(r)) shapeByRace.set(r, new Set()); shapeByRace.get(r).add(x.r.characterId); }
const e5rows = racesHere.map(([race, n]) => {
  const share = 100 * n / inSettlement.length;
  const shapes = [...(shapeByRace.get(race) || [])].sort();
  // A race is SHAPE-distinguishable only if some body it draws is drawn by no other race here.
  const others = new Set();
  for (const [r2, s2] of shapeByRace) if (r2 !== race) for (const v of s2) others.add(v);
  const unique = shapes.filter((s) => !others.has(s));
  return { race, n, share_pct: +share.toFixed(1), at_or_above_5pct: share >= 5, rendered_bodies: shapes,
    bodies_unique_to_this_race: unique, shape_distinguishable: unique.length > 0,
    tint_distinguishable: true, tint_note: 'RACE_TINT (renderer.js:45) gives every shipped race its own skin/cloth pair, so colour separates them; shape does not' };
});
const failing = e5rows.filter((r) => r.at_or_above_5pct && !r.shape_distinguishable);
const E5 = {
  check: 'E5 — the rendered mix matches the data',
  settlement: bigSettlement[0], n_npcs_here: inSettlement.length,
  bar: 'every race with >= 5% share in the data is distinguishable on screen',
  census: e5rows,
  races_at_or_above_5pct: e5rows.filter((r) => r.at_or_above_5pct).map((r) => r.race),
  races_at_or_above_5pct_not_shape_distinguishable: failing.map((r) => r.race),
  reading: 'scored on SHAPE. RI-VIS10 C2 already refuses a variety claim that rests on palette, and '
    + '`rig-variant-proof.mjs` records the measured reason (Morrowind\'s own nine regions separate at '
    + '9.1% by colour against an 11.1% chance baseline). Both columns are published so a second critic '
    + 'may score it on tint and get a different, stated answer.',
};
E5.verdict = failing.length === 0 ? 'PASS' : 'FAIL';

const out = {
  tool: 'f10-r9c-crowd-census.mjs', role: 'independent critic, W1-F10-r9', generated: new Date().toISOString(),
  item: 'RI-VIS10 §E (E1..E5)',
  enumeration: {
    command: 'readdirSync(game/data/npcs).filter(.json) then walk every record with an `id`',
    files: files.length, records: N,
    distinct_actors: byActor.size, distinct_races: byRace.size,
    race_census: sortDesc(byRace).map(([r, c]) => ({ race: r, n: c })),
  },
  renderer_finding: 'game/src/render/actor.js:characterFor selects the body from FNV1a(group.name) % pool(artFamilyForRace(race)) — the `actor` field never reaches the renderer. RI-VIS10 §E uses `actor` as its denominator throughout.',
  E1, E2, E3, E4, E5,
  passed: [E1, E2, E3, E4, E5].filter((e) => e.verdict === 'PASS').length,
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));

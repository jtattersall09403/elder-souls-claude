#!/usr/bin/env node
/**
 * w1-thorn-roof-census.mjs — how many DISTINCT ROOF PROFILES does each settlement's skyline carry?
 *
 * Ruling E1 asks for >= 5 roof profiles and is explicit that it counts SILHOUETTES, not parts. So
 * this does not count kit ids in a table; it runs the renderer's own decision chain —
 * `planSettlement()` -> `assignVariantSalts()` -> `previewSilhouette()` — which is the code that
 * actually decides what the skyline is, and counts the distinct `roof` values that come out.
 *
 * IT HAS A NEGATIVE CONTROL AND THE CONTROL IS LOAD-BEARING. `roofChoice(gram, seed)` returns
 * `gram.roofs[0]` for a fixed seed, so a census that passes a constant seed reports ONE profile for
 * every town in the game and looks like a catastrophic finding. Chunk 1 of W1-THORN-PLATES made
 * exactly that mistake and caught it. `--arm constant` reproduces it on purpose: it must collapse
 * every town to 1 while `--arm live` does not, and if the two arms ever agree, this instrument is
 * measuring the seed rather than the game and its numbers are void. `--both` runs the pair and
 * exits non-zero unless they disagree.
 *
 * USAGE
 *   node tools/render/w1-thorn-roof-census.mjs [--arm live|constant|both] [--json <path>]
 *
 * EXIT
 *   0  ran, and (for --both) the control disagreed with the live arm as it must
 *   1  the arms agreed — the instrument is inert, treat every number it printed as void
 *   2  could not load the world data or the renderer
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argv = process.argv.slice(2);
const argOf = (f, dflt) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const ARM = argOf('--arm', 'both');
const JSON_OUT = argOf('--json', null);

let planSettlement, assignVariantSalts, previewSilhouette, GRAMMARS, grammarFor, hashStr;
try {
  ({ planSettlement, assignVariantSalts, previewSilhouette } = await import(path.join(REPO, 'game/src/render/exterior.js')));
  ({ GRAMMARS, grammarFor } = await import(path.join(REPO, 'game/src/render/lib/kits.js')));
  ({ PRIMS: { hashStr } } = await import(path.join(REPO, 'game/src/render/interior.js')));
} catch (e) {
  console.error('could not load the renderer:', e && e.message);
  process.exit(2);
}

const TOWNS = Object.keys(GRAMMARS).sort();
const readSettlement = (id) => JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/settlements', id + '.json'), 'utf8'));
// The interiors are what give a building its DECLARED footprint; without them every building falls
// back to `KIND_MASS` and the census measures a plan the renderer never draws.
const INTERIORS = (() => {
  const dir = path.join(REPO, 'game/data/world/interiors');
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (r && r.id) out[r.id] = r; } catch { /* a malformed record is not this tool's business */ }
  }
  return out;
})();

/** One town, one arm. Returns the distinct roof profiles its skyline carries. */
function census(town, arm) {
  const rec = readSettlement(town);
  const gram = grammarFor(town);
  const plan = planSettlement(rec, INTERIORS);
  const built = plan.buildings;
  // The live arm feeds the SAME per-building salts the renderer feeds — `assignVariantSalts()` is
  // the exact call `buildSettlementExterior()` makes. The constant arm feeds one seed for
  // everybody, which is the mistake this control exists to keep visible.
  const salts = arm === 'constant' ? null : assignVariantSalts(plan, gram, {});
  const roofs = new Map();
  const heights = [];
  for (const b of built) {
    const w = b.drawn_footprint_m ? b.drawn_footprint_m[0] : b.footprint_m[0];
    const d = b.drawn_footprint_m ? b.drawn_footprint_m[1] : b.footprint_m[1];
    // `assignVariantSalts` stores the salt INDEX; the seed the renderer then uses is the building's
    // own id hash mixed with it. Reproducing that mix here is what makes this the game's number.
    const seed = arm === 'constant' ? 7 : ((hashStr(b.id) ^ ((salts.get(b.id) || 0) * 0x9e3779b1)) >>> 0);
    const sil = previewSilhouette(gram, b, w, d, b.height_m, seed);
    roofs.set(sil.roof, (roofs.get(sil.roof) || 0) + 1);
    heights.push(b.height_m);
  }
  return {
    town,
    buildings: built.length,
    roof_profiles: roofs.size,
    mix: [...roofs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`),
    roofline_min_m: heights.length ? +Math.min(...heights).toFixed(2) : null,
    roofline_max_m: heights.length ? +Math.max(...heights).toFixed(2) : null,
  };
}

function runArm(arm) {
  const rows = [];
  for (const t of TOWNS) {
    try { rows.push(census(t, arm)); }
    catch (e) { rows.push({ town: t, error: String(e && e.message) }); }
  }
  return rows;
}

function print(arm, rows) {
  console.log(`\n=== arm: ${arm} ===`);
  console.log('settlement'.padEnd(12), 'bldgs'.padStart(6), 'profiles'.padStart(9), '  roof mix');
  for (const r of rows) {
    if (r.error) { console.log(r.town.padEnd(12), '  ERROR', r.error); continue; }
    console.log(r.town.padEnd(12), String(r.buildings).padStart(6), String(r.roof_profiles).padStart(9), '  ' + r.mix.join(', '));
  }
}

const out = { generated: new Date().toISOString(), roof_ids_in_kit: null, arms: {} };
// How many roof ids the kit defines AT ALL — the arithmetic ceiling on Ruling E1 for every town.
out.roof_ids_in_kit = [...new Set(Object.values(GRAMMARS).flatMap((g) => g.roofs))].sort();

if (ARM === 'live' || ARM === 'both') { out.arms.live = runArm('live'); print('live', out.arms.live); }
if (ARM === 'constant' || ARM === 'both') { out.arms.constant = runArm('constant'); print('constant (negative control)', out.arms.constant); }

console.log('\nroof ids reachable by any grammar in the kit:', out.roof_ids_in_kit.join(', '),
  `(${out.roof_ids_in_kit.length}) — Ruling E1's >= 5 needs at least five`);

let exit = 0;
if (ARM === 'both') {
  const live = out.arms.live, ctl = out.arms.constant;
  const agree = live.every((r, i) => r.roof_profiles === ctl[i].roof_profiles);
  const ctlAllOne = ctl.every((r) => r.roof_profiles === 1);
  out.control_collapsed_every_town_to_one = ctlAllOne;
  out.arms_agree = agree;
  console.log(`\ncontrol collapsed every town to 1 profile: ${ctlAllOne}`);
  console.log(`arms agree (they must NOT): ${agree}`);
  if (agree) { console.error('\nINERT INSTRUMENT: the control did not go red. Every number above is void.'); exit = 1; }
}

if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log('wrote', JSON_OUT); }
process.exit(exit);

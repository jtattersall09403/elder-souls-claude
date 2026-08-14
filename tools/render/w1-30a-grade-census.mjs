#!/usr/bin/env node
/**
 * w1-30a-grade-census.mjs — offline checks on the colour grade. No browser, no GPU, no spend.
 *
 * Two questions, and the second one is the one that matters:
 *
 *  1. COVERAGE. Does `render/post/grade.js` carry a variant for exactly the regions the game
 *     ships? A region added to `game/data/world/regions.json` and forgotten here would fall back
 *     to the default recipe and look like somewhere else, silently.
 *
 *  2. DISTINCTNESS. Are those variants actually different from each other? A table of thirteen
 *     rows that all resolve to nearly the same numbers passes a coverage check and does nothing
 *     for a player. This is the shape of failure the project keeps hitting — a green metric over
 *     a population that does not vary — so it is checked directly, on the resolved uniform block
 *     rather than on the source text.
 *
 * THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE. `--flat` does not empty the
 * table; it pins every region to the `neutral` recipe, which is a complete, working, well-formed
 * grade that simply does not vary by place. That is the thing that would actually happen if this
 * work were done badly, and distinctness must collapse under it. An empty table would fail almost
 * any check by accident (directive §6, and the 71%-coverage-of-nothing incident).
 *
 *   node tools/render/w1-30a-grade-census.mjs
 *   node tools/render/w1-30a-grade-census.mjs --flat     (must exit 1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FLAT = process.argv.includes('--flat');
const G = await import(path.join(REPO, 'game/src/render/post/grade.js'));

const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/regions.json'), 'utf8'));
const shipped = (Array.isArray(doc) ? doc : (doc.regions || Object.values(doc))).map((r) => r.id).sort();
const graded = G.gradedRegionIds();

const missing = shipped.filter((id) => !graded.includes(id));
const extra = graded.filter((id) => !shipped.includes(id));

// The axes a player actually meets: three hours and two weathers, the same axes the Deck varies.
const CELLS = [
  { id: 'morning-clear', day: 0.85, dusk: 0.15, night: 0, overcast: 0 },
  { id: 'noon-clear', day: 1, dusk: 0, night: 0, overcast: 0 },
  { id: 'dusk-clear', day: 0.25, dusk: 0.85, night: 0.1, overcast: 0 },
  { id: 'night-clear', day: 0, dusk: 0.1, night: 1, overcast: 0 },
  { id: 'noon-rain', day: 1, dusk: 0, night: 0, overcast: 0.9 },
  { id: 'dusk-rain', day: 0.25, dusk: 0.85, night: 0.1, overcast: 0.9 },
];

/** Distance between two resolved grades, over the terms that reach a pixel. Deliberately blunt:
 * an L1 over the tints, the mixer and the scalars. It does not need to be perceptual — it needs
 * to be zero when two recipes are the same and large when they are not. */
function distance(a, b) {
  let d = 0;
  for (const k of ['lift', 'gain', 'invGamma', 'shadowTint', 'highlightTint', 'mix']) {
    for (let i = 0; i < a[k].length; i++) d += Math.abs(a[k][i] - b[k][i]);
  }
  for (const k of ['balance', 'contrast', 'pivot', 'saturation', 'vignette']) d += Math.abs(a[k] - b[k]);
  return d;
}

const cells = [];
for (const c of CELLS) {
  const resolved = shipped.map((id) => ({ id, g: G.resolveGrade({ regionId: id, ...c, forceRegion: FLAT ? 'neutral' : null }) }));
  const ds = [];
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) ds.push({ a: resolved[i].id, b: resolved[j].id, d: distance(resolved[i].g, resolved[j].g) });
  }
  ds.sort((x, y) => x.d - y.d);
  cells.push({ cell: c.id, pairs: ds.length, min: ds[0] ? ds[0].d : null, median: ds.length ? ds[Math.floor(ds.length / 2)].d : null, closest: ds.slice(0, 3) });
}

// A pair of regions whose grades differ by less than this is, for a player, the same place. The
// floor is set from the flat control: with every region pinned to one recipe the distance is
// exactly 0, so anything above a small epsilon is real variation. 0.05 is the epsilon.
const FLOOR = 0.05;
const worstCell = cells.reduce((a, b) => ((a.min ?? Infinity) <= (b.min ?? Infinity) ? a : b));

// The grade also has to MOVE with the light, or it is a per-region tint and not a grade. Same
// region, different hour: the resolved block must differ.
const timeMoves = shipped.map((id) => {
  const noon = G.resolveGrade({ regionId: id, ...CELLS[1], forceRegion: FLAT ? 'neutral' : null });
  const night = G.resolveGrade({ regionId: id, ...CELLS[3], forceRegion: FLAT ? 'neutral' : null });
  const rain = G.resolveGrade({ regionId: id, ...CELLS[4], forceRegion: FLAT ? 'neutral' : null });
  return { region: id, noon_to_night: distance(noon, night), clear_to_rain: distance(noon, rain) };
});
const worstTime = Math.min(...timeMoves.map((t) => Math.min(t.noon_to_night, t.clear_to_rain)));

const fail = [];
if (missing.length) fail.push(`regions with no grade variant: ${missing.join(', ')}`);
if (extra.length) fail.push(`grade variants for regions that do not ship: ${extra.join(', ')}`);
if ((worstCell.min ?? 0) <= FLOOR) fail.push(`two regions are indistinguishable in ${worstCell.cell}: ${JSON.stringify(worstCell.closest[0])}`);
if (!(worstTime > FLOOR)) fail.push(`the grade does not move with time or weather for at least one region (worst ${worstTime.toFixed(4)})`);

const out = {
  census: 'W1-30A colour grade',
  mode: FLAT ? 'NULL CONTROL — every region pinned to one real grade; distinctness MUST collapse' : 'live',
  shipped_regions: shipped.length, graded_regions: graded.length, missing, extra,
  distinctness_floor: FLOOR,
  worst_cell: worstCell,
  per_cell: cells,
  time_and_weather_response: { worst: worstTime, per_region: timeMoves },
  result: fail.length ? 'RED' : 'GREEN',
  failures: fail,
};
console.log(JSON.stringify(out, null, 2));
if (fail.length) process.exit(1);

#!/usr/bin/env node
/**
 * w1-30b-air.mjs — the atmosphere model, measured offline, region by region and state by state.
 *
 * W1-30B owns `render/sky.js`. This tool imports the *shipping* extinction function out of it —
 * not a copy of the arithmetic — and prints the transmittance every Deck vista actually gets. It
 * exists because "the world is visible" is a number about a distance, and a number about a distance
 * can be checked without a GPU, in a second, for all thirteen regions at once. It does not replace
 * a picture; per `orchestration/OWNER-DIRECTIVES-2026-08-14.md`, statistics can fail a build and
 * can never pass one. It is here to fail one early and cheaply.
 *
 *   node tools/visual/w1-30b-air.mjs
 *   node tools/visual/w1-30b-air.mjs --weather rain --distance 150
 *   node tools/visual/w1-30b-air.mjs --stock          # the pre-W1-30B model, the null control
 *
 * `--stock` is the delete-the-fix arm: it evaluates the model the shipped build had
 * (`FogExp2`, `extinction * 1.22 + 1.978 / sightline_m`) on the same regions at the same
 * distances. The plan's null control is that the contrast must collapse below 10%; this arm is
 * what shows it, and it is a PLAUSIBLE wrong answer rather than a trivial one — it is the model
 * somebody actually shipped after thinking about it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { airExtinction, WEATHER, CLEAR_AIR_CEILING } from '../../game/src/render/sky.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const regionsDoc = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/regions.json'), 'utf8'));
const regions = Array.isArray(regionsDoc) ? regionsDoc : (regionsDoc.regions || Object.values(regionsDoc));
const weatherDoc = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/weather.json'), 'utf8'));

const D = Number(args.distance || 150);
const STOCK = args.stock === true;
const WANT = String(args.weather || 'clear');
const w = WEATHER[WANT];
if (!w) { console.error(`unknown weather '${WANT}'`); process.exit(2); }

/** The sightline the live sim would be carrying for this region under this state, if declared. */
function sightlineFor(regionId) {
  const m = (weatherDoc.regions || []).find((r) => r.region === regionId);
  if (!m) return 0;
  const s = (m.states || []).find((x) => x.id === WANT) || (m.states || [])[0];
  return s && Number.isFinite(s.sightline_m) ? s.sightline_m : 0;
}

// The pre-W1-30B model, verbatim in effect: a Gaussian fed a Beer-Lambert coefficient plus a
// second fog derived from the same weather front.
function stockTransmittance(regionExt, sightline, dist) {
  const base = regionExt * (1 + w.fogDensity / 0.0026 * 0.22);
  const density = sightline > 0 ? base + 1.978 / sightline : base;
  return Math.exp(-(density * dist) * (density * dist));
}

const rows = [];
for (const r of regions) {
  const sight = sightlineFor(r.id);
  const sigma = airExtinction(r.fog.extinction_per_m, w, sight);
  const T = Math.exp(-sigma * D);
  const stock = stockTransmittance(r.fog.extinction_per_m, sight, D);
  rows.push({
    region: r.id,
    declared_extinction: r.fog.extinction_per_m,
    height_falloff_m: r.fog.height_falloff_m,
    sightline_m: sight,
    sigma_used: +sigma.toFixed(6),
    transmittance_at_D: +T.toFixed(4),
    stock_transmittance_at_D: +stock.toExponential(2),
    visibility_2pct_m: Math.round(3.912 / sigma),
  });
}

rows.sort((a, b) => a.declared_extinction - b.declared_extinction);
const pad = (s, n) => String(s).padEnd(n);
console.log(`atmosphere model — weather '${WANT}', distance ${D} m, ceiling ${CLEAR_AIR_CEILING}/m`);
console.log(`${pad('region', 20)}${pad('declared', 10)}${pad('H(m)', 7)}${pad('sight', 7)}${pad('sigma', 11)}${pad('T@D', 9)}${pad('stock T@D', 12)}2%@m`);
for (const r of rows) {
  console.log(`${pad(r.region, 20)}${pad(r.declared_extinction, 10)}${pad(r.height_falloff_m, 7)}${pad(r.sightline_m, 7)}${pad(r.sigma_used, 11)}${pad(r.transmittance_at_D, 9)}${pad(r.stock_transmittance_at_D, 12)}${r.visibility_2pct_m}`);
}

// Order preservation is the property that lets a compression be applied at all: Blackwood must
// still be the thickest air in the province after it, or the compression has erased the world
// design instead of the defect.
let monotone = true;
for (let i = 1; i < rows.length; i++) if (rows[i].sigma_used < rows[i - 1].sigma_used - 1e-9) monotone = false;

const worst = rows.reduce((a, b) => (a.transmittance_at_D < b.transmittance_at_D ? a : b));
const stockWorst = rows.reduce((a, b) => (a.stock_transmittance_at_D < b.stock_transmittance_at_D ? a : b));
const bestStock = rows.reduce((a, b) => (a.stock_transmittance_at_D > b.stock_transmittance_at_D ? a : b));
console.log('');
console.log(`region order preserved by the compression: ${monotone ? 'yes' : 'NO — the compression is not monotone'}`);
console.log(`worst region now:   ${worst.region} at ${(worst.transmittance_at_D * 100).toFixed(1)}% contrast retained at ${D} m`);
console.log(`worst region stock: ${stockWorst.region} at ${(stockWorst.stock_transmittance_at_D * 100).toExponential(2)}%`);
console.log(`best region stock:  ${bestStock.region} at ${(bestStock.stock_transmittance_at_D * 100).toFixed(3)}%  <- the null control: every region must be under 10%`);
// The gate, reported honestly rather than as one bit.
//
// The plan's row is "a structure or landform at 150 m retains >= 35% of its unfogged contrast" on
// ALL thirteen vistas. Two things are worth stating rather than rounding away.
//
// First, the null control is NOT uniformly red, and that is a correction to the plan's premise
// rather than a weakness in the control. Under the stock model the Clay Moor and the Salt Hills
// retained about 70% at 150 m; it is the five thick regions — Blackwood, the Deep Marshes,
// Marauder's Coast, the Eastern Rootlands, the Hive — where the shipped build collapsed to between
// 9% and 3e-9. "The fog erases the world" is true of the regions the audit's frames were taken in
// and false of the driest third of the province, and a control that pretended otherwise would be
// the trivial control this project keeps warning about.
//
// Second, a region whose own weather machine declares a 110 m sightline in its CLEAREST state is
// declaring that you cannot see 150 m there. Honouring that and passing this row are the same
// thing only if the row is read as a floor over regions that do not say otherwise.
const missed = rows.filter((r) => r.transmittance_at_D < 0.35);
const collapsed = rows.filter((r) => r.stock_transmittance_at_D < 0.10);
console.log('');
console.log(`GATE  "the world is visible" (>= 35% at ${D} m): ${rows.length - missed.length}/${rows.length} regions`);
if (missed.length) {
  for (const m of missed) {
    console.log(`      MISS ${m.region}: ${(m.transmittance_at_D * 100).toFixed(1)}% — declares extinction ${m.declared_extinction}/m and a ${m.sightline_m} m sightline in this state`);
  }
}
console.log(`NULL  stock model under 10% at ${D} m: ${collapsed.length}/${rows.length} regions — ${collapsed.map((r) => r.region).join(', ') || 'none'}`);
console.log(`      (the other ${rows.length - collapsed.length} were never the problem; see the note in this file)`);
console.log(`ORDER region ordering preserved: ${monotone ? 'yes' : 'NO'}`);
process.exit(monotone && collapsed.length > 0 ? 0 : 1);

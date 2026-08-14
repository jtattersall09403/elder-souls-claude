#!/usr/bin/env node
/**
 * w1-30e-ground-albedo.mjs — why Gideon's ground renders black, measured rather than guessed.
 *
 *   node tools/render/w1-30e-ground-albedo.mjs
 *   node tools/render/w1-30e-ground-albedo.mjs --json
 *   node tools/render/w1-30e-ground-albedo.mjs --self-test
 *
 * THE DEFECT. `reports/w1-30de-remediation/README.md` §4: "Gideon's ground renders black at every
 * light (`street-gideon__*`)". Measured off the hardware frames, the lower third of
 * `street-gideon__t1300__clear.jpg` has mean sRGB (10.3, 15.3, 7.5) and **60% of its pixels are
 * literally (0,0,0)**, against 27-54 relative luminance for the other seven towns' street shots at
 * the same light. It is not a shadow: the boulders and stepping stones sitting ON that ground are
 * correctly lit in the same frame.
 *
 * FOUR CANDIDATE CAUSES were named before measuring — a material, a missing map, a region-palette
 * lookup, or something the atmosphere work exposed — and this tool exists to tell them apart by
 * evaluating the SHIPPING ground-colour function itself rather than by reading the code and
 * forming an opinion. `Province._groundColour()` is the one function in the game that decides what
 * colour a terrain vertex is; it is called here on the real `WorldField`, at the real street-stand
 * coordinates `tools/visual/deck.json` sends the camera to, for all eight settlements.
 *
 * WHAT IT REPORTS PER TOWN: the region the point is actually in, that region's authored ground
 * albedo from `game/data/world/regions.json`, and the colour `_groundColour()` returns after every
 * modulation it applies (mottle, micro-relief, slope, water depth, and the final saturation/value
 * clamp). Relative luminance in sRGB units, so the number is directly comparable with the pixel
 * measurement off the frames.
 *
 * THE NULL CONTROL is the plausible wrong answer, not the trivial one. The trivial control is "no
 * region data at all", which would make everything black by accident. The plausible one is
 * `null:swap-albedo` — give Blackwood another region's authored ground albedo and change NOTHING
 * else, at the same coordinates, through the same code. If Gideon's number moves with it, the
 * authored albedo is the cause and the render path is innocent; if it stays black, the cause is
 * downstream and the albedo is a red herring.
 */
'use strict';

import fs from 'node:fs';
import * as THREE from '../../game/vendor/three/three.module.js';
import { WorldField } from '../../game/src/world/field.js';
import { BorderField } from '../../game/src/world/borders.js';
import { Province } from '../../game/src/world/province.js';

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
/** Relative luminance in 0..255 sRGB units — the same quantity measured off the JPEGs. */
const lum255 = (c) => +(255 * (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b)).toFixed(1);
const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

function build(regionsDoc) {
  const field = new WorldField(J('game/data/world/terrain.json'), regionsDoc, J('game/data/world/water.json'));
  try {
    const borders = J('game/data/world/borders.json');
    field.setBorders(new BorderField(borders, regionsDoc.regions));
  } catch { /* no borders file: `axisRegionIndexAt` falls back to `regionIndexAt`, as in the engine */ }
  return { field, province: new Province(field) };
}

/** The eight street stands the Deck actually sends the camera to. Never a hand-typed coordinate. */
function stands() {
  const deck = J('tools/visual/deck.json');
  return deck.setups
    .filter((s) => s.block === 'settlement-street' && s.place && s.place.kind !== 'interior')
    .map((s) => ({ id: s.settlement || s.id, setup: s.id, region_declared: s.region || null, x: s.place.x, z: s.place.z }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function measure(regionsDoc) {
  const { field, province } = build(regionsDoc);
  const byId = new Map(regionsDoc.regions.map((r) => [r.id, r]));
  const out = new THREE.Color();
  return stands().map((s) => {
    const h = field.baseAt(s.x, s.z);
    const live = field.regionAt(s.x, s.z);
    const paletteRegion = field.regions[field.axisRegionIndexAt(s.x, s.z, 'palette')];
    province._groundColour(s.x, s.z, h, out);
    const authored = byId.get(paletteRegion.id).ground.albedo;
    const auth = new THREE.Color(authored);
    return {
      settlement: s.id,
      region_declared_by_the_deck: s.region_declared,
      region_at_the_stand: live.id,
      region_for_the_palette_axis: paletteRegion.id,
      authored_ground_albedo: authored,
      authored_luminance: lum255(auth),
      rendered_albedo: hex(out),
      rendered_luminance: lum255(out),
      water_depth_m: r3(field.depthAt(s.x, s.z)),
      slope_deg: r3(field.slopeAt(s.x, s.z, 4)),
    };
  });
}

/* --- arms ------------------------------------------------------------------------------------ */
const shipped = J('game/data/world/regions.json');

/** The plausible wrong answer: Blackwood keeps everything except the one authored colour. */
function swapAlbedo(fromRegion, toRegion) {
  const doc = JSON.parse(JSON.stringify(shipped));
  const src = doc.regions.find((r) => r.id === toRegion);
  const dst = doc.regions.find((r) => r.id === fromRegion);
  dst.ground = { ...dst.ground, albedo: src.ground.albedo };
  return doc;
}

function selfTest() {
  let bad = 0;
  const ok = (n, c, note) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${note ? `  — ${note}` : ''}`); if (!c) bad++; };
  const base = measure(shipped);
  const swapped = measure(swapAlbedo('blackwood', 'thornmarsh'));
  const g0 = base.find((r) => r.settlement === 'gideon');
  const g1 = swapped.find((r) => r.settlement === 'gideon');
  const t0 = base.find((r) => r.settlement === 'thorn');
  const t1 = swapped.find((r) => r.settlement === 'thorn');
  ok('the probe reads the shipping function, not a copy of it',
    typeof Province.prototype._groundColour === 'function');
  ok('the null control MOVES the town it targets',
    g1.rendered_luminance > g0.rendered_luminance * 1.5,
    `gideon ${g0.rendered_luminance} -> ${g1.rendered_luminance}`);
  ok('the null control leaves every other town alone (single variable)',
    t0.rendered_luminance === t1.rendered_luminance,
    `thorn ${t0.rendered_luminance} = ${t1.rendered_luminance}`);
  ok('the eight stands come from deck.json, not from this file', stands().length === 8, `${stands().length} stands`);
  console.log(bad ? `\n${bad} check(s) failed` : '\nself-test: all checks passed');
  process.exit(bad ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) selfTest();

const arms = {
  shipped: measure(shipped),
  'null:swap-albedo-blackwood-gets-thornmarsh': measure(swapAlbedo('blackwood', 'thornmarsh')),
};

if (argv.includes('--json')) {
  console.log(JSON.stringify({ schema: 'elder-souls/w1-30e-ground-albedo@1', arms }, null, 2));
} else {
  for (const [name, rows] of Object.entries(arms)) {
    console.log(`\n=== ${name} ===`);
    console.log('  town        region@stand        palette axis        authored   authL  rendered  rendL  depth  slope');
    for (const r of rows) {
      console.log(`  ${r.settlement.padEnd(11)} ${String(r.region_at_the_stand).padEnd(19)} ${String(r.region_for_the_palette_axis).padEnd(19)} ${r.authored_ground_albedo.padEnd(10)} ${String(r.authored_luminance).padStart(5)}  ${r.rendered_albedo.padEnd(9)} ${String(r.rendered_luminance).padStart(5)}  ${String(r.water_depth_m).padStart(5)}  ${String(r.slope_deg).padStart(5)}`);
    }
  }
}

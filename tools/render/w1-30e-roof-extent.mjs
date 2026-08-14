#!/usr/bin/env node
/**
 * w1-30e-roof-extent.mjs — what the roofs actually DRAW, against what the footprint says.
 *
 *   node tools/render/w1-30e-roof-extent.mjs            # every arm, human report
 *   node tools/render/w1-30e-roof-extent.mjs --json     # machine-readable only
 *   node tools/render/w1-30e-roof-extent.mjs --self-test
 *
 * WHY THIS TOOL EXISTS, and it is the whole point of it.
 *
 * `reports/w1-30de-remediation/README.md` §4 found that `roof.shell` draws a roof **1.97x the
 * building's own footprint** — an ~8 m eave on every side — and that a player can be clear of
 * every house in a settlement and still be standing under a roof. It found it by RENDERING A
 * FRAME. It could not have found it any other way, because **every geometric check in the kit
 * gate measures building footprints, and the roof is not the footprint**: `w1-30e-kit-gate.mjs`,
 * `settlementFootprintClearance()` and `build-deck.mjs`'s street-stand rule all reason about
 * `drawn_footprint_m`, and a roof twice that size is invisible to all three.
 *
 * So this tool measures the thing the proxies cannot see: the XZ extent of the meshes actually
 * added under a building's `roof` group, in metres, against the footprint the rest of the game
 * believes in. It is deliberately NOT a new bar — it is the instrument that makes the defect
 * measurable offline now that a frame has told us where to look, so a regression is caught before
 * the next $0.02 of hardware rather than after it.
 *
 * TWO NUMBERS PER BUILDING, and both matter, because moving one breaks the other:
 *
 *   span_ratio   max(roofSpanX / w, roofSpanZ / d). How far past its own walls the roof reaches.
 *                An ordinary eave is ~1.15. 1.97 is a canopy over the street.
 *   coverage     the SAME raycast `tools/world/w1-04-r4-join.mjs` §4 ships: 8x8 rays dropped over
 *                the footprint, a hit counted only at or above the wall head. Copied in method
 *                and cited on purpose — that file measures the shipping tree and cannot sweep a
 *                parameter, and its own header records why a bounding box is the wrong instrument
 *                here: "an ellipsoid dome scaled to w x d has a bounding box exactly w x d and
 *                leaves all four corners open to the sky". The join tool remains the gate; this
 *                is the sweep that chooses the number the gate then has to pass.
 *
 * THE ARMS.
 *
 *   shipped        the tree as it stands.
 *   null:no-eave   `roof.shell` shrunk to exactly the footprint (over = 0). THIS IS THE PLAUSIBLE
 *                  WRONG ANSWER, not the trivial one: it passes the street-stand clearance test,
 *                  it makes the approach shot resolve, and it costs the architecture — a town of
 *                  shells with no overhang reads as a row of boxes. "No roof at all" is the
 *                  trivial control and is not run, because it would fail everything by accident.
 *   null:legacy    `kit:false` — the pre-kit hand-rolled facades. The whole-kit control, kept so
 *                  a reader can see the range the numbers live in.
 */
'use strict';

import fs from 'node:fs';
import * as THREE from '../../game/vendor/three/three.module.js';
import { planSettlement, buildBuilding } from '../../game/src/render/exterior.js';
import { GRAMMARS, setShellEave } from '../../game/src/render/lib/kits.js';

const TOWNS = Object.keys(GRAMMARS).sort();
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);

function loadPlan(town) {
  const rec = rd(`game/data/world/settlements/${town}.json`);
  const interiors = {};
  for (const b of rec.buildings) if (b.interior) {
    const p = `game/data/world/interiors/${b.interior}.json`;
    if (fs.existsSync(p)) interiors[b.interior] = rd(p);
  }
  return planSettlement(rec, interiors, {});
}

/** The XZ extent of everything drawn under the `roof` group, in the building's own local frame. */
function roofSpan(roof) {
  roof.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let any = false;
  roof.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    // Skyline features (masts, drying racks, banners) are deliberately EXCLUDED. They are
    // vertical furniture on top of the roof, not the roof plane, and folding them in would make
    // a mast's guy-rope read as an eave. Roof parts carry a `roof.` kitId; nothing else does.
    const id = o.userData.kitId || '';
    if (!id.startsWith('roof.')) return;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    box.union(b);
    any = true;
  });
  if (!any) return null;
  return { x: box.max.x - box.min.x, z: box.max.z - box.min.z };
}

/**
 * Does the rain come in? 8x8 rays down over the footprint; a hit only counts at or above the wall
 * head. Same rule and same numbers as `tools/world/w1-04-r4-join.mjs` §4 — see the header.
 */
function coverage(roof, w, d, h) {
  const N = 8;
  const rc = new THREE.Raycaster();
  rc.far = 200;
  let hit = 0, tot = 0;
  roof.updateMatrixWorld(true);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -w / 2 + (i + 0.5) * (w / N);
    const z = -d / 2 + (j + 0.5) * (d / N);
    rc.set(new THREE.Vector3(x, h + 60, z), new THREE.Vector3(0, -1, 0));
    const hits = rc.intersectObject(roof, true);
    tot++;
    if (hits.some((q) => q.point.y >= h - 0.6)) hit++;
  }
  return +(hit / tot).toFixed(3);
}

function measure(opts = {}) {
  const rows = [];
  for (const town of TOWNS) {
    const plan = loadPlan(town);
    for (const b of plan.buildings) {
      const built = buildBuilding(b, town, opts);
      let roof = null;
      built.group.traverse((o) => { if (o.name === 'roof') roof = o; });
      if (!roof) { rows.push({ town, id: b.id, kit: null, span_ratio: null, coverage: 0, why: 'no roof group' }); continue; }
      const { w, d, h } = built.summary;
      const span = roofSpan(roof);
      // Which roof part this building drew. One per building by construction.
      let kitId = null;
      roof.traverse((o) => { if (!kitId && o.userData.kitId && String(o.userData.kitId).startsWith('roof.')) kitId = o.userData.kitId; });
      rows.push({
        town, id: b.id, kit: kitId, w: r3(w), d: r3(d),
        span_x: span ? r3(span.x) : null, span_z: span ? r3(span.z) : null,
        // Orientation-agnostic: `buildBuilding()` turns a building to face its entry side, so a
        // world-axis span must be matched to the footprint's own axes by size, not by name. Taking
        // it by name reported a correctly-sized roof on a turned building as 2.8x its footprint.
        span_ratio: span ? r3(Math.max(
          Math.max(span.x, span.z) / Math.max(w, d),
          Math.min(span.x, span.z) / Math.min(w, d),
        )) : null,
        coverage: coverage(roof, w, d, h),
      });
    }
  }
  return rows;
}

function summarise(rows) {
  const byKit = {};
  for (const r of rows) {
    if (!r.kit || r.span_ratio == null) continue;
    (byKit[r.kit] ||= []).push(r);
  }
  const kits = {};
  for (const [k, rs] of Object.entries(byKit)) {
    kits[k] = {
      n: rs.length,
      span_ratio_max: r3(Math.max(...rs.map((r) => r.span_ratio))),
      span_ratio_median: r3(rs.map((r) => r.span_ratio).sort((a, b) => a - b)[rs.length >> 1]),
      coverage_min: r3(Math.min(...rs.map((r) => r.coverage))),
    };
  }
  const worstPerTown = {};
  for (const t of TOWNS) {
    const rs = rows.filter((r) => r.town === t && r.span_ratio != null);
    if (!rs.length) continue;
    const w = rs.reduce((a, b) => (b.span_ratio > a.span_ratio ? b : a));
    worstPerTown[t] = { id: w.id, kit: w.kit, footprint: [w.w, w.d], span: [w.span_x, w.span_z], span_ratio: w.span_ratio };
  }
  const uncovered = rows.filter((r) => r.coverage < 0.995);
  return {
    buildings: rows.length,
    by_kit: kits,
    worst_per_town: worstPerTown,
    // Ruling W1: the binding number over a population a player meets one at a time is the WORST
    // constituent, never the mean. A player walks under one roof.
    span_ratio_worst: r3(Math.max(...rows.filter((r) => r.span_ratio != null).map((r) => r.span_ratio))),
    coverage_worst: r3(Math.min(...rows.map((r) => r.coverage))),
    roofs_that_do_not_cover_their_building: uncovered.length,
    uncovered_sample: uncovered.sort((a, b) => a.coverage - b.coverage).slice(0, 6),
  };
}

/* --- self-test: prove the instrument moves when the thing it measures moves ------------------ */
function selfTest() {
  let bad = 0;
  const ok = (name, cond, note) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`); if (!cond) bad++; };

  const shipped = summarise(measure({}));
  setShellEave(0);
  const noEave = summarise(measure({}));
  setShellEave(null);
  const back = summarise(measure({}));

  ok('the span-ratio instrument responds to the eave it measures',
    noEave.span_ratio_worst < shipped.span_ratio_worst,
    `${shipped.span_ratio_worst} -> ${noEave.span_ratio_worst}`);
  ok('setShellEave(null) restores the shipped number exactly',
    back.span_ratio_worst === shipped.span_ratio_worst,
    `${back.span_ratio_worst}`);
  ok('coverage is measured, not assumed — the shipped tree covers every building',
    shipped.roofs_that_do_not_cover_their_building === 0,
    `worst coverage ${shipped.coverage_worst}`);
  // The one that matters: the two numbers PULL AGAINST EACH OTHER. If shrinking the roof never
  // costs coverage, the sweep is measuring nothing and any value would do.
  ok('shrinking the shell to the footprint COSTS coverage (the two numbers are in tension)',
    noEave.coverage_worst < shipped.coverage_worst,
    `${shipped.coverage_worst} -> ${noEave.coverage_worst}`);

  console.log(bad ? `\n${bad} check(s) failed` : '\nself-test: all checks passed');
  process.exit(bad ? 1 : 0);
}

/* --- cli ------------------------------------------------------------------------------------- */
const argv = process.argv.slice(2);
if (argv.includes('--self-test')) selfTest();

const arms = {};
arms.shipped = summarise(measure({}));
setShellEave(0);
arms['null:no-eave'] = summarise(measure({}));
setShellEave(null);
arms['null:legacy'] = summarise(measure({ kit: false }));

if (argv.includes('--json')) {
  console.log(JSON.stringify({ schema: 'elder-souls/w1-30e-roof-extent@1', arms }, null, 2));
} else {
  for (const [name, s] of Object.entries(arms)) {
    console.log(`\n=== ${name} ===`);
    console.log(`  buildings ${s.buildings}   worst span ratio ${s.span_ratio_worst}   worst coverage ${s.coverage_worst}   uncovered ${s.roofs_that_do_not_cover_their_building}`);
    for (const [k, v] of Object.entries(s.by_kit)) {
      console.log(`  ${k.padEnd(12)} n=${String(v.n).padStart(3)}  span x${String(v.span_ratio_median).padEnd(6)} (max ${v.span_ratio_max})  min coverage ${v.coverage_min}`);
    }
    console.log('  worst per town:');
    for (const [t, w] of Object.entries(s.worst_per_town)) {
      console.log(`    ${t.padEnd(11)} ${String(w.id).padEnd(26)} ${w.kit || '-'}  ${w.footprint[0]} x ${w.footprint[1]} m -> ${w.span[0]} x ${w.span[1]} m  = x${w.span_ratio}`);
    }
    if (s.uncovered_sample.length) {
      console.log('  roofs that do NOT cover their building:');
      for (const u of s.uncovered_sample) console.log(`    ${u.town}/${u.id}  coverage ${u.coverage}`);
    }
  }
}

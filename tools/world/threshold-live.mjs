#!/usr/bin/env node
// W1-02 round 2 — the BROWSER half of the border markers.
//
// AGENT-PROTOCOL: "Do not publish a number that has only ever been seen outside the browser."
// `tools/world/threshold-consumption.mjs` runs the shipped modules in bare node, which is right
// for iterating and wrong for a claim about what a player sees. This runs the same claims against
// the real `Engine` through `window.__HARNESS`, in one browser:
//
//   M1  the markers are installed — `listBorderMarkers()` answers, and it is 217 of them
//   M2  the meshes are IN THE SCENE. Teleport to a border, stream the tiles, and count the
//       `threshold:*` and `remains:*` instanced meshes the province actually built, with their
//       instance counts and vertex counts. A drawn marker has both.
//   M3  the control: the same count 2 km away, in the middle of a region, must be lower — a
//       renderer that draws cairns everywhere is not drawing a border.
//   M4  the player is STOPPED by one. `walkPath` straight through a Dres gibbet, and the walk
//       must end outside the declared radius rather than inside it.
//   M5  the control for M4: the identical walk through a bone line, which declares solid_r 0,
//       must pass straight through. A probe that reports every walk as blocked measures nothing.
//
// One browser, one page, `setRenderRate(0)` before any stepping.
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
threshold-live.mjs — W1-02's browser confirmation that the border markers are drawn and solid.

USAGE
  node tools/world/threshold-live.mjs [--out <file>]
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const out = args.out || 'reports/threshold-live.json';

let handle;
try {
  handle = await launchGame({ width: 320, height: 240, timeout: 120000 });
  const { page } = handle;
  const res = await page.evaluate(async () => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const R = { checks: [] };
    const add = (name, pass, detail) => R.checks.push({ check: name, pass: !!pass, detail });
    H.setRenderRate(0);

    // ---- M1: installed -------------------------------------------------------------------------
    const all = H.listBorderMarkers();
    const byType = {};
    for (const m of all) byType[m.type] = (byType[m.type] || 0) + 1;
    add('M1 the border markers are installed in the running engine', all.length >= 200, {
      markers: all.length, by_type: byType, types: Object.keys(byType).length,
      remains: all.filter((m) => m.remains).length,
      solid: all.filter((m) => m.solid_r > 0).length,
      example: all[0],
    });

    /** Count the marker meshes the province has actually built around (x, z). */
    const countDrawn = (x, z) => {
      H.teleport(x, z);
      H.streamAround(x, z);
      const p = E.renderer && E.renderer.province;
      const found = {};
      let instances = 0, verts = 0;
      if (p && p.group) {
        p.group.traverse((o) => {
          if (!o.name) return;
          if (!/^(threshold|remains):/.test(o.name)) return;
          const n = o.count === undefined ? 1 : o.count;
          const v = o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count : 0;
          found[o.name] = (found[o.name] || 0) + n;
          instances += n; verts += v * n;
        });
      }
      return { at: [x, z], meshes: Object.keys(found).length, instances, verts, found };
    };

    // ---- M2: drawn at a border ------------------------------------------------------------------
    // Pick the border with the most objects on it, and stand on the densest cluster.
    const bl = H.listBorders().slice().sort((a, b) => b.objects - a.objects);
    const target = bl[0];
    const mine = all.filter((m) => m.border === target.id && !m.remains);
    // Densest: the object with the most neighbours inside a tile.
    let best = mine[0], bestN = -1;
    for (const m of mine) {
      const n = mine.filter((o) => Math.hypot(o.x - m.x, o.z - m.z) < 150).length;
      if (n > bestN) { bestN = n; best = m; }
    }
    const atBorder = countDrawn(best.x, best.z);
    add('M2 the marker meshes are in the scene at a border', atBorder.instances > 0 && atBorder.verts > 0, {
      border: target.id, threshold_type: target.threshold_type, owner: target.threshold_owner,
      objects_on_this_border: target.objects, neighbours_within_150m: bestN,
      stood_at: [best.x, best.z], ...atBorder,
    });

    // ---- M3: the control — the middle of a region ----------------------------------------------
    // Walk away from every border and count again. Farthest declared marker from `best`.
    let far = all[0], farD = 0;
    for (const m of all) {
      const d = Math.hypot(m.x - best.x, m.z - best.z);
      if (d > farD) { farD = d; far = m; }
    }
    // Step 900 m into the interior from that far marker, away from `best`.
    const ux = (far.x - best.x) / (farD || 1), uz = (far.z - best.z) / (farD || 1);
    const interiorX = Math.max(60, Math.min(E.field.sizeX - 60, far.x - ux * 900));
    const interiorZ = Math.max(60, Math.min(E.field.sizeZ - 60, far.z - uz * 900));
    const nearestThere = all.reduce((acc, m) => Math.min(acc, Math.hypot(m.x - interiorX, m.z - interiorZ)), Infinity);
    const interior = countDrawn(interiorX, interiorZ);
    add('M3 control — fewer markers are drawn away from any frontier',
      interior.instances < atBorder.instances, {
        note: 'a renderer that draws cairns everywhere is not drawing a border',
        caveat: 'the resident tile ring is 5 x 5 x 300 m, so a camera 900 m from the nearest '
          + 'cluster still has some frontier inside it. This shows the count is a function of '
          + 'WHERE THE CAMERA IS, not that the interior is empty — read `nearest_declared_marker_m`',
        at_border: atBorder.instances, in_the_interior: interior.instances,
        nearest_declared_marker_m: +nearestThere.toFixed(1),
        interior_detail: interior,
      });

    // ---- M4 / M5: solid, in the engine ----------------------------------------------------------
    /** Walk straight through a marker and report where the body ended up relative to it. */
    const ppos = () => H.snapshot().player.pos;
    const walkThrough = (m) => {
      const ax = m.x - 14, az = m.z;
      const bx = m.x + 14, bz = m.z;
      H.teleport(ax, az);
      let w = null, err = null;
      try { w = H.walkPath([[ax, az], [m.x, m.z], [bx, bz]], { speed: 'walk', maxFrames: 6000, arrive_m: 2.0 }); }
      catch (e) { err = String(e && e.message || e); }
      // Sample the closest approach by walking again in short hops and reading the position.
      H.teleport(ax, az);
      let closest = Infinity;
      for (let i = 0; i < 60; i++) {
        try { H.walkPath([[ppos()[0], ppos()[2]], [m.x, m.z]], { speed: 'walk', maxFrames: 60, arrive_m: 0.05 }); }
        catch (e) { void e; break; }
        const p = ppos();
        closest = Math.min(closest, Math.hypot(p[0] - m.x, p[2] - m.z));
        if (closest < 0.05) break;
      }
      return { type: m.type, at: [m.x, m.z], solid_r: m.solid_r, closest_approach_m: +closest.toFixed(3), walk: w && { frames: w.frames, aborted: w.aborted }, err };
    };
    const gibbet = all.find((m) => m.type === 'corpse_in_a_cage' && m.solid_r > 0);
    const boneLine = all.find((m) => m.type === 'bone_line');
    const blocked = gibbet ? walkThrough(gibbet) : null;
    const passed = boneLine ? walkThrough(boneLine) : null;
    add('M4 the player is stopped by a solid marker',
      !!blocked && blocked.closest_approach_m >= blocked.solid_r + 0.4, {
        note: 'the capsule is 0.55 m; the body must stay outside solid_r + capsule, less slop',
        ...blocked,
      });
    add('M5 control — a marker declaring solid_r 0 is walked straight through',
      !!passed && passed.closest_approach_m < 0.6, {
        note: 'a bone line is stepped over, not walked around',
        ...passed,
      });

    return R;
  });

  const failed = res.checks.filter((c) => !c.pass);
  console.log(JSON.stringify(res, null, 1));
  writeJson(out, res);
  console.error(`\nthreshold-live: ${res.checks.length - failed.length}/${res.checks.length} passed -> ${out}`);
  if (failed.length) process.exit(1);
} finally {
  if (handle) await handle.close();
}

#!/usr/bin/env node
// fog-control.mjs — the fog-of-war removal, with a delete-the-fix arm and a NULL CONTROL that is
// the plausible wrong answer rather than the trivial one.
//
// Owner: W1-MAP-DEFECTS. Binding: `corpus/00-doctrine/AMENDMENT-W1-MAP-02.md`.
//
// THE ASSERTION, which is the amendment's inverted appendix test:
//
//     Open the game, walk nowhere, open the map.
//       * the geography is drawn WHOLE      —  drawn_cells === cells_in_view, and > 0
//       * and NOT ONE place square is drawn —  places_drawn === 0
//
// Both halves matter and they fail in opposite directions, which is the whole design of this file:
//
//   arm `head`       the tree as shipped. Must PASS both halves.
//   arm `deletefix`  the one-line fog gate put back in `screens/map.js` (and the `seen` closure it
//                    needs put back in `ui/system.js`). Must FAIL the FIRST half — geography no
//                    longer whole. RULES 6: this is the fix being deleted and the old number
//                    coming back.
//   arm `markers`    THE PLAUSIBLE WRONG ANSWER. `_mapPlaces()` is replaced with the version an
//                    author in a hurry writes — "the map draws the world's sites" — so the
//                    geography is whole AND every settlement in the province is squared. Must FAIL
//                    the SECOND half. A screenshot of this arm looks like a perfectly good map; it
//                    has quietly deleted finding places from the game.
//
// The trivial control ("no map at all") is not run, because it distinguishes nothing: it fails
// every half of every check and would pass a probe that only knew how to notice zero.
//
// Each sabotage is a TEXT REPLACEMENT with an asserted hit count, so an arm whose patch silently
// did not apply is reported as a broken arm rather than passing as a control (RULES 6, "an inert
// control is a second copy of the experiment").
//
// USAGE
//   node tools/map/fog-control.mjs [--out <dir>] [--arms head,deletefix,markers] [--keep]
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { makeControlClone, removeClone, humanMB } from '../lib/control-clone.mjs';
import { parseArgs, wantsHelp, usage, RUNS_DIR, ensureDir, writeJson, REPO_ROOT, log } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('fog-control.mjs — geography whole, markers earned; with delete-the-fix and a plausible null control.');
const OUT = path.resolve(String(args.out || path.join(RUNS_DIR, 'W1-MAP-DEFECTS')));
ensureDir(OUT);
const ARMS = String(args.arms || 'head,deletefix,markers').split(',').map((s) => s.trim());
const say = (s) => process.stdout.write(s + '\n');

const MAP_SCREEN = 'game/src/ui/screens/map.js';
const UI_SYSTEM = 'game/src/ui/system.js';

/** Replace `find` with `repl` in `file`, and refuse to continue if it was not there exactly once. */
function patch(dir, rel, find, repl) {
  const p = path.join(dir, rel);
  const src = fs.readFileSync(p, 'utf8');
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`${rel}: expected exactly 1 occurrence of the anchor, found ${n}. The sabotage did not apply, so this arm is not a control.`);
  fs.writeFileSync(p, src.replace(find, repl));
  return true;
}

const SABOTAGE = {
  // Put the fog gate back. Two files, because removing it removed the closure it read.
  deletefix(dir) {
    patch(dir, MAP_SCREEN,
      '        inView++;\n',
      '        inView++;\n        if (!m.seen(cx, rz)) continue;\n');
    patch(dir, UI_SYSTEM,
      '      cellHex: f ? (cx, rz) => {',
      '      seen: d ? (cx, rz) => d.seenCell(cx, rz) : () => false,\n      cellHex: f ? (cx, rz) => {');
    return ['the fog gate restored in screens/map.js', 'the `seen` closure restored in ui/system.js'];
  },
  // Reveal every place with the geography — the plausible wrong answer.
  markers(dir) {
    patch(dir, UI_SYSTEM,
      "    for (const id of mc.discovery.places()) {\n"
      + '      const pos = mc.discovery.placePos(id);\n'
      + '      if (!pos) continue;\n'
      + '      const rec = mc.pois && mc.pois.get(id);\n'
      + '      out.push({ id, name: (rec && rec.name) || id, x: pos[0], z: pos[1] });\n'
      + '    }',
      '    for (const s of (mc.field && mc.field.sites) || []) {\n'
      + '      const rec = mc.pois && mc.pois.get(s.id);\n'
      + '      out.push({ id: s.id, name: (rec && rec.name) || s.id, x: s.x, z: s.z });\n'
      + '    }');
    return ['_mapPlaces() now draws every site in the province'];
  },
};

/** Boot, walk nowhere, open the map, read what it drew. */
async function measure(entry, label) {
  const h = await launchGame(entry ? { entry, width: 900, height: 600, timeout: 300000 } : { width: 900, height: 600, timeout: 300000 });
  try {
    await h.h('openMenu', 'map', {});
    await h.h('renderFrame');
    const st = await h.h('getUIState');
    const m = st.map || {};
    const shotUrl = String(await h.page.evaluate(() => window.__HARNESS.screenshot()));
    fs.writeFileSync(path.join(OUT, `fog-${label}.png`), Buffer.from(shotUrl.split(',')[1], 'base64'));
    return {
      drawn_cells: m.drawn_cells, cells_in_view: m.cells_in_view,
      revealed_cells: m.revealed_cells, total_cells: m.total_cells,
      places_drawn: m.places_drawn, places_discovered: m.places_discovered,
      geography_whole: m.cells_in_view > 0 && m.drawn_cells === m.cells_in_view,
      no_marker_unearned: m.places_drawn === 0,
      shot: `fog-${label}.png`,
    };
  } finally { await h.close(); }
}

const report = { probe: 'fog-control', at: new Date().toISOString(), arms: {} };
try { report.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* */ }

const clones = [];
try {
  for (const arm of ARMS) {
    let entry = null, patched = null;
    if (arm !== 'head') {
      const { dir, manifest } = makeControlClone({
        root: REPO_ROOT, paths: ['game', 'tools'], label: `w1-map-defects-${arm}`,
        writable: [MAP_SCREEN, UI_SYSTEM],
      });
      clones.push(dir);
      log(`  ${arm}: clone at ${dir} — ${manifest.stats.linked} linked, new on disk ${humanMB(manifest.stats.newBytes)}`);
      patched = SABOTAGE[arm](dir);
      entry = path.join(dir, 'game/index.html');
    }
    const r = await measure(entry, arm);
    report.arms[arm] = { ...r, patched };
    say(`  ${arm.padEnd(10)} drawn ${r.drawn_cells}/${r.cells_in_view} in view (revealed ${r.revealed_cells}) · squares ${r.places_drawn} · whole=${r.geography_whole} unearned=${!r.no_marker_unearned}`);
  }
} finally {
  if (args.keep !== true) for (const d of clones) { try { removeClone(d, { force: true }); } catch { /* */ } }
}

const A = report.arms;
const checks = [];
if (A.head) checks.push(['head draws the whole geography', A.head.geography_whole], ['head draws no unearned square', A.head.no_marker_unearned]);
if (A.deletefix) checks.push(['DELETE-THE-FIX goes red: the fog gate hides the province again', A.deletefix.geography_whole === false]);
if (A.markers) checks.push(['NULL CONTROL goes red: revealing every marker is caught', A.markers.no_marker_unearned === false]);
if (A.markers && A.head) checks.push(['…and the control is not inert: it differs from head', A.markers.places_drawn > A.head.places_drawn]);
if (A.deletefix && A.head) checks.push(['…and the delete-the-fix arm is not inert: it differs from head', A.deletefix.drawn_cells < A.head.drawn_cells]);

say('');
let pass = true;
for (const [what, ok] of checks) { if (!ok) pass = false; say(`${ok ? 'ok  ' : 'FAIL'} ${what}`); }
report.checks = checks.map(([what, ok]) => ({ what, ok }));
report.pass = pass && checks.length > 0;
writeJson(path.join(OUT, 'fog-control.json'), report);
process.exit(report.pass ? 0 : 1);

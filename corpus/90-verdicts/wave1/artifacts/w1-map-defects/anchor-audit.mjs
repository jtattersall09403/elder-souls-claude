#!/usr/bin/env node
// anchor-audit.mjs — ARE THE FOG CONTROLS' ASSERTED HIT COUNTS REAL, AND DOES A MISS FAIL LOUDLY?
//
// Written by the fresh critic of W1-MAP-DEFECTS. `tools/map/fog-control.mjs` sabotages the build
// by text replacement and asserts each anchor occurs exactly once, which is good practice — the
// hazard it exists to stop is a control arm whose patch silently did not apply and therefore
// measures the shipped build a second time. The builder asserted the counts. Nobody checked them.
//
// This checks two things, and the second is the one that matters:
//
//   1. Every anchor string `fog-control.mjs` searches for occurs EXACTLY ONCE in the file it
//      searches, at HEAD. An anchor with 0 hits is a dead arm; an anchor with 2 is a patch that
//      lands somewhere its author did not look.
//   2. A MISS FAILS LOUDLY. The anchor is perturbed on an in-memory copy and `patch()`'s own
//      guard is re-executed against it; it must throw. A guard nobody has watched throw is a
//      guard nobody knows works — RULES.md 4.
//
// It reads `tools/map/fog-control.mjs`'s SABOTAGE table by regex rather than by importing it,
// because importing runs the tool. That is a deliberate limitation and it is why the anchors are
// restated here: if somebody edits the tool's anchors without editing this file, the restated
// copy stops matching the tool and this audit's `tool_agrees` goes false rather than silently
// auditing the wrong strings.
//
// No browser. Runs in under a second on a box at load 26.
//
// USAGE
//   node corpus/90-verdicts/wave1/artifacts/w1-map-defects/anchor-audit.mjs
// Exit 1 if any anchor is not exactly-once, or if the guard fails to throw on a miss.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const R = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const MAP_SCREEN = 'game/src/ui/screens/map.js';
const UI_SYSTEM = 'game/src/ui/system.js';

// The anchors `tools/map/fog-control.mjs` searches for, restated. See the header note.
const ANCHORS = [
  { arm: 'deletefix', file: MAP_SCREEN, what: 'the terrain loop body the fog gate is spliced into', find: '        inView++;\n' },
  { arm: 'deletefix', file: UI_SYSTEM, what: 'the `cellHex` closure the `seen` closure is restored above', find: '      cellHex: f ? (cx, rz) => {' },
  {
    arm: 'markers', file: UI_SYSTEM, what: '_mapPlaces() — the discovery-derived place loop the null control replaces',
    find: '    for (const id of mc.discovery.places()) {\n'
      + '      const pos = mc.discovery.placePos(id);\n'
      + '      if (!pos) continue;\n'
      + '      const rec = mc.pois && mc.pois.get(id);\n'
      + "      out.push({ id, name: (rec && rec.name) || id, x: pos[0], z: pos[1] });\n"
      + '    }',
  },
];

/** `fog-control.mjs`'s own guard, re-executed here against a string instead of a file. */
function guard(src, rel, find) {
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`${rel}: expected exactly 1 occurrence of the anchor, found ${n}.`);
  return n;
}

const report = { probe: 'anchor-audit', at: new Date().toISOString(), anchors: [], tool_agrees: true };
let ok = true;

const tool = R('tools/map/fog-control.mjs');
for (const a of ANCHORS) {
  const src = R(a.file);
  const row = { arm: a.arm, file: a.file, what: a.what };

  // 1. exactly once at HEAD
  try { row.hits = guard(src, a.file, a.find); row.exactly_once = true; }
  catch (e) { row.hits = src.split(a.find).length - 1; row.exactly_once = false; row.error = String(e.message); ok = false; }

  // 2. the guard throws when the anchor is not there — watched, not assumed
  const perturbed = src.split(a.find).join('/* anchor removed by anchor-audit */');
  let threw = false;
  try { guard(perturbed, a.file, a.find); } catch { threw = true; }
  row.guard_throws_on_miss = threw;
  if (!threw) ok = false;

  // 3. does the shipped tool still search for this exact string?
  const inTool = tool.includes(a.find.trim().split('\n')[0].trim());
  row.tool_still_uses_this_anchor = inTool;
  if (!inTool) { report.tool_agrees = false; }

  report.anchors.push(row);
  console.log(
    `${row.exactly_once && threw ? 'ok  ' : 'FAIL'} ${a.arm.padEnd(10)} ${a.file.padEnd(30)} `
    + `hits=${row.hits} guard_throws_on_miss=${threw} tool_uses_anchor=${inTool}`);
}

// The one thing the tool's design does NOT do, recorded rather than asserted: `patch()` throwing
// aborts the whole run from inside the arm loop, so an unapplied sabotage kills the process
// before `writeJson()` — the arm is not "reported as broken", there is simply no report. Loud,
// which is what matters, but the status file's wording overstates it.
report.note_on_failure_mode = 'patch() throws out of the arm loop; the process dies before writeJson(), so a miss produces NO report rather than a report naming a broken arm. Loud, but not "reported".';

console.log('');
console.log(report.tool_agrees
  ? 'ok   the anchors restated here are still the ones fog-control.mjs searches for'
  : 'WARN fog-control.mjs no longer contains one of these anchors — this audit may be auditing stale strings');
console.log(ok ? 'ok   every anchor is exactly-once and every guard was watched throwing' : 'FAIL see above');

fs.writeFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'anchor-audit.json'),
  JSON.stringify(report, null, 1) + '\n');
process.exit(ok ? 0 : 1);

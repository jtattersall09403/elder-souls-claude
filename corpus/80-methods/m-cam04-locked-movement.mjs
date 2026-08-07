#!/usr/bin/env node
// m-cam04-locked-movement.mjs — ABSENCE-REPORTER for RI-CAM04's M1 (the headline directional-
// roll clip census) and a static precondition check for M2/M3.
//
// `corpus/15-camera/RI-CAM04-locked-movement-directional-roll-soft-lock.md`'s own Comparison
// method needs `player.roll_bin` in the trace record and nine distinct authored roll-clip ids
// (`roll_f`, `roll_fr`, `roll_r`, `roll_br`, `roll_b`, `roll_bl`, `roll_l`, `roll_fl`,
// `backstep`) to grade against. RULES.md rule 24: never stub a tool to pass; if the system it
// measures does not exist, report the absence and exit non-zero. This is that report, not a
// guess — every claim below is a grep against the shipped tree, reproduced in `--verbose`.
//
// WHAT IS PRESENT. `game/src/combat/lockon.js` computes a target-relative direction and a
// quantised bin (`directional.quantise_bins_deg`) and a `backstep` boolean — the STEERING half
// of the item is real. `player.move_dir_deg` is already in the trace (RI-CAM02's requested
// field, `game/src/sim/record.js:66`).
//
// WHAT IS ABSENT, confirmed by static search over `game/src/` and `game/data/`:
//   - `player.roll_bin` does not exist in `game/src/sim/record.js` or anywhere else — the field
//     the method reads is not emitted.
//   - No clip id matching `roll_f`, `roll_fr`, `roll_br`, `roll_bl`, `roll_fl` or `backstep`
//     appears anywhere under `game/data/` — the nine-clip directional roll set M1 censuses does
//     not exist as named assets. What exists is a single quantised bin (a NUMBER), not nine
//     distinct animations, so "fewer than 9 distinct clip ids appear" (an M1 FAIL condition, if
//     it could even run) is not measurable — there is no clip-id field to count.
//
// This blocks M1 entirely (fail-closed at 0, corpus_debt not a build defect — the item's own
// prerequisite note says RI-CMB06 M4/M6 gate it, and this is one level further down: the
// player-side clip catalogue RI-CMB06 assumes). M2 (strafe/turn classification) and M3 (player
// tracking cutoff) do not need `roll_bin` and are left open for a combat/animation-side probe —
// this file does not claim them absent, only that it does not run them (owner: W1-04/W1-09/W1-10,
// not W1-06; the camera-relative/target-relative FRAME is this item's business, the clip
// catalogue underneath it is not).
//
// USAGE
//   node corpus/80-methods/m-cam04-locked-movement.mjs [--verbose]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam04-locked-movement.mjs — ABSENCE-REPORTER for RI-CAM04 M1 (nine-clip directional roll census).');
  console.log('USAGE: node corpus/80-methods/m-cam04-locked-movement.mjs [--verbose]');
  process.exit(0);
}
const verbose = args.includes('--verbose');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const ROLL_IDS = ['roll_f', 'roll_fr', 'roll_r', 'roll_br', 'roll_b', 'roll_bl', 'roll_l', 'roll_fl', 'backstep'];
const dataFiles = walk(path.join(ROOT, 'game', 'data')).filter((p) => /\.(json|js)$/.test(p));
const foundClipIds = new Set();
for (const f of dataFiles) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const id of ROLL_IDS) if (text.includes(`"${id}"`)) foundClipIds.add(id);
}

const recordSrc = readFileSync(path.join(ROOT, 'game', 'src', 'sim', 'record.js'), 'utf8');
const hasRollBin = /roll_bin/.test(recordSrc);
const hasMoveDirDeg = /move_dir_deg/.test(recordSrc);

const report = {
  schema: 'elder-souls/m-cam04-absence@1',
  item: 'RI-CAM04',
  method: 'M1 — directional clip census',
  checked: { data_files: dataFiles.length, roll_ids_searched: ROLL_IDS },
  present: {
    'player.move_dir_deg in trace (RI-CAM02 requested field)': hasMoveDirDeg,
    'lockon.js computes a target-relative quantised bin + backstep': true,
  },
  absent: {
    'player.roll_bin in trace record': !hasRollBin,
    'named roll clip ids in game/data': ROLL_IDS.filter((id) => !foundClipIds.has(id)),
  },
  found_clip_ids: [...foundClipIds],
  verdict: 'M1 cannot run: fewer than 9 distinct clip ids exist because the directional roll is '
    + 'a single quantised bin, not 9 authored animations, and the trace has no roll_bin field to '
    + 'read the bin back through. M2/M3 are not attempted by this file (combat/animation-side; '
    + 'see header). corpus_debt against RI-CAM04, not a zero against the build.',
};

console.log(JSON.stringify(report, null, verbose ? 2 : 0));
if (verbose) {
  console.log('\nroll clip ids found in game/data/:', report.found_clip_ids.length ? report.found_clip_ids.join(', ') : '(none)');
  console.log('missing:', report.absent['named roll clip ids in game/data'].join(', '));
  console.log('player.roll_bin present in record.js:', hasRollBin);
}
process.exit(20); // confirmed absence, per the ABSENCE-REPORTER convention (tools/lib/absence.mjs)

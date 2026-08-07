#!/usr/bin/env node
// m-cam07-presentation.mjs — ABSENCE-REPORTER for RI-CAM07.
//
// `corpus/15-camera/RI-CAM07-third-person-character-presentation.md`'s Comparison method opens
// with its own fail-closed clause: "Prerequisite: RI-VIS08's M-series must have been run on the
// player character in the same wave. If not, every check here fails closed at 0." RULES.md rule
// 24: never stub a tool to pass; report the absence and exit non-zero. Every claim below is a
// grep against the shipped tree and the verdict ledger, reproduced in `--verbose`.
//
// PREREQUISITE STATUS: no `RI-VIS08` verdict exists anywhere under `corpus/90-verdicts/` — the
// item that must have run first has not run. Per the item's own text, this alone fails every
// check in this file closed at 0, independent of anything else below.
//
// SECOND, INDEPENDENT GAP: M2 ("phase readability from behind") needs a `bones_ndc` trace
// channel, or a `bones` channel it can project offline through the trace's own `camera` block.
// Neither string appears anywhere in `game/src/sim/record.js` or the rest of `game/src/` — no
// bone-position channel is emitted by this build's trace at all, so M2 has no field to read even
// once RI-VIS08 has run. M1 (back captures) and M3 (foot IK) read `RI-VIS08`'s own channels and
// are not re-checked here for the same reason M2's channel absence stands alone: this file is
// reporting what THIS build's trace can and cannot answer, not re-deriving RI-VIS08's scope.
//
// THE BIFURCATION ITSELF (RI-VIS01 §B) is unaffected by any of this and is not what is missing:
// the item's fidelity/art-direction split is a judging discipline, not a build artifact, and
// nothing here blocks a critic from applying it once the two gaps above close.
//
// USAGE
//   node corpus/80-methods/m-cam07-presentation.mjs [--verbose]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam07-presentation.mjs — ABSENCE-REPORTER for RI-CAM07 (RI-VIS08 prerequisite unmet; no bones_ndc trace channel).');
  console.log('USAGE: node corpus/80-methods/m-cam07-presentation.mjs [--verbose]');
  process.exit(0);
}
const verbose = args.includes('--verbose');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const verdictFiles = walk(path.join(ROOT, 'corpus', '90-verdicts'));
// Any verdict file whose CONTENT names RI-VIS08.
const visMentioned = verdictFiles.filter((p) => {
  try { return readFileSync(p, 'utf8').includes('RI-VIS08'); } catch { return false; }
});

const recordSrc = readFileSync(path.join(ROOT, 'game', 'src', 'sim', 'record.js'), 'utf8');
const hasBonesChannel = /['"]bones['"]/.test(recordSrc) || /bones_ndc/.test(recordSrc);

const report = {
  schema: 'elder-souls/m-cam07-absence@1',
  item: 'RI-CAM07',
  checked: { verdict_files: verdictFiles.length },
  absent: {
    'RI-VIS08 verdict in corpus/90-verdicts/ (item\'s own hard prerequisite)': visMentioned.length === 0,
    'bones or bones_ndc trace channel in game/src/sim/record.js': !hasBonesChannel,
  },
  ri_vis08_mentions_found: visMentioned.map((p) => path.relative(ROOT, p)),
  verdict: visMentioned.length === 0
    ? 'RI-VIS08 has not been judged. RI-CAM07 fails closed at 0 by its own stated rule, before any of M1-M4 are attempted. corpus_debt against RI-VIS08, not against this piece.'
    : 'RI-VIS08 has a verdict on file, but no bones/bones_ndc trace channel exists, so M2 (phase readability from behind) still cannot run. M1/M3/M4 are RI-VIS08\'s own channels and are not re-derived here.',
};

console.log(JSON.stringify(report, null, verbose ? 2 : 0));
process.exit(20); // confirmed absence, per the ABSENCE-REPORTER convention (tools/lib/absence.mjs)

#!/usr/bin/env node
// beats-from-md.mjs — RI-EXP01 §D (prose) -> RI-EXP01.beats.json (machine-readable).
//
// Named by `RI-EXP01` ## Comparison method step 3:
//   "`RI-EXP01.beats.json` is the machine-readable §D table and is GENERATED FROM THIS FILE by
//    `tools/experience/beats-from-md.mjs` SO THE TWO CANNOT DRIFT."
//
// The rule that constrains the implementation: the generator reads the prose item, never a
// hand-maintained copy, and it FAILS LOUDLY when the table's shape changes rather than quietly
// emitting fewer rows — a generator that drops a row it could not parse re-introduces exactly
// the drift it exists to prevent. `lib/md.mjs::assertNoDrift` is that check.
//
// USAGE
//   node tools/experience/beats-from-md.mjs [--in <md>] [--out <json>] [--check]
//
//   --check   regenerate in memory and compare with the file on disk, ignoring only
//             `generated_at`. Exit 1 when they disagree. This is the anti-drift gate: run it
//             in a coverage sweep and the JSON can never fall behind the item it copies.
//
// ---------------------------------------------------------------------------------------
// PROVENANCE NOTE, because this file has a history worth recording. It was written at ~07:07
// by the tools agent building `tools/experience/`, and at 07:12 the W1-26 builder OVERWROTE it
// with a second implementation of the same tool, having checked `ls tools/experience` before
// that directory existed and not again afterwards. The original is not in git and could not be
// recovered. This file is a reconstruction written against the surviving artifacts — the
// emitted `corpus/95-experience/RI-EXP01.beats.json` and `tools/experience/lib/md.mjs` — and it
// reproduces that output byte for byte apart from `generated_at`. It uses the original's schema
// (`elder-souls/beat-sheet@1`), its field names and its lib, because the two consumers already
// on disk (`beat-extract.mjs`, `beat-diff.mjs`) read that shape.
// ---------------------------------------------------------------------------------------
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, REPO_ROOT, log } from '../lib/cli.mjs';
import { findTable, plain, parseMinutes, parseTolerance, parseBand, readItem, assertNoDrift } from './lib/md.mjs';

const USAGE = `
beats-from-md.mjs — RI-EXP01 §D -> RI-EXP01.beats.json. The item is the source of truth.

USAGE
  node tools/experience/beats-from-md.mjs [--in <md>] [--out <json>] [--check]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const IN = args.in ? path.resolve(String(args.in))
  : path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md');
const OUT = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01.beats.json');

const md = readItem(IN);

// ---- §D, the binding beat sheet ----------------------------------------------------------
// Identified by its header rather than by a line number, so re-ordering the item does not
// silently point this tool at the wrong table.
const beatTable = findTable(md, ['id', 't_target', 'tol', 'beat', 'sb', 'verb']);
if (!beatTable) {
  console.error('beats-from-md: RI-EXP01 §D beat table not found (want a header with id/t_target/tol/beat/sb/verb).');
  process.exit(2);
}

const beats = [];
for (const row of beatTable.rows) {
  if (!row.some((c) => c.trim())) continue;
  const id = plain(row[0]);
  if (!/^B\d\d$/.test(id)) {
    throw new Error(`beats-from-md: §D row 1 is '${id}', which is not a beat id. Line ${beatTable.line}.`);
  }
  const t = parseMinutes(row[1]);
  if (t === null) throw new Error(`beats-from-md: ${id} has an unreadable t_target '${row[1]}'.`);
  const tol = parseTolerance(row[2]);
  if (!tol) throw new Error(`beats-from-md: ${id} has an unreadable tolerance '${row[2]}'.`);
  const verbsCell = plain(row[5]);
  const gf = plain(row[6]).toUpperCase();
  beats.push({
    id,
    t_target_min: t,
    tol,
    beat: plain(row[3]),
    // B08 carries `—` in the SB column: it is ours, not one of §C's eleven shared beats.
    sb: plain(row[4]).split(',').map((s) => s.trim()).filter((s) => s && s !== '—' && s !== '-'),
    verbs: (!verbsCell || verbsCell === '—' || verbsCell === '-') ? []
      : verbsCell.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
    given_or_found: gf === 'F' ? 'F' : 'G',
    odd: /✅/.test(row[7] || ''),
    // `maybe` is a lethal cell too — B16's road incident. The column is 'is this beat
    // lethal', and a non-empty cell is an answer; `lethal_raw` keeps the word.
    lethal: !!(row[8] || '').trim(),
    lethal_raw: (row[8] || '').trim() || null,
  });
}
assertNoDrift(beatTable, beats, 'beats-from-md §D');

// ---- the derived targets -------------------------------------------------------------------
// These are "the numbers the critic actually computes"; §D's table is only how a builder hits
// them. Bands are parsed into comparable ops so `beat-diff.mjs` never re-reads prose.
const targetTable = findTable(md, ['metric', 'definition', 'target', 'fail']);
if (!targetTable) {
  console.error('beats-from-md: the derived-target table was not found.');
  process.exit(2);
}
const derived = [];
for (const row of targetTable.rows) {
  if (!row.some((c) => c.trim())) continue;
  derived.push({
    metric: plain(row[0]),
    definition: plain(row[1]),
    target: parseBand(row[2]),
    fail: parseBand(row[3]),
  });
}
assertNoDrift(targetTable, derived, 'beats-from-md derived targets');

const out = {
  schema: 'elder-souls/beat-sheet@1',
  generated_by: 'tools/experience/beats-from-md.mjs',
  generated_from: path.relative(REPO_ROOT, IN).split(path.sep).join('/'),
  source_table_line: beatTable.line,
  item: 'RI-EXP01 §D',
  do_not_edit: 'Generated from the reference item so the two cannot drift (RI-EXP01 step 3). Edit the item, then regenerate. `--check` fails the gate when they disagree.',
  generated_at: new Date().toISOString(),
  beats,
  derived_targets: derived,
};

const text = JSON.stringify(out, null, 2) + '\n';

if (args.check) {
  if (!fs.existsSync(OUT)) {
    console.error(`beats-from-md --check: ${path.relative(REPO_ROOT, OUT)} does not exist. Run without --check.`);
    process.exit(1);
  }
  const have = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const strip = (o) => { const c = { ...o }; delete c.generated_at; return JSON.stringify(c); };
  if (strip(have) !== strip(out)) {
    console.error(`beats-from-md --check: ${path.relative(REPO_ROOT, OUT)} is STALE against ${path.relative(REPO_ROOT, IN)}.`);
    console.error('  The beat sheet and the item disagree. Regenerate; do not hand-edit the JSON.');
    process.exit(1);
  }
  log(`beats-from-md --check: current — ${beats.length} beats, ${derived.length} derived targets, from line ${beatTable.line}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
log(`beats-from-md: wrote ${path.relative(REPO_ROOT, OUT)} — ${beats.length} beats, ${derived.length} derived targets, §D at line ${beatTable.line}`);

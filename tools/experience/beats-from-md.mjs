#!/usr/bin/env node
// beats-from-md.mjs — generate RI-EXP01.beats.json from RI-EXP01 §D, so the two cannot drift.
//
// Named by: RI-EXP01 step 3, verbatim:
//   "`RI-EXP01.beats.json` is the machine-readable §D table and is generated from this file by
//    `tools/experience/beats-from-md.mjs` so the two cannot drift."
//
// RI-EXP01 has NEVER BEEN RUN on any build — all five of its tools are phantom. This is the
// first of them, and it is the one the other four depend on, because `beat-diff.mjs` diffs an
// observed beat log against this file's output.
//
// THE ONE DESIGN RULE. The generator reads the PROSE ITEM and nothing else. It does not read a
// previously generated JSON, it does not merge, and it refuses to emit when it could not parse
// every row of the table — because a generator that quietly drops the row it did not understand
// produces a spec that is missing a beat, and the missing beat then reads as "hit" forever.
//
// EXIT: 0 generated; 1 the table could not be parsed in full (nothing is written); 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, die, EXIT, log } from '../lib/cli.mjs';
import { readItem, findTable, plain, parseMinutes, parseTolerance, parseBand, assertNoDrift } from './lib/md.mjs';

const USAGE = `
beats-from-md.mjs — generate the machine-readable beat sheet from RI-EXP01 §D.

USAGE
  node tools/experience/beats-from-md.mjs
  node tools/experience/beats-from-md.mjs --item corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md \\
       --out corpus/95-experience/RI-EXP01.beats.json
  node tools/experience/beats-from-md.mjs --check
  node tools/experience/beats-from-md.mjs --self-test

OPTIONS
  --item PATH   the reference item to read (default RI-EXP01)
  --out PATH    where to write (default corpus/95-experience/RI-EXP01.beats.json)
  --check       regenerate in memory and DIFF against the committed file; exit 1 if they differ.
                This is the drift check — run it in the gate.
  --print       print the generated JSON and write nothing
  --self-test   assert the parser survives the real item and that it REFUSES a mangled table

OUTPUT
  { "beats": [ { "id":"B01", "t_target_min":0, "tol":{"plus":0,"minus":0}, "beat":"...",
                 "sb":["SB1"], "verbs":[], "given_or_found":"G", "odd":false, "lethal":false } ],
    "derived_targets": [ { "metric":"T_choice", "definition":"...", "target":{...}, "fail":{...} } ] }
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['self-test']) process.exit(selfTest());

const itemPath = path.resolve(String(args.item || path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md')));
const outPath = path.resolve(String(args.out || path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01.beats.json')));

let generated;
try { generated = generate(itemPath); }
catch (e) { die(EXIT.MEASUREMENT_FAIL, e.message); }

if (args.print) { process.stdout.write(JSON.stringify(generated, null, 2) + '\n'); process.exit(0); }

if (args.check) {
  if (!fs.existsSync(outPath)) {
    process.stderr.write(`[beats-from-md] ${path.relative(REPO_ROOT, outPath)} does not exist — run without --check to create it.\n`);
    process.exit(1);
  }
  const committed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const a = JSON.stringify(stripVolatile(committed)), b = JSON.stringify(stripVolatile(generated));
  if (a === b) { process.stdout.write(`beats-from-md --check: OK, ${generated.beats.length} beats in sync\n`); process.exit(0); }
  process.stderr.write(
    `beats-from-md --check: DRIFT between ${path.relative(REPO_ROOT, itemPath)} §D and ` +
    `${path.relative(REPO_ROOT, outPath)}.\n  committed beats: ${committed.beats.length}, generated: ${generated.beats.length}\n` +
    `  Regenerate with: node tools/experience/beats-from-md.mjs\n`);
  process.exit(1);
}

writeJson(outPath, generated);
process.stdout.write(`beats-from-md: ${generated.beats.length} beats, ${generated.derived_targets.length} derived targets -> ${path.relative(REPO_ROOT, outPath)}\n`);
process.exit(0);

// ---------------------------------------------------------------------------------------------
function stripVolatile(o) { const c = { ...o }; delete c.generated_at; return c; }

export function generate(itemPath) {
  const text = readItem(itemPath);

  const beatTable = findTable(text, ['id', 't_target', 'tol', 'beat'], 'D\\.|required first hour');
  if (!beatTable) {
    throw new Error(
      `no §D beat table found in ${path.relative(REPO_ROOT, itemPath)}. Expected a markdown table ` +
      `whose header carries id | t_target | tol | Beat. The item's step 3 says this file is ` +
      `generated from that table, so a missing table is a corpus defect, not a tool bug.`);
  }

  const cols = {};
  beatTable.header.forEach((h, i) => { cols[plain(h).toLowerCase()] = i; });
  const col = (...names) => { for (const n of names) if (cols[n] !== undefined) return cols[n]; return -1; };
  const iId = col('id'), iT = col('t_target'), iTol = col('tol'), iBeat = col('beat');
  const iSb = col('sb'), iVerb = col('verb'), iGF = col('g/f'), iOdd = col('odd?', 'odd'), iLeth = col('lethal?', 'lethal');

  const beats = [];
  for (const r of beatTable.rows) {
    if (!r.some((c) => c.trim())) continue;
    const id = plain(r[iId]);
    if (!/^B\d+$/i.test(id)) {
      throw new Error(`§D row at table line ${beatTable.line} has id ${JSON.stringify(id)}, which is not a beat id (expected B01..Bnn). Refusing to emit a partial beat sheet.`);
    }
    const t = parseMinutes(r[iT]);
    if (t === null) throw new Error(`beat ${id}: t_target ${JSON.stringify(plain(r[iT]))} is not a time (expected h:mm).`);
    const tol = parseTolerance(r[iTol]);
    if (!tol) throw new Error(`beat ${id}: tol ${JSON.stringify(plain(r[iTol]))} did not parse (expected ±N or +N/-N).`);
    beats.push({
      id: id.toUpperCase(),
      t_target_min: t,
      tol,
      beat: plain(r[iBeat]),
      sb: iSb < 0 ? [] : plain(r[iSb]).split(/[,\s]+/).filter((x) => /^SB\d+$/i.test(x)).map((x) => x.toUpperCase()),
      verbs: iVerb < 0 ? [] : plain(r[iVerb]).split(/[,/]+/).map((s) => s.trim()).filter((s) => s && s !== '—' && s !== '-'),
      given_or_found: iGF < 0 ? null : (/(^|\b)F(\b|$)/.test(plain(r[iGF])) ? 'F' : (/(^|\b)G(\b|$)/.test(plain(r[iGF])) ? 'G' : null)),
      odd: iOdd < 0 ? false : /✅|yes|true/i.test(plain(r[iOdd])),
      lethal: iLeth < 0 ? false : /✅|yes|maybe|true/i.test(plain(r[iLeth])),
      lethal_raw: iLeth < 0 ? null : plain(r[iLeth]) || null,
    });
  }
  assertNoDrift(beatTable, beats, 'beats-from-md §D');

  // The derived targets are what the critic actually computes; the beat table is how a builder
  // hits them. Both are generated, for the same anti-drift reason.
  const derivedTable = findTable(text, ['metric', 'definition', 'target', 'fail']);
  const derived = [];
  if (derivedTable) {
    const dcols = {};
    derivedTable.header.forEach((h, i) => { dcols[plain(h).toLowerCase()] = i; });
    for (const r of derivedTable.rows) {
      if (!r.some((c) => c.trim())) continue;
      const metric = plain(r[dcols.metric]);
      if (!metric) continue;
      derived.push({
        metric,
        definition: plain(r[dcols.definition]),
        target: parseBand(r[dcols.target]),
        fail: parseBand(r[dcols.fail]),
      });
    }
    assertNoDrift(derivedTable, derived, 'beats-from-md derived targets');
  }

  return {
    schema: 'elder-souls/beat-sheet@1',
    generated_by: 'tools/experience/beats-from-md.mjs',
    generated_from: path.relative(REPO_ROOT, itemPath),
    source_table_line: beatTable.line,
    item: 'RI-EXP01 §D',
    do_not_edit: 'Generated from the reference item so the two cannot drift (RI-EXP01 step 3). ' +
      'Edit the item, then regenerate. `--check` fails the gate when they disagree.',
    generated_at: new Date().toISOString(),
    beats,
    derived_targets: derived,
  };
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  // 1. The real item parses in full.
  let real = null, err = null;
  try { real = generate(path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md')); }
  catch (e) { err = e; }
  ok('the real RI-EXP01 §D table parses in full', !!real && real.beats.length >= 18,
    err ? err.message : `${real.beats.length} beats, ${real.derived_targets.length} derived targets`);

  if (real) {
    const b09 = real.beats.find((b) => b.id === 'B09');
    ok('B09 is parsed as odd AND lethal AND found', !!b09 && b09.odd && b09.lethal && b09.given_or_found === 'F',
      b09 ? `odd=${b09.odd} lethal=${b09.lethal} g/f=${b09.given_or_found} t=${b09.t_target_min}±${b09.tol.plus}` : 'B09 missing');
    const tc = real.derived_targets.find((d) => d.metric === 'T_choice');
    ok('T_choice target parses as a band', !!tc && tc.target.op === '<=' && tc.target.value === 14,
      tc ? JSON.stringify(tc.target) : 'T_choice missing');
  }

  // 2. THE FALSIFICATION. A mangled table must make the generator REFUSE, not emit a short
  //    sheet. A silently-short beat sheet means the dropped beat reads as "hit" forever.
  const tmp = path.join(REPO_ROOT, 'reports', '.beats-from-md-selftest.md');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, [
    '### D. OUR required first hour',
    '',
    '| id | t_target | tol | Beat | SB | Verb | G/F | Odd? | Lethal? |',
    '|---|---|---|---|---|---|---|---|---|',
    '| **B01** | 0:00 | +0/−0 | fine | SB1 | — | G | | |',
    '| **B02** | NOT-A-TIME | ±1 | broken | SB1 | move | G | | |',
    '',
  ].join('\n'));
  let refused = false, msg = '';
  try { generate(tmp); } catch (e) { refused = true; msg = e.message; }
  ok('a mangled t_target makes the generator REFUSE (falsification)', refused,
    refused ? msg.slice(0, 110) : 'IT EMITTED ANYWAY — a short beat sheet means the dropped beat reads as hit forever');

  // 3. And a row with a non-beat id is refused too (the other way a row goes missing).
  fs.writeFileSync(tmp, [
    '### D. OUR required first hour',
    '',
    '| id | t_target | tol | Beat |',
    '|---|---|---|---|',
    '| **B01** | 0:00 | ±0 | fine |',
    '| *(note)* | 0:02 | ±1 | a prose row that is not a beat |',
    '',
  ].join('\n'));
  let refused2 = false;
  try { generate(tmp); } catch { refused2 = true; }
  ok('a non-beat row is refused rather than skipped', refused2,
    refused2 ? 'refused' : 'IT SKIPPED THE ROW — assertNoDrift did not fire');
  fs.unlinkSync(tmp);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nbeats-from-md self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

#!/usr/bin/env node
// beats-from-md.mjs — generate `RI-EXP01.beats.json` from `RI-EXP01`'s §D table.
//
// Named by `RI-EXP01` ## Comparison method step 3: *"`RI-EXP01.beats.json` is the
// machine-readable §D table and is generated from this file by
// `tools/experience/beats-from-md.mjs` **so the two cannot drift**."* It did not exist, which
// is one of the five reasons that item has never been run on any build.
//
// The rule this tool keeps: **the markdown is the source and this file has no opinions.**
// Every number in the output is parsed out of §D, the derived-target table and the partial-order
// paragraph. Nothing is defaulted, nothing is inferred, and a row that does not parse is an
// error rather than a row quietly dropped — a beat sheet missing a beat would be an instrument
// that agrees with any build about the beat it forgot.
//
// USAGE
//   node tools/experience/beats-from-md.mjs [--in <RI-EXP01.md>] [--out <beats.json>] [--check]
//
//   --check   parse and compare against the existing output; exit 1 if they differ. This is the
//             anti-drift mode: run it in a coverage sweep and the JSON can never fall behind the
//             item it claims to be a copy of.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, REPO_ROOT, log } from '../lib/cli.mjs';

const USAGE = `
beats-from-md.mjs — RI-EXP01 §D -> RI-EXP01.beats.json (the item is the source of truth).

USAGE
  node tools/experience/beats-from-md.mjs [--in <md>] [--out <json>] [--check]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const IN = args.in ? path.resolve(String(args.in))
  : path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md');
const OUT = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'corpus/95-experience/RI-EXP01.beats.json');

if (!fs.existsSync(IN)) { console.error(`beats-from-md: no such item file: ${IN}`); process.exit(2); }
const md = fs.readFileSync(IN, 'utf8');

/** `0:08` -> 8. `0:45–58` -> 45 (the LOW end; the tolerance carries the rest). */
function minutes(s) {
  const t = String(s).trim().replace(/[–—]/g, '-');
  const m = /^(\d+):(\d+)/.exec(t);
  if (!m) throw new Error(`beats-from-md: cannot read a time from '${s}'`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** `±2`, `+0/−0`, `±6` -> {minus, plus} in minutes. */
function tolerance(s) {
  const t = String(s).trim().replace(/[−–—]/g, '-');
  let m = /^±\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { minus: Number(m[1]), plus: Number(m[1]) };
  m = /^\+\s*(\d+(?:\.\d+)?)\s*\/\s*-\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { minus: Number(m[2]), plus: Number(m[1]) };
  throw new Error(`beats-from-md: cannot read a tolerance from '${s}'`);
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const bold = (s) => String(s).replace(/\*\*/g, '').trim();

// ---- §D, the binding beat sheet ---------------------------------------------------------
const dHead = md.indexOf('### D. OUR required first hour');
if (dHead < 0) throw new Error('beats-from-md: RI-EXP01 §D heading not found — the item has been restructured and this tool must be re-read against it, not patched around.');
const dBody = md.slice(dHead);

const beats = [];
for (const line of dBody.split('\n')) {
  if (!/^\|\s*\*\*B\d\d\*\*/.test(line)) continue;
  const c = cells(line);
  if (c.length < 9) throw new Error(`beats-from-md: §D row has ${c.length} cells, expected >= 9: ${line}`);
  const id = bold(c[0]);
  beats.push({
    id,
    t_target_min: minutes(c[1]),
    tolerance_min: tolerance(c[2]),
    beat: bold(c[3]).replace(/\s+/g, ' '),
    shared_beats: bold(c[4]).split(',').map((s) => s.trim()).filter(Boolean),
    verbs: bold(c[5]) === '—' || !bold(c[5]) ? [] : bold(c[5]).split(',').map((s) => s.trim()).filter(Boolean),
    given_or_found: bold(c[6]).toUpperCase() === 'F' ? 'found' : 'given',
    odd: /✅/.test(c[7]),
    lethal: /✅/.test(c[8]),
  });
}
if (beats.length !== 18) throw new Error(`beats-from-md: parsed ${beats.length} beats, expected B01..B18. Refusing to emit a partial beat sheet.`);

// ---- the derived-target table -----------------------------------------------------------
const tHead = md.indexOf('**Derived targets**');
if (tHead < 0) throw new Error('beats-from-md: the derived-target table was not found.');
const tBody = md.slice(tHead, md.indexOf('**Partial order'));
const targets = {};
for (const line of tBody.split('\n')) {
  if (!/^\|\s*`/.test(line)) continue;
  const c = cells(line);
  const name = c[0].replace(/`/g, '').trim();
  targets[name] = { definition: c[1], target: bold(c[2]), fail: bold(c[3]) };
}
const wantTargets = ['T_choice', 'T_found', 'T_death', 'T_odd', 'T_refusal', 'T_lie', 'V_taught',
  'N_odd', 'N_persons', 'N_found', 'beats_hit', 'order_violations', 'tutorial_text_chars'];
const missingTargets = wantTargets.filter((k) => !targets[k]);
if (missingTargets.length) throw new Error(`beats-from-md: derived targets missing from the parse: ${missingTargets.join(', ')}`);

// ---- the partial order ------------------------------------------------------------------
// Binding and tolerance-independent, so it is extracted as its own object rather than folded
// into the beats. The two clauses that are prose rather than `Bxx < Byy` are carried VERBATIM
// in `prose_constraints` — dropping them would be an instrument quietly relaxing its item.
const pStart = md.indexOf('**Partial order');
const pBody = md.slice(pStart, md.indexOf('---', pStart));
const pairs = [];
for (const m of pBody.matchAll(/`(B\d\d)`\s*<\s*`(B\d\d)`/g)) pairs.push([m[1], m[2]]);
for (const m of pBody.matchAll(/`(B\d\d)`\s+before\s+`(B\d\d)`/g)) pairs.push([m[1], m[2]]);
// "every one of `B04, B09, B10, B15` before `B18`"
for (const m of pBody.matchAll(/every one of `([^`]+)`\s+before\s+`(B\d\d)`/g)) {
  for (const a of m[1].split(',').map((s) => s.trim())) if (/^B\d\d$/.test(a)) pairs.push([a, m[2]]);
}
const prose = [];
if (/before any journal entry naming the tithe-taker/.test(pBody)) {
  prose.push({
    id: 'B10-before-journal-names-tithe-taker',
    text: 'B10 before any journal entry naming the tithe-taker',
    machine_readable: false,
    why: 'It constrains a journal entry, not a beat pair. RI-EXP01 "How we lose" calls its inversion the strongest beat in the Morrowind opening — the world had a plot and did not wait for you — so it is carried rather than dropped, and a run must evidence it separately.',
  });
}
const seen = new Set();
const partialOrder = pairs.filter(([a, b]) => { const k = `${a}<${b}`; if (seen.has(k)) return false; seen.add(k); return true; });
if (partialOrder.length < 8) throw new Error(`beats-from-md: parsed only ${partialOrder.length} order constraints; §D declares more. Refusing to emit a weakened partial order.`);

// ---- the hard fails ---------------------------------------------------------------------
const hfStart = md.indexOf('**Hard fails — any one caps the item at 2');
const hfBody = hfStart < 0 ? '' : md.slice(hfStart, md.indexOf('## How we lose', hfStart));
const hardFails = [];
for (const m of hfBody.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*/gm)) hardFails.push({ n: Number(m[1]), what: m[2] });
if (hardFails.length !== 7) throw new Error(`beats-from-md: parsed ${hardFails.length} hard fails, expected 7.`);

const out = {
  schema: 'elder-souls/exp01-beats@1',
  generated_by: 'tools/experience/beats-from-md.mjs',
  hand_authored: false,
  source: path.relative(REPO_ROOT, IN),
  source_sha: null,
  item: 'RI-EXP01',
  note: 'Generated from RI-EXP01 §D. Do not hand-edit: edit the item and re-run, or the instrument and the bar drift, which is the failure this file was specified to prevent.',
  beats,
  derived_targets: targets,
  partial_order: partialOrder,
  prose_constraints: prose,
  hard_fails: hardFails,
};
out.source_sha = (await import('node:crypto')).createHash('sha256').update(md).digest('hex').slice(0, 16);

const text = JSON.stringify(out, null, 2) + '\n';
if (args.check) {
  if (!fs.existsSync(OUT)) { console.error(`beats-from-md --check: ${OUT} does not exist.`); process.exit(1); }
  const have = fs.readFileSync(OUT, 'utf8');
  if (have !== text) {
    console.error(`beats-from-md --check: ${path.relative(REPO_ROOT, OUT)} is stale against ${path.relative(REPO_ROOT, IN)}. Re-run without --check.`);
    process.exit(1);
  }
  log(`beats-from-md --check: current (${beats.length} beats, ${partialOrder.length} order constraints)`);
  process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);
log(`beats-from-md: wrote ${path.relative(REPO_ROOT, OUT)} — ${beats.length} beats, ${Object.keys(targets).length} derived targets, ${partialOrder.length} order constraints, ${prose.length} prose constraint(s), ${hardFails.length} hard fails`);

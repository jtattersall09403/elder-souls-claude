#!/usr/bin/env node
// check-building-overlap.mjs — NO SETTLEMENT MAY GROW A NEW BUILDING-INSIDE-A-BUILDING.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS IS A RATCHET AND NOT AN ASSERTION
// ---------------------------------------------------------------------------------------------
//
// `tools/world/building-overlap-census.mjs` counted the class for the first time: **83 pairs of
// buildings interpenetrate by more than a wall, an eave and a porch, across 8 of 8 settlements.**
// RULES.md rule 13 is explicit — *never land a fail-closed assertion before the data it demands
// exists* — and a check that demands zero overlaps today would throw on every agent's boot-check
// and be disabled within the hour, which is how this project ends up with gates that have never
// fired for the right reason.
//
// So this is a RATCHET against a frozen baseline. It fails when the world gets WORSE:
//
//   * a settlement's counted overlaps go UP, or
//   * a pair overlaps that was not overlapping when the baseline was frozen, or
//   * a building's door ends up inside another building and did not before.
//
// It reports, without failing, when the world gets BETTER, and tells you to re-freeze. A count
// that only ever goes down is the whole point: the 82 remaining overlaps are a scheduled piece
// (see `orchestration/status/W1-BUILDING-OVERLAP-CENSUS.json`), and this stops the class growing
// underneath it in the meantime.
//
// ---------------------------------------------------------------------------------------------
// IT GOES RED, AND YOU CAN WATCH IT
// ---------------------------------------------------------------------------------------------
//
// `--self-break` builds a control clone, puts Thorn's barge hold back where it was — the exact
// 7.02 x 4.00 m overlap this piece removed — and REQUIRES this check to fail there. If it passes
// on the sabotaged tree, this tool exits non-zero to say it is not measuring anything. A gate that
// has never fired is not evidence; this project has shipped one of those before.
//
//   node tools/check-building-overlap.mjs [--verbose]
//   node tools/check-building-overlap.mjs --self-break     # prove it fires
//   node tools/check-building-overlap.mjs --freeze          # rewrite the baseline (deliberate)
//
// Exit codes: 0 held, 1 the world got worse, 2 the tool could not measure.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = 'corpus/50-world/data/building-overlap-baseline.json';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const say = (s) => process.stdout.write(s + '\n');

/** The census, reduced to the three things the ratchet compares. Pair keys are order-independent. */
async function measure(root) {
  // The census module resolves its own ROOT from its own path, so measuring another tree means
  // running that tree's copy of it as a process rather than importing this one.
  const out = path.join(process.env.TMPDIR || '/tmp', `check-building-overlap-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  execFileSync('node', [path.join(root, 'tools/world/building-overlap-census.mjs'), '--quiet', '--json', out], { stdio: 'pipe' });
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  fs.rmSync(out, { force: true });
  const per = {}, pairs = [], doors = [];
  for (const s of j.settlements) {
    per[s.id] = s.counts.overlap;
    for (const p of s.pairs) {
      if (p.structural || p.class !== 'overlap') continue;
      pairs.push(`${s.id}:${[p.a, p.b].sort().join('|')}`);
      for (const d of p.door_inside_other) doors.push(`${s.id}:${d}`);
    }
  }
  return { per_settlement: per, pairs: pairs.sort(), doors_inside_another_building: [...new Set(doors)].sort(), total: j.total.overlap };
}

/** Compare a measurement against a frozen baseline. Returns the list of regressions. */
export function ratchet(base, now) {
  const bad = [];
  for (const [id, n] of Object.entries(now.per_settlement)) {
    const was = base.per_settlement[id];
    if (was === undefined) { bad.push(`${id}: a settlement the baseline does not know, with ${n} overlap(s) — freeze it deliberately or fix it`); continue; }
    if (n > was) bad.push(`${id}: counted overlaps went UP, ${was} -> ${n}`);
  }
  const wasPair = new Set(base.pairs);
  for (const p of now.pairs) if (!wasPair.has(p)) bad.push(`new overlapping pair: ${p}`);
  const wasDoor = new Set(base.doors_inside_another_building);
  for (const d of now.doors_inside_another_building) if (!wasDoor.has(d)) bad.push(`a door is now inside another building: ${d}`);
  return bad;
}

// ---- --self-break: sabotage a copy and require this check to go red ----------------------------
if (has('--self-break')) {
  const REVERT = [
    ['game/data/world/settlements/thorn.json', '    -20,\n    0,\n    57\n   ],\n   "yaw_deg": 90,', '    -20,\n    0,\n    49\n   ],\n   "yaw_deg": 90,'],
    ['game/data/world/settlements/thorn.json', '   "door": [\n    3800,\n    0,\n    912.5\n   ],', '   "door": [\n    3800,\n    0,\n    904.5\n   ],'],
  ];
  const clone = execFileSync('node', [
    path.join(ROOT, 'tools/control-clone.mjs'), 'make', '--label', 'check-building-overlap-selfbreak',
    '--paths', 'game,tools', '--writable', 'game/data/world/settlements/thorn.json',
  ], { encoding: 'utf8' }).trim().split('\n').pop().trim();

  let applied = 0;
  for (const [rel, from, to] of REVERT) {
    const p = path.join(clone, rel);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) continue;
    fs.writeFileSync(p, src.replace(from, to));
    applied++;
  }
  if (applied !== REVERT.length) {
    say(`self-break: could not reintroduce the Thorn overlap (${applied}/${REVERT.length} edits applied).`);
    say('self-break: refusing to report a green check against a tree it failed to sabotage.');
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE), 'utf8'));
  const sabotaged = await measure(clone);
  const clean = await measure(ROOT);
  const badS = ratchet(base, sabotaged);
  const badC = ratchet(base, clean);
  say('self-break — the Thorn barge hold put back on top of the writ house, on a copy:');
  say(`  sabotaged tree: ${badS.length} regression(s)`);
  for (const b of badS) say(`      ${b}`);
  say(`  shipped tree:   ${badC.length} regression(s)`);
  for (const b of badC) say(`      ${b}`);
  try { execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'cleanup', '--dir', clone], { stdio: 'pipe' }); } catch { /* sweep will get it */ }
  if (badS.length === 0) { say('\nself-break FAILED: the check is silent on a tree with the defect reintroduced. It is not measuring anything.'); process.exit(2); }
  if (badC.length !== 0) { say('\nself-break FAILED: the check is red on the SHIPPED tree, so the two arms do not distinguish anything.'); process.exit(2); }
  say('\nself-break: the arms disagree — red on the sabotaged copy, green on the shipped tree.');
  process.exit(0);
}

// ---- the ordinary run --------------------------------------------------------------------------
const now = await measure(ROOT);

if (has('--freeze')) {
  const doc = {
    what: 'The frozen count of oriented building-footprint overlaps, per settlement, that `tools/check-building-overlap.mjs` ratchets against.',
    why: 'RULES.md rule 13 — 83 overlaps exist on the tree this was frozen on, so a fail-closed "zero overlaps" assertion would throw for every agent. This freezes the debt and fails only when it GROWS. The debt itself is a scheduled piece; see orchestration/status/W1-BUILDING-OVERLAP-CENSUS.json.',
    definition: 'See tools/world/building-overlap-census.mjs. Separation depth by SAT on the ORIENTED drawn footprints; <=0.36 m is a shared wall, <=1.50 m is a porch/eave, above that is counted. Structures are excluded from the headline.',
    frozen_utc: new Date().toISOString(),
    frozen_at_commit: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })(),
    total: now.total,
    per_settlement: now.per_settlement,
    pairs: now.pairs,
    doors_inside_another_building: now.doors_inside_another_building,
  };
  fs.mkdirSync(path.dirname(path.join(ROOT, BASELINE)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, BASELINE), JSON.stringify(doc, null, 2) + '\n');
  say(`check-building-overlap: baseline frozen at ${now.total} overlap(s) across ${Object.keys(now.per_settlement).length} settlements -> ${BASELINE}`);
  process.exit(0);
}

if (!fs.existsSync(path.join(ROOT, BASELINE))) {
  say(`check-building-overlap: no baseline at ${BASELINE}. Run --freeze deliberately, having read why.`);
  process.exit(2);
}
const base = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE), 'utf8'));
const bad = ratchet(base, now);

const improved = [];
for (const [id, n] of Object.entries(now.per_settlement)) {
  const was = base.per_settlement[id];
  if (was !== undefined && n < was) improved.push(`${id}: ${was} -> ${n}`);
}

if (has('--verbose')) {
  say('check-building-overlap: per settlement (baseline -> now)');
  for (const id of Object.keys(now.per_settlement).sort()) say(`  ${id.padEnd(12)} ${String(base.per_settlement[id] ?? '?').padStart(3)} -> ${String(now.per_settlement[id]).padStart(3)}`);
}
if (improved.length) say(`check-building-overlap: ${improved.length} settlement(s) improved — ${improved.join(', ')}. Re-freeze with --freeze so the ratchet holds the new floor.`);

if (bad.length) {
  say(`check-building-overlap: ${bad.length} regression(s) — a building moved into another building since the baseline was frozen:`);
  for (const b of bad) say(`  ${b}`);
  say('check-building-overlap: fix the geometry, or --freeze deliberately and say in your status file why the world got worse.');
  process.exit(1);
}
say(`check-building-overlap: held — ${now.total} counted overlap(s) against a frozen ${base.total}, no settlement worse, no new door inside another building.`);

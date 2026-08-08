#!/usr/bin/env node
// S22 for game/data/combat/ai.json — a CHECK, not a constructor (RULES 14).
//
// Round 1 shipped this file with THIRTEEN frame-valued leaves and no `unit` field anywhere, so
// `aggro_entry_frames: [20, 30]` was either a 0.33 s roar or a 0.67 s one and the corpus could
// not say which. The fix is not a comment; it is a machine-readable `units` block plus something
// that fails when a leaf is added without one, because the next builder to add a frame count
// will not have read the comment.
//
// It checks four things and exits non-zero on any of them:
//   1. every dimensioned leaf in the behaviour tables has an entry in §units
//   2. every §units entry names a unit from the allowed set
//   3. every §units entry corresponds to a leaf that exists (no stale rows)
//   4. §behaviour_archetype names real statblocks and real archetype rows (rule 10's order)
//
// HOW TO SEE IT FAIL: `node tools/combat/check-ai-units.mjs --self-test` removes one unit entry,
// adds one undeclared frame leaf and points one behaviour_archetype row at a nonexistent
// archetype, all in memory, and asserts that the checker reports exactly those three. A check
// that has never been watched going red is not evidence (RULES 4/6).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const AI = path.join(ROOT, 'game/data/combat/ai.json');
const ENEMIES = path.join(ROOT, 'game/data/combat/enemies');

const TABLES = ['bands', 'perception', 'movement', 'circle', 'commit', 'block', 'disengage', 'leash', 'punish_read', 'archetype'];

const ALLOWED = new Set([
  'f@60', 's', 'm', 'm_per_s', 'deg_per_s',
  'multiple_of_omega', 'multiple_of_sight_radius', 'multiple_of_player_reach',
  'fraction', 'count', 'boolean', 'enum',
]);

/** Leaves that carry a dimension. A string that is not an enum-valued leaf is prose and skipped. */
function leaves(obj, prefix = '', out = []) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;                     // the file's own commentary
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out);
    else if (Array.isArray(v) && v.every((e) => typeof e === 'number')) out.push({ path: p, value: v });
    else if (Array.isArray(v) && v.every((e) => e && typeof e === 'object')) {
      // an array of rows: the unit is declared once, against `path[].field`
      v.forEach((e) => leaves(e, `${p}[]`, out));
    } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      out.push({ path: p, value: v });
    }
  }
  return out;
}

/** `archetype.INFANTRY.walk_mps` is declared once as `archetype.*.walk_mps`. */
function unitFor(units, p) {
  if (units[p] !== undefined) return units[p];
  const wild = p.replace(/^archetype\.[A-Z_]+\./, 'archetype.*.');
  return units[wild];
}

function check(ai, statIds) {
  const problems = [];
  const units = ai.units || {};
  const scope = {};
  for (const t of TABLES) if (ai[t]) scope[t] = ai[t];
  const ls = leaves(scope);
  const seen = new Set();

  for (const l of ls) {
    const u = unitFor(units, l.path);
    if (u === undefined) {
      problems.push({ kind: 'missing_unit', path: l.path, value: l.value });
      continue;
    }
    seen.add(units[l.path] !== undefined ? l.path : l.path.replace(/^archetype\.[A-Z_]+\./, 'archetype.*.'));
    if (!ALLOWED.has(u)) problems.push({ kind: 'unknown_unit', path: l.path, unit: u, allowed: [...ALLOWED] });
  }
  for (const k of Object.keys(units)) {
    if (k.startsWith('_')) continue;
    if (!seen.has(k)) problems.push({ kind: 'stale_unit_row', path: k, unit: units[k] });
  }

  // Rule 10's order: behaviour_archetype overrides the statblock, so both ends must exist.
  for (const [id, arch] of Object.entries(ai.behaviour_archetype || {})) {
    if (id.startsWith('_')) continue;
    if (!statIds.has(id)) problems.push({ kind: 'behaviour_archetype_unknown_statblock', id });
    else if (!ai.archetype[arch]) problems.push({ kind: 'behaviour_archetype_unknown_row', id, archetype: arch });
  }
  return problems;
}

function report(problems, label) {
  if (!problems.length) { console.log(`${label}: OK`); return 0; }
  console.error(`${label}: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p.kind.padEnd(38)} ${JSON.stringify(p)}`);
  return 1;
}

function main() {
  const ai = JSON.parse(fs.readFileSync(AI, 'utf8'));
  const statIds = new Set(fs.readdirSync(ENEMIES).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

  if (process.argv.includes('--self-test')) {
    const broken = JSON.parse(JSON.stringify(ai));
    delete broken.units['commit.token_hold_cap_f'];               // 1: a leaf loses its unit
    broken.commit.brand_new_window_f = 44;                        // 2: a leaf arrives without one
    broken.behaviour_archetype.inf_trash = 'NOT_AN_ARCHETYPE';    // 3: rule 10's order broken
    // Compared against the LIVE tree's own result, not against zero: a self-test that assumes
    // the shipped file is already clean reports the shipped file's defects as its own successes.
    const baseKinds = check(ai, statIds).map((p) => p.kind).sort();
    const probs = check(broken, statIds);
    const kinds = probs.map((p) => p.kind).sort();
    const added = [...kinds];
    for (const k of baseKinds) { const i = added.indexOf(k); if (i >= 0) added.splice(i, 1); }
    const want = ['behaviour_archetype_unknown_row', 'missing_unit', 'missing_unit'];
    const ok = JSON.stringify(added.sort()) === JSON.stringify(want);
    console.log(`self-test: baseline ${baseKinds.length} problem(s); injected 3 defects; checker now reports ${probs.length}, i.e. ${added.length} new: ${added.join(', ')}`);
    if (!ok) { console.error('SELF-TEST FAILED: the checker did not report the injected defects. It cannot fail, so it is not evidence.'); process.exit(1); }
    console.log('self-test: OK — the checker goes red on all three injected defects.');
    return;
  }

  process.exit(report(check(ai, statIds), 'game/data/combat/ai.json §units'));
}

main();

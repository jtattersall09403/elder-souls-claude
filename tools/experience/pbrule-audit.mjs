#!/usr/bin/env node
// pbrule-audit.mjs — RI-EXP06 Step 3. The governing rule, audited.
//
//   node tools/experience/pbrule-audit.mjs --corpus corpus/ --out reports/experience/w1/pbrule-audit.json
//
// PB-RULE (RI-EXP06 §C, binding project-wide): "No reference item anywhere in this corpus may
// introduce a new anti-exploit hard fail, clamp, cap, cooldown, exception list, or 'cannot X
// while Y' rule without naming, in the same item, at least one RI-EXP06 register entry that the
// new rule PRESERVES, and stating how it preserves it." Clause 1: "the naming is a section, not
// a sentence" — a line of the form `preserves: B-09 — the clamp is on arbitrage ratios, not on
// the disposition-price curve`.
//
// "The audit's false-positive rate is expected to be high and that is acceptable — a flagged
// rule that legitimately has nothing to preserve clears itself with a one-line `preserves: none
// — this rule constrains X, which no register entry uses`, and that line is itself the useful
// artifact."
//
// So this tool is deliberately noisy and deliberately cheap to satisfy. What it must NOT be is
// silent: an audit that flags nothing on a corpus of 153 items that has never heard of PB-RULE
// is an audit that is not running.
//
// SCOPE. `--since <ref>` restricts it to items changed in a git range, which is how the rule is
// meant to be applied per wave ("scans every RI-*.md changed or added in the wave"). With no
// `--since` it audits the whole corpus and reports the backlog, which is the honest number on
// the first run because PB-RULE has never been enforced.
//
// SELF-TEST (RULES #4)
//   node tools/experience/pbrule-audit.mjs --self-test
// Three mutations of a COPY of an item: add a clamp with no `preserves:` (must flag); add the
// same clamp WITH a `preserves: B-09 — ...` line (must clear); add a `preserves:` naming an
// entry that is not in the register (must flag as naming a non-existent entry).
//
// EXIT: 0 no violation in scope · 2 violations · 5 self-test failed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// The trigger vocabulary, verbatim from RI-EXP06 Step 3.
const TRIGGERS = [
  { id: 'automatic fail', re: /automatic fail/i },
  { id: 'hard fail', re: /hard fail/i },
  { id: 'clamp', re: /\bclamp(ed|s|ing)?\b/i },
  { id: 'cap', re: /\bcap(ped|s|ping)?\b/i },
  { id: 'cooldown', re: /\bcool[- ]?down\b/i },
  { id: 'may not', re: /\bmay not\b/i },
  { id: 'cannot … while', re: /\bcannot\b[^.\n]{0,60}\bwhile\b/i },
  { id: 'exception list', re: /exception list/i },
];
// "in a SCORING or THRESHOLD context" — the item's own qualifier, and the only thing keeping this
// from flagging every paragraph of prose in the corpus.
const CONTEXT = /\bbar\b|\bfloor\b|threshold|score|scoring|ladder|fails?\b|forbid|must not|\bshall not\b|\||≥|≤|>=|<=/i;

function itemFiles(corpusDir) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (/^RI-[A-Z0-9]+.*\.md$/.test(e.name)) out.push(p);
    }
  })(corpusDir);
  return out.sort();
}

function changedSince(ref, corpusDir) {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`, '--', path.relative(REPO, corpusDir)], { cwd: REPO }).toString();
    return new Set(out.split('\n').filter(Boolean).map((p) => path.join(REPO, p)));
  } catch { return null; }
}

export function auditText(rel, text, liveEntries) {
  const lines = text.split('\n');
  const preserves = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /(?:^|\s)preserves:\s*(.+)$/i.exec(lines[i]);
    if (m) preserves.push({ line: i + 1, text: m[1].trim() });
  }
  const named = new Set();
  for (const p of preserves) for (const m of p.text.matchAll(/\bB-(\d{2})\b/g)) named.add(`B-${m[1]}`);
  const namesNone = preserves.some((p) => /^none\b/i.test(p.text));
  const unknown = [...named].filter((id) => !liveEntries.has(id));

  const triggers = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!CONTEXT.test(l)) continue;
    for (const t of TRIGGERS) if (t.re.test(l)) { triggers.push({ line: i + 1, trigger: t.id, text: l.trim().slice(0, 180) }); break; }
  }
  const covered = preserves.length > 0 || namesNone;
  return {
    item: rel,
    triggers: triggers.length,
    trigger_lines: triggers.slice(0, 12),
    preserves_lines: preserves,
    preserves_names: [...named],
    preserves_none: namesNone,
    names_an_entry_that_is_not_in_the_register: unknown,
    violation: triggers.length > 0 && !covered,
    bad_reference: unknown.length > 0,
  };
}

async function selfTest(liveEntries) {
  say('SELF-TEST — three mutations of a COPY of one item.');
  const src = path.join(REPO, 'corpus/95-experience/RI-EXP04-novelty-curve.md');
  const base = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '# a\n\nnothing here.\n';
  const strip = (t) => t.replace(/^.*preserves:.*$/gim, '').replace(/\bclamp\w*|\bcap\w*|\bcooldown\b|\bmay not\b|hard fail|automatic fail|exception list/gi, 'xxx');
  const clean = strip(base);
  const cases = [
    { id: 'a clamp with no preserves line', text: clean + '\n| `novelty_cap` | the curve is clamped at 0.4 | **hard fail** above |\n', want: (r) => r.violation },
    { id: 'the same clamp WITH a preserves line', text: clean + '\n| `novelty_cap` | the curve is clamped at 0.4 | **hard fail** above |\n\npreserves: B-09 — the clamp is on arbitrage ratios, not on the disposition-price curve\n', want: (r) => !r.violation },
    { id: 'a preserves naming an entry that does not exist', text: clean + '\n| `novelty_cap` | clamped | **hard fail** |\n\npreserves: B-42 — invented\n', want: (r) => r.bad_reference },
    { id: 'no anti-exploit language at all', text: clean, want: (r) => !r.violation && r.triggers === 0 },
  ];
  let ok = true;
  for (const c of cases) {
    const r = auditText('self-test.md', c.text, liveEntries);
    const good = c.want(r);
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${c.id.padEnd(46)} triggers=${r.triggers} violation=${r.violation} bad_ref=${r.bad_reference}`);
    if (!good) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  const probesPath = path.join(REPO, 'corpus/95-experience/RI-EXP06.probes.json');
  const live = new Set(fs.existsSync(probesPath)
    ? JSON.parse(fs.readFileSync(probesPath, 'utf8')).entries.filter((e) => e.status === 'live').map((e) => e.id)
    : []);
  if (!live.size) say('WARNING: RI-EXP06.probes.json is absent or has no live entries; a `preserves:` line cannot be validated.');
  if (has('self-test')) process.exit((await selfTest(live)) ? 0 : 5);

  const corpusDir = path.resolve(REPO, arg('corpus', 'corpus'));
  const since = arg('since', null);
  const scope = since ? changedSince(since, corpusDir) : null;
  const files = itemFiles(corpusDir).filter((f) => !scope || scope.has(f));
  const rows = files.map((f) => auditText(path.relative(REPO, f), fs.readFileSync(f, 'utf8'), live));
  const violations = rows.filter((r) => r.violation);
  const badRefs = rows.filter((r) => r.bad_reference);

  const out = {
    schema: 'elder-souls/exp06-pbrule@1', at: new Date().toISOString(),
    scope: since ? `changed since ${since}` : 'the whole corpus (PB-RULE has never been enforced, so this is the backlog)',
    items_audited: rows.length,
    live_register_entries: [...live],
    items_with_anti_exploit_language: rows.filter((r) => r.triggers > 0).length,
    items_carrying_a_preserves_line: rows.filter((r) => r.preserves_lines.length > 0).length,
    violations: violations.map((r) => ({ item: r.item, triggers: r.triggers, first: (r.trigger_lines || []).slice(0, 3) })),
    bad_references: badRefs.map((r) => ({ item: r.item, names: r.names_an_entry_that_is_not_in_the_register })),
    rows,
  };
  const o = path.resolve(REPO, arg('out', 'reports/experience/w1/pbrule-audit.json'));
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify(out, null, 2) + '\n');

  say(`pbrule-audit — ${rows.length} reference items, scope: ${out.scope}`);
  say(`  ${out.items_with_anti_exploit_language} carry anti-exploit language in a scoring or threshold context`);
  say(`  ${out.items_carrying_a_preserves_line} carry a \`preserves:\` line`);
  say(`  ${violations.length} PB-RULE violation(s)`);
  for (const v of violations.slice(0, 20)) { const f = (v.first || [])[0]; say(`    ${v.item}  (${v.triggers} trigger line(s))  e.g. L${f ? f.line : '?'} ${f ? f.trigger : ''}`); }
  if (violations.length > 20) say(`    ... and ${violations.length - 20} more, in the report`);
  for (const b of badRefs) say(`    BAD REF ${b.item} names ${b.names.join(', ')}`);
  say(`wrote ${path.relative(REPO, o)}`);
  process.exit(violations.length ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('pbrule-audit.mjs')) main();

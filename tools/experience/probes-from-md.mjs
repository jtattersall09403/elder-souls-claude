#!/usr/bin/env node
// probes-from-md.mjs — RI-EXP06 Step 0: "the register is data".
//
// "`corpus/95-experience/RI-EXP06.probes.json` is generated from §B by
// `tools/experience/probes-from-md.mjs` so the register and the probe suite cannot drift. Each
// record: `{id, title, systemic, permanent, admission:[P1..P5], probe:{scenario, setup,
// assertions[]}, status:"live"|"struck", struck_wave}`."
//
// Neither the tool nor the file existed. RULES.md #24.
//
// The fifteen entries in §B are prose, not a table, so this parses the block structure the item
// actually uses — `**B-nn — Title.** \`Sys ✔\``, then `*What it is.*`, `*Why it survives.*`,
// `*What it costs the player.*`, `*Probe \`PB-nn\`...*` — and splits each probe paragraph into
// its individual assertions on the item's own `assert` and `;` boundaries. It also reads the
// **Red if / Red the moment** clause out of each entry, because that clause is the entry's real
// content: it names the mechanism whose ARRIVAL closes the breakage, and it is what
// `breakage-probe.mjs` searches the tree for.
//
// It CHECKS the register's own totals (15 entries · 8 systemic · 2 permanent, against
// BAR-CRITIQUE-01 §3 rank 3's ≥12 / ≥4 / ≥2) and the §C floor of twelve live entries.
//
// SELF-TEST (RULES #4)
//   node tools/experience/probes-from-md.mjs --self-test
// Four mutations of a COPY of the item: strike four entries so the register falls below §C's
// floor of twelve; remove a `Sys ✔`; delete an entry's Probe paragraph; delete an entry outright.
// Each must be reported. Never writes to the corpus.
//
// EXIT: 0 · 2 the register's declared totals disagree with the parse · 3 unparseable ·
//       4 fewer than twelve live entries (§C clause 3) · 5 self-test failed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const ITEM = path.join(REPO, 'corpus/95-experience/RI-EXP06-permissiveness-budget.md');
export const OUT = path.join(REPO, 'corpus/95-experience/RI-EXP06.probes.json');

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const say = (s) => process.stdout.write(s + '\n');
const clean = (s) => String(s || '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*([^*]*)\*/g, '$1').replace(/\s+/g, ' ').trim();

export function parseRegister(text) {
  const errs = [];
  // Split on the entry headers. A header is a line beginning `**B-nn — `.
  const blocks = [];
  const re = /^\*\*B-(\d{2}) — (.+?)\*\*(.*)$/gm;
  let m, last = null;
  while ((m = re.exec(text))) {
    if (last) last.body = text.slice(last.at, m.index);
    last = { id: `B-${m[1]}`, title: clean(m[2]).replace(/\.$/, ''), flags: m[3] || '', at: re.lastIndex };
    blocks.push(last);
  }
  if (last) {
    const end = text.indexOf('### C. The governing rule', last.at);
    last.body = text.slice(last.at, end > 0 ? end : undefined);
  }
  if (!blocks.length) throw new Error('§B: no `**B-nn — ...**` entry headers found');

  const field = (body, label) => {
    const r = new RegExp(`\\*${label}\\.?\\*([\\s\\S]*?)(?=\\n\\*[A-Z]|\\n---|$)`, 'i');
    const mm = r.exec(body);
    return mm ? clean(mm[1]) : null;
  };

  const entries = blocks.map((b) => {
    const body = b.body || '';
    const probeRaw = /\*Probe `PB-(\d{2})`([\s\S]*?)(?=\n\*[A-Z]|\n---|$)/.exec(body);
    const probeText = probeRaw ? clean(probeRaw[2]) : null;
    if (!probeRaw) errs.push(`${b.id}: no *Probe \`PB-nn\`* paragraph`);
    // The "Red if / Red the moment" clause: the mechanism whose ARRIVAL closes the breakage.
    const redM = /Red (?:if|the (?:moment|day))([^*]*)/i.exec(probeText || '');
    const assertions = (probeText || '')
      .split(/(?:^|[.;]\s*)(?=assert\b)/i)
      .map((s) => clean(s))
      .filter((s) => /^assert/i.test(s))
      .map((s) => s.replace(/\s*Red (if|the moment|the day)[\s\S]*$/i, '').replace(/\.$/, ''));
    if (probeRaw && !assertions.length) errs.push(`${b.id}: the probe paragraph carries no "assert" clause`);
    const struck = /\*\*STRUCK\b/i.test(body) || /status:\s*struck/i.test(body);
    return {
      id: b.id,
      probe_id: probeRaw ? `PB-${probeRaw[1]}` : null,
      title: b.title,
      systemic: /Sys\s*✔/.test(b.flags),
      permanent: /Perm\s*✔/.test(b.flags),
      conditional: /conditional/i.test(b.flags),
      what_it_is: field(body, 'What it is'),
      why_it_survives: field(body, 'Why it survives'),
      price: field(body, 'What it costs the player'),
      bound: field(body, 'Bound \\(not a nerf[^)]*\\)'),
      admission: ['P1', 'P2', 'P3', 'P4', 'P5'],
      probe: { scenario: null, setup: probeText, assertions },
      closes_if: redM ? clean(redM[1]) : null,
      status: struck ? 'struck' : 'live',
      struck_wave: null,
    };
  });

  // §B's own totals line, read out of the prose.
  const tot = /\*\*Register totals\.\*\* (\d+) entries · \*\*(\d+) systemic\*\*[^·]*· *\n?\*\*(\d+) permanent/.exec(text)
    || /\*\*Register totals\.\*\* (\d+) entries · \*\*(\d+) systemic\*\*[\s\S]{0,200}?\*\*(\d+) permanent/.exec(text);
  const declared = tot ? { entries: Number(tot[1]), systemic: Number(tot[2]), permanent: Number(tot[3]) } : null;
  const recount = {
    entries: entries.length,
    systemic: entries.filter((e) => e.systemic).length,
    permanent: entries.filter((e) => e.permanent).length,
    live: entries.filter((e) => e.status === 'live').length,
    conditional: entries.filter((e) => e.conditional).length,
    with_assertions: entries.filter((e) => e.probe.assertions.length).length,
    total_assertions: entries.reduce((s, e) => s + e.probe.assertions.length, 0),
    with_close_clause: entries.filter((e) => e.closes_if).length,
  };
  const mismatches = [];
  if (!declared) mismatches.push('the "Register totals" line is not in a form this tool can read');
  else for (const k of ['entries', 'systemic', 'permanent']) {
    if (declared[k] !== recount[k]) mismatches.push(`${k}: the item declares ${declared[k]}, the register yields ${recount[k]}`);
  }

  // §C clause 3, binding: the register may never fall below twelve live entries.
  const floor12 = recount.live >= 12;
  if (!floor12) errs.push(`§C clause 3: ${recount.live} live entries, and the register may never fall below twelve`);

  return { entries, declared, recount, mismatches, errs, floor12 };
}

function generate({ write = true, itemPath = ITEM, outPath = OUT } = {}) {
  const text = fs.readFileSync(itemPath, 'utf8');
  const p = parseRegister(text);
  const artifact = {
    schema: 'elder-souls/exp06-probes@1',
    generated_by: 'tools/experience/probes-from-md.mjs',
    generated_from: path.relative(REPO, itemPath),
    source_sha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16),
    at: new Date().toISOString(),
    note: 'GENERATED. Do not edit; edit RI-EXP06 §B and re-run. `closes_if` is the entry\'s "Red if" ' +
      'clause — the mechanism whose ARRIVAL closes the breakage, and what breakage-probe.mjs looks for.',
    pb_rule: 'No reference item may introduce a new anti-exploit hard fail, clamp, cap, cooldown, ' +
      'exception list, or "cannot X while Y" rule without naming, in the same item, at least one ' +
      'RI-EXP06 register entry that the new rule preserves (§C, PB-RULE).',
    declared_in_item: p.declared,
    recount: p.recount,
    declared_vs_recount: p.mismatches,
    parse_errors: p.errs,
    live_entry_floor_met: p.floor12,
    strike_log: [],
    entries: p.entries,
  };
  if (write) { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n'); }
  return artifact;
}

const MUTATIONS = [
  { id: 'strike-four-entries-below-the-floor', wants: '§C clause 3 to fire',
    apply: (t) => t.replace(/^\*\*B-(0[1-4]) — /gm, '**STRUCK B-$1 — '),
    must: (a) => a.live_entry_floor_met === false },
  { id: 'remove-a-systemic-marker', wants: 'the systemic recount to disagree with the declared total',
    apply: (t) => t.replace('**B-09 — The disposition snowball.** `Sys ✔`', '**B-09 — The disposition snowball.**'),
    must: (a) => a.declared_vs_recount.some((m) => m.startsWith('systemic:')) },
  { id: 'delete-a-probe-paragraph', wants: 'the entry to be reported as carrying no probe',
    apply: (t) => t.replace(/\*Probe `PB-12`[\s\S]*?(?=\n\*\*Red|\n---)/, ''),
    must: (a) => a.parse_errors.some((e) => /B-12/.test(e)) },
  { id: 'delete-an-entry', wants: 'the entry recount to disagree with the declared total',
    apply: (t) => t.replace(/\n\*\*B-13 — [\s\S]*?(?=\n---)/, '\n'),
    must: (a) => a.declared_vs_recount.some((m) => m.startsWith('entries:')) },
];

async function selfTest() {
  say('SELF-TEST — the generator must go red on four mutations of a COPY of the item.');
  const text = fs.readFileSync(ITEM, 'utf8');
  const base = generate({ write: false });
  let ok = base.declared_vs_recount.length === 0 && base.parse_errors.length === 0 && base.live_entry_floor_met;
  say(`  ${ok ? 'ok  ' : 'FAIL'}  the shipped item parses clean` + (ok ? '' : `  <-- ${JSON.stringify(base.declared_vs_recount.concat(base.parse_errors))}`));
  const tmp = path.join(REPO, 'tmp', 'exp06-selftest');
  fs.mkdirSync(tmp, { recursive: true });
  for (const m of MUTATIONS) {
    const mutated = m.apply(text);
    if (mutated === text) { say(`  FAIL  ${m.id}: the mutation matched nothing — this self-test is stale`); ok = false; continue; }
    const p = path.join(tmp, m.id + '.md'); fs.writeFileSync(p, mutated);
    let red = false, note = '';
    try { red = m.must(generate({ write: false, itemPath: p })); } catch (e) { red = true; note = ' (threw)'; }
    say(`  ${red ? 'ok  ' : 'FAIL'}  ${m.id.padEnd(36)} wants ${m.wants}${note}`);
    if (!red) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  if (has('self-test')) process.exit((await selfTest()) ? 0 : 5);
  let a;
  try { a = generate({}); } catch (e) { say('probes-from-md: ' + ((e && e.message) || e)); process.exit(3); }
  say(`RI-EXP06.probes.json  <- ${path.relative(REPO, ITEM)}`);
  say(`  ${a.recount.entries} entries · ${a.recount.live} live · ${a.recount.systemic} systemic · ${a.recount.permanent} permanent · ${a.recount.conditional} conditional`);
  say(`  ${a.recount.total_assertions} assertions across ${a.recount.with_assertions} entries · ${a.recount.with_close_clause} carry a "Red if" close clause`);
  for (const e of a.parse_errors) say(`  PARSE  ${e}`);
  for (const m of a.declared_vs_recount) say(`  TOTALS ${m}`);
  say(`wrote ${path.relative(REPO, OUT)}`);
  if (!a.live_entry_floor_met) process.exit(4);
  process.exit(a.declared_vs_recount.length || a.parse_errors.length ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('probes-from-md.mjs')) main();
export { generate };

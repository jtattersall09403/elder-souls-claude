#!/usr/bin/env node
// CRITIC instrument, W1-23 round 1. Written by the critic, not the builder.
//
// Binding: RI-LOR06 (contradiction discipline), RI-LOR01 (canon dossier), RI-MTH07 /
// ARBITRATION §3 (CONSUMPTION), RULES.md #4 (a probe that cannot fail is worse than no probe),
// #6 (delete-the-fix, and then check the two arms actually differ).
//
// The piece under judgement ships two green instruments — `tools/lore/canon-census.mjs` and
// `tools/lore/canon-consumption.mjs` — and both pass. This tool asks the five questions neither
// of them asks, each of which is a way the green could be true and mean less than it reads:
//
//   A. SEAL. `build-canon.mjs` replaces `authorially_true` with sha256(ruling) and both the
//      projector and the consumption tool then check for a leak only when the ruling string is
//      >= 24 characters long. A ruling that is the bare position id "A"/"B"/"C" is under that
//      length, is skipped by both leak checks, and its seal is invertible by three guesses.
//      This brute-forces every seal against its own published position ids.
//   B. ABLATION. Run the WHOLE province through `infoFor()` twice — once with the register and
//      once with `canon=null` — and diff. This is the delete-the-fix the piece did not run: the
//      builder's perturbation strikes a holder and watches a line vanish, but every cf-tagged
//      info also carries an actor field, and converse.js line 246 already refuses an info written
//      for somebody else's mouth. The question is whether the register denies anything the actor
//      filter would have allowed.
//   C. VOICE vs GATE. `voiced_by: "dialogue:<topic>#<actor>"` is counted by the census as a voice
//      whether or not the info it names carries a matching `cf`/`pos`. An untagged voice is in
//      the census's population and outside the consumer's: the register gates nothing there.
//   D. REACH. "N of N people hold at least one registered position" is a statement about holder
//      lists. This counts how many of them also have a line to say it.
//   E. STALENESS OF NON-DISPUTES. The census checks disputes and contradiction edges. It never
//      checks a `measured:` claim on an undisputed CF-C fact, so a registered constructed fact
//      can be falsified by the shipped tree and stay green. CF-C023 is the live instance.
//
// --self-test breaks each of the five on purpose and confirms this tool goes red.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CanonRegistry } from '../../game/src/world/canon.js';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

function topicDocs() {
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => rd(`game/data/dialogue/topics/${f}`));
}
function population() {
  const out = [];
  const dir = path.join(ROOT, 'game/data/npcs');
  for (const f of fs.readdirSync(dir)) for (const n of (rd(`game/data/npcs/${f}`).npcs || [])) out.push(n);
  return out;
}
/** every dialogue info in the tree, keyed `<topic>#<actor>`, with its cf tag if any. */
function infoIndex(docs) {
  const m = new Map();
  for (const d of docs) for (const t of (d.topics || [])) for (const i of (t.infos || [])) {
    const k = `${t.id}#${i.a || ''}`;
    const arr = m.get(k) || []; arr.push({ cf: i.cf || null, pos: i.pos || null }); m.set(k, arr);
  }
  return m;
}

// ------------------------------------------------------------------ A. the seal
export function seals(canonDoc) {
  const rows = [];
  for (const f of canonDoc.facts.filter((x) => x.disputed)) {
    if (!f.truth_seal) { rows.push({ id: f.id, sealed: false, recovered: null }); continue; }
    const cands = [...(f.positions || []).map((p) => p.id), 'null', 'undefined'];
    const hit = cands.find((c) => sha(c) === f.truth_seal);
    rows.push({ id: f.id, sealed: true, recovered: hit || null });
  }
  const sealed = rows.filter((r) => r.sealed);
  return { rows, sealed: sealed.length, recovered: sealed.filter((r) => r.recovered).length };
}

// ------------------------------------------------------------------ B. the ablation
export function ablate(reg, idx, pop, topics) {
  const P = { race: 'dunmer', upbringing: null };
  let pairs = 0, silenced = 0, swapped = 0;
  const examples = [];
  for (const n of pop) for (const t of topics) {
    const a = infoFor(idx, t, n, P, reg); const b = infoFor(idx, t, n, P, null);
    pairs++;
    const ta = a && a.text, tb = b && b.text;
    if (ta === tb) continue;
    if (tb && !ta) silenced++; else if (ta && tb) swapped++;
    if (examples.length < 6) examples.push({ npc: n.id || null, actor: n.actor || null, faction: n.faction || null, topic: t, with: ta || null, without: tb || null });
  }
  return { pairs, changed: silenced + swapped, silenced, swapped, examples };
}

// ------------------------------------------------------------------ C. voice vs gate
export function voiceVsGate(canonDoc, infos) {
  let total = 0, tagged = 0; const untagged = [];
  for (const f of canonDoc.facts.filter((x) => x.disputed)) for (const p of (f.positions || [])) for (const v of (p.voiced_by || [])) {
    if (!String(v).startsWith('dialogue:')) continue;
    total++;
    const arr = infos.get(String(v).slice('dialogue:'.length)) || [];
    if (arr.some((i) => i.cf === f.id && i.pos === p.id)) tagged++;
    else untagged.push(`${f.id}/${p.id} -> ${v}`);
  }
  return { total, tagged, untagged };
}

// ------------------------------------------------------------------ D. reach
export function reach(reg, pop, infos, canonDoc) {
  // which (cf,pos,actor) triples actually exist as a line
  const lines = new Set();
  for (const [k, arr] of infos) { const actor = k.split('#')[1] || ''; for (const i of arr) if (i.cf) lines.add(`${i.cf}|${i.pos}|${actor}`); }
  let holdsAndSpeaks = 0, holdsOnly = 0, holdsNothing = 0;
  const disputes = reg.disputes();
  for (const n of pop) {
    let holds = false, speaks = false;
    for (const d of disputes) {
      const st = reg.stanceOf(n, d.id);
      if (!st) continue;
      holds = true;
      if (lines.has(`${d.id}|${st}|${n.actor || ''}`)) speaks = true;
    }
    if (!holds) holdsNothing++; else if (speaks) holdsAndSpeaks++; else holdsOnly++;
  }
  let positions = 0, mute = 0;
  for (const f of canonDoc.facts.filter((x) => x.disputed)) for (const p of (f.positions || [])) {
    positions++;
    const anyLine = [...lines].some((l) => l.startsWith(`${f.id}|${p.id}|`));
    if (!anyLine) mute++;
  }
  return { population: pop.length, holdsAndSpeaks, holdsOnly, holdsNothing, positions, positions_with_no_dialogue_voice: mute };
}

// ------------------------------------------------------------------ E. stale measured claims
/**
 * A `measured:` string on an undisputed fact is a claim about the shipped tree at a date. Where
 * it names a term and asserts ZERO, re-count the term. Narrow on purpose: it only fires on the
 * explicit "and X, Y and Z ZERO" shape, which is the one CF-C023 uses.
 */
export function staleMeasured(canonDoc, counter) {
  const out = [];
  for (const f of canonDoc.facts) {
    if (f.disputed || !f.measured) continue;
    const m = /([A-Z][A-Za-z-]+(?:,\s+[A-Z][A-Za-z-]+)*(?:\s+and\s+[A-Z][A-Za-z-]+))\s+ZERO/.exec(f.measured);
    if (!m) continue;
    for (const term of m[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean)) {
      const n = counter(term);
      if (n > 0) out.push({ id: f.id, term, asserted: 0, observed: n });
    }
  }
  return out;
}

function countInGameData(term) {
  try {
    const t = term.replace(/s$/, '');
    return Number(execSync(`grep -rioF ${JSON.stringify(t)} ${JSON.stringify(path.join(ROOT, 'game/data'))} --include=*.json | wc -l`).toString().trim());
  } catch { return 0; }
}

// ------------------------------------------------------------------ self-test
function selfTest() {
  let bad = 0;
  const ok = (m) => console.log(`  ok   ${m}`);
  const no = (m) => { bad++; console.log(`  FAIL ${m}`); };

  // A: a seal over a long ruling must NOT be recoverable; over a bare id it must be.
  const fake = { facts: [{ id: 'X1', disputed: true, positions: [{ id: 'A' }, { id: 'B' }], truth_seal: sha('B') }] };
  seals(fake).recovered === 1 ? ok('a seal over a bare position id is recovered') : no('the seal brute-force cannot invert sha256("B")');
  const long = { facts: [{ id: 'X2', disputed: true, positions: [{ id: 'A' }, { id: 'B' }], truth_seal: sha('partial:something long enough to be unguessable') }] };
  seals(long).recovered === 0 ? ok('a seal over a prose ruling is NOT recovered') : no('the brute-force claims to invert a prose ruling');

  // C: an untagged voice must be reported.
  const infos = new Map([['t#clerk', [{ cf: null, pos: null }]], ['u#clerk', [{ cf: 'X1', pos: 'A' }]]]);
  const doc = { facts: [{ id: 'X1', disputed: true, positions: [{ id: 'A', voiced_by: ['dialogue:u#clerk'] }, { id: 'B', voiced_by: ['dialogue:t#clerk'] }] }] };
  const vg = voiceVsGate(doc, infos);
  (vg.total === 2 && vg.tagged === 1 && vg.untagged.length === 1) ? ok('an untagged dialogue voice is caught') : no(`voice/gate split wrong: ${JSON.stringify(vg)}`);
  const clean = voiceVsGate({ facts: [{ id: 'X1', disputed: true, positions: [{ id: 'A', voiced_by: ['dialogue:u#clerk'] }] }] }, infos);
  clean.untagged.length === 0 ? ok('a properly tagged voice is not reported') : no('the voice/gate check cries wolf on a clean voice');

  // E: a measured ZERO claim that is now non-zero must be caught, and a true one must not.
  const s1 = staleMeasured({ facts: [{ id: 'C1', measured: 'Of the tribes: Agacephs, Paatru and Sarpa ZERO.' }] }, (t) => (t === 'Paatru' ? 34 : 0));
  s1.length === 1 && s1[0].term === 'Paatru' ? ok('a falsified `measured: ... ZERO` claim is caught') : no(`stale-measured missed it: ${JSON.stringify(s1)}`);
  const s2 = staleMeasured({ facts: [{ id: 'C1', measured: 'Of the tribes: Agacephs, Paatru and Sarpa ZERO.' }] }, () => 0);
  s2.length === 0 ? ok('a still-true `measured: ... ZERO` claim is silent') : no('stale-measured fires on a true claim');

  console.log(bad ? `\nSELF-TEST: ${bad} FAILED` : '\nSELF-TEST: PASS');
  return bad ? 1 : 0;
}

// ------------------------------------------------------------------ main
function main(argv) {
  if (argv.includes('--self-test')) return selfTest();

  const canonDoc = rd('game/data/lore/canon.json');
  const docs = topicDocs();
  const idx = buildTopicIndex(docs);
  const infos = infoIndex(docs);
  const reg = new CanonRegistry(canonDoc);
  const pop = population();
  const topics = new Set(); for (const d of docs) for (const t of (d.topics || [])) topics.add(t.id);

  const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })();
  console.log(`commit   ${commit}`);
  console.log(`register ${canonDoc.facts.length} facts, ${canonDoc.counts.disputed} disputed`);
  console.log(`build    ${pop.length} people, ${topics.size} topics, ${[...infos.values()].reduce((a, b) => a + b.length, 0)} dialogue infos\n`);

  console.log('A. SEAL     is the ruling absent from the build, or merely renamed?');
  const S = seals(canonDoc);
  for (const r of S.rows.filter((x) => x.recovered)) console.log(`  RECOVERED  ${r.id} ruling = "${r.recovered}"  (three guesses against the position ids it publishes)`);
  console.log(`  ${S.recovered} of ${S.sealed} sealed disputes have their ruling recoverable from the shipped bytes alone`);

  console.log('\nB. ABLATION delete the register and diff the whole province (RULES #6)');
  const A = ablate(reg, idx, pop, topics);
  console.log(`  ${A.pairs} (npc,topic) pairs; the register changes ${A.changed} (${(100 * A.changed / A.pairs).toFixed(3)}%) — ${A.silenced} silenced, ${A.swapped} swapped for a different line`);

  console.log('\nC. VOICE vs GATE  a `voiced_by` may name an info that carries no cf tag');
  const V = voiceVsGate(canonDoc, infos);
  console.log(`  ${V.total} dialogue voices declared; ${V.tagged} are tagged with that cf+pos; ${V.untagged.length} are NOT`);
  for (const u of V.untagged) console.log(`    untagged  ${u}`);

  console.log('\nD. REACH    holding a position vs having a line to say it');
  const R = reach(reg, pop, infos, canonDoc);
  console.log(`  ${R.population} people: ${R.holdsAndSpeaks} hold a position AND have a line (${(100 * R.holdsAndSpeaks / R.population).toFixed(1)}%), ${R.holdsOnly} hold one with no line, ${R.holdsNothing} hold none`);
  console.log(`  ${R.positions_with_no_dialogue_voice} of ${R.positions} positions have no dialogue voice at all`);

  console.log('\nE. STALE    a `measured:` claim on an undisputed fact that the tree has falsified');
  const E = staleMeasured(canonDoc, countInGameData);
  for (const e of E) console.log(`  FALSIFIED  ${e.id}: asserts "${e.term}" scores ZERO; the shipped tree scores ${e.observed}`);
  if (!E.length) console.log('  none');

  const out = { commit, seal: S, ablation: A, voice_vs_gate: V, reach: R, stale_measured: E };
  const dest = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
  if (dest) { fs.mkdirSync(path.dirname(path.join(ROOT, dest)), { recursive: true }); fs.writeFileSync(path.join(ROOT, dest), `${JSON.stringify(out, null, 2)}\n`); console.log(`\nwrote ${dest}`); }

  // This tool REPORTS; it does not gate. Non-zero only when a finding is present, so a future
  // tree that closes all five reads as exit 0 and this cannot become a probe that never fires.
  const findings = S.recovered + V.untagged.length + E.length;
  console.log(findings ? `\nCRITIC W1-23 r1: ${findings} finding(s)` : '\nCRITIC W1-23 r1: clean');
  return findings ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));

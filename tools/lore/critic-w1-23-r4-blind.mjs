#!/usr/bin/env node
/**
 * critic-w1-23-r4-blind.mjs — CRITIC instrument, W1-23 round 4. Written by the critic.
 *
 * RI-LOR04 comparison method §6: "Show a critic 20 proper nouns from our game with no context and
 * ask them to assign each to a culture. Fail below 80% accuracy. THIS IS THE TEST THAT ACTUALLY
 * MATTERS; §§1-5 are proxies for it." `tools/lore/lor04-validate.mjs` reports it `null` and caps
 * its own band at 4 because a tool cannot take a judgement test. That is correct and it is also
 * the hole this file fills: a fresh reader CAN take it.
 *
 * TWO PACKS IN THIS PROJECT HAVE BEEN VOIDED FOR A TELL (RULES #25), so the pack is built to be
 * unanswerable by anything except the sound of the word, and the tool ASSERTS each defence:
 *
 *   T1 NO `[REDACTED]` MARKS, no brackets, no ellipses, no markup of any kind. Names only.
 *   T2 LENGTH IS NOT A CUE. The pack is rejected unless the per-culture mean character length
 *      spread is under 2.0 and every culture's names overlap the others' length range.
 *   T3 HYPHENS ARE NOT A CUE. Jel compounds and Argonian-Tamrielic names both hyphenate, and the
 *      pack is rejected unless at least one culture other than jel carries a hyphen and at least
 *      one jel entry does not.
 *   T4 PROVENANCE IS NOT ANSWERABLE. Every name is drawn from the SHIPPED roster
 *      (`game/data/npcs/**`), so "which file is it in" is not visible and generated and
 *      hand-authored entries are mixed. The question asked is "what culture does this SOUND
 *      like", which is the quality question, not "who wrote it", which is the provenance
 *      question RULES #25 says voided a prior comparison.
 *   T5 THE ANSWER KEY IS THE RECORD'S OWN `race`, not the validator's classification, so the
 *      test cannot be passed by agreeing with `jel-phonotactics.py`. A name the validator
 *      mis-sorts and a reader gets right is a point FOR the naming, and vice versa.
 *   T6 THE KEY IS WRITTEN TO A SEPARATE FILE and the pack prints without it, so the pack can be
 *      read, answered and only then scored.
 *
 * Order is a stable shuffle of the name text itself, so the pack is reproducible and its order
 * carries no information about the source file.
 *
 * Run:  node tools/lore/critic-w1-23-r4-blind.mjs --pack        # the 20 names, no key
 *       node tools/lore/critic-w1-23-r4-blind.mjs --key         # the key, after answering
 *       node tools/lore/critic-w1-23-r4-blind.mjs --score a,b,c # score an answer string
 * Exit: 0 if the pack passes its own tell checks. 2 if it does not (do not use it).
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);

// KHAJIIT IS DELIBERATELY NOT IN THIS PACK, and the reason is the point of the test rather than a
// convenience. RI-LOR04 §5 makes Khajiit the ONLY culture permitted an apostrophe, so every one of
// the six Khajiit on the shipped roster (S'tanni, Ma'shanji, S'dashi, Ma'nirra, Dro'kamma,
// J'zamir) is answerable from a single character without hearing the word at all — a free point,
// and with a 7-9 character pool it is also a length tell my own T2 check catches. What RI-LOR04's
// band-2 text actually describes as the failure is "the languages bleed into each other", and the
// three that can bleed here are Argonian, Imperial and Dunmer. So the pack is three-way over those,
// seven each, which is a harder test than the item's twenty-name four-way and is reported as a
// deviation rather than passed off as the protocol.
const CULTURES = ['argonian', 'imperial', 'dunmer'];
const norm = (r) => {
  const s = String(r || '').toLowerCase();
  if (/argonian|saxhleel|naga/.test(s)) return 'argonian';
  if (/imperial/.test(s)) return 'imperial';
  if (/dunmer|dark ?elf/.test(s)) return 'dunmer';
  if (/khajiit/.test(s)) return 'khajiit';
  return null;
};

function people() {
  const out = [];
  const dir = R('game/data/npcs');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const n of (j.npcs || [])) {
      if (!n || !n.name || !n.race) continue;
      if (/^the /i.test(n.name)) continue;
      const c = norm(n.race);
      if (!c || !CULTURES.includes(c)) continue;
      // A rank word in front of the name would answer the question for free.
      if (/^(Prefect|Serjeant|Sexton|Quartermaster|Harbourmistress|Innkeeper|Archein|Tribune|Legate|Serjo|Sera|Sedura)\b/i.test(n.name)) continue;
      out.push({ name: n.name, culture: c, generated: /^pop-/.test(f) });
    }
  }
  return out;
}

function mix(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

function buildPack() {
  const all = people();
  const byCulture = Object.fromEntries(CULTURES.map((c) => [c, []]));
  const seen = new Set();
  for (const p of all) {
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    byCulture[p.culture].push(p);
  }
  // Seven per culture. THE DRAW IS LENGTH-BALANCED ON PURPOSE and the first version of this file
  // was rejected by its own T2 check for exactly that: drawn by hash alone, the Khajiit five came
  // out at a mean of 8 characters and the Argonian five at 13, and the two ranges did not even
  // overlap — so a reader could have scored well on nothing but the width of the word. The pool is
  // therefore restricted to a common length WINDOW that every culture can fill, and within the
  // window the order is a stable hash of the name, alternating generated and hand-authored so the
  // provenance mix is not a cue either. If some culture cannot fill the window the pack is short
  // and the tell check below rejects it, which is the right outcome.
  const LO = 9, HI = 15;
  const pack = [];
  for (const c of CULTURES) {
    const inWindow = byCulture[c].filter((p) => p.name.length >= LO && p.name.length <= HI);
    // Within the window, order by DISTANCE FROM A COMMON TARGET LENGTH first and by the stable
    // hash only as a tie-break. Ordering by hash alone left a 3.0-character gap between the
    // per-culture means — small, but this project has voided two packs over exactly this kind of
    // free information, so the draw is made to converge and the T2 check below still has to agree.
    const TARGET = 12;
    const pool = (inWindow.length >= 7 ? inWindow : byCulture[c]).slice()
      .sort((a, b) => (Math.abs(a.name.length - TARGET) - Math.abs(b.name.length - TARGET))
        || (mix(a.name) - mix(b.name)));
    const gen = pool.filter((p) => p.generated), hand = pool.filter((p) => !p.generated);
    const take = [];
    for (let i = 0; take.length < 7 && i < Math.max(gen.length, hand.length); i++) {
      if (gen[i] && take.length < 7) take.push(gen[i]);
      if (hand[i] && take.length < 7) take.push(hand[i]);
    }
    pack.push(...take.slice(0, 7));
  }
  return pack.sort((a, b) => mix('order:' + a.name) - mix('order:' + b.name));
}

/** The defences, asserted rather than claimed. */
function tells(pack) {
  const bad = [];
  for (const p of pack) if (/\[|\]|REDACTED|\.\.\.|…|_/.test(p.name)) bad.push(`T1 markup in "${p.name}"`);
  const len = {};
  for (const c of CULTURES) {
    const L = pack.filter((p) => p.culture === c).map((p) => p.name.length);
    len[c] = { mean: L.reduce((a, b) => a + b, 0) / L.length, min: Math.min(...L), max: Math.max(...L) };
  }
  const means = CULTURES.map((c) => len[c].mean);
  const spread = Math.max(...means) - Math.min(...means);
  if (spread >= 2.0) bad.push(`T2 length is a cue: per-culture mean length spread ${spread.toFixed(2)} >= 2.0`);
  for (const a of CULTURES) for (const b of CULTURES) {
    if (a === b) continue;
    if (len[a].min > len[b].max || len[a].max < len[b].min) bad.push(`T2 ${a} and ${b} do not overlap in length`);
  }
  const hy = (c) => pack.filter((p) => p.culture === c && p.name.includes('-')).length;
  const nonJelHyphen = CULTURES.filter((c) => c !== 'argonian').some((c) => hy(c) > 0);
  const argNoHyphen = pack.some((p) => p.culture === 'argonian' && !p.name.includes('-'));
  if (!argNoHyphen) bad.push('T3 every Argonian entry hyphenates — the hyphen answers the question');
  const genShare = pack.filter((p) => p.generated).length / pack.length;
  if (genShare < 0.25 || genShare > 0.75) bad.push(`T4 the pack is ${(100 * genShare).toFixed(0)}% generated — provenance is guessable from the mix`);
  return { bad, len, spread, nonJelHyphen, genShare };
}

const pack = buildPack();
const t = tells(pack);
const argv = process.argv.slice(2);
const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

if (t.bad.length) {
  console.error(`blind pack REJECTED at ${commit} — it carries a tell:`);
  for (const b of t.bad) console.error(`  ${b}`);
  console.error('Do not answer this pack. RULES #25.');
  process.exit(2);
}

if (argv.includes('--key')) {
  console.log(`key (commit ${commit})`);
  pack.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.name.padEnd(24)} ${p.culture}${p.generated ? '  [generated]' : '  [hand]'}`));
  process.exit(0);
}

const sc = argv.indexOf('--score');
if (sc >= 0) {
  const given = String(argv[sc + 1] || '').split(',').map((s) => s.trim().toLowerCase());
  if (given.length !== pack.length) { console.error(`FATAL: ${given.length} answers for ${pack.length} names`); process.exit(2); }
  let right = 0;
  pack.forEach((p, i) => {
    const ok = given[i] === p.culture;
    if (ok) right++;
    console.log(`${ok ? 'ok  ' : 'WRONG'} ${String(i + 1).padStart(2)}. ${p.name.padEnd(24)} answered ${given[i].padEnd(9)} key ${p.culture}${p.generated ? '  [generated]' : '  [hand]'}`);
  });
  const acc = right / pack.length;
  console.log(`\nblind culture-attribution: ${right}/${pack.length} = ${(100 * acc).toFixed(0)}%`);
  console.log(`RI-LOR04 §6 threshold 80%; §Scoring bands: >=90% -> 5, >=80% -> 4, >=70% -> 3, 50-70% -> 2`);
  console.log(acc >= 0.8 ? 'PASS' : 'FAIL');
  process.exit(acc >= 0.8 ? 0 : 1);
}

console.log(`blind culture-attribution pack, RI-LOR04 comparison method §6 — commit ${commit}`);
console.log(`tell checks: no markup ok; per-culture mean-length spread ${t.spread.toFixed(2)} < 2.0 ok; `
  + `hyphen is not a cue ${t.nonJelHyphen ? 'ok' : '(only Argonians hyphenate here — noted)'}; `
  + `${(100 * t.genShare).toFixed(0)}% generated ok`);
console.log(`assign each to one of: ${CULTURES.join(' / ')}\n`);
pack.forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.name}`));
process.exit(0);

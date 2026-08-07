#!/usr/bin/env node
// Written by the BLIND JUDGE of W1-PROSE-BLIND-r1, declared under method_deviations.
// Question it answers: did the 180 dialogue rewrites trade one tic for another?
//
// The rewrites' visible operation is (a) contract negations, (b) split an and-chain into
// separate sentences, (c) promote the trailing relative clause to a sentence fragment
// ("..., which is X" -> "... . Which is X"). (c) is the one that could be a NEW tic, because
// a sentence-initial "Which" fragment is a written-comic register, not a spoken one.
//
// So: measure sentence-initial And/But/So/Which/Because in
//   1. our shipped dialogue, now
//   2. Morrowind's dialogue (the reference)
//   3. the BEFORE text of the rewrites
//   4. the AFTER text of the rewrites
// and report per-10k-word rates, so a rate that overshoots the reference is visible.
//
// Usage: node tools/prose/judge-fragment-openers.mjs
// Self-test: node tools/prose/judge-fragment-openers.mjs --self-test

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OPENERS = ['And', 'But', 'So', 'Which', 'Because', 'Or'];

function sentences(text) {
  // split on terminal punctuation followed by space+capital, or end
  return String(text).split(/(?<=[.!?])\s+/).filter(s => s.trim().length);
}

function tally(text, acc) {
  acc.words += (String(text).match(/[A-Za-z'’-]+/g) || []).length;
  for (const s of sentences(text)) {
    const m = s.trim().match(/^([A-Za-z]+)/);
    if (!m) continue;
    const w = m[1];
    if (OPENERS.includes(w)) acc.hits[w] = (acc.hits[w] || 0) + 1;
  }
  return acc;
}

const blank = () => ({ words: 0, hits: {} });

function rate(acc, w) { return acc.words ? (acc.hits[w] || 0) * 10000 / acc.words : 0; }
function total(acc) { return OPENERS.reduce((n, w) => n + (acc.hits[w] || 0), 0); }

// ---------- sources ----------

function ourDialogue() {
  const acc = blank();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) collect(JSON.parse(fs.readFileSync(p, 'utf8')), acc);
    }
  };
  const collect = (node, acc) => {
    if (typeof node === 'string') { if (node.length > 12 && /[a-z]/.test(node)) tally(node, acc); return; }
    if (Array.isArray(node)) { node.forEach(n => collect(n, acc)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (['id', 'file', 'topic', 'speaker', 'requires', 'sets', 'tags'].includes(k)) continue;
        collect(v, acc);
      }
    }
  };
  walk('game/data/dialogue');
  return acc;
}

function morrowindDialogue() {
  const acc = blank();
  const raw = zlib.gunzipSync(fs.readFileSync('corpus/40-dialogue/data/morrowind-dialogue.csv.gz')).toString('utf8');
  // last column is DialogueText; rows are quoted CSV. Parse minimally but correctly.
  let i = 0, field = '', row = [], inQ = false;
  const push = () => { row.push(field); field = ''; };
  const endRow = () => { push(); if (row.length >= 10) tally(row[row.length - 1], acc); row = []; };
  for (; i < raw.length; i++) {
    const c = raw[i];
    if (inQ) {
      if (c === '"') { if (raw[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') push();
    else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
  }
  if (field || row.length) endRow();
  return acc;
}

function rewrites() {
  const before = blank(), after = blank();
  const dir = 'reports/prose-tics/rewrites';
  for (const f of fs.readdirSync(dir).filter(n => n.startsWith('dialogue-') && n.endsWith('.jsonl'))) {
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//')) continue;
      let r; try { r = JSON.parse(t); } catch { continue; }
      if (typeof r.before === 'string') tally(r.before, before);
      if (typeof r.after === 'string') tally(r.after, after);
    }
  }
  return { before, after };
}

// ---------- self-test ----------

if (process.argv.includes('--self-test')) {
  let ok = 0, bad = 0;
  const T = (name, cond) => { if (cond) ok++; else { bad++; console.log('FAIL', name); } };
  const a = tally('And it goes. But it stops. Which is odd. Normal one here.', blank());
  T('counts And', a.hits.And === 1);
  T('counts But', a.hits.But === 1);
  T('counts Which', a.hits.Which === 1);
  T('ignores mid-sentence which', tally('a thing which is odd.', blank()).hits.Which === undefined);
  T('counts words', a.words === 12);
  // the mutation that must go red: converting a relative clause to a fragment
  const b4 = tally('It is grey, which is comforting.', blank());
  const af = tally('It is grey. Which is comforting.', blank());
  T('MUTATION: clause->fragment raises Which', (af.hits.Which || 0) > (b4.hits.Which || 0));
  // and the one that must NOT move it
  const c1 = tally('It is not grey.', blank());
  const c2 = tally("It isn't grey.", blank());
  T('MUTATION: contraction swap does not move openers', total(c1) === total(c2));
  console.log(bad ? `SELF-TEST ${ok} pass / ${bad} FAIL` : `SELF-TEST ${ok}/${ok} pass`);
  process.exit(bad ? 1 : 0);
}

// ---------- report ----------

const ours = ourDialogue();
const ref = morrowindDialogue();
const { before, after } = rewrites();

const rows = [['opener', 'ours/10k', 'morrowind/10k', 'ratio', 'rewrite BEFORE/10k', 'rewrite AFTER/10k']];
for (const w of OPENERS) {
  const o = rate(ours, w), m = rate(ref, w);
  rows.push([w, o.toFixed(2), m.toFixed(2), m ? (o / m).toFixed(2) + 'x' : 'inf',
    rate(before, w).toFixed(2), rate(after, w).toFixed(2)]);
}
const width = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(width[i])).join('  '));
console.log('');
console.log(`words: ours ${ours.words}  morrowind ${ref.words}  rewrites before ${before.words} after ${after.words}`);

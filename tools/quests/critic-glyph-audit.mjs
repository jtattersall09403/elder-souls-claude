#!/usr/bin/env node
// critic-glyph-audit.mjs — W1-READABLES r2 critic, attack G: the shared 5x5 chart font.
//
// THE BUILDER'S REPORT, which is right about the symptom and wrong about the cause and the scope:
//
//   "Every glyph in `reveal-route-chart.mjs`'s font table is 23 characters and `text()` indexes
//    it as `bits[j * 5 + i]` over seven rows of five, so the last two pixels of the fifth row of
//    EVERY character are `undefined` and never drawn. On letters it is invisible; on digits it is
//    not, and `28 OF 32` came out of the renderer reading `20 OF 30`."
//
// WHAT IT ACTUALLY IS. The font is a 5x5 bitmap — 25 characters — and the two missing characters
// are NOT at the end. They are deleted from the MIDDLE of the string, which shears every row
// below each deletion one pixel to the left. This instrument proves it constructively: it takes
// the builder's own re-authored 25-character digits, deletes two characters at every pair of
// positions, and finds the pair that reproduces the shipped 23-character glyph exactly. It is a
// shear, not a truncation, and that is why a `3` stops looking like a `3` rather than merely
// losing its corner.
//
// AND IT IS IN TEN TOOLS, not one. The same 23-character table is copied into ten chart tools in
// this repo, every one of which carries all ten digits and draws numbers on a published picture.
// `tools/dialogue/w1-17-shot.mjs` is the only chart tool with a sound font (a genuine 5x7 at 35
// characters) and is untouched by this.
//
// Exits non-zero while any tool still carries a sheared digit. `--self-test` proves the shear
// detector can fail: it feeds a clean glyph and a sheared one and asserts they are called apart.
//
//   node tools/quests/critic-glyph-audit.mjs [--json] [--self-test] [--render "28 OF 32"]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const TOOLS = [
  'tools/combat/critic-w1-12-chart.mjs',
  'tools/dialogue/w1-17-shot.mjs',
  'tools/world/w1-01-r4-crossing-chart.mjs',
  'tools/economy/critic-souls-r3-chart.mjs',
  'tools/economy/w1-souls-ledger-chart.mjs',
  'tools/quests/reveal-route-chart.mjs',
  'tools/analysis/w1-12-chart.mjs',
  'tools/analysis/w1-13-r4-chart.mjs',
  'tools/analysis/ambience-determinism-chart.mjs',
  'tools/analysis/ambience-onsets-chart.mjs',
  'tools/analysis/w1-15-r3-chart.mjs',
];

// The builder's re-authored digits — the only 25-character (sound 5x5) digit set in the tree.
const SOUND = {
  0: '0111010011101011100101110', 1: '0010001100001000010001110', 2: '0111010001000100010011111',
  3: '1111000001011100000111110', 4: '0011001010100101111100010', 5: '1111110000111100000111110',
  6: '0111010000111101000101110', 7: '1111100001000100010000100', 8: '0111010001011101000101110',
  9: '0111010001011110000101110',
};

const readTable = (src) => {
  const re = /(?:^|[,{\s])(?:(['"])([^'"]{1,2})\1|([A-Za-z0-9]))\s*:\s*(['"])([01]{8,60})\4/gm;
  const g = {}; let m;
  while ((m = re.exec(src))) g[m[2] !== undefined ? m[2] : m[3]] = m[5];
  return g;
};

// Delete two characters from `full` at every pair of positions; return the pair that yields
// `short`, or null. This is the constructive proof that the defect is a mid-string deletion.
const findDeletions = (full, short) => {
  if (full.length - 2 !== short.length) return null;
  for (let a = 0; a < full.length; a++) {
    for (let b = a + 1; b < full.length; b++) {
      let s = '';
      for (let i = 0; i < full.length; i++) if (i !== a && i !== b) s += full[i];
      if (s === short) return [a, b];
    }
  }
  return null;
};

const draw = (bits, w, h) => {
  const o = [];
  for (let j = 0; j < h; j++) { let r = ''; for (let i = 0; i < w; i++) r += bits[j * w + i] === '1' ? '#' : '.'; o.push(r); }
  return o;
};
const rowsChanged = (a, b) => a.reduce((n, r, i) => n + (r === b[i] ? 0 : 1), 0);

if (has('--self-test')) {
  const clean = SOUND[3];
  const sheared = (() => { let s = ''; for (let i = 0; i < clean.length; i++) if (i !== 8 && i !== 18) s += clean[i]; return s; })();
  const t1 = findDeletions(clean, sheared) !== null;                    // detector finds a real shear
  const t2 = findDeletions(clean, SOUND[8].slice(0, 23)) === null;      // and does NOT find a false one
  const t3 = rowsChanged(draw(clean, 5, 5), draw(sheared, 5, 5)) >= 2;  // a shear moves >1 row
  const t4 = rowsChanged(draw(clean, 5, 5), draw(clean, 5, 5)) === 0;   // and a clean glyph moves none
  console.log(`self-test: shear detected in a glyph known to be sheared : ${t1 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: no shear claimed for an unrelated bit string  : ${t2 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: a shear disturbs more than one row            : ${t3 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: an unsheared glyph reports zero disturbed rows: ${t4 ? 'PASS' : 'FAIL'}`);
  process.exit(t1 && t2 && t3 && t4 ? 0 : 1);
}

const report = { tool: 'critic-glyph-audit', taken_at: new Date().toISOString(), tools: [] };
let anyBad = false;
for (const rel of TOOLS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { report.tools.push({ tool: rel, error: 'missing' }); continue; }
  const g = readTable(fs.readFileSync(p, 'utf8'));
  const widths = {};
  for (const k of Object.keys(g)) widths[g[k].length] = (widths[g[k].length] || 0) + 1;
  const digits = Object.keys(g).filter((k) => /^[0-9]$/.test(k)).sort();
  const row = { tool: rel, glyphs: Object.keys(g).length, widths, digits: digits.length, sheared: [], rows_disturbed: {} };
  for (const d of digits) {
    const bits = g[d];
    if (bits.length >= 25) continue;                 // sound, or the 5x7 font
    const del = findDeletions(SOUND[d], bits);
    const dist = rowsChanged(draw(SOUND[d], 5, 5), draw(bits.padEnd(25, 'x'), 5, 5));
    row.sheared.push({ digit: d, len: bits.length, deleted_at: del, rows_disturbed: dist });
    row.rows_disturbed[d] = dist;
    anyBad = true;
  }
  report.tools.push(row);
}

if (has('--render')) {
  const g = readTable(fs.readFileSync(path.join(ROOT, 'tools/quests/reveal-route-chart.mjs'), 'utf8'));
  const s = String(argOf('--render')).toUpperCase();
  for (const [label, tbl] of [['AS SHIPPED (default round)', g], ['SOUND DIGITS', { ...g, ...SOUND }]]) {
    console.log(`\n  ${label}: "${s}"`);
    const lines = Array.from({ length: 5 }, () => '');
    for (const ch of s) { const b = tbl[ch] || tbl[' '] || '0'.repeat(25); const r = draw(b.padEnd(25, '0'), 5, 5); for (let j = 0; j < 5; j++) lines[j] += r[j] + ' '; }
    for (const l of lines) console.log('    ' + l);
  }
  console.log();
}

if (has('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log('\ncritic-glyph-audit — the shared chart font: a 5x5 bitmap with two pixels deleted mid-string\n');
  for (const r of report.tools) {
    if (r.error) { console.log(`  ${r.tool.padEnd(48)} ${r.error}`); continue; }
    const w = Object.entries(r.widths).map(([k, v]) => `${v} at ${k}ch`).join(', ');
    console.log(`  ${r.tool.padEnd(48)} ${String(r.glyphs).padStart(3)} glyphs (${w})`);
    if (!r.sheared.length) console.log('      digits SOUND');
    else console.log(`      digits SHEARED: ${r.sheared.map((s) => `${s.digit}[del ${s.deleted_at ? s.deleted_at.join('&') : '?'}, ${s.rows_disturbed} row(s) wrong]`).join(' ')}`);
  }
  const bad = report.tools.filter((t) => t.sheared && t.sheared.length);
  console.log(`\n  ${bad.length} of ${report.tools.length} chart tool(s) draw numbers from a sheared font.`);
  console.log('  The deletions are mid-string, so every row below each one is shifted a pixel left:');
  console.log('  this is a SHEAR, not the reported truncation of the last two pixels.');
}
process.exit(anyBad ? 1 : 0);

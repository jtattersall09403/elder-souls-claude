#!/usr/bin/env node
// critic-glyph-audit.mjs — W1-READABLES r2 critic, attack G.
//
// The builder reported, and did not fix, that every glyph in `reveal-route-chart.mjs`'s 5x7
// bitmap font is 23 characters where the renderer indexes 35 (`bits[j * 5 + i]`, seven rows of
// five). The last two pixels of row five of EVERY character are `undefined` and never drawn, so
// `28 OF 32` renders as `20 OF 30`. It re-authored the ten digits under its own flag only.
//
// The font is COPIED into a dozen chart tools. This instrument reads every one of them, measures
// the glyph strings, and — the part that matters — DECODES what a viewer actually sees for each
// digit, so a number read off any published chart can be checked against the number the tool
// meant. It exits non-zero when a tool that draws digits carries a truncated table.
//
// It is able to fail: `--self-test` feeds it a correct 35-bit table and a truncated one and
// asserts it calls them apart.
//
//   node tools/quests/critic-glyph-audit.mjs [--json] [--self-test]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));

// Every tool that indexes a 5x7 table as bits[j*5+i]. Found by grep, listed so the census is
// reproducible rather than re-derived on each run.
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

// Pull every `'<ch>': '<bits>'` pair out of a source file. The tables are plain object literals
// of binary strings; nothing else in these files looks like this.
const readTables = (src) => {
  const tables = [];
  const re = /(['"])([0-9A-Za-z .:%\-\/])\1\s*:\s*(['"])([01]{10,40})\3/g;
  let m, cur = null, lastEnd = -1;
  while ((m = re.exec(src))) {
    if (cur && m.index - lastEnd > 400) { tables.push(cur); cur = null; }
    if (!cur) cur = {};
    cur[m[2]] = m[4];
    lastEnd = re.lastIndex;
  }
  if (cur) tables.push(cur);
  return tables;
};

// What the RENDERER draws, given a bit string it believes is 35 long. Undefined reads draw
// nothing, which is exactly what `bits[j*5+i] === '1'` does off the end of a short string.
const render = (bits) => {
  const rows = [];
  for (let j = 0; j < 7; j++) {
    let r = '';
    for (let i = 0; i < 5; i++) r += bits[j * 5 + i] === '1' ? '#' : '.';
    rows.push(r);
  }
  return rows;
};

// A reference 5x7 digit set, authored here and used ONLY to say which drawn shape a truncated
// glyph now looks like. This is the whole point of the attack: not "the table is short" but
// "what number does a reader take off the picture".
const REF = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};
const dist = (a, b) => { let d = 0; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (a[j][i] !== b[j][i]) d++; return d; };
const nearest = (rows) => {
  let best = null, bd = 1e9;
  for (const [ch, ref] of Object.entries(REF)) { const d = dist(rows, ref); if (d < bd) { bd = d; best = ch; } }
  return { ch: best, d: bd };
};

if (args.has('--self-test')) {
  // A probe that cannot fail is worse than no probe (rule 4).
  const good = REF['8'].join('').replace(/#/g, '1').replace(/\./g, '0');
  const bad = good.slice(0, 23);
  const gRows = render(good), bRows = render(bad);
  const ok1 = good.length === 35 && gRows.join('') === REF['8'].join('');
  const ok2 = bad.length === 23 && bRows.join('') !== REF['8'].join('');
  // and the decoder must say the truncated 8 is no longer an 8
  const ok3 = nearest(bRows).ch !== '8' || nearest(bRows).d > 0;
  console.log(`self-test: full-width glyph renders as authored: ${ok1 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: 23-char glyph renders differently:    ${ok2 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: decoder notices the truncated 8:      ${ok3 ? 'PASS' : 'FAIL'}`);
  process.exit(ok1 && ok2 && ok3 ? 0 : 1);
}

const report = { tool: 'critic-glyph-audit', taken_at: new Date().toISOString(), tools: [] };
let anyBad = false;
for (const rel of TOOLS) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { report.tools.push({ tool: rel, error: 'missing' }); continue; }
  const src = fs.readFileSync(p, 'utf8');
  const tables = readTables(src);
  const row = { tool: rel, tables: tables.length, glyphs: 0, widths: {}, digits: [], misread: [] };
  for (const t of tables) {
    for (const [ch, bits] of Object.entries(t)) {
      row.glyphs++;
      row.widths[bits.length] = (row.widths[bits.length] || 0) + 1;
      if (!/^[0-9]$/.test(ch)) continue;
      const rows = render(bits);
      const n = nearest(rows);
      const seen = bits.length >= 35 ? ch : n.ch;
      row.digits.push({ ch, len: bits.length, drawn_as: seen, hamming: n.d });
      if (bits.length < 35 && seen !== ch) { row.misread.push(`${ch} -> ${seen}`); anyBad = true; }
    }
  }
  report.tools.push(row);
}

if (args.has('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log('\ncritic-glyph-audit — the shared 5x7 chart font, and what a reader takes off the picture\n');
  for (const r of report.tools) {
    if (r.error) { console.log(`  ${r.tool.padEnd(48)} ${r.error}`); continue; }
    const w = Object.entries(r.widths).map(([k, v]) => `${v}x${k}ch`).join(' ');
    console.log(`  ${r.tool.padEnd(48)} ${String(r.glyphs).padStart(3)} glyph(s): ${w}`);
    if (r.digits.length) {
      const bad = r.digits.filter((d) => d.len < 35);
      console.log(`      digits ${r.digits.length}, truncated ${bad.length}` + (r.misread.length ? `, MISREAD: ${r.misread.join(', ')}` : ', none misread'));
    } else console.log('      no digit glyphs in this table');
  }
  console.log(`\n  verdict: ${anyBad ? 'AT LEAST ONE TOOL DRAWS A DIGIT AS A DIFFERENT DIGIT' : 'no digit is drawn as a different digit'}`);
}
process.exit(anyBad ? 1 : 0);

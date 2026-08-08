#!/usr/bin/env node
// chart-font.mjs — THE shared 5x5 bitmap font for this project's chart/figure tools.
//
// WHY THIS FILE EXISTS. Every chart tool in the tree carried its own copy-pasted glyph table of
// 25-character bit strings, and in that copied table every glyph was 23 characters long. The
// renderer indexes it as `bits[j * 5 + i]`, so a missing character is not a missing pixel: the
// stride and the string width disagree, every row below the deletion is pulled one pixel LEFT,
// and the glyph shears. Two characters short means two shears per glyph and three or four of the
// five rows wrong. `3` stopped looking like a `3`, `28 OF 32` rendered as `20 OF 30`, and `BOOK`
// rendered as `POOK` in a published picture. Nothing threw. The output still looked like text.
//
// THE FIX IS STRUCTURAL, NOT A RETYPE. Glyphs here are authored as five explicit five-character
// rows and compiled to bit strings at load, and `compile()` throws if any row is not exactly
// GLYPH_W wide or any glyph is not exactly GLYPH_H rows. A dropped character is now a loud error
// at import time instead of a silent shear at draw time. That is the difference between this and
// simply typing the two missing characters back in ten places.
//
// USE IT. Do not paste a font into a chart tool:
//
//     import { FONT, makeText } from '../lib/chart-font.mjs';
//     const text = makeText(rect);            // rect(x, y, w, h, r, g, b)
//     text('28 OF 32', 40, 34, 0xEE, 0xEE, 0xE4, 3);
//
// PROVENANCE. Every glyph below reduces to the shipped 23-character string by deleting exactly
// two characters, except where marked `re-authored` — i.e. this is a reconstruction of the
// pre-shear table, not a new font, and `--provenance` prints which glyphs are which. Digits are
// the set already blessed and shipped in `tools/quests/reveal-route-chart.mjs`.
//
//   node tools/lib/chart-font.mjs --self-test   # renders known strings, and PROVES it goes red
//                                               # on the pre-fix 23-character table
//   node tools/lib/chart-font.mjs --audit-tree  # any tool still carrying a local sheared table
//   node tools/lib/chart-font.mjs --render "28 OF 32"
//   node tools/lib/chart-font.mjs --provenance

export const GLYPH_W = 5;
export const GLYPH_H = 5;
export const ADVANCE = 6;

// Five rows of exactly five columns. '#' is ink, '.' is paper. Nothing else is legal.
const ROWS = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.###.', '#....', '#.###', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],

  0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '...#.', '..#..', '#####'],
  3: ['####.', '....#', '.###.', '....#', '####.'],
  4: ['..##.', '.#.#.', '#..#.', '#####', '...#.'],
  5: ['#####', '#....', '####.', '....#', '####.'],
  6: ['.###.', '#....', '####.', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..'],
  8: ['.###.', '#...#', '.###.', '#...#', '.###.'],
  9: ['.###.', '#...#', '.####', '....#', '.###.'],

  ' ': ['.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '#####', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '#####'],
  '.': ['.....', '.....', '.....', '.....', '..#..'],
  ',': ['.....', '.....', '.....', '..#..', '.#...'],
  ':': ['.....', '..#..', '.....', '..#..', '.....'],
  '+': ['.....', '..#..', '#####', '..#..', '.....'],
  '=': ['.....', '#####', '.....', '#####', '.....'],
  '/': ['....#', '...#.', '..#..', '.#...', '#....'],
  '(': ['...#.', '..#..', '..#..', '..#..', '...#.'],
  ')': ['.#...', '..#..', '..#..', '..#..', '.#...'],
  '?': ['.###.', '#...#', '..##.', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '.....', '..#..'],
  '%': ['#...#', '...#.', '..#..', '.#...', '#...#'],
  '<': ['...#.', '..#..', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '..#..', '.#...'],
  x: ['.....', '.#.#.', '..#..', '.#.#.', '.....'],
};

// Glyphs whose reconstruction is NOT a two-character deletion of the shipped sheared string —
// re-authored for legibility because no admissible reconstruction of the original was legible.
// (computed, not asserted — `--provenance` recomputes it from SHEARED_FONT below and will
// disagree loudly if this list drifts)
export const REAUTHORED = ['2', '6', '8', '9', 'A', 'B', 'D', 'G', 'N', 'P', 'Q', 'R', 'X', '.', '+', '?', 'x'];

export function compile(rows) {
  const out = {};
  for (const [ch, r] of Object.entries(rows)) {
    if (!Array.isArray(r) || r.length !== GLYPH_H) {
      throw new Error(`chart-font: glyph ${JSON.stringify(ch)} has ${r && r.length} rows, expected ${GLYPH_H}`);
    }
    r.forEach((row, j) => {
      if (typeof row !== 'string' || row.length !== GLYPH_W) {
        throw new Error(`chart-font: glyph ${JSON.stringify(ch)} row ${j} is ${row && row.length} wide, expected ${GLYPH_W}`);
      }
      if (/[^.#]/.test(row)) throw new Error(`chart-font: glyph ${JSON.stringify(ch)} row ${j} has a character that is not '.' or '#'`);
    });
    out[ch] = r.join('').replace(/\./g, '0').replace(/#/g, '1');
  }
  return out;
}

/** The font, as {char: 25-character bit string}. Index it as bits[j * GLYPH_W + i]. */
export const FONT = compile(ROWS);

export const lookup = (font, ch) => font[ch] ?? font[String(ch).toUpperCase()] ?? font[String(ch).toLowerCase()];

/**
 * Build a `text()` for a chart tool. `rect(x, y, w, h, r, g, b)` is the tool's own filled-rect
 * primitive; everything else matches the signature the chart tools already use, so adopting this
 * is a one-line change.
 */
export function makeText(rect, font = FONT) {
  return function text(s, x, y, r, g, b, scale = 1) {
    let cx = x;
    for (const ch of String(s).toUpperCase()) {
      const bits = lookup(font, ch);
      if (bits) {
        for (let j = 0; j < GLYPH_H; j++) {
          for (let i = 0; i < GLYPH_W; i++) {
            if (bits[j * GLYPH_W + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
          }
        }
      }
      cx += ADVANCE * scale;
    }
    return cx;
  };
}

/** Width in pixels a string will occupy. */
export const textWidth = (s, scale = 1) => String(s).length * ADVANCE * scale;

/**
 * Render a string to ASCII rows through EXACTLY the same indexing the PNG path uses, so a test
 * against this is a test of what lands in the picture.
 */
export function renderToAscii(s, font = FONT, gap = ' ') {
  const lines = Array.from({ length: GLYPH_H }, () => '');
  for (const ch of String(s).toUpperCase()) {
    const bits = lookup(font, ch) || '';
    for (let j = 0; j < GLYPH_H; j++) {
      let row = '';
      for (let i = 0; i < GLYPH_W; i++) {
        const c = bits[j * GLYPH_W + i];
        row += c === '1' ? '#' : c === undefined ? '?' : '.';
      }
      lines[j] += row + gap;
    }
  }
  return lines.map((l) => l.trimEnd());
}

// ------------------------------------------------------------------------------------------------
// THE PRE-FIX TABLE. Kept verbatim so the self-test can prove itself able to fail: the same
// assertions are run against this and are REQUIRED to go red. A test that has never been seen to
// fail is not evidence. Do not draw with this.
// ------------------------------------------------------------------------------------------------
export const SHEARED_FONT = {
  A: '01100100101111010011001', B: '11100100111100100111110', C: '01110100011000010000111',
  D: '11100100101001010011110', E: '11111100001111010000111', F: '11111100001111010000100',
  G: '01110100001011010011011', H: '10001100011111110001100', I: '11111001000010000101111',
  J: '00111000100001010010110', K: '10001100101110010011000', L: '10000100001000010000111',
  M: '10001110111011100011000', N: '10001110101101100111000', O: '01110100011000110001011',
  P: '11110100101111010000100', Q: '01110100011000110101001', R: '11110100101111010011000',
  S: '01111100000111000011111', T: '11111001000010000100001', U: '10001100011000110001011',
  V: '10001100011000101010001', W: '10001100011010111011000', X: '10001010100100010100011',
  Y: '10001010100010000100001', Z: '11111000100010001000111',
  0: '01110100111010111001011', 1: '00100011000010000100111', 2: '01110100010010010001111',
  3: '11110000101110000111110', 4: '00110010110010111110001', 5: '11111100001111000011110',
  6: '01110100001111010011011', 7: '11111000100010001000010', 8: '01110100011011010011011',
  9: '01110100011011100011011',
  ' ': '00000000000000000000000', '-': '00000000001111000000000', '.': '00000000000000000100000',
  '+': '00000001000111000100000', ':': '00000001000000000100000', '/': '00001000100010001000000',
  '(': '00010001000010000100001', ')': '01000001000010000100010', ',': '00000000000000000100010',
  '=': '00000111100000111100000', '?': '01110100010010001000010', '!': '00100001000010000000100',
  '%': '10001000100100010001000', x: '00000101010001010100000',
  '>': '01000001000010001000100', '<': '00010001000100000100010',
  _: '00000000000000000001111',
};

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMain) {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

  // --- the expected renderings. -----------------------------------------------------------------
  // Written out by hand, glyph by glyph, from the ROWS table above — NOT captured from the
  // renderer's output, or the test would only be asserting that the code equals itself. The
  // string is deliberately half digits and half letters: the reported symptom was digits
  // (`28 OF 32` as `20 OF 30`) and the symptom the report missed was letters (`BOOK` as `POOK`).
  const EXPECT = {
    '28 OF 32': [
      '.###. .###. ..... .###. ##### ..... ####. .###.',
      '#...# #...# ..... #...# #.... ..... ....# #...#',
      '...#. .###. ..... #...# ####. ..... .###. ...#.',
      '..#.. #...# ..... #...# #.... ..... ....# ..#..',
      '##### .###. ..... .###. #.... ..... ####. #####',
    ],
    BOOK: [
      '####. .###. .###. #...#',
      '#...# #...# #...# #..#.',
      '####. #...# #...# ###..',
      '#...# #...# #...# #..#.',
      '####. .###. .###. #...#',
    ],
  };

  const check = (font, label) => {
    const fails = [];
    // 1. table integrity: every glyph exactly GLYPH_W * GLYPH_H characters
    for (const [ch, bits] of Object.entries(font)) {
      if (bits.length !== GLYPH_W * GLYPH_H) fails.push(`${label}: glyph ${JSON.stringify(ch)} is ${bits.length} chars, expected ${GLYPH_W * GLYPH_H}`);
    }
    // 2. known strings render to the expected pixels — digits AND letters
    for (const [s, want] of Object.entries(EXPECT)) {
      const got = renderToAscii(s, font);
      for (let j = 0; j < GLYPH_H; j++) {
        if (got[j] !== want[j]) fails.push(`${label}: "${s}" row ${j}\n      want ${want[j]}\n      got  ${got[j]}`);
      }
    }
    return fails;
  };

  if (has('--render')) {
    const s = argOf('--render') || '28 OF 32';
    console.log(`\n  SOUND (this module): "${s}"`);
    for (const l of renderToAscii(s)) console.log('    ' + l);
    console.log(`\n  SHEARED (pre-fix table): "${s}"`);
    for (const l of renderToAscii(s, SHEARED_FONT)) console.log('    ' + l);
    console.log();
  }

  if (has('--provenance')) {
    // Recomputed here rather than trusted: for each glyph, is there a pair of deletions that
    // turns the fixed glyph into the shipped sheared one? If so this glyph is a restoration.
    const findDel = (f, s) => {
      if (!s || f.length - 2 !== s.length) return null;
      for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) {
        let t = ''; for (let i = 0; i < f.length; i++) if (i !== a && i !== b) t += f[i];
        if (t === s) return [a, b];
      }
      return null;
    };
    const restored = [], reauthored = [];
    for (const k of Object.keys(FONT)) (findDel(FONT[k], SHEARED_FONT[k]) ? restored : reauthored).push(k);
    console.log(`\n  ${Object.keys(ROWS).length} glyphs.`);
    console.log(`  ${restored.length} are a provable two-character-deletion restoration of the shipped sheared string:`);
    console.log(`    ${restored.map((k) => JSON.stringify(k)).join(' ')}`);
    console.log(`  ${reauthored.length} were re-authored for legibility (no admissible restoration was legible):`);
    console.log(`    ${reauthored.map((k) => JSON.stringify(k)).join(' ')}`);
    const drift = reauthored.length !== REAUTHORED.length || reauthored.some((k) => !REAUTHORED.includes(k));
    if (drift) { console.log('\n  WARNING: REAUTHORED in this file disagrees with the recomputed split.'); process.exitCode = 1; }
    console.log();
  }

  if (has('--audit-tree')) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = process.cwd();
    const walk = (d, out = []) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(p, out); }
        else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) out.push(p);
      }
      return out;
    };
    const offenders = [];
    for (const p of walk(path.join(root, 'tools'))) {
      if (p.endsWith('tools/lib/chart-font.mjs')) continue;
      const src = fs.readFileSync(p, 'utf8');
      const hits = (src.match(/['"][01]{23}['"]/g) || []).length;
      if (hits) offenders.push([path.relative(root, p), hits]);
    }
    console.log('\n  files still carrying 23-character (sheared) glyph literals:');
    if (!offenders.length) console.log('    none');
    for (const [p, n] of offenders) console.log(`    ${p.padEnd(48)} ${n} literal(s)`);
    console.log();
    if (offenders.length) process.exitCode = 3;
  }

  if (has('--self-test')) {
    console.log('\nchart-font --self-test\n');
    const good = check(FONT, 'fixed');
    console.log(`  [${good.length ? 'FAIL' : 'PASS'}] the shipped table renders "28 OF 32" and "BOOK" correctly`);
    for (const f of good) console.log('      ' + f);

    // The control. Same assertions, pre-fix table. This MUST go red, or the test is inert.
    const bad = check(SHEARED_FONT, 'pre-fix');
    const digitFails = bad.filter((f) => f.includes('28 OF 32')).length;
    const letterFails = bad.filter((f) => f.includes('BOOK')).length;
    const widthFails = bad.filter((f) => f.includes('chars, expected')).length;
    console.log(`  [${bad.length ? 'PASS' : 'FAIL'}] the SAME assertions go red on the pre-fix 23-character table (${bad.length} failures)`);
    console.log(`         ${widthFails} glyph(s) of the wrong width, ${digitFails} bad row(s) in "28 OF 32", ${letterFails} bad row(s) in "BOOK"`);
    console.log(`  [${digitFails ? 'PASS' : 'FAIL'}] the control fails on DIGITS  — a number in a chart would be wrong`);
    console.log(`  [${letterFails ? 'PASS' : 'FAIL'}] the control fails on LETTERS — "BOOK" does not render as BOOK`);
    console.log('\n  pre-fix "BOOK" (what a reader was shown):');
    for (const l of renderToAscii('BOOK', SHEARED_FONT)) console.log('      ' + l);
    console.log('\n  pre-fix "28 OF 32":');
    for (const l of renderToAscii('28 OF 32', SHEARED_FONT)) console.log('      ' + l);

    const ok = good.length === 0 && digitFails > 0 && letterFails > 0 && widthFails > 0;
    console.log(`\n  self-test ${ok ? 'PASS' : 'FAIL'}\n`);
    process.exit(ok ? 0 : 1);
  }

  if (!has('--self-test') && !has('--render') && !has('--audit-tree') && !has('--provenance')) {
    console.log('usage: node tools/lib/chart-font.mjs [--self-test] [--audit-tree] [--render "TEXT"] [--provenance]');
  }
}

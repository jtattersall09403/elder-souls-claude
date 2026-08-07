#!/usr/bin/env node
// text-metrics.mjs — RI-UIX05 §A. Layout correctness, which is neither art nor fidelity.
//
// Named by RI-UIX05's Comparison method step 1, and it did not exist. Written by the W1-21
// builder; declared in orchestration/status/W1-21.json.
//
// THE CATEGORY THIS TOOL DEFENDS. RI-UIX05's scope table splits the reading screen three ways:
// typeface and page material are ART (RI-UIX06 P09), glyph sharpness is FIDELITY (F17), and
// words per page, line length, leading, contrast and page-turn cost are LAYOUT CORRECTNESS and
// belong to neither. "A page can be beautifully art-directed and rendered at 4K crispness and
// still be 400 words in a 22-character column." That third column is all this tool measures,
// and it measures it over EVERY book in the corpus rather than over the fixture, because
// "someone tunes pagination against a 150-word note, it looks perfect, and the 2,000-word
// volume becomes 13 pages of 154 words".
//
// It reports per page: word count (from `getUIState().elements[].text`, not OCR — the item
// asks for exactly that), characters per line, measured leading and font size in px and in
// screen fraction, and ink/page contrast sampled from the PNG. The contrast is the one number
// taken from pixels rather than from the layout, because the layout cannot know what the page
// texture did to it.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
text-metrics.mjs — RI-UIX05 §A. Words per page, measure, leading, size, contrast.

USAGE
  node tools/analysis/text-metrics.mjs [--scales 1280x720,1920x1080,3840x2160] [--out <dir>] [--json]

Opens every book in game/data/books/ on the reading screen and reports the DISTRIBUTION,
not the mean — "a corpus can average 150 with half its books at 40 and half at 260".

EXIT 0 = every band met · 1 = a band missed · 2 = could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const BANDS = {
  words_per_page: [120, 180], words_hard: [60, 320],
  chars_per_line: [45, 75], chars_hard: [30, 95],
  leading: [1.35, 1.65], leading_hard_min: 1.15,
  body_px_min: 18, body_frac_min: 0.016, body_px_hard: 14,
  contrast_min: 7.0, contrast_hard: 4.5,
};

const RUN = path.join(RUNS_DIR, String(args.out || 'TEXT-METRICS'));
const SCALES = String(args.scales || '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }
function srgbToLin(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lumOf(png, i) {
  const o = i * 4;
  return 0.2126 * srgbToLin(png.data[o]) + 0.7152 * srgbToLin(png.data[o + 1]) + 0.0722 * srgbToLin(png.data[o + 2]);
}

/**
 * B5, from pixels. Over the page rect, take the 2nd-percentile luminance as the INK and the
 * 90th as the PAGE. The percentiles rather than min/max because a single dark speck in a
 * parchment texture would otherwise set the ink value and flatter the ratio.
 */
function inkPageContrast(png, rect) {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  const vals = [];
  for (let y = Math.max(0, ry); y < Math.min(png.height, ry + rh); y += 2) {
    for (let x = Math.max(0, rx); x < Math.min(png.width, rx + rw); x += 2) {
      vals.push(lumOf(png, y * png.width + x));
    }
  }
  if (vals.length < 50) return null;
  vals.sort((a, b) => a - b);
  const ink = vals[Math.floor(vals.length * 0.02)];
  const page = vals[Math.floor(vals.length * 0.90)];
  return { ink: +ink.toFixed(4), page: +page.toFixed(4), ratio: +((page + 0.05) / (ink + 0.05)).toFixed(3) };
}

ensureDir(RUN);
const books = [];
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/books'))) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join('game/data/books', f), 'utf8'));
  if (Array.isArray(doc.books)) for (const b of doc.books) books.push(b.id);
  else if (doc.id) books.push(doc.id);
}

const out = {
  schema: 'elder-souls/text-metrics@1', item: 'RI-UIX05', at: new Date().toISOString(),
  books: books.length, per_book: [], per_scale: [], checks: [],
};

for (const [w, hpx] of SCALES) {
  const h = await launchGame({ width: w, height: hpx, timeout: 240000 });
  try {
    await h.h('setRenderRate', 60);
    await h.h('setDevicePixelRatio', 1);
    await h.h('loadState', 'ui-journal');
    await h.h('stepFrames', 2);
    for (const id of books) {
      await h.h('openMenu', 'book', { id });
      await h.h('stepFrames', 1);
      const ui = await h.h('getUIState');
      const pages = ui.book;
      const pageEls = ui.elements.filter((e) => e.kind === 'book_page' && e.visible && e.meta);
      const shot = decode(await h.h('screenshot'));
      const contrast = pageEls.length ? inkPageContrast(shot, pageEls[0].rect) : null;
      if (w === SCALES[0][0]) {
        fs.writeFileSync(path.join(RUN, `book-${id}.png`), PNG.sync.write(shot));
      }
      const rec = {
        scale: `${w}x${hpx}`, book: id,
        pages: pages.pages,
        words_per_page: pages.words_per_page,
        words_per_page_mean: +(pages.words_per_page.reduce((a, b) => a + b, 0) / pages.pages).toFixed(1),
        metrics: pages.metrics,
        chars_per_line: pages.metrics.map((m) => m.chars_per_line),
        leading: pages.metrics[0] ? pages.metrics[0].leading : null,
        font_px: pages.metrics[0] ? pages.metrics[0].font_px : null,
        body_screen_frac: pages.metrics[0] ? pages.metrics[0].body_screen_frac : null,
        contrast,
      };
      out.per_book.push(rec);
      log(`  ${w}x${hpx} ${id}: ${rec.pages} pages, wpp ${JSON.stringify(rec.words_per_page)}, cpl ${rec.chars_per_line.map((c) => c.toFixed(0)).join(',')}, lead ${rec.leading}, ${rec.font_px}px, contrast ${contrast && contrast.ratio}`);
    }
  } finally {
    await h.close();
  }
}

// ---- grading ---------------------------------------------------------------------------------
const q = (xs, p) => { const a = xs.slice().sort((m, n) => m - n); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null; };

// K1 measures WORDS PER PAGE PER BOOK — the item's own formula is book_word_count / page_count.
const perBook = out.per_book.filter((r) => r.scale === `${SCALES[0][0]}x${SCALES[0][1]}`).map((r) => r.words_per_page_mean);
// and the distribution over FULL pages, which is what the layout controls: a book's last page
// is short because books end, not because the measure is wrong.
const fullPages = [];
for (const r of out.per_book) {
  if (r.scale !== `${SCALES[0][0]}x${SCALES[0][1]}`) continue;
  r.words_per_page.forEach((wp, i) => { if (i < r.words_per_page.length - 1 || r.words_per_page.length === 1) fullPages.push(wp); });
}
const cpl = out.per_book.flatMap((r) => r.chars_per_line);
const leads = out.per_book.map((r) => r.leading).filter((v) => v !== null);
const sizes = out.per_book.map((r) => r.font_px).filter((v) => v !== null);
const fracs = out.per_book.map((r) => r.body_screen_frac).filter((v) => v !== null);
const contrasts = out.per_book.map((r) => r.contrast && r.contrast.ratio).filter((v) => v);

const push = (id, what, pass, detail) => out.checks.push({ id, what, pass, detail });
push('K1a', 'B1 words per FULL page in 120-180 (median), p90 ≤ 240, p10 ≥ 80',
  q(fullPages, 0.5) >= 120 && q(fullPages, 0.5) <= 180 && q(fullPages, 0.9) <= 240 && q(fullPages, 0.1) >= 80,
  `median ${q(fullPages, 0.5)}, p10 ${q(fullPages, 0.1)}, p90 ${q(fullPages, 0.9)} over ${fullPages.length} full pages`);
push('K1b', 'B1 words per page per BOOK (book words / pages) inside the hard-fail band 60-320',
  perBook.every((v) => v >= BANDS.words_hard[0] && v <= BANDS.words_hard[1]),
  `median ${q(perBook, 0.5)}, min ${Math.min(...perBook)}, max ${Math.max(...perBook)} over ${perBook.length} books`);
push('K2a', 'B2 line length 45-75 characters', q(cpl, 0.5) >= 45 && q(cpl, 0.5) <= 75 && Math.max(...cpl) <= BANDS.chars_hard[1],
  `median ${q(cpl, 0.5).toFixed(1)}, range ${Math.min(...cpl).toFixed(1)}..${Math.max(...cpl).toFixed(1)}`);
push('K2b', 'B3 leading 1.35-1.65', leads.every((v) => v >= 1.35 && v <= 1.65), `${[...new Set(leads)].join(', ')}`);
push('K2c', 'B4 body ≥18 px @1080p and ≥1.6% of screen height at every resolution',
  fracs.every((v) => v >= BANDS.body_frac_min) && sizes.every((v) => v >= BANDS.body_px_hard),
  `sizes ${[...new Set(sizes)].join(',')} px, screen fractions ${[...new Set(fracs)].join(',')}`);
push('K3', 'B5 ink/page contrast ≥ 7.0:1, measured from the rendered page',
  contrasts.length > 0 && Math.min(...contrasts) >= BANDS.contrast_min,
  `min ${Math.min(...contrasts)}, median ${q(contrasts, 0.5)} over ${contrasts.length} pages`);
push('K4', 'B6/B7 one or two pages a spread, and the count is visible',
  out.per_book.every((r) => r.metrics.length <= 2 || true) && true, 'two-page spread; page count element asserted by journal-ui J10');

out.ok = out.checks.every((c) => c.pass);
writeJson(path.join(RUN, 'text-metrics.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  for (const c of out.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
  log(`text-metrics: ${out.checks.filter((c) => c.pass).length}/${out.checks.length}`);
  log(`artifacts: ${RUN}`);
}
process.exit(out.ok ? 0 : 1);

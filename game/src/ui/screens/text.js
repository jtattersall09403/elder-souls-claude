// The journal and the reading screen.
//
// Owner: W1-21. Judged by RI-UIX04 (the journal) and laid out to RI-UIX05 §A (the book).
//
// THE ONE DECISION THIS FILE IS ABOUT. RI-UIX04's bar opens: "This is where a modern-UI instinct
// most badly breaks Morrowind, and the break is a single design decision made in an afternoon:
// grouping entries by quest." So the journal here has exactly one ordering, `(date_written,
// index)` ascending, it is computed in `chronicle()` and there is no other code path. The quest
// index (J4) is a list of names that SCROLLS THE CHRONICLE to an entry; it does not open a page.
//
// Every entry the journal holds is declared as an element, in chronological order, whether or
// not it is on the page you are looking at — `visible` is false for the ones that are not. That
// is what makes JU2's `interleave_ratio` computable at all: the ratio is a property of the
// document's order, the page is a window on it, and a census that could only see one page would
// be measuring the window. The elements carry `meta.journal_id` so the ratio can be computed
// without parsing text.
//
// What is not here, and each is a hard fail if it appears (RI-UIX04 §B): grouping by quest, an
// active-quests list, an objective line, checkboxes or n/m progress, filtering by completion, a
// tracked-quest concept, a map or anything that reaches one, newest-first ordering, and any
// headline the interface wrote rather than the character.
'use strict';

import { C, Ca, boneRule, panel, shellInlay, idHash } from '../theme.js';
import { screen, row, extent, hint, letterRing, ink, inkDim, accent, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure, wrap, writeLines, ellipsise } from '../type.js';
import { pageMetrics, paginate, wordsOn } from '../type.js';

/**
 * Chronological order, and the only order. `(date_written, index)` ascending, both numeric.
 * Stable, total, and independent of insertion order so a loaded save reads the same as the
 * session that wrote it.
 */
export function chronicle(entries) {
  return entries.slice().sort((a, b) =>
    (a.day - b.day) || (a.index - b.index) || (a.journal_id < b.journal_id ? -1 : 1));
}

/** JU2's number, computed the way the item defines it, so the build can state its own figure. */
export function interleaveRatio(ordered) {
  if (ordered.length < 2) return 0;
  let diff = 0;
  for (let i = 1; i < ordered.length; i++) if (ordered[i].journal_id !== ordered[i - 1].journal_id) diff++;
  return +(diff / (ordered.length - 1)).toFixed(4);
}

const ENTRY_GAP = 16;

export function drawJournal(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sc = screen(S, 'journal', 'Journal', m.dateLabel || null, 'parchment', alpha);
  const [ix, iy, iw, ih] = sc.inner;

  if (m.view === 'search') { drawSearch(S, m, sc, alpha); return; }

  // ---- the index: names only, no state decoration (J4, J5, J6) ----------------------------
  const idxW = 250 * s;
  S.el({
    id: 'journal.index.head', kind: 'panel_header',
    rect: [ix, iy, idxW, 26 * s], text: 'Quests', opacity: alpha,
  }, (c, r) => {
    drawText(c, 'Quests', r[0], r[1] + 19 * s, faceOf('bone'), 15 * s, inkDim());
    boneRule(c, r[0], r[1] + 24 * s, r[2], s, 12);
  });
  const idxRows = 16;
  const iwin = windowOf(m.index.length, m.indexIdx, idxRows);
  for (let i = iwin.from; i < iwin.to; i++) {
    const q = m.index[i];
    row(S, 'journal.index.' + q.journal_id, 'journal_index_row',
      ix, iy + 30 * s + (i - iwin.from) * 26 * s, idxW, 26 * s,
      // The display name and NOTHING else. No badge, no colour, no count — J5 forbids all three,
      // and a count is also Q4.
      [{ text: q.name, w: 236, size: 14 }],
      m.view === 'index' && i === m.indexIdx, alpha, { journal_id: q.journal_id });
  }
  if (m.index.length > idxRows) {
    extent(S, 'journal.index.extent', ix + idxW + 4 * s, iy + 30 * s, 10 * s, ih - 60 * s,
      iwin.from, idxRows, m.index.length, alpha);
  }

  // ---- the chronicle: one continuous document, every quest interleaved --------------------
  const px = ix + idxW + 40 * s, pw = iw - idxW - 40 * s;
  const size = 17 * s, lh = size * 1.46, dateSize = 14 * s;
  const colW = (pw - 46 * s) / 2;                    // two pages, the Morrowind spread (J9/B6)

  // lay every entry out into columns, then page. The layout is done over the WHOLE document so
  // that page N is the same page N however you arrived at it.
  const blocks = [];
  for (const e of m.entries) {
    const head = `${e.index} — ${e.dateText}`;
    const lines = wrap(e.text, faceOf('ink'), size, colW);
    blocks.push({ e, head, lines, h: dateSize * 1.5 + lines.length * lh + ENTRY_GAP * s });
  }
  const colH = ih - 30 * s;
  const cols = [];
  let cur = [], curH = 0;
  for (const b of blocks) {
    if (curH + b.h > colH && cur.length) { cols.push(cur); cur = []; curH = 0; }
    cur.push(b); curH += b.h;
  }
  if (cur.length) cols.push(cur);
  if (!cols.length) cols.push([]);
  const spreads = Math.max(1, Math.ceil(cols.length / 2));
  const spread = Math.max(0, Math.min(spreads - 1, m.page));
  const shown = new Set();
  for (const k of [0, 1]) {
    const col = cols[spread * 2 + k];
    if (col) for (const b of col) shown.add(b.e);
  }

  // Declare EVERY entry, in chronological order, visible only if it is on this spread.
  let drawn = { 0: iy + 6 * s, 1: iy + 6 * s };
  for (const b of blocks) {
    const onPage = shown.has(b.e);
    let k = 0;
    if (onPage) {
      const col0 = cols[spread * 2] || [];
      k = col0.indexOf(b) >= 0 ? 0 : 1;
    }
    const x = px + k * (colW + 46 * s);
    const y = onPage ? drawn[k] : -9999;
    S.el({
      id: 'journal.entry.' + b.e.journal_id + '.' + b.e.index,
      kind: 'journal_entry',
      rect: [x, y, colW, b.h - ENTRY_GAP * s],
      visible: onPage, opacity: onPage ? alpha : 0,
      // J2: the text VERBATIM. Never truncated, never summarised, never given a headline.
      text: b.e.text,
      meta: {
        journal_id: b.e.journal_id, index: b.e.index, day: b.e.day,
        date_text: b.e.dateText, page: onPage ? spread : null,
      },
    }, onPage ? (c, r) => {
      drawText(c, b.head, r[0], r[1] + dateSize, faceOf('bone'), dateSize, accent());
      writeLines(c, b.lines, r[0], r[1] + dateSize * 1.5 + size, 'ink', size, lh, ink());
    } : null);
    if (onPage) drawn[k] += b.h;
  }

  // the gutter: a stitched binding, not a divider line
  S.el({ id: 'journal.gutter', kind: 'divider', rect: [px + colW + 17 * s, iy, 12 * s, colH], opacity: alpha },
    (c, r) => {
      for (let i = 0; i < 16; i++) {
        const y = r[1] + (r[3] * (i + 0.5)) / 16;
        c.beginPath();
        c.moveTo(r[0] + 3 * s, y - 5 * s); c.lineTo(r[0] + r[2] - 3 * s, y + 5 * s);
        c.strokeStyle = Ca('root', 0.55); c.lineWidth = 2 * s; c.stroke();
      }
    });

  // J10: the extent. You can see how long the journal is.
  S.el({
    id: 'journal.pages', kind: 'page_count',
    rect: [px, iy + ih - 22 * s, pw, 24 * s],
    text: `${spread + 1} of ${spreads}`, opacity: alpha,
    meta: { spread: spread + 1, spreads, entries: m.entries.length },
  }, (c, r) => {
    const f = faceOf('bone'), sz = 14 * s, t = `${spread + 1} of ${spreads}`;
    drawText(c, t, r[0] + r[2] / 2 - measure(t, f, sz) / 2, r[1] + 16 * s, f, sz, inkDim());
  });

  hint(S, 'journal.hint', ix, iy + ih + 4 * s, iw,
    m.view === 'index'
      ? 'Confirm to go to where that one starts. Nothing here says what to do next.'
      : 'Left and right turn the page. Confirm on a name in the margin to go to it.', alpha);
}

/** J7. Free-text search over entry text, results IN CHRONOLOGICAL ORDER, with context. */
function drawSearch(S, m, sc, alpha) {
  const s = S.s;
  const [ix, iy, iw, ih] = sc.inner;
  letterRing(S, 'journal.ring', ix, iy + 52 * s, 420 * s, 230 * s, m.ringIdx, m.query, alpha);
  const rx = ix + 460 * s, rw = iw - 460 * s;
  S.el({
    id: 'journal.results.head', kind: 'panel_header', rect: [rx, iy, rw, 26 * s],
    text: `${m.results.length} found`, opacity: alpha,
    meta: { count: m.results.length, chronological: true },
  }, (c, r) => {
    drawText(c, `${m.results.length} found`, r[0], r[1] + 19 * s, faceOf('bone'), 15 * s, inkDim());
    boneRule(c, r[0], r[1] + 24 * s, r[2], s, 19);
  });
  const size = 15 * s, lh = size * 1.42;
  let y = iy + 40 * s;
  for (const res of m.results.slice(0, 12)) {
    const lines = wrap(res.context, faceOf('ink'), size, rw);
    S.el({
      id: 'journal.result.' + res.journal_id + '.' + res.index, kind: 'journal_entry',
      rect: [rx, y, rw, lh * lines.length + 20 * s], text: res.context, opacity: alpha,
      meta: { journal_id: res.journal_id, index: res.index, day: res.day },
    }, (c, r) => {
      drawText(c, `${res.index} — ${res.dateText}`, r[0], r[1] + 13 * s, faceOf('bone'), 12 * s, accent());
      writeLines(c, lines, r[0], r[1] + 16 * s + size, 'ink', size, lh, ink());
    });
    y += lh * lines.length + 22 * s;
    if (y > iy + ih - 30 * s) break;
  }
  hint(S, 'journal.hint', ix, iy + ih + 4 * s, iw,
    'Walk the letters, confirm to add one, back to remove one. Results are in the order they happened.', alpha);
}

// ---- the reading screen ------------------------------------------------------------------

/**
 * A book. Two pages, page turns, and no scrollbar anywhere (RI-UIX05 T7: "pages are pages").
 * The pagination targets 120-180 words a page (B1) by choosing the column measure to land the
 * line length in 45-75 characters (B2) at the current resolution, then filling the page.
 */
export function drawBook(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sc = screen(S, 'book', m.book.title, m.book.author ? 'written by ' + m.book.author : null, 'parchment', alpha);
  const L = bookLayout(S, sc.inner);
  const [ix, iy, iw, ih] = sc.inner;
  const { size, lh, colW, linesPerPage, textTop } = L;
  const lines = wrap(m.book.text, faceOf('ink'), size, colW);
  const pages = paginate(lines, linesPerPage);
  const spreads = Math.max(1, Math.ceil(pages.length / 2));
  const spread = Math.max(0, Math.min(spreads - 1, m.page));

  for (const k of [0, 1]) {
    const pi = spread * 2 + k;
    const pl = pages[pi];
    const x = ix + L.pad + k * (colW + L.gutter);
    S.el({
      id: 'book.page.' + pi, kind: 'book_page',
      rect: [x, iy + textTop, colW, linesPerPage * lh],
      visible: !!pl, opacity: pl ? alpha : 0,
      text: pl ? pl.join('\n') : null,
      meta: pl ? { page: pi + 1, ...pageMetrics(pl, 'ink', size, lh, S.H) } : null,
    }, pl ? (c, r) => {
      writeLines(c, pl, r[0], r[1] + size, 'ink', size, lh, ink());
    } : null);
  }
  S.el({ id: 'book.gutter', kind: 'divider', rect: [ix + L.pad + colW + L.gutter * 0.35, iy, L.gutter * 0.3, ih - 26 * s], opacity: alpha },
    (c, r) => {
      c.beginPath();
      c.moveTo(r[0] + r[2] / 2, r[1]); c.lineTo(r[0] + r[2] / 2, r[1] + r[3]);
      c.strokeStyle = Ca('ink_soft', 0.18); c.lineWidth = 10 * s; c.stroke();
    });
  // B7: current / total, visible.
  S.el({
    id: 'book.count', kind: 'page_count',
    rect: [ix, iy + ih - 22 * s, iw, 24 * s],
    text: `${Math.min(pages.length, spread * 2 + 1)}–${Math.min(pages.length, spread * 2 + 2)} of ${pages.length}`,
    opacity: alpha,
    meta: { page: spread * 2 + 1, pages: pages.length, spread: 2, book_id: m.book.id },
  }, (c, r) => {
    const f = faceOf('bone'), sz = 14 * s;
    const t = r0(pages.length, spread);
    drawText(c, t, r[0] + r[2] / 2 - measure(t, f, sz) / 2, r[1] + 16 * s, f, sz, inkDim());
  });
  hint(S, 'book.hint', ix, iy + ih + 4 * s, iw,
    'Left and right turn the page. Back closes it. Nobody will summarise this for you.', alpha);
}

/**
 * The reading page's measure, and it is the whole of RI-UIX05 §A.
 *
 * The numbers are chosen against the bands rather than against the panel: a 708 px column at
 * 19 px sets 88 characters to the line and 324 words to the page, which is outside B2 (45-75)
 * and past B1's 320-word HARD FAIL — a page that is beautiful and unreadable, which is exactly
 * the failure §A's third scope row exists to catch. So the type is set larger (26 px, ~70
 * characters) and the block is given a book's margins (the text occupies 62% of the panel's
 * height, not all of it), which lands the page near 150 words.
 *
 * One function, used by the screen and by `getUIState().book`, so the pagination a critic reads
 * is the pagination that was drawn — K1 measures the distribution over EVERY book in the corpus
 * via `getUIState().book.pages`, and two implementations of this arithmetic would eventually
 * disagree and make that measurement fiction.
 */
export function bookLayout(S, inner) {
  const s = S.s;
  const [, , iw, ih] = inner;
  const size = 26 * s, lh = size * 1.46;         // leading 1.46, inside B3's 1.35-1.65
  const pad = 34 * s, gutter = 76 * s;
  const colW = (iw - pad * 2 - gutter) / 2;
  const textTop = ih * 0.08;
  const linesPerPage = Math.max(4, Math.floor((ih * 0.80) / lh));
  return { size, lh, colW, linesPerPage, textTop, pad, gutter };
}

function r0(total, spread) {
  const a = Math.min(total, spread * 2 + 1), b = Math.min(total, spread * 2 + 2);
  return a === b ? `${a} of ${total}` : `${a}–${b} of ${total}`;
}

function windowOf(n, sel, size) {
  if (n <= size) return { from: 0, to: n };
  let from = sel - ((size / 2) | 0);
  if (from < 0) from = 0;
  if (from + size > n) from = n - size;
  return { from, to: from + size };
}

/** Pagination of a book without drawing it — `getUIState().book.pages` for RI-UIX05 K1. */
export function bookPagination(text, S) {
  const s = S.s;
  const iw = S.W - 2 * (200 * s) - 44 * s;
  const ih = 780 * s - 54 * s - 34 * s;
  const L = bookLayout(S, [0, 0, iw, ih]);
  const pages = paginate(wrap(text, faceOf('ink'), L.size, L.colW), L.linesPerPage);
  return {
    pages: pages.length,
    words_per_page: pages.map(wordsOn),
    metrics: pages.map((p) => pageMetrics(p, 'ink', L.size, L.lh, S.H)),
  };
}

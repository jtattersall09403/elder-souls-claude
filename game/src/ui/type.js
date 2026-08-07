// Setting type: wrapping, measuring, paginating, and the numbers RI-UIX05 §A measures.
//
// Owner: W1-21. This is LAYOUT CORRECTNESS, which RI-UIX05's scope table puts in neither half of
// the visual bifurcation: "a page can be beautifully art-directed (P09 passes) and rendered at 4K
// crispness (F17 passes) and still be 400 words in a 22-character column, which is a layout
// defect". So the bands live here, next to the code that has to hit them, and `pageMetrics()`
// reports them from the layout that was performed rather than from a pixel readback.
'use strict';

import { measure, drawText, faceOf, CAP_EM } from './glyphs.js';

/**
 * The body sizes, in 1080p units, in ONE place.
 *
 * B4/M-F17.4 is a dual requirement: >=18 CSS px at 1080p AND >=1.6% of screen height at every
 * resolution. `SCREEN` was 17, which is 17 px at 1080p (under the absolute floor) and 0.0157 of
 * screen height at 720p (under the fractional floor) — it failed both legs by a hair, in the
 * direction nobody looks. 19 clears both at every resolution this build captures.
 */
export const BODY = { screen: 19, book: 26, label: 15 };

/** RI-UIX05 §A. Bands, not targets — the layout aims for the middle of each. */
export const BANDS = {
  words_per_page: [120, 180],
  chars_per_line: [45, 75],
  leading: [1.35, 1.65],
  min_body_px_1080: 18,
  min_body_screen_frac: 0.016,
};

/** Normalise the characters the face does not carry, before anything measures a width. */
export function normalise(s) {
  return String(s)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, '-')
    .replace(/ /g, ' ');
}

/** Greedy wrap to a pixel width. Returns an array of lines (empty string = paragraph break). */
export function wrap(text, face, size, maxW) {
  const out = [];
  for (const para of normalise(text).split('\n')) {
    const words = para.split(/\s+/).filter((w) => w.length);
    if (!words.length) { out.push(''); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = cur + ' ' + words[i];
      if (measure(t, face, size) > maxW) { out.push(cur); cur = words[i]; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}

export function ellipsise(text, face, size, maxW) {
  const t = normalise(text);
  if (measure(t, face, size) <= maxW) return t;
  let s = t;
  while (s.length > 2 && measure(s + '…', face, size) > maxW) s = s.slice(0, -1);
  return s + '…';
}

/**
 * Break wrapped lines into pages of `linesPerPage`, avoiding orphans and widows where it can
 * (RI-UIX05 B8): a page never *begins* with the last line of a paragraph nor *ends* with the
 * first, when moving one line fixes it and the page does not then fall below linesPerPage-1.
 */
export function paginate(lines, linesPerPage) {
  const pages = [];
  let i = 0;
  const isBreak = (k) => lines[k] === '';
  while (i < lines.length) {
    let end = Math.min(lines.length, i + linesPerPage);
    if (end < lines.length) {
      // widow: the page would end on the first line of a paragraph
      if (isBreak(end - 2) && !isBreak(end - 1) && end - 1 > i + 1) end -= 1;
      // orphan: the next page would begin on the last line of this paragraph
      else if (!isBreak(end - 1) && isBreak(end) === false && isBreak(end + 1) && end - 1 > i + 1) end -= 1;
    }
    pages.push(lines.slice(i, end));
    i = end;
    while (i < lines.length && lines[i] === '') i++;      // eat the break at a page boundary
  }
  return pages.length ? pages : [[]];
}

/**
 * The floor a book's LAST page is balanced up to, in words. RI-UIX05 K1's `p10 >= 80`.
 */
export const TAIL_FLOOR_WORDS = 80;

/**
 * Pagination of a whole book: `paginate`, then the last-page balancing pass that ordinary book
 * typesetting does and that this build did not (RI-UIX05 §A **B8**, "no page begins or ends with
 * a single line of a paragraph where avoidable").
 *
 * WHY. `paginate` fills every page to the brim and lets the remainder fall onto the last one, so
 * the final page of a book is whatever is left. Measured over the shipped corpus at 1920×1080:
 * 324 pages, p10 **62.3** words against K1's floor of 80, with **twelve** books ending on a page
 * under 25 words and one — `the-counting-rhyme` — ending on a page of **three**. A player turns a
 * page to read three words. The round-1 builder concluded from the same measurement that K1 is
 * *unsatisfiable*, because a final page is partial by construction; the round-1 critic showed
 * that inference is wrong, and it is: a compositor does not leave a three-word page, they take
 * lines back off the earlier pages until the tail is respectable.
 *
 * HOW, and it is deliberately the dullest possible method: re-run the SAME `paginate` with a
 * smaller per-page line budget, stopping the moment the page COUNT would change. Fewer lines on
 * the early pages is exactly "pull words back from the preceding pages"; refusing to change the
 * page count is what keeps this a balancing pass rather than a re-flow, and it means the widow
 * and orphan rules above still run — there is one paginator, not two.
 *
 * A one-page book has no tail to balance and is returned untouched.
 */
export function paginateBook(lines, linesPerPage, floorWords = TAIL_FLOOR_WORDS) {
  const first = paginate(lines, linesPerPage);
  if (first.length < 2) return first;
  let best = first;
  for (let cap = linesPerPage - 1; cap >= 2; cap--) {
    if (wordsOn(best[best.length - 1]) >= floorWords) break;
    const cand = paginate(lines, cap);
    if (cand.length !== first.length) break;      // never add or drop a page
    best = cand;
  }
  return best;
}

/** Words on a laid-out page. */
export function wordsOn(pageLines) {
  let n = 0;
  for (const l of pageLines) n += l.split(/\s+/).filter((w) => w.length).length;
  return n;
}

/**
 * Everything RI-UIX05 §A asks about a laid-out page, computed from the layout. `chars_per_line`
 * is the mean over non-empty lines; a full page of a 45-75 character measure lands near 60.
 */
export function pageMetrics(pageLines, faceId, size, lineH, screenH) {
  const nonEmpty = pageLines.filter((l) => l.length);
  const chars = nonEmpty.length ? nonEmpty.reduce((a, l) => a + l.length, 0) / nonEmpty.length : 0;
  return {
    face: faceId,
    words: wordsOn(pageLines),
    lines: pageLines.length,
    chars_per_line: +chars.toFixed(2),
    font_px: +size.toFixed(2),
    leading: +(lineH / size).toFixed(3),
    body_screen_frac: +(size / screenH).toFixed(5),
    cap_em: CAP_EM,
  };
}

/** Write pre-wrapped lines from a baseline. Returns the baseline after the last line. */
export function writeLines(ctx, lines, x, y, faceId, size, lineH, colour, opts) {
  const face = faceOf(faceId);
  let yy = y;
  for (const l of lines) {
    if (l.length) drawText(ctx, l, x, yy, face, size, colour, opts);
    yy += lineH;
  }
  return yy;
}

export { measure, drawText, faceOf };

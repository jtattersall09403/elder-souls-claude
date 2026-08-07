// Setting type: wrapping, measuring, paginating, and the numbers RI-UIX05 §A measures.
//
// Owner: W1-21. This is LAYOUT CORRECTNESS, which RI-UIX05's scope table puts in neither half of
// the visual bifurcation: "a page can be beautifully art-directed (P09 passes) and rendered at 4K
// crispness (F17 passes) and still be 400 words in a 22-character column, which is a layout
// defect". So the bands live here, next to the code that has to hit them, and `pageMetrics()`
// reports them from the layout that was performed rather than from a pixel readback.
'use strict';

import { measure, drawText, faceOf, CAP_EM } from './glyphs.js';

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

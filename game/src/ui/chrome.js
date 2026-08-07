// The furniture every menu screen is built from.
//
// Owner: W1-21. Binding: RI-UIX06 §B, the forbidden UI-kit set, which this file exists to make
// unavailable rather than merely discouraged. There is no `card()`, no `button()`, no
// `tabBar()`, no `modal()` and no `slider()` in here, because G1/G7/G9 forbid all of them and a
// helper with one of those names is how they arrive.
//
// What is here instead:
//   * `screen()`     — a panel of a named material, framed by a root lashing, with a carved
//                      header band. The Morrowind reference (REF-A12b) frames its windows in
//                      carved wood with the SELECTED THING'S NAME in the header; that is the
//                      form being inherited, in this world's materials.
//   * `tagColumn()`  — the categories. A ledger's thumb-index tags cut into the outer edge, in
//                      bone, one per category, the current one carrying a shell inlay. It is
//                      vertical, physical and index-shaped on purpose: a horizontal row of
//                      rectangles with an active underline is G7's tab bar, and the fastest way
//                      to arrive at one is to write a helper called `tabs`.
//   * `row()`        — a list row. Selection is a shell inlay, never a fill lighten and never a
//                      focus ring (G6, A5).
//   * `letterRing()` — the gamepad text entry. RI-UIX04 J7 requires free-text search and the
//                      owner tests on a GameSir X2s; a search field that needs a keyboard is a
//                      surface that is not reachable on a pad, which fails the piece's own
//                      platform requirement whatever RI-UIX04 says.
'use strict';

import { C, Ca, panel, rootLashing, boneRule, shellInlay, chitinPath, idHash } from './theme.js';
import { drawText, faceOf, measure, ellipsise } from './type.js';

/** Screen box, in 1080p units, sized against RI-UIX03 P5's ≤60% of screen area. */
export const BOX = { x: 200, y: 160, w: 1520, h: 780 };   // 57.2% of 1920×1080

/** In-combat opacity. P5 caps it at 55%; 50% leaves the centre 40%×40% half world. */
export const COMBAT_ALPHA = 0.50;
export const CALM_ALPHA = 0.94;

export function screenRect(S) {
  const s = S.s;
  return [BOX.x * s, BOX.y * s, BOX.w * s, BOX.h * s];
}

/**
 * The panel and its frame. Declares ONE element (`panel`) covering the whole screen box, plus
 * one `panel_header`. Everything drawn afterwards declares itself.
 */
export function screen(S, id, title, subtitle, material, alpha) {
  const s = S.s;
  const r = screenRect(S);
  const seed = idHash(id) & 0xffff;
  S.el({
    id: id + '.panel', kind: 'panel', rect: r, opacity: alpha, material,
    meta: { area_frac: +((r[2] * r[3]) / (S.W * S.H)).toFixed(4) },
  }, (c) => {
    panel(c, material, r[0], r[1], r[2], r[3], s, seed, 1);
    rootLashing(c, r[0], r[1], r[2], r[3], s, seed);
  });
  const hh = 54 * s;
  S.el({
    id: id + '.header', kind: 'panel_header',
    rect: [r[0], r[1], r[2], hh], text: title, opacity: alpha,
  }, (c, q) => {
    const f = faceOf('bone'), sz = 22 * s;
    const t = title || '';
    drawText(c, t, q[0] + q[2] / 2 - measure(t, f, sz) / 2, q[1] + 34 * s, f, sz, C('ink'));
    if (subtitle) {
      const f2 = faceOf('ink'), s2 = 15 * s;
      drawText(c, subtitle, q[0] + 26 * s, q[1] + 34 * s, f2, s2, C('ink_soft'));
    }
    boneRule(c, q[0] + 20 * s, q[1] + hh - 4 * s, q[2] - 40 * s, s, seed + 5);
  });
  return { rect: r, inner: [r[0] + 22 * s, r[1] + hh + 10 * s, r[2] - 44 * s, r[3] - hh - 34 * s], seed, alpha };
}

/** A worked-bone divider between columns. Not a 1 px border (G4). */
export function column(S, id, x, y, w, h, alpha) {
  const s = S.s;
  S.el({ id, kind: 'divider', rect: [x - 6 * s, y, 12 * s, h], opacity: alpha }, (c, r) => {
    c.save();
    c.beginPath();
    c.moveTo(r[0] + r[2] / 2, r[1]);
    for (let t = 1; t <= 14; t++) {
      c.lineTo(r[0] + r[2] / 2 + ((t % 2) ? 1.6 : -1.6) * s, r[1] + (r[3] * t) / 14);
    }
    c.strokeStyle = Ca('bone_dim', 0.5); c.lineWidth = 2.4 * s; c.stroke();
    c.restore();
  });
  return { x, y, w, h };
}

/**
 * The category tags: a ledger's thumb index, cut in bone down the outer edge.
 * @param {{id:string,name:string}[]} tags
 */
export function tagColumn(S, id, x, y, w, tags, selected, alpha, focused) {
  const s = S.s, th = 46 * s, gap = 5 * s;
  tags.forEach((t, i) => {
    const yy = y + i * (th + gap);
    const on = i === selected;
    S.el({
      id: `${id}.${t.id}`, kind: 'category',
      rect: [x, yy, w, th], text: t.name, focused: on && focused, opacity: alpha,
      meta: { count: t.count === undefined ? null : t.count },
    }, (c, r) => {
      // the tag itself: a bone lug that projects from the edge, never a rectangle
      c.save();
      c.beginPath();
      c.moveTo(r[0], r[1] + 3 * s);
      c.lineTo(r[0] + r[2] - 12 * s, r[1]);
      c.quadraticCurveTo(r[0] + r[2], r[1] + r[3] / 2, r[0] + r[2] - 12 * s, r[1] + r[3]);
      c.lineTo(r[0], r[1] + r[3] - 3 * s);
      c.closePath();
      c.fillStyle = on ? Ca('bone', 0.95) : Ca('bone_dim', 0.42);
      c.fill();
      c.strokeStyle = Ca('root', 0.75); c.lineWidth = 1.8 * s; c.stroke();
      c.restore();
      if (on) shellInlay(c, r[0] + 2 * s, r[1] + r[3] - 7 * s, r[2] - 18 * s, 4 * s, s, idHash(t.id));
      const f = faceOf('bone'), sz = 13 * s;
      drawText(c, ellipsise(t.name, f, sz, r[2] - 20 * s), r[0] + 8 * s, r[1] + r[3] * 0.62, f, sz,
        on ? C('ink') : C('ink_soft'));
    });
  });
  return tags.length * (th + gap);
}

/**
 * One row of a list. `cols` is [{text, w, align, face, size, colour}].
 * Selection is a shell inlay under the row: a material catching the light, not a hover fill.
 */
export function row(S, id, kind, x, y, w, h, cols, selected, alpha, meta) {
  return S.el({
    id, kind,
    rect: [x, y, w, h],
    text: cols.map((c) => c.text).filter((t) => t !== null && t !== undefined && t !== '').join('  '),
    focused: !!selected, opacity: alpha, meta,
  }, (c, r) => {
    const s = S.s;
    if (selected) shellInlay(c, r[0], r[1], r[2], r[3], s, idHash(id));
    let cx = r[0] + 8 * s;
    for (const col of cols) {
      const f = faceOf(col.face || 'ink');
      const sz = (col.size || 17) * s;
      const t = ellipsise(String(col.text === null || col.text === undefined ? '' : col.text), f, sz, col.w * s - 10 * s);
      const wpx = measure(t, f, sz);
      const tx = col.align === 'right' ? cx + col.w * s - 10 * s - wpx
        : col.align === 'centre' ? cx + (col.w * s) / 2 - wpx / 2 : cx;
      drawText(c, t, tx, r[1] + h * 0.70, f, sz, C(col.colour || (selected ? 'ink' : 'ink_soft')));
      cx += col.w * s;
    }
  });
}

/** A scroll extent: how much there is and where you are in it (RI-UIX04 J10). */
export function extent(S, id, x, y, w, h, from, shown, total, alpha) {
  return S.el({
    id, kind: 'scroll_extent', rect: [x, y, w, h], opacity: alpha,
    text: null, meta: { from, shown, total },
  }, (c, r) => {
    const s = S.s;
    boneRule(c, r[0] + r[2] / 2 - 2 * s, r[1], 4 * s, s, 17);
    c.save();
    c.beginPath();
    c.moveTo(r[0] + r[2] / 2, r[1]); c.lineTo(r[0] + r[2] / 2, r[1] + r[3]);
    c.strokeStyle = Ca('bone_dim', 0.35); c.lineWidth = 3 * s; c.stroke();
    if (total > 0) {
      const a = r[1] + (r[3] * from) / total;
      const b = r[1] + (r[3] * Math.min(total, from + shown)) / total;
      c.beginPath(); c.moveTo(r[0] + r[2] / 2, a); c.lineTo(r[0] + r[2] / 2, Math.max(b, a + 6 * s));
      c.strokeStyle = Ca('bone', 0.9); c.lineWidth = 6 * s; c.lineCap = 'round'; c.stroke();
    }
    c.restore();
  });
}

/** A line of prose under a screen, telling you what the buttons do. Never numeric. */
export function hint(S, id, x, y, w, text, alpha) {
  return S.el({ id, kind: 'hint', rect: [x, y, w, 26 * (S.s)], text, opacity: alpha }, (c, r) => {
    const f = faceOf('ink'), sz = 14 * S.s;
    drawText(c, text, r[0], r[1] + 18 * S.s, f, sz, C('ink_soft'));
  });
}

/** The 36 glyphs of the gamepad letter ring, in the order a d-pad walks them. */
export const RING = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789'.split('');
export const RING_COLS = 8;

/**
 * The letter ring. Six rows of eight bone tiles; d-pad moves, `interact` adds, `roll` deletes.
 * This is what makes search reachable with no keyboard attached.
 */
export function letterRing(S, id, x, y, w, h, cursor, query, alpha) {
  const s = S.s;
  const cw = w / RING_COLS, ch = h / Math.ceil(RING.length / RING_COLS);
  S.el({
    id: id + '.query', kind: 'search_field', rect: [x, y - 40 * s, w, 34 * s],
    text: query, opacity: alpha,
  }, (c, r) => {
    boneRule(c, r[0], r[1] + r[3] - 4 * s, r[2], s, 991);
    const f = faceOf('ink'), sz = 19 * s;
    drawText(c, (query || '') + '▁'.replace('▁', ''), r[0] + 4 * s, r[1] + r[3] - 12 * s, f, sz, C('ink'));
    // the caret is a cut mark, not a blinking bar: nothing in this interface animates on a clock
    const qw = measure(query || '', f, sz);
    c.beginPath();
    c.moveTo(r[0] + 6 * s + qw, r[1] + r[3] - 8 * s);
    c.lineTo(r[0] + 14 * s + qw, r[1] + r[3] - 8 * s);
    c.strokeStyle = C('ink'); c.lineWidth = 2.4 * s; c.stroke();
  });
  RING.forEach((ch2, i) => {
    const cxi = i % RING_COLS, cyi = (i / RING_COLS) | 0;
    const rx = x + cxi * cw, ry = y + cyi * ch;
    const on = i === cursor;
    S.el({
      id: `${id}.k${i}`, kind: 'list_row', rect: [rx, ry, cw - 3 * s, ch - 3 * s],
      text: ch2 === ' ' ? '(space)' : ch2, focused: on, opacity: alpha,
    }, (c, r) => {
      chitinPath(c, r[0], r[1], r[2], r[3], s, 6100 + i);
      c.fillStyle = on ? Ca('bone', 0.9) : Ca('bone_dim', 0.25); c.fill();
      const f = faceOf('bone'), sz = 15 * s;
      const t = ch2 === ' ' ? '—' : ch2;
      drawText(c, t, r[0] + r[2] / 2 - measure(t, f, sz) / 2, r[1] + r[3] * 0.68, f, sz, on ? C('ink') : C('ink_soft'));
    });
  });
}

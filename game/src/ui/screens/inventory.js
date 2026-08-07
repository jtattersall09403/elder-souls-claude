// The inventory, and the container screen that is the same screen twice.
//
// Owner: W1-21. Judged by RI-UIX03 §B/§D.
//
// It is a LIST, not a grid of icons, and that is the item's own instruction: §D N1 forbids a 3D
// inspection turntable as the primary view "because the list is the Morrowind object", and C6
// requires sorting by value-per-weight, "the specific Morrowind affordance: it is how you decide
// what to leave behind". A grid cannot show weight, value and value-per-weight in a column you
// can sort. So: name, weight, value, value-per-weight, four columns, and the fourth is the one
// the loot economy has a shape because of.
//
// What is deliberately absent, each because §D names it:
//   N2 rarity colours — every row is drawn in the same two inks, and `ui-census` counts the hues
//   N3 comparison arrows — nothing on this screen compares an item to the equipped one
//   N4 best-in-slot / N5 auto-equip — no element of either kind exists in the vocabulary
//   C9 no auto-sort-and-junk — "take all" exists on a container; nothing decides what is junk
'use strict';

import { C, Ca, boneRule, bonePip, panel, idHash } from '../theme.js';
import { screen, column, tagColumn, row, extent, hint, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure, wrap, writeLines, ellipsise } from '../type.js';

export const SORTS = [
  { id: 'name', label: 'name' },
  { id: 'weight', label: 'weight' },
  { id: 'value', label: 'value' },
  { id: 'value_per_weight', label: 'value for weight' },
];

export const CATEGORIES = ['all', 'weapon', 'armour', 'clothing', 'potion', 'ingredient', 'book', 'tool', 'misc', 'quest'];

const ROWS = 15;

/** @param {object} m the inventory model assembled by ui/system.js */
export function drawInventory(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sel = m.rows[m.rowIdx] || null;
  const sc = screen(S, 'inventory', sel ? sel.name : 'Carried', m.placeName || null, 'reed', alpha);
  const [ix, iy, iw, ih] = sc.inner;

  // ---- left: encumbrance, the tags, the sort, and gold -----------------------------------
  const colW = 148 * s;
  encumbrance(S, ix, iy, colW, m, alpha);
  const tags = CATEGORIES.map((id) => ({
    id, name: id === 'all' ? 'All' : id[0].toUpperCase() + id.slice(1),
    count: m.counts[id] || 0,
  }));
  tagColumn(S, 'inventory.cat', ix, iy + 72 * s, colW, tags, m.tagIdx, alpha, m.col === 0);
  const sortY = iy + 72 * s + tags.length * 51 * s + 8 * s;
  S.el({
    id: 'inventory.sort', kind: 'category',
    rect: [ix, sortY, colW, 42 * s], text: 'sorted by ' + SORTS[m.sortIdx].label,
    focused: m.col === 0 && m.tagIdx === tags.length, opacity: alpha,
  }, (c, r) => {
    boneRule(c, r[0], r[1] + 4 * s, r[2], s, 55);
    const f = faceOf('ink'), sz = 13 * s;
    drawText(c, 'sorted by', r[0] + 2 * s, r[1] + 22 * s, f, sz, C('ink_soft'));
    drawText(c, SORTS[m.sortIdx].label, r[0] + 2 * s, r[1] + 38 * s, faceOf('bone'), 14 * s, C('ink'));
  });
  // C10: gold is a number, never an item with a weight.
  S.el({
    id: 'inventory.gold', kind: 'gold',
    rect: [ix, iy + ih - 34 * s, colW, 30 * s], text: `${m.gold} gold`, opacity: alpha,
  }, (c, r) => {
    boneRule(c, r[0], r[1], r[2], s, 71);
    drawText(c, String(m.gold), r[0] + 2 * s, r[1] + 24 * s, faceOf('bone'), 19 * s, C('ink'));
    drawText(c, 'gold', r[0] + 4 * s + measure(String(m.gold), faceOf('bone'), 19 * s), r[1] + 24 * s,
      faceOf('ink'), 14 * s, C('ink_soft'));
  });

  // ---- centre: the list --------------------------------------------------------------------
  const lx = ix + colW + 26 * s, lw = 700 * s;
  column(S, 'inventory.rule1', lx - 14 * s, iy, 2 * s, ih, alpha);
  listHeader(S, 'inventory', lx, iy, lw, alpha);
  const win = windowOf(m.rows.length, m.rowIdx, ROWS);
  const rowH = 32 * s;
  for (let i = win.from; i < win.to; i++) {
    const it = m.rows[i];
    row(S, 'inventory.row.' + it.id, 'list_row', lx, iy + 34 * s + (i - win.from) * rowH, lw, rowH, [
      { text: it.equipped ? '— ' + it.name : it.name, w: 330 },
      { text: it.count > 1 ? '×' + it.count : '', w: 46, align: 'right', face: 'bone', size: 14 },
      { text: fmt(it.weight), w: 100, align: 'right', face: 'bone', size: 15 },
      { text: it.value_gold ? String(it.value_gold) : '—', w: 110, align: 'right', face: 'bone', size: 15 },
      { text: it.weight > 0 ? fmt(it.value_gold / it.weight) : '—', w: 110, align: 'right', face: 'bone', size: 15 },
    ], i === m.rowIdx && m.col === 1, alpha, {
      item_id: it.id, category: it.category, weight: it.weight, value_gold: it.value_gold,
      equipped: !!it.equipped, stolen: !!it.stolen,
    });
  }
  extent(S, 'inventory.extent', lx + lw + 6 * s, iy + 34 * s, 12 * s, ih - 60 * s, win.from, ROWS, m.rows.length, alpha);

  // ---- right: the item, in full ------------------------------------------------------------
  const dx = lx + lw + 34 * s, dw = ix + iw - dx;
  column(S, 'inventory.rule2', dx - 16 * s, iy, 2 * s, ih, alpha);
  detail(S, 'inventory.detail', dx, iy, dw, ih, sel, alpha, m.col === 2, S);

  hint(S, 'inventory.hint', ix, iy + ih + 4 * s, iw,
    m.inCombat
      ? 'The fight has not stopped. Equipping takes time you are standing still for.'
      : 'Left and right change column. Up and down move. Confirm to equip, read or use.',
    alpha);
}

/** The container screen: the same list twice, take and put (RI-UIX03 C8). */
export function drawContainer(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sc = screen(S, 'container', m.containerName || 'Container', m.placeName || null, 'clay', alpha);
  const [ix, iy, iw, ih] = sc.inner;
  const half = (iw - 40 * s) / 2;
  const sides = [
    { id: 'mine', title: 'Carried', rows: m.rows, idx: m.rowIdx, x: ix },
    { id: 'theirs', title: m.containerName || 'Container', rows: m.containerRows, idx: m.otherIdx, x: ix + half + 40 * s },
  ];
  for (const side of sides) {
    const on = (side.id === 'mine') === (m.side === 0);
    S.el({
      id: `container.${side.id}.head`, kind: 'panel_header',
      rect: [side.x, iy, half, 28 * s], text: side.title, opacity: alpha, focused: on,
    }, (c, r) => {
      drawText(c, side.title, r[0], r[1] + 20 * s, faceOf('bone'), 16 * s, on ? C('ink') : C('ink_soft'));
      boneRule(c, r[0], r[1] + 26 * s, r[2], s, idHash(side.id));
    });
    const win = windowOf(side.rows.length, side.idx, ROWS);
    for (let i = win.from; i < win.to; i++) {
      const it = side.rows[i];
      row(S, `container.${side.id}.row.${it.id}`, 'list_row',
        side.x, iy + 34 * s + (i - win.from) * 32 * s, half, 32 * s, [
          { text: it.name, w: 300 },
          { text: fmt(it.weight), w: 90, align: 'right', face: 'bone', size: 15 },
          { text: it.value_gold ? String(it.value_gold) : '—', w: 90, align: 'right', face: 'bone', size: 15 },
        ], on && i === side.idx, alpha, { item_id: it.id, side: side.id });
    }
  }
  hint(S, 'container.hint', ix, iy + ih + 4 * s, iw,
    'Confirm moves one thing across. There is no button that decides what is worth keeping.', alpha);
}

// ---- pieces ------------------------------------------------------------------------------

/**
 * C3: current / maximum load as a NUMBER and a BAR, on the screen at all times. C4 is the
 * consequence and lives in the simulation; what is shown here is the threshold you are near,
 * marked in bone, so the decision is legible before you make it rather than after.
 */
function encumbrance(S, x, y, w, m, alpha) {
  const s = S.s;
  S.el({
    id: 'inventory.encumbrance', kind: 'encumbrance',
    rect: [x, y, w, 60 * s], fill: m.loadMax ? m.load / m.loadMax : 0,
    text: `${fmt(m.load)} / ${fmt(m.loadMax)}`, opacity: alpha,
    meta: { load: m.load, max: m.loadMax, tier: m.burdenTier },
  }, (c, r) => {
    const f = faceOf('bone'), sz = 17 * s;
    const t = `${fmt(m.load)} / ${fmt(m.loadMax)}`;
    drawText(c, t, r[0] + 2 * s, r[1] + 18 * s, f, sz, C('ink'));
    const by = r[1] + 28 * s, bh = 11 * s;
    c.fillStyle = C('parchment'); c.fillRect(r[0], by, r[2], bh);
    const frac = Math.max(0, Math.min(1, m.loadMax ? m.load / m.loadMax : 0));
    c.fillStyle = C(frac > 1 - 1e-9 ? 'blood' : 'reed_dark');
    c.fillRect(r[0], by, r[2] * frac, bh);
    for (const b of [0.5, 0.8]) {
      c.beginPath(); c.moveTo(r[0] + r[2] * b, by); c.lineTo(r[0] + r[2] * b, by + bh);
      c.strokeStyle = Ca('bone_dim', 0.9); c.lineWidth = 1.6 * s; c.stroke();
    }
    drawText(c, m.burdenTier, r[0] + 2 * s, r[1] + 55 * s, faceOf('ink'), 13 * s, C('ink_soft'));
  });
}

function listHeader(S, id, x, y, w, alpha) {
  const s = S.s;
  S.el({ id: id + '.cols', kind: 'divider', rect: [x, y, w, 30 * s], opacity: alpha }, (c, r) => {
    const f = faceOf('bone'), sz = 12 * s;
    const cols = [['', 330], ['', 46], ['weight', 100], ['gold', 110], ['for weight', 110]];
    let cx = r[0] + 8 * s;
    for (const [t, cw] of cols) {
      if (t) drawText(c, t, cx + cw * s - 10 * s - measure(t, f, sz), r[1] + 20 * s, f, sz, C('ink_soft'));
      cx += cw * s;
    }
    boneRule(c, r[0], r[1] + 26 * s, r[2], s, 33);
  });
}

/** C7: name, weight, value, condition, and the FULL description — unabbreviated, untruncated. */
function detail(S, id, x, y, w, h, it, alpha, focused) {
  const s = S.s;
  S.el({
    id, kind: 'detail_panel', rect: [x, y, w, h], opacity: alpha, focused,
    text: it ? it.description : null,
    meta: it ? { item_id: it.id, weight: it.weight, value_gold: it.value_gold, condition: it.condition } : null,
  }, (c, r) => {
    if (!it) {
      drawText(c, 'nothing selected', r[0], r[1] + 24 * s, faceOf('ink'), 15 * s, C('ink_soft'));
      return;
    }
    const f = faceOf('ink'), fb = faceOf('bone');
    let yy = r[1] + 26 * s;
    drawText(c, it.name, r[0], yy, faceOf('bone'), 20 * s, C('ink'));
    yy += 14 * s;
    boneRule(c, r[0], yy, r[2], s, 909);
    yy += 26 * s;
    const facts = [
      ['weight', it.weight > 0 ? fmt(it.weight) : 'nothing'],
      ['gold', it.value_gold ? String(it.value_gold) : 'not for sale'],
    ];
    if (it.condition !== undefined && it.condition !== null) facts.push(['condition', pct(it.condition)]);
    if (it.stolen) facts.push(['', 'stolen']);
    for (const [k, v] of facts) {
      if (k) drawText(c, k, r[0], yy, f, 13 * s, C('ink_soft'));
      drawText(c, v, r[0] + 96 * s, yy, fb, 15 * s, it.stolen && !k ? C('blood') : C('ink'));
      yy += 22 * s;
    }
    yy += 10 * s;
    const size = 16 * s, lh = size * 1.48;
    const lines = wrap(it.description, f, size, r[2]);
    writeLines(c, lines, r[0], yy, 'ink', size, lh, C('ink'));
    yy += lines.length * lh + 16 * s;
    if (it.readable) drawText(c, 'It can be read.', r[0], yy, f, 14 * s, C('ink_soft'));
    if (it.equipped) drawText(c, 'In hand.', r[0], yy + 20 * s, f, 14 * s, C('ink_soft'));
  });
}

function windowOf(n, sel, size) {
  if (n <= size) return { from: 0, to: n };
  let from = sel - ((size / 2) | 0);
  if (from < 0) from = 0;
  if (from + size > n) from = n - size;
  return { from, to: from + size };
}

function fmt(v) {
  const n = Number(v) || 0;
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1);
}
function pct(v) { return String(Math.round(Number(v) * 100)) + ' in 100'; }

/** The comparator set. `value_per_weight` is the one C6 names and it is one line. */
export function sortRows(rows, sortId) {
  const by = {
    name: (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    weight: (a, b) => b.weight - a.weight,
    value: (a, b) => b.value_gold - a.value_gold,
    value_per_weight: (a, b) => (b.weight ? b.value_gold / b.weight : -1) - (a.weight ? a.value_gold / a.weight : -1),
  };
  return rows.slice().sort(by[sortId] || by.name);
}

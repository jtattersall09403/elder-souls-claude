// The inventory, and the container screen that is the same screen twice.
//
// Owner: W1-21; T4-r2 for everything under RI-UIX09.
// Judged by RI-UIX03 §B/§D and RI-UIX09 §B (P1, P2, P4, P5).
//
// It is a LIST, not a grid of icons, and that is the item's own instruction: §D N1 forbids a 3D
// inspection turntable as the primary view "because the list is the Morrowind object", and C6
// requires sorting by value-per-weight, "the specific Morrowind affordance: it is how you decide
// what to leave behind". A grid cannot show weight, value and value-per-weight in a column you
// can sort. So: name, weight, value, value-per-weight, four columns, and the fourth is the one
// the loot economy has a shape because of.
//
// ---------------------------------------------------------------------------------------------
// WHAT T4 ROUND 2 CHANGED, AND THE MEASUREMENT IT CHANGED IT AGAINST
// ---------------------------------------------------------------------------------------------
//
// The round-1 critic measured this screen populated (`states/ui-journal.json`, 44 carried records)
// and reported **zero pictorial elements inside the panel** — the declared kinds were `list_row`
// ×15, `category` ×11, `detail_panel`, `encumbrance`, `gold`, `divider` ×3, `scroll_extent`,
// `hint`, and the vocabulary `icon | item_icon | doll | portrait | glyph_object` returned nothing.
// Panel fill on the panel's own rect was **0.207** against Morrowind's **0.61**.
//
// A list being the right STRUCTURE (N1, C6) and the screen being a wall of drawn things are not in
// tension — `REF-A12b-inventory__mw-15538700.jpg` is a list of objects with a dressed figure beside
// it, and the four numbers Morrowind puts on that window are stack counts. So the list stays and
// three things are added, each answering one of RI-UIX09's rows:
//
//   P1  every row leads with a drawn depiction of the object it names (`item_icon`, 28 px)
//   P2  the equipped figure, at the left, wearing what is equipped (`doll`) — Morrowind's own
//       paper doll, and P2's hard fail is "equipped state is legible only as text", which is
//       exactly what an `— ` prefix on a row name is
//   P5  the detail panel LEADS WITH THE THING, as `REF-A12b-tooltip__*` does, and then says its
//       name, weight, value and condition
//
// Every one of them draws through `ui/icons.js`. There is no drawing code for an object in this
// file, and there must not be: the reuse is the point (OWNER-DIRECTIVES-2026-08-14 §3).
//
// What is deliberately absent, each because §D names it:
//   N2 rarity colours — every row is drawn in the same two inks, and `ui-census` counts the hues
//   N3 comparison arrows — nothing on this screen compares an item to the equipped one
//   N4 best-in-slot / N5 auto-equip — no element of either kind exists in the vocabulary
//   C9 no auto-sort-and-junk — "take all" exists on a container; nothing decides what is junk
'use strict';

import { C, Ca, boneRule, bonePip, panel, chitinPath, idHash } from '../theme.js';
import { screen, screenRect, column, tagColumn, row, extent, hint, hintLines, ink, inkDim, accent, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure, wrap, writeLines, ellipsise, BODY } from '../type.js';
import { itemIcon, drawDoll, drawObject, shapeFor } from '../icons.js';

export const SORTS = [
  { id: 'name', label: 'name' },
  { id: 'weight', label: 'weight' },
  { id: 'value', label: 'value' },
  { id: 'value_per_weight', label: 'value for weight' },
];

export const CATEGORIES = ['all', 'weapon', 'armour', 'clothing', 'potion', 'ingredient', 'book', 'tool', 'misc', 'quest'];

// The window shows 18 rows, not 15. Round 1's screen used 15 at 32 units and left 194 units of
// the 674-unit inner box empty below the last one — a third of the list column carrying nothing.
// Morrowind's window is sized to its contents; ours is a fixed 1520×780 box (RI-UIX03 P5 caps the
// panel at 60% of the frame), so the honest equivalent is to fill it.
const ROWS = 18;
const ROW_H = 34;
const ICON = 28;

/**
 * The column grid, in 1080p units, over the 1476-unit inner box.
 *
 * Written down as one object rather than as a chain of `+ 26 * s` because round 1's layout was a
 * chain and the empty third of the screen was invisible in it.
 */
const COLS = { doll: 200, gapA: 20, tags: 132, gapB: 24, list: 640, gapC: 30 };

/** @param {object} m the inventory model assembled by ui/system.js */
export function drawInventory(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sel = m.rows[m.rowIdx] || null;
  // T4 round 3, RI-UIX10 O3 — the equip commitment, while it is running. Non-null only in a
  // fight: out of combat `Engine._applyUIPending()` resolves the swap on the press, because the
  // world is paused there and 30 frames off a stopped clock can never elapse. See that method's
  // header for the seam ruling and what would overturn it.
  const ep = m.equipPending || null;
  const epRow = ep ? (m.rows.find((r) => r.id === ep.item) || null) : null;
  const epName = epRow ? epRow.name : (ep ? ep.item : null);
  const sc = screen(S, 'inventory', sel ? sel.name : 'Carried', m.placeName || null, 'reed', alpha);
  const [ix, iy, iw, ih] = sc.inner;

  // ---- column A: what you weigh, what you are wearing, what you are carrying it in --------
  const dollW = COLS.doll * s;
  encumbrance(S, ix, iy, dollW, m, alpha);
  // RI-UIX09 P2. The figure, wearing the objects — Morrowind's own arrangement, measured off
  // `REF-A12b-inventory__mw-15538700.jpg`: encumbrance bar at the top of the left column, the
  // dressed body under it, the armour reading at its foot.
  drawDoll(S, 'inventory.doll', ix, iy + 68 * s, dollW, 400 * s, m.equipped || {}, alpha);
  // What is on the figure, named and drawn, with each thing's condition under it. Morrowind puts
  // `Armor: 42` at the foot of its doll; this is the same place answering the same question, and
  // it is the one place in the game where "how worn is the thing in my hand" is legible at rest.
  const wornSlots = ['head', 'body', 'legs', 'feet', 'hands', 'right', 'left']
    .filter((k) => (m.equipped || {})[k]).slice(0, 4);
  S.el({
    id: 'inventory.worn', kind: 'divider',
    rect: [ix, iy + 476 * s, dollW, 24 * s], text: null, opacity: alpha,
    meta: { worn_count: wornSlots.length, slots: wornSlots },
  }, (c, r) => {
    boneRule(c, r[0], r[1] + 2 * s, r[2], s, 313);
    drawText(c, wornSlots.length === 1 ? 'worn and held' : 'worn and held',
      r[0] + 2 * s, r[1] + 20 * s, faceOf('ink'), 13 * s, inkDim());
  });
  wornSlots.forEach((k, i) => {
    const it = m.equipped[k];
    const wy = iy + (502 + i * 30) * s;
    itemIcon(S, 'inventory.worn.' + k, ix, wy, 26 * s, 26 * s, it, alpha,
      { condition: it.condition === null || it.condition === undefined ? null : it.condition });
    S.el({
      id: 'inventory.wornrow.' + k, kind: 'list_row',
      rect: [ix + 30 * s, wy, dollW - 30 * s, 26 * s], text: it.name, opacity: alpha,
      meta: { item_id: it.id, slot: k, equipped: true },
    }, (c, r) => {
      const f = faceOf('ink'), sz = 13 * s;
      drawText(c, ellipsise(it.name, f, sz, r[2] - 4 * s), r[0], r[1] + 18 * s, f, sz, ink());
    });
  });
  const sortY = iy + 574 * s;
  S.el({
    id: 'inventory.sort', kind: 'category',
    rect: [ix, sortY, dollW, 42 * s], text: 'sorted by ' + SORTS[m.sortIdx].label,
    focused: m.col === 0 && m.tagIdx === CATEGORIES.length, opacity: alpha,
  }, (c, r) => {
    boneRule(c, r[0], r[1] + 4 * s, r[2], s, 55);
    const f = faceOf('ink'), sz = 13 * s;
    drawText(c, 'sorted by', r[0] + 2 * s, r[1] + 22 * s, f, sz, inkDim());
    drawText(c, SORTS[m.sortIdx].label, r[0] + 2 * s, r[1] + 38 * s, faceOf('bone'), 14 * s, ink());
  });
  // C10: gold is a number, never an item with a weight. It is drawn as a small heap of struck
  // coin beside the numeral — the coin is a picture of the currency, not an inventory record, and
  // `gold` stays the element's kind so C10's census reads exactly what it read before.
  S.el({
    id: 'inventory.gold', kind: 'gold',
    rect: [ix, iy + ih - 40 * s, dollW, 36 * s], text: `${m.gold} gold`, opacity: alpha,
  }, (c, r) => {
    boneRule(c, r[0], r[1], r[2], s, 71);
    drawObject(c, 'coin', r[0], r[1] + 6 * s, 30 * s, 30 * s, s, 7717, null);
    drawText(c, String(m.gold), r[0] + 36 * s, r[1] + 28 * s, faceOf('bone'), 19 * s, ink());
    drawText(c, 'gold', r[0] + 40 * s + measure(String(m.gold), faceOf('bone'), 19 * s), r[1] + 28 * s,
      faceOf('ink'), 14 * s, inkDim());
  });

  // ---- column B: the categories, still a thumb index and still not a tab bar (G7) ---------
  const tx = ix + (COLS.doll + COLS.gapA) * s, tagW = COLS.tags * s;
  const tags = CATEGORIES.map((id) => ({
    id, name: id === 'all' ? 'All' : id[0].toUpperCase() + id.slice(1),
    count: m.counts[id] || 0,
  }));
  tagColumn(S, 'inventory.cat', tx, iy, tagW, tags, m.tagIdx, alpha, m.col === 0);

  // ---- column C: the list ------------------------------------------------------------------
  const lx = ix + (COLS.doll + COLS.gapA + COLS.tags + COLS.gapB) * s, lw = COLS.list * s;
  column(S, 'inventory.rule1', lx - 14 * s, iy, 2 * s, ih, alpha);
  listHeader(S, 'inventory', lx, iy, lw, alpha);
  const win = windowOf(m.rows.length, m.rowIdx, ROWS);
  const rowH = ROW_H * s;
  for (let i = win.from; i < win.to; i++) {
    const it = m.rows[i];
    const ry = iy + 34 * s + (i - win.from) * rowH;
    row(S, 'inventory.row.' + it.id, 'list_row', lx, ry, lw, rowH, [
      // The equipped mark is now the DOLL and the drawn dash below, not a `— ` glued to the name.
      { text: it.name, w: 286, size: BODY.screen },
      { text: it.count > 1 ? '×' + it.count : '', w: 40, align: 'right', face: 'bone', size: 14 },
      { text: fmt(it.weight), w: 88, align: 'right', face: 'bone', size: 15 },
      { text: it.value_gold ? String(it.value_gold) : '—', w: 88, align: 'right', face: 'bone', size: 15 },
      { text: it.weight > 0 ? fmt(it.value_gold / it.weight) : '—', w: 88, align: 'right', face: 'bone', size: 15 },
    ], i === m.rowIdx && m.col === 1, alpha, {
      item_id: it.id, category: it.category, weight: it.weight, value_gold: it.value_gold,
      equipped: !!it.equipped, stolen: !!it.stolen,
      // T4 round 3, RI-UIX10 O3. The row the press landed on says so while the commitment runs,
      // so `getUIState()`'s own census answers "did anything change" rather than a critic having
      // to infer it from the absence of a change.
      equipping: !!(ep && ep.item === it.id),
      equip_remaining_f: ep && ep.item === it.id ? ep.remaining_f : null,
    }, ICON + 10);
    // RI-UIX09 P1. The row's own depiction, ≥ 28 CSS px at 1080p, carrying the item's condition
    // as RI-UIX07 W4's mark — the same call the quick slots and the container columns make.
    itemIcon(S, 'inventory.icon.' + it.id, lx + 4 * s, ry + 3 * s, ICON * s, ICON * s, it, alpha,
      { condition: it.condition === null || it.condition === undefined ? null : it.condition });
  }
  extent(S, 'inventory.extent', lx + lw + 6 * s, iy + 34 * s, 12 * s, ih - 60 * s, win.from, ROWS, m.rows.length, alpha);

  // ---- column D: the item, in full ----------------------------------------------------------
  const dx = lx + lw + COLS.gapC * s, dw = ix + iw - dx;
  column(S, 'inventory.rule2', dx - 16 * s, iy, 2 * s, ih, alpha);
  detail(S, 'inventory.detail', dx, iy, dw, ih, sel, alpha, m.col === 2, ep && sel && ep.item === sel.id ? ep : null);

  hint(S, 'inventory.hint', ix, iy + ih + 4 * s, iw,
    // T4 round 3, RI-UIX10 O3. THE FIRST BRANCH IS NEW and it is the narration OP7 failed for
    // want of: an accepted press that shows nothing is indistinguishable from a dead control, and
    // in a fight `RI-UIX03` P7 REQUIRES the swap to take 30 frames, so the only honest fix is to
    // say so while they run. Out of combat there is no branch to take here — the world is paused,
    // the commitment is unpayable, and `Engine._applyUIPending()` resolves the swap on the press.
    ep
      ? `Putting on the ${String(epName || 'it').toLowerCase()}. You are standing still for it.`
      : m.inCombat
        ? 'The fight has not stopped. Equipping takes time you are standing still for.'
      // W1-MAP-DEFECTS. The second sentence is the owner's defect, in words: they could not open
      // the map, because nothing in the game had ever mentioned that the pages turn or that a map
      // is one of them. It names the ACTION and never the key (RI-JRN03 DS5) — `swap` is one of
      // the sixteen closed action names, and it is what the pad's shoulder, the mouse wheel and
      // the touch drawer's arrows all are.
        : 'Left and right change column. Up and down move. Confirm to equip, read or use. '
          + 'Swap turns the page: the map, the journal, your case, your spells.',
    alpha);
}

/**
 * The container screen: the same list twice, take and put (RI-UIX03 C8).
 *
 * ---- THE `undefined` HEADER, AND WHY THE `|| 'Container'` BELOW WAS NOT THE FIX ----
 *
 * Round 1 photographed this screen rendering the literal string `undefined` twice — as the panel
 * title and again as the container-side column header (`crops/container-undefined-header-4x.png`,
 * `panel_header [200,160,1520,54] "undefined"` and `[980,224,718,28] "undefined"`). The critic
 * called it "one line of data flow, and the most visible defect in the piece", and it was: the
 * fallbacks below were already written and could never fire, because
 * `Engine.openContainer(name, contents)` did `name: String(name)` and **`String(undefined)` is the
 * five-letter TRUTHY STRING `"undefined"`**, so `m.containerName || 'Container'` chose it.
 *
 * Fixed at the source in `engine.js` (`openContainer` now stores `null` for an absent name) AND
 * hardened here, because a UI that can be handed a bad string from a second call site should not
 * print it. `containerTitle()` refuses the three shapes that have ever produced this — `null`, the
 * empty string, and the words `"undefined"`/`"null"` arriving as text — and falls back to the
 * container's `kind`, then to the word `Container`. Two guards for one defect, and both arms are
 * exercised by `tools/ui/t4-r2-measure.mjs`'s `--container-name` sweep so neither is inert.
 */
export function drawContainer(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const title = containerTitle(m.containerName, m.containerKind);
  const containerHint = 'Confirm moves one thing across. There is no button that decides what is worth keeping.';
  // T4 round 5 (`ARBITRATION` S58). Measured 457px at 14px body against a 480-wide box's 436px
  // inner width — round 4 drew it as one unwrapped line and it was cut mid-word at the panel edge
  // with no ellipsis (`…what is worth keep`). See `chrome.js` `hintLines()`/`hint()`.
  const fl = hintLines(containerHint, screenRect(S, 'container')[2] - 44 * s, s);
  const sc = screen(S, 'container', title, m.placeName || null, 'clay', alpha, fl);
  const [ix, iy, iw, ih] = sc.inner;
  const half = (iw - 40 * s) / 2;
  // THE ROWS STOP AT EIGHT AND THE BOTTOM THIRD BECOMES THE THING YOU ARE ABOUT TO MOVE.
  //
  // Round 1 measured this screen at **0.033** fill, the emptiest panel in the build — two lists of
  // names on a clay ground with nothing else on it, and, more to the point, **no way to see what a
  // thing is before you take it**. You could read a name and a weight and that was all; C7's
  // detail panel exists on the inventory and had no counterpart here. So eight rows a side, and
  // the band underneath carries the selected record exactly as the inventory's does: the object,
  // drawn, then name, weight, gold, condition and the full description.
  //
  // T4 round 4, GAP-W1-ui-panel-is-a-fixed-box. 12 -> 8 -> 4, over two measured passes. T4-r3
  // measured this screen's own D2 at 0.0572, the worst hard fail of the five; the first pass (8
  // rows, 650×500 box) still hard-failed at 0.0953, because the SELECTED-ITEM DEPICTION plate
  // (`Math.min(140, bh-20)` below) is worth far more matter than any one row — it fell from a
  // full 140×140 plate (19,600 px²) to 50×50 (2,500 px²) when eight rows' worth of list height
  // left the band only 70 px tall. Four rows a side gives the band enough height to recover most
  // of that. Both sides still scroll past 4 (`windowOf` + `extent`, unchanged below); a 44-item
  // carried list was never going to fit on one page at any panel size, fixed box or not.
  const CROWS = 4;
  // T4 round 5. The 2-line hint (`fl` above) makes `screen()` reserve 20 more units in its footer,
  // which would otherwise come straight out of `ih` and shrink the selected-item depiction plate
  // below — the round-4 comment right above names exactly why that plate's size is what carries
  // this screen's density margin (0.1525 against a 0.15 floor, a margin of 0.0025). So the top gap
  // before the list rows shrinks by the same amount the footer grew, and the plate stays full size.
  const listTop = Math.max(16, 34 - (fl - 1) * 20);
  const sides = [
    { id: 'mine', title: 'Carried', rows: m.rows, idx: m.rowIdx, x: ix },
    { id: 'theirs', title, rows: m.containerRows, idx: m.otherIdx, x: ix + half + 40 * s },
  ];
  for (const side of sides) {
    const on = (side.id === 'mine') === (m.side === 0);
    S.el({
      id: `container.${side.id}.head`, kind: 'panel_header',
      rect: [side.x, iy, half, 28 * s], text: side.title, opacity: alpha, focused: on,
    }, (c, r) => {
      drawText(c, side.title, r[0], r[1] + 20 * s, faceOf('bone'), 16 * s, on ? ink() : inkDim());
      boneRule(c, r[0], r[1] + 26 * s, r[2], s, idHash(side.id));
    });
    const win = windowOf(side.rows.length, side.idx, CROWS);
    if (side.rows.length > CROWS) {
      extent(S, `container.${side.id}.extent`, side.x + half - 12 * s, iy + listTop * s, 12 * s,
        CROWS * ROW_H * s, win.from, CROWS, side.rows.length, alpha);
    }
    for (let i = win.from; i < win.to; i++) {
      const it = side.rows[i];
      const ry = iy + listTop * s + (i - win.from) * ROW_H * s;
      // T4 round 4. name(280) + weight(90) + gold(90) = 460 was pitched against the old
      // ~718-unit `half` ((iw-40)/2 at iw=1476); the new box's `half` is under 460 alone, so all
      // three move onto fractions of `half` instead of literals that would run the gold column
      // past the row's own edge and into the panel's outer margin.
      row(S, `container.${side.id}.row.${it.id}`, 'list_row',
        side.x, ry, half - 16 * s, ROW_H * s, [
          { text: it.name, w: (half / s) * 0.60 },
          { text: fmt(it.weight), w: (half / s) * 0.19, align: 'right', face: 'bone', size: 15 },
          { text: it.value_gold ? String(it.value_gold) : '—', w: (half / s) * 0.19, align: 'right', face: 'bone', size: 15 },
        ], on && i === side.idx, alpha, { item_id: it.id, side: side.id }, ICON + 10);
      // RI-UIX09 P1 again, and the SAME call — a chest full of things looks like a chest full of
      // things on both sides of the transfer. Round 1 measured this panel at 0.033 fill, the
      // emptiest screen in the build.
      itemIcon(S, `container.${side.id}.icon.${it.id}`, side.x + 4 * s, ry + 3 * s,
        ICON * s, ICON * s, it, alpha,
        { condition: it.condition === null || it.condition === undefined ? null : it.condition });
    }
    if (!side.rows.length) {
      S.el({
        id: `container.${side.id}.empty`, kind: 'hint',
        rect: [side.x, iy + 40 * s, half, 26 * s], text: 'Nothing here.', opacity: alpha,
      }, (c, r) => drawText(c, 'Nothing here.', r[0] + 4 * s, r[1] + 18 * s, faceOf('ink'), 14 * s, inkDim()));
    }
  }
  // ---- the band: what you have selected, drawn, on whichever side you are standing in --------
  const by = iy + (listTop + CROWS * ROW_H + 18) * s;
  const bh = ih - (listTop + CROWS * ROW_H + 18) * s;
  const selSide = m.side === 0 ? m.rows : m.containerRows;
  const selIdx = m.side === 0 ? m.rowIdx : m.otherIdx;
  const csel = selSide[selIdx] || null;
  column(S, 'container.band.rule', ix, by - 10 * s, iw, 2 * s, alpha);
  if (csel) {
    const plate = Math.min(140 * s, bh - 20 * s);
    itemIcon(S, 'container.band.depiction', ix, by + 6 * s, plate, plate, csel, alpha,
      { condition: csel.condition === null || csel.condition === undefined ? null : csel.condition });
  }
  S.el({
    id: 'container.band', kind: 'detail_panel',
    rect: [ix + 160 * s, by, iw - 160 * s, bh], opacity: alpha,
    text: csel ? csel.description : null,
    meta: csel ? {
      item_id: csel.id, weight: csel.weight, value_gold: csel.value_gold, condition: csel.condition,
      side: m.side === 0 ? 'mine' : 'theirs', depiction_element: 'container.band.depiction',
    } : null,
  }, (c, r) => {
    if (!csel) {
      drawText(c, 'nothing selected', r[0], r[1] + 24 * s, faceOf('ink'), 15 * s, inkDim());
      return;
    }
    const f = faceOf('ink'), fb = faceOf('bone');
    drawText(c, csel.name, r[0], r[1] + 24 * s, fb, 20 * s, ink());
    boneRule(c, r[0], r[1] + 32 * s, r[2] * 0.6, s, 606);
    const facts = [['weight', csel.weight > 0 ? fmt(csel.weight) : 'nothing'],
      ['gold', csel.value_gold ? String(csel.value_gold) : 'not for sale']];
    if (csel.condition !== undefined && csel.condition !== null) facts.push(['condition', pct(csel.condition)]);
    let fx = r[0];
    for (const [k, v] of facts) {
      drawText(c, k, fx, r[1] + 58 * s, f, 13 * s, inkDim());
      drawText(c, v, fx, r[1] + 78 * s, fb, 15 * s, ink());
      fx += 150 * s;
    }
    const size = BODY.screen * s, lh = size * 1.44;
    writeLines(c, wrap(csel.description || '', f, size, r[2] * 0.94), r[0], r[1] + 106 * s, 'ink', size, lh, ink());
  });
  hint(S, 'container.hint', ix, iy + ih + 4 * s, iw, containerHint, alpha);
}

/**
 * The name to put over a container, refusing every shape that has produced `undefined` on screen.
 *
 * Exported so `tools/ui/t4-r2-measure.mjs` can drive it directly with the bad values and watch it
 * refuse — a guard nobody has seen fail is not evidence (RULES rule 6).
 */
export function containerTitle(name, kind) {
  const bad = new Set(['', 'undefined', 'null', 'nan', '[object object]']);
  const n = name === null || name === undefined ? '' : String(name).trim();
  if (n && !bad.has(n.toLowerCase())) return n;
  const k = kind === null || kind === undefined ? '' : String(kind).trim();
  if (k && !bad.has(k.toLowerCase())) return k[0].toUpperCase() + k.slice(1);
  return 'Container';
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
    drawText(c, t, r[0] + 2 * s, r[1] + 18 * s, f, sz, ink());
    const by = r[1] + 28 * s, bh = 11 * s;
    const frac = Math.max(0, Math.min(1, m.loadMax ? m.load / m.loadMax : 0));
    chitinPath(c, r[0], by, r[2], bh, s, 8123);
    c.save(); c.clip();
    c.fillStyle = C('parchment'); c.fillRect(r[0] - 2, by - 2, r[2] + 4, bh + 4);
    c.fillStyle = C(frac > 1 - 1e-9 ? 'blood' : 'reed_dark');
    c.fillRect(r[0], by, r[2] * frac, bh);
    c.restore();
    chitinPath(c, r[0], by, r[2], bh, s, 8123);
    c.strokeStyle = Ca('bone_dim', 0.85); c.lineWidth = 1.6 * s; c.stroke();
    for (const b of [0.60, 0.85]) {          // the burden tier boundaries, cut into the bone
      c.beginPath(); c.moveTo(r[0] + r[2] * b, by); c.lineTo(r[0] + r[2] * b, by + bh);
      c.strokeStyle = Ca('bone_dim', 0.9); c.lineWidth = 1.6 * s; c.stroke();
    }
    drawText(c, m.burdenTier, r[0] + 2 * s, r[1] + 55 * s, faceOf('ink'), 13 * s, inkDim());
  });
}

function listHeader(S, id, x, y, w, alpha) {
  const s = S.s;
  S.el({ id: id + '.cols', kind: 'divider', rect: [x, y, w, 30 * s], opacity: alpha }, (c, r) => {
    const f = faceOf('bone'), sz = 12 * s;
    const cols = [['', 330], ['', 46], ['weight', 100], ['gold', 110], ['for weight', 110]];
    let cx = r[0] + 8 * s;
    for (const [t, cw] of cols) {
      if (t) drawText(c, t, cx + cw * s - 10 * s - measure(t, f, sz), r[1] + 20 * s, f, sz, inkDim());
      cx += cw * s;
    }
    boneRule(c, r[0], r[1] + 26 * s, r[2], s, 33);
  });
}

/**
 * C7: name, weight, value, condition, and the FULL description — unabbreviated, untruncated.
 *
 * RI-UIX09 **P5**: it leads with the thing. `REF-A12b-tooltip__mw-207311882.jpg` and
 * `-52160371.jpg` both put a drawn object at the top of the tooltip and the name, weight and value
 * under it; P5's hard fail is "detail panel is text only", which is what round 1 measured. The
 * depiction is a separate `item_icon` element rather than a shape painted inside `detail_panel`,
 * so RI-UIX09's method step 2 (count the pictorial kinds inside the panel rect) can see it — a
 * picture drawn inside another element's callback is exactly the "everything drawn straight to
 * canvas is invisible" failure `surface.js`'s header exists to prevent.
 */
function detail(S, id, x, y, w, h, it, alpha, focused, equipping) {
  const s = S.s;
  const plate = Math.min(150 * s, w - 40 * s);
  if (it) {
    S.el({
      id: id + '.plate', kind: 'divider', rect: [x, y + 6 * s, w, plate + 18 * s],
      opacity: alpha, text: null,
    }, (c, r) => {
      // the shelf the object stands on: a slab of the panel's own material, not a card (G1)
      chitinPath(c, r[0] + (r[2] - plate) / 2 - 10 * s, r[1] + plate * 0.86, plate + 20 * s, 14 * s, s, 2027);
      c.fillStyle = Ca('chitin_dark', 0.55); c.fill();
      c.strokeStyle = Ca('bone_dim', 0.55); c.lineWidth = 1.4 * s; c.stroke();
    });
    itemIcon(S, id + '.depiction', x + (w - plate) / 2, y + 10 * s, plate, plate, it, alpha,
      { condition: it.condition === null || it.condition === undefined ? null : it.condition });
  }
  S.el({
    id, kind: 'detail_panel', rect: [x, y + (it ? plate + 28 * s : 0), w, h - (it ? plate + 28 * s : 0)],
    opacity: alpha, focused,
    text: it ? it.description : null,
    meta: it ? {
      item_id: it.id, weight: it.weight, value_gold: it.value_gold, condition: it.condition,
      // The depiction is a sibling element, so say which one — a critic checking P5 should not
      // have to infer the pairing from two rects that happen to be adjacent.
      depiction_element: id + '.depiction', depiction_shape: shapeFor(it),
      // T4 round 3, RI-UIX10 O3 — the in-progress state, on the panel the player is reading.
      equipping: !!equipping,
      equip_remaining_f: equipping ? equipping.remaining_f : null,
    } : null,
  }, (c, r) => {
    if (!it) {
      drawText(c, 'nothing selected', r[0], r[1] + 24 * s, faceOf('ink'), 15 * s, inkDim());
      return;
    }
    const f = faceOf('ink'), fb = faceOf('bone');
    let yy = r[1] + 26 * s;
    drawText(c, it.name, r[0], yy, faceOf('bone'), 20 * s, ink());
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
      if (k) drawText(c, k, r[0], yy, f, 13 * s, inkDim());
      drawText(c, v, r[0] + 96 * s, yy, fb, 15 * s, it.stolen && !k ? accent() : ink());
      yy += 22 * s;
    }
    yy += 10 * s;
    const size = BODY.screen * s, lh = size * 1.48;
    const lines = wrap(it.description, f, size, r[2]);
    writeLines(c, lines, r[0], yy, 'ink', size, lh, ink());
    yy += lines.length * lh + 16 * s;
    if (it.readable) drawText(c, 'It can be read.', r[0], yy, f, 14 * s, inkDim());
    if (it.equipped) drawText(c, 'In hand.', r[0], yy + 20 * s, f, 14 * s, inkDim());
    // T4 round 3, RI-UIX10 O3. Drawn, not merely declared — a meta field a probe reads and a
    // player cannot is the orphan-model failure (`RI-MTH07`) wearing a UI hat. The rule under it
    // empties as the commitment runs, so the wait has a length rather than being an ellipsis.
    if (equipping) {
      const ey = yy + (it.equipped ? 40 : 20) * s;
      drawText(c, 'Putting it on.', r[0], ey, faceOf('bone'), 14 * s, accent());
      const total = Math.max(1, Number(equipping.commit_frames) || 30);
      const left = Math.max(0, Math.min(total, Number(equipping.remaining_f) || 0));
      const bw = Math.min(180 * s, r[2]);
      c.fillStyle = Ca('chitin_dark', 0.55);
      c.fillRect(r[0], ey + 8 * s, bw, 4 * s);
      c.fillStyle = accent();
      c.fillRect(r[0], ey + 8 * s, bw * (1 - left / total), 4 * s);
    }
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

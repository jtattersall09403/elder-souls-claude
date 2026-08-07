// The level-up screen, the character sheet, and the spell list.
//
// Owner: W1-21. The level-up screen is judged by RI-UIX03 §E, and L4 is the check to run first:
// **no gold appears on it.** S15 says souls level you and only level you, gold is the only
// currency, and "a gold figure on the level-up screen is a category error and is a hard fail —
// it is the exact confusion S15 was decreed to prevent". There is therefore no gold element in
// this file, and `ui-census.mjs` asserts it by regex over the rendered text as well as by kind,
// because the way this fails is a header component reused from the merchant screen.
//
// L5: all ten attributes on screen simultaneously. `game/data/progression/attributes.json`
// declares ten and they are all here — a three-stat class summary fails S2's Morrowind half.
// L8: the soft caps are MARKED, in bone, on the attribute's own gauge, rather than discovered
// by experiment.
// L6: selecting an attribute previews what it changes, before confirming, and the preview is a
// separate element so a critic can assert it appeared and that no `level_up` event fired.
// L7: there is no respec button. Respec, if it exists, is a named person with a price.
'use strict';

import { C, Ca, boneRule, bonePip, shellInlay, idHash } from '../theme.js';
import { screen, row, column, hint, extent, ink, inkDim, accent, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure, wrap, writeLines } from '../type.js';

export function drawLevelUp(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sc = screen(S, 'levelup', 'The hearth', m.hearthName || null, 'bone', alpha);
  const [ix, iy, iw, ih] = sc.inner;

  // ---- what it costs, in souls. There is no other currency on this screen. -----------------
  S.el({
    id: 'levelup.level', kind: 'level_value',
    rect: [ix, iy, 300 * s, 40 * s], text: String(m.level), opacity: alpha,
    meta: { level: m.level },
  }, (c, r) => {
    drawText(c, 'level', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.level), r[0] + 60 * s, r[1] + 30 * s, faceOf('bone'), 26 * s, ink());
  });
  S.el({
    id: 'levelup.souls', kind: 'souls_held',
    rect: [ix + 320 * s, iy, 300 * s, 40 * s], text: String(m.souls), opacity: alpha,
    meta: { souls_held: m.souls },
  }, (c, r) => {
    drawText(c, 'souls held', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.souls), r[0] + 100 * s, r[1] + 30 * s, faceOf('bone'), 22 * s, ink());
  });
  S.el({
    id: 'levelup.next', kind: 'souls_to_next',
    rect: [ix + 640 * s, iy, 360 * s, 40 * s], text: String(m.soulsToNext), opacity: alpha,
    meta: { souls_to_next: m.soulsToNext, level_after: m.level + 1, affordable: m.souls >= m.soulsToNext },
  }, (c, r) => {
    drawText(c, 'to the next', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.soulsToNext), r[0] + 110 * s, r[1] + 30 * s, faceOf('bone'), 22 * s,
      m.souls >= m.soulsToNext ? C('ink') : inkDim());
  });
  S.el({ id: 'levelup.rule', kind: 'divider', rect: [ix, iy + 44 * s, iw, 6 * s], opacity: alpha },
    (c, r) => boneRule(c, r[0], r[1] + 3 * s, r[2], s, 4));

  // ---- the ten attributes, all on screen at once (L5) ---------------------------------------
  const rowH = 46 * s, colW = iw * 0.56;
  m.attributes.forEach((a, i) => {
    const y = iy + 58 * s + i * rowH;
    const on = i === m.attrIdx;
    S.el({
      id: 'levelup.attr.' + a.id, kind: 'attribute_row',
      rect: [ix, y, colW, rowH - 4 * s], text: `${a.name} ${a.value}`, focused: on, opacity: alpha,
      meta: { attribute: a.id, value: a.value, soft_cap: a.soft_cap, hard_cap_curve: a.hard_cap_curve },
    }, (c, r) => {
      if (on) shellInlay(c, r[0], r[1], r[2], r[3], s, idHash(a.id));
      drawText(c, a.name, r[0] + 8 * s, r[1] + 26 * s, faceOf('bone'), 15 * s, ink());
      drawText(c, String(a.value), r[0] + 210 * s, r[1] + 27 * s, faceOf('bone'), 19 * s, ink());
      // the gauge, with the soft cap cut into it (L8)
      const gx = r[0] + 262 * s, gw = r[2] - 280 * s, gy = r[1] + 16 * s, gh = 10 * s;
      c.fillStyle = C('parchment'); c.fillRect(gx, gy, gw, gh);
      c.fillStyle = C('reed_dark'); c.fillRect(gx, gy, gw * Math.min(1, a.value / 99), gh);
      for (const [cap, label] of [[a.soft_cap, 'soft'], [a.hard_cap_curve, 'hard']]) {
        if (!cap) continue;
        const cx = gx + gw * (cap / 99);
        c.beginPath(); c.moveTo(cx, gy - 4 * s); c.lineTo(cx, gy + gh + 4 * s);
        c.strokeStyle = Ca('bone_dim', 0.95); c.lineWidth = 2 * s; c.stroke();
        drawText(c, label, cx - 10 * s, gy + gh + 16 * s, faceOf('ink'), 10 * s, inkDim());
      }
    });
  });

  // ---- L6: what it would do, before you confirm --------------------------------------------
  const px = ix + colW + 30 * s, pw = iw - colW - 30 * s;
  column(S, 'levelup.rule2', px - 16 * s, iy + 58 * s, 2 * s, ih - 70 * s, alpha);
  const a = m.attributes[m.attrIdx];
  S.el({
    id: 'levelup.preview', kind: 'attribute_preview',
    rect: [px, iy + 58 * s, pw, ih - 70 * s], opacity: alpha,
    text: a ? a.in_fight + ' ' + a.out_of_fight : null,
    meta: a ? { attribute: a.id, from: a.value, to: a.value + 1, derived: m.preview } : null,
  }, (c, r) => {
    if (!a) return;
    let y = r[1] + 24 * s;
    drawText(c, a.name, r[0], y, faceOf('bone'), 19 * s, ink());
    y += 10 * s; boneRule(c, r[0], y, r[2], s, 6); y += 26 * s;
    drawText(c, `${a.value}  to  ${a.value + 1}`, r[0], y, faceOf('bone'), 17 * s, ink());
    y += 28 * s;
    for (const d of m.preview) {
      drawText(c, d.label, r[0], y, faceOf('ink'), 14 * s, inkDim());
      drawText(c, `${d.from}  ${d.to}`, r[0] + 190 * s, y, faceOf('bone'), 14 * s, ink());
      y += 20 * s;
    }
    y += 12 * s;
    const size = 15 * s, lh = size * 1.44;
    const ls = wrap('In a fight: ' + a.in_fight, faceOf('ink'), size, r[2]);
    y = writeLines(c, ls, r[0], y, 'ink', size, lh, ink());
    y += 8 * s;
    const ls2 = wrap('Out of one: ' + a.out_of_fight, faceOf('ink'), size, r[2]);
    writeLines(c, ls2, r[0], y, 'ink', size, lh, ink());
  });

  hint(S, 'levelup.hint', ix, iy + ih + 4 * s, iw,
    m.souls >= m.soulsToNext
      ? 'Confirm twice to spend. Nothing is spent until the second time.'
      : 'Not enough souls yet. Come back.', alpha);
}

/** The character sheet: identity, the ten, and the skills. Morrowind breadth (S2). */
export function drawSheet(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sc = screen(S, 'sheet', m.name || 'Nameless', m.classLabel || null, 'reed', alpha);
  const [ix, iy, iw, ih] = sc.inner;
  const colW = iw * 0.34;

  const facts = [
    ['recorded as', m.race], ['raised', m.upbringing], ['trade', m.classLabel],
    ['tide', m.birthsign], ['level', String(m.level)], ['souls', String(m.souls)],
    ['reputation', String(m.reputation)], ['bounty', String(m.bounty)],
  ];
  facts.forEach(([k, v], i) => {
    S.el({
      id: 'sheet.fact.' + k.replace(/\s/g, '_'), kind: 'sheet_row',
      rect: [ix, iy + i * 26 * s, colW, 24 * s], text: `${k} ${v}`, opacity: alpha,
    }, (c, r) => {
      drawText(c, k, r[0], r[1] + 17 * s, faceOf('ink'), 14 * s, inkDim());
      drawText(c, String(v || '—'), r[0] + 140 * s, r[1] + 17 * s, faceOf('bone'), 15 * s, ink());
    });
  });

  const ax = ix + colW + 24 * s;
  column(S, 'sheet.rule1', ax - 14 * s, iy, 2 * s, ih, alpha);
  m.attributes.forEach((a, i) => {
    S.el({
      id: 'sheet.attr.' + a.id, kind: 'attribute_row',
      rect: [ax, iy + i * 26 * s, colW * 0.8, 24 * s], text: `${a.name} ${a.value}`, opacity: alpha,
      meta: { attribute: a.id, value: a.value, soft_cap: a.soft_cap },
    }, (c, r) => {
      drawText(c, a.name, r[0], r[1] + 17 * s, faceOf('bone'), 13 * s, ink());
      drawText(c, String(a.value), r[0] + 180 * s, r[1] + 17 * s, faceOf('bone'), 15 * s, ink());
    });
  });

  const sx = ax + colW * 0.8 + 30 * s, sw = ix + iw - sx;
  column(S, 'sheet.rule2', sx - 16 * s, iy, 2 * s, ih, alpha);
  const rows = 22;
  const win = windowOf(m.skills.length, m.rowIdx, rows);
  for (let i = win.from; i < win.to; i++) {
    const sk = m.skills[i];
    row(S, 'sheet.skill.' + sk.id, 'skill_row', sx, iy + (i - win.from) * 24 * s, sw, 24 * s, [
      { text: sk.name, w: 220, size: 14 },
      { text: String(sk.value), w: 60, align: 'right', face: 'bone', size: 14 },
    ], i === m.rowIdx, alpha, { skill: sk.id, value: sk.value });
  }
  if (m.skills.length > rows) {
    extent(S, 'sheet.extent', ix + iw - 10 * s, iy, 10 * s, ih - 20 * s, win.from, rows, m.skills.length, alpha);
  }
  hint(S, 'sheet.hint', ix, iy + ih + 4 * s, iw, 'What is written on your case, and what you can do.', alpha);
}

/** The attuned spells. A list, walked with a thumb; never a wheel that stops the fight. */
export function drawSpells(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const sel = m.spells[m.rowIdx] || null;
  const sc = screen(S, 'spells', sel ? sel.name : 'Attuned', m.focusLabel || null, 'chitin', alpha);
  const [ix, iy, iw, ih] = sc.inner;
  const lw = iw * 0.46;
  const rows = 18;
  const win = windowOf(m.spells.length, m.rowIdx, rows);
  for (let i = win.from; i < win.to; i++) {
    const sp = m.spells[i];
    row(S, 'spells.row.' + sp.id, 'spell_row', ix, iy + (i - win.from) * 30 * s, lw, 30 * s, [
      { text: sp.name, w: 300 },
      { text: String(sp.cost), w: 70, align: 'right', face: 'bone', size: 14 },
    ], i === m.rowIdx, alpha, { spell: sp.id, cost: sp.cost, school: sp.school });
  }
  const dx = ix + lw + 30 * s, dw = iw - lw - 30 * s;
  column(S, 'spells.rule', dx - 16 * s, iy, 2 * s, ih, alpha);
  S.el({
    id: 'spells.detail', kind: 'detail_panel', rect: [dx, iy, dw, ih], opacity: alpha,
    text: sel ? sel.description : null, meta: sel ? { spell: sel.id } : null,
  }, (c, r) => {
    if (!sel) { drawText(c, 'nothing attuned', r[0], r[1] + 24 * s, faceOf('ink'), 15 * s, inkDim()); return; }
    let y = r[1] + 26 * s;
    drawText(c, sel.name, r[0], y, faceOf('bone'), 19 * s, ink());
    y += 12 * s; boneRule(c, r[0], y, r[2], s, 9); y += 26 * s;
    for (const [k, v] of [['school', sel.school], ['focus', String(sel.cost)]]) {
      drawText(c, k, r[0], y, faceOf('ink'), 13 * s, inkDim());
      drawText(c, String(v), r[0] + 110 * s, y, faceOf('bone'), 15 * s, ink());
      y += 22 * s;
    }
    y += 10 * s;
    const size = 16 * s, lh = size * 1.46;
    writeLines(c, wrap(sel.description || '', faceOf('ink'), size, r[2]), r[0], y, 'ink', size, lh, ink());
  });
  hint(S, 'spells.hint', ix, iy + ih + 4 * s, iw,
    'Attuning is a hearth action. In a fight you cycle what is already attuned, and the fight does not stop for it.', alpha);
}

function windowOf(n, sel, size) {
  if (n <= size) return { from: 0, to: n };
  let from = sel - ((size / 2) | 0);
  if (from < 0) from = 0;
  if (from + size > n) from = n - size;
  return { from, to: from + size };
}

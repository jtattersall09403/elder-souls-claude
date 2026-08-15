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

import { C, Ca, boneRule, bonePip, shellInlay, chitinPath, idHash } from '../theme.js';
import { screen, screenRect, row, column, hint, hintLines, extent, ink, inkDim, accent, CALM_ALPHA, COMBAT_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure, wrap, writeLines, ellipsise } from '../type.js';
import { glyphObject, drawObject, ATTRIBUTE_SHAPE } from '../icons.js';

/**
 * Strip a reference-item citation out of anything about to be drawn for the player.
 *
 * Round 1 photographed the level-up screen's attribute preview reading *"Out of one: Max equip
 * load **(RI-PRG07)**; carry capacity for loot; forcing doors and chests"*
 * (`crops/levelup-attribute-preview-RI-PRG07-leak-2x.png`). The citation came from
 * `game/data/progression/attributes.json`, where it is genuinely useful to whoever maintains the
 * data — so the data is corrected (three strings, `strength`, `hist-bond`, `personality`) AND this
 * guard stands in front of the draw call, because the field is authored prose and the next writer
 * will reach for a citation again. Acceptance is zero `/RI-[A-Z]{3}\d{2}/` matches in any element
 * `text` on any screen; two guards for one defect, and the data arm alone would not have held.
 */
export function playerProse(t) {
  return String(t === null || t === undefined ? '' : t)
    .replace(/\s*\((?:RI|GAP|AR|S)-[A-Z0-9\-]+\)/g, '')
    .replace(/\s+([;,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The attribute's carved mark. One drawn object per attribute — RI-UIX09 D1's `glyph_object`. */
function attrShape(id) { return ATTRIBUTE_SHAPE[String(id)] || 'bundle'; }

/** A school's mark. Falls back to a staff rather than to nothing — every row gets a picture. */
const SCHOOL_SHAPE = {
  restoration: 'herb', alteration: 'rope', illusion: 'robe', conjuration: 'amulet',
  destruction: 'pot', mysticism: 'ring', enchant: 'ingot', alchemy: 'bottle',
};

export function drawLevelUp(S, m) {
  const s = S.s;
  const alpha = m.inCombat ? COMBAT_ALPHA : CALM_ALPHA;
  const levelUpHint = m.souls >= m.soulsToNext
    ? 'Confirm twice to spend. Nothing is spent until the second time.'
    : 'Not enough souls yet. Come back.';
  const fl = hintLines(levelUpHint, screenRect(S, 'levelup')[2] - 44 * s, s);
  const sc = screen(S, 'levelup', 'The hearth', m.hearthName || null, 'bone', alpha, fl);
  const [ix, iy, iw, ih] = sc.inner;

  // ---- what it costs, in souls. There is no other currency on this screen. -----------------
  // T4 round 4, GAP-W1-ui-panel-is-a-fixed-box. These three blocks used to sit at fixed 0/320/640
  // offsets 300/300/360 wide — a 1000-unit span the old 1476-wide box had 476 units to spare
  // against. The new box is narrower than that on its own, so the three move onto thirds of `iw`
  // instead of a magic span that would now overlap the attribute rows below it.
  const statW = iw / 3;
  S.el({
    id: 'levelup.level', kind: 'level_value',
    rect: [ix, iy, statW - 10 * s, 40 * s], text: String(m.level), opacity: alpha,
    meta: { level: m.level },
  }, (c, r) => {
    drawText(c, 'level', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.level), r[0] + 60 * s, r[1] + 30 * s, faceOf('bone'), 26 * s, ink());
  });
  S.el({
    id: 'levelup.souls', kind: 'souls_held',
    rect: [ix + statW, iy, statW - 10 * s, 40 * s], text: String(m.souls), opacity: alpha,
    meta: { souls_held: m.souls },
  }, (c, r) => {
    drawText(c, 'souls held', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.souls), r[0] + 100 * s, r[1] + 30 * s, faceOf('bone'), 22 * s, ink());
  });
  S.el({
    id: 'levelup.next', kind: 'souls_to_next',
    rect: [ix + statW * 2, iy, statW - 10 * s, 40 * s], text: String(m.soulsToNext), opacity: alpha,
    meta: { souls_to_next: m.soulsToNext, level_after: m.level + 1, affordable: m.souls >= m.soulsToNext },
  }, (c, r) => {
    drawText(c, 'to the next', r[0], r[1] + 26 * s, faceOf('ink'), 15 * s, inkDim());
    drawText(c, String(m.soulsToNext), r[0] + 110 * s, r[1] + 30 * s, faceOf('bone'), 22 * s,
      m.souls >= m.soulsToNext ? C('ink') : inkDim());
  });
  S.el({ id: 'levelup.rule', kind: 'divider', rect: [ix, iy + 44 * s, iw, 6 * s], opacity: alpha },
    (c, r) => boneRule(c, r[0], r[1] + 3 * s, r[2], s, 4));

  // ---- the ten attributes, all on screen at once (L5) ---------------------------------------
  // T4 round 4. rowH 46 -> 36 -> 30, over two measured passes: ten rows at 46 needed 460 units
  // below the 58-unit header, which the old 674-unit inner box had room for; the first pass's 36
  // (760×560 box) still hard-failed `RI-UIX09` DN4 at 0.1455 because the row TEXT (names, values)
  // is short and fixed and does not shrink with the box the way flowing prose does, so raising the
  // row density — not the box alone — is what actually recovers `D2`. 30 is the floor the row's
  // OWN content sets: the cap-tick label 8 units below the gauge (see below) needs the row to be
  // at least ~30 units before it starts drawing into the next row.
  const rowH = 30 * s, colW = iw * 0.56;
  // T4 round 5 (`ARBITRATION` S58 — "ink drawn over ink still counts, and it is not legible"). The
  // round-4 layout put the value column at a FIXED FRACTION of `colW` (0.27) — a proportion that
  // held at the old 826-unit `colW` and collided on 9 of 10 rows at the new 244-unit one, because
  // the fraction shrank with the box but the GLYPHS did not: font sizes are fixed pixels, not a
  // fraction of anything. So the column widths are measured from the actual longest string that
  // will be drawn in them (`measure()`, the same metric `drawText` itself uses), not guessed from
  // the box's own width. `PERSONALITY` is the widest name at this face/size — 71px — and every
  // value is at most two digits (`hard_cap` is 99) — 15px — so the name column reserves 71+14 and
  // the value column reserves 15+10, both with an explicit gap to the next column rather than an
  // adjoining edge, so `tools/ui/t4-r5-legibility.mjs`'s separator check has margin, not a near-miss.
  const nameColW = Math.max(...m.attributes.map((a) => measure(a.name, faceOf('bone'), 15 * s))) + 14 * s;
  const valueColW = Math.max(...m.attributes.map((a) => measure(String(a.value), faceOf('bone'), 19 * s))) + 10 * s;
  const nameX0 = 44 * s, valueX0 = nameX0 + nameColW, gaugeX0 = valueX0 + valueColW + 8 * s;
  m.attributes.forEach((a, i) => {
    const y = iy + 58 * s + i * rowH;
    const on = i === m.attrIdx;
    S.el({
      id: 'levelup.attr.' + a.id, kind: 'attribute_row',
      rect: [ix, y, colW, rowH - 4 * s], text: `${a.name} ${a.value}`, focused: on, opacity: alpha,
      meta: { attribute: a.id, value: a.value, soft_cap: a.soft_cap, hard_cap_curve: a.hard_cap_curve },
    }, (c, r) => {
      if (on) shellInlay(c, r[0], r[1], r[2], r[3], s, idHash(a.id));
      drawText(c, a.name, r[0] + nameX0, r[1] + 26 * s, faceOf('bone'), 15 * s, ink());
      drawText(c, String(a.value), r[0] + valueX0, r[1] + 27 * s, faceOf('bone'), 19 * s, ink());
      // the gauge, with the soft cap cut into it (L8). Takes whatever is left of the row after the
      // measured name and value columns, clamped to a sane minimum rather than trusting the
      // remainder is always positive.
      // A2: not a plain rectangle. The gauge is a bone trough with a cut edge, exactly as the
      // HUD's bars are, so nothing on any screen in this interface is an axis-aligned box.
      const gx = r[0] + gaugeX0, gw = Math.max(30 * s, r[0] + r[2] - 10 * s - gx), gy = r[1] + 16 * s, gh = 10 * s;
      chitinPath(c, gx, gy, gw, gh, s, idHash(a.id) & 0xffff);
      c.save(); c.clip();
      c.fillStyle = C('parchment'); c.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);
      c.fillStyle = C('reed_dark'); c.fillRect(gx, gy, gw * Math.min(1, a.value / 99), gh);
      c.restore();
      chitinPath(c, gx, gy, gw, gh, s, idHash(a.id) & 0xffff);
      c.strokeStyle = Ca('bone_dim', 0.8); c.lineWidth = 1.6 * s; c.stroke();
      for (const [cap, label] of [[a.soft_cap, 'soft'], [a.hard_cap_curve, 'hard']]) {
        if (!cap) continue;
        const cx = gx + gw * (cap / 99);
        c.beginPath(); c.moveTo(cx, gy - 4 * s); c.lineTo(cx, gy + gh + 4 * s);
        c.strokeStyle = Ca('bone_dim', 0.95); c.lineWidth = 2 * s; c.stroke();
        // T4 round 4. 16 -> 8: the label sat far enough below the gauge (gy+gh+16) that it needed
        // a ~46-unit row on its own; tucked to gy+gh+8 it stays inside a 30-unit row instead of
        // drawing into the next attribute down. Still a tick AND a word, not just a tick — L8
        // asks for the cap "MARKED… on the attribute's own gauge", which the tick line alone
        // already satisfies, so the label is belt-and-braces rather than the requirement itself.
        drawText(c, label, cx - 10 * s, gy + gh + 8 * s, faceOf('ink'), 9 * s, inkDim());
      }
    });
    // RI-UIX09 D1. The attribute's own carved mark, a drawn object rather than a letter: a maul
    // for strength, a book for intelligence, a pair of boots for speed. It is `glyph_object` and
    // NOT `item_icon` — an attribute is not a thing you can pick up, and a census that could not
    // tell them apart would report this screen as carrying inventory.
    glyphObject(S, 'levelup.mark.' + a.id, ix + 6 * s, y + 6 * s, 30 * s, 30 * s,
      attrShape(a.id), alpha, { attribute: a.id });
  });

  // ---- L6: what it would do, before you confirm --------------------------------------------
  const px = ix + colW + 30 * s, pw = iw - colW - 30 * s;
  column(S, 'levelup.rule2', px - 16 * s, iy + 58 * s, 2 * s, ih - 70 * s, alpha);
  const a = m.attributes[m.attrIdx];
  S.el({
    id: 'levelup.preview', kind: 'attribute_preview',
    rect: [px, iy + 58 * s, pw, ih - 70 * s], opacity: alpha,
    // `playerProse()` — see its header. Round 1 rendered `(RI-PRG07)` to the player from here.
    text: a ? playerProse(a.in_fight) + ' ' + playerProse(a.out_of_fight) : null,
    meta: a ? { attribute: a.id, from: a.value, to: a.value + 1, derived: m.preview } : null,
  }, (c, r) => {
    if (!a) return;
    let y = r[1] + 24 * s;
    drawObject(c, attrShape(a.id), r[0], y - 22 * s, 30 * s, 30 * s, s, idHash('pv' + a.id), null);
    drawText(c, a.name, r[0] + 38 * s, y, faceOf('bone'), 19 * s, ink());
    y += 14 * s; boneRule(c, r[0], y, r[2], s, 6); y += 26 * s;
    drawText(c, `${a.value}  to  ${a.value + 1}`, r[0], y, faceOf('bone'), 17 * s, ink());
    y += 28 * s;
    for (const d of m.preview) {
      drawText(c, d.label, r[0], y, faceOf('ink'), 14 * s, inkDim());
      drawText(c, `${d.from}  ${d.to}`, r[0] + 190 * s, y, faceOf('bone'), 14 * s, ink());
      y += 20 * s;
    }
    y += 12 * s;
    const size = 15 * s, lh = size * 1.44;
    const ls = wrap('In a fight: ' + playerProse(a.in_fight), faceOf('ink'), size, r[2]);
    y = writeLines(c, ls, r[0], y, 'ink', size, lh, ink());
    y += 8 * s;
    const ls2 = wrap('Out of one: ' + playerProse(a.out_of_fight), faceOf('ink'), size, r[2]);
    writeLines(c, ls2, r[0], y, 'ink', size, lh, ink());
  });

  hint(S, 'levelup.hint', ix, iy + ih + 4 * s, iw, levelUpHint, alpha);
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
  // ---- THE SHEET WAS THE EMPTIEST SCREEN IN THE BUILD AND THIS IS WHY -----------------------
  //
  // Round 1 measured panel fill of **0.069** here, against Morrowind's 0.42 and RI-UIX09 P4's low
  // bar of 0.35. The cause was not a missing feature: eight facts and ten attributes were drawn on
  // 26-unit rows down a 674-unit box, using 468 units of it and leaving the rest blank, with the
  // values as bare numerals and no gauge. `REF-A12b-character_sheet__mw-*.jpg` (four plates) shows
  // the opposite — two dense stacked blocks, every attribute and both skill lists on screen at
  // once, filling the window. The rows below are pitched to fill the column and each attribute
  // carries the same gauge and the same carved mark the level-up screen uses.
  const factH = 34;
  facts.forEach(([k, v], i) => {
    S.el({
      id: 'sheet.fact.' + k.replace(/\s/g, '_'), kind: 'sheet_row',
      rect: [ix, iy + i * factH * s, colW, (factH - 2) * s], text: `${k} ${v}`, opacity: alpha,
    }, (c, r) => {
      drawText(c, k, r[0], r[1] + 20 * s, faceOf('ink'), 14 * s, inkDim());
      // T4 round 4. The value offset (150) was pitched against the old 502-unit colW (iw*0.34 at
      // iw=1476); `colW` is 250-ish now, so a fixed 150 left a long value — a class or a
      // birthsign name — with nowhere to go but over the divider into the attribute column.
      // Fraction-of-colW offset plus `ellipsise` (as every list row in this file already uses)
      // instead of an unbounded `drawText`.
      const f = faceOf('bone'), sz = 16 * s, vx = r[2] * 0.56;
      const t = ellipsise(String(v || '—'), f, sz, r[2] - vx - 4 * s);
      drawText(c, t, r[0] + vx, r[1] + 21 * s, f, sz, ink());
      boneRule(c, r[0], r[1] + r[3] - 3 * s, r[2], s, idHash(k) & 0xffff);
    });
  });

  // T4 round 4. 42 -> 36: the row's own content (name+value line, then an 8-unit gauge starting
  // at +26) needs about 34 units, which 42 had room to spare on and 36 does not — chosen from the
  // content, same as level-up's rowH, rather than from the arithmetic target alone.
  const ax = ix + colW + 24 * s, attrW = colW * 0.92, attrH = 36;
  column(S, 'sheet.rule1', ax - 14 * s, iy, 2 * s, ih, alpha);
  // T4 round 5 (`ARBITRATION` S58). Same defect as level-up's row, same fix: `r[2]*0.40` was a
  // fraction of `attrW` tuned to the OLD ~502-unit column, and at the new ~161-unit `attrW` it put
  // the value inside the longest names ("PERSONALITY" 66px at this face/size vs. a 0.40 offset of
  // 64px). The value column now starts after the measured longest name plus a real gap, exactly as
  // the level-up screen's row does — the gauge is unaffected, it was already drawn on its own line
  // below the name/value and never collided.
  const sheetValueX = 40 * s + Math.max(...m.attributes.map((a) => measure(a.name, faceOf('bone'), 14 * s))) + 10 * s;
  m.attributes.forEach((a, i) => {
    const y = iy + i * attrH * s;
    S.el({
      id: 'sheet.attr.' + a.id, kind: 'attribute_row',
      rect: [ax, y, attrW, (attrH - 4) * s], text: `${a.name} ${a.value}`, opacity: alpha,
      meta: { attribute: a.id, value: a.value, soft_cap: a.soft_cap },
    }, (c, r) => {
      drawText(c, a.name, r[0] + 40 * s, r[1] + 20 * s, faceOf('bone'), 14 * s, ink());
      drawText(c, String(a.value), r[0] + sheetValueX, r[1] + 21 * s, faceOf('bone'), 16 * s, ink());
      // the same bone trough the level-up screen cuts, so one attribute reads the same way on
      // both screens rather than being a number here and a gauge there
      const gx = r[0] + 40 * s, gw = r[2] - 56 * s, gy = r[1] + 26 * s, gh = 8 * s;
      chitinPath(c, gx, gy, gw, gh, s, idHash('sh' + a.id) & 0xffff);
      c.save(); c.clip();
      c.fillStyle = C('parchment'); c.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);
      c.fillStyle = C('reed_dark'); c.fillRect(gx, gy, gw * Math.min(1, a.value / 99), gh);
      c.restore();
      chitinPath(c, gx, gy, gw, gh, s, idHash('sh' + a.id) & 0xffff);
      c.strokeStyle = Ca('bone_dim', 0.75); c.lineWidth = 1.4 * s; c.stroke();
      if (a.soft_cap) {
        const cx2 = gx + gw * (a.soft_cap / 99);
        c.beginPath(); c.moveTo(cx2, gy - 3 * s); c.lineTo(cx2, gy + gh + 3 * s);
        c.strokeStyle = Ca('bone_dim', 0.95); c.lineWidth = 1.8 * s; c.stroke();
      }
    });
    glyphObject(S, 'sheet.mark.' + a.id, ax + 2 * s, y + 4 * s, 32 * s, 32 * s,
      attrShape(a.id), alpha, { attribute: a.id });
  });

  const sx = ax + attrW + 30 * s, sw = ix + iw - sx;
  column(S, 'sheet.rule2', sx - 16 * s, iy, 2 * s, ih, alpha);
  // T4 round 4. 28 -> 24 -> 20, over two measured passes: `game/data/progression/skills.json`
  // carries 19 skills (checked: `python3 -c "import json;print(len(json.load(open(
  // 'game/data/progression/skills.json'))['skills']))"` -> 19) and this is the tallest of the
  // sheet's three columns, so it is what decides how much the box can shrink without dropping a
  // row off the bottom of the window. At `skillH=20` the second pass's `ih` (384) still gives
  // `floor(ih/20) = 19` — every skill stays on screen, none newly scrolled.
  const skillH = 20;
  const rows = Math.max(8, Math.floor(ih / (skillH * s)));
  const win = windowOf(m.skills.length, m.rowIdx, rows);
  // The name/value column widths (220 + 60 = 280) were pitched against the old ~600-unit `sw`
  // (iw*0.66 minus the other two columns at iw=1476); the new `sw` is under 220 alone at this
  // box's width, so both move onto fractions of `sw` — `row()` still ellipsises whatever does not
  // fit, exactly as it already does for the inventory and container lists.
  const skNameW = (sw / s) * 0.76, skValW = (sw / s) * 0.20;
  for (let i = win.from; i < win.to; i++) {
    const sk = m.skills[i];
    row(S, 'sheet.skill.' + sk.id, 'skill_row', sx, iy + (i - win.from) * skillH * s, sw, skillH * s, [
      { text: sk.name, w: skNameW, size: 15 },
      { text: String(sk.value), w: skValW, align: 'right', face: 'bone', size: 15 },
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
  const spellsHint = 'Attuning is a hearth action. In a fight you cycle what is already attuned, and the fight does not stop for it.';
  // T4 round 5. This hint measures 549px at 14px body against a 460-wide box's 416px inner width —
  // it was drawn as one unwrapped line and ran off the panel's own right edge, losing its last
  // eight words with no ellipsis (`ARBITRATION` S58). `hintLines()` tells `screen()` how tall the
  // wrapped hint will actually be so the footer band is sized for it before the panel is drawn.
  const fl = hintLines(spellsHint, screenRect(S, 'spells')[2] - 44 * s, s);
  const sc = screen(S, 'spells', sel ? sel.name : 'Attuned', m.focusLabel || null, 'chitin', alpha, fl);
  const [ix, iy, iw, ih] = sc.inner;
  const lw = iw * 0.46;
  // T4 round 4. 18 was a flat cap against the old 674-unit `ih` (18*34=612 fit under it with
  // room to spare); the new, shorter box does not have 612 units to give the list, so the cap is
  // now also bounded by what actually fits — the attuned list this build's own fixture carries is
  // 2 spells, well under either number, but a fuller list must not draw past the panel's foot.
  const rows = Math.max(4, Math.min(18, Math.floor(ih / (34 * s))));
  const win = windowOf(m.spells.length, m.rowIdx, rows);
  // T4 round 4, GAP-W1-ui-panel-is-a-fixed-box. name(300) + cost(70) = 370 units was pitched
  // against the old ~679-unit `lw` (iw*0.46 at iw=1476); the new box's `lw` is under 370 alone,
  // so both move onto fractions of `lw` instead of literals that would push the cost column past
  // the row's own right edge.
  const spNameW = (lw / s) * 0.81, spCostW = (lw / s) * 0.18;
  for (let i = win.from; i < win.to; i++) {
    const sp = m.spells[i];
    const ry = iy + (i - win.from) * 34 * s;
    row(S, 'spells.row.' + sp.id, 'spell_row', ix, ry, lw, 34 * s, [
      { text: sp.name, w: spNameW },
      { text: String(sp.cost), w: spCostW, align: 'right', face: 'bone', size: 14 },
    ], i === m.rowIdx, alpha, { spell: sp.id, cost: sp.cost, school: sp.school }, 38);
    // The school's mark, drawn. Same table, same `glyph_object` kind — a spell is not an object
    // you carry, so it is not an `item_icon` either.
    glyphObject(S, 'spells.mark.' + sp.id, ix + 3 * s, ry + 3 * s, 28 * s, 28 * s,
      SCHOOL_SHAPE[String(sp.school || '').toLowerCase()] || 'staff', alpha, { spell: sp.id, school: sp.school });
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
  hint(S, 'spells.hint', ix, iy + ih + 4 * s, iw, spellsHint, alpha);
}

function windowOf(n, sel, size) {
  if (n <= size) return { from: 0, to: n };
  let from = sel - ((size / 2) | 0);
  if (from < 0) from = 0;
  if (from + size > n) from = n - size;
  return { from, to: from + size };
}

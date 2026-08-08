// The combat HUD.
//
// Owner: W1-21. Judged by RI-UIX01, which is `souls`: inside the fight Souls is authoritative,
// the HUD is small and permanent and it tells you the things you cannot deduce from the world.
//
// THE BUDGET IT IS LAID OUT AGAINST (RI-UIX01 §C), stated here because the geometry below is
// the answer to it and nothing else:
//   * ≤6 persistent elements. There are exactly 6: health, stamina, focus, heal charges,
//     quick slots, equip load.
//   * ≤4.0% of 1920×1080 for the union of those six. Measured: see `tools/analysis/ui-census.mjs`.
//   * 0.0% in the central 50%×50%. Everything is pinned to a screen edge and the centre box is
//     x∈[480,1440], y∈[270,810] at 1080p; the closest element to it is the health bar's right
//     end at x=442.
//   * ≤1 numeric text. The heal-charge count is the one. The equip-load indicator is therefore
//     a bone gauge with a notch and NOT a percentage — a percentage there would be the second
//     numeral and would also be RI-UIX06 G8.
//   * exactly one world-anchored element: the lock-on reticle.
//
// THE STAMINA BAR IS NOT DECORATION (RI-UIX01 §D). `fill` is `player.stamina / staminaMax` read
// on the frame being drawn, with no tween, no lerp and no easing anywhere in this file — D1 is
// "100% of frames within ±0.005" and is stated absolutely on purpose. The one piece of state the
// bar keeps is `spentFrom`, the level stamina stood at when the current regen block began, and
// that is read off `player.regenBlockUntil` rather than inferred, so it cannot drift from the
// simulation either.
'use strict';

import { C, Ca, BARS, BUILDUP, panel, chitinPath, boneRule, bonePip, resinFill, idHash, jitter } from './theme.js';
import { drawText, faceOf, measure, wrap, ellipsise } from './type.js';

/** 1080p geometry, scaled by `s`. Everything is expressed here so the budget is auditable. */
const L = {
  margin: 42,
  barX: 42, barY: 40,
  barW: 400,
  healthH: 16, staminaH: 10, focusH: 10,
  gap: 8,
  pipsY: 118, pipsW: 110, pipsH: 24,
  buildupY: 158, buildupW: 240, buildupH: 12, buildupGap: 6,
  slotBox: 150,
  loadW: 120, loadH: 24,
  bossW: 900, bossH: 34, bossY: 962,
  promptW: 200, promptH: 32, promptY: 830,
  toastW: 400, toastH: 48, toastY: 40,
  reticle: 48,
};

/**
 * Draw the HUD and declare every element.
 *
 * @param {UISurface} S
 * @param {object} m the HUD model — a pure read of the simulation, assembled by ui/system.js
 */
export function drawHUD(S, m) {
  const s = S.s, W = S.W;
  const seed = 20211;

  // ---- E1 health -------------------------------------------------------------------------
  bar(S, {
    id: 'hud.health', kind: 'health_bar', seed,
    x: L.barX * s, y: L.barY * s, w: L.barW * s, h: L.healthH * s,
    frac: m.hpFrac, spec: BARS.health,
  });

  // ---- E2 stamina. §D lives here. ----------------------------------------------------------
  const staY = (L.barY + L.healthH + L.gap) * s;
  bar(S, {
    id: 'hud.stamina', kind: 'stamina_bar', seed: seed + 1,
    x: L.barX * s, y: staY, w: L.barW * s, h: L.staminaH * s,
    frac: m.staFrac, spec: BARS.stamina,
    // D2: while regen is blocked, the trough between the current level and the level stamina
    // stood at when it was spent is drawn INK rather than bone — a 10.9:1 change in the same
    // pixels, present only in the blocked state and draining as the delay elapses.
    spentFrom: m.regenBlocked ? m.spentFrom : null,
    // D6: at 0 the whole trough is ink. A third state, distinct from both the others.
    exhausted: m.staFrac <= 0,
    meta: { regen_blocked: !!m.regenBlocked, exhausted: m.staFrac <= 0 },
  });

  // ---- E3 focus (S19). Present whenever the build can cast. --------------------------------
  if (m.canCast) {
    bar(S, {
      id: 'hud.focus', kind: 'focus_bar', seed: seed + 2,
      x: L.barX * s, y: (L.barY + L.healthH + L.gap + L.staminaH + L.gap) * s,
      w: L.barW * s, h: L.focusH * s,
      frac: m.focusFrac, spec: BARS.focus, resin: true,
    });
  }

  // ---- E4 heal charges. The one numeral on screen during a fight. --------------------------
  S.el({
    id: 'hud.heal', kind: 'heal_charges',
    rect: [L.barX * s, L.pipsY * s, L.pipsW * s, L.pipsH * s],
    text: String(m.estus), fill: m.estusMax ? m.estus / m.estusMax : 0,
    meta: { charges: m.estus, max: m.estusMax },
  }, (c, r) => {
    // a gourd, drawn, not a flask pictogram (A6)
    const gx = r[0] + 12 * s, gy = r[1] + r[3] * 0.5;
    c.save();
    c.beginPath();
    c.moveTo(gx - 3 * s, gy - 9 * s);
    c.quadraticCurveTo(gx - 10 * s, gy - 1 * s, gx - 7 * s, gy + 7 * s);
    c.quadraticCurveTo(gx, gy + 12 * s, gx + 7 * s, gy + 7 * s);
    c.quadraticCurveTo(gx + 10 * s, gy - 1 * s, gx + 3 * s, gy - 9 * s);
    c.closePath();
    c.fillStyle = Ca('clay_dark', 0.92); c.fill();
    c.strokeStyle = C('bone_dim'); c.lineWidth = 1.6 * s; c.stroke();
    c.beginPath();
    c.moveTo(gx - 3 * s, gy - 9 * s); c.lineTo(gx - 3 * s, gy - 12 * s);
    c.lineTo(gx + 3 * s, gy - 12 * s); c.lineTo(gx + 3 * s, gy - 9 * s);
    c.strokeStyle = C('root'); c.lineWidth = 3 * s; c.stroke();
    c.restore();
    drawText(c, String(m.estus), r[0] + 30 * s, r[1] + r[3] * 0.5 + 7 * s,
      faceOf('bone'), 20 * s, C('bone'));
  });

  // ---- E9 equip load. No numeral: a bone gauge with a notch at the roll-class boundary. -----
  const loadX = W - (L.margin + L.loadW) * s;
  const loadY = S.H - (L.margin + L.slotBox + 12 + L.loadH) * s;
  S.el({
    id: 'hud.equipload', kind: 'equip_load',
    rect: [loadX, loadY, L.loadW * s, L.loadH * s],
    fill: m.equipLoadPct / 100,
    text: m.rollClass,
    meta: { roll_class: m.rollClass, pct: m.equipLoadPct },
  }, (c, r) => {
    boneRule(c, r[0], r[1] + r[3] * 0.62, r[2], s, 4411);
    const f = Math.max(0, Math.min(1, m.equipLoadPct / 100));
    c.beginPath();
    c.moveTo(r[0], r[1] + r[3] * 0.62);
    c.lineTo(r[0] + r[2] * f, r[1] + r[3] * 0.62);
    c.strokeStyle = C('root'); c.lineWidth = 4 * s; c.stroke();
    // the three roll-class boundaries, cut into the bone
    for (const b of [0.30, 0.70, 1.0]) {
      c.beginPath();
      c.moveTo(r[0] + r[2] * b, r[1] + r[3] * 0.30);
      c.lineTo(r[0] + r[2] * b, r[1] + r[3] * 0.90);
      c.strokeStyle = Ca('bone_dim', 0.8); c.lineWidth = 1.6 * s; c.stroke();
    }
    drawText(c, m.rollClass, r[0], r[1] + r[3] * 0.30, faceOf('bone'), 11 * s, C('bone_dim'));
  });

  // ---- E5 quick slots: left hand, right hand, item, spell ----------------------------------
  const qx = W - (L.margin + L.slotBox) * s, qy = S.H - (L.margin + L.slotBox) * s;
  S.el({
    id: 'hud.quickslots', kind: 'quick_slots',
    rect: [qx, qy, L.slotBox * s, L.slotBox * s],
    text: [m.slots.left, m.slots.right, m.slots.item, m.slots.spell].filter(Boolean).join(' / ') || null,
    meta: { ...m.slots },
  }, (c, r) => {
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2, k = 34 * s;
    const put = (dx, dy, label, active, i) => {
      const x = cx + dx * k - 27 * s, y = cy + dy * k - 20 * s;
      chitinPath(c, x, y, 54 * s, 40 * s, s, 900 + i);
      c.fillStyle = Ca('chitin_dark', 0.62); c.fill();
      c.strokeStyle = Ca(active ? 'shell_lit' : 'root', active ? 0.85 : 0.55);
      c.lineWidth = 2 * s; c.stroke();
      if (label) {
        const f = faceOf('bone'), sz = 11 * s;
        const t = label.length > 9 ? label.slice(0, 8) + '…' : label;
        drawText(c, t, x + 27 * s - measure(t, f, sz) / 2, y + 25 * s, f, sz, C('bone'));
      }
    };
    put(-1, 0, m.slots.left, m.slots.leftActive, 0);
    put(1, 0, m.slots.right, m.slots.rightActive, 1);
    put(0, -1, m.slots.spell, false, 2);
    put(0, 1, m.slots.item, false, 3);
  });

  // ---- E6 status buildup, only while > 0, at most 3 ----------------------------------------
  const ups = (m.buildups || []).filter((b) => b.value > 0).slice(0, 3);
  ups.forEach((b, i) => {
    const y = (L.buildupY + i * (L.buildupH + L.buildupGap)) * s;
    S.el({
      id: 'hud.buildup.' + b.kind, kind: 'buildup_meter',
      rect: [L.barX * s, y, L.buildupW * s, L.buildupH * s],
      fill: b.value, text: null, meta: { kind: b.kind },
    }, (c, r) => {
      c.fillStyle = C(BUILDUP.trough); c.fillRect(r[0], r[1], r[2], r[3]);
      resinFill(c, r[0], r[1], r[2] * Math.min(1, b.value), r[3], s, BUILDUP[b.kind] || 'ink_soft');
      chitinPath(c, r[0], r[1], r[2], r[3], s, 3300 + i);
      c.strokeStyle = C('chitin'); c.lineWidth = 2 * s; c.stroke();
    });
  });

  // ---- E7 lock-on reticle. THE ONLY world-anchored element in the game. ---------------------
  if (m.lockOn && m.lockOn.screen) {
    const rr = L.reticle * s;
    S.el({
      id: 'hud.lockon', kind: 'lockon_reticle',
      rect: [m.lockOn.screen[0] - rr / 2, m.lockOn.screen[1] - rr / 2, rr, rr],
      worldAnchor: m.lockOn.eid,
    }, (c, r) => {
      const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
      // shell inlay: nacreous, catching the light along one axis
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.4;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * r[2] * 0.20, cy + Math.sin(a) * r[3] * 0.20);
        c.lineTo(cx + Math.cos(a) * r[2] * 0.44, cy + Math.sin(a) * r[3] * 0.44);
        c.strokeStyle = i % 2 ? Ca('shell_lit', 0.95) : Ca('shell', 0.7);
        c.lineWidth = 2.4 * s; c.lineCap = 'round'; c.stroke();
      }
      c.beginPath(); c.arc(cx, cy, r[2] * 0.10, 0, Math.PI * 2);
      c.fillStyle = Ca('bone_bright', 0.9); c.fill();
    });
  }

  // ---- E8 boss bar, only in a fog-gated fight ----------------------------------------------
  if (m.boss) {
    const bx = (W - L.bossW * s) / 2;
    S.el({
      id: 'hud.boss', kind: 'boss_bar',
      rect: [bx, L.bossY * s, L.bossW * s, L.bossH * s],
      fill: m.boss.frac, text: m.boss.name,
    }, (c, r) => {
      c.fillStyle = C(BARS.boss.trough); c.fillRect(r[0], r[1] + r[3] * 0.42, r[2], r[3] * 0.40);
      c.fillStyle = C(BARS.boss.fill);
      c.fillRect(r[0], r[1] + r[3] * 0.42, r[2] * Math.max(0, Math.min(1, m.boss.frac)), r[3] * 0.40);
      chitinPath(c, r[0], r[1] + r[3] * 0.36, r[2], r[3] * 0.52, s, 7777);
      c.strokeStyle = C('chitin'); c.lineWidth = 2.4 * s; c.stroke();
      const f = faceOf('bone'), sz = 15 * s;
      drawText(c, m.boss.name, r[0] + r[2] / 2 - measure(m.boss.name, f, sz) / 2, r[1] + r[3] * 0.28, f, sz, C('bone'));
    });
  }

  // ---- E10 interact prompt. Range-gated: X12 forbids a prompt on something out of range. ----
  if (m.prompt) {
    S.el({
      id: 'hud.prompt', kind: 'interact_prompt',
      rect: [(W - L.promptW * s) / 2, L.promptY * s, L.promptW * s, L.promptH * s],
      text: m.prompt.text,
      // RI-JRN04 L7. The glyph is declared so M-P14 can read which device the affordance is
      // drawn for without a pixel diff, and the pixel diff still has to agree with it.
      meta: { range_m: m.prompt.range_m, device: m.prompt.device || 'keyboard', glyph: m.prompt.glyph || 'keycap' },
    }, (c, r) => {
      const f = faceOf('bone'), sz = 15 * s;
      const gw = 22 * s;
      // W1-HUD-TOAST-A. The census (tools/analysis/hud-toast-corpus.mjs) found 130 of 1309
      // reachable prompt names (readable-prop titles, mostly) wider than the ~169 px this label
      // has after the device glyph — a name, drawn as one line with no wrap and no truncation of
      // any kind, is the same defect the toast had. A prompt is one line by design (RI-UIX01 §C's
      // "small and permanent"), so it is ellipsised rather than wrapped.
      const budget = r[2] - gw * 1.4;
      const t = ellipsise(m.prompt.text, f, sz, budget);
      const tw = measure(t, f, sz);
      const x0 = r[0] + r[2] / 2 - (tw + gw * 1.4) / 2;
      deviceGlyph(c, m.prompt.glyph || 'keycap', x0 + gw * 0.5, r[1] + r[3] * 0.60, gw * 0.5, s);
      drawText(c, t, x0 + gw * 1.4, r[1] + r[3] * 0.72, f, sz, C('bone'));
      boneRule(c, r[0] + r[2] * 0.22, r[1] + r[3] * 0.90, r[2] * 0.56, s, 88);
    });
  }

  // ---- E11 toast. Never during a fight (RI-UIX01 §C counts it separately and §C fails a
  // build showing one in an active fight), and never carrying quest state (RI-UIX04 Q11).
  if (m.toast && !m.inCombat) {
    // W1-20: THE TOAST WRAPS NOW, and it did not before.
    //
    // The panel is 400 units wide and the line was drawn centred on it in one run with no
    // wrapping and no truncation, so any string wider than the parchment spilled out of both
    // ends of it. Measured on the shipped renderer at 1920x1080: a 115-character sentence
    // measures 676 px against a 400 px panel, and `getRenderedText()` reports it `clipped:
    // false` — because nothing clipped it. It simply ran off the paper at both ends, and from
    // the chair that is a sentence with its first four words and its last five missing.
    //
    // Found while photographing a faction refusal, which is the longest thing this channel has
    // ever been asked to carry, but it is not a faction defect: every equip refusal
    // (`_sayEquip`) and every cast refusal in the build goes through the same element. A short
    // toast is unaffected — one line, same rect, same coverage — so this is additive.
    // W1-HUD-TOAST-A. The greedy wrap above was a SECOND implementation of `ui/type.js`'s
    // `wrap()`/`ellipsise()` (rule 10) — hud.js already imported `measure`/`drawText`/`faceOf`
    // from that same file. Two defects rode along with the duplication, both named CARRIED by
    // the plan critic and both closed here:
    //  1. `wrap()` does not shorten a single word wider than `maxW` either — it emits it as its
    //     own over-wide row, identically to the inline copy. Every row is `ellipsise()`'d
    //     explicitly after wrapping, so an over-wide word is truncated with a mark rather than
    //     drawn past the panel edge. Not reachable by today's data (widest word in any
    //     `game/data` name is 129.0 px against this 376 px budget — see
    //     `reports/w1-hud-toast-a/corpus.json`) but it is unreachable-by-data, not correct.
    //  2. `wrap()` calls `normalise()` (good — A3 compares against `normalise(T)`) and splits on
    //     `\n`, emitting `''` for a blank paragraph. A toast is one paragraph; blank rows are
    //     dropped rather than counted, so a stray blank line cannot change `row_count` and, with
    //     it, the panel height and the 3-row ellipsis ceiling.
    const f = faceOf('ink'), sz = 16 * s;
    const maxW = (L.toastW - 24) * s;
    let wrapped = wrap(String(m.toast.text), f, sz, maxW).filter((row) => row.length > 0);
    if (!wrapped.length) wrapped = [''];
    // Three lines is the ceiling. RI-UIX04 Q11 keeps this channel small on purpose, and a toast
    // that grows without bound is a quest log wearing a parchment. A fourth-plus row is dropped.
    const ceilingHit = wrapped.length > 3;
    if (ceilingHit) wrapped = wrapped.slice(0, 3);
    // Every row is `ellipsise()`'d: the third row (if the ceiling fired) is FORCED to end in an
    // ellipsis even though it already fits `maxW` — the marker itself can push an exactly-fitting
    // row over budget, so the same shrink loop `ellipsise()` uses for "doesn't fit" is reused
    // rather than re-appending '…' raw. Every other row only shrinks if it is itself over `maxW`
    // (CARRIED-1: a single word wider than the budget, which `wrap()` does not shorten).
    const rows = wrapped.map((row, i) => ellipsise(row, f, sz, maxW, { force: ceilingHit && i === wrapped.length - 1 }));
    // A3's escape hatch: no silent loss unless `truncated` is set. Silent loss now has two
    // distinct causes and both must set it — the 3-row ceiling (`ceilingHit`) AND a per-row
    // shrink from an over-wide single word, which `rows.join(' ') === normalise(T)` alone would
    // not catch on its own (row 1 or 2 can lose text without the ceiling ever firing).
    const rowShortened = rows.some((row, i) => row !== wrapped[i]);
    const truncated = ceilingHit || rowShortened;
    const lineH = 20 * s;
    const h = Math.max(L.toastH * s, rows.length * lineH + 20 * s);
    const widest = rows.reduce((a, t) => Math.max(a, measure(t, f, sz)), 0);
    S.el({
      id: 'hud.toast', kind: 'toast',
      rect: [(W - L.toastW * s) / 2, L.toastY * s, L.toastW * s, h],
      text: m.toast.text, opacity: 0.92,
      // The measurement that was missing. `render/text-register.js` records the draw CALL, so a
      // run that ran off both ends of the paper came back `clipped: false` and every probe in the
      // tree read it as legible. These three numbers are the fit itself, so a check can assert
      // `widest <= max_w` and a broken wrap goes red in a tool rather than in a screenshot.
      // The RAW measurement only. `fits` is deliberately NOT computed here: the first version
      // judged the fit against `maxW`, the same variable the wrapper uses, so breaking the
      // wrapper moved the yardstick with it and the check stayed green on a line that ran 823 px
      // across a 400 px panel. ui/system.js now derives `fits` from the element's own RECT,
      // which the wrapper does not set.
      meta: { rows: rows.slice(), row_count: rows.length, widest_px: +widest.toFixed(1), wrap_budget: +maxW.toFixed(1), truncated },
    }, (c, r) => {
      panel(c, 'parchment', r[0], r[1], r[2], r[3], s, 4242, 0.86);
      const top = r[1] + (r[3] - rows.length * lineH) / 2 + lineH * 0.72;
      for (let i = 0; i < rows.length; i++) {
        drawText(c, rows[i], r[0] + r[2] / 2 - measure(rows[i], f, sz) / 2, top + i * lineH, f, sz, C('ink'));
      }
    });
  }

  // ---- the journal glyph: RI-UIX04 Q11's narrow exemption. One glyph, no words, ≤3 s. -------
  if (m.entryGlyph) {
    S.el({
      id: 'hud.entryglyph', kind: 'entry_glyph',
      rect: [W - 74 * s, 40 * s, 32 * s, 32 * s], text: null,
    }, (c, r) => {
      const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
      // a reed nib. It says something was written. It never says what.
      c.beginPath();
      c.moveTo(cx - 6 * s, cy + 9 * s); c.lineTo(cx + 3 * s, cy - 9 * s);
      c.lineTo(cx + 7 * s, cy - 7 * s); c.lineTo(cx - 2 * s, cy + 11 * s);
      c.closePath();
      c.fillStyle = Ca('bone', 0.85); c.fill();
      c.strokeStyle = Ca('ink', 0.6); c.lineWidth = 1.2 * s; c.stroke();
    });
  }
}

/**
 * One bar: a bone trough that a resource fills, in a chitin housing.
 *
 * The trough is LIGHT and the fill is DARK, which is the arrangement D3 needs and the opposite
 * of the usual one. Bright-fill-on-black puts crimson (L 0.077) on near-black (L 0.009) at
 * 2.17:1 and fails D3's 4.5:1 outright; a blood fill in a bone trough is 6.35:1. The housing is
 * opaque near-black with a bone rim, so "bar vs background ≥3.0:1" holds against a bright
 * firelit interior (the housing carries it) and against night in the Deep Marshes (the rim
 * does) without either case needing a different design.
 */
function bar(S, o) {
  const s = S.s;
  const frac = Math.max(0, Math.min(1, Number(o.frac) || 0));
  S.el({
    id: o.id, kind: o.kind,
    rect: [o.x, o.y, o.w, o.h],
    fill: +frac.toFixed(6),
    meta: o.meta,
  }, (c, r) => {
    const [x, y, w, h] = r;
    // housing
    chitinPath(c, x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s, s, o.seed);
    c.fillStyle = Ca('chitin_dark', 0.88); c.fill();
    c.strokeStyle = Ca('bone_dim', 0.85); c.lineWidth = 1.8 * s; c.stroke();
    // trough
    c.fillStyle = C(o.exhausted && o.spec.exhaustedTrough ? o.spec.exhaustedTrough : o.spec.trough);
    c.fillRect(x, y, w, h);
    // the spent band (D2)
    if (o.spentFrom !== null && o.spentFrom !== undefined && o.spentFrom > frac) {
      c.fillStyle = C(o.spec.spent);
      c.fillRect(x + w * frac, y, w * (o.spentFrom - frac), h);
    }
    // the fill
    if (frac > 0) {
      if (o.resin) resinFill(c, x, y, w * frac, h, s, o.spec.fill);
      else { c.fillStyle = C(o.spec.fill); c.fillRect(x, y, w * frac, h); }
    }
    // a bone tick every quarter, cut into the trough — reading a threshold without a numeral
    for (let i = 1; i < 4; i++) {
      c.beginPath();
      c.moveTo(x + (w * i) / 4, y); c.lineTo(x + (w * i) / 4, y + h);
      c.strokeStyle = Ca('bone_dim', 0.45); c.lineWidth = 1.2 * s; c.stroke();
    }
  });
}

/**
 * RI-JRN04 L7 — the device affordance beside an interaction prompt.
 *
 * THREE MARKS, NO LETTERS. This is the one place in the game where the interface is allowed to
 * say something about the control, and RI-JRN03 DS5 makes it legal only because it is a
 * picture: a key cap, a face button, a fingertip. The instant it becomes the letter `E` it is
 * an instruction (M-K22), it is wrong for a gamepad player (L7), and it is wrong again for
 * anyone playing on a layout where that key is not where the label says.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {'keycap'|'face_button'|'fingertip'} kind
 */
export function deviceGlyph(c, kind, cx, cy, r, s) {
  c.save();
  c.lineWidth = Math.max(1, 1.6 * s);
  c.strokeStyle = Ca('bone', 0.85);
  c.fillStyle = Ca('bone', 0.16);
  if (kind === 'face_button') {
    c.beginPath(); c.arc(cx, cy, r * 0.86, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(cx, cy, r * 0.40, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'fingertip') {
    // a fingertip on glass: the pad, and the ring of the press
    c.beginPath(); c.ellipse(cx, cy + r * 0.12, r * 0.46, r * 0.62, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(cx, cy + r * 0.12, r * 0.92, 0, Math.PI * 2);
    c.strokeStyle = Ca('bone', 0.45); c.stroke();
  } else {
    // a key cap, seen slightly from above: a rounded top face over a short skirt
    const w = r * 1.5, h = r * 1.25;
    c.beginPath();
    c.moveTo(cx - w / 2, cy - h / 2); c.lineTo(cx + w / 2, cy - h / 2);
    c.lineTo(cx + w / 2, cy + h * 0.20); c.lineTo(cx - w / 2, cy + h * 0.20);
    c.closePath(); c.fill(); c.stroke();
    c.beginPath();
    c.moveTo(cx - w / 2, cy + h * 0.20); c.lineTo(cx - w * 0.36, cy + h / 2);
    c.lineTo(cx + w * 0.36, cy + h / 2); c.lineTo(cx + w / 2, cy + h * 0.20);
    c.strokeStyle = Ca('bone', 0.55); c.stroke();
  }
  c.restore();
}

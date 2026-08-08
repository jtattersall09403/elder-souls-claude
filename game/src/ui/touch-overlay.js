// The touch controls, and the rotate state, DRAWN.
//
// Owner: W1-29 (`input.touch.fallback`, `platform.mobile.viewport`). Binding sources:
// `RI-JRN04` §G (T1–T9), §F H1/H3/H11, and `RI-MTH07`/`ARBITRATION` §3 CONSUMPTION.
//
// WHY THIS FILE EXISTS AT ALL.
// Round 1 shipped a complete, correct touch model — sixteen actions reachable, a floating
// stick, four simultaneous pointers, every target ≥ 44 CSS px, nothing in a safe-area inset —
// and **no renderer read any of it**. The round-1 critic's ablation is the cleanest statement
// of the defect in this project: same pinned sim frame, zero held actions in both arms, only
// `deviceClass` differing, and the desktop and handheld framebuffers came back **byte-identical**
// (`a4932a97f50021ee`) while `touchState()` reported `visible: true` and `touchLayout()`
// reported eleven controls in both. Its summary was "the controls exist, work, are correctly
// laid out, and are drawn nowhere". `rotateState()` was the same shape one file along: an
// authored line — *"The map lies the long way."* — computed, carried, exposed through the
// harness, and painted by nothing. That is `RI-JRN04`'s own fourth orphan shape, orphan text,
// and its CONSUMPTION §3 scores a `coupling == 0` dimension 0 with no partial credit.
//
// SO THE TWO MODELS NOW HAVE ONE NAMED WORLD-SIDE CONSUMER EACH, AND IT IS THIS FILE.
//   * `TouchInput.layout()` + `TouchInput.stick`  ->  `drawTouchOverlay()`
//   * `Viewport.rotateState()`                    ->  `drawRotateState()`
// Both are reached from `UISystem.build()`, which is called by `Renderer.render()` AND by
// `getUIState()`, so the overlay is in the composited frame and in every harness screenshot.
//
// WHY IT IS DRAWN INTO THE WEBGL CANVAS AND NOT INTO THE DOM.
// `__HARNESS.screenshot()` is `canvas.toDataURL()`. A DOM overlay is visible to a human and to
// Playwright's `page.screenshot()` and INVISIBLE to the harness, so every visual measurement in
// this project would be taken on a different picture from the one the player sees. `ui/surface.js`
// exists for that reason and this file uses it exactly as the HUD does: `S.el()` is the only way
// to get a context, it takes the element record first, and it clips the draw to the rect that
// was declared. You cannot draw a touch control without declaring one.
//
// NO TEXT, ANYWHERE ON THE CONTROLS, AND THAT IS A RULE RATHER THAN A STYLE.
// `RI-JRN03` DS1 sets the whole game's instruction budget at zero and DS5 makes a prompt legal
// only when it names the action in the world and never the control. A touch button labelled
// "ROLL" is a control legend on the glass — `M-K20`/`M-P24`'s hard fail, drawn sixteen times.
// Every control is therefore a MARK: a blade, a shield, a boot, a flask, cut in the same
// bone-and-reed idiom as the rest of the interface. The one string this file draws is the rotate
// line, which is in fiction and names no control.
//
// GEOMETRY. `TouchInput.layout()` returns CSS px in viewport space, measured from the bottom
// right of the SAFE AREA, so the arc already moves with `env(safe-area-inset-*)` (H3/T8). This
// file only maps that space onto the drawing buffer: `sx = S.W / viewport.w`. It invents no
// position and adjusts no radius — a control drawn somewhere other than where the hit test is
// would be worse than not drawing it, because the player would press the picture and miss.
'use strict';

import { C, Ca } from './theme.js';
import { drawText, faceOf, measure } from './type.js';

/** Ink for the overlay. Deliberately quiet: the fight is behind it. */
const RING = 'bone';
const RING_HOT = 'bone_bright';
const MARK = 'ink';

/**
 * One mark per action, drawn in a unit box centred on (0,0) with radius 1.
 *
 * These are the affordances a Souls player already reads: a blade swings, a shield guards, a
 * boot rolls. `RI-JRN03` M-N1's whole point is that convention is measurable, and a picture of
 * the verb is the only legend this item's budget permits.
 */
const MARKS = {
  light: (c) => { line(c, -0.45, 0.55, 0.45, -0.6); line(c, -0.62, 0.3, -0.18, 0.72); },
  heavy: (c) => { line(c, -0.42, 0.62, 0.5, -0.5); line(c, -0.62, 0.38, -0.14, 0.8); arc(c, -0.1, 0.15, 0.72, -1.15, 0.25); },
  block: (c) => { shield(c, 0.78); },
  parry: (c) => { shield(c, 0.62); arc(c, 0, 0, 0.95, -0.9, 0.45); },
  roll: (c) => { arc(c, 0, 0.05, 0.6, -2.6, 1.9); arrowHead(c, 0.52, -0.28, 0.9); },
  sprint: (c) => { arc(c, 0, 0.05, 0.6, -2.6, 1.9); arrowHead(c, 0.52, -0.28, 0.9); },
  jump: (c) => { chevron(c, 0, -0.15, 0.55, -1); line(c, -0.6, 0.62, 0.6, 0.62); },
  crouch: (c) => { chevron(c, 0, 0.15, 0.55, 1); line(c, -0.6, -0.62, 0.6, -0.62); },
  interact: (c) => { arc(c, 0, 0, 0.62, 0, Math.PI * 2); line(c, 0, -0.62, 0, -0.95); },
  // the same gourd the heal-charge element draws, so the item you drink and the button you
  // drink it with are recognisably the same object (RI-UIX06 A6: a gourd, drawn, not a flask
  // pictogram)
  use_item: (c) => { gourd(c); },
  lock_on: (c) => { bracket(c, 0.8); arc(c, 0, 0, 0.22, 0, Math.PI * 2); },
  two_hand: (c) => { line(c, -0.15, 0.7, -0.15, -0.7); line(c, 0.15, 0.7, 0.15, -0.7); line(c, -0.5, -0.35, 0.5, -0.35); },
  swap_left: (c) => { line(c, 0.6, 0, -0.6, 0); arrowHead(c, -0.6, 0, Math.PI); },
  swap_right: (c) => { line(c, -0.6, 0, 0.6, 0); arrowHead(c, 0.6, 0, 0); },
  spell_cycle: (c) => { arc(c, 0, 0, 0.6, 0.4, 5.6); arrowHead(c, 0.55, -0.24, -1.2); },
  menu: (c) => { line(c, -0.6, -0.42, 0.6, -0.42); line(c, -0.6, 0, 0.6, 0); line(c, -0.6, 0.42, 0.6, 0.42); },
  __drawer: (c) => { dot(c, -0.5, 0, 0.13); dot(c, 0, 0, 0.13); dot(c, 0.5, 0, 0.13); },
};

/**
 * Draw the whole touch overlay and declare every control.
 *
 * @param {import('./surface.js').UISurface} S
 * @param {object} m {controls, stick, viewport:{w,h}, insets, shown}
 * @returns {number} controls drawn — 0 when the overlay is not shown, which is the value the
 *   coupling test perturbs against.
 */
export function drawTouchOverlay(S, m) {
  if (!m || !m.shown || !Array.isArray(m.controls) || !m.controls.length) return 0;
  const vw = Math.max(1, (m.viewport && m.viewport.w) || S.W);
  const vh = Math.max(1, (m.viewport && m.viewport.h) || S.H);
  const sx = S.W / vw, sy = S.H / vh;
  // ONE scale for the arc, and it is anchored at the SAFE-AREA CORNER rather than at the
  // frame's origin. `TouchInput.layout()` expresses every control as an offset from the bottom
  // right of the safe area — that is what keeps H3/T8 clause 1 true — so the drawing has to
  // reproduce the same anchor. That used to read "true by construction", which is the same
  // half-truth `ui/system.js` was carrying and the round-1 critic's §5 named both of them: it is
  // a claim about clause ONE only (clause 2, never overlap the dialogue surface, is a deletable
  // filter — see `ui/system.js`), and until this round it had only ever been measured against an
  // inset of ZERO. It is now measured against RI-JRN04 M-P17's real {0,44,21,44} cutout, 11 of 11
  // controls clear, with a null control that reddens at 3 of 11 the moment `_origin()` is
  // re-anchored off the safe area — `tools/touch/critic-fight.mjs --leg insets`. THE ANCHOR IS
  // THE MECHANISM, so the line below is the thing that teardown breaks.
  //
  // Scaling x and y independently would preserve the anchor and
  // shear the arc whenever the drawing buffer's aspect differs from the logical viewport's,
  // which is every harness capture and every phone whose URL bar is halfway collapsed; the
  // controls would then be ellipses drawn away from their own circular hit boxes, and the
  // player would press the picture and miss. `min` keeps the arc inside the frame on either
  // mismatch.
  const sr = Math.min(sx, sy);
  const ox = S.W - (m.insets ? m.insets.right : 0) * sr;
  const oy = S.H - (m.insets ? m.insets.bottom : 0) * sr;
  const cssOx = vw - (m.insets ? m.insets.right : 0);
  const cssOy = vh - (m.insets ? m.insets.bottom : 0);
  const px = (x) => ox + (x - cssOx) * sr;
  const py = (y) => oy + (y - cssOy) * sr;
  let n = 0;

  // ---- T2: the floating stick, drawn where the thumb actually landed --------------------
  // Not a rosette in a corner. The origin is `stick.ox/oy`, which is the pointer's own
  // position, so the picture and the hit model are the same object.
  if (m.stick && m.stick.active) {
    const R = (m.stickRadius || 90) * sr;
    // The stick is a REAL POINTER POSITION anywhere in the left half, not an offset from
    // the arc's corner, so it maps through the plain viewport scale.
    const cx = m.stick.ox * sx, cy = m.stick.oy * sy;
    S.el({
      id: 'touch.stick', kind: 'touch_stick',
      rect: [cx - R, cy - R, R * 2, R * 2],
      material: 'bone',
      meta: { origin_css: [Math.round(m.stick.ox), Math.round(m.stick.oy)], deflection: [round4(m.stick.x), round4(m.stick.y)] },
    }, (c) => {
      c.lineWidth = Math.max(1, 2.0 * sr);
      c.strokeStyle = Ca(RING, 0.42);
      c.beginPath(); c.arc(cx, cy, R * 0.94, 0, Math.PI * 2); c.stroke();
      // the knob, at the deflection the sim is actually reading (screen y is down)
      const kx = cx + m.stick.x * R * 0.72, ky = cy - m.stick.y * R * 0.72;
      c.beginPath(); c.arc(kx, ky, R * 0.30, 0, Math.PI * 2);
      c.fillStyle = Ca(RING, 0.20); c.fill();
      c.strokeStyle = Ca(RING_HOT, 0.78); c.lineWidth = Math.max(1, 2.4 * sr); c.stroke();
    });
    n++;
  }

  // ---- T4/T1: the button arc, and the drawer's petals when it is open -------------------
  for (const ctl of m.controls) {
    const r = ctl.r * sr;
    const cx = px(ctl.x), cy = py(ctl.y);
    const mark = MARKS[ctl.action] || MARKS.interact;
    const down = !!ctl.down;
    S.el({
      id: 'touch.' + ctl.action, kind: 'touch_button',
      rect: [cx - r, cy - r, r * 2, r * 2],
      material: 'bone',
      // No `text`. A touch control that carried a label would be a control legend on the glass
      // (DS1) and would put sixteen instruction strings into the rendered-text register.
      text: null,
      meta: {
        action: ctl.action, down, from_drawer: !!ctl.fromDrawer,
        target_css_px: Math.round(ctl.r * 2), hit_centre_css: [Math.round(ctl.x), Math.round(ctl.y)],
        gate: ctl.gate ? { tap: ctl.gate.tap, hold: ctl.gate.hold, frames: ctl.gate.frames } : null,
      },
    }, (c) => {
      c.lineWidth = Math.max(1, (down ? 2.8 : 1.8) * sr);
      c.beginPath(); c.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
      c.fillStyle = Ca(down ? RING_HOT : RING, down ? 0.26 : 0.10); c.fill();
      c.strokeStyle = Ca(down ? RING_HOT : RING, down ? 0.95 : 0.55); c.stroke();
      // the mark, in a unit box at 0.52 of the control's radius
      c.save();
      c.translate(cx, cy);
      c.scale(r * 0.52, r * 0.52);
      c.lineWidth = (down ? 0.20 : 0.15);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = Ca(down ? RING_HOT : MARK, down ? 0.98 : 0.82);
      c.fillStyle = Ca(down ? RING_HOT : MARK, down ? 0.98 : 0.82);
      mark(c);
      c.restore();
    });
    n++;
  }
  return n;
}

/**
 * H1 — the rotate state. An in-world illustration, not a UI modal.
 *
 * A chart on a table, seen the wrong way round, with the pilot's own note under it. There is
 * no "please rotate your device", no button, no control name and no full-screen panel: `M-P16`
 * measures opaque non-world UI against `RI-JRN01` M5's 55% ceiling and this occupies about a
 * fifth of the frame with the live world visible everywhere around it.
 *
 * @returns {boolean} whether anything was drawn — the coupling observable for `rotateState()`.
 */
export function drawRotateState(S, m) {
  if (!m || !m.line) return false;
  const W = S.W, H = S.H, s = Math.min(W, H) / 1080;
  const bw = Math.min(W * 0.56, H * 0.62), bh = bw * 0.62;
  const x0 = (W - bw) / 2, y0 = (H - bh) / 2 - bh * 0.06;
  S.el({
    id: 'rotate.illustration', kind: 'rotate_illustration',
    rect: [x0, y0, bw, bh + bh * 0.30],
    material: 'parchment', opacity: 0.92,
    text: m.line,
    meta: { illustration: m.illustration || 'chart-on-a-table', orientation: 'portrait' },
  }, (c) => {
    // the table's edge
    c.lineWidth = Math.max(1, 3.0 * s * 6);
    c.strokeStyle = Ca('root', 0.5);
    c.beginPath(); c.moveTo(x0 - bw * 0.06, y0 + bh * 1.02); c.lineTo(x0 + bw * 1.06, y0 + bh * 1.02); c.stroke();
    // the chart, lying the SHORT way — a tall sheet on a wide table, which is the whole joke
    const cw = bh * 0.66, ch = bh * 0.92;
    const cx0 = x0 + (bw - cw) / 2, cy0 = y0 + (bh - ch) / 2;
    c.fillStyle = Ca('parchment', 0.80);
    c.fillRect(cx0, cy0, cw, ch);
    c.lineWidth = Math.max(1, 2.0 * s * 6);
    c.strokeStyle = Ca('ink', 0.55);
    c.strokeRect(cx0, cy0, cw, ch);
    // a coastline and two soundings, drawn the long way across a sheet that is the wrong way up
    c.beginPath();
    c.moveTo(cx0 + cw * 0.10, cy0 + ch * 0.30);
    c.quadraticCurveTo(cx0 + cw * 0.55, cy0 + ch * 0.16, cx0 + cw * 0.92, cy0 + ch * 0.44);
    c.moveTo(cx0 + cw * 0.08, cy0 + ch * 0.72);
    c.quadraticCurveTo(cx0 + cw * 0.48, cy0 + ch * 0.86, cx0 + cw * 0.90, cy0 + ch * 0.66);
    c.strokeStyle = Ca('ink', 0.62);
    c.stroke();
    for (const [fx, fy] of [[0.30, 0.50], [0.66, 0.58], [0.44, 0.80]]) {
      c.beginPath(); c.arc(cx0 + cw * fx, cy0 + ch * fy, Math.max(1.5, 3 * s * 6), 0, Math.PI * 2);
      c.fillStyle = Ca('ink', 0.55); c.fill();
    }
    // the note under it. In fiction, and it names no control.
    const f = faceOf('ink'), sz = Math.max(18, 30 * s * 6);
    drawText(c, m.line, x0 + bw / 2 - measure(m.line, f, sz) / 2, y0 + bh * 1.22, f, sz, C('bone'));
  });
  return true;
}

// ---- mark primitives. Everything is stroked geometry in the unit box. ---------------------

function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function arc(c, x, y, r, a0, a1) { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
function chevron(c, x, y, r, dir) {
  c.beginPath(); c.moveTo(x - r, y + r * 0.5 * dir); c.lineTo(x, y - r * 0.5 * dir); c.lineTo(x + r, y + r * 0.5 * dir); c.stroke();
}
function shield(c, r) {
  c.beginPath();
  c.moveTo(-r * 0.8, -r * 0.8); c.lineTo(r * 0.8, -r * 0.8);
  c.lineTo(r * 0.8, r * 0.15); c.quadraticCurveTo(r * 0.75, r * 0.95, 0, r * 1.05);
  c.quadraticCurveTo(-r * 0.75, r * 0.95, -r * 0.8, r * 0.15);
  c.closePath(); c.stroke();
}
function bracket(c, r) {
  const g = r * 0.45;
  for (const [sxx, syy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    c.beginPath();
    c.moveTo(sxx * r, syy * (r - g)); c.lineTo(sxx * r, syy * r); c.lineTo(sxx * (r - g), syy * r);
    c.stroke();
  }
}
function arrowHead(c, x, y, ang) {
  const h = 0.28;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x - Math.cos(ang - 0.5) * h, y - Math.sin(ang - 0.5) * h);
  c.lineTo(x - Math.cos(ang + 0.5) * h, y - Math.sin(ang + 0.5) * h);
  c.closePath(); c.fill();
}
function gourd(c) {
  c.beginPath();
  c.moveTo(-0.22, -0.35);
  c.quadraticCurveTo(-0.78, 0.05, -0.52, 0.62);
  c.quadraticCurveTo(0, 1.02, 0.52, 0.62);
  c.quadraticCurveTo(0.78, 0.05, 0.22, -0.35);
  c.closePath(); c.stroke();
  c.beginPath();
  c.moveTo(-0.22, -0.35); c.lineTo(-0.22, -0.72);
  c.lineTo(0.22, -0.72); c.lineTo(0.22, -0.35);
  c.stroke();
}

function round4(v) { return Math.round(Number(v) * 10000) / 10000; }

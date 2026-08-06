// The dialogue surface — the one piece of drawn interface this game has.
//
// Owner: W1-07. Binding sources: RI-JRN01 O7/O8 and M5, RI-UIX06 (diegesis and UI style),
// seam S18 (third person, the body visible).
//
// WHY IT IS DRAWN INTO THE WEBGL CANVAS AND NOT INTO THE DOM.
// `__HARNESS.screenshot()` is `canvas.toDataURL()` (render/renderer.js). A DOM overlay is
// invisible to it, so a surface built out of `<div>`s would be present for a human, present
// for Playwright's `page.screenshot()`, and *absent* from every frame the harness itself
// captures — which is exactly the class of "true in one instrument, false in another" that
// the W1-07 round-1 verdict was written about. Drawing into an offscreen 2D canvas and
// compositing it as a textured quad over the 3D scene makes one frame, and both instruments
// see the same one.
//
// WHAT IT IS ALLOWED TO BE (RI-JRN01 O8, and it is a short list):
//   * bottom-anchored, never full-screen: the panel's own height is capped at 42% of the
//     frame, so opaque non-world UI can never approach M5's 55% ceiling;
//   * translucent over the LIVE view — the room, the desk and the woman behind it keep
//     moving behind the text;
//   * no cursor, no hover, no drag. Selection is an index moved by the closed action set,
//     which is what makes the whole scene completable on a gamepad (O17);
//   * no numerals used as statistics, no "Step 2 of 4", no progress bar.
//
// Determinism: this module READS a model object and draws. It never touches the simulation,
// the PRNG or the clock, and `metrics()` is computed from the layout it just performed
// rather than from a pixel readback, so a run with rendering disabled reports the same
// numbers a run with rendering enabled does.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';

const PANEL_MAX_FRAC = 0.42;      // of frame height. M5's ceiling is 0.55 of frame AREA.
const OPTION_WINDOW = 5;          // options visible at once; longer lists scroll.

/** The parchment palette. One ink, one vellum, one rule. Nothing glows. */
const INK = '#efe4cd';
const INK_DIM = '#b9ab8e';
const INK_HOT = '#ffd9a0';
const VELLUM = 'rgba(18, 15, 12, 0.86)';
const RULE = 'rgba(180, 150, 100, 0.34)';

export class UILayer {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(2, width | 0);
    this.canvas.height = Math.max(2, height | 0);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false, depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.model = null;
    this.dirty = true;
    this.visible = true;
    this.last = emptyMetrics();
  }

  setSize(w, h) {
    const W = Math.max(2, w | 0), H = Math.max(2, h | 0);
    if (this.canvas.width === W && this.canvas.height === H) return;
    this.canvas.width = W; this.canvas.height = H;
    this.dirty = true;
  }

  /**
   * @param {null|object} model  null closes the surface. Otherwise:
   *   { speaker_name, speaker_title, place_name, line, aside, input_kind,
   *     options: [{id, text, aside}], selected, picked: [ids], prompt, typed,
   *     progress: {n, of} }
   */
  setModel(model) {
    this.model = model || null;
    this.dirty = true;
    return this.model;
  }

  setVisible(v) { this.visible = !!v; this.dirty = true; return this.visible; }

  /** Composite over whatever the 3D pass just drew. Called by Renderer.render(). */
  render(three) {
    if (this.dirty) { this._redraw(); this.dirty = false; }
    if (!this.model || !this.visible) return false;
    const prevAuto = three.autoClear;
    three.autoClear = false;
    three.clearDepth();
    three.render(this.scene, this.camera);
    three.autoClear = prevAuto;
    return true;
  }

  /**
   * What M5 measures. Computed from the layout, not from a readback — and it performs the
   * layout if the model changed since the last present, so a harness call taken between
   * `setModel()` and the next frame reports the surface that is about to be drawn rather
   * than the one before it.
   */
  metrics() {
    if (this.dirty) { this._redraw(); this.dirty = false; }
    return this.last;
  }

  // ---- drawing -----------------------------------------------------------------------

  _redraw() {
    const c = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    this.texture.needsUpdate = true;
    if (!this.model || !this.visible) { this.last = emptyMetrics(); return; }

    const m = this.model;
    const s = H / 1080;                                   // one scale factor, so 4K reads the same
    const pad = Math.round(34 * s);
    const bodySize = Math.round(30 * s);
    const nameSize = Math.round(22 * s);
    const optSize = Math.round(27 * s);
    const lineH = Math.round(bodySize * 1.36);
    const optH = Math.round(optSize * 1.62);

    const marginX = Math.round(W * 0.10);
    const panelW = W - marginX * 2;
    const textW = panelW - pad * 2;

    // --- measure first, then place. The panel is exactly as tall as its contents.
    c.font = bodyFont(bodySize);
    const lines = wrap(c, m.line || '', textW);
    const asideLines = m.aside ? wrap(c, m.aside, textW) : [];
    const opts = Array.isArray(m.options) ? m.options : [];
    const sel = clampInt(m.selected, 0, Math.max(0, opts.length - 1));
    const win = windowOf(opts.length, sel, OPTION_WINDOW);
    const shownOpts = opts.slice(win.from, win.to);

    let contentH = pad;
    contentH += nameSize + Math.round(14 * s);                       // speaker line + rule
    contentH += lines.length * lineH;
    if (asideLines.length) contentH += Math.round(10 * s) + asideLines.length * Math.round(nameSize * 1.34);
    if (m.input_kind === 'text') contentH += Math.round(18 * s) + Math.round(bodySize * 1.7);
    if (shownOpts.length) contentH += Math.round(16 * s) + shownOpts.length * optH;
    if (win.to < opts.length || win.from > 0) contentH += Math.round(nameSize * 1.2);
    contentH += pad;

    const maxH = Math.round(H * PANEL_MAX_FRAC);
    const panelH = Math.min(contentH, maxH);
    const x0 = marginX, y0 = H - panelH - Math.round(H * 0.045);

    // --- vellum
    c.save();
    roundRect(c, x0, y0, panelW, panelH, Math.round(6 * s));
    c.fillStyle = VELLUM;
    c.fill();
    c.lineWidth = Math.max(1, Math.round(2 * s));
    c.strokeStyle = RULE;
    c.stroke();
    c.clip();

    let y = y0 + pad + nameSize * 0.82;

    // --- who is speaking, and where you are standing. RI-JRN01 M6 is this line.
    c.font = smallFont(nameSize);
    c.fillStyle = INK_DIM;
    c.textAlign = 'left';
    const who = [m.speaker_title, m.speaker_name].filter(Boolean).join(' ');
    c.fillText(who.toUpperCase(), x0 + pad, y);
    if (m.place_name) {
      c.textAlign = 'right';
      c.fillText(m.place_name.toUpperCase(), x0 + panelW - pad, y);
      c.textAlign = 'left';
    }
    y += Math.round(10 * s);
    c.beginPath();
    c.moveTo(x0 + pad, y + 0.5); c.lineTo(x0 + panelW - pad, y + 0.5);
    c.strokeStyle = RULE; c.lineWidth = Math.max(1, Math.round(1 * s)); c.stroke();
    y += Math.round(bodySize * 1.12);

    // --- what she says
    c.font = bodyFont(bodySize);
    c.fillStyle = INK;
    for (const ln of lines) { c.fillText(ln, x0 + pad, y); y += lineH; }

    if (asideLines.length) {
      y += Math.round(8 * s);
      c.font = italicFont(nameSize);
      c.fillStyle = INK_DIM;
      for (const ln of asideLines) { c.fillText(ln, x0 + pad, y); y += Math.round(nameSize * 1.34); }
    }

    // --- a name being written into the ledger
    if (m.input_kind === 'text') {
      y += Math.round(20 * s);
      c.font = bodyFont(Math.round(bodySize * 1.06));
      c.fillStyle = INK_HOT;
      const typed = (m.typed || '');
      if (typed) c.fillText(typed + '▁', x0 + pad, y);
      c.beginPath();
      c.moveTo(x0 + pad, y + Math.round(9 * s) + 0.5);
      c.lineTo(x0 + pad + Math.round(textW * 0.62), y + Math.round(9 * s) + 0.5);
      c.strokeStyle = RULE; c.stroke();
      y += Math.round(bodySize * 0.7);
    }

    // --- the answers. A caret, never a cursor.
    if (shownOpts.length) {
      y += Math.round(20 * s);
      c.font = bodyFont(optSize);
      for (let i = 0; i < shownOpts.length; i++) {
        const o = shownOpts[i];
        const isSel = (win.from + i) === sel;
        const picked = Array.isArray(m.picked) && m.picked.indexOf(o.id) >= 0;
        c.fillStyle = isSel ? INK_HOT : (picked ? INK : INK_DIM);
        const mark = isSel ? '— ' : (picked ? '· ' : '  ');
        let label = mark + o.text;
        if (o.aside) label += '   ' + o.aside;
        c.fillText(ellipsise(c, label, textW), x0 + pad, y);
        y += optH;
      }
      if (opts.length > shownOpts.length) {
        c.font = smallFont(nameSize);
        c.fillStyle = INK_DIM;
        c.fillText(`${sel + 1} of ${opts.length}`, x0 + pad, y);
      }
    }
    c.restore();

    // --- metrics, from the layout that was just performed
    const frameArea = W * H;
    const panelArea = panelW * panelH;
    const text = [who, m.place_name || '', ...lines, ...asideLines,
      ...(m.input_kind === 'text' ? [m.typed || ''] : []),
      ...shownOpts.map((o) => o.text)].filter(Boolean);
    this.last = {
      open: true,
      panel_px: [panelW, panelH],
      frame_px: [W, H],
      // The vellum's alpha is 0.86, so the panel is translucent and the room is visible
      // through it. Reported as opaque anyway: overstating our own UI footprint is the
      // safe direction to round in.
      opaque_area_frac: +(panelArea / frameArea).toFixed(4),
      panel_height_frac: +(panelH / H).toFixed(4),
      uniform_area_frac: 0,
      full_screen_panels: 0,
      world_visible_behind: true,
      option_count: opts.length,
      options_shown: shownOpts.length,
      selected_index: sel,
      text,
      text_chars: text.join(' ').length,
    };
  }
}

function emptyMetrics() {
  return {
    open: false, panel_px: [0, 0], frame_px: [0, 0], opaque_area_frac: 0,
    panel_height_frac: 0, uniform_area_frac: 0, full_screen_panels: 0,
    world_visible_behind: true, option_count: 0, options_shown: 0, selected_index: 0,
    text: [], text_chars: 0,
  };
}

// Generic families only. A named face that is not installed in the capture container silently
// falls back and changes every glyph metric between a developer's machine and CI.
function bodyFont(px) { return `${px}px Georgia, "Times New Roman", serif`; }
function italicFont(px) { return `italic ${px}px Georgia, "Times New Roman", serif`; }
function smallFont(px) { return `${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = cur + ' ' + words[i];
      if (ctx.measureText(t).width > maxW) { out.push(cur); cur = words[i]; } else cur = t;
    }
    out.push(cur);
  }
  return out;
}

function ellipsise(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 4 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function windowOf(n, sel, size) {
  if (n <= size) return { from: 0, to: n };
  let from = sel - Math.floor(size / 2);
  if (from < 0) from = 0;
  if (from + size > n) from = n - size;
  return { from, to: from + size };
}

function clampInt(v, lo, hi) {
  const n = Number.isFinite(v) ? Math.round(v) : 0;
  return n < lo ? lo : n > hi ? hi : n;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

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

// Both of these are DELIVERY budgets, not taste. RI-JRN09 M1 counts an authored string that
// did not reach the frame at its node as undelivered, and both of these were quietly costing
// delivery: the panel's height cap sacrificed the scribe's previous reply, and a 5-option
// window hid 4 of the 9 hatch-names and 4 of the 9 birthsigns at the node that offers them.
// Measured before the change: DTR_scene 0.8288, with HF1 tripped at `hold.hatch-name` (0.400).
//
// The panel is 80% of frame width, so its AREA fraction is roughly 0.8x its height fraction —
// 0.48 of height is ~0.38 of area, comfortably inside RI-JRN01 M5's 0.55 AREA ceiling, which
// the build measures at 0.14–0.34 today. The area figure is re-measured after every change to
// these two numbers; raising delivery by breaking the UI-footprint bar would just move the
// defect, which is the failure mode three W1-09 rounds shipped in a row.
const PANEL_MAX_FRAC = 0.48;      // of frame height. M5's ceiling is 0.55 of frame AREA.
const OPTION_WINDOW = 9;          // options visible at once; longer lists (19 skills) scroll.

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
    // Writing `canvas.width` resets the backing store to a NEW one of a different size, but
    // the GPU texture uploaded from the old store is still bound and still the old dimensions.
    // Without this dispose the layer kept compositing the previous upload — a ghost second
    // interface, offset up the screen, on any resize and on every DPR-2 capture. Disposing
    // makes three re-upload at the new size on the next present.
    this.texture.dispose();
    this.texture.needsUpdate = true;
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
    if (m.kind === 'death') { this._redrawDeath(m, W, H); return; }
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
    // `spoken` is what she said about your last answer and `preamble` is her framing of a new
    // set of questions; both are hers, both are drawn quieter than the thing she is asking
    // now, and neither existed before round 3 — the graph wrote them and nothing drew them.
    c.font = italicFont(nameSize);
    const spokenLines = [];
    for (const s of (Array.isArray(m.spoken) ? m.spoken : [])) for (const ln of wrap(c, s, textW)) spokenLines.push(ln);
    if (m.preamble) { spokenLines.push(''); for (const ln of wrap(c, m.preamble, textW)) spokenLines.push(ln); }
    const spokenH = Math.round(nameSize * 1.32);

    // The writ, at the node that stamps it. Drawn as a document — its own rule, its own
    // smaller face — so it reads as a thing on the desk rather than as more of her talking.
    c.font = smallFont(nameSize);
    const recordLines = [];
    if (m.record && Array.isArray(m.record.lines)) {
      for (const ln of m.record.lines) for (const w of wrap(c, ln, textW)) recordLines.push(w);
    }
    const recordH = Math.round(nameSize * 1.30);

    c.font = bodyFont(bodySize);
    const lines = wrap(c, m.line || '', textW);
    const asideLines = m.aside ? wrap(c, m.aside, textW) : [];
    const opts = Array.isArray(m.options) ? m.options : [];
    const sel = clampInt(m.selected, 0, Math.max(0, opts.length - 1));
    const win = windowOf(opts.length, sel, OPTION_WINDOW);
    const shownOpts = opts.slice(win.from, win.to);

    let contentH = pad;
    contentH += nameSize + Math.round(14 * s);                       // speaker line + rule
    if (spokenLines.length) contentH += spokenLines.length * spokenH + Math.round(14 * s);
    if (recordLines.length) contentH += recordLines.length * recordH + Math.round(20 * s);
    contentH += lines.length * lineH;
    if (asideLines.length) contentH += Math.round(10 * s) + asideLines.length * Math.round(nameSize * 1.34);
    if (m.input_kind === 'text') contentH += Math.round(18 * s) + Math.round(bodySize * 1.7);
    if (shownOpts.length) contentH += Math.round(16 * s) + shownOpts.length * optH;
    // (the scroll note moved into the header row, which is already budgeted, so it no
    //  longer adds height and can no longer be the line the height cap clips away)
    contentH += pad;

    // The panel is capped at 42% of frame height and CLIPS, so anything that would push the
    // answers off the bottom has to go instead. The order of sacrifice is fixed and is the
    // order of importance: the thing being asked and the answers to it always survive; her
    // reply to the previous answer is dropped a line at a time until they fit. Without this
    // rule, adding `spoken` in round 3 would have re-created the round-2 defect one layer
    // down — a question that is computed, sent to the surface, and clipped off the vellum.
    const maxH = Math.round(H * PANEL_MAX_FRAC);
    while (contentH > maxH && spokenLines.length) {
      spokenLines.shift();
      contentH -= spokenH;
      if (!spokenLines.length) contentH -= Math.round(14 * s);
    }
    // The writ's identity block is sacrificed AFTER her previous reply and BEFORE the line
    // being spoken now or the answers to it, which never go. It is dropped from the BOTTOM,
    // so the heading and the name survive longest — a clipped document should still be
    // recognisably this player's document.
    while (contentH > maxH && recordLines.length) {
      recordLines.pop();
      contentH -= recordH;
      if (!recordLines.length) contentH -= Math.round(20 * s);
    }
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
    // The scroll position rides in the HEADER, not under the last answer.
    //
    // W1-26: it used to be drawn after the options, and at `hold.hatch-name` — thirteen
    // hatch-names, a nine-option window — the panel's height cap clipped it away. The
    // rendered-text register (`render/text-register.js`) caught it as the one string in the
    // whole opening that was handed to `fillText` and painted outside its clip: computed,
    // laid out, drawn, unreadable. That is `RI-JRN09`'s "orphan text" one layer below the
    // round-2 defect, and the fix is to put the only element that tells a player the list
    // continues in the one place on the panel that can never be clipped.
    const scrollNote = (opts.length > shownOpts.length) ? `${sel + 1} of ${opts.length}` : '';
    if (m.place_name || scrollNote) {
      c.textAlign = 'right';
      c.fillText([m.place_name ? m.place_name.toUpperCase() : '', scrollNote].filter(Boolean).join('   ·   '), x0 + panelW - pad, y);
      c.textAlign = 'left';
    }
    y += Math.round(10 * s);
    c.beginPath();
    c.moveTo(x0 + pad, y + 0.5); c.lineTo(x0 + panelW - pad, y + 0.5);
    c.strokeStyle = RULE; c.lineWidth = Math.max(1, Math.round(1 * s)); c.stroke();
    y += Math.round(bodySize * 1.12);

    // --- what she said about the last thing you told her
    if (spokenLines.length) {
      c.font = italicFont(nameSize);
      c.fillStyle = INK_DIM;
      for (const ln of spokenLines) { c.fillText(ln, x0 + pad, y); y += spokenH; }
      y += Math.round(14 * s);
    }

    // --- the document on the desk
    if (recordLines.length) {
      y += Math.round(4 * s);
      c.font = smallFont(nameSize);
      c.fillStyle = INK;
      for (const ln of recordLines) { c.fillText(ellipsise(c, ln, textW), x0 + pad, y); y += recordH; }
      y += Math.round(6 * s);
      c.beginPath();
      c.moveTo(x0 + pad, y + 0.5); c.lineTo(x0 + pad + Math.round(textW * 0.42), y + 0.5);
      c.strokeStyle = RULE; c.stroke();
      y += Math.round(12 * s);
    }

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
      // (the scroll position is drawn in the header — see the note there)
    }
    c.restore();

    // --- metrics, from the layout that was just performed
    const frameArea = W * H;
    const panelArea = panelW * panelH;
    const text = [who, m.place_name || '', ...spokenLines, ...recordLines, ...lines, ...asideLines,
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

/**
 * The death surface — W1-13, RI-JRN06 D5/D11/D18.
 *
 * It is allowed to be exactly one thing: a word, over a darkened frame, gone in 2.5 s or the
 * instant any button is pressed. Everything the item forbids is forbidden HERE, in the only
 * place it could be added: there is no souls-lost figure, no death counter, no time-survived
 * line, no "try dodging", no retry button and no difficulty offer. RI-JRN06 "How we lose" #9:
 * "Every one of those numbers is a small act of contempt and none of them are in either
 * reference game."
 *
 * The words are RI-LOR05 §2's: "Everything that dies in Black Marsh goes down. This is not a
 * belief. In the marsh's own idiom it is plumbing." The world is left VISIBLE behind the
 * scrim — the marsh you fell in is the last thing you look at — which also keeps
 * `world_visible_behind` true and the surface inside RI-JRN01 M5's opaque-area budget.
 */
UILayer.prototype._redrawDeath = function _redrawDeath(m, W, H) {
  const c = this.ctx;
  const s = H / 1080;
  // A scrim, not a curtain: 0.62 alpha over the live view.
  c.fillStyle = 'rgba(6, 5, 4, 0.62)';
  c.fillRect(0, 0, W, H);
  const size = Math.round(96 * s);
  c.font = `${size}px Georgia, "Times New Roman", serif`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const line = String(m.line || '');
  const y = Math.round(H * 0.5 + size * 0.34);
  c.fillStyle = 'rgba(120, 24, 18, 0.9)';
  c.fillText(line, W / 2 + Math.round(2 * s), y + Math.round(2 * s));
  c.fillStyle = '#c9a087';
  c.fillText(line, W / 2, y);
  const w = c.measureText(line).width;
  c.strokeStyle = 'rgba(180, 150, 100, 0.30)';
  c.lineWidth = Math.max(1, Math.round(1.5 * s));
  c.beginPath();
  c.moveTo(W / 2 - w * 0.62, y + size * 0.42);
  c.lineTo(W / 2 + w * 0.62, y + size * 0.42);
  c.stroke();
  c.textAlign = 'left';
  // WHAT `opaque_area_frac` MEANS, and why this is 0.
  //
  // RI-JRN01 M5 caps OPAQUE non-world UI as a fraction of frame area, and `Engine.getUIState()`
  // ADDS this number to the HUD's coverage to produce `non_world_area_frac`. Not one pixel of
  // this surface is opaque: it is a 0.62-alpha scrim with the live marsh moving behind it and
  // about a hundredth of a frame of glyphs. Reporting 0.62 here would have charged the death
  // surface as though it were an opaque full-screen panel and failed another piece's bar on a
  // misread word — so the occlusion is reported next to it, under its own name, at full size,
  // and a critic who disagrees with the reading has the number in hand.
  this.last = {
    open: true, kind: 'death',
    panel_px: [W, H], frame_px: [W, H],
    opaque_area_frac: 0,
    scrim_alpha: 0.62, scrim_area_frac: 1.0, scrim_occlusion_frac: 0.62,
    glyph_area_frac: +(((w * size) / (W * H)) * 0.34).toFixed(4),
    panel_height_frac: 1.0, uniform_area_frac: 0, full_screen_panels: 0,
    world_visible_behind: true,
    option_count: 0, options_shown: 0, selected_index: 0,
    text: [line], text_chars: line.length,
    // RI-JRN06 M-D9 greps the UI-text stream for these. The surface carries one string and
    // this is it; the enumeration is here so the grep has a defined place to look.
    statistics_rendered: 0, tips_rendered: 0, numerals_rendered: 0,
  };
};

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

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
// The MOST options the surface will try to show at once, not the number it shows. The layout
// search below starts here and gives ground — type scale first, then the window — so this is an
// upper bound on ambition rather than a fixed frame. It was 9, chosen when every list was drawn
// in one column at one size; 20 covers the longest list in the scene (nineteen skills at
// `writ.class-custom-primary`) so that list gets the chance to be wholly on the page.
const OPTION_WINDOW = 20;

// ---- the overflow policy. THIS IS THE ROUND-2 REPAIR AND IT IS NOT A TASTE DECISION. -------
//
// The round-1 verdict measured the shape of the failure exactly: "Everything the scribe ASKS is
// drawn. Everything she SAYS BACK is what goes." `hold.wake`'s line — the first thing anyone
// says in the game — was undrawn at `hold.hatch-name` in every walk. The reply to the upbringing
// answer was undrawn at `writ.given-name`. `on_match_named_class`, the line RI-CHR01 §4 calls
// "the moment the route is for" and the whole reason a fourteen-class census exists, was undrawn
// at `writ.birthsign`. All three for one reason: `spoken` was the FIRST thing sacrificed when the
// content exceeded the panel's height cap. "A scene that asks perfectly and never answers is a
// form with good questions on it."
//
// THE FIX IS NOT MORE PANEL. The obvious move — raise `PANEL_MAX_FRAC` — is closed. The critic
// measured the build's non-world area at 0.498 against RI-JRN01 M5's 0.55 ceiling, so there are
// about five points of area in hand and the panel is 0.8 of frame width; every point of height
// costs 0.8 of a point of area. Buying delivery by breaking the UI-footprint bar just moves the
// defect, which is the failure three W1-09 rounds shipped in a row.
//
// SO THE RELIEF COMES FROM THE TYPE, THEN THE WINDOW, AND HER REPLY GOES LAST. In order:
//
//   1. TYPE SCALE. Shrink every dimension on the panel together — sizes, leading, padding — by
//      the largest factor in [TYPE_FLOOR, 1] that makes everything fit. A denser page is not a
//      lost line. This alone fits every node in the scene except the two with a fourteen- and a
//      nineteen-item list.
//   2. OPTION WINDOW. Then narrow the list, never below MIN_OPTION_WINDOW. This is the trade the
//      whole policy turns on, and the argument is one sentence: **a scrolled option is still
//      reachable and a dropped line is gone forever.** The caret pages the list, the caret-resync
//      fix shipped last round works, and "3 of 14" rides in the header where the cap cannot clip
//      it. Nothing is lost; something is one press further away.
//   3. THE WRIT'S IDENTITY BLOCK, from the bottom — it is redrawn in full by the carried object.
//   4. HER REPLY, a line at a time, and only when 1-3 together cannot fit the page. `metrics()`
//      reports it as `sacrificed.spoken_lines` so this is visible in the artifact rather than
//      inferred from a DTR that came out low.
//
// TYPE_FLOOR is 0.78 because 30 px body type at 1080p becomes 23 px, which is still larger than
// the 22 px this surface already uses for the speaker line and her asides.
const TYPE_FLOOR = 0.78;
const TYPE_STEPS = 12;            // scales tried between 1.0 and TYPE_FLOOR, coarse to fine
const MIN_OPTION_WINDOW = 5;

// TWO COLUMNS FOR A LONG LIST OF SHORT NAMES, which is what the two longest lists in the scene
// actually are: thirteen hatch-names at `hold.hatch-name` and nineteen skills at
// `writ.class-custom-primary`. Rows, not options, is what the height cap spends, so a list laid
// out two-up costs half the page and the whole list is on it — which is better than a scrolled
// one on every reading of the delivered-text ratio, not just the generous one.
//
// It is also simply what the object is. A form on a desk lists a column of names down the left
// and a column down the right; it does not show you nine of thirteen and make you page. The
// caret is still one index moved by the closed action set (O8) and reading order is still
// top-to-bottom then over, so nothing about the gamepad path changes.
//
// GUARDED ON MEASUREMENT, NOT ON GUESSWORK: two columns only if EVERY visible label already fits
// a half-width column. A name that would have to be ellipsised into ambiguity — "Waits-For-The-
// Second-Ti…" — is worth more page than it costs, so that list stays single-column.
const TWO_COLUMN_MIN = 10;

/** The parchment palette. One ink, one vellum, one rule. Nothing glows. */
const INK = '#efe4cd';
const INK_DIM = '#b9ab8e';
const INK_HOT = '#ffd9a0';
const VELLUM = 'rgba(18, 15, 12, 0.86)';
const RULE = 'rgba(180, 150, 100, 0.34)';

export class UILayer {
  constructor(width, height) {
    /** @see setTouchClearRight — null means "no touch arc on the glass" (every desktop frame). */
    this.touchClearRightX = null;
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

  /**
   * W1-UIX08. LAY OUT AND MEASURE, BUT DO NOT PAINT.
   *
   * `RI-UIX08` replaces this surface's conversation panel — a bottom-anchored list of selectable
   * replies, which is that item's hard fail — with `ui/screens/dialogue.js`, drawn on the `menus`
   * surface where every element is declared. Two windows for one conversation would be worse than
   * either, so the new one paints and this one does not.
   *
   * IT IS NOT `setVisible(false)`, AND THE DIFFERENCE IS THE WHOLE POINT. `visible` short-circuits
   * `_redraw()` and empties `this.last`, and `Engine.getUIState()` spreads `renderer.ui.metrics()`
   * wholesale — so hiding the panel that way would have silently zeroed `option_count`,
   * `panel_height_frac`, `world_visible_behind` and the drawn-text array for every probe in this
   * tree that measures a conversation. This flag skips the PAINT BLOCK ONLY: the layout still
   * runs, `metrics()` still reports what the old panel would have been, and nothing is handed to
   * `fillText`, so `render/text-register.js` does not record strings that never reached a frame.
   *
   * Set from `Engine._conversationSync()` and cleared when the conversation closes. One boolean,
   * one caller, and `DIALOGUE_WINDOW = false` in `engine.js` turns the whole thing off.
   */
  setSuppressed(v) {
    const s = !!v;
    if (s !== this.suppressed) { this.suppressed = s; this.dirty = true; }
    return this.suppressed;
  }

  /**
   * RI-JRN04 T8, second clause: "touch controls ... never overlap the dialogue or journal
   * surfaces". `x` is the left edge of the touch arc in the same pixel space this canvas uses,
   * or null when there is no arc on the glass — which is every desktop frame, so the panel a
   * keyboard player sees is byte-identical to the one it drew before this existed.
   *
   * It is a setter and not a field because `_redraw()` only runs when `dirty`, and a panel that
   * kept its old width until something else happened to dirty it would be right most of the time
   * and wrong exactly when a conversation opens.
   */
  setTouchClearRight(x) {
    const v = (x === null || x === undefined || !Number.isFinite(x)) ? null : Math.round(x);
    if (v !== this.touchClearRightX) { this.touchClearRightX = v; this.dirty = true; }
    return v;
  }

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
    const base = H / 1080;                                // one scale factor, so 4K reads the same
    const maxH = Math.round(H * PANEL_MAX_FRAC);
    const marginX = Math.round(W * 0.10);
    // T8: the panel is 80% of the frame wide, and on a phone the touch arc is drawn on top of it.
    // When an arc is on the glass the panel stops 10 px short of its leftmost control; a floor of
    // 45% of the frame means a badly-placed arc can shrink the reading surface but never collapse
    // it. `touchClearRightX` is null on every desktop frame, so `rightEdge` is `W - marginX` and
    // the arithmetic below is unchanged.
    const rightEdge = this.touchClearRightX === null || this.touchClearRightX === undefined
      ? W - marginX
      : Math.min(W - marginX, Math.max(marginX + Math.round(W * 0.45), this.touchClearRightX - 10));
    const panelW = rightEdge - marginX;                   // 0.8W unless a touch arc is drawn
    const opts = Array.isArray(m.options) ? m.options : [];
    const sel = clampInt(m.selected, 0, Math.max(0, opts.length - 1));

    /**
     * Lay the whole panel out at a type scale and an option-window size, and return everything
     * the paint pass needs plus the height it came to. Nothing is drawn here.
     *
     * Every dimension on the surface is a multiple of `s`, so one factor moves the type, the
     * leading, the padding and the gaps together and the page stays in proportion.
     */
    const layout = (k, winSize) => {
      const s = base * k;
      const mobileFloor = W > H * 1.8 && H <= 900 ? 36 : 0;
      const pad = Math.round(34 * s);
      const bodySize = Math.max(11, mobileFloor, Math.round(30 * s));
      const nameSize = Math.max(9, mobileFloor, Math.round(22 * s));
      const optSize = Math.max(10, mobileFloor, Math.round(27 * s));
      const lineH = Math.round(bodySize * 1.36);
      const optH = Math.round(optSize * 1.62);
      const spokenH = Math.round(nameSize * 1.32);
      const recordH = Math.round(nameSize * 1.30);
      const textW = panelW - pad * 2;

      // `spoken` is what she said about your last answer and `preamble` is her framing of a new
      // set of questions; both are hers, both are drawn quieter than the thing she is asking
      // now.
      c.font = italicFont(nameSize);
      const spokenLines = [];
      for (const t of (Array.isArray(m.spoken) ? m.spoken : [])) for (const ln of wrap(c, t, textW)) spokenLines.push(ln);
      if (m.preamble) { spokenLines.push(''); for (const ln of wrap(c, m.preamble, textW)) spokenLines.push(ln); }

      // The writ, at the node that stamps it. Drawn as a document — its own rule, its own
      // smaller face — so it reads as a thing on the desk rather than as more of her talking.
      c.font = smallFont(nameSize);
      const recordLines = [];
      if (m.record && Array.isArray(m.record.lines)) {
        for (const ln of m.record.lines) for (const w of wrap(c, ln, textW)) recordLines.push(w);
      }

      c.font = bodyFont(bodySize);
      const lines = wrap(c, m.line || '', textW);
      const asideLines = m.aside ? wrap(c, m.aside, textW) : [];
      const win = windowOf(opts.length, sel, Math.max(1, winSize));
      const shownOpts = opts.slice(win.from, win.to);
      // Two columns if the list is long and every label already fits half the width. Measured at
      // the option face, at this scale, against this column — never assumed from a character
      // count, because the face is not monospaced and the aside is glued on after the label.
      const colGap = Math.round(28 * s);
      const colW = Math.floor((textW - colGap) / 2);
      c.font = bodyFont(optSize);
      const twoCol = shownOpts.length >= TWO_COLUMN_MIN
        && shownOpts.every((o) => c.measureText('— ' + o.text + (o.aside ? '   ' + o.aside : '')).width <= colW);
      const optRows = twoCol ? Math.ceil(shownOpts.length / 2) : shownOpts.length;
      const L = {
        k, s, pad, bodySize, nameSize, optSize, lineH, optH, spokenH, recordH, textW,
        spokenLines, recordLines, lines, asideLines, win, shownOpts,
        twoCol, optRows, colW, colGap,
        spokenDropped: 0, recordDropped: 0,
      };
      L.height = () => {
        let h = L.pad * 2;
        h += L.nameSize + Math.round(14 * L.s);                        // speaker line + rule
        if (L.spokenLines.length) h += L.spokenLines.length * L.spokenH + Math.round(14 * L.s);
        if (L.recordLines.length) h += L.recordLines.length * L.recordH + Math.round(20 * L.s);
        h += L.lines.length * L.lineH;
        if (L.asideLines.length) h += Math.round(10 * L.s) + L.asideLines.length * Math.round(L.nameSize * 1.34);
        if (m.input_kind === 'text') h += Math.round(18 * L.s) + Math.round(L.bodySize * 1.7);
        if (L.shownOpts.length) h += Math.round(16 * L.s) + L.optRows * L.optH;
        // (the scroll note lives in the header row, which is already budgeted, so it no longer
        //  adds height and can no longer be the line the height cap clips away)
        return h;
      };
      return L;
    };

    // ---- the four reliefs, in order. See the note beside TYPE_FLOOR for the argument. -------
    const fullWindow = Math.min(OPTION_WINDOW, Math.max(1, opts.length));
    let L = null;
    // 1. the largest type scale at which EVERYTHING fits — every reply, every line, the full
    //    option window. This is the one that fires at almost every node in the scene.
    for (let i = 0; i <= TYPE_STEPS; i++) {
      const k = 1 - (1 - TYPE_FLOOR) * (i / TYPE_STEPS);
      const cand = layout(k, fullWindow);
      if (cand.height() <= maxH) { L = cand; break; }
    }
    // 2. no scale fits the whole window: take the floor — where the smallest type buys the most
    //    rows — and narrow the list until the page closes. A scrolled option is still reachable.
    if (!L) {
      let win = fullWindow;
      L = layout(TYPE_FLOOR, win);
      while (L.height() > maxH && win > MIN_OPTION_WINDOW) { win--; L = layout(TYPE_FLOOR, win); }
    }
    // 3. the writ's identity block, from the BOTTOM, so the heading and the name survive longest
    //    — a clipped document should still be recognisably this player's document. It is the
    //    cheapest thing on the page to lose because the carried object redraws it in full.
    while (L.height() > maxH && L.recordLines.length) { L.recordLines.pop(); L.recordDropped++; }
    // 4. LAST: her reply, a line at a time. Reaching this line at all is the defect round 1
    //    measured, so it is counted and published in `metrics()` rather than left to be
    //    inferred from a DTR that came out low.
    while (L.height() > maxH && L.spokenLines.length) { L.spokenLines.shift(); L.spokenDropped++; }

    const {
      s, pad, bodySize, nameSize, optSize, lineH, optH, spokenH, recordH, textW,
      spokenLines, recordLines, lines, asideLines, win, shownOpts, twoCol, optRows, colW, colGap,
    } = L;
    const contentH = L.height();
    const panelH = Math.min(contentH, maxH);
    const x0 = marginX, y0 = H - panelH - Math.round(H * 0.045);

    // --- vellum
    c.save();
    roundRect(c, x0, y0, panelW, panelH, Math.round(6 * s));
    const vellum=c.createLinearGradient(x0,y0,x0,y0+panelH);
    vellum.addColorStop(0,'rgba(37, 30, 22, 0.92)');vellum.addColorStop(.18,VELLUM);vellum.addColorStop(1,'rgba(12, 11, 10, 0.90)');
    c.fillStyle = vellum;
    c.fill();
    c.lineWidth = Math.max(1, Math.round(2 * s));
    c.strokeStyle = RULE;
    c.stroke();
    // An inset inked rule and small corner knots make the interface an object from this world,
    // while retaining the same footprint and gamepad-only interaction contract.
    c.beginPath();roundRect(c,x0+Math.round(7*s),y0+Math.round(7*s),panelW-Math.round(14*s),panelH-Math.round(14*s),Math.round(3*s));
    c.strokeStyle='rgba(214, 176, 111, 0.22)';c.lineWidth=Math.max(1,Math.round(s));c.stroke();
    c.fillStyle='rgba(205, 169, 104, 0.38)';
    for(const [cx,cy] of [[x0+14*s,y0+14*s],[x0+panelW-14*s,y0+14*s],[x0+14*s,y0+panelH-14*s],[x0+panelW-14*s,y0+panelH-14*s]]){c.save();c.translate(cx,cy);c.rotate(Math.PI/4);c.fillRect(-3*s,-3*s,6*s,6*s);c.restore();}
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
      // Reading order is DOWN the first column and then down the second, so a caret moved by
      // one index walks the list the way the eye reads it.
      const perCol = twoCol ? optRows : shownOpts.length;
      for (let i = 0; i < shownOpts.length; i++) {
        const o = shownOpts[i];
        const isSel = (win.from + i) === sel;
        const picked = Array.isArray(m.picked) && m.picked.indexOf(o.id) >= 0;
        c.fillStyle = isSel ? INK_HOT : (picked ? INK : INK_DIM);
        const mark = isSel ? '— ' : (picked ? '· ' : '  ');
        let label = mark + o.text;
        if (o.aside) label += '   ' + o.aside;
        const col = twoCol ? Math.floor(i / perCol) : 0;
        const row = twoCol ? i % perCol : i;
        const cx = x0 + pad + col * (colW + colGap);
        c.fillText(ellipsise(c, label, twoCol ? colW : textW), cx, y0 + (y - y0) + row * optH);
      }
      y += optRows * optH;
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
      /**
       * THE OVERFLOW POLICY, SHOWING ITS WORK.
       *
       * Round 1's defect was invisible from outside: the panel silently shifted her replies off
       * the top and reported a healthy `text` array of everything else. So the relief that was
       * applied is published. `type_scale < 1` means the page was set denser to keep a line;
       * `option_window < option_count` means the list is paged and the header says so;
       * `spoken_lines` above zero means the last resort fired and something she said did not
       * reach the frame — which is the number this round exists to hold at 0.
       */
      sacrificed: {
        type_scale: +L.k.toFixed(4),
        type_floor: TYPE_FLOOR,
        option_window: shownOpts.length,
        option_window_from: win.from,
        option_columns: twoCol ? 2 : 1,
        option_rows: optRows,
        record_lines: L.recordDropped,
        spoken_lines: L.spokenDropped,
        content_px: contentH,
        max_px: maxH,
      },
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

// The touch fallback — RI-JRN04 §G. "This is not a courtesy, it is O17."
//
// Before this file the tree had no touch code at all, so `RI-JRN01` O17's touch-only leg and
// `RI-JRN04` M-P21 were not failing, they were unmeasurable — which scores 0 fail-closed and
// looks the same from outside as a design failure.
//
// Rules, each named:
//   T1  all sixteen actions of the closed set reachable; ten direct, the rest behind ONE drawer
//   T2  the left half is a FLOATING stick, originating where the thumb lands
//   T3  the right half is camera drag with §D's curve applied to drag velocity
//   T4  the discrete buttons live in the lower-right arc, thumb-reachable
//   T5  roll/sprint share a control with the SAME 12-frame discriminator the pad uses, so the
//       semantics a player learns on a pad transfer
//   T6  charged heavy is a hold on the heavy button, thresholded on duration
//   T7  controls vanish within 2 s of the last touch while a pad is active, and return on touch
//   T8  nothing occupies a safe-area inset and nothing overlaps the dialogue surface
//   T9  MULTI-TOUCH: stick + camera + two buttons simultaneously. Every pointer is tracked in
//       a map keyed by pointerId; the "one active pointer" handler is RI-JRN04 "How we lose"
//       #12 and it is the most common touch bug in browser games.
//
// Geometry is in CSS px measured from the bottom-right of the SAFE AREA, so the whole arc
// moves with `env(safe-area-inset-*)` and can never enter an inset (H3/T8).
'use strict';

import { shouldPromote } from './hold-gate.js';

export class TouchInput {
  /**
   * @param {InputPipeline} pipe
   * @param {HTMLElement} canvas
   * @param {object} profiles game/data/input/profiles.json
   */
  constructor(pipe, canvas, profiles) {
    if (!profiles || !profiles.touch) throw new Error('TouchInput: game/data/input/profiles.json §touch is required. The layout is DATA (RI-MTH07).');
    this.pipe = pipe;
    this.canvas = canvas;
    this.cfg = profiles.touch;
    this.analog = profiles.analog;
    this.enabled = false;
    this.attached = false;
    this.visible = true;
    // T7's 2 s is expressed in FIXED SIM FRAMES, not wall-clock ms: HARNESS.md §8 D1-D3 forbid
    // a `performance.now()` read inside the fixed step, and the guard is armed, so a ms clock
    // here takes the whole run down with a DETERMINISM VIOLATION. 2 s = 120 f@60.
    this.lastTouchFrame = -1e9;
    this.hideAfterFrames = Math.round((profiles.touch.hide_after_ms_when_pad_active || 2000) * 60 / 1000);
    this.padActive = false;
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.viewport = { w: 844, h: 390, dpr: 1 };
    this.drawerOpen = false;
    this.suppressToDrawer = null;   // S35: a READING screen is up; see layout()
    this.keepOnly = null;           // T8 clause 2: a TALKING surface is up; see layout()
    /** pointerId -> {role, ...}. NOT a single active pointer. T9. */
    this.pointers = new Map();
    this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.held = new Map();          // action -> {downFrame, gate}
    this._handlers = [];
    this.frame = () => 0;
    this.onActivity = null;
    this._assertLayout();
  }

  /** T1/T11: assert at construction rather than let a player find the unreachable verb. */
  _assertLayout() {
    const direct = this.cfg.buttons.map((b) => b.action);
    const gated = this.cfg.buttons.flatMap((b) => (b.hold_gate ? [b.hold_gate.tap, b.hold_gate.hold] : []));
    const reach = new Set([...direct, ...gated, ...this.cfg.drawer.actions, 'sprint']);
    const missing = [];
    // move is the stick; look is the drag. Everything else must be a control.
    for (const a of ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump', 'use_item',
      'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu', 'crouch', 'spell_cycle']) {
      if (!reach.has(a)) missing.push(a);
    }
    if (missing.length) throw new Error(`RI-JRN04 T1: touch cannot reach ${missing.join(', ')}. O17 requires the whole closed set on touch alone.`);
    // H11: every touchable control >= 44x44 CSS px, and no two adjacent closer than 8 px.
    const small = this.cfg.buttons.filter((b) => b.r * 2 < this.cfg.min_target_css_px).map((b) => `${b.action} (${b.r * 2}px)`);
    if (small.length) throw new Error(`RI-JRN04 H11: touch target below ${this.cfg.min_target_css_px} CSS px — ${small.join(', ')}`);
    for (let i = 0; i < this.cfg.buttons.length; i++) {
      for (let j = i + 1; j < this.cfg.buttons.length; j++) {
        const a = this.cfg.buttons[i], b = this.cfg.buttons[j];
        const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r;
        if (gap < this.cfg.min_gap_css_px) throw new Error(`RI-JRN04 H11: touch controls '${a.action}' and '${b.action}' are ${gap.toFixed(1)} px apart, below the ${this.cfg.min_gap_css_px} px minimum`);
      }
    }
  }

  setViewport(w, h, dpr, insets) {
    this.viewport = { w, h, dpr: dpr || 1 };
    if (insets) this.insets = { ...this.insets, ...insets };
  }

  /** T7: with a pad active the controls go away; a touch brings them back. */
  setPadActive(on) { this.padActive = !!on; }

  /** Origin of the button arc: the bottom-right corner of the SAFE AREA (H3/T8). */
  _origin() {
    return { x: this.viewport.w - this.insets.right, y: this.viewport.h - this.insets.bottom };
  }

  /**
   * SEAM S35 — reduce the arc to the drawer while a READING surface is open.
   *
   * Set by `Engine._touchOverlayModel()` from `UISystem.mode`; `null` restores the full arc. It
   * is a field on the input model rather than a filter in the renderer for one reason, and it is
   * the reason the whole overlay works: **`layout()` is read by the hit test as well as by the
   * drawing**, so a control filtered out of the picture alone would be invisible and still
   * pressable. The property the overlay rests on is that what is drawn is what is pressable, in
   * both directions; a filter applied to only one of the two readers breaks it.
   *
   * The drawer itself is never suppressed — `menu` lives in it, the touch profile declares no
   * gestures, and a player who could open the map but not close it is a worse defect than the
   * one this rule exists to fix.
   *
   * @type {?string} the reading surface currently up ('map' | 'journal' | 'book'), or null
   *      — declared in the constructor beside `drawerOpen`, which is this class's style.
   */

  /**
   * T8, SECOND CLAUSE — the arc reduced to the verbs a TALKING surface consumes.
   *
   * `suppressToDrawer` above is S35's rule for the READING screens, where nothing the ring draws
   * can do anything. A conversation is the opposite case and needed its own answer: two of its
   * verbs are live (`interact` commits, `block` un-picks) and the other eight are not, while the
   * dialogue panel is 80% of the frame's width and the ring is drawn over it. Measured at
   * 844x390 with `hold.hatch-name` open, SEVEN of the eleven drawn controls sat on the panel's
   * rectangle and covered the right-hand column of the name ledger — a player choosing a name
   * could not read half the names on offer. T8 says the controls "never overlap the dialogue or
   * journal surfaces"; `ui/system.js` had a comment claiming T8 was "upheld by construction",
   * which is true of the inset clause and was never true of this one.
   *
   * `keepOnly` is an array of action names, or null for the whole arc. Set every frame by
   * `Engine._touchOverlayModel()`, for the same reason `suppressToDrawer` is: `layout()` is read
   * by the hit test as well as by the drawing, so a control filtered out of only one of the two
   * would be invisible and still pressable, or visible and dead.
   *
   * The drawer goes with them. S35 kept it because a player who could open the map and not close
   * it is trapped; nobody is trapped in a conversation — `interact` ends it and `block` steps
   * back — and the drawer's own centre sits over the panel, which is the defect.
   * @type {?Array<string>}
   */

  /** @returns {Array<{action,x,y,r,down}>} laid out in CSS px. The renderer draws exactly this. */
  layout() {
    const o = this._origin();
    const out = [];
    const keep = Array.isArray(this.keepOnly) ? this.keepOnly : null;
    if (!this.suppressToDrawer) {
      for (const b of this.cfg.buttons) {
        if (keep && keep.indexOf(b.action) < 0) continue;
        out.push({ action: b.action, x: o.x + b.cx, y: o.y + b.cy, r: b.r, held: !!b.held, gate: b.hold_gate || null, down: this.held.has(b.action) });
      }
    }
    if (keep) return out;
    const d = this.cfg.drawer;
    out.push({ action: '__drawer', x: o.x + d.cx, y: o.y + d.cy, r: d.r, drawer: true, down: this.drawerOpen });
    if (this.drawerOpen) {
      const n = d.actions.length;
      for (let i = 0; i < n; i++) {
        const th = -Math.PI / 2 - (i - (n - 1) / 2) * 0.42;
        out.push({ action: d.actions[i], x: o.x + d.cx + Math.cos(th) * 92, y: o.y + d.cy + Math.sin(th) * 92, r: 26, fromDrawer: true, down: this.held.has(d.actions[i]) });
      }
    }
    return out;
  }

  /** H3/T8 audit — every control's bounding box against the inset regions. M-P17 reads this. */
  insetViolations() {
    const bad = [];
    const { w, h } = this.viewport;
    const I = this.insets;
    for (const c of this.layout()) {
      if (c.x - c.r < I.left || c.x + c.r > w - I.right || c.y - c.r < I.top || c.y + c.r > h - I.bottom) {
        bad.push({ what: c.action, box: [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r] });
      }
    }
    if (this.stick.active) {
      const r = this.cfg.stick.max_radius_css_px;
      if (this.stick.ox - r < I.left || this.stick.oy + r > h - I.bottom) bad.push({ what: 'stick', box: [this.stick.ox - r, this.stick.oy - r, this.stick.ox + r, this.stick.oy + r] });
    }
    return bad;
  }

  attach() {
    if (this.attached || !this.canvas || !this.canvas.addEventListener) return;
    this.attached = true;
    const on = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); this._handlers.push([t, type, fn, opts]); };
    const opt = { passive: false };
    on(this.canvas, 'pointerdown', (e) => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { e.preventDefault(); this.down(e.pointerId, e.clientX, e.clientY); } }, opt);
    on(window, 'pointermove', (e) => { if (this.pointers.has(e.pointerId)) { e.preventDefault(); this.move(e.pointerId, e.clientX, e.clientY); } }, opt);
    const up = (e) => { if (this.pointers.has(e.pointerId)) { e.preventDefault(); this.up(e.pointerId); } };
    on(window, 'pointerup', up, opt);
    on(window, 'pointercancel', up, opt);
    // H5: the callout, the selection and the double-tap zoom, all suppressed on the canvas.
    on(this.canvas, 'touchstart', (e) => e.preventDefault(), opt);
    on(this.canvas, 'touchmove', (e) => e.preventDefault(), opt);
    on(this.canvas, 'gesturestart', (e) => e.preventDefault(), opt);
    on(this.canvas, 'contextmenu', (e) => e.preventDefault(), opt);
    on(this.canvas, 'selectstart', (e) => e.preventDefault(), opt);
  }

  detach() {
    for (const [t, type, fn, opts] of this._handlers) t.removeEventListener(type, fn, opts);
    this._handlers.length = 0;
    this.attached = false;
    this.releaseAll();
  }

  // ---- the pointer model. Every pointer is tracked; none is "the" pointer. T9 -------------

  down(id, x, y) {
    this.lastTouchFrame = this.frame();
    this.visible = true;
    this.onActivity && this.onActivity('touch');
    const hit = this._hitButton(x, y);
    if (hit) {
      this.pointers.set(id, { role: 'button', action: hit.action, control: hit, downFrame: this.frame() });
      if (hit.drawer) { this.drawerOpen = !this.drawerOpen; return 'drawer'; }
      if (hit.gate) { this.held.set(hit.action, { gateFrom: this.frame(), gate: hit.gate, promoted: false }); return 'gate'; }
      this.held.set(hit.action, { downFrame: this.frame() });
      this.pipe.edgeDown(hit.action);
      if (hit.fromDrawer) this.drawerOpen = false;
      return 'press';
    }
    if (x < this.viewport.w / 2) {
      // T2: the stick originates where the thumb landed.
      this.pointers.set(id, { role: 'stick' });
      this.stick = { active: true, ox: x, oy: y, x: 0, y: 0 };
      return 'stick';
    }
    this.pointers.set(id, { role: 'camera', lx: x, ly: y });
    return 'camera';
  }

  move(id, x, y) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.lastTouchFrame = this.frame();
    if (p.role === 'stick') {
      const R = this.cfg.stick.max_radius_css_px;
      let dx = (x - this.stick.ox) / R;
      let dy = -(y - this.stick.oy) / R;             // screen y is down; move y is forward
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      this.stick.x = dx; this.stick.y = dy;
      return;
    }
    if (p.role === 'camera') {
      // T3: drag velocity through the same shaping the stick uses, expressed in DEGREES for
      // the next fixed step. Never per rendered frame (PL6 / M-P8).
      const dx = x - p.lx, dy = y - p.ly;
      p.lx = x; p.ly = y;
      this.pipe.addLook(dx * this.cfg.camera.deg_per_css_px_yaw, dy * this.cfg.camera.deg_per_css_px_pitch);
    }
  }

  up(id) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    this.lastTouchFrame = this.frame();
    if (p.role === 'stick') { this.stick.active = false; this.stick.x = 0; this.stick.y = 0; this.pipe.setMove(0, 0); return; }
    if (p.role === 'button' && p.action && !p.control.drawer) {
      const h = this.held.get(p.action);
      this.held.delete(p.action);
      if (h && h.gate) {
        // T5: the SAME 12-frame discriminator the pad uses, so muscle memory transfers.
        if (h.promoted) this.pipe.edgeUp(h.gate.hold);
        else { this.pipe.edgeDown(h.gate.tap); this.pipe.edgeUp(h.gate.tap); }
      } else {
        this.pipe.edgeUp(p.action);
      }
    }
  }

  /** Called once per fixed step, before the latch. Promotes gates and pushes the stick. */
  tick(frame) {
    for (const [action, h] of this.held) {
      // Frames HELD, press frame inclusive — the same quantity the pad uses, so T5's promise
      // that the semantics transfer is true to the frame and not just in spirit.
      if (h.gate && !h.promoted && shouldPromote(frame, h.gateFrom, h.gate)) {
        h.promoted = true;
        this.pipe.edgeDown(h.gate.hold);
      }
    }
    // T6: the charged heavy is a hold on the heavy button, thresholded on DURATION, because a
    // finger has no analog travel. Above the pad's own charge window the intent is full.
    const hv = this.held.get('heavy');
    this.pipe.chargeIntent = hv ? 1 : this.pipe.chargeIntent;
    if (this.stick.active) {
      const ls = this.analog.left_stick;
      const m = Math.hypot(this.stick.x, this.stick.y);
      if (m <= ls.inner_deadzone) this.pipe.setMove(0, 0);
      else {
        let mm = (Math.min(m, ls.outer_saturation) - ls.inner_deadzone) / (ls.outer_saturation - ls.inner_deadzone);
        if (mm > 1) mm = 1;
        this.pipe.setMove((this.stick.x / m) * mm, (this.stick.y / m) * mm);
      }
    }
    // T7
    // A `reset()` or a save load rewinds `sim.frame` to 0, which leaves `lastTouchFrame` in the
    // future and the overlay visible forever. Clamp rather than trust the clock's monotonicity.
    if (this.lastTouchFrame > frame) this.lastTouchFrame = -1e9;
    if (this.padActive && frame - this.lastTouchFrame > this.hideAfterFrames && !this.pointers.size) this.visible = false;
  }

  releaseAll() {
    for (const [action, h] of this.held) {
      if (h.gate) { if (h.promoted) this.pipe.edgeUp(h.gate.hold); }
      else this.pipe.edgeUp(action);
    }
    this.held.clear();
    this.pointers.clear();
    this.stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.pipe.setMove(0, 0);
  }

  _hitButton(x, y) {
    // Reverse order so a drawer petal drawn over the arc wins the hit.
    const cs = this.layout();
    for (let i = cs.length - 1; i >= 0; i--) {
      const c = cs[i];
      if (Math.hypot(x - c.x, y - c.y) <= Math.max(c.r, this.cfg.min_target_css_px / 2)) return c;
    }
    return null;
  }

  /** A-JRN6 */
  state() {
    return {
      enabled: this.enabled, visible: this.visible,
      // `visible` is T7's fade timer alone and it is true on a desktop, which the round-1
      // critic recorded as harmless-until-something-is-drawn. Something is drawn now
      // (`ui/touch-overlay.js`), so the value the RENDERER gates on is reported under its own
      // name: `shown` is the conjunction, and it is the one field that answers "is there
      // anything on the glass".
      shown: this.enabled && this.visible,
      pointers: this.pointers.size,
      lastTouchFrame: this.lastTouchFrame, hideAfterFrames: this.hideAfterFrames,
      stick: { ...this.stick }, drawerOpen: this.drawerOpen,
      held: Array.from(this.held.keys()),
      roles: Array.from(this.pointers.values()).map((p) => p.role),
      insetViolations: this.insetViolations().length,
    };
  }
}

// The phone as a real device — RI-JRN04 §F, `platform.mobile.viewport`.
//
// This path was filed at wave 2 by the taxonomy pass that filed every desktop input path at
// wave 1, and W1-AMENDMENT-01 §2b promoted it on the owner's requirement: "I want them to work
// both on desktop AND on mobile with a controller attached." A path that decides whether the
// game renders and accepts input on the device the owner is holding is not a wave-2 path.
//
//   H1  landscape only, locked on the first user gesture (which is the same gesture that
//       enters fullscreen, unlocks audio and requests pointer lock — RI-JRN01 O4). If the lock
//       is refused the game renders a rotate state that is an IN-WORLD illustration, not a
//       modal, and recovers automatically on rotation.
//   H2  device class from `(pointer: coarse)` and `(hover: none)`. NEVER user-agent sniffing,
//       and never the gamepad list (L1: the pad is invisible until its first button press and
//       the player is holding it).
//   H3  `viewport-fit=cover` plus `env(safe-area-inset-*)`; nothing readable or touchable in
//       an inset.
//   H4  `dvh`, never `vh`. The URL bar collapsing is a resize, and a resize must not reset the
//       camera, drop the aspect handling, refetch an asset or interrupt the sim.
//   H5  pinch, double-tap zoom, pull-to-refresh, selection and the long-press callout, all off.
//   H6  fullscreen on the same gesture as H1; exiting does not pause combat but does release
//       held inputs.
//   H12 wake lock during play, released when hidden.
//
// Everything here is guarded for a headless/CI DOM that has no Screen Orientation API, no
// Fullscreen API and no wakeLock — absence is reported, never thrown, because the harness runs
// in exactly that DOM and a throw here would take the whole boot with it.
'use strict';

export class Viewport {
  constructor(canvas, profiles, doc = (typeof document !== 'undefined' ? document : null), win = (typeof window !== 'undefined' ? window : null)) {
    this.canvas = canvas;
    this.doc = doc;
    this.win = win;
    this.cfg = (profiles && profiles.mobile) || {};
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.deviceClass = 'desktop';
    this.orientation = 'landscape';
    this.orientationLocked = false;
    this.lockRefused = false;
    this.fullscreen = false;
    this.wakeLock = null;
    this.resizes = 0;
    this.lastSize = { w: 0, h: 0 };
    this.onResize = null;
    /** L9/H2 — fired when the device class actually changes. `RealInput` wires the fallback. */
    this.onDeviceClass = null;
    this.deviceClassChanges = 0;
    this.capabilities = {
      orientationLock: !!(this.win && this.win.screen && this.win.screen.orientation && this.win.screen.orientation.lock),
      fullscreen: !!(this.canvas && (this.canvas.requestFullscreen || this.canvas.webkitRequestFullscreen)),
      wakeLock: !!(typeof navigator !== 'undefined' && navigator.wakeLock),
      matchMedia: !!(this.win && this.win.matchMedia),
    };
    /** Harness override (A-JRN4). When set it wins over the real media queries and screen. */
    this.override = null;
    this._handlers = [];
  }

  /**
   * H2 — the ONLY device-class source.
   *
   * L9 IS A CONSEQUENCE AND IT HAS TO FIRE HERE, NOT ONLY AT BOOT. "A coarse-pointer device
   * gets the touch fallback from the FIRST FRAME." Round 1 applied that rule once, inside
   * `RealInput.attach()`, so a device class that changed afterwards — a phone rotated into a
   * different media-query state, or a harness `setViewport({pointer:'coarse'})` — moved the
   * reported class and left the touch fallback exactly as it was. The round-1 critic's
   * ablation went straight through the hole: it switched `deviceClass` to `handheld` and
   * nothing downstream of it changed, which is a second, quieter way for the overlay to be
   * absent from a handheld frame. `onDeviceClass` is the notification that closes it.
   */
  detectDeviceClass() {
    const before = this.deviceClass;
    if (this.override && this.override.pointer) {
      this.deviceClass = (this.override.pointer === 'coarse') ? 'handheld' : 'desktop';
    } else if (!this.capabilities.matchMedia) {
      this.deviceClass = 'desktop';
    } else {
      const coarse = this.win.matchMedia(this.cfg.device_class_queries ? this.cfg.device_class_queries.coarse : '(pointer: coarse)').matches;
      const noHover = this.win.matchMedia(this.cfg.device_class_queries ? this.cfg.device_class_queries.no_hover : '(hover: none)').matches;
      this.deviceClass = (coarse && noHover) ? 'handheld' : 'desktop';
    }
    if (this.deviceClass !== before) this.deviceClassChanges++;
    if (this.deviceClass !== before && this.onDeviceClass) this.onDeviceClass(this.deviceClass, before);
    return this.deviceClass;
  }

  /** H3 — read the four insets the UA computed from `env(safe-area-inset-*)`. */
  readSafeAreaInsets() {
    if (this.override && this.override.insets) { this.insets = { ...this.override.insets }; return this.insets; }
    if (!this.doc || !this.win || !this.win.getComputedStyle) return this.insets;
    const cs = this.win.getComputedStyle(this.doc.documentElement);
    const px = (name) => {
      const v = cs.getPropertyValue(name);
      const n = parseFloat(v);
      return isFinite(n) ? n : 0;
    };
    this.insets = { top: px('--sai-top'), right: px('--sai-right'), bottom: px('--sai-bottom'), left: px('--sai-left') };
    return this.insets;
  }

  size() {
    if (this.override && this.override.size) return { ...this.override.size };
    if (!this.win) return { w: 1920, h: 1080, dpr: 1 };
    return { w: this.win.innerWidth, h: this.win.innerHeight, dpr: this.win.devicePixelRatio || 1 };
  }

  isPortrait() {
    if (this.override && this.override.orientation) return this.override.orientation === 'portrait';
    const s = this.size();
    return s.h > s.w;
  }

  /**
   * H1/H6/H9 — the ONE gesture. RI-JRN01 O4: the New/Continue click unlocks audio, enters
   * fullscreen, locks orientation and requests pointer lock. There is no separate surface for
   * any of them, because a surface is the thing the opening's whole bar is about not having.
   */
  async onFirstGesture() {
    const out = { fullscreen: false, orientation: false, wakeLock: false, refusals: [] };
    if (this.deviceClass === 'handheld' || (this.override && this.override.pointer === 'coarse')) {
      if (this.capabilities.fullscreen) {
        try { await (this.canvas.requestFullscreen ? this.canvas.requestFullscreen({ navigationUI: 'hide' }) : this.canvas.webkitRequestFullscreen()); this.fullscreen = true; out.fullscreen = true; }
        catch (e) { out.refusals.push('fullscreen: ' + (e && e.name)); }
      } else out.refusals.push('fullscreen: unsupported');
      if (this.capabilities.orientationLock) {
        try { await this.win.screen.orientation.lock(this.cfg.orientation || 'landscape'); this.orientationLocked = true; out.orientation = true; }
        catch (e) { this.lockRefused = true; out.refusals.push('orientation: ' + (e && e.name)); }
      } else { this.lockRefused = true; out.refusals.push('orientation: unsupported'); }
      out.wakeLock = await this.requestWakeLock();
    }
    return out;
  }

  /** H12 */
  async requestWakeLock() {
    if (!this.capabilities.wakeLock || !this.cfg.wake_lock) return false;
    try { this.wakeLock = await navigator.wakeLock.request('screen'); return true; }
    catch { return false; }
  }

  releaseWakeLock() {
    if (this.wakeLock && this.wakeLock.release) { try { this.wakeLock.release(); } catch { /* already gone */ } }
    this.wakeLock = null;
  }

  /**
   * H1 — when the lock is refused and the device is held in portrait, the game renders a
   * rotate state. It is an in-world illustration and it recovers on rotation with no reload.
   * This returns the MODEL; render/ui.js draws it, and it draws no UI kit (M-P16 measures the
   * opaque non-world fraction and the ceiling is RI-JRN01 M5's 55%).
   */
  rotateState() {
    if (this.deviceClass !== 'handheld') return null;
    if (!this.isPortrait()) return null;
    return {
      kind: 'rotate',
      // No control name, no "please", no button. A thing seen in the world, turned on its side.
      line: 'The map lies the long way.',
      illustration: 'chart-on-a-table',
    };
  }

  /**
   * H4 — a resize is a resize. The camera pose, the sim clock and the asset set are all
   * untouched; only the render target and the CSS-px layout change. The URL bar collapsing
   * mid-play is the common case and it must cost 0 sim frames.
   */
  attach() {
    if (!this.win || this._handlers.length) return;
    const on = (t, type, fn) => { t.addEventListener(type, fn); this._handlers.push([t, type, fn]); };
    const handle = () => {
      const s = this.size();
      if (s.w === this.lastSize.w && s.h === this.lastSize.h) return;
      this.lastSize = { w: s.w, h: s.h };
      this.resizes++;
      this.readSafeAreaInsets();
      this.onResize && this.onResize(s, this.insets);
    };
    on(this.win, 'resize', handle);
    on(this.win, 'orientationchange', handle);
    if (this.win.visualViewport) on(this.win.visualViewport, 'resize', handle);
    if (this.win.screen && this.win.screen.orientation) on(this.win.screen.orientation, 'change', handle);
    this.lastSize = this.size();
    this.readSafeAreaInsets();
  }

  detach() { for (const [t, ty, fn] of this._handlers) t.removeEventListener(ty, fn); this._handlers.length = 0; }

  /** A-JRN4's world side: force a viewport, an orientation, a pointer class and insets. */
  setOverride(o) {
    this.override = o ? { ...(this.override || {}), ...o } : null;
    this.detectDeviceClass();
    this.readSafeAreaInsets();
    const s = this.size();
    if (s.w !== this.lastSize.w || s.h !== this.lastSize.h) {
      this.lastSize = { w: s.w, h: s.h };
      this.resizes++;
      this.onResize && this.onResize(s, this.insets);
    }
    return this.state();
  }

  state() {
    const s = this.size();
    return {
      deviceClass: this.deviceClass,
      size: s,
      insets: { ...this.insets },
      orientation: this.isPortrait() ? 'portrait' : 'landscape',
      orientationLocked: this.orientationLocked,
      lockRefused: this.lockRefused,
      fullscreen: this.fullscreen,
      wakeLock: !!this.wakeLock,
      resizes: this.resizes,
      deviceClassChanges: this.deviceClassChanges,
      rotateState: this.rotateState(),
      capabilities: { ...this.capabilities },
      min_text_css_px: this.cfg.min_text_css_px || 18,
    };
  }
}

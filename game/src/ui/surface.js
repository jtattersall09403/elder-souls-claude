// The interface's drawing surface, and the register of what is on it.
//
// Owner: W1-21.
//
// TWO PROPERTIES, AND EVERY UI MEASUREMENT IN THIS PROJECT DEPENDS ON BOTH.
//
// 1. IT IS IN THE HARNESS SCREENSHOT. `__HARNESS.screenshot()` is `canvas.toDataURL()`
//    (render/renderer.js). A DOM overlay is visible to a human and to Playwright's
//    `page.screenshot()` and INVISIBLE to the harness, so every visual verdict in the project
//    would have measured a different picture from the one the player sees. W1-07 found this and
//    solved it for the dialogue surface by drawing into an offscreen 2D canvas and compositing
//    the result as a textured quad over the 3D pass; a critic verified it by diffing
//    `page.screenshot()` against `__HARNESS.screenshot()` at 19 nodes and got 0 differing
//    pixels. This file follows that architecture exactly. There is no DOM in this interface.
//
// 2. YOU CANNOT DRAW WITHOUT DECLARING. RI-UIX01's sixth "how we lose" is
//    "`getUIState()` becomes the definition of the UI — everything registered is measured;
//    everything drawn straight to canvas is invisible", and RI-UIX02 §C's pixel sweep exists
//    because "a game cannot hide a marker by not declaring it". The answer here is structural
//    rather than disciplinary: `el()` is the ONLY way to get a drawing context, it takes the
//    element record first and the draw callback second, and it clips the callback to the rect
//    it declared. An element that draws outside its declared box is clipped away rather than
//    silently unmeasured, and there is no path from a screen module to the raw 2D context.
//    So the census and the pixels cannot disagree, and `ui-layer.mjs`'s reconciliation is a
//    check on that claim rather than the only thing holding it up.
//
// Render order is preserved: `elements` is append-ordered and is never sorted. RI-UIX04 JU2 is
// computed from render order, and "an implementation that returns elements in an arbitrary or
// z-sorted order makes this item unmeasurable".
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { FACES } from './glyphs.js';

/** The closed element-kind vocabulary. Anything else throws at `el()`. */
export const KINDS = new Set([
  // RI-UIX01 §A — permitted
  'health_bar', 'stamina_bar', 'focus_bar', 'heal_charges', 'quick_slots',
  'buildup_meter', 'lockon_reticle', 'boss_bar', 'equip_load',
  'interact_prompt', 'toast',
  // menu furniture
  'panel', 'panel_header', 'list_row', 'detail_panel', 'encumbrance', 'category',
  'journal_entry', 'journal_index_row', 'book_page', 'page_count', 'attribute_row',
  'attribute_preview', 'souls_held', 'souls_to_next', 'level_value', 'skill_row',
  'spell_row', 'sheet_row', 'search_field', 'scroll_extent', 'selection', 'divider',
  'hint', 'gold', 'container_panel', 'topic_link', 'entry_glyph',
  // W1-29 / RI-JRN04 §G and H1. Added deliberately, and they are here rather than in a
  // separate surface because RI-UIX01's sixth "how we lose" is "everything drawn straight to
  // canvas is invisible": the touch controls are non-world UI on a phone, they occupy frame
  // area, and they must be in the same census every other element is in. `touch_button`
  // carries `text: null` by construction — a labelled touch control is a control legend and
  // is RI-JRN03 DS1's hard fail drawn sixteen times.
  'touch_button', 'touch_stick', 'rotate_illustration',
  // W1-MAP / ARBITRATION S35. The three things the map screen is allowed to be made of, and
  // deliberately NOT named `map`, `map_pin` or `minimap` — those stay in FORBIDDEN_KINDS below
  // and this build still emits none of them, so a census that greps the RI-UIX01 §B names reads
  // 0 after the map exists exactly as it did before. An implementation that had to widen the
  // forbidden list in order to draw its map would be telling on itself.
  //
  // There is no fourth kind and there must not be. A route, a marker, an objective or a
  // distance readout has no kind it could be declared under, and `el()` throws on an undeclared
  // kind — so the way this screen would acquire a pin is a deliberate edit to this list.
  'map_terrain', 'map_place', 'map_player',
]);

/**
 * The X1-X12 names of RI-UIX01 §B, present in the vocabulary as a TRAP: nothing in this build
 * emits one, and `ui-census.mjs` checks for them by name. They are listed so that a census that
 * finds none is a statement about the build rather than about the vocabulary being too small to
 * express the violation.
 */
export const FORBIDDEN_KINDS = new Set([
  'damage_number', 'enemy_nameplate', 'enemy_health_bar', 'hit_marker',
  'damage_direction', 'minimap', 'compass', 'objective_tracker', 'quest_marker',
  'waypoint', 'ground_telegraph', 'xp_popup', 'combo_counter', 'dps_meter',
  'auto_equip', 'best_in_slot', 'active_quest_list', 'objective_line', 'progress_bar',
  'checkbox', 'tracked_quest', 'map', 'map_pin', 'codex_entry',
]);

export class UISurface {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(2, width | 0);
    this.canvas.height = Math.max(2, height | 0);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // NEAREST both ways. The canvas is resized to the drawing buffer on every `setSize`, so the
    // texel:pixel ratio is exactly 1:1 and there is nothing to interpolate — which is what makes
    // RI-UIX06 M-F17.3's "canvas bitmap sampled with LINEAR at non-1:1 scale" not apply, and
    // M-F17.2 (the DPR-2 check, "the whole point of F17") survivable from a canvas path. A
    // LINEAR filter here would resample a 1:1 blit and soften every glyph for nothing.
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.premultiplyAlpha = false;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false, depthWrite: false,
      toneMapped: false, premultipliedAlpha: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.elements = [];
    this.drawn = false;
    this.overdrawPx = 0;
    this.screenAlpha = null;        // set between beginScreen()/endScreen()
    this.screenRect = null;
  }

  /**
   * Open a translucent screen. Everything drawn until `endScreen()` is painted at FULL alpha and
   * the whole rectangle is then knocked back to `alpha` in one operation.
   *
   * This is a correctness fix, not a tidy-up, and RI-UIX03 P5's perturbation test is what found
   * it. Setting `globalAlpha = 0.5` per element COMPOUNDS: a panel, a header, a divider and a
   * row stacked in the same pixel composite to 1 − 0.5⁴ = 0.94, so a "50% opacity" screen was
   * opaque over its own centre and the world behind the fight was gone. Measured: the world
   * moved 0.0% of the centre 40%×40% pixels under a perturbation that moved 99.8% of the pixels
   * outside the screen.
   *
   * `destination-in` with a flat `rgba(0,0,0,alpha)` multiplies the alpha channel of everything
   * already in the rectangle by exactly `alpha` and touches nothing outside it — so the HUD,
   * which is drawn before the screen and lives at the frame's edges, keeps its full opacity.
   */
  beginScreen(rect, alpha) {
    this.screenAlpha = alpha;
    this.screenRect = rect.slice();
  }

  endScreen() {
    if (this.screenAlpha === null || this.screenAlpha >= 1) { this.screenAlpha = null; return; }
    const c = this.ctx, r = this.screenRect;
    c.save();
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = `rgba(0,0,0,${this.screenAlpha})`;
    c.fillRect(r[0] - 8, r[1] - 8, r[2] + 16, r[3] + 16);
    c.restore();
    this.screenAlpha = null;
  }

  /**
   * Resize the surface to the drawing buffer.
   *
   * `texture.dispose()` is not tidiness — it is a correctness fix, and the RI-UIX02 §C pixel
   * sweep is what found it. `THREE.CanvasTexture` allocates its GPU storage at the canvas's
   * size on first upload and, on `needsUpdate`, re-uploads with `texSubImage2D` into that
   * storage. Resize the canvas from 1920×1080 to 1280×720 and the new frame is pasted into the
   * bottom-left corner of a texture that is still 1920×1080 — WebGL's origin is bottom-left —
   * while the old frame survives in the rest of it. Sampled across a full-screen quad, the
   * player sees TWO interfaces: the correct one, and a ghost of the previous size offset up the
   * screen. Measured: the ghost's quick-slot cluster landed at (773, 643) instead of
   * (1152, 592), which is exactly where the arithmetic above puts it.
   *
   * It is invisible at a fixed resolution and appears the moment anyone resizes a window,
   * rotates a phone, or captures at a second device-pixel ratio — i.e. in every RI-UIX06 §E
   * scaling capture and on every real player's first window drag. `dispose()` frees the
   * storage so the next upload is a `texImage2D` at the new size.
   */
  setSize(w, h) {
    const W = Math.max(2, w | 0), H = Math.max(2, h | 0);
    if (this.canvas.width === W && this.canvas.height === H) return false;
    this.canvas.width = W; this.canvas.height = H;
    this.texture.dispose();
    this.texture.needsUpdate = true;
    return true;
  }

  /** Frame scale: 1.0 at 1080p. Every dimension in every screen is expressed in these units. */
  get s() { return this.canvas.height / 1080; }
  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }

  begin() {
    // RI-JRN04 H10 is a physical CSS-pixel floor, not a 1080p-relative preference. At the
    // reference DPR-2 landscape phone, 18 CSS px is 36 backing pixels. Keep the layout model
    // responsive, but never draw its authored small labels below that floor on this population.
    this.ctx.__esMinTextPx = this.canvas.width > this.canvas.height * 1.8 && this.canvas.height <= 900 ? 36 : 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.elements.length = 0;
    this.drawn = false;
    this.overdrawPx = 0;
  }

  /**
   * Declare an element and draw it. The ONLY drawing entry point.
   *
   * @param {object} rec  {id, kind, rect:[x,y,w,h], text?, fill?, worldAnchor?, opacity?,
   *                       material?, focused?, meta?}
   * @param {(ctx: CanvasRenderingContext2D, r: number[]) => void} draw
   */
  el(rec, draw) {
    if (!KINDS.has(rec.kind)) {
      throw new Error(`UISurface.el: kind '${rec.kind}' is not in the closed vocabulary. ` +
        (FORBIDDEN_KINDS.has(rec.kind) ? 'It is an RI-UIX01 §B forbidden kind.' : 'Add it to KINDS deliberately.'));
    }
    const r = rec.rect.map((v) => Math.round(v * 100) / 100);
    const record = {
      id: rec.id,
      kind: rec.kind,
      rect: r,
      visible: rec.visible === undefined ? true : !!rec.visible,
      opacity: rec.opacity === undefined ? 1 : rec.opacity,
      text: rec.text === undefined ? null : rec.text,
      fill: rec.fill === undefined ? null : rec.fill,
      worldAnchor: rec.worldAnchor === undefined ? null : rec.worldAnchor,
      material: rec.material || null,
      focused: !!rec.focused,
    };
    if (rec.meta) record.meta = rec.meta;
    this.elements.push(record);
    if (!record.visible || record.opacity <= 0 || !draw) return record;
    const c = this.ctx;
    c.save();
    // Inside a translucent screen every element paints at FULL alpha; `endScreen()` knocks the
    // whole rectangle back once. `record.opacity` still reports the alpha the player sees.
    c.globalAlpha = this.screenAlpha === null ? record.opacity : 1;
    // The declared rect IS the clip. An element cannot paint outside what it declared.
    c.beginPath();
    c.rect(r[0] - 0.5, r[1] - 0.5, r[2] + 1, r[3] + 1);
    c.clip();
    // W1-HUD-TOAST-A / BLOCKING-1's §3 resolution: `render/text-register.js` records the OWNING
    // ELEMENT for every string drawn while this element's callback runs, so a generalised fit
    // check can find "the entries this element painted" rather than "every entry on the
    // surface". Set for the duration of `draw()` only, on the context `el()` already owns —
    // additive, and a no-op for any context the register does not instrument.
    const prevOwner = c.__esOwnerId;
    c.__esOwnerId = rec.id;
    draw(c, r);
    c.__esOwnerId = prevOwner;
    c.restore();
    this.drawn = true;
    this.overdrawPx += Math.max(0, r[2]) * Math.max(0, r[3]);
    return record;
  }

  /** Composite over whatever the 3D pass just drew. Called by Renderer.render(). */
  render(three) {
    this.texture.needsUpdate = true;
    if (!this.drawn) return false;
    const prev = three.autoClear;
    three.autoClear = false;
    three.clearDepth();
    three.render(this.scene, this.camera);
    three.autoClear = prev;
    return true;
  }

  /** Union area of the visible rects, in px². Exact, by x-slab coordinate compression. */
  unionArea(filter, clip) {
    const rs = [];
    for (const e of this.elements) {
      if (!e.visible || e.opacity <= 0) continue;
      if (filter && !filter(e)) continue;
      let [x, y, w, h] = e.rect;
      if (w <= 0 || h <= 0) continue;
      let x1 = x + w, y1 = y + h;
      if (clip) {
        x = Math.max(x, clip[0]); y = Math.max(y, clip[1]);
        x1 = Math.min(x1, clip[0] + clip[2]); y1 = Math.min(y1, clip[1] + clip[3]);
        if (x1 <= x || y1 <= y) continue;
      }
      rs.push([x, y, x1, y1]);
    }
    if (!rs.length) return 0;
    const xs = [];
    for (const r of rs) { xs.push(r[0], r[2]); }
    xs.sort((a, b) => a - b);
    let area = 0;
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      if (x1 <= x0) continue;
      const iv = [];
      for (const r of rs) if (r[0] <= x0 && r[2] >= x1) iv.push([r[1], r[3]]);
      if (!iv.length) continue;
      iv.sort((a, b) => a[0] - b[0]);
      let cur0 = iv[0][0], cur1 = iv[0][1], span = 0;
      for (let k = 1; k < iv.length; k++) {
        if (iv[k][0] > cur1) { span += cur1 - cur0; cur0 = iv[k][0]; cur1 = iv[k][1]; }
        else if (iv[k][1] > cur1) cur1 = iv[k][1];
      }
      span += cur1 - cur0;
      area += span * (x1 - x0);
    }
    return area;
  }

  /** The `fonts` block RI-UIX06 A3/G2 is checked against. */
  fonts(bodyPx, labelPx) {
    return [
      { family: FACES.ink.family, size_px: bodyPx, weight: FACES.ink.stem, path: FACES.ink.path },
      { family: FACES.bone.family, size_px: labelPx, weight: FACES.bone.stem, path: FACES.bone.path },
    ];
  }
}

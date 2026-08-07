// The rendered-text register — the build's enumerable answer to "what does the frame say?"
//
// Owner: W1-26 (`journey.opening.legibility`). Binding sources: `RI-JRN01` §0.1(a) M9/M15,
// `RI-JRN09` M1 (`ES-LEGIBLE/1`), `RI-MTH06` §B, and the fourth orphan shape named by
// `RI-JRN09`'s CONSUMPTION section: **orphan text** — a string authored, computed correctly,
// carried through the model, exposed through the harness, and never drawn.
//
// WHY THIS FILE EXISTS.
// `RI-JRN01` M9 and M15 are greps over "every string rendered". This game draws all of its
// text into a WebGL canvas, so `document.body.innerText` is `""` and the accessibility tree
// has no children: the obvious instrument returns an empty set, and **a grep over an empty
// set returns zero hits and reads as a clean pass**. The wave-1 amendment closed that by
// refusing to score M9/M15 at all unless the build names an accessor and demonstrates it
// non-empty on a frame known to carry text. This is that accessor.
//
// WHY IT INSTRUMENTS THE DRAW CALL AND NOT A MODEL.
// A register fed by the layout code would be a second copy of the layout's intentions, and
// the defect this whole area exists to catch — round 2's ten authored questions carried
// correctly in the model and drawn by nothing — is precisely a divergence between intention
// and paint. So the register is fed by the **draw call**: nothing can appear in it that was
// not handed to a drawing primitive, and nothing handed to one can fail to appear. It cannot
// drift from the frame because it *is* the frame's text.
//
// THIS BUILD HAS **TWO** TEXT DRAW PATHS, AND ROUND 1 INSTRUMENTED ONE OF THEM.
// `render/ui.js` and `render/title.js` paint with `CanvasRenderingContext2D.fillText`.
// `ui/glyphs.js drawText()` — which every HUD and menu string goes through, via `ui/type.js` —
// renders each glyph as a STROKED QUADRATIC PATH (`moveTo`/`lineTo`/`quadraticCurveTo`/
// `stroke`) and never calls `fillText` at all. Wrapping `fillText` therefore made the HUD
// surface invisible even after its context was instrumented, and the W1-26 round-1 verdict
// falsified it directly: on a freshly instrumented `menus` context, a sentinel through
// `glyphs.drawText()` was **not seen** and a sentinel through `ctx.fillText()` **was**. The
// build's own report then recorded `distinct_searched: 0, hits: []` as an M9 PASS — the
// register bought the same false pass, one layer down, that it was written to close.
//
// So `instrument()` installs `ctx.__esNoteText`, and `glyphs.drawText()` calls it. The hook is
// installed BY the register ON the context, rather than imported by the glyph module, for two
// reasons: a drawing module cannot record against a context the register does not own, and a
// context that was never instrumented has no hook, so an unregistered surface stays visibly
// unregistered instead of quietly reporting into a shared bucket.
//
// AN EMPTY RESULT AND A CLEAN RESULT MUST NEVER BE THE SAME VALUE.
// This is the single most repeated defect in this project: an instrument that cannot see its
// subject returns `[]`, a grep over `[]` returns zero hits, and zero hits reads as a pass.
// §0.1(a) exists because of it and round 1 reproduced it anyway. The register therefore keeps
// a roster: every surface this build draws text onto is `declare()`d — by name, at
// construction, whether or not it can be instrumented — and `coverage()` reports which of them
// are actually wrapped. A query that spans a declared-but-blind surface comes back
// `complete: false` with the blind surfaces named, and every consumer is required to treat
// that as `unmeasurable` rather than as zero hits.
//
// WHY IT ALSO TRACKS THE CLIP.
// `fillText` was called is not the same claim as *the player could read it*. The dialogue
// surface clips to its vellum panel, so a line pushed past the panel's bottom edge is passed
// to `fillText` and painted nowhere. That is orphan text one layer further down, and an
// instrument that could not see it would buy the same false pass the model-side instrument
// bought in round 2. So the register shadows the 2D context's clip state (`save`/`restore`/
// `clip` plus the path calls that build the region), computes each string's own box from
// `measureText`, and marks the entry `clipped` when the two do not intersect. `drawn()`
// excludes clipped strings by default; `all()` returns both so the difference is visible.
//
// DETERMINISM. The register touches no PRNG, no clock and no simulation state; it appends to
// an array during the render pass. It is capped (`CAP`) so a long journey cannot grow it
// without bound, and it records the number of entries it dropped rather than silently
// forgetting them. With rendering disabled (`setRenderRate(0)`) the UI layer still lays out
// on `metrics()`, so a stepping probe that never presents a frame still gets a register — the
// entries it holds are the strings the layout painted into the offscreen 2D canvas, which is
// the same canvas the composited frame samples.
'use strict';

const CAP = 40000;
const INSTRUMENTED = Symbol('es.textRegister.instrumented');

/** A rectangle, or null for "no clip / everything". */
function intersect(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1);
  return { x0, y0, x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

function overlaps(a, b) {
  if (!a || !b) return true;
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export class TextRegister {
  constructor() {
    this.entries = [];
    this.dropped = 0;
    this.seq = 0;
    this.frame = 0;
    this.enabled = true;
    /**
     * The roster. name -> {name, declared, instrumented, paths, why}.
     *
     * A surface appears here the moment the renderer says it exists, which is BEFORE anything
     * has been drawn on it and independently of whether the register managed to wrap it. That
     * is the whole point: `coverage().blind` is how a consumer learns that its zero hits are
     * ignorance rather than absence.
     */
    this.surfaces = new Map();
  }

  /**
   * Name a surface this build paints text onto. Idempotent; safe before instrumentation.
   * @param {string} name  the class `RI-JRN01` M9 filters on ('dialogue' | 'title' | 'menus')
   * @param {string} [why] what draws on it, for a critic reading `coverage()` cold
   */
  declare(name, why) {
    let s = this.surfaces.get(name);
    if (!s) { s = { name, declared: true, instrumented: false, paths: [], why: why || null }; this.surfaces.set(name, s); }
    else if (why) s.why = why;
    return s;
  }

  /**
   * Which declared surfaces are actually wrapped, and which are not.
   *
   * `complete` is the field a consumer must branch on before reporting a grep result. It is
   * derived from the contexts that were really instrumented — never from a static array, which
   * is exactly how round 1 came to publish `surfaces: ['dialogue','title']` while the strings
   * M9 is aimed at were painted on a third surface nobody had wrapped.
   */
  coverage(opts) {
    const o = opts || {};
    const all = [...this.surfaces.values()];
    let scope = all;
    if (o.surface) { const w = Array.isArray(o.surface) ? o.surface : [o.surface]; scope = all.filter((s) => w.indexOf(s.name) >= 0); }
    if (o.notSurface) { const n = Array.isArray(o.notSurface) ? o.notSurface : [o.notSurface]; scope = scope.filter((s) => n.indexOf(s.name) < 0); }
    const instrumented = scope.filter((s) => s.instrumented).map((s) => s.name);
    const blind = scope.filter((s) => !s.instrumented).map((s) => s.name);
    return {
      declared: all.map((s) => s.name),
      instrumented,
      blind,
      complete: blind.length === 0 && scope.length > 0,
      in_scope: scope.length,
      paths: Object.fromEntries(scope.map((s) => [s.name, s.paths.slice()])),
      why: Object.fromEntries(all.map((s) => [s.name, s.why])),
    };
  }

  /** The sim frame the next draw calls belong to. Called once per render by the Renderer. */
  setFrame(f) { this.frame = f | 0; return this.frame; }

  clear() { this.entries.length = 0; this.dropped = 0; this.seq = 0; return true; }

  /**
   * Wrap a 2D context so every string it paints is recorded against `surface`.
   * Idempotent: a context already instrumented is returned unchanged, so a resize or a
   * second Renderer cannot double-record.
   *
   * `surface` is the class `RI-JRN01` M9 filters on — it greps strings rendered *outside* a
   * dialogue/journal/book surface, so the tag has to be on the entry and not inferred by the
   * critic afterwards.
   */
  instrument(ctx, surface) {
    if (!ctx) return ctx;
    const rec = this.declare(surface);
    if (ctx[INSTRUMENTED]) { rec.instrumented = true; return ctx; }
    const reg = this;
    const state = { clip: null, stack: [], path: null };

    const wrap = (name, fn) => {
      const orig = ctx[name].bind(ctx);
      ctx[name] = fn(orig);
    };

    // ---- clip shadowing. Only the path primitives this codebase's surfaces actually use
    // are tracked; anything else widens the path box, which errs towards calling a string
    // VISIBLE. Erring the other way would let the register hide text that was really drawn.
    const grow = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (!state.path) state.path = { x0: x, y0: y, x1: x, y1: y };
      else {
        state.path.x0 = Math.min(state.path.x0, x); state.path.y0 = Math.min(state.path.y0, y);
        state.path.x1 = Math.max(state.path.x1, x); state.path.y1 = Math.max(state.path.y1, y);
      }
    };
    wrap('beginPath', (o) => function () { state.path = null; return o(); });
    wrap('moveTo', (o) => function (x, y) { grow(x, y); return o(x, y); });
    wrap('lineTo', (o) => function (x, y) { grow(x, y); return o(x, y); });
    wrap('quadraticCurveTo', (o) => function (cx, cy, x, y) { grow(cx, cy); grow(x, y); return o(cx, cy, x, y); });
    wrap('bezierCurveTo', (o) => function (a, b, c, d, x, y) { grow(a, b); grow(c, d); grow(x, y); return o(a, b, c, d, x, y); });
    wrap('arc', (o) => function (x, y, r, ...rest) { grow(x - r, y - r); grow(x + r, y + r); return o(x, y, r, ...rest); });
    wrap('rect', (o) => function (x, y, w, h) { grow(x, y); grow(x + w, y + h); return o(x, y, w, h); });
    wrap('save', (o) => function () { state.stack.push(state.clip); return o(); });
    wrap('restore', (o) => function () { state.clip = state.stack.length ? state.stack.pop() : null; return o(); });
    wrap('clip', (o) => function (...a) { state.clip = intersect(state.clip, state.path); return o(...a); });

    const record = (kind) => (orig) => function (text, x, y, maxWidth) {
      const r = orig(text, x, y, maxWidth);
      if (reg.enabled) {
        const s = String(text);
        let w = 0;
        try { w = ctx.measureText(s).width || 0; } catch { w = 0; }
        reg._record(state, surface, kind, s, x, y, w, fontPx(ctx.font), ctx.textAlign || 'left');
      }
      return r;
    };
    wrap('fillText', record('fill'));
    wrap('strokeText', record('stroke'));

    /**
     * The SECOND draw path's entry point — see the header. `ui/glyphs.js drawText()` calls
     * this after it has stroked the string's paths, handing over the advance width and the
     * nominal size it drew at, because a vector run has no `measureText` to interrogate.
     *
     * It is installed on the context by the register rather than imported by the drawer, so a
     * surface the register does not own has no hook and cannot report into it.
     *
     * @param {string} text  @param {number} x  @param {number} y baseline
     * @param {number} w advance in px  @param {number} px nominal size
     */
    ctx.__esNoteText = (text, x, y, w, px) => {
      if (reg.enabled) reg._record(state, surface, 'vector', String(text), x, y, w || 0, px || 16, 'left');
    };
    if (rec.paths.indexOf('fillText') < 0) rec.paths.push('fillText', 'strokeText', 'glyphs.drawText');
    rec.instrumented = true;

    ctx[INSTRUMENTED] = true;
    ctx.__esTextState = state;
    return ctx;
  }

  /**
   * One string, from either draw path.
   *
   * The box is an approximation in both directions: the nominal px size is the only height
   * available cheaply and the baseline sits at `y`. Both bounds are widened by a line's worth
   * so a marginal string is called VISIBLE rather than clipped — the register must never be
   * the thing that hides text that really reached the frame.
   */
  _record(state, surface, kind, s, x, y, w, px, align) {
    if (!s.length) return;
    if (this.entries.length >= CAP) { this.dropped++; return; }
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    const box = { x0, y0: y - px * 1.2, x1: x0 + w, y1: y + px * 0.5 };
    this.entries.push({
      i: this.seq++,
      frame: this.frame,
      surface,
      kind,
      text: s,
      x: Math.round(x), y: Math.round(y),
      w: Math.round(w), px,
      clipped: !overlaps(box, state.clip),
    });
  }

  /** Every string handed to a 2D context, clipped or not. */
  all(opts) { return this._filter(this.entries, opts); }

  /** Every string that reached the frame — the set M9/M15/DTR are computed over. */
  drawn(opts) { return this._filter(this.entries.filter((e) => !e.clipped), opts); }

  _filter(list, opts) {
    const o = opts || {};
    let out = list;
    if (Number.isFinite(o.since)) out = out.filter((e) => e.i >= o.since);
    if (Number.isFinite(o.sinceFrame)) out = out.filter((e) => e.frame >= o.sinceFrame);
    if (o.surface) {
      const want = Array.isArray(o.surface) ? o.surface : [o.surface];
      out = out.filter((e) => want.indexOf(e.surface) >= 0);
    }
    if (o.notSurface) {
      const no = Array.isArray(o.notSurface) ? o.notSurface : [o.notSurface];
      out = out.filter((e) => no.indexOf(e.surface) < 0);
    }
    return out;
  }

  /** The report a critic quotes: counts per surface, plus the drop count if any. */
  summary() {
    const bySurface = {};
    for (const e of this.entries) {
      const b = bySurface[e.surface] || (bySurface[e.surface] = { entries: 0, drawn: 0, clipped: 0, distinct: new Set() });
      b.entries++;
      if (e.clipped) b.clipped++; else { b.drawn++; b.distinct.add(e.text); }
    }
    const out = {};
    for (const k of Object.keys(bySurface)) {
      out[k] = { entries: bySurface[k].entries, drawn: bySurface[k].drawn, clipped: bySurface[k].clipped, distinct_drawn: bySurface[k].distinct.size };
    }
    return { total: this.entries.length, dropped: this.dropped, cap: CAP, surfaces: out };
  }
}

function fontPx(font) {
  const m = /(\d+(?:\.\d+)?)px/.exec(String(font || ''));
  return m ? Math.round(parseFloat(m[1])) : 16;
}

/** One register per page. The Renderer instruments every 2D surface it owns against it. */
export const textRegister = new TextRegister();

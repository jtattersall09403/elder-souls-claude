// The interface's materials.
//
// Owner: W1-21. Binding: RI-UIX06 §A (the material vocabulary) and §B (the forbidden UI-kit
// set). A2 is the rule that shapes this whole file: **no element is a plain rectangle**, every
// panel edge is a material edge, and "uniform corner radii are the signature of a UI kit and are
// forbidden". So there is no `roundRect` here. There are nine materials, and a panel is drawn by
// naming one.
//
// A4: "No colour appears in the UI that does not appear in the world." Every hex below is
// copied out of `corpus/50-world/regions.json` `palette_hex` — 39 colours across 13 regions —
// so the palette-conformance check is ΔE = 0 by construction rather than by tolerance. The
// region each colour was taken from is named, because AD4 is checkable and a critic should be
// able to grep for the string.
//
// DETERMINISM. Every irregularity here — the chitin plate seams, the torn parchment edge, the
// knots in a root lashing, the crazing on fired clay — comes from `hash2`, an integer hash of
// the element's own id and vertex index. No `Math.random()`, so a frame drawn twice is the same
// frame twice, and a screenshot diff between two runs of the same state is empty. That is not a
// nicety: RI-UIX02 §E's whole detector is a pixel difference restricted to the UI layer, and a
// UI that jitters makes every `D` non-empty and the detector useless.
'use strict';

/**
 * The palette. Key -> [hex, "region it is in the world"].
 * Anything drawn in this interface picks from here and nowhere else.
 */
export const PALETTE = {
  // ink and page
  ink: ['#241e1c', 'Thornmarsh'],
  ink_soft: ['#4a3423', 'Blackwood'],
  parchment: ['#dcd2b8', 'Eastern Rootlands'],
  parchment_dim: ['#c8bfa8', 'The Salt Hills'],
  parchment_deep: ['#b9b2a0', 'Thornmarsh'],
  // bone
  bone: ['#e6e2d0', 'The Hive'],
  bone_bright: ['#edede6', 'Stone Wastes'],
  bone_dim: ['#8e8a7e', "Marauder's Coast"],
  // chitin
  chitin: ['#2a211a', 'Western Rootlands'],
  chitin_dark: ['#16191a', 'The Deep Marshes'],
  chitin_lit: ['#4a3423', 'Blackwood'],
  chitin_sheen: ['#4f7a5e', 'Western Rootlands'],
  chitin_sheen2: ['#5e7c88', 'The Deep Marshes'],
  // root and reed
  root: ['#6b5638', 'Blackwood'],
  root_pale: ['#8b8577', 'The Salt Hills'],
  reed: ['#8e8a7e', "Marauder's Coast"],
  reed_dark: ['#2c3a2e', 'Blackwood'],
  moss: ['#4e6b3c', 'Thornmarsh'],
  moss_deep: ['#1f2e1c', 'The Hive'],
  // resin and shell
  resin: ['#c39a5c', 'Crimson Coast'],
  resin_deep: ['#b8712c', 'Thornmarsh'],
  resin_pale: ['#d6c77a', 'The Hive'],
  amethyst: ['#4a3a55', 'The Stone Forest'],
  shell: ['#b7c4c0', 'Eastern Rootlands'],
  shell_lit: ['#c6d2da', 'The Salt Hills'],
  shell_cold: ['#8fa6b4', 'Valus Ridge'],
  // clay and blood
  clay: ['#9c5b3c', 'The Clay Moor'],
  clay_dark: ['#8c5a3a', 'Western Rootlands'],
  blood: ['#8e2b33', 'Crimson Coast'],
  slate: ['#232021', 'Crimson Coast'],
};

/** hex for a palette key. Throws on an unknown key, so a stray colour cannot be typed in. */
export function C(key) {
  const e = PALETTE[key];
  if (!e) throw new Error(`theme.C('${key}'): not a world palette colour. AD4 forbids it.`);
  return e[0];
}

/** rgba() from a palette key. */
export function Ca(key, a) {
  const h = C(key);
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The nine materials of RI-UIX06 §A, named so a census can be taken from the draw calls. */
export const MATERIALS = ['chitin', 'root', 'ink', 'parchment', 'bone', 'resin', 'reed', 'shell', 'clay'];

// ---- determinism ------------------------------------------------------------------------

/** 32-bit integer hash of (a, b). No clock, no PRNG, no state. */
export function hash2(a, b) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
/** hash2 mapped to [-1, 1). */
export function jitter(a, b) { return (hash2(a, b) / 2147483648) - 1; }
/** A stable integer id for a string, so an element's irregularity follows its identity. */
export function idHash(s) {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- edges ------------------------------------------------------------------------------

/**
 * A chitin plate edge: segmented, slightly asymmetric, joins visible. NOT a rounded rectangle
 * — the corners are plate ends that overlap, and no two of the four are the same.
 * Traces a closed path; the caller fills and/or strokes it.
 */
export function chitinPath(ctx, x, y, w, h, s, seed) {
  const seg = Math.max(3, Math.round(Math.min(w, h) / (26 * s)));
  const k = seed | 0;
  ctx.beginPath();
  const edge = (x0, y0, x1, y1, side) => {
    const dx = (x1 - x0) / seg, dy = (y1 - y0) / seg;
    const nx = (y1 - y0), ny = -(x1 - x0);
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i <= seg; i++) {
      const j = jitter(k + side * 977, i) * 1.9 * s;
      ctx.lineTo(x0 + dx * i + (nx / nl) * j, y0 + dy * i + (ny / nl) * j);
    }
  };
  ctx.moveTo(x, y);
  edge(x, y, x + w, y, 1);
  edge(x + w, y, x + w, y + h, 2);
  edge(x + w, y + h, x, y + h, 3);
  edge(x, y + h, x, y, 4);
  ctx.closePath();
}

/**
 * A torn / cockled parchment edge. Fibrous, irregular, translucent at the edge. The amplitude
 * is larger than chitin's and the period is shorter, so the two edges are told apart in a crop.
 */
export function parchmentPath(ctx, x, y, w, h, s, seed) {
  const step = Math.max(4, Math.round(7 * s));
  const k = seed | 0;
  ctx.beginPath();
  let n = 0;
  const run = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const cnt = Math.max(2, Math.round(len / step));
    const dx = (x1 - x0) / cnt, dy = (y1 - y0) / cnt;
    const nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
    for (let i = 1; i <= cnt; i++) {
      const j = (jitter(k, n++) * 2.6 + jitter(k + 31, n) * 1.3) * s;
      ctx.lineTo(x0 + dx * i + nx * j, y0 + dy * i + ny * j);
    }
  };
  ctx.moveTo(x, y);
  run(x, y, x + w, y); run(x + w, y, x + w, y + h);
  run(x + w, y + h, x, y + h); run(x, y + h, x, y);
  ctx.closePath();
}

// ---- surfaces ---------------------------------------------------------------------------

/**
 * A panel of one material. This is the only way a background gets drawn in this interface.
 * @param {string} material one of MATERIALS
 * @param {number} alpha    0..1 — a panel over a live fight is translucent (RI-UIX03 P5)
 */
export function panel(ctx, material, x, y, w, h, s, seed, alpha) {
  const a = alpha === undefined ? 1 : alpha;
  ctx.save();
  ctx.globalAlpha = a;
  switch (material) {
    case 'chitin': {
      chitinPath(ctx, x, y, w, h, s, seed);
      const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
      g.addColorStop(0, C('chitin'));
      g.addColorStop(0.55, C('chitin_dark'));
      g.addColorStop(1, C('chitin'));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // plate seams: the joins are visible, which is the material's whole tell
      const rows = Math.max(2, Math.round(h / (30 * s)));
      for (let i = 1; i < rows; i++) {
        const yy = y + (h * i) / rows + jitter(seed + 7, i) * 2 * s;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        for (let t = 1; t <= 8; t++) ctx.lineTo(x + (w * t) / 8, yy + jitter(seed + 13, i * 8 + t) * 1.6 * s);
        ctx.strokeStyle = Ca('chitin_dark', 0.85); ctx.lineWidth = 1.4 * s; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, yy - 1.2 * s);
        for (let t = 1; t <= 8; t++) ctx.lineTo(x + (w * t) / 8, yy - 1.2 * s + jitter(seed + 13, i * 8 + t) * 1.6 * s);
        ctx.strokeStyle = Ca(i % 2 ? 'chitin_sheen' : 'chitin_sheen2', 0.22); ctx.lineWidth = 1 * s; ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'parchment': {
      parchmentPath(ctx, x, y, w, h, s, seed);
      const g = ctx.createLinearGradient(x, y, x + w * 0.2, y + h);
      g.addColorStop(0, C('parchment'));
      g.addColorStop(0.5, C('parchment_dim'));
      g.addColorStop(1, C('parchment_deep'));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // fibre: the cockling of a bark-paper that has been wet
      for (let i = 0; i < Math.round(h / (5 * s)); i++) {
        const yy = y + i * 5 * s + jitter(seed + 3, i) * 2 * s;
        ctx.beginPath(); ctx.moveTo(x, yy);
        for (let t = 1; t <= 10; t++) ctx.lineTo(x + (w * t) / 10, yy + jitter(seed + 5, i * 10 + t) * 1.4 * s);
        ctx.strokeStyle = Ca('root_pale', 0.055 + 0.05 * Math.abs(jitter(seed + 9, i)));
        ctx.lineWidth = 1.1 * s; ctx.stroke();
      }
      // damp staining, heavier at the edges — this is ALBEDO, never a blur (CC-7)
      const st = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.2,
        x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.72);
      st.addColorStop(0, Ca('parchment', 0));
      st.addColorStop(1, Ca('ink_soft', 0.30));
      ctx.fillStyle = st; ctx.fillRect(x, y, w, h);
      ctx.restore();
      break;
    }
    case 'reed': {
      chitinPath(ctx, x, y, w, h, s, seed + 101);
      ctx.fillStyle = C('reed_dark'); ctx.fill();
      ctx.save(); ctx.clip();
      const p = Math.max(4, 6 * s);
      for (let i = 0; i * p < w + h; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * p, y); ctx.lineTo(x + i * p - h, y + h);
        ctx.strokeStyle = Ca('reed', i % 3 === 0 ? 0.16 : 0.07); ctx.lineWidth = 1.6 * s; ctx.stroke();
      }
      for (let i = 0; i * p * 2 < h; i++) {
        ctx.beginPath(); ctx.moveTo(x, y + i * p * 2); ctx.lineTo(x + w, y + i * p * 2);
        ctx.strokeStyle = Ca('reed', 0.10); ctx.lineWidth = 1.2 * s; ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'clay': {
      parchmentPath(ctx, x, y, w, h, s, seed + 57);
      ctx.fillStyle = C('clay_dark'); ctx.fill();
      ctx.save(); ctx.clip();
      // crazed glaze and thumbprints
      for (let i = 0; i < 26; i++) {
        const cx = x + ((hash2(seed, i) % 1000) / 1000) * w, cy = y + ((hash2(seed, i + 500) % 1000) / 1000) * h;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        let px = cx, py = cy;
        for (let t = 0; t < 4; t++) { px += jitter(seed + i, t) * 14 * s; py += jitter(seed + i, t + 40) * 14 * s; ctx.lineTo(px, py); }
        ctx.strokeStyle = Ca('clay', 0.30); ctx.lineWidth = 1 * s; ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const cx = x + ((hash2(seed + 11, i) % 1000) / 1000) * w, cy = y + ((hash2(seed + 11, i + 9) % 1000) / 1000) * h;
        const rr = (8 + (hash2(seed, i) % 7)) * s;
        for (let t = 0; t < 5; t++) {
          ctx.beginPath(); ctx.arc(cx, cy, rr - t * 1.6 * s, 0.6, 4.1); ctx.strokeStyle = Ca('clay', 0.16); ctx.lineWidth = 0.9 * s; ctx.stroke();
        }
      }
      // Fired clay sits at L 0.13, which is the worst luminance a ground can have: too dark for
      // ink, too light for bone. A slip of chitin-black is brushed over it — a real thing a
      // potter does to a vessel — which brings the ground to L 0.06 and puts bone on it at
      // better than 7:1. The crazing and the thumbprints are still visible through it.
      ctx.fillStyle = Ca('chitin_dark', 0.55);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'bone': {
      chitinPath(ctx, x, y, w, h, s, seed + 211);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, C('bone_bright')); g.addColorStop(1, C('bone'));
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      for (let i = 0; i < Math.round(w / (18 * s)); i++) {          // scrimshaw
        const xx = x + i * 18 * s + jitter(seed + 2, i) * 4 * s;
        ctx.beginPath(); ctx.moveTo(xx, y + 2 * s); ctx.lineTo(xx + jitter(seed + 4, i) * 5 * s, y + h - 2 * s);
        ctx.strokeStyle = Ca('bone_dim', 0.18); ctx.lineWidth = 0.9 * s; ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default:
      throw new Error(`theme.panel: unknown material '${material}'`);
  }
  ctx.restore();
}

/**
 * The frame around a panel: root, lashed. Corners are KNOTS, not mitres (RI-UIX06 §A "root").
 * Drawn as the panel's own edge so there is no separate 1 px border anywhere (G4).
 */
export function rootLashing(ctx, x, y, w, h, s, seed) {
  ctx.save();
  ctx.lineCap = 'round';
  // the bound root itself
  chitinPath(ctx, x, y, w, h, s, seed + 401);
  ctx.strokeStyle = C('root'); ctx.lineWidth = 4.4 * s; ctx.stroke();
  ctx.strokeStyle = Ca('root_pale', 0.5); ctx.lineWidth = 1.6 * s; ctx.stroke();
  // the lashings, at irregular intervals — fibre wound round the frame
  const per = 46 * s;
  const wind = (x0, y0, x1, y1, side) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / per));
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const nx = uy, ny = -ux;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 + jitter(seed + side, i) * 0.28) * (len / n);
      const cx = x0 + ux * t, cy = y0 + uy * t;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + ux * k * 2.1 * s - nx * 5.5 * s, cy + uy * k * 2.1 * s - ny * 5.5 * s);
        ctx.lineTo(cx + ux * k * 2.1 * s + nx * 5.5 * s, cy + uy * k * 2.1 * s + ny * 5.5 * s);
        ctx.strokeStyle = Ca('root_pale', 0.8); ctx.lineWidth = 1.5 * s; ctx.stroke();
      }
    }
  };
  wind(x, y, x + w, y, 1); wind(x + w, y, x + w, y + h, 2);
  wind(x + w, y + h, x, y + h, 3); wind(x, y + h, x, y, 4);
  // knots at the corners: a root frame is grown and tied, so the corner is the thickest thing
  for (const [cx, cy, i] of [[x, y, 0], [x + w, y, 1], [x + w, y + h, 2], [x, y + h, 3]]) {
    const r = (5.4 + Math.abs(jitter(seed + 71, i)) * 2.4) * s;
    ctx.beginPath();
    for (let t = 0; t <= 12; t++) {
      const a = (t / 12) * Math.PI * 2;
      const rr = r * (1 + jitter(seed + 73, i * 13 + t) * 0.30);
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = C('root'); ctx.fill();
    ctx.strokeStyle = Ca('root_pale', 0.6); ctx.lineWidth = 1.3 * s; ctx.stroke();
  }
  ctx.restore();
}

/**
 * Shell inlay: nacreous, catching the light along ONE axis. Used for selection. It is not a
 * focus ring and it does not glow — it is a material that is bright when the light hits it,
 * which is A5 ("nothing glows for UI reasons") satisfied by giving the highlight a direction.
 */
export function shellInlay(ctx, x, y, w, h, s, seed) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, Ca('shell_cold', 0.10));
  g.addColorStop(0.42, Ca('shell_lit', 0.44));
  g.addColorStop(0.52, Ca('bone_bright', 0.52));
  g.addColorStop(0.66, Ca('shell', 0.20));
  g.addColorStop(1, Ca('shell_cold', 0.06));
  chitinPath(ctx, x, y, w, h, s, seed + 601);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

/**
 * A resin fill: translucent, viscous, lit from within by a single internal highlight rather
 * than by an emissive halo. Used for the focus bar and the status buildup meters.
 */
export function resinFill(ctx, x, y, w, h, s, key) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, Ca(key, 0.75));
  g.addColorStop(0.42, C(key));
  g.addColorStop(1, Ca(key, 0.88));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // the light inside it: one line, one axis, no bloom
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.30); ctx.lineTo(x + w, y + h * 0.30);
  ctx.strokeStyle = Ca('resin_pale', 0.35); ctx.lineWidth = Math.max(1, h * 0.10); ctx.stroke();
  ctx.restore();
}

/** A worked bone pip — the level-up attribute markers, the healing-charge count, list bullets. */
export function bonePip(ctx, cx, cy, r, s, filled, seed) {
  ctx.beginPath();
  for (let t = 0; t <= 7; t++) {
    const a = (t / 7) * Math.PI * 2 - 0.4;
    const rr = r * (1 + jitter(seed, t) * 0.22);
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.92;
    if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = C('bone'); ctx.fill(); }
  ctx.strokeStyle = filled ? Ca('bone_dim', 0.9) : Ca('bone_dim', 0.55);
  ctx.lineWidth = 1.3 * s;
  ctx.stroke();
}

/** A bone divider: a worked splinter, not a hairline (G4 forbids a 1 px border). */
export function boneRule(ctx, x, y, w, s, seed) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let t = 1; t <= 10; t++) ctx.lineTo(x + (w * t) / 10, y + jitter(seed, t) * 1.1 * s);
  ctx.strokeStyle = Ca('bone_dim', 0.55);
  ctx.lineWidth = 2.2 * s;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 1.1 * s);
  for (let t = 1; t <= 10; t++) ctx.lineTo(x + (w * t) / 10, y - 1.1 * s + jitter(seed, t) * 1.1 * s);
  ctx.strokeStyle = Ca('bone', 0.30);
  ctx.lineWidth = 1 * s;
  ctx.stroke();
  ctx.restore();
}

/**
 * WCAG relative luminance and contrast, on hex strings. Here rather than in a tool because the
 * build must be able to state its own D3 figures and a critic must be able to check them
 * against pixels — two numbers from two instruments, which is the point.
 */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(hexA, hexB) {
  const a = luminance(hexA), b = luminance(hexB);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return +((hi + 0.05) / (lo + 0.05)).toFixed(3);
}

/**
 * The bar colour contract, stated as data so `ui-census.mjs` can assert D3 against the same
 * numbers the renderer uses and a critic can assert both against pixels.
 *
 * Every bar is a BONE TROUGH that a resource fills. That is what makes D3 passable at all: a
 * dark fill in a light trough clears 4.5:1 in both directions, whereas the usual bright-fill-
 * on-black arrangement puts crimson (L 0.077) on near-black (L 0.009) at 2.17:1 and fails.
 */
export const BARS = {
  health: { trough: 'bone', fill: 'blood' },
  // `spent` is the D2 signal: while regen is blocked, the stretch of trough between the current
  // level and where stamina stood at the spend is drawn INK instead of bone. It is a large,
  // 10.9:1 change in the same pixels, it drains as the delay elapses, and it disappears the
  // frame regen resumes. `exhaustedTrough` is D6's third state: at 0 the whole trough is ink.
  stamina: { trough: 'parchment', fill: 'reed_dark', spent: 'ink', exhaustedTrough: 'ink' },
  focus: { trough: 'parchment_dim', fill: 'amethyst' },
  boss: { trough: 'bone', fill: 'blood' },
};

/** Per-affliction buildup fills (S11). Each is a resin, and each clears 4.5:1 on its trough. */
export const BUILDUP = {
  trough: 'parchment_dim',
  poison: 'moss_deep',
  disease: 'ink_soft',
  curse: 'amethyst',
  frost: 'slate',
};

/** D3's figures, computed from the palette rather than asserted. */
export function barContrasts() {
  const out = {};
  for (const [k, v] of Object.entries(BARS)) {
    out[k] = { fill_vs_trough: contrast(C(v.fill), C(v.trough)) };
    if (v.spent) out[k].spent_vs_trough = contrast(C(v.spent), C(v.trough));
    if (v.exhaustedTrough) out[k].exhausted_trough_vs_trough = contrast(C(v.exhaustedTrough), C(v.trough));
  }
  for (const k of ['poison', 'disease', 'curse', 'frost']) {
    out['buildup_' + k] = { fill_vs_trough: contrast(C(BUILDUP[k]), C(BUILDUP.trough)) };
  }
  return out;
}

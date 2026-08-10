// The interface's own letterforms.
//
// Owner: W1-21. Binding: RI-UIX06 A3 ("the typeface is DRAWN FOR THIS WORLD, not a system or
// web font. Two faces maximum: one for body prose, one for numerals and labels") and G2, which
// makes a system/web font stack a hard fail of the ART side.
//
// WHY THIS IS OUTLINE DATA AND NOT A FONT FILE OR A CSS STACK.
//
//  1. `render/ui.js` uses `bodyFont(px) => '${px}px Georgia, "Times New Roman", serif'`. That is
//     G2 verbatim, and its own comment says why it had to be generic: "a named face that is not
//     installed in the capture container silently falls back and changes every glyph metric
//     between a developer's machine and CI." Both problems have the same fix — ship the glyphs
//     as geometry inside the build. Nothing to install, nothing to fall back to, identical
//     metrics on every machine, and the face is a project asset that a critic can read.
//
//  2. RI-UIX06 M-F17.3 wants a VECTOR or SDF text path and fails "a canvas bitmap sampled with
//     LINEAR at non-1:1 scale". These are quadratic-Bezier paths stroked by the 2D rasteriser at
//     whatever size is asked for, so the glyph is re-rasterised at every resolution and every
//     device pixel ratio. There is no glyph atlas anywhere in this build to upscale.
//
//  3. M-F17.1/M-F17.2 measure a stem's 10%->90% luminance transition in DEVICE pixels. A stroked
//     vector path gives a one-pixel antialiased edge at any size, which is the population the
//     1.5 px threshold was drawn to sit inside.
//
// THE GRID. x grows right from 0; y grows DOWN. Cap top y=0, x-height top y=4.2, baseline y=10,
// descender y=13.2. So one "unit" is capHeight/10 and the em is 10/0.72 = 13.89 units, matching
// a cap height of 0.72 em, which is ordinary for a text face.
//
// THE TWO PENS. There is one set of skeletons and two pens over it, which is how a written face
// and its carved companion relate in a place that writes with a reed on wet bark and cuts labels
// into bone:
//   * `ink`  — the reed pen. Curves are drawn as curves; stem 1.15 units; natural widths.
//   * `bone` — the knife. Every quadratic is FLATTENED to its chord, the whole face is condensed
//     to 0.85, and the stem is 1.5 units. A knife does not draw a curve, and the difference is
//     produced by the tool rather than asserted in a table.
// Declared as two families in `getUIState().fonts`, both pointing at this file, so a critic
// reading AD3 sees project geometry and can check the claim by reading it.
'use strict';

/** Cap height, in grid units. The scale factor for a requested px size is `size*CAP_EM/CAP`. */
export const CAP = 10;
export const BASELINE = 10;
export const CAP_EM = 0.72;          // cap height as a fraction of the nominal font size
export const XHEIGHT_Y = 4.2;
export const DESCENDER_Y = 13.2;

/**
 * glyph -> [advanceWidth, pathData]. Path data is SVG-ish: `M x y`, `L x y`, `Q cx cy x y`,
 * comma or space separated. Parsed once into a flat command array by `parseGlyph`.
 */
const G = {
  ' ': [3.2, ''],
  ' ': [3.2, ''],

  // ---- lower case ---------------------------------------------------------------------
  a: [6.4, 'M1,5.2Q2.2,4.2 3.8,4.2Q5.6,4.2 5.6,6.2L5.6,10M5.6,6.6Q2.6,6.6 1.4,7.5Q0.5,8.3 1.2,9.3Q2,10.3 3.6,9.8Q4.9,9.4 5.6,8.4'],
  b: [6.6, 'M1,0.2L1,10M1,5.2Q2.4,4.2 4,4.2Q6,4.2 6,7.1Q6,10 4,10Q2.4,10 1,9'],
  c: [6.0, 'M5.6,5.4Q4.6,4.2 3.2,4.2Q0.8,4.2 0.8,7.1Q0.8,10 3.2,10Q4.6,10 5.6,8.8'],
  d: [6.6, 'M5.6,0.2L5.6,10M5.6,5.2Q4.2,4.2 2.6,4.2Q0.6,4.2 0.6,7.1Q0.6,10 2.6,10Q4.2,10 5.6,9'],
  e: [6.0, 'M0.9,7L5.4,7Q5.4,4.2 3.1,4.2Q0.8,4.2 0.8,7.1Q0.8,10 3.3,10Q4.8,10 5.6,8.9'],
  f: [4.4, 'M4,0.4Q1.6,-0.2 1.6,2.4L1.6,10M0.2,4.6L3.8,4.6'],
  g: [6.4, 'M5.6,5.2Q4.2,4.2 2.6,4.2Q0.6,4.2 0.6,7Q0.6,9.8 2.6,9.8Q4.2,9.8 5.6,8.8M5.6,4.4L5.6,11.4Q5.6,13.2 3.2,13.2Q1.6,13.2 0.9,12.3'],
  h: [6.4, 'M1,0.2L1,10M1,5.4Q2.2,4.2 3.8,4.2Q5.8,4.2 5.8,6.4L5.8,10'],
  i: [2.4, 'M1.2,4.4L1.2,10M1.2,2.2L1.2,2.6'],
  j: [2.8, 'M1.6,4.4L1.6,11.6Q1.6,13.2 0.2,13.1M1.6,2.2L1.6,2.6'],
  k: [6.0, 'M1,0.2L1,10M5.6,4.4L1.2,7.6M2.6,6.6L5.8,10'],
  l: [2.4, 'M1.2,0.2L1.2,10'],
  m: [9.6, 'M1,4.4L1,10M1,5.4Q2,4.2 3.4,4.2Q5,4.2 5,6.2L5,10M5,5.4Q6,4.2 7.4,4.2Q9,4.2 9,6.2L9,10'],
  n: [6.4, 'M1,4.4L1,10M1,5.4Q2.2,4.2 3.8,4.2Q5.8,4.2 5.8,6.4L5.8,10'],
  o: [6.6, 'M3.2,4.2Q0.8,4.2 0.8,7.1Q0.8,10 3.2,10Q5.6,10 5.6,7.1Q5.6,4.2 3.2,4.2'],
  p: [6.6, 'M1,4.4L1,13.2M1,5.2Q2.4,4.2 4,4.2Q6,4.2 6,7.1Q6,10 4,10Q2.4,10 1,9'],
  q: [6.6, 'M5.6,4.4L5.6,13.2M5.6,5.2Q4.2,4.2 2.6,4.2Q0.6,4.2 0.6,7.1Q0.6,10 2.6,10Q4.2,10 5.6,9'],
  r: [4.6, 'M1,4.4L1,10M1,5.6Q2,4.2 4.2,4.4'],
  s: [5.4, 'M4.8,5.2Q4,4.2 2.6,4.2Q0.9,4.2 0.9,5.6Q0.9,6.8 2.8,7.1Q4.9,7.4 4.9,8.6Q4.9,10 2.8,10Q1.2,10 0.5,9'],
  t: [4.4, 'M1.6,1.8L1.6,8.4Q1.6,10 3.6,9.9M0.2,4.6L3.8,4.6'],
  u: [6.4, 'M1,4.4L1,8Q1,10 2.8,10Q4.4,10 5.6,8.8M5.6,4.4L5.6,10'],
  v: [5.8, 'M0.6,4.4L2.9,10L5.2,4.4'],
  w: [8.8, 'M0.6,4.4L2.2,10L4.4,5.6L6.6,10L8.2,4.4'],
  x: [5.8, 'M0.6,4.4L5.2,10M5.2,4.4L0.6,10'],
  y: [5.8, 'M0.6,4.4L2.9,10M5.2,4.4L2,12.2Q1.4,13.2 0.4,13'],
  z: [5.4, 'M0.6,4.4L4.9,4.4L0.6,10L5.1,10'],

  // ---- capitals -----------------------------------------------------------------------
  A: [7.6, 'M0.4,10L3.8,0L7.2,10M1.6,7.2L6,7.2'],
  B: [6.8, 'M1,0L1,10M1,0L4.2,0Q6.2,0 6.2,2.4Q6.2,4.8 4.2,4.8L1,4.8M1,4.8L4.6,4.8Q6.6,4.8 6.6,7.4Q6.6,10 4.6,10L1,10'],
  C: [7.0, 'M6.4,1.6Q5.2,0 3.4,0Q0.8,0 0.8,5Q0.8,10 3.4,10Q5.2,10 6.4,8.4'],
  D: [7.2, 'M1,0L1,10M1,0L3.8,0Q6.8,0 6.8,5Q6.8,10 3.8,10L1,10'],
  E: [6.2, 'M5.8,0L1,0L1,10L5.8,10M1,4.8L4.8,4.8'],
  F: [5.8, 'M5.6,0L1,0L1,10M1,4.8L4.6,4.8'],
  G: [7.4, 'M6.4,1.6Q5.2,0 3.4,0Q0.8,0 0.8,5Q0.8,10 3.4,10Q6.6,10 6.6,7L6.6,5.6L4.2,5.6'],
  H: [7.2, 'M1,0L1,10M6.2,0L6.2,10M1,5L6.2,5'],
  I: [2.6, 'M1.3,0L1.3,10'],
  J: [5.0, 'M4,0L4,7.8Q4,10 2.2,10Q0.6,10 0.4,8.4'],
  K: [6.8, 'M1,0L1,10M6.2,0L1.2,5.4M2.6,4L6.6,10'],
  L: [5.8, 'M1,0L1,10L5.6,10'],
  M: [9.0, 'M1,10L1,0L4.5,7.4L8,0L8,10'],
  N: [7.4, 'M1,10L1,0L6.4,10L6.4,0'],
  O: [7.8, 'M3.9,0Q0.8,0 0.8,5Q0.8,10 3.9,10Q7,10 7,5Q7,0 3.9,0'],
  P: [6.6, 'M1,10L1,0L4.2,0Q6.4,0 6.4,2.8Q6.4,5.6 4.2,5.6L1,5.6'],
  Q: [7.8, 'M3.9,0Q0.8,0 0.8,5Q0.8,10 3.9,10Q7,10 7,5Q7,0 3.9,0M4.6,7.4L7.4,10.8'],
  R: [6.8, 'M1,10L1,0L4.2,0Q6.4,0 6.4,2.6Q6.4,5.2 4.2,5.2L1,5.2M3.6,5.2L6.6,10'],
  S: [6.2, 'M5.8,1.4Q5,0 3,0Q1,0 1,2.4Q1,4.4 3.4,4.8Q5.9,5.2 5.9,7.4Q5.9,10 3.4,10Q1.4,10 0.5,8.6'],
  T: [6.4, 'M0.4,0L6,0M3.2,0L3.2,10'],
  U: [7.2, 'M1,0L1,7.4Q1,10 3.6,10Q6.2,10 6.2,7.4L6.2,0'],
  V: [7.2, 'M0.6,0L3.6,10L6.6,0'],
  W: [10.4, 'M0.6,0L2.6,10L5.2,2.6L7.8,10L9.8,0'],
  X: [7.0, 'M0.6,0L6.4,10M6.4,0L0.6,10'],
  Y: [7.0, 'M0.6,0L3.5,5.2L6.4,0M3.5,5.2L3.5,10'],
  Z: [6.4, 'M0.5,0L5.9,0L0.5,10L5.9,10'],

  // ---- figures. One advance width for all ten, so a column of numbers lines up. --------
  0: [5.8, 'M2.9,0Q0.7,0 0.7,5Q0.7,10 2.9,10Q5.1,10 5.1,5Q5.1,0 2.9,0'],
  1: [5.8, 'M1.3,1.8L3,0L3,10M1.4,10L4.7,10'],
  2: [5.8, 'M0.8,1.8Q1.2,0 3,0Q5,0 5,2.2Q5,4 3,5.6L0.7,10L5.2,10'],
  3: [5.8, 'M0.8,1.4Q1.4,0 3,0Q5,0 5,2.2Q5,4.4 2.8,4.6Q5.2,4.8 5.2,7.2Q5.2,10 3,10Q1.2,10 0.6,8.6'],
  4: [5.8, 'M4,10L4,0L0.5,7.2L5.4,7.2'],
  5: [5.8, 'M5,0L1.2,0L0.9,4.6Q1.8,4 2.9,4Q5.2,4 5.2,7Q5.2,10 2.9,10Q1.2,10 0.6,8.6'],
  6: [5.8, 'M4.9,1Q4.2,0 3,0Q0.8,0 0.8,5.4Q0.8,10 3,10Q5.1,10 5.1,7.4Q5.1,5 3,5Q1.4,5 0.9,6.6'],
  7: [5.8, 'M0.5,0L5.3,0L2.2,10'],
  8: [5.8, 'M2.9,0Q0.9,0 0.9,2.3Q0.9,4.6 2.9,4.6Q4.9,4.6 4.9,2.3Q4.9,0 2.9,0M2.9,4.6Q0.6,4.6 0.6,7.3Q0.6,10 2.9,10Q5.2,10 5.2,7.3Q5.2,4.6 2.9,4.6'],
  9: [5.8, 'M0.9,9Q1.6,10 2.8,10Q5,10 5,4.6Q5,0 2.8,0Q0.7,0 0.7,2.6Q0.7,5 2.8,5Q4.4,5 4.9,3.4'],

  // ---- marks ---------------------------------------------------------------------------
  '.': [2.6, 'M1.3,9.6L1.3,10'],
  ',': [2.6, 'M1.4,9.6L0.7,11.6'],
  ':': [2.6, 'M1.3,5.6L1.3,6M1.3,9.6L1.3,10'],
  ';': [2.6, 'M1.3,5.6L1.3,6M1.4,9.6L0.7,11.6'],
  "'": [2.2, 'M1.1,0L0.8,2.6'],
  '"': [3.8, 'M1.1,0L0.8,2.6M2.8,0L2.5,2.6'],
  '-': [4.2, 'M0.7,6.2L3.5,6.2'],
  '—': [7.4, 'M0.4,6.2L7,6.2'],
  '–': [5.6, 'M0.4,6.2L5.2,6.2'],
  '!': [2.6, 'M1.3,0L1.3,7M1.3,9.6L1.3,10'],
  '?': [5.4, 'M0.8,1.8Q1.2,0 2.8,0Q4.8,0 4.8,2.2Q4.8,4 2.7,5.2L2.7,7M2.7,9.6L2.7,10'],
  '(': [3.4, 'M2.8,-0.4Q0.6,4.8 2.8,11'],
  ')': [3.4, 'M0.6,-0.4Q2.8,4.8 0.6,11'],
  '/': [4.6, 'M0.4,10.4L4.2,-0.4'],
  '…': [7.8, 'M1,9.6L1,10M3.9,9.6L3.9,10M6.8,9.6L6.8,10'],
  '·': [3.0, 'M1.5,6.3L1.5,6.7'],
  '+': [5.4, 'M2.7,4.2L2.7,9M0.4,6.6L5,6.6'],
  '=': [5.4, 'M0.4,5.4L5,5.4M0.4,7.6L5,7.6'],
  '%': [8.2, 'M1.8,0Q0.6,0 0.6,1.6Q0.6,3.2 1.8,3.2Q3,3.2 3,1.6Q3,0 1.8,0M6.4,6.8Q5.2,6.8 5.2,8.4Q5.2,10 6.4,10Q7.6,10 7.6,8.4Q7.6,6.8 6.4,6.8M7.4,0L0.8,10'],
  '*': [5.2, 'M2.6,3.4L2.6,8M0.6,4.6L4.6,6.8M4.6,4.6L0.6,6.8'],
  '&': [8.0, 'M7.4,10L2.6,4.6Q1.4,3.2 2.4,1.4Q3.4,-0.2 4.8,0.8Q6,1.7 4.4,3.4L1.4,6.4Q0.4,7.6 1.4,9Q2.6,10.6 4.6,9.4L7,7.8'],
};

/** Codepoints that are folded onto an existing glyph before lookup. */
const FOLD = {
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '−': '-', '­': '-', '•': '·',
};

/** Parsed command arrays, built lazily and cached. cmd = [op, ...coords] flattened. */
const PARSED = new Map();

/**
 * @param {string} d
 * @returns {number[]} flat command stream: 0=move(x,y) 1=line(x,y) 2=quad(cx,cy,x,y)
 */
function parseGlyph(d) {
  const hit = PARSED.get(d);
  if (hit) return hit;
  const out = [];
  const re = /([MLQ])([-0-9., ]+)/g;
  let m;
  while ((m = re.exec(d))) {
    const nums = m[2].split(/[, ]+/).filter((s) => s.length).map(Number);
    if (m[1] === 'M') out.push(0, nums[0], nums[1]);
    else if (m[1] === 'L') { for (let i = 0; i + 1 < nums.length; i += 2) out.push(1, nums[i], nums[i + 1]); }
    else { for (let i = 0; i + 3 < nums.length; i += 4) out.push(2, nums[i], nums[i + 1], nums[i + 2], nums[i + 3]); }
  }
  PARSED.set(d, out);
  return out;
}

/** The two pens. `flatten` is the knife: a quadratic becomes its chord. */
export const FACES = {
  ink: { id: 'ink', family: 'Argonian Reed (project)', stem: 1.15, condense: 1.0, flatten: false, track: 0.0, path: 'game/src/ui/glyphs.js' },
  bone: { id: 'bone', family: 'Argonian Bone-cut (project)', stem: 1.5, condense: 0.85, flatten: true, track: 0.55, path: 'game/src/ui/glyphs.js' },
};

export function faceOf(id) { return FACES[id] || FACES.ink; }

function lookup(ch) {
  const folded = FOLD[ch] || ch;
  return G[folded] || null;
}

/** Advance width of one character, in grid units, for a face. */
export function advanceUnits(ch, face) {
  const g = lookup(ch);
  const w = g ? g[0] : G['?'][0];
  return w * face.condense + face.track;
}

/** Width of a string in PIXELS at `size`. `size` is the nominal font size, cap = size*CAP_EM. */
export function measure(text, face, size) {
  const u = size * CAP_EM / CAP;
  let w = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) w += advanceUnits(s[i], face);
  return w * u;
}

/**
 * Draw a string. Returns the advance in px.
 *
 * The path is built in GRID units and drawn under a transform, so the rasteriser sees real
 * curves at the final device resolution — this is the property M-F17.2 measures and it is the
 * reason the glyphs are geometry rather than an atlas.
 *
 * IT ALSO TELLS THE RENDERED-TEXT REGISTER (W1-26 round 2).
 * `render/text-register.js` wraps `fillText`/`strokeText`. Not one glyph here goes through
 * either — every one is a stroked path — so every string the HUD and the menus draw was
 * INVISIBLE to the register, and `RI-JRN01` M9 ("grep every string rendered outside a
 * dialogue/journal/book surface") ran over an empty set and reported a pass. Over its real
 * domain M9 had a hit. `ctx.__esNoteText` is the hook the register installs on the contexts it
 * owns; calling it is what makes the enumeration of the frame's text actually complete. It is
 * absent on any context the register does not own, so this costs an undefined-check and cannot
 * report into a surface nobody registered.
 */
export function drawText(ctx, text, x, y, face, size, colour, opts) {
  size = Math.max(size, Number(ctx.__esMinTextPx || 0));
  const u = size * CAP_EM / CAP;
  const s = String(text);
  const o = opts || {};
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = face.stem * u * (o.weight || 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;
  let pen = 0;
  for (let i = 0; i < s.length; i++) {
    const g = lookup(s[i]);
    if (g && g[1]) {
      const cmds = parseGlyph(g[1]);
      const ox = x + pen * u, oy = y - BASELINE * u;      // y is the BASELINE
      ctx.beginPath();
      for (let k = 0; k < cmds.length;) {
        const op = cmds[k];
        if (op === 0) { ctx.moveTo(ox + cmds[k + 1] * face.condense * u, oy + cmds[k + 2] * u); k += 3; }
        else if (op === 1) { ctx.lineTo(ox + cmds[k + 1] * face.condense * u, oy + cmds[k + 2] * u); k += 3; }
        else {
          const cx = ox + cmds[k + 1] * face.condense * u, cy = oy + cmds[k + 2] * u;
          const px = ox + cmds[k + 3] * face.condense * u, py = oy + cmds[k + 4] * u;
          if (face.flatten) ctx.lineTo(px, py); else ctx.quadraticCurveTo(cx, cy, px, py);
          k += 5;
        }
      }
      ctx.stroke();
    }
    pen += advanceUnits(s[i], face);
  }
  ctx.restore();
  const adv = pen * u;
  if (ctx.__esNoteText) ctx.__esNoteText(s, x, y, adv, size);
  return adv;
}

/** Every character this build can draw. `text-metrics.mjs` uses it to prove coverage. */
export function coverage() { return Object.keys(G).concat(Object.keys(FOLD)); }

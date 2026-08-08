// colour.mjs — sRGB -> CIELAB (D65) and ΔE, in the units the corpus actually specifies.
//
// Written by W1-21 round 3, for FD6.
//
// WHY THIS FILE EXISTS. `RI-UIX06` §F M-F19.1 says "no dark or light halo at UI edges over a
// mid-grey background; **edge pixel chroma deviation ≤ 3 ΔE**", and its §Scoring row FD6 says
// "no fringing; **ΔE ≤3**", hard fail "**ΔE >8**". `tools/metrics/ui-metrics.mjs` was measuring a
// **luminance overshoot in 0–255** and comparing it to **40**. Those are different quantities in
// different units, so — as the round-2 verdict put it — "neither the pass condition nor the hard-
// fail condition in the item is currently being tested", and a two-round-old red check could not
// be graded as a fail or as a hard fail because nobody could say whether 99.9 luma was a ΔE of 3
// or of 30.
//
// WHICH ΔE. `corpus/00-doctrine/BAR-CRITIQUE-IMAGES-01.md` fixes the project's convention:
// "RI-VIS05 §C computes **ΔE2000 in CIELAB D65**". So ΔE2000 is the number FD6 is graded on.
// `de76` is exported alongside and reported in the artifact, because it is what
// `tools/world/region-axes.mjs` uses for its ground-material axis and a reader comparing the two
// tools should not have to guess which is which.
//
// The sRGB->Lab path is the same one `region-axes.mjs` uses (sRGB EOTF, then the D65 white point
// 0.95047 / 1.0 / 1.08883), so the two tools' Lab values are directly comparable.

/** sRGB byte triple -> CIELAB under D65. */
export function labFromSrgb255(r, g, b) {
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const f = (t) => (t > 0.008856451679 ? Math.cbrt(t) : 7.787037 * t + 16 / 116);
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** CIE76 — plain Euclidean distance in Lab. Reported for comparability, not graded on. */
export function de76(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

/**
 * CIEDE2000. The standard formulation (Sharma, Wu & Dalal 2005), kL = kC = kH = 1.
 * Checked against that paper's published test pairs by `--self-test` in ui-metrics.mjs.
 */
export function de2000(lab1, lab2) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const deg = 180 / Math.PI, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const C7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (bb, ap) => { if (bb === 0 && ap === 0) return 0; const h = Math.atan2(bb, ap) * deg; return h < 0 ? h + 360 : h; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;

  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos((2 * hbp) * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2)
    + RT * (dCp / SC) * (dHp / SH),
  );
}

/**
 * THE FD6 QUANTITY, stated once so both the tool and any reader agree what is being measured.
 *
 * A correct alpha composite at a UI edge lies ON the line between the colour inside the panel and
 * the colour outside it: `out = a*ui + (1-a)*world`, so every edge pixel is some convex mix of
 * the two sides. Non-premultiplied alpha pulls the pixel OFF that line, toward black (the classic
 * dark halo) or toward white. So the deviation to measure is the distance from the observed edge
 * pixel to the nearest point on the inside–outside segment — zero for any legal blend at any
 * alpha, and positive exactly when the composite is wrong.
 *
 * The projection is done in Lab, and the answer is returned in ΔE2000, which is the unit
 * `RI-UIX06` §F grades against. The old luma test was the same idea in the wrong space: it asked
 * whether the pixel's LUMINANCE was outside the interval spanned by the two sides, which is the
 * 1-D shadow of this and cannot see a chroma fringe at all — and M-F19.1's own words are
 * "edge pixel **chroma** deviation".
 */
export function edgeDeviationDE(pixel, inside, outside) {
  const P = labFromSrgb255(pixel[0], pixel[1], pixel[2]);
  const A = labFromSrgb255(inside[0], inside[1], inside[2]);
  const B = labFromSrgb255(outside[0], outside[1], outside[2]);
  const AB = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len2 = AB[0] * AB[0] + AB[1] * AB[1] + AB[2] * AB[2];
  let t = 0;
  if (len2 > 1e-12) {
    t = ((P[0] - A[0]) * AB[0] + (P[1] - A[1]) * AB[1] + (P[2] - A[2]) * AB[2]) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const Q = [A[0] + AB[0] * t, A[1] + AB[1] * t, A[2] + AB[2] * t];
  return { de2000: de2000(P, Q), de76: de76(P, Q), t };
}

// Deterministic scalar fields shared by the offline terrain builder and the running game.
//
// Nothing here draws from the simulation PRNG or from Math.random: every value is a pure
// function of integer-hashed coordinates. That is what lets `tools/world/build-terrain.mjs`
// calibrate the province's water coverage offline and the game reproduce the identical field
// at runtime — the declared water census and the observed one are then the same field sampled
// twice, which is what RI-WLD10 M48 asks for.
'use strict';

export function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0,1], smoothstep-interpolated. */
export function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Fractal value noise in [0,1]. */
export function fbm(x, y, s, octaves = 4, lac = 2.03, gain = 0.5) {
  let amp = 1, sum = 0, norm = 0, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(fx, fy, s + o * 37) * amp;
    norm += amp; amp *= gain; fx *= lac; fy *= lac;
  }
  return sum / norm;
}

/** Ridged multifractal in [0,1]: sharp crests, rounded valleys. Mountains, not dunes. */
export function ridged(x, y, s, octaves = 5) {
  let amp = 1, sum = 0, norm = 0, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise2(fx, fy, s + o * 53) * 2 - 1);
    sum += n * n * amp; norm += amp; amp *= 0.52; fx *= 2.07; fy *= 2.07;
  }
  return sum / norm;
}

/** Quantised terraces with a small residual — kiln pans, comb shelves, salt crater rims. */
export function terrace(v, steps = 5, softness = 0.22) {
  const t = Math.floor(v * steps) / steps;
  const frac = v * steps - Math.floor(v * steps);
  return t + softness * (frac * frac * (3 - 2 * frac)) / steps;
}

/**
 * The local relief term, in metres, at a point.
 *
 * Zero-mean by construction, which is what makes the water solve tractable: standing water in
 * a region is `offset - detail`, so the region's water coverage index is exactly
 * P(detail < offset) over the region's land, and one scalar per region reproduces RI-WLD10 §8.
 *
 * @param {number} x world metres east
 * @param {number} z world metres south
 * @param {number} relief amplitude in metres
 * @param {number} rw ridged weight 0..1
 * @param {number} tw terraced weight 0..1
 */
export function detailAt(x, z, relief, rw, tw) {
  if (relief <= 0) return 0;
  const u = x / 42, v = z / 42;
  const n1 = fbm(u, v, 1301, 3) * 2 - 1;
  const nr = ridged(u * 0.8, v * 0.8, 2711, 4) * 2 - 1;
  const nt = terrace(fbm(u * 0.55, v * 0.55, 4409, 3), 5, 0.22) * 2 - 1;
  const nd = (noise2(x / 12.5, z / 12.5, 6113) * 2 - 1);
  const bw = Math.max(0, 1 - rw - tw);
  return relief * (bw * n1 + rw * nr + tw * nt + 0.30 * nd);
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
export function lerp(a, b, t) { return a + (b - a) * t; }

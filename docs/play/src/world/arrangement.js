// Prop ARRANGEMENT: a per-region density field over the shared scatter lattice.
//
// Verdict W1-01 round 2 counted the prop schema and found ONE key set across all thirteen
// regions — `canopy + under + rock`, seven silhouettes and five ground shapes shared thirteen
// ways plus a colour. Round 3 placed the thirteen ONLY-HERE landmarks as real geometry and the
// colour-stripped separability did not move, and said why: 840 instances over 14.31 km2 is 59
// per km2, and a random frame contains ordinary ground and ordinary flora, not a landmark.
//
// Spacing statistics carry more identity than model count. The same cone is a gorse clump on
// open turf, a mangrove fringe combed into tide-parallel lines, and a single glass thorn alone
// on a salt pan, depending only on WHERE IT IS ALLOWED TO STAND. That is what this file decides.
//
// It is a separate module rather than a method on `Province` for two reasons: the offline tools
// must evaluate the identical field (`tools/world/arrangement-audit.mjs` measures the realised
// spacing statistics the same way the renderer places them), and the per-mode normalisation
// constants below had to be MEASURED against the built province rather than guessed.
'use strict';

import { noise2, fbm, ridged, hash2, smoothstep } from './noise.js';

/**
 * Mean multiplier of each mode over the province, measured by `tools/world/arrangement-audit.mjs`
 * on 40,000 points per region inside each region's own territory.
 *
 * These exist so that ARRANGEMENT DOES NOT SECRETLY CHANGE DENSITY. `regions.json` declares a
 * per-100 m2 density per layer and `RI-WLD04` M18's `flora_density_placed` axis scores it; a
 * clumping rule whose mean multiplier is 1.4 would quietly move every region's declared density
 * and make the axis a measurement of this file instead. Dividing by the measured mean leaves the
 * declared density intact and changes only its spatial distribution — which is the whole point.
 */
const NORM = {
  scatter: 1.0,
  clumped: 1.2059,
  rows: 1.3444,
  drainage: 1.3906,
  'high-ground': 1.3774,
  fringe: 0.3187,
  isolated: 0.6102,
  maze: 1.4220,
};

/**
 * The region's arrangement multiplier on its declared density at a point.
 *
 * @param {import('./field.js').WorldField} field
 * @param {number} soften ground layers get a milder version of the same field, so the pattern is
 *   legible in the canopy and the ground between the clumps is bare rather than empty.
 * @returns {number} multiplier, mean ~1 over a region
 */
export function arrangeAt(field, x, z, a, soften = 1) {
  if (!a || !a.strength) return 1;
  let m = 1;
  switch (a.mode) {
    // Copses and thickets with open ground between them, at the declared gap.
    case 'clumped': {
      const g = a.gap_m || 50;
      m = 0.10 + 2.75 * smoothstep(0.42, 0.66, fbm(x / g, z / g, 8101, 3));
      break;
    }
    // Lineated on a bearing. `rectilinear` crosses the lines into a grid, which is what a dyked
    // paddy landscape is and what nothing else in the province is.
    case 'rows': {
      const th = (a.bearing_deg || 0) * Math.PI / 180;
      const sp = a.spacing_m || 36;
      const wob = 0.30 * (fbm(x / 210, z / 210, 8117, 2) - 0.5) * 2;
      const line = (t) => 0.10 + 2.9 * (1 - smoothstep(0.06, 0.26, Math.abs(t - Math.round(t))));
      m = line((x * Math.cos(th) + z * Math.sin(th)) / sp + wob);
      if (a.rectilinear) {
        m = Math.max(m, line((-x * Math.sin(th) + z * Math.cos(th)) / sp
          + 0.30 * (fbm(x / 210, z / 210, 8123, 2) - 0.5) * 2));
      }
      break;
    }
    // Gathered into the low ground the region's own micro-relief cuts: gully lines, the flanks of
    // a braided channel, the wet trough between two ripples.
    case 'drainage':
      m = 0.15 + 2.6 * smoothstep(0.35, -0.35, field.micro.at(x, z));
      break;
    // The opposite: standing only on ground the micro-relief has lifted clear of the water. A
    // drowned forest's trees are on the tussocks and not in the hollows.
    case 'high-ground':
      m = 0.12 + 2.7 * smoothstep(-0.35, 0.35, field.micro.at(x, z));
      break;
    // Banked against the waterline, thinning fast inland: tide-lichen to the high-water mark.
    case 'fringe':
      m = 0.12 + 2.9 * (1 - smoothstep(0, 55, Math.abs(field.coastDistAt(x, z))));
      break;
    // One plant per cell of a coarse lattice and nothing between: an even, wide, deliberate
    // spacing that reads as a desert and cannot be produced by thinning a scatter.
    case 'isolated': {
      const g = a.gap_m || 70;
      const cx = Math.floor(x / g), cz = Math.floor(z / g);
      const px = (cx + hash2(cx, cz, 8131)) * g, pz = (cz + hash2(cx, cz, 8137)) * g;
      // The disc must be SMALLER THAN THE SCATTER LATTICE CELL, or two or three plants of the
      // same cell pass the roll six metres apart and the nearest-neighbour statistic reads as
      // CLUMPED (Clark-Evans 0.27) when the intent was the exact opposite. At 0.075 g the disc is
      // 28 m2 against a 42.5 m2 lattice cell, so a cell yields one plant or none — which is what
      // "isolated" has to mean. `gap_m` is then set per region to 100/declared-density, so the
      // even spacing and the declared density are the same statement. 1/(pi*0.075^2) keeps the
      // mean multiplier at 1.
      m = Math.hypot(x - px, z - pz) < g * 0.075 ? 56.59 : 0.0;
      break;
    }
    // Dense everywhere except along sinuous corridors. Thornmarsh is "impenetrable except on cut
    // paths, and the cut paths are re-cut weekly" — that is a maze, not a density.
    case 'maze':
      m = ridged(x / (a.gap_m || 58), z / (a.gap_m || 58), 8141, 3) > 0.70 ? 0.04 : 1.62;
      break;
    default:
      return 1;
  }
  m /= NORM[a.mode] || 1;
  return Math.max(0, 1 + (m - 1) * a.strength * soften);
}

/** Which arrangement modes exist, for probes and for the M18 axis. */
export const ARRANGEMENT_MODES = Object.keys(NORM);
export const ARRANGEMENT_NORM = NORM;

/** The lattice `province._scatter` places on, exposed so an audit measures the same points. */
export function latticePoints(ox, oz, tileM, n) {
  const out = [];
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const jx = noise2(ix * 1.7 + ox, iz * 2.3 + oz, 7717);
      const jz = noise2(ix * 2.9 + ox, iz * 1.3 + oz, 7723);
      out.push([ox + (ix + jx) * (tileM / n), oz + (iz + jz) * (tileM / n)]);
    }
  }
  return out;
}

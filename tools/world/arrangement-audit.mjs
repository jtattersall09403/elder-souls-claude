#!/usr/bin/env node
/**
 * arrangement-audit.mjs — measure what the per-region prop ARRANGEMENT actually does.
 *
 * Round 3's finding was that placing thirteen rare landmarks could not move a statistic computed
 * over random frames, because the frames are made of ordinary flora on ordinary ground. Round 4's
 * answer is that the ordinary flora is arranged differently in every region. This tool is the
 * instrument for that claim, and it measures three things:
 *
 *  1. NORMALISATION — the mean multiplier of each mode over each region's own territory. If this
 *     is not 1, arrangement is secretly changing DENSITY, and `regions.json`'s declared per-100 m2
 *     figures and RI-WLD04 M18's `flora_density_placed` axis would be measuring this file. The
 *     `NORM` table in `game/src/world/arrangement.js` is set from the `suggested` column here.
 *  2. REALISED DENSITY — placed instances per 100 m2 on the renderer's own lattice, against the
 *     declared figure, per region and per layer.
 *  3. SPACING STATISTICS — the thing that carries the identity. Nearest-neighbour distance, its
 *     coefficient of variation, and the Clark-Evans R (observed mean NN distance over the mean
 *     expected under a Poisson process of the same intensity): R < 1 is clumped, R = 1 is random,
 *     R > 1 is over-dispersed. A gorse clump on open turf and a glass thorn alone on a salt pan
 *     are the same cone at R 0.55 and R 1.7.
 *
 * Usage: node tools/world/arrangement-audit.mjs [--out reports/arrangement.json] [--calibrate]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { arrangeAt, ARRANGEMENT_NORM, latticePoints } from '../../game/src/world/arrangement.js';
import { noise2, fbm, hash2, smoothstep } from '../../game/src/world/noise.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/arrangement.json';
const CALIBRATE = argv.includes('--calibrate');

const regionsDoc = rd('game/data/world/regions.json');
const field = new WorldField(rd('game/data/world/terrain.json'), regionsDoc, rd('game/data/world/water.json'));
field.setRoads(rd('game/data/world/roads.json'));
const REG = field.regions;

// ---- 1. normalisation -----------------------------------------------------------------------
const NS = 40000;
const norm = [];
for (const r of REG) {
  const bb = r.bounds_m;
  let st = 0x9E3779B9 ^ (r.index * 2654435761);
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  let sum = 0, n = 0;
  for (let i = 0; i < NS; i++) {
    const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]);
    const z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
    if (field.regionIndexAt(x, z) !== r.index) continue;
    sum += arrangeAt(field, x, z, r.props.arrangement, 1.0);
    n++;
  }
  const mean = n ? sum / n : 1;
  norm.push({ region: r.id, mode: r.props.arrangement.mode, samples: n, mean_multiplier: +mean.toFixed(4) });
}
const byMode = new Map();
for (const row of norm) {
  if (!byMode.has(row.mode)) byMode.set(row.mode, []);
  byMode.get(row.mode).push(row.mean_multiplier);
}
const suggested = {};
for (const [mode, vals] of byMode) {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  suggested[mode] = +((ARRANGEMENT_NORM[mode] || 1) * m).toFixed(4);
}

// ---- 2 + 3. place on the renderer's own lattice, per region -----------------------------------
// Exactly `province._scatter`'s point set and rolls, so what is measured is what is drawn.
const TILE_M = 300, N = 46;
const MAX_INSTANCES = { canopy: 700, under: 2600, rock: 420 };
const COVER_RADIUS_M = 70, COVER_LATTICE_M = 1.7;
const placed = new Map(REG.map((r) => [r.id, { canopy: [], under: [], rock: [], cover: [] }]));

/** The ground-cover disc, exactly as `province.updateCover` builds it, at a point in the region. */
function coverDisc(cx0, cz0) {
  const out = [];
  const step = COVER_LATTICE_M, cellArea = step * step;
  const n = Math.ceil(COVER_RADIUS_M / step);
  const gx0 = Math.floor((cx0 - COVER_RADIUS_M) / step), gz0 = Math.floor((cz0 - COVER_RADIUS_M) / step);
  for (let iz = 0; iz <= n * 2; iz++) for (let ix = 0; ix <= n * 2; ix++) {
    const cx = gx0 + ix, cz = gz0 + iz;
    const px = (cx + hash2(cx, cz, 6301)) * step, pz = (cz + hash2(cx, cz, 6307)) * step;
    const d = Math.hypot(px - cx0, pz - cz0);
    if (d > COVER_RADIUS_M || px < 0 || pz < 0 || px >= field.sizeX || pz >= field.sizeZ) continue;
    if (!field.isLandAt(px, pz)) continue;
    const r = REG[field.regionIndexAt(px, pz)];
    const cv = r.props.cover;
    const patch = 0.30 + 1.70 * smoothstep(0.40, 0.62, fbm(px / cv.patch_m, pz / cv.patch_m, 6311, 3));
    const fade = 1 - smoothstep(COVER_RADIUS_M - 15, COVER_RADIUS_M, d);
    const a = arrangeAt(field, px, pz, r.props.arrangement, 0.45);
    if (hash2(cx, cz, 6313) >= cv.per100m2 * patch * a * fade * cellArea / 100) continue;
    if (field.depthAt(px, pz) > Math.max(0.12, cv.h * 0.75)) continue;
    out.push([px, pz]);
  }
  return out;
}
/** Pool four discs of dry land inside the region, so one wet centroid does not decide the row. */
function coverStats(r) {
  const bb = r.bounds_m;
  let st = 0x1234567 ^ (r.index * 40503);
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const all = [];
  let discs = 0;
  for (let tries = 0; tries < 400 && discs < 4; tries++) {
    const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]), z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
    if (field.regionIndexAt(x, z) !== r.index || !field.isLandAt(x, z) || field.depthAt(x, z) > 0.3) continue;
    all.push(...coverDisc(x, z));
    discs++;
  }
  if (!discs) return null;
  const st2 = spacing(all, discs * Math.PI * COVER_RADIUS_M * COVER_RADIUS_M);
  return st2 ? { discs, ...st2 } : null;
}

const tiles = { x: Math.ceil(field.sizeX / TILE_M), z: Math.ceil(field.sizeZ / TILE_M) };
const cellArea = (TILE_M * TILE_M) / (N * N);
for (let tz = 0; tz < tiles.z; tz++) {
  for (let tx = 0; tx < tiles.x; tx++) {
    const ox = tx * TILE_M, oz = tz * TILE_M;
    let li = -1;
    for (const [x, z] of latticePoints(ox, oz, TILE_M, N)) {
      li++;
      const ix = li % N, iz = (li / N) | 0;
      if (!field.isLandAt(x, z)) continue;
      const r = REG[field.regionIndexAt(x, z)];
      const p = r.props;
      const depth = field.depthAt(x, z);
      const aTall = arrangeAt(field, x, z, p.arrangement, 1.0);
      const aLow = arrangeAt(field, x, z, p.arrangement, 0.45);
      const P = placed.get(r.id);
      const cap = (k, per100) => Math.min(1, MAX_INSTANCES[k] / Math.max(1e-6, per100 * TILE_M * TILE_M / 100));
      if (p.canopy.shape !== 'none' && depth < Math.max(0.9, p.canopy.h * 0.16)
        && hash2(ix + ox, iz + oz, 7741) < p.canopy.per100m2 * cap('canopy', p.canopy.per100m2) * aTall * cellArea / 100) P.canopy.push([x, z]);
      if (hash2(ix + ox, iz + oz, 7757) < p.under.per100m2 * cap('under', p.under.per100m2) * aLow * cellArea / 100
        && depth < Math.max(0.25, p.under.h * 0.80)) P.under.push([x, z]);
      if (hash2(ix + ox, iz + oz, 7761) < p.rock.per100m2 * cap('rock', p.rock.per100m2) * aTall * cellArea / 100) P.rock.push([x, z]);
    }
  }
}


// ---- 4. the NEAR-FIELD PROP DISC, replicated -------------------------------------------------
// `province.updateNear` puts the deficit between a region's declared density and the per-tile
// budget back inside 90 m of the camera, because the per-tile budget clamps every dense region to
// the same 0.78 canopy per 100 m2 and that is the density a frame is actually made at. What this
// measures is therefore the density a standing player is IN, which is the number the M17 frames
// see — not the province-wide average, which is a mixture of near and far.
const NEAR_RADIUS_M = 90;
const MAX_NEAR = { canopy: 2600, under: 2400, rock: 700 };
const TILE_BUDGET = (TILE_M * TILE_M) / 100;
function nearDisc(cx0, cz0) {
  const out = { canopy: [], under: [], rock: [] };
  const ri0 = field.regionIndexAt(cx0, cz0);
  const defOf = (r) => {
    const p = r.props;
    const d = {
      canopy: Math.max(0, (p.canopy.shape === 'none' ? 0 : p.canopy.per100m2) - MAX_INSTANCES.canopy / TILE_BUDGET),
      under: Math.max(0, p.under.per100m2 - MAX_INSTANCES.under / TILE_BUDGET),
      rock: Math.max(0, p.rock.per100m2 - MAX_INSTANCES.rock / TILE_BUDGET),
    };
    d.max = Math.max(d.canopy, d.under, d.rock);
    return d;
  };
  const here = defOf(REG[ri0]);
  if (here.max <= 0.001) return out;
  const step = Math.min(6.5, Math.max(1.9, Math.sqrt(100 / (2 * here.max))));
  const cellArea = step * step;
  const n = Math.ceil(NEAR_RADIUS_M / step);
  const gx0 = Math.floor((cx0 - NEAR_RADIUS_M) / step), gz0 = Math.floor((cz0 - NEAR_RADIUS_M) / step);
  for (let iz = 0; iz <= n * 2; iz++) for (let ix = 0; ix <= n * 2; ix++) {
    const cx = gx0 + ix, cz = gz0 + iz;
    const px = (cx + hash2(cx, cz, 8101)) * step, pz = (cz + hash2(cx, cz, 8103)) * step;
    if (Math.hypot(px - cx0, pz - cz0) > NEAR_RADIUS_M) continue;
    if (px < 0 || pz < 0 || px >= field.sizeX || pz >= field.sizeZ) continue;
    if (!field.isLandAt(px, pz)) continue;
    const r = REG[field.regionIndexAt(px, pz)];
    const d = defOf(r);
    if (d.max <= 0.001) continue;
    const p = r.props;
    const depth = field.depthAt(px, pz);
    const aTall = arrangeAt(field, px, pz, p.arrangement, 1.0);
    const aLow = arrangeAt(field, px, pz, p.arrangement, 0.45);
    if (p.canopy.shape !== 'none' && depth < Math.max(0.9, p.canopy.h * 0.16)
      && hash2(cx, cz, 8111) < d.canopy * aTall * cellArea / 100 && out.canopy.length < MAX_NEAR.canopy) out.canopy.push([px, pz]);
    if (hash2(cx, cz, 8117) < d.under * aLow * cellArea / 100
      && depth < Math.max(0.25, p.under.h * 0.80) && out.under.length < MAX_NEAR.under) out.under.push([px, pz]);
    if (hash2(cx, cz, 8123) < d.rock * aTall * cellArea / 100 && out.rock.length < MAX_NEAR.rock) out.rock.push([px, pz]);
  }
  return out;
}

/**
 * Realised canopy closure, from the geometry the renderer places.
 *
 * The tile lattice at its capped density plus the near disc at the deficit, over four discs of
 * ground inside the region; crown discs of the region's own radius, weighted by the plan-view
 * fraction its crown SHAPE projects. `regions.json canopy_closure` is derived from the declared
 * numbers; this is derived from the placed ones, and the two agreeing is the check.
 */
const CROWN_PLAN_FRACTION = { sphere: 1.0, dome: 1.0, cone: 1.0, spire: 0.3025, column: 0.81, arch: 0.30, none: 0 };
function nearDensity(r) {
  const bb = r.bounds_m;
  let st = 0x7654321 ^ (r.index * 26953);
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const acc = { canopy: 0, under: 0, rock: 0 };
  let discs = 0;
  const areaPer = Math.PI * NEAR_RADIUS_M * NEAR_RADIUS_M;
  for (let tries = 0; tries < 600 && discs < 4; tries++) {
    const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]), z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
    if (field.regionIndexAt(x, z) !== r.index || !field.isLandAt(x, z) || field.depthAt(x, z) > 0.3) continue;
    const nd = nearDisc(x, z);
    // the tile layer inside the same disc, at its capped density
    const p = r.props;
    const cap = (k, per100) => Math.min(1, MAX_INSTANCES[k] / Math.max(1e-6, per100 * TILE_BUDGET));
    acc.canopy += nd.canopy.length + p.canopy.per100m2 * cap('canopy', p.canopy.per100m2) * areaPer / 100;
    acc.under += nd.under.length + p.under.per100m2 * cap('under', p.under.per100m2) * areaPer / 100;
    acc.rock += nd.rock.length + p.rock.per100m2 * cap('rock', p.rock.per100m2) * areaPer / 100;
    discs++;
  }
  if (!discs) return null;
  const per = (v) => +((v / discs) / areaPer * 100).toFixed(3);
  const cn = per(acc.canopy);
  const occ = CROWN_PLAN_FRACTION[r.props.canopy.shape] ?? 0;
  const rr = r.props.canopy.r || 0;
  return {
    discs,
    canopy_per100m2: cn, under_per100m2: per(acc.under), rock_per100m2: per(acc.rock),
    realised_canopy_closure: +(1 - Math.exp(-(cn / 100) * Math.PI * rr * rr * occ)).toFixed(3),
    declared_canopy_closure: r.canopy_closure,
  };
}

/** Nearest-neighbour statistics and the Clark-Evans dispersion index. */
function spacing(pts, areaM2) {
  if (pts.length < 12) return null;
  const cell = 60;
  const grid = new Map();
  const key = (a, b) => a * 100000 + b;
  for (let i = 0; i < pts.length; i++) {
    const k = key(Math.floor(pts[i][0] / cell), Math.floor(pts[i][1] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const nn = [];
  for (let i = 0; i < pts.length; i++) {
    const cx = Math.floor(pts[i][0] / cell), cz = Math.floor(pts[i][1] / cell);
    let best = Infinity;
    for (let rr = 1; rr <= 4 && best === Infinity; rr++) {
      for (let dz = -rr; dz <= rr; dz++) {
        for (let dx = -rr; dx <= rr; dx++) {
          const b = grid.get(key(cx + dx, cz + dz));
          if (!b) continue;
          for (const j of b) {
            if (j === i) continue;
            const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
            if (d < best) best = d;
          }
        }
      }
    }
    if (Number.isFinite(best)) nn.push(best);
  }
  if (nn.length < 12) return null;
  const mean = nn.reduce((a, b) => a + b, 0) / nn.length;
  const sd = Math.sqrt(nn.reduce((a, b) => a + (b - mean) ** 2, 0) / nn.length);
  const density = pts.length / areaM2;
  const expected = 0.5 / Math.sqrt(density);
  return {
    n: pts.length,
    per100m2: +(density * 100).toFixed(3),
    nn_mean_m: +mean.toFixed(2),
    nn_cv: +(sd / mean).toFixed(3),
    clark_evans_R: +(mean / expected).toFixed(3),
  };
}

const rows = [];
for (const r of REG) {
  const areaM2 = r.area_km2 * 1e6;
  const P = placed.get(r.id);
  rows.push({
    region: r.id,
    mode: r.props.arrangement.mode,
    micro: { amp_m: r.terrain.micro.amp_m, weights: r.terrain.micro.weights },
    cover_shape: r.props.cover.shape,
    canopy: { declared_per100m2: r.props.canopy.per100m2, ...(spacing(P.canopy, areaM2) || {}) },
    under: { declared_per100m2: r.props.under.per100m2, ...(spacing(P.under, areaM2) || {}) },
    rock: { declared_per100m2: r.props.rock.per100m2, ...(spacing(P.rock, areaM2) || {}) },
    cover: { declared_per100m2: r.props.cover.per100m2, patch_m: r.props.cover.patch_m,
      ...(coverStats(r) || {}) },
    skin: r.terrain.skin,
    near_field: nearDensity(r),
  });
}

const doc = {
  schema: 'w1-01/arrangement@1',
  measured_at: new Date().toISOString(),
  note: 'Per-region prop arrangement, measured on the renderer\'s own lattice with the renderer\'s '
      + 'own rolls. clark_evans_R < 1 clumped, = 1 random, > 1 over-dispersed.',
  normalisation: { current: ARRANGEMENT_NORM, per_region: norm, suggested },
  regions: rows,
};
mkdirSync(join(ROOT, dirname(outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');

if (CALIBRATE) {
  process.stdout.write('const NORM = {\n');
  for (const [k, v] of Object.entries(suggested)) process.stdout.write(`  ${JSON.stringify(k)}: ${v},\n`);
  process.stdout.write('};\n');
}
process.stdout.write(`\n${'region'.padEnd(18)} ${'mode'.padEnd(12)} ${'micro'.padEnd(22)} canopy/100m2 (decl)   NN m   CV    R    | cover R\n`);
for (const row of rows) {
  const mw = Object.entries(row.micro.weights).map(([k, v]) => `${k}:${v}`).join(' ');
  process.stdout.write(`${row.region.padEnd(18)} ${row.mode.padEnd(12)} ${mw.padEnd(22)} `
    + `${String(row.canopy.per100m2 ?? '-').padStart(7)} (${String(row.canopy.declared_per100m2).padStart(5)}) `
    + `${String(row.canopy.nn_mean_m ?? '-').padStart(7)} ${String(row.canopy.nn_cv ?? '-').padStart(5)} `
    + `${String(row.canopy.clark_evans_R ?? '-').padStart(5)} | ${String(row.cover.clark_evans_R ?? '-').padStart(5)}\n`);
}
const meanErr = rows.map((r) => Math.abs((r.canopy.per100m2 ?? r.canopy.declared_per100m2) - r.canopy.declared_per100m2) / Math.max(1e-6, r.canopy.declared_per100m2));
process.stdout.write(`\nworst canopy density deviation from declared: ${(Math.max(...meanErr) * 100).toFixed(1)}%\n`);
process.stdout.write(`  ${outFile}\n`);

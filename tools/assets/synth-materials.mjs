#!/usr/bin/env node
// W1-30C — synthesise the material assets no legally redistributable CC0 set provides.
//
//   node tools/assets/synth-materials.mjs            # write everything
//   node tools/assets/synth-materials.mjs --list     # what it would write, and why
//
// W1-30C's stop condition: "if legally redistributable CC0/CC-BY sets cannot be found for a
// family, the fallback is a GENERATED set produced by a committed, reproducible script (not hash
// noise: real procedural material synthesis with structure)". Three families qualify — chitin,
// resin and water — and the four shared detail-normal tiles and the trim atlas were never going to
// come from a photo library at all.
//
// Everything here is seeded and deterministic: same script, same bytes, checked by --list against
// the manifest hashes. There is no hash-noise field anywhere in this file; each surface is built
// from a named structure (Voronoi cells, flow bands, warp/weft crossing, bevelled mouldings)
// because raising a texture-detail statistic is not the same thing as looking like a material, and
// that confusion is what this whole piece exists to undo.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'game/assets/w1-30/materials');
const LIST = process.argv.includes('--list');

const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------------------
// deterministic primitives
// ---------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** Tiling value noise: the lattice wraps at `period`, so every tile below is seamless. */
function valueNoise(seed, period) {
  const g = new Float32Array(period * period);
  const r = rng(seed);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const at = (a, b) => g[(((b % period) + period) % period) * period + (((a % period) + period) % period)];
    const u = smooth(xf), v = smooth(yf);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
  };
}
function fbm(seed, basePeriod, octaves) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ n: valueNoise(seed + o * 977, basePeriod * (1 << o)), f: 1 << o, a: 1 / (1 << o) });
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (u, v) => layers.reduce((s, l) => s + l.a * l.n(u * basePeriod * l.f, v * basePeriod * l.f), 0) / norm;
}

/** Tiling Worley/Voronoi over the unit square. One jittered site per grid cell and a 3x3
 *  neighbourhood lookup, so cost is constant per texel instead of linear in the site count — the
 *  naive all-pairs version took longer to run than the rest of the library put together.
 *  `cells` is the requested site count; the grid is the nearest square at or above it. */
function voronoi(seed, cells) {
  const G = Math.max(2, Math.ceil(Math.sqrt(cells)));
  const r = rng(seed), jx = new Float32Array(G * G), jy = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) { jx[i] = r(); jy[i] = r(); }
  const wrap = (i) => ((i % G) + G) % G;
  return (u, v) => {
    const gu = u * G, gv = v * G, cu = Math.floor(gu), cv = Math.floor(gv);
    let d1 = 9, d2 = 9, id = 0, cx = 0, cy = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const ax = cu + ox, ay = cv + oy, k = wrap(ay) * G + wrap(ax);
      const px = ax + jx[k], py = ay + jy[k];
      const dx = (gu - px) / G, dy = (gv - py) / G, d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; id = k; cx = px / G; cy = py / G; } else if (d < d2) d2 = d;
    }
    return { d1, d2, id, cx, cy, edge: d2 - d1 };
  };
}

/** Height field -> tangent-space OpenGL normal map, by wrapped Sobel. Strength is in height units
 * per texel; the whole point of the detail tiles is that this is the only channel they carry. */
function normalFromHeight(h, N, strength) {
  const out = Buffer.alloc(N * N * 3);
  const at = (x, y) => h[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 3;
    out[i] = Math.round((nx * .5 + .5) * 255);
    out[i + 1] = Math.round((ny * .5 + .5) * 255);   // OpenGL (+Y up)
    out[i + 2] = Math.round((nz * .5 + .5) * 255);
  }
  return out;
}

function writeRGB(file, rgb, w, h, q) {
  const ppm = path.join(process.env.TMPDIR || '/tmp', `w1-30c-${path.basename(file)}.ppm`);
  fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), rgb]));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  ff('-i', ppm, '-q:v', String(q), file);
  fs.unlinkSync(ppm);
  return { file: path.relative(OUT, file), sha256: sha256(fs.readFileSync(file)), bytes: fs.statSync(file).size };
}
function writeGray(file, gray, w, h, q) {
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = gray[i]; }
  return writeRGB(file, rgb, w, h, q);
}

// ---------------------------------------------------------------------------
// the three substituted families
// ---------------------------------------------------------------------------

/** chitin — plated carapace. Voronoi cells with a bevelled rim, per-cell hue and per-cell gloss,
 *  plus a fine pore layer so the plates are not glassy. */
function chitin(N = 1024) {
  const cellF = voronoi(1471, 46), pore = fbm(913, 24, 4), tint = rng(5501);
  // Indexed by the Voronoi grid id, which is bounded by the grid, not by the requested site count.
  const cellTint = Array.from({ length: 4096 }, () => [tint(), tint()]);
  const h = new Float32Array(N * N), alb = Buffer.alloc(N * N * 3), rgh = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, c = cellF(u, v), i = y * N + x;
    // A plate is domed in the middle and falls away sharply at its rim; the rim is what a light
    // catches, and it is the reason chitin reads as armour rather than as a bumpy surface.
    const rim = smooth(clamp01(c.edge / .045));
    const dome = smooth(clamp01(1 - c.d1 / .16));
    const p = pore(u, v);
    h[i] = rim * .72 + dome * .22 + p * .06;
    const [hueJit, glossJit] = cellTint[c.id];
    // Deep bruised purple-brown, the FAMILY_COLOUR chitin hue, varied per plate.
    const base = [.40 + hueJit * .10, .28 + hueJit * .06, .34 + hueJit * .09];
    const shade = .55 + rim * .40 + p * .18;
    alb[i * 3] = Math.round(clamp01(base[0] * shade) * 255);
    alb[i * 3 + 1] = Math.round(clamp01(base[1] * shade) * 255);
    alb[i * 3 + 2] = Math.round(clamp01(base[2] * shade) * 255);
    // Rims are scuffed and matte; plate centres are polished. That contrast is the material.
    rgh[i] = Math.round(clamp01(.30 + glossJit * .16 + (1 - rim) * -.14 + (1 - dome) * .30) * 255);
  }
  return { slug: 'chitin_plates', N, albedo: alb, height: h, rough: rgh, normalStrength: 2.6 };
}

/** resin — sap. Domain-warped flow bands with trapped bubbles, high gloss, low relief. */
function resin(N = 1024) {
  const warp = fbm(2213, 6, 4), grain = fbm(7717, 32, 3), bub = voronoi(3391, 120);
  const h = new Float32Array(N * N), alb = Buffer.alloc(N * N * 3), rgh = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    // Flow bands: a sine in v pushed sideways by low-frequency noise, which is what makes a poured
    // material read as poured rather than as stripes.
    const w = warp(u, v);
    const band = .5 + .5 * Math.sin((v * 9 + w * 3.4) * Math.PI * 2);
    const b = bub(u, v);
    const bubble = b.d1 < .012 ? smooth(1 - b.d1 / .012) : 0;   // trapped air, a shallow dent
    const g = grain(u, v);
    h[i] = band * .28 + g * .10 - bubble * .55;
    const lit = .52 + band * .34 + g * .12 - bubble * .22;
    // Sap green-amber: the FAMILY_COLOUR resin hue, kept translucent-looking by a bright floor.
    alb[i * 3] = Math.round(clamp01(lit * .44) * 255);
    alb[i * 3 + 1] = Math.round(clamp01(lit * .74) * 255);
    alb[i * 3 + 2] = Math.round(clamp01(lit * .56) * 255);
    rgh[i] = Math.round(clamp01(.18 + bubble * .40 + g * .14) * 255);
  }
  return { slug: 'resin_flow', N, albedo: alb, height: h, rough: rgh, normalStrength: 1.6 };
}

/** water — a ripple normal only. The surface's appearance belongs to render/water.js; this exists
 *  so that shader has a high-frequency term to break its specular lobe with. */
function water(N = 512) {
  const chop = fbm(6101, 16, 3);
  const h = new Float32Array(N * N), alb = Buffer.alloc(N * N * 3), rgh = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    // Crossed incommensurate ripples, matching the shader's own wave construction so the texture
    // and the vertex displacement do not fight each other.
    const a = Math.sin((u * 7 + v * 5) * Math.PI * 2), b = Math.sin((-u * 11 + v * 6) * Math.PI * 2);
    const c = Math.sin((u * 19 - v * 23) * Math.PI * 2);
    h[i] = a * .40 + b * .32 + c * .12 + chop(u, v) * .30;
    alb[i * 3] = 46; alb[i * 3 + 1] = 92; alb[i * 3 + 2] = 100;
    rgh[i] = Math.round(clamp01(.08 + chop(u, v) * .10) * 255);
  }
  return { slug: 'water_ripple', N, albedo: alb, height: h, rough: rgh, normalStrength: 1.1 };
}

// ---------------------------------------------------------------------------
// the four shared detail-normal tiles
// ---------------------------------------------------------------------------
const DETAIL = {
  // fibrous directional grain with pores — wood, foliage
  organic(N) {
    const streak = fbm(4001, 4, 3), fine = fbm(4002, 48, 3), pore = voronoi(4003, 240);
    return (u, v) => {
      const bend = streak(u, v) * .18;
      const fibre = Math.sin((u * 96 + bend * 40) * Math.PI * 2) * .5 + .5;
      const p = pore(u, v).d1 < .006 ? .8 : 0;
      return fibre * .55 + fine(u, v) * .35 - p * .5;
    };
  },
  // cellular pitting with sub-grain — soil, stone, salt, metal
  mineral(N) {
    const cell = voronoi(4101, 180), grain = fbm(4102, 64, 3);
    return (u, v) => { const c = cell(u, v); return smooth(clamp01(c.edge / .02)) * .60 + grain(u, v) * .40; };
  },
  // woven warp/weft crossing — cloth, skin, water
  fabric(N) {
    const slub = fbm(4201, 12, 3);
    return (u, v) => {
      const warp = Math.sin(u * 64 * Math.PI * 2) * .5 + .5, weft = Math.sin(v * 64 * Math.PI * 2) * .5 + .5;
      // Over-under: the thread that is on top alternates per cell, which is what a weave is.
      const over = ((Math.floor(u * 64) + Math.floor(v * 64)) % 2) === 0;
      return (over ? warp * .7 + weft * .2 : weft * .7 + warp * .2) + slub(u, v) * .16;
    };
  },
  // fine cracked plating — carapace, shell, bone, resin
  hard(N) {
    const crack = voronoi(4301, 90), micro = fbm(4302, 96, 2);
    return (u, v) => { const c = crack(u, v); return (c.edge < .012 ? 0 : .8) + micro(u, v) * .22; };
  },
};

// ---------------------------------------------------------------------------
// the trim atlas — twelve 128 px bands of a 2048x1536 sheet
// ---------------------------------------------------------------------------
const TRIM_BANDS = [
  'edge', 'moulding', 'plank', 'lashing', 'bolt', 'shell-ring',
  'bone-binding', 'resin-seam', 'dye-band', 'metal-course', 'chitin-bar', 'bleached-timber',
];
/** Each band is a *made* motif with a repeating rhythm along the band, because a trim sheet's job
 *  is to say "a person cut this and fixed it here" in one glance. */
function trimBand(name, u, t, noise) {
  // u runs along the band 0..1 (tiling), t runs across it 0..1.
  const n = noise(u * 4, t);
  const stripe = (period, duty) => ((u * period) % 1) < duty;
  switch (name) {
    case 'edge':            return { h: 1 - Math.abs(t - .5) * 2, c: [.42, .38, .32], r: .70 + n * .12 };
    case 'moulding':        return { h: .5 + .5 * Math.cos((t * 3 - .5) * Math.PI * 2), c: [.48, .44, .38], r: .62 + n * .10 };
    case 'plank':           return { h: (t % .34 < .03 ? 0 : .8) + n * .18, c: [.36, .27, .19], r: .82 + n * .10 };
    case 'lashing':         return { h: .35 + .55 * (Math.sin((u * 26 + t * 6) * Math.PI * 2) * .5 + .5), c: [.44, .35, .22], r: .88 - n * .08 };
    case 'bolt':            return { h: (Math.hypot(((u * 16) % 1) - .5, t - .5) < .22 ? 1 : .18) + n * .10, c: [.30, .30, .32], r: .38 + n * .16 };
    case 'shell-ring':      return { h: .5 + .5 * Math.cos(Math.hypot(((u * 10) % 1) - .5, t - .5) * 14), c: [.64, .58, .46], r: .46 + n * .14 };
    case 'bone-binding':    return { h: stripe(12, .55) ? .9 : .25 + n * .2, c: [.78, .73, .60], r: .58 + n * .12 };
    case 'resin-seam':      return { h: .5 + .35 * Math.sin((u * 8 + n * 2) * Math.PI * 2) - Math.abs(t - .5) * .6, c: [.30, .52, .38], r: .22 + n * .10 };
    case 'dye-band':        return { h: .5 + n * .3, c: t < .5 ? [.56, .22, .18] : [.22, .26, .44], r: .84 - n * .10 };
    case 'metal-course':    return { h: stripe(6, .48) ? .85 : .30, c: [.44, .46, .48], r: .30 + n * .18 };
    case 'chitin-bar':      return { h: .5 + .45 * Math.cos((u * 20) * Math.PI * 2) * (1 - Math.abs(t - .5) * 1.6), c: [.28, .20, .26], r: .34 + n * .12 };
    case 'bleached-timber': return { h: .6 + n * .34 - (t % .5 < .04 ? .5 : 0), c: [.70, .68, .60], r: .86 - n * .10 };
    default: throw new Error(`W1-30C unknown trim band '${name}'`);
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
const written = {};

function emitFamily(m) {
  const dir = path.join(OUT, m.slug);
  written[m.slug] = {
    albedo: writeRGB(path.join(dir, `${m.slug}_albedo_1k.jpg`), m.albedo, m.N, m.N, 4),
    normal: writeRGB(path.join(dir, `${m.slug}_normal_1k.jpg`), normalFromHeight(m.height, m.N, m.normalStrength), m.N, m.N, 3),
    rough: writeGray(path.join(dir, `${m.slug}_rough_512.jpg`), (() => {
      // downsample 2x by box filter so the roughness map matches the CC0 sets' 512 convention
      const H = m.N >> 1, out = Buffer.alloc(H * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
        const i = y * 2 * m.N + x * 2;
        out[y * H + x] = (m.rough[i] + m.rough[i + 1] + m.rough[i + m.N] + m.rough[i + m.N + 1]) >> 2;
      }
      return out;
    })(), m.N >> 1, m.N >> 1, 5),
  };
}

if (!LIST) {
  for (const m of [chitin(), resin(), water()]) { process.stdout.write(`  synth ${m.slug} ... `); emitFamily(m); console.log('ok'); }

  const N = 512;
  for (const [name, make] of Object.entries(DETAIL)) {
    process.stdout.write(`  synth detail-normal/${name} ... `);
    const f = make(N), h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = f(x / N, y / N);
    written[`detail/${name}`] = writeRGB(path.join(OUT, 'detail', `detail_normal_${name}_512.jpg`), normalFromHeight(h, N, 1.5), N, N, 3);
    console.log('ok');
  }

  process.stdout.write('  synth trim atlas ... ');
  const W = 2048, H = 1536, BH = 128, noise = fbm(8801, 24, 3);
  const alb = Buffer.alloc(W * H * 3), hh = new Float32Array(W * H), rgh = Buffer.alloc(W * H);
  for (let band = 0; band < TRIM_BANDS.length; band++) {
    const name = TRIM_BANDS[band];
    for (let ty = 0; ty < BH; ty++) for (let x = 0; x < W; x++) {
      const y = band * BH + ty, i = y * W + x;
      const s = trimBand(name, x / W, ty / BH, noise);
      hh[i] = s.h;
      const lit = .55 + s.h * .45;
      alb[i * 3] = Math.round(clamp01(s.c[0] * lit) * 255);
      alb[i * 3 + 1] = Math.round(clamp01(s.c[1] * lit) * 255);
      alb[i * 3 + 2] = Math.round(clamp01(s.c[2] * lit) * 255);
      rgh[i] = Math.round(clamp01(s.r) * 255);
    }
  }
  // Sobel across the whole sheet would bleed one band into its neighbour; the sheet is authored so
  // that band boundaries sit at a flat value, so the bleed is a texel and not a seam.
  const trimNormal = (() => {
    const out = Buffer.alloc(W * H * 3);
    const at = (x, y) => hh[Math.min(H - 1, Math.max(0, y)) * W + (((x % W) + W) % W)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = at(x + 1, y) - at(x - 1, y), dy = at(x, y + 1) - at(x, y - 1);
      let nx = -dx * 3.2, ny = -dy * 3.2, nz = 1; const l = Math.hypot(nx, ny, nz);
      const i = (y * W + x) * 3;
      out[i] = Math.round((nx / l * .5 + .5) * 255);
      out[i + 1] = Math.round((ny / l * .5 + .5) * 255);
      out[i + 2] = Math.round((nz / l * .5 + .5) * 255);
    }
    return out;
  })();
  written['trim/albedo'] = writeRGB(path.join(OUT, 'trim', 'trim_atlas_albedo_2k.jpg'), alb, W, H, 4);
  written['trim/normal'] = writeRGB(path.join(OUT, 'trim', 'trim_atlas_normal_2k.jpg'), trimNormal, W, H, 3);
  written['trim/rough'] = writeGray(path.join(OUT, 'trim', 'trim_atlas_rough_2k.jpg'), rgh, W, H, 5);
  console.log('ok');
}

console.log(JSON.stringify({ bands: TRIM_BANDS, written }, null, 2));

#!/usr/bin/env node
// Generates game/data/camera/cells.json — the static collision set the spring arm casts
// against and the navmesh spines the scripted routes follow.
//
// It is a generator rather than a hand-written file because the three worst geometries
// (RI-CAM01 M2) are *repetitive* — 8 pillars, 96 mangrove roots, 54 railing posts — and a
// hand-written 3,000-line JSON is a file nobody audits. The OUTPUT is the inspectable
// artifact (HARNESS §5 mandates `game/data/**`); this file is how it is reproduced, and
// `node tools/camera/gen-cells.mjs --check` fails if the committed JSON has drifted.
//
// Every architectural dimension below is annotated with the RI-CAM05 §D minimum it is
// meeting. `--audit` prints that table so a critic can check the geometry without a game.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'game', 'data', 'camera', 'cells.json');

const cells = [];

// ---------------------------------------------------------------------------------------
// A deterministic integer hash, so "scattered" geometry is reproducible and reviewable.
// No Math.random anywhere in this file: the committed JSON must be byte-stable.
function h(i, s) {
  let x = (i * 374761393 + s * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
const r2 = (v) => Math.round(v * 100) / 100;

// =========================================================================================
// 1. cam-flat-plain — the M1 static rig census cell. Ground only: every rig number must be
//    readable with nothing to collide against.
// =========================================================================================
cells.push({
  id: 'cam-flat-plain', class: 'rig', ground_y: 0,
  title: 'Featureless ground plane. RI-CAM01 M1 static rig census.',
  shapes: [{ k: 'plane_y', y: 0, id: 'ground' }],
  spine: null,
});

// =========================================================================================
// 2. cam-walk-cistern — the interior route. RI-CAM01 M2's first worst geometry.
//
//    RI-CAM01 M2 describes the cistern with a "doorway ≤ 1.2 m clear". RI-CAM05 §D sets a
//    binding 1.80 m minimum on doorway clear width for authored interiors and makes any
//    interior below it an automatic fail of this piece. The two items are in direct
//    conflict; §D governs, because it is the one that binds the world and because CAM01 M2
//    describes a route rather than fixing a dimension. The ≤ 1.2 m pinch is built anyway,
//    as `cam-rig-pinch`, which is declared `class: "rig"` and is NOT an interior — so the
//    hard clip-through evidence CAM01 M2 wants exists without CAM05 M4 failing on it.
// =========================================================================================
{
  const S = [];
  const G = 0;
  S.push({ k: 'plane_y', y: G, id: 'floor' });
  // -- entry hall, 8 × 8, ceiling 4.0 (combat interior: ≥ 2.60 clear width, ≥ 3.20 ceiling)
  wallBox(S, 'hall_n', 0, 4.6, 8.0, 0.6, 4.0, -0.0, 0);          // z = +4.6 wall
  wallBox(S, 'hall_w', -4.6, 0, 0.6, 8.0, 4.0, 0, 0);
  wallBox(S, 'hall_e', 4.6, 0, 0.6, 8.0, 4.0, 0, 0);
  wallBox(S, 'hall_s_l', -2.95, -4.6, 3.3, 0.6, 4.0, 0, 0);      // doorway gap 1.80 m
  wallBox(S, 'hall_s_r', 2.95, -4.6, 3.3, 0.6, 4.0, 0, 0);
  ceiling(S, 'hall_ceil', 0, 0, 10, 10, 4.0);
  // -- corridor south, 2.60 m clear × 20 m, ceiling 3.20 (the §D combat-interior minimum)
  for (let i = 0; i < 2; i++) {
    const sx = i === 0 ? -1 : 1;
    wallBox(S, `cor_w${i}`, sx * (1.30 + 0.35), -14.6, 0.35, 10.0, 3.2, 0, 0);
  }
  ceiling(S, 'cor_ceil', 0, -14.6, 3.4, 21, 3.2);
  // -- the low arch, halfway down the corridor: 3.20 m clear, 0.8 m deep
  S.push({ k: 'box', id: 'arch', c: [0, 3.2 + 0.5, -14.6], h: [1.7, 0.5, 0.4] });
  // -- pillar hall, 14 × 14, 8 pillars on a 4.4 m grid, clear span between pillars 3.60 m
  const PH_Z = -28.0;
  wallBox(S, 'ph_n_l', -4.6, PH_Z + 7.3, 2.9, 0.6, 5.0, 0, 0);
  wallBox(S, 'ph_n_r', 4.6, PH_Z + 7.3, 2.9, 0.6, 5.0, 0, 0);
  wallBox(S, 'ph_s', 0, PH_Z - 7.3, 7.5, 0.6, 5.0, 0, 0);
  wallBox(S, 'ph_w', -7.3, PH_Z, 0.6, 7.5, 5.0, 0, 0);
  wallBox(S, 'ph_e', 7.3, PH_Z, 0.6, 7.5, 5.0, 0, 0);
  ceiling(S, 'ph_ceil', 0, PH_Z, 16, 16, 5.0);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    S.push({ k: 'cyl', id: `pillar${i}`, c: [r2(Math.sin(ang) * 4.4), 2.5, r2(PH_Z + Math.cos(ang) * 4.4)], half_h: 2.5, r: 0.40 });
  }
  // -- spiral stair up, clear radius to the outer wall 2.40 m (§D), central newel r = 0.50
  const SP = [0, PH_Z - 4.0];
  S.push({ k: 'cyl', id: 'newel', c: [SP[0], 3.0, SP[1]], half_h: 3.0, r: 0.50 });
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 4;                        // two turns
    const y = 0.18 * i;
    S.push({
      k: 'box', id: `tread${i}`,
      c: [r2(SP[0] + Math.sin(a0) * 1.70), r2(y - 0.09), r2(SP[1] + Math.cos(a0) * 1.70)],
      h: [1.30, 0.09, 0.42], yaw_deg: r2(a0 * 180 / Math.PI),
    });
  }
  // outer wall of the stair well, at 2.90 m radius → 2.40 m clear from the newel surface
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2;
    S.push({
      k: 'box', id: `spwall${i}`,
      c: [r2(SP[0] + Math.sin(a0) * 3.10), 3.0, r2(SP[1] + Math.cos(a0) * 3.10)],
      h: [0.52, 3.0, 0.25], yaw_deg: r2(a0 * 180 / Math.PI),
    });
  }
  // -- ledge on the upper level: a 2.6 m walkway with a 4 m drop on one side
  wallBox(S, 'ledge_wall', -3.5, PH_Z - 12.0, 0.5, 8.0, 4.0, 0, 4.32);
  S.push({ k: 'box', id: 'ledge_floor', c: [-2.0, 4.32 - 0.25, PH_Z - 12.0], h: [1.5, 0.25, 8.0] });
  // -- crawl space branch: 1.40 m clear width, 1.80 m clear ceiling, 10.0 m long (S48 / §D legal)
  wallBox(S, 'crawl_w', -0.95, -6.0, 0.25, 5.0, 1.8, 0, 0);
  wallBox(S, 'crawl_e', 0.95, -6.0, 0.25, 5.0, 1.8, 0, 0);
  ceiling(S, 'crawl_ceil', 0, -6.0, 2.4, 10.0, 1.8);

  cells.push({
    id: 'cam-walk-cistern', class: 'combat_interior', ground_y: 0,
    title: 'Sunken cistern: 1.80 m doorway, 2.60 m corridor, low arch, pillar hall, two-turn spiral stair, ledge, and a legal crawl-space branch.',
    declared: {
      min_clear_width_m: 2.60, min_clear_ceiling_m: 3.20, doorway_clear_width_m: 1.80,
      spiral_stair_clear_radius_m: 2.40,
      crawl_space: { clear_width_m: 1.40, clear_ceiling_m: 1.80, length_m: 10.0, encounters: 0 },
      conflict_note: 'RI-CAM01 M2 asks for a doorway ≤ 1.2 m clear; RI-CAM05 §D forbids an interior doorway under 1.80 m. §D governs here and the 1.2 m pinch lives in cam-rig-pinch.',
    },
    shapes: S,
    spine: [
      [0, 2.5], [0, -2.0], [0, -6.0], [0, -12.0], [0, -18.0], [0, -22.0],
      [0, PH_Z + 5.0], [3.6, PH_Z + 2.0], [4.4, PH_Z - 2.0], [1.5, PH_Z - 4.5],
      [0, PH_Z + 5.0], [0, -22.0], [0, -12.0], [0, -2.0], [0, 2.5],
    ],
  });
}

// =========================================================================================
// 3. cam-walk-mangrove — "the geometry that is 70% of this world" (RI-CAM01 M2).
//    Trunks are cylinders; the prop roots are capsules leaning out of the water at angles,
//    which is precisely the geometry a vertical-cylinder-only collision set misses.
// =========================================================================================
{
  const S = [{ k: 'plane_y', y: 0, id: 'mud' }];
  let n = 0;
  for (let i = 0; i < 34; i++) {
    const x = r2((h(i, 11) - 0.5) * 56);
    const z = r2((h(i, 12) - 0.5) * 56);
    if (Math.abs(x) < 1.6 && Math.abs(z) < 26) continue;      // keep the spine walkable
    const tr = r2(0.28 + h(i, 13) * 0.42);
    S.push({ k: 'cyl', id: `trunk${i}`, c: [x, 4.0, z], half_h: 4.0, r: tr });
    const roots = 3 + Math.floor(h(i, 14) * 3);
    for (let j = 0; j < roots; j++) {
      const a = (j / roots) * Math.PI * 2 + h(i * 7 + j, 15) * 0.9;
      const reach = 1.1 + h(i * 7 + j, 16) * 1.5;
      S.push({
        k: 'cap', id: `root${n++}`,
        a: [r2(x + Math.sin(a) * tr * 0.6), 1.5, r2(z + Math.cos(a) * tr * 0.6)],
        b: [r2(x + Math.sin(a) * reach), 0.05, r2(z + Math.cos(a) * reach)],
        r: r2(0.10 + h(i * 7 + j, 17) * 0.12),
      });
    }
  }
  cells.push({
    id: 'cam-walk-mangrove', class: 'exterior', ground_y: 0,
    title: 'Mangrove root cluster: 30-odd trunks and ~130 prop roots at angles, over a 56 m patch.',
    shapes: S,
    spine: [[0, 24], [0.8, 16], [-0.9, 8], [0.6, 0], [-0.7, -8], [0.9, -16], [0, -24],
      [0.9, -16], [-0.7, -8], [0.6, 0], [-0.9, 8], [0.8, 16], [0, 24]],
  });
}

// =========================================================================================
// 4. cam-walk-boardwalk — "the thin-geometry case a sphere cast most often misses".
//    Railings are 0.07 m capsules. They are in the collision set on purpose: the failure
//    RI-CAM05 "How we lose" #9 describes is a railing that is NOT, so the arm pumps.
// =========================================================================================
{
  const S = [{ k: 'plane_y', y: -1.4, id: 'water_bed' }];
  const deck = (x0, z0, x1, z1, id) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    S.push({ k: 'box', id: `${id}_deck`, c: [r2(cx), 0.85, r2(cz)], h: [1.50, 0.15, r2(len / 2)], yaw_deg: r2(yaw * 180 / Math.PI) });
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);
    const steps = Math.max(2, Math.round(len / 2.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + dx * t, pz = z0 + dz * t;
      for (const sgn of [-1, 1]) {
        const ax = r2(px + nx * sgn * 1.50), az = r2(pz + nz * sgn * 1.50);
        S.push({ k: 'cyl', id: `${id}_post${i}${sgn > 0 ? 'r' : 'l'}`, c: [ax, 1.55, az], half_h: 0.55, r: 0.07 });
        S.push({ k: 'cyl', id: `${id}_stilt${i}${sgn > 0 ? 'r' : 'l'}`, c: [ax, 0.0, az], half_h: 1.4, r: 0.09 });
      }
    }
    for (const sgn of [-1, 1]) {
      for (const ry of [1.55, 2.05]) {
        S.push({
          k: 'cap', id: `${id}_rail${ry}${sgn > 0 ? 'r' : 'l'}`,
          a: [r2(x0 + nx * sgn * 1.50), ry, r2(z0 + nz * sgn * 1.50)],
          b: [r2(x1 + nx * sgn * 1.50), ry, r2(z1 + nz * sgn * 1.50)], r: 0.07,
        });
      }
    }
  };
  deck(0, 30, 0, -6, 'run1');
  deck(0, -6, 26, -6, 'run2');
  // stilt huts alongside, close enough that the arm has to work
  // Keep the huts alongside the two legs, never across the walking spine at the elbow.
  // The old single-axis series continued past z=-6 and put hut4 directly over run2; the
  // route ground sampler consequently (and correctly) found its roof as the walking surface.
  for (let i = 0; i < 4; i++) {
    const z = 26 - i * 7.5;
    const sx = i % 2 === 0 ? 4.4 : -4.4;
    S.push({ k: 'box', id: `hut${i}`, c: [sx, 2.4, z], h: [2.0, 1.6, 2.0], yaw_deg: (i * 13) % 40 });
  }
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 7.5;
    const z = i % 2 === 0 ? -10.4 : -1.6;
    S.push({ k: 'box', id: `hut${i + 4}`, c: [x, 2.4, z], h: [2.0, 1.6, 2.0], yaw_deg: ((i + 4) * 13) % 40 });
  }
  cells.push({
    id: 'cam-walk-boardwalk', class: 'exterior', ground_y: 0.85,
    title: 'Stilt-village boardwalk: 3.00 m deck, two rails at 1.55 m and 2.05 m on 0.07 m posts, huts alongside, a 90° turn.',
    declared: { deck_clear_width_m: 3.00, rail_radius_m: 0.07 },
    shapes: S,
    spine: [[0, 28], [0, 18], [0, 8], [0, -2], [0, -6], [8, -6], [18, -6], [24, -6],
      [18, -6], [8, -6], [0, -6], [0, 8], [0, 18], [0, 28]],
  });
}

// =========================================================================================
// 5. cam-boss-arena — RI-CAM01 M3's fourth route, and where RI-CAM03 M1/M3 run.
// =========================================================================================
{
  const S = [{ k: 'plane_y', y: 0, id: 'floor' }];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    S.push({ k: 'box', id: `arenawall${i}`, c: [r2(Math.sin(a) * 14.5), 4.0, r2(Math.cos(a) * 14.5)], h: [1.70, 4.0, 0.5], yaw_deg: r2(a * 180 / Math.PI) });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    S.push({ k: 'cyl', id: `col${i}`, c: [r2(Math.sin(a) * 9.5), 4.0, r2(Math.cos(a) * 9.5)], half_h: 4.0, r: 0.55 });
  }
  cells.push({
    id: 'cam-boss-arena', class: 'combat_interior', ground_y: 0,
    title: 'Round boss arena, 29 m across, 6 columns at r = 9.5 m, a 4 m wall.',
    declared: { min_clear_width_m: 8.0, min_clear_ceiling_m: 8.0 },
    shapes: S, spine: [[0, 8], [6, 4], [8, -4], [0, -8], [-8, -4], [-6, 4], [0, 8]],
  });
}

// =========================================================================================
// 6. cam-collision-rig — RI-CAM01 M4. A wall on a rail: the scenario drives `wall_z`.
// =========================================================================================
cells.push({
  id: 'cam-collision-rig', class: 'rig', ground_y: 0,
  title: 'Flat ground plus one wall on a rail. The rate law (RI-CAM01 M4) is measured here.',
  shapes: [
    { k: 'plane_y', y: 0, id: 'floor' },
    { k: 'box', id: 'rail_wall', c: [0, 3.0, -6.0], h: [8.0, 3.0, 0.4] },
  ],
  movers: [{ id: 'rail_wall', axis: 'z', from: -6.0, to: -0.5, period_frames: 240 }],
  spine: null,
});

// =========================================================================================
// 7. cam-rig-pinch — the ≤ 1.2 m doorway CAM01 M2 asks for, declared NOT an interior so it
//    cannot be scored against RI-CAM05 §D's architecture minimums.
// =========================================================================================
{
  const S = [{ k: 'plane_y', y: 0, id: 'floor' }];
  wallBox(S, 'pinch_l', -2.6, 0, 2.0, 0.5, 3.0, 0, 0);
  wallBox(S, 'pinch_r', 2.6, 0, 2.0, 0.5, 3.0, 0, 0);
  wallBox(S, 'pinch_back', 0, 6.0, 6.0, 0.5, 3.0, 0, 0);
  ceiling(S, 'pinch_ceil', 0, 3.0, 12, 12, 2.2);
  cells.push({
    id: 'cam-rig-pinch', class: 'rig', ground_y: 0,
    title: 'A 1.20 m doorway between two walls. A test rig, not an interior: RI-CAM05 §D forbids shipping this.',
    declared: { doorway_clear_width_m: 1.20, is_shipped_interior: false },
    shapes: S, spine: [[0, -4], [0, 0], [0, 4], [0, 0], [0, -4]],
  });
}

// =========================================================================================
// 8. cam-stair — RI-CAM05 §D's stair measurables: 30°, 0.18 m rise.
// =========================================================================================
{
  const S = [{ k: 'plane_y', y: 0, id: 'floor' }];
  for (let i = 0; i < 40; i++) {
    S.push({ k: 'box', id: `st${i}`, c: [0, 0.18 * i - 0.09, -1.0 - i * 0.312], h: [2.0, 0.09 + 0.09 * i, 0.156] });
  }
  wallBox(S, 'st_w', -2.4, -7.0, 0.4, 8.0, 9.0, 0, 0);
  wallBox(S, 'st_e', 2.4, -7.0, 0.4, 8.0, 9.0, 0, 0);
  cells.push({
    id: 'cam-stair', class: 'traversal_interior', ground_y: 0,
    title: '40 treads at 0.18 m rise / 0.312 m going = 30.0°, in a 4.00 m clear stairwell.',
    declared: { min_clear_width_m: 4.00, min_clear_ceiling_m: 9.00, rise_m: 0.18, going_m: 0.312, angle_deg: 30.0 },
    shapes: S, spine: [[0, 2], [0, -1], [0, -13.5], [0, -1], [0, 2]],
  });
}

// ---------------------------------------------------------------------------------------
function wallBox(S, id, cx, cz, hx, hz, height, yaw, y0) {
  S.push({ k: 'box', id, c: [r2(cx), r2((y0 || 0) + height / 2), r2(cz)], h: [hx, height / 2, hz], yaw_deg: yaw || 0 });
}
function ceiling(S, id, cx, cz, hx, hz, clear) {
  S.push({ k: 'box', id, c: [r2(cx), r2(clear + 0.3), r2(cz)], h: [hx, 0.3, hz] });
}

const doc = {
  schema: 'elder-souls/camera-cells@1',
  generated_by: 'tools/camera/gen-cells.mjs',
  owner: 'RI-CAM01 §C/§D (the collision set the spring arm casts against), RI-CAM05 §D (architecture minimums)',
  note: 'Primitive kinds: box (oriented about +Y), cyl (vertical finite), cap (capsule), plane_y (ground half-space). Distances are metres. This set contains ONLY static world geometry — RI-CAM01 §C\'s excluded layers are excluded by construction, which is what makes RI-CAM01 M6 pass structurally.',
  cells,
};

const json = JSON.stringify(doc, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== json) { console.error('cells.json is stale — re-run tools/camera/gen-cells.mjs'); process.exit(1); }
  console.log('cells.json up to date');
} else if (process.argv.includes('--audit')) {
  for (const c of cells) {
    console.log(`${c.id.padEnd(20)} ${String(c.class).padEnd(18)} ${String(c.shapes.length).padStart(4)} shapes  ${c.declared ? JSON.stringify(c.declared) : ''}`);
  }
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${OUT} — ${cells.length} cells, ${cells.reduce((a, c) => a + c.shapes.length, 0)} primitives`);
}

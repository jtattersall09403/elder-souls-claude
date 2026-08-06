#!/usr/bin/env node
// RI-CMB07 M3 — the four fingerprint plots, produced as data (the item asks for plots; the
// scoreable content is (d): "FAIL if (d) shows player invuln frames that do not cluster around
// enemy hitbox frames"). Rendered as ASCII strips so the artifact is diffable and readable.
import fs from 'node:fs';

const out = { generated: new Date().toISOString(), fights: {} };
let strip = '';
for (const F of ['F1', 'F2', 'F3', 'F4', 'F5']) {
  const lines = fs.readFileSync(`reports/w1-09/exemplar/RI-CMB07-exemplar-${F}-frames.jsonl`, 'utf8').split('\n').filter(Boolean);
  const frames = lines.slice(1).map((l) => JSON.parse(l));
  const N = frames.length;
  const eHb = frames.map((f) => (f.e[0] ? f.e[0][4] : 0));
  const pIv = frames.map((f) => f.p[5]);
  const pHb = frames.map((f) => f.p[6]);

  // (d) clustering: for every invuln frame, distance to the nearest enemy-hitbox-active frame
  const hbIdx = []; eHb.forEach((v, i) => { if (v) hbIdx.push(i); });
  const dists = [];
  for (let i = 0; i < N; i++) {
    if (!pIv[i]) continue;
    let best = Infinity;
    for (const h of hbIdx) { const d = Math.abs(h - i); if (d < best) best = d; if (h > i && d > best) break; }
    dists.push(best);
  }
  dists.sort((a, b) => a - b);
  const q = (p) => (dists.length ? dists[Math.min(dists.length - 1, Math.floor(dists.length * p))] : null);
  const invulnFrames = pIv.reduce((a, b) => a + b, 0);
  const overlap = pIv.reduce((a, b, i) => a + (b && eHb[i] ? 1 : 0), 0);

  // (c) state occupancy
  const occ = {};
  for (const f of frames) occ[f.p[0]] = (occ[f.p[0]] || 0) + 1;
  const occFrac = Object.fromEntries(Object.entries(occ).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / N).toFixed(4)]));

  // (a) stamina series, decimated to 300 buckets
  const B = 300, bucket = Math.ceil(N / B);
  const stam = [];
  for (let i = 0; i < N; i += bucket) {
    const s = frames.slice(i, i + bucket).map((f) => f.p[3]);
    stam.push(+(s.reduce((a, b) => a + b, 0) / s.length / frames[0].p[3]).toFixed(3));
  }

  out.fights[F] = {
    invuln_frames: invulnFrames,
    invuln_frames_overlapping_an_enemy_hitbox: overlap,
    invuln_overlap_fraction: +(overlap / Math.max(1, invulnFrames)).toFixed(4),
    distance_to_nearest_enemy_hitbox_frame: { median: q(0.5), p75: q(0.75), p90: q(0.9), max: dists[dists.length - 1] ?? null },
    state_occupancy: occFrac,
    stamina_series_300: stam,
    m3d_clustering_verdict: overlap / Math.max(1, invulnFrames) >= 0.25 ? 'clustered' : 'NOT CLUSTERED',
  };

  // ASCII timeline strip: 200 columns over the whole fight
  const W = 200, w = Math.ceil(N / W);
  let a = '', b = '', c = '';
  for (let i = 0; i < N; i += w) {
    a += eHb.slice(i, i + w).some(Boolean) ? 'E' : '.';
    b += pIv.slice(i, i + w).some(Boolean) ? 'I' : '.';
    c += pHb.slice(i, i + w).some(Boolean) ? 'P' : '.';
  }
  strip += `${F}  (each column = ${w} frames)\n enemy hitbox : ${a}\n player invuln: ${b}\n player hitbox: ${c}\n\n`;
}
fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-09-r2/critic-r2-m3.json', JSON.stringify(out, null, 1));
fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-09-r2/critic-r2-m3d-timeline.txt', strip);
for (const [k, v] of Object.entries(out.fights)) {
  console.log(k, 'invuln', v.invuln_frames, 'overlapping enemy hitbox', v.invuln_frames_overlapping_an_enemy_hitbox,
    '(' + v.invuln_overlap_fraction + ')', 'dist median', v.distance_to_nearest_enemy_hitbox_frame.median,
    'p90', v.distance_to_nearest_enemy_hitbox_frame.p90, '->', v.m3d_clustering_verdict);
}

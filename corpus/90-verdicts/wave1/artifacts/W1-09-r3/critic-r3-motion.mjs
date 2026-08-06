// Critic r3: single-frame weapon-socket displacement, classified as a STATE BOUNDARY
// (previous frame's state != this frame's) or WITHIN a state. Straight off the shipped
// exemplar frames JSONL. Declared per-frame tip travel for the straight sword is 0.308 m
// (game/data/combat/hitgeometry.json §weapon_hitboxes.straight_sword) and the declared peak
// tip speed is 18.5 m/s.
import fs from 'node:fs';

const HZ = 60;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const out = { declared_per_frame_tip_travel_m: 0.308, declared_peak_tip_speed_mps: 18.5, fights: {} };

for (const F of ['F1', 'F2', 'F3', 'F4', 'F5']) {
  const lines = fs.readFileSync(`reports/w1-09/exemplar/RI-CMB07-exemplar-${F}-frames.jsonl`, 'utf8').split('\n').filter(Boolean);
  const frames = lines.slice(1).map((l) => JSON.parse(l));
  const boundary = [], within = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (!a.x || !b.x || !a.x.sockets || !b.x.sockets) continue;
    if (b.f <= 1) continue;                          // rig initialisation, excluded as the builder excludes it
    const jb = d3(a.x.sockets.slice(3, 6), b.x.sockets.slice(3, 6));
    const rec = { f: b.f, m: +jb.toFixed(4), from: a.p[0], to: b.p[0], anim_from: a.p[1], anim_to: b.p[1] };
    if (a.p[0] !== b.p[0] || a.p[1] !== b.p[1]) boundary.push(rec); else within.push(rec);
  }
  const top = (arr) => arr.sort((x, y) => y.m - x.m).slice(0, 5);
  out.fights[F] = {
    worst_boundary: top(boundary.slice()),
    worst_within: top(within.slice()),
    n_boundary: boundary.length, n_within: within.length,
    boundary_over_declared: boundary.filter((r) => r.m > 0.308).length,
    within_over_declared: within.filter((r) => r.m > 0.308).length,
  };
}
console.log(JSON.stringify(out, null, 1));

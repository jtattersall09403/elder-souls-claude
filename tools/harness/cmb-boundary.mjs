#!/usr/bin/env node
// cmb-boundary.mjs — the W1-09 round-3 verdict §8 measurement, as an instrument.
//
// WHY THIS EXISTS. The round-3 verdict classified every frame of the shipped exemplar as a state
// BOUNDARY or as within-state and reported `worst boundary 0.4561 m ROLL_RECOVER -> ATK_STARTUP`
// in four of five fights. Nothing in the build could reproduce that: the figure came out of a
// critic's own script against a trace file, so every later round could only quote it. Round 4's
// report offered a hypothesis for the residual (`§11.4`: the SOCKET DISTANCE changing at the
// boundary) and recorded that it had not been tested.
//
// This runs the measurement against the LIVE BROWSER BUILD and separates the three things that
// can move a weapon tip in one frame, which is what turns the figure into a diagnosis:
//
//   pose discontinuity   the tip moves, the capsule length is constant, the root is still
//   socket swap          the capsule length changes on exactly the boundary frame
//   whole-rig transform  BOTH sockets move by the same vector -- root translation, root Y
//                        offset, or a yaw step, and `yaw_delta_deg` and `root_move_m` say which
//
// Measured on the round-4b build: ROLL_RECOVER -> ATK_STARTUP is 0.4494 m with the capsule length
// identical to four decimals, the root still to four decimals and the yaw unchanged, and both
// sockets translating +0.443 / +0.448 m in Y. It is the roll clip's `root_offset.y`, which
// `clips.json §cross_fade.what_it_blends` excludes from the blend by declaration.
//
//   node tools/harness/cmb-boundary.mjs [out.json]
//
// AGENT-PROTOCOL: `setRenderRate(0)` is set before any stepping loop.
import fs from 'node:fs';
const { launchGame, requireMethods } = await import('../lib/browser.mjs');

const h = await launchGame({ width: 320, height: 240 });
await h.hOpt('setRenderRate', 0);
await requireMethods(h, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'combatTraceStart', 'combatTraceDrain', 'lockOn', 'teleport']);

const raw = await h.page.evaluate(() => {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  H.setSeed(0);
  H.loadState('arena_champion');
  try { H.lockOn('E1'); } catch (e) { /* no target */ }
  H.combatTraceStart({ scenario: 'w1-09-r4b-boundary' });
  const log = [];
  // Drive roll -> attack-as-soon-as-actionable, and attack -> attack, repeatedly. Both of the
  // verdict's boundaries (ROLL_RECOVER->ATK_STARTUP and ATK_RECOVER->ATK_STARTUP) appear.
  let phase = 0;
  for (let f = 0; f < 1200; f++) {
    const st = cs().player;
    const q = [];
    if (st.state === 'IDLE' || st.state === 'WALK' || st.state === 'RUN') {
      if (phase % 2 === 0) { q.push({ f: 0, move: [0, 1] }, { f: 0, press: ['roll'] }, { f: 1, release: ['roll'] }); }
      else { q.push({ f: 0, press: ['light'] }, { f: 1, release: ['light'] }); }
      phase++;
    } else if (st.state === 'ROLL_RECOVER' || st.state === 'ATK_RECOVER') {
      // hold the attack button through the recovery so the swing starts on the first
      // actionable frame — which is exactly the boundary the verdict measured.
      q.push({ f: 0, press: ['light'] }, { f: 1, release: ['light'] });
    }
    if (q.length) H.queueInputs(q);
    H.stepFrames(1);
  }
  const recs = H.combatTraceDrain();
  for (const r of recs) {
    if (r.t !== 'F') continue;
    log.push([r.f, r.p[0], r.p[1], r.p[2], r.x.sockets, r.x.p_pos, r.x.p_yaw]);
  }
  return log;
});
await h.close();

const rows = raw.map(([f, state, anim, af, s, pos, yaw]) => ({
  f, state, anim, af,
  a: [s[0], s[1], s[2]], b: [s[3], s[4], s[5]],
  len: Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]),
  pos, yaw,
}));
const d3 = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);

const boundaries = [];
let worstAll = { d: 0 };
for (let i = 1; i < rows.length; i++) {
  const p = rows[i - 1], c = rows[i];
  const dTip = d3(c.b, p.b);
  const dRoot = d3(c.pos, p.pos);
  const rec = {
    f: c.f, from: p.state, to: c.state,
    tip_move_m: +dTip.toFixed(4),
    root_move_m: +dRoot.toFixed(4),
    capsule_len_prev_m: +p.len.toFixed(4),
    capsule_len_m: +c.len.toFixed(4),
    capsule_len_delta_m: +(c.len - p.len).toFixed(4),
    anim_from: p.anim, anim_to: c.anim,
    yaw_from: p.yaw, yaw_to: c.yaw, yaw_delta_deg: +(c.yaw - p.yaw).toFixed(3),
    tip_r_prev_m: +Math.hypot(p.b[0] - p.pos[0], p.b[2] - p.pos[2]).toFixed(4),
    tip_move_if_yaw_only_m: +(2 * Math.hypot(p.b[0] - p.pos[0], p.b[2] - p.pos[2]) * Math.abs(Math.sin((c.yaw - p.yaw) * Math.PI / 360))).toFixed(4),
  };
  if (dTip > worstAll.d) worstAll = { d: dTip, ...rec };
  if (p.state !== c.state) boundaries.push(rec);
}
boundaries.sort((x, y) => y.tip_move_m - x.tip_move_m);

const byPair = new Map();
for (const b of boundaries) {
  const k = `${b.from} -> ${b.to}`;
  if (!byPair.has(k) || byPair.get(k).tip_move_m < b.tip_move_m) byPair.set(k, b);
}

const out = {
  _source: 'W1-09 r3 verdict §8 — worst single-frame weapon-tip move at a STATE BOUNDARY',
  frames: rows.length,
  states_seen: [...new Set(rows.map((r) => r.state))],
  boundary_count: boundaries.length,
  worst_boundary: boundaries[0] || null,
  worst_by_pair: [...byPair.entries()].map(([k, v]) => ({ pair: k, ...v })).sort((a, b) => b.tip_move_m - a.tip_move_m),
  worst_any_frame: worstAll,
  top10_boundaries: boundaries.slice(0, 10),
  windows: {},
};
for (const w of out.worst_by_pair.slice(0, 3)) {
  const i0 = rows.findIndex((r) => r.f === w.f);
  out.windows[`${w.pair} @f${w.f}`] = rows.slice(Math.max(0, i0 - 3), i0 + 4).map((r) => ({
    f: r.f, state: r.state, anim: r.anim, af: r.af,
    a: r.a.map((v) => +v.toFixed(4)), b: r.b.map((v) => +v.toFixed(4)),
    pos: r.pos.map((v) => +v.toFixed(4)), yaw: r.yaw,
  }));
}
const dest = process.argv[2];
if (dest) fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ frames: out.frames, states: out.states_seen, boundary_count: out.boundary_count }, null, 1));
console.log('worst by pair:');
for (const p of out.worst_by_pair) {
  console.log(`  ${p.pair.padEnd(34)} tip ${p.tip_move_m.toFixed(4)}  root ${p.root_move_m.toFixed(4)}  dyaw ${p.yaw_delta_deg.toFixed(2)} deg -> ${p.tip_move_if_yaw_only_m.toFixed(4)} m of it  capsule ${p.capsule_len_prev_m.toFixed(3)}->${p.capsule_len_m.toFixed(3)}  @f${p.f}  ${p.anim_from} -> ${p.anim_to}`);
}
console.log(`worst ANY frame: ${out.worst_any_frame.tip_move_m} m  ${out.worst_any_frame.from} -> ${out.worst_any_frame.to} @f${out.worst_any_frame.f}`);

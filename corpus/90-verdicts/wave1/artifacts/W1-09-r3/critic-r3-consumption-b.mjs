import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const base = loadCombatData();
const clone = () => JSON.parse(JSON.stringify(base));

/** Player rolls into the champion's chop from 2.6 m; measures i-frame negation. */
function rollFight(data) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[2] = 2.6; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 10, move: 'chop' }]);
  // roll so the i-frame window (f5..) opens just as the chop goes live (10+68 = f78 active)
  a.queueInputs([{ f: 1, move: [0, 0] }, { f: 70, press: ['roll'] }, { f: 72, release: ['roll'] }]);
  const P = a.cs.bodyOf('P');
  const hp0 = P.hp; let neg = 0, hit = 0, ifr = 0;
  for (let i = 0; i < 220; i++) {
    a.step();
    if (P.iframe) ifr++;
    for (const e of a.drain()) { if (e.kind === 'IFRAME_NEGATE' && e.dst === 'P') neg++; if (e.kind === 'HIT' && e.dst === 'P') hit++; }
  }
  return { iframe_frames: ifr, negations: neg, hits: hit, damage: Math.round(hp0 - P.hp) };
}

/** Body overlap dwell: RI-AI01 spacing — fraction of frames the two capsules interpenetrate. */
function overlapDwell(data) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[2] = 0.8; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  const cyc = ['chop', 'combo_a', 'combo_b', 'thrust']; const sc = []; let f = 20;
  for (let i = 0; i < 40; i++) { sc.push({ f, move: cyc[i % 4] }); f += 160; }
  a.script('E1', sc);
  const ins = [{ f: 1, move: [0, 0] }];
  for (let k = 2; k < 3000; k += 8) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
  a.queueInputs(ins);
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  let n = 0, inside = 0, min = Infinity;
  for (let i = 0; i < 3000; i++) {
    a.step(); a.drain();
    if (P.dead || E.dead) break;
    const d = Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]);
    n++; if (d < P.bodyRadius + E.bodyRadius - 1e-6) inside++;
    if (d < min) min = d;
  }
  return { frames: n, frames_interpenetrating: inside, dwell_fraction: +(inside / n).toFixed(4), min_centre_distance_m: +min.toFixed(3), required_m: P.bodyRadius + E.bodyRadius };
}

/** substeps: does reducing to 1 change which swings connect? Sweep the whole reach band. */
function reachSet(data) {
  const out = [];
  for (let i = 0; i <= 80; i++) {
    const d = +(i * 0.05).toFixed(2);
    const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
    a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
    a.spawn('E1', 'champion_hist_marked', 0, d, 180);
    a.lockOn('E1');
    a.queueInputs([{ f: 1, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
    const E = a.cs.bodyOf('E1'); const h0 = E.hp;
    for (let k = 0; k < 160; k++) { a.step(); a.drain(); }
    if (E.hp < h0) out.push(d);
  }
  return out;
}

const R = {};
R.iframes_full = rollFight(base);
{ const d = clone(); d.roll.roll.LIGHT.iframes = [5, 6]; d.roll.roll.LIGHT.iframe_count = 2; R.iframes_2f = rollFight(d); }
R.overlap_dwell = overlapDwell(base);
{ const d = clone(); d.hitgeometry.bodies.player_radius_m = 0; d.hitgeometry.bodies.default_enemy_radius_m = 0; R.overlap_dwell_no_separation = overlapDwell(d); }
const s4 = reachSet(base);
const d1 = clone(); d1.hitgeometry.sweep.substeps = 1;
const s1 = reachSet(d1);
R.substeps = { substeps_4_hits: s4.length, substeps_1_hits: s1.length, lost_at: s4.filter((x) => !s1.includes(x)), gained_at: s1.filter((x) => !s4.includes(x)) };
console.log(JSON.stringify(R, null, 1));

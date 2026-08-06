#!/usr/bin/env node
// TEMPORARY. Stationary mashing player vs the champion, at a range of distances.
import { NodeArena } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const DS = (arg('d', '0.4,0.8,1.0,1.1,1.5,2.0,2.6')).split(',').map(Number);
const CAP = Number(arg('cap', 3000));

// The champion's own loop, close to the exemplar's: chop, combo_a, combo_b, thrust on a cadence.
function enemyLoop(n) {
  const out = []; let f = 30;
  const cyc = ['chop', 'combo_a', 'combo_b', 'thrust'];
  for (let i = 0; i < n; i++) { out.push({ f, move: cyc[i % cyc.length] }); f += 160; }
  return out;
}

for (const d of DS) {
  const a = new NodeArena({ loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  if (process.argv.includes('--nosep')) a.cs.resolveBodyCollision = () => {};
  a.lockOn('E1');
  a.script('E1', enemyLoop(80));
  // mash light every 8 frames, forever
  const ins = [{ f: 0, move: [0, 0] }];
  for (let f = 2; f < CAP; f += 8) { ins.push({ f, press: ['light'] }); ins.push({ f: f + 2, release: ['light'] }); }
  a.queueInputs(ins);
  const E = a.cs.bodyOf('E1'), P = a.cs.bodyOf('P');
  const hp0 = P.hp, ehp0 = E.hp;
  let active = 0, stagger = 0, frames = 0;
  const via = {};
  for (let i = 0; i < CAP; i++) {
    a.step(); frames++;
    if (E.state === 'ATK_ACTIVE') active++;
    if (E.state === 'STAGGER') stagger++;
    for (const e of a.drain()) if (e.kind === 'HIT' && e.dst === 'P') via[e.via] = (via[e.via] || 0) + 1;
    if (E.dead || P.dead) break;
  }
  console.log(`d=${d}  enemy_killed=${E.dead} player_died=${P.dead} frames=${frames} dmg_taken=${Math.round(hp0 - P.hp)}/${hp0} enemy_hp=${Math.round(Math.max(0, E.hp))}/${ehp0} atk_active_f=${active} stagger_f=${stagger} hits_by=${JSON.stringify(via)}`);
}

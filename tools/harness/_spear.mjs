#!/usr/bin/env node
// TEMPORARY. Per-frame trace of a player spear R1 against a stationary champion.
import { NodeArena } from '../lib/combat-node.mjs';
import { capsuleGap } from '../../game/src/combat/geometry.js';

const argv = process.argv.slice(2);
const NOSEP = argv.includes('--nosep');
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const W = arg('w', 'spear');
const D = Number(arg('d', 2.0));

const a = new NodeArena({ loadout: { weapon: W } });
if (NOSEP) a.cs.resolveBodyCollision = () => {};
a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
a.spawn('E1', 'champion_hist_marked', 0, D, 180);
a.lockOn('E1');
a.queueInputs([{ f: 0, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
const E = a.cs.bodyOf('E1'), P = a.cs.bodyOf('P');
const e0 = E.hp;
for (let k = 0; k < 70; k++) {
  a.step();
  let best = Infinity, part = null;
  for (const h of E.rig.hurtboxes) {
    const g = capsuleGap(P.socketA, P.socketB, P.move ? P.move.hitbox_radius_m : 0, h.a, h.b, h.r);
    if (g < best) { best = g; part = h.id; }
  }
  const st = P.state;
  if (st === 'IDLE') continue;
  console.log(`f${a.frame} ${st.padEnd(12)} af=${String(P.animFrame).padStart(2)} hb=${P.hitboxActive ? 1 : 0} pz=${P.pos[2].toFixed(3)} ez=${E.pos[2].toFixed(3)} dist=${(E.pos[2] - P.pos[2]).toFixed(3)} sA=[${P.socketA.map((v) => v.toFixed(2)).join(',')}] sB=[${P.socketB.map((v) => v.toFixed(2)).join(',')}] gap=${best.toFixed(3)} ${part} ehp=${Math.round(E.hp)}`);
  if (E.hp < e0) { console.log('HIT'); break; }
}

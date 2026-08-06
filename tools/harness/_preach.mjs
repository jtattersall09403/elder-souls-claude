#!/usr/bin/env node
// TEMPORARY. Player weapon reach sweep, with a switch for the step-5 separation pass.
import { NodeArena } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const NOSEP = argv.includes('--nosep');
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const WPNS = (arg('w', 'dagger,straight-sword,spear,greatsword,halberd')).split(',');

for (const w of WPNS) {
  const hits = [];
  const detail = [];
  for (let i = 0; i <= 40; i++) {
    const d = i / 10;
    const a = new NodeArena({ loadout: { weapon: w } });
    if (NOSEP) a.cs.resolveBodyCollision = () => {};
    a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
    a.spawn('E1', 'champion_hist_marked', 0, d, 180);
    a.lockOn('E1');
    a.queueInputs([{ f: 0, move: [0, 0] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] }]);
    const E = a.cs.bodyOf('E1');
    const e0 = E.hp;
    let hit = false, minD = Infinity;
    for (let k = 0; k < 160; k++) {
      a.step();
      const dist = Math.hypot(E.pos[0] - a.player.pos[0], E.pos[2] - a.player.pos[2]);
      if (dist < minD) minD = dist;
      if (E.hp < e0) hit = true;
    }
    if (hit) hits.push(d);
    detail.push(`${d}:${hit ? 'H' : '.'}${minD.toFixed(2)}`);
  }
  const inner = hits.length ? [] : null;
  const min = hits[0];
  const misses = hits.length ? [] : null;
  const holes = [];
  for (let i = 0; i <= 40; i++) { const d = i / 10; if (d < min && !hits.includes(d)) holes.push(d); }
  console.log(`${w.padEnd(16)} min=${hits[0]} max=${hits[hits.length - 1]} n=${hits.length} inner_misses=${holes.length}`);
  if (argv.includes('--v')) console.log('   ', detail.join(' '));
}

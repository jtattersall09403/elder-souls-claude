#!/usr/bin/env node
// TEMPORARY node-side diagnostic. Deleted before hand-off.
import { NodeArena } from '../lib/combat-node.mjs';
import { capsuleGap } from '../../game/src/combat/geometry.js';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

const MOVE = arg('move', 'chop');
const VERBOSE = argv.includes('--v');
const DS = arg('d', null);

function run(d, move, verbose) {
  const a = new NodeArena({ loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = d; a.player.yaw = 180;
  a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 4, move }]);
  a.queueInputs([{ f: 0, move: [0, 0] }]);
  const E = a.cs.bodyOf('E1'), P = a.cs.bodyOf('P');
  const hp0 = P.hp;
  const rows = [];
  let hit = false;
  for (let i = 0; i < 120; i++) {
    a.step();
    let best = Infinity, bestPart = null;
    for (const h of P.rig.hurtboxes) {
      const g = capsuleGap(E.socketA, E.socketB, E.move ? E.move.hitbox_radius_m : 0, h.a, h.b, h.r);
      if (g < best) { best = g; bestPart = h.id; }
    }
    if (P.hp < hp0) hit = true;
    if (verbose && (E.state === 'ATK_ACTIVE' || E.state === 'ATK_WINDUP')) {
      rows.push(`f${a.frame} ${E.state.padEnd(10)} af=${String(E.animFrame).padStart(2)} hb=${E.hitboxActive ? 1 : 0} ez=${E.pos[2].toFixed(3)} sA=[${E.socketA.map((v) => v.toFixed(2)).join(',')}] sB=[${E.socketB.map((v) => v.toFixed(2)).join(',')}] gap=${best.toFixed(3)} ${bestPart}`);
    }
  }
  return { hit, rows, dmg: hp0 - P.hp };
}

if (DS) {
  for (const d of DS.split(',').map(Number)) {
    const r = run(d, MOVE, true);
    console.log(`=== d=${d} move=${MOVE} hit=${r.hit} dmg=${r.dmg}`);
    for (const l of r.rows) console.log(l);
  }
} else {
  const hits = [];
  for (let i = 0; i <= 40; i++) {
    const d = i / 10;
    const r = run(d, MOVE, false);
    if (r.hit) hits.push(d);
  }
  console.log(MOVE, 'min', hits[0], 'max', hits[hits.length - 1], 'n', hits.length);
}

#!/usr/bin/env node
// TEMPORARY. Worst single-frame weapon-socket displacement, by state transition.
import { NodeArena } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

const a = new NodeArena({ loadout: { weapon: 'straight-sword' } });
a.player.pos[0] = 0; a.player.pos[2] = 0; a.player.yaw = 0; a.player.evaluateRig(0);
a.spawn('E1', 'champion_hist_marked', 0, 3.0, 180);
a.lockOn('E1');
const script = [];
for (let f = 40; f < 4000; f += 190) { script.push({ f, move: 'chop' }); script.push({ f: f + 60, move: 'combo_a' }); }
a.script('E1', script);

// A player doing everything: run, sprint, roll, chained attacks, block, walk.
const ins = [];
let f = 2;
const seq = () => {
  ins.push({ f, move: [0, 1] }); f += 20;                     // run
  ins.push({ f, press: ['roll'] }); ins.push({ f: f + 2, release: ['roll'] }); f += 34;
  ins.push({ f, press: ['sprint'] }); f += 30;
  ins.push({ f, press: ['roll'] }); ins.push({ f: f + 2, release: ['roll'] }); f += 34;
  ins.push({ f, release: ['sprint'] }); ins.push({ f: f + 1, move: [0, 0] }); f += 6;
  for (let k = 0; k < 3; k++) { ins.push({ f, press: ['light'] }); ins.push({ f: f + 2, release: ['light'] }); f += 26; }
  ins.push({ f, press: ['heavy'] }); ins.push({ f: f + 2, release: ['heavy'] }); f += 70;
  ins.push({ f, press: ['block'] }); f += 30; ins.push({ f, release: ['block'] }); f += 4;
  ins.push({ f, move: [0.6, 0.3] }); f += 24; ins.push({ f, move: [0, 0] }); f += 10;
};
for (let i = 0; i < 12; i++) seq();
a.queueInputs(ins);

const P = a.player, E = a.cs.bodyOf('E1');
const worst = new Map();
let prevState = P.state, prevA = P.socketA.slice(), prevB = P.socketB.slice(), prevYaw = P.yaw;
let prevEState = E.state, prevEA = E.socketA.slice(), prevEB = E.socketB.slice(), prevEYaw = E.yaw;
const rec = (map, from, to, d, yaw) => {
  const k = `${from}->${to}`;
  const c = map.get(k) || { worst: 0, n: 0, yaw: 0 };
  if (d > c.worst) { c.worst = d; c.yaw = yaw; }
  c.n++; map.set(k, c);
};
const dist = (a1, a2) => Math.hypot(a1[0] - a2[0], a1[1] - a2[1], a1[2] - a2[2]);

for (let i = 0; i < f + 200; i++) {
  a.step();
  const dA = Math.max(dist(P.socketA, prevA), dist(P.socketB, prevB));
  rec(worst, prevState, P.state, dA, Math.abs(((P.yaw - prevYaw + 540) % 360) - 180));
  if (process.env.SNAPDBG && dA > Number(process.env.SNAPDBG) && (process.env.SNAPSAME ? prevState === P.state : true)) console.log('DBG f'+a.frame, prevState+'->'+P.state, 'd='+dA.toFixed(3), 'anim='+P.anim, 'af='+P.animFrame, 'loopF='+P._loopFrame, 'blendLeft='+P.rig.blendLeft, 'guard='+P.guardRaised);
  prevState = P.state; prevA = P.socketA.slice(); prevB = P.socketB.slice(); prevYaw = P.yaw;
  const dE = Math.max(dist(E.socketA, prevEA), dist(E.socketB, prevEB));
  rec(worst, 'E:' + prevEState, 'E:' + E.state, dE, Math.abs(((E.yaw - prevEYaw + 540) % 360) - 180));
  prevEState = E.state; prevEA = E.socketA.slice(); prevEB = E.socketB.slice(); prevEYaw = E.yaw;
}

const rows = [...worst.entries()].sort((x, y) => y[1].worst - x[1].worst);
console.log('worst single-frame weapon-socket displacement, by transition (declared straight-sword per-frame tip travel = 0.308 m)');
for (const [k, v] of rows.slice(0, 16)) {
  const same = k.split('->')[0].replace('E:', '') === k.split('->')[1].replace('E:', '');
  console.log(`  ${v.worst.toFixed(3)} m  ${(v.worst * 60).toFixed(0).padStart(4)} m/s  x${String(v.n).padStart(4)}  ${k}  yaw=${v.yaw.toFixed(1)}deg${same ? '   (within a state)' : ''}`);
}

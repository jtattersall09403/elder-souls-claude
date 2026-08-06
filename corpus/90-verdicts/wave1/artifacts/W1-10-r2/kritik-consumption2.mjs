// CONSUMPTION, part 2: the two models part 1's probe was too weak to exercise.
'use strict';
import fs from 'node:fs';
const ROOT = '/home/user/elder-souls-claude';
const MS = `${ROOT}/game/data/combat/movesets/ssw_garrison_sword.json`;

async function run(script, dist, frames = 400) {
  const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs?v=${Math.random()}`);
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon: 'straight-sword' } });
  const e = a.spawn('t', 'dummy_passive', 0, dist, 180);
  a.lockOn('t');
  a.queueInputs(script);
  const chain = []; const hits = [];
  const z0 = a.player.pos[2];
  let zmax = z0;
  for (let i = 0; i < frames; i++) {
    a.step();
    zmax = Math.max(zmax, a.player.pos[2]);
    for (const ev of a.drain()) {
      if (ev.kind === 'ACTION_START' && ev.tag === 'attack') chain.push(ev.anim_slot);
      if (ev.kind === 'HIT') hits.push(ev.f);
    }
  }
  return { chain, hits, dz: +(zmax - z0).toFixed(4), hp: e.hp };
}
function patch(file, fn) {
  const orig = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(orig); fn(doc);
  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  return () => fs.writeFileSync(file, orig);
}

// mash light every 8 f to drive the chain (RI-WPN02 §D D4's own method)
const mash = []; for (let f = 3; f < 400; f += 8) { mash.push({ f, press: ['light'] }, { f: f + 2, release: ['light'] }); }

const out = [];
{
  const before = await run(mash, 1.2);
  const r = patch(MS, (d) => { delete d.slots['r1.1'].chains_to; });
  let after; try { after = await run(mash, 1.2); } finally { r(); }
  const changed = before.chain.join(',') !== after.chain.join(',');
  out.push({ name: 'chains_to r1.1->r1.2 deleted (mash probe)', changed, before: before.chain.slice(0, 8), after: after.chain.slice(0, 8) });
  console.log(`${changed ? 'CONSUMED' : 'INERT   '}  chains_to  before[${before.chain.slice(0, 6)}]  after[${after.chain.slice(0, 6)}]`);
}
{
  // root translation: measure the attacker's own forward displacement during the swing,
  // and re-test the S26 body corridor at the edge of reach.
  const solo = [{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }];
  const before = await run(solo, 6.0);
  const r = patch(MS, (d) => { d.slots['r1.1'].root_dz_m = 0; });
  let after; try { after = await run(solo, 6.0); } finally { r(); }
  const changed = before.dz !== after.dz;
  out.push({ name: 'root_dz_m 0.31 -> 0 (attacker displacement)', changed, before_dz: before.dz, after_dz: after.dz });
  console.log(`${changed ? 'CONSUMED' : 'INERT   '}  root_dz_m  attacker dz before=${before.dz} m  after=${after.dz} m`);
}
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));

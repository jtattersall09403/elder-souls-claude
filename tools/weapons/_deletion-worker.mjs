// Measurement worker for `deletion-test.mjs`, run as a FRESH NODE PROCESS.
//
// Why a process and not a cache-busted import. `import('x.mjs?v=rand')` busts only that module;
// its transitive imports stay in the ESM registry. The first version of the deletion test did
// exactly that and reported three fixes as "deleting them changes nothing" — because the edited
// `resolve.js` and `system.js` were never re-read. A deletion test that cannot see the deletion
// is the "probe that cannot fail" AGENT-PROTOCOL names; a process boundary is the only honest
// module cache reset.
//
//   node tools/weapons/_deletion-worker.mjs '<json args>'
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const A = JSON.parse(process.argv[2]);

async function fight({ weapon, target, dist, frames }) {
  const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon } });
  const e = a.spawn('t', target, 0, dist, 180);
  a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp;
  let hitF = null, held = 0, prevAnim = -1, mat = null, hs = null, vhs = null, kb = null, err = null;
  try {
    for (let i = 0; i < frames; i++) {
      a.step();
      for (const ev of a.drain()) {
        const k = ev.kind || ev.type;
        if (k === 'HIT' && hitF === null) hitF = ev.f;
        if (k === 'IMPACT' && mat === null) { mat = ev.material; hs = ev.hitstop_f; vhs = ev.victim_hitstop_f; kb = ev.knockback_m; }
      }
      if (hitF !== null && a.player.animFrame === prevAnim) held++;
      prevAnim = a.player.animFrame;
    }
  } catch (x) { err = String((x && x.message) || x); }
  return { dmg: +(hp0 - e.hp).toFixed(2), hitF, held, material: mat, hitstop_f: hs, victim_hitstop_f: vhs, knockback_m: kb, error: err };
}

async function reach() {
  const { loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
  const { MovesetLibrary } = await import(`${ROOT}/game/src/combat/moveset.js`);
  const { Rig } = await import(`${ROOT}/game/src/combat/skeleton.js`);
  const D = loadCombatData();
  const lib = new MovesetLibrary(
    { clips: JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/clip-registry.json`, 'utf8')).clips },
    JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/classes.json`, 'utf8')),
    D.weaponMovesets, D.skeleton, D.hitgeometry);
  const rig = new Rig(D.skeleton, D.hitgeometry);
  const byClass = {}, rows = {};
  for (const [id, ms] of Object.entries(D.weaponMovesets)) {
    (byClass[ms.class] ||= []).push(id);
    const lead = ms.slots['r1.1'] ? 'r1.1' : Object.keys(ms.slots)[0];
    const slot = ms.slots[lead];
    const clip = lib.clipFor(id, lead), sock = lib.socketsFor(id, lead);
    const startup = slot.startup_f + (slot.charge_max_f || 0);
    const pos = [0, 0, 0];
    let r = 0, inb = Infinity;
    for (let f = startup + 1; f <= startup + slot.active_f && f <= clip.total; f++) {
      pos[2] = clip.rootForwardAt(f); clip.applyPose(rig, f);
      rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
      r = Math.max(r, Math.hypot(rig.socketB[0] - pos[0], rig.socketB[2] - pos[2]));
      inb = Math.min(inb, Math.hypot(rig.socketA[0] - pos[0], rig.socketA[2] - pos[2]));
    }
    rows[id] = { measured: +r.toFixed(4), declared: ms.reach_m, inboard: +inb.toFixed(3), socket_a: sock.a, socket_b: sock.b };
  }
  const spread = {};
  for (const [c, ids] of Object.entries(byClass)) { const v = ids.map((i) => rows[i].measured); spread[c] = +(Math.max(...v) - Math.min(...v)).toFixed(3); }
  const err = Object.values(rows).map((x) => Math.abs(x.measured - x.declared));
  const inb = Object.values(rows).map((x) => x.inboard);
  return {
    weapons: Object.keys(rows).length,
    conform_0_10m: err.filter((e) => e <= 0.10).length,
    max_err_m: +Math.max(...err).toFixed(3),
    worst_class_spread_m: +Math.max(...Object.values(spread)).toFixed(3),
    worst_class: Object.entries(spread).sort((a, b) => b[1] - a[1])[0][0],
    max_inboard_m: +Math.max(...inb).toFixed(3),
    weapons_with_inboard_over_0_60: inb.filter((x) => x > 0.60).length,
  };
}

async function band({ weapon, from, to, step, frames }) {
  const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
  const D = loadCombatData();
  const v = [];
  for (let d = from; d <= to + 1e-9; d += step) {
    const a = new NodeArena({ data: D, loadout: { weapon } });
    const e = a.spawn('t', 'mat_flesh', 0, +d.toFixed(2), 180);
    a.lockOn('t'); a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
    const hp0 = e.hp;
    try { for (let i = 0; i < frames; i++) a.step(); } catch { /* the crash cases */ }
    v.push({ d: +d.toFixed(2), hit: hp0 - e.hp > 0 });
  }
  const hits = v.filter((x) => x.hit).map((x) => x.d);
  return {
    vector: v.map((x) => (x.hit ? '1' : '0')).join(''),
    min: hits.length ? Math.min(...hits) : null,
    max: hits.length ? Math.max(...hits) : null,
    interior_gaps_m: hits.length ? v.filter((x) => !x.hit && x.d > Math.min(...hits) && x.d < Math.max(...hits)).map((x) => x.d) : [],
  };
}

const out = A.op === 'fight' ? await fight(A) : A.op === 'reach' ? await reach() : await band(A);
process.stdout.write(JSON.stringify(out));

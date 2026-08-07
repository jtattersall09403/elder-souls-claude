// One measurement, in its own process, so that an edit to a source file is really seen.
//
// `fix-ablation.mjs` first tried to bust the module cache with a `?v=` query on
// tools/lib/combat-node.mjs. That invalidates ONLY that module: Node's ESM registry keys by
// resolved URL, and combat-node.mjs imports `game/src/combat/system.js` without a query, so the
// patched file was never re-read and all three ablations reported numbers identical to the
// unablated build. A probe that cannot see its own perturbation reports everything as INERT, and
// this is the second time this round that failure mode has appeared. One process per measurement
// is the only version of this that cannot silently lie.
'use strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const D = loadCombatData();
const WHICH = process.argv[2];

function fight(weapon, target, dist, frames = 300) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  const e = a.spawn('t', target, 0, dist, 180);
  e.knockbackImmune = true;
  a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp;
  let imp = null, held = 0, pa = -1, hitF = null;
  for (let i = 0; i < frames; i++) {
    a.step();
    for (const ev of a.drain()) {
      if (ev.kind === 'IMPACT' && !imp) { imp = ev; hitF = ev.f; }
      if ((ev.kind === 'HIT' || ev.kind === 'DEFLECT') && hitF === null) hitF = ev.f;
    }
    if (hitF !== null && i > 0 && a.player.animFrame === pa) held++;
    pa = a.player.animFrame;
  }
  return { hit: !!imp, dmg: +(hp0 - e.hp).toFixed(2), hitstop_declared: imp ? imp.hitstop_f : null, hitstop_held: held, material: imp ? imp.material : null };
}

if (WHICH === 'deadbands') {
  const out = {};
  for (const w of ['spr_drowned_harpoon', 'hlb_garrison_bill', 'axe_bog_cleaver']) {
    const v = [];
    for (let d = 0.2; d <= 3.0001; d += 0.05) {
      const dd = +d.toFixed(2);
      v.push({ d: dd, hit: fight(w, 'mat_flesh', dd, 260).hit });
    }
    const hits = v.filter((x) => x.hit).map((x) => x.d);
    out[w] = {
      min: hits.length ? Math.min(...hits) : null,
      max: hits.length ? Math.max(...hits) : null,
      interior_gaps_m: hits.length ? v.filter((x) => !x.hit && x.d > Math.min(...hits) && x.d < Math.max(...hits)).map((x) => x.d) : [],
    };
  }
  console.log(JSON.stringify(out));
} else if (WHICH === 'arc') {
  const byClass = {};
  for (const [id, m] of Object.entries(D.weaponMovesets)) (byClass[m.class] ||= []).push(id);
  let bad = 0, total = 0; const list = [];
  for (const c of Object.keys(byClass).sort()) {
    const wid = byClass[c].sort()[0];
    const ms = D.weaponMovesets[wid];
    for (const slot of ['r1.1', 'r2']) {
      if (!ms.slots[slot]) continue;
      total++;
      const btn = /r2/.test(slot) ? 'heavy' : 'light';
      const a = new NodeArena({ data: D, loadout: { weapon: wid } });
      const b = a.player;
      a.queueInputs([{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
      const bs = [];
      for (let i = 0; i < 400; i++) {
        a.step();
        const m = b.move;
        if (m && m.kind === 'attack' && m.slot === slot && b.animFrame > m.startup && b.animFrame <= m.startup + m.active) {
          const dx = b.socketB[0] - b.pos[0], dz = b.socketB[2] - b.pos[2];
          if (Math.hypot(dx, dz) >= 0.20) bs.push(Math.atan2(dx, dz));
        }
      }
      let tr = 0;
      for (let i = 1; i < bs.length; i++) { let d = bs[i] - bs[i - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tr += Math.abs(d); }
      const meas = +((tr * 180) / Math.PI).toFixed(1);
      const decl = Math.abs(ms.slots[slot].arc_sweep_deg);
      if (Math.abs(meas - decl) > 10) { bad++; list.push(`${c}/${slot} decl ${decl} meas ${meas}`); }
    }
  }
  console.log(JSON.stringify({ nonconforming: bad, of: total, list }));
} else if (WHICH === 'material') {
  const rows = {};
  for (const m of ['flesh', 'chitin', 'stone', 'metal', 'wood', 'water']) rows[m] = fight('ssw_garrison_sword', 'mat_' + m, 1.2);
  console.log(JSON.stringify({
    rows,
    distinct_damage: new Set(Object.values(rows).map((r) => r.dmg)).size,
    distinct_hitstop: new Set(Object.values(rows).map((r) => r.hitstop_held)).size,
    of: Object.keys(rows).length,
  }));
}

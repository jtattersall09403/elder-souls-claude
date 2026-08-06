// ARI (amended bands, within-class SHARE, S_total 2065), TDV and ILS — the observed column.
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const ROOT = '/home/user/elder-souls-claude';
const D = loadCombatData();
const MS = D.weaponMovesets;
const MAND = 'r1.1 r1.2 r1.3 r2 r2.charged run.r1 run.r2 roll.r1 backstep.r1 jump.r1 plunge guard.counter guardbreak art.1 2h.r1.1 2h.r1.2 2h.r1.3 2h.r2 2h.r2.charged 2h.run.r1 2h.run.r2 2h.roll.r1 2h.backstep.r1 2h.jump.r1 2h.guard.counter'.split(' ');
const CHAIN2 = new Set(['CGS', 'GHM']);
const BOW_MAND = 'bow.draw bow.quick bow.aimed bow.roll plunge guardbreak art.1'.split(' ');
const out = { generated: new Date().toISOString() };

// ---- ARI -------------------------------------------------------------------------------------
let S_total = 0; const clipUse = new Map(); const perWeapon = {};
for (const [wid, m] of Object.entries(MS)) {
  const mand = m.class === 'BOW' ? BOW_MAND : (CHAIN2.has(m.class) ? MAND.filter((s) => s !== 'r1.3' && s !== '2h.r1.3') : MAND);
  const present = mand.filter((s) => m.slots[s]);
  S_total += mand.length;
  for (const s of present) {
    const key = m.class + '|' + m.slots[s].anim;           // within-class SHARE scope (§C as tightened)
    if (!clipUse.has(key)) clipUse.set(key, new Set());
    clipUse.get(key).add(wid);
  }
  perWeapon[wid] = { class: m.class, mandatory: mand.length, present: present.length, missing: mand.filter((s) => !m.slots[s]) };
}
const C = clipUse.size;
const shareHist = {};
for (const s of clipUse.values()) { const n = Math.min(5, s.size); shareHist[n >= 5 ? '5+' : n] = (shareHist[n >= 5 ? '5+' : n] || 0) + 1; }
const overShare = [...clipUse.entries()].filter(([, s]) => s.size > 4);
out.ARI = {
  S_total, distinct_clips_C: C, ARI: +(C / S_total).toFixed(4),
  bands: 'PASS 0.42 <= ARI <= 0.60, HARD FAIL < 0.33 (amended wave 1)',
  verdict: (C / S_total) < 0.33 ? 'HARD FAIL' : (C / S_total > 0.60 ? 'FAIL over-fragmented' : (C / S_total >= 0.42 ? 'PASS' : 'BELOW PASS')),
  share_histogram: shareHist, clips_shared_by_more_than_4: overShare.length,
  weapons_missing_mandatory: Object.entries(perWeapon).filter(([, v]) => v.present < v.mandatory).map(([k, v]) => `${k} missing ${v.missing.join(',')}`),
};
console.log('ARI', out.ARI.ARI, out.ARI.verdict, '| S_total', S_total, 'C', C, '| share hist', JSON.stringify(shareHist));
if (out.ARI.weapons_missing_mandatory.length) console.log('  MISSING MANDATORY SLOTS on', out.ARI.weapons_missing_mandatory.length, 'weapons:', out.ARI.weapons_missing_mandatory.slice(0, 6));

// ---- TDV (observed): drive each mirrored slot one-handed and two-handed, compare live ---------
function driveSlot(weapon, twoHand, slot) {
  const a = new NodeArena({ data: D, loadout: { weapon, twoHanded: twoHand } });
  const b = a.player;
  const btn = /(^|\.)(r2|art)/.test(slot) ? 'heavy' : 'light';
  a.queueInputs([{ f: 3, press: [btn] }, { f: 5, release: [btn] }]);
  let ev = null; const path = [];
  for (let i = 0; i < 300; i++) {
    a.step();
    for (const e of a.drain()) if (e.kind === 'ACTION_START' && e.tag === 'attack' && !ev) ev = e;
    if (b.move && b.move.kind === 'attack') path.push([...b.socketB]);
  }
  return ev ? { slot: ev.anim_slot, anim: ev.anim, f: [ev.startup, ev.active, ev.recovery], arc: ev.arc_sweep_deg, path } : null;
}
const MIRROR = ['r1.1', 'r1.2', 'r2', 'run.r1', 'roll.r1', 'backstep.r1', 'jump.r1'];
const tdvRows = [];
for (const [wid, m] of Object.entries(MS)) {
  if (m.class === 'BOW') continue;
  let div = 0, n = 0;
  for (const s of MIRROR) {
    if (!m.slots[s] || !m.slots['2h.' + s]) continue;
    n++;
    const a = m.slots[s], b = m.slots['2h.' + s];
    const clipDiff = a.anim !== b.anim;
    const arcDiff = Math.abs((a.arc_sweep_deg || 0) - (b.arc_sweep_deg || 0)) >= 25;
    const shapeDiff = a.shape !== b.shape;
    if (clipDiff && (arcDiff || shapeDiff)) div++;
  }
  tdvRows.push({ weapon: wid, class: m.class, mirrored: n, diverged: div, TDV: n ? +(div / n).toFixed(4) : 0 });
}
const tv = tdvRows.map((r) => r.TDV).sort((a, b) => a - b);
out.TDV = { median: tv[tv.length >> 1], min: tv[0], zero_weapons: tdvRows.filter((r) => r.TDV === 0).map((r) => r.weapon), rows: tdvRows };
console.log('TDV declared-structure median', out.TDV.median, 'min', out.TDV.min, 'weapons at 0:', out.TDV.zero_weapons.length);
// live confirmation on the four probes
const live = [];
for (const w of ['dagger', 'straight-sword', 'axe', 'ultra-greatsword']) {
  for (const s of ['r1.1', 'r2']) {
    const one = driveSlot(w, false, s), two = driveSlot(w, true, s);
    const same = one && two && one.anim === two.anim;
    let pathDelta = null;
    if (one && two) { const n = Math.min(one.path.length, two.path.length); let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.hypot(one.path[i][0] - two.path[i][0], one.path[i][1] - two.path[i][1], one.path[i][2] - two.path[i][2])); pathDelta = +mx.toFixed(3); }
    live.push({ weapon: w, slot: s, one: one && one.anim, two: two && two.slot, two_anim: two && two.anim, same_clip: same, max_tip_path_delta_m: pathDelta });
    console.log(`  TDV live ${w.padEnd(18)} ${s.padEnd(6)} 1h ${one && one.anim} -> 2h ${two && two.slot}/${two && two.anim}  tip-path delta ${pathDelta} m`);
  }
}
out.TDV.live = live;

// ---- ILS (observed hitstop grid) --------------------------------------------------------------
const lib = new (await import(`${ROOT}/game/src/combat/moveset.js`)).MovesetLibrary(D.clipRegistry, D.weaponClasses, MS);
const MATS = Object.keys(D.weaponClasses.hitstop.attacker.light);
const TIERS = ['light', 'medium', 'heavy', 'ultra'];
const grid = {}; const triples = new Set(); let cells = 0, unique = 0;
const rep = { light: 'dgr_shell_knife', medium: 'ssw_garrison_sword', heavy: 'axe_shell_splitter', ultra: 'ugs_golem_sword' };
for (const t of TIERS) {
  grid[t] = {};
  for (const mat of MATS) {
    const w = rep[t]; if (!w || !MS[w]) continue;
    const hs = lib.hitstopFor(w, 'r1.1', mat);
    const kb = lib.knockbackFor(w, 'r1.1', mat);
    const vh = lib.victimHitstopFor(w, 'r1.1', mat);
    grid[t][mat] = { hitstop_f: hs, knockback_m: kb, victim_hitstop_f: vh };
    cells++; const key = `${hs}|${kb}|${vh}`; if (!triples.has(key)) { triples.add(key); }
  }
}
for (const t of TIERS) for (const mat of MATS) { const c = grid[t][mat]; if (!c) continue; const key = `${c.hitstop_f}|${c.knockback_m}|${c.victim_hitstop_f}`; let n = 0; for (const tt of TIERS) for (const mm of MATS) { const d = grid[tt][mm]; if (d && `${d.hitstop_f}|${d.knockback_m}|${d.victim_hitstop_f}` === key) n++; } if (n === 1) unique++; }
out.ILS = { cells, uniquely_legible: unique, ILS: +(unique / cells).toFixed(4), grid, bands: 'PASS >= 0.80, HARD FAIL < 0.40' };
console.log('ILS', out.ILS.ILS, `(${unique}/${cells} cells with a unique (hitstop,knockback,victim) triple)`);
fs.writeFileSync(process.argv[2] || '/dev/stdout', JSON.stringify(out, null, 1));

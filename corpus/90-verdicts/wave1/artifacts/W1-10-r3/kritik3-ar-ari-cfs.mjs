// KRITIK3 — AR-1 / AR-2 / AR-3, plus an independent `ARI`, `CFS`, `TDV` and determinism census.
// Nothing here is read from a builder tool's output. §3.4: "Do not accept a matrix the builder
// produced. Do not accept `ARI` reported by a tool the builder wrote."
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const D = loadCombatData();

const out = { generated: new Date().toISOString(), instrument: 'kritik3-ar-ari-cfs.mjs (critic-authored)' };

// ============================================================================================
// AR-1 — randomness anywhere on the weapon path, and cancellable attacks.
// ============================================================================================
const SRC = ['combat/resolve.js', 'combat/impact.js', 'combat/moves.js', 'combat/moveset.js',
  'combat/actor.js', 'combat/player.js', 'combat/swing.js', 'combat/system.js', 'combat/geometry.js']
  .map((f) => ({ f, s: fs.readFileSync(path.join(ROOT, 'game/src', f), 'utf8') }));
const rngHits = [];
for (const { f, s } of SRC) {
  s.split('\n').forEach((line, i) => {
    if (/Math\.random|\brng\b|\brandom\(|nextFloat|shuffle/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
      rngHits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`);
    }
  });
}
// The behavioural half: two identical seeds must produce an identical event stream and hp.
function scripted(seed) {
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon: 'ssw_garrison_sword' } });
  const e = a.spawn('t', 'inf_trash', 0, 1.4, 180);
  a.lockOn('t'); a.script('t', [{ f: 20, move: 'chop', face: 180 }, { f: 140, move: 'thrust', face: 180 }]);
  a.queueInputs([{ f: 4, press: ['light'] }, { f: 6, release: ['light'] },
    { f: 60, press: ['light'] }, { f: 62, release: ['light'] },
    { f: 130, press: ['heavy'] }, { f: 150, release: ['heavy'] }]);
  const ev = [];
  for (let i = 0; i < 260; i++) { a.step(); for (const x of a.drain()) ev.push(`${x.f}:${x.kind}:${x.dmg ?? ''}`); }
  return { ev: ev.join('|'), hp: e.hp, php: a.player.hp };
}
const r1 = scripted(1), r2 = scripted(1);
// And a *damage-variance* probe: 12 identical hits must produce exactly one damage value.
const dmgs = new Set();
for (let k = 0; k < 12; k++) {
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon: 'ssw_garrison_sword' } });
  const e = a.spawn('t', 'mat_flesh', 0, 1.2, 180); a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp;
  for (let i = 0; i < 90; i++) a.step();
  dmgs.add(+(hp0 - e.hp).toFixed(4));
}
out.AR1 = {
  rng_references_on_the_weapon_path: rngHits,
  determinism_identical: r1.ev === r2.ev && r1.hp === r2.hp && r1.php === r2.php,
  distinct_damage_over_12_identical_hits: [...dmgs],
  verdict: rngHits.length === 0 && r1.ev === r2.ev && dmgs.size === 1 ? 'PASS' : 'INVESTIGATE',
};

// ============================================================================================
// AR-2 — Souls conventions leaking into the world through the weapon layer.
// ============================================================================================
const msDir = path.join(ROOT, 'game/data/combat/movesets');
const movesets = fs.readdirSync(msDir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(msDir, f), 'utf8'))).filter((d) => d.weapon_id);
const procedural = movesets.filter((m) => /procedural|generated|randomis|randomiz/i.test(JSON.stringify(m)));
const floatingDamage = fs.existsSync(path.join(ROOT, 'game/src/ui'))
  ? fs.readdirSync(path.join(ROOT, 'game/src/ui')).filter((f) => /damage.?number|floating/i.test(f)) : [];
out.AR2 = {
  procedural_weapon_generation: procedural.map((m) => m.weapon_id),
  floating_damage_number_modules: floatingDamage,
  weapons_with_lore_in_description: movesets.filter((m) => (m.notes || '').length > 400).length,
  verdict: procedural.length === 0 && floatingDamage.length === 0 ? 'PASS' : 'INVESTIGATE',
};

// ============================================================================================
// AR-3 — is the material system a real seam crossing, driven?
// ============================================================================================
function hit(weapon, mat) {
  const a = new NodeArena({ data: loadCombatData(), loadout: { weapon } });
  const e = a.spawn('t', 'mat_' + mat, 0, 1.2, 180); a.lockOn('t');
  a.queueInputs([{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }]);
  const hp0 = e.hp; let rec = null;
  for (let i = 0; i < 200; i++) { a.step(); for (const x of a.drain()) if (x.kind === 'IMPACT' && !rec) rec = x; }
  return { dmg: +(hp0 - e.hp).toFixed(2), material: rec ? rec.material : null, hitstop: rec ? rec.hitstop_f : null, deflect: rec ? !!rec.deflected : null };
}
out.AR3 = {
  mace_vs_stone: hit('mce_bog_iron_mace', 'stone'),
  rapier_vs_stone: hit('tsw_bog_rapier', 'stone'),
  mace_vs_flesh: hit('mce_bog_iron_mace', 'flesh'),
  rapier_vs_flesh: hit('tsw_bog_rapier', 'flesh'),
  sword_vs_plant: hit('ssw_garrison_sword', 'plant'),
  enemies_declaring_material: fs.readdirSync(path.join(ROOT, 'game/data/combat/enemies'))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/combat/enemies', f), 'utf8')).material).length,
};
out.AR3.seam_sterile = !(out.AR3.mace_vs_stone.dmg > 0 && out.AR3.rapier_vs_stone.dmg === 0);

// ============================================================================================
// ARI — the animation reuse index, recomputed from the movesets, RI-WPN03 §C.
// ============================================================================================
const clipUse = new Map();      // clip -> Set(weapon)
const perWeaponClips = {};
for (const m of movesets) {
  const s = new Set();
  for (const [slot, v] of Object.entries(m.slots)) { if (v.anim) { s.add(v.anim); (clipUse.get(v.anim) || clipUse.set(v.anim, new Set()).get(v.anim)).add(m.weapon_id); } }
  perWeaponClips[m.weapon_id] = s;
}
const C = clipUse.size;
const S_total = movesets.reduce((a, m) => a + Object.keys(m.slots).length, 0);
const hist = {};
for (const [, ws] of clipUse) { const k = ws.size >= 5 ? '5+' : String(ws.size); hist[k] = (hist[k] || 0) + 1; }
const share = [...clipUse.values()].map((s) => s.size);
const UNQ = movesets.map((m) => [...perWeaponClips[m.weapon_id]].filter((c) => clipUse.get(c).size === 1).length);
out.ARI = {
  distinct_clips_C: C, total_slots_S: S_total, ARI: +(C / S_total).toFixed(4),
  bands: 'PASS 0.42..0.60, HARD FAIL <0.33, FAIL >0.60',
  clip_share_histogram: hist,
  max_share: Math.max(...share), share_over_4: share.filter((x) => x > 4).length,
  UNQ_mean: +(UNQ.reduce((a, b) => a + b, 0) / UNQ.length).toFixed(3),
  UNQ_min: Math.min(...UNQ), weapons_with_UNQ_0: UNQ.filter((x) => x === 0).length,
};

// ============================================================================================
// CFS — RI-WPN04's contextual fidelity. T1: a contextual slot must not be the standing light.
// ============================================================================================
const CTX = ['roll.r1', 'roll.r2', 'backstep.r1', 'run.r1', 'run.r2', 'jump.r1', 'jump.r2', 'plunge', 'guard.counter'];
let cells = 0, distinctClip = 0, distinctFrames = 0;
const fails = [];
for (const m of movesets) {
  const base = m.slots['r1.1'];
  if (!base) continue;
  for (const c of CTX) {
    const s = m.slots[c];
    if (!s) continue;
    cells++;
    const dc = s.anim !== base.anim;
    const df = !(s.startup_f === base.startup_f && s.active_f === base.active_f && s.recovery_f === base.recovery_f);
    if (dc) distinctClip++;
    if (df) distinctFrames++;
    if (!dc || !df) fails.push(`${m.weapon_id}/${c}${dc ? '' : ' same-clip'}${df ? '' : ' same-frames'}`);
  }
}
out.CFS = { cells, distinct_clip: distinctClip, distinct_frames: distinctFrames, CFS: +(Math.min(distinctClip, distinctFrames) / cells).toFixed(4), failures: fails.slice(0, 20), failure_count: fails.length };

// ============================================================================================
// TDV — two-hand divergence, RI-WPN06 M1: does `2h.<x>` differ from `<x>` in shape/arc/root?
// ============================================================================================
const tdv = [];
for (const m of movesets) {
  const pairs = Object.keys(m.slots).filter((k) => k.startsWith('2h.') && m.slots[k.slice(3)]);
  if (!pairs.length) { tdv.push({ w: m.weapon_id, TDV: 0, pairs: 0 }); continue; }
  let diff = 0;
  for (const k of pairs) {
    const a = m.slots[k], b = m.slots[k.slice(3)];
    if (a.anim !== b.anim || a.shape !== b.shape || Math.abs((a.arc_sweep_deg || 0) - (b.arc_sweep_deg || 0)) >= 10
      || Math.abs((a.root_dz_m || 0) - (b.root_dz_m || 0)) >= 0.10) diff++;
  }
  tdv.push({ w: m.weapon_id, TDV: +(diff / pairs.length).toFixed(3), pairs: pairs.length });
}
const tv = tdv.map((x) => x.TDV).sort((a, b) => a - b);
out.TDV = { median: tv[Math.floor(tv.length / 2)], min: tv[0], weapons_at_zero: tdv.filter((x) => x.TDV === 0).map((x) => x.w) };

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('AR-1', out.AR1.verdict, '| rng refs', out.AR1.rng_references_on_the_weapon_path.length,
  '| determinism', out.AR1.determinism_identical, '| distinct damage', out.AR1.distinct_damage_over_12_identical_hits);
console.log('AR-2', out.AR2.verdict, JSON.stringify(out.AR2).slice(0, 160));
console.log('AR-3 seam_sterile', out.AR3.seam_sterile, 'mace/stone', out.AR3.mace_vs_stone, 'rapier/stone', out.AR3.rapier_vs_stone);
console.log('ARI', out.ARI.ARI, 'C', out.ARI.distinct_clips_C, 'S', out.ARI.total_slots_S, 'hist', JSON.stringify(out.ARI.clip_share_histogram), 'UNQ mean', out.ARI.UNQ_mean, 'max_share', out.ARI.max_share);
console.log('CFS', out.CFS.CFS, `${out.CFS.distinct_clip}/${out.CFS.cells} distinct clip,`, `${out.CFS.distinct_frames}/${out.CFS.cells} distinct frames`, 'failures', out.CFS.failure_count);
console.log('TDV median', out.TDV.median, 'min', out.TDV.min, 'at zero', out.TDV.weapons_at_zero.length);

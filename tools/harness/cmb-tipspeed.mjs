#!/usr/bin/env node
// cmb-tipspeed.mjs — RI-CMB04 §B's `peak_tip_speed_mps` column, measured on EVERY clip the game
// can play, on EVERY frame of it.
//
// WHY. The round-3 verdict measured 39.57–45.22 m/s of peak tip speed against a declared 18.5,
// and the round-3 build did not see it, because there are TWO clip synthesis paths and the
// build's probe only sampled one:
//
//   path 1  `clips.json §archetypes` — hand-authored, solved by `tools/harness/anim-author.mjs`
//           against the declared column. Enemy attacks and the seven player spine baselines.
//   path 2  `game/src/combat/swing.js buildSwing()` from `game/data/weapons/clip-registry.json`
//           profiles — W1-10's 1,150 roster clips (`clip_garrison_r1_3` and friends). **No
//           solver constrains these and `cmb-probe` never samples them.** The chain links
//           (`r1.2`, `r1.3`, `r1.4`, `r1.5`) are in this path and are where the regression was.
//
// This tool walks BOTH, over every frame of every clip and not only the active window, because
// the column is a property of the WEAPON and a startup that whips the blade at 45 m/s is a
// weapon being swung at 45 m/s whatever the hitbox flag says.
//
// The speed is measured in the ATTACKER'S OWN FRAME: root translation is subtracted. A weapon's
// peak tip speed is how fast you can swing it; it is not raised by the fact that you are also
// running, and RI-CMB01/RI-CMB02 own root motion, not RI-CMB04. The world-space figure is
// reported alongside it because that is what governs SWEEP CONTINUITY (§sweep.substeps).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clip } from '../../game/src/combat/clips.js';
import { Rig } from '../../game/src/combat/skeleton.js';
import { MovesetLibrary } from '../../game/src/combat/moveset.js';
import { loadCombatData, GAME_DATA } from '../lib/combat-node.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const TOL = Number(arg('tolerance', 1.0));    // multiple of the declared column that still passes

const data = loadCombatData();
const rig = new Rig(data.skeleton, data.hitgeometry);
const CLASS_OF = data.hitgeometry.weapon_hitboxes;

/** Peak tip speed over every frame of a clip, local (root removed) and world. */
function peakOf(clip, sockA, sockB) {
  const pos = [0, 0, 0];
  let px = 0, py = 0, pzl = 0, pzw = 0, has = false;
  let local = 0, world = 0, localF = 0, worldF = 0, maxStep = 0;
  for (let f = 1; f <= clip.total; f++) {
    const z = clip.rootForwardAt(f);
    pos[2] = z;
    clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sockA, sockB);
    const b = rig.socketB;
    if (has) {
      const dl = Math.hypot(b[0] - px, b[1] - py, (b[2] - z) - pzl) * 60;
      const dw = Math.hypot(b[0] - px, b[1] - py, b[2] - pzw) * 60;
      if (dl > local) { local = dl; localF = f; }
      if (dw > world) { world = dw; worldF = f; }
      if (dw / 60 > maxStep) maxStep = dw / 60;
    }
    px = b[0]; py = b[1]; pzl = b[2] - z; pzw = b[2]; has = true;
  }
  return { local: +local.toFixed(2), world: +world.toFixed(2), localFrame: localF, worldFrame: worldF, max_step_m: +maxStep.toFixed(4) };
}

const rows = [];

// ---- path 1: clips.json archetypes, as instantiated by enemy attacks --------------------------
for (const id of Object.keys(data._enemies)) {
  const st = data._enemies[id];
  if (id === 'probe_pulse') continue;
  for (const k of Object.keys(st.attacks || {})) {
    const a = st.attacks[k];
    const m = { startup: a.startup, active: a.active, total: a.startup + a.active + a.recovery };
    const clip = new Clip(a.anim, data.clips.archetypes[a.archetype || 'cut_diagonal'], m, 1.0, a.root_dz_m || 0);
    const p = peakOf(clip, st.weapon.socket_a_dist_m, st.weapon.socket_b_dist_m);
    rows.push({ path: 'clips.json', owner: id, slot: k, clip: a.anim, declared: st.weapon.peak_tip_speed_mps_declared || null, ...p });
  }
}

// ---- path 2: swing.js / clip-registry, every roster weapon x every slot ------------------------
const lib = new MovesetLibrary(data.clipRegistry, data.weaponClasses, data.weaponMovesets, data.skeleton, data.hitgeometry);
const declaredFor = (cls) => {
  const key = String(cls || '').toLowerCase();
  const map = {
    dgr: 'dagger', ssw: 'straight_sword', spr: 'spear', axe: 'axe', hlb: 'halberd',
    gsw: 'greatsword', ugs: 'ultra_greatsword',
  };
  const hit = CLASS_OF[map[key] || key];
  return hit ? hit.peak_tip_speed_mps : null;
};
for (const wid of Object.keys(data.weaponMovesets)) {
  const doc = data.weaponMovesets[wid];
  const slots = Object.keys(doc.slots || doc.moves || {});
  for (const s of slots) {
    let clip, sock;
    try { clip = lib.clipFor(wid, s); sock = lib.socketsFor(wid, s); } catch (e) { continue; }
    if (!clip || !clip.total) continue;
    const p = peakOf(clip, sock.a, sock.b);
    const cls = (data.clipRegistry.clips[clip.id] && data.clipRegistry.clips[clip.id].class) || doc.class;
    rows.push({ path: 'swing.js', owner: wid, slot: s, clip: clip.id, declared: declaredFor(cls), ...p });
  }
}

for (const r of rows) r.ratio = r.declared ? +(r.local / r.declared).toFixed(3) : null;
const over = rows.filter((r) => r.declared && r.local > r.declared * TOL);
const worst = [...rows].filter((r) => r.ratio !== null).sort((a, b) => b.ratio - a.ratio);

const R = {
  schema: 'es-tipspeed/1', item: 'RI-CMB04 §B', tolerance: TOL,
  clips_measured: rows.length,
  by_path: {
    'clips.json': rows.filter((r) => r.path === 'clips.json').length,
    'swing.js': rows.filter((r) => r.path === 'swing.js').length,
  },
  over_declared: over.length,
  worst_20: worst.slice(0, 20),
  peak_local_mps: Math.max(...rows.map((r) => r.local)),
  peak_world_mps: Math.max(...rows.map((r) => r.world)),
  rows: argv.includes('--full') ? rows : undefined,
};
if (arg('out')) {
  fs.mkdirSync(path.dirname(String(arg('out'))), { recursive: true });
  fs.writeFileSync(String(arg('out')), JSON.stringify(R, null, 1) + '\n');
}

const L = [];
L.push(`cmb-tipspeed — RI-CMB04 §B peak_tip_speed_mps, EVERY frame of EVERY clip`);
L.push(`  clips measured: ${R.clips_measured}  (clips.json ${R.by_path['clips.json']}, swing.js ${R.by_path['swing.js']})`);
L.push(`  peak local (root removed): ${R.peak_local_mps} m/s     peak world: ${R.peak_world_mps} m/s`);
L.push(`  clips over their declared column: ${R.over_declared}`);
L.push('\n  WORST 20 BY RATIO');
L.push('    path        owner                      slot        clip                          local  declared  ratio  @f');
for (const r of R.worst_20) {
  L.push(`    ${r.path.padEnd(11)} ${String(r.owner).padEnd(26)} ${String(r.slot).padEnd(11)} ${String(r.clip).padEnd(29)} ${String(r.local).padStart(6)} ${String(r.declared).padStart(9)}  ${String(r.ratio).padStart(5)}  ${r.localFrame}`);
}
L.push('');
L.push(over.length === 0 ? '  ACCEPTANCE: pass — no clip exceeds its declared column on any frame'
  : `  ACCEPTANCE: FAIL — ${over.length} clips exceed their declared column`);
process.stdout.write(L.join('\n') + '\n');
process.exit(over.length === 0 ? 0 : 1);

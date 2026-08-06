// Blind pack GENERATED AT RUNTIME through setLoadout() + an input script, per WEAPON-CRITIC §6
// as amended (BAR-CRITIQUE-W1-10-R1 §R6). Carries per-frame MOTION ONLY: player position, yaw,
// weapon socket A/B world positions, target hp, and the input stream. No clip ids, no slot ids,
// no shape, no arc, no reach, no frame counts, no class, no weapon name, no damage numbers.
'use strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const DIR = '/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-10-r2';
const D = loadCombatData();

// A 20-second (1200 f) script exercising the five verbs the user named.
const script = [];
let f = 10;
const tap = (b) => { script.push({ f, press: [b] }, { f: f + 2, release: [b] }); f += 10; };
for (let i = 0; i < 4; i++) tap('light');            // chain
f += 40; tap('heavy');                                // heavy
f += 60; script.push({ f, press: ['heavy'] }, { f: f + 45, release: ['heavy'] }); f += 90;  // charged
script.push({ f, move: [0, 1] }, { f: f + 1, press: ['roll'] }, { f: f + 2, release: ['roll'] }); f += 32; tap('light'); f += 60;  // roll-attack
script.push({ f, move: [0, 0] }, { f: f + 1, press: ['roll'] }, { f: f + 2, release: ['roll'] }); f += 18; tap('light'); f += 60;  // backstep-attack
script.push({ f, move: [0, 1] }, { f, press: ['sprint'] }); f += 40; tap('light');
script.push({ f, release: ['sprint'] }); f += 60;
for (let i = 0; i < 3; i++) tap('light');

function trace(weapon) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  const e = a.spawn('t', 'dummy_passive', 0, 2.2, 180);
  a.lockOn('t');
  a.queueInputs(script);
  const rows = [];
  for (let i = 0; i < 1200; i++) {
    a.step();
    const b = a.player;
    rows.push([a.frame, +b.pos[0].toFixed(3), +b.pos[2].toFixed(3), +b.yaw.toFixed(3),
      +b.socketA[0].toFixed(3), +b.socketA[1].toFixed(3), +b.socketA[2].toFixed(3),
      +b.socketB[0].toFixed(3), +b.socketB[1].toFixed(3), +b.socketB[2].toFixed(3),
      +e.hp.toFixed(1)]);
  }
  return { columns: ['f', 'px', 'pz', 'yaw', 'ax', 'ay', 'az', 'bx', 'by', 'bz', 'target_hp'], input_script: script, rows };
}

// RI-WPN03 M6: 12 traces, 4 each from 3 classes.
const M6 = { GHM: ['ghm_bog_maul', 'ghm_kings_ruin', 'ghm_pile_driver', 'ghm_stone_breaker'],
             SPR: ['spr_drowned_harpoon', 'spr_fishers_gig', 'spr_mire_trident', 'spr_reed_gig'],
             TSW: ['tsw_bog_rapier', 'tsw_duelling_pick', 'tsw_oath_of_salt', 'tsw_reed_estoc'] };
// RI-WPN02: 3 traces from 3 classes.
const M2 = { A: 'csw_naga_sickle', B: 'hlb_garrison_bill', C: 'mce_bog_iron_mace' };

const items = [];
for (const [cls, ws] of Object.entries(M6)) for (const w of ws) items.push({ truth: { cls, w }, t: trace(w) });
// deterministic shuffle by hash so the label order carries no information
items.sort((a, b) => crypto.createHash('sha256').update(a.truth.w).digest('hex').localeCompare(crypto.createHash('sha256').update(b.truth.w).digest('hex')));
const key = {};
items.forEach((it, i) => { const id = 'T' + (i + 1); key[id] = it.truth; fs.writeFileSync(`${DIR}/blind-m6-${id}.json`, JSON.stringify({ id, ...it.t })); });
const three = [];
for (const [lbl, w] of Object.entries(M2)) { three.push({ lbl, w }); fs.writeFileSync(`${DIR}/blind-m2-${lbl}.json`, JSON.stringify({ id: lbl, ...trace(w) })); }
fs.writeFileSync(`${DIR}/blind-KEY-SEALED.json`, JSON.stringify({ warning: 'do not read before recording picks', m6: key, m2: three }, null, 1));
console.log('generated', Object.keys(key).length, 'M6 traces and', three.length, 'M2 traces — motion columns only:', items[0].t.columns.join(','));

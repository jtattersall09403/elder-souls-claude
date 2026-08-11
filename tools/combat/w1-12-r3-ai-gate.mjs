#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NodeArena, loadCombatData } from '../lib/combat-node.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'reports/w1-12-r3/ai-gate.json');
const IDS = ['inf_trash', 'guard_legion', 'drowned_lesser', 'drowned_greater',
  'beast_slitherfang', 'champion_hist_marked', 'cst_sap_speaker'];
const DURATIONS = [1800, 3600, 5400];

function omega(data, id) {
  const s = data._enemies[id];
  const a = data.ai.behaviour_archetype[id] || s.archetype;
  return s.reach_m || data.ai.archetype[a].omega_m;
}

function run(data, id, range, frames) {
  const arena = new NodeArena({ data, seed: 1337 });
  const b = arena.spawn('enemy', id, 0, range, 180);
  const ctl = arena.cs.enemies.get('enemy');
  const O = omega(data, id), strike = 0.85 * O;
  const ds = [], states = new Map(); let near = 0, denominator = 0;
  for (let f = 0; f < frames; f++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO'; arena.step();
    const state = ctl.ai.state;
    const d = Math.hypot(b.pos[0] - arena.player.pos[0], b.pos[2] - arena.player.pos[2]);
    ds.push(d); states.set(state, (states.get(state) || 0) + 1);
    if (state !== 'COMMIT') { denominator++; if (d < strike) near++; }
  }
  const mean = ds.reduce((a, n) => a + n, 0) / ds.length;
  const variance = Math.sqrt(ds.reduce((a, n) => a + (n - mean) ** 2, 0) / ds.length);
  const entropy = [...states.values()].reduce((h, n) => { const p = n / frames; return h - p * Math.log2(p); }, 0);
  return { statblock: id, start_range_m: range, frames, numerator: near, denominator,
    min_dist_dwell: +(near / denominator).toFixed(4), spacing_variance_m: +variance.toFixed(4),
    state_entropy_bits: +entropy.toFixed(4), state_histogram: Object.fromEntries(states),
    pass: near / denominator <= 0.10 && variance >= 0.8 && entropy >= 1.5 };
}

const data = loadCombatData();
const rows = [];
for (const frames of DURATIONS) for (const id of IDS) rows.push(run(data, id, 5 * omega(data, id), frames));

// Rule 6: removing the new recovery locomotion must materially worsen the native result.
const deleted = structuredClone(data); deleted.ai.movement.recover_retreat_mps = 0;
const shippedControl = run(data, 'inf_trash', 12, 3600);
const deletedControl = run(deleted, 'inf_trash', 12, 3600);
// RI-MTH07: both sides of a live leaf perturbation must change an entity trajectory.
const low = structuredClone(data), high = structuredClone(data);
low.ai.movement.recover_retreat_mps *= 0.5; high.ai.movement.recover_retreat_mps *= 2;
const consumption = { half: run(low, 'inf_trash', 12, 3600), shipped: shippedControl,
  doubled: run(high, 'inf_trash', 12, 3600) };
const controlsPass = deletedControl.min_dist_dwell > shippedControl.min_dist_dwell
  && consumption.half.min_dist_dwell !== consumption.doubled.min_dist_dwell;
const result = { schema: 'elder-souls/w1-12-r3-ai-gate@1',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() !== '',
  fixture: { player: 'stationary, never attacks', seed: 1337, durations_f_at_60: DURATIONS,
    start_range: '5.0*omega (RI-AI01 initial RUSH band; the item specifies no multi-range M3 population)' },
  rows, controls: { deleted_recovery_retreat: deletedControl, consumption }, controls_pass: controlsPass,
  failures: rows.filter(r => !r.pass) };
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`M3 ${rows.length - result.failures.length}/${rows.length}; controls ${controlsPass ? 'PASS' : 'FAIL'}; wrote ${path.relative(ROOT, OUT)}`);
if (result.failures.length || !controlsPass) process.exitCode = 1;

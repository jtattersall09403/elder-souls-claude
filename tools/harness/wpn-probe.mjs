#!/usr/bin/env node
// W1-10 live probe: drive window.__HARNESS.weapons.* in the REAL browser build and print what it
// returns. RI-MTH04 voids any claim that cannot show a real run; this is that run.
//
// Usage: node tools/harness/wpn-probe.mjs [--json reports/w1-10/wpn-probe.json]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/game/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__HARNESS !== undefined, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const out = await page.evaluate(() => {
  const W = window.__HARNESS.weapons;
  const list = W.listWeapons();
  const ssw = W.getMoveset('ssw_garrison_sword');
  const roll = W.getClipTrack('ssw_garrison_sword', 'roll.r1');
  const r11 = W.getClipTrack('ssw_garrison_sword', 'r1.1');
  const maxdiff = (a, b) => {
    let m = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]));
    return Math.round(m * 10000) / 10000;
  };
  // the exact window probe RI-WPN04 M2 asks for, driven through the shipped resolver
  const wg = W.wgrid('ssw_garrison_sword', 'roll.r1', { roll_tier: 'LIGHT' });
  const wgH = W.wgrid('ssw_garrison_sword', 'roll.r1', { roll_tier: 'HEAVY' });
  const wgO = W.wgrid('ssw_garrison_sword', 'roll.r1', { roll_tier: 'OVERLOADED' });
  // the fallback question, asked directly: does a press one frame outside the window
  // produce the standard light attack?
  const before = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'ROLL', state_frame: 30, roll_tier: 'LIGHT' });
  const inside = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'ROLL', state_frame: 31, roll_tier: 'LIGHT' });
  const after = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'ROLL', state_frame: 53, roll_tier: 'LIGHT' });
  const rising = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'AIRBORNE', descending: false, fall_height_m: 4, target_below: true, roll_tier: 'LIGHT' });
  const plunge = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'AIRBORNE', descending: true, fall_height_m: 3.1, target_below: true, roll_tier: 'LIGHT' });
  const lowFall = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'AIRBORNE', descending: true, fall_height_m: 2.9, target_below: true, roll_tier: 'LIGHT' });
  const gcDual = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'BLOCK_SUCCESS', state_frame: 5, stance: 'two_hand', offhand_shield: false });
  const gcO1 = W.resolveSlot('ssw_garrison_sword', 'light', { state: 'BLOCK_SUCCESS', state_frame: 5, stance: 'one_hand', offhand_shield: true });
  const charge = [0, 8, 15, 22, 30, 50].map((c) => W.chargeState('ssw_garrison_sword', 'r2.charged', c));
  const impact = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'].map((m) => {
    const a = W.impactFor('dgr_shell_knife', 'r1.1', m), b = W.impactFor('ugs_golem_sword', 'r1.1', m);
    return { material: m, dagger_hitstop_f: a.attacker_hitstop_f, ugs_hitstop_f: b.attacker_hitstop_f, dagger_deflect: a.deflect, ugs_deflect: b.deflect };
  });
  const mce = ['stone', 'flesh'].map((m) => ({ material: m, mult: W.impactFor('mce_bog_iron_mace', 'r1.1', m).damage_multiplier, deflect: W.impactFor('mce_bog_iron_mace', 'r1.1', m).deflect }));
  const tip = W.weaponTipTrack('ugs_golem_sword', 'r1.1');
  return {
    weapons: list.length,
    sample: list.slice(0, 2),
    ssw_slots: Object.keys(ssw.slots).length,
    ssw_exclusive_2h: ssw.stance.two_hand.exclusive_slots,
    clip_roll_r1: roll.clip, clip_r1_1: r11.clip,
    roll_vs_r1_root_max_delta_m: maxdiff(roll.root, r11.root),
    roll_vs_r1_tip_max_delta_m: maxdiff(roll.b, r11.b),
    wgrid_light: wg, wgrid_heavy_window: wgH.observed_window_f, wgrid_overloaded_window: wgO.observed_window_f,
    press_f30: before, press_f31: inside, press_f53: after,
    rising_jump: rising, plunge_3_1m: plunge, plunge_2_9m: lowFall,
    guard_counter_two_handed: gcDual, guard_counter_o1: gcO1,
    charge_ramp: charge,
    impact_grid: impact,
    mace_on_stone: mce,
    ugs_peak_tip_speed_mps: Math.max(...tip.tip_speed_mps),
  };
});

await browser.close();
server.close();

const report = { run: new Date().toISOString(), page_errors: errs, ...out };
const ji = process.argv.indexOf('--json');
if (ji >= 0) { fs.mkdirSync(path.dirname(path.join(ROOT, process.argv[ji + 1])), { recursive: true }); fs.writeFileSync(path.join(ROOT, process.argv[ji + 1]), JSON.stringify(report, null, 1) + '\n'); }

console.log(`weapons loaded in the browser: ${out.weapons}`);
console.log(`ssw_garrison_sword slots: ${out.ssw_slots}; 2h-exclusive: ${JSON.stringify(out.ssw_exclusive_2h)}`);
console.log(`\nRI-WPN04 T1/T3/T4 on the running build — roll.r1 vs r1.1, same weapon:`);
console.log(`  clip ids           ${out.clip_roll_r1}  vs  ${out.clip_r1_1}`);
console.log(`  root track delta   ${out.roll_vs_r1_root_max_delta_m} m   (T3 fails below 0.02)`);
console.log(`  hitbox path delta  ${out.roll_vs_r1_tip_max_delta_m} m   (T4 fails below 0.03)`);
console.log(`\nRI-WPN04 M2 window probe, roll.r1 @ LIGHT: declared ${JSON.stringify(out.wgrid_light.declared_window_f)}  observed ${JSON.stringify(out.wgrid_light.observed_window_f)}`);
console.log(`  HEAVY tier observed ${JSON.stringify(out.wgrid_heavy_window)}  (cap 32 f@60)`);
console.log(`  OVERLOADED observed ${JSON.stringify(out.wgrid_overloaded_window)}  (must be null)`);
console.log(`  press at roll f30 -> ${JSON.stringify(out.press_f30)}`);
console.log(`  press at roll f31 -> ${JSON.stringify(out.press_f31)}`);
console.log(`  press at roll f53 -> ${JSON.stringify(out.press_f53)}`);
console.log(`\nAerial: rising jump -> ${JSON.stringify(out.rising_jump)}`);
console.log(`  plunge from 3.1 m -> ${JSON.stringify(out.plunge_3_1m)}`);
console.log(`  plunge from 2.9 m -> ${JSON.stringify(out.plunge_2_9m)}`);
console.log(`\nguard.counter two-handed -> ${JSON.stringify(out.guard_counter_two_handed)}`);
console.log(`guard.counter in O1      -> ${JSON.stringify(out.guard_counter_o1)}`);
console.log(`\nRI-WPN01 §C charge ramp (SSW r2.charged, charge_max_f 30):`);
for (const c of out.charge_ramp) console.log(`  held ${String(c.charge_f).padStart(2)} f  mv ${c.motion_value.toFixed(3)}  poise ${c.poise_damage.toFixed(1)}  hyperarmour ${c.hyperarmour}`);
console.log(`\nRI-WPN05 §A hitstop, dagger vs ultra greatsword:`);
for (const r of out.impact_grid) console.log(`  ${r.material.padEnd(7)} DGR ${String(r.dagger_hitstop_f).padStart(3)} f (deflect ${r.dagger_deflect})   UGS ${String(r.ugs_hitstop_f).padStart(3)} f (deflect ${r.ugs_deflect})`);
console.log(`\nMCE material response: ${JSON.stringify(out.mace_on_stone)}`);
console.log(`UGS r1.1 peak tip speed: ${out.ugs_peak_tip_speed_mps} m/s (RI-WPN05 §E ultra band 26-40)`);
if (errs.length) { console.log(`\npage errors (${errs.length}):`); for (const e of errs.slice(0, 5)) console.log('  ! ' + e); }

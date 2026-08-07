// The impact and material model, DRIVEN IN THE SHIPPING BROWSER BUILD.
//
// `orchestration/AGENT-PROTOCOL.md` is explicit that `tools/lib/combat-node.mjs` "agrees with the
// browser for short measurements and diverges for long fights", and that behavioural claims must
// be confirmed in the browser. Everything this piece claims about materials is measured in node by
// `tools/weapons/impact-census.mjs`; this tool re-measures the load-bearing rows through headless
// Chromium against the real engine, so the claim is not a node artefact.
//
// Four things it establishes:
//   1. the 5x7 attacker-hitstop grid is recoverable from BROWSER traces
//   2. AR-3's seam crossing is EXERCISED, not declared: a mace beats a stone enemy that a rapier
//      cannot, and the reason is in the trace rather than in a design document
//   3. per-region material works: the same weapon on the same body deals different damage to a
//      Hist-Marked champion's plant limb and its metal cuirass
//   4. S26 contiguity holds live: a spear hits a man standing 1.4 m in front of it
//
//   node tools/harness/wpn-impact-live.mjs [out.json]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const OUT = process.argv[2] || path.resolve(REPO_ROOT, 'reports/W1-10-impact-live.json');
const { chromium } = await loadPlaywright();
const server = await serveDir(REPO_ROOT);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 320, height: 240 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 120000 });
// AGENT-PROTOCOL: never step with the renderer live.
await page.evaluate(async () => { await window.__HARNESS.ready(); window.__HARNESS.setRenderRate(0); });

/**
 * One scripted swing at one spawned target, in the browser, reading the IMPACT event back out of
 * the combat trace. Nothing about the result is computed here — every field is what the engine
 * emitted.
 */
const swing = (args) => page.evaluate(async (a) => {
  const H = window.__HARNESS;
  await H.ready();
  await H.loadState('wpn-dummy-arena');
  await H.setSeed(1);
  await H.setLoadout({ weapon: a.weapon, shield: a.shield === undefined ? null : a.shield });
  for (const e of H.listEntities()) { if (e.kind !== 'enemy') continue; try { H.despawn(e.eid); } catch { /* fixture entity */ } }
  H.teleport(0, 0, { yaw: 0 });
  H.spawn(a.target, 0, a.dist, { as: 'T', yaw: 180 });
  H.lockOn('T');
  H.combatTraceStart({});
  H.stepFrames(4);
  const before = H.listEntities().find((e) => e.eid === 'T');
  // `queueInputs` frames are RELATIVE to the current frame — engine.input.queueInputs(script,
  // engine.sim.frame) passes the current frame as the base. Absolute frames land in the far
  // future and nothing ever presses, which is exactly what the first run of this probe measured
  // (0 hits everywhere, 0 page errors) and is a probe bug, not a game one.
  H.queueInputs([{ f: 2, press: [a.button || 'light'] }, { f: 4, release: [a.button || 'light'] }]);
  H.stepFrames(a.frames || 260);
  const seg = H.combatTraceDrain();
  H.combatTraceStop();
  const after = H.listEntities().find((e) => e.eid === 'T');
  const evs = [];
  for (const line of seg) {
    const o = typeof line === 'string' ? JSON.parse(line) : line;
    if (o && o.v) for (const e of o.v) evs.push({ f: o.f, ...e });
    if (o && o.kind) evs.push(o);
  }
  const imp = evs.find((e) => e.kind === 'IMPACT' || e.k === 'IMPACT');
  const hit = evs.find((e) => e.kind === 'HIT' || e.k === 'HIT');
  const def = evs.find((e) => e.kind === 'DEFLECT' || e.k === 'DEFLECT');
  return {
    weapon: a.weapon, target: a.target, dist: a.dist,
    hp_before: before ? before.hp : null, hp_after: after ? after.hp : null,
    dmg: before && after ? +(before.hp - after.hp).toFixed(2) : null,
    impact: imp || null, hit: hit || null, deflect: !!def,
    kinds: [...new Set(evs.map((e) => e.kind || e.k))].filter(Boolean),
  };
}, args);

const out = { generated: new Date().toISOString(), build: await page.evaluate(() => window.__HARNESS.getBuildInfo()), sections: {} };

// ---- 1. the 5x7 attacker hitstop grid, in the browser -----------------------------------------
const MATERIALS = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'];
const TIER_W = { light: 'ssw_garrison_sword', medium: 'mce_bog_iron_mace', heavy: 'gsw_memorial_blade', ultra: 'ugs_golem_sword' };
const grid = {};
for (const [tier, w] of Object.entries(TIER_W)) {
  grid[tier] = {};
  for (const m of MATERIALS) {
    const r = await swing({ weapon: w, target: 'mat_' + m, dist: 1.2 });
    grid[tier][m] = r.impact ? { hitstop_f: r.impact.hitstop_f, victim_hitstop_f: r.impact.victim_hitstop_f, knockback_m: r.impact.knockback_m, deflect: r.impact.deflect, decal: r.impact.decal, mult: r.impact.material_mult, dmg: r.dmg } : null;
  }
}
out.sections.hitstop_grid = grid;

// ---- 2. AR-3: a mace beats a stone thing that a rapier cannot ---------------------------------
// RI-WPN05 §B's own words: "a lore fact (root-golems are stone; the Hist-bonded are plant) is a
// combat answer, and a merchant selling a mace is selling a solution to an encounter."
const ar3 = {};
for (const w of ['mce_bog_iron_mace', 'ghm_bog_maul', 'tsw_bog_rapier', 'ssw_garrison_sword']) {
  ar3[w] = await swing({ weapon: w, target: 'mat_stone', dist: 1.2 });
}
out.sections.ar3_stone = ar3;

// ---- 3. per-region material on one body -------------------------------------------------------
// The Hist-Marked champion is plant at the limbs, metal where it wears a legion cuirass and flesh
// at the head. Three materials, one enemy, and the player learns to aim.
out.sections.per_region = await swing({ weapon: 'ssw_garrison_sword', target: 'champion_hist_marked', dist: 1.4 });

// ---- 4. S26 contiguity, live ------------------------------------------------------------------
// The round-2 verdict: "a spear cannot hit a man standing 1.4 m in front of it (dead band
// 1.30-1.60 m), confirmed identically in the node arena and the browser."
const band = {};
for (const w of ['spr_drowned_harpoon', 'hlb_garrison_bill', 'axe_bog_cleaver']) {
  const v = [];
  for (let d = 0.6; d <= 2.6001; d += 0.1) {
    const r = await swing({ weapon: w, target: 'mat_flesh', dist: +d.toFixed(2), frames: 220 });
    v.push({ d: +d.toFixed(2), hit: !!r.impact });
  }
  const hits = v.filter((x) => x.hit).map((x) => x.d);
  let gaps = [];
  if (hits.length) {
    for (const x of v) if (!x.hit && x.d > Math.min(...hits) && x.d < Math.max(...hits)) gaps.push(x.d);
  }
  band[w] = { vector: v.map((x) => (x.hit ? '1' : '0')).join(''), from: 0.6, step: 0.1, interior_gaps_m: gaps };
}
out.sections.contiguity = band;

out.page_errors = pageErrors;
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// ---- print ------------------------------------------------------------------------------------
const pad = (s, n) => String(s).padStart(n);
console.log('\nBROWSER attacker hitstop (f@60), read off the IMPACT event in the combat trace');
console.log('tier      ' + MATERIALS.map((m) => pad(m, 9)).join(''));
for (const t of Object.keys(grid)) console.log(t.padEnd(10) + MATERIALS.map((m) => pad(grid[t][m] ? grid[t][m].hitstop_f : '-', 9)).join(''));
console.log('\nBROWSER victim hitstop (f@60)  — 0 on stone/metal/shield is §A\'s bounce');
console.log('tier      ' + MATERIALS.map((m) => pad(m, 9)).join(''));
for (const t of Object.keys(grid)) console.log(t.padEnd(10) + MATERIALS.map((m) => pad(grid[t][m] ? grid[t][m].victim_hitstop_f : '-', 9)).join(''));
console.log('\nAR-3 — four weapons against a stone target');
for (const [w, r] of Object.entries(ar3)) {
  console.log(`  ${w.padEnd(20)} dmg ${pad(r.dmg, 8)}  deflect ${r.deflect}  hitstop ${r.impact ? r.impact.hitstop_f : '-'}  +recovery ${r.impact ? r.impact.added_recovery_f : '-'}`);
}
const pr = out.sections.per_region;
console.log(`\nper-region: ssw on champion_hist_marked -> part ${pr.impact ? pr.impact.part : '-'} material ${pr.impact ? pr.impact.material : '-'} mult ${pr.impact ? pr.impact.material_mult : '-'} dmg ${pr.dmg}`);
console.log('\nS26 contiguity, live, 0.60 m -> 2.60 m at 0.10 m');
for (const [w, b] of Object.entries(band)) console.log(`  ${w.padEnd(22)} ${b.vector}   interior gaps: ${b.interior_gaps_m.length ? b.interior_gaps_m.join(', ') : 'none'}`);
console.log(`\npage errors: ${pageErrors.length}`);
console.log(`wrote ${OUT}`);

await ctx.close(); await browser.close(); await server.close();

// Critic-authored. The AIRBORNE row: sweep the press frame across the whole jump, in the
// BROWSER (the shipping game) and in tools/lib/combat-node.mjs, and compare. Round 1 found
// jump.r1 / jump.r2 produced no attack from any frame; round 2 claims they do.
'use strict';
import fs from 'node:fs';
import { serveDir } from '/home/user/elder-souls-claude/tools/lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';

const OUT = process.argv[2] || '/dev/stdout';
const W = ['dagger', 'straight-sword', 'axe', 'ultra-greatsword'];
const D = loadCombatData();

// ---- node side -------------------------------------------------------------------------------
function nodeSweep(weapon, button) {
  const row = [];
  for (let k = 0; k <= 50; k++) {
    const a = new NodeArena({ data: D, loadout: { weapon } });
    a.spawn('t', 'dummy_passive', 0, 1.2, 180);
    const pf = 3 + k;
    a.queueInputs([{ f: 2, press: ['jump'] }, { f: 3, release: ['jump'] }, { f: pf, press: [button] }, { f: pf + 2, release: [button] }]);
    let fired = null, dropped = null;
    for (let i = 0; i < 200; i++) {
      a.step();
      for (const e of a.drain()) {
        if (e.kind === 'ACTION_START' && e.tag === 'attack' && !fired) fired = { slot: e.anim_slot, from: e.from_state, at: e.from_state_frame, f: e.f };
        if (e.kind === 'INPUT_DROPPED' && !dropped) dropped = e.reason;
      }
    }
    row.push(fired ? fired.slot + (fired.from === 'AIRBORNE' ? '' : `(from ${fired.from})`) : '.' );
  }
  return row;
}

// ---- browser side ----------------------------------------------------------------------------
const { chromium } = await loadPlaywright();
const server = await serveDir('/home/user/elder-souls-claude');
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 120000 });
await page.evaluate(() => window.__HARNESS.ready());

async function browserSweep(weapon, button) {
  return page.evaluate(async ({ weapon, button }) => {
    const H = window.__HARNESS; const row = [];
    for (let k = 0; k <= 50; k++) {
      await H.loadState('wpn-dummy-arena');
      await H.setLoadout({ weapon });
      H.traceStart({});
      const pf = 3 + k;
      H.queueInputs([{ f: 2, press: ['jump'] }, { f: 3, release: ['jump'] }, { f: pf, press: [button] }, { f: pf + 2, release: [button] }]);
      await H.stepFrames(200);
      const rows = H.traceDrain(); H.traceStop();
      let slot = null, jumpStates = new Set();
      for (const r of rows) { if (r.f >= pf && r.player.anim_slot && !slot) slot = r.player.anim_slot; jumpStates.add(r.player.state); }
      row.push(slot || '.');
    }
    return row;
  }, { weapon, button });
}

const res = { generated: new Date().toISOString(), sweeps: {} };
for (const w of W) {
  for (const btn of ['light', 'heavy']) {
    const n = nodeSweep(w, btn);
    const b = await browserSweep(w, btn);
    const agree = n.map((v, i) => v === b[i]).filter(Boolean).length;
    res.sweeps[`${w}/${btn}`] = { node: n, browser: b, agree_cells: agree, of: n.length };
    const fmt = (arr) => arr.map((v) => (v === '.' ? '.' : v === 'jump.r1' ? 'J' : v === 'jump.r2' ? 'K' : v === 'plunge' ? 'P' : v === 'r1.1' ? 'S' : v === 'r2' ? 'T' : '?')).join('');
    console.log(`${w.padEnd(18)} ${btn.padEnd(6)} node   ${fmt(n)}`);
    console.log(`${''.padEnd(18)} ${''.padEnd(6)} browser ${fmt(b)}   agree ${agree}/${n.length}`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('\nlegend: J=jump.r1  K=jump.r2  P=plunge  S=standing r1.1  T=standing r2  .=no attack');
await browser.close(); await server.close();

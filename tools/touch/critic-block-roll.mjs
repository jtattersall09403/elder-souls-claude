#!/usr/bin/env node
// critic-block-roll.mjs — W1-TOUCH critic. The two reds `--leg fight` left, taken apart.
//
//  C-BLOCK  a finger HELD on the 'block' control never raised the guard across 98 samples.
//           `combat/player.js:975` reads `input.held & BIT.block`, so the question is whether a
//           held TOUCH control writes the HELD bit or only a down EDGE. A tapped control and a
//           held control are different mechanisms and a Souls fight leans on the second.
//
//  C-ROLL   a short tap on the roll control produced `backstep`, not a roll. That is very likely
//           CORRECT — a dodge with no direction is a backstep in both source games — and my first
//           check was simply too strict. RULES 8: a still target hides every steering defect, and
//           a dodge with no stick input is a still target. So: roll again WITH the stick pushed.
//
// Both are measured against the DESKTOP arm in the same page, so "touch cannot" is never confused
// with "this build does not".
'use strict';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const SERVE_ROOT = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');
const rec = { schema: 'elder-souls/critic-block-roll@1', checks: {} };
const pass = (id, what, d) => { rec.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { rec.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };

const server = await serveDir(SERVE_ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
await page.goto(server.origin + '/game/index.html?state=arena_duel', { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
await page.evaluate(() => window.__HARNESS.ready());
const cdp = await ctx.newCDPSession(page);

class Finger {
  constructor(c) { this.c = c; this.p = new Map(); }
  l() { return [...this.p.values()].map((q) => ({ x: q.x, y: q.y, id: q.id, radiusX: 12, radiusY: 12, force: 1 })); }
  async down(id, x, y) { this.p.set(id, { id, x, y }); await this.c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.l() }); }
  async move(id, x, y) { const q = this.p.get(id); if (!q) return; q.x = x; q.y = y; await this.c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this.l() }); }
  async up(id) { this.p.delete(id); await this.c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.l() }); }
}
const F = new Finger(cdp);
const lay = () => page.evaluate(() => window.__HARNESS.touchLayout());
const at = (l, a) => l.find((c) => c.action === a);

// Title down, with a finger.
{
  const l = await lay(); const ic = at(l, 'interact');
  await F.down(9, ic.x, ic.y); await page.waitForTimeout(110); await F.up(9);
  await page.waitForTimeout(2500);
}
const shown = await page.evaluate(() => !!(window.__ENGINE.renderer.title && window.__ENGINE.renderer.title.shown));
say(`title down: ${!shown}`);
if (shown) { say('FATAL: title still up'); process.exit(2); }

// ---- 1. Does a held finger write the HELD BIT? -------------------------------------------------
const L = await lay();
const bc = at(L, 'block');
say(`\n--- C-BLOCK-HELDBIT: a finger held on 'block' at (${Math.round(bc.x)},${Math.round(bc.y)}) ---`);
await F.down(7, bc.x, bc.y);
const held = [];
for (let i = 0; i < 25; i++) {
  held.push(await page.evaluate(() => {
    const e = window.__ENGINE;
    const t = e.real.touch;
    const c = window.__HARNESS.getCombatState();
    return {
      f: c.frame,
      touch_held: [...t.held.keys()],
      pipe_held_raw: e.input && e.input.held !== undefined ? e.input.held : null,
      latched_held: e.sim.input ? e.sim.input.held : null,
      guard: !!c.player.guard, st: c.player.state, mv: c.player.move ? c.player.move.id : null,
      two_handed: !!c.player.two_handed, exhausted: !!c.player.exhausted, shield: c.player.shield, sta: c.player.stamina,
    };
  }));
  await page.waitForTimeout(80);
}
await F.up(7);
const anyGuard = held.filter((h) => h.guard).length;
const sawTouchHeld = held.filter((h) => h.touch_held.includes('block')).length;
const last = held[held.length - 1];
rec.block = { samples: held.length, guard_samples: anyGuard, touch_held_samples: sawTouchHeld, two_handed: last.two_handed, exhausted: last.exhausted, shield: last.shield, states: [...new Set(held.map((h) => h.st))], latched_held_seen: [...new Set(held.map((h) => h.latched_held))], trail: held.slice(0, 8) };
say(`  TouchInput.held contains 'block' on ${sawTouchHeld}/${held.length} samples`);
say(`  latched input.held values seen: ${JSON.stringify(rec.block.latched_held_seen)}`);
say(`  guardRaised on ${anyGuard}/${held.length};  two_handed=${last.two_handed} exhausted=${last.exhausted} shield=${JSON.stringify(last.shield)}`);
say(`  player states: ${JSON.stringify(rec.block.states)}`);

// ---- 2. The DESKTOP arm for block, same page, same body ----------------------------------------
say(`\n--- C-BLOCK-DESKTOP: KeyF (the keyboard binding for block) held in the same page ---`);
await page.keyboard.down('KeyF');
const kb = [];
for (let i = 0; i < 15; i++) {
  kb.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { guard: !!c.player.guard, st: c.player.state }; }));
  await page.waitForTimeout(80);
}
await page.keyboard.up('KeyF');
const kbGuard = kb.filter((h) => h.guard).length;
rec.block_desktop = { samples: kb.length, guard_samples: kbGuard, states: [...new Set(kb.map((h) => h.st))] };
say(`  guardRaised on ${kbGuard}/${kb.length} keyboard samples; states ${JSON.stringify(rec.block_desktop.states)}`);

if (anyGuard > 0) pass('C-BLOCK', `a held finger on 'block' raises the guard on ${anyGuard}/${held.length} samples`, rec.block);
else if (kbGuard > 0) fail('C-BLOCK', `THE GUARD IS A DESKTOP-ONLY VERB. A finger held on the 'block' control shows up in TouchInput.held on ${sawTouchHeld}/${held.length} samples and NEVER raises the guard, while KeyF held in the SAME page and the SAME body raises it on ${kbGuard}/${kb.length}. Block is the verb a Souls fight is built on and it does not reach the touchscreen.`, { touch: rec.block, desktop: rec.block_desktop });
else fail('C-BLOCK-INCONCLUSIVE', `neither the finger (${anyGuard}/${held.length}) nor the keyboard (${kbGuard}/${kb.length}) raised the guard, so this fixture cannot tell a touch defect from a build in which the guard is refused for some third reason (two_handed=${last.two_handed} exhausted=${last.exhausted} shield=${JSON.stringify(last.shield)}). Reported as inconclusive rather than as a finding.`, { touch: rec.block, desktop: rec.block_desktop });

// ---- 3. The roll, WITH A DIRECTION (RULES 8) ---------------------------------------------------
say(`\n--- C-ROLL-DIRECTED: the stick pushed, THEN a tap on roll ---`);
const rc = at(L, 'roll');
const origin = { x: 160, y: 260 };
await F.down(1, origin.x, origin.y); await page.waitForTimeout(40);
await F.move(1, origin.x + 80, origin.y - 40);       // a real direction on the stick
await page.waitForTimeout(400);
await F.down(8, rc.x, rc.y); await page.waitForTimeout(70); await F.up(8);
const roll = [];
for (let i = 0; i < 45; i++) {
  roll.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { f: c.frame, st: c.player.state, mv: c.player.move ? c.player.move.id : null, inv: !!c.player.invuln, sta: Math.round(c.player.stamina * 10) / 10 }; }));
  await page.waitForTimeout(35);
}
await F.up(1);
const moves = [...new Set(roll.map((r) => r.mv).filter(Boolean))];
const invN = roll.filter((r) => r.inv).length;
rec.roll_directed = { moves, invuln_samples: invN, samples: roll.length, states: [...new Set(roll.map((r) => r.st))], sta_start: roll[0].sta, sta_min: Math.min(...roll.map((r) => r.sta)) };
say(`  moves: ${JSON.stringify(moves)}  invuln ${invN}/${roll.length}  stamina ${rec.roll_directed.sta_start} -> ${rec.roll_directed.sta_min}`);
if (moves.some((m) => /roll/i.test(m))) pass('C-ROLL', `with the stick pushed, the same 70 ms tap on the shared roll/sprint control ROLLS (${JSON.stringify(moves)}) with ${invN}/${roll.length} invulnerable samples. The earlier 'backstep' was correct Souls behaviour for a dodge with no direction, and my first check was the thing that was wrong.`, rec.roll_directed);
else if (moves.some((m) => /backstep/i.test(m))) fail('C-ROLL', `even with the stick pushed to a real deflection the dodge is still a ${JSON.stringify(moves)} — the direction the finger is holding does not reach the dodge`, rec.roll_directed);
else fail('C-ROLL', `no dodge came out at all with the stick pushed: ${JSON.stringify(moves)}`, rec.roll_directed);

// ---- 4. And does the guard, if it comes up, actually EAT a hit? ---------------------------------
writeJson(path.join(OUT, 'critic-block-roll.json'), rec);
say(`\nartifact reports/critic-w1-touch/critic-block-roll.json`);
await ctx.close(); await browser.close(); await server.close();

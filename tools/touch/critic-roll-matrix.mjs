#!/usr/bin/env node
// critic-roll-matrix.mjs — W1-TOUCH critic. Why does the dodge vanish when the stick is held?
//
// `--leg fight` tapped 'roll' with no stick and got `backstep` (correct: a dodge with no direction
// is a backstep in both source games). `critic-block-roll.mjs` pushed the stick first, tapped the
// same control the same way, and got NOTHING AT ALL — no move, no stamina spent, state RUN then
// IDLE. Rolling out of a run is the single most-used verb in a Souls fight, so if a finger cannot
// do it the platform claim collapses.
//
// Four arms, one page, one body. The point is to separate three explanations that all look the
// same from outside:
//
//   A  touch roll, NO stick          — the known-good baseline (backstep)
//   B  touch roll, stick HELD        — the failure under test
//   C  DESKTOP roll (Space), stick held BY THE FINGER — if this rolls, the movement is fine and
//                                      the defect is in the touch button; if it also does nothing,
//                                      the defect is "no dodge while running" and is not touch's
//   D  DESKTOP roll (Space), moving BY KEYBOARD (KeyW) — the pure desktop differential. If this
//                                      rolls, the build can roll out of a run and B is a real
//                                      touch defect. If it does not, nothing here is about touch.
//
// `up()` in input/touch.js emits `edgeDown(tap)` and `edgeUp(tap)` back to back inside ONE event
// handler for a gated control, so `getInputEdges()` is read around every arm: an edge that never
// reaches the pipeline and an edge that reaches it and is dropped by the fight are different bugs.
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
const rec = { schema: 'elder-souls/critic-roll-matrix@1', arms: {} };

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

{ const l = await lay(); const ic = at(l, 'interact'); await F.down(9, ic.x, ic.y); await page.waitForTimeout(110); await F.up(9); await page.waitForTimeout(2500); }
const L = await lay();
const rc = at(L, 'roll');
say(`title down; roll control at (${Math.round(rc.x)},${Math.round(rc.y)})`);
rec.frame_rate = await (async () => {
  const f = () => page.evaluate(() => window.__ENGINE.sim.frame);
  const a = await f(); const t = Date.now(); await page.waitForTimeout(2000); const b = await f();
  return { fps: Math.round(((b - a) / (Date.now() - t)) * 1000 * 10) / 10 };
})();
say(`frame rate ${rec.frame_rate.fps} fps`);

const watch = async (ms = 1600, every = 30) => {
  const t0 = Date.now(); const s = [];
  while (Date.now() - t0 < ms) {
    s.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { f: c.frame, st: c.player.state, mv: c.player.move ? c.player.move.id : null, inv: !!c.player.invuln, sta: Math.round(c.player.stamina * 10) / 10 }; }));
    await page.waitForTimeout(every);
  }
  return { moves: [...new Set(s.map((x) => x.mv).filter(Boolean))], states: [...new Set(s.map((x) => x.st))], inv: s.filter((x) => x.inv).length, n: s.length, sta_start: s[0].sta, sta_min: Math.min(...s.map((x) => x.sta)) };
};
const edgesSince = async (mark) => page.evaluate((m) => (window.__HARNESS.getInputEdges() || []).filter((e) => e.recv_step >= m).map((e) => `${e.button}:${e.edge}@${e.recv_step}`), mark);
const markNow = () => page.evaluate(() => window.__ENGINE.sim.frame);
const settle = async () => { await page.waitForTimeout(1200); };

// ---- ARM A: touch roll, NO stick ---------------------------------------------------------------
{
  const m = await markNow();
  await F.down(8, rc.x, rc.y); await page.waitForTimeout(70); await F.up(8);
  const w = await watch();
  rec.arms.A_touch_no_stick = { ...w, edges: await edgesSince(m) };
  say(`\nA touch roll, no stick     : moves=${JSON.stringify(w.moves)} states=${JSON.stringify(w.states)} inv=${w.inv}/${w.n} sta ${w.sta_start}->${w.sta_min}  edges=${JSON.stringify(rec.arms.A_touch_no_stick.edges)}`);
}
await settle();

// ---- ARM B: touch roll, stick HELD ---------------------------------------------------------------
{
  await F.down(1, 160, 260); await page.waitForTimeout(40); await F.move(1, 240, 220);
  await page.waitForTimeout(500);
  const m = await markNow();
  await F.down(8, rc.x, rc.y); await page.waitForTimeout(70); await F.up(8);
  const w = await watch();
  rec.arms.B_touch_stick_held = { ...w, edges: await edgesSince(m) };
  say(`B touch roll, stick held   : moves=${JSON.stringify(w.moves)} states=${JSON.stringify(w.states)} inv=${w.inv}/${w.n} sta ${w.sta_start}->${w.sta_min}  edges=${JSON.stringify(rec.arms.B_touch_stick_held.edges)}`);
  await F.up(1);
}
await settle();

// ---- ARM C: DESKTOP roll (Space), stick held by the FINGER ---------------------------------------
{
  await F.down(1, 160, 260); await page.waitForTimeout(40); await F.move(1, 240, 220);
  await page.waitForTimeout(500);
  const m = await markNow();
  await page.keyboard.down('Space'); await page.waitForTimeout(70); await page.keyboard.up('Space');
  const w = await watch();
  rec.arms.C_key_roll_touch_stick = { ...w, edges: await edgesSince(m) };
  say(`C Space roll, touch stick  : moves=${JSON.stringify(w.moves)} states=${JSON.stringify(w.states)} inv=${w.inv}/${w.n} sta ${w.sta_start}->${w.sta_min}  edges=${JSON.stringify(rec.arms.C_key_roll_touch_stick.edges)}`);
  await F.up(1);
}
await settle();

// ---- ARM D: pure DESKTOP — KeyW to run, Space to roll --------------------------------------------
{
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  const m = await markNow();
  await page.keyboard.down('Space'); await page.waitForTimeout(70); await page.keyboard.up('Space');
  const w = await watch();
  rec.arms.D_pure_desktop = { ...w, edges: await edgesSince(m) };
  say(`D Space roll, KeyW running : moves=${JSON.stringify(w.moves)} states=${JSON.stringify(w.states)} inv=${w.inv}/${w.n} sta ${w.sta_start}->${w.sta_min}  edges=${JSON.stringify(rec.arms.D_pure_desktop.edges)}`);
  await page.keyboard.up('KeyW');
}

// ---- the reading -------------------------------------------------------------------------------
const rolled = (a) => a && a.moves.some((m) => /roll/i.test(m));
const anyMove = (a) => a && a.moves.length > 0;
const A = rec.arms.A_touch_no_stick, B = rec.arms.B_touch_stick_held, C = rec.arms.C_key_roll_touch_stick, D = rec.arms.D_pure_desktop;
let verdict;
if (rolled(D) && !anyMove(B) && rolled(C)) verdict = 'TOUCH DEFECT: the desktop rolls out of a run and so does the desktop button while a FINGER holds the stick, but the touch roll control does nothing while the stick is held. The defect is in the touch button, not in the fight.';
else if (rolled(D) && !anyMove(B) && !anyMove(C)) verdict = 'MULTI-TOUCH DEFECT: while a finger holds the stick, NEITHER the touch roll nor the desktop roll fires. Holding the movement stick suppresses the dodge whatever presses it.';
else if (!rolled(D) && !anyMove(B)) verdict = 'NOT A TOUCH DEFECT: the pure desktop arm does not roll out of a run either, so no dodge-while-running exists on this build for any device and the touch arm is not the thing that is broken.';
else if (rolled(B)) verdict = 'NO DEFECT: the touch roll DOES roll with the stick held; the earlier null was a timing artefact of the probe.';
else verdict = 'INCONCLUSIVE — see the arms.';
rec.verdict = verdict;
say(`\nVERDICT: ${verdict}`);
writeJson(path.join(OUT, 'critic-roll-matrix.json'), rec);
say(`artifact reports/critic-w1-touch/critic-roll-matrix.json`);
await ctx.close(); await browser.close(); await server.close();

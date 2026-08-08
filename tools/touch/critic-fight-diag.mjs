#!/usr/bin/env node
// critic-fight-diag.mjs — W1-TOUCH critic. Why did every button in --leg fight come back null?
//
// RULES 4/6: a red result from an instrument that has never been seen green is not evidence, it is
// a broken probe. Before any of `--leg fight`'s failures can be published, this has to separate:
//
//   (a) the touch BUTTONS do not reach the fight        -> a real defect, and a large one
//   (b) the FIXTURE is wrong (arena_duel in play mode swallows input, or the ui is on a screen)
//   (c) my TAP is wrong (lands off the control, or the arc is laid out somewhere else)
//
// It does that by driving the SAME fixture three ways in one page — a finger on the control, the
// harness's own edge, and a keyboard key — and printing the pipeline's view after each. Whichever
// of the three moves the world tells you which of (a)/(b)/(c) you have.
'use strict';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

// The tree this run SERVES. Defaults to the working copy. `--serve-root <dir>` points it at a
// pristine `git archive HEAD` export instead, which is what you want on a box where a dozen
// agents are editing concurrently: on 2026-08-08 a neighbour's STAGED, uncommitted quest data
// made `QuestBook` throw inside `Engine._boot`, so every page on this machine was a black screen
// for reasons that had nothing to do with the piece under test. RULES 12 — a measurement is a
// claim about a COMMIT, not about whatever happened to be on disk.
const SERVE_ROOT = String(process.env.ES_SERVE_ROOT || '');

const args = parseArgs(process.argv.slice(2));
const STATE = String(args.state || 'arena_duel');
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');

const server = await serveDir(SERVE_ROOT || REPO_ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const perr = [];
page.on('pageerror', (e) => perr.push(String(e && e.message || e)));
await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
await page.goto(server.origin + `/game/index.html?state=${STATE}`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
await page.evaluate(() => window.__HARNESS.ready());
const cdp = await ctx.newCDPSession(page);

const rec = { state: STATE, page_errors: perr };
const snap = () => page.evaluate(() => {
  const e = window.__ENGINE;
  const c = window.__HARNESS.getCombatState();
  const t = e.real && e.real.touch;
  return {
    mode: e.mode, frame: e.sim.frame,
    ui_mode: e.renderer && e.renderer.ui ? e.renderer.ui.mode : null,
    menuOpen: !!e.sim.menuOpen,
    census_takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
    player: { state: c.player.state, anim: c.player.anim, move: c.player.move ? c.player.move.id : null, actionable_at: c.player.actionable_at, sta: c.player.stamina, weapon: c.player.weapon, weapon_class: c.player.weapon_class },
    enemy: c.enemies[0] ? { id: c.enemies[0].id, hp: c.enemies[0].hp, state: c.enemies[0].state, dist: c.enemies[0].dist_m } : null,
    touch: t ? { enabled: t.enabled, attached: !!t.attached, suppressToDrawer: !!t.suppressToDrawer, keepOnly: t.keepOnly, held: [...t.held], stick: t.stick ? { ...t.stick } : null } : null,
    layout: window.__HARNESS.touchLayout().map((c2) => ({ a: c2.action, x: Math.round(c2.x), y: Math.round(c2.y), r: c2.r })),
    edges: window.__HARNESS.getInputEdges ? window.__HARNESS.getInputEdges().slice(-8) : null,
  };
});

// ---- ARM 0: is the world even RUNNING? --------------------------------------------------------
// RULES 8/26. Every "the finger did nothing" result below is meaningless if the fixed step is not
// advancing: a straight sword's light attack has ~25 f@60 of startup, so at 3 sim-frames a second
// a 700 ms observation window is under two frames and would see `move: null` on a build that works
// perfectly. The frame RATE is therefore measured first and stamped on everything.
{
  const f = () => page.evaluate(() => window.__ENGINE.sim.frame);
  const a = await f(); const t = Date.now();
  await page.waitForTimeout(3000);
  const b = await f();
  rec.frame_rate = { frames: b - a, ms: Date.now() - t, fps: Math.round(((b - a) / (Date.now() - t)) * 1000 * 10) / 10 };
  say(`frame rate: ${rec.frame_rate.frames} sim frames in ${rec.frame_rate.ms} ms = ${rec.frame_rate.fps} fps  (a light attack is ~25 f@60 of startup alone)`);
}

const s0 = await snap();
rec.boot = s0;
say(`boot: mode=${s0.mode} ui=${s0.ui_mode} menuOpen=${s0.menuOpen} censusInput=${s0.census_takes_input}`);
say(`player: state=${s0.player.state} weapon=${s0.player.weapon} (${s0.player.weapon_class}) sta=${s0.player.sta}`);
say(`enemy : ${JSON.stringify(s0.enemy)}`);
say(`touch : ${JSON.stringify(s0.touch && { enabled: s0.touch.enabled, suppressToDrawer: s0.touch.suppressToDrawer, keepOnly: s0.touch.keepOnly })}`);
say(`layout: ${JSON.stringify(s0.layout)}`);

const lc = s0.layout.find((c) => c.a === 'light');
say(`\n'light' control at (${lc ? lc.x : '?'}, ${lc ? lc.y : '?'}) r=${lc ? lc.r : '?'} — viewport 844x390`);

// ---- ARM 1: a real finger on the control -------------------------------------------------------
say(`\n--- ARM 1: real CDP touch on the 'light' control ---`);
const pts = (x, y) => [{ x, y, id: 9, radiusX: 12, radiusY: 12, force: 1 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(lc.x, lc.y) });
const t1 = await page.evaluate(() => { const t = window.__ENGINE.real.touch; return { held: [...t.held], pointers: t.pointers ? t.pointers.size : null, downRet: null }; });
say(`  immediately after touchStart: TouchInput.held = ${JSON.stringify(t1.held)}, pointers=${t1.pointers}`);
await page.waitForTimeout(120);
const t1b = await page.evaluate(() => ({ held: [...window.__ENGINE.real.touch.held], edges: window.__HARNESS.getInputEdges().slice(-6) }));
say(`  after 120 ms held:            ${JSON.stringify(t1b.held)}  edges=${JSON.stringify(t1b.edges)}`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(700);
const s1 = await snap();
rec.arm_finger = { held_at_down: t1.held, held_120ms: t1b.held, edges: t1b.edges, after: s1 };
say(`  world after: player.move=${s1.player.move} state=${s1.player.state} sta=${s1.player.sta} enemyHp=${s1.enemy && s1.enemy.hp}`);

// ---- ARM 2: the harness's own edge, bypassing the listener --------------------------------------
say(`\n--- ARM 2: __HARNESS edge for 'light' (bypasses the touch listener entirely) ---`);
const arm2 = await page.evaluate(() => {
  const e = window.__ENGINE;
  try { e.input.edgeDown('light'); return 'edgeDown ok'; } catch (err) { return 'ERR ' + err.message; }
});
say(`  ${arm2}`);
await page.waitForTimeout(700);
const s2 = await snap();
rec.arm_harness = { call: arm2, after: s2 };
say(`  world after: player.move=${s2.player.move} state=${s2.player.state} sta=${s2.player.sta} enemyHp=${s2.enemy && s2.enemy.hp}`);

// ---- ARM 3: a keyboard key ---------------------------------------------------------------------
say(`\n--- ARM 3: the DESKTOP control arm — is the FIXTURE fightable at all, by any device? ---`);
const bind = await page.evaluate(() => {
  const b = window.__ENGINE.real.controlMap || null;
  const outp = {};
  if (b) for (const [k, v] of Object.entries(b)) { if (typeof v === 'string' && /light|heavy|roll|block/.test(v)) outp[k] = v; }
  return outp;
});
say(`  bindings for the fight verbs: ${JSON.stringify(bind)}`);
// `light` is bound to Mouse0, so the desktop arm is a real MOUSE press on the canvas, not a key.
await page.mouse.move(400, 200);
await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
await page.waitForTimeout(300);
const midMouse = await snap();
await page.waitForTimeout(1500);
const s3 = await snap();
rec.arm_desktop = { device: 'mouse button 0 on the canvas', bindings: bind, at_300ms: { move: midMouse.player.move, state: midMouse.player.state, sta: midMouse.player.sta }, after: s3 };
say(`  mouse0 pressed — at 300 ms: move=${midMouse.player.move} state=${midMouse.player.state} sta=${midMouse.player.sta}`);
say(`                 — at 1.8 s : move=${s3.player.move} state=${s3.player.state} sta=${s3.player.sta} enemyHp=${s3.enemy && s3.enemy.hp}`);

// ---- ARM 4: the finger again, but SAMPLED THROUGH the move rather than after it ---------------
// RULES 8: one instant is a still target in time. If the world runs at a handful of frames a
// second, "after 700 ms" lands inside the attack's own startup and sees nothing.
say(`\n--- ARM 4: the finger again, sampled continuously for 6 s ---`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(lc.x, lc.y) });
await page.waitForTimeout(90);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const trail = [];
for (let i = 0; i < 60; i++) {
  trail.push(await page.evaluate(() => {
    const c = window.__HARNESS.getCombatState();
    return { f: c.frame, st: c.player.state, mv: c.player.move ? c.player.move.id : null, sta: Math.round(c.player.stamina * 10) / 10, ehp: c.enemies[0] ? c.enemies[0].hp : null };
  }));
  await page.waitForTimeout(100);
}
const seen = [...new Set(trail.map((x) => x.mv).filter(Boolean))];
const states = [...new Set(trail.map((x) => x.st))];
rec.arm_finger_sampled = { moves_seen: seen, states_seen: states, sta_min: Math.min(...trail.map((x) => x.sta)), sta_start: trail[0].sta, ehp_start: trail[0].ehp, ehp_end: trail[trail.length - 1].ehp, frames: trail[trail.length - 1].f - trail[0].f, trail };
say(`  moves seen over 6 s / ${rec.arm_finger_sampled.frames} sim frames: ${JSON.stringify(seen)}`);
say(`  states seen: ${JSON.stringify(states)}   stamina ${rec.arm_finger_sampled.sta_start} -> min ${rec.arm_finger_sampled.sta_min}   enemy hp ${rec.arm_finger_sampled.ehp_start} -> ${rec.arm_finger_sampled.ehp_end}`);

rec.page_errors = perr;
say(`\npage errors: ${JSON.stringify(perr.slice(0, 5))}`);
writeJson(path.join(OUT, `critic-fight-diag-${STATE}.json`), rec);
say(`artifact reports/critic-w1-touch/critic-fight-diag-${STATE}.json`);
await ctx.close(); await browser.close(); await server.close();

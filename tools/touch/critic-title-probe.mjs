#!/usr/bin/env node
// critic-title-probe.mjs — W1-TOUCH critic. What is behind the title, and can a finger get there?
//
// `engine.js:3372`: while `renderer.title.shown`, the title surface takes the latched input and
// `return`s BEFORE the fight is stepped. So a fixture that loads `?state=arena_duel` and starts
// pressing 'light' is pressing it at a title screen, and every "the finger did nothing" it reports
// is a broken probe rather than a defect (RULES 4). This works out the real route.
'use strict';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const STATE = String(args.state || 'arena_duel');
const SERVE_ROOT = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const OUT = path.join(REPO_ROOT, 'reports', 'critic-w1-touch');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');

const server = await serveDir(SERVE_ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
await page.goto(server.origin + `/game/index.html?state=${STATE}`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
await page.evaluate(() => window.__HARNESS.ready());
const cdp = await ctx.newCDPSession(page);
const pts = (x, y) => [{ x, y, id: 9, radiusX: 12, radiusY: 12, force: 1 }];

const rec = { state: STATE, beats: [] };
const look = () => page.evaluate(() => {
  const e = window.__ENGINE;
  const c = window.__HARNESS.getCombatState();
  return {
    frame: e.sim.frame,
    titleShown: !!(e.renderer && e.renderer.title && e.renderer.title.shown),
    title: window.__HARNESS.getTitleState ? window.__HARNESS.getTitleState() : null,
    census_takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
    conversation_open: !!(e.conversation && e.conversation.open),
    player: { state: c.player.state, move: c.player.move ? c.player.move.id : null, sta: c.player.stamina, pos: c.player.pos },
    enemy: c.enemies[0] ? { id: c.enemies[0].id, hp: c.enemies[0].hp, state: c.enemies[0].state, dist: c.enemies[0].dist_m } : null,
    layout: window.__HARNESS.touchLayout().map((x) => x.action),
  };
});

const b0 = await look();
rec.beats.push({ when: 'boot', ...b0 });
say(`boot  : titleShown=${b0.titleShown} frame=${b0.frame}`);
say(`title : ${JSON.stringify(b0.title)}`);
say(`enemy : ${JSON.stringify(b0.enemy)}`);

// A finger commits the highlighted title row, exactly as the round's opening leg does.
const lay = await page.evaluate(() => window.__HARNESS.touchLayout());
const ic = lay.find((c) => c.action === 'interact');
say(`\ntapping 'interact' at (${Math.round(ic.x)},${Math.round(ic.y)}) to commit the title row '${b0.title && b0.title.selected_id}'`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(ic.x, ic.y) });
await page.waitForTimeout(100);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(3000);
const b1 = await look();
rec.beats.push({ when: 'after one interact tap', ...b1 });
say(`after : titleShown=${b1.titleShown} census=${b1.census_takes_input} conv=${b1.conversation_open} frame=${b1.frame}`);
say(`        player=${JSON.stringify(b1.player)}  enemy=${JSON.stringify(b1.enemy)}`);
say(`        arc=${JSON.stringify(b1.layout)}`);

// Now, with the title down, does a finger on 'light' reach the fight?
if (!b1.titleShown && !b1.census_takes_input) {
  const lay2 = await page.evaluate(() => window.__HARNESS.touchLayout());
  const lc = lay2.find((c) => c.action === 'light');
  if (lc) {
    say(`\ntitle is down — a finger on 'light' at (${Math.round(lc.x)},${Math.round(lc.y)})`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(lc.x, lc.y) });
    await page.waitForTimeout(90);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const trail = [];
    for (let i = 0; i < 30; i++) {
      trail.push(await page.evaluate(() => { const c = window.__HARNESS.getCombatState(); return { f: c.frame, st: c.player.state, mv: c.player.move ? c.player.move.id : null, sta: Math.round(c.player.stamina * 10) / 10 }; }));
      await page.waitForTimeout(100);
    }
    const moves = [...new Set(trail.map((x) => x.mv).filter(Boolean))];
    rec.after_title_light = { moves, states: [...new Set(trail.map((x) => x.st))], sta_start: trail[0].sta, sta_min: Math.min(...trail.map((x) => x.sta)) };
    say(`  moves=${JSON.stringify(moves)} states=${JSON.stringify(rec.after_title_light.states)} stamina ${rec.after_title_light.sta_start} -> ${rec.after_title_light.sta_min}`);
  }
}
writeJson(path.join(OUT, `critic-title-probe-${STATE}.json`), rec);
say(`\nartifact reports/critic-w1-touch/critic-title-probe-${STATE}.json`);
await ctx.close(); await browser.close(); await server.close();

#!/usr/bin/env node
// Throwaway diagnosis for W1-MAP-DEFECTS. Two questions:
//   1. does the page survive a few minutes of play mode at all? (two runs died with
//      "Target page, context or browser has been closed")
//   2. why does the screen walk stop at the journal?
// Instruments by RECORDING only; never drives.
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const say = (s) => process.stdout.write(s + '\n');
const h = await launchGame({ ...args, width: Number(args.width || 640), height: Number(args.height || 360) });
let dead = null;
h.page.on('crash', () => { dead = 'page crashed'; say('!! PAGE CRASHED'); });
h.page.on('close', () => { dead = dead || 'page closed'; say('!! PAGE CLOSED'); });
h.browser.on('disconnected', () => { dead = dead || 'browser disconnected'; say('!! BROWSER DISCONNECTED'); });
try {
  await h.page.goto(h.url.replace(/\?.*$/, '') + '?mode=play', { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.waitForTimeout(1000);

  await h.page.evaluate(() => {
    const E = window.__ENGINE, ui = E.ui;
    window.__LOG = [];
    const step0 = ui.step.bind(ui);
    ui.step = (input, ctx) => {
      let pressed = [];
      try { pressed = ['menu', 'swap_right', 'swap_left', 'interact', 'two_hand', 'roll'].filter((a) => input.pressedName(a)); } catch { /* */ }
      const before = ui.mode;
      const taken = step0(input, ctx);
      if (pressed.length || before !== ui.mode) window.__LOG.push({ w: 'step', f: ctx && ctx.frame, pressed, taken: taken.slice(), before, after: ui.mode, combat: !!(ctx && ctx.inCombat) });
      return taken;
    };
    const walk0 = ui._walkPeer.bind(ui);
    ui._walkPeer = (dir, ctx) => {
      let ring = null, at = null;
      try { ring = ui._walkRing(ctx); at = ring.indexOf(ui.mode); } catch (e) { ring = ['ERR ' + e.message]; }
      const r = walk0(dir, ctx);
      window.__LOG.push({ w: 'walk', dir, ring, at, to: r, refused: ui.navRefused });
      return r;
    };
    const drv = E.sim.uiDriver;
    E.sim.uiDriver = (input) => {
      let pressed = [];
      try { pressed = ['menu', 'swap_right', 'swap_left'].filter((a) => input.pressedName(a)); } catch { /* */ }
      if (pressed.length) {
        window.__LOG.push({ w: 'driver', pressed, census: !!(E.censusSurface && E.censusSurface.takesInput), isMenu: ui.isMenu(), early_return: !!(E.censusSurface && E.censusSurface.takesInput) && !ui.isMenu(), paused: !!E._pausedThisStep });
      }
      return drv(input);
    };
    // Did the DOM even see the key?
    window.addEventListener('keydown', (e) => window.__LOG.push({ w: 'dom', code: e.code, defaultPrevented: e.defaultPrevented }), true);
  });

  const dump = async (label) => {
    if (dead) { say(`${label} -> SKIPPED (${dead})`); return; }
    const out = await h.page.evaluate(() => {
      const l = window.__LOG.slice(); window.__LOG = [];
      const E = window.__ENGINE;
      return { log: l, mode: E.ui.mode, frame: E.sim.frame, paused: !!E._pausedThisStep, pausedFrames: E.uiPausedFrames || 0 };
    }).catch((e) => ({ err: String(e && e.message || e).slice(0, 100) }));
    if (out.err) { say(`${label} -> READ FAILED ${out.err}`); dead = out.err; return; }
    say(`${label} -> mode=${out.mode} simFrame=${out.frame} pausedFrames=${out.pausedFrames}`);
    for (const e of out.log) say('    ' + JSON.stringify(e));
  };
  await dump('settled');
  await h.page.keyboard.press('KeyM'); await h.page.waitForTimeout(500); await dump('KeyM');
  for (let i = 1; i <= 5 && !dead; i++) { await h.page.keyboard.press('Digit3'); await h.page.waitForTimeout(500); await dump(`Digit3 #${i}`); }
} catch (e) {
  say('THREW: ' + String(e && e.message || e).slice(0, 300));
} finally {
  say('dead: ' + dead);
  say('pageerrors: ' + JSON.stringify(h.errors.slice(0, 4)));
  try { await h.close(); } catch { /* */ }
}

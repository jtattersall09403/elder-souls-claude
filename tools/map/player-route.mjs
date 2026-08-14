#!/usr/bin/env node
// player-route.mjs — CAN A PERSON OPEN THE MAP?
//
// Owner: W1-MAP-DEFECTS. The owner reported, from the deployed build, that they could not open
// the map at all. `tools/ui/critic-w1-21-r2-doors-at-head.mjs` says otherwise — but it starts
// from `loadState('ui-journal')`, a canned mid-game state, and it steps the simulation by hand
// through the harness. A player does neither. This tool takes the player's route and only the
// player's route:
//
//   * `?mode=play`, so requestAnimationFrame drives the simulation exactly as it does for a
//     person. Nothing here calls `stepFrames`, `openMenu`, `setMode` or `loadState`.
//   * the game boots where a player boots — the barge hold, character creation not yet begun.
//   * every input is a real `page.keyboard` press (desktop) or a real touch tap (phone), routed
//     through `window` and `canvas` listeners in `game/src/input/real.js`.
//   * the harness is used ONLY to read state back and to take the screenshot, never to drive.
//
// It fails (exit 1) when the map cannot be reached from the world by pressing keys.
//
// USAGE
//   node tools/map/player-route.mjs [--out <dir>] [--legs desktop,phone] [--shots]
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) {
  usage('player-route.mjs — reach the map with real key presses and real taps, from a real boot.');
}
const OUT = path.resolve(String(args.out || path.join(RUNS_DIR, 'W1-MAP-DEFECTS')));
ensureDir(OUT);
const SHOTS = path.join(OUT, 'shots');
ensureDir(SHOTS);
const LEGS = String(args.legs || 'desktop,phone').split(',').map((s) => s.trim());
const say = (s) => process.stdout.write(s + '\n');

const report = { probe: 'player-route', at: new Date().toISOString(), commit: null, legs: {} };
try {
  report.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD').toString().trim();
} catch { /* not fatal */ }

/** Everything about the route, read off the running build. Reads only. */
const READ = () => {
  const E = window.__ENGINE, H = window.__HARNESS;
  const ui = H.getUIState ? H.getUIState() : null;
  const inp = E.real && E.real.state ? E.real.state() : null;
  return {
    mode: (ui && ui.mode) || (E.ui && E.ui.mode) || null,
    walkable: ui && ui.nav ? ui.nav.walkable : null,
    advertised: ui && ui.nav ? ui.nav.advertised : null,
    walk_live: ui && ui.nav ? ui.nav.walk_live : null,
    refused: ui && ui.nav ? ui.nav.refused : null,
    text_focused: inp ? !!inp.textFocused : null,
    census_takes_input: !!(E.censusSurface && E.censusSurface.takesInput),
    in_combat: (() => { try { return E.inCombat(); } catch { return null; } })(),
    frame: E.sim ? E.sim.frame : null,
    map_terrain_cells: ui && ui.map ? { drawn: ui.map.drawn_cells, revealed: ui.map.revealed_cells, total: ui.map.total_cells, places_drawn: ui.map.places_drawn } : null,
  };
};

// The picture the PLAYER sees. `page.screenshot()` rather than `__HARNESS.screenshot()`: the
// harness one round-trips a full framebuffer copy through a data URL on every call and took the
// renderer down on the second call of the first run of this tool (`Target page … has been
// closed`, 1280x720, swiftshader). The whole game is drawn into one canvas that fills the page,
// so the page shot and the canvas shot are the same picture — and this one is what a person
// photographing their screen would get.
async function shot(h, name) {
  if (args.shots === false) return null;
  const file = path.join(SHOTS, name + '.png');
  try {
    await h.page.screenshot({ path: file });
    return path.relative(OUT, file);
  } catch (e) {
    return 'FAILED: ' + String(e && e.message || e).slice(0, 120);
  }
}

async function bootPlay(h, query = '') {
  await h.page.goto(h.url.replace(/\?.*$/, '') + '?mode=play' + query, { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 120000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.waitForTimeout(1200);
}

// ---------------------------------------------------------------------------------------------
// DESKTOP — the keyboard route.
// ---------------------------------------------------------------------------------------------
async function desktop() {
  const h = await launchGame({ width: 1280, height: 720, timeout: 300000 });
  const leg = { steps: [], reached_map: false, shots: [] };
  try {
    await bootPlay(h);
    const push = async (label, key) => {
      if (key) { await h.page.keyboard.press(key); await h.page.waitForTimeout(320); }
      const st = await h.page.evaluate(READ).catch((e) => ({ read_failed: String(e && e.message || e).slice(0, 160) }));
      const file = await shot(h, `desktop-${String(leg.steps.length).padStart(2, '0')}-${label}`);
      leg.steps.push({ label, key: key || null, ...st, shot: file });
      say(`  ${label.padEnd(22)} key=${String(key || '-').padEnd(8)} mode=${String(st.mode).padEnd(10)} walkable=[${(st.walkable || []).join(',')}] refused=${JSON.stringify(st.refused)}`);
      return st;
    };
    await push('boot', null);
    await push('menu-key-M', 'KeyM');
    for (let i = 1; i <= 8; i++) await push(`swap_right-${i}`, 'Digit3');
    // and the other way round the ring, in case forward is the broken direction
    await push('close', 'Escape');
    await push('menu-key-M-again', 'KeyM');
    for (let i = 1; i <= 8; i++) await push(`swap_left-${i}`, 'Digit4');
    leg.reached_map = leg.steps.some((s) => s.mode === 'map');
  } finally {
    leg.console_errors = h.errors.slice(0, 6);
    await h.close();
  }
  return leg;
}

// ---------------------------------------------------------------------------------------------
// PHONE — the touch route. `menu`, `swap_left` and `swap_right` all live behind ONE drawer
// control (`game/data/input/profiles.json` touch.drawer), so the route is: open the drawer, tap
// `menu`, open the drawer again, tap `swap_right` — as many times as it takes.
// ---------------------------------------------------------------------------------------------
async function phone() {
  const h = await launchGame({ width: 844, height: 390, timeout: 300000 });
  const leg = { steps: [], reached_map: false };
  try {
    // A real phone context on the same browser: coarse pointer, no hover, touch events. The
    // desktop context `launchGame` makes reports a fine pointer, and `TouchInput.enabled` comes
    // from that media query, so the overlay would never appear on it.
    const ctx = await h.browser.newContext({
      viewport: { width: 844, height: 390 }, deviceScaleFactor: 2,
      hasTouch: true, isMobile: true,
      colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => h.errors.push({ kind: 'pageerror', message: String(e && e.message || e) }));
    h.page = page;      // so `shot()` and `READ` run against the phone
    await page.goto(h.url.replace(/\?.*$/, '') + '?mode=play', { waitUntil: 'load', timeout: 240000 });
    await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 240000 });
    await page.evaluate(() => window.__HARNESS.ready());
    await page.waitForTimeout(1500);
    leg.touch_state_at_boot = await page.evaluate(() => window.__HARNESS.touchState());
    const layout = async () => h.page.evaluate(() => {
      const E = window.__ENGINE;
      if (!E.real || !E.real.touch) return null;
      return { controls: E.real.touch.layout(), drawerOpen: E.real.touch.drawerOpen, enabled: E.real.touch.enabled, visible: E.real.touch.visible };
    });
    const tapAction = async (action) => {
      const l = await layout();
      const c = (l && l.controls || []).find((x) => x.action === action);
      if (!c) return { tapped: false, reason: `no '${action}' control on the glass`, controls: (l && l.controls || []).map((x) => x.action) };
      await h.page.touchscreen.tap(c.x, c.y);
      await h.page.waitForTimeout(320);
      return { tapped: true, at: [Math.round(c.x), Math.round(c.y)] };
    };
    const push = async (label, action) => {
      let t = { tapped: null };
      if (action) t = await tapAction(action);
      const st = await h.page.evaluate(READ);
      const l = await layout();
      const file = await shot(h, `phone-${String(leg.steps.length).padStart(2, '0')}-${label}`);
      leg.steps.push({ label, action: action || null, tap: t, ...st, controls_on_glass: (l && l.controls || []).map((x) => x.action), shot: file });
      say(`  ${label.padEnd(22)} tap=${JSON.stringify(t).slice(0, 60).padEnd(30)} mode=${String(st.mode).padEnd(10)} glass=[${(l && l.controls || []).map((x) => x.action).join(',')}]`);
      return st;
    };
    await push('boot', null);
    // A first tap anywhere wakes the overlay on a device that has not been touched yet.
    await h.page.touchscreen.tap(200, 200); await h.page.waitForTimeout(300);
    await push('first-touch', null);
    await push('drawer', '__drawer');
    await push('menu', 'menu');
    for (let i = 1; i <= 6; i++) {
      await push(`drawer-${i}`, '__drawer');
      await push(`swap_right-${i}`, 'swap_right');
    }
    leg.reached_map = leg.steps.some((s) => s.mode === 'map');
  } finally {
    leg.console_errors = h.errors.slice(0, 6);
    await h.close();
  }
  return leg;
}

if (LEGS.includes('desktop')) { say('== desktop, keyboard, from a real boot =='); report.legs.desktop = await desktop(); }
if (LEGS.includes('phone')) { say('== phone, touch, from a real boot =='); report.legs.phone = await phone(); }

const reached = Object.entries(report.legs).map(([k, v]) => [k, !!v.reached_map]);
report.pass = reached.length > 0 && reached.every(([, ok]) => ok);
writeJson(path.join(OUT, 'player-route.json'), report);
say('');
for (const [k, ok] of reached) say(`${ok ? 'ok  ' : 'FAIL'} ${k}: the map ${ok ? 'was' : 'was NEVER'} reached by a player's own controls`);
say(`report: ${path.join(OUT, 'player-route.json')}`);
process.exit(report.pass ? 0 : 1);

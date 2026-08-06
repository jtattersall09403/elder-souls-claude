#!/usr/bin/env node
// critic-w1-07-r2e.mjs — CRITIC instrument, W1-07 round 2, pass E.
//  E1  the custom-class route on a gamepad: reproduce the uncaught throw out of stepFrames.
//  E2  gamepad-only completion via the questionnaire route (the route the item calls mandatory).
//  E3  keyboard-only completion with real DOM key events.
//  E4  S26: minimum reaching distance of the raid party's statblock against a stationary player.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeE');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2e.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 4000)); };

async function launch() {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 320, height: 240 }, locale: 'en-GB', timezoneId: 'UTC' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready());
  return {
    page, errors,
    async h(m, ...a) {
      const r = await page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
      if (r.err) throw new Error(`${m}(): ${r.err}`);
      return r.ok;
    },
    async soft(m, ...a) {
      return this.page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
    },
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
  };
}

const NB = 17, A = 0, DOWN = 13;
const padState = (down = [], axes = [0, 0, 0, 0]) => ({ buttons: Array.from({ length: NB }, (_, i) => down.includes(i)), axes });

async function padSetup(h, race) {
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('censusBegin', { race });
  await h.h('stepFrames', 4);
}
async function tap(h, btn) {
  const a = await h.soft('gamepad', padState([btn]));
  const b = await h.soft('stepFrames', 3);
  const c = await h.soft('gamepad', padState([]));
  const d = await h.soft('stepFrames', 3);
  for (const r of [a, b, c, d]) if (r.err) return r.err;
  return null;
}
async function walkOut(h) {
  await h.h('gamepad', padState([], [0, -1, 0, 0]));
  for (let k = 0; k < 60; k++) {
    await h.h('stepFrames', 10);
    const q = await h.h('getCensusState');
    if (!q.paused) break;
  }
  await h.h('gamepad', padState([]));
  await h.h('stepFrames', 3);
  return h.h('getCensusState');
}

// ---- E1: the custom route, gamepad, minimal reproduction --------------------------------
async function e1() {
  const h = await launch();
  await padSetup(h, 'khajiit');
  const log = [];
  let presses = 0, err = null;
  // hatch-name
  err = await tap(h, A); presses++;
  let st = await h.h('getCensusState');
  if (st.paused) { st = await walkOut(h); log.push({ walked_out_to: st.node }); }
  // race-observed, sex, upbringing, given-name
  for (let i = 0; i < 4 && !err; i++) {
    st = await h.h('getCensusState');
    if (st.done) break;
    err = await tap(h, A); presses++;
    log.push({ node: st.node, after: (await h.h('getCensusState')).node });
  }
  // class-routes: caret DOWN once to reach "Tell her what you actually do" (the custom route)
  st = await h.h('getCensusState');
  log.push({ at: st.node, options: st.input && (st.input.options||[]).map((o) => o.text) });
  if (!err) err = await tap(h, DOWN);
  if (!err) { err = await tap(h, A); presses++; }
  st = await h.h('getCensusState');
  log.push({ now: st.node, options: st.input && (st.input.options||[]).map((o) => o.id), kind: st.input && st.input.kind });
  // Now walk the custom nodes with caret+A only, exactly as a player would.
  let guard = 0;
  while (!err && guard++ < 60) {
    st = await h.h('getCensusState');
    if (st.done) break;
    const before = st.node;
    const surf = st.surface || {};
    log.push({ node: before, kind: st.input && st.input.kind, offered: st.input && (st.input.options||[]).map((o) => o.id), picked: surf.picked, sel: surf.selected_index });
    err = await tap(h, A); presses++;
    if (err) { log.push({ THREW_ON: before, error: err }); break; }
    const after = await h.h('getCensusState');
    if (after.node === before) { err = await tap(h, DOWN); if (err) { log.push({ THREW_ON_CARET: before, error: err }); break; } }
  }
  const pageErrors = h.errors.slice();
  await h.close();
  T('E1-custom-route-gamepad-crash', {
    presses, throw_from_stepFrames: err, page_errors: pageErrors, log,
    verdict: err ? 'ORDINARY BUTTON PRESSES ON THE CUSTOM-CLASS ROUTE THROW OUT OF THE FIXED STEP' : 'the custom route survives caret+A',
  });
}

// ---- E2: gamepad-only completion via the questionnaire route ----------------------------
async function e2() {
  const h = await launch();
  await padSetup(h, 'khajiit');
  let presses = 0, sticks = 0; const log = []; let err = null;
  let guard = 0;
  for (;;) {
    if (guard++ > 300) { log.push('GUARD'); break; }
    const st = await h.h('getCensusState');
    if (st.done) break;
    if (st.paused) { sticks++; const q = await walkOut(h); log.push({ via: 'left stick', now: q.node }); if (q.paused) { log.push('STICK WALK FAILED'); break; } continue; }
    const before = st.node;
    const kind = st.input && st.input.kind;
    const opts = (st.input && st.input.options) || [];
    if (before === 'writ.class-routes') {
      // pick the questionnaire route: it is the third option, so two caret moves.
      const idx = opts.findIndex((o) => o.id === 'questionnaire');
      for (let k = 0; k < idx; k++) { err = await tap(h, DOWN); presses++; if (err) break; }
    }
    if (err) break;
    err = await tap(h, A); presses++;
    if (err) { log.push({ THREW_ON: before, error: err }); break; }
    const after = await h.h('getCensusState');
    log.push({ node: before, kind, options: opts.length, to: after.node, done: !!after.done });
    if (after.node === before && !after.done) { err = await tap(h, DOWN); presses++; if (err) break; }
  }
  const st = await h.h('getCensusState');
  const ch = await h.h('getCharacter');
  const writ = await h.h('readWrit');
  const inp = await h.h('getInputState');
  const pageErrors = h.errors.slice();
  await h.close();
  T('E2-gamepad-only-questionnaire-route', {
    completed: !!st.done, button_presses: presses, left_stick_walks: sticks,
    error: err, page_errors: pageErrors,
    active_device: inp.activeDevice, pad_polls: inp.gamepad.polls, pad_id: inp.gamepad.id,
    character: ch && { race: ch.race, sex: ch.sex, upbringing: ch.upbringing, given_name: ch.given_name, hatch_name: ch.hatch_name, class: ch.class, birthsign: ch.birthsign },
    writ_present: !!writ, writ_sample: writ && String(JSON.stringify(writ)).slice(0, 240),
    log,
  });
}

// ---- E3: keyboard only, real DOM key events ---------------------------------------------
async function e3() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('censusBegin', { race: 'nord' });
  await h.h('stepFrames', 4);
  const key = async (k) => { await h.page.keyboard.down(k); await h.h('stepFrames', 3); await h.page.keyboard.up(k); await h.h('stepFrames', 3); };
  const log = []; let keys = 0, guard = 0, err = null;
  for (;;) {
    if (guard++ > 200) { log.push('GUARD'); break; }
    const st = await h.h('getCensusState');
    if (st.done) break;
    if (st.paused) {
      await h.page.keyboard.down('KeyW');
      for (let k = 0; k < 60; k++) { await h.h('stepFrames', 10); const q = await h.h('getCensusState'); if (!q.paused) break; }
      await h.page.keyboard.up('KeyW'); await h.h('stepFrames', 3);
      const q = await h.h('getCensusState');
      log.push({ via: 'W held', now: q.node });
      if (q.paused) { log.push('KEYBOARD WALK FAILED'); break; }
      continue;
    }
    const before = st.node;
    const kind = st.input && st.input.kind;
    const opts = (st.input && st.input.options) || [];
    if (before === 'writ.class-routes') {
      const idx = opts.findIndex((o) => o.id === 'questionnaire');
      for (let k = 0; k < idx; k++) await key('KeyS');
    }
    if (kind === 'text') { for (const c of 'BJORN') await h.page.keyboard.press(`Key${c}`); await h.h('stepFrames', 3); }
    const r = await h.soft('stepFrames', 0);
    if (r.err) { err = r.err; break; }
    await key('KeyE'); keys++;
    const after = await h.h('getCensusState');
    log.push({ node: before, kind, to: after.node, typed: after.surface && after.surface.typed, done: !!after.done });
    if (after.node === before && !after.done) { await key('KeyS'); await key('KeyE'); keys++; }
  }
  const st = await h.h('getCensusState');
  const ch = await h.h('getCharacter');
  const inp = await h.h('getInputState');
  await h.close();
  T('E3-keyboard-only-completion', {
    completed: !!st.done, key_presses: keys, error: err, active_device: inp.activeDevice,
    character: ch && { race: ch.race, given_name: ch.given_name, class: ch.class, birthsign: ch.birthsign }, log,
  });
}

// ---- E4: S26 reach band -----------------------------------------------------------------
async function e4() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const CH = { race: 'saxhleel', upbringing: 'interior', sex: 'male', class: 'marsh-knight', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' };
  const rows = [];
  const moves = ['chop', 'thrust', 'combo_a', 'combo_b'];
  for (let d = 0.4; d <= 3.4001; d += 0.2) {
    const dist = Math.round(d * 100) / 100;
    const perMove = {};
    for (const mv of moves) {
      await h.h('loadState', 'default');
      await h.h('setCharacter', CH);
      const eid = await h.h('spawn', 'inf_trash', 0, dist, { as: 'probe' });
      const p0 = (await h.h('getCombatState')).player.hp;
      const q = await h.soft('queueEnemyScript', eid, [{ at: 6, move: mv }]);
      await h.h('stepFrames', 240);
      const p1 = (await h.h('getCombatState')).player.hp;
      perMove[mv] = { dmg: Math.round((p0 - p1) * 100) / 100, script_err: q.err || null };
    }
    rows.push({ dist_m: dist, ...perMove });
  }
  await h.close();
  const reach = {};
  for (const mv of moves) {
    const hitAt = rows.filter((r) => r[mv].dmg > 0).map((r) => r.dist_m);
    let contiguous = true;
    for (let i = 1; i < hitAt.length; i++) if (Math.abs(hitAt[i] - hitAt[i - 1] - 0.2) > 1e-6) contiguous = false;
    reach[mv] = { reaching_m: hitAt, min: hitAt[0] ?? null, max: hitAt[hitAt.length - 1] ?? null, contiguous: hitAt.length ? contiguous : null };
  }
  T('E4-S26-reach-band', {
    rows, reach,
    verdict: Object.values(reach).some((r) => r.contiguous === false) ? 'INTERIOR GAP IN A REACHABLE BAND — S26 defect'
      : (Object.values(reach).every((r) => r.min === null) ? 'THE STATBLOCK NEVER REACHES A STATIONARY PLAYER AT ANY DISTANCE' : 'bands contiguous'),
  });
}

try { await e1(); await e2(); await e3(); await e4(); }
finally { fs.writeFileSync(path.join(OUT, 'probeE.json'), JSON.stringify(rec, null, 2)); }

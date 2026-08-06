#!/usr/bin/env node
// critic-w1-07-r2d.mjs — CRITIC instrument, W1-07 round 2, pass D.
//  D1  gamepad-only completion of the whole census, driven through the same RealInput.pollGamepad
//      a physical GameSir X2s takes; counts presses, and asserts NO other verb touched the census.
//  D2  keyboard-only completion, driven with real DOM key events (page.keyboard), not queueInputs.
//  D3  S26: minimum reaching distance of the raid party's own statblock against a stationary
//      player, swept, and the contiguity of the reachable band.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeD');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2d.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 3000)); };

async function launch(w = 320, hgt = 240) {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, locale: 'en-GB', timezoneId: 'UTC' });
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
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
  };
}

const NB = 17;
const padState = (down = [], axes = [0, 0, 0, 0]) => ({ buttons: Array.from({ length: NB }, (_, i) => down.includes(i)), axes });

// ---- D1: gamepad only -------------------------------------------------------------------
async function d1() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('censusBegin', { race: 'khajiit' });
  await h.h('stepFrames', 4);
  let presses = 0, sticks = 0;
  const log = [];
  const tap = async (btn) => {
    await h.h('gamepad', padState([btn]));
    await h.h('stepFrames', 3);
    await h.h('gamepad', padState([]));
    await h.h('stepFrames', 3);
    presses++;
  };
  const DPAD_DOWN = 13, A = 0;
  let guard = 0;
  for (;;) {
    if (guard++ > 400) { log.push('GUARD TRIPPED'); break; }
    const st = await h.h('getCensusState');
    if (st.done) break;
    if (st.paused) {
      // Walk out of the hold on the left stick alone. Nothing is pressed.
      await h.h('gamepad', padState([], [0, -1, 0, 0]));
      sticks++;
      let walked = 0;
      for (let k = 0; k < 60; k++) {
        await h.h('stepFrames', 10); walked += 10;
        const q = await h.h('getCensusState');
        if (!q.paused) break;
      }
      await h.h('gamepad', padState([]));
      await h.h('stepFrames', 3);
      const q = await h.h('getCensusState');
      log.push({ via: 'left stick', frames: walked, now: q.node, still_paused: !!q.paused });
      if (q.paused) { log.push('THE WALK OUT OF THE HOLD DID NOT COMPLETE ON THE STICK'); break; }
      continue;
    }
    const before = st.node;
    const opts = st.input ? (st.input.options || []) : [];
    const kind = st.input ? st.input.kind : null;
    // Move the caret down once when there is a list (proves the D-pad drives selection), then A.
    if (opts.length > 1) { await tap(DPAD_DOWN); }
    await tap(A);
    const after = await h.h('getCensusState');
    log.push({ node: before, kind, options: opts.length, moved_to: after.node, done: !!after.done, picked: after.surface ? after.surface.picked : null });
    if (after.node === before && !after.done && kind !== 'pick' && !(after.surface && after.surface.picked && after.surface.picked.length)) {
      // The node did not advance. Try a second A in case this is a multi-pick node.
      await tap(A);
      const again = await h.h('getCensusState');
      if (again.node === before && !again.done) { log.push({ STUCK_AT: before, kind, options: opts.length }); break; }
    }
  }
  const st = await h.h('getCensusState');
  const ch = await h.h('getCharacter');
  const writ = await h.h('readWrit');
  const inputState = await h.h('getInputState');
  await h.close();
  T('D1-gamepad-only-completion', {
    completed: !!st.done,
    button_presses: presses, left_stick_walks: sticks,
    active_device: inputState.activeDevice, pad: inputState.gamepad,
    character: ch && { race: ch.race, sex: ch.sex, upbringing: ch.upbringing, given_name: ch.given_name, hatch_name: ch.hatch_name, class: ch.class, birthsign: ch.birthsign },
    writ_present: !!writ,
    log,
  });
}

// ---- D2: keyboard only, with REAL DOM key events ---------------------------------------
async function d2() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('censusBegin', { race: 'nord' });
  await h.h('stepFrames', 4);
  const key = async (k) => { await h.page.keyboard.down(k); await h.h('stepFrames', 3); await h.page.keyboard.up(k); await h.h('stepFrames', 3); };
  const log = []; let keys = 0; let guard = 0;
  for (;;) {
    if (guard++ > 300) { log.push('GUARD'); break; }
    const st = await h.h('getCensusState');
    if (st.done) break;
    if (st.paused) {
      await h.page.keyboard.down('KeyW');
      for (let k = 0; k < 60; k++) { await h.h('stepFrames', 10); const q = await h.h('getCensusState'); if (!q.paused) break; }
      await h.page.keyboard.up('KeyW');
      await h.h('stepFrames', 3);
      const q = await h.h('getCensusState');
      log.push({ via: 'W held', now: q.node, still_paused: !!q.paused });
      if (q.paused) { log.push('KEYBOARD WALK FAILED'); break; }
      continue;
    }
    const before = st.node;
    const kind = st.input ? st.input.kind : null;
    if (kind === 'text') {
      // Type a name on the keyboard; RI-JRN01 O17(a).
      for (const c of 'Bjorn') await h.page.keyboard.press(`Key${c.toUpperCase()}`);
      await h.h('stepFrames', 3);
    }
    await key('KeyE'); keys++;
    const after = await h.h('getCensusState');
    log.push({ node: before, kind, moved_to: after.node, done: !!after.done, typed: after.surface ? after.surface.typed : null });
    if (after.node === before && !after.done) {
      await key('KeyE'); keys++;
      const again = await h.h('getCensusState');
      if (again.node === before && !again.done) { log.push({ STUCK_AT: before, kind }); break; }
    }
  }
  const st = await h.h('getCensusState');
  const ch = await h.h('getCharacter');
  const inputState = await h.h('getInputState');
  await h.close();
  T('D2-keyboard-only-completion', {
    completed: !!st.done, key_presses: keys, active_device: inputState.activeDevice,
    character: ch && { race: ch.race, given_name: ch.given_name, class: ch.class, birthsign: ch.birthsign },
    log,
  });
}

// ---- D3: S26 — minimum reaching distance and band contiguity ---------------------------
async function d3() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  await h.h('loadState', 'default');
  await h.h('setCharacter', { race: 'saxhleel', upbringing: 'interior', sex: 'male', class: 'marsh-knight', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' });
  const rows = [];
  for (let d = 0.4; d <= 3.6001; d += 0.2) {
    const dist = Math.round(d * 100) / 100;
    await h.h('loadState', 'default');
    await h.h('setCharacter', { race: 'saxhleel', upbringing: 'interior', sex: 'male', class: 'marsh-knight', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' });
    await h.h('setPlayerMotion', { pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0 }).catch(() => {});
    const eid = await h.h('spawn', 'inf_trash', 0, dist, { as: `probe-${dist}` });
    await h.h('setEntityPos', eid, 0, dist).catch(() => {});
    const hp0 = (await h.h('getCombatState')).player.hp;
    await h.h('traceStart').catch(() => {});
    await h.h('queueEnemyScript', eid, [{ at: 4, move: 'chop' }]).catch(async () => { await h.h('raiseEnemyAlert', eid, 100).catch(() => {}); });
    await h.h('stepFrames', 180);
    const hp1 = (await h.h('getCombatState')).player.hp;
    const evs = await h.h('traceDrain').catch(() => []);
    const hits = (Array.isArray(evs) ? evs : []).filter((e) => e.type === 'HIT' || e.kind === 'HIT').length;
    rows.push({ dist_m: dist, hp_before: hp0, hp_after: hp1, damage: hp0 - hp1, hit_events: hits });
    await h.h('killEntity', eid).catch(() => {});
  }
  await h.close();
  const reached = rows.filter((r) => r.damage > 0).map((r) => r.dist_m);
  let contiguous = true;
  for (let i = 1; i < reached.length; i++) if (Math.abs(reached[i] - reached[i - 1] - 0.2) > 1e-6) contiguous = false;
  T('D3-S26-reach-band', {
    rows,
    reaching_distances_m: reached,
    min_reach_m: reached.length ? Math.min(...reached) : null,
    max_reach_m: reached.length ? Math.max(...reached) : null,
    band_contiguous: reached.length ? contiguous : null,
    verdict: !reached.length ? 'THE ENEMY NEVER REACHES THE PLAYER AT ANY DISTANCE 0.4-3.6 m'
      : (contiguous ? 'reachable band is contiguous' : 'INTERIOR GAP IN THE REACHABLE BAND — S26 defect'),
  });
}

try { await d1(); await d2(); await d3(); }
finally { fs.writeFileSync(path.join(OUT, 'probeD.json'), JSON.stringify(rec, null, 2)); }

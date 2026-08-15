#!/usr/bin/env node
// t4-r2-critic-twohand.mjs — is `two_hand` (the HUD full/minimal switch) dead, or is my clock?
//
// Owner: crit-t4-r2. This exists because I recorded a `two_hand` failure twice and each attempt
// fell on a different side of the same gate, and RI-UIX10 §B trap I2 — which I wrote — says a
// verdict that fails a control without asserting the instrument is not evidence.
//
// THE GATE, read rather than guessed: `desktop.hold_gate_frames.two_hand = 12`, consumed at
// `input/real.js` `_down`/`_up` through `hold-gate.js`. `inputNow(mode, frame, event)` returns
// `frame * STEP_MS` for every mode EXCEPT `play`, so in `play-instrumented` the gate is measured
// in HARNESS FRAMES and a `stepFrames(20)` hold is a genuine 20 f@60 hold. That is the valid
// stimulus and it is what this file uses.
//
// It reads the pipeline at four points, so the answer names WHERE it stops:
//   1. the hold record itself (`real._holds.KeyG`) while the key is down
//   2. `input.pendingPress` immediately after the keyup, before any step
//   3. `getInputEdges()` after one step — did the action reach the latch
//   4. `getUIState().hud.mode` after — did the screen act on it
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, log, ensureDir } from '../lib/cli.mjs';

const ROOT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r2c');
ensureDir(path.join(ROOT, 'reports'));
ensureDir(path.join(ROOT, 'screens'));

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
const out = { schema: 'elder-souls/t4-twohand@1', at: new Date().toISOString(), steps: [], checks: [] };
let exit = 0;
const push = (id, pass, detail) => { out.checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };

try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', 'ui-journal');
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);
  // reach the inventory through the real path
  for (let i = 0; i < 4; i++) {
    const m = await h.page.evaluate(() => window.__HARNESS.getUIState().mode);
    if (m === 'inventory') break;
    await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true, cancelable: true })));
    await h.h('stepFrames', 2);
    await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm', bubbles: true })));
    await h.h('stepFrames', 2);
  }
  const before = await h.page.evaluate(() => ({ mode: window.__HARNESS.getUIState().mode, hud: window.__HARNESS.getUIState().hud.mode }));

  await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', key: 'g', bubbles: true, cancelable: true })));
  out.steps.push({ at: 'after keydown', ...(await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return { hold: e.real._holds && e.real._holds.KeyG ? { ...e.real._holds.KeyG, gate: { ...e.real._holds.KeyG.gate } } : null, pendingPress: e.input.pendingPress, frame: window.__HARNESS.getFrame() };
  })) });
  await h.h('stepFrames', 20);            // 20 f@60 — well past the 12-frame gate
  out.steps.push({ at: 'after 20 fixed steps, still down', ...(await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return { hold: e.real._holds && e.real._holds.KeyG ? { fired: e.real._holds.KeyG.fired, tDown: e.real._holds.KeyG.tDown } : null, pendingPress: e.input.pendingPress, frame: window.__HARNESS.getFrame() };
  })) });
  await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG', key: 'g', bubbles: true })));
  out.steps.push({ at: 'immediately after keyup, before any step', ...(await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return { pendingPress: e.input.pendingPress, edges: window.__HARNESS.getInputEdges ? window.__HARNESS.getInputEdges().slice(-6) : null, frame: window.__HARNESS.getFrame() };
  })) });
  await h.h('stepFrames', 1);
  out.steps.push({ at: 'after 1 step', ...(await h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    return { edges: window.__HARNESS.getInputEdges ? window.__HARNESS.getInputEdges().slice(-6) : null, hud: s.hud.mode, mode: s.mode };
  })) });
  await h.h('stepFrames', 6);
  const after = await h.page.evaluate(() => ({ mode: window.__HARNESS.getUIState().mode, hud: window.__HARNESS.getUIState().hud.mode }));
  out.before = before; out.after = after;

  const held = out.steps[1] && out.steps[1].hold;
  push('TH1 the hold record survives 20 fixed steps and the gate is reached',
    !!held, `hold record after 20 steps: ${JSON.stringify(held)}; gate frames ${JSON.stringify(out.steps[0].hold && out.steps[0].hold.gate)}`);
  push('TH2 a 20 f@60 hold of KeyG switches the HUD mode',
    before.hud !== after.hud, `hud.mode ${before.hud} -> ${after.hud} on mode '${after.mode}'; ` +
    `pendingPress after keyup = ${out.steps[2].pendingPress}; edges after 1 step = ${JSON.stringify(out.steps[3].edges)}`);

  // ---- the pictures the last run could not take (screenshot timed out under load) -------------
  for (const [name, prep, note] of [
    ['critic-inventory', null, 'the inventory as a player reaches it: `menu` from the world, nothing else pressed'],
    ['critic-journal-chronicle', 'journal', 'the journal on arrival — the chronicle'],
    ['critic-journal-stuck-search', 'search', 'the SAME journal after ONE press of confirm: `focus.journal.view` is `search`, and no action in the closed set returns it'],
    ['critic-world-hud', 'world', 'the world HUD out of combat — the world set on the bottom rail'],
  ]) {
    if (prep === 'journal' || prep === 'search') {
      for (let i = 0; i < 10; i++) {
        const m = await h.page.evaluate(() => window.__HARNESS.getUIState().mode);
        if (m === 'journal') break;
        const code = m === 'world' ? 'KeyM' : 'Digit3';
        await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: 'x', bubbles: true, cancelable: true })), code);
        await h.h('stepFrames', 2);
        await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit3', key: 'x', bubbles: true })));
        await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM', key: 'm', bubbles: true })));
        await h.h('stepFrames', 2);
      }
    }
    if (prep === 'search') {
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true, cancelable: true })));
      await h.h('stepFrames', 2);
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true })));
      await h.h('stepFrames', 2);
    }
    if (prep === 'world') {
      await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
      await h.h('stepFrames', 4);
    }
    await h.h('renderFrame');
    const st = await h.page.evaluate(() => { const s = window.__HARNESS.getUIState(); return { mode: s.mode, focus: s.focus }; });
    try {
      const b = await h.page.screenshot({ type: 'png', timeout: 120000 });
      const p = path.join(ROOT, 'screens', `${name}__1920x1080.png`);
      fs.writeFileSync(p, b);
      log(`  shot ${name}: ${JSON.stringify(st)}`);
      (out.shots = out.shots || []).push({ file: path.relative(REPO_ROOT, p), note, state: st, resolution: '1920x1080', dpr: 1, camera_pose: 'menu overlay over the fixture world camera; no orbit — the subject is a 2D surface' });
    } catch (e) { (out.shots = out.shots || []).push({ file: null, note, state: st, error: String(e.message || e) }); }
  }

  fs.writeFileSync(path.join(ROOT, 'reports', 'twohand-and-shots.json'), JSON.stringify(out, null, 2));
  exit = out.checks.every((c) => c.pass) ? 0 : 1;
} catch (e) {
  out.error = String(e && e.stack || e);
  fs.writeFileSync(path.join(ROOT, 'reports', 'twohand-and-shots.json'), JSON.stringify(out, null, 2));
  log(`could not run: ${e && e.message || e}`);
  exit = 2;
} finally { await h.close(); }
process.exit(exit);

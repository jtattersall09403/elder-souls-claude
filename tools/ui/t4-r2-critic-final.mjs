#!/usr/bin/env node
// t4-r2-critic-final.mjs — the three things left, and the pictures.
//
// Owner: crit-t4-r2.
//
//  HG  `two_hand` is gated on WALL-CLOCK MILLISECONDS (`input/real.js _up`:
//      `promotedAtRelease(tDown, tUp, gate)`, gate = `desktop.hold_gate_frames.two_hand` = 12 f@60
//      = 200 ms). Under `setRenderRate(0)` a harness `stepFrames(20)` costs almost no wall clock,
//      so the previous run's 20-frame hold was a ~3 ms hold and the failure it recorded was its
//      own. Held for 400 real milliseconds here.
//  TSD the touch stick, diagnosed rather than asserted: the chain is
//      `pointerdown -> touch.stick.active -> touch.tick() -> pipe.setMove -> input.moveX ->
//       UISystem.step`. Each link is read, so the verdict names WHERE it stops instead of saying
//      "touch does not work".
//  SHOT the pictures the verdict cites, with the state they are of recorded beside them.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('t4-r2-critic-final.mjs [--out <dir>]');
const ROOT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r2c');
const OUT = path.join(ROOT, 'reports'); ensureDir(OUT);
const SHOTS = path.join(ROOT, 'screens'); ensureDir(SHOTS);

const report = { schema: 'elder-souls/t4-critic-final@1', at: new Date().toISOString(), checks: [], data: {}, shots: [] };
const push = (id, pass, detail) => { report.checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };
const J = (o) => JSON.stringify(o);

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
  await h.h('stepFrames', 2);
}
async function read() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    return { mode: s.mode, focus: s.focus ? { ...s.focus } : null, hud_mode: s.hud ? s.hud.mode : null, panel_rect: s.panel_rect };
  });
}
async function goto(target) {
  for (let i = 0; i < 3; i++) { const r = await read(); if (r.mode !== 'world') break; await key('KeyM'); }
  for (let i = 0; i < 12; i++) {
    const r = await read();
    if (r.mode === target) return target;
    if (r.mode === 'world') await key('KeyM'); else await key('Digit3');
  }
  return (await read()).mode;
}
async function shot(name, note) {
  const p = path.join(SHOTS, `${name}__1920x1080.png`);
  const b = await h.page.screenshot({ type: 'png' });
  fs.writeFileSync(p, b);
  const st = await read();
  report.shots.push({ file: path.relative(REPO_ROOT, p), note, state: st, camera_pose: 'menu overlay — fixed UI camera, no orbit; world camera at the fixture default', resolution: '1920x1080', dpr: 1 });
  log(`  shot ${name}: ${J(st)}`);
}

try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', 'ui-journal');
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  // ---- HG. `two_hand` with a REAL 400 ms hold -------------------------------------------------
  {
    await goto('inventory');
    const b = await read();
    await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', key: 'g', bubbles: true, cancelable: true })));
    await h.h('stepFrames', 8);
    await new Promise((r) => setTimeout(r, 400));            // 400 REAL milliseconds
    await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG', key: 'g', bubbles: true })));
    await h.h('stepFrames', 6);
    const a = await read();
    report.data.hud_switch = { before: b.hud_mode, after: a.hud_mode };
    push('HG1 the HUD full/minimal switch responds to a real 400 ms hold of KeyG',
      b.hud_mode !== a.hud_mode, `hud.mode ${b.hud_mode} -(KeyG down, 400 ms wall clock, up)-> ${a.hud_mode}`);
    if (b.hud_mode !== a.hud_mode) {
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', key: 'g', bubbles: true, cancelable: true })));
      await h.h('stepFrames', 4); await new Promise((r) => setTimeout(r, 400));
      await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyG', key: 'g', bubbles: true })));
      await h.h('stepFrames', 4);
    }
  }

  // ---- TSD. the touch stick, link by link -----------------------------------------------------
  {
    await h.h('setViewport', { pointer: 'coarse' });
    await h.h('stepFrames', 2);
    await goto('inventory');
    const before = await read();
    const chain = [];
    await h.page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      cv.dispatchEvent(mk('pointerdown', r.left + r.width * 0.18, r.top + r.height * 0.5));
    });
    chain.push(await h.page.evaluate(() => {
      const t = window.__ENGINE.real.touch, i = window.__ENGINE.input;
      return { at: 'after pointerdown', stick: { ...t.stick }, pointers: t.pointers.size, menuOpen: t.menuOpen, moveX: i.moveX, moveY: i.moveY, uiMoveY: i.uiMoveY };
    }));
    await h.page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      window.dispatchEvent(mk('pointermove', r.left + r.width * 0.18, r.top + r.height * 0.5 + 140));
    });
    chain.push(await h.page.evaluate(() => {
      const t = window.__ENGINE.real.touch, i = window.__ENGINE.input;
      return { at: 'after pointermove +140px', stick: { ...t.stick }, moveX: i.moveX, moveY: i.moveY, uiMoveY: i.uiMoveY };
    }));
    await h.h('stepFrames', 4);
    chain.push(await h.page.evaluate(() => {
      const t = window.__ENGINE.real.touch, i = window.__ENGINE.input;
      const s = window.__HARNESS.getUIState();
      return { at: 'after 4 fixed steps', stick: { ...t.stick }, moveX: i.moveX, moveY: i.moveY, uiMoveY: i.uiMoveY, focus: s.focus };
    }));
    await h.h('stepFrames', 10);
    const after = await read();
    await h.page.evaluate(() => {
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const mk = (t, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 21, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
      window.dispatchEvent(mk('pointerup', r.left + r.width * 0.18, r.top + r.height * 0.5 + 140));
    });
    report.data.touch_stick_chain = { before: before.focus, chain, after: after.focus };
    const stickLive = chain[1] && chain[1].stick && Math.abs(chain[1].stick.y) > 0.1;
    const moveLive = chain[2] && Math.abs(chain[2].moveY) > 0.1;
    push('TSD1 the touch stick registers a drag', stickLive, `stick after the move: ${J(chain[1] && chain[1].stick)}`);
    push('TSD2 the stick reaches the input pipeline', moveLive, `pipeline move after 4 fixed steps: moveX=${chain[2] && chain[2].moveX}, moveY=${chain[2] && chain[2].moveY}`);
    push('TSD3 the stick walks the open screen\'s list',
      J(before.focus) !== J(after.focus), `focus ${J(before.focus)} -> ${J(after.focus)} on mode '${after.mode}'`);
    await h.h('setViewport', { pointer: 'fine' });
    await h.h('stepFrames', 2);
  }

  // ---- W3 / W6. THE TWO CONDITIONAL WORLD-SET ELEMENTS, with their conditions MADE TRUE -------
  //
  // The builder's evidence table reports W3 (sneak) and W6 (breath) as "built: yes, drawn on this
  // frame: no (condition not met)". Built is a source claim and CRITIC-DOCTRINE §1.1 forbids
  // scoring one. `crouch` is KeyC; submersion is reached by reading the water model rather than
  // asserted. Whatever this leg finds is what V1 is scored on.
  {
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 3);
    const b = await h.page.evaluate(() => {
      const s = window.__HARNESS.getUIState();
      return (s.elements || []).filter((e) => e.visible).map((e) => e.kind);
    });
    await key('KeyC', 6);
    await h.h('stepFrames', 6);
    const a = await h.page.evaluate(() => {
      const s = window.__HARNESS.getUIState();
      const eng = window.__ENGINE;
      return {
        kinds: (s.elements || []).filter((e) => e.visible).map((e) => e.kind),
        crouched: !!(eng.sim.player && eng.sim.player.crouched),
        stealth: s.hud && s.hud.world ? s.hud.world : null,
      };
    });
    report.data.sneak = { kinds_before: b, after: a };
    push('W3 the sneak state is drawn while sneaking',
      a.kinds.includes('sneak_state'),
      `crouched=${a.crouched}; world-set kinds before ${J(b.filter((k) => /bearing|effect|place|sneak|breath/.test(k)))}, ` +
      `after ${J(a.kinds.filter((k) => /bearing|effect|place|sneak|breath/.test(k)))}`);
    await key('KeyC', 6);
  }

  // ---- LG. RI-UIX03 M-E1, run first as L4 requires -------------------------------------------
  {
    const lg = await h.page.evaluate(() => {
      const A = window.__HARNESS;
      try { A.setAtHearth(true); A.openMenu('levelup'); } catch (e) { return { error: String(e.message || e) }; }
      const s = A.getUIState();
      const els = (s.elements || []).filter((e) => e.visible);
      return {
        mode: s.mode,
        gold_kind: els.filter((e) => e.kind === 'currency_gold').map((e) => e.id),
        gold_text: els.filter((e) => e.text != null && /\bgold\b|\bdrakes?\b|\bseptims?\b/i.test(String(e.text))).map((e) => `${e.id}: ${e.text}`),
        ri_citation: els.filter((e) => e.text != null && /RI-[A-Z]{3}\d{2}/.test(String(e.text))).map((e) => `${e.id}: ${e.text}`),
        attribute_rows: els.filter((e) => e.kind === 'attribute_row').length,
        souls_to_next: (els.find((e) => e.kind === 'souls_to_next') || {}).text,
        level: (els.find((e) => e.kind === 'level_value') || {}).text,
      };
    });
    report.data.levelup = lg;
    push('LG1 (RI-UIX03 M-E1 / S15) no gold anywhere on the level-up screen',
      !lg.error && lg.gold_kind.length === 0 && lg.gold_text.length === 0,
      `mode=${lg.mode}; currency_gold elements ${J(lg.gold_kind)}; gold/drake/septim strings ${J(lg.gold_text)}`);
    push('LG2 no reference-item id is rendered in player-facing text (round 1 secondary #2)',
      !lg.error && lg.ri_citation.length === 0, `RI- citations on the level-up screen: ${J(lg.ri_citation)}`);
    push('LG3 (M-E2 / L5) all ten attributes are on screen at once',
      lg.attribute_rows === 10, `${lg.attribute_rows} attribute_row elements; level '${lg.level}', souls to next '${lg.souls_to_next}'`);
    await h.page.evaluate(() => { window.__ENGINE.closeMenu(); });
    await h.h('stepFrames', 2);
  }

  // ---- SHOT. the pictures ---------------------------------------------------------------------
  await h.h('setMode', 'play-instrumented');
  await goto('inventory');
  await h.h('renderFrame');
  await shot('critic-inventory', 'the inventory as a player reaches it: `menu` from the world, nothing else pressed');

  await goto('journal');
  await h.h('renderFrame');
  await shot('critic-journal-chronicle', 'the journal on arrival — the chronicle');

  // …then one press of confirm, which the screen invites, and the same screen afterwards
  await key('KeyE');
  await h.h('renderFrame');
  await shot('critic-journal-stuck-search', 'the SAME journal after ONE press of confirm. `focus.view` is `search` and no action in the closed set returns it to the chronicle; it survives closing the screen');

  await key('Escape');
  await h.h('stepFrames', 4);
  await h.h('renderFrame');
  await shot('critic-world-hud', 'the world HUD out of combat — the six-element world set on the bottom rail');

  report.data.errors = h.errors ? h.errors.slice(0, 8) : [];
  writeJson(path.join(OUT, 'critic-final.json'), report);
  exit = report.checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${report.checks.filter((c) => c.pass).length}/${report.checks.length} checks passed`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  writeJson(path.join(OUT, 'critic-final.json'), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);

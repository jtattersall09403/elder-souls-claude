#!/usr/bin/env node
// dialogue-input-diag.mjs — where does a real key press die on its way to the dialogue window?
// Throwaway diagnostic for W1-UIX08-INPUT-FIX. Not a check; it prints a trace.
'use strict';
import { launchGame } from '../lib/browser.mjs';
import { log } from '../lib/cli.mjs';

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
try {
  await h.h('setRenderRate', 60);
  await h.h('loadState', 'helstrom-market');
  await h.h('stepFrames', 4);

  const boot = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    return {
      has_real: !!eng.real,
      real_attached: !!(eng.real && eng.real.attached),
      has_input: !!eng.input,
      input_ctor: eng.input && eng.input.constructor && eng.input.constructor.name,
      mode: eng.ui && eng.ui.mode,
      isMenu: eng.ui && eng.ui.isMenu(),
      has_censusDriver: !!eng.sim.censusDriver,
      has_uiDriver: !!eng.sim.uiDriver,
      censusSurface_open: !!(eng.censusSurface && eng.censusSurface.open),
      censusSurface_takesInput: !!(eng.censusSurface && eng.censusSurface.takesInput),
    };
  });
  log('boot: ' + JSON.stringify(boot, null, 1));

  // Instrument: wrap the pipeline so we can see what a real key press produces at latch time.
  await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    window.__TRACE = [];
    const pipe = eng.input;
    const origLatch = pipe.latchForStep.bind(pipe);
    pipe.latchForStep = function (frame) {
      const r = origLatch(frame);
      window.__TRACE.push({ at: 'latch', frame, pressed: pipe.pressedNames().slice(), moveX: pipe.moveX, moveY: pipe.moveY, uiMoveX: pipe.uiMoveX, uiMoveY: pipe.uiMoveY });
      return r;
    };
    const origConsume = pipe.consumeUI.bind(pipe);
    pipe.consumeUI = function (names) {
      window.__TRACE.push({ at: 'consumeUI', names: names.slice(), stack: (new Error()).stack.split('\n').slice(2, 5).join(' | ') });
      return origConsume(names);
    };
    const ui = eng.ui;
    const origDlg = ui.dialogueStep.bind(ui);
    ui.dialogueStep = function (input, ctx) {
      const out = origDlg(input, ctx);
      window.__TRACE.push({ at: 'dialogueStep', moveX: input.moveX, moveY: input.moveY, pressed: input.pressedNames().slice(), out, focus: JSON.parse(JSON.stringify(ui.dialogueFocus)) });
      return out;
    };
    const origConv = eng._conversationStep.bind(eng);
    eng._conversationStep = function (input) { window.__TRACE.push({ at: '_conversationStep' }); return origConv(input); };
    const origCensus = eng._censusStep.bind(eng);
    eng._censusStep = function (input) { window.__TRACE.push({ at: '_censusStep' }); return origCensus(input); };
  });

  const opened = await h.page.evaluate(() => {
    const A = window.__HARNESS;
    try { A.closeMenu(); } catch { /* */ }
    let best = null;
    for (const n of A.listNPCs()) {
      const st = A.talkTo(n.eid);
      if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
    }
    if (best) A.talkTo(best.eid);
    return best;
  });
  await h.h('stepFrames', 3);
  log('opened: ' + JSON.stringify(opened));

  await h.page.evaluate(() => { window.__TRACE = []; });
  await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true })));
  const afterEvent = await h.page.evaluate(() => {
    const p = window.__ENGINE.input;
    return { moveX: p.moveX, moveY: p.moveY, pendingPress: p.pendingPress, moveDirs: window.__ENGINE.real ? { ...window.__ENGINE.real.moveDirs } : null };
  });
  log('after dispatch, before step: ' + JSON.stringify(afterEvent));
  await h.h('stepFrames', 2);
  let trace = await h.page.evaluate(() => window.__TRACE.slice(0, 40));
  log('TRACE (ArrowRight):\n' + trace.map((t) => JSON.stringify(t)).join('\n'));

  await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true })));
  await h.h('stepFrames', 2);

  // Now KeyE
  await h.page.evaluate(() => { window.__TRACE = []; });
  await h.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true, cancelable: true })));
  const afterE = await h.page.evaluate(() => {
    const p = window.__ENGINE.input;
    return { pendingPress: p.pendingPress, heldNames: p.heldNames().slice() };
  });
  log('after KeyE dispatch: ' + JSON.stringify(afterE));
  await h.h('stepFrames', 2);
  trace = await h.page.evaluate(() => window.__TRACE.slice(0, 40));
  log('TRACE (KeyE):\n' + trace.map((t) => JSON.stringify(t)).join('\n'));
} catch (e) {
  log('diag failed: ' + (e && e.stack || e));
} finally {
  await h.close();
}
process.exit(0);

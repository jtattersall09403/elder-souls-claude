#!/usr/bin/env node
/**
 * critic-w1-13-r2-c.mjs — W1-13 round-2 CRITIC probe C. BREAK THE INSTRUMENTS ON PURPOSE.
 *
 * The round-2 builder's best finding was about instruments: `Engine._step()` returns early
 * while a screen is open outside combat, `loadState()` does not close one, and so a screen left
 * open upstream froze every block of `jrn06-death.mjs` while it printed nineteen `[OK]` lines
 * against twenty deaths that produced no death. It says the journey now closes what is up and
 * REFUSES TO MEASURE otherwise. AGENT-PROTOCOL: a probe that cannot fail is worse than no probe.
 * So this probe breaks the gate on purpose and checks that it goes red.
 *
 *   C1. THE GATE, ARMED. Open a screen; run the gate's own sequence; confirm it closes it and
 *       the world advances 5.
 *   C2. THE GATE, DISARMED. Stub `closeMenu()` to a no-op in the page, then run the same
 *       sequence. The gate must report advanced !== 5 and refuse. If it still reports 5 the
 *       gate is measuring nothing.
 *   C3. THE GATE'S BLIND SPOT. `Engine._step()` pauses on an open screen OUTSIDE COMBAT. Put
 *       the world IN COMBAT with a screen open: the world runs, the gate passes — and the
 *       question is whether anything else the item measures is still frozen.
 *   C4. SIBLING JOURNEYS. Do the other per-journey modules carry the same assumption? Measured
 *       by leaving a screen open and asking each what it reports.
 *   C5. THE LEDGER SURFACE. Does a check with pass:false reach the ledger as anything other
 *       than `ok`? Read the record `put()` writes.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r2-c.mjs [--out <file>]'); process.exit(0); }
const out = { schema: 'critic/w1-13-r2-c@1', taken_at: new Date().toISOString() };
let handle;

// The gate, lifted verbatim in shape from tools/journey/jrn06-death.mjs's own block so that
// what is under test is the build's behaviour and not a paraphrase of it.
const GATE = `(async () => {
  const H = window.__HARNESS;
  const before = H.getUIState();
  if (before.mode && before.mode !== 'world') { try { await H.closeMenu(); } catch (e) {} }
  const after = H.getUIState();
  const frameOf = (r) => (typeof r === 'number' ? r : (r && typeof r.frame === 'number' ? r.frame : NaN));
  const f0 = frameOf(H.getFrame());
  H.stepFrames(5);
  const f1 = frameOf(H.getFrame());
  return { ui_mode_on_entry: before.mode, ui_mode_after_close: after.mode,
           frame_before: f0, frame_after: f1, advanced: f1 - f0,
           gate_would_refuse: (f1 - f0) !== 5 };
})()`;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---- C1: the gate, armed -------------------------------------------------------------
  out.c1_gate_armed = await h.page.evaluate(async (src) => {
    const H = window.__HARNESS;
    H.loadState('arena_flat'); H.setRenderRate(0); H.stepFrames(2);
    H.openMenu('inventory');
    // the world is now stopped: show it before the gate runs
    const f0 = H.getFrame(); H.stepFrames(10); const f1 = H.getFrame();
    const frozen = { advanced_with_the_screen_up: (typeof f1 === 'number' ? f1 : f1.frame) - (typeof f0 === 'number' ? f0 : f0.frame) };
    // eslint-disable-next-line no-eval
    const gate = await eval(src);
    return { frozen, gate, verdict: gate.advanced === 5 && !gate.gate_would_refuse ? 'gate recovered the world' : 'gate refused' };
  }, GATE);
  log('C1 ' + JSON.stringify(out.c1_gate_armed));

  // ---- C2: the gate, disarmed ------------------------------------------------------------
  out.c2_gate_disarmed = await h.page.evaluate(async (src) => {
    const H = window.__HARNESS;
    H.loadState('arena_flat'); H.setRenderRate(0); H.stepFrames(2);
    const real = H.closeMenu;
    H.closeMenu = () => 'inventory';          // the sabotage: it lies and does nothing
    H.openMenu('inventory');
    // eslint-disable-next-line no-eval
    const gate = await eval(src);
    H.closeMenu = real;
    try { H.closeMenu(); } catch (e) {}
    return { gate, instrument_went_red: gate.gate_would_refuse === true };
  }, GATE);
  log('C2 ' + JSON.stringify(out.c2_gate_disarmed));

  // ---- C3: the gate's blind spot — a screen open DURING a fight --------------------------
  out.c3_in_combat = await h.page.evaluate(async (src) => {
    const H = window.__HARNESS;
    H.loadState('arena_flat'); H.setRenderRate(0);
    H.spawn('inf_trash', 3, 3, { as: 'c3-mob' });
    H.aggro('c3-mob');
    H.stepFrames(30);
    const inCombat = H.getPlayerStats().in_combat;
    H.openMenu('inventory');
    const f0 = H.getFrame(); H.stepFrames(10); const f1 = H.getFrame();
    const adv = (typeof f1 === 'number' ? f1 : f1.frame) - (typeof f0 === 'number' ? f0 : f0.frame);
    // eslint-disable-next-line no-eval
    const gate = await eval(src);
    const mode = H.getUIState().mode;
    return {
      in_combat: inCombat,
      advanced_with_the_screen_up_in_combat: adv,
      gate, ui_mode_after_gate: mode,
      note: 'if the world runs while the screen is up, the gate PASSES with the screen still up',
    };
  }, GATE);
  log('C3 ' + JSON.stringify(out.c3_in_combat));

  // ---- C4: do the other journeys stop when a screen is left open? -------------------------
  out.c4_sibling_exposure = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const res = [];
    for (const state of ['arena_flat', 'settlement_primary_street', 'barge-hold']) {
      for (const screen of ['inventory', 'journal', 'sheet', 'map']) {
        try {
          H.loadState(state); H.setRenderRate(0); H.stepFrames(2);
          H.openMenu(screen);
          const f0 = H.getFrame();
          H.stepFrames(10);
          const f1 = H.getFrame();
          const n = (x) => (typeof x === 'number' ? x : x.frame);
          // and does loadState rescue it?
          H.loadState(state);
          const g0 = H.getFrame(); H.stepFrames(10); const g1 = H.getFrame();
          res.push({
            state, screen,
            advanced_with_screen_open: n(f1) - n(f0),
            mode_after_loadState: H.getUIState().mode,
            advanced_after_loadState: n(g1) - n(g0),
          });
          H.closeMenu();
        } catch (e) { res.push({ state, screen, threw: String(e.message || e) }); }
      }
    }
    return res;
  });
  log('C4 done');

  // ---- C5: what does a FAILING check look like in the ledger? -----------------------------
  // Read the shape jrn06's put() writes, from the real journey artifact if one is on disk.
  out.c5_note = 'see reports/journeys/*/journey.json instruments[].status for a check whose value.pass is false';

  out.page_errors = handle.pageErrors ? handle.pageErrors.slice() : [];
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  log('FATAL ' + out.fatal);
} finally {
  if (handle && handle.close) await handle.close();
}
writeJson(String(args.out || 'reports/runs/critic-W1-13-R2/probe-c.json'), out);
log('written');

#!/usr/bin/env node
// critic-w1-26-r4-fleet.mjs — IS THE THROW A FIX OR A FLEET HAZARD, AND DOES THE CONTROL BITE?
//
// Owner: the W1-26 round-4 CRITIC. Declared under `method_deviations`. One browser, kept.
//
// ---- D. RULE 13 ------------------------------------------------------------------------------
// `Engine.bodyRace()` now throws. Rule 13: never land a fail-closed assertion before the data it
// demands exists, because every agent boot-checks and a throwing engine is everyone's problem.
// The one call site in `game/src/` is `censusBegin()`, and `censusBegin` is reached from
// `_titleApply('new')` — which is applied from **`_afterStep()`, inside the frame loop**
// (`this.loop.afterStep = () => this._afterStep()`), with no try/catch anywhere on the path.
// So the question is not "does it throw" but "what does the frame loop do when it does".
//
//   D1  SHIPPED TREE, SILENT. Boot, press New the way the player does, and confirm no throw.
//   D2  THE LOAD PATH. `save/state.js` :610 writes `sim.identity.race` from the blob with NO
//       validation, and `_applyStartingBody()` runs once at boot and never again. So: load a
//       save carrying a race this build does not know — which is what EVERY save written before
//       W1-26 r3 carries, because `sim/state.js` defaulted `identity.race` to `'argonian'` and
//       `argonian` is a boolean TAG here, not an id — then quit to menu and press New. Does the
//       frame loop survive?
//   D3  THE ACCESSOR SIDE. Enumerate every harness verb that can reach `bodyRace()` and confirm
//       the split left none on the throwing side.
//   D4  THE NEIGHBOURS. `raceTerm()` (`sim/dialogue/disposition.js`) reads the same field and
//       NEXT-DISPATCH §Q17 says 179 of 347 NPC records carry a race it cannot resolve. Does the
//       new throw fire anywhere those records are read?
//
// ---- C. THE TWO INERT CONTROLS -----------------------------------------------------------------
// The builder found `--still-fire-a-field` inert, and fixed it by changing TWO things at once:
// the SABOTAGE (censusBegin alone -> begin + enter + answer) and the READER (trace-only ->
// trace + entity-side `asked_while_still`). Rule 6's fourth shape is exactly this: two changes
// for one defect, where honest reporting looks like an inert fix. The builder measured three
// cells of the 2x2 and not the fourth.
//
//   C1  Old sabotage (censusBegin({}) alone) against the NEW reader. If that is already red,
//       the sabotage change was not what made the control bite and the round's account of it is
//       incomplete.
//   C2  What the entity-side reader actually keys on, sampled at the frame the old sabotage
//       lands: `census_open` (surface drawn / takes input) and `character_written`
//       (race_observed || done).
//
// ---- G. CONSUMPTION (RI-MTH07) AT MORE THAN ONE INSTANT (rule 8) --------------------------------
// The model is the race the scribe observes. Perturbed on the running world (never as an
// argument), through the row a player commits to, and read at TWO instants: the frame the scene
// opens, and 600 frames of let-the-world-run later. A number taken at one instant is a still
// target in time.
//
// EXIT: non-zero if the throw kills a frame loop on any path a player can reach, if the still
// control does not bite, or if consumption does not couple at both instants.
//
// USAGE
//   node tools/journey/critic-w1-26-r4-fleet.mjs [--json <path>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-26-r4-fleet.mjs — rule 13 on the new throw, the still control's missing 2x2 cell,
and consumption at two instants.

USAGE
  node tools/journey/critic-w1-26-r4-fleet.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json))
  : path.join(REPORTS_DIR, 'critic-w1-26-r4', 'fleet.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };

const out = {
  schema: 'elder-souls/critic-fleet@1', piece: 'W1-26-r4', role: 'critic',
  commit: (gitInfo() || {}).commit || null,
  conditions: { loadavg_at_start: loadavg(), viewport: '960x540' },
  passes: [], failures: [], checks: {},
};
const pass = (id, what, d) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };

const handle = await launchGame({ width: 960, height: 540 });
say(`  browser up — ${handle.url}`);

async function ready(p = handle.page) {
  await p.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE), null, { timeout: 90000 });
}
await ready();

// A single evaluate helper, so every arm runs in the page and nothing is inferred Node-side.
const ev = (fn, arg) => handle.page.evaluate(fn, arg);

/**
 * A FRESH ENGINE, because `__HARNESS.reset()` does not clear the census.
 *
 * MEASURED, and it cost this file a wrong reading: the first run of section C reported the
 * UNTORN arm already `character_written: true` after `reset()`, which would have said the still
 * window cannot discriminate at all. It was contamination from sections D1/D2, which had opened
 * the census — `reset()` resets the sim, `Engine.census.spec` survives it. A `goto` reboots the
 * page and is the only clean arm.
 */
async function reboot() {
  await handle.page.goto(handle.url, { waitUntil: 'load', timeout: 90000 });
  await ready();
}

// =============================================================================================
// D1 — the shipped tree is silent
// =============================================================================================
say('');
say('D1. THE SHIPPED BODY, THROUGH THE ROW A PLAYER COMMITS TO.');
const d1 = await ev(() => {
  const e = window.__ENGINE;
  const r = { boot_race: e.sim.identity.race, raw: null, threw: null, node: null, loop_alive: null };
  try { r.raw = e._bodyRaceRaw(); } catch (err) { r.threw = 'raw:' + String(err && err.message); }
  const before = e.sim.frame;
  try {
    window.__HARNESS.titleShow();
    window.__HARNESS.titleActivate('new');
    window.__HARNESS.stepFrames(20);
    const st = window.__HARNESS.getCensusState();
    r.node = st && st.node;
  } catch (err) { r.threw = String(err && err.message || err); }
  r.frames_advanced = e.sim.frame - before;
  r.loop_alive = r.frames_advanced > 0;
  return r;
});
out.checks.D1_detail = d1;
if (!d1.threw && d1.loop_alive && d1.node) {
  pass('D1', `shipped body '${d1.boot_race}' — no throw, scene opened at '${d1.node}', ${d1.frames_advanced} frames advanced. The assertion is silent on the shipped tree (rule 13's precondition).`, d1);
} else {
  fail('D1', `shipped body threw or the loop stopped: ${JSON.stringify(d1)}`, d1);
}

// =============================================================================================
// D2 — the load path, and what the frame loop does
// =============================================================================================
say('');
say('D2. A SAVE CARRYING A RACE THIS BUILD DOES NOT KNOW, THEN `New`.');
say('    `save/state.js` :610 writes sim.identity.race from the blob unvalidated.');
say('    Every save written before W1-26 r3 carries `argonian` (sim/state.js default).');
await reboot();
const d2 = await ev(async () => {
  const e = window.__ENGINE;
  const H = window.__HARNESS;
  const r = { steps: [] };
  const note = (k, v) => r.steps.push({ [k]: v });
  // The page was just rebooted, so the world is already clean. `H.reset()` is NOT used here:
  // measured, it leaves `engine.renderer` null and the next `titleShow()` dies on
  // `this.renderer.title` — which would have been reported as the throw under test.
  // (a) a save round trip that carries the bad race. Use the real save/load path, not a poke.
  r.race_before_save = e.sim.identity.race;
  e.sim.identity.race = 'argonian';         // what a pre-r3 save's blob holds
  let blob = null;
  try { blob = H.saveState ? H.saveState() : null; } catch (err) { r.save_threw = String(err && err.message); }
  note('saved', !!blob);
  // Put a legal race back, then restore the blob — so the ONLY thing that puts the bad race on
  // the world is the load path itself.
  e.sim.identity.race = 'saxhleel';
  try {
    if (blob && H.restoreState) H.restoreState(blob);
    else if (blob && H.loadState) H.loadState(blob);
  } catch (err) { r.restore_threw = String(err && err.message); }
  r.race_after_load = e.sim.identity.race;
  r.load_validated = r.race_after_load !== 'argonian';
  // (b) accessors must still answer
  try { r.raw_after_load = e._bodyRaceRaw(); } catch (err) { r.raw_threw = String(err && err.message); }
  try { r.census_state_readable = !!H.getCensusState(); r.body_race_fault = (H.getCensusState() || {}).body_race_fault; }
  catch (err) { r.census_state_threw = String(err && err.message); }
  // (c) now press New the way a player does — through the title, applied in _afterStep.
  const before = e.sim.frame;
  try {
    H.titleShow();
    H.titleActivate('new');
    r.title_activate_threw = null;
  } catch (err) { r.title_activate_threw = String(err && err.message || err); }
  // step the loop; the commit is applied in _afterStep
  try { H.stepFrames(20); r.step_threw = null; } catch (err) { r.step_threw = String(err && err.message || err); }
  r.frames_advanced = e.sim.frame - before;
  r.loop_alive_after = r.frames_advanced > 0;
  try { r.node_after = (H.getCensusState() || {}).node; } catch (err) { r.node_after_threw = String(err && err.message); }
  return r;
});
out.checks.D2_detail = d2;
const d2Threw = d2.title_activate_threw || d2.step_threw;
if (!d2.load_validated && d2Threw) {
  fail('D2', `THE LOAD PATH IS UNGUARDED AND THE THROW IS REACHABLE FROM IT. A save carrying '${d2.race_after_load}' loads without validation, and the next 'New' throws out of the frame loop: ${JSON.stringify(d2Threw).slice(0, 200)}`, d2);
} else if (!d2.load_validated && !d2Threw) {
  pass('D2', `a save carrying '${d2.race_after_load}' loads unvalidated, but pressing New did not throw out of the loop (frames advanced ${d2.frames_advanced}, node ${JSON.stringify(d2.node_after)}) — record where it went instead`, d2);
} else {
  pass('D2', `the load path rejected or normalised the bad race (race after load: ${JSON.stringify(d2.race_after_load)})`, d2);
}

// =============================================================================================
// D2b — THE PLAYER'S PATH, not the harness's. `titleActivate()` is a synchronous harness call;
// a player's Enter latches `_titlePending` and it is applied from `_afterStep()`, INSIDE the
// frame loop, with no try/catch anywhere on the path. This is the arm rule 13 is about.
// =============================================================================================
say('');
say('D2b. THE SAME BAD BODY, COMMITTED BY A REAL `Enter` UNDER rAF, IN PLAY MODE.');
say('    A second PAGE on the SAME browser (rule 21: one browser, kept), booted the way a');
say('    human boots it — `navigator.webdriver` forced false so `main.js` resolves mode');
say("    'play', where the sim advances only from requestAnimationFrame and `_titleApply` is");
say('    reached from `_afterStep()` inside the frame loop.');
const playCtx = await handle.browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'en-GB', timezoneId: 'UTC' });
const playPage = await playCtx.newPage();
// On the PAGE, not the context — the same call `opening-play.mjs` makes, so this arm boots the
// way a human's browser boots. `main.js` :16 picks harness mode from `navigator.webdriver`.
await playPage.addInitScript("Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});");
const playErrors = [];
playPage.on('pageerror', (e) => playErrors.push({ message: String(e && e.message || e).slice(0, 300) }));
const pev = (fn, arg) => playPage.evaluate(fn, arg);
async function playBoot() {
  await playPage.goto(handle.url, { waitUntil: 'load', timeout: 90000 });
  await playPage.waitForFunction(() => !!(window.__HARNESS && typeof window.__HARNESS.ready === 'function'), null, { timeout: 90000 });
  await pev(() => window.__HARNESS.ready());
  return pev(() => ({ mode: window.__ENGINE.mode, webdriver: navigator.webdriver, frame: window.__ENGINE.sim.frame }));
}
const playBootInfo = await playBoot();
say(`    booted: mode=${playBootInfo.mode} navigator.webdriver=${playBootInfo.webdriver}`);
const d2bSetup = await pev(() => {
  const e = window.__ENGINE; const H = window.__HARNESS;
  e.sim.identity.race = 'argonian';    // what a pre-r3 save's blob puts here on load
  return { mode: e.mode, race: e.sim.identity.race, title_shown: !!(H.getTitleState() || {}).shown, frame: e.sim.frame };
});
await playPage.waitForTimeout(1200);
const frameA = await pev(() => window.__ENGINE.sim.frame);
await playPage.keyboard.press('Enter');
await playPage.waitForTimeout(1500);
const frameB = await pev(() => window.__ENGINE.sim.frame);
await playPage.waitForTimeout(1500);
const frameC = await pev(() => window.__ENGINE.sim.frame);
const d2bState = await pev(() => {
  const H = window.__HARNESS;
  let title = null, census = null, err = null;
  try { title = H.getTitleState(); } catch (x) { err = 'title:' + String(x && x.message); }
  try { census = H.getCensusState(); } catch (x) { err = (err || '') + ' census:' + String(x && x.message); }
  return {
    title_shown: title ? !!title.shown : null,
    in_session: title ? !!title.inSession : null,
    census_node: census ? census.node : null,
    race_observed: census ? census.race_observed : null,
    surface_drawn: census && census.surface ? !!census.surface.drawn : null,
    accessor_error: err,
  };
});
// A CONTROL ARM, because a loop that never ran is not a loop that died: the same page, the same
// Enter, with a LEGAL body. If this arm also advances 0 frames the measurement above is vacuous.
await playBoot();
await playPage.waitForTimeout(1200);
const ctrlA = await pev(() => window.__ENGINE.sim.frame);
await playPage.keyboard.press('Enter');
await playPage.waitForTimeout(1500);
const ctrlB = await pev(() => window.__ENGINE.sim.frame);
await playPage.waitForTimeout(1500);
const ctrlC = await pev(() => window.__ENGINE.sim.frame);
const ctrlState = await pev(() => {
  const H = window.__HARNESS; const c = H.getCensusState() || {};
  return { node: c.node, race_observed: c.race_observed, in_session: !!(H.getTitleState() || {}).inSession };
});
const newErrors = playErrors.slice();
const d2b = { boot: playBootInfo, setup: d2bSetup, frameA, frameB, frameC,
  advanced_after_enter: frameB - frameA, advanced_after_that: frameC - frameB,
  control_legal_body: { frameA: ctrlA, frameB: ctrlB, frameC: ctrlC, advanced_after_enter: ctrlB - ctrlA, advanced_after_that: ctrlC - ctrlB, state: ctrlState },
  page_errors: newErrors.slice(0, 5), state: d2bState };
out.checks.D2b_detail = d2b;
const raceError = newErrors.find((x) => /body carries race/.test(String(x.message || '')));
if (d2b.control_legal_body.advanced_after_that === 0) {
  fail('D2b', `THIS ARM IS VACUOUS: the CONTROL (a legal body, same page, same Enter) also advanced 0 frames, so the page was never running a frame loop and nothing here is evidence about the throw. ${JSON.stringify(d2b)}`.slice(0, 600), d2b);
} else if (raceError && d2b.advanced_after_that === 0) {
  fail('D2b', `THE FRAME LOOP IS DEAD. A real Enter on 'New' with an unreadable body threw out of _afterStep() and the loop stopped advancing (${d2b.advanced_after_that} frames in 1.5 s). This is rule 13's failure exactly: a fail-closed assertion on a path a player reaches, inside the fixed step.`, d2b);
} else if (raceError) {
  fail('D2b', `the throw reached the page as an uncaught error on the player's Enter (${newErrors.length} page error(s)), and the loop kept running (${d2b.advanced_after_that} frames in the next 1.5 s). The title is ${d2b.state.title_shown ? 'still shown' : 'DISMISSED'} and the scene is at ${JSON.stringify(d2b.state.census_node)} with race_observed ${JSON.stringify(d2b.state.race_observed)} — a state with no title and no observed body.`, d2b);
} else if (d2b.advanced_after_that === 0) {
  fail('D2b', `the loop stopped advancing after Enter (${d2b.advanced_after_that} frames) with no race error recorded — ${JSON.stringify(newErrors.slice(0, 2))}`, d2b);
} else {
  pass('D2b', `a real Enter with an unreadable body did not throw to the page and the loop kept running (${d2b.advanced_after_that} frames in 1.5 s); state ${JSON.stringify(d2b.state)}`, d2b);
}

// =============================================================================================
// D3 — the accessor side of the split
// =============================================================================================
say('');
say('D3. EVERY HARNESS VERB, AGAINST A BODY THE BUILD CANNOT READ.');
await reboot();
const d3 = await ev(() => {
  const e = window.__ENGINE; const H = window.__HARNESS;
  e.sim.identity.race = 'zzz-not-a-race';
  const threw = []; const okv = []; const skipped = [];
  // Only zero-argument verbs — a verb that needs arguments is not "an accessor a probe reaches
  // for", and guessing arguments would manufacture failures that are not about this change.
  for (const name of Object.keys(H)) {
    // Reading the property can itself throw: the harness exposes getters (`weapons` lazily
    // binds an engine). That is not this round's change and must not crash the sweep.
    let f;
    try { f = H[name]; } catch (err) { skipped.push(name); continue; }
    if (typeof f !== 'function' || f.length > 0) { skipped.push(name); continue; }
    if (/^(reset|killPlayer|playerDeath|writeSave|deleteSaveSlot|importSave|exportSave|simulateStorageFailure|stallMainThread)$/.test(name)) { skipped.push(name); continue; }
    try { const v = f(); okv.push(name); if (v && typeof v.then === 'function') v.catch(() => {}); }
    catch (err) { threw.push({ verb: name, message: String(err && err.message || err).slice(0, 160) }); }
  }
  return { threw, ok_count: okv.length, skipped_count: skipped.length,
    race_faults: threw.filter((t) => /races\.json|body carries race/.test(t.message)) };
});
out.checks.D3_detail = d3;
if (d3.race_faults.length === 0) {
  pass('D3', `${d3.ok_count} zero-argument harness verbs answered against an unreadable body; ${d3.threw.length} threw for other reasons and none of them names the race fault. The bodyRace/_bodyRaceRaw split left no accessor on the throwing side.`, d3);
} else {
  fail('D3', `${d3.race_faults.length} accessor(s) throw the race fault: ${JSON.stringify(d3.race_faults)}`, d3);
}

// =============================================================================================
// D4 — the neighbours who read the same field
// =============================================================================================
say('');
say('D4. THE NPC RECORDS §Q17 NAMES — DOES THE NEW THROW REACH THEM?');
await reboot();
const d4 = await ev(() => {
  const e = window.__ENGINE; const H = window.__HARNESS;
  const r = { npcs: 0, disposition_threw: [], disposition_ok: 0, sample: [] };
  e.sim.identity.race = 'saxhleel';
  // Open the barge hold so there are people in the world to ask about, THEN make the body
  // unreadable — the scene has to exist before the neighbours can be read.
  try { H.titleShow(); H.titleActivate('new'); H.stepFrames(20); } catch (err) { r.open_threw = String(err && err.message); }
  e.sim.identity.race = 'zzz-not-a-race';   // the player body is now unreadable
  let list = [];
  try { list = H.listNPCs() || []; } catch (err) { r.list_threw = String(err && err.message); }
  r.npcs = list.length;
  for (const n of list.slice(0, 120)) {
    const id = n && (n.id || n.npc || n.name);
    if (!id) continue;
    try { const d = H.npcDisposition(id); r.disposition_ok++; if (r.sample.length < 3) r.sample.push({ id, total: d && d.total }); }
    catch (err) { r.disposition_threw.push({ id, message: String(err && err.message || err).slice(0, 140) }); }
  }
  return r;
});
out.checks.D4_detail = d4;
const d4RaceFaults = (d4.disposition_threw || []).filter((t) => /races\.json|body carries race/.test(t.message));
if (d4RaceFaults.length === 0) {
  pass('D4', `${d4.disposition_ok} NPC disposition reads against an unreadable player body; none throws the new fault (raceTerm() resolves an unknown race to 0 and does not raise). The fix is confined to the census.`, d4);
} else {
  fail('D4', `the new throw reaches the disposition path: ${JSON.stringify(d4RaceFaults.slice(0, 3))}`, d4);
}

// =============================================================================================
// C1/C2 — the still control's missing 2x2 cell
// =============================================================================================
say('');
say('C. THE OLD (INERT) SABOTAGE AGAINST THE NEW READER.');
await reboot();
const c = await ev(() => {
  const e = window.__ENGINE; const H = window.__HARNESS;
  const readState = () => {
    const st = H.getCensusState() || {};
    return {
      node: st.node || null,
      census_open: !!(st.surface && (st.surface.drawn || st.surface.takes_input)),
      race_observed: !!st.race_observed,
      done: !!st.done,
      character_written: !!(st.race_observed || st.done),
    };
  };
  const untorn = readState();          // a freshly booted page; nothing has been reset over
  H.stepFrames(30);
  const untorn_after = readState();
  // THE OLD SABOTAGE, EXACTLY: censusBegin({}) alone, nothing else.
  const began = H.censusBegin({});
  H.stepFrames(30);
  const old_sabotage = readState();
  // and the events the trace-only reader would have seen
  return { untorn, untorn_after, began_node: began && began.node, old_sabotage };
});
out.checks.C_detail = c;
const readerBitesOnOldSabotage = c.old_sabotage.census_open || c.old_sabotage.character_written;
const untornQuiet = !c.untorn_after.census_open && !c.untorn_after.character_written;
if (untornQuiet && readerBitesOnOldSabotage) {
  fail('C1', `THE MISSING 2x2 CELL IS RED: the OLD sabotage (censusBegin({}) alone — the one the round reports as inert) is caught by the NEW entity-side reader on its own (census_open=${c.old_sabotage.census_open}, character_written=${c.old_sabotage.character_written}, node ${JSON.stringify(c.old_sabotage.node)}), while the untorn arm is quiet. Two changes were made for one defect: the sabotage AND the reader. The reader alone is sufficient, so the round's account — "fixed by driving to a field-writing node" — is not what made the control bite.`, c);
} else if (untornQuiet && !readerBitesOnOldSabotage) {
  pass('C1', 'the old sabotage is still invisible to the new reader, so the sabotage change is load-bearing and the round\'s account holds', c);
} else {
  fail('C1', `the untorn arm is NOT quiet (census_open=${c.untorn_after.census_open}, character_written=${c.untorn_after.character_written}) — the still window cannot discriminate at all`, c);
}

// =============================================================================================
// G — CONSUMPTION at two instants (rule 8)
// =============================================================================================
say('');
say('G. CONSUMPTION — four bodies, perturbed on the running world, read at TWO instants.');
const BODIES = ['saxhleel', 'dunmer', 'khajiit', 'nord'];
const g = { arms: [] };
for (const body of BODIES) {
  await reboot();                               // a fresh engine per arm; reset() is not enough
  const arm = await ev(async (race) => {
    const e = window.__ENGINE; const H = window.__HARNESS;
    e.sim.identity.race = race;                 // the world field, never an argument
    H.titleShow();
    H.titleActivate('new');                     // the row the title's New commits to
    H.stepFrames(10);
    // Reach the desk so the scribe has actually looked and said her line. `censusEnter` is the
    // player's `interact`; no race is passed anywhere.
    try { H.censusEnter('talk'); H.stepFrames(6); } catch { /* the hold node may already take input */ }
    const snap = () => {
      const st = H.getCensusState() || {};
      const drawn = (H.getRenderedText && H.getRenderedText()) || null;
      const rows = drawn && Array.isArray(drawn.strings) ? drawn.strings
        : (Array.isArray(drawn) ? drawn : (drawn && drawn.rows) || []);
      const texts = rows.map((r) => (typeof r === 'string' ? r : (r && (r.text || r.string)) || '')).filter(Boolean);
      return {
        frame: e.sim.frame,
        spec_race: st.race_observed || null,   // the race the scribe LOOKED AT
        body_race: st.body_race || null,
        node: st.node || null,
        surface_text: (st.surface && st.surface.rendered_text) ? st.surface.rendered_text.join(' | ') : '',
        drawn_join: texts.join(' | '),
        disposition_sample: (() => {
          try {
            const l = H.listNPCs() || [];
            return l.slice(0, 4).map((n) => {
              const id = n && (n.eid ?? n.id ?? n.npc ?? n.name);
              try { const d = H.npcDisposition(id); return [String(id), d && (d.total ?? d.disposition ?? null)]; }
              catch (x) { return [String(id), 'threw:' + String(x && x.message).slice(0, 40)]; }
            });
          } catch { return null; }
        })(),
      };
    };
    // instant 1 — the frame the scene opens
    const t1 = snap();
    // let the world run: 600 frames, nothing pressed
    H.stepFrames(600);
    const t2 = snap();
    return { race, t1, t2 };
  }, body);
  g.arms.push(arm);
  say(`    ${body}: t1 spec=${JSON.stringify(arm.t1.spec_race)} node=${arm.t1.node} disp=${JSON.stringify(arm.t1.disposition_sample)}`);
  say(`    ${' '.repeat(body.length)}  t2 (+600f) spec=${JSON.stringify(arm.t2.spec_race)} node=${arm.t2.node} disp=${JSON.stringify(arm.t2.disposition_sample)}`);
}
const distinct = (xs) => new Set(xs.map((x) => JSON.stringify(x))).size;
g.t1_distinct_spec = distinct(g.arms.map((a) => a.t1.spec_race));
g.t2_distinct_spec = distinct(g.arms.map((a) => a.t2.spec_race));
g.t1_distinct_disp = distinct(g.arms.map((a) => a.t1.disposition_sample));
g.t2_distinct_disp = distinct(g.arms.map((a) => a.t2.disposition_sample));
g.t1_distinct_drawn = distinct(g.arms.map((a) => a.t1.drawn_join));
g.t2_distinct_drawn = distinct(g.arms.map((a) => a.t2.drawn_join));
g.moved_between_instants = g.arms.map((a) => ({ race: a.race, f1: a.t1.frame, f2: a.t2.frame, advanced: a.t2.frame - a.t1.frame }));
out.checks.G_detail = g;
const bothInstants = g.t1_distinct_spec === 4 && g.t2_distinct_spec === 4 && g.t1_distinct_disp === 4 && g.t2_distinct_disp === 4;
if (bothInstants) {
  pass('G', `coupling holds at BOTH instants: 4/4 distinct observed races and 4/4 distinct NPC disposition vectors at the opening frame AND ${g.moved_between_instants[0].advanced} frames later`, g);
} else {
  fail('G', `coupling is not 4/4 at both instants — t1 spec ${g.t1_distinct_spec}/4, t2 spec ${g.t2_distinct_spec}/4, t1 disp ${g.t1_distinct_disp}/4, t2 disp ${g.t2_distinct_disp}/4`, g);
}

// =============================================================================================
out.conditions.loadavg_at_end = loadavg();
out.page_errors = handle.errors.slice(0, 10);
await handle.close();
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
writeJson(jsonPath, out);
say(`  -> ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);

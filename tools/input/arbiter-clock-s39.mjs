#!/usr/bin/env node
// arbiter-clock-s39.mjs — THE FALSIFIER S39 SPECIFIED AND DID NOT RUN.
//
// `corpus/00-doctrine/ARBITRATION.md` S39 rules that a duration is classified by where its two
// endpoints are generated: both in the simulation -> `f@60` forever, and it may never read a wall
// clock; both in the player's HAND -> stamped in wall-clock ms from `event.timeStamp` and
// converted to `f@60` once, at the input boundary. The ruling then names its own falsifier, names
// the tool that would run it — this file — and says in its own text that the tool does not exist
// and that the arbiter did not build it. A ruling whose falsifier has never been run is an
// opinion with a number attached. This is the instrument, and it is built to be able to kill the
// ruling that asked for it.
//
// ============================================================================================
// WHAT S39 PREDICTS, VERBATIM FROM THE ROW
// ============================================================================================
//   "Record one input trace, replay it at a rAF rate above the 12.00 Hz floor and at one below
//    it, and compare (a) the promoted action per press and (b) the simulation state hash. S39
//    predicts that after the fix the promoted action for presses of 20 / 60 / 120 / 250 / 500 ms
//    is roll / roll / roll / sprint / sprint at BOTH rates, that frames_held is within +-1 f@60
//    of round(asked_ms / 16.667) at both rates, and that the two replays are bit-identical.
//    S39 is overturned if the third of those cannot be made true — if honouring a stamped press
//    duration forces a wall-clock quantity into the recorded stream and the replay hashes
//    diverge, then determinism outranks the hand."
//
// The 12.00 Hz floor is `core/loop.js`: `STEP_MS = 1000/60`, `MAX_CATCHUP = 5`, surplus DROPPED
// rather than taken as a bigger step. 5 x 16.667 ms = 83.33 ms, so at any rAF rate >= 12.00 Hz
// the accumulator tracks wall clock exactly and below it the whole world enters uniform slow
// motion — and, as S39 puts it, the thumb does not.
//
// ============================================================================================
// THE FOUR ARMS
// ============================================================================================
//
// A1  REPLAY DETERMINISM ACROSS THE FLOOR   — the arm that carries the defeat condition.
//     S39's "what is given up" §1 says the replay "must therefore record the CONVERTED INTEGER,
//     not the stamp", so the stream S39 proposes to record is frame-indexed promoted actions and
//     nothing else. This arm replays exactly such a stream at both rates and hashes the trace.
//       * NULL CONTROL   same script, same rate, twice        -> hashes MUST match
//       * CROSS-RATE     same script, above and below floor   -> match, or S39's third fails
//       * SELF-TEST      the same script shifted by ONE FRAME -> hashes MUST differ
//     It runs the canonical stream and, when A2 has run, the stream A2 actually captured from a
//     hand — "record one input trace, replay it at two rates" in the literal sense.
//
// A2  CAPTURE ON THE SHIPPED TREE           — predictions (a) and (b).
//     Real synthetic pointer events, timed IN-PAGE. Not over CDP: a round trip on a loaded box
//     is what made the round-1 critic's own first attempt an instrument artefact, and its
//     successor tool says so in its header. Asks for 20/60/120/250/500 ms above and below the
//     floor and reports the frames the GAME counted and the move the body actually made.
//
// A3  DELETE-THE-FIX                        — the control that decides whether A2 means anything.
//     `hold-gate.js`'s own header names the teardown: "change `inputNow()` to return
//     `frame * STEP_MS` in mode `play` ... that restores the pre-S39 behaviour exactly and the
//     play-mode arm must go red." This arm does precisely that on a SERVED COPY and asserts the
//     edit applied. RULES 6 has three failure shapes and this guards the worst of them: if the
//     torn-down arm is as green as the fixed arm, then whatever made A2 pass, it was not S39.
//
// A4  LINT                                  — offline, no browser.
//     S39 requires "one offline arm needing no browser: a lint asserting that every one of the
//     sixteen reclassified figures is stamped and every one of the 11,161 others is not, red
//     when either list is violated on purpose."
//
// ============================================================================================
// WHAT WOULD MAKE ME REPORT "S39 FALLS", AND WHAT WOULD NOT
// ============================================================================================
// S39 falls if honouring a stamped duration forces a wall-clock quantity into the RECORDED
// STREAM and the replay hashes diverge. A cross-rate divergence is only S39's fault if the
// baseline is clean, so A1's null controls run first: if the SAME script at the SAME rate does
// not reproduce, the tree is not run-to-run deterministic and S39's third prediction is
// UNTESTABLE rather than false. This tool says that instead of claiming a scalp. Getting that
// distinction wrong is the difference between a falsifier and a headline.
//
// ============================================================================================
// WHICH TREE THE NUMBERS ARE ABOUT (RULES 12)
// ============================================================================================
// Everything is served from a clean `git archive HEAD game` export, never from the working tree.
// Two reasons, and the second is the load-bearing one. (1) A measurement is a claim about a
// commit. (2) `game/src/input/hold-gate.js` and its neighbours are owned RIGHT NOW by the
// W1-TOUCH round-2 builder — `node tools/ownership.mjs --for game/src/input/hold-gate.js` — and
// the working tree carries their half-finished edits to `engine.js` and `gamepad.js`. Serving
// the working tree would make every number here a claim about a file someone else was in the
// middle of typing.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const USAGE = `
arbiter-clock-s39.mjs — run ARBITRATION S39's own falsifier.

USAGE
  node tools/input/arbiter-clock-s39.mjs [--arm a1,a2,a3,a4] [--self-test]

OPTIONS
  --arm <list>     Which arms (default a1,a2,a3,a4).
  --self-test      Run only the instrument's own red checks: shift one arm's input stream by a
                   single frame and confirm divergence is reported; stamp the lint's lists and
                   confirm it moves. Exits 5 if any control that must go red stayed green.
  --frames <n>     Replay length in sim frames (default 420).
  --hi-ms <n>      rAF period ABOVE the floor  (default 16  -> ~62 Hz).
  --lo-ms <n>      rAF period BELOW the floor  (default 431 -> 2.32 Hz, the rate the W1-TOUCH
                   round-1 artifact implies: 11.6 fixed steps/s, 19.3% of real time).
  --state <id>     Named state (default arena_duel — a moving target, RULES 8).
  --seed <n>       Seed (default 1337).
  --rev <ref>      Git ref to export and serve (default HEAD). --rev worktree serves the dirty
                   tree and stamps the artifact as such.
  --out <dir>      Report directory (default reports/s39).
  --keep-trees     Leave the exported and patched copies on disk for inspection.
  --help

EXIT
  0  every requested arm ran and every assertion was decided, either way.
  3  the two rates did not straddle the 12.00 Hz floor — the run is void, not a result.
  4  an arm could not run at all (no browser, a patch anchor missing, no harness).
  5  a control that MUST go red stayed green: this tool is inert, ignore every number in it.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) usage(USAGE);

const OUT = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 's39');
ensureDir(OUT);
const FRAMES = Number(args.frames || 420);
const HI_MS = Number(args['hi-ms'] || 16);
const LO_MS = Number(args['lo-ms'] || 431);
const STATE = String(args.state || 'arena_duel');
const SEED = Number(args.seed === undefined ? 1337 : args.seed);
const REV = String(args.rev || 'HEAD');
const SELF_TEST = !!args['self-test'];
const ARMS = new Set(String(args.arm || (SELF_TEST ? 'a1,a4' : 'a1,a2,a3,a4')).split(',').map((s) => s.trim()).filter(Boolean));
const STEP_MS = 1000 / 60;
const FLOOR_HZ = 1000 / (5 * STEP_MS);        // 12.00 Hz — MAX_CATCHUP = 5

const say = (s) => process.stdout.write(s + '\n');
const hr = () => say('-'.repeat(98));

/** Load per core at this instant. Every timing figure here is stamped with it (RULES 26). */
function loadPerCore() {
  try {
    const la = Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]);
    const cores = (fs.readFileSync('/proc/cpuinfo', 'utf8').match(/^processor\s*:/gm) || []).length || 1;
    return Math.round((la / cores) * 100) / 100;
  } catch { return null; }
}

const gitAt = (ref) => { try { return execSync(`git rev-parse --short ${ref}`, { cwd: REPO_ROOT }).toString().trim(); } catch { return null; } };

const rec = {
  schema: 'elder-souls/arbiter-clock-s39@1',
  ruling: 'ARBITRATION.md S39',
  tool: 'tools/input/arbiter-clock-s39.mjs',
  commit: gitAt('HEAD'),
  served_rev: REV,
  served_commit: REV === 'worktree' ? null : gitAt(REV),
  working_tree_dirty: (() => { try { return execSync('git status --porcelain -- game/', { cwd: REPO_ROOT }).toString().trim().split('\n').filter(Boolean); } catch { return null; } })(),
  taken_at: new Date().toISOString(),
  load_per_core_at_start: loadPerCore(),
  floor_hz: Math.round(FLOOR_HZ * 100) / 100,
  raf_period_ms: { above_floor: HI_MS, below_floor: LO_MS },
  frames: FRAMES,
  state: STATE,
  seed: SEED,
  self_test_only: SELF_TEST,
  arms: {},
  controls: [],
  verdict: null,
  could_not_run: [],
};

/** An assertion this tool makes. `redExpected` ones MUST fail on demand or the tool is inert. */
function control(name, passed, why, redExpected = false) {
  rec.controls.push({ name, passed: !!passed, red_expected: redExpected, why });
  say(`  ${passed ? 'ok  ' : 'RED '} ${name}  — ${why}`);
  return !!passed;
}

// ==============================================================================================
// THE RECORDED STREAM
// ==============================================================================================
// This object is what S39's defeat condition is about. Under the ruling a press duration is
// "derived from a wall-clock span AT CAPTURE TIME, and the replay must therefore record the
// CONVERTED INTEGER, not the stamp". So a post-S39 recording of the five canonical presses is
// frame-indexed promoted actions and integer frames, with no millisecond anywhere in it. If a
// stamp had to appear here, S39 would already be dead on inspection — which is why this tool
// asserts the stream's shape rather than assuming it.
//
//   asked_ms          20     60    120    250    500
//   round(ms/16.667)   1      4      7     15     30    f@60
//   vs the 12 f gate   <      <      <     >=     >=
//   promoted         roll   roll   roll  sprint sprint
const ASKED_MS = [20, 60, 120, 250, 500];
const CONVERTED_F = ASKED_MS.map((ms) => Math.round(ms / STEP_MS));
const PRESS_AT = [30, 110, 190, 270, 350];
const GATE_F = 12;

function canonicalStream(shiftFrames = 0) {
  const s = [];
  for (let i = 0; i < ASKED_MS.length; i++) {
    const f0 = PRESS_AT[i] + shiftFrames;
    const d = CONVERTED_F[i];
    s.push({ f: Math.max(1, f0 - 4), move: [0, 1] });      // a sprint must have somewhere to go
    if (d >= GATE_F) {
      s.push({ f: f0 + GATE_F, press: ['sprint'] });        // promoted at the gate
      s.push({ f: f0 + d, release: ['sprint'] });
    } else {
      s.push({ f: f0 + d, press: ['roll'] });               // touch.js `up`: the tap is down+up
      s.push({ f: f0 + d + 1, release: ['roll'] });
    }
    s.push({ f: f0 + d + 6, move: [0, 0] });
  }
  return s.sort((a, b) => a.f - b.f);
}

const INTEGER_ONLY_KEYS = new Set(['f', 'press', 'release', 'move']);
function streamIsIntegerOnly(s) {
  return s.every((e) => Number.isInteger(e.f)
    && Object.keys(e).every((k) => INTEGER_ONLY_KEYS.has(k))
    && (!e.move || e.move.every((v) => Number.isInteger(v))));
}

// ==============================================================================================
// THE rAF SHIM — how this tool puts the world above and below the floor
// ==============================================================================================
// NOT by loading the box. A stall arm measured against a drifting load is the mistake
// `tools/touch/r2-framerate.mjs` documents in its own header, and a falsifier a neighbour's
// browser can move is not a falsifier. Instead requestAnimationFrame is REPLACED, before the
// app's first line, by a setTimeout pump at a chosen period. `loop.js` still reads real wall
// clock through `wallNow()` and is otherwise untouched, so the accumulator does exactly what it
// does on a slow phone: at 431 ms per tick it wants 25.9 steps, takes MAX_CATCHUP = 5, and drops
// the rest.
function rafShim() {
  return (p) => {
    const cbs = new Map();
    let id = 1;
    window.__ES_RAF_PERIOD = p;
    window.__ES_RAF_PUMPS = 0;
    window.requestAnimationFrame = (fn) => { const h = id++; cbs.set(h, fn); return h; };
    window.cancelAnimationFrame = (h) => { cbs.delete(h); };
    const pump = () => {
      window.__ES_RAF_PUMPS++;
      const now = performance.now();
      const due = Array.from(cbs.entries());
      cbs.clear();
      for (const [, fn] of due) {
        try { fn(now); } catch (e) { window.__ES_RAF_ERR = String((e && e.stack) || e); }
      }
      setTimeout(pump, window.__ES_RAF_PERIOD);
    };
    setTimeout(pump, p);
  };
}

async function openPage(browser, server, periodMs, { phone = false } = {}) {
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
    : await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { errs.push(String(e).slice(0, 300)); });
  await page.addInitScript(rafShim(), periodMs);
  // `main.js` picks harness mode when navigator.webdriver is true; `?mode=play` overrides it, and
  // play mode is the whole point — the rAF accumulator must be the thing driving the simulation.
  await page.goto(`${server.origin}/game/index.html?mode=play&state=${encodeURIComponent(STATE)}`, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
  await page.evaluate(() => window.__HARNESS.ready());
  // RENDERING OFF IN BOTH ARMS, AND THIS IS NOT A CONVENIENCE — it is the difference between an
  // experiment and a measurement of this box. The first run of this tool asked for a 16 ms rAF
  // period and got 0.06 rAF Hz, because with the render on, one rAF tick on a 844x390 dpr-3
  // context cost 16 SECONDS at load 7.3/core — the ABOVE-floor arm was six times slower than the
  // below-floor arm and the two arms were on the same side of the floor. W1-TOUCH-r2's finding A2
  // is the same number from the other direction: `loop.setRenderRate(0)` takes rAF from 1.0-2.3 Hz
  // to 24-25 Hz. So the render is removed and the rAF rate is set by the shim and ONLY by the
  // shim. A-JRN11 exists for exactly this and the sim is required not to care what is drawn.
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  return { ctx, page, errs };
}

/** Measured rAF Hz and fixed steps/s over a real window. A rate this tool claims, it measures. */
async function measureRate(page, windowMs = 2500) {
  return page.evaluate(async (w) => {
    const L = window.__ENGINE.loop;
    const a = { raf: L.stats.rafTicks, steps: L.stats.simStepsTotal, clamps: L.stats.catchupClamps, drop: L.stats.catchupDroppedMs, t: performance.now() };
    await new Promise((r) => setTimeout(r, w));
    const b = { raf: L.stats.rafTicks, steps: L.stats.simStepsTotal, clamps: L.stats.catchupClamps, drop: L.stats.catchupDroppedMs, t: performance.now() };
    const dt = (b.t - a.t) / 1000;
    return {
      window_s: Math.round(dt * 1000) / 1000,
      raf_hz: Math.round(((b.raf - a.raf) / dt) * 100) / 100,
      sim_steps_per_s: Math.round(((b.steps - a.steps) / dt) * 100) / 100,
      sim_time_ratio: Math.round(((b.steps - a.steps) / 60 / dt) * 1000) / 1000,
      catchup_clamps: b.clamps - a.clamps,
      dropped_ms_per_s: Math.round((b.drop - a.drop) / dt),
      mode: L.mode,
      raf_drives_sim: L.rafDrivesSim,
    };
  }, windowMs);
}

// ==============================================================================================
// A1 — replay determinism across the floor
// ==============================================================================================
async function replayOnce(page, script) {
  const start = await page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);                       // A-JRN11: the sim must not care what is drawn
    H.setSeed(o.seed);
    H.loadState(o.state);
    H.reanchorFreeRunning();
    H.queueInputs(o.script);
    H.traceStart({ enemies: true, hitboxes: true, events: true });
    return window.__ENGINE.sim.frame;
  }, { seed: SEED, state: STATE, script });

  const target = start + FRAMES;
  await page.waitForFunction((t) => window.__ENGINE.sim.frame >= t, target, { timeout: 300000, polling: 250 });
  const out = await page.evaluate(() => {
    const r = window.__HARNESS.traceStop();
    const L = window.__ENGINE.loop;
    return { records: r, raf: L.stats.rafTicks, steps: L.stats.simStepsTotal, clamps: L.stats.catchupClamps, dropped: Math.round(L.stats.catchupDroppedMs), rafErr: window.__ES_RAF_ERR || null };
  });
  const recs = out.records.filter((r) => r.f >= start && r.f < start + FRAMES);
  const h = crypto.createHash('sha256');
  for (const r of recs) h.update(JSON.stringify(r) + '\n');
  return {
    hash: h.digest('hex'),
    frames: recs.length,
    start_frame: start,
    raf_ticks: out.raf,
    sim_steps: out.steps,
    catchup_clamps: out.clamps,
    catchup_dropped_ms: out.dropped,
    raf_error: out.rafErr,
    records: recs,
  };
}

/** Where two runs first part company. A hash mismatch with no frame number is not evidence. */
function firstDivergence(a, b) {
  if (!a || !b) return null;
  const n = Math.min(a.records.length, b.records.length);
  for (let i = 0; i < n; i++) {
    const x = JSON.stringify(a.records[i]);
    const y = JSON.stringify(b.records[i]);
    if (x !== y) {
      const keys = new Set([...Object.keys(a.records[i] || {}), ...Object.keys(b.records[i] || {})]);
      const fields = [];
      for (const k of keys) {
        const xa = JSON.stringify(a.records[i][k]);
        const yb = JSON.stringify(b.records[i][k]);
        if (xa !== yb) fields.push({ field: k, a: String(xa).slice(0, 200), b: String(yb).slice(0, 200) });
      }
      return { index: i, frame_a: a.records[i].f, frame_b: b.records[i].f, fields };
    }
  }
  if (a.records.length !== b.records.length) return { index: n, note: `record COUNT differs: ${a.records.length} vs ${b.records.length}` };
  return null;
}

async function armA1(browser, server, capturedStream) {
  const A = { name: 'A1 replay determinism across the 12.00 Hz floor', runs: {}, checks: {} };
  say('\nA1 — REPLAY DETERMINISM ACROSS THE FLOOR   (the arm that carries S39\'s defeat condition)');
  hr();
  const script = canonicalStream(0);
  const shifted = canonicalStream(1);
  A.canonical_stream = script;
  A.canonical_stream_integer_only = streamIsIntegerOnly(script);
  A.captured_stream = capturedStream || null;
  A.captured_stream_integer_only = capturedStream ? streamIsIntegerOnly(capturedStream) : null;

  const hi = await openPage(browser, server, HI_MS);
  A.rate_above = await measureRate(hi.page);
  say(`  above-floor page: rAF ${A.rate_above.raf_hz} Hz, ${A.rate_above.sim_steps_per_s} fixed steps/s (${(A.rate_above.sim_time_ratio * 100).toFixed(1)}% of real time), ${A.rate_above.catchup_clamps} clamps, ${A.rate_above.dropped_ms_per_s} ms/s dropped`);
  A.runs.hi_1 = await replayOnce(hi.page, script);
  A.runs.hi_2 = await replayOnce(hi.page, script);
  A.runs.hi_shift1 = await replayOnce(hi.page, shifted);
  if (capturedStream) A.runs.hi_cap = await replayOnce(hi.page, capturedStream);
  await hi.ctx.close();

  const lo = await openPage(browser, server, LO_MS);
  A.rate_below = await measureRate(lo.page, 4500);
  say(`  below-floor page: rAF ${A.rate_below.raf_hz} Hz, ${A.rate_below.sim_steps_per_s} fixed steps/s (${(A.rate_below.sim_time_ratio * 100).toFixed(1)}% of real time), ${A.rate_below.catchup_clamps} clamps, ${A.rate_below.dropped_ms_per_s} ms/s dropped`);
  A.runs.lo_1 = await replayOnce(lo.page, script);
  A.runs.lo_2 = await replayOnce(lo.page, script);
  if (capturedStream) A.runs.lo_cap = await replayOnce(lo.page, capturedStream);
  await lo.ctx.close();

  say('');
  for (const k of Object.keys(A.runs)) {
    const r = A.runs[k];
    say(`  ${k.padEnd(11)} ${r.hash.slice(0, 20)}  frames=${r.frames} raf=${r.raf_ticks} steps=${r.sim_steps} clamps=${r.catchup_clamps} dropped=${r.catchup_dropped_ms}ms`);
  }
  say('');

  A.straddles = A.rate_above.raf_hz > FLOOR_HZ && A.rate_below.raf_hz < FLOOR_HZ;
  A.checks.straddle = control('A1/straddle',
    A.straddles,
    `above=${A.rate_above.raf_hz} Hz, below=${A.rate_below.raf_hz} Hz, floor=${FLOOR_HZ.toFixed(2)} Hz — the two arms must sit either side of it or nothing below means anything`);
  A.checks.integer_only = control('A1/recorded-stream-carries-no-millisecond',
    A.canonical_stream_integer_only && (capturedStream ? A.captured_stream_integer_only : true),
    'every event in the replayed stream is a frame index and an action name. S39 §1 requires the record to carry the CONVERTED INTEGER and not the stamp; a stamp in here would kill the ruling on inspection');
  A.checks.null_hi = control('A1/null-control-above',
    A.runs.hi_1.hash === A.runs.hi_2.hash,
    'same script, same rate, twice — if this fails the cross-rate comparison is measuring noise');
  A.checks.null_lo = control('A1/null-control-below',
    A.runs.lo_1.hash === A.runs.lo_2.hash,
    'same script, same rate, twice, below the floor');
  A.checks.self_test = control('A1/SELF-TEST-must-go-red',
    A.runs.hi_1.hash !== A.runs.hi_shift1.hash,
    'the SAME script shifted by ONE FRAME must produce a different hash. If it does not, this arm cannot fail and every other line in it is void', true);
  A.checks.cross_rate = control('A1/cross-rate, canonical stream (S39 prediction 3)',
    A.runs.hi_1.hash === A.runs.lo_1.hash,
    'an integer-only recorded stream replayed above and below the floor must be bit-identical');
  if (capturedStream) {
    A.checks.cross_rate_captured = control('A1/cross-rate, the stream A2 actually captured',
      A.runs.hi_cap.hash === A.runs.lo_cap.hash,
      'the literal reading of "record one input trace, replay it at two rates": the promoted actions a real hand produced, replayed above and below the floor');
  }

  A.self_test_divergence = firstDivergence(A.runs.hi_1, A.runs.hi_shift1);
  if (!A.checks.cross_rate) A.cross_rate_divergence = firstDivergence(A.runs.hi_1, A.runs.lo_1);
  if (!A.checks.null_hi) A.null_hi_divergence = firstDivergence(A.runs.hi_1, A.runs.hi_2);
  if (!A.checks.null_lo) A.null_lo_divergence = firstDivergence(A.runs.lo_1, A.runs.lo_2);
  if (capturedStream && !A.checks.cross_rate_captured) A.captured_divergence = firstDivergence(A.runs.hi_cap, A.runs.lo_cap);
  for (const k of Object.keys(A.runs)) delete A.runs[k].records;
  return A;
}

// ==============================================================================================
// A2 / A3 — capture: what a thumb actually gets, above and below the floor
// ==============================================================================================
// TIMED IN-PAGE, NOT OVER CDP. `tools/touch/critic-gate-wallclock.mjs` documents why in its own
// header: a CDP round trip on a loaded box is not free, so `waitForTimeout(70)` between a down
// and an up is 70 ms plus two dispatches and the press the game saw was far longer than the
// press asked for. Here the whole press lives inside one page.evaluate — the down, the wait, the
// up and the observation — so the only host round trip is the one that starts it.
//
// The events are synthetic `PointerEvent`s, which matters for one reason and this tool depends
// on it: a `PointerEvent` constructed in the page carries a real `timeStamp`, written by the
// browser at construction, which is exactly the quantity S39 tells the input boundary to read.
async function capturePresses(page) {
  return page.evaluate(async (o) => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    const cv = document.getElementById('view');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ev = (type, x, y) => new PointerEvent(type, {
      pointerId: 8, pointerType: 'touch', clientX: x, clientY: y,
      bubbles: true, cancelable: true, isPrimary: true, width: 24, height: 24, pressure: 1,
    });
    const lay0 = H.touchLayout() || [];
    if (!lay0.length) return { error: 'touchLayout() is empty — no touch overlay on this context' };
    // Wake the overlay: T7 keeps it hidden until something has been touched.
    const warm = lay0.find((c) => c.action === 'interact') || lay0[0];
    cv.dispatchEvent(ev('pointerdown', warm.x, warm.y));
    await sleep(120);
    window.dispatchEvent(ev('pointerup', warm.x, warm.y));
    await sleep(1200);

    const lay = H.touchLayout() || [];
    const rc = lay.find((c) => c.action === 'roll');
    if (!rc) return { error: 'no roll control in touchLayout()', layout: lay.map((c) => c.action) };
    const gate = (() => {
      try {
        const b = E.real.touch.cfg.buttons.find((x) => x.action === 'roll');
        return b && b.hold_gate ? b.hold_gate.frames : null;
      } catch { return null; }
    })();

    const rows = [];
    for (const askedMs of o.asked) {
      // THE PROMOTED ACTION IS READ AT THE BOUNDARY, NOT OFF THE ANIMATION. S39 compares "the
      // promoted action per press"; that is `roll` or `sprint` arriving at the input pipeline.
      // The first version of this tool read the body's move id instead and scored 0/5 in both
      // arms because a roll with no direction is a BACKSTEP — a true statement about the combat
      // layer and no evidence at all about the gate. The trace's `input.pressed` is the shipped
      // record of exactly the quantity the ruling names.
      H.traceStart({ enemies: false, hitboxes: false, events: false });
      const t0 = performance.now();
      const f0 = E.sim.frame;
      cv.dispatchEvent(ev('pointerdown', rc.x, rc.y));
      const h0 = E.real.touch.held.get('roll');
      const gateFrom = h0 && h0.gateFrom !== undefined ? h0.gateFrom : null;
      const tDown = h0 && h0.tDown !== undefined ? h0.tDown : null;
      await sleep(askedMs);
      // The map entry is captured BEFORE the up, because `up()` deletes it from the map — but
      // the OBJECT survives, and post-S39 `up()` writes the decisive `framesHeld` onto it. So
      // the number this tool reports is the one the game itself computed and acted on, not a
      // frame delta this tool inferred. That distinction is the whole of `critic-gate-wallclock`'s
      // header and it is why the round-1 critic's first attempt measured its own latency.
      const h1 = E.real.touch.held.get('roll');
      const promotedAtUp = !!(h1 && h1.promoted);
      const fUp = E.sim.frame;
      window.dispatchEvent(ev('pointerup', rc.x, rc.y));
      const wallMs = performance.now() - t0;
      const framesHeldByGame = h1 && h1.framesHeld !== undefined ? h1.framesHeld
        : (gateFrom !== null ? (fUp - gateFrom + 1) : null);
      // Let the world run. RULES 8: one instant is a still target, and below the floor a whole
      // batch of steps happens only once every 431 ms, so the edge needs time to reach a step.
      const seen = [];
      const until = performance.now() + 2000;
      while (performance.now() < until) {
        const c = H.getCombatState();
        seen.push({ st: c.player.state, mv: c.player.move ? c.player.move.id : null, f: E.sim.frame });
        await sleep(40);
      }
      const recs = H.traceStop();
      const edges = [];
      for (const r of recs) {
        for (const n of (r.input && r.input.pressed) || []) if (n === 'roll' || n === 'sprint') edges.push({ action: n, f: r.f });
      }
      await sleep(400);
      const moves = Array.from(new Set(seen.map((x) => x.mv).filter(Boolean)));
      const states = Array.from(new Set(seen.map((x) => x.st)));
      const promotedAction = edges.length ? edges[edges.length - 1].action : null;
      const outcome = promotedAction || 'nothing';
      const wantF = Math.round(askedMs / (1000 / 60));
      rows.push({
        asked_ms: askedMs,
        wall_ms: Math.round(wallMs),
        expected_f60: wantF,
        expected_outcome: wantF >= (gate || 12) ? 'sprint' : 'roll',
        frames_held_by_the_game: framesHeldByGame,
        sim_frame_at_down: f0,
        sim_frame_at_up: fUp,
        sim_frames_elapsed_during_press: fUp - f0,
        t_down_ms: tDown === null ? null : Math.round(tDown),
        promoted_at_up: promotedAtUp,
        input_edges: edges,
        outcome,
        body_moves: moves,
        body_states: states,
      });
    }
    return { gate_frames: gate, rows };
  }, { asked: ASKED_MS });
}

function scoreCapture(side) {
  const rows = (side && side.rows) || [];
  if (!rows.length) return null;
  const rightMove = rows.filter((r) => r.outcome === r.expected_outcome).length;
  const withinOne = rows.filter((r) => r.frames_held_by_the_game !== null && Math.abs(r.frames_held_by_the_game - r.expected_f60) <= 1).length;
  const distinct = new Set(rows.map((r) => r.frames_held_by_the_game)).size;
  return { rows: rows.length, right_move: rightMove, frames_within_1: withinOne, distinct_frame_counts: distinct };
}

async function armCapture(browser, server, label) {
  const A = { name: label, above: null, below: null };
  say(`\n${label}`);
  hr();
  for (const [key, period] of [['above', HI_MS], ['below', LO_MS]]) {
    const p = await openPage(browser, server, period, { phone: true });
    const rate = await measureRate(p.page, key === 'below' ? 4500 : 2500);
    let cap;
    try { cap = await capturePresses(p.page); } catch (e) { cap = { error: String((e && e.message) || e) }; }
    if (p.errs.length) cap.page_errors = p.errs.slice(0, 6);
    await p.ctx.close();
    A[key] = { rate, ...cap };
    say(`  ${key.padEnd(5)} the floor — rAF ${rate.raf_hz} Hz, ${rate.sim_steps_per_s} fixed steps/s (${(rate.sim_time_ratio * 100).toFixed(1)}% of real time), gate ${cap.gate_frames} f@60`);
    if (cap.error) { say(`    COULD NOT CAPTURE: ${cap.error}`); continue; }
    for (const r of cap.rows) {
      say(`    asked ${String(r.asked_ms).padStart(3)} ms -> wall ${String(r.wall_ms).padStart(4)} ms   the game counted ${String(r.frames_held_by_the_game).padStart(4)} f@60 (want ${String(r.expected_f60).padStart(2)})   sim advanced ${String(r.sim_frames_elapsed_during_press).padStart(3)} f   -> ${String(r.outcome).padEnd(7)} (want ${String(r.expected_outcome).padEnd(6)})  edges ${JSON.stringify(r.input_edges)}`);
    }
  }
  A.above_score = scoreCapture(A.above);
  A.below_score = scoreCapture(A.below);
  return A;
}

/** The integer stream a capture produced — S39's "record one input trace", literally. */
function streamFromCapture(side) {
  if (!side || !side.rows || !side.rows.length) return null;
  const s = [];
  let f = 30;
  for (const r of side.rows) {
    const d = Math.max(1, Number(r.frames_held_by_the_game) || 1);
    const promoted = r.outcome === 'sprint' || r.outcome === 'promoted-no-move-id';
    s.push({ f: Math.max(1, f - 4), move: [0, 1] });
    if (promoted) {
      s.push({ f, press: ['sprint'] });
      s.push({ f: f + Math.max(1, d), release: ['sprint'] });
    } else {
      s.push({ f, press: ['roll'] });
      s.push({ f: f + 1, release: ['roll'] });
    }
    s.push({ f: f + Math.max(1, d) + 6, move: [0, 0] });
    f += Math.max(1, d) + 40;
  }
  return s.sort((a, b) => a.f - b.f);
}

// ==============================================================================================
// A3 — DELETE THE FIX
// ==============================================================================================
// `game/src/input/hold-gate.js`'s own header, written by whoever landed S39, names the teardown:
//
//     "change `inputNow()` to return `frame * STEP_MS` in mode `play` ... That restores the
//      pre-S39 behaviour exactly and the play-mode arm must go red — five presses, one verdict,
//      `frames_held` constant."
//
// That is exactly what this does, on a COPY, and it asserts the edit applied. `hold-gate.js` is
// owned right now by the W1-TOUCH round-2 builder and this tool must not — and does not — write
// to it. A patched tree byte-identical to the shipped one is RULES 6's inert teardown, so a
// missing anchor is a hard failure and not a warning.
const DELETE_THE_FIX = [
  {
    file: 'src/input/hold-gate.js',
    find: "export function inputNow(mode, frame, event) {\n  if (mode === 'play') {",
    replace: "export function inputNow(mode, frame, event) {\n  // DELETE-THE-FIX (tools/input/arbiter-clock-s39.mjs --arm a3): the hand's clock is removed\n  // and `frame * STEP_MS` is returned in every mode, which is the pre-S39 frame count exactly.\n  if (false && mode === 'play') {",
  },
];

function tearDownTree(srcRoot) {
  const dst = path.join(OUT, 'tree-deleted-fix');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(srcRoot, 'game'), path.join(dst, 'game'), { recursive: true });
  const applied = [];
  for (const p of DELETE_THE_FIX) {
    const f = path.join(dst, 'game', p.file);
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(p.find)) {
      throw new Error(`DELETE-THE-FIX anchor not found in game/${p.file}:\n  ${p.find.replace(/\n/g, '\\n').slice(0, 180)}\n`
        + 'A teardown that does not apply is RULES 6\'s inert control: both arms would be the positive arm and the "control went red" line would be a second copy of the experiment.');
    }
    fs.writeFileSync(f, src.replace(p.find, p.replace));
    applied.push({ file: p.file });
  }
  return { dst, applied };
}

// ==============================================================================================
// A4 — the offline lint
// ==============================================================================================
// S39: "a lint asserting that every one of the sixteen reclassified figures is stamped and every
// one of the 11,161 others is not, red when either list is violated on purpose."
//
// STAMPED, defined so a builder can check it rather than take my word: at the site itself — not
// somewhere else in the same file — the threshold is compared against a quantity derived from a
// wall-clock millisecond span (`inputNow`, `tDown`, `event.timeStamp`, `framesHeld(tDown, …)`),
// or the datum publishes a `ms` twin beside its `frames`. FRAME-COUNTED: the site compares
// integer sim frames. Each source site is located by an ANCHOR and judged on a window around it,
// because a file-wide grep for `timeStamp` calls `real.js` stamped on the strength of a comment.
const SRC_SITES = [
  {
    id: 9,
    what: 'real.js — the bare literal 12, the second copy of the gate constant',
    file: 'src/input/real.js',
    anchor: /const holdControl = control \+ 'Hold' \+/,
    stamped: /holdGateFrames\(/,
    window: 400,
  },
  {
    id: 10,
    what: 'combat/player.js — r2 -> r2.charged, promoted at 9',
    file: 'src/combat/player.js',
    anchor: /\{ at: 9, to: \(m\.slot === '2h\.r2'/,
    stamped: /tDown|inputNow\(|framesHeld\(/,
    window: 900,
  },
  {
    id: 11,
    what: 'combat/player.js — art.1 -> art.2, promoted at 13',
    file: 'src/combat/player.js',
    anchor: /\{ at: 13, to: \(m\.slot === '2h\.art\.1'/,
    stamped: /tDown|inputNow\(|framesHeld\(/,
    window: 900,
  },
  {
    id: 12,
    what: 'combat/player.js — bow.draw -> bow.aimed, promoted at 9',
    file: 'src/combat/player.js',
    anchor: /m\.slot === 'bow\.draw' \? \{ at: 9/,
    stamped: /tDown|inputNow\(|framesHeld\(/,
    window: 900,
  },
  {
    id: 13,
    what: 'gamepad.js — analog.trigger.autozero_frames = 30',
    file: 'src/input/gamepad.js',
    anchor: /autozero_frames/,
    stamped: /autozeroMs|nowMs|restFromMs/,
    window: 700,
  },
  {
    id: 14,
    what: 'gamepad.js — analog.drift_guard.frames = 600',
    file: 'src/input/gamepad.js',
    anchor: /drift_guard/,
    stamped: /driftMs|nowMs|driftFromMs/,
    window: 900,
  },
  {
    id: 15,
    what: 'touch.js — hide_after_ms_when_pad_active -> hideAfterFrames = 120',
    file: 'src/input/touch.js',
    anchor: /hide_after_ms_when_pad_active/,
    stamped: /hideAfterMs|lastTouchMs/,
    window: 1200,
  },
  {
    id: 16,
    what: 'sim/stealth/pickpocket.js — holdSeconds() -> holdFrames() -> heldFrames++',
    file: 'src/sim/stealth/pickpocket.js',
    anchor: /this\.needFrames = holdFrames\(|this\.needMs =/,
    stamped: /needMs|heldMs|holdMs/,
    window: 700,
  },
];

/** The eight data-side gate figures (S39 1-8), located structurally, not by line number. */
function profileGateSites(root) {
  const p = path.join(root, 'game', 'data', 'input', 'profiles.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const sites = [];
  const seen = new Set();
  const walk = (v, at) => {
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (!v || typeof v !== 'object') return;
    if (v.hold_gate && typeof v.hold_gate === 'object' && v.hold_gate.frames !== undefined) {
      const tag = `${at}${v.action ? ` (${v.action})` : ''}`;
      if (!seen.has(tag)) { seen.add(tag); sites.push({ tag, frames: v.hold_gate.frames, ms: v.hold_gate.ms === undefined ? null : v.hold_gate.ms }); }
    }
    if (v.hold_gate_frames && typeof v.hold_gate_frames === 'object') {
      for (const [k, n] of Object.entries(v.hold_gate_frames)) {
        const tag = `${at}.hold_gate_frames.${k}`;
        if (typeof n !== 'number' || seen.has(tag)) continue;
        seen.add(tag);
        const twin = (v.hold_gate_ms || {})[k];
        sites.push({ tag, frames: n, ms: twin === undefined ? null : twin });
      }
    }
    // A pad profile's gates live under numeric button indices inside `hold_gate`.
    if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'hold_gate' && x && typeof x === 'object' && x.frames === undefined) {
          for (const [idx, row] of Object.entries(x)) {
            if (!row || typeof row !== 'object' || row.frames === undefined) continue;
            const tag = `${at}.hold_gate[${idx}] ${row.tap || ''}/${row.hold || ''}`;
            if (seen.has(tag)) continue;
            seen.add(tag);
            sites.push({ tag, frames: row.frames, ms: row.ms === undefined ? null : row.ms });
          }
        } else walk(x, at ? `${at}.${k}` : k);
      }
    }
  };
  walk(j, '');
  return sites;
}

/** Every frame-denominated duration figure published in game/data. The 11,161 that stay. */
function dataFrameCensus(root) {
  const dir = path.join(root, 'game', 'data');
  const counts = new Map();
  const NAME = /(_f|_frames?|^f|^frames?|^iframes)$/;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) {
        let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
        visit(j, null);
      }
    }
  };
  const visit = (v, k) => {
    if (Array.isArray(v)) { for (const x of v) visit(x, k); return; }
    if (typeof v === 'number') { if (k && NAME.test(k)) counts.set(k, (counts.get(k) || 0) + 1); return; }
    if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) visit(x, kk);
  };
  walk(dir);
  let total = 0;
  for (const v of counts.values()) total += v;
  return { names: counts.size, total, top: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ field: k, n: v })) };
}

function armA4(root, label) {
  const A = { name: `A4 offline lint (${label})`, root: path.relative(REPO_ROOT, root) || '.' };
  const gates = profileGateSites(root);
  A.data_sites = gates;
  A.data_stamped = gates.filter((g) => g.ms !== null).length;

  const src = [];
  for (const s of SRC_SITES) {
    const f = path.join(root, 'game', s.file);
    let txt = null;
    try { txt = fs.readFileSync(f, 'utf8'); } catch { /* missing */ }
    if (txt === null) { src.push({ id: s.id, what: s.what, file: s.file, found: false, stamped: false }); continue; }
    const m = s.anchor.exec(txt);
    if (!m) { src.push({ id: s.id, what: s.what, file: s.file, found: false, stamped: false, note: 'anchor not found — the site has moved or been rewritten; a lint that cannot find its site must say so, not pass' }); continue; }
    const a = Math.max(0, m.index - s.window);
    const b = Math.min(txt.length, m.index + s.window);
    src.push({ id: s.id, what: s.what, file: s.file, found: true, stamped: s.stamped.test(txt.slice(a, b)), stamped_re: String(s.stamped) });
  }
  A.src_sites = src;
  A.src_stamped = src.filter((s) => s.stamped).length;
  A.sixteen_stamped = A.data_stamped + A.src_stamped;
  A.sixteen_total = gates.length + src.length;
  A.data_census = dataFrameCensus(root);
  return A;
}

// ==============================================================================================
// THE TREE UNDER TEST
// ==============================================================================================
function exportTree(ref) {
  if (ref === 'worktree') return { root: REPO_ROOT, temporary: false };
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 's39-tree-'));
  execSync(`git archive ${ref} game | tar -x -C ${JSON.stringify(dst)}`, { cwd: REPO_ROOT, shell: '/bin/bash' });
  return { root: dst, temporary: true };
}

// ==============================================================================================
// MAIN
// ==============================================================================================
say(`arbiter-clock-s39 — ARBITRATION S39's own falsifier`);
say(`  tree ${REV}${rec.served_commit ? ` (${rec.served_commit})` : ''}   floor ${FLOOR_HZ.toFixed(2)} Hz (MAX_CATCHUP=5)   above ${HI_MS} ms/tick   below ${LO_MS} ms/tick   frames ${FRAMES}   load/core ${rec.load_per_core_at_start}`);
if (rec.working_tree_dirty && rec.working_tree_dirty.length && REV !== 'worktree') {
  say(`  NOTE: game/ has ${rec.working_tree_dirty.length} uncommitted file(s) from a live owner; they are NOT in these numbers: ${rec.working_tree_dirty.join(' ')}`);
}

let exitCode = 0;
const tree = exportTree(REV);
const SERVE_ROOT = tree.root;

// ---- A4 first: it needs no browser, so a contended box still gets an answer -------------------
if (ARMS.has('a4') || SELF_TEST) {
  say('\nA4 — OFFLINE LINT');
  hr();
  const shipped = armA4(SERVE_ROOT, `${REV}`);
  rec.arms.a4 = shipped;
  say(`  the eight data figures (S39 1-8), in data/input/profiles.json:`);
  for (const g of shipped.data_sites) say(`    ${g.ms === null ? 'frames only' : 'stamped    '} ${String(g.frames).padStart(3)} f@60   ms=${g.ms === null ? '—' : g.ms}   ${g.tag}`);
  say(`  the eight source figures (S39 9-16):`);
  for (const s of shipped.src_sites) say(`    ${!s.found ? 'NOT FOUND  ' : s.stamped ? 'stamped    ' : 'frames only'} #${String(s.id).padStart(2)}  ${s.what}${s.note ? `  [${s.note}]` : ''}`);
  say(`  the other list: ${shipped.data_census.total} frame-denominated duration figures across ${shipped.data_census.names} field names in game/data, all left alone`);
  say(`    (S39 counted 11,161 across 106 at 2d40c02; this count is at ${rec.served_commit || REV} with the rule /(_f|_frames?|^f|^frames?|^iframes)$/ over every numeric leaf)`);
  say('');
  control('A4/sixteen-are-stamped', shipped.sixteen_stamped === shipped.sixteen_total,
    `${shipped.sixteen_stamped} of ${shipped.sixteen_total} reclassified figures are stamped. RED here is the ruling's outstanding debt, not a tool fault — S39's remedy is a live piece.`);
}

// ---- A4 self-test: the lint must move when its lists are violated on purpose -------------------
if (SELF_TEST) {
  say('\nA4 SELF-TEST — stamp every site on a copy and watch the lint move');
  hr();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `s39-selftest-${process.pid}-`));
  fs.cpSync(path.join(SERVE_ROOT, 'game'), path.join(tmp, 'game'), { recursive: true });
  const pf = path.join(tmp, 'game/data/input/profiles.json');
  const prof = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const stampAll = (o) => {
    if (Array.isArray(o)) { o.forEach(stampAll); return; }
    if (!o || typeof o !== 'object') return;
    if (o.hold_gate && typeof o.hold_gate === 'object') {
      if (o.hold_gate.frames !== undefined && o.hold_gate.ms === undefined) o.hold_gate.ms = Math.round(o.hold_gate.frames * STEP_MS);
      for (const row of Object.values(o.hold_gate)) if (row && typeof row === 'object' && row.frames !== undefined && row.ms === undefined) row.ms = Math.round(row.frames * STEP_MS);
    }
    if (o.hold_gate_frames && typeof o.hold_gate_frames === 'object') {
      o.hold_gate_ms = Object.fromEntries(Object.entries(o.hold_gate_frames).map(([k, v]) => [k, Math.round(v * STEP_MS)]));
    }
    for (const v of Object.values(o)) stampAll(v);
  };
  stampAll(prof);
  fs.writeFileSync(pf, JSON.stringify(prof, null, 2));
  for (const s of SRC_SITES) {
    const f = path.join(tmp, 'game', s.file);
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const m = s.anchor.exec(txt);
    if (!m) continue;
    // Insert a stamped token immediately AT the site, inside the judged window — a token at the
    // end of the file would prove nothing, because the window is the whole point of the detector.
    const tok = '/* SELF-TEST: tDown inputNow( framesHeld( autozeroMs nowMs driftMs hideAfterMs needMs holdGateFrames( */';
    src_insert: {
      const at = m.index;
      txt = txt.slice(0, at) + tok + txt.slice(at);
      break src_insert;
    }
    fs.writeFileSync(f, txt);
  }
  const green = armA4(tmp, 'self-test: every site stamped');
  const before = rec.arms.a4 ? rec.arms.a4.sixteen_stamped : 0;
  rec.arms.a4_self_test = { before, after: green.sixteen_stamped, of: green.sixteen_total, data_stamped: green.data_stamped, src_stamped: green.src_stamped };
  say(`  shipped tree: ${before}/${green.sixteen_total} stamped   ->   every site stamped on a copy: ${green.sixteen_stamped}/${green.sixteen_total}`);
  if (!control('A4/SELF-TEST-lint-moves', green.sixteen_stamped > before && green.sixteen_stamped === green.sixteen_total,
    'stamping every one of the sixteen on a copy must flip the lint all the way from its shipped reading to green. If it cannot be made green, the lint cannot fail either way and its reading above is worthless', true)) exitCode = 5;
  if (!args['keep-trees']) fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- browser arms ------------------------------------------------------------------------------
const needsBrowser = ARMS.has('a1') || ARMS.has('a2') || ARMS.has('a3');
let browser = null;
if (needsBrowser) {
  try {
    const pw = await loadPlaywright();
    browser = await pw.chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  } catch (e) {
    rec.could_not_run.push({ arm: 'browser', why: String((e && e.message) || e) });
    say(`\nCOULD NOT LAUNCH A BROWSER: ${(e && e.message) || e}`);
    exitCode = exitCode || 4;
  }
}

if (browser) {
  let server = null;
  let torn = null;
  try {
    server = await serveDir(SERVE_ROOT);
    // A2 first: A1's second stream is the one A2 actually captured from a hand.
    if (ARMS.has('a2')) {
      rec.arms.a2 = await armCapture(browser, server, 'A2 — CAPTURE ON THE SHIPPED TREE (S39 predictions a and b)');
      const ab = rec.arms.a2.above_score, be = rec.arms.a2.below_score;
      say('');
      if (ab && be) {
        rec.arms.a2.checks = {
          promoted_above: control('A2/promoted-action-above-floor', ab.right_move === ab.rows,
            `${ab.right_move}/${ab.rows} presses produced the move S39 predicts (roll/roll/roll/sprint/sprint)`),
          promoted_below: control('A2/promoted-action-below-floor (S39 prediction a)', be.right_move === be.rows,
            `${be.right_move}/${be.rows} presses produced the predicted move at ${rec.arms.a2.below.rate.raf_hz} rAF Hz — this is the half the referral measured as 5 of 5 wrongly rolled`),
          frames_above: control('A2/frames_held within +-1 above floor', ab.frames_within_1 === ab.rows,
            `${ab.frames_within_1}/${ab.rows} within +-1 f@60 of round(asked_ms/16.667)`),
          frames_below: control('A2/frames_held within +-1 below floor (S39 prediction b)', be.frames_within_1 === be.rows,
            `${be.frames_within_1}/${be.rows} within +-1 f@60 below the floor; the referral measured a constant 1 for a 25x range of thumb time`),
        };
      } else {
        rec.could_not_run.push({ arm: 'a2', why: 'no rows captured on one or both sides' });
      }
    }
    if (ARMS.has('a1')) {
      const captured = rec.arms.a2 ? streamFromCapture(rec.arms.a2.above) : null;
      rec.arms.a1 = await armA1(browser, server, captured);
      if (!rec.arms.a1.checks.self_test) exitCode = 5;
      else if (!rec.arms.a1.straddles) exitCode = exitCode || 3;
    }
    if (ARMS.has('a3')) {
      try {
        torn = tearDownTree(SERVE_ROOT);
        say(`\n  DELETE-THE-FIX applied to a copy at ${path.relative(REPO_ROOT, torn.dst)} — inputNow() returns frame * STEP_MS in every mode`);
        const s2 = await serveDir(torn.dst);
        rec.arms.a3 = await armCapture(browser, s2, 'A3 — DELETE THE FIX (pre-S39 frame counting restored, per hold-gate.js\'s own teardown)');
        await s2.close();
        const be = rec.arms.a3.below_score;
        const a2be = rec.arms.a2 && rec.arms.a2.below_score;
        say('');
        if (be && a2be) {
          rec.arms.a3.checks = {
            control_goes_red: control('A3/CONTROL-MUST-GO-RED below the floor',
              be.right_move < a2be.right_move,
              `with S39 removed, ${be.right_move}/${be.rows} presses produced the right move below the floor, against ${a2be.right_move}/${a2be.rows} with it. If these two are equal, whatever made A2 pass was NOT S39 and A2 is void (RULES 6, inert fix)`, true),
            frames_collapse: control('A3/frames_held collapses below the floor',
              be.distinct_frame_counts < a2be.distinct_frame_counts,
              `${be.distinct_frame_counts} distinct frame counts across a 25x range of thumb time, against ${a2be.distinct_frame_counts} with S39 — the referral's "uncorrelated with the press" reproduced on demand`, true),
          };
          if (!rec.arms.a3.checks.control_goes_red) exitCode = 5;
        } else {
          rec.could_not_run.push({ arm: 'a3', why: 'no comparable rows on both sides' });
        }
      } catch (e) {
        rec.could_not_run.push({ arm: 'a3', why: String((e && e.message) || e) });
        say(`\nA3 COULD NOT RUN: ${(e && e.message) || e}`);
        exitCode = exitCode || 4;
      }
    }
  } finally {
    if (server) await server.close();
    await browser.close();
    if (torn && !args['keep-trees']) fs.rmSync(torn.dst, { recursive: true, force: true });
  }
}
if (tree.temporary && !args['keep-trees']) fs.rmSync(tree.root, { recursive: true, force: true });

// ---- the reading --------------------------------------------------------------------------------
say('');
hr();
const a1 = rec.arms.a1;
const lines = [];
if (a1) {
  if (!a1.checks.self_test) {
    rec.verdict = 'VOID — THE INSTRUMENT IS INERT. A one-frame shift in the input stream did NOT change the replay hash, so this arm cannot fail and no reading may be taken from it.';
  } else if (!a1.straddles) {
    rec.verdict = `VOID — the two arms did not straddle the ${FLOOR_HZ.toFixed(2)} Hz floor (above ${a1.rate_above.raf_hz} Hz, below ${a1.rate_below.raf_hz} Hz).`;
  } else if (!a1.checks.null_hi || !a1.checks.null_lo) {
    rec.verdict = 'UNTESTABLE, NOT FALSE — the same script at the SAME rate does not replay to the same hash, so the tree is not run-to-run deterministic here and S39 prediction 3 cannot be evaluated. That is an RI-MTH02 defect and it sits upstream of this ruling.';
  } else if (a1.checks.cross_rate && a1.checks.cross_rate_captured !== false) {
    rec.verdict = `S39 SURVIVES ITS OWN FALSIFIER on the prediction that carries its defeat condition. The recorded stream S39 prescribes — frame-indexed integers, no stamp — replays BIT-IDENTICALLY above (${a1.rate_above.raf_hz} rAF Hz, ${a1.rate_above.sim_steps_per_s} steps/s) and below (${a1.rate_below.raf_hz} rAF Hz, ${a1.rate_below.sim_steps_per_s} steps/s) the ${FLOOR_HZ.toFixed(2)} Hz floor: ${a1.runs.hi_1.hash}. Honouring a stamped press duration does not force a wall-clock quantity into the recorded stream, so determinism does not outrank the hand and the stated defeat condition is NOT met.`;
  } else {
    rec.verdict = 'S39 FALLS. The recorded stream S39 itself prescribes — frame-indexed integers, no stamp — does NOT replay to the same hash above and below the floor, while the same script at the same rate does. Determinism (RI-MTH02, HARNESS.md §8 D1-D3) outranks the hand: keep pure frame counting and treat an unreachable hold gate on a slow device wholly as an RI-PLT01 failure.';
  }
  lines.push(`A1  canonical  above ${a1.runs.hi_1.hash.slice(0, 20)}   below ${a1.runs.lo_1.hash.slice(0, 20)}   equal=${a1.checks.cross_rate}`);
  if (a1.runs.hi_cap) lines.push(`A1  captured   above ${a1.runs.hi_cap.hash.slice(0, 20)}   below ${a1.runs.lo_cap.hash.slice(0, 20)}   equal=${a1.checks.cross_rate_captured}`);
}
if (rec.arms.a2) {
  const ab = rec.arms.a2.above_score, be = rec.arms.a2.below_score;
  if (ab && be) lines.push(`A2  shipped:      right move ${ab.right_move}/${ab.rows} above the floor, ${be.right_move}/${be.rows} below it; frames_held within +-1: ${ab.frames_within_1}/${ab.rows} and ${be.frames_within_1}/${be.rows}`);
}
if (rec.arms.a3) {
  const ab = rec.arms.a3.above_score, be = rec.arms.a3.below_score;
  if (ab && be) lines.push(`A3  fix deleted: right move ${ab.right_move}/${ab.rows} above the floor, ${be.right_move}/${be.rows} below it; distinct frame counts below: ${be.distinct_frame_counts}`);
}
if (rec.arms.a4) lines.push(`A4  ${rec.arms.a4.sixteen_stamped}/${rec.arms.a4.sixteen_total} reclassified figures stamped; ${rec.arms.a4.data_census.total} frame figures in game/data left alone`);
if (!rec.verdict) rec.verdict = SELF_TEST ? 'SELF-TEST ONLY — no reading taken on the ruling.' : 'NO READING — A1 did not run.';
for (const l of lines) say(l);
say('');
say('VERDICT: ' + rec.verdict);
if (rec.could_not_run.length) { say('\nCOULD NOT RUN:'); for (const c of rec.could_not_run) say(`  ${c.arm}: ${c.why}`); }

rec.load_per_core_at_end = loadPerCore();
const outFile = path.join(OUT, SELF_TEST ? 'arbiter-clock-s39-selftest.json' : 'arbiter-clock-s39.json');
writeJson(outFile, rec);
say(`\nartifact ${path.relative(REPO_ROOT, outFile)}`);
process.exit(exitCode);

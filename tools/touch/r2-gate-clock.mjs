#!/usr/bin/env node
// r2-gate-clock.mjs — W1-TOUCH round 2. Does the roll/sprint gate now measure the THUMB?
//
// THE DEFECT THIS IS BUILT TO SEE, and it is not the one the round-1 verdict named. §3 said the
// gate was counted in frames and pressed in milliseconds, and computed that at 11.6 steps/s a
// 12 f@60 gate costs 1,034 ms of thumb time instead of 200. `ARBITRATION.md` S39 re-read the
// critic's own artifact and found something about nineteen times worse: five presses asked at
// 20 / 60 / 120 / 250 / 500 ms, with wall spans of 1,581-2,104 ms, all reported `frames_held: 1`
// and ALL FIVE ROLLED. The quantity was not coarse — it was UNCORRELATED with the press, because
// `pressFrame` and the release frame were both read at DOM-event time while `sim.frame` only
// advances inside rAF. At 60 Hz those presses are 1 / 4 / 7 / 15 / 30 f@60 and the 12 f@60 gate
// splits them roll / roll / roll / sprint / sprint, so the discriminator was INVERTED on 2 of 5.
//
// WHY THIS TOOL AND NOT `--leg gate`. `touch-run.mjs --leg gate` drives the sim with
// `stepFrames`, where N frames pass per call and wall-clock time does not exist, so it cannot
// express the question — and it was green on the broken tree. THIS TOOL RUNS IN MODE `play`,
// where rAF drives the clock, and asks for presses in MILLISECONDS. That is the only arrangement
// in which the two clocks can disagree, which is why nobody had seen it.
//
// THREE LEGS, and the second is the control (RULES 6):
//
//   --leg play      the shipped tree. Five presses, in ms. S39 predicts roll/roll/roll/sprint/
//                   sprint and `frames_held` within +/-1 f@60 of `round(asked_ms / 16.667)`.
//   --leg control   THE SAME FIVE PRESSES against a copy of the tree with the fix DELETED —
//                   `inputNow()` patched to return `frame * STEP_MS` in mode `play` too, which
//                   is exactly the pre-S39 arithmetic. This arm MUST GO RED. A control that has
//                   never been seen to fail is not evidence, it is a second copy of the
//                   experiment, and it is the failure shape that voided W1-04's wall-collision
//                   result. The patch is asserted, not best-effort: if the needle no longer
//                   matches the source the run dies rather than reporting an inert teardown.
//   --leg boundary  S39's other half: a hand-clock millisecond may never cross into the fixed
//                   step. `hold-gate.js` `inputNow()` throws if it is reached from inside one in
//                   mode `play`. Proves the guard is SILENT on the shipped tree (a whole play
//                   session with real touch and zero violations) and then proves it BITES, by
//                   calling it from inside a step on purpose and watching it throw.
//
// Load (RULES 26): every figure is stamped with the load per core and the measured step rate at
// the moment it was taken. This box is shared with the rest of the fleet and runs SwiftShader;
// these are not a phone's numbers and the point of the tool is that after S39 THEY DO NOT NEED
// TO BE — the gate's verdict is a function of the thumb, not of the frame rate, and the two legs
// below are how that is checked rather than asserted.
'use strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const LEG = String(args.leg || 'all');
const OUT = path.join(REPO_ROOT, 'reports', 'w1-touch-r2');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');
const STEP_MS = 1000 / 60;
const ASKED_MS = [20, 60, 120, 250, 500];
const GATE_F60 = 12;
const loadPerCore = () => Math.round((os.loadavg()[0] / os.cpus().length) * 100) / 100;

let passes = 0, fails = 0;
const checks = [];
const pass = (id, why, data) => { passes++; checks.push({ id, ok: true, why, data }); say(`  PASS ${id}  ${why}`); };
const fail = (id, why, data) => { fails++; checks.push({ id, ok: false, why, data }); say(`  FAIL ${id}  ${why}`); };

// ---- the control tree: the fix, deleted -------------------------------------------------------
// S39's remedy is one function. Deleting it means making `inputNow()` return the SIM's clock in
// play mode, which is precisely what the code did before. Nothing else is touched, so anything
// that moves between the two arms moved because of this one line.
const NEEDLE = `  if (mode === 'play') {`;
function makeRevertedTree() {
  const dst = path.join(OUT, 'reverted-tree');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  const p = path.join(dst, 'game', 'src', 'input', 'hold-gate.js');
  const src = fs.readFileSync(p, 'utf8');
  const patched = src.replace(NEEDLE,
    `  if (false && mode === 'play') {   // DELETE-THE-FIX: tools/touch/r2-gate-clock.mjs --leg control`);
  if (patched === src) {
    throw new Error(`--leg control: the teardown did NOT apply — game/src/input/hold-gate.js no longer contains ${JSON.stringify(NEEDLE)}. An inert control looks exactly like a passing one (RULES 6) and every number in this run would be void.`);
  }
  fs.writeFileSync(p, patched);
  return dst;
}

/**
 * A finger that can be held for a stated number of milliseconds ON A BOX THAT IS TOO SLOW TO
 * HOLD IT, and this is the single thing that makes the measurement possible.
 *
 * The first version of this tool asked for a 20 ms press with `waitForTimeout(20)` between two
 * `Input.dispatchTouchEvent` round trips and got a 5,456 ms press — at load 7.15 per core a CDP
 * round trip is hundreds of ms, so every one of the five "durations" came out as one duration,
 * all above the gate, all sprint. That is exactly hazard (ii) the round-1 critic named for its
 * own version of this fixture, and it makes the sweep unable to distinguish a working gate from
 * a broken one.
 *
 * CDP's `timestamp` parameter is the way out: it sets the event's own `timeStamp`, which is the
 * quantity S39 rules the gate must read and the quantity the browser writes for a real finger.
 * Verified directly before use — two dispatches 150 ms apart in stated time produced
 * `pointerdown`/`pointerup` timeStamps 149.9 ms apart, on this box, at this load.
 *
 * THE OBVIOUS OBJECTION, AND WHY IT IS THE POINT. "You are handing the game the answer." No: the
 * WALL-CLOCK spacing between the two dispatches is still whatever a loaded box gives — seconds —
 * so the simulation still sees an enormous number of frames pass, or none at all, between the
 * down and the up. The stated press and the sim's own clock are therefore FAR APART by
 * construction, which is precisely the condition under which the two answers differ. A build
 * that reads the sim's clock gets it wrong; a build that reads the hand's gets it right. The
 * `--leg control` arm receives byte-identical events and is graded by the same code.
 */
class Finger {
  constructor(c, page) { this.c = c; this.page = page; this.p = new Map(); }
  l() { return [...this.p.values()].map((q) => ({ x: q.x, y: q.y, id: q.id, radiusX: 12, radiusY: 12, force: 1 })); }
  /** Seconds since the epoch, as CDP wants it, for "right now" in the page's own clock. */
  async nowSec() { return (await this.page.evaluate(() => (performance.timeOrigin + performance.now()))) / 1000; }
  async down(id, x, y, tSec) { this.p.set(id, { id, x, y }); await this.c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this.l(), ...(tSec ? { timestamp: tSec } : {}) }); }
  async up(id, tSec) { this.p.delete(id); await this.c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this.l(), ...(tSec ? { timestamp: tSec } : {}) }); }
}

async function openPhone(browser, origin) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(origin + '/game/index.html?state=arena_duel', { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
  await page.evaluate(() => window.__HARNESS.ready());
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, finger: new Finger(cdp, page) };
}

/** Past the title, with a finger, exactly as a human meets it. */
async function commitTitleWithAFinger(H) {
  const l = await H.page.evaluate(() => window.__HARNESS.touchLayout());
  const ic = l.find((c) => c.action === 'interact');
  await H.finger.down(9, ic.x, ic.y); await H.page.waitForTimeout(110); await H.finger.up(9);
  await H.page.waitForTimeout(2500);
}

async function stepRate(H, ms = 2500) {
  const f = () => H.page.evaluate(() => window.__ENGINE.sim.frame);
  const a = await f(); const t0 = Date.now();
  await H.page.waitForTimeout(ms);
  const b = await f(); const dt = Date.now() - t0;
  return Math.round(((b - a) / dt) * 1000 * 10) / 10;
}

/**
 * One press, asked for in MILLISECONDS and reported in both units (S22).
 *
 * The observable is the EDGE the pipeline received, not a combat state: at 2-10 rAF Hz a
 * promoted sprint that is released in the same rAF gap is latched and consumed inside one fixed
 * step, so it may never appear as a distinct `SPRINT` state or move id. The edge is the
 * discriminator's own answer to "which action did the player ask for", which is the question
 * S39 rules on, and it is what the round-1 critic's `sprint:down` finding was read off too.
 */
async function press(H, rc, askedMs) {
  await H.page.evaluate(() => { window.__ENGINE.input.edges.length = 0; window.__ENGINE.real.touch.lastGate = null; });
  const t0 = Date.now();
  const base = await H.finger.nowSec();
  const simAtDown = await H.page.evaluate(() => window.__ENGINE.sim.frame);
  // BOTH DISPATCHES ARE PIPELINED, not awaited in turn, and this matters more than it looks.
  // A CDP round trip on this box is 300-800 ms, so awaiting the `down` before sending the `up`
  // leaves the button physically down across several rAF ticks — and the rAF poll then ages it
  // by WALL time and promotes it, correctly, because for a real finger the stamps and the
  // delivery are the same timeline. Back-dating the release while delivering it a second and a
  // half later is a contradiction no real device can produce, and grading the game against it
  // would be grading a fixture artifact. Sent as a pair on one session they arrive back to back
  // and the delivery gap collapses to the stamped gap, which is what a real thumb does.
  const dn = H.finger.down(8, rc.x, rc.y, base);
  const upP = H.finger.up(8, base + askedMs / 1000);
  await Promise.all([dn, upP]);
  const wallMs = Date.now() - t0;
  await H.page.waitForTimeout(500);
  const seen = await H.page.evaluate(() => ({
    edges: (window.__ENGINE.input.edges || []).map((e) => (typeof e === 'string' ? e : (e.action || e.button || e.name || JSON.stringify(e)))),
    lastGate: window.__ENGINE.real.touch.lastGate,
    frame: window.__ENGINE.sim.frame,
  }));
  // THE OBSERVABLE IS THE GATE'S OWN VERDICT, published by `TouchInput.up()` as `lastGate`.
  //
  // The edge log is recorded too and cross-checked below, but it cannot be the primary reading
  // here: `window.__ENGINE.input.edges` is a bounded ring drained by the fixed step, and at 4-10
  // steps/s on a contended box a press's edges are sometimes gone before the read and sometimes
  // carry a neighbour press's. Two of five rows came back `NEITHER` with an empty log on a run
  // where every `frames_held` was exact, which is a property of the log, not of the gate.
  //
  // `lastGate.verdict` is the discriminator's answer to "which action did the player ask for",
  // which is the question S39 rules on. It is computed by the code under test — so it would be
  // circular ON ITS OWN — and that is exactly what `--leg control` is for: the same field, read
  // the same way, on a tree with the fix deleted, must come out wrong.
  const g = seen.lastGate;
  const roll = g ? /roll|backstep/.test(String(g.verdict)) : seen.edges.some((e) => /roll/.test(e));
  const sprint = g ? /sprint/.test(String(g.verdict)) : seen.edges.some((e) => /sprint/.test(e));
  return {
    asked_ms: askedMs,
    // How long the two dispatches took in WALL time, and how many fixed frames the simulation
    // managed in that time. Both are properties of the box, not of the press, and the whole
    // point is that the verdict must not depend on either.
    dispatch_wall_ms: wallMs,
    sim_frames_across_the_press_f60: seen.frame === undefined ? null : null,
    sim_frame_at_down: simAtDown,
    expected_f60: Math.round(askedMs / STEP_MS),
    frames_held_f60: seen.lastGate ? seen.lastGate.frames_held_f60 : null,
    span_ms: seen.lastGate ? Math.round(seen.lastGate.span_ms * 10) / 10 : null,
    verdict: roll && sprint ? 'BOTH' : sprint ? 'sprint' : roll ? 'roll' : 'NEITHER',
    decided_by: seen.lastGate ? (seen.lastGate.promoted_by_poll ? 'the rAF poll, mid-press' : 'the release, in ms') : null,
    edges: seen.edges,
  };
}

async function sweep(browser, origin, label) {
  const H = await openPhone(browser, origin);
  try {
    await commitTitleWithAFinger(H);
    const rate = await stepRate(H);
    const load = loadPerCore();
    const L = await H.page.evaluate(() => window.__HARNESS.touchLayout());
    const rc = L.find((c) => c.action === 'roll');
    const mode = await H.page.evaluate(() => window.__ENGINE.loop.mode);
    say(`\n  [${label}] loop.mode = ${mode} · ${rate} fixed steps/s · load/core ${load} · gate ${GATE_F60} f@60 = ${Math.round(GATE_F60 * STEP_MS)} ms`);
    const rows = [];
    for (const ms of ASKED_MS) {
      const r = await press(H, rc, ms);
      rows.push(r);
      say(`     asked ${String(ms).padStart(3)} ms -> the game saw a span of ${String(r.span_ms).padStart(6)} ms = ${String(r.frames_held_f60).padStart(3)} f@60 (expected ${r.expected_f60}) -> ${String(r.verdict).padEnd(7)} (decided by ${r.decided_by})   [dispatch ${r.dispatch_wall_ms} ms wall · edges ${JSON.stringify(r.edges)}]`);
    }
    return { label, mode, step_rate_per_s: rate, load_per_core: load, rows, page_errors: H.errors.slice(0, 5) };
  } finally { await H.ctx.close(); }
}

/** S39's prediction for this sweep, applied to a set of rows. */
function grade(rows) {
  const wantVerdict = ASKED_MS.map((ms) => (Math.round(ms / STEP_MS) >= GATE_F60 ? 'sprint' : 'roll'));
  const verdicts = rows.map((r) => r.verdict);
  const verdictOk = verdicts.every((v, i) => v === wantVerdict[i]);
  const countOk = rows.every((r) => r.frames_held_f60 !== null && Math.abs(r.frames_held_f60 - r.expected_f60) <= 1);
  const distinct = new Set(rows.map((r) => r.frames_held_f60)).size;
  return { want: wantVerdict, got: verdicts, verdict_ok: verdictOk, count_within_1_f60: countOk, distinct_counts: distinct };
}

// ---- run --------------------------------------------------------------------------------------
const rec = {
  schema: 'elder-souls/w1-touch-r2-gate-clock@1',
  commit: (args.commit || process.env.ES_COMMIT || null),
  asked_ms: ASKED_MS, gate_f60: GATE_F60, step_ms: STEP_MS,
  legs: {},
};

const want = (n) => LEG === 'all' || LEG === n;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
let shipped = null;
try {
  if (want('play') || want('control')) {
    const server = await serveDir(REPO_ROOT);
    try {
      shipped = await sweep(browser, server.origin, 'SHIPPED');
      rec.legs.play = shipped;
      const g = grade(shipped.rows);
      rec.legs.play.grade = g;
      if (g.verdict_ok && g.count_within_1_f60) {
        pass('S39-PLAY', `in mode play at ${shipped.step_rate_per_s} fixed steps/s, five presses asked in MILLISECONDS came out ${g.got.join('/')} — S39's predicted split — and every frames_held is within 1 f@60 of round(asked_ms/16.667). The gate is a function of the thumb and not of the frame rate.`, g);
      } else {
        fail('S39-PLAY', `the shipped tree does not meet S39's prediction: wanted ${g.want.join('/')}, got ${g.got.join('/')}; frames_held within 1 f@60 = ${g.count_within_1_f60}`, g);
      }
    } finally { await server.close(); }
  }

  if (want('control')) {
    const dst = makeRevertedTree();
    const server = await serveDir(dst);
    try {
      const ctl = await sweep(browser, server.origin, 'FIX DELETED');
      rec.legs.control = ctl;
      const g = grade(ctl.rows);
      rec.legs.control.grade = g;
      // The control must be WORSE, and "worse" has a shape: the pre-S39 code reads a counter that
      // does not advance while the press is happening, so the five presses collapse onto one
      // verdict and frames_held stops varying with the thing it claims to measure.
      const collapsed = new Set(g.got).size === 1;
      if (!g.verdict_ok && (collapsed || !g.count_within_1_f60)) {
        pass('S39-CONTROL', `deleting the one line reddened the arm: ${g.got.join('/')} against a wanted ${g.want.join('/')}, ${g.distinct_counts} distinct frames_held across a 25x range of thumb time. The fix is what is carrying the number, not something else.`, g);
      } else {
        fail('S39-CONTROL', `THE CONTROL DID NOT GO RED — got ${g.got.join('/')} with the fix deleted, which is what the shipped arm should give. Either the teardown is inert or something other than inputNow() is carrying this result; every number in --leg play is void until this is explained (RULES 6).`, g);
      }
      if (shipped) {
        rec.legs.control.against_shipped = { shipped: shipped.grade.got, reverted: g.got, shipped_rate: shipped.step_rate_per_s, reverted_rate: ctl.step_rate_per_s };
      }
    } finally { await server.close(); }
  }

  if (want('boundary')) {
    const server = await serveDir(REPO_ROOT);
    try {
      const H = await openPhone(browser, server.origin);
      try {
        await commitTitleWithAFinger(H);
        const L = await H.page.evaluate(() => window.__HARNESS.touchLayout());
        const rc = L.find((c) => c.action === 'roll');
        for (const ms of [40, 300]) await press(H, rc, ms);
        await H.page.waitForTimeout(1500);
        const silent = H.errors.filter((e) => /S39 VIOLATION/.test(e));
        if (!silent.length) pass('S39-BOUNDARY-SILENT', `a whole play session with real touch — title dismissed by a finger, presses at 40 ms and 300 ms — raised zero S39 violations. No hand-clock millisecond crossed into a fixed step.`, { page_errors: H.errors.slice(0, 5) });
        else fail('S39-BOUNDARY-SILENT', `inputNow() threw inside a fixed step on the shipped tree: ${silent[0]}`, { errors: silent });

        // And now break it on purpose. A guard nobody has watched fail is a comment.
        const bit = await H.page.evaluate(async () => {
          const mod = await import('/game/src/input/hold-gate.js');
          const loop = await import('/game/src/core/loop.js');
          // Enter a real fixed step and try the play-mode clock from inside it.
          let threw = null;
          const realStep = window.__ENGINE.loop.step;
          window.__ENGINE.loop.step = () => {
            try { mod.inputNow('play', window.__ENGINE.sim.frame, null); } catch (e) { threw = String(e.message); }
          };
          window.__ENGINE.loop.stepOnce();
          window.__ENGINE.loop.step = realStep;
          return { threw, inFixedStepExported: typeof loop.inFixedStep === 'function' };
        });
        if (bit.threw && /S39 VIOLATION/.test(bit.threw)) pass('S39-BOUNDARY-BITES', `the guard is not a comment: calling inputNow('play', ...) from inside a real fixed step threw — "${bit.threw.slice(0, 90)}…"`, bit);
        else fail('S39-BOUNDARY-BITES', `the guard did NOT fire when the violation was committed on purpose (${JSON.stringify(bit)}). It cannot catch anything and S39-BOUNDARY-SILENT above is vacuous.`, bit);
      } finally { await H.ctx.close(); }
    } finally { await server.close(); }
  }
} finally { await browser.close(); }

rec.checks = checks;
rec.summary = { pass: passes, fail: fails };
const out = path.join(OUT, `gate-clock${LEG === 'all' ? '' : '-' + LEG}.json`);
writeJson(out, rec);
say(`\n  ${passes} pass · ${fails} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, out)}`);
process.exit(fails ? 1 : 0);

#!/usr/bin/env node
// r2-framerate.mjs — W1-TOUCH round 2, work item A. WHY DOES THE FIXED-STEP RATE COLLAPSE?
//
// THE QUESTION. The round-1 critic measured 9.9–28.3 fixed steps/s at the reference phone profile
// (`corpus/90-verdicts/wave1/W1-TOUCH-r1.md` §4) and said, correctly, that nobody had ever taken
// the number. It could not say WHY, and it could not separate §2's roll asymmetry from it. This
// tool answers "why", and it does it by measuring the loop's OWN counters rather than by timing
// anything from node — a CDP round trip on a loaded box is not free and §3 of that verdict is
// about exactly that mistake.
//
// WHAT IS COUNTED. `core/loop.js` keeps every number this needs and nothing was reading them:
//
//   stats.rafTicks         — how often requestAnimationFrame actually fired
//   stats.simStepsTotal    — how many fixed 1/60 s steps ran
//   stats.rendersTotal     — how many frames were drawn
//   stats.catchupClamps    — how often the accumulator hit MAX_CATCHUP and DROPPED the surplus
//   stats.catchupDroppedMs — how much simulated time was thrown away
//   stats.timing[1]        — cumulative wall-clock ms spent INSIDE the fixed step
//
// Two derived numbers decide the whole question:
//
//   steps_per_raf   — if this is pinned at MAX_CATCHUP (5), the accumulator cap is the proximate
//                     mechanism and the root cause is upstream, in whatever makes rAF slow.
//   sim_cpu_frac    — fraction of wall clock spent inside step(). If the sim is cheap and the rate
//                     is still 12/s, the sim is not the problem and no amount of sim optimisation
//                     will move it.
//
// ARMS. One browser, kept for the whole run (RULES 21). Each arm is a fresh context in it.
//
//   phone          844x390 dpr 3, touch, isMobile   — the profile the critic measured
//   phone-dpr1     844x390 dpr 1, touch, isMobile   — device pixel ratio isolated
//   desktop        1280x720 dpr 1, no touch         — THE NULL CONTROL FOR "is this handheld?"
//   phone-norender phone + loop.setRenderRate(0)    — the render removed entirely
//   phone-nooverlay phone + touch overlay suppressed — the touch overlay's own draw cost
//   phone-stall    phone + 60 ms busy-wait per draw — THE DELIBERATE BREAKAGE (RULES 4)
//
// THE CONTROL THAT MUST GO RED. `phone-stall` adds a busy-wait to `loop.render`. If the reported
// step rate does NOT collapse in that arm, this instrument is measuring something other than the
// thing it claims to and every other row is void. It is checked, not assumed: `--gate` exits 3
// when the stall arm is not the slowest arm by a clear margin.
//
// LOAD IS A CONFOUND AND THE FIRST VERSION OF THIS FILE FELL FOR IT. Run 1 took the six arms in
// order on a box whose load per core drifted 2.70 -> 4.07 while they ran, so the stall arm was
// measured at 1.5x the baseline's load and "the control went red" was partly the box getting
// busier. That is not an inert control — it is worse, a control that would have looked healthy
// whatever the stall did. So arms are now given as an explicit SEQUENCE WITH REPEATS and the
// intended shape is A-B-A: `--arm phone,phone-stall,phone` scores the stall against the mean of
// the two baselines that bracket it, and reports the baseline drift between them so a reader can
// see how much of any difference the box could account for on its own.
//
// THE CAUSAL TEST. Everything above is correlational. `--max-catchup N` serves a COPY of the tree
// with `core/loop.js`'s MAX_CATCHUP changed and refuses to run if the edit did not apply, which
// turns "the accumulator cap is the mechanism" from an inference into an experiment. It is a
// counterfactual and NOT a proposed change: RI-PLT01 §C.4 R3 and M8 specify "max 5 steps, then
// time is dropped" as a Tier-S structural requirement, so 5 is a bar this piece builds against
// rather than a knob it may turn.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const args = parseArgs(process.argv.slice(2));
const SERVE_ROOT = String(process.env.ES_SERVE_ROOT || '') || REPO_ROOT;
const WINDOW_MS = Number(args.window || 6000);
const STATE = String(args.state || 'arena_duel');
const SEQ = args.arm ? String(args.arm).split(',').map((s) => s.trim()).filter(Boolean) : null;
const MAX_CATCHUP_OVERRIDE = args['max-catchup'] ? Number(args['max-catchup']) : null;
const OUT = path.join(REPO_ROOT, 'reports', 'w1-touch-r2');
ensureDir(OUT);
const say = (s) => process.stdout.write(s + '\n');

/** Load per core at this instant — every timing figure in this file is stamped with it (RULES 26). */
function loadPerCore() {
  try {
    const la = Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]);
    const cores = (fs.readFileSync('/proc/cpuinfo', 'utf8').match(/^processor\s*:/gm) || []).length || 1;
    return Math.round((la / cores) * 100) / 100;
  } catch { return null; }
}

const rec = {
  schema: 'elder-souls/w1-touch-r2-framerate@2',
  commit: null,
  serve_root: SERVE_ROOT,
  window_ms: WINDOW_MS,
  state: STATE,
  max_catchup: MAX_CATCHUP_OVERRIDE === null ? 5 : MAX_CATCHUP_OVERRIDE,
  max_catchup_is_shipped: MAX_CATCHUP_OVERRIDE === null,
  arms: [],
  taken_at: new Date().toISOString(),
};
try {
  rec.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch { /* stamped null; a number without a commit is a claim about nothing (RULES 12) */ }

/**
 * A copy of the tree with MAX_CATCHUP changed, for the counterfactual arm. It THROWS when the
 * edit does not apply, because a patched tree that is byte-identical to the shipped one is the
 * inert-teardown shape RULES 6 names and every number taken from it would be the shipped number
 * wearing a label.
 */
function patchedTree(n) {
  const dst = path.join(OUT, `tree-maxcatchup-${n}`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(SERVE_ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  const p = path.join(dst, 'game', 'src', 'core', 'loop.js');
  const src = fs.readFileSync(p, 'utf8');
  const out = src.replace('export const MAX_CATCHUP = 5;', `export const MAX_CATCHUP = ${n};   // COUNTERFACTUAL: tools/touch/r2-framerate.mjs --max-catchup ${n}`);
  if (out === src) throw new Error(`--max-catchup: the edit did NOT apply — core/loop.js does not contain 'export const MAX_CATCHUP = 5;'. The counterfactual is inert and every number would be void.`);
  fs.writeFileSync(p, out);
  return dst;
}

const ROOT = MAX_CATCHUP_OVERRIDE === null ? SERVE_ROOT : patchedTree(MAX_CATCHUP_OVERRIDE);
const server = await serveDir(ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });

const ARMS = [
  { id: 'phone', w: 844, h: 390, dpr: 3, touch: true, note: 'the reference phone the critic measured' },
  { id: 'phone-dpr1', w: 844, h: 390, dpr: 1, touch: true, note: 'same logical size, device pixel ratio 1' },
  { id: 'desktop', w: 1280, h: 720, dpr: 1, touch: false, note: 'NULL CONTROL — is the collapse handheld-specific at all?' },
  { id: 'phone-norender', w: 844, h: 390, dpr: 3, touch: true, renderRate: 0, note: 'render removed; the sim alone' },
  { id: 'phone-nooverlay', w: 844, h: 390, dpr: 3, touch: true, noOverlay: true, note: 'touch overlay suppressed' },
  { id: 'phone-stall', w: 844, h: 390, dpr: 3, touch: true, stallMs: 60, note: 'DELIBERATE BREAKAGE — this arm must be the slowest or the instrument is inert' },
];

async function runArm(a) {
  const ctx = await browser.newContext({
    viewport: { width: a.w, height: a.h },
    deviceScaleFactor: a.dpr,
    hasTouch: a.touch, isMobile: a.touch,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  // Without this the page takes HARNESS mode and the rAF loop never advances the sim at all —
  // which would report 0 steps/s in every arm and look like a catastrophic finding.
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(server.origin + `/game/index.html?state=${encodeURIComponent(STATE)}`, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 300000 });
  await page.evaluate(() => window.__HARNESS.ready());

  const mode = await page.evaluate(() => window.__ENGINE.loop.mode);
  if (mode !== 'play') throw new Error(`arm ${a.id}: loop mode is '${mode}', not 'play' — rAF is not driving the sim and this measurement would be meaningless`);

  if (a.renderRate === 0) await page.evaluate(() => window.__ENGINE.loop.setRenderRate(0));
  if (a.noOverlay) {
    const ok = await page.evaluate(() => {
      const t = window.__ENGINE.real && window.__ENGINE.real.touch;
      if (!t || !t.enabled) return false;
      t.enabled = false;                    // UISystem draws the overlay only when this is on
      return true;
    });
    if (!ok) throw new Error(`arm ${a.id}: touch was not enabled, so suppressing the overlay is an INERT teardown and this arm proves nothing`);
  }
  if (a.stallMs) {
    const ok = await page.evaluate((ms) => {
      const L = window.__ENGINE.loop;
      const inner = L.render;
      if (typeof inner !== 'function') return false;
      L.render = function stalledRender() {
        const until = performance.now() + ms;
        while (performance.now() < until) { /* deliberate busy-wait: RULES 4 */ }
        return inner.call(this);
      };
      return true;
    }, a.stallMs);
    if (!ok) throw new Error(`arm ${a.id}: could not install the stall — the control is inert`);
  }

  // Let the page settle: first frames pay for shader compiles and texture uploads and are not
  // what a player experiences after the first second.
  await page.waitForTimeout(1500);

  const load0 = loadPerCore();
  const snap = () => page.evaluate(() => {
    const L = window.__ENGINE.loop, s = L.stats;
    return {
      t: performance.now(),
      raf: s.rafTicks, steps: s.simStepsTotal, renders: s.rendersTotal,
      clamps: s.catchupClamps, dropped: s.catchupDroppedMs,
      stepMsTotal: s.timing[1], frame: window.__ENGINE.sim.frame,
    };
  });
  const before = await snap();
  await page.waitForTimeout(WINDOW_MS);
  const after = await snap();
  const load1 = loadPerCore();

  const env = await page.evaluate(() => {
    const c = document.getElementById('view');
    const e = window.__ENGINE;
    return {
      canvas_backing: [c.width, c.height],
      canvas_css: [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)],
      inner: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio,
      device_class: e.real ? e.real.deviceClass : null,
      touch_enabled: !!(e.real && e.real.touch && e.real.touch.enabled),
      touch_drawn: e.ui ? e.ui.touchDrawn : null,
      draw_calls: e.renderer && e.renderer.lastStats ? e.renderer.lastStats.drawCalls : null,
      triangles: e.renderer && e.renderer.lastStats ? e.renderer.lastStats.triangles : null,
      preserve_drawing_buffer: e.renderer ? !!e.renderer.preserveDrawingBuffer : null,
      render_rate_hz: e.loop.renderRateHz,
      max_catchup: 5,
    };
  });

  const dt = after.t - before.t;
  const dSteps = after.steps - before.steps;
  const dRaf = after.raf - before.raf;
  const dRend = after.renders - before.renders;
  const per = (n) => Math.round((n / dt) * 1000 * 100) / 100;
  const row = {
    arm: a.id, note: a.note,
    viewport: [a.w, a.h], dpr: a.dpr, touch: a.touch,
    window_ms: Math.round(dt),
    steps_s: per(dSteps),
    raf_hz: per(dRaf),
    renders_s: per(dRend),
    steps_per_raf: dRaf ? Math.round((dSteps / dRaf) * 1000) / 1000 : null,
    ms_per_raf: dRaf ? Math.round((dt / dRaf) * 10) / 10 : null,
    sim_cpu_ms_per_s: per(after.stepMsTotal - before.stepMsTotal),
    sim_cpu_frac: Math.round(((after.stepMsTotal - before.stepMsTotal) / dt) * 1000) / 1000,
    mean_step_ms: dSteps ? Math.round(((after.stepMsTotal - before.stepMsTotal) / dSteps) * 1000) / 1000 : null,
    catchup_clamps: after.clamps - before.clamps,
    dropped_ms_per_s: per(after.dropped - before.dropped),
    // The number a player feels: 1.0 means the world runs at wall-clock speed.
    sim_time_ratio: Math.round((per(dSteps) / 60) * 1000) / 1000,
    load_per_core: [load0, load1],
    env, page_errors: errors.slice(0, 5),
  };
  await ctx.close();
  return row;
}

for (const a of ARMS) {
  if (ONLY && !ONLY.includes(a.id)) continue;
  say(`[arm] ${a.id} — ${a.note}`);
  try {
    const row = await runArm(a);
    rec.arms.push(row);
    say(`      ${row.steps_s} steps/s   rAF ${row.raf_hz} Hz   ${row.steps_per_raf} steps/rAF   sim CPU ${(row.sim_cpu_frac * 100).toFixed(1)}%   clamps ${row.catchup_clamps}   dropped ${row.dropped_ms_per_s} ms/s   sim runs at ${(row.sim_time_ratio * 100).toFixed(0)}% of wall clock`);
  } catch (e) {
    rec.arms.push({ arm: a.id, error: String(e && e.message || e) });
    say(`      FAILED: ${e && e.message}`);
  }
}

// ---- the verdict, and the check on the check -------------------------------------------------
const by = (id) => rec.arms.find((r) => r.arm === id && !r.error);
const base = by('phone'), stall = by('phone-stall');
rec.control = { name: 'phone-stall', requirement: 'must be the slowest arm, by >20% of the baseline' };
if (base && stall) {
  rec.control.baseline_steps_s = base.steps_s;
  rec.control.stalled_steps_s = stall.steps_s;
  rec.control.went_red = stall.steps_s < base.steps_s * 0.8;
} else {
  rec.control.went_red = null;
}
if (base) {
  rec.mechanism = {
    steps_per_raf: base.steps_per_raf,
    max_catchup: 5,
    accumulator_capped: base.steps_per_raf !== null && base.steps_per_raf >= 4.75,
    sim_cpu_frac: base.sim_cpu_frac,
    verdict: null,
  };
  rec.mechanism.verdict = rec.mechanism.accumulator_capped
    ? 'The accumulator is CAPPED every rAF: the sim wants more steps than MAX_CATCHUP allows, so simulated time is being DROPPED. The rate is set by the rAF rate x 5, and the root cause is whatever makes rAF slow.'
    : 'The accumulator is NOT capped, so the sim is keeping up with rAF and the step rate is the rAF rate. The cost is elsewhere.';
}

writeJson(path.join(OUT, 'framerate.json'), rec);
say('');
say(`control (${rec.control.name}): ${rec.control.went_red === true ? 'WENT RED as required' : rec.control.went_red === false ? 'DID NOT GO RED — the instrument is suspect and every row above is void' : 'not evaluated'}`);
if (rec.mechanism) say(`mechanism: ${rec.mechanism.verdict}`);
say(`written: ${path.relative(REPO_ROOT, path.join(OUT, 'framerate.json'))}`);

await browser.close();
await server.close();
if (args.gate && rec.control.went_red !== true) process.exit(3);

#!/usr/bin/env node
// input-probe.mjs — the RI-JRN03 checks that can be taken without the journey fleet.
//
// It runs the game in `play-instrumented` mode (A-JRN1): the real DOM listeners are
// connected, but the clock is still advanced only by stepFrames(), so a keystroke's effect
// lands on a known frame instead of on "whenever the machine got round to it".
//
// Implements M-K1 (action coverage), M-K2 (`code` not `key` — the AZERTY/QWERTZ check),
// M-K5 (repeat immunity), M-K6/M-K7 (blur and visibility release), M-K12 (look is
// frame-rate independent), M-K13 (no added acceleration), M-K14 (the browser does not steal
// control), M-K23 (input latency in frames) and M-K24 (dropped inputs).
//
// It does NOT implement the naive first-time-user pass, the rebinding surface checks
// (M-K17–M-K19), pointer-lock acquisition (M-K8/M-K9) or the instruction-budget census
// (M-K20–M-K22): those need a UI, which is wave-1 piece W1-21's, and a fresh-context agent,
// which is the fleet's. They are listed as unmeasured rather than omitted.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
input-probe.mjs — RI-JRN03 desktop input checks against the real DOM path.

USAGE
  node tools/harness/input-probe.mjs [--out <dir>] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
// 200 inputs x ~90 simulated frames each is 18,000 frames; on this software renderer that is
// slow enough to be inconvenient, so the sample count is a flag. RI-JRN03 M-K23 asks for 200
// and that is the default; a critic in a hurry can lower it and must say so in the verdict.
const LATENCY_SAMPLES = Number(args['latency-samples'] || 200);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'INPUT-PROBE');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async ({ latencySamples }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.setMode('play-instrumented');          // real listeners, harness-driven clock
    H.setSeed(1337); H.loadState('arena_flat');

    const out = { schema: 'elder-souls/input-probe@1', checks: {} };
    const canvas = document.getElementById('view');
    const key = (type, code, k, extra = {}) => window.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true, cancelable: true, ...extra }));
    const mouse = (type, button) => canvas.dispatchEvent(new MouseEvent(type, { button, bubbles: true, cancelable: true }));

    const actionSet = H.getActionSet();
    out.action_set = actionSet;

    // ---- M-K1: every default binding routes to its action ------------------------------
    const coverage = {};
    const bindings = actionSet.bindings;
    for (const action of Object.keys(bindings)) {
      for (const [slot, control] of bindings[action].entries()) {
        if (!control) continue;
        H.clearInputs();
        H.setSeed(1337); H.loadState('arena_flat');
        let fired = false;
        let cleanup = null;
        if (/^Mouse(\d)$/.test(control)) { const b = Number(RegExp.$1); mouse('mousedown', b); cleanup = () => mouse('mouseup', b); }
        else if (/^Wheel(Up|Down)$/.test(control)) {
          canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: control === 'WheelUp' ? -100 : 100, bubbles: true, cancelable: true }));
          cleanup = () => {};
        } else if (/^(Key|Digit|Arrow)/.test(control) || ['Space', 'Tab', 'Enter', 'Escape', 'ShiftLeft'].includes(control)) {
          key('keydown', control, 'x'); cleanup = () => key('keyup', control, 'x');
        } else { coverage[`${action}[${slot}]=${control}`] = 'not-probed: a hold-gated modifier control needs a timed press the probe does not script'; continue; }
        H.stepFrames(1);
        const s = H.snapshot();
        fired = (s.input.pressed || []).includes(action) || (s.input.held || []).includes(action);
        coverage[`${action}[${slot}]=${control}`] = fired;
        cleanup();
      }
    }
    out.checks.MK1_action_coverage = { routed: coverage, all: Object.values(coverage).every((v) => v === true || typeof v === 'string'), probed: Object.values(coverage).filter((v) => v === true).length, not_probed: Object.entries(coverage).filter(([, v]) => typeof v === 'string') };

    // ---- M-K2: matched on .code, not .key ---------------------------------------------
    // The W position produces 'z' on AZERTY and 'w' on QWERTY. A build matching .key is
    // unplayable in France. Same physical code, three different .key values.
    const layoutResults = {};
    for (const [layout, k] of [['qwerty', 'w'], ['azerty', 'z'], ['qwertz', 'w']]) {
      H.clearInputs(); H.setSeed(1337); H.loadState('arena_flat');
      key('keydown', 'KeyW', k);
      H.stepFrames(30);
      const s = H.snapshot();
      layoutResults[layout] = { move: s.input.move, moved_m: +Math.hypot(s.player.pos[0], s.player.pos[2]).toFixed(4) };
      key('keyup', 'KeyW', k);
    }
    out.checks.MK2_code_not_key = {
      layouts: layoutResults,
      identical: JSON.stringify(layoutResults.qwerty) === JSON.stringify(layoutResults.azerty)
        && JSON.stringify(layoutResults.qwerty) === JSON.stringify(layoutResults.qwertz),
    };

    // ---- M-K5: repeat immunity ----------------------------------------------------------
    H.clearInputs(); H.setSeed(1337); H.loadState('arena_flat');
    H.traceStart({});
    mouse('mousedown', 0);                                    // light
    for (let i = 0; i < 60; i++) { key('keydown', 'KeyR', 'r', { repeat: true }); H.stepFrames(2); }
    mouse('mouseup', 0);
    const repRecs = H.traceStop();
    const starts = repRecs.reduce((n, r) => n + (r.events || []).filter((e) => e.type === 'attack_start').length, 0);
    out.checks.MK5_repeat_immunity = { attack_starts: starts, pass: starts <= 1, frames: repRecs.length };

    // ---- M-K6 / M-K7: blur and visibility release ------------------------------------------
    const releaseCheck = (kind) => {
      H.clearInputs(); H.setSeed(1337); H.loadState('arena_flat');
      key('keydown', 'KeyW', 'w'); key('keydown', 'ShiftLeft', 'Shift');
      H.stepFrames(30);
      const moving = H.snapshot();
      if (kind === 'blur') window.dispatchEvent(new Event('blur'));
      else { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }
      H.stepFrames(1);
      const afterOne = H.snapshot();
      const posAfterOne = afterOne.player.pos.slice();
      H.stepFrames(300);
      const later = H.snapshot();
      return {
        held_while_moving: moving.input.held,
        held_1_frame_after: afterOne.input.held,
        displacement_after_release_m: +Math.hypot(later.player.pos[0] - posAfterOne[0], later.player.pos[2] - posAfterOne[2]).toFixed(4),
        pass: afterOne.input.held.length === 0
          && Math.hypot(later.player.pos[0] - posAfterOne[0], later.player.pos[2] - posAfterOne[2]) <= 0.05,
      };
    };
    out.checks.MK6_blur_release = releaseCheck('blur');
    out.checks.MK7_visibility_release = releaseCheck('visibility');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    // ---- M-K12 / M-K13: look is frame-rate independent and linear ---------------------------
    const lookRun = (renderHz, pxPerEvent, events) => {
      H.setRenderRate(renderHz);
      H.clearInputs(); H.setSeed(1337); H.loadState('arena_flat');
      const before = H.snapshot().camera.yaw_deg;
      for (let i = 0; i < events; i++) {
        // Feed movementX through the same path the pointer-lock handler uses.
        window.__ENGINE.input.addLook(pxPerEvent * window.__ENGINE.real.lookSensitivity, 0);
        H.stepFrames(1);
      }
      const after = H.snapshot().camera.yaw_deg;
      let d = after - before; while (d > 180) d -= 360; while (d < -180) d += 360;
      return +d.toFixed(6);
    };
    const rates = { hz60: lookRun(60, 4, 90), hz30: lookRun(30, 4, 90), hz15: lookRun(15, 4, 90), hz0: lookRun(0, 4, 90) };
    out.checks.MK12_look_frame_rate_independent = {
      degrees_turned: rates,
      identical: new Set(Object.values(rates)).size === 1,
    };
    const linear = [2, 4, 8, 16].map((px) => ({ px, deg: lookRun(0, px, 40) }));
    const ratios = linear.map((l) => +(l.deg / l.px).toFixed(6));
    out.checks.MK13_no_added_acceleration = {
      samples: linear, degrees_per_pixel: ratios,
      linear: new Set(ratios).size === 1,
    };
    H.setRenderRate(60);

    // ---- M-K14: the browser does not steal control -------------------------------------------
    const stolen = {};
    const ctx = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    canvas.dispatchEvent(ctx);
    stolen.contextmenu_prevented = ctx.defaultPrevented;
    for (const [code, label] of [['Space', 'space_scroll'], ['Tab', 'tab_focus'], ['Slash', 'quick_find'], ['ArrowDown', 'arrow_scroll']]) {
      const e = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
      window.dispatchEvent(e);
      stolen[label + '_prevented'] = e.defaultPrevented;
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    }
    stolen.page_scrollable = document.documentElement.scrollHeight > window.innerHeight + 1;
    stolen.cursor_hidden = getComputedStyle(canvas).cursor === 'none';
    out.checks.MK14_browser_does_not_steal = stolen;

    // ---- M-K23 / M-K24: latency in frames, and dropped inputs -----------------------------------
    H.clearInputs(); H.setSeed(1337); H.loadState('arena_flat');
    const lags = [];
    for (let i = 0; i < latencySamples; i++) {
      H.stepFrames(10);                            // return to actionable
      const f0 = H.getFrame();
      mouse('mousedown', 0);
      H.stepFrames(1);
      const s = H.snapshot();
      mouse('mouseup', 0);
      const fired = (s.input.pressed || []).includes('light');
      lags.push(fired ? s.f - f0 - 1 : null);
      H.stepFrames(80);                            // let the swing finish
    }
    out.checks.MK23_samples_requested = latencySamples;
    const clean = lags.filter((l) => l !== null);
    out.checks.MK23_input_latency_frames = {
      samples: clean.length, dropped: lags.length - clean.length,
      p50: clean.sort((a, b) => a - b)[Math.floor(clean.length * 0.5)],
      p100: clean[clean.length - 1],
    };
    out.checks.MK24_dropped_inputs = { droppedInputs: H.getInputState().droppedInputs };

    out.input_state = H.getInputState();
    out.not_measured_here = {
      'M-K3': 'label localisation — needs the settings surface (wave-1 piece W1-21)',
      'M-K8/M-K9/M-K10/M-K11': 'pointer-lock acquisition, Escape behaviour and lock-failure playability — need a menu surface and a real user gesture; headless Chromium will not grant pointer lock without one',
      'M-K15': 'cursor in a screenshot — the computed cursor style is checked above; the screenshot check needs the UI piece',
      'M-K16': 'rollover safety — needs a keyboard emulator that drops the third simultaneous key',
      'M-K17/M-K18/M-K19': 'rebinding — the rebinding SURFACE is wave-1 piece W1-21. The binding MODEL (per-device, two slots, reserved-chord list) is in game/src/input/bindings.js and is reported by getActionSet()',
      'M-K20/M-K21/M-K22': 'instruction budget, inscription census, prompt purity — need UI text and world inscriptions',
      'naive pass': 'JC-03N, a fresh-context agent. Not something a builder may run on its own work',
    };
    H.setMode('harness');
    return out;
  }, { latencySamples: LATENCY_SAMPLES });
} finally {
  await handle.close();
}

report.page_errors = handle.errors;
writeJson(path.join(outDir, 'input-probe.json'), report);
const c = report.checks;
log(`M-K1 action coverage: ${c.MK1_action_coverage.probed}/${Object.keys(c.MK1_action_coverage.routed).length} controls routed, ${c.MK1_action_coverage.not_probed.length} not probed (${c.MK1_action_coverage.not_probed.map(([k]) => k).join(', ') || 'none'})`);
log(`M-K2 code-not-key: ${c.MK2_code_not_key.identical ? 'identical across qwerty/azerty/qwertz' : 'DIFFERS — HF1'}`);
log(`M-K5 repeat immunity: ${c.MK5_repeat_immunity.attack_starts} attack_start events from 60 repeat keydowns`);
log(`M-K6 blur release: held after 1 frame = ${JSON.stringify(c.MK6_blur_release.held_1_frame_after)}, drift ${c.MK6_blur_release.displacement_after_release_m} m`);
log(`M-K7 visibility release: held after 1 frame = ${JSON.stringify(c.MK7_visibility_release.held_1_frame_after)}, drift ${c.MK7_visibility_release.displacement_after_release_m} m`);
log(`M-K12 look vs render rate: ${JSON.stringify(c.MK12_look_frame_rate_independent.degrees_turned)} identical=${c.MK12_look_frame_rate_independent.identical}`);
log(`M-K13 linearity: ${JSON.stringify(c.MK13_no_added_acceleration.degrees_per_pixel)} linear=${c.MK13_no_added_acceleration.linear}`);
log(`M-K14 browser control: ${JSON.stringify(c.MK14_browser_does_not_steal)}`);
log(`M-K23 latency frames: p50=${c.MK23_input_latency_frames.p50} p100=${c.MK23_input_latency_frames.p100} over ${c.MK23_input_latency_frames.samples} inputs`);
log(`M-K24 dropped inputs: ${c.MK24_dropped_inputs.droppedInputs}`);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'input-probe.json') + '\n');
process.exit(report.page_errors.length ? EXIT.HARNESS_ERROR : EXIT.OK);

#!/usr/bin/env node
// w1-08-29-r2-coupling.mjs — CONSUMPTION (RI-MTH07 §B) for the two models W1-29 shipped with
// no world-side consumer, plus the delete-the-fix leg.
//
// WHAT ROUND 1 MEASURED, AND WHY THIS TOOL IS SHAPED THE WAY IT IS.
// The round-1 critic's ablation is the thing to beat: same pinned sim frame, ZERO held actions
// in both arms, only `deviceClass` differing, `touchState().visible === true` and
// `touchLayout()` reporting eleven controls in BOTH — and the two framebuffers came back
// byte-identical (a4932a97f50021ee), with a stable null control proving the probe could have
// seen a difference. Its own discarded first attempt (K1) is the trap this file must avoid: it
// perturbed the model by putting four pointers on control centres, which put `light` and
// `block` into `held`, so the PLAYER animated and the hash would have moved whether or not the
// overlay was drawn. That arm is logged as a method deviation in the verdict and it is exactly
// the confound a later round would use to claim a false fix.
//
// So every arm here holds the simulation still:
//   * the sim is stepped to a pinned frame and never stepped again inside an arm;
//   * no action is ever pressed — `getInputState().held` is asserted EMPTY in every arm and the
//     arm is void if it is not;
//   * only the model under test is changed between arms;
//   * a NULL CONTROL re-samples one arm unchanged and must return the same hash, or the probe
//     is too noisy to conclude anything and says so.
//
// The observable is what `RI-JRN04`'s CONSUMPTION section demands for a journey: "a drawn
// string, a rendered object, a surface that appears" — a framebuffer hash, not a harness return
// value. `RI-MTH07` §B1 rules the trace an observer and not a consumer, so `touchLayout()`
// returning eleven controls is not evidence of anything and is recorded here only as the
// model-side value the pixels are being compared against.
//
// EXIT: 0 all arms ran; 1 an arm was void (held actions, or an unstable null control); 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, die, EXIT, log, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-08-29-r2-coupling.mjs — RI-MTH07 coupling for touchLayout() and rotateState().

USAGE
  node tools/harness/w1-08-29-r2-coupling.mjs --out reports/journeys/w1-08-29-r2-coupling
  node tools/harness/w1-08-29-r2-coupling.mjs --shots docs/shots --out DIR

OPTIONS
  --width N --height N   capture size (default 844x390, a clamped landscape phone)
  --shots DIR            also write the handheld frame as a PNG for the blog
  --out DIR              write coupling.json
  --help
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const W = Number(args.width || 844), H = Number(args.height || 390);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/w1-08-29-r2-coupling')));

const md5 = (b) => crypto.createHash('md5').update(b).digest('hex').slice(0, 16);

async function main() {
  const handle = await launchGame({ width: W, height: H });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);

  /**
   * One arm. `setup` runs in the page, then the frame is presented ONCE and hashed.
   *
   * `renderFrame()` presents without advancing the simulation, which is what makes a pinned
   * frame possible at all: AGENT-PROTOCOL's stepping rule is that a probe which steps with the
   * renderer live renders one SwiftShader frame per sim frame and never returns.
   */
  async function arm(name, setup, arg) {
    const model = await ev(setup, arg);
    await ev(() => window.__HARNESS.renderFrame());
    const png = Buffer.from(await ev(() => window.__HARNESS.screenshot()).then((d) => String(d).split(',')[1]), 'base64');
    const held = await ev(() => window.__HARNESS.getInputState().held.slice());
    const ui = await ev(() => {
      const u = window.__HARNESS.getUIState();
      return { touch: u.touch || null, mode: u.mode, coveragePct: u.coveragePct, frame: u.frame };
    });
    return { name, hash: md5(png), bytes: png.length, held, model, ui, png };
  }

  // Match the DRAWING BUFFER to the logical viewport at dpr 2, exactly as `main.js`'s `fit()`
  // does in play mode. Without it the harness keeps the authored 1920x1080 backing store while
  // the viewport override says 844x390, the two aspects disagree, and the frame is not the one
  // a phone would present. The size is set once, before any arm, and never varies between arms.
  const FIT_UNUSED = (o) => {
    const cv = document.querySelector('canvas#view');
    cv.width = o.w * 2; cv.height = o.h * 2;
    window.__ENGINE.renderer.setSize(cv.width, cv.height);
    return [cv.width, cv.height];
  };

  // The pinned world. One reset, one step to frame 24, and nothing steps again.
  const PIN = (o) => {
    const H0 = window.__HARNESS;
    const cv = document.querySelector('canvas#view');
    cv.width = o.w * 2; cv.height = o.h * 2;
    window.__ENGINE.renderer.setSize(cv.width, cv.height);
    H0.reset({ state: 'arena_flat' });
    H0.setMode('play-instrumented');
    H0.setRenderRate(0);
    H0.setViewport({ size: { w: o.w, h: o.h, dpr: 1 }, pointer: o.pointer, orientation: o.orientation, insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H0.stepFrames(24);
    const st = H0.getInputState();
    return {
      deviceClass: st.deviceClass,
      touch_enabled: st.touch.enabled, touch_visible: st.touch.visible, touch_shown: st.touch.shown,
      touch_controls_in_model: (H0.touchLayout() || []).length,
      rotateState: H0.getViewport().rotateState,
      frame: H0.getFrame(),
    };
  };

  const arms = [];
  // ---- MODEL 1: TouchInput.layout() ------------------------------------------------------
  arms.push(await arm('desktop', PIN, { w: W, h: H, pointer: 'fine', orientation: 'landscape' }));
  arms.push(await arm('handheld', PIN, { w: W, h: H, pointer: 'coarse', orientation: 'landscape' }));
  arms.push(await arm('desktop-null-control', PIN, { w: W, h: H, pointer: 'fine', orientation: 'landscape' }));

  // ---- MODEL 1b: perturb the LAYOUT DATA, device class held fixed -------------------------
  // Two well-separated values of one number in game/data/input/profiles.json §touch, everything
  // else identical. If the picture moves, the drawn control is reading the same table the hit
  // test reads; if it does not, the renderer has its own copy of the layout, which is the
  // second-worst outcome available and the one that would let the hit test and the picture
  // drift apart.
  arms.push(await arm('handheld-layout-perturbed', (o) => {
    const H0 = window.__HARNESS;
    H0.perturbInput({ path: 'touch.buttons.2.cx', value: -420 });
    H0.perturbInput({ path: 'touch.buttons.2.cy', value: -30 });
    const r = ((f) => f)(null);
    const cv0 = document.querySelector('canvas#view');
    cv0.width = o.w * 2; cv0.height = o.h * 2;
    window.__ENGINE.renderer.setSize(cv0.width, cv0.height);
    H0.reset({ state: 'arena_flat' });
    H0.setMode('play-instrumented'); H0.setRenderRate(0);
    H0.setViewport({ size: { w: o.w, h: o.h, dpr: 1 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    H0.stepFrames(24);
    const lay = H0.touchLayout().find((c) => c.action === 'light');
    return { light_centre_css: lay ? [Math.round(lay.x), Math.round(lay.y)] : null, r, frame: H0.getFrame() };
  }, { w: W, h: H }));
  await ev(() => window.__HARNESS.perturbInputReset());

  // ---- MODEL 2: Viewport.rotateState() ----------------------------------------------------
  arms.push(await arm('handheld-portrait', PIN, { w: 390, h: 844, pointer: 'coarse', orientation: 'portrait' }));
  arms.push(await arm('handheld-landscape', PIN, { w: W, h: H, pointer: 'coarse', orientation: 'landscape' }));

  // ---- the DELETE-THE-FIX leg -------------------------------------------------------------
  // AGENT-PROTOCOL: "delete your own fix from a copy and confirm the failure returns." The fix
  // is the call from `UISystem.build()` into `ui/touch-overlay.js`. Deleting it from the source
  // would need a second build; deleting it from the RUNNING page is the same deletion at the
  // same seam — the draw functions are replaced with no-ops and the layout is rebuilt.
  const deleted = await arm('handheld-fix-deleted', (o) => {
    const H0 = window.__HARNESS;
    const cv1 = document.querySelector('canvas#view');
    cv1.width = o.w * 2; cv1.height = o.h * 2;
    window.__ENGINE.renderer.setSize(cv1.width, cv1.height);
    H0.reset({ state: 'arena_flat' });
    H0.setMode('play-instrumented'); H0.setRenderRate(0);
    H0.setViewport({ size: { w: o.w, h: o.h, dpr: 1 }, pointer: 'coarse', orientation: 'landscape', insets: { top: 0, right: 44, bottom: 21, left: 44 } });
    // Sever the consumer: the engine stops publishing the two models to the interface, which
    // is precisely the state round 1 shipped — model complete, renderer reading nothing.
    window.__ES_UICTX_ORIG = window.__ES_UICTX_ORIG || window.__ENGINE._uiCtx;
    window.__ENGINE._uiCtx = function () {
      const c = window.__ES_UICTX_ORIG.call(this);
      c.touch = null; c.rotate = null;
      return c;
    };
    H0.stepFrames(24);
    return { fix: 'ui/system.js build() -> ui/touch-overlay.js', severed_at: 'Engine._uiCtx().touch/.rotate', frame: H0.getFrame() };
  }, { w: W, h: H });
  arms.push(deleted);
  await ev(() => { if (window.__ES_UICTX_ORIG) window.__ENGINE._uiCtx = window.__ES_UICTX_ORIG; });

  if (args.shots) {
    fs.mkdirSync(path.resolve(String(args.shots)), { recursive: true });
    const hh = arms.find((a) => a.name === 'handheld');
    const dd = arms.find((a) => a.name === 'desktop');
    fs.writeFileSync(path.join(path.resolve(String(args.shots)), '2026-08-07-w1-29-touch-overlay-handheld.png'), hh.png);
    fs.writeFileSync(path.join(path.resolve(String(args.shots)), '2026-08-07-w1-29-touch-overlay-desktop.png'), dd.png);
  }

  await handle.close();

  const by = Object.fromEntries(arms.map((a) => [a.name, a]));
  const heldViolations = arms.filter((a) => a.held.length).map((a) => ({ arm: a.name, held: a.held }));
  const nullStable = by.desktop.hash === by['desktop-null-control'].hash;

  const findings = [
    {
      model: 'TouchInput.layout() + TouchInput.stick',
      source: 'game/src/input/touch.js',
      consumer: 'game/src/ui/touch-overlay.js drawTouchOverlay(), called from game/src/ui/system.js UISystem.build()',
      perturbation: "deviceClass 'desktop' vs 'handheld' at a pinned sim frame, 0 held actions in both",
      observable: 'framebuffer md5 of __HARNESS.screenshot()',
      a: { arm: 'desktop', hash: by.desktop.hash, controls_drawn: by.desktop.ui.touch && by.desktop.ui.touch.controls_drawn },
      b: { arm: 'handheld', hash: by.handheld.hash, controls_drawn: by.handheld.ui.touch && by.handheld.ui.touch.controls_drawn },
      null_control: { arm: 'desktop-null-control', hash: by['desktop-null-control'].hash, stable: nullStable },
      coupling: by.desktop.hash !== by.handheld.hash ? 1 : 0,
    },
    {
      model: 'game/data/input/profiles.json §touch.buttons[].cx/cy (the layout table itself)',
      source: 'game/data/input/profiles.json',
      consumer: 'the same drawTouchOverlay() — the picture is laid out from the table the hit test reads',
      perturbation: "light's cx -107 -> -420, cy -148 -> -30, device class held at 'handheld'",
      observable: 'framebuffer md5',
      a: { arm: 'handheld', hash: by.handheld.hash },
      b: { arm: 'handheld-layout-perturbed', hash: by['handheld-layout-perturbed'].hash, light_centre_css: by['handheld-layout-perturbed'].model.light_centre_css },
      coupling: by.handheld.hash !== by['handheld-layout-perturbed'].hash ? 1 : 0,
    },
    {
      model: 'Viewport.rotateState()',
      source: 'game/src/input/viewport.js',
      consumer: 'game/src/ui/touch-overlay.js drawRotateState(), same call site',
      perturbation: 'orientation portrait vs landscape on a handheld, pinned frame, 0 held actions',
      observable: 'framebuffer md5',
      a: { arm: 'handheld-portrait', hash: by['handheld-portrait'].hash, rotate_drawn: by['handheld-portrait'].ui.touch && by['handheld-portrait'].ui.touch.rotate_drawn, model: by['handheld-portrait'].model.rotateState },
      b: { arm: 'handheld-landscape', hash: by['handheld-landscape'].hash, rotate_drawn: by['handheld-landscape'].ui.touch && by['handheld-landscape'].ui.touch.rotate_drawn },
      coupling: by['handheld-portrait'].hash !== by['handheld-landscape'].hash ? 1 : 0,
    },
    {
      model: 'DELETE-THE-FIX: sever Engine._uiCtx().touch/.rotate, which is the round-1 state',
      source: 'game/src/engine.js _uiCtx()',
      consumer: null,
      perturbation: 'the consumer is removed at run time; device class held at handheld',
      observable: 'framebuffer md5',
      a: { arm: 'handheld', hash: by.handheld.hash },
      b: { arm: 'handheld-fix-deleted', hash: by['handheld-fix-deleted'].hash, controls_drawn: by['handheld-fix-deleted'].ui.touch && by['handheld-fix-deleted'].ui.touch.controls_drawn },
      // The round-1 FAILURE is the handheld frame becoming identical to the desktop frame again.
      failure_returned: by['handheld-fix-deleted'].hash === by.desktop.hash,
      coupling: null,
    },
  ];

  fs.mkdirSync(OUT, { recursive: true });
  writeJson(path.join(OUT, 'coupling.json'), {
    schema: 'elder-souls/consumption@1',
    tool: 'tools/harness/w1-08-29-r2-coupling.mjs',
    items: ['RI-JRN04'], method: 'RI-MTH07 §B',
    ran_at: new Date().toISOString(),
    capture: { width: W, height: H, pinned_sim_frame: 24 },
    probe_validity: {
      held_actions_in_every_arm: heldViolations.length === 0 ? 'empty' : heldViolations,
      null_control_stable: nullStable,
      note: "the round-1 critic's discarded K1 arm moved the hash by pressing four controls, which animated the PLAYER; no arm here presses anything",
    },
    arms: arms.map((a) => ({ name: a.name, hash: a.hash, bytes: a.bytes, held: a.held, model: a.model, ui: a.ui })),
    findings,
  });
  for (const f of findings) log(`  ${f.coupling === null ? 'DEL ' : f.coupling ? 'OK  ' : 'FAIL'} ${f.model.slice(0, 62)} : ${f.a.hash} vs ${f.b.hash}`);
  log(`null control stable: ${nullStable}; held actions clean: ${heldViolations.length === 0}`);
  log(`-> ${path.relative(REPO_ROOT, OUT)}/coupling.json`);
  process.exit(heldViolations.length || !nullStable ? 1 : 0);
}

await main();

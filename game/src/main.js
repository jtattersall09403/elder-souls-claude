// Entry point. Static, no build step, no network at runtime.
//
// Mode selection (HARNESS.md R3): the simulation is driven by requestAnimationFrame ONLY
// in 'play'. Under automation — `?harness=1`, or `navigator.webdriver`, which Playwright
// sets — the internal loop renders and nothing else, and the sim advances only inside
// stepFrames(). Defaulting to harness mode when webdriver is true is the "simpler and
// preferred" option HARNESS.md R3 names, and it removes a whole class of "the trace
// depends on how busy the machine was" failures.
'use strict';

import { Engine } from './engine.js';
import { installHarness } from './harness/api.js';
import { REVISION } from '../vendor/three/three.module.js';

const params = new URLSearchParams(location.search);
const automated = params.get('harness') === '1' || navigator.webdriver === true;
const mode = params.get('mode') || (automated ? 'harness' : 'play');
// The renderer reads this before it constructs its GL context, to decide whether to keep a second
// full-size copy of the framebuffer for `__HARNESS.screenshot()`. It must be set BEFORE the Engine
// is built, and it must not be a module import, because `render/renderer.js` is constructed deep
// inside the engine and has no other way to know who is looking.
globalThis.__ES_AUTOMATED = automated;
const stateName = params.get('state') || 'default';

// ---- THE LOUD BIT --------------------------------------------------------------------------
//
// This one line is why every "first ten minutes" measurement this project ever took was taken in
// the wrong town. `default.json` is the harness/debug boot — the harbour steps at LILMOTH — and a
// player who clicks `New` at the title screen never reaches it: `Engine._titleApply('new')` goes
// to `censusBegin({})`, which stages `barge-hold` and then `writ-house`, both of which are in
// THORN. Settled by playing it: `reports/spawn-truth/2026-08-14-spawn-truth.md`.
//
// The default is not being changed — booting straight to a known world coordinate is exactly
// right for a probe measuring terrain, weather or any town that is not Thorn, and moving where
// the game starts is a design decision with a blast radius, not a patch. What it must not do any
// more is happen SILENTLY under automation. `launchGame()` collects the page console, so this
// lands in the log of every tool that boots without a `?state=`, and `tools/lib/opening.mjs`
// names the shipping path for anything that means to measure the opening.
if (automated && !params.get('state')) {
  console.warn(
    '[spawn] booting the HARNESS DEFAULT state (game/data/states/default.json — the harbour steps '
    + 'at Lilmoth). This is NOT where the game starts: title -> New goes to barge-hold and then '
    + 'writ-house, both in Thorn. Nothing measured from here is evidence about what a new player '
    + 'sees. See reports/spawn-truth/2026-08-14-spawn-truth.md, and tools/lib/opening.mjs '
    + 'startOpening() for the shipping path.',
  );
}

window.__ES_THREE = REVISION;

const canvas = document.getElementById('view');
const engine = new Engine(canvas);
window.__ENGINE = engine;

const boot = engine.boot({ mode, state: stateName }).catch((e) => {
  // R7: errors are loud. A blank canvas with a swallowed exception is the failure mode
  // that costs a whole measurement session.
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:2rem;background:#180d0d;color:#ffb0a0;font:14px/1.5 monospace;white-space:pre-wrap;z-index:99';
  pre.textContent = 'BOOT FAILED\n\n' + (e && e.stack || e);
  document.body.appendChild(pre);
  throw e;
});

// The harness object is installed IMMEDIATELY, before boot resolves, so a tool can await
// ready() rather than poll for the object's existence.
installHarness(engine, boot);

// W1-22 — THE BED HAS TO REACH A PLAYER'S EARS, NOT ONLY A PROBE'S REPORT.
//
// `Engine.ambience` runs every frame in every mode, because a model that only exists when a
// speaker is attached cannot be measured on a headless box. But a model that is only ever
// measured is the defect this piece was dispatched against, so here is the other half: in PLAY
// mode, on the first real gesture, build an `AudioContext` and attach it.
//
// It has to be a gesture rather than boot. Every browser blocks audio until the user has
// interacted, and an `AudioContext` created at load starts `suspended` and stays that way — so
// wiring it at boot is the version of this that looks correct in code and is silent in fact.
// Automated runs are excluded outright: `--mute-audio` is in `DETERMINISTIC_CHROMIUM_ARGS`, an
// output context on a machine with no sound card is a source of stalls, and every measurement
// goes through `ambienceCapture()`'s OfflineAudioContext instead, which needs neither.
if (!automated) {
  const enable = () => {
    window.removeEventListener('pointerdown', enable);
    window.removeEventListener('keydown', enable);
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor || !engine.ambience) return;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      ctx.resume && ctx.resume();
      engine.ambience.attach(ctx);
      engine.audioContext = ctx;
    } catch (e) {
      // Never take the game down for the sake of ambience. A silent world is playable; a
      // world that will not boot is not.
      console.warn('ambience: could not open an AudioContext —', e && e.message);
    }
  };
  window.addEventListener('pointerdown', enable, { once: false });
  window.addEventListener('keydown', enable, { once: false });
}

// Resize: the canvas backing store is authoritative for screenshots, so it is only ever
// changed by the harness or by a real window resize in play mode.
if (!automated) {
  const fit = () => {
    const w = Math.floor(window.innerWidth), h = Math.floor(window.innerHeight);
    canvas.width = w; canvas.height = h;
    if (engine.renderer) engine.renderer.setSize(w, h);
  };
  window.addEventListener('resize', fit);
  boot.then(fit);
}

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
const stateName = params.get('state') || 'default';

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

#!/usr/bin/env node
// critic-w1-08-29-r1b.mjs — second critic pass on W1-08 / W1-29.
//
// The predecessor critic measured latency, coverage, the consumeUI trap and the draw path.
// This tool measures only the four things its artifacts do NOT answer, or answer with a
// predicate that cannot see the defect:
//
//   E1 TOUCH-ROLL   rerun-touch M-P21a reports `reach.roll === "sprint"` and still passes,
//                   because its predicate is `!v` (something fired) and never `v === action`.
//                   Drive the touch roll control as a TAP and as a HOLD and report which
//                   action each produces, and whether `roll` is reachable on touch at all.
//   E2 DOUBLE-BIND  c2 reports Mouse1 latching edges ["parry","lock_on"]. M-K1's predicate is
//                   `got.includes(action)`, which passes a control that fires the right action
//                   PLUS others. Enumerate the shipped default bindings and report every
//                   control owned by more than one action, and what one press of it fires.
//   E3 TEXT-STREAM  M-K20 (HF5, 6 points) passed with `frames: 0`. Determine whether
//                   getRenderedText() is ever non-empty in ordinary play, i.e. whether the
//                   check can fail at all.
//   E4 OVERLAY-DRAW Whether the touch overlay and the rotate state reach a draw call:
//                   drawn-geometry census with the overlay on vs off, at the same sim frame.
//
// EXIT 0 every probe ran; 11 no harness; 12 the page threw.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, EXIT, log, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-08-29-r1b.mjs — second-pass critic probes for RI-JRN03 / RI-JRN04.

USAGE
  node tools/harness/critic-w1-08-29-r1b.mjs --out DIR
OPTIONS
  --probe P[,P]   e1|e2|e3|e4 (default: all)
  --out DIR       write critic-checks.json
  --help
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks/critic-r1b')));
const PROBES = args.probe ? new Set(String(args.probe).split(',').map((s) => s.trim())) : null;
const want = (...n) => !PROBES || n.some((x) => PROBES.has(x));

const results = [];
function record(id, what, ok, detail, threshold) {
  results.push({ id, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  log(`  [${ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL'}] ${id.padEnd(12)} ${what}`);
  log(`         ${JSON.stringify(detail).slice(0, 900)}`);
}

async function main() {
  const handle = await launchGame({ width: 844, height: 390, entry: args.entry, url: args.url });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(0); return true; });

  // ---------------------------------------------------------------------------------
  // E1 — is `roll` reachable on touch?
  // ---------------------------------------------------------------------------------
  if (want('e1')) {
    const r = await ev(() => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.setDeviceClass && H.setDeviceClass('handheld');
      H.stepFrames(4);
      const layout = H.touchLayout() || [];
      const out = { layout_actions: layout.map((c) => c.action), taps: {}, holds: {} };
      let id = 30;
      // Drive every non-drawer control at several hold lengths and report what fired.
      for (const c of layout) {
        if (c.action === '__drawer') continue;
        for (const [label, frames] of [['tap', 2], ['hold', 20]]) {
          const e0 = H.getInputEdges().length;
          H.touchDown(id, c.x, c.y);
          H.stepFrames(frames);
          H.touchUp(id);
          H.stepFrames(4);
          const fired = H.getInputEdges().slice(e0).map((e) => e.button);
          (label === 'tap' ? out.taps : out.holds)[c.action] = fired;
          id++;
        }
      }
      return out;
    });
    const tapRoll = r.taps.roll || [];
    const holdRoll = r.holds.roll || [];
    // Which of the closed action set is produced by SOME touch control at SOME hold length?
    const produced = new Set();
    for (const m of [r.taps, r.holds]) for (const v of Object.values(m)) for (const a of v) produced.add(a);
    const mislabelled = [];
    for (const [action, fired] of Object.entries(r.holds)) {
      if (!fired.includes(action) && !(r.taps[action] || []).includes(action)) mislabelled.push({ control: action, fired_on_hold: fired, fired_on_tap: r.taps[action] || [] });
    }
    record('E1-TOUCH-ROLL', 'the touch control labelled `roll` produces the roll action',
      tapRoll.includes('roll') || holdRoll.includes('roll'),
      { tap_fired: tapRoll, hold_fired: holdRoll, controls_whose_label_never_fires: mislabelled,
        distinct_actions_produced: [...produced].sort(), n_controls: r.layout_actions.length, all_taps: r.taps, all_holds: r.holds },
      'RI-JRN04 M-P21 / HF5: the action a control is labelled for must be the action it fires');
  }

  // ---------------------------------------------------------------------------------
  // E2 — controls owned by more than one action in the shipped defaults.
  // ---------------------------------------------------------------------------------
  if (want('e2')) {
    const r = await ev(() => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.stepFrames(4);
      const set = H.getActionSet();
      const owners = {};
      for (const [a, pair] of Object.entries(set.bindings)) {
        for (const c of pair) { if (!c) continue; (owners[c] = owners[c] || []).push(a); }
      }
      const shared = Object.fromEntries(Object.entries(owners).filter(([, v]) => v.length > 1));
      // Press each shared control once and report every action that fired.
      const fires = {};
      for (const c of Object.keys(shared)) {
        const canvas = document.querySelector('canvas#view');
        const m = /^Mouse(\d+)$/.exec(c);
        const e0 = H.getInputEdges().length;
        if (m) canvas.dispatchEvent(new MouseEvent('mousedown', { button: Number(m[1]), bubbles: true, cancelable: true }));
        else window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true, cancelable: true }));
        H.stepFrames(15);
        if (m) window.dispatchEvent(new MouseEvent('mouseup', { button: Number(m[1]), bubbles: true }));
        else window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
        H.stepFrames(4);
        fires[c] = [...new Set(H.getInputEdges().slice(e0).map((e) => e.button))];
      }
      return { bindings: set.bindings, shared, fires };
    });
    record('E2-DOUBLE-BIND', 'no shipped default control is owned by two actions',
      Object.keys(r.shared).length === 0,
      { shared_controls: r.shared, one_press_fires: r.fires, bindings: r.bindings },
      'RI-JRN03 M-K1 / RB4: one press = one action. M-K1 uses `fired.includes(action)` and cannot see the extra');
  }

  // ---------------------------------------------------------------------------------
  // E3 — can M-K20 fail? Is the rendered-text stream ever non-empty?
  // ---------------------------------------------------------------------------------
  if (want('e3')) {
    const r = await ev(() => {
      const H = window.__HARNESS;
      const probe = (label, setup) => {
        H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
        H.renderedTextClear && H.renderedTextClear();
        try { setup && setup(); } catch (e) { return { label, error: String(e && e.message) }; }
        H.stepFrames(120);
        const t = H.getRenderedText ? H.getRenderedText() : null;
        return { label, entries: t ? (t.entries || []).length : null, distinct: t ? (t.distinct || []).slice(0, 10) : null,
          surfaces: t ? t.surfaces_instrumented : null, total: t && t.summary ? t.summary.total : null };
      };
      const out = [];
      out.push(probe('arena, no ui'));
      out.push(probe('menu open', () => H.uiOpen && H.uiOpen('menu')));
      out.push(probe('boot state', () => H.reset({ state: 'boot' })));
      out.push(probe('handheld + touch overlay', () => { H.setDeviceClass && H.setDeviceClass('handheld'); H.setUIVisible && H.setUIVisible(true); }));
      return out;
    });
    const anyText = r.some((x) => (x.entries || 0) > 0);
    record('E3-TEXT-STREAM', 'the stream M-K20 (HF5) searches is ever non-empty, i.e. M-K20 can fail',
      anyText, { probes: r },
      'AGENT-PROTOCOL: a probe that cannot fail is worse than no probe. M-K20 passed on frames=0');
  }

  // ---------------------------------------------------------------------------------
  // E4 — does the touch overlay / rotate state reach a draw call?
  // ---------------------------------------------------------------------------------
  if (want('e4')) {
    const r = await ev(() => {
      const H = window.__HARNESS;
      const census = () => { const g = H.getDrawnGeometry ? H.getDrawnGeometry() : null; return g; };
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(60);
      H.setDeviceClass && H.setDeviceClass('desktop');
      H.stepFrames(30);
      const desktop = census();
      H.setDeviceClass && H.setDeviceClass('handheld');
      H.stepFrames(30);
      const handheld_idle = census();
      H.touchDown(1, 120, 300); H.touchDown(2, 700, 300); H.stepFrames(10);
      const handheld_touching = census();
      const touchState = H.touchState ? H.touchState() : null;
      const layoutLen = (H.touchLayout() || []).length;
      H.touchUp(1); H.touchUp(2);
      return { desktop: desktop, handheld_idle, handheld_touching, touch_state: touchState, layout_controls: layoutLen };
    });
    const cnt = (g) => (g && typeof g === 'object') ? (Array.isArray(g) ? g.length : (g.count != null ? g.count : JSON.stringify(g).length)) : null;
    const differs = JSON.stringify(r.desktop) !== JSON.stringify(r.handheld_touching);
    record('E4-OVERLAY-DRAW', 'the touch overlay the model reports changes what the renderer draws',
      differs, { layout_controls: r.layout_controls, desktop_census: r.desktop, handheld_idle_census: r.handheld_idle,
        handheld_touching_census: r.handheld_touching, census_sizes: { desktop: cnt(r.desktop), handheld_touching: cnt(r.handheld_touching) },
        touch_state_keys: r.touch_state ? Object.keys(r.touch_state) : null },
      'RI-JRN04 §G: a control the player must find with a thumb has to be drawn');
  }

  await handle.close();
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'FAIL').length, unmeasurable: results.filter((r) => r.status === 'unmeasurable').length };
  writeJson(path.join(OUT, 'critic-checks.json'), {
    schema: 'critic-input-checks/1', tool: 'tools/harness/critic-w1-08-29-r1b.mjs',
    ran_at: new Date().toISOString(), counts, checks: results });
  log(`\n  ${counts.pass}/${counts.total} pass, ${counts.fail} fail -> ${OUT}/critic-checks.json`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(EXIT ? 12 : 1); });

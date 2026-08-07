#!/usr/bin/env node
// critic-w1-08-29-r1.mjs — an INDEPENDENT instrument for the W1-08 / W1-29 critique.
//
// Written for this critique under orchestration/TOOL-LOOP.md rule 1 and declared in the verdict
// under `method_deviations`. It exists because the builder's own instrument
// (tools/journey/input-checks.mjs) answers RI-JRN03 M-K1/M-K23 and RI-JRN04 M-P1/M-P10 from
// `__HARNESS.getInputEdges()`, which returns `engine.input.edges` — the array `latchForStep()`
// pushes to at the TOP of the fixed step, before the simulation has read it. That is the input
// pipeline's own record of having received a press. RI-JRN03 M-K23 asks for frames "to the sim
// step that CONSUMES it"; RI-JRN03 M-K1 asks which action FIRED, "from the trace", naming
// A-JRN7's `input_action` event. Those are different observers and this tool uses the second.
//
// PROBES
//   C1  LAT-SIM     DOM keydown -> the fixed step whose TRACE emits input_action/attack_start.
//                   Measured in the same loop as the builder's edge-buffer figure, so the two
//                   numbers come off the same 200 presses and the difference is attributable.
//   C2  COVER-SIM   All 16 actions on their default desktop primary, driven through the real DOM
//                   path in an arena. For each: did an EDGE latch, and did the SIMULATION do
//                   anything observable (a trace event naming it, or a world-state delta)?
//   C3  TRAP        The consumeUI trap the builder warns about, confirmed at the boot state, and
//                   the same sweep repeated in an arena so the difference is the surface.
//   C4  PAD-SIM     The pad's 16 actions, same question, through __HARNESS.gamepad().
//
// EXIT 0 every probe ran; 11 no harness; 12 the page threw.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, EXIT, log, writeJson, REPO_ROOT, quantile } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-08-29-r1.mjs — independent re-measurement of RI-JRN03 M-K1/M-K23 and RI-JRN04 M-P1/M-P10.

USAGE
  node tools/harness/critic-w1-08-29-r1.mjs --out DIR
  node tools/harness/critic-w1-08-29-r1.mjs --probe lat --out DIR

OPTIONS
  --probe P[,P]   c1|lat, c2|cover, c3|trap, c4|pad  (default: all)
  --n N           presses for the latency probe (default 200)
  --out DIR       write critic-checks.json
  --help
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/journeys/input-checks/critic-r1')));
const N = Number(args.n || 200);
const PROBES = args.probe ? new Set(String(args.probe).split(',').map((s) => s.trim())) : null;
const want = (...names) => !PROBES || names.some((n) => PROBES.has(n));

const results = [];
function record(id, what, ok, detail, threshold) {
  results.push({ id, what, status: ok === null ? 'unmeasurable' : (ok ? 'pass' : 'FAIL'), threshold, detail });
  const tag = ok === null ? 'N/A ' : ok ? 'OK  ' : 'FAIL';
  log(`  [${tag}] ${id.padEnd(10)} ${what} = ${JSON.stringify(detail).slice(0, 260)}`);
}

// The sixteen actions and their default desktop PRIMARY control, read off
// game/data/input/profiles.json at run time rather than restated here.

async function main() {
  const handle = await launchGame({ width: 320, height: 240, entry: args.entry, url: args.url });
  const page = handle.page;
  const ev = (fn, arg) => page.evaluate(fn, arg);

  await ev(() => { window.__HARNESS.setMode('play-instrumented'); window.__HARNESS.setRenderRate(0); return true; });

  // -------------------------------------------------------------------------------------
  // C1 — LATENCY, measured from the SIMULATION's response, not from the pipeline's latch.
  // -------------------------------------------------------------------------------------
  if (want('c1', 'lat')) {
    const lat = await ev((n) => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.stepFrames(4);
      const edgeGaps = [];   // the builder's observer: the pipeline's own edge ring
      const simGaps = [];    // this tool's observer: the trace saying the sim acted
      let noStamina = 0;
      H.traceStart({ enemies: false, hitboxes: false, events: true });
      for (let i = 0; i < n; i++) {
        H.traceDrain();
        const f0 = H.getFrame();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
        let edgeSeen = -1, simSeen = -1;
        for (let s = 0; s < 8; s++) {
          const e0 = H.getInputEdges().length;
          H.stepFrames(1);
          if (edgeSeen < 0 && H.getInputEdges().slice(e0).some((e) => e.button === 'heavy')) edgeSeen = H.getFrame() - f0;
          const recs = H.traceDrain();
          // "The simulation acted" = the trace shows the character committed to the heavy.
          // NOTE, and it matters for the verdict: this build does NOT emit A-JRN7's
          // `input_action` for an attack. combat/system.js emits `ACTION_START` (mv:'R2') and
          // a mirrored `attack_start` that carries no button/move field. sim/player.js's
          // `input_action` line is a different, simpler player path that this build does not
          // run in an arena. So the channel RI-JRN03 M-K1 names by name is not the channel
          // that records the fact; this probe reads the one that does, and says so.
          for (const r of recs) {
            for (const e of (r.events || [])) {
              if (e.type === 'input_dropped_no_stamina') noStamina++;
              const acted = (e.type === 'ACTION_START' && (e.mv === 'R2' || e.reason === 'r2'))
                || (e.type === 'input_action' && e.button === 'heavy');
              if (acted && simSeen < 0) simSeen = r.f - f0;
            }
            // belt and braces: the committed state itself, read off the frame record
            if (simSeen < 0 && r.player && r.player.state && r.player.state !== 'IDLE') simSeen = r.f - f0;
          }
          if (edgeSeen >= 0 && simSeen >= 0) break;
        }
        edgeGaps.push(edgeSeen); simGaps.push(simSeen);
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
        // let the heavy's recovery finish so the next press is not eaten by commitment
        H.stepFrames(90);
      }
      H.traceStop();
      return { edgeGaps, simGaps, noStamina };
    }, N);

    const sortedEdge = lat.edgeGaps.slice().sort((a, b) => a - b);
    const sim = lat.simGaps.filter((x) => x >= 0);
    const sortedSim = sim.slice().sort((a, b) => a - b);
    const never = lat.simGaps.filter((x) => x < 0).length;
    record('C1-LAT',
      'frames from a real DOM keydown to the fixed step whose TRACE records the sim acting on it',
      sim.length > 0 && never === 0 && Math.max(...sortedSim) <= 2,
      {
        n: lat.simGaps.length,
        edge_observer: { p50: quantile(sortedEdge, 0.5), p100: Math.max(...sortedEdge), never: lat.edgeGaps.filter((x) => x < 0).length },
        sim_observer: sim.length ? { p50: quantile(sortedSim, 0.5), p100: Math.max(...sortedSim), never } : { never },
        input_dropped_no_stamina: lat.noStamina,
      },
      'p100 <= 2 frames measured on the SIMULATION\'s response (RI-JRN03 M-K23)');
  }

  // -------------------------------------------------------------------------------------
  // C2 — COVERAGE. Sixteen actions, real DOM path, in an arena. Edge vs simulation response.
  // -------------------------------------------------------------------------------------
  if (want('c2', 'cover')) {
    const cover = await ev(() => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0);
      H.stepFrames(4);
      const prof = H.getActionSet ? H.getActionSet() : null;
      const st = H.getInputState();
      const bindings = st.bindings || (prof && prof.bindings) || null;
      const out = {};
      const actions = (prof && (prof.actions || prof.set)) || (st.actions) || null;
      const list = Array.isArray(actions) ? actions : Object.keys(bindings || {});
      for (const a of list) {
        const b = bindings && bindings[a];
        const primary = Array.isArray(b) ? b[0] : (b && b.primary) || null;
        if (!primary) { out[a] = { primary: null, edge: false, sim_events: [], world_delta: null, note: 'no primary binding exposed' }; continue; }
        H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4);
        const before = JSON.stringify(H.getPlayerStats ? H.getPlayerStats() : {});
        H.traceStart({ enemies: false, hitboxes: false, events: true });
        const e0 = H.getInputEdges().length;
        const isMouse = /^Mouse(\d)$/.test(String(primary));
        const canvas = document.querySelector('canvas#view') || document.querySelector('canvas');
        if (isMouse) {
          const btn = Number(String(primary).slice(5));
          canvas.dispatchEvent(new MouseEvent('mousedown', { button: btn, bubbles: true }));
        } else if (/^Wheel/.test(String(primary))) {
          canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: /Up/.test(String(primary)) ? -100 : 100, bubbles: true }));
        } else {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: String(primary), bubbles: true }));
        }
        H.stepFrames(20);   // long enough for a hold-gate (12 f) to promote
        const edges = H.getInputEdges().slice(e0).map((e) => e.button);
        const recs = H.traceDrain();
        const simEvents = [];
        for (const r of recs) for (const e of (r.events || [])) simEvents.push(e.type + (e.button ? ':' + e.button : e.move ? ':' + e.move : ''));
        H.traceStop();
        if (isMouse) window.dispatchEvent(new MouseEvent('mouseup', { button: Number(String(primary).slice(5)), bubbles: true }));
        else if (!/^Wheel/.test(String(primary))) window.dispatchEvent(new KeyboardEvent('keyup', { code: String(primary), bubbles: true }));
        H.stepFrames(4);
        const after = JSON.stringify(H.getPlayerStats ? H.getPlayerStats() : {});
        out[a] = { primary: String(primary), edge: edges.includes(a), edges, sim_events: simEvents.slice(0, 12), world_changed: before !== after };
      }
      return out;
    });
    const names = Object.keys(cover);
    const edged = names.filter((a) => cover[a].edge);
    const simmed = names.filter((a) => cover[a].sim_events.length > 0 || cover[a].world_changed);
    record('C2-COVER',
      'all bound actions on their default desktop primary: edge latched vs the SIMULATION visibly responding',
      names.length > 0,
      {
        actions: names.length,
        edge_latched: edged.length,
        sim_responded: simmed.length,
        edge_only_no_sim_response: names.filter((a) => cover[a].edge && !(cover[a].sim_events.length > 0 || cover[a].world_changed)),
        per_action: cover,
      },
      'RI-JRN03 M-K1: which action FIRED, from the trace');
  }

  // -------------------------------------------------------------------------------------
  // C3 — the consumeUI trap, confirmed, and the same sweep in an arena.
  // -------------------------------------------------------------------------------------
  if (want('c3', 'trap')) {
    const trap = await ev(() => {
      const H = window.__HARNESS;
      // fresh boot state — do NOT reset
      const boot = {};
      const mags = [0.10, 0.20, 0.60, 0.92, 1.00];
      const zero = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' };
      function sweep(tag) {
        const o = {};
        for (const m of mags) {
          const s = { buttons: new Array(17).fill(0), axes: [m * Math.cos(0.7), -m * Math.sin(0.7), 0, 0], mapping: 'standard' };
          H.gamepad(s); H.stepFrames(2);
          const mv = H.getMoveVector();
          o[m] = { move: mv, mag: +Math.hypot(mv[0], mv[1]).toFixed(4), held: H.getInputState().held.slice() };
        }
        H.gamepad(zero); H.stepFrames(2);
        return o;
      }
      boot.at_boot = sweep('boot');
      boot.boot_ui = H.getInputState().held.slice();
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4);
      boot.at_arena = sweep('arena');
      return boot;
    });
    const bootZero = Object.values(trap.at_boot).every((v) => v.mag === 0);
    const arenaLive = Object.values(trap.at_arena).some((v) => v.mag > 0);
    record('C3-TRAP',
      'the boot state zeroes movement (consumeUI) while the same stick sweep in an arena does not',
      bootZero && arenaLive, trap,
      'confirms the builder\'s warning: a probe reading `held`/move at boot measures the surface, not the deadzone');
  }

  // -------------------------------------------------------------------------------------
  // C4 — the pad's actions, same edge-vs-sim question.
  // -------------------------------------------------------------------------------------
  if (want('c4', 'pad')) {
    const padc = await ev(() => {
      const H = window.__HARNESS;
      H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4);
      const zero = () => ({ buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], mapping: 'standard' });
      const out = {};
      for (let idx = 0; idx <= 15; idx++) {
        H.reset({ state: 'arena_flat' }); H.setMode('play-instrumented'); H.setRenderRate(0); H.stepFrames(4);
        H.gamepad(zero()); H.stepFrames(2);
        const e0 = H.getInputEdges().length;
        H.traceStart({ enemies: false, hitboxes: false, events: true });
        const on = zero(); on.buttons[idx] = 1;
        H.gamepad(on); H.stepFrames(20);
        const edges = [...new Set(H.getInputEdges().slice(e0).map((e) => e.button))];
        const recs = H.traceDrain(); H.traceStop();
        const simEvents = [];
        for (const r of recs) for (const e of (r.events || [])) simEvents.push(e.type + (e.button ? ':' + e.button : e.move ? ':' + e.move : ''));
        H.gamepad(zero()); H.stepFrames(4);
        out[idx] = { edges, sim_events: [...new Set(simEvents)].slice(0, 10), held: H.getInputState().held.slice() };
      }
      return out;
    });
    const idxWithEdge = Object.keys(padc).filter((i) => padc[i].edges.length > 0);
    record('C4-PAD',
      'pad indices 0-15 driven through __HARNESS.gamepad(): which produce an action edge and which produce a SIM response',
      idxWithEdge.length > 0,
      { indices_producing_an_edge: idxWithEdge.length, per_index: padc },
      'RI-JRN04 M-P1');
  }

  await handle.close();
  const counts = { total: results.length, pass: results.filter((r) => r.status === 'pass').length, fail: results.filter((r) => r.status === 'FAIL').length };
  writeJson(path.join(OUT, 'critic-checks.json'), { schema: 'critic-input-checks/1', tool: 'tools/harness/critic-w1-08-29-r1.mjs', ran_at: new Date().toISOString(), counts, checks: results });
  log(`\n  ${counts.pass}/${counts.total} pass  ->  ${path.join(OUT, 'critic-checks.json')}`);
}

main().catch((e) => die(12, 'critic probe threw: ' + (e && e.message), { stack: e && e.stack }));

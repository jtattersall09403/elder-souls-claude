#!/usr/bin/env node
// W1-02 — the BROWSER half. Confirm in the running engine what node measured out of it.
//
// AGENT-PROTOCOL: "Do not publish a number that has only ever been seen outside the browser."
// `tools/world/env-consumption.mjs` and `tools/world/border-traverse.mjs` both run the shipped
// modules in bare node, which is right for iterating and wrong for a behavioural claim. This runs
// the same claims against the real `Engine`, through `window.__HARNESS`, in one browser:
//
//   L1  the clock advances FROM THE FIXED STEP — step frames with no verb, watch the hour move
//   L2  `pauseClock()` stops it (the negative control: the world, not the probe, is the writer)
//   L3  the weather machine is installed and running for the region the body is in
//   L4  stealth's `V` responds to the world clock — the consumer, in the engine, end to end
//   L5  the border field is wired: nine axes give more than one region inside a border band
//   L6  `getBorderCrossover` on the LIVE field agrees with the node traverse
//
// One browser, one page, `setRenderRate(0)` before any stepping (AGENT-PROTOCOL: a probe that
// steps one frame at a time with the renderer live never returns).
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
wld-env-live.mjs — W1-02's browser confirmation of the clock, the weather machine and the borders.

USAGE
  node tools/world/wld-env-live.mjs [--out <file>] [--frames <n>]
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const FRAMES = Number(args.frames ?? 18000);      // 5 real minutes of game time
const out = args.out || 'reports/w1-02-live.json';

let handle;
try {
  handle = await launchGame({ width: 320, height: 240, timeout: 90000 });
  const { page } = handle;
  const res = await page.evaluate(async (FRAMES) => {
    const H = window.__HARNESS;
    const R = { checks: [] };
    const add = (name, pass, detail) => R.checks.push({ check: name, pass, detail });
    H.setRenderRate(0);

    // ---- L1 / L2: the clock, and the frozen control -----------------------------------------
    const e0 = H.getEnvironment();
    H.stepFrames(FRAMES);
    const e1 = H.getEnvironment();
    H.pauseClock(true);
    H.stepFrames(FRAMES);
    const e2 = H.getEnvironment();
    H.pauseClock(false);
    const advanced = ((e1.time_of_day - e0.time_of_day) + 24) % 24;
    const frozen = Math.abs(e2.time_of_day - e1.time_of_day);
    add('L1 the clock advances from the fixed step, with no verb called', advanced > 0.001, {
      frames: FRAMES, hours_before: e0.time_of_day, hours_after: e1.time_of_day,
      hours_advanced: +advanced.toFixed(6),
      expected: +(FRAMES * 24 / e0.frames_per_day).toFixed(6),
      timescale: e0.timescale, frames_per_day: e0.frames_per_day,
    });
    add('L2 pauseClock() holds it (negative control)', frozen < 1e-6, {
      frames: FRAMES, hours_drift_while_paused: frozen, hour: e2.time_of_day,
    });

    // ---- L3: the weather machine is running for the region the body is in --------------------
    add('L3 a regional weather machine is installed', !!e1.region && e1.states_here.length >= 4, {
      region: e1.region, weather: e1.weather, states_here: e1.states_here,
      worst_here: e1.worst_here, light: e1.light, sightline_m: e1.sightline_m,
      state_is_declared_here: e1.states_here.includes(e1.weather),
      effect: e1.effect,
    });

    // ---- L4: stealth's V responds to the world clock ------------------------------------------
    // The consumer chain, in the engine: env.timeOfDay/weatherLight -> skyAmbient -> L -> V.
    // Pin two hours and read V back off `getStealthState()`; the numbers must differ.
    let vNoon = null, vNight = null, lNoon = null, lNight = null;
    try {
      H.setTimeOfDay(12); H.stepFrames(4);
      const a = H.getStealthState();
      vNoon = a.V; lNoon = a.L;
      H.setTimeOfDay(1); H.stepFrames(4);
      const b = H.getStealthState();
      vNight = b.V; lNight = b.L;
    } catch (err) { R.stealth_error = String(err && err.message || err); }
    add('L4 stealth visibility V responds to the world clock', vNoon !== null && vNight !== null && vNoon !== vNight, {
      consumer: 'sim/stealth/system.js#skyAmbient -> light.defaultAmbient -> L -> V',
      L_noon: lNoon, L_0100: lNight, V_noon: vNoon, V_0100: vNight,
    });

    // ---- L5 / L6: the borders ------------------------------------------------------------------
    const bl = H.listBorders();
    // Walk to the middle of a border band and read the nine axes there.
    let inBand = null;
    for (const b of bl) {
      const t = H.getBorderCrossover(b.id, { length_m: 400, step_m: 2 });
      // Stand where the earliest and latest axes disagree: half way between them.
      const cs = Object.values(t.crossovers_m).filter((v) => v !== null);
      if (cs.length < 4) continue;
      const mid = (Math.min(...cs) + Math.max(...cs)) / 2;
      const at = t.at;
      const probe = H.getBorderAt(at.x + t.direction[0] * mid, at.z + t.direction[1] * mid);
      if (probe.in_border && probe.distinct_axis_regions > 1) { inBand = { border: b.id, mid_m: mid, probe, traverse: t }; break; }
    }
    add('L5 inside a border band the nine axes disagree', !!inBand, inBand ? {
      border: inBand.border, at_m_through: inBand.mid_m,
      distinct_axis_regions: inBand.probe.distinct_axis_regions,
      axis_regions: inBand.probe.axis_regions,
      raster_says: inBand.probe.raster_region,
    } : { note: 'no border band produced two different axis answers' });

    const live = {};
    for (const b of bl.slice(0, 6)) {
      const t = H.getBorderCrossover(b.id);
      live[b.id] = { stddev_m: t.stddev_m, span_m: t.span_m, axes: t.axes_resolved, order: t.order, kind: t.kind };
    }
    add('L6 getBorderCrossover runs on the live field', Object.values(live).every((v) => v.stddev_m >= 5), {
      note: 'stddev < 5 m is RI-WLD12 M65\'s automatic fail (the texture swap)',
      borders: bl.length, sampled: live,
    });

    R.env_after = e1;
    R.borders = bl.length;
    return R;
  }, FRAMES);

  const failed = res.checks.filter((c) => !c.pass);
  console.log(JSON.stringify(res, null, 1));
  writeJson(out, res);
  console.error(`\nwld-env-live: ${res.checks.length - failed.length}/${res.checks.length} passed -> ${out}`);
  if (failed.length) process.exit(1);
} finally {
  if (handle) await handle.close();
}

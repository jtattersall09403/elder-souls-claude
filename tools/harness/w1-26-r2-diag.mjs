#!/usr/bin/env node
// w1-26-r2-diag.mjs — round-2 diagnosis, before any change.
//
// Three questions the round-1 verdict left open and told the builder to answer by measurement
// rather than by assumption:
//
//   D1  What surfaces does the rendered-text register actually see, and does a sentinel drawn
//       through `ui/glyphs.js drawText()` reach it? (verdict §2)
//   D2  WHY does 60 frames of forward input move the body 0.0000 m? The verdict names the
//       census surface eating the latch as the mechanism and then says: "Find out why before
//       assuming it is the census pausing locomotion." So: measure locomotion in the hold with
//       the census surface NOT open, and again with it open. If the first also reads 0.0000 m
//       the cause is not the census and the named fix would have bought nothing.
//   D3  At `writ.given-name`, what exactly does the panel's height cap throw away, and how much
//       height is it over budget by?
//
// USAGE  node tools/harness/w1-26-r2-diag.mjs [--json <path>]
'use strict';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-26-r2-diag.mjs — register surfaces, locomotion cause, panel overflow.';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame({ ...args, width: 320, height: 240 });
const out = { probe: 'w1-26-r2-diag' };
try {
  // ---------------------------------------------------------------- D1: register surfaces ---
  say('== D1 — which surfaces does the register see, and does a vector sentinel reach it? ==');
  out.d1 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.setRenderRate(0);
    const eng = H._engine ? H._engine() : (window.__ENGINE || null);
    const r = { engine_reachable: !!eng };
    const rt = H.getRenderedText({});
    r.reported_surfaces = rt.surfaces_instrumented || rt.surfaces || null;
    r.blind = rt.blind_surfaces || rt.blind || '(field absent)';
    r.summary_surfaces = Object.keys(rt.summary.surfaces || {});
    if (H.registerSurfaces) r.register_surfaces = H.registerSurfaces();
    // THE FALSIFICATION. Two sentinels through the two draw paths this build has, onto the
    // HUD/menus surface. If the vector one is invisible to the register, the register cannot
    // see the surface M9 and M15 are aimed at, whatever it says about being instrumented.
    if (H.drawSentinels) r.sentinels = H.drawSentinels('ES-SENTINEL');
    // The strings the HUD really draws in the opening, whatever the register can see.
    await H.setSeed(1337); await H.loadState('barge-hold');
    H.queueInputs([{ f: 0, move: [0, 1] }]); H.stepFrames(120);
    const ui = H.getUIState();
    r.hud_element_text = ((ui.hud && ui.hud.elements) || (ui.elements) || [])
      .map((e) => e && e.text).filter(Boolean);
    return r;
  });
  say('  ' + JSON.stringify(out.d1));

  // ------------------------------------------------------------------ D2: why nothing moves ---
  say('\n== D2 — locomotion in the hold, census surface open vs not ==');
  out.d2 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const pos = () => { const s = H.getPlayerStats(); return (s.pos || s.position || []).slice(); };
    const d = (a, b) => Math.hypot((b[0] - a[0]), (b[2] - a[2]));
    const r = {};

    // THE INSTRUMENT BUG THE ROUND-1 MEASUREMENT CARRIED.
    // `InputPipeline.queueInputs()` does `this.script = script.slice()` — it REPLACES the
    // timeline and re-bases it on the calling frame. So `for (i<60) queueInputs([{f:i,...}])`
    // leaves exactly ONE event on the timeline: the last one. Both the round-1 builder's probe
    // and the round-1 critic's probe were written that way, so "60 frames of forward input" was
    // one frame of forward input. Measured both ways here, side by side, so the difference is
    // in the artifact and nobody has to take my word for it.
    const script = (n, mv) => { const s = []; for (let i = 0; i < n; i++) s.push({ f: i, move: mv }); return s; };
    const walk = (n, mv) => { H.queueInputs(script(n, mv)); H.stepFrames(n); };
    const walkOneAtATime = (n, mv) => { for (let i = 0; i < n; i++) H.queueInputs([{ f: i, move: mv }]); H.stepFrames(n); };

    // (a0) the round-1 call shape, reproduced.
    await H.setRenderRate(0); await H.setSeed(1337);
    await H.loadState('barge-hold');
    const z0 = pos(); walkOneAtATime(60, [0, 1]); const z1 = pos();
    r.round1_call_shape = { from: z0, to: z1, moved_m: +d(z0, z1).toFixed(4), note: '60 successive queueInputs calls — only the last event survives' };

    // (a) the hold, WITHOUT the census scene open at all. If this is 0 the census is innocent.
    await H.loadState('barge-hold');
    const a0 = pos(); walk(60, [0, 1]); const a1 = pos();
    r.no_census = { from: a0, to: a1, moved_m: +d(a0, a1).toFixed(4) };

    // (b) same, with the census open at hold.hatch-name (the shipped opening).
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    const st = H.getCensusState();
    const b0 = pos(); walk(60, [0, 1]); const b1 = pos();
    r.census_open = {
      node: st.node, takes_input: !!(st.surface && st.surface.takes_input), paused: !!st.paused,
      from: b0, to: b1, moved_m: +d(b0, b1).toFixed(4),
    };

    // (c) sideways too — is it one axis or all of them?
    await H.loadState('barge-hold');
    const c0 = pos(); walk(60, [1, 0]); const c1 = pos();
    r.no_census_strafe = { from: c0, to: c1, moved_m: +d(c0, c1).toFixed(4) };

    // (c2) can the body reach the ladder at z >= 4.2 from the hold's start pose, walking
    //      forward, in a plausible number of frames? That is the census-paused exit.
    await H.loadState('barge-hold');
    const g0 = pos(); walk(600, [0, 1]); const g1 = pos();
    r.no_census_600 = { from: g0, to: g1, moved_m: +d(g0, g1).toFixed(4), z_end: +g1[2].toFixed(3), ladder_z: 4.2 };

    // (d) in the OPEN WORLD, same 60 frames — the control.
    try {
      await H.loadState('default');
      const e0 = pos(); walk(60, [0, 1]); const e1 = pos();
      r.open_world = { from: e0, to: e1, moved_m: +d(e0, e1).toFixed(4) };
    } catch (e) { r.open_world = String(e).slice(0, 120); }
    return r;
  });
  for (const k of Object.keys(out.d2)) say(`  ${k.padEnd(18)}: ${JSON.stringify(out.d2[k])}`);

  // ------------------------------------------------------------- D3: the panel's overflow ----
  say('\n== D3 — what the panel throws away at writ.given-name ==');
  out.d3 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    await H.setRenderRate(0); await H.setSeed(1337);
    await H.loadState('barge-hold');
    // THE WATERMARK TRAP (round-1 verdict §8.1). `UILayer` repaints only when `dirty`, and
    // `getCensusState()` / `censusAnswer()` both call `metrics()`, which repaints and CLEARS
    // the flag. So the mark must be taken BEFORE the call that repaints the node, and the
    // register read `{since: mark}` after it. A mark taken afterwards measures an empty
    // register and reports DTR 0.00 for a scene that drew everything.
    let mark = H.getRenderedText({}).next_index;
    await H.censusBegin({ race: 'saxhleel' });
    let st = H.getCensusState(); let guard = 0, qi = 0, entered = false;
    const rows = [];
    while (st && !st.done && guard++ < 80) {
      const inp = st.input;
      if (!inp) {
        if (!entered) { entered = true; mark = H.getRenderedText({}).next_index; st = await H.censusEnter(); continue; }
        break;
      }
      const model = H.getCensusModel() || {};
      // Strip ALL whitespace from both sides: ui.js `wrap()` splits on whitespace and DROPS the
      // space it broke on, so a space-joined delivery test invents undrawn text (round-1
      // verdict §8.2). Concatenating the register's rows with no separator and matching against
      // a whitespace-stripped needle is the only comparison that does not lie.
      const drawn = H.getRenderedText({ since: mark }).entries.map((e) => tight(e.text)).join('');
      const want = [];
      for (const s of (model.spoken || [])) want.push({ role: 'spoken', s });
      if (model.preamble) want.push({ role: 'preamble', s: model.preamble });
      if (model.line) want.push({ role: 'line', s: model.line });
      for (const o of (model.options || [])) want.push({ role: 'option', s: o.text });
      const miss = want.filter((w) => drawn.indexOf(tight(w.s)) < 0);
      rows.push({
        node: st.node,
        n: want.length, drawn: want.length - miss.length,
        dtr: want.length ? +((want.length - miss.length) / want.length).toFixed(4) : 1,
        undrawn: miss.map((m) => `${m.role}: ${String(m.s).slice(0, 70)}`),
        panel_frac: (H.getUIState().dialogue || {}).panel_height_frac || null,
      });
      let v;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = ((inp.options || [])[0] || {}).id;
      if (v == null) break;
      mark = H.getRenderedText({}).next_index;
      try { st = await H.censusAnswer(v); } catch (e) { rows.push({ node: st.node, error: String(e).slice(0, 140) }); break; }
    }
    return { rows, worst: rows.slice().sort((a, b) => (a.dtr ?? 1) - (b.dtr ?? 1))[0] || null };
  });
  for (const r of out.d3.rows) {
    say(`  ${String(r.node).padEnd(28)} DTR ${String(r.dtr).padEnd(7)} ${r.drawn}/${r.n}  panel ${r.panel_frac}`);
    for (const u of (r.undrawn || [])) say(`      UNDRAWN  ${u}`);
  }
} finally {
  const p = args.json ? String(args.json) : 'reports/journeys/w1-26-r2-diag.json';
  writeJson(p, out);
  say('\nwrote ' + p);
  await h.close();
}

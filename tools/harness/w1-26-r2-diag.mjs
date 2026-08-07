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

    // (a) the hold, WITHOUT the census scene open at all. If this is 0 the census is innocent.
    await H.setRenderRate(0); await H.setSeed(1337);
    await H.loadState('barge-hold');
    const a0 = pos();
    for (let i = 0; i < 60; i++) H.queueInputs([{ f: i, move: [0, 1] }]);
    H.stepFrames(60);
    const a1 = pos();
    r.no_census = { from: a0, to: a1, moved_m: +d(a0, a1).toFixed(4) };

    // (b) same, with the census open at hold.hatch-name (the shipped opening).
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    const st = H.getCensusState();
    const b0 = pos();
    for (let i = 0; i < 60; i++) H.queueInputs([{ f: i, move: [0, 1] }]);
    H.stepFrames(60);
    const b1 = pos();
    r.census_open = {
      node: st.node, takes_input: !!(st.surface && st.surface.takes_input), paused: !!st.paused,
      from: b0, to: b1, moved_m: +d(b0, b1).toFixed(4),
    };

    // (c) sideways and backwards too, without the census — is it one axis or all of them?
    await H.loadState('barge-hold');
    const c0 = pos();
    for (let i = 0; i < 60; i++) H.queueInputs([{ f: i, move: [1, 0] }]);
    H.stepFrames(60);
    const c1 = pos();
    r.no_census_strafe = { from: c0, to: c1, moved_m: +d(c0, c1).toFixed(4) };

    // (d) in the OPEN WORLD, same 60 frames — the control. If the world moves and the hold does
    //     not, the hold's interior is the cause and the census pause fixes nothing.
    try {
      await H.loadState('default');
      const e0 = pos();
      for (let i = 0; i < 60; i++) H.queueInputs([{ f: i, move: [0, 1] }]);
      H.stepFrames(60);
      const e1 = pos();
      r.open_world = { from: e0, to: e1, moved_m: +d(e0, e1).toFixed(4) };
    } catch (e) { r.open_world = String(e).slice(0, 120); }
    return r;
  });
  say('  no census open   : ' + JSON.stringify(out.d2.no_census));
  say('  census open      : ' + JSON.stringify(out.d2.census_open));
  say('  strafe, no census: ' + JSON.stringify(out.d2.no_census_strafe));
  say('  open world       : ' + JSON.stringify(out.d2.open_world));

  // ------------------------------------------------------------- D3: the panel's overflow ----
  say('\n== D3 — what the panel throws away at writ.given-name ==');
  out.d3 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    await H.setRenderRate(0); await H.setSeed(1337);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    let st = H.getCensusState(); let guard = 0, qi = 0, entered = false;
    const rows = [];
    while (st && !st.done && guard++ < 80) {
      const inp = st.input;
      if (!inp) {
        if (!entered) { entered = true; st = await H.censusEnter(); continue; }
        break;
      }
      // measure at this node: model strings vs drawn strings
      const mark = H.getRenderedText({}).next_index;
      const model = H.getCensusModel() || {};
      H.getUIState();                                  // forces the repaint
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

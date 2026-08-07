#!/usr/bin/env node
// critic-w1-07-r3a.mjs — CRITIC's own instrument for RI-JRN09 M1 (DTR).
//
// Written by the round-3 critic. It does NOT use tools/harness/jrn09-exchange.mjs, which the
// BUILDER wrote to grade its own work. Two deliberate differences:
//
//  1. THE ACCESSOR. jrn09-exchange reads `getCensusState().surface.rendered_text`, which is
//     `UILayer.metrics().text` — an array assembled from the LAYOUT VARIABLES at the end of
//     `_redraw()`, not from the `fillText` calls. It reports `shownOpts.map(o => o.text)` (the
//     untruncated option) where the frame received `ellipsise(...)`, it reports `recordLines`
//     where the frame received `ellipsise(...)`, and it is blind to the panel's `clip()`.
//     This probe reads `__HARNESS.getRenderedText()` — W1-26's `render/text-register.js`,
//     which wraps CanvasRenderingContext2D.fillText and shadows the clip state — and reports
//     both the clipped and the unclipped sets.
//
//  2. THE DENOMINATOR. jrn09-exchange takes "the strings the model computes" from
//     `getCensusModel()`, i.e. `renderer.ui.model` — the object `buildCensusModel()` handed to
//     the surface. That is the exact layer round 2's defect lived in: `buildCensusModel` read
//     `state.line` and never `state.question.text`, so ten questions were computed by the
//     census and dropped by the model builder. A DTR whose denominator is the model cannot see
//     a string the model builder dropped: it is 1.0 by construction whenever the renderer draws
//     everything it was handed. This probe reports THREE denominators side by side —
//       D_model : getCensusModel()            (the builder's)
//       D_state : getCensusState()            (what the census computed for the node)
//       D_writ  : D_state + readWrit().lines  (RI-JRN09 M1 names "the writ's body")
//
// USAGE  node tools/harness/critic-w1-07-r3a.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-07-r3a.mjs — critic's own DTR, three denominators, draw-call accessor.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const delivered = (authored, blob) => { const a = norm(authored); return !a || blob.indexOf(a) >= 0; };

function strings(kindPrefix, obj) {
  const c = [];
  const push = (kind, s) => { if (s && String(s).trim()) c.push({ kind: kindPrefix + kind, s: String(s) }); };
  push('line', obj.line);
  push('preamble', obj.preamble);
  for (const sp of (obj.spoken || [])) push('spoken', (sp && typeof sp === 'object') ? sp.line : sp);
  push('aside', obj.aside);
  const opts = (obj.options || (obj.input && obj.input.options) || []);
  for (const o of opts) push('option', o.text || o.id);
  if (obj.question && obj.question.text) push('question', obj.question.text);
  return c;
}
function uniq(list) {
  const seen = new Set(); const out = [];
  for (const x of list) { const k = norm(x.s); if (k && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

const h = await launchGame(args);
const out = { probe: 'critic-w1-07-r3a', nodes: [], totals: {} };
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });

  let st = await h.h('getCensusState');
  let guard = 0, qi = 0, entered = false;
  while (st && !st.done && guard++ < 64) {
    // Clear the draw register, force a real render, and read what fillText actually received.
    await h.h('renderedTextClear');
    await h.h('renderFrame');
    const reg = await h.h('getRenderedText', {});
    const regAll = await h.h('getRenderedText', { includeClipped: true });
    const drawn = reg.distinct || [];
    const drawnAll = regAll.distinct || [];
    const clipped = (regAll.entries || []).filter((e) => e.clipped).map((e) => e.text);
    const blob = norm(drawn.join('  '));
    const blobAll = norm(drawnAll.join('  '));

    const model = (await h.h('getCensusModel')) || {};
    const writ = st.writ || null;

    const dModel = uniq(strings('m.', model));
    const dState = uniq(strings('s.', st));
    const writStrings = [];
    if (writ && Array.isArray(writ.lines)) for (const ln of writ.lines) writStrings.push({ kind: 'w.writ', s: ln });
    const dWrit = uniq([...strings('s.', st), ...writStrings]);

    const score = (set) => {
      const hit = set.filter((x) => delivered(x.s, blob));
      return { computed: set.length, drawn: hit.length, dtr: set.length ? +(hit.length / set.length).toFixed(4) : 1,
               missed: set.filter((x) => !delivered(x.s, blob)).map((x) => ({ kind: x.kind, s: x.s.slice(0, 110) })) };
    };
    const rec = {
      node: st.node,
      kind: st.input ? st.input.kind : null,
      questionnaire: !!(st.input && st.input.kind === 'questionnaire'),
      question_id: st.question ? st.question.id : null,
      register_rows: (reg.entries || []).length,
      register_rows_incl_clipped: (regAll.entries || []).length,
      clipped_strings: clipped,
      surface_metrics_text_rows: (st.surface && st.surface.rendered_text || []).length,
      opaque_area_frac: st.surface ? st.surface.opaque_area_frac : 0,
      panel_height_frac: st.surface ? st.surface.panel_height_frac : 0,
      d_model: score(dModel),
      d_state: score(dState),
      d_writ: score(dWrit),
      // Does the layout-echo accessor claim strings the draw register never saw?
      metrics_claims_not_in_register: (st.surface && st.surface.rendered_text || [])
        .filter((t) => norm(t) && blobAll.indexOf(norm(t)) < 0).slice(0, 12),
    };
    out.nodes.push(rec);
    say(`${String(st.node).padEnd(28)} kind=${String(rec.kind).padEnd(14)} reg=${rec.register_rows} clip=${clipped.length} ` +
        `DTR model=${rec.d_model.dtr} state=${rec.d_state.dtr} writ=${rec.d_writ.dtr} area=${rec.opaque_area_frac}`);
    if (rec.metrics_claims_not_in_register.length) {
      say(`   !! metrics().text claims ${rec.metrics_claims_not_in_register.length} strings the draw register never saw:`);
      for (const t of rec.metrics_claims_not_in_register) say(`      "${t.slice(0, 90)}"`);
    }
    for (const m of rec.d_state.missed) say(`   -- state-undrawn ${m.kind}: "${m.s.slice(0, 90)}"`);

    const inp = st.input;
    if (!inp) { if (!entered) { entered = true; st = await h.h('censusEnter'); continue; } break; }
    let v;
    if (inp.kind === 'text') v = 'Silence-Under-Salt';
    else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((o) => o.id);
    else if (inp.kind === 'questionnaire') { v = (inp.options || [])[qi % (inp.options || []).length].id; qi++; }
    else if (st.node === 'writ.class-routes') v = 'questionnaire';
    else v = (inp.options || [])[0] && (inp.options || [])[0].id;
    if (v === undefined || v === null) break;
    st = await h.h('censusAnswer', v);
  }

  const agg = (key) => {
    const c = out.nodes.reduce((a, n) => a + n[key].computed, 0);
    const d = out.nodes.reduce((a, n) => a + n[key].drawn, 0);
    const q = out.nodes.filter((n) => n.questionnaire);
    const qd = q.length ? q.reduce((a, n) => a + n[key].dtr, 0) / q.length : 0;
    return { scene: c ? +(d / c).toFixed(4) : 0, q: +qd.toFixed(4), computed: c, drawn: d, worst: Math.min(...out.nodes.map((n) => n[key].dtr)) };
  };
  out.totals = { d_model: agg('d_model'), d_state: agg('d_state'), d_writ: agg('d_writ') };
  out.totals.area_min = Math.min(...out.nodes.map((n) => n.opaque_area_frac).filter((x) => x > 0));
  out.totals.area_max = Math.max(...out.nodes.map((n) => n.opaque_area_frac));
  out.totals.panel_height_max = Math.max(...out.nodes.map((n) => n.panel_height_frac));
  out.totals.total_clipped = out.nodes.reduce((a, n) => a + n.clipped_strings.length, 0);
  say('\n== TOTALS ==');
  for (const k of ['d_model', 'd_state', 'd_writ']) {
    const t = out.totals[k];
    say(`  ${k.padEnd(8)} DTR_scene ${t.scene}  DTR_q ${t.q}  worst-node ${t.worst}  (${t.drawn}/${t.computed})`);
  }
  say(`  opaque area ${out.totals.area_min}–${out.totals.area_max}; panel height max ${out.totals.panel_height_max}; clipped strings ${out.totals.total_clipped}`);
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}

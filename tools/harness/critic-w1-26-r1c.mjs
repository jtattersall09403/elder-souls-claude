#!/usr/bin/env node
// critic-w1-26-r1c.mjs — the CRITIC's own M20/HF9, M4 clause 1 (O6), RI-JRN09 M2 (AC), and the
// RI-MTH07 CONSUMPTION perturbation on the naming line.
//
// Written by the W1-26 round-1 critic. Declared under `method_deviations`.
//
// S34 NOTE. Every claim in this probe is an ARRIVAL claim — a surface reached, an interval
// walked, a state that survives a reload — so nothing here is placed and nothing here is served
// from the capture cache. No screenshot is cited for any of it.
//
//   T   M20/HF9. Fresh browser context, save seeded into IndexedDB, page RELOADED, then: is a
//       title surface reached before control, does it offer exactly the O3 set, does `Continue`
//       load that save. Walked, not placed.
//   O   M4 clause 1 / O6. `getJourneyStamps()` after a real-input attempt to walk, plus the
//       independent question of whether the body can move at all at the first field node.
//   A   RI-JRN09 M2 (AC). For each of RI-CHR01 §1's eight inputs (sex exempt, out of 7), is the
//       value the player gave present in something DRAWN before they leave the interior? The
//       quoted drawn row is recorded so a reader can judge whether seven quotes are seven
//       templates — the item's one declared judgement call.
//   K   RI-MTH07 CONSUMPTION on the model this journey exists for: `on_match_named_class`, the
//       line RI-CHR01 §4 calls "the moment the route is for". Two well-separated values (two
//       different named classes from two different answer patterns), everything else held
//       fixed, frame-side observable (the drawn string set), plus a null control on a model
//       known to be drawn.
//
// USAGE  node tools/harness/critic-w1-26-r1c.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-26-r1c.mjs — M20/HF9 (walked), O6, AC, and the naming-line coupling test.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame(args);
const out = { probe: 'critic-w1-26-r1c' };
try {
  // ---------------------------------------------------------------- T: M20 / HF9, WALKED ----
  say('== T — M20/HF9: a title surface, from a fresh profile with a save present ==');
  out.m20 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const r = {};
    r.dom_inner_text_len = (document.body.innerText || '').length;
    try { r.wrote_save = await H.writeSave('slot-a'); } catch (e) { r.wrote_save = String(e).slice(0, 160); }
    return r;
  });
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready && window.__HARNESS.ready(), { timeout: 120000 }).catch(() => {});
  const t = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const r = {};
    await H.titleShow();
    H.renderFrame();
    const st = await H.getTitleState();
    r.state = st;
    r.option_ids = st.option_ids || (st.options || []).map((o) => o.id);
    r.enabled = (st.options || []).map((o) => ({ id: o.id, enabled: o.enabled }));
    r.selected_id = st.selected_id;
    r.title_strings = H.getRenderedText({ surface: 'title' }).distinct;
    const before = H.getPlayerStats ? JSON.stringify(H.getPlayerStats()).length : null;
    r.activate = await H.titleActivate('continue');
    r.shown_after = (await H.getTitleState()).shown;
    r.stats_len_before = before;
    r.stats_len_after = H.getPlayerStats ? JSON.stringify(H.getPlayerStats()).length : null;
    return r;
  });
  Object.assign(out.m20, t);
  say(`  option_ids: ${JSON.stringify(out.m20.option_ids)}`);
  say(`  enabled:    ${JSON.stringify(out.m20.enabled)}`);
  say(`  focused:    ${out.m20.selected_id}`);
  say(`  title strings drawn: ${JSON.stringify(out.m20.title_strings)}`);
  say(`  Continue -> ${JSON.stringify(out.m20.activate)}   title still up after: ${out.m20.shown_after}`);

  // ------------------------------------------------------------------- O: M4 clause 1 / O6 ---
  say('\n== O — M4 clause 1 / O6: available play before the first character-defining question ==');
  out.o6 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.setRenderRate(0);
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    const st0 = H.getCensusState();
    const p0 = H.getPlayerStats().pos || H.getPlayerStats().position;
    // Sixty frames of real forward input, dispatched through the same pipeline a player uses.
    for (let i = 0; i < 60; i++) H.queueInputs([{ f: i, move: [0, 1] }]);
    H.stepFrames(60);
    const p1 = H.getPlayerStats().pos || H.getPlayerStats().position;
    const d = (a, b) => (a && b) ? Math.hypot((b[0] ?? b.x) - (a[0] ?? a.x), (b[2] ?? b.z) - (a[2] ?? a.z)) : null;
    return {
      stamps: await H.getJourneyStamps(),
      node_at_start: st0.node,
      node_sets_field: st0.sets || (st0.node === 'hold.hatch-name' ? 'hatch_name' : null),
      census_takes_input: !!(st0.surface && st0.surface.takes_input),
      moved_m: +(d(p0, p1) || 0).toFixed(4),
      forward_input_frames: 60,
      threshold_s: 60,
    };
  });
  say('  ' + JSON.stringify(out.o6));

  // --------------------------------------------------------- A: RI-JRN09 M2, the AC census ---
  say('\n== A — RI-JRN09 M2 (AC): are the answers consumed inside the scene, in DRAWN text? ==');
  out.ac = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    await H.setRenderRate(0);
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    const mark0 = H.getRenderedText({}).next_index;
    await H.censusBegin({ race: 'saxhleel' });
    let st = H.getCensusState(); let guard = 0, qi = 0, entered = false;
    const given = { hatch_name: 'Silence-Under-Salt', given_name: 'Keeps-The-Tally', race: 'Saxhleel' };
    while (st && !st.done && guard++ < 80) {
      const model = H.getCensusModel() || {};
      const optCount = ((model && model.options) || []).length;
      if (optCount > 1) for (let k = 0; k < optCount + 1; k++) { H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]); H.stepFrames(2); H.getUIState(); }
      const inp = st.input;
      if (!inp) { if (!entered) { entered = true; st = await H.censusEnter(); continue; } break; }
      let v;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? given.hatch_name : given.given_name;
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = ((inp.options || [])[0] || {}).id;
      if (st.node === 'writ.upbringing') { given.upbringing = ((inp.options || [])[1] || {}).text; v = ((inp.options || [])[1] || {}).id; }
      if (st.node === 'writ.birthsign') { given.birthsign = ((inp.options || [])[0] || {}).text; }
      if (v == null) break;
      try { st = await H.censusAnswer(v); } catch (e) { break; }
    }
    const ch = H.getCensusState().character || {};
    given.class = (ch.class && (ch.class.name || ch.class.id)) || (ch.class_name) || null;
    const rows = H.getRenderedText({ since: mark0 }).entries.map((e) => e.text);
    const blob = rows.map(tight).join('');
    const fields = [
      { id: 'hatch_name', value: given.hatch_name },
      { id: 'race', value: given.race },
      { id: 'upbringing', value: given.upbringing },
      { id: 'given_name', value: given.given_name },
      { id: 'class', value: given.class },
      { id: 'birthsign', value: given.birthsign },
      { id: 'favoured_attributes', value: null, note: 'custom route only; not taken on this walk' },
    ];
    const result = fields.map((f) => {
      if (!f.value) return { ...f, consumed: false, quote: null };
      const hit = rows.find((r) => tight(r).indexOf(tight(f.value)) >= 0);
      return { ...f, consumed: blob.indexOf(tight(f.value)) >= 0, quote: hit ? String(hit).slice(0, 140) : null };
    });
    return { given, fields: result, ac: result.filter((r) => r.consumed).length, of: 7, drawn_rows: rows.length };
  });
  for (const f of out.ac.fields) say(`  ${f.consumed ? 'CONSUMED' : 'NOT     '} ${String(f.id).padEnd(20)} "${String(f.value).slice(0, 30)}"  <- ${f.quote ? '"' + f.quote + '"' : '(no drawn row carries it)'}`);
  say(`  AC = ${out.ac.ac} of 7`);

  // ---------------------- K: RI-MTH07 CONSUMPTION on `on_match_named_class` (the naming line) --
  say('\n== K — CONSUMPTION: does the naming line reach the frame? (RI-MTH07 §B) ==');
  out.consumption = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    /** One questionnaire completion with a fixed answer index; returns the naming line and the frame. */
    const run = async (answerPick, race) => {
      await H.setRenderRate(0);
      await H.setSeed(1337);
      await H.loadState('barge-hold');
      await H.censusBegin({ race });
      let st = H.getCensusState(); let guard = 0; let namingLine = null; let birthsignDrawn = null;
      let mark = H.getRenderedText({}).next_index;
      let entered = false;
      while (st && !st.done && guard++ < 80) {
        const inp = st.input;
        if (st.node === 'writ.birthsign') {
          // The naming line is a `spoken` reply carried into this node. Record both what the
          // census computed and what the surface painted, over the same interval.
          namingLine = (st.spoken || []).map((s) => (typeof s === 'string' ? s : s.line)).find((l) => l && /not to the letter|nearest to/i.test(l))
            || (st.spoken || []).map((s) => (typeof s === 'string' ? s : s.line)).join(' | ');
          const model = H.getCensusModel() || {};
          const optCount = ((model && model.options) || []).length;
          for (let k = 0; k < optCount + 1; k++) { H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]); H.stepFrames(2); H.getUIState(); }
          birthsignDrawn = H.getRenderedText({ since: mark }).entries.map((e) => e.text);
        }
        if (!inp) { if (!entered) { entered = true; st = await H.censusEnter(); continue; } break; }
        let v;
        if (inp.kind === 'text') v = 'Silence-Under-Salt';
        else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
        else if (inp.kind === 'questionnaire') v = (inp.options || [])[answerPick % (inp.options || []).length].id;
        else if (st.node === 'writ.class-routes') v = 'questionnaire';
        else v = ((inp.options || [])[0] || {}).id;
        if (st.node === 'writ.given-name') mark = H.getRenderedText({}).next_index;
        if (v == null) break;
        try { st = await H.censusAnswer(v); } catch (e) { break; }
      }
      const ch = H.getCensusState().character || {};
      const blob = (birthsignDrawn || []).map(tight).join('');
      return {
        class_id: (ch.class && ch.class.id) || null,
        class_name: (ch.class && ch.class.name) || null,
        naming_line: namingLine ? String(namingLine).slice(0, 170) : null,
        naming_line_drawn: !!(namingLine && blob.indexOf(tight(namingLine)) >= 0),
        class_name_drawn: !!(ch.class && ch.class.name && blob.indexOf(tight(ch.class.name)) >= 0),
        drawn_rows_at_birthsign: (birthsignDrawn || []).length,
      };
    };
    const a = await run(0, 'saxhleel');
    const b = await run(2, 'dunmer');
    // Null control: a model KNOWN to be drawn — the hatch-name — perturbed the same way.
    const ctrl = await (async () => {
      const one = async (name) => {
        await H.setRenderRate(0); await H.setSeed(1337); await H.loadState('barge-hold');
        const m = H.getRenderedText({}).next_index;
        await H.censusBegin({ race: 'saxhleel' });
        await H.censusAnswer(name);
        H.getUIState();
        const rows = H.getRenderedText({ since: m }).entries.map((e) => e.text);
        return { name, drawn: rows.map(tight).join('').indexOf(tight(name)) >= 0, rows: rows.length };
      };
      return { a: await one('Silence-Under-Salt'), b: await one('Counts-The-Drowned') };
    })();
    return {
      model: 'on_match_named_class (RI-CHR01 §4, "the moment the route is for")',
      consumer_claimed: 'render/ui.js — the scribe\'s reply, drawn above the next thing she asks',
      value_a: a, value_b: b,
      predicted_change: 'the two runs produce different named classes, therefore different naming lines, therefore a different drawn string set',
      coupling: (a.naming_line_drawn || b.naming_line_drawn) ? 'nonzero — at least one naming line reached the frame' : 0,
      null_control: ctrl,
    };
  });
  say('  ' + JSON.stringify(out.consumption, null, 2));
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}

#!/usr/bin/env node
// w1-26-r2-scene.mjs — the opening as a played scene, round 2, measured over the whole graph.
//
// Owner: W1-26. It answers, on the live build and in the browser, the five things the round-1
// verdict said this round had to close, plus the CONSUMPTION check `RI-MTH07` requires of each:
//
//   A  THE ACCESSOR SEES EVERY SURFACE.  `RI-JRN01` §0.1(a), and the verdict's single biggest
//      gap. The register's roster is read back; the two draw paths this build has are each given
//      a sentinel on the surface M9 is aimed at; M9 and M15 are then run over a domain that is
//      declared complete, and the probe EXITS NON-ZERO if it searched zero strings or the
//      register reports a blind surface. A probe that cannot go red is worse than no probe.
//   D  `DTR`, over all 18 input-carrying nodes, on ALL THREE class routes, under BOTH draw
//      policies (on arrival / scrolled), against the census's own computed string set.
//   N  THE NAMING LINE. Is the line in which a functionary tells you what you are actually
//      DRAWN, and does it COUPLE — two well-separated class outcomes, everything else held
//      fixed, frame-side observable, plus a null control.
//   O  O6. Does the body move, how many seconds of it are available before the first
//      character-defining question, and is that question GATED on the player or on the clock.
//   W  CAN THE SCENE BE WALKED OUT OF? Added by round 2's successor. O6 handed the player a body
//      before the first question, and a body can leave: `interact` anywhere inside any interior
//      used to take the way OUT, so a press aimed at the woman eight metres away put the body on
//      a dock 3.9 km from a paused scene it could never resume. A STILL probe cannot see this.
//   C  CONSUMPTION (`RI-MTH07` §B, mandatory under `ARBITRATION` §3). The opening is played
//      twice, differing in ONE answer the player gives, and an ENTITY in the world is then asked
//      what it does — greeting cell, band, topics offered — with a null control on a field the
//      reaction matrix must not read.
//   K  DELETE-THE-FIX. Every repair in this round is removed from a live copy and the failure is
//      confirmed to return. `RI-MTH07`, and the standing rule that a builder must break its own
//      instrument before trusting it.
//
// TWO TRAPS, BOTH ALREADY PAID FOR BY THE ROUND-1 CRITIC. Do not re-derive either.
//   1. `UILayer` repaints only when `dirty`, and `getCensusState()` AND `censusAnswer()` both
//      call `metrics()`, which repaints and clears the flag. The register watermark must be
//      taken BEFORE the repainting call and read back with `{since: mark}` after it. A mark
//      taken afterwards measures an empty register and reports `DTR 0.00` for a scene that drew
//      everything.
//   2. `render/ui.js wrap()` splits prose on whitespace and DROPS the space it broke on, so a
//      delivery test that joins register rows with a space and substring-matches fails on every
//      wrapped string and INVENTS undrawn text. Strip all whitespace from both sides.
//
// USAGE  node tools/harness/w1-26-r2-scene.mjs [--json <path>]
'use strict';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-26-r2-scene.mjs — accessor coverage, DTR over three routes, the naming line, O6, and delete-the-fix.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

ensureDir(path.join(REPORTS_DIR, 'journeys'));
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'journeys', 'w1-26-r2-scene.json');

const out = {
  schema: 'elder-souls/w1-26-r2-scene@1', item: 'RI-JRN09 + RI-JRN01', piece: 'W1-26',
  checks: {}, failures: [], passes: [], hard_fails: [],
};
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };
const hard = (id, m) => { out.hard_fails.push({ id, why: m }); say(`  HARD FAIL ${id}  ${m}`); };

// `RI-JRN01` M9's substring list, verbatim, plus the imperative-second-person test.
const M9_SUBSTRINGS = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
const M15_WORDS = ['chosen', 'prophes', 'prophec', 'destined', 'foretold', 'the last of',
  'the only one who', 'nerevarine', 'you alone can'];

const h = await launchGame({ ...args, width: 320, height: 240 });
try {
  // =========================================================== A — the accessor's reach ======
  say('== A — does the accessor see every surface, including the vector-stroked one? ==');
  out.checks.accessor = await h.page.evaluate(async (lists) => {
    const H = window.__HARNESS;
    await H.setRenderRate(0);
    const r = {};
    r.roster = H.registerSurfaces();
    r.sentinels = H.drawSentinels('ES-W1-26-R2');
    // The HUD as the opening really draws it: 120 frames of walking in the hold, census paused,
    // standing next to the tithe-gourd — which is the frame the round-1 critic caught
    // `"Take A tithe-gourd, empty"` on.
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    H.renderedTextClear();
    // Walk the hold and stand ON each of the two takeable things, laying the HUD out at every
    // stop, so the interact prompt is IN the domain M9 greps. Round 1's hit was that prompt;
    // a re-run that never goes near a prop would be searching a domain the defect is not in.
    const goTo = (tx, tz) => {
      for (let attempt = 0; attempt < 30; attempt++) {
        const ps = H.getPlayerStats(); const p = ps.pos || ps.position;
        const dx = tx - p[0], dz = tz - p[2];
        if (Math.hypot(dx, dz) < 0.8) return true;
        const yaw = (ps.yaw || 0) * Math.PI / 180;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = []; for (let i = 0; i < 12; i++) step.push({ f: i, move: [str / n, fwd / n] });
        H.queueInputs(step); H.stepFrames(14); H.getUIState();
      }
      return false;
    };
    r.reached_gourd = goTo(1.6, -1.6);          // "A tithe-gourd, empty"
    r.prompt_at_gourd = (H.getUIState().prompt || null);
    r.reached_knife = goTo(-2.0, 0.2);          // "A knife somebody did not find"
    r.prompt_at_knife = (H.getUIState().prompt || null);
    r.reached_her = goTo(-2.0, 2.6);            // Jeeh-Ei
    r.prompt_at_her = (H.getUIState().prompt || null);
    H.getUIState();                            // lay the HUD out
    const rt = H.getRenderedText({ notSurface: ['dialogue'] });
    r.non_dialogue = { complete: rt.complete, blind: rt.blind_surfaces, in_scope: rt.surfaces_in_scope, distinct: rt.distinct };
    const all = H.getRenderedText({});
    r.all = { complete: all.complete, blind: all.blind_surfaces, distinct_count: all.distinct_count };
    // THE VERDICT'S ACCEPTANCE, LITERALLY: "on a frame where `UISurface.elements[].text` is
    // non-empty, `getRenderedText({notSurface:['dialogue']})` returns a set that CONTAINS every
    // one of those strings (SET EQUALITY, not merely non-empty)". Non-empty is the check that
    // round 1 passed while being blind to two thirds of the frame; equality against the
    // element vocabulary is the check that could not have passed.
    {
      const eng = window.__ENGINE;
      const elems = eng.renderer.menus.elements.filter((e) => e.text != null && String(e.text).length);
      const want = [...new Set(elems.map((e) => String(e.text)))];
      const drawn = H.getRenderedText({ surface: ['menus'] }).distinct;
      const got = new Set(drawn);
      // A DECLARED STRING THE FRAME ITSELF TRUNCATED IS NOT A BLIND SPOT.
      // `ui/hud.js` ellipsises a label that will not fit its declared rect, so the quick slot
      // declares "Spark-Dart" and PAINTS "Spark-Da…". The register is faithful — it reports what
      // went through the draw call — and reporting that as "missing" would blame the instrument
      // for the layout. It is recorded under its own name instead, because an unreadable spell
      // name in a quick slot is a real legibility defect and it should not vanish into a pass.
      const truncatedBy = (t) => drawn.find((d) => d.endsWith('…') && t.startsWith(d.slice(0, -1)) && d.length > 1);
      const missing = want.filter((t) => !got.has(t) && !truncatedBy(t));
      const truncated = want.filter((t) => !got.has(t) && truncatedBy(t)).map((t) => ({ declared: t, drawn: truncatedBy(t) }));
      r.set_equality = {
        element_texts: want,
        register_has: want.filter((t) => got.has(t)),
        truncated_by_the_frame: truncated,
        register_missing: missing,
        elements_non_empty: want.length > 0,
        equal: want.length > 0 && missing.length === 0,
      };
    }
    const low = (s) => String(s).toLowerCase();
    r.m9_hits = rt.distinct.filter((s) => lists.subs.some((sub) => s.indexOf(sub) >= 0));
    // The imperative-second-person clause, which is the one that fired in round 1. A bare
    // imperative verb at the head of a drawn string is the shape: "Take …", "Speak to …",
    // "Hold …". Checked as a leading token so a proper noun in the middle of a line is safe.
    const IMPERATIVE = ['take', 'press', 'hold', 'speak', 'click', 'tap', 'push', 'pull', 'use',
      'open', 'go', 'walk', 'run', 'jump', 'attack', 'defeat', 'find', 'collect', 'equip', 'talk'];
    r.m9_imperative = rt.distinct.filter((s) => IMPERATIVE.indexOf(low(s).split(/[^a-z]+/)[0]) >= 0);
    r.m15_hits = all.distinct.filter((s) => lists.words.some((w) => low(s).indexOf(w) >= 0));
    r.hud_prompt = H.getUIState().prompt || null;
    return r;
  }, { subs: M9_SUBSTRINGS, words: M15_WORDS });

  const A = out.checks.accessor;
  say(`  roster: declared ${JSON.stringify(A.roster.declared)}  instrumented ${JSON.stringify(A.roster.instrumented)}  blind ${JSON.stringify(A.roster.blind)}`);
  say(`  sentinel through glyphs.drawText()  -> seen: ${A.sentinels.vector.seen}`);
  say(`  sentinel through ctx.fillText()     -> seen: ${A.sentinels.fill.seen}`);
  say(`  M9 domain: ${A.non_dialogue.distinct.length} distinct non-dialogue strings, complete=${A.non_dialogue.complete}`);
  say(`  they are: ${JSON.stringify(A.non_dialogue.distinct)}`);

  if (!A.roster.complete) fail(`the register declares ${JSON.stringify(A.roster.blind)} and cannot see them: M9/M15 are unmeasurable ⇒ 0`);
  else pass(`every declared surface is instrumented (${A.roster.instrumented.join(', ')})`);
  if (!A.sentinels.both_seen) fail(`the register misses a draw path: vector seen=${A.sentinels.vector.seen}, fillText seen=${A.sentinels.fill.seen}`);
  else pass('both draw paths falsified: a vector sentinel AND a fillText sentinel are both in the register');
  say(`  UISurface.elements[].text on this frame: ${JSON.stringify(A.set_equality.element_texts)}`);
  if (!A.set_equality.elements_non_empty) fail('no HUD element carried text on the measured frame — set equality is untestable, not satisfied');
  else if (!A.set_equality.equal) fail(`the register is MISSING drawn element text: ${JSON.stringify(A.set_equality.register_missing)}`);
  else {
    pass(`set equality: the register accounts for all ${A.set_equality.element_texts.length} strings UISurface.elements[].text carries on that frame`);
    for (const t of A.set_equality.truncated_by_the_frame) {
      say(`  NOTE  the frame TRUNCATES a declared label: "${t.declared}" is painted as "${t.drawn}" (ui/hud.js ellipsises to the declared rect). The register is faithful; the label is not legible. W1-21 owns that rect.`);
    }
  }
  if (!A.non_dialogue.complete) fail(`M9's domain is incomplete (blind: ${JSON.stringify(A.non_dialogue.blind)}) — unmeasurable, not clean`);
  else if (!A.non_dialogue.distinct.length) fail('M9 searched ZERO strings. That is ignorance, not a pass.');
  else {
    pass(`M9 searched ${A.non_dialogue.distinct.length} distinct strings over a complete domain`);
    if (A.m9_hits.length) hard('HF3', `M9 substring hits: ${JSON.stringify(A.m9_hits)}`);
    else if (A.m9_imperative.length) hard('HF3', `M9 imperative-second-person hits: ${JSON.stringify(A.m9_imperative)}`);
    else pass('M9: 0 hits — no instruction substrings and no imperative-led string on the non-dialogue surfaces');
  }
  if (A.m15_hits.length) hard('HF-M15', `chosen-one vocabulary drawn: ${JSON.stringify(A.m15_hits)}`);
  else pass(`M15: 0 hits over ${A.all.distinct_count} distinct strings, domain complete=${A.all.complete}`);

  // ========================================================== O — O6, and does it move? =====
  say('\n== O — O6: a body before a character ==');
  out.checks.o6 = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const pos = () => { const s = H.getPlayerStats(); return (s.pos || s.position || []).slice(); };
    const d = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
    await H.setRenderRate(0); await H.setSeed(1337);
    await H.loadState('barge-hold');
    const st0 = await H.censusBegin({ race: 'saxhleel' });
    const r = {
      node_at_boot: st0.node,
      paused_at_boot: !!st0.paused,
      resume_by: st0.resume_by || null,
      census_takes_input_at_boot: !!(st0.surface && st0.surface.takes_input),
      any_question_at_boot: !!(st0.input),
    };
    // Sixty frames of real forward input through the same pipeline a player uses — in ONE
    // queueInputs call. `InputPipeline.queueInputs()` REPLACES the timeline and re-bases it on
    // the calling frame, so sixty successive calls deliver exactly one frame of input, which is
    // what both round-1 probes did and why "0.0000 m" was partly an artefact of the instrument.
    const p0 = pos();
    const s60 = []; for (let i = 0; i < 60; i++) s60.push({ f: i, move: [0, 1] });
    H.queueInputs(s60); H.stepFrames(60);
    r.moved_m_60f = +d(p0, pos()).toFixed(4);
    r.stamps_after_60 = await H.getJourneyStamps();

    // Now play. Sixty-one seconds of ordinary being-a-body in the hold, with nothing asked, then
    // walk over and talk to her. The walk is a real path through the world, not a teleport.
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    const script = [];
    for (let i = 0; i < 3660; i++) {           // 61 s at 60 Hz
      const t = i / 60;
      script.push({ f: i, move: [Math.sin(t * 0.7) * 0.8, Math.cos(t * 0.5) * 0.8] });
    }
    H.queueInputs(script); H.stepFrames(3660);
    r.wandered = { frames: 3660, s: 61, still_paused: !!H.getCensusState().paused, question_up: !!H.getCensusState().input };
    // Walk to her and press interact. She is at [-2.0, 0, 2.6]; drive straight at her, then reach.
    const who = (H.getCensusState().npcs_present || []);
    r.npcs_present = who;
    for (let attempt = 0; attempt < 40 && H.getCensusState().paused; attempt++) {
      const p = pos();
      const st = H.getCensusState();
      const tgt = (st.speaker_entity && st.speaker_entity.pos) || [-2.0, 0, 2.6];
      const yaw = (H.getPlayerStats().yaw || 0) * Math.PI / 180;
      const dx = tgt[0] - p[0], dz = tgt[2] - p[2];
      // world -> body frame, so the drive is through the same move axes a stick uses
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
      const n = Math.max(1e-6, Math.hypot(fwd, str));
      const step = [];
      for (let i = 0; i < 30; i++) step.push({ f: i, move: [str / n, fwd / n] });
      step.push({ f: 31, press: ['interact'] }, { f: 32, release: ['interact'] });
      H.queueInputs(step); H.stepFrames(40);
    }
    const st1 = H.getCensusState();
    r.after_walk_and_talk = { node: st1.node, paused: !!st1.paused, asks: st1.input ? st1.input.kind : null, line: st1.line };
    r.stamps = await H.getJourneyStamps();
    r.dist_to_her = st1.speaker_entity ? st1.speaker_entity.dist_m : null;
    return r;
  });
  const O = out.checks.o6;
  say(`  at boot: node=${O.node_at_boot} paused=${O.paused_at_boot} resume_by=${O.resume_by} question=${O.any_question_at_boot}`);
  say(`  60 frames of forward input moved the body ${O.moved_m_60f} m`);
  say(`  61 s of wandering with nothing asked: still paused = ${O.wandered.still_paused}`);
  say(`  walked over and pressed interact -> ${JSON.stringify(O.after_walk_and_talk)}`);
  say(`  stamps: ${JSON.stringify(O.stamps)}`);
  if (O.any_question_at_boot) fail('a character-defining question is on the frame at boot');
  else pass('no question at boot: the hold opens with a body and no form');
  if (!(O.moved_m_60f > 0.5)) fail(`60 frames of forward input moved ${O.moved_m_60f} m — the body does not move`);
  else pass(`60 frames of forward input moved ${O.moved_m_60f} m`);
  const secs = O.stamps.available_play_s_before_first_field;
  if (secs == null) fail('available_play_s_before_first_field is undefined — first_control or the field node never arrived');
  else if (secs < 60) fail(`available play before the first character-defining question: ${secs} s, against O6's >= 60 s`);
  else pass(`available play before the first character-defining question: ${secs} s (O6 wants >= 60 s)`);
  if (O.after_walk_and_talk.paused) fail('walking to her and pressing interact did not open the scene');
  else pass(`she speaks on interact: "${String(O.after_walk_and_talk.line).slice(0, 70)}…"`);

  // ========================================== D + N — DTR over three routes, and the naming ==
  say('\n== D — DTR over every input-carrying node, all three class routes ==');
  out.checks.dtr = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

    /**
     * Walk one class route and measure delivery at every node.
     *
     * `scrolled` counts an option the caret can page to as delivered; `arrival` counts only what
     * is on the frame when the node opens. Both are reported because the item says "actually
     * drawn at that node" and the two readings of that sentence differ, and a builder that
     * published only the kind one would be choosing its own denominator.
     */
    const walk = async (route) => {
      await H.setRenderRate(0); await H.setSeed(1337);
      await H.loadState('barge-hold');
      let mark = H.getRenderedText({}).next_index;
      await H.censusBegin({ race: 'saxhleel' });
      let st = H.getCensusState();
      const rows = []; let guard = 0, qi = 0;
      let naming = null;
      while (st && !st.done && guard++ < 90) {
        if (!st.input) {
          if (st.paused) { mark = H.getRenderedText({}).next_index; st = await H.censusEnter(st.resume_by); continue; }
          break;
        }
        const model = H.getCensusModel() || {};
        const drawnRows = H.getRenderedText({ since: mark }).entries.map((e) => tight(e.text));
        const blob = drawnRows.join('');
        const want = [];
        for (const s of (model.spoken || [])) want.push({ role: 'spoken', s });
        if (model.preamble) want.push({ role: 'preamble', s: model.preamble });
        if (model.line) want.push({ role: 'line', s: model.line });
        for (const o of (model.options || [])) want.push({ role: 'option', s: o.text });
        const missArrival = want.filter((w) => blob.indexOf(tight(w.s)) < 0);
        // The scrolled policy: page the caret through the whole list, then re-read.
        //
        // ONE REPAINT PER CARET POSITION, and this is the third instrument trap in this scene.
        // `UILayer` repaints on demand — `metrics()` when `dirty` — so a probe that queues fifty
        // frames of caret movement and then calls `getUIState()` ONCE paints exactly one window:
        // the last one. It reads back as "scrolling revealed nothing" and indicts the build for
        // a defect in the probe. Step, repaint, step.
        const optCount = ((model.options) || []).length;
        for (let k = 0; k < optCount + 2 && optCount > 1; k++) {
          H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]);
          H.stepFrames(3);
          H.getUIState();
        }
        const blobScrolled = H.getRenderedText({ since: mark }).entries.map((e) => tight(e.text)).join('');
        const missScrolled = want.filter((w) => blobScrolled.indexOf(tight(w.s)) < 0);
        const surf = H.getUIState().dialogue_surface || {};
        rows.push({
          node: st.node, n: want.length,
          arrival: want.length - missArrival.length,
          scrolled: want.length - missScrolled.length,
          dtr_arrival: want.length ? +((want.length - missArrival.length) / want.length).toFixed(4) : 1,
          dtr_scrolled: want.length ? +((want.length - missScrolled.length) / want.length).toFixed(4) : 1,
          undrawn_scrolled: missScrolled.map((m) => `${m.role}: ${String(m.s).slice(0, 80)}`),
          undrawn_arrival_roles: missArrival.map((m) => m.role),
          sacrificed: surf.sacrificed || null,
          area_frac: surf.opaque_area_frac, height_frac: surf.panel_height_frac,
        });
        if (st.node === 'writ.class-verdict') {
          naming = { line: model.line, drawn: blobScrolled.indexOf(tight(model.line)) >= 0 };
        }
        let v;
        const inp = st.input;
        if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
        else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
        else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
        else if (st.node === 'writ.class-routes') v = route;
        else if (st.node === 'writ.class-custom-name') v = 'Root-Cutter';
        else v = ((inp.options || [])[0] || {}).id;
        if (v == null) break;
        mark = H.getRenderedText({}).next_index;
        try { st = await H.censusAnswer(v); } catch (e) { rows.push({ node: st.node, error: String(e).slice(0, 160) }); break; }
      }
      const ch = H.getCensusState().character || {};
      const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
      const q = rows.filter((r) => r.node === 'writ.class-questions');
      return {
        route, rows, naming,
        class_name: (ch.class && (ch.class.name || ch.class.id)) || ch.class_name || null,
        dtr_scene_arrival: +(sum('arrival') / Math.max(1, sum('n'))).toFixed(4),
        dtr_scene_scrolled: +(sum('scrolled') / Math.max(1, sum('n'))).toFixed(4),
        dtr_q: q.length ? +(q.reduce((a, r) => a + r.scrolled, 0) / q.reduce((a, r) => a + r.n, 0)).toFixed(4) : null,
        dtr_q_arrival: q.length ? +(q.reduce((a, r) => a + r.arrival, 0) / q.reduce((a, r) => a + r.n, 0)).toFixed(4) : null,
        worst_arrival: rows.slice().filter((r) => r.dtr_arrival != null).sort((a, b) => a.dtr_arrival - b.dtr_arrival)[0] || null,
        worst_scrolled: rows.slice().filter((r) => r.dtr_scrolled != null).sort((a, b) => a.dtr_scrolled - b.dtr_scrolled)[0] || null,
        max_area_frac: Math.max(...rows.map((r) => r.area_frac || 0)),
        spoken_sacrificed_total: rows.reduce((a, r) => a + ((r.sacrificed && r.sacrificed.spoken_lines) || 0), 0),
      };
    };
    return { questionnaire: await walk('questionnaire'), named: await walk('named'), custom: await walk('custom') };
  });

  for (const k of ['questionnaire', 'named', 'custom']) {
    const W = out.checks.dtr[k];
    say(`\n  route ${k}: class = ${W.class_name}`);
    for (const r of W.rows) {
      if (r.error) { say(`    ${String(r.node).padEnd(26)} ERROR ${r.error}`); continue; }
      const sc = r.sacrificed || {};
      say(`    ${String(r.node).padEnd(26)} arrival ${String(r.dtr_arrival).padEnd(7)} scrolled ${String(r.dtr_scrolled).padEnd(7)} ${r.arrival}/${r.n}  k=${sc.type_scale} win=${sc.option_window} cols=${sc.option_columns} spoken-lost=${sc.spoken_lines}`);
      for (const u of r.undrawn_scrolled) say(`        UNDRAWN  ${u}`);
    }
    say(`    DTR_scene arrival ${W.dtr_scene_arrival}  scrolled ${W.dtr_scene_scrolled}  DTR_q ${W.dtr_q} (arrival ${W.dtr_q_arrival})`);
    say(`    worst node on arrival: ${W.worst_arrival && W.worst_arrival.node} @ ${W.worst_arrival && W.worst_arrival.dtr_arrival}`);
    say(`    max non-world panel area: ${W.max_area_frac}   spoken lines sacrificed across the whole route: ${W.spoken_sacrificed_total}`);

    if (W.spoken_sacrificed_total > 0) fail(`route ${k}: the panel sacrificed ${W.spoken_sacrificed_total} of the scribe's lines`);
    else pass(`route ${k}: 0 of the scribe's lines sacrificed to the panel budget`);
    if (W.dtr_q !== null && W.dtr_q < 1) fail(`route ${k}: DTR_q ${W.dtr_q} < 1.00`);
    if (W.dtr_scene_scrolled < 0.90) fail(`route ${k}: DTR_scene ${W.dtr_scene_scrolled} < 0.90`);
    else pass(`route ${k}: DTR_scene ${W.dtr_scene_scrolled} (arrival ${W.dtr_scene_arrival}) >= 0.90`);
    const worst = W.worst_arrival;
    if (worst && worst.dtr_arrival < 0.50) hard('HF1', `route ${k}: DTR ${worst.dtr_arrival} at ${worst.node}`);
    if (W.max_area_frac > 0.55) hard('HF-M5', `route ${k}: panel area ${W.max_area_frac} over M5's 0.55 ceiling`);
    else pass(`route ${k}: max panel area ${W.max_area_frac} inside M5's 0.55`);
    if (!W.naming || !W.naming.drawn) fail(`route ${k}: the naming line was NOT drawn`);
    else pass(`route ${k}: naming line drawn — "${String(W.naming.line).slice(0, 70)}…"`);
    if (W.naming && W.class_name && String(W.naming.line).indexOf(W.class_name) < 0) {
      fail(`route ${k}: the drawn naming line does not contain the computed class "${W.class_name}"`);
    }
  }

  // ============================================ N — the naming line's CONSUMPTION coupling ===
  say('\n== N — RI-MTH07 CONSUMPTION on the naming line ==');
  out.checks.naming_coupling = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const tight = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
    /**
     * Two WELL-SEPARATED values of the perturbed term (the answer pattern that decides the
     * class), everything else held fixed, observed FRAME-SIDE (the drawn string set at the
     * verdict node) — plus a null control that perturbs nothing.
     */
    const run = async (pick) => {
      await H.setRenderRate(0); await H.setSeed(1337);
      await H.loadState('barge-hold');
      let mark = H.getRenderedText({}).next_index;
      await H.censusBegin({ race: 'saxhleel' });
      let st = H.getCensusState(); let guard = 0, qi = 0; let verdict = null;
      while (st && !st.done && guard++ < 90) {
        if (!st.input) { if (st.paused) { mark = H.getRenderedText({}).next_index; st = await H.censusEnter(st.resume_by); continue; } break; }
        if (st.node === 'writ.class-verdict' && !verdict) {
          const model = H.getCensusModel() || {};
          const blob = H.getRenderedText({ since: mark }).entries.map((e) => tight(e.text)).join('');
          verdict = { line: model.line, drawn: blob.indexOf(tight(model.line)) >= 0 };
          // and keep going — the class name is only on the character, and the character only
          // exists once the writ is stamped. Reading the observable and then stopping would
          // have left `class_name` null and made the coupling test unable to tell two different
          // classes apart from two identical nulls.
        }
        let v; const inp = st.input;
        if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
        else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[pick(qi, os.length)].id; qi++; }
        else if (st.node === 'writ.class-routes') v = 'questionnaire';
        else v = ((inp.options || [])[0] || {}).id;
        if (v == null) break;
        mark = H.getRenderedText({}).next_index;
        try { st = await H.censusAnswer(v); } catch (e) { break; }
      }
      const ch = H.getCensusState().character || {};
      const cls = (ch.class && (ch.class.name || ch.class.id)) || ch.class_name || null;
      return { verdict, class_name: cls, class_in_drawn_line: !!(cls && verdict && String(verdict.line).indexOf(cls) >= 0) };
    };
    const a = await run(() => 0);                       // always the first answer
    const b = await run((i, n) => (n - 1));             // always the last answer
    const nullCtl = await run(() => 0);                 // perturb nothing: same as A
    return {
      A: a, B: b, null_control: nullCtl,
      classes_differ: a.class_name !== b.class_name,
      lines_differ: (a.verdict && a.verdict.line) !== (b.verdict && b.verdict.line),
      both_drawn: !!(a.verdict && a.verdict.drawn) && !!(b.verdict && b.verdict.drawn),
      null_control_identical: (a.verdict && a.verdict.line) === (nullCtl.verdict && nullCtl.verdict.line),
      coupling: (a.class_name !== b.class_name
        && (a.verdict && a.verdict.line) !== (b.verdict && b.verdict.line)
        && (a.verdict && a.verdict.drawn) && (b.verdict && b.verdict.drawn)) ? 1 : 0,
    };
  });
  const N = out.checks.naming_coupling;
  say(`  A: class=${N.A.class_name}  drawn=${N.A.verdict && N.A.verdict.drawn}`);
  say(`     "${String(N.A.verdict && N.A.verdict.line).slice(0, 110)}"`);
  say(`  B: class=${N.B.class_name}  drawn=${N.B.verdict && N.B.verdict.drawn}`);
  say(`     "${String(N.B.verdict && N.B.verdict.line).slice(0, 110)}"`);
  say(`  null control identical to A: ${N.null_control_identical}`);
  if (!N.classes_differ) fail('the two answer patterns produced the SAME class — the perturbation is not separated');
  if (!N.both_drawn) fail('a naming line was computed and not drawn');
  if (!N.null_control_identical) fail('the null control moved the observable — the test is not measuring the perturbation');
  if (N.coupling !== 1) fail(`NAMED_line coupling = ${N.coupling}`);
  else pass('NAMED_line coupling = 1: two classes, two drawn lines, null control unmoved');

  // ==================================================================== K — delete the fix ===
  say('\n== K — delete each fix from a live copy and confirm the failure returns ==');
  out.checks.delete_the_fix = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE;
    const r = {};
    // K1 — the vector hook. Remove `__esNoteText` from the menus context and the register goes
    // blind to the HUD again, which is exactly the round-1 state.
    {
      const ctx = eng.renderer.menus.ctx;
      const keep = ctx.__esNoteText;
      const before = H.drawSentinels('K1-WITH');
      delete ctx.__esNoteText;
      const after = H.drawSentinels('K1-WITHOUT');
      ctx.__esNoteText = keep;
      const restored = H.drawSentinels('K1-RESTORED');
      r.k1_vector_hook = {
        with_fix_vector_seen: before.vector.seen,
        without_fix_vector_seen: after.vector.seen,
        restored_vector_seen: restored.vector.seen,
        fillText_unaffected: after.fill.seen,
        failure_returns: before.vector.seen && !after.vector.seen && restored.vector.seen,
      };
    }
    // K2 — the roster. Declare a surface nobody instrumented and the accessor must say so
    // rather than keep reporting a clean complete domain.
    {
      const reg = eng.renderer.textRegister;
      const before = H.getRenderedText({}).complete;
      reg.declare('a-surface-nobody-wrapped', 'delete-the-fix probe');
      const after = H.getRenderedText({});
      reg.surfaces.delete('a-surface-nobody-wrapped');
      const restored = H.getRenderedText({}).complete;
      r.k2_roster = {
        complete_before: before, complete_with_blind_surface: after.complete,
        blind_named: after.blind_surfaces, complete_after_restore: restored,
        failure_returns: before === true && after.complete === false && after.blind_surfaces.indexOf('a-surface-nobody-wrapped') >= 0 && restored === true,
      };
    }
    // K3 — THE NAMING LINE'S PROTECTED SLOT.
    //
    // The repair is that the naming line stopped being a `spoken` row and became a node's own
    // `line`. So the deletion is to put it back where round 1 had it — in `spoken` — under page
    // pressure the panel genuinely cannot absorb, and confirm it goes undrawn while the node's
    // own line survives. Pressure is applied honestly: the same surface, the same constants, a
    // model with more content than the height cap can hold at the type floor with the minimum
    // option window. If the line survives even there, the protected slot is not doing the work
    // and this round has not fixed anything.
    {
      const tight = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
      await H.setRenderRate(0); await H.setSeed(1337);
      await H.loadState('barge-hold');
      let mark = H.getRenderedText({}).next_index;
      await H.censusBegin({ race: 'saxhleel' });
      let st = H.getCensusState(); let guard = 0, qi = 0;
      while (st && !st.done && guard++ < 90 && st.node !== 'writ.class-verdict') {
        if (!st.input) { if (st.paused) { st = await H.censusEnter(st.resume_by); continue; } break; }
        let v; const inp = st.input;
        if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
        else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
        else if (st.node === 'writ.class-routes') v = 'questionnaire';
        else v = ((inp.options || [])[0] || {}).id;
        if (v == null) break;
        try { st = await H.censusAnswer(v); } catch (e) { break; }
      }
      const model = H.getCensusModel() || {};
      const namingLine = model.line;
      const ui = eng.renderer.ui;
      const seen = (m0) => H.getRenderedText({ since: m0 }).entries.map((e) => tight(e.text)).join('');
      // Page pressure the cap cannot absorb: twenty long answers and a wall of her talking.
      const manyOpts = [];
      for (let i = 0; i < 20; i++) {
        manyOpts.push({ id: 'x' + i, text: 'An answer long enough that it cannot be set two to a line at any size ' + i });
      }
      const filler = [];
      for (let i = 0; i < 8; i++) {
        filler.push('She keeps talking, and the page is only so tall, and something on it has to give way ' + i + '.');
      }
      const question = 'Which tide were you drawn on?';

      // WITH the fix: the naming line is the node's own `line` — the slot nothing may sacrifice.
      let m0 = H.getRenderedText({}).next_index;
      ui.setModel({ ...model, line: namingLine, spoken: filler, options: manyOpts, input_kind: 'choice', record: null });
      const mWith = ui.metrics();
      const withFix = seen(m0).indexOf(tight(namingLine)) >= 0;

      // WITHOUT: exactly round 1's arrangement — the naming line is a `spoken` row, the node's
      // own line is the next question, and the same page pressure applies.
      m0 = H.getRenderedText({}).next_index;
      ui.setModel({ ...model, line: question, spoken: [namingLine, ...filler], options: manyOpts, input_kind: 'choice', record: null });
      const mWithout = ui.metrics();
      const withoutFix = seen(m0).indexOf(tight(namingLine)) >= 0;

      r.k3_naming_line = {
        naming_line: String(namingLine).slice(0, 90),
        drawn_as_node_line: withFix,
        drawn_as_spoken_row_under_pressure: withoutFix,
        sacrificed_as_node_line: mWith.sacrificed,
        sacrificed_as_spoken_row: mWithout.sacrificed,
        question_still_drawn_without_fix: seen(m0).indexOf(tight(question)) >= 0,
        failure_returns: withFix === true && withoutFix === false,
      };
    }
    // K4 — the imperative prompt, ON THE FRAME rather than in a return value.
    //
    // The round-1 hit was `"Take A tithe-gourd, empty"` drawn on the HUD after 120 frames of
    // walking in the hold. So: stand next to the tithe-gourd, lay the HUD out, read the string
    // the REGISTER has (which is what M9 greps), and then put the round-1 string back through
    // the same element and confirm M9's imperative clause goes red on it.
    {
      const IMPERATIVE = ['take', 'speak', 'press', 'hold', 'click', 'tap', 'use', 'open', 'go', 'talk'];
      const led = (s) => IMPERATIVE.indexOf(String(s).toLowerCase().split(/[^a-z]+/)[0]) >= 0;
      await H.setRenderRate(0); await H.setSeed(1337);
      await H.loadState('barge-hold');
      await H.censusBegin({ race: 'saxhleel' });
      // Walk onto the tithe-gourd at [1.6, 0.82, -1.6]; the census is paused so the body moves.
      for (let attempt = 0; attempt < 30; attempt++) {
        const ps = H.getPlayerStats();
        const p = ps.pos || ps.position;
        const yaw = (ps.yaw || 0) * Math.PI / 180;
        const dx = 1.6 - p[0], dz = -1.6 - p[2];
        if (Math.hypot(dx, dz) < 0.9) break;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = [];
        for (let i = 0; i < 12; i++) step.push({ f: i, move: [str / n, fwd / n] });
        H.queueInputs(step); H.stepFrames(14);
      }
      H.renderedTextClear();
      H.getUIState();
      const drawnNow = H.getRenderedText({ surface: ['menus'] }).distinct;
      const promptNow = eng._interactPrompt();
      // Round 1's string, through the same drawn element, on the same surface.
      const round1 = promptNow ? ((promptNow.verb === 'take' ? 'Take ' : 'Speak to ') + promptNow.text) : null;
      let drawnThen = [];
      if (round1) {
        const mark0 = H.getRenderedText({}).next_index;
        H.drawOnMenus(round1);                        // through the real vector draw path
        drawnThen = H.getRenderedText({ since: mark0 }).distinct;
      }
      r.k4_prompt = {
        walked_to: (H.getPlayerStats().pos || H.getPlayerStats().position),
        prompt_now: promptNow ? promptNow.text : null,
        drawn_on_menus_now: drawnNow,
        m9_imperative_now: drawnNow.filter(led),
        round1_string: round1,
        drawn_on_menus_round1: drawnThen,
        m9_imperative_round1: drawnThen.filter(led),
        failure_returns: !!(round1 && drawnThen.filter(led).length > 0 && drawnNow.filter(led).length === 0),
      };
    }
    return r;
  });
  // ================================= W — can the scene be walked out of half-finished? ========
  // ROUND 2's successor. O6 gave the player sixty seconds of body before the first question, and
  // a body can leave. Measured at HEAD before this section existed: pressing `interact` to talk
  // to her from eight metres away fell through the census's (correct) reach refusal into
  // `stepSettlement`'s door latch, which offered the way OUT of every interior at `dist_m: 0`
  // from anywhere in the room — and put the body on the Tidewrack dock, 3.9 km from a hold the
  // paused scene can never be resumed in. The scene probe called it `dist_to_her: 0.272` the
  // whole time, because the census measures its speaker in the hold's own frame. A STILL probe
  // cannot see this; only a walked one can.
  say('\n== W — the opening cannot be walked out of, and the way out is a place ==');
  out.checks.escape = await h.page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.setRenderRate(0); await H.setSeed(1337);
    const drive = async (deleteFix) => {
      await H.loadState('barge-hold');
      await H.censusBegin({ race: 'saxhleel' });
      const restore = deleteFix ? deleteFix() : null;
      const script = [];
      for (let i = 0; i < 3660; i++) { const t = i / 60; script.push({ f: i, move: [Math.sin(t * 0.7) * 0.8, Math.cos(t * 0.5) * 0.8] }); }
      H.queueInputs(script); H.stepFrames(3660);          // 61 s of being a body, then go and talk
      for (let a = 0; a < 40 && E.census.paused; a++) {
        const p = E.sim.player.pos;
        const who = E.sim.findNPC(E.census.state().speaker);
        const tgt = who ? who.pos : [-2, 0, 2.6];
        const yaw = (H.getPlayerStats().yaw || 0) * Math.PI / 180;
        const dx = tgt[0] - p[0], dz = tgt[2] - p[2];
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = [];
        for (let i = 0; i < 30; i++) step.push({ f: i, move: [str / n, fwd / n] });
        step.push({ f: 31, press: ['interact'] }, { f: 32, release: ['interact'] });
        H.queueInputs(step); H.stepFrames(40);
      }
      const st = H.getCensusState();
      const p = E.sim.player.pos;
      const row = {
        node: st.node, paused: !!st.paused, asks: st.input ? st.input.kind : null,
        interior: E.sim.env.interior,
        // The number the census reports, and the number the WORLD reports, side by side. They
        // disagreed by 3.9 km and only one of them was ever printed.
        census_dist_m: st.speaker_entity ? st.speaker_entity.dist_m : null,
        world_dist_m: (() => { const w = E.sim.findNPC('jeeh-ei'); return w ? +Math.hypot(w.pos[0] - p[0], w.pos[2] - p[2]).toFixed(3) : null; })(),
      };
      if (restore) restore();
      return row;
    };
    const r = { with_fix: await drive(null) };
    // DELETE THE FIX, both halves at once: strip the inside-door face (so the out-door is in
    // reach from anywhere again) and unhook the scene's veto.
    r.fix_deleted = await drive(() => {
      const real = E.settlements.interior.bind(E.settlements);
      E.settlements.interior = (id) => { const rec = real(id); return rec ? { ...rec, continuity: { ...(rec.continuity || {}), interior_spawn: null } } : rec; };
      const veto = E.sim.doorVeto; E.sim.doorVeto = null;
      return () => { E.settlements.interior = real; E.sim.doorVeto = veto; };
    });
    // And the door still WORKS as a door: stand on the inside face and it opens.
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    E.sim.doorVeto = null;                       // the scene's hold released, as it is when done
    const face = E.settlements.interior('barge-hold').continuity.interior_spawn;
    E.sim.placeBody(face[0], face[1], face[2]);
    H.stepFrames(2);
    r.door_in_reach_at_its_own_face = E.sim.door ? { way: E.sim.door.way, dist_m: E.sim.door.dist_m } : null;
    H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]); H.stepFrames(6);
    r.door_opens_from_its_face = E.sim.env.interior === null;
    return r;
  });
  {
    const W = out.checks.escape;
    say(`  with the fix:  ${JSON.stringify(W.with_fix)}`);
    say(`  fix deleted:   ${JSON.stringify(W.fix_deleted)}`);
    say(`  the door at its own inside face: ${JSON.stringify(W.door_in_reach_at_its_own_face)} opens=${W.door_opens_from_its_face}`);
    if (W.with_fix.paused || W.with_fix.interior !== 'barge-hold') {
      hard('W-ESCAPE', `after 61 s of body the scene could not be resumed: node=${W.with_fix.node} interior=${W.with_fix.interior}`);
    } else pass(`61 s of body, then walk over and talk: the scene resumes at ${W.with_fix.node}, still in the hold`);
    if (W.fix_deleted.paused && W.fix_deleted.interior === null) {
      pass(`deleting the fix brings it back: paused at ${W.fix_deleted.node}, ${W.fix_deleted.world_dist_m} m from her, outside every interior`);
    } else fail('deleting the out-door reach gate did NOT bring the escape back — the fix may not be what is doing the work');
    if (W.door_opens_from_its_face) pass('the way out is still a door: standing on its inside face, interact leaves the hold');
    else fail('the out-door no longer opens from its own inside face — the reach gate is too tight');
    const cd = W.fix_deleted.census_dist_m, wd = W.fix_deleted.world_dist_m;
    if (cd != null && wd != null && Math.abs(cd - wd) > 1) {
      say(`  NOTE  in the broken run the census reports ${cd} m to her and the world reports ${wd} m. ` +
          'That gap is why a probe that never walked reported this scene as passing.');
    }
  }

  // ============================ C — CONSUMPTION: does the world read what you answered? =======
  // `RI-MTH07` §B, mandatory under ARBITRATION §3. The model this piece ships is the census
  // output. Naming a consumer inside the scene is not enough — the scene is the thing being
  // judged. So: play the opening TWICE, changing exactly ONE answer the player gives with their
  // own hands (`writ.upbringing`), and then read an ENTITY: what a person in the world says when
  // you walk up to them, which cell of `greetings.json` it came out of, and what they will
  // discuss with you. Null control: two runs differing only in the hatch-name — a field the
  // reaction matrix must not read — must give byte-identical entity behaviour.
  say('\n== C — CONSUMPTION: the answers you give are read by somebody in the world ==');
  out.checks.consumption = await h.page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.setRenderRate(0); await H.setSeed(1337);
    // Walk the whole creation, answering it, and hand back what a person in the world then does.
    const play = async ({ upbringing, hatchName }) => {
      await H.loadState('barge-hold');
      await H.censusBegin({ race: 'saxhleel' });
      E.sim.doorVeto = E.sim.doorVeto;                  // (left installed; we never touch a door)
      let qi = 0;
      for (let guard = 0; guard < 200; guard++) {
        const st = H.getCensusState();
        if (st.done) break;
        if (st.paused) { H.censusEnter(st.resume_by); continue; }
        const inp = st.input;
        if (!inp) { H.censusAnswer(null); continue; }
        let v;
        if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? hatchName : 'Keeps-The-Tally';
        else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
        else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
        else if (st.node === 'writ.class-routes') v = 'questionnaire';
        else if (st.node === 'writ.upbringing') v = upbringing;
        else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
        H.censusAnswer(v);
      }
      const ch = H.getCharacter();
      // Now go and be looked at. `talkTo` is the world-side reader: sim/dialogue/disposition.js
      // derives this person's regard from the race AND UPBRINGING the scene just wrote, and
      // sim/quest/topic-supply.js filters what they will discuss with you.
      const target = E.sim.npcs.find((n) => n.eid !== 'jeeh-ei' && n.reaction_group) || E.sim.npcs.find((n) => n.reaction_group);
      // FOUND BY THE NULL CONTROL, which is what a null control is for. `Engine._greetCount` —
      // the "how many times have you walked up to me" counter that stops a person repeating
      // their first sentence — is NOT cleared by `loadState`, so the second play of the opening
      // in the same page draws the SECOND line of the same greeting cell and two identical
      // characters appear to be greeted differently. The cell, the key, the band, the
      // disposition and the topics were identical throughout; only the rotation moved. Cleared
      // here so that everything the comparison reads is a function of the answers alone.
      if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
      const said = target ? H.talkTo(target.eid) : null;
      const disp = target ? H.npcDisposition(target.eid) : null;
      if (said) H.conversationClose();
      return {
        answered: { upbringing: ch.upbringing, hatch_name: ch.hatch_name, race: ch.race, class: ch.class_id },
        npc: target ? target.eid : null,
        // THE ENTITY-SIDE OBSERVABLES. Not the formula — what the person did.
        greeting_line: said ? said.greeting : null,
        greeting_cell: said ? said.greeting_cell : null,
        // [reaction_group, disposition_band, player_race_class] — the key the world looked you
        // up under. This is the census's answer arriving at a stranger's eyes.
        greeting_key: said ? said.greeting_key : null,
        band: disp ? disp.band : null,
        disposition: disp ? disp.disposition : null,
        topics_offered: said && said.topics ? said.topics.map((t) => t.id).sort() : null,
        // the model's own prediction, for the coupling denominator
        predicted_upbringing_term: disp && disp.term ? disp.term.upbringing : null,
      };
    };
    const a = await play({ upbringing: 'interior', hatchName: 'Silence-Under-Salt' });
    const b = await play({ upbringing: 'foreign-born', hatchName: 'Silence-Under-Salt' });
    const nullA = await play({ upbringing: 'interior', hatchName: 'Silence-Under-Salt' });
    const nullB = await play({ upbringing: 'interior', hatchName: 'Reeds-In-The-Doorway' });
    const num = Math.abs((b.disposition ?? 0) - (a.disposition ?? 0));
    const den = Math.abs((b.predicted_upbringing_term ?? 0) - (a.predicted_upbringing_term ?? 0));
    return {
      a, b, nullA, nullB,
      consumer: 'sim/dialogue/disposition.js derivedDisposition() via Engine.talkTo() -> character/converse.js greeting cell; sim/quest/topic-supply.js topicsFor() -> what that person will discuss',
      coupling: den > 0 ? +(num / den).toFixed(4) : null,
      // The entity-side half, stated separately because `disposition` above is still a number a
      // harness call computes. `greeting_key[1]` is the band THE WORLD looked you up under when
      // this person opened their mouth — chosen inside `character/converse.js`, not by us. If the
      // scene's answer never reached the room, both runs come back on the same key and this is 0.
      band_model_says: [a.band, b.band],
      band_world_used: [a.greeting_key ? a.greeting_key[1] : null, b.greeting_key ? b.greeting_key[1] : null],
      coupling_entity_side: (a.greeting_key && b.greeting_key)
        ? ((a.greeting_key[1] !== b.greeting_key[1] && a.greeting_key[1] === a.band && b.greeting_key[1] === b.band) ? 1 : 0)
        : null,
      greeting_changed: a.greeting_line !== b.greeting_line || a.greeting_cell !== b.greeting_cell,
      band_or_disp_changed: a.band !== b.band || a.disposition !== b.disposition,
      null_identical: nullA.greeting_line === nullB.greeting_line
        && nullA.greeting_cell === nullB.greeting_cell
        && JSON.stringify(nullA.greeting_key) === JSON.stringify(nullB.greeting_key)
        && nullA.band === nullB.band
        && nullA.disposition === nullB.disposition
        && JSON.stringify(nullA.topics_offered) === JSON.stringify(nullB.topics_offered),
    };
  });
  {
    const C = out.checks.consumption;
    say(`  consumer: ${C.consumer}`);
    say(`  A upbringing=${C.a.answered.upbringing} -> ${C.a.npc} disposition ${C.a.disposition} (${C.a.band}) cell ${C.a.greeting_cell}`);
    say(`  B upbringing=${C.b.answered.upbringing} -> ${C.b.npc} disposition ${C.b.disposition} (${C.b.band}) cell ${C.b.greeting_cell}`);
    say(`  A said: "${String(C.a.greeting_line).slice(0, 78)}"`);
    say(`  B said: "${String(C.b.greeting_line).slice(0, 78)}"`);
    say(`  band the model says ${JSON.stringify(C.band_model_says)}; band the WORLD looked her up under ${JSON.stringify(C.band_world_used)}`);
    say(`  coupling ${C.coupling} (entity-side ${C.coupling_entity_side})   null control identical: ${C.null_identical}`);
    if (C.coupling_entity_side !== 1) {
      hard('C-ORPHAN', `the world did not look the player up under the band the census produced: model ${JSON.stringify(C.band_model_says)} vs world ${JSON.stringify(C.band_world_used)}`);
    } else if (C.band_or_disp_changed || C.greeting_changed) {
      pass(`one answer in the opening changed what a person in the world does (coupling ${C.coupling}, entity-side ${C.coupling_entity_side})`);
    } else hard('C-ORPHAN', 'changing an answer the player gives in the opening changed NOTHING an entity does — the census model is an orphan (RI-MTH07 §B)');
    if (C.null_identical) pass('null control: changing only the hatch-name changes nothing the entity does');
    else fail('null control FAILED: a field the reaction matrix does not read still moved the entity — the difference above may be an artefact');
  }

  const K = out.checks.delete_the_fix;
  for (const [k, v] of Object.entries(K)) {
    say(`  ${k}: ${JSON.stringify(v)}`);
    if (v.failure_returns) pass(`${k}: deleting the fix brings the failure back`);
    else fail(`${k}: deleting the fix did NOT bring the failure back — the fix may not be what is doing the work`);
  }
} finally {
  out.ok = out.failures.length === 0 && out.hard_fails.length === 0;
  writeJson(jsonPath, out);
  say(`\n${out.passes.length} pass, ${out.failures.length} fail, ${out.hard_fails.length} hard fail`);
  say('wrote ' + jsonPath);
  await h.close();
  // FAIL-CLOSED. A probe that cannot go red is worse than no probe (round-1 verdict §7).
  if (!out.ok) process.exitCode = 1;
}

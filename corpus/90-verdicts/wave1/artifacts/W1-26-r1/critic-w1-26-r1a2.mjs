#!/usr/bin/env node
// critic-w1-26-r1a2.mjs — CRITIC's own RI-JRN09 M1 (DTR) over EVERY node of the census graph.
//
// Written by the W1-26 round-1 critic. Declared under `method_deviations`.
//
// WHY IT EXISTS. Both instruments that have measured DTR on this build measured a SUBSET:
//   * tools/harness/w1-26-opening.mjs (the builder's) reached 3 node ids — hold.hatch-name,
//     hold.out, writ.race-observed — and reported DTR_scene 0.9500 over them, saying so.
//   * critic-w1-07-r3a.mjs (the sibling critic's) reached 11 of 20 node ids: it took the
//     questionnaire route only, so writ.class-named, the four writ.class-custom-* pick nodes
//     and writ.birthsign-second were never visited by anyone.
// game/data/dialogue/topics/writ-house.json ships TWENTY nodes. This probe walks all three
// class routes and forces both conditional nodes, so every node id is measured.
//
// TWO DENOMINATORS, side by side, because the choice is the whole argument:
//   D_model : getCensusModel() — `renderer.ui.model`, the object buildCensusModel() handed the
//             surface. This is the layer round 2's defect lived in (buildCensusModel read
//             state.line and never state.question.text), so a DTR over it cannot see a string
//             the model builder dropped. It is the builder's denominator.
//   D_state : getCensusState() — what the CENSUS computed for the node, plus the writ body at
//             the terminating node. RI-JRN09 M1's own list ("the dilemma prose, the
//             interlocutor's line, the mis-recording, the answer set, the writ's body") is a
//             description of this set, not of the model.
//
// TWO DRAW POLICIES:
//   arrival  : the register between entering the node and touching anything — what the player
//              is shown on arrival.
//   scrolled : plus everything painted while the caret is paged through the whole option list
//              with the same closed action set a player has. Strictly more generous; it is the
//              builder's policy and it is defensible ("at that node", not "in one frame").
//
// INSTRUMENT NOTE, stated because an earlier draft of this probe was wrong in exactly this way:
// `UILayer` repaints only when `dirty`, and `getCensusState()` / `censusAnswer()` both call
// `metrics()`, which repaints and clears the flag. A probe that clears the register AFTER
// reading state therefore measures an empty set and reports DTR 0 for a scene that drew
// everything. This version never clears: it takes a WATERMARK on the register before the call
// that repaints, and reads everything appended after it.
//
// USAGE  node tools/harness/critic-w1-26-r1a2.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-26-r1a2.mjs — DTR over all 20 census nodes, 2 denominators, 2 draw policies.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame(args);
const out = { probe: 'critic-w1-26-r1a2', walks: [], node_ids_seen: [], totals: {} };

async function walk(name, opts) {
  const res = await h.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
    const tight = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();
    const blobOf = (entries) => {
      const rows = [...new Set(entries.map((e) => e.text))];
      return { spaced: rows.map(norm).join('  '), tight: rows.map(tight).join('') };
    };
    const uniq = (list) => {
      const seen = new Set(); const r = [];
      for (const x of list) { const k = norm(x.text); if (k && !seen.has(k)) { seen.add(k); r.push(x); } }
      return r;
    };
    const strings = (obj) => {
      const c = [];
      const add = (role, s) => { if (s && String(s).trim()) c.push({ role, text: String(s) }); };
      add('line', obj.line);
      add('preamble', obj.preamble);
      for (const s of (obj.spoken || [])) add('spoken', typeof s === 'string' ? s : (s && s.line));
      add('aside', obj.aside);
      if (obj.record && Array.isArray(obj.record.lines)) for (const l of obj.record.lines) add('record', l);
      if (obj.question && obj.question.text) add('question', obj.question.text);
      for (const op of (obj.options || (obj.input && obj.input.options) || [])) add('option', op.text || op.id);
      if (obj.writ && Array.isArray(obj.writ.lines)) for (const l of obj.writ.lines) add('writ', l);
      return uniq(c);
    };
    // The register is never cleared; `i` is a monotone sequence, so the watermark is a count.
    const regLen = () => H.getRenderedText({}).next_index;
    const since = (mark, inc) => H.getRenderedText({ surface: 'dialogue', includeClipped: !!inc, since: mark });

    await H.setRenderRate(0);
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    let mark = regLen();
    await H.censusBegin({ race: o.race });   // repaints

    const nodes = [];
    let st = H.getCensusState();
    let guard = 0, qi = 0, entered = false;
    while (st && !st.done && guard++ < 80) {
      // --- arrival: everything painted since the call that entered this node.
      const arrivalReg = since(mark, false);
      const blobArrival = blobOf(arrivalReg.entries);
      const model0 = H.getCensusModel() || {};

      // --- scrolled: page the caret through the whole option list, player actions only.
      const optCount = ((model0 && model0.options) || []).length;
      if (optCount > 1) {
        for (let k = 0; k < optCount + 1; k++) {
          H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]);
          H.stepFrames(2);
          H.getUIState();        // repaints when the caret moved the model; no WebGL frame
        }
      }
      const model = H.getCensusModel() || model0;
      const scrollReg = since(mark, false);
      const scrollRegInc = since(mark, true);
      const blobScroll = blobOf(scrollReg.entries);
      const clipped = scrollRegInc.entries.filter((e) => e.clipped).map((e) => e.text);

      const dModel = strings(model);
      const dState = strings(st);
      const score = (set, blobPair) => {
        // `wrap()` in render/ui.js splits prose on whitespace, DROPS the space, and hands each
        // fragment to its own fillText. A substring test over rows joined by a space therefore
        // fails on every wrapped string and would invent undrawn text. The primary test strips
        // ALL whitespace from both sides, which reconstructs a wrapped string exactly; the
        // space-joined test is kept alongside so the difference is visible.
        const miss = set.filter((x) => blobPair.tight.indexOf(tight(x.text)) < 0);
        return {
          computed: set.length, drawn: set.length - miss.length,
          dtr: set.length ? +((set.length - miss.length) / set.length).toFixed(4) : 1,
          missed: miss.map((x) => ({ role: x.role, text: x.text.slice(0, 130) })),
          dtr_space_joined: set.length ? +((set.length - set.filter((x) => blobPair.spaced.indexOf(norm(x.text)) < 0).length) / set.length).toFixed(4) : 1,
        };
      };
      nodes.push({
        node: st.node,
        kind: st.input ? st.input.kind : null,
        question_id: st.question ? st.question.id : null,
        option_count: ((st.input && st.input.options) || []).length,
        register_rows_arrival: arrivalReg.entries.length,
        register_rows_scrolled: scrollReg.entries.length,
        clipped_strings: clipped,
        d_model_scrolled: score(dModel, blobScroll),
        d_state_arrival: score(dState, blobArrival),
        d_state_scrolled: score(dState, blobScroll),
      });

      const inp = st.input;
      mark = regLen();
      if (!inp) { if (!entered) { entered = true; st = await H.censusEnter(); continue; } break; }
      let v;
      if (inp.kind === 'text') v = 'Silence-Under-Salt';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = o.route;
      else if (st.node === 'writ.upbringing') v = o.upbringing || ((inp.options || [])[0] || {}).id;
      else if (st.node === 'writ.birthsign') v = o.birthsign || ((inp.options || [])[0] || {}).id;
      else v = ((inp.options || [])[0] || {}).id;
      if (v === undefined || v === null) break;
      try { st = await H.censusAnswer(v); } catch (e) { nodes.push({ node: st.node, threw: String(e).slice(0, 220) }); break; }
    }

    // --- M8 / RI-JRN09 M2(c): the writ, opened by the input path a player has.
    let writ = null;
    try {
      const api = await H.readWrit();
      const m2 = regLen();
      await H.openWrit();
      H.getUIState();
      const reg = since(m2, false);
      const drawnBlob = blobOf(reg.entries);
      const lines = (api && (api.lines || String(api.text || '').split('\n'))) || [];
      const body = uniq(lines.filter((l) => String(l).trim()).map((l) => ({ role: 'writ', text: l })));
      const missed = body.filter((x) => drawnBlob.tight.indexOf(tight(x.text)) < 0);
      writ = {
        reader_state: await H.getWritReaderState(),
        body_lines: body.length,
        drawn_lines: body.length - missed.length,
        dtr: body.length ? +((body.length - missed.length) / body.length).toFixed(4) : 1,
        undrawn: missed.map((x) => x.text.slice(0, 110)),
        register_rows: reg.entries.length,
        distinct_drawn: [...new Set(reg.entries.map((e) => e.text))],
      };
    } catch (e) { writ = { error: String(e).slice(0, 260) }; }
    return { nodes, writ, done: !!(st && st.done) };
  }, opts);
  res.walk = name; res.opts = opts;
  out.walks.push(res);
  say(`\n== WALK ${name} (${JSON.stringify(opts)}) ==`);
  for (const n of res.nodes) {
    if (n.threw) { say(`  ${String(n.node).padEnd(30)} THREW ${n.threw}`); continue; }
    say(`  ${String(n.node).padEnd(30)} kind=${String(n.kind).padEnd(14)} opts=${String(n.option_count).padStart(2)} ` +
        `rows arr=${String(n.register_rows_arrival).padStart(3)} scr=${String(n.register_rows_scrolled).padStart(3)} | ` +
        `D_state arr=${n.d_state_arrival.dtr} scr=${n.d_state_scrolled.dtr} | D_model=${n.d_model_scrolled.dtr} | clip=${n.clipped_strings.length}`);
    for (const m of n.d_state_scrolled.missed) say(`      -- UNDRAWN even scrolled [${m.role}] "${m.text.slice(0, 105)}"`);
  }
  if (res.writ) say(`  writ reader: ${res.writ.drawn_lines}/${res.writ.body_lines} body lines drawn, DTR ${res.writ.dtr}` + (res.writ.error ? ` ERROR ${res.writ.error}` : ''));
  return res;
}

try {
  await walk('A-questionnaire', { race: 'saxhleel', upbringing: 'foreign-born', route: 'questionnaire', birthsign: 'kaal-kaal' });
  await walk('B-named', { race: 'dunmer', upbringing: 'interior', route: 'named', birthsign: null });
  await walk('C-custom', { race: 'khajiit', upbringing: 'blackrose', route: 'custom', birthsign: null });

  const byId = new Map();
  for (const w of out.walks) for (const n of w.nodes) {
    if (n.threw) continue;
    const key = n.node + (n.question_id ? '#' + n.question_id : '');
    if (!byId.has(key)) byId.set(key, n);
  }
  out.node_ids_seen = [...new Set([...byId.keys()].map((k) => k.split('#')[0]))].sort();
  const rows = [...byId.values()];
  const agg = (pick) => {
    const c = rows.reduce((a, n) => a + pick(n).computed, 0);
    const d = rows.reduce((a, n) => a + pick(n).drawn, 0);
    const q = rows.filter((n) => n.kind === 'questionnaire');
    const qc = q.reduce((a, n) => a + pick(n).computed, 0), qd = q.reduce((a, n) => a + pick(n).drawn, 0);
    let worst = { dtr: 2, node: null };
    for (const n of rows) if (pick(n).dtr < worst.dtr) worst = { dtr: pick(n).dtr, node: n.node };
    const below = rows.filter((n) => pick(n).dtr < 0.5).map((n) => ({ node: n.node, dtr: pick(n).dtr }));
    return { scene: c ? +(d / c).toFixed(4) : 0, q: qc ? +(qd / qc).toFixed(4) : 1, computed: c, drawn: d, worst, below_half: below };
  };
  out.totals = {
    node_ids_measured: out.node_ids_seen.length,
    node_visits: rows.length,
    d_state_arrival: agg((n) => n.d_state_arrival),
    d_state_scrolled: agg((n) => n.d_state_scrolled),
    d_model_scrolled: agg((n) => n.d_model_scrolled),
    total_clipped: rows.reduce((a, n) => a + n.clipped_strings.length, 0),
  };
  say('\n===== TOTALS over ' + out.node_ids_seen.length + ' distinct node ids, ' + rows.length + ' node visits =====');
  for (const k of ['d_state_arrival', 'd_state_scrolled', 'd_model_scrolled']) {
    const t = out.totals[k];
    say(`  ${k.padEnd(18)} DTR_scene ${t.scene}  DTR_q ${t.q}  worst ${t.worst.dtr} @ ${t.worst.node}  (${t.drawn}/${t.computed})  below-0.50 nodes: ${t.below_half.length}`);
    for (const b of t.below_half) say(`        HF1 candidate: ${b.node} = ${b.dtr}`);
  }
  say(`  node ids seen (${out.node_ids_seen.length}): ${out.node_ids_seen.join(', ')}`);
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}

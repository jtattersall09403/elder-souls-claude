#!/usr/bin/env node
// critic-w1-26-r1a.mjs — CRITIC's own RI-JRN09 M1 (DTR) over EVERY node of the census graph.
//
// Written by the W1-26 round-1 critic. Declared under `method_deviations`.
//
// WHY IT EXISTS. Both instruments that have measured DTR on this build measured a SUBSET:
//   * tools/harness/w1-26-opening.mjs (the builder's) reached 3 node ids — hold.hatch-name,
//     hold.out, writ.race-observed — and reported DTR_scene 0.9500 over them, saying so.
//   * critic-w1-07-r3a.mjs (the sibling critic's) reached 11 of 20 node ids: it took the
//     questionnaire route only, so writ.class-named and the four writ.class-custom-* pick
//     nodes and writ.birthsign-second were never visited by anyone.
// game/data/dialogue/topics/writ-house.json ships TWENTY nodes. This probe walks all three
// class routes and forces the two conditional nodes, so every node id is measured.
//
// THREE DENOMINATORS, reported side by side, because the choice is the whole argument:
//   D_model : getCensusModel()  — `renderer.ui.model`, the object buildCensusModel() handed
//             the surface. This is the layer round 2's defect lived in (buildCensusModel read
//             state.line and never state.question.text), so a DTR over it cannot see a string
//             the model builder dropped and is 1.0 by construction whenever the renderer draws
//             what it was handed. It is the builder's denominator.
//   D_state : getCensusState() — what the CENSUS computed for that node. RI-JRN09 M1's list
//             ("the dilemma prose, the interlocutor's line, the mis-recording, the answer set,
//             the writ's body") is a description of this set.
//   D_writ  : D_state + readWrit().lines at the terminating node.
//
// TWO DRAW POLICIES, also side by side:
//   one_frame : the register after a single renderFrame() — what is on screen at once.
//   scrolled  : the register after paging the caret through the whole option list with the
//               same closed action set a player has. This is the builder's policy and it is
//               defensible ("at that node", not "in one frame"), but it is strictly more
//               generous and a player who does not scroll never sees the difference.
//
// USAGE  node tools/harness/critic-w1-26-r1a.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-26-r1a.mjs — DTR over all 20 census nodes, 3 denominators, 2 draw policies.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame(args);
const out = { probe: 'critic-w1-26-r1a', build_sha: process.env.ES_SHA || null, walks: [], node_ids_seen: [], totals: {} };

/** One walk of the scene. `route` picks the class route; `race`/`upbringing` force conditionals. */
async function walk(name, opts) {
  const res = await h.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
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
      const optSrc = obj.options || (obj.input && obj.input.options) || [];
      for (const op of optSrc) add('option', op.text || op.id);
      if (obj.writ && Array.isArray(obj.writ.lines)) for (const l of obj.writ.lines) add('writ', l);
      return uniq(c);
    };

    await H.setSeed(1337);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: o.race });

    const nodes = [];
    let st = H.getCensusState();
    let guard = 0, qi = 0, entered = false;
    while (st && !st.done && guard++ < 80) {
      // --- one_frame: clear, draw once, read the register.
      H.renderedTextClear();
      H.renderFrame();
      const model0 = H.getCensusModel() || {};
      const regOne = H.getRenderedText({ surface: 'dialogue' });
      const regOneAll = H.getRenderedText({ surface: 'dialogue', includeClipped: true });
      const blobOne = (regOne.distinct || []).map(norm).join('  ');

      // --- scrolled: page the caret through the whole list with the player's own actions.
      const optCount = ((model0 && model0.options) || []).length;
      if (optCount > 1) {
        for (let k = 0; k < optCount + 1; k++) {
          H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]);
          H.stepFrames(2);
          H.renderFrame();
        }
      }
      const model = H.getCensusModel() || model0;
      const regAll = H.getRenderedText({ surface: 'dialogue' });
      const regAllInc = H.getRenderedText({ surface: 'dialogue', includeClipped: true });
      const blobScroll = (regAll.distinct || []).map(norm).join('  ');
      const clipped = (regAllInc.entries || []).filter((e) => e.clipped).map((e) => e.text);

      const dModel = strings(model);
      const dState = strings(st);
      const score = (set, blob) => {
        const miss = set.filter((x) => blob.indexOf(norm(x.text)) < 0);
        return {
          computed: set.length,
          drawn: set.length - miss.length,
          dtr: set.length ? +((set.length - miss.length) / set.length).toFixed(4) : 1,
          missed: miss.map((x) => ({ role: x.role, text: x.text.slice(0, 120) })),
        };
      };
      nodes.push({
        node: st.node,
        kind: st.input ? st.input.kind : null,
        question_id: st.question ? st.question.id : null,
        option_count: ((st.input && st.input.options) || []).length,
        register_rows_one: (regOne.entries || []).length,
        register_rows_scrolled: (regAll.entries || []).length,
        clipped_strings: clipped,
        d_model_scrolled: score(dModel, blobScroll),
        d_state_one: score(dState, blobOne),
        d_state_scrolled: score(dState, blobScroll),
      });

      const inp = st.input;
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
      try { st = await H.censusAnswer(v); } catch (e) { nodes.push({ node: st.node, threw: String(e).slice(0, 200) }); break; }
    }
    return { nodes, done: !!(st && st.done) };
  }, opts);
  res.walk = name;
  res.opts = opts;
  out.walks.push(res);
  say(`\n== WALK ${name} (${JSON.stringify(opts)}) ==`);
  for (const n of res.nodes) {
    if (n.threw) { say(`  ${String(n.node).padEnd(30)} THREW ${n.threw}`); continue; }
    say(`  ${String(n.node).padEnd(30)} kind=${String(n.kind).padEnd(14)} opts=${String(n.option_count).padStart(2)} ` +
        `D_state one=${n.d_state_one.dtr} scrolled=${n.d_state_scrolled.dtr} D_model=${n.d_model_scrolled.dtr} clip=${n.clipped_strings.length}`);
    for (const m of n.d_state_scrolled.missed) say(`      -- undrawn even scrolled [${m.role}] "${m.text.slice(0, 95)}"`);
  }
  return res;
}

try {
  await walk('A-questionnaire', { race: 'saxhleel', upbringing: 'foreign-born', route: 'questionnaire', birthsign: 'kaal-kaal' });
  await walk('B-named', { race: 'dunmer', upbringing: 'interior', route: 'named', birthsign: null });
  await walk('C-custom', { race: 'khajiit', upbringing: 'blackrose', route: 'custom', birthsign: null });

  // --- aggregate over DISTINCT node ids, weighted by string count (RI-JRN09 M1's rule).
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
    return { scene: c ? +(d / c).toFixed(4) : 0, q: qc ? +(qd / qc).toFixed(4) : 1, computed: c, drawn: d, worst };
  };
  out.totals = {
    node_ids_measured: out.node_ids_seen.length,
    node_visits: rows.length,
    d_state_one_frame: agg((n) => n.d_state_one),
    d_state_scrolled: agg((n) => n.d_state_scrolled),
    d_model_scrolled: agg((n) => n.d_model_scrolled),
    total_clipped: rows.reduce((a, n) => a + n.clipped_strings.length, 0),
  };
  say('\n===== TOTALS over ' + out.node_ids_seen.length + ' distinct node ids, ' + rows.length + ' node visits =====');
  for (const k of ['d_state_one_frame', 'd_state_scrolled', 'd_model_scrolled']) {
    const t = out.totals[k];
    say(`  ${k.padEnd(20)} DTR_scene ${t.scene}  DTR_q ${t.q}  worst ${t.worst.dtr} @ ${t.worst.node}  (${t.drawn}/${t.computed})`);
  }
  say(`  nodes seen: ${out.node_ids_seen.join(', ')}`);
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}

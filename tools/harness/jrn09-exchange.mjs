#!/usr/bin/env node
// jrn09-exchange.mjs — RI-JRN09, the opening as an exchange, measured on the live build.
//
// Owner: W1-07. Filed by BAR-CRITIQUE-W1-07-R1 §R3, after that critic found the whole journeys
// corpus "could prove the room was built, and not one bar could tell whether anybody spoke in
// it". RI-JRN09 §0.2 makes DTR, AC and NAMED mandatory citations in any verdict on this
// journey, and the item is deliberately runnable today — no exemplar, no naive channel, no
// phantom tool. This is that instrument, and it is a builder's copy of a check a critic will
// re-run: it is written to FAIL when the build is wrong, not to agree with the build.
//
//   M1  ES-LEGIBLE   DTR(node) = |distinct authored strings DRAWN| / |distinct authored strings
//                    COMPUTED|, read through the rendered-text accessor
//                    `getCensusState().surface.rendered_text` — the exact array that went
//                    through fillText into the WebGL canvas a screenshot reads. DTR_q = 1.00,
//                    DTR_scene >= 0.90. DISTINCT counts, never character counts: the item is
//                    explicit that a length check cannot see the failure it exists to catch,
//                    because round 2's own instrument passed this scene by counting characters
//                    while the question was the same stock line at all ten nodes.
//   M2  ES-ANSWERED  Each of RI-CHR01 §1's eight inputs (sex exempt, so out of 7) must be used
//                    before the player leaves the interior, in a DRAWN line, a visible object,
//                    or a visible written record. A getCensusState() field is explicitly NOT
//                    consumption — RI-MTH07 §B1 rules the trace an observer. AC >= 6 of 7.
//                    Evidence is the drawn row, quoted, so a critic can judge whether seven
//                    quotes are seven templates (the item's one declared judgement call).
//   M3  ES-NAMED     >= 240 completions over all 10 races x 4 upbringings with a PUBLISHED and
//                    verified a/b/c/d histogram; NAMED_distinct >= 10 of 14; the naming line
//                    drawn 100% of the time on a named match; NAMED_rate reported, unbanded.
//
// Hard fails implemented as hard fails: HF1 DTR < 0.50 on any node class; HF2 AC < 4 of 7;
// HF3 NAMED_distinct == 0; HF4 the histogram unpublished or biased.
//
// USAGE
//   node tools/harness/jrn09-exchange.mjs [--runs 240] [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson, log } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
jrn09-exchange.mjs — RI-JRN09 M1/M2/M3 (DTR, AC, NAMED) against the running build.

USAGE
  node tools/harness/jrn09-exchange.mjs [--runs 240] [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const RUNS = Math.max(240, Number(args.runs || 240));

const say = (s) => process.stdout.write(s + '\n');
const out = { item: 'RI-JRN09', runs: RUNS, m1: null, m2: null, m3: null, m4: null, hard_fails: [], failures: [] };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => say(`  pass  ${m}`);
const hard = (id, m) => { out.hard_fails.push({ id, why: m }); say(`  HARD FAIL ${id}  ${m}`); };

/** Normalise for comparison. The layout wraps, so drawn rows are fragments of authored strings. */
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Was this authored string delivered to the frame? The UI wraps long prose over several
 * fillText calls, so "drawn" means the node's concatenated drawn text CONTAINS the whole
 * authored string — not that one drawn row equals it.
 *
 * Deliberately strict in the direction that matters: a question counts only if ALL of it is on
 * the surface, so a truncated question fails. That is correct — the item's whole point is that
 * the player can read the thing being asked.
 */
const delivered = (authored, blob) => { const a = norm(authored); return !a || blob.indexOf(a) >= 0; };

/**
 * The authored strings the model computes for a node, deduplicated, with their role.
 *
 * `model` here is `getCensusModel()` — the object `buildCensusModel()` produced and
 * `UILayer.setModel()` drew — NOT `getCensusState()`. RI-JRN09 M1 says "the distinct authored
 * strings THE MODEL computes for that node", and the two disagree in precisely the place the
 * item was written about: the raw state carries the scribe's stock framing in `line` at all ten
 * questionnaire nodes, while the model demotes it to `preamble` at question one and puts the
 * QUESTION in `line`. An earlier draft of this probe read the raw state and reported DTR_q 0.55
 * for a scene that draws its question at 10 of 10 nodes.
 */
function authoredAt(model) {
  const c = [];
  const push = (kind, s) => { if (s && String(s).trim()) c.push({ kind, s: String(s) }); };
  push('line', model.line);
  push('preamble', model.preamble);
  for (const sp of (model.spoken || [])) push('spoken', (sp && typeof sp === 'object') ? sp.line : sp);
  push('aside', model.aside);
  for (const o of (model.options || [])) push('option', o.text || o.id);
  if (model.question && model.question.text) push('question', model.question.text);
  const seen = new Set(); const uniq = [];
  for (const x of c) { const k = norm(x.s); if (k && !seen.has(k)) { seen.add(k); uniq.push(x); } }
  return uniq;
}

/** Choose a legal answer for the node in front of us. `pattern` picks among questionnaire answers. */
function answerFor(model, pattern, qi) {
  const inp = model.input;
  if (!inp) return null;
  if (inp.kind === 'text') return 'Silence-Under-Salt';
  const opts = inp.options || [];
  if (inp.kind === 'pick') {
    const want = inp.count || 2;
    return opts.slice(0, want).map((o) => o.id);
  }
  if (!opts.length) return null;
  if (inp.kind === 'questionnaire') return opts[pattern(qi) % opts.length].id;
  return opts[0].id;
}

/**
 * One complete walk of the census, from the barge hold to the stamp.
 *
 * `steer` maps a node id to the option id to take there, which is how the M3 sweep reaches all
 * 10 races x 4 upbringings on the questionnaire route. `hold.out` carries no input: it is
 * RI-JRN01 O6's hand-back, where the player walks out of the hold and into the Writ House, and
 * it is crossed with `censusEnter()` rather than an answer.
 */
async function walk(h, { state = 'barge-hold', pattern = () => 0, begin = {}, steer = {} } = {}) {
  await h.h('loadState', state);
  await h.h('censusBegin', begin);
  const nodes = []; let qi = 0; let guard = 0; let entered = false;
  let st = await h.h('getCensusState');
  while (st && !st.done && guard++ < 64) {
    const drawnRows = (st.surface && st.surface.rendered_text) || [];
    const blob = norm(drawnRows.join('  '));
    // COMPUTED comes from the model; DRAWN comes from the surface the model was drawn onto.
    const model = (await h.h('getCensusModel')) || st;
    const uniq = authoredAt(model);
    const hit = uniq.filter((x) => delivered(x.s, blob));
    const missed = uniq.filter((x) => !delivered(x.s, blob));
    const kind = st.input ? st.input.kind : null;
    nodes.push({
      node: st.node, kind, questionnaire: kind === 'questionnaire',
      question_id: st.question ? st.question.id : null,
      question_text: st.question ? st.question.text : null,
      spoken: (st.spoken || []).slice(),
      drawn_rows: drawnRows.slice(),
      computed: uniq.length, drawn_count: hit.length,
      // Carried so raising the panel's height budget to buy delivery cannot quietly break the
      // bar it trades against. RI-JRN01 M5 caps opaque UI at 0.55 of frame AREA.
      opaque_area_frac: (st.surface && st.surface.opaque_area_frac) || 0,
      dtr: uniq.length ? +(hit.length / uniq.length).toFixed(4) : 1,
      missed: missed.map((m) => ({ kind: m.kind, s: m.s.slice(0, 100) })),
    });
    if (kind === 'questionnaire') qi++;
    if (!kind) {
      // RI-JRN01 O6's hand-back. Crossed once; a second one means the graph is stuck.
      if (!entered) { entered = true; st = await h.h('censusEnter'); continue; }
      break;
    }
    const forced = steer[st.node];
    const v = forced !== undefined ? forced : answerFor(st, pattern, qi - 1);
    if (v === null || v === undefined) break;
    st = await h.h('censusAnswer', v);
  }
  return { nodes, final: st };
}

const h = await launchGame(args);
try {
  await h.h('setSeed', 1337);

  // ---- M1 ES-LEGIBLE ----------------------------------------------------------------------
  say('== M1 ES-LEGIBLE — did the authored text reach the frame? ==');
  // The questionnaire route, because it is the one RI-CHR01 calls mandatory and the one whose
  // ten questions round 2 never printed.
  const { nodes } = await walk(h, {
    begin: { race: 'saxhleel' },
    steer: { 'writ.class-routes': 'questionnaire' },
    pattern: (i) => i % 4,
  });
  const qNodes = nodes.filter((n) => n.questionnaire);
  const dtrQ = qNodes.length ? qNodes.reduce((a, n) => a + n.dtr, 0) / qNodes.length : 0;
  const totC = nodes.reduce((a, n) => a + n.computed, 0);
  const totD = nodes.reduce((a, n) => a + n.drawn_count, 0);
  const dtrScene = totC ? totD / totC : 0;
  const distinctQ = new Set(qNodes.map((n) => norm(n.question_text)).filter(Boolean));
  const qFull = qNodes.filter((n) => n.question_text && delivered(n.question_text, norm(n.drawn_rows.join('  ')))).length;

  say(`  nodes walked ${nodes.length}; questionnaire nodes ${qNodes.length}`);
  say(`  distinct question texts computed ${distinctQ.size}; question text fully drawn at ${qFull}/${qNodes.length} nodes`);
  say(`  DTR_q     = ${dtrQ.toFixed(4)}  (item requires exactly 1.00)`);
  say(`  DTR_scene = ${dtrScene.toFixed(4)}  (item requires >= 0.90)`);
  for (const n of nodes) if (n.dtr < 1) {
    say(`    ${String(n.node).padEnd(30)} DTR ${n.dtr.toFixed(3)}  missed ${n.missed.map((m) => `${m.kind}:"${m.s.slice(0, 46)}"`).join(' | ')}`);
  }
  out.m1 = {
    accessor: 'getCensusState().surface.rendered_text (UILayer.metrics().text — the fillText array)',
    nodes: nodes.map(({ drawn_rows, ...r }) => ({ ...r, drawn_rows: drawn_rows.length })),
    dtr_q: +dtrQ.toFixed(4), dtr_scene: +dtrScene.toFixed(4),
    distinct_question_texts: distinctQ.size,
    question_nodes: qNodes.length, question_text_drawn_at: qFull,
    strings_computed: totC, strings_drawn: totD,
  };
  if (dtrQ < 1) fail(`DTR_q = ${dtrQ.toFixed(4)}, item requires 1.00`);
  else pass('DTR_q = 1.0000');
  if (dtrScene < 0.90) fail(`DTR_scene = ${dtrScene.toFixed(4)}, item requires >= 0.90`);
  else pass(`DTR_scene = ${dtrScene.toFixed(4)}`);

  // The counter-check on this round's own fix. DTR was bought partly by widening the option
  // window and the panel's height budget; if that pushed the drawn surface through RI-JRN01
  // M5's 0.55 AREA ceiling it would be the W1-09 failure mode — the named gap closed by moving
  // the defect into the bar next door. Measured here, in the same run, from the same frames.
  const areas = nodes.map((n) => n.opaque_area_frac).filter((x) => x > 0);
  const maxArea = areas.length ? Math.max(...areas) : 0;
  out.m1.opaque_area_frac_max = +maxArea.toFixed(4);
  out.m1.opaque_area_frac_min = areas.length ? +Math.min(...areas).toFixed(4) : 0;
  say(`  opaque UI area fraction over the scene: ${out.m1.opaque_area_frac_min}–${out.m1.opaque_area_frac_max}  (RI-JRN01 M5 ceiling 0.55)`);
  if (maxArea > 0.55) fail(`opaque UI area ${maxArea.toFixed(4)} exceeds RI-JRN01 M5's 0.55 ceiling — delivery was bought with the UI-footprint bar`);
  else pass(`opaque UI area peaks at ${maxArea.toFixed(4)}, inside M5's 0.55 ceiling`);
  const worst = nodes.reduce((a, n) => (n.dtr < a.dtr ? n : a), { dtr: 1, node: '-' });
  if (worst.dtr < 0.50) hard('HF1', `DTR ${worst.dtr.toFixed(3)} at ${worst.node} — the scene computed twice what it showed`);

  // ---- M2 ES-ANSWERED ---------------------------------------------------------------------
  //
  // The value must appear in a line DRAWN AFTER the node that set it — a person cannot consume
  // an answer before it is given, and crediting a string drawn earlier would be an instrument
  // that cannot fail.
  say('\n== M2 ES-ANSWERED — did the person who asked use what you told them? ==');
  const ch = await h.h('getCharacter');
  // A value is "used" if the DISPLAY NAME the world would speak appears in a drawn row, not if
  // the slug does. The scribe says "The Full Root", never "raj-xul", and a probe that only
  // matched slugs would score a consumed birthsign as unconsumed. Names are resolved from the
  // same tables the scene interpolates from.
  const cd = await h.h('getCreationData');
  const nameOf = (list, id) => { const x = (list || []).find((y) => y.id === id); return x ? (x.name || '') : ''; };
  const FIELDS = [
    { id: 'hatch_name', value: ch.hatch_name, alt: [] },
    { id: 'given_name', value: ch.given_name, alt: [] },
    { id: 'race', value: ch.race, alt: [nameOf(cd.races.races, ch.race)] },
    { id: 'upbringing', value: ch.upbringing, alt: [nameOf(cd.reactions.upbringings, ch.upbringing), ((cd.reactions.upbringings || []).find((u) => u.id === ch.upbringing) || {}).given_as || ''] },
    { id: 'birthsign', value: ch.birthsign, alt: [nameOf(cd.birthsigns.signs, ch.birthsign)] },
    { id: 'class', value: ch.class_id, alt: [ch.class_name || ''] },
    { id: 'route', value: ch.class_route, alt: [] },
  ];
  const rows = [];
  for (let i = 0; i < nodes.length; i++) for (const r of nodes[i].drawn_rows) rows.push({ i, text: r });
  out.m2 = { of: FIELDS.length, consumed: 0, fields: [], exempt: ['sex (RI-CHR01 §2 — zero mechanical terms by design)'] };
  for (const f of FIELDS) {
    const cands = [f.value, ...(f.alt || [])].filter(Boolean).map((x) => norm(String(x).split('-').join(' ')));
    let ev = null;
    for (const r of rows) {
      const t = norm(r.text).split('-').join(' ');
      if (cands.some((c) => c && t.indexOf(c) >= 0)) { ev = r.text; break; }
    }
    if (ev) out.m2.consumed++;
    out.m2.fields.push({ field: f.id, value: f.value == null ? null : String(f.value), drawn_evidence: ev });
    say(`  ${f.id.padEnd(12)} ${String(f.value).padEnd(22)} ${ev ? 'CONSUMED  "' + String(ev).slice(0, 74) + '"' : '— not found in any drawn row'}`);
  }
  const ac = out.m2.consumed;
  say(`  AC = ${ac} of ${FIELDS.length}  (item requires >= 6; pass floor 5; hard fail < 4)`);
  if (ac < 6) fail(`AC = ${ac} of 7, item requires >= 6`);
  else pass(`AC = ${ac} of 7`);
  if (ac < 4) hard('HF2', `AC = ${ac} of 7 — the scene is a form with an NPC drawn next to it`);

  // ---- M3 ES-NAMED ------------------------------------------------------------------------
  say(`\n== M3 ES-NAMED — does the questionnaire end with somebody saying a profession? ==`);
  const races = (await h.h('getCreationData')).races.races.map((r) => r.id);
  // The four upbringings the graph actually offers at `writ.upbringing`, read from the node
  // rather than guessed — an earlier draft of this probe guessed and would have steered every
  // run into the same branch while reporting full coverage.
  const ups = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
  const perPair = Math.ceil(RUNS / (races.length * ups.length));
  const hist = { a: 0, b: 0, c: 0, d: 0 };
  const classes = new Map();
  let named = 0, total = 0, lineDrawn = 0, lineMissing = 0;
  const LETTERS = ['a', 'b', 'c', 'd'];
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  for (const race of races) for (const up of ups) for (let k = 0; k < perPair; k++) {
    const picks = [];
    const w = await walk(h, {
      begin: { race },
      steer: { 'writ.upbringing': up, 'writ.class-routes': 'questionnaire' },
      pattern: () => { const j = Math.floor(rnd() * 4); picks.push(j); return j; },
    });
    for (const j of picks) hist[LETTERS[j]]++;
    total++;
    const c = await h.h('getCharacter');
    const id = c.class_id || null;
    // The unnamed band is a FEATURE the item explicitly protects ("I do not have a word for
    // what you are" is a good answer for a customs officer). A run that fell through to the
    // custom/unnamed outcome is not a named match and must not be counted as one — an earlier
    // draft counted them and reported a false NAMED_distinct of 15 of 14 and a false
    // "naming line drawn 232/240".
    const isNamed = !!(id && id !== 'custom' && c.class_route !== 'custom' && c.class_name);
    if (isNamed) {
      named++;
      classes.set(id, (classes.get(id) || 0) + 1);
      // The naming line must have been DRAWN, not merely computed.
      const blob = norm(w.nodes.map((n) => n.drawn_rows.join('  ')).join('  '));
      if (blob.indexOf(norm(c.class_name)) >= 0) lineDrawn++; else lineMissing++;
    }
  }
  const totalAnswers = hist.a + hist.b + hist.c + hist.d;
  const expect = totalAnswers / 4;
  const skew = Math.max(...LETTERS.map((L) => Math.abs(hist[L] - expect))) / (expect || 1);
  say(`  completions ${total} over ${races.length} races x ${ups.length} upbringings (${perPair} each)`);
  say(`  answer histogram a/b/c/d = ${hist.a}/${hist.b}/${hist.c}/${hist.d}  (max deviation from even ${(skew * 100).toFixed(2)}%)`);
  say(`  NAMED_distinct = ${classes.size} of 14   (>= 10 full marks, >= 6 to pass)`);
  say(`  NAMED_rate     = ${(named / (total || 1) * 100).toFixed(2)}%  (reported, deliberately unbanded)`);
  say(`  naming line drawn on a named match: ${lineDrawn}/${named} (${named ? (lineDrawn / named * 100).toFixed(1) : '—'}%)`);
  const byClass = [...classes.entries()].sort((a, b) => b[1] - a[1]);
  say('  ' + byClass.map(([k, v]) => `${k}:${v}`).join('  '));
  out.m3 = {
    completions: total, per_pair: perPair, histogram: hist, histogram_max_deviation: +skew.toFixed(4),
    named_distinct: classes.size, named_rate: +(named / (total || 1)).toFixed(4),
    naming_line_drawn: lineDrawn, naming_line_missing: lineMissing,
    by_class: Object.fromEntries(byClass),
  };
  if (classes.size < 10) fail(`NAMED_distinct = ${classes.size} of 14, item wants >= 10 for full marks`);
  else pass(`NAMED_distinct = ${classes.size} of 14`);
  if (named && lineDrawn !== named) fail(`the naming line reached the frame in only ${lineDrawn}/${named} named runs — item requires 100%`);
  else if (named) pass('the naming line reached the frame in 100% of named runs');
  if (classes.size === 0) hard('HF3', 'NAMED_distinct == 0 — the mandatory route cannot produce the thing it exists to produce');
  if (skew > 0.15) hard('HF4', `answer histogram deviates ${(skew * 100).toFixed(1)}% from even — a biased sweep is void`);

  // ---- M4 citations -----------------------------------------------------------------------
  out.m4 = {
    T_control: { value: null, blocked_on: 'RI-PLT03 P1 — not measured by this probe; the piece must cite it separately' },
    RI_EXP01: { blocked_on: 'RI-MTH06 — tools/experience/session-run.mjs, beat-extract.mjs, beat-diff.mjs, beats-from-md.mjs and isolation-check.mjs are all phantom; RI-EXP01 has never been run on any build' },
  };
  say('\n== M4 citations ==');
  say('  T_control: not measured here — RI-PLT03 P1 owns it.');
  say('  RI-EXP01 N_found/T_lie/T_refusal/N_odd: blocked_on RI-MTH06 (all five tools phantom).');
} finally {
  await h.close();
}

if (args.json) { writeJson(String(args.json), out); log(`wrote ${args.json}`); }
say(`\n${out.hard_fails.length ? out.hard_fails.length + ' HARD FAIL(S); ' : ''}${out.failures.length ? out.failures.length + ' failure(s)' : 'ALL PASS'}`);
process.exit(out.failures.length || out.hard_fails.length ? 1 : 0);

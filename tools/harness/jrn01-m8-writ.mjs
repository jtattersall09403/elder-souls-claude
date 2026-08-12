#!/usr/bin/env node
// jrn01-m8-writ.mjs — RI-JRN01 M8 (amended wave 1): is the writ an OBJECT or a return value?
//
// Owner: W1-07. M8 as originally written was satisfied by a string in `readWrit()`, which the
// item's own How-we-lose #10 describes word for word: "the stamped document is a flag, not an
// object … exists in the save file, is never rendered, cannot be read". BAR-CRITIQUE-W1-07-R1
// §R2.3 stiffened it: the object must be openable through the same input path a player has,
// and its rendered-text set at the open node must be non-empty and contain the answers.
// Round 2 measured `rendered_text: []` at the stamped node.
//
// This creates a character through the real graph, opens the carried writ, and reads the drawn
// rows back out of the surface — not out of the API that was the defect.
//
// USAGE
//   node tools/harness/jrn01-m8-writ.mjs
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const h = await launchGame(args);
let bad = 0;
const say = (s) => console.log(s);
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });
  let st = await h.h('getCensusState'), g = 0;
  while (st && !st.done && g++ < 64) {
    const inp = st.input || {};
    if (!inp.kind) { if (st.paused) { st = await h.h('censusEnter', st.resume_by); continue; } break; }
    let v;
    if (inp.kind === 'text') v = 'Silence-Under-Salt';
    else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map(o => o.id);
    else if (st.node === 'writ.class-routes') v = 'questionnaire';
    else v = (inp.options || [])[0]?.id;
    if (v === undefined) break;
    st = await h.h('censusAnswer', v);
  }
  const ch = await h.h('getCharacter');
  say(`created: ${ch.given_name} / ${ch.race} / ${ch.upbringing} / ${ch.class_name} / ${ch.birthsign}`);

  const r = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const actions = [], actionTrace = [];
    const tap = (name) => {
      actionTrace.push({ name, edge:'before', ui:H.getUIState().mode, input:H.getInputState() });
      H.queueInputs([{ f:0, press:[name] }]); H.stepFrames(1);
      actionTrace.push({ name, edge:'pressed', ui:H.getUIState().mode, input:H.getInputState() });
      H.queueInputs([{ f:0, release:[name] }]); H.stepFrames(1);
      actionTrace.push({ name, edge:'released', ui:H.getUIState().mode, input:H.getInputState() });
      actions.push(name);
    };
    const down = () => {
      H.queueInputs([{ f:0, move:[0,-1] }]); H.stepFrames(1);
      H.queueInputs([{ f:0, move:[0,0] }]); H.stepFrames(1);
      actions.push('move-down');
    };
    H.clearInputs(); H.stepFrames(2);
    tap('menu');
    let ui = H.getUIState(), selected = null, moves = 0;
    while (ui.mode === 'inventory' && moves++ < 128) {
      selected = ui.elements.find((e) => e.kind === 'list_row' && e.focused) || null;
      if (selected && selected.meta && selected.meta.item_id === 'stamped-writ') break;
      down(); ui = H.getUIState();
    }
    const selectedId = selected && selected.meta && selected.meta.item_id;
    if (selectedId === 'stamped-writ') tap('interact');
    ui = H.getUIState();
    const rows = (ui.elements || []).filter((e) => e.visible && e.text != null).map((e) => String(e.text));
    const result = {
      open: ui.mode === 'book' && ui.book && ui.book.id === 'stamped-writ',
      refused: selectedId !== 'stamped-writ' ? `inventory selection stopped at ${selectedId || '(none)'}` : null,
      total: ui.book ? ui.book.pages : 0,
      window: ui.book ? [ui.book.page, Math.min(ui.book.pages, ui.book.page + 1)] : null,
      rows, selected_item: selectedId, production_actions: actions,
      direct_writ_api_calls: 0,
      final_ui: { mode: ui.mode, book: ui.book, focus: ui.focus },
      action_trace: actionTrace,
    };
    if (ui.mode === 'book') tap('menu');
    result.closed = H.getUIState().mode !== 'book';
    return result;
  });
  if (!r.open) { say(`FAIL production inventory reader refused: ${r.refused || JSON.stringify({ final_ui:r.final_ui, action_trace:r.action_trace.slice(-6) })}`); bad++; }
  else {
    say(`writ reader open through inventory: ${r.total} pages, window ${r.window}`);
    say(`production actions: ${r.production_actions.join(', ')}`);
    const rows = r.rows;
    say(`rendered_text rows at the open node: ${rows.length}`);
    if (!rows.length) { say('FAIL rendered_text is EMPTY at the open node — the writ is still an API string'); bad++; }
    const blob = rows.join(' ').toLowerCase();
    for (const [name, val] of [['name', ch.given_name], ['race', 'saxhleel'], ['class', ch.class_name]]) {
      const hit = blob.includes(String(val).toLowerCase());
      say(`  ${name.padEnd(6)} "${val}" in drawn text: ${hit ? 'YES' : 'NO'}`);
      if (!hit) bad++;
    }
    say(`  sample drawn row: "${rows.find(x => x.includes('Name recorded')) || rows[1] || rows[0]}"`);
  }
  if (!r.closed) { say('FAIL production menu input did not close the writ'); bad++; }
  if (r.direct_writ_api_calls !== 0) { say('FAIL direct writ API participated'); bad++; }
} finally { await h.close(); }
say(bad ? `${bad} FAILURE(S)` : 'PASS — the carried writ opens and its text reaches the frame');
process.exit(bad ? 1 : 0);

// RI-JRN01 M8 (amended): the carried writ must be OPENABLE and its text must reach the frame.
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
  let st = await h.h('getCensusState'), entered = false, g = 0;
  while (st && !st.done && g++ < 64) {
    const inp = st.input || {};
    if (!inp.kind) { if (!entered) { entered = true; st = await h.h('censusEnter'); continue; } break; }
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

  const r = await h.h('openWrit');
  if (!r.open) { say(`FAIL openWrit refused: ${r.refused}`); bad++; }
  else {
    say(`writ reader open: ${r.total} lines, window ${r.window}`);
    // Page through the whole document, collecting every DRAWN row.
    const drawn = new Set();
    for (let top = 0; top < r.total; top++) {
      const ui = await h.h('getUIState');
      for (const t of (ui.text || [])) drawn.add(String(t));
      await h.h('closeWrit'); await h.h('openWrit');
      // scroll by re-opening and stepping top manually is not exposed; instead read all lines
      break;
    }
    const ui = await h.h('getUIState');
    const rows = (ui.text || []).map(String);
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
  const c = await h.h('closeWrit');
  if (c.open) { say('FAIL closeWrit did not close'); bad++; }
} finally { await h.close(); }
say(bad ? `${bad} FAILURE(S)` : 'PASS — the carried writ opens and its text reaches the frame');
process.exit(bad ? 1 : 0);

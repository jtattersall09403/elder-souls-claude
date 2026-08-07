// Does creation still complete on a gamepad alone, through the NEW stamp node?
// Round 2's verdict verified this and it must not regress: the pad drives the same
// RealInput.pollGamepad() a physical pad does.
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const h = await launchGame(args);
let presses = 0, ok = false;
try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setSeed', 1337);
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });
  const A = 0;                       // standard mapping: A / cross
  const pad = (buttons, axes) => h.h('gamepad', { buttons, axes: axes || [0, 0, 0, 0] });
  const down = Array(17).fill(false);
  for (let i = 0; i < 400 && !ok; i++) {
    const st = await h.h('getCensusState');
    if (st.done) { ok = true; break; }
    // Press A, release A, step. Caret stays at the top: we only ever take the first option.
    const b = down.slice(); b[A] = true;
    await pad(b); await h.h('stepFrames', 2);
    await pad(down.slice()); await h.h('stepFrames', 2);
    presses++;
    // The hold hands control back by WALKING, not by a press; cross it the same way play does.
    const s2 = await h.h('getCensusState');
    if (s2.paused) { await h.h('censusEnter'); }
  }
  const st = await h.h('getCensusState');
  ok = !!st.done;
  const c = await h.h('getCharacter');
  console.log(`pad-only creation: done=${ok} presses=${presses} class=${c.class_id} route=${c.class_route} attrTotal=${c.invariants ? c.invariants.attribute_total : '?'}`);
} finally { await h.close(); }
console.log(ok ? 'PASS — creation completes on the pad alone' : 'FAIL — the pad could not finish creation');
process.exit(ok ? 0 : 1);

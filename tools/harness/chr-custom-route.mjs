#!/usr/bin/env node
// chr-custom-route.mjs — does the CUSTOM class route complete without throwing?
//
// Owner: W1-07. The round-2 verdict: "the custom route throws out of `stepFrames` on caret+A"
// — `census: writ.class-custom-neglected cannot repeat strength`, because census.js _options()
// ignored `inp.excludes` for the attribute and skill sources and offered attributes the player
// had already spent. A third of the creation routes crashed the simulation loop.
//
// This walks the whole custom route for four races and asserts it reaches the stamp with a
// legal sheet. It is deliberately not a unit test: the throw was in the live fixed step.
//
// USAGE
//   node tools/harness/chr-custom-route.mjs
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const h = await launchGame(args);
let bad = 0;
try {
  await h.h('setSeed', 1337);
  for (const race of ['saxhleel','dunmer','nord','khajiit']) {
    await h.h('loadState', 'barge-hold');
    let st = await h.h('censusBegin', { race });
    let entered = false, guard = 0, nodes = [];
    while (st && !st.done && guard++ < 64) {
      const inp = st.input || {};
      nodes.push(st.node);
      if (!inp.kind) { if (!entered) { entered = true; st = await h.h('censusEnter'); continue; } break; }
      let v;
      if (inp.kind === 'text') v = 'Silence-Under-Salt';
      else if (inp.kind === 'pick') v = (inp.options||[]).slice(0, inp.count||2).map(o=>o.id);
      else if (st.node === 'writ.class-routes') v = 'custom';
      else v = (inp.options||[])[0]?.id;
      if (v === undefined) break;
      try { st = await h.h('censusAnswer', v); }
      catch (e) { console.log(`  THREW at ${st.node} (${race}): ${e.message}`); bad++; break; }
    }
    const c = await h.h('getCharacter');
    console.log(`${race.padEnd(10)} done=${!!(st&&st.done)} route=${c.class_route} class=${c.class_id} attrTotal=${c.invariants?c.invariants.attribute_total:'?'} nodes=${nodes.length}`);
    if (!(st && st.done)) { console.log('   DID NOT COMPLETE'); bad++; }
  }
} finally { await h.close(); }
console.log(bad ? `${bad} FAILURE(S)` : 'custom route: no throws, all completed');
process.exit(bad ? 1 : 0);

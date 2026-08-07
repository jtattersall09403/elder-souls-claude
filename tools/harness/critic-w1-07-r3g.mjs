#!/usr/bin/env node
// critic-w1-07-r3g.mjs — RI-JRN09 M3's `NAMED_line`, measured as the item defines it.
//
// M3: "`NAMED_line` — sweeps in which **`on_match_named_class`'s line** reached the frame on a
// named match | 100%".
//
// The builder's probe (tools/harness/jrn09-exchange.mjs, M3) tests this with:
//
//     const blob = norm(w.nodes.map(n => n.drawn_rows.join('  ')).join('  '));
//     if (blob.indexOf(norm(c.class_name)) >= 0) lineDrawn++;
//
// — i.e. it asks whether the class NAME appears anywhere in the whole scene's drawn text, over
// every node. The same round added `Trade declared: %ClassName` to the writ's drawn identity
// block at `writ.stamp`, so that substring is on the frame whatever the scribe did or did not
// say. The check passes because of a different fix, and it cannot distinguish "she said it" from
// "it is printed on the form two nodes later".
//
// What this probe does instead: the scribe's naming line is produced by `on_match_named_class` /
// `on_nearest_named_class` and arrives in `getCensusState().spoken` at the node the questionnaire
// advances to (`writ.birthsign`). So — at that node, and only at that node, which is its one
// chance — take the naming line out of `spoken` and ask the DRAW REGISTER whether it is on the
// frame. It also records how many `spoken` lines the panel's overflow rule threw away, since
// that is the mechanism.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.resolve('corpus/90-verdicts/wave1/artifacts/W1-07-r3');
const say = (s) => process.stdout.write(s + '\n');
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const rec = { generated_by: 'tools/harness/critic-w1-07-r3g.mjs', runs: [], summary: null };

const RACES = (args.races ? String(args.races).split(',') : ['saxhleel', 'dunmer', 'nord', 'khajiit', 'bosmer', 'imperial']);
const UPS = (args.ups ? String(args.ups).split(',') : ['interior', 'lukiul']);

const h = await launchGame({ ...args, width: Number(args.width || 640), height: Number(args.height || 360) });
try {
  await h.h('setSeed', 1337);
  let seed = 777;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };

  let named = 0, lineDrawn = 0, lineOnFrameByAnyMeans = 0, nameStringDrawn = 0;
  for (const race of RACES) for (const up of UPS) {
    await h.h('loadState', 'barge-hold');
    await h.h('censusBegin', { race });
    let st = await h.h('getCensusState'); let guard = 0, entered = false;
    let namingLine = null, drawnAtBirthsign = null, wholeSceneBlob = '', sacrificed = 0;
    while (st && !st.done && guard++ < 40) {
      if (st.node === 'writ.birthsign') {
        await h.h('renderedTextClear');
        await h.h('renderFrame');
        const reg = await h.h('getRenderedText', {});
        const blob = norm((reg.distinct || []).join('  '));
        // The naming line is the most recent `spoken` entry at this node.
        const sp = (st.spoken || []).map((x) => (x && typeof x === 'object') ? x.line : x).filter(Boolean);
        namingLine = sp.length ? sp[sp.length - 1] : null;
        drawnAtBirthsign = namingLine ? blob.indexOf(norm(namingLine)) >= 0 : null;
        sacrificed = sp.filter((s) => blob.indexOf(norm(s)) < 0).length;
        wholeSceneBlob += '  ' + blob;
      } else if (st.node === 'writ.stamp' || st.node === 'hold.wake') {
        // The stamp node is where the writ's identity block (and `Trade declared: %ClassName`)
        // is drawn — the string the builder's test finds. Render there so the comparison is fair.
        await h.h('renderedTextClear');
        await h.h('renderFrame');
        const reg = await h.h('getRenderedText', {});
        wholeSceneBlob += '  ' + norm((reg.distinct || []).join('  '));
      }
      const inp = st.input;
      if (!inp) { if (!entered) { entered = true; st = await h.h('censusEnter'); continue; } break; }
      let v;
      if (inp.kind === 'text') v = 'Silence-Under-Salt';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((o) => o.id);
      else if (inp.kind === 'questionnaire') v = (inp.options || [])[Math.floor(rnd() * inp.options.length)].id;
      else if (st.node === 'writ.upbringing') v = up;
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = (inp.options || [])[0] && (inp.options || [])[0].id;
      if (v == null) break;
      st = await h.h('censusAnswer', v);
    }
    const ch = await h.h('getCharacter');
    const isNamed = !!(ch && ch.class_id && ch.class_id !== 'custom' && ch.class_route !== 'custom' && ch.class_name);
    const nameHit = isNamed && wholeSceneBlob.indexOf(norm(ch.class_name)) >= 0;
    const lineHitAnywhere = namingLine ? wholeSceneBlob.indexOf(norm(namingLine)) >= 0 : false;
    if (isNamed) {
      named++;
      if (drawnAtBirthsign) lineDrawn++;
      if (lineHitAnywhere) lineOnFrameByAnyMeans++;
      if (nameHit) nameStringDrawn++;
    }
    rec.runs.push({ race, up, class_id: ch && ch.class_id, class_name: ch && ch.class_name, named: isNamed,
      naming_line: namingLine ? namingLine.slice(0, 140) : null,
      naming_line_drawn_at_its_node: drawnAtBirthsign,
      naming_line_drawn_anywhere: lineHitAnywhere,
      class_name_string_drawn_anywhere: nameHit,
      spoken_lines_sacrificed_at_birthsign: sacrificed });
    say(`${race.padEnd(9)} ${up.padEnd(13)} ${String(ch && ch.class_name).padEnd(18)} named=${isNamed ? 'y' : 'n'} ` +
        `LINE_drawn_at_node=${drawnAtBirthsign} LINE_anywhere=${lineHitAnywhere} NAME_string_anywhere=${nameHit} sacrificed=${sacrificed}`);
  }
  rec.summary = {
    named_runs: named,
    naming_line_drawn_at_its_node: lineDrawn,
    naming_line_drawn_anywhere_in_scene: lineOnFrameByAnyMeans,
    class_name_substring_drawn_anywhere: nameStringDrawn,
    NAMED_line_pct_by_item_definition: named ? +(100 * lineDrawn / named).toFixed(2) : null,
    NAMED_line_pct_by_builders_test: named ? +(100 * nameStringDrawn / named).toFixed(2) : null,
  };
  say(`\n== M3 NAMED_line ==`);
  say(`  named runs                                              : ${named}`);
  say(`  naming LINE on the frame at the node it is spoken       : ${lineDrawn}  (${rec.summary.NAMED_line_pct_by_item_definition}%)  <- the item's definition, requires 100%`);
  say(`  naming LINE on the frame anywhere in the scene          : ${lineOnFrameByAnyMeans}`);
  say(`  class NAME substring anywhere in the scene              : ${nameStringDrawn}  (${rec.summary.NAMED_line_pct_by_builders_test}%)  <- what jrn09-exchange.mjs measures`);
} finally {
  fs.writeFileSync(path.join(OUT, 'named-line-critic.json'), JSON.stringify(rec, null, 2));
  await h.close();
}

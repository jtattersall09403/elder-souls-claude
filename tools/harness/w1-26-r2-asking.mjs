#!/usr/bin/env node
// w1-26-r2-asking.mjs — does the opening teach that ASKING is the verb?
//
// Owner: W1-26 round 2. This is the instrument for the third thing the round-2 dispatch put
// under this piece: findability landed tree-wide, 34 quest keywords that existed nowhere now
// have bodies, 32 rumours supply them per settlement, and ten of thirty-five quests open from
// a cold start by walking into two towns and asking what people are saying. **The opening is
// where a player learns that asking is the verb.** So: measure whether it does.
//
// WHAT WAS MEASURED BEFORE ANY CHANGE, through the live reader rather than by grepping files:
//
//   * RI-DLG01 §A — "the player begins with exactly nine topics, granted at character
//     creation". `sim/state.js` initialises `topicsKnown: []` and nothing between there and the
//     door out of the writ house put a word in it. The player began with none.
//   * Of the nine ROOT topics in `topics/00-roots.json`, SEVEN were listed by ZERO of the 336
//     NPC records in the tree, because `converse.js topicsFor()` iterated `npc.topics` alone.
//   * Every root info was written for one of the six archetypes in `dialogue/speakers.json`,
//     and the NPC records use EIGHTEEN actor names. All three speakers in the opening are among
//     the twelve that are not archetypes — `jeeh-ei` is a `villager`, the Warden-Scribe and the
//     provincial clerk are `clerk`s — so the nine roots against the opening's three records
//     returned 27 nulls out of 27. The one scene whose job is to teach the verb was the one
//     scene in which asking could not be answered by a living soul.
//   * And the scene never said the word. Its 22 nodes contained no sentence telling the player
//     that asking is a thing you do. Under `ARBITRATION` S35 that matters more than it used to:
//     the map now exists and shows only ground already walked, so it cannot get the player
//     anywhere new, and S35 closes by saying so — "wayfinding must still work without opening
//     the map at all".
//
// THE CONSUMER, named as `RI-MTH07` §B requires, end to end and world-side:
//
//     topics/00-roots.json `root: true`  +  topics/06-opening-roots.json (villager/clerk halves)
//       -> converse.js buildTopicIndex().roots
//       -> Engine._censusFinish() learnTopics()        [the writ is stamped: the words are given]
//       -> sim.quest.topicsKnown
//       -> Engine._talkPlayer().topics_known
//       -> converse.js topicsFor()                      [what this person will discuss with YOU]
//       -> Conversation.start().list                    [the list drawn when you walk up]
//       -> Engine.conversationSay() -> learnTopics(to)  [asking hands you more words]
//
// The observable is never a harness return value describing the model. It is WHAT A PERSON
// STANDING IN THE ROOM OFFERS AND SAYS, and what the player is holding afterwards.
//
// USAGE
//   node tools/harness/w1-26-r2-asking.mjs [--json <path>]
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-r2-asking.mjs — the opening as the place a player learns the verb.

USAGE
  node tools/harness/w1-26-r2-asking.mjs [--json <path>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.join(REPORTS_DIR, 'journeys');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'w1-26-r2-asking.json');

const say = (s) => process.stdout.write(s + '\n');
const out = { schema: 'elder-souls/w1-26-asking@1', piece: 'W1-26', checks: {}, failures: [], passes: [] };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };

// Small viewport, renderer off. AGENT-PROTOCOL: a stepping loop that renders is the single most
// expensive thing in this project, and nothing here is a photograph.
const handle = await launchGame({ ...args, width: 320, height: 240 });

try {
  const r = await handle.page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.ready();
    await H.setRenderRate(0);
    await H.setSeed(1337);

    // Play the whole creation with the player's own hands on every answer, exactly as
    // `w1-26-r2-scene.mjs` does, and stop when the writ is stamped.
    const playToStamp = async () => {
      await H.loadState('barge-hold');
      await H.censusBegin({ race: 'saxhleel' });
      let qi = 0;
      const before = (E.sim.quest.topicsKnown || []).slice();
      let stampDrawn = null;
      // THE WATERMARK IS TAKEN BEFORE THE CALL THAT REPAINTS, NEVER AFTER IT.
      // `getCensusState()` and `censusAnswer()` both call `metrics()`, which repaints the UI
      // layer and CLEARS `dirty`; the layer will not paint again until something dirties it. So
      // a mark taken at the top of an iteration is already downstream of the paint that drew
      // this node, and `{since: mark}` comes back EMPTY. My first draft did that and reported
      // `distinct: 0` at `writ.stamp` — with the node's own long-standing door sentence missing
      // too, which is what gave it away, because a real overflow drops the scribe's replies and
      // keeps the node's own line, never both. `mark` is now advanced immediately before every
      // call that advances the scene, so `{since: mark}` is exactly the new node's paint.
      let mark = H.getRenderedText({}).next_index;
      for (let guard = 0; guard < 200; guard++) {
        const st = H.getCensusState();
        if (st.done) break;
        if (st.node === 'writ.stamp' && !stampDrawn) {
          const d = H.getRenderedText({ since: mark });
          // Whitespace stripped BOTH SIDES: `render/ui.js wrap()` splits prose on whitespace,
          // DROPS the space and hands each fragment to its own fillText, so a space-joined
          // substring test invents undrawn text on every wrapped string.
          const flat = (d.entries || []).map((e) => String(e.text)).join('').replace(/\s+/g, '');
          stampDrawn = {
            node: 'writ.stamp',
            distinct: d.distinct ? d.distinct.length : 0,
            entries: d.entries ? d.entries.length : 0,
            teaching_sentence_drawn: flat.indexOf('Soaskthemwhattheydo,andwhatisbeingsaidhere.') >= 0,
            door_sentence_drawn: flat.indexOf('Thedoorbehindmeistheoneyouwant.') >= 0,
          };
        }
        // TWO hand-back nodes now (`hold.come-to` resume_by talk, `hold.out` resume_by walk).
        // A walker with a one-shot `entered` flag stops dead at the second and reports zeros.
        if (st.paused) { mark = H.getRenderedText({}).next_index; H.censusEnter(st.resume_by); continue; }
        const inp = st.input;
        if (!inp) { mark = H.getRenderedText({}).next_index; H.censusAnswer(null); continue; }
        let v;
        if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
        else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
        else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
        else if (st.node === 'writ.class-routes') v = 'questionnaire';
        else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
        mark = H.getRenderedText({}).next_index;
        H.censusAnswer(v);
      }
      return { before, after: (E.sim.quest.topicsKnown || []).slice(), stampDrawn };
    };

    // Walk up to somebody and read what they will discuss. `_greetCount` is cleared first: it
    // is NOT reset by loadState, so a second play in the same page draws the second line of the
    // same greeting cell and a null control reads as a difference. Found the hard way already.
    const askable = (eid) => {
      if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
      const st = H.talkTo(eid);
      const list = (st.topics || []).map((t) => ({ id: t.id, root: !!t.root }));
      H.conversationClose();
      return list;
    };

    // ---- 1. THE GRANT -------------------------------------------------------------------
    const grant = await playToStamp();

    // ---- 2. WHAT THE PEOPLE IN THE ROOM NOW OFFER ---------------------------------------
    const present = E.sim.npcs.map((n) => n.eid);
    const offered = {};
    for (const eid of ['warden-scribe-tuleeh-ma', 'clerk-avelia-doren', 'jeeh-ei']) {
      if (!E.sim.findNPC(eid)) continue;
      offered[eid] = askable(eid);
    }

    // ---- 3. ASKING ACTUALLY ANSWERS, AND HANDS YOU WORDS --------------------------------
    // The whole point. A root that is offered and then produces silence is worse than one that
    // is not offered, and a root that answers and hands back nothing teaches the player that
    // asking produces prose rather than progress.
    const speaker = E.sim.findNPC('warden-scribe-tuleeh-ma') ? 'warden-scribe-tuleeh-ma' : present[0];
    if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
    H.talkTo(speaker);
    const asked = [];
    const heldBeforeAsking = (E.sim.quest.topicsKnown || []).slice();
    for (const t of (H.getConversationState().topics || [])) {
      if (!t.root) continue;
      const held = new Set(E.sim.quest.topicsKnown || []);
      const said = H.conversationSay(t.id);
      const gained = (E.sim.quest.topicsKnown || []).filter((x) => !held.has(x));
      asked.push({
        topic: t.id,
        // `Engine.conversationSay()` returns `this.conversation.state()`, and the words the
        // person actually spoke are on `said` — NOT `text`, which does not exist on that object.
        // Reading `.text` made nine answered topics report SILENT while, two lines below, the
        // same nine were visibly handing the player keywords off their `to` edges. A probe whose
        // two halves contradict each other is wrong in at least one of them.
        answered: !!(said && said.said),
        chars: said && said.said ? said.said.length : 0,
        source: said ? said.said_topic : null,
        text: said && said.said ? said.said : null,
        words_gained: gained,
      });
    }
    H.conversationClose();
    const heldAfterAsking = (E.sim.quest.topicsKnown || []).slice();

    // ---- 4. CONSUMPTION: perturb the MODEL, watch the ENTITY -----------------------------
    // Take one root's `villager`/`clerk` info out of the live index and ask the same person the
    // same question. If the file is an orphan model, the list does not move.
    const idx = E.topicIndex;
    const key = 'little advice';
    const rec = idx.get(key);
    const savedInfos = rec ? rec.infos.slice() : null;
    const nullControl = askable(speaker);                       // perturb nothing
    let perturbed = null;
    if (rec) {
      rec.infos = rec.infos.filter((i) => i.a !== 'clerk' && i.a !== 'villager');
      perturbed = askable(speaker);
      rec.infos = savedInfos;                                   // put it back
    }
    const restored = askable(speaker);

    // ---- 5. DELETE THE FIX: take the granted words away ----------------------------------
    // The offer is gated on the player HOLDING the word. Empty `topicsKnown` and the same
    // person must fall back to exactly the subjects their own record advertises.
    const savedKnown = (E.sim.quest.topicsKnown || []).slice();
    E.sim.quest.topicsKnown.length = 0;
    const withoutGrant = askable(speaker);
    for (const t of savedKnown) E.sim.quest.topicsKnown.push(t);
    const withGrant = askable(speaker);

    return {
      grant: {
        before: grant.before, after: grant.after,
        gained: grant.after.filter((t) => !grant.before.includes(t)),
      },
      present, offered,
      asked,
      held_before_asking: heldBeforeAsking, held_after_asking: heldAfterAsking,
      words_gained_by_asking: heldAfterAsking.filter((t) => !heldBeforeAsking.includes(t)),
      consumption: {
        consumer: 'topics/06-opening-roots.json + 00-roots.json root flag -> converse.js buildTopicIndex().roots -> Engine._censusFinish() learnTopics -> sim.quest.topicsKnown -> Engine._talkPlayer().topics_known -> converse.js topicsFor() -> Conversation.start().list -> what the person in the room offers',
        speaker,
        null_control: nullControl.map((t) => t.id),
        perturbed: perturbed ? perturbed.map((t) => t.id) : null,
        restored: restored.map((t) => t.id),
      },
      delete_the_fix: {
        with_grant: withGrant.map((t) => t.id),
        without_grant: withoutGrant.map((t) => t.id),
      },
      verb_line: grant.stampDrawn || { node: 'writ.stamp', distinct: 0, teaching_sentence_drawn: false, door_sentence_drawn: false },
    };
  });
  out.checks = r;

  say('THE GRANT — RI-DLG01 §A, "granted at character creation"');
  say(`  topicsKnown before the desk: ${JSON.stringify(r.grant.before)}`);
  say(`  gained at the stamp (${r.grant.gained.length}): ${JSON.stringify(r.grant.gained)}`);
  if (r.grant.gained.length === 9) pass('the nine root topics are granted when the writ is stamped');
  else fail(`the stamp granted ${r.grant.gained.length} root topics, not nine: ${JSON.stringify(r.grant.gained)}`);

  say('WHAT THE ROOM OFFERS');
  for (const [eid, list] of Object.entries(r.offered)) {
    const roots = list.filter((t) => t.root).length;
    say(`  ${eid}: ${list.length} topics, ${roots} of them root — ${list.map((t) => t.id).join(', ')}`);
  }
  const anyRoots = Object.values(r.offered).every((l) => l.filter((t) => t.root).length > 0);
  if (anyRoots) pass('every speaker in the opening now offers root topics; before this round all three offered none');
  else fail('a speaker in the opening offers no root topic at all — the verb still has no answer in this scene');

  say('ASKING ANSWERS, AND HANDS BACK WORDS');
  const silent = r.asked.filter((a) => !a.answered);
  const barren = r.asked.filter((a) => a.answered && a.words_gained.length === 0);
  for (const a of r.asked) say(`  ${a.topic.padEnd(22)} ${a.answered ? `${a.chars} chars` : 'SILENT'}  +${JSON.stringify(a.words_gained)}`);
  if (r.asked.length === 0) fail('no root topic was offered to ask — nothing to measure');
  else if (silent.length) fail(`${silent.length} root topic(s) were offered and answered with nothing: ${JSON.stringify(silent.map((a) => a.topic))}`);
  else pass(`all ${r.asked.length} root topics offered were answered out loud`);
  if (r.asked.length && barren.length === r.asked.length) fail('every root answered and none of them handed back a word — asking produces prose, not progress');
  else if (r.words_gained_by_asking.length) pass(`asking handed the player ${r.words_gained_by_asking.length} new keyword(s): ${JSON.stringify(r.words_gained_by_asking)}`);
  else fail('asking handed the player no new keyword at all');

  say('CONSUMPTION (RI-MTH07 §B)');
  const C = r.consumption;
  say(`  consumer: ${C.consumer}`);
  const nullSame = JSON.stringify(C.null_control) === JSON.stringify(C.restored);
  const moved = C.perturbed && JSON.stringify(C.perturbed) !== JSON.stringify(C.null_control);
  say(`  null control (perturb nothing): ${C.null_control.length} topics`);
  say(`  with 'little advice' removed from the villager and clerk mouths: ${C.perturbed ? C.perturbed.length : 'n/a'} topics`);
  say(`  restored: ${C.restored.length} topics`);
  if (!nullSame) fail('the null control moved — two identical runs gave different topic lists, so nothing measured here is attributable');
  else pass('null control: perturb nothing, observe nothing');
  if (moved) pass('CONSUMPTION: taking a line out of the model changed what a person standing in the room offers');
  else fail('CONSUMPTION coupling == 0 — removing the info changed nothing the world does. The file is an orphan model.');

  say('DELETE THE FIX');
  const D = r.delete_the_fix;
  say(`  with the granted words: ${D.with_grant.length} topics`);
  say(`  with topicsKnown emptied: ${D.without_grant.length} topics`);
  if (D.without_grant.length < D.with_grant.length) pass(`delete-the-fix reproduces: emptying topicsKnown drops the list ${D.with_grant.length} -> ${D.without_grant.length}, back to the subjects the record itself advertises`);
  else fail('delete-the-fix did NOT reproduce: emptying topicsKnown left the offer unchanged, so the gate is not the gate');

  say('THE SCENE SAYS THE WORD');
  if (r.verb_line.teaching_sentence_drawn) pass("writ.stamp's teaching sentence reached the frame through the draw-call register");
  else fail(`writ.stamp's teaching sentence was NOT drawn (${r.verb_line.distinct} distinct strings on the frame, door sentence drawn=${r.verb_line.door_sentence_drawn}) — the overflow policy is eating it, which is round 1's defect wearing a new sentence`);
} finally {
  out.page_errors = handle.errors.slice(0, 6);
  await handle.close();
}

out.verdict = out.failures.length ? 'FAIL' : 'PASS';
say('');
say(`w1-26-r2-asking: ${out.passes.length} pass, ${out.failures.length} fail -> ${out.verdict}`);
writeJson(jsonPath, out);
log(`wrote ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);

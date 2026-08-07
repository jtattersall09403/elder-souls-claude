#!/usr/bin/env node
// w1-speakers-ask.mjs — walk up to people in the province and put the nine words to them.
//
// Owner: W1-SPEAKERS. Binding: RI-DLG01 §A, RI-MTH07 / ARBITRATION §3 (CONSUMPTION).
//
// WHY THIS EXISTS, AND WHY IT IS NOT `root-coverage.mjs`.
// `tools/dialogue/root-coverage.mjs` calls the shipped reader in bare Node over the shipped
// data. That is the right instrument for the census — 336 records is not something to walk —
// but it never boots the engine, never loads a town, and never presses a button. "A count of
// infos in a file is not coverage", and neither is a count of `infoFor()` returns. This one
// BOOTS THE GAME, LOADS A TOWN, MOVES THE BODY TO A PERSON, OPENS THE CONVERSATION THE SAME WAY
// A PLAYER DOES, and reads what they say.
//
// It also carries the two mutations that the node census cannot see at all, because both live
// in the engine rather than in `converse.js`:
//
//   * the settlement rumour replacing the root's generic answer (`Engine._installTopicSupply`),
//     which is the observable half of the `latest rumours` -> `latest rumors` spelling fix; and
//   * the reach gate — a conversation opened by the interact button rather than by naming an
//     eid, so a person who cannot be walked to cannot be counted as answering.
//
// SEVEN CHECKS
//   C1  a person in a town offers the nine roots and ANSWERS all nine out loud
//   C2  the answer is the one written for THEIR TOWN, not another town's
//   C3  two people of DIFFERENT actor names in the same town differ on the self-roots and
//       agree on the world-roots — the contrast, in the room
//   C4  the gossip keyword appears exactly ONCE in the list
//   C5  CONSUMPTION: remove the generic floor from the LIVE index and the same person in the
//       same room stops being able to answer. Put it back and they can again. Null control.
//   C6  DELETE THE FIX at the cell gate: move the speaker's settlement and the town answer must
//       change to a different town's or vanish
//   C7  the conversation opened by WALKING and pressing interact says the same thing as the one
//       opened by naming the eid — otherwise every number above is about a surface the player
//       never touches
//
// USAGE
//   node tools/harness/w1-speakers-ask.mjs [--state town-gideon] [--json <path>]
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-speakers-ask.mjs — put the nine root words to people standing in a province town.

USAGE
  node tools/harness/w1-speakers-ask.mjs [--state <named state>] [--json <path>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.join(REPORTS_DIR, 'journeys');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'w1-speakers-ask.json');
const STATE = String(args.state || 'town-gideon');

const say = (s) => process.stdout.write(s + '\n');
const out = { schema: 'elder-souls/w1-speakers-ask@1', piece: 'W1-SPEAKERS', state: STATE, checks: {}, failures: [], passes: [] };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };

// 320x240, renderer off for the stepping. AGENT-PROTOCOL: a stepping loop that renders is the
// single most expensive thing in this project and nothing here is a photograph.
const handle = await launchGame({ ...args, width: 320, height: 240 });

try {
  const r = await handle.page.evaluate(async (STATE) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    await H.ready();
    await H.setRenderRate(0);
    await H.setSeed(4021);
    H.loadState(STATE);

    const ROOTS = ['duties', 'background', 'specific-place', 'someone-in-particular', 'services', 'my-trade', 'little-advice', 'latest-rumors', 'little-secret'];
    const SELF = new Set(['duties', 'background', 'my-trade']);

    // The nine words are granted at the writ desk. A body dropped straight into a town has not
    // been through the census, so they are granted here by the SAME call `_censusFinish` makes
    // — `learnTopics(topicsKnown, rootTopicIds(topicIndex))` — rather than by hand-writing the
    // nine strings, so a tenth root added to `00-roots.json` arrives here without an edit and
    // a typo cannot silently seed a gate with the string it is about to ask for.
    const grantRoots = () => {
      const held = E.sim.quest.topicsKnown;
      const roots = (E.topicIndex && E.topicIndex.roots) ? E.topicIndex.roots.map((x) => x.id) : [];
      for (const t of roots) if (!held.some((k) => String(k).toLowerCase().replace(/[-_]+/g, ' ') === String(t).toLowerCase().replace(/[-_]+/g, ' '))) held.push(t);
      return roots;
    };
    const rootsGranted = grantRoots();

    // `_greetCount` is not cleared by loadState, so a second conversation with the same person
    // in the same page draws the SECOND line of the same greeting cell and a null control reads
    // as a difference. Recorded by W1-26 and re-learned by everybody who skips it.
    const fresh = (eid) => {
      if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
      return H.talkTo(eid);
    };
    const askAll = (eid) => {
      const st = fresh(eid);
      const listed = (st.topics || []).map((t) => t.id);
      const answers = {};
      for (const id of ROOTS) {
        if (!listed.some((x) => x.toLowerCase().replace(/[-_]+/g, ' ') === id.replace(/-/g, ' '))) { answers[id] = null; continue; }
        const s = H.conversationSay(id);
        answers[id] = (s && s.said) ? s.said : null;
      }
      H.conversationClose();
      return { listed, answers, answered: ROOTS.filter((id) => answers[id]).length };
    };

    const npcs = H.listNPCs();
    const settlement = (E.sim.env && E.sim.env.settlement) || null;

    // ---- C1 / C2 -------------------------------------------------------------------------
    // Pick somebody wearing one of the actor names that answered NOTHING before this round.
    const MUTE_BEFORE = ['townsman', 'merchant', 'healer', 'dres-factor', 'innkeeper', 'fisher', 'town-elder', 'outlaw', 'naga-elder', 'mercenary', 'deep-elder'];
    const rec = (eid) => { const n = E.sim.findNPC(eid); return n && n.record ? n.record : n; };
    const actorOf = (eid) => { const n = rec(eid); return n ? (n.actor || null) : null; };
    const pickBy = (pred) => (npcs.find((n) => pred(actorOf(n.eid), n)) || {}).eid || null;

    const subject = pickBy((a) => MUTE_BEFORE.includes(a));
    const other = pickBy((a, n) => MUTE_BEFORE.includes(a) && n.eid !== subject && a !== actorOf(subject));

    const A = subject ? askAll(subject) : null;
    const B = other ? askAll(other) : null;

    // ---- C4 ------------------------------------------------------------------------------
    const gossip = A ? A.listed.filter((id) => /^latest rumou?rs$/.test(String(id).toLowerCase().replace(/[-_]+/g, ' '))) : [];

    // ---- C5 CONSUMPTION: perturb the MODEL, watch the ENTITY -------------------------------
    // Strip the GENERIC (actorless) infos out of one world-root in the LIVE index and ask the
    // same person in the same room. If `07-root-coverage.json` is an orphan model, nothing
    // moves. The null control asks twice with nothing touched.
    const nullControl = subject ? askAll(subject) : null;
    const target = 'little secret';
    const recT = E.topicIndex.get(target);
    const saved = recT ? recT.infos.slice() : null;
    let perturbed = null;
    if (recT && subject) {
      recT.infos = recT.infos.filter((i) => i.a);         // the floor removed, actor rows kept
      perturbed = askAll(subject);
      recT.infos = saved;
    }
    const restored = subject ? askAll(subject) : null;

    // ---- C6 DELETE THE FIX at the cell gate -----------------------------------------------
    // The town answer is chosen by `converse.js inCell()`. Move the person and the answer must
    // move with them. If it does not, `cell` is decorative again and C2 was vacuous.
    let moved = null;
    if (subject) {
      const n = E.sim.findNPC(subject);
      const r0 = n.record || n;
      const was = r0.settlement;
      const to = was === 'thorn' ? 'soulrest' : 'thorn';
      r0.settlement = to;
      if (n !== r0) n.settlement = to;
      moved = { from: was, to, ...askAll(subject) };
      r0.settlement = was;
      if (n !== r0) n.settlement = was;
    }
    const back = subject ? askAll(subject) : null;

    // ---- C7 the conversation a PLAYER opens ------------------------------------------------
    // Put the body next to the person and press the button, rather than naming an eid. Renderer
    // stays off; this is a step loop, not a photograph.
    let walked = null;
    if (subject) {
      const n = E.sim.findNPC(subject);
      const p = n.pos || n;
      H.conversationClose();
      if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
      try {
        H.teleport(p.x + 1.2, p.z + 0.6, { face: [p.x, p.z] });
        H.stepFrames(6);
        H.queueInputs([{ frame: E.sim.frame + 1, down: ['interact'] }, { frame: E.sim.frame + 3, up: ['interact'] }]);
        H.stepFrames(12);
        const st = H.getConversationState();
        walked = {
          opened: !!(st && st.open),
          npc: st && st.npc ? st.npc : null,
          topics: st && st.topics ? st.topics.map((t) => t.id) : [],
        };
        if (walked.opened) {
          const s = H.conversationSay('services');
          walked.services = s && s.said ? s.said : null;
          H.conversationClose();
        }
      } catch (e) { walked = { opened: false, error: String(e && e.message || e) }; }
    }

    return {
      settlement, npc_count: npcs.length, roots_granted: rootsGranted,
      subject: subject ? { eid: subject, actor: actorOf(subject), ...A } : null,
      other: other ? { eid: other, actor: actorOf(other), ...B } : null,
      gossip_keywords: gossip,
      consumption: {
        consumer: 'game/data/dialogue/topics/07-root-coverage.json -> converse.js buildTopicIndex() -> infoFor() generic tier -> Conversation.start().list -> what the person in the room says',
        null_control_answered: nullControl ? nullControl.answered : null,
        perturbed_answer: perturbed ? perturbed.answers['little-secret'] : null,
        restored_answer: restored ? restored.answers['little-secret'] : null,
        baseline_answer: A ? A.answers['little-secret'] : null,
      },
      cell_delete_the_fix: moved, cell_restored: back ? back.answers['services'] : null,
      walked,
    };
  }, STATE);

  out.checks = r;
  say(`STATE ${STATE}   settlement=${r.settlement}   ${r.npc_count} people in the world`);
  say('');

  const A = r.subject, B = r.other;
  say('C1 — a person who could answer NOTHING before this round');
  if (!A) fail('no NPC wearing a previously-mute actor name is present in this state');
  else {
    say(`     ${A.eid}  (actor: ${A.actor})`);
    for (const k of Object.keys(A.answers)) say(`       ${k.padEnd(24)} ${A.answers[k] ? '"' + String(A.answers[k]).slice(0, 92) + '"' : '— SILENT'}`);
    if (A.answered === 9) pass(`${A.eid} answers all nine roots out loud`);
    else fail(`${A.eid} answers ${A.answered} of 9`);
  }

  say('');
  say('C2 — the answer is the one written for THEIR town');
  const townPhrase = { gideon: 'Gideon', stormhold: 'wall', lilmoth: 'counter', helstrom: 'well', blackrose: 'prison', archon: 'Dye', soulrest: 'salt', thorn: 'Thorn' }[r.settlement];
  if (A && townPhrase && (String(A.answers['services'] || '') + String(A.answers['specific-place'] || '')).includes(townPhrase)) {
    pass(`the services / specific-place answers name ${r.settlement}`);
  } else if (A) fail(`no ${r.settlement} answer came back: services="${A.answers['services']}"`);

  say('');
  say('C3 — the contrast: different on the self-roots, same on the world-roots');
  if (A && B) {
    const SELF = ['duties', 'background', 'my-trade'];
    const WORLD = ['specific-place', 'services', 'little-advice'];
    const selfDiff = SELF.filter((k) => A.answers[k] && B.answers[k] && A.answers[k] !== B.answers[k]).length;
    const worldSame = WORLD.filter((k) => A.answers[k] && A.answers[k] === B.answers[k]).length;
    say(`     ${A.actor} vs ${B.actor}:  self-roots differing ${selfDiff}/3,  world-roots agreeing ${worldSame}/3`);
    if (selfDiff === 3) pass('two trades in the same town give three different answers about themselves');
    else fail(`only ${selfDiff}/3 self-roots differ between ${A.actor} and ${B.actor}`);
    if (worldSame >= 2) pass('and agree about the town they both live in');
    else fail(`only ${worldSame}/3 world-roots agree — the town answer is not reaching both`);
  } else fail('needed two people of different actor names in one town and did not find them');

  say('');
  say('C4 — the gossip keyword, after the spelling fix');
  say(`     offered: ${JSON.stringify(r.gossip_keywords)}`);
  if (r.gossip_keywords.length === 1) pass('one gossip keyword in the list, not two');
  else fail(`${r.gossip_keywords.length} gossip keywords offered`);

  say('');
  say('C5 — CONSUMPTION: perturb the model, watch the person');
  const c = r.consumption;
  say(`     consumer: ${c.consumer}`);
  say(`     baseline  : ${c.baseline_answer ? '"' + String(c.baseline_answer).slice(0, 70) + '"' : 'null'}`);
  say(`     perturbed : ${c.perturbed_answer ? '"' + String(c.perturbed_answer).slice(0, 70) + '"' : 'NULL — the person went silent'}`);
  say(`     restored  : ${c.restored_answer ? '"' + String(c.restored_answer).slice(0, 70) + '"' : 'null'}`);
  if (c.baseline_answer && !c.perturbed_answer) pass('removing the generic floor from the LIVE index silences the person');
  else fail('removing the generic floor changed nothing the person says — the file is an orphan model');
  if (c.restored_answer === c.baseline_answer) pass('and putting it back restores the same words');
  else fail('restore did not reproduce the baseline');
  if (c.null_control_answered === (A ? A.answered : -1)) pass(`null control identical (${c.null_control_answered} of 9 both times)`);
  else fail(`null control moved: ${A && A.answered} -> ${c.null_control_answered}`);

  say('');
  say('C6 — DELETE THE FIX at the cell gate');
  const m = r.cell_delete_the_fix;
  if (m) {
    say(`     moved ${m.from} -> ${m.to}`);
    say(`     services there : ${m.answers['services'] ? '"' + String(m.answers['services']).slice(0, 70) + '"' : 'null'}`);
    say(`     back home      : ${r.cell_restored ? '"' + String(r.cell_restored).slice(0, 70) + '"' : 'null'}`);
    if (m.answers['services'] !== r.cell_restored) pass('moving the speaker changes which town\'s answer they give');
    else fail('the same town answer followed the speaker to another town — `cell` is decorative');
  } else fail('cell perturbation did not run');

  say('');
  say('C7 — the conversation a PLAYER opens, by walking and pressing interact');
  const w = r.walked;
  if (w && w.opened) {
    say(`     opened with ${w.npc}, ${w.topics.length} topics offered`);
    say(`     asked "services": ${w.services ? '"' + String(w.services).slice(0, 80) + '"' : 'null'}`);
    if (w.services && A && w.services === A.answers['services']) pass('walking up and pressing interact gives the same answer as talkTo — the numbers above are about the surface the player touches');
    else fail(`walked conversation said ${JSON.stringify(w.services)}, talkTo said ${JSON.stringify(A && A.answers['services'])}`);
  } else fail(`the walked conversation did not open: ${w && w.error ? w.error : 'no conversation'}`);

  say('');
  say(`${out.passes.length} pass   ${out.failures.length} fail`);
  writeJson(jsonPath, out);
  log(`wrote ${jsonPath}`);
} finally {
  await handle.close();
}
process.exit(out.failures.length ? 1 : 0);

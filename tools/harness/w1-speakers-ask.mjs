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
      const answers = {}, cells = {};
      for (const id of ROOTS) {
        if (!listed.some((x) => x.toLowerCase().replace(/[-_]+/g, ' ') === id.replace(/-/g, ' '))) { answers[id] = null; cells[id] = null; continue; }
        const s = H.conversationSay(id);
        answers[id] = (s && s.said) ? s.said : null;
        // WHICH TOWN'S ANSWER, from the reader rather than from the prose. See the note on
        // `said_cell` in converse.js: matching the town's NAME inside the line cannot tell a
        // cell-gated answer apart from an actor row that happens to mention the place, and
        // C6 failed for exactly that reason before this field existed.
        cells[id] = (s && s.said_cell) ? s.said_cell : null;
      }
      H.conversationClose();
      return { listed, answers, cells, answered: ROOTS.filter((id) => answers[id]).length };
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
    // The town answer is chosen by `converse.js inCell()`. Move the person and the town answer
    // must move with them.
    //
    // THIS CHECK CARRIES ITS OWN CONTROL, and the first version did not, which is why it read
    // as a defect in the world when the defect was in the check. It watched `services` and
    // asserted the line must change. For a merchant, `services` resolves to the `a: merchant`
    // ACTOR row — specificity 8, against the cell tier's 2 — which is a line about the trade,
    // not about the town, and which is RIGHT to follow the speaker to Thorn. The check was
    // demanding that a correct answer be wrong.
    //
    // So it now splits the nine by what the reader actually chose (`said_cell`):
    //   * every root delivered from a CELL-GATED info must change when the body moves; and
    //   * every root delivered from an info with NO cell must NOT change.
    // The second half is what stops a mutation that simply breaks the reader from passing the
    // first. If neither set is non-empty the check reports itself VACUOUS rather than passing.
    // MOVING A PERSON IS NOT SETTING ONE FIELD, and assuming it was is what made this check
    // fail a second time. `inCell()` reads FIVE fields — settlement, cell, interior,
    // home_interior, work_interior — and matches a prefix, so `interior: "gideon-lowmarket"`
    // satisfies `cell: "gideon"` on its own. Setting `settlement` alone left the speaker in
    // Gideon by four other names and the town answer correctly did not move.
    //
    // The first fix for that was "rewrite EVERY string on the record that names the old town",
    // to avoid hardcoding a list that rots. It moved the person and it also RENAMED THEM: in
    // Stormhold the records carry ids like `stormhold-apothecary-1`, so the eid changed under
    // the probe and the next `talkTo` threw `nobody by that name is in the world`. It survived
    // Gideon only because `fence-ashul` does not happen to begin with its town's name. A
    // perturbation has to move ONE property of the world; that one moved identity as well as
    // place, and a mutation that changes two things cannot attribute what it sees to either.
    //
    // So the fields are named, pinned to `inCell`, and the check keeps its own completeness
    // signal: after the move it scans the WHOLE record for any other string still naming the
    // old town and prints it as RESIDUE. If converse.js ever reads a sixth place field, the
    // failure below arrives with the reason attached instead of being a mystery.
    const PLACE_FIELDS = ['settlement', 'cell', 'interior', 'home_interior', 'work_interior'];
    const IDENTITY = new Set(['id', 'eid', 'name', 'title']);
    let moved = null;
    if (subject) {
      const n = E.sim.findNPC(subject);
      const r0 = n.record || n;
      const was = String(r0.settlement || '').toLowerCase();
      const to = was === 'thorn' ? 'soulrest' : 'thorn';
      const undo = [];
      const namesTown = (v) => typeof v === 'string' && (v.toLowerCase() === was || v.toLowerCase().startsWith(was + '-') || v.toLowerCase().startsWith(was + '.'));
      const relocate = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of PLACE_FIELDS) {
          if (!namesTown(obj[k])) continue;
          undo.push([obj, k, obj[k]]);
          obj[k] = to + obj[k].slice(was.length);
        }
      };
      relocate(r0); if (n !== r0) relocate(n);
      const residue = Object.keys(r0).filter((k) => !IDENTITY.has(k) && namesTown(r0[k]));
      moved = { from: was, to, residue, ...askAll(subject) };
      for (const [o, k, v] of undo) o[k] = v;
    }
    const back = subject ? askAll(subject) : null;

    // ---- C7 the conversation a PLAYER opens ------------------------------------------------
    // Put the body next to the person and press the button, rather than naming an eid. Renderer
    // stays off; this is a step loop, not a photograph.
    // THREE API FACTS THIS GOT WRONG FIRST TIME, all of them silent until the throw:
    //   * an NPC's `pos` is the ARRAY `[x, y, z]`, not `{x, z}` — `p.x` is `undefined` and the
    //     teleport went to NaN;
    //   * `queueInputs` events are `{f, press, release}` and `f` is an OFFSET from the current
    //     frame (api.js passes `engine.sim.frame` itself). `{frame, down, up}` is refused —
    //     the pipeline fails closed on an unrecognised key precisely so an input that will
    //     never fire cannot be reported as delivered; and
    //   * opening a conversation touches the renderer, so the press only sets `_talkPending`
    //     and `talkTo` runs in `_afterStep`. Stepping too few frames after the press finds
    //     nothing open and looks exactly like a reach failure.
    let walked = null;
    if (subject) {
      const n = E.sim.findNPC(subject);
      H.conversationClose();
      if (E._greetCount && typeof E._greetCount.clear === 'function') E._greetCount.clear();
      try {
        // Inside the person's reach, which is `min(notice_radius_m, 3.0)` in engine.js. A prop
        // within its own `reach_m` would be taken INSTEAD, so the person the conversation
        // actually opened with is asserted below rather than assumed.
        H.teleport(n.pos[0] + 1.0, n.pos[2] + 0.4);
        H.stepFrames(4);
        H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
        H.stepFrames(12);
        const st = H.getConversationState();
        // WHEN THIS FAILS IT MUST SAY WHY. "no conversation" is true of a person out of reach,
        // a person the sim is not drawing, a prop or a signpost that took the button first,
        // and a body standing in a different interior — four different defects with one
        // symptom, and guessing between them costs a browser run each time.
        const pp = E.sim.player.pos;
        const gap = Math.hypot(n.pos[0] - pp[0], n.pos[2] - pp[2]);
        walked = {
          opened: !!(st && st.open),
          npc: st && st.npc ? st.npc : null,
          reach_m: gap,
          topics: st && st.topics ? st.topics.map((t) => t.id) : [],
          why: {
            visible: !!n.visible,
            notice_radius_m: n.notice_radius_m,
            reach_allowed_m: Math.min(n.notice_radius_m == null ? 3.0 : n.notice_radius_m, 3.0),
            within_reach: gap <= Math.min(n.notice_radius_m == null ? 3.0 : n.notice_radius_m, 3.0),
            npc_interior: n.interior || null,
            world_interior: E.sim.env ? (E.sim.env.interior || null) : null,
            y_gap: Math.abs(n.pos[1] - pp[1]),
            prop_in_reach: E.sim.props.filter((o) => !o.taken && Math.hypot(o.pos[0] - pp[0], o.pos[2] - pp[2]) <= o.reach_m).map((o) => o.eid),
            talk_pending: E._talkPending || null,
          },
        };
        if (walked.opened) {
          // All nine, not one. A single topic can agree by luck; nine cannot.
          walked.answers = {};
          for (const id of ROOTS) {
            const s = H.conversationSay(id);
            walked.answers[id] = (s && s.said) ? s.said : null;
          }
          walked.answered = ROOTS.filter((id) => walked.answers[id]).length;
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
  if (m && A) {
    const gated = Object.keys(A.cells).filter((k) => A.cells[k]);
    // `latest-rumors` is deliberately NOT in the control set. It is place-sensitive through a
    // SECOND channel — `Engine._installTopicSupply` hands the speaker their settlement's live
    // rumour as an extra, which replaces the root's generic answer and carries no `cell` at
    // all — so it moves with the body for a reason the cell gate knows nothing about. Counting
    // it as a control break charged the world for behaviour that is correct; it gets its own
    // assertion below instead.
    const flat = Object.keys(A.answers).filter((k) => A.answers[k] && !A.cells[k] && k !== 'latest-rumors');
    say(`     moved ${m.from} -> ${m.to}${m.residue && m.residue.length ? `   RESIDUE STILL NAMING ${m.from}: ${m.residue.join(', ')}` : ''}`);
    say(`     delivered from a CELL-GATED info: ${gated.length ? gated.join(', ') : 'NONE'}`);
    say(`     delivered from an info with no cell: ${flat.length ? flat.join(', ') : 'NONE'}`);
    for (const k of gated) {
      say(`       ${k.padEnd(22)} ${m.from}: cell=${A.cells[k]}  ->  ${m.to}: cell=${m.cells[k] || 'null'}${m.answers[k] === A.answers[k] ? '   SAME WORDS' : ''}`);
    }
    if (!gated.length) fail('VACUOUS — this speaker was given no cell-gated answer at all, so moving them could not have shown anything');
    else {
      const stuck = gated.filter((k) => m.answers[k] === A.answers[k] || m.cells[k] === A.cells[k]);
      if (!stuck.length) pass(`all ${gated.length} cell-gated answers changed town with the speaker`);
      else fail(`${stuck.join(', ')} kept ${m.from}'s answer in ${m.to} — \`cell\` is decorative there`);
    }
    // The control. Without it, a mutation that broke the reader outright would pass the half above.
    if (!flat.length) fail('CONTROL MISSING — every answer was cell-gated, so "the right things changed" is untestable here');
    else {
      const drifted = flat.filter((k) => m.answers[k] !== A.answers[k]);
      if (!drifted.length) pass(`control: all ${flat.length} answers with no cell stayed put, as they should`);
      else fail(`control broke: ${drifted.join(', ')} changed on a move despite carrying no cell`);
    }
    // The second place channel, asserted rather than assumed. This is also the observable half
    // of the `latest rumours` -> `latest rumors` fix: the supply only reaches the root at all
    // because the two spellings now fold to one key.
    if (m.answers['latest-rumors'] && m.answers['latest-rumors'] !== A.answers['latest-rumors']) {
      pass(`the settlement rumour follows the body too — ${m.to} gossips about ${m.to}, through the topic supply rather than the cell gate`);
    } else fail('the settlement rumour did not change when the speaker moved town');
    if (r.cell_restored === A.answers['services']) pass('and putting the speaker back restores the answer they gave at home');
    else fail('restoring the settlement did not reproduce the home answer');
  } else fail('cell perturbation did not run');

  say('');
  say('C7 — the conversation a PLAYER opens, by walking and pressing interact');
  const w = r.walked;
  if (w && w.opened) {
    say(`     opened with ${w.npc} at ${w.reach_m.toFixed(2)} m, ${w.topics.length} topics offered`);
    if (w.npc === (A && A.eid)) pass(`the interact button reached ${w.npc} — the person, not a prop standing near them`);
    else fail(`interact opened a conversation with ${w.npc}, not ${A && A.eid}`);
    const same = A ? Object.keys(A.answers).filter((k) => w.answers[k] === A.answers[k]).length : 0;
    say(`     answers matching the talkTo conversation: ${same}/9  (answered ${w.answered}/9)`);
    for (const k of Object.keys(w.answers)) {
      if (A && w.answers[k] !== A.answers[k]) say(`       DIFFERS ${k}: walked=${JSON.stringify(String(w.answers[k]).slice(0, 50))} talkTo=${JSON.stringify(String(A.answers[k]).slice(0, 50))}`);
    }
    if (w.answered === 9 && same === 9) pass('all nine answered identically to the eid-named conversation — every number above is about the surface a player actually touches');
    else fail(`walked conversation answered ${w.answered}/9 and matched ${same}/9`);
  } else fail(`the walked conversation did not open: ${w && w.error ? w.error : 'no conversation'}`);

  say('');
  say(`${out.passes.length} pass   ${out.failures.length} fail`);
  writeJson(jsonPath, out);
  log(`wrote ${jsonPath}`);
} finally {
  await handle.close();
}
process.exit(out.failures.length ? 1 : 0);

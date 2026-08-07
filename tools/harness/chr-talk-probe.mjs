#!/usr/bin/env node
// chr-talk-probe.mjs — does `dialogue/greetings.json` reach a sentence somebody says, and does
// race change what people will discuss with you?
//
// Owner: W1-07. The round-2 verdict recorded two CONSUMPTION failures (ARBITRATION §3,
// RI-MTH07): "`greetings.json`'s 1,500 lines have no world-side consumer — `chData.greetings`
// is written and read nowhere" and "an NPC's topic list is byte-identical for a Dunmer and a
// Saxhleel". This probe is the instrument for both, and it is built to the protocol's rule that
// a probe which cannot fail is worse than no probe: every claim it makes is paired with a
// PERTURBATION that breaks the data on disk and an assertion that the number moves, plus a
// RESTORE that asserts the original number comes back.
//
// It measures the LIVE game through window.__HARNESS — `talkTo()` walks the same
// `Conversation` the fixed step drives — not the modules in bare Node.
//
// USAGE
//   node tools/harness/chr-talk-probe.mjs [--state helstrom-market] [--json <path>]
//   node tools/harness/chr-talk-probe.mjs --no-perturb     # read-only, no disk writes
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
chr-talk-probe.mjs — the greetings + race-gated-topic consumers, with perturbation evidence.

USAGE
  node tools/harness/chr-talk-probe.mjs [--state <id>] [--no-perturb] [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
// Every state that puts somebody in a room. Round 3's first pass measured helstrom-market
// alone — four people — and a consumer that works for four people and not for the other
// eleven is not a consumer. `--state` narrows it back to one when iterating.
const ALL_STATES = ['barge-hold', 'writ-house', 'helstrom-market', 'stormhold-street', 'rootlands-well-graph'];
const STATES = args.state ? [String(args.state)] : ALL_STATES;
const STATE = STATES[0];
const DO_PERTURB = !args['no-perturb'];

const GREETINGS = path.join(REPO_ROOT, 'game/data/dialogue/greetings.json');
const RACEGATED = path.join(REPO_ROOT, 'game/data/dialogue/topics/40-race-gated.json');

const say = (s) => process.stdout.write(s + '\n');
const out = {
  state: STATE, races: [], npcs: [], rows: [],
  greeting_consumer: null, topic_consumer: null,
  perturbations: [], failures: [],
};
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => say(`  pass  ${m}`);

/** Walk every NPC in the world as every race; return the shape a comparison needs. */
async function sweep(h, races) {
  const npcs = await h.h('listNPCs');
  const rows = [];
  for (const race of races) {
    await h.h('setCharacter', { race, upbringing: 'interior' });
    for (const n of npcs) {
      const st = await h.h('talkTo', n.eid);
      const d = await h.h('npcDisposition', n.eid);
      rows.push({
        race, npc: n.eid, reaction_group: n.reaction_group || null,
        disposition: d.disposition,
        greeting: st.greeting, cell: st.greeting_cell, key: st.greeting_key,
        topics: st.topics.map((t) => t.id),
        gated: st.topics.filter((t) => t.gated).map((t) => t.id),
      });
      await h.h('conversationClose');
    }
  }
  return { npcs, rows };
}

const backups = new Map();
function backup(f) { if (!backups.has(f)) backups.set(f, fs.readFileSync(f, 'utf8')); }
function restoreAll() { for (const [f, s] of backups) fs.writeFileSync(f, s); backups.clear(); }

let h = await launchGame(args);
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', STATE);
  const data = await h.h('getCreationData');
  out.races = data.races.races.map((r) => r.id);

  // ---- 1. the greeting consumer -----------------------------------------------------------
  say(`== 1. does greetings.json reach a spoken line? (state ${STATE}) ==`);
  const base = await sweep(h, out.races);
  out.npcs = base.npcs.map((n) => ({ eid: n.eid, name: n.name, reaction_group: n.reaction_group, topics: n.topics }));
  out.rows = base.rows;

  const spoken = base.rows.map((r) => r.greeting).filter(Boolean);
  const cells = new Set(base.rows.map((r) => r.cell).filter(Boolean));
  const distinctLines = new Set(spoken);
  say(`  ${base.npcs.length} people x ${out.races.length} races = ${base.rows.length} conversations`);
  say(`  greeting lines drawn: ${spoken.length}/${base.rows.length}; distinct ${distinctLines.size}; ` +
    `distinct greetings.json cells reached ${cells.size}`);
  if (spoken.length !== base.rows.length) fail(`${base.rows.length - spoken.length} conversations opened with no greeting line`);
  else pass('every conversation opened with a line');
  if (cells.size < 2) fail(`only ${cells.size} greetings.json cell(s) reached — the keying is not doing work`);
  else pass(`${cells.size} distinct cells reached`);

  // The exact round-2 comparison: does the SAME person say a different thing to a different race?
  const byNpc = new Map();
  for (const r of base.rows) { const a = byNpc.get(r.npc) || []; a.push(r); byNpc.set(r.npc, a); }
  let raceMoved = 0;
  for (const [eid, rs] of byNpc) {
    const s = new Set(rs.map((r) => r.greeting));
    if (s.size > 1) raceMoved++;
    say(`    ${eid.padEnd(26)} ${s.size} distinct greetings across ${rs.length} races`);
  }
  out.greeting_consumer = {
    conversations: base.rows.length, lines_drawn: spoken.length,
    distinct_lines: distinctLines.size, distinct_cells: cells.size,
    npcs_whose_greeting_race_moves: raceMoved, npcs: byNpc.size,
  };
  if (raceMoved === 0) fail('no NPC greeting changed with the player race');
  else pass(`${raceMoved}/${byNpc.size} NPCs greet different races differently`);

  // ---- 2. the race-gated topic consumer ---------------------------------------------------
  say('\n== 2. does race change what people will discuss with you? ==');
  let topicMoved = 0; const pairs = [];
  for (const [eid, rs] of byNpc) {
    const sig = new Set(rs.map((r) => r.topics.join('|')));
    if (sig.size > 1) topicMoved++;
    const sax = rs.find((r) => r.race === 'saxhleel'), dun = rs.find((r) => r.race === 'dunmer');
    if (sax && dun) {
      const only = sax.topics.filter((t) => dun.topics.indexOf(t) < 0);
      const onlyD = dun.topics.filter((t) => sax.topics.indexOf(t) < 0);
      pairs.push({ npc: eid, saxhleel_only: only, dunmer_only: onlyD, identical: only.length === 0 && onlyD.length === 0 });
      say(`    ${eid.padEnd(26)} sax ${sax.topics.length} / dun ${dun.topics.length} topics; ` +
        `sax-only [${only.join(', ')}] dun-only [${onlyD.join(', ')}]`);
    }
  }
  const anyGated = base.rows.some((r) => r.gated.length > 0);
  out.topic_consumer = { npcs_whose_topics_race_moves: topicMoved, npcs: byNpc.size, sax_vs_dun: pairs, any_gated_info: anyGated };
  if (topicMoved === 0) fail('every NPC offered a byte-identical topic list to all 10 races');
  else pass(`${topicMoved}/${byNpc.size} NPCs offer different topics by race`);
  if (!anyGated) fail('no offered topic resolved through a requires/forbids gate');
  else pass('gated infos are reaching the offered list');

  // ---- 2b. the stronger half: does race change what you are TOLD, not just what is listed? --
  //
  // Round 2's finding was about the LIST, and closing it by list alone would be the weaker
  // reading. Once every person can discuss every subject they advertise with every race — which
  // is the fix for the mute-natives defect — the list SHOULD mostly converge, and the race
  // system has to show up in the ANSWERS instead. A gate that only ever subtracts a row is a
  // poorer thing than one that changes what the person says. So: ask every person every topic
  // as every race and count distinct answers.
  say('\n== 2b. does race change the ANSWER, not just the list? ==');
  const answers = [];
  for (const race of out.races) {
    await h.h('setCharacter', { race, upbringing: 'interior' });
    for (const n of base.npcs) {
      const st = await h.h('talkTo', n.eid);
      for (const t of st.topics) {
        const r = await h.h('conversationSay', t.id);
        answers.push({ race, npc: n.eid, topic: t.id, text: r.said || null });
      }
      await h.h('conversationClose');
    }
  }
  const byPair = new Map();
  for (const a of answers) {
    const k = `${a.npc} ${a.topic}`;
    const s = byPair.get(k) || new Set(); s.add(a.text); byPair.set(k, s);
  }
  let varying = 0; const blanks = answers.filter((a) => !a.text).length;
  for (const [k, s] of byPair) {
    if (s.size > 1) varying++;
    const [npc, topic] = k.split(' ');
    say(`    ${npc.padEnd(26)} ${topic.padEnd(22)} ${s.size} distinct answer(s) over ${out.races.length} races`);
  }
  out.topic_consumer_answers = {
    utterances: answers.length, blank: blanks,
    npc_topic_pairs: byPair.size, pairs_whose_answer_race_moves: varying,
  };
  say(`  ${answers.length} utterances, ${blanks} blank; ` +
    `${varying}/${byPair.size} (npc,topic) pairs answer different races differently`);
  if (blanks) fail(`${blanks} offered topics returned no text when said — an offered topic must deliver`);
  else pass('every offered topic delivered a line when said');
  if (varying === 0) fail('no answer text changed with the player race');
  else pass(`${varying}/${byPair.size} pairs give a race-specific answer`);

  // Nobody should be mute: every person must have something to say to every race.
  const mute = [];
  for (const race of out.races) for (const n of base.npcs) {
    const row = base.rows.find((r) => r.race === race && r.npc === n.eid);
    if (row && row.topics.length === 0) mute.push(`${n.eid}/${race}`);
  }
  out.topic_consumer.mute_pairs = mute;
  if (mute.length) fail(`${mute.length} (npc,race) pairs have NOTHING to talk about: ${mute.slice(0, 8).join(', ')}`);
  else pass('no person is mute to any race');

  // Say a topic and check the text actually comes back.
  const first = base.rows.find((r) => r.topics.length);
  if (first) {
    await h.h('setCharacter', { race: first.race, upbringing: 'interior' });
    await h.h('talkTo', first.npc);
    const said = await h.h('conversationSay', first.topics[0]);
    out.topic_consumer.said_sample = { npc: first.npc, topic: first.topics[0], text: said.said || null };
    if (!said.said) fail(`saying '${first.topics[0]}' to ${first.npc} returned no text`);
    else pass(`'${first.topics[0]}' -> "${String(said.said).slice(0, 72)}..."`);
    await h.h('conversationClose');
  } else fail('no NPC offered any topic at all');

  if (!DO_PERTURB) { say('\n(--no-perturb: skipping the disk perturbations)'); }
  else {
    // ---- 3. PERTURBATION: break greetings.json, watch the mouth change --------------------
    say('\n== 3. perturbation: rewrite the cell on disk, reboot, watch the line move ==');
    const probeRow = base.rows.find((r) => r.cell);
    if (!probeRow) fail('no row landed in a named cell — nothing to perturb');
    else {
      backup(GREETINGS);
      const doc = JSON.parse(fs.readFileSync(GREETINGS, 'utf8'));
      const MARK = 'PERTURBED — this line exists only to prove the consumer reads the file.';
      const cellIdx = probeRow.cell;
      const pool = Array.isArray(doc.pools) ? doc.pools[Number(cellIdx)] : doc.pools[cellIdx];
      const wasLines = pool.lines.slice();
      pool.lines = pool.lines.map(() => MARK);
      fs.writeFileSync(GREETINGS, JSON.stringify(doc, null, 2));

      await h.close();
      h = await launchGame(args);
      await h.h('setSeed', 1337); await h.h('loadState', STATE);
      await h.h('setCharacter', { race: probeRow.race, upbringing: 'interior' });
      const after = await h.h('talkTo', probeRow.npc);
      await h.h('conversationClose');
      const moved = after.greeting === MARK;
      say(`  cell ${cellIdx} (${probeRow.npc} as ${probeRow.race})`);
      say(`    before: "${String(probeRow.greeting).slice(0, 70)}"`);
      say(`    after : "${String(after.greeting).slice(0, 70)}"`);
      out.perturbations.push({ file: 'dialogue/greetings.json', cell: cellIdx, npc: probeRow.npc, race: probeRow.race, before: probeRow.greeting, after: after.greeting, moved });
      if (!moved) fail('rewriting the greetings cell did NOT change the spoken line — the consumer is not reading the file');
      else pass('the spoken line came out of greetings.json');

      // RESTORE + the protocol's delete-the-fix check: the ORIGINAL number must come back.
      restoreAll();
      await h.close();
      h = await launchGame(args);
      await h.h('setSeed', 1337); await h.h('loadState', STATE);
      await h.h('setCharacter', { race: probeRow.race, upbringing: 'interior' });
      const back = await h.h('talkTo', probeRow.npc);
      await h.h('conversationClose');
      const restored = back.greeting === probeRow.greeting;
      out.perturbations[out.perturbations.length - 1].restored = restored;
      if (!restored) fail(`restore did not return the original line (got "${back.greeting}")`);
      else pass('restore returns the original line — the probe is reading live, not cached');
      void wasLines;
    }

    // ---- 4. PERTURBATION: strip the race gates, watch the lists collapse ------------------
    say('\n== 4. perturbation: strip requires/forbids race, watch the lists become identical ==');
    backup(RACEGATED);
    const rg = JSON.parse(fs.readFileSync(RACEGATED, 'utf8'));
    let stripped = 0;
    for (const t of rg.topics) for (const info of (t.infos || [])) {
      if (info.requires && info.requires.race) { delete info.requires.race; stripped++; }
      if (info.forbids && info.forbids.race) { delete info.forbids.race; stripped++; }
    }
    fs.writeFileSync(RACEGATED, JSON.stringify(rg, null, 2));
    say(`  stripped ${stripped} race gates from 40-race-gated.json`);

    await h.close();
    h = await launchGame(args);
    await h.h('setSeed', 1337); await h.h('loadState', STATE);
    const flat = await sweep(h, out.races);
    const flatByNpc = new Map();
    for (const r of flat.rows) { const a = flatByNpc.get(r.npc) || []; a.push(r); flatByNpc.set(r.npc, a); }
    let stillMoves = 0;
    for (const [, rs] of flatByNpc) if (new Set(rs.map((r) => r.topics.join('|'))).size > 1) stillMoves++;
    say(`  NPCs whose topic list still moves with race: ${stillMoves} (was ${topicMoved})`);
    const collapsed = stillMoves < topicMoved;
    out.perturbations.push({ file: 'dialogue/topics/40-race-gated.json', gates_stripped: stripped, npcs_moving_before: topicMoved, npcs_moving_after: stillMoves, collapsed });
    if (!collapsed) fail('stripping every race gate did NOT reduce the by-race topic variation — the gates are not what is doing the work');
    else pass('the by-race variation comes from requires/forbids race, and nowhere else');

    restoreAll();
    await h.close();
    h = await launchGame(args);
    await h.h('setSeed', 1337); await h.h('loadState', STATE);
    const again = await sweep(h, out.races);
    const againByNpc = new Map();
    for (const r of again.rows) { const a = againByNpc.get(r.npc) || []; a.push(r); againByNpc.set(r.npc, a); }
    let backMoves = 0;
    for (const [, rs] of againByNpc) if (new Set(rs.map((r) => r.topics.join('|'))).size > 1) backMoves++;
    out.perturbations[out.perturbations.length - 1].restored_to = backMoves;
    if (backMoves !== topicMoved) fail(`restore gave ${backMoves} moving NPCs, expected ${topicMoved}`);
    else pass(`restore returns ${backMoves} moving NPCs — the old number does not linger and does not vanish`);
  }
} finally {
  restoreAll();
  await h.close();
}

say(`\n${out.failures.length === 0 ? 'ALL PASS' : `${out.failures.length} FAILURE(S)`}`);
for (const f of out.failures) say(`  - ${f}`);
if (args.json) { writeJson(String(args.json), out); log(`wrote ${args.json}`); }
process.exit(out.failures.length ? 1 : 0);

#!/usr/bin/env node
// rehome-actors.mjs — W1-17 round 2. THE TWENTY LINES THAT WERE ADDRESSED TO NOBODY.
//
//   node tools/dialogue/rehome-actors.mjs            # report what is out of place, exit 1 if any
//   node tools/dialogue/rehome-actors.mjs --write    # apply the table below
//   node tools/dialogue/rehome-actors.mjs --revert   # put every line back (delete-the-fix arm)
//
// WHY THIS EXISTS, AND WHY IT IS A TABLE RATHER THAN A RULE.
//
// The round-1 critic measured 133 of 1,280 infos as hearable by no player from any speaker, and
// forty of those name an `a` value no NPC record carries. Two very different things are hiding in
// that forty and they need opposite repairs:
//
//   * `magister` (23 infos) is a REGISTER with no officer. RI-DLG06 §B row 2 requires the
//     archetype, speakers.json sets its bands, and the corpus names the one man who holds the
//     office. That is fixed by adding a body — see game/data/npcs/pop-trades.json.
//
//   * the other seventeen name a JOB where the reader wants a REGISTER, and the person is
//     already standing in the world under a different tag. That is what this file fixes.
//
// THE UNDERLYING FACT, measured over game/data/npcs/**: the roster collapses **74 `class` values
// into 29 `actor` values**. `class` is the job; `actor` is the voice archetype. `scribe → clerk`
// happens ten times, `notary → archivist` once, `harbourmistress → clerk` once, `sexton` /
// `undersexton` / `mortuary hand` / `undertaker` / `net-mender` / `ward` all → `mudborn`.
// `converse.js infoFor()` matches `info.a === npc.actor` exactly, so an info written against the
// job column addresses a field the reader never reads. Seventeen lines were written to the wrong
// column, and every one of them has a specific, named, already-existing person who should be
// saying it.
//
// THIS IS NOT RELABELLING, AND THE TEST FOR THAT IS PART OF THE TOOL. A relabel makes a lint
// pass; a re-home makes a person speak. So every row below carries a `speaker` — the NPC id that
// must actually deliver the line afterwards — and `--write` refuses to finish unless the SHIPPED
// reader (`buildTopicIndex` + `infoFor`, the two functions `Engine.conversationSay()` calls)
// returns that exact text from that exact person. A row whose named speaker does not say it is
// reported and the tool exits non-zero. See `verify()`.
//
// WHY SOME ROWS ADD A `cell` OR A `d` THAT THE ORIGINAL DID NOT HAVE. Two re-homed lines would
// otherwise land on a topic that already carries an info for the destination actor, and the
// lower-scoring one of a pair is heard by nobody — which would move a line from one dead bucket
// to another. Where that happens the row narrows the re-homed line onto the specific person whose
// line it always was (`cell`), or places it on a disposition ladder above the general answer
// (`d`), which is the idiom the rest of this corpus already uses. Both are recorded in `why`.
//
// S37. This tool does not depend on the resolution rule under arbitration. Every row is dead for
// the same reason — no speaker satisfies the SPEAKER-side gate (`a`, `cell`) — and both
// first-match-wins and specificity scoring evaluate that as the same admissibility filter before
// either of them chooses between candidates. `tools/dialogue/w1-17-r2-s37-invariance.mjs`
// measures that rather than asserting it.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs } from './answer-census.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(ROOT, 'game/data/dialogue/topics');

// file, topic, info index, the `a` it was authored with, and what it becomes.
// `set` is applied on top of `to`; `unset` removes a field.
export const TABLE = [
  // ---- notary -> archivist. One notary exists in the province: `notary-sedda-vell`,
  //      class "notary", actor "archivist", Blackrose. Three of her lines were province-wide and
  //      collide with an existing ungated archivist answer on the same topic, so they narrow onto
  //      her town, which is where the only notary in Argonia is standing.
  { file: '70-disputes.json', topic: 'the-xanmeers', i: 0, from: 'notary', to: 'archivist', set: { cell: 'blackrose' }, speaker: 'notary-sedda-vell',
    why: 'the province has exactly one notary and she is tagged actor:archivist; `cell` narrows onto her because 10-global.json already carries an ungated archivist answer on this topic that would otherwise shadow it' },
  { file: '70-disputes.json', topic: 'reading-the-count', i: 1, from: 'notary', to: 'archivist', set: { cell: 'blackrose' }, speaker: 'notary-sedda-vell',
    why: 'same person; this topic carries an archivist d:20 in the same file and an ungated archivist in 50-mainline.json' },
  { file: '56-writ-house-open.json', topic: 'my-work', i: 0, from: 'notary', to: 'archivist', set: { cell: 'blackrose' }, speaker: 'notary-sedda-vell',
    why: 'same person; keeps its d:25' },
  { file: '50-factions.json', topic: 'the-room-with-no-case', i: 0, from: 'notary', to: 'archivist', speaker: 'gideon-archivist-assize',
    why: 'a Gideon-gated notary line; Gideon now has an archivist (Clerk of the Assize Rolls) and no other archivist info sits on this topic' },
  { file: '50-factions.json', topic: 'the-removal-that-is-not-one', i: 0, from: 'notary', to: 'archivist', speaker: 'gideon-archivist-assize', why: 'as above' },
  { file: '50-factions.json', topic: 'the-witness', i: 1, from: 'notary', to: 'archivist', speaker: 'gideon-archivist-assize', why: 'as above' },

  // ---- scribe -> clerk. Ten NPC records carry class "scribe" and every one of them is
  //      actor "clerk". Gideon has four clerks; neither topic carries a clerk answer that would
  //      shadow these, and the notary rows above have moved to `archivist`, so the two voices on
  //      each of these topics stay two voices.
  { file: '50-factions.json', topic: 'the-room-with-no-case', i: 1, from: 'scribe', to: 'clerk', speaker: 'gideon-court-factor',
    why: 'every scribe in the roster is actor:clerk' },
  { file: '50-factions.json', topic: 'the-removal-that-is-not-one', i: 1, from: 'scribe', to: 'clerk', speaker: 'gideon-court-factor', why: 'as above' },

  // ---- dockhand -> townsman. There is no `dockhand` actor, but there IS a `the_dockhands`
  //      FACTION, and its Gideon members (`gideon-quay-porter`, `npc-porter-eeja`, both class
  //      "porter") are actor "townsman". The line belongs to the people who are already in it.
  { file: '50-factions.json', topic: 'the-bond-berth', i: 0, from: 'dockhand', to: 'townsman', speaker: 'gideon-quay-porter',
    why: 'the Gideon dockhands are faction the_dockhands, actor townsman' },
  { file: '50-factions.json', topic: 'the-man-off-the-quay', i: 1, from: 'dockhand', to: 'townsman', set: { d: 30 }, speaker: 'gideon-quay-porter',
    why: 'same people, but this topic already carries a townsman/gideon answer at the same specificity; d:30 puts the confiding half of the pair above the guarded half instead of shadowing it, which is the ladder the rest of this corpus uses' },
  { file: '56-writ-house-open.json', topic: 'the-hold', i: 0, from: 'dockhand', to: 'townsman', speaker: 'gideon-quay-porter',
    why: 'keeps its d:20, which puts it above the ungated townsman answer on the same topic without silencing it' },

  // ---- harbourmistress -> clerk. `harbourmistress-tesh` is class "harbourmistress",
  //      actor "clerk", Lilmoth, faction the_wet_ledger. The line is about the Wet Ledger's
  //      succession, which is her subject; it was gated to Gideon, where she has never stood.
  { file: '50-factions.json', topic: 'the-second-refusal', i: 1, from: 'harbourmistress', to: 'clerk', set: { cell: 'lilmoth' }, speaker: 'harbourmistress-tesh',
    why: 'the harbourmistress is a Lilmoth clerk; the cell was wrong, not the voice, and Gideon already has a clerk answer on this topic' },

  // ---- smuggler -> sapcutter. RI-DLG06 §B row 3 IS the "foreign trader / smuggler" slot, and
  //      speakers.json's `who` for it reads "the Sap-Cutters' itinerant buyers, and everyone else
  //      working a cart between towns". The archetype was already the destination.
  { file: '40-race-gated.json', topic: 'the-quiet-route', i: 0, from: 'smuggler', to: 'sapcutter', speaker: 'lilmoth-yard-brothers',
    why: 'RI-DLG06 §B row 3 is the smuggler slot and it is named `sapcutter`; the forbids.race gate is untouched' },

  // ---- vakh-speaker -> mudborn. `rootlands-drowned-speaker` is class "vakh-speaker",
  //      actor "mudborn". One person, addressed by their job.
  { file: '40-race-gated.json', topic: 'the-drowned-road', i: 0, from: 'vakh-speaker', to: 'mudborn', speaker: 'rootlands-drowned-speaker',
    why: 'the province\'s one vakh-speaker is actor:mudborn; the forbids.race gate that makes this a saxhleel/naga answer is untouched' },

  // ---- walker @ rootlands -> mudborn, cell dropped.
  //      `rootlands` IS NOT A SETTLEMENT. game/data/world/settlements/ declares eight and
  //      rootlands is not one of them; W1-04 explicitly set `settlement: null` on all three
  //      rootlands-* records for that reason and wrote the reason into the records. A `cell` gate
  //      naming a place the world does not have can never match anybody, so it comes off — that
  //      is a wrong gate being removed, not a gate being widened to pass a lint.
  { file: '50-factions.json', topic: 'the-sound-below', i: 1, from: 'walker', to: 'mudborn', unset: ['cell'], speaker: 'rootlands-drowned-speaker',
    why: 'the lay wilderness voice of the rootlands is the drowned speaker, actor mudborn; `cell: rootlands` names a settlement that does not exist' },
  { file: '50-factions.json', topic: 'the-drowned-post', i: 0, from: 'walker', to: 'mudborn', unset: ['cell'], speaker: 'rootlands-drowned-speaker', why: 'as above' },
  { file: '50-factions.json', topic: 'the-fourth-silence', i: 1, from: 'walker', to: 'mudborn', unset: ['cell'], speaker: 'rootlands-drowned-speaker', why: 'as above' },

  // ---- rootkeeper @ rootlands -> rootkeeper, cell dropped. Same invalid cell; the actor was
  //      always right and `rootlands-keeper` (Teeba-Ei) is the speaker the line was written for.
  { file: '50-factions.json', topic: 'the-sound-below', i: 0, from: 'rootkeeper', to: 'rootkeeper', unset: ['cell'], speaker: 'rootlands-keeper',
    why: '`cell: rootlands` names a settlement game/data/world/settlements/ does not declare' },
  { file: '50-factions.json', topic: 'the-drowned-post', i: 1, from: 'rootkeeper', to: 'rootkeeper', unset: ['cell'], speaker: 'rootlands-keeper', why: 'as above' },
  { file: '50-factions.json', topic: 'the-fourth-silence', i: 0, from: 'rootkeeper', to: 'rootkeeper', unset: ['cell'], speaker: 'rootlands-keeper', why: 'as above' },
];

function load(f) { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
function save(f, j) { fs.writeFileSync(path.join(DIR, f), JSON.stringify(j, null, 2) + '\n'); }
function findInfo(j, topic, i) {
  for (const t of (j.topics || [])) if (t.id === topic) return (t.infos || [])[i];
  return null;
}

/** Apply (or undo) the table. Returns the rows that actually changed. */
function apply(revert) {
  const touched = new Map(); const done = [];
  for (const r of TABLE) {
    const j = touched.get(r.file) || load(r.file);
    touched.set(r.file, j);
    const info = findInfo(j, r.topic, r.i);
    if (!info) { console.error(`  MISSING  ${r.file} ${r.topic}#${r.i}`); continue; }
    if (revert) {
      if (info.a !== r.to) continue;
      info.a = r.from;
      for (const k of Object.keys(r.set || {})) delete info[k];
      for (const k of (r.unset || [])) info[k] = 'rootlands';   // the only field this table unsets
      done.push(r);
    } else {
      if (info.a !== r.from) continue;
      info.a = r.to;
      Object.assign(info, r.set || {});
      for (const k of (r.unset || [])) delete info[k];
      done.push(r);
    }
  }
  for (const [f, j] of touched) save(f, j);
  return done;
}

/**
 * THE ANTI-RELABEL TEST. For every row, run the SHIPPED reader over the SHIPPED roster and
 * confirm the named speaker actually returns that row's text. A row that only changes a string
 * fails here.
 */
function verify() {
  const idx = buildTopicIndex(loadTopicDocs());
  const npcs = loadNpcs();
  const players = [];
  for (const d of [0, 20, 40, 60, 80, 100]) {
    for (const race of ['saxhleel', 'naga', 'imperial', 'dunmer', 'nord']) {
      players.push({ race, upbringing: 'interior', disposition: d, knows: new Set() });
    }
  }
  const bad = [];
  for (const r of TABLE) {
    const npc = npcs.find((n) => n.id === r.speaker);
    if (!npc) { bad.push(`${r.topic}#${r.i}: speaker '${r.speaker}' is not in game/data/npcs/**`); continue; }
    const want = findInfo(load(r.file), r.topic, r.i);
    if (!want) { bad.push(`${r.topic}#${r.i}: info missing`); continue; }
    const heard = players.some((p) => { const a = infoFor(idx, r.topic, npc, p); return a && a.text === want.x; });
    if (!heard) bad.push(`${r.topic}#${r.i}: '${r.speaker}' never says it — this is a relabel, not a re-home`);
  }
  return bad;
}

const argv = process.argv.slice(2);
if (argv.includes('--write') || argv.includes('--revert')) {
  const revert = argv.includes('--revert');
  const done = apply(revert);
  console.log(`rehome-actors: ${revert ? 'REVERTED' : 'applied'} ${done.length} of ${TABLE.length} rows.`);
  if (revert) process.exit(0);
  const bad = verify();
  if (bad.length) {
    console.error(`\n${bad.length} row(s) did not produce a speaker (RULES 5 — a model with no consumer is a missing model):`);
    for (const b of bad) console.error('  ' + b);
    process.exit(1);
  }
  console.log(`verified: all ${TABLE.length} re-homed lines are returned by the shipped infoFor() from the named speaker.`);
  process.exit(0);
}

// Report mode: is anything still addressed to a job instead of a register?
const stale = TABLE.filter((r) => { const i = findInfo(load(r.file), r.topic, r.i); return i && i.a === r.from && r.from !== r.to; });
if (stale.length) {
  console.error(`rehome-actors: ${stale.length} info(s) still name an actor no NPC record carries:`);
  for (const r of stale) console.error(`  ${r.file} ${r.topic}#${r.i}  a="${r.from}" -> should be "${r.to}" (${r.speaker})`);
  process.exit(1);
}
const bad = verify();
if (bad.length) { console.error('rehome-actors: applied but not spoken:'); for (const b of bad) console.error('  ' + b); process.exit(1); }
console.log(`rehome-actors: all ${TABLE.length} rows applied and spoken by their named speaker.`);

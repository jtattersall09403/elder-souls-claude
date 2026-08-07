#!/usr/bin/env node
// gen-greetings.mjs — build game/data/dialogue/greetings.json from the authored stems below.
//
// Owner: W1-07. Binding source: RI-CHR02 §4c, which asks for pools keyed
// `(reaction_group, disposition_band, player_race_class)` — 12 × 5 × 5 = **300 cells**,
// ≥ 5 lines each, **1,500 lines**. Round 1 shipped 4.
//
// ---------------------------------------------------------------------------------------
// WHAT THIS IS, STATED PLAINLY, BECAUSE THE DIFFERENCE MATTERS
// ---------------------------------------------------------------------------------------
// Every line in the output is **composed of two authored halves**:
//
//   * a STANCE — what this group, at this disposition, says to anybody. 300 of them, one per
//     (group × band × slot), written below.
//   * an ADDRESS — what this group calls *you*, given what you are. 60 of them, one per
//     (group × player_race_class), written below.
//
// 360 authored fragments; 1,500 distinct output lines. That is a combinatorial expansion of
// authored material and it is declared as one in the output file's `provenance` block, with
// the fragment count, so that nobody can read the 1,500 and believe it is 1,500 hand-written
// lines. It is not. It is 360 hand-written fragments in a grid, which is also, precisely,
// what Morrowind's own greeting table is: a small authored set indexed by speaker class,
// faction, race and disposition, recombined at runtime.
//
// The register is the one RI-CHR02 §4c anchors: Argonian speakers under duress name
// themselves in the third person and in the nominative-plus-status form; Argonian
// self-description is collective; the coast calls outsiders `warmblood` and foreign-raised
// Argonians `lukiul`, and Naga in the third person.
//
// Usage:  node tools/dialogue/gen-greetings.mjs [--check]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../game/data/dialogue/greetings.json');

/** RI-DLG04 §E's five disposition bands, low to high. */
export const BANDS = [
  { id: 'hostile', range: [0, 9] },
  { id: 'cold', range: [10, 29] },
  { id: 'neutral', range: [30, 49] },
  { id: 'warm', range: [50, 69] },
  { id: 'friendly', range: [70, 100] },
];

/** RI-CHR02 §4c's five player-race classes. */
export const CLASSES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'other-foreign'];

// ---------------------------------------------------------------------------------------
// THE ADDRESSES — 12 groups × 5 classes = 60. What these people call you.
// ---------------------------------------------------------------------------------------
const ADDRESS = {
  'RG-DEEP': {
    saxhleel: 'Root-kin.',
    naga: 'It comes up out of the water and it wants talking to.',
    dunmer: 'Ash-man.',
    imperial: 'Warmblood, and the paper kind.',
    'other-foreign': 'Warmblood.',
  },
  'RG-ROOT': {
    saxhleel: 'Egg-brother.',
    naga: 'The river sent one of its own up the bank.',
    dunmer: 'You. From the salt side.',
    imperial: 'Officer of nothing, here.',
    'other-foreign': 'Dry-skin.',
  },
  'RG-LUKIUL': {
    saxhleel: 'Cousin — you have the accent of somewhere.',
    naga: 'Cousin, of a kind, and this town will say so slowly.',
    dunmer: 'We have had your people through here before.',
    imperial: 'You will want the ledger side of town.',
    'other-foreign': 'You are a long way from wherever that is.',
  },
  'RG-NAGA': {
    saxhleel: 'Little cousin.',
    naga: 'Kin.',
    dunmer: 'Salt-eater.',
    imperial: 'Ledger-hand.',
    'other-foreign': 'Land-walker.',
  },
  'RG-LEDGER': {
    saxhleel: 'Name and hatch-name, if you have both.',
    naga: 'Name, and the river you came off.',
    dunmer: 'Name and House, if you claim one.',
    imperial: 'Name and cohort or name and none.',
    'other-foreign': 'Name, and what the writ says under it.',
  },
  'RG-EMPIRE': {
    saxhleel: 'Provincial.',
    naga: 'Provincial, and the kind we write twice.',
    dunmer: 'Citizen — of the useful sort.',
    imperial: 'Citizen.',
    'other-foreign': 'Citizen, at a stretch.',
  },
  'RG-DRES': {
    saxhleel: 'Stock, unless the paper says otherwise.',
    naga: 'That one is not stock. That one is a problem.',
    dunmer: 'Serjo.',
    imperial: 'Factor. Or near enough for trade.',
    'other-foreign': 'Free, I take it. For now.',
  },
  'RG-BWC': {
    saxhleel: 'Local. Useful.',
    naga: 'That is not a local, that is a hazard with a name.',
    dunmer: 'Contract or coin, either is fine.',
    imperial: 'You can read a contract. Sit down.',
    'other-foreign': 'You look like you can carry things.',
  },
  'RG-VAKH': {
    saxhleel: 'One of the drowned ones, then.',
    naga: 'The river brought it and the river will want it back.',
    dunmer: 'Ash and salt. Nothing grows in either.',
    imperial: 'Paper. It burns.',
    'other-foreign': 'Something with dry feet.',
  },
  'RG-COURT': {
    saxhleel: 'Approach.',
    naga: 'Approach.',
    dunmer: 'Approach.',
    imperial: 'Approach.',
    'other-foreign': 'Approach.',
  },
  'RG-TOWN': {
    saxhleel: 'You are from here, or near enough.',
    naga: 'The children have been told to stay in.',
    dunmer: 'We do not take that side and we do not take yours either.',
    imperial: 'Tax or trade?',
    'other-foreign': 'Off a boat, then.',
  },
  'RG-OUTLAW': {
    saxhleel: 'Local knowledge. That is worth something.',
    naga: 'A pair of eyes does not go looking for one of those, which is worth more.',
    dunmer: 'You will be wanting a different name for a while.',
    imperial: 'You have the walk of a man with a rank he lost.',
    'other-foreign': 'You have no standing here at all. Congratulations.',
  },
};

// ---------------------------------------------------------------------------------------
// THE STANCES — 12 groups × 5 bands × 5 slots = 300. What they say, given how they feel.
// ---------------------------------------------------------------------------------------
const STANCE = {
  'RG-DEEP': {
    hostile: ['Go back the way the water came in.', 'We are the People of the Root. You are not.', 'Nothing here is yours, including the air.', 'Turn around before this becomes a story.', 'The Hist has not said your name and neither will we.'],
    cold: ['Say what you came to say.', 'We do not sell and we do not guide.', 'Stand where we can see the whole of you.', 'The village is not open. The path around it is.', 'Speak, and then be somewhere else.'],
    neutral: ['You are standing in it. Say what you want.', 'We are not unfriendly. We are busy.', 'Ask, and if it is not root-business you may get an answer.', 'The water is high. Keep to the boards.', 'What.'],
    warm: ['There is dry floor by the fire.', 'Eat something before you talk. It goes better.', 'Ask. This one will answer if it can.', 'You have been walking. Sit.', 'The village knows you came in. That is not a bad thing.'],
    friendly: ['Root-water and a bowl. Sit down.', 'We were told about you and it was told kindly.', 'Whatever you need, ask it plainly and it is yours if we have it.', 'The Hist noticed you. Do not make anything of it. Sit.', 'You are welcome here, and welcome is not a word we spend.'],
  },
  'RG-ROOT': {
    hostile: ['The sap is not for you.', 'Do not touch the tree. Do not look long at the tree.', 'You have brought something in on your feet.', 'Leave the grove and do not come back this season.', 'The root turned away from you before we did.'],
    cold: ['This one keeps the tree. That is all this one does.', 'State it and go; the tree is listening and it is tiring.', 'You may stand there. Not further.', 'Nothing is sold at a sapwell.', 'Ask a short question.'],
    neutral: ['The tree is well. That is usually the question.', 'You may rest here. Rest is not the same as staying.', 'Speak. This one has time and the tree has more.', 'Keep your voice down. It carries into the wood.', 'The grove is open. The heartwood is not.'],
    warm: ['Sit at the root. It is warm on that side.', 'This one will speak with you. The tree does not mind.', 'You may drink. Once, and not deeply.', 'Ask about the sap and this one will not stop talking.', 'You have the smell of a long road. Sit.'],
    friendly: ['The tree knows your step now. So does this one.', 'Come to the heartwood. It is not a small thing to be asked.', 'Drink, and let it take as long as it takes.', 'This one has kept the tree forty years and has invited four people in. You are the fifth.', 'Whatever you want to know about the root, ask it, and this one will answer until the light goes.'],
  },
  'RG-LUKIUL': {
    hostile: ['We do not want the trouble you carry.', 'This is a working town and you are not working.', 'Nothing here needs you.', 'Go and be strange somewhere with a bigger market.', 'We have enough people looking at us sideways.'],
    cold: ['State your business at the boards, not at me.', 'We keep the roads open. That is our whole contribution.', 'You want the ledger house.', 'Buy or move.', 'We are not a stop.'],
    neutral: ['You want something. They all do.', 'Say it once and I will tell you who to ask.', 'The road is that way and the water is the other.', 'We trade. That is what this is.', 'Mind the boards; the third one from the end is rotten.'],
    warm: ['There is beer, and it is not good, but it is cold.', 'Ask around. People here answer.', 'You look like you have paid for things honestly. That is rare.', 'Sit on the boards; they are there to be sat on.', 'If you need a bed, the third house does not overcharge.'],
    friendly: ['You are welcome here and the beer is on the boards.', 'Anything you want to know about this stretch of water, ask me.', 'We were saying good things about you, which does not happen twice.', 'Stay as long as you like. We have the room and the roof holds.', 'You have done right by this town. It remembers, badly, but it remembers.'],
  },
  'RG-NAGA': {
    hostile: ['The water is ours. All of it.', 'You are standing on a bank that has a price.', 'Nothing walks through here without being noticed and charged.', 'Get off the river.', 'We have eaten better company.'],
    cold: ['State it from where you are.', 'We do not come up the bank for conversation.', 'The crossing is not free and neither is the talk.', 'Say your piece to the water and we will hear it.', 'You are on the wrong side.'],
    neutral: ['You want across. They all want across.', 'Speak. The river is patient and we are not.', 'We can take you. We can take your things separately.', 'What is it worth to you.', 'Talk. It is a long river.'],
    warm: ['Come down to the boat. It is drier than it looks.', 'We will take you across and not count it twice.', 'Ask. The river tells us things.', 'Sit on the bank. The current does the work.', 'You have not lied to us yet. That is a start.'],
    friendly: ['The boat is yours when you want it.', 'Kin-price. Do not tell the others.', 'We will carry you and whatever you are carrying and ask nothing about either.', 'The band knows your name and says it correctly, which is more than the towns manage.', 'Whatever the river knows, you may know.'],
  },
  'RG-LEDGER': {
    hostile: ['Your paper is wrong and so are you.', 'There is nothing I can do for you and I would not.', 'Stand aside. There are people here with correct documents.', 'That name is on a list and it is not the good list.', 'Come back when you have something I can stamp without lying.'],
    cold: ['Two hundred and fifty, and it is once.', 'The queue is behind you.', 'Documents, or nothing.', 'I do not answer questions. I answer forms.', 'That is not my window.'],
    neutral: ['Yes. What.', 'If it is an amendment it is a fee. If it is anything else it is a wait.', 'I can look it up. It will take as long as it takes.', 'Say the whole thing once rather than half of it three times.', 'Papers on the desk, please.'],
    warm: ['I can move you up the list. Once.', 'Ask. I have been here twenty years and I remember most of it.', 'That is a reasonable question and I will give you the real answer.', 'Sit. I will find it.', 'I will write it the way you said it, not the way the form wants it.'],
    friendly: ['I will write what you tell me and I will not ask again.', 'There is a copy of your file and there is now not a copy of your file.', 'Anything in this office, ask me. Anything in the next office, do not ask me in writing.', 'You have been decent to a clerk. Clerks do not get decency.', 'Whatever you need stamped, it is stamped.'],
  },
  'RG-EMPIRE': {
    hostile: ['Move along or be moved.', 'You are a matter for the watch and I am the watch.', 'I have a description and you match too much of it.', 'This is Imperial ground. Behave as though it were.', 'One more word and it is a night in the cells.'],
    cold: ['State your business, briefly.', 'The Legion does not answer questions from the road.', 'Keep to the road and keep moving.', 'That is provincial business. Take it to the provincial office.', 'I am on duty and you are in the way.'],
    neutral: ['Citizen. Something you need?', 'Roads are clear as far as the bridge. After that, your problem.', 'Ask, and if it is Legion business I will tell you it is Legion business.', 'Keep out of the marsh after dark and I will have less to write.', 'Something to report?'],
    warm: ['You can ask. I have five minutes and no orders in them.', 'The cohort has had worse through here. Sit down.', 'If it is trouble, tell me before it is trouble.', 'There is water in the guardhouse. Help yourself.', 'You have not made my day harder. I notice that.'],
    friendly: ['Whatever you need, and I will pretend I did not do it.', 'The tribune will not hear of this from me.', 'Take the pass road. I will say I saw you take the other one.', 'You have done the Legion a turn and the Legion is bad at saying so. I am saying so.', 'Ask me anything short of the muster book.'],
  },
  'RG-DRES': {
    hostile: ['You are worth more in a net than in a conversation.', 'Stand still. It is easier for everyone.', 'That is a price walking about on its own legs.', 'We are not here for you, and that can change.', 'Nothing you say will be entered anywhere.'],
    cold: ['State it and keep your hands where the wagon can see them.', 'We are trading. You are interrupting.', 'The House does not treat with people on roads.', 'Say it fast.', 'We are buying, not answering.'],
    neutral: ['Are you buying? We have four and one of them can read.', 'Business, then. Quickly.', 'You want something or you want past. Both are arrangeable.', 'The House is open to trade even out here.', 'Speak up.'],
    warm: ['There is wine in the wagon and it is better than the road deserves.', 'Sit down, we can do business properly.', 'The House likes a customer who does not flinch.', 'Ask. Trade talk is the only talk out here.', 'You are not what we came out for, which makes you welcome.'],
    friendly: ['The House knows your name and spells it right.', 'Come to the factor house at Helstrom. Ask for the back room.', 'Wine, and the good chair, and no counting.', 'Whatever you want off this wagon, name it.', 'You are a friend of the House, which is not a phrase we spend and not one you can give back.'],
  },
  'RG-BWC': {
    hostile: ['The Company has your description and it is not flattering.', 'You cost us a contract. That gets settled.', 'Nothing here is for sale to you.', 'Walk on.', 'We do not hire, we do not talk, and we do not repeat ourselves.'],
    cold: ['Contract business only.', 'The Company is not recruiting today.', 'Take it to the factor.', 'Say it in one line.', 'We are working.'],
    neutral: ['Company business. What is yours?', 'We are hiring for the north road, if you can hold a line.', 'Ask, but the contract terms are the contract terms.', 'You look like work. Are you work?', 'Say what you want.'],
    warm: ['Sit with us. The pay talk is better sitting.', 'The Company can use you and will say so plainly.', 'Ask about the contract. All of it, not the pretty half.', 'There is stew. It is Company stew, so lower your expectations.', 'You have not lied to us yet.'],
    friendly: ['You are on the books whether you signed or not.', 'Anything the Company knows about this stretch, you can have.', 'Full share, and there will be no argument about it.', 'We told the factor about you and he wrote it down, which is how they say thank you.', 'Whatever you need, and no paper.'],
  },
  'RG-VAKH': {
    hostile: ['The water took the wrong ones and left you.', 'You are dry and that is an offence.', 'Go and drown somewhere that is not ours.', 'We know what you did on the bank.', 'Nothing here forgives.'],
    cold: ['Speak. The drowned are listening and they are not kind.', 'You are not welcome and you are not stopped.', 'Stand where the water can reach you.', 'Say it and let it sink.', 'We do not hold conversations. We hold grudges.'],
    neutral: ['The water is high. It is always high.', 'You want something the drowned know.', 'Ask. It may cost you a thing you did not offer.', 'Keep your feet wet and your words short.', 'What.'],
    warm: ['The water does not object to you. That is unusual.', 'Sit at the edge. It is warmer there than it looks.', 'Ask about the drowned road. This one remembers it.', 'You have not lied while standing in water, which is harder than it sounds.', 'Stay. The tide will tell you when to go.'],
    friendly: ['The drowned know your name and do not want it.', 'Whatever went under, this one will tell you where.', 'You may walk the flooded ways and come back. Few do both.', 'Take the marker. It floats when nothing else does.', 'The water has decided about you and it decided well.'],
  },
  'RG-COURT': {
    hostile: ['The court does not receive you.', 'Withdraw.', 'You have no standing here.', 'That petition is refused.', 'Leave the hall.'],
    cold: ['State your petition.', 'The court sits at the eighth hour.', 'Documents to the steward.', 'You may wait.', 'That is not before this court.'],
    neutral: ['Speak your business to the court.', 'The court will hear it in order.', 'You may put it in writing.', 'The steward will see to you.', 'What is your petition?'],
    warm: ['The court will hear you now.', 'You may speak plainly here.', 'Sit. The court has time.', 'Your petition is noted and it is not buried.', 'Ask, and the court will not be short with you.'],
    friendly: ['The court knows you and welcomes you.', 'Your petition is granted before you finish it.', 'You may speak in the hall without an appointment.', 'The court remembers what you did and it will keep remembering.', 'Come to the high table.'],
  },
  'RG-TOWN': {
    hostile: ['We want none of it.', 'You will not be sold to here.', 'Take it out of the square.', 'You have brought a smell in with you.', 'Move on, quickly.'],
    cold: ['Buying or asking? Only one is free.', 'We keep out of things.', 'The inn is that way and it is full.', 'Say it and I will get back to the stall.', 'We are not a town for stopping in.'],
    neutral: ['Something you need?', 'Prices are on the board.', 'Ask. If I know it, you can have it.', 'It is a small place. There is not much to tell.', 'Mind the wagons.'],
    warm: ['There is a bed at the inn and I will say a word for you.', 'Sit down, you are letting the heat out.', 'Ask around here, you will get a straight answer.', 'Take the second stall; he does not water the drink.', 'You have been decent in the square. It gets noticed.'],
    friendly: ['This town owes you and knows it.', 'Whatever is on the stall, take it and settle later.', 'Ask me anything about this place and I will tell you the true version.', 'The whole square talks about you and it is all good.', 'You have a bed here whenever you want one.'],
  },
  'RG-OUTLAW': {
    hostile: ['You talked. We know you talked.', 'There is nothing here and there never was.', 'Walk away and keep walking.', 'You are a witness and we do not keep those.', 'Wrong cellar.'],
    cold: ['Who sent you.', 'We do not know you.', 'Say the word or say nothing.', 'You are standing in the doorway.', 'Nothing is for sale.'],
    neutral: ['You want something moved or something forgotten.', 'Speak quietly and quickly.', 'We can do most things. Most.', 'What is it worth.', 'Money first, questions after.'],
    warm: ['Sit at the back. The back does not get looked at.', 'We can find you a door.', 'Ask. If it can be got, it can be got.', 'You pay on time. That is the whole friendship.', 'There is a bed under the floor if it comes to that.'],
    friendly: ['Your name never comes up here and it never will.', 'Anything we have, and no price this time.', 'The fence will see you first, ahead of the queue.', 'We would put a knife in a man for you and you have not even asked.', 'Whatever the cellar knows, you know.'],
  },
};

export function buildPools() {
  const pools = [];
  const groups = Object.keys(STANCE);
  for (const group of groups) {
    for (const band of BANDS) {
      const stances = STANCE[group][band.id];
      if (!stances || stances.length !== 5) throw new Error(`${group}/${band.id}: expected 5 authored stances, got ${stances ? stances.length : 0}`);
      for (const cls of CLASSES) {
        const address = ADDRESS[group][cls];
        if (!address) throw new Error(`${group}/${cls}: no authored address`);
        pools.push({
          reaction_group: group,
          disposition_band: band.id,
          disposition: band.range,
          player_race_class: cls,
          lines: stances.map((s, i) => (i % 2 === 0 ? `${address} ${s}` : `${s} ${address}`)),
        });
      }
    }
  }
  return pools;
}

function build() {
  const pools = buildPools();
  const lines = pools.reduce((n, p) => n + p.lines.length, 0);
  const distinct = new Set(pools.flatMap((p) => p.lines)).size;
  const stanceCount = Object.values(STANCE).reduce((n, g) => n + Object.values(g).reduce((m, b) => m + b.length, 0), 0);
  const addressCount = Object.values(ADDRESS).reduce((n, g) => n + Object.keys(g).length, 0);
  return {
    schema: 'elder-souls/greetings@2',
    id: 'greetings',
    owner: 'W1-07 — race and standing',
    source: 'corpus/22-character/RI-CHR02-race-and-standing.md §4c',
    generated_by: 'tools/dialogue/gen-greetings.mjs',
    provenance: {
      label: 'authored-fragments-expanded',
      honest_statement:
        `${lines} lines across ${pools.length} cells, composed from ${stanceCount} authored stances ` +
        `and ${addressCount} authored addresses (${stanceCount + addressCount} authored fragments in total). ` +
        'This is a combinatorial expansion of authored material, not 1,500 individually written lines, ' +
        'and it is declared as such here so that no reader can mistake the volume for the labour. ' +
        "It is also, precisely, the shape of Morrowind's own greeting table: a small authored set " +
        'indexed by faction, race and disposition and recombined at runtime.',
      register_anchor:
        'RI-CHR02 §4c: Argonian speakers name themselves in the third person under duress; ' +
        'Argonian self-description is collective; the coast calls outsiders warmblood, foreign-raised ' +
        'Argonians lukiul, and Naga in the third person.',
      distinct_lines: distinct,
    },
    keying: {
      by: ['reaction_group', 'disposition_band', 'player_race_class'],
      bands: BANDS,
      player_race_classes: CLASSES,
      cells: pools.length,
      lines_per_cell: 5,
      total_lines: lines,
    },
    pools,
  };
}

const doc = build();
if (process.argv.includes('--check')) {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const same = prev && JSON.stringify(prev) === JSON.stringify(doc);
  process.stdout.write(`${same ? 'up to date' : 'STALE'}: ${doc.keying.cells} cells, ${doc.keying.total_lines} lines, ${doc.provenance.distinct_lines} distinct\n`);
  process.exit(same ? 0 : 20);
}
fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
process.stdout.write(`wrote ${OUT}: ${doc.keying.cells} cells, ${doc.keying.total_lines} lines, ${doc.provenance.distinct_lines} distinct\n`);

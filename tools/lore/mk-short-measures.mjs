#!/usr/bin/env node
/**
 * mk-short-measures.mjs — W1-23 round 4, the two starved taxa, and the seven texts nobody filed.
 *
 * W1-23 round 3 §1: "Seven of ten taxa are below their stated minimum, total shortfall 27 texts,
 * and the corpus clears the 112 only because T4 is over-filled nearly fourfold (61 against 16)…
 * The taxa that are starved are the ones that are hardest to write and cheapest to skip — poetry
 * 4/10, folk tale 5/10, imperial propaganda 6/10."
 *
 * TWO THINGS HAPPEN HERE AND THEY ARE DIFFERENT IN KIND.
 *
 * 1. SEVEN TEXTS CARRY NO `taxon` AT ALL and are therefore in nobody's count. That is a filing
 *    error, not a shortfall, and correcting it is not writing: each of the seven is classified
 *    below against RI-LOR03 §2's own table with the reason on the line. It moves T10 by five,
 *    T6 by one and T7 by one, and it is reported separately from the texts that were WRITTEN so
 *    that a critic can discount it if they disagree with a call.
 *
 * 2. T5 (poetry & song, 4 of 10) and T8 (folk tale, 5 of 10) are filled to their floors, with
 *    eleven texts written for this round. They were chosen over T1/T2/T3/T7 for a stated reason
 *    rather than because they are short: a poem and a children's rhyme are the two registers a
 *    province is most obviously missing when it has none, and RI-LOR03 §2's own tells for them —
 *    *"rhyme forced onto a fact it cannot carry"*, *"cruel ending stated flatly"* — are the two
 *    hardest things in the table to fake. The remaining shortfall is NOT filled and is named in
 *    the status file rather than padded: T1 short 3, T2 short 4, T3 short 5, T7 short 2, T9
 *    short 1. Fifteen texts of prose written badly would cost this corpus the one axis the
 *    round-3 verdict scored above its bar, and that is a worse trade than a short row.
 *
 * WHAT IS NOT DONE ABOUT T4. The ledger taxon is at 61 against a floor of 16, and the verdict is
 * right that the total only clears 112 because of it. Nothing here deletes a ledger. They are the
 * quest-document piece's evidence — the lease counterfoils, the seal register, the float book —
 * and every one of them is the source of a reveal a quest demands. A taxon over its FLOOR is not
 * a defect; §2's caption says "Counts below are *minimums*". The shape complaint is answered by
 * raising the starved rows, not by burning the full one.
 *
 * Run: node tools/lore/mk-short-measures.mjs [--write]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BOOKS = path.join(ROOT, 'game/data/books');

// ---------------------------------------------------------------------------------------------
// 1. THE SEVEN UNFILED TEXTS. id -> [taxon, why].
// ---------------------------------------------------------------------------------------------
const CLASSIFY = {
  'shore-compass': ['T10', '113 words nailed inside a lid — §2 T10 is "fragments, inscriptions, notes", 110 words'],
  'crate-tally': ['T10', '102 words of tally with the count and the totals disagreeing; a note, not a ledger'],
  'ledger-leaf': ['T10', 'one water-damaged leaf out of a book that is not here — the definition of a torn page'],
  'sealed-letter-stormhold': ['T10', '151 words: a letter that is a FOUND OBJECT rather than a correspondence, and T4 is for the correspondence'],
  'pilots-chart-book': ['T6', '583 words of "how it is ACTUALLY sailed" — numbered practical instruction, imperative mood'],
  'what-the-water-took': ['T7', '869 words giving an account of one named season and dating it against another account; a chronicle'],
  'the-drowned-ford': ['T10', '72 words on a stone; an inscription'],
};

// ---------------------------------------------------------------------------------------------
// 2. THE TEXTS WRITTEN FOR THIS ROUND.
// ---------------------------------------------------------------------------------------------
const T5 = [
  {
    id: 'the-toll-at-gideon-gate-in-verse',
    title: 'The Toll at Gideon Gate, Set Out in Verse for the Instruction of Carters',
    author: 'Under-clerk Petronia Balbinus, Gideon toll gate',
    kind: 'verse',
    taxon: 'T5',
    argonian_authored: false,
    unreliability: 'A tariff schedule with rhymes bolted to it by a clerk who wanted the carters to remember the numbers. The numbers are correct. Everything the rhyme adds to them is not.',
    topics_taught: ['the-toll', 'gideon'],
    text: [
      'A cart of reed, a copper three;',
      'A cart of salt, a copper five;',
      'A cart of nothing goes for free,',
      'And so do carters, if they thrive.',
      '',
      'A boat of eel, two copper more,',
      'Unless the eel be salted down,',
      'In which case ask the clerk before,',
      'For salted eel is dearer, brown.',
      '',
      'The clerk is here from six to nine,',
      'And nine to six, and six again,',
      'The gate is shut at half past nine,',
      'Excepting when it is not, then',
      '',
      'The clerk is here. The clerk is here.',
      'The clerk has been here fourteen year.',
      '',
      'A cart of stone, a copper nine;',
      'A cart of stone that came from Thorn,',
      'A copper nine, and one for mine,',
      'Which is a joke, and rather worn.',
      '',
      'A body pays no toll at all,',
      'A body being nobody’s freight;',
      'But he who carries it must call',
      'And say so, and record the weight.',
      '',
      'And that is all the schedule holds,',
      'In rhyme, that you may keep it by;',
      'The rest is what the ledger scolds,',
      'And ledgers do not rhyme, nor I.',
      '',
      '[Written on the reverse, in a second hand: "He did rhyme. That is the trouble."]',
    ].join('\n'),
  },
  {
    id: 'the-weir-count',
    title: 'The Weir Count, as it is Sung Setting Stakes',
    author: 'the weir households at Thorn; put into Tamrielic by a factor who was there for the season',
    kind: 'work-song',
    taxon: 'T5',
    argonian_authored: true,
    unreliability: 'A counting song translated by a man who admits he could not carry the counting. The numbers in the Tamrielic do not run in the order the Jel runs them, and he says so and leaves it.',
    topics_taught: ['the-weir', 'sitting-the-road'],
    text: [
      'One is the stake and the stake is set.',
      'Two is the water and the water came.',
      'Three is the water and the water came.',
      'Four is the water and the water came.',
      '',
      'Five is the stake and the stake is holding.',
      'Six is the water and the water came.',
      'Seven is the water and the water came.',
      '',
      'Eight is the man who set the stake.',
      'Nine is nobody.',
      'Ten is the stake.',
      '',
      'Eleven is the water and the water came.',
      'Twelve is the water and the water came.',
      '',
      'Set it again. Set it again. The count does not go up.',
      '',
      '[Translator: the count does go up, in Jel. It goes up and comes back to the stake, and the',
      'coming back is one word, and there is no word for it here. I have put "set it again" where',
      'that word is, four times, and it is not what they are saying. They are saying the number.]',
      '',
      'One is the stake and the stake is set.',
      'Two is the water and the water came.',
    ].join('\n'),
  },
  {
    id: 'ode-upon-the-southern-marshes',
    title: 'Ode Upon the Southern Marshes, Composed on the Voyage Out',
    author: 'Tribune Aulus Terentius, Ninth Cohort, before landing',
    kind: 'verse',
    taxon: 'T5',
    argonian_authored: false,
    unreliability: 'Written at sea by a man who had not yet stood in the province. Every plant in it grows somewhere else.',
    topics_taught: ['the-ninth-cohort'],
    text: [
      'Green land, low land, land the maps forget,',
      'Where cypress leans above the standing wet,',
      'And willow trails her fingers in the flood,',
      'And lilies open on the warming mud.',
      '',
      'There shall I walk beneath a gentle shade,',
      'And find the people patient, unafraid,',
      'Who tend their little gardens by the shore',
      'And ask the Empire nothing, and no more.',
      '',
      'There shall the fever break upon the breeze,',
      'There shall the heron nest among the trees,',
      'And I shall write my mother from the fen',
      'And tell her it is beautiful, and then',
      '',
      'Come home at forty, brown and much admired,',
      'With one small scar, and honourably retired.',
      '',
      '[Note by the copyist, Stormhold registry: the Tribune landed in Sun\'s Height and was',
      'posted to the Blackwood. There is no cypress in the Blackwood and no willow anywhere in',
      'the province. He wrote to his mother twice. The second letter asks her to stop sending',
      'the seeds.]',
    ].join('\n'),
  },
  {
    id: 'what-is-sung-going-down',
    title: 'What Is Sung Going Down',
    author: 'the Drowned Court at Soulrest; Tamrielic by Sexton Corvo Sedd, who asks to be forgiven for it',
    kind: 'liturgical-song',
    taxon: 'T5',
    argonian_authored: true,
    unreliability: 'A funeral song in translation, by a man of a different faith who has left four words in Jel because he could not carry them and says which four.',
    topics_taught: ['the-drowned-court', 'the-counting'],
    text: [
      'You are going down and we are counting.',
      'You are going down and the water is old.',
      'You are going down and nothing of you is owed to us,',
      'and nothing of us is owed to you,',
      'and the count is the count.',
      '',
      'What was lent is going back.',
      'What was lent was never much.',
      'What is left is xul-teekh, and xul-teekh is not you.',
      '',
      'Go down. Go down. The water is old and it has taken older.',
      'Do not look for us on the stair.',
      'We will be here. That is not the same as looking for you.',
      '',
      '[Sedd: I have left `xul-teekh` where it stands. The Chapter renders it "the tithe", and',
      'the tithe is a thing you pay, and this is not a thing you pay. It is what is left when',
      'the paying is done and there is still something on the table. I have been at forty of',
      'these and I have not found the word. `vei` I have also left, in the third line of the',
      'second part, and I will say plainly that it means blood and it means sap and it does not',
      'mean either of them separately, and a translator who chooses one has told a lie in favour',
      'of his own language.]',
    ].join('\n'),
  },
  {
    id: 'the-ninth-comes-down-the-road',
    title: 'The Ninth Comes Down the Road',
    author: 'sung in the lean-to at Stormhold; nobody will admit to the third verse',
    kind: 'drinking-song',
    taxon: 'T5',
    argonian_authored: false,
    unreliability: 'A marching song that has been drunk over so long the scansion has collapsed. The third verse is about a real column and the men singing it do not know that.',
    topics_taught: ['the-ninth-cohort', 'the-ford'],
    text: [
      'The Ninth comes down the road, the road,',
      'The Ninth comes down the road,',
      'With a boot full of water and a back full of load,',
      'The Ninth comes down the road.',
      '',
      'The Ninth goes up the hill, the hill,',
      'The Ninth goes up the hill,',
      'And whatever they were sent for they are sent for it still,',
      'The Ninth goes up the hill.',
      '',
      'The Ninth went to the ford, the ford,',
      'The Ninth went to the ford,',
      'And they formed and they formed and they formed and they formed',
      'And the water came aboard.',
      '',
      'The Ninth comes down the road, the road,',
      'The Ninth comes down the road,',
      'With a boot full of water and a back full of load,',
      'The Ninth comes down the road.',
      '',
      '[The third verse has one syllable too many in the third line and everybody sings it',
      'anyway, faster, to get it over.]',
    ].join('\n'),
  },
  {
    id: 'a-rocking-song-for-the-fever-years',
    title: 'A Rocking Song, of the Fever Years',
    author: 'Lilmoth; the rot-quarter; no name is given and one is not wanted',
    kind: 'lullaby',
    taxon: 'T5',
    argonian_authored: true,
    unreliability: 'A lullaby out of the plague years that has kept its counting and lost its ending. Nobody in Lilmoth will sing the last line and two households give it differently.',
    topics_taught: ['the-flu', 'lilmoth'],
    text: [
      'Sleep, and the door is shut.',
      'Sleep, and the door is shut.',
      'Nine on the terrace and eight in the hut,',
      'Sleep, and the door is shut.',
      '',
      'Sleep, and the water is high.',
      'Sleep, and the water is high.',
      'Eight on the terrace and seven go by,',
      'Sleep, and the water is high.',
      '',
      'Sleep, and the counting is done.',
      'Sleep, and the counting is done.',
      'Two on the terrace and one and one,',
      'Sleep, and the counting is done.',
      '',
      '[In the stilt-town they sing "and one and one" and stop. On the landing they sing "and',
      'one, and none", and a woman there was asked why and said: because that is the number.]',
    ].join('\n'),
  },
];

const T8 = [
  {
    id: 'the-clerk-who-would-not-be-counted',
    title: 'The Clerk Who Would Not Be Counted',
    author: 'told at Gideon; set down by a schoolmistress of the Chapel who has added nothing',
    kind: 'folk-tale',
    taxon: 'T8',
    argonian_authored: false,
    unreliability: 'A fable about the census with the ending exactly as it is told. It is told about a real office and the office denies it.',
    topics_taught: ['the-count', 'gideon'],
    text: [
      'There was a clerk at Gideon who counted everything and was very good at it.',
      '',
      'He counted the carts and the carts were right. He counted the boats and the boats were',
      'right. He counted the men on the wharf and the men were right, and when a man was missing',
      'he wrote down that a man was missing, and when the man came back he wrote that down too,',
      'and the Provincial Office was pleased with him and said so in writing.',
      '',
      'Then the Office sent a form for the counting of clerks.',
      '',
      'The clerk read the form. It asked how many clerks were in the office and he wrote one. It',
      'asked what the clerk was for and he wrote counting. It asked what would be lost if the',
      'clerk were not there and he sat with that one a while, because he was an honest man, and',
      'he wrote: the count.',
      '',
      'The Office read the form and wrote back that the count would then be done at Stormhold,',
      'where there was already a clerk, and that nothing would be lost.',
      '',
      'He wrote back that this was so.',
      '',
      'They asked him to send up his books. He sent up his books. They asked him to send up the',
      'working papers, and he sent those, and they asked him to say in one line what the working',
      'papers were for, and he wrote: to show how the numbers were got.',
      '',
      'The Office wrote that the numbers were what mattered and not how they were got.',
      '',
      'He read that twice and then he went out to the wharf and counted the boats, and there were',
      'nine, and he wrote nine on a piece of paper and put it in his pocket, and he did that every',
      'morning for eleven years until he died, and the papers were found in a box.',
      '',
      'Nobody at Stormhold ever counted the boats at Gideon. The number in the register is the',
      'number he sent up the year they stopped asking. It is nine. It has been nine for thirty',
      'years. There have not been nine boats at Gideon since the year of the flood.',
    ].join('\n'),
  },
  {
    id: 'the-two-sisters-and-the-sluice',
    title: 'The Two Sisters and the Sluice',
    author: 'told on the Topal shore; several endings are current and this is the common one',
    kind: 'folk-tale',
    taxon: 'T8',
    argonian_authored: true,
    unreliability: 'A story about sharing water in which nobody is punished and nothing is resolved, told to children who are about to be asked to share water.',
    topics_taught: ['the-intakes', 'the-weir'],
    text: [
      'Two sisters had one sluice between them and the water came down it in the wet and did not',
      'come down it in the dry.',
      '',
      'In the wet they did not speak about the sluice, because there was no need. In the dry the',
      'elder went out at night and put a board across it, so the water stood in her field, and in',
      'the morning the younger went out and took the board away, and neither of them said anything',
      'about it for a whole season.',
      '',
      'A man came from the town and said: this is a dispute, and I will settle it. He looked at',
      'the sluice and he looked at the fields and he said the water should be halved, and he cut a',
      'notch in the stone at the halfway, and he went away pleased.',
      '',
      'That night the elder put the board across the notch.',
      '',
      'In the morning the younger took it away, and she also took a chisel, and she cut the notch',
      'deeper, so that the halfway was lower and more water came to her. And the next night the',
      'elder cut it deeper still on her side, and so it went, and by the end of the dry the stone',
      'was cut through and the sluice would not hold water at all, and both fields were dry, and',
      'the two of them stood and looked at it.',
      '',
      'The elder said: we have ruined it.',
      '',
      'The younger said: yes.',
      '',
      'Then they sat down on the bank, one on each side, and they sat there until it rained,',
      'which was eleven days, and neither of them went home and neither of them spoke, and when it',
      'rained the water went through the broken stone and into the river and neither field got any',
      'of it.',
      '',
      'They mended the stone the next year, together, and it held, and they never spoke about the',
      'season and they never spoke about the man from the town.',
      '',
      'That is the story. It is told to children the week before the intakes are shared out.',
    ].join('\n'),
  },
  {
    id: 'why-the-mud-crab-carries-his-house',
    title: 'Why the Mud-Crab Carries His House',
    author: 'told everywhere; this telling from the deep market at Helstrom',
    kind: 'fable',
    taxon: 'T8',
    argonian_authored: true,
    unreliability: 'A beast-fable about debt whose moral is never stated. The teller has been asked for the moral and has said that there is not one.',
    topics_taught: ['the-lease', 'the-count'],
    text: [
      'The mud-crab used to live in a hole like everybody else.',
      '',
      'He borrowed a roof off the tortoise for one season, because his hole took water, and he',
      'said he would give it back in the dry. The tortoise said there was no hurry.',
      '',
      'In the dry the crab came and said: I have not got it. The tortoise said: keep it another',
      'season. And the crab kept it another season, and in the dry after that he came and said: I',
      'have not got it, and the tortoise said: keep it.',
      '',
      'This went on. The crab grew and the roof did not, and after some years it did not fit him,',
      'and he could not put his legs under it properly, and he walked sideways, which he had not',
      'done before.',
      '',
      'One day the tortoise said: I do not want it back.',
      '',
      'The crab said: then I will put it down.',
      '',
      'The tortoise said: you may put it down.',
      '',
      'And the crab stood there with it on his back and did not put it down, and he has not put',
      'it down since, and he walks sideways, and if you take the roof off a mud-crab he dies.',
      '',
      'Small children are told this and laugh at the walking. Older ones are told it again and do',
      'not.',
    ].join('\n'),
  },
  {
    id: 'the-man-who-sold-his-name',
    title: 'The Man Who Sold His Name',
    author: 'told at the Boards; a Tamrielic telling, and the Jel telling is said to be different in the last part',
    kind: 'folk-tale',
    taxon: 'T8',
    argonian_authored: true,
    unreliability: 'A story about the two-name system told by people who have two names, to people who are about to be given a second one by a clerk.',
    topics_taught: ['the-naming', 'the-count'],
    text: [
      'A man at the Boards had a name from his mother and a name from the clerk, and he used the',
      'clerk\'s name at the gate and his mother\'s name at home, which is what everybody does.',
      '',
      'A factor came and said: your clerk-name is a good one, it is short, it goes on a manifest',
      'well. I will give you eleven drakes for it.',
      '',
      'The man said: it is only what the clerk wrote.',
      '',
      'The factor said: then it is worth eleven drakes to you and nothing.',
      '',
      'So he sold it, and the factor put it on his own papers, and the man went to the gate and',
      'the gate asked his name and he gave his mother\'s name, and the gate wrote it down wrong,',
      'because it was not a name the gate had a way of writing. And the next time it wrote it down',
      'wrong differently. And after some years there were four of him in the ledgers and none of',
      'them was owed anything, because a debt has to be owed to one person.',
      '',
      'He went to the factor and said: I want it back.',
      '',
      'The factor said: I will sell it to you for eleven drakes.',
      '',
      'He did not have eleven drakes, because none of the four of him had ever been paid.',
      '',
      'He is still at the Boards. He is an old man. He answers to all four and to his mother\'s',
      'name, and the children think he is being funny.',
    ].join('\n'),
  },
  {
    id: 'the-girl-who-carried-water-upright',
    title: 'The Girl Who Carried Water Upright',
    author: 'told at Soulrest on the steps; the last line is the same in every telling',
    kind: 'folk-tale',
    taxon: 'T8',
    argonian_authored: true,
    unreliability: 'A children\'s story about doing a thing perfectly. The cruelty is in the last line and the tellers do not soften it.',
    topics_taught: ['the-counting', 'soulrest'],
    text: [
      'There was a girl on the steps at Soulrest who could carry a full jar up all forty of them',
      'without spilling.',
      '',
      'Everybody said: that is very good. And it was. Nobody else could do it. The steps are wet',
      'and they are worn in the middle and forty is a great many, and she went up with the jar',
      'full to the lip and set it down full to the lip, every time, and she was eleven.',
      '',
      'The Chapter heard about it and had her up to carry for the counting, which is a thing done',
      'once a year, and she carried, and it went well, and they gave her a copper and said she',
      'should come back.',
      '',
      'She came back the next year and the year after. She got taller and the jar got bigger and',
      'she still did not spill. Then one year her hands were bad — they go bad, on the steps, from',
      'the wet — and she spilled a little on the twenty-ninth, and she went back down and filled',
      'it and did it again, and did not spill.',
      '',
      'The next year she spilled on the twelfth and did it again. And again. She was on the steps',
      'all day.',
      '',
      'The Chapter said: you do not have to do it twice. Nobody asked you to do it twice.',
      '',
      'She said: I know.',
      '',
      'She carried until she was forty and then her hands would not hold a jar at all, and after',
      'that she sat at the bottom and told the ones going up where the worn part was.',
      '',
      'They still spilled. Everybody spills. She was the only one who ever did not, and there is',
      'nothing in the Chapter\'s books to say she was there.',
    ].join('\n'),
  },
];

// ---------------------------------------------------------------------------------------------

function main(write) {
  // 1. classify
  const found = new Set();
  for (const f of fs.readdirSync(BOOKS)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(BOOKS, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.books || [j];
    let n = 0;
    for (const b of list) {
      if (!b || !b.id || !CLASSIFY[b.id]) continue;
      found.add(b.id);
      const [taxon, why] = CLASSIFY[b.id];
      if (b.taxon === taxon) continue;
      b.taxon = taxon;
      b.taxon_note = why;
      n++;
    }
    if (n) {
      console.log(`  ${f}: filed ${n} previously unfiled text(s)`);
      if (write) fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    }
  }
  for (const id of Object.keys(CLASSIFY)) if (!found.has(id)) console.log(`  WARNING: ${id} is not on disk`);

  // 2. write
  const doc = {
    schema: 'elder-souls/books@1',
    group: 'the-short-measures',
    owner: 'W1-23-r4',
    note: 'T5 (poetry & song) and T8 (folk tale) filled to RI-LOR03 §2\'s floors. Written for this round; see tools/lore/mk-short-measures.mjs for what was NOT filled and why.',
    books: [...T5, ...T8],
  };
  const out = path.join(BOOKS, 'the-short-measures.json');
  const words = doc.books.reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
  console.log(`  ${doc.books.length} texts, ${words} words -> game/data/books/the-short-measures.json`);
  if (write) fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');

  // 3. the resulting census
  const counts = {};
  for (const f of fs.readdirSync(BOOKS)) {
    if (!f.endsWith('.json')) continue;
    for (const b of (JSON.parse(fs.readFileSync(path.join(BOOKS, f), 'utf8')).books || [])) {
      if (b && b.id) counts[b.taxon || 'NONE'] = (counts[b.taxon || 'NONE'] || 0) + 1;
    }
  }
  const FLOOR = { T1: 16, T2: 10, T3: 14, T4: 16, T5: 10, T6: 12, T7: 12, T8: 10, T9: 6, T10: 16 };
  let total = 0, short = 0;
  console.log('\n  taxon  have  floor');
  for (const t of Object.keys(FLOOR)) {
    const have = counts[t] || 0;
    total += have;
    const gap = Math.max(0, FLOOR[t] - have);
    short += gap;
    console.log(`  ${t.padEnd(5)}  ${String(have).padStart(4)}  ${String(FLOOR[t]).padStart(5)}  ${gap ? `SHORT ${gap}` : 'ok'}`);
  }
  console.log(`  unfiled: ${counts.NONE || 0}    total ${total}    remaining shortfall ${short}`);
  if (!write) console.log('\n(dry run — pass --write to apply)');
}

main(process.argv.includes('--write'));

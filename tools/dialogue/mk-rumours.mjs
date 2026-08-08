// AUTHORING TOOL — what a town is saying this week.
//
//   node tools/dialogue/mk-rumours.mjs            # merges into game/data/dialogue/rumours.json
//   node tools/dialogue/mk-rumours.mjs --check    # counts only; exit 1 if a tier target is missed
//
// RI-DLG03 §C, Tier A (Lilmoth, Stormhold, Helstrom): 28 distinct rumours in the settlement's
// pool, >=20 unique to it, >=12 that change across the main-quest acts, >=3 false or misleading,
// >=3 that report the player's own past actions. The shipped file carried 8 apiece.
//
// EVERY GATE HERE HAS A READER, and one of them did not until this round. `RumourBook.for()`
// (`game/src/sim/quest/topic-supply.js`) filtered on race and upbringing only, so an act-gated
// rumour would have been decorative — the town saying the same eight things in the last hour of
// the game as in the first. `player.knows` was already being passed in from
// `Engine._talkPlayer()`; the filter now reads it, with `infoAllowed()`'s exact semantics. That
// is what makes `requires.knows` / `forbids.knows` below mean something.
//
//   settlement        RumourBook.for() — keyed off the speaker's town (engine.js rumourFor)
//   x                 Conversation.start() -> extra[{kind:'rumour'}] -> the words on the screen
//   adds_topics       Engine.conversationSay() -> learnTopics(sim.quest.topicsKnown, ...)
//   requires.race     RumourBook.for() whitelist
//   forbids.knows     RumourBook.for() — how a rumour RETIRES at an act boundary
//   requires.knows    RumourBook.for() — how a rumour ARRIVES, including one about the player
//
// THE DIEGETIC RULE (RI-DLG03, binding): no rumour names a quest, an objective or a stage; none
// gives a bearing, a distance or a map reference; none describes a UI affordance; none is phrased
// as an instruction to the player. They are things people say about other people. Several of them
// are wrong, and the file marks which — `false_or_misleading` is authorial bookkeeping for a
// critic, not a field the game reads, and it is named `_note` so nobody mistakes it for one.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FILE = path.join(ROOT, 'game/data/dialogue/rumours.json');

// Act flags, all of them set by a quest resolution's `consequences.world_flags` in
// game/data/quests/mainline-act*.json and read back through Engine._knownFlags().
const A1 = 'act_one_closed', A2O = 'act_two_opened', A2 = 'act_two_closed';
const A3O = 'act_three_opened', A3 = 'act_three_closed', A5O = 'act_five_opened', A5 = 'act_five_closed';

const NEW = {
  // ------------------------------------------------------------------------------------ LILMOTH
  lilmoth: [
    { id: 'lil-roofwalk-span', x: "Third span on the roof walks went last month with a man on it and he lived, and the yard that owns the plank says it was never their plank. Two families have stopped speaking over it. Whose plank do you think it was?" , adds_topics: ['the-roof-walks'] },
    { id: 'lil-teel-list', x: "Wide-Eye Teel has the lamp list in her head and she raised four streets this quarter without a word to the Office. Has anyone worked out yet whether she is allowed to?", adds_topics: ['the-lamp-tax', 'wide-eye-teel'] },
    { id: 'lil-warehouse-row', x: "Warehouse row took in nine families this winter and the row is not a place families come out of. And the Office counts them as housed.", adds_topics: ['the-warehouse-row'] },
    { id: 'lil-sunken-well', x: "They say the sunken well ran clear for three days in the spring and then went back to what it was. The ones who drank it will not say what it tasted of.", adds_topics: ['the-sunken-well'], _note: 'false_or_misleading' },
    { id: 'lil-swimmers-fee', x: "The swimmers have put their price up again and the harbour has decided that is greed. It is not greed. Two of them did not come up last season. Would you go down for the old rate?", adds_topics: ['the-swimmers'] },
    { id: 'lil-fishmarket-half', x: "There is half an hour after the fish market closes when the boxes go out and no one minds who is standing there, and there are people in this city who eat only in that half hour.", adds_topics: ['the-fish-market'] },
    { id: 'lil-made-ground', x: "The made ground under the low city is settling again. You can see it in the doors — half the quarter has a door that will not shut in the wet.", adds_topics: ['the-made-ground', 'the-low-city'] },
    { id: 'lil-yard-brothers', x: "The yard brothers are cutting on the third stand and the rootkeepers have said nothing about it. The yards find the silence worse than a refusal.", adds_topics: ['the-sap-cutters', 'the-cutting-yard'] },
    { id: 'lil-hidesfoot', x: "Hides-His-Foot has not been seen on the tide steps in a month and his boat is still tied. His sister says he is visiting. His sister has said that before.", adds_topics: ['hides-his-foot', 'the-tide-steps'] },
    { id: 'lil-office-annexe', x: "Someone has been signing the Office annexe book after the clerks go home, and the hand is good enough that they only noticed by the ink.", adds_topics: ['the-office-annexe'] },
    { id: 'lil-hatchery-quiet', x: "The hatchery has gone quiet a season early and the keepers are saying it is the weather. It has never been the weather before.", adds_topics: ['the-hatchery'], _note: 'false_or_misleading' },
    { id: 'lil-drowned-quarter', x: "Two children got into the drowned quarter on a dare and came back up talking about a lamp burning down there. Their mothers have beaten it out of them and the story is still going round. Who lights a lamp under water?", adds_topics: ['the-drowned-quarter'] },
    { id: 'lil-tide-steps-toll', x: "There is a man taking a toll on the tide steps who has no paper for it and the whole quarter pays him, and the legion knows, and the legion would rather he did it than they.", adds_topics: ['the-tide-steps'] },
    { id: 'lil-organ-market', x: "The organ market has a buyer this month who pays in Imperial silver and asks nothing, and the price of everything has gone strange because of it. Have you seen what a fresh one fetches now?", adds_topics: ['the-organ-market'] },
    { id: 'lil-ledgerman', x: "The ledgerman of Lilmoth turned down work twice this month. Twice. He has never turned down work in his life and the wharf has decided he is dying.", adds_topics: ['the-ledgerman-of-lilmoth'], _note: 'false_or_misleading' },
    // act-gated arrivals and retirements
    { id: 'lil-act1-wells', requires: { knows: [A1] }, x: "Since the business up the coast the wells here have been drawing slow, and the Office has put a man on each of them with a book. Writing it down has not helped the water.", adds_topics: ['the-quiet-wells'] },
    { id: 'lil-act1-yard', requires: { knows: [A1] }, x: "The cutting yard has stopped taking new hands. That has not happened in this city in eleven years and the reason given is a shortage of rope.", adds_topics: ['the-cutting-yard'], _note: 'false_or_misleading' },
    { id: 'lil-act2-tally', requires: { knows: [A2O] }, x: "There is a copy of the Drowned Tally in this city that the Court does not know about, and the man who has it is trying very hard to be uninteresting.", adds_topics: ['the-drowned-tally'] },
    { id: 'lil-act2-court', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "The Court has sent someone up from the rootlands and they are not staying at an inn. Four households have been asked to put a stranger up and three of them said no.", adds_topics: ['the-drowned-court'] },
    { id: 'lil-act3-roots', requires: { knows: [A3O] }, x: "The eleven live roots are being counted again and by a different hand this time, and the keepers are letting it happen. That is the news, not the count.", adds_topics: ['the-eleven-live-roots'] },
    { id: 'lil-act3-thread', requires: { knows: [A3] }, x: "Whatever was holding the wharf trade together came apart this month. The barges are still running. Ask any of the crews who is paying for them and watch the face.", adds_topics: ['the-thread-is-cut'] },
    { id: 'lil-act5-after', requires: { knows: [A5] }, x: "The wells came back, or they did not, depending which street you ask on, and the arguing about it has already outlasted the drought.", adds_topics: ['what-the-wells-do-now'] },
    { id: 'lil-act5-after2', requires: { knows: [A5] }, x: "They are saying the Count was opened by an outlander and the yards are saying it was opened by no one at all and it simply gave. Both halves of the city are sure.", adds_topics: ['the-opening-of-the-count'], _note: 'false_or_misleading' },
    // the player's own past actions
    { id: 'lil-player-boxes', requires: { knows: ['boxes_counted_true'] }, x: "A stranger went through the empty boxes at the mortuary and counted them honestly. No clerk had. Now three offices are pretending they asked for it.", adds_topics: ['the-empty-boxes'] },
    { id: 'lil-player-yardvote', requires: { knows: ['the_yards_hold_the_third_stand'] }, x: "The yards held the third stand. A stranger did the talking and the crews have decided that makes the stranger theirs. You may find that is a debt.", adds_topics: ['the-cutting-yard'] },
    { id: 'lil-player-ledger', requires: { knows: ['ledger_terms_signed'] }, x: "The Ledger signed terms with the yards and the whole wharf knows who carried the paper between them. Half of it is grateful.", adds_topics: ['the-ledgers-terms'] },
  ],

  // ---------------------------------------------------------------------------------- STORMHOLD
  stormhold: [
    { id: 'sto-salt-short', x: "The salt market weighed short three days running and the weigh house says the scale is fine. The scale has been fine for thirty years. Do you see the difficulty?", adds_topics: ['the-salt-market', 'the-weigh-house'] },
    { id: 'sto-okanshei', x: "Okan-Shei has not undercut a rival in thirty years and this month he undercut the whole west end, and the market is trying to work out what he knows.", adds_topics: ['okan-shei'] },
    { id: 'sto-northwall', x: "There was a light behind the north wall on the eleventh and the watch that saw it has been moved to the harbour gate. Moved, mind. Not disciplined. What do you make of that?", adds_topics: ['the-north-wall', 'the-old-quarter'] },
    { id: 'sto-drains', x: "Something is living in the drains that the engineers cut and the garrison will not go down and the town has stopped asking them to.", adds_topics: ['the-drains', 'the-under-drain'], _note: 'false_or_misleading' },
    { id: 'sto-nightwatch', x: "The night watch has been doubled and the reason given is thieves. There have been no thieves. But there has been a great deal of walking about at night by men in Legion boots.", adds_topics: ['the-night-watch'] },
    { id: 'sto-wallstreet', x: "A family on Wall Street is still paying rent on a house behind the wall and the Office still takes it. Nine years now. Not one clerk will say the house exists.", adds_topics: ['the-wall-street', 'the-north-wall'] },
    { id: 'sto-quartermaster', x: "The quartermaster has been selling boots to the town and buying worse ones for the cohort, and the tribune knows. So who do you suppose is wearing the good pair?", adds_topics: ['the-quartermaster'] },
    { id: 'sto-borderroad', x: "The border road has had two carts go missing off it this season and the third one came back with everything on it and no driver.", adds_topics: ['the-border-road'] },
    { id: 'sto-muster', x: "There are names on the muster board that have drawn pay since before the fever year, and the man who noticed has been posted to a fort with no roof. Would you notice anything, in his place?", adds_topics: ['the-muster-board', 'the-dead-pay'] },
    { id: 'sto-thinyears', x: "The old ones here still measure a bad year against the six that came after the fever, and they will tell you this one is not close, and they will tell you it is the same shape.", adds_topics: ['the-thin-years', 'the-fever-year'] },
    { id: 'sto-innkeeper', x: "There is a back route out of the inn on the eleventh of the month, for people who would rather not meet the Tribune coming in, and it is busier than the front.", adds_topics: ['the-tribune-drinks', 'the-quiet-route'] },
    { id: 'sto-belena', x: "Belena Sarn has not signed a warrant in six weeks and the pile is on her desk where the whole office can see it. Courage or a message, take your pick.", adds_topics: ['belena-sarn'] },
    { id: 'sto-saltrock', x: "They are cutting new cisterns into the salt rock and the water that comes up is not fit and they are cutting anyway.", adds_topics: ['the-drains'] },
    { id: 'sto-gatefee', x: "The gate fee went up by a third and the notice went up after the fee did. Two carters have refused to pay and have not been stopped, and the gate has noticed.", adds_topics: ['the-gate-fee'] },
    { id: 'sto-oldquarter-rent', x: "A clerk went into the old quarter with a lamp and a book last winter to make a survey of it and came out and asked to be transferred.", adds_topics: ['the-old-quarter'] },
    { id: 'sto-act1', requires: { knows: [A1] }, x: "The cohort has been counting its own wells since the coast business and it has found it has fewer than the roll says. You only find that out by walking to them.", adds_topics: ['the-quiet-wells', 'the-ninth-cohort'] },
    { id: 'sto-act1b', requires: { knows: [A1] }, forbids: { knows: [A2] }, x: "There is an order posted about the salt trade that no one will read out loud and the market has decided it means the Empire is short of money.", adds_topics: ['the-salt-market'], _note: 'false_or_misleading' },
    { id: 'sto-act2', requires: { knows: [A2O] }, x: "Two men came up from the marsh asking after the old quarter and had papers for it, and the gate let them through, and the gate has been quiet about whose papers.", adds_topics: ['the-old-quarter'] },
    { id: 'sto-act2b', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "The tribune has stopped drinking at the inn. He has been at the weigh house instead, in the evenings, with the books out.", adds_topics: ['the-tribune'] },
    { id: 'sto-act3', requires: { knows: [A3O] }, x: "The garrison has been told to expect a movement of water in the drains and has not been told by whom, and the men are treating that as an order about a flood.", adds_topics: ['the-drains'], _note: 'false_or_misleading' },
    { id: 'sto-act3b', requires: { knows: [A3] }, x: "Half the border traffic stopped this month and the road is not closed. It has simply gone quiet, the way a road does when the people who used it have found a reason not to.", adds_topics: ['the-border-road'] },
    { id: 'sto-act5', requires: { knows: [A5] }, x: "Whatever happened under the wastes, the salt rock felt it, and there are new cracks in the cistern floor that the engineers are recording as settlement.", adds_topics: ['the-stone-wastes'] },
    { id: 'sto-act5b', requires: { knows: [A5] }, x: "The Office has begun a survey of every well in the province and it is being done properly. After all this, that is either shame or a bill being prepared.", adds_topics: ['the-unfinished-survey'] },
    { id: 'sto-player-wall', requires: { knows: ['stormhold_north_wall_entered'] }, x: "A stranger got into the old quarter and came out and did not go to the Office about it. The garrison would very much like to know what was seen.", adds_topics: ['the-old-quarter'] },
    { id: 'sto-player-muster', requires: { knows: ['dead_pay_named_aloud'] }, x: "The dead pay got said out loud in front of a clerk who wrote it down, and the muster board has been repainted since. Coincidence, is it?", adds_topics: ['the-dead-pay'] },
    { id: 'sto-player-quarter', requires: { knows: ['the_paymaster_is_finished'] }, x: "The paymaster is finished and there is a stranger in this town who is said to have done it with arithmetic. The men cannot decide whether that is worse.", adds_topics: ['the-paymaster'] },
  ],

  // ----------------------------------------------------------------------------------- HELSTROM
  helstrom: [
    { id: 'hel-quiet-street', x: "Do not walk the quiet street after dark. The town will tell you that and the town will not tell you why, and the ones who do know say it differently each time. Which version did you get?", adds_topics: ['helstrom'] },
    { id: 'hel-arrangement', x: "The arrangement between the Legion and the root halls got renewed this season without a word said in public, and both sides are behaving as though it were a defeat.", adds_topics: ['the-arrangement', 'the-root-halls'] },
    { id: 'hel-fence', x: "There is a fence in this town who has never once asked where a thing came from. Half the province thinks that is a service. And the other half thinks it is a trap.", adds_topics: ['the-fence-at-helstrom'] },
    { id: 'hel-naheesh', x: "Naheesh-Tul has stopped giving the halls to strangers and will not say who told him to. He was never told. The town cannot get past that part.", adds_topics: ['naheesh-tul', 'the-given-halls'] },
    { id: 'hel-thirdroot', x: "The third root has been closed since the spring and the keepers have put a person on it. They have not done that in living memory.", adds_topics: ['the-third-root'] },
    { id: 'hel-carriers', x: "The carriers have raised their rate on the Thorn run and it is not the distance, it is that two of them will not walk it alone any more.", adds_topics: ['the-carriers'] },
    { id: 'hel-dres-cages', x: "There are cages behind the Dres yard that have held nothing for twenty years, and this spring a hand was sent to clean them.", adds_topics: ['the-old-cages', 'house-dres'] },
    { id: 'hel-listening-floor', x: "They will let you stand on the listening floor if you ask properly and they will not tell you what you are meant to hear. Half of this town has never been. Have you?", adds_topics: ['the-listening-floor'] },
    { id: 'hel-fourth-day', x: "The Court sits four days and speaks on three, and the warmbloods in this town all believe the fourth day is where the real business is done.", adds_topics: ['the-fourth-day'], _note: 'false_or_misleading' },
    { id: 'hel-market-coin', x: "Half the coin in this market is mudcrab money and the factor house has begun refusing it, quietly, to some people and not others.", adds_topics: ['the-mudcrab-money'] },
    { id: 'hel-agaceph', x: "The Agaceph guides have not taken a warmblood into the weir this season and they are giving a different reason to each one who asks.", adds_topics: ['the-covenant'] },
    { id: 'hel-lodging', x: "The lodging price doubled the week the surveyors arrived and has not come down, and the surveyors left in the autumn.", adds_topics: ['the-lodging-price'] },
    { id: 'hel-boat-tax', x: "The boat tax is being collected twice at this bank, once at the water and once at the office, and each collector says the other is the irregular one.", adds_topics: ['the-boat-tax', 'the-bank-toll'] },
    { id: 'hel-ferrymen', x: "The ferrymen have started calling themselves a guild and have a book and a seal, and no charter, and so far no one has asked them for one.", adds_topics: ['the-ferrymen'] },
    { id: 'hel-naga', x: "A naga band came to the ford in the spring and traded properly and left, and the town has been telling it as a raid ever since. Which of those two stories reached you first?", adds_topics: ['the-naga-bands', 'about-the-naga'], _note: 'false_or_misleading' },
    { id: 'hel-act1', requires: { knows: [A1] }, x: "The root halls have been carrying water up from the deep channels since the coast business, by hand, at night, and not one keeper has said the word drought.", adds_topics: ['the-root-halls', 'the-quiet-wells'] },
    { id: 'hel-act1b', requires: { knows: [A1] }, forbids: { knows: [A2] }, x: "There is a keeper here who has stopped taking supplicants and has not stopped tending, and the halls are treating that as an illness.", adds_topics: ['the-root-halls'] },
    { id: 'hel-act2', requires: { knows: [A2O] }, x: "A copy of something went from the factor house to the Court this month in a fish crate, and the man who packed it has been paid enough to leave.", adds_topics: ['the-drowned-court', 'the-factor-house'] },
    { id: 'hel-act2b', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "The Dres have called their factors in from three towns for a week and given no reason, and the yards here have taken it as a sign to buy.", adds_topics: ['house-dres'] },
    { id: 'hel-act3', requires: { knows: [A3O] }, x: "The listening floor has been busy at odd hours and the keepers have stopped explaining the hours, and the town has begun keeping its own note of them.", adds_topics: ['the-listening-floor'] },
    { id: 'hel-act3b', requires: { knows: [A3] }, x: "Whatever the halls were waiting on has arrived or has not, and either way the third root was opened last week and closed again the same day.", adds_topics: ['the-third-root'] },
    { id: 'hel-act5', requires: { knows: [A5] }, x: "The Court has gone quiet and the halls will not say whether that is grief or arithmetic, and the town has decided it can be both.", adds_topics: ['the-drowned-court'] },
    { id: 'hel-act5b', requires: { knows: [A5] }, x: "They are already arguing about who opened it. Give it a year and this town will have four versions and a song.", adds_topics: ['the-opening-of-the-count'] },
    { id: 'hel-player-fence', requires: { knows: ['helstrom_fence_used'] }, x: "The fence took something off a stranger this season that he would not normally touch, and he has been careful about who he mentions it to.", adds_topics: ['the-fence-at-helstrom'] },
    { id: 'hel-player-halls', requires: { knows: ['given_halls_opened_to_player'] }, x: "Naheesh-Tul gave the halls to an outlander. He has not explained it and the town has stopped waiting for him to.", adds_topics: ['the-given-halls', 'naheesh-tul'] },
    { id: 'hel-player-dres', requires: { knows: ['a_dres_factor_did_the_arithmetic_in_front_of_the_player'] }, x: "A Dres factor did the sums out loud in front of a stranger and the House has not sent anyone about it yet. Not sending anyone is not the same as forgiving it.", adds_topics: ['house-dres'] },
  ],

  // ------------------------------------------------------------------------- TIER B TOP-UPS
  archon: [
    { id: 'arc-vats', x: "The vats flooded twice this season and the lung wage has not moved, and the men who mix have stopped pretending the two are unconnected. How long would you mix, at that wage?", adds_topics: ['the-vat-cough', 'the-lung-wage'] },
    { id: 'arc-purple-law', x: "The purple law is enforced on the dye yards and on no one else, and the yard office will tell you that is because no other house dyes.", adds_topics: ['the-purple-law', 'the-dye-yards'] },
    { id: 'arc-militia', x: "The militia here is nine men and a list, and the list has three names on it that belong to the dead, and the pay still goes out.", adds_topics: ['the-militia', 'the-dead-pay'] },
    { id: 'arc-tidelichen', x: "The tide lichen has come in thick on the north bank and the healers are calling it a good sign, and the old ones are not.", adds_topics: ['the-tide-lichen'], _note: 'false_or_misleading' },
    { id: 'arc-bell', x: "The chapel bell rang on its own again and the priest went on with what he was saying. That frightened the congregation rather more than the bell had!", adds_topics: ['the-bell-that-rings'] },
    { id: 'arc-watercall', x: "The water call was held early this year and half the town was not told, and the half that was told will not say who told them.", adds_topics: ['the-water-call'] },
    { id: 'arc-act2', requires: { knows: [A2O] }, x: "The yard office has taken on a clerk from Gideon who asks about the well rather than the vats, and asks it of the wrong people, politely.", adds_topics: ['the-yard-office'] },
    { id: 'arc-act3', requires: { knows: [A3O] }, x: "The vats have been run dry twice on purpose this month and the reason given is cleaning. They have never been cleaned.", adds_topics: ['the-vat-cough'], _note: 'false_or_misleading' },
    { id: 'arc-act5', requires: { knows: [A5] }, x: "The dye yards are hiring again and the wage is worse and the queue is longer, and the two facts are being reported as one piece of good news.", adds_topics: ['the-dye-yards'] },
    { id: 'arc-player-factor', requires: { knows: ['archon_dres_factor_gone'] }, x: "The Dres factor has gone from this town and the House has not replaced him, and the market cannot decide whether to be pleased.", adds_topics: ['house-dres'] },
  ],
  blackrose: [
    { id: 'bla-roseyard', x: "They planted roses on the old execution ground and the prison has never once explained it. Every family in this town has a view on what it means. What is yours?", adds_topics: ['the-rose-yard'] },
    { id: 'bla-longsentences', x: "The long sentences are getting longer and the warden signs them and the Assize does not read them, and the warden has begun signing them in front of witnesses.", adds_topics: ['the-long-sentences', 'the-warden'] },
    { id: 'bla-onecustomer', x: "The one customer took the whole of the timber cut again this season at a price no other yard was offered, and the yards are calling that a contract.", adds_topics: ['the-one-customer'] },
    { id: 'bla-supplyroad', x: "The supply road has been running at night, which it does not, and the prison has taken deliveries it did not order. Both of those at once, mind.", adds_topics: ['the-supply-road'] },
    { id: 'bla-quietgrave', x: "There is a grave on the point with no name cut on it and every person in this town knows the name, and it has stayed uncut for nine years.", adds_topics: ['the-quiet-grave'] },
    { id: 'bla-act2', requires: { knows: [A2O] }, x: "The Company has been buying leases at Blackrose it cannot work and paying over the value, and the yards have begun refusing to sell.", adds_topics: ['the-lease-roll', 'the-blackwood-company'] },
    { id: 'bla-act3', requires: { knows: [A3O] }, x: "The prison took in a body this month that came from the interior and was not a prisoner, and the day book has it as a transfer.", adds_topics: ['blackrose-prison', 'the-blackrose-day-book'] },
    { id: 'bla-act5', requires: { knows: [A5] }, x: "The warden has asked for the long sentences to be reviewed. All of them. He has asked before and this is the first time Gideon has answered!", adds_topics: ['the-long-sentences'] },
  ],
  gideon: [
    { id: 'gid-underwriters', x: "The underwriters' gate refused four manifests in a week and the man with the stamp has been seen drinking at the factor house. He does not drink there.", adds_topics: ['the-underwriters-gate'] },
    { id: 'gid-scribe', x: "There is a scribe in this town who was struck off the roll and comes in every morning and does the work. And the notary has stopped pretending not to see her.", adds_topics: ['the-struck-off-notary', 'the-removal-that-is-not-one'] },
    { id: 'gid-vestry', x: "The vestry well was sealed for a fortnight and reopened with no notice, and Brother Teleno has been asked about it four times and has answered differently each time. Would you ask a fifth?", adds_topics: ['the-vestry-well', 'brother-teleno'] },
    { id: 'gid-fieldgrid', x: "The field grid was re-surveyed in the spring and eleven holdings came out smaller and none came out larger, and the surveyor has left the province.", adds_topics: ['the-field-grid'] },
    { id: 'gid-witness', x: "The woman who saw it still walks the same road home past the same door every evening, and the town has decided that means she is lying.", adds_topics: ['the-witness'], _note: 'false_or_misleading' },
    { id: 'gid-act3', requires: { knows: [A3O] }, x: "The Assize has cleared a week in its calendar and has not said what for, and three notaries have cancelled travel.", adds_topics: ['the-assize'] },
    { id: 'gid-act5', requires: { knows: [A5] }, x: "The Office has begun answering letters it has sat on for years and the answers are all the same length. The clerks find that more sinister than the silence.", adds_topics: ['the-provincial-office'] },
  ],
  // ---- second pass: the gaps `--check` reported after the first (RI-DLG03 §C, by tier) --------
  _lilmoth2: [
    { id: 'lil-act2c', requires: { knows: [A2] }, x: "The Court's man went home and left a list with the harbour office, and the harbour office has been reading names off it to people who ask nicely.", adds_topics: ['the-drowned-court'] },
  ],
  _stormhold2: [
    { id: 'sto-act2c', requires: { knows: [A2] }, x: "The weigh house books went to Gideon in a locked case and came back in a sack, and the clerk who signed for them has asked to be moved.", adds_topics: ['the-weigh-house'] },
  ],
  _helstrom2: [
    { id: 'hel-act2c', requires: { knows: [A2] }, x: "The factor house has stopped taking mudcrab money from anyone at all now, and is saying it never did, and half the market was paid in it last winter.", adds_topics: ['the-factor-house', 'the-mudcrab-money'], _note: 'false_or_misleading' },
  ],
  _gideon2: [
    { id: 'gid-act1', requires: { knows: [A1] }, x: "The vestry well came up brown for a day after the coast business and Brother Teleno had it drawn off and refilled before the morning, and told the vestry it was silt.", adds_topics: ['the-vestry-well'], _note: 'false_or_misleading' },
    { id: 'gid-act1b', requires: { knows: [A1] }, forbids: { knows: [A2] }, x: "The Assize has begun asking the yards about their water rather than their leases. When did that building last ask about water?", adds_topics: ['the-assize'] },
    { id: 'gid-act2', requires: { knows: [A2O] }, x: "A porter on the quay said something once about the Tally being late and has not been on the quay since, and his crew say he took a berth south.", adds_topics: ['the-drowned-tally'] },
    { id: 'gid-act2b', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "Four houses in this town will lend you a name and this month three of them stopped, and the fourth has put its price past what a working man has.", adds_topics: ['a-name-for-cover'] },
    { id: 'gid-act3b', requires: { knows: [A3] }, x: "The court factor has been going through the lease roll year by year and writing in the margins, and margins are not where that office writes.", adds_topics: ['the-lease-roll'] },
    { id: 'gid-act5b', requires: { knows: [A5] }, x: "They have taken the struck-off notary's name off the roll properly at last, and put it back on, and the office will not say which came first.", adds_topics: ['the-struck-off-notary'] },
    { id: 'gid-player-witness', requires: { knows: ['gideon_witness_spoke'] }, x: "The woman who saw it has said what she saw, to a stranger who was not of the court, and the town has gone very quiet about her since.", adds_topics: ['the-witness'] },
    { id: 'gid-player-assize', requires: { knows: ['assize_lease_vote_counted_aloud'] }, x: "The lease vote got counted out loud in front of the room. That has not happened here in living memory and two of the chairs have not been back.", adds_topics: ['the-lease-vote'] },
  ],
  _archon2: [
    { id: 'arc-annexe', x: "The office annexe here has one clerk and four registers and three of the registers are for a trade this town stopped doing forty years ago.", adds_topics: ['the-office-annexe'] },
    { id: 'arc-deesei', x: "An-Deesei has been buying tide lichen at a price that makes no sense and drying it somewhere the yards have not found.", adds_topics: ['an-deesei', 'the-tide-lichen'] },
    { id: 'arc-crossing', x: "The crossing fee was set by a man who has been dead eleven years and the ferry still collects it in his name. And the name is still on the board.", adds_topics: ['the-crossing-fee'] },
    { id: 'arc-vestry', x: "There is a healer here who will not treat vat cough any more and will not say why, and she is the only one in the town who was any good at it.", adds_topics: ['the-vat-cough'] },
    { id: 'arc-act1', requires: { knows: [A1] }, x: "The water call was held twice this year. Twice. The second one was not announced and the people who went will not say who called it.", adds_topics: ['the-water-call'] },
    { id: 'arc-act2b', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "The vats have been taking water from the far bank since the spring and paying a toll for it that the yard office has not entered anywhere.", adds_topics: ['the-yard-office'] },
    { id: 'arc-act3b', requires: { knows: [A3] }, x: "The purple law was enforced on a house that does no dyeing at all last month, and the yard office is calling that a clerical matter.", adds_topics: ['the-purple-law'] },
    { id: 'arc-act5b', requires: { knows: [A5] }, x: "The lung wage went up the week after and no house has claimed credit for it. In this town that means it was not a kindness.", adds_topics: ['the-lung-wage'] },
    { id: 'arc-player-water', requires: { knows: ['archon_water_call_open'] }, x: "The water call is open to anyone who asks now, and there is a stranger who is said to have argued it open, and the vats are watching to see what it costs.", adds_topics: ['the-water-call'] },
  ],
  _blackrose2: [
    { id: 'bla-warden-petition', x: "The warden's petition has gone up three times and come back unopened three times, and he has started reading it out to the yard instead.", adds_topics: ['the-petition', 'the-warden'] },
    { id: 'bla-timber', x: "The timber yards took on twenty hands and let eighteen go inside a month. But the two who stayed are not the two the foreman would have picked.", adds_topics: ['the-timber-yards'] },
    { id: 'bla-floats', x: "The river floats came down light twice this season and the tally at the top says they went out full, and both tallies are in the same hand.", adds_topics: ['the-river-floats'] },
    { id: 'bla-prison-food', x: "They are feeding the prison off the town's grain and calling it a purchase, and the price is written down, and no coin has moved.", adds_topics: ['blackrose-prison'], _note: 'false_or_misleading' },
    { id: 'bla-act1', requires: { knows: [A1] }, x: "The prison well went bad in the spring and they have been carting water up the supply road since, at night, so the town does not count the carts.", adds_topics: ['the-supply-road', 'blackrose-prison'] },
    { id: 'bla-act2b', requires: { knows: [A2O] }, forbids: { knows: [A3O] }, x: "A Company man has been at the day book for a week with the warden's leave, and not one of us has asked the warden why he gave it.", adds_topics: ['the-blackrose-day-book'] },
    { id: 'bla-act3b', requires: { knows: [A3] }, x: "Two long sentences ended early this month and both men walked out the gate and neither has been seen in the town since.", adds_topics: ['the-long-sentences'], _note: 'false_or_misleading' },
    { id: 'bla-act5b', requires: { knows: [A5] }, x: "The one customer has stopped buying. The yards had ten years of that contract and four days of notice.", adds_topics: ['the-one-customer'] },
    { id: 'bla-player-lease', requires: { knows: ['blackrose_yards_outbid_the_company'] }, x: "The yards outbid the Company on the third stand and there is a stranger the crews will not name who is said to have found them the money.", adds_topics: ['the-cutting-yard'] },
    { id: 'bla-player-keep', requires: { knows: ['blackrose_keep_open_to_player'] }, x: "A stranger has been let into the keep who is not of the Assize and not of the garrison, and the warden signed for it himself.", adds_topics: ['blackrose-prison'] },
  ],
  _thorn2: [
    { id: 'tho-charter', x: "The charter says Thorn is a village and a village pays no gate fee, and Gideon has stopped answering letters about the charter, and the fee is being collected.", adds_topics: ['the-thorn-charter'] },
    { id: 'tho-act1', requires: { knows: [A1] }, x: "The tree has been quiet since the coast business and the keepers are up at it in the dark, which they do not do. And they are not singing.", adds_topics: ['the-tree-at-thorn'] },
    { id: 'tho-act2', requires: { knows: [A2O] }, x: "A man walked out of the deep marsh standing up and has not moved since, and Ossa will not say he is alive and will not say the other thing.", adds_topics: ['the-stilled-man', 'the-deep-marsh'] },
    { id: 'tho-act3', requires: { knows: [A3O] }, x: "The tide-turn walk was made three days early this month and the whole village went, and no one has explained the hurry.", adds_topics: ['the-tide-turn-walk'] },
    { id: 'tho-act5', requires: { knows: [A5] }, x: "The tree took water again. It is the whole of what anyone here will tell you, and they tell it as though it settles the matter. Does it?", adds_topics: ['the-tree-at-thorn'], _note: 'false_or_misleading' },
    { id: 'tho-player-tree', requires: { knows: ['thorn_tree_spoken_for'] }, x: "The keepers let an outlander stand at the tree and the village has not decided yet whether to be angry about it.", adds_topics: ['the-tree-at-thorn'] },
  ],
  _soulrest2: [
    { id: 'sou-burning', x: "The yard behind the customs post has burned more this year than the Court's book admits, and the woman who burns them keeps her own count and will show it to anyone who asks.", adds_topics: ['the-burning-yard', 'the-tally-of-the-dead'] },
    { id: 'sou-bonesetter', x: "The bone-setter here has taken to refusing warmbloods and giving a different reason each time. Two of the reasons contradicted each other in the same afternoon. Are you well?", adds_topics: ['the-bone-setter'] },
    { id: 'sou-listening', x: "The listening is kept at the turn of the tide and the town arranges its evenings round it, and the customs post has begun writing down who attends.", adds_topics: ['the-listening-at-soulrest'] },
    { id: 'sou-drums', x: "There have been drums out over the flats and not every night, and the ones who have been counting the nights have stopped telling people the pattern.", adds_topics: ['the-drums'] },
    { id: 'sou-silted', x: "The silted bay took a keel this month that drew less water than the last one that got through, and the pilots are arguing about whether the bay is moving.", adds_topics: ['the-silted-bay'] },
    { id: 'sou-act1', requires: { knows: [A1] }, x: "The wells here went first and no one up the coast believed it, and now that they do believe it they have begun explaining it to us.", adds_topics: ['the-quiet-wells'] },
    { id: 'sou-act2', requires: { knows: [A2O] }, x: "The Tally went out late this year and the Court sent to ask why, and the clerk who wrote the reply has been drinking since.", adds_topics: ['the-drowned-tally'] },
    { id: 'sou-act3', requires: { knows: [A3O] }, x: "The Court has taken a room at the customs post and paid for a season, and the post has never let a room before.", adds_topics: ['the-drowned-court'] },
    { id: 'sou-act5', requires: { knows: [A5] }, x: "The count came right this year for the first time in three, and the woman at the yard has not said a word about it. So the town knows it is true.", adds_topics: ['the-tally-of-the-dead'] },
    { id: 'sou-salt-pans', x: "The salt pans out on the point are worked by three families and one of them has not been seen this season, and the other two are working all three pans and saying nothing about it.", adds_topics: ['the-salt-pans'], _note: 'false_or_misleading' },
    { id: 'sou-player-count', requires: { knows: ['soulrest_dead_counted_again'] }, x: "A stranger counted the dead again, properly, and the two books came out the same, and the Court has not thanked anyone for it.", adds_topics: ['the-tally-of-the-dead'] },
  ],
  _tidewrack2: [
    { id: 'tid-hull', x: "The seized hull has been sitting in the shallows for two seasons and the office keeps re-sealing it, and the seal keeps being broken from the inside.", adds_topics: ['the-seized-hull'], _note: 'false_or_misleading' },
    { id: 'tid-clerks', x: "There are two clerks here and one village and four registers, and one of the registers is for a customs house that was never built.", adds_topics: ['the-provincial-office'] },
    { id: 'tid-wreck', x: "The drowned wreck comes up at the lowest tides of the year and people go out to it, and the office writes down who went and does nothing with the list.", adds_topics: ['the-drowned-wreck'] },
    { id: 'tid-boats', x: "Boats put in here that have no business putting in here, at night, and pay the tie-up in coin, and the clerk takes it. So who is going to write that down?", adds_topics: ['the-boat-tax'] },
    { id: 'tid-act2', requires: { knows: [A2O] }, x: "A hull came in this month with a manifest for Soulrest and unloaded here, and the office has entered it as weather.", adds_topics: ['the-manifest'], _note: 'false_or_misleading' },
    { id: 'tid-act5', requires: { knows: [A5] }, x: "The office has been told to expect a survey. Here. There has not been a survey through this place in forty years.", adds_topics: ['the-unfinished-survey'] },
  ],
};


function main() {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const CHECK = process.argv.includes('--check');
  doc.rumours = doc.rumours || {};
  if (!CHECK) {
    for (const [key, rows] of Object.entries(NEW)) {
      const town = key.replace(/^_/, '').replace(/2$/, '');
      const have = new Set((doc.rumours[town] || []).map((r) => (typeof r === 'string' ? r : r.id)));
      doc.rumours[town] = [...(doc.rumours[town] || []), ...rows.filter((r) => !have.has(r.id))];
    }
    doc.w1_17_successor_note = "RI-DLG03 §C top-up. Act gates (`requires.knows` / `forbids.knows`) are read by `RumourBook.for()` in game/src/sim/quest/topic-supply.js, which filtered on race and upbringing ONLY until this round — the flag set was already being passed in from Engine._talkPlayer() and the reader never looked, so an act-gated rumour authored before this change would have been decorative. `_note` is authorial bookkeeping for a critic and is read by nothing, deliberately.";
    delete doc.declared_incomplete;
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  }

  const TIER = { lilmoth: 'A', stormhold: 'A', helstrom: 'A', gideon: 'B', archon: 'B', blackrose: 'B', thorn: 'C', soulrest: 'C', tidewrack: 'D' };
  const TARGET = { A: { total: 28, act: 12, false: 3, player: 3 }, B: { total: 20, act: 8, false: 2, player: 2 }, C: { total: 10, act: 4, false: 1, player: 1 }, D: { total: 6, act: 2, false: 1, player: 0 } };
  let bad = 0;
  console.log('town        tier  total  act-gated  false  player-deed   (targets in brackets)');
  for (const [town, rows] of Object.entries(doc.rumours)) {
    const tier = TIER[town] || 'D', t = TARGET[tier];
    const R = rows.map((r) => (typeof r === 'string' ? { x: r } : r));
    const act = R.filter((r) => (r.requires && (r.requires.knows || r.requires.knows_all)) || (r.forbids && r.forbids.knows)).length;
    const fake = R.filter((r) => r._note === 'false_or_misleading').length;
    const deed = R.filter((r) => r.requires && Array.isArray(r.requires.knows) && !r.requires.knows.some((k) => /^act_/.test(k))).length;
    const miss = [];
    if (R.length < t.total) miss.push('total');
    if (act < t.act) miss.push('act');
    if (fake < t.false) miss.push('false');
    if (deed < t.player) miss.push('player');
    if (miss.length) bad++;
    console.log(`${town.padEnd(11)} ${tier}    ${String(R.length).padStart(4)}(${t.total})  ${String(act).padStart(6)}(${t.act})  ${String(fake).padStart(4)}(${t.false})  ${String(deed).padStart(6)}(${t.player})   ${miss.length ? 'SHORT: ' + miss.join(',') : 'ok'}`);
  }
  const total = Object.values(doc.rumours).reduce((a, r) => a + r.length, 0) + (doc.race_gated || []).length;
  console.log(`\n${total} rumours in the province (${(doc.race_gated || []).length} of them race-gated).`);
  if (bad) { console.error(`${bad} settlement(s) below their RI-DLG03 §C tier target.`); process.exit(1); }
}

main();

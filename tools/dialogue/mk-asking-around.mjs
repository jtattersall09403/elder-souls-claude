// AUTHORING TOOL — the connective tissue of the topic graph.
//
//   node tools/dialogue/mk-asking-around.mjs        # writes game/data/dialogue/topics/05-asking-around.json
//
// WHY THIS FILE EXISTS.
// `tools/dialogue/build-graph.mjs` reported **151 orphans**: topics with authored text and no
// way in. 42 of those turned out to be advertised on an NPC's own `topics` array and so are
// reachable in the running game; the other 109 were not reachable by anything. A topic nobody
// can name is not a topic — it is a paragraph in a file — and in Morrowind the way a subject
// becomes askable is that somebody says the word in front of you (AddTopic, spelled `to` here).
//
// So this file is thirty-odd ANSWERS, each written for one person in one town, whose nouns are
// the orphaned subjects. It is authoring, and the tool exists only so the JSON is generated from
// one legible place rather than hand-edited into eight files owned by six other pieces.
//
// TWO RULES THE CONTENT OBEYS, and they are both about not becoming a quest log:
//
//   1. Nobody here tells the player to go anywhere. Not one line closes on "Ask at X" or "you
//      should" or "you'll want to". `tools/check-prose.mjs` measures exactly that as
//      `echo_direction` and records our rate at 2.82x the Morrowind reference, so it is a known
//      tell of ours and adding thirty more of them would make it worse. These people mention
//      things because the things are on their mind.
//   2. Every info carries BOTH an actor (`a`) and a place (`cell`). That is not decoration:
//      `05-` sorts ahead of every file these topics are declared in, and an info that is
//      strictly more constrained than the ones after it is in the right place under BOTH
//      Morrowind's first-match rule and `infoFor()`'s specificity score. Author it the other way
//      round and the unreachable-INFO lint is correct to shout.
//
// Voices are `game/data/dialogue/speakers.json`'s six archetype slots plus the ordinary town
// actors. Measured with `node tools/dialogue/voice-metrics.mjs`.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'game/data/dialogue/topics/05-asking-around.json');

// ---------------------------------------------------------------------------------------------
// PART ONE — three topics that three shipped answers already name and that did not exist.
// `build-graph.mjs` called these five dangling edges. They are not filler: each is the far side
// of a conversation somebody in the tree has already started.
// ---------------------------------------------------------------------------------------------
const NEW_TOPICS = [
  {
    id: 'the-burning-yard',
    infos: [
      { a: 'clerk', cell: 'soulrest', to: ['the-tally-of-the-dead', 'the-drowned-court'],
        x: "Vaskh burns and Vaskh writes. Her book has a name, a weight and a tide in it for every one, and the Court's book has a number. No clerk in this office has ever asked her to set the two down side by side. She finds that restful. I do not." },
      { a: 'mudborn', cell: 'soulrest', to: ['the-tally-of-the-dead'],
        x: "She won't take money for it, dry-one, and she won't take a name she hasn't been given, and when the water brings up a man no family claims she gives him one out of her own and writes down that she did it. There are eleven of her cousins in that book who never lived." },
      { a: 'townsman', cell: 'soulrest',
        x: "The smoke goes up behind the customs post most evenings and everyone in Soulrest knows what hour it is by it. Not one of us counts who goes on. Only she does." },
      { a: 'rootkeeper', cell: 'soulrest', d: 30, to: ['the-marsh-burial'],
        x: "Burning is what is done for a body the marsh will not take back. And the marsh does not take back a body it did not have a hand in. So a yard that burns as often as this one is saying something about how the dead here are being made. It is not said aloud at the yard." },
    ],
  },
  {
    id: 'the-north-wall',
    infos: [
      { a: 'legionary', cell: 'stormhold', to: ['the-old-quarter'],
        x: "Six feet of salt block and a gate no man of mine has opened. Stores, per the roll. Show me the requisition and I will walk you as far as the gate. I will not go past it." },
      // No archivist lives in Stormhold — `tools/dialogue/consume.mjs` arm 8 caught this line
      // as unspeakable before it shipped. The register is the same; the record-keeper is a clerk.
      { a: 'clerk', cell: 'stormhold', to: ['the-old-quarter'],
        x: "It is not on the original survey, which is generally taken to mean it was built after, and the survey was not amended, which is generally taken to mean it was not built at all. In most accounts of Stormhold the wall simply appears, fully mortared, in a paragraph about drainage." },
      { a: 'innkeeper', cell: 'stormhold', to: ['the-old-quarter'],
        x: "My grandmother lived on the other side of it and came out. That's all she ever told anyone, and she told it in that order, and she said it like the second half was the strange part. Do you want the room facing it or not?" },
      { a: 'villager', cell: 'stormhold',
        x: "There's a family here still paying rent on a house behind it. The office takes the money. The office has said nothing about the house in nine years." },
    ],
  },
  {
    id: 'the-deep-marsh',
    infos: [
      { a: 'healer', cell: 'thorn', to: ['the-stilled-man', 'the-rot-house'],
        x: "It starts about a day past the last stilt and there is no line drawn on the ground where it starts. People walk in and most of them walk out. The ones who don't come out are not the ones I think about." },
      { a: 'rootkeeper', cell: 'thorn', d: 25, to: ['the-stilled-man', 'the-hist-that-stopped'],
        x: "It is where the trees are older than the arrangement between them and us, supplicant. An older tree is not a kinder one. It is only a tree that has had longer to decide what it thinks of a person walking under it. What is owed there is owed on terms no living person agreed to." },
      { a: 'mudborn', cell: 'thorn', to: ['the-marsh-lights'],
        x: "You can hear the water change, dry-one. That's the whole of it. The water sounds like water for two days and then one morning it sounds like something taking a drink, and if you've any sense that's the morning you turn round." },
      { a: 'outlaw', cell: 'thorn',
        x: "Good place to not be found. Bad place to be found in. I've done both." },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// PART TWO — the gateways. Each entry is one INFO added to an existing, reachable topic.
// `to` is the AddTopic list: every id in it is a word the text actually says.
// ---------------------------------------------------------------------------------------------
const G = [
  // ---- the roads out of every town ----------------------------------------------------------
  { t: 'the-cart-roads', a: 'legionary', cell: 'stormhold',
    to: ['the-road-to-gideon', 'the-road-to-helstrom', 'the-road-to-lilmoth'],
    x: "Three go out of here. The Gideon road is metalled and taxed. The Helstrom road is neither. The Lilmoth road is a river with a reputation. Which of the three are you taking?" },
  { t: 'the-cart-roads', a: 'merchant', cell: 'blackrose',
    to: ['the-road-to-archon', 'the-road-to-blackrose', 'the-road-to-soulrest'],
    x: "The Archon road's four days if the vats haven't flooded and nine if they have. The Soulrest road I won't send a cart down at all any more — that's the second season running. And the Blackrose road, well, you're standing on it." },
  { t: 'the-cart-roads', a: 'innkeeper', cell: 'helstrom',
    to: ['the-road-to-thorn', 'the-road-to-stormhold'],
    x: "Thorn road, two days, and the last of it's plank. Stormhold road, five, and you'll want the boots off at the end of it. I've had both sorts through here this month and the Thorn ones complain less." },

  // ---- the province as a shape --------------------------------------------------------------
  { t: 'the-thirteen-regions', a: 'archivist', cell: 'blackrose',
    to: ['the-western-rootlands', 'the-valus-ridge', 'the-stone-wastes'],
    x: "Thirteen is the Office's number and it is not a good one. The Western Rootlands and the Stone Wastes share a single entry in most accounts — a hundred and forty miles of difference recorded as a comma. The Valus Ridge is entered twice under two spellings, because two surveyors walked it in the same decade and neither read the other." },
  { t: 'the-thirteen-regions', a: 'fisher', cell: 'lilmoth',
    to: ['topal-bay', 'the-padomaic'],
    x: "Topal Bay's warm and shallow and full and it's ours. Then there's the Padomaic past the heads, which is none of those things. My father crossed the line between them once and talked about it for the rest of his life." },
  { t: 'the-thirteen-regions', a: 'townsman', cell: 'thorn',
    to: ['thornmarsh', 'the-hive'],
    x: "We're Thornmarsh, officially. You'll not hear it said. And the Hive is north of us, and you'll not hear that said either, for a different reason. Do you know which reason?" },

  // ---- the Empire's furniture ---------------------------------------------------------------
  { t: 'the-ninth-cohort', a: 'legionary', cell: 'helstrom',
    to: ['the-old-imperial-forts', 'the-curfew'],
    x: "We hold four forts. Two are roofed. The curfew is mine to call and I call it when the tide is wrong, not when the town is loud. Citizen, people get that backwards." },
  // Re-homed from `the-provincial-office`: that topic already carries clerk infos gated on
  // requires.race covering all ten races, which outscore a cell gate 12 to 10, so this line was
  // heard by nobody. Arm 8 of consume.mjs found it. `the-charter` is the Office's own document.
  { t: 'the-charter', a: 'clerk', cell: 'gideon',
    to: ['the-imperial-tongue', 'the-dunmer-question'],
    x: "Everything's filed in the Imperial tongue and about a third of the province can read it. That's not policy, it's just what happened, and the part that surprises people is who the third is — it isn't the Dunmer either, whatever they'll tell you at the factor house." },

  // ---- gods, more than one set --------------------------------------------------------------
  { t: 'the-chapel-of-akatosh', a: 'healer', cell: 'archon',
    to: ['the-nine-here', 'the-bell-that-rings'],
    x: "The Nine are here the way a road is here — the Empire laid it and now it's just the ground. And there's a bell in that chapel that rings on its own maybe twice a year, and the priest has stopped explaining it, and honestly I think he's happier for it." },
  { t: 'the-chapel-of-akatosh', a: 'dres-factor', cell: 'helstrom',
    to: ['the-tribunal-question', 'the-shrine-return'],
    x: "We keep the Tribunal at home and we keep them quietly here, and the chapel affects not to notice. If you were raised to make a shrine return you will find nowhere in this province to make it, and you will find that stops mattering to you in about a year. Were you raised to make one?" },

  // ---- weather, water, hunger ---------------------------------------------------------------
  // Same finding as the two above: `the-tides` carries race-gated fisher infos that outscore a
  // cell gate for every race in the game. Moved to the topic that is actually about the water.
  { t: 'tide-law', a: 'fisher', cell: 'gideon',
    to: ['the-first-tide', 'the-empty-nets'],
    x: "First tide's the one you work. After that you're just wet. And there's been three months now of coming in with nothing in the nets and no one at the market will say the words out loud, so they say the weather instead." },
  { t: 'the-marsh-creatures', a: 'mudborn', cell: 'soulrest',
    to: ['the-marsh-lights', 'the-drums'],
    x: "Lights out over the flats most nights, dry-one, and everyone's got a cousin who followed one, and the cousin is always another man's cousin. The drums are the part I'd ask about, if I were the asking sort. They aren't every night. A thing that came every night would only be weather." },
  { t: 'the-fever-year', a: 'town-elder', cell: 'stormhold',
    to: ['the-thin-years'],
    x: "The fever was one year and everyone remembers the year. What came after was six, and the Office never gave those a name, so I call them the thin years and people know what I mean without me saying how I know." },

  // ---- the tree, the eggs, the hearth --------------------------------------------------------
  { t: 'the-great-hist', a: 'rootkeeper', cell: 'lilmoth', d: 25,
    to: ['the-hist-songs', 'the-egg-tending'],
    x: "What is sung to a tree is not a song in the sense a warmblood means, supplicant. What is done at the egg-tending is not a ceremony in that sense either. Both are closer to what is done for a debt carried so long that the carrying has become the whole of the relation. It is tended. It is not worshipped. That difference is not one this province has ever managed to explain to an Office." },
  { t: 'the-marsh-food', a: 'innkeeper', cell: 'gideon',
    to: ['the-hearths', 'the-mudcrab-money'],
    x: "Nine hearths in this town and eight of them will feed you. The ninth is a family matter. And half the coin over my counter this month has been mudcrab money. It spends fine until the season turns. Have you tried to change any?" },
  { t: 'the-river-boats', a: 'fisher', cell: 'helstrom',
    to: ['the-ferrymen', 'the-fishing-rights'],
    x: "The ferrymen aren't a guild and they'd like you to think they are. As for the rights — my grandfather's water is now three men's water and none of the three is me. I've been to the Office about it twice. Do you know what a third visit costs?" },

  // ---- the towns' own small business ---------------------------------------------------------
  { t: 'lilmoth', a: 'villager', cell: 'lilmoth',
    to: ['the-lamp-tax', 'wide-eye-teel', 'the-warehouse-row'],
    x: "You pay for the lamps whether your street has any. Wide-Eye Teel keeps the list of who's paid and she keeps it in her head, and she's never once been wrong, and not one of her neighbours has ever seen her write. Warehouse row's where you go when you can't pay it." },
  { t: 'stormhold', a: 'merchant', cell: 'stormhold',
    to: ['the-salt-market', 'okan-shei'],
    x: "Salt market's the whole reason there's a town on this rock. Okan-Shei has held the west end for thirty years and has never once undercut a rival — a stranger way to trade than cheating, and it has worked better for him. Are you buying salt or selling it?" },
  { t: 'blackrose', a: 'townsman', cell: 'blackrose',
    to: ['the-rose-yard'],
    x: "The rose yard's the old execution ground and there's roses on it now, planted deliberate, by the prison. The town has never once agreed whether the roses are an apology." },
  { t: 'thorn', a: 'healer', cell: 'thorn',
    to: ['the-thorn-charter', 'the-bone-setter'],
    x: "The charter says Thorn is a village and a village pays no gate fee. The charter is a hundred and eleven years old and the Office has stopped answering letters about it. If you break something out here it's the bone-setter or it's the road, and the road's two days." },
  { t: 'soulrest', a: 'rootkeeper', cell: 'soulrest', d: 30,
    to: ['the-listening-at-soulrest', 'the-bone-setter'],
    x: "The listening is kept at the hour the tide turns, and that is not the same hour twice in a year. A person who wishes to attend must know the water rather than the calendar. It is not a test. It is only what the practice is, and the town has arranged its evenings round it for longer than there has been a town." },

  // ---- the factions, from the inside ----------------------------------------------------------
  { t: 'the-wet-ledger', a: 'clerk', cell: 'gideon',
    to: ['the-underwriters-gate', 'the-second-refusal'],
    x: "Everything goes through the underwriters' gate and the gate is one man with a stamp. He'll refuse you once as a matter of form. It's the second refusal that means anything, and by then you've paid for the first." },
  { t: 'the-drowned-court', a: 'rootkeeper', cell: 'helstrom', d: 30,
    to: ['the-fourth-day', 'the-fourth-silence'],
    x: "The Court sits four days and speaks on three of them. What is decided on the fourth is not written down, because on the fourth day nothing is said at all. A warmblood hears that and assumes a secret is being kept. What is being kept is a silence, and it is kept from the Court itself." },
  { t: 'the-consensus', a: 'townsman', cell: 'gideon',
    to: ['the-removal-that-is-not-one'],
    x: "There's a scribe in this town who was struck off the roll and still comes in every morning and still works. The notary won't call it a removal. She won't call it anything else either." },
  // `the-taking-below` already carries a mudborn-in-Soulrest info, so this one is the town's
  // ordinary voice instead. Two infos with the same filter tie on `infoFor()`'s score and the
  // second is never returned — the unreachable-INFO lint caught exactly that on the first draft
  // of this file, which is the lint doing its job on its author.
  { t: 'the-taking-below', a: 'townsman', cell: 'soulrest',
    to: ['the-sound-below', 'the-drowned-post'],
    x: "There's a sound under the rootlands that the walkers all know and none of them will describe to me, and I've asked four of them, politely, over a year. There's a post down there too, and a walker on it every day. That isn't a rumour, that's a rota." },
  { t: 'what-the-wells-do-now', a: 'townsman', cell: 'archon',
    to: ['what-the-tide-does-now'],
    x: "The wells are what everyone talks about. Not one of them has said a word about what the tide's been doing, and it's been doing it longer." },

  // ---- what a Saxhleel is asked, and what a Saxhleel asks --------------------------------------
  { t: 'the-hatch-name-list', a: 'rootkeeper', cell: 'helstrom', d: 25,
    requires: { race: ['saxhleel', 'naga'] },
    to: ['the-hatching-pool', 'your-egg-year', 'the-second-name', 'your-clutch-mark'],
    x: "A list is kept of the pool a person came out of, the year of the egg, the mark of the clutch and the second name taken after. It is kept by the clutch and not by the Office. The Office has its own list and believes it to be the same list. Supplicant, you have four entries in this province and have read none of them." },
  { t: 'the-hatch-name-list', a: 'clerk', cell: 'lilmoth',
    to: ['the-price-of-a-name', 'the-word-they-use'],
    x: "We take one name and we take it in writing. What that costs a person is not a thing the form has a box for, and I have watched people decide, at my desk, in about four seconds, which of their names they are prepared to give the Empire. The word they use for what I do here is not a polite one and I think it's fair." },
  { t: 'the-lukiul', a: 'townsman', cell: 'gideon',
    requires: { race: ['saxhleel', 'naga'] },
    to: ['what-the-towns-say-about-us', 'the-third-person', 'the-old-tongue', 'your-accent'],
    x: "You talk like the towns. That's not an accusation, it's just the first thing this street noticed about you. Some of us kept the old tongue and some of us kept the third person and most of us kept neither, and the ones who kept both are unbearable at dinner. Which did your house keep?" },
  { t: 'the-covenant', a: 'rootkeeper', cell: 'thorn', d: 30,
    requires: { race: ['saxhleel', 'naga'] },
    to: ['standing-in-the-shallows', 'the-first-molt', 'the-long-swim', 'what-the-marsh-remembers'],
    x: "What is owed is learned in the shallows before it is learned in words. It is learned again at the first molt. It is settled, for those who go, on the long swim. None of the three is taught by being told about it. The marsh remembers a person who did all three and has no opinion whatever about one who did none. It is the absence of opinion that frightens the towns, supplicant, and not the debt." },
  { t: 'hist-sap', a: 'rootkeeper', cell: 'lilmoth', d: 30,
    to: ['what-the-sap-showed-me', 'the-hist-that-stopped', 'what-happens-to-the-old-ones'],
    x: "It shows and it does not say, and what it showed this one is not transferable. A tree that has stopped showing anything at all is not thereby dead. It is a tree that has decided, and no appeal is written anywhere against a tree's decision. The old ones go quiet first. It has never been established what the quiet is the beginning of." },
  { t: 'the-writ-house', a: 'clerk', cell: 'lilmoth',
    to: ['the-warden-scribes-file', 'the-second-ledger', 'what-we-keep-from-the-office'],
    x: "Every writ is copied twice — once for the file the Warden-Scribe keeps and once for the second ledger, which is ours. The Office has been told about the first. Do you want to know why there's a second, or would you rather not be able to say you'd been told?" },
  { t: 'the-boards', a: 'legionary', cell: 'stormhold',
    to: ['cohort-business', 'what-the-tribune-wants', 'the-legion-quartermaster'],
    x: "Two boards. One is cohort business and one is what the Tribune wants, and they are not the same board for a reason. Quartermaster posts on neither. Citizen, if you are after work, it is the quartermaster." },
  { t: 'the-boards', a: 'innkeeper', cell: 'helstrom',
    to: ['the-tribune-drinks', 'the-quiet-route', 'who-informs'],
    x: "The Tribune drinks here on the eleventh of the month and it has never been put on a board. There's a quiet route out the back for people who'd rather not walk past him. And one of the faces in this room tells him who used it. I've decided not to mind." },
  { t: 'house-dres', a: 'dres-factor', cell: 'helstrom',
    to: ['what-the-house-pays-us', 'the-old-cages', 'the-vintage'],
    x: "The House pays a factor in wine and in standing and in coin, in that order, and prefers you not to reckon the third. There are cages behind the yard that have not held anything in twenty years and have not been taken down either. Were you asking about the vintage, or were you asking about the cages?" },
  { t: 'house-dres', a: 'merchant', cell: 'archon',
    to: ['who-buys', 'the-fence-at-helstrom', 'the-count-of-the-taken'],
    x: "There's a buyer and it isn't the House, not directly, not since the treaty. There's a fence at Helstrom who has never once asked me where a thing came from. And there's a count being kept of who's gone missing off this coast, by a woman in Soulrest, and it does not match the Office's count and she'll show it to any caller. Does that sound like a trade to you?" },
  { t: 'the-gate-fee', a: 'clerk', cell: 'archon',
    to: ['the-bank-toll', 'the-boat-tax', 'the-crossing-fee', 'the-surcharge'],
    x: "Bank toll, boat tax, crossing fee, and a surcharge that exists to round the other three up to something a clerk can add in his head. Only the last one is honest about what it's for." },
  { t: 'the-drowned-road', a: 'villager', cell: 'blackrose',
    requires: { race: ['saxhleel', 'naga'] },
    to: ['why-the-village-is-empty', 'the-village-tally', 'the-village-that-moved'],
    x: "You'll pass a village on that road with the doors all shut properly from the outside and not a soul behind them, and it's the doors that stay with you. There's a tally cut in the post at the turning. The village didn't die. It moved, and it moved without telling the Office, and the Office still sends a man to count it." },
  { t: 'the-marsh-magic', a: 'healer', cell: 'lilmoth',
    to: ['the-fever', 'the-smell', 'breathing-here', 'what-to-drink'],
    x: "Half of what I treat in outlanders isn't magic and isn't even the marsh. It's the fever they brought, the smell they can't stop noticing, the breathing, and what they've been drinking. Fix the last one and three of them go away. And not one of them believes me about the water!" },
  { t: 'the-outlander-question', a: 'townsman', cell: 'helstrom',
    forbids: { race: ['saxhleel', 'naga'] },
    to: ['warmblood', 'the-mud-season', 'the-lodging-price', 'your-people-here'],
    x: "Warmblood isn't an insult, it's just a fact about you, and you'll stop hearing it as one around the second mud season. Your people here mostly last one. The lodging price is what it is because of how many didn't." },
  { t: 'the-naga-bands', a: 'naga-elder', cell: 'helstrom',
    to: ['about-the-naga', 'what-the-band-eats', 'what-the-band-owes', 'the-road-south'],
    x: "You've been told what we eat and you've been told what we owe and you've been told both by people who have never been south of the ford. The road south is open. It has been open the whole time, and the bands stay north of it. Why do you suppose that is?" },
  { t: 'the-quiet-wells', a: 'rootkeeper', cell: 'archon', d: 25,
    to: ['the-thing-in-the-cistern', 'the-warehouse-key', 'our-losses'],
    x: "A well that has gone quiet is not empty, supplicant, and it is not a thing that is entered. The cistern under the old warehouse has been quiet two years and has been entered twice. Both keys are now held by people who will not discuss it. What has been lost is being counted somewhere. It is not being counted here." },
  { t: 'the-arnesian-war', a: 'town-elder', cell: 'blackrose',
    to: ['what-tear-thinks', 'the-marsh-burial', 'slavery'],
    x: "Tear thinks it ended. That's the whole of Tear's position and they've held it for two hundred years. Out here the burials from it are still being made, and the practice that started it is still being practised on the water, and if you say either of those in a Dres hall you'll be told you've misunderstood the treaty." },
  { t: 'the-hatch-name-list', a: 'legionary', cell: 'gideon',
    to: ['citizenship', 'home-leave', 'bridge-duty', 'boots'],
    x: "Citizenship comes with the oath. Home leave doesn't. Bridge duty's the one the recruits dodge and it's the one that gets you noticed. Ask the quartermaster for boots twice — the first pair's the ones he wanted rid of!" },
  { t: 'the-crimson-coast', a: 'fisher', cell: 'blackrose',
    to: ['the-net-price', 'the-quiet-grave', 'counting-by-tides'],
    x: "Nets have gone up a third and the fish haven't. We count a man's age in tides out here, which sounds pretty until you've had to do it for a child. There's a grave on the point with no name on it and everyone knows the name." },
  { t: 'the-wet-ledger', a: 'merchant', cell: 'lilmoth',
    to: ['the-office', 'the-factor-house', 'house-business', 'bank-law'],
    x: "Four rooms decide what a thing is worth here: the Office, the factor house, whatever House business is being done that week, and bank law, which is the only one of the four that's written down. Guess which one moves the price." },
  { t: 'the-great-hist', a: 'rootkeeper', cell: 'blackrose', d: 25,
    to: ['root-water', 'the-drowned-kin', 'hist-debt', 'what-the-sap-says'],
    x: "Root water is drawn and drunk and it is not a sacrament. The drowned kin are under and are not gone. The debt is carried and was never agreed to. What the sap says is said to one person at a time and is not repeated after. Four things, supplicant, and a warmblood scholar has written a book on each without having done any of them." },
  { t: 'the-sap-cutters', a: 'sapcutter', cell: 'lilmoth',
    to: ['the-hist', 'egg-tending', 'what-the-cohort-sells'],
    x: "This one cuts. This one doesn't ask the tree first, friend, and this one knows what that's worth. Egg-tending season the yards go quiet — every hand's gone home. And the Cohort sells the sap on, which they'll deny. Have you seen their manifest?" },
  { t: 'the-organ-market', a: 'outlaw', cell: 'gideon',
    to: ['the-second-name', 'the-old-cages', 'who-buys'],
    x: "A man came through here selling a second name off a dead cousin, papers and all. There's cages in this trade that haven't been opened in years and every runner knows where they stand. There's still a buyer. Not asking who." },
  { t: 'the-drowned-court', a: 'townsman', cell: 'helstrom',
    to: ['what-we-are-owed'],
    x: "Ask anyone here what the Court is for and you'll get the same answer in a different order. Ask what we're owed by it and the room goes quiet, and it isn't a sullen quiet — it's people doing arithmetic." },
  { t: 'the-fee', a: 'clerk', cell: 'stormhold',
    to: ['the-lodging-price', 'the-bank-toll', 'the-surcharge'],
    x: "The fee's set by the Office and the lodging price is set by whoever has a roof, and only one of those has ever been appealed successfully. Add the bank toll and the surcharge and you'll find the roof is cheaper than the paper." },
];

function build() {
  const byTopic = new Map();
  for (const g of G) {
    const info = { a: g.a, cell: g.cell };
    if (g.d != null) info.d = g.d;
    if (g.requires) info.requires = g.requires;
    if (g.forbids) info.forbids = g.forbids;
    info.x = g.x;
    if (g.to && g.to.length) info.to = g.to;
    if (!byTopic.has(g.t)) byTopic.set(g.t, []);
    byTopic.get(g.t).push(info);
  }
  const topics = [...NEW_TOPICS];
  for (const [id, infos] of byTopic) topics.push({ id, infos });
  return {
    schema: 'elder-souls/dialogue-topics@2',
    group: 'asking-around',
    owner: "W1-17. The connective tissue: the answers whose nouns make the province's other 109 subjects askable.",
    key_legend_ref: 'topics/00-roots.json#key_legend',
    generated_by: 'tools/dialogue/mk-asking-around.mjs',
    why: "build-graph.mjs reported 151 orphans — topics with authored text and no way in. 42 were advertised on an NPC's own `topics` array and are reachable in the running game; 109 were reachable by nothing at all. In Morrowind a subject becomes askable because somebody says the word in front of you, so these are answers, not an index.",
    house_rule: "Every info carries both an actor and a cell, and this file sorts ahead of every file these topics are declared in, so the more-constrained info is authored above the less-constrained one under both Morrowind's first-match rule and infoFor()'s specificity score. No line here closes on a direction; check-prose measures that as `echo_direction` and ours already runs 2.82x the reference.",
    topics,
  };
}

const doc = build();
fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
const infos = doc.topics.reduce((a, t) => a + t.infos.length, 0);
const adds = doc.topics.reduce((a, t) => a + t.infos.reduce((b, i) => b + (i.to || []).length, 0), 0);
console.log(`wrote ${path.relative(ROOT, OUT)} — ${doc.topics.length} topic records, ${infos} infos, ${adds} AddTopic edges`);

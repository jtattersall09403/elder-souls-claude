#!/usr/bin/env node
// gen-magic-quests.mjs — the 24 quests RI-MAG04's census counts, written to
// corpus/30-quests/quest.schema.json and emitted as game/data/quests/magic-utility.json.
//
// Why a generator rather than 24 hand-written files: the census (Q1-Q12) is the artifact, and
// the census is only meaningful if the shape is uniform — every quest has a magic route, at
// least one non-magic route (Q8 is 100% and any breach is a LOCKOUT), a real `requires`, and a
// journal in the player's own voice. The prose is authored; the scaffolding is not.
//
// Run: node tools/analysis/gen-magic-quests.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// shape S1..S8 from RI-MAG04 §C. Each must appear on >= 2 quests and none on > 35%.
// `mo` = magic is the ONLY non-violent route (Q6 wants 4-10 of these).
const Q = [
  // ---- S1 ACCESS ------------------------------------------------------------------------------
  { id: 'mag_the_warded_ledger', t: 'The Warded Ledger', cat: 'faction', fac: 'the_dockhands', shape: 'S1', kind: 'theft', stakes: 5,
    giver: ['harbourmistress-tesh', 'lilmoth-customs'], topic: 'the ledger',
    hook: 'Tesh says the ledger that would prove the gem-running is behind a warded door in the customs loft. She says it as if the door were weather.',
    fx: ['open_lock', 'shatter'], school: 'warding', req: { skills: { warding: 45, sorcery: 25 } },
    magic: 'The ward comes apart like a knot and the hinge pins come off with it. The ledger is where she said, and the last four pages are in a different hand.',
    alts: [
      ['bribe', { gold: 400, disposition: 45 }, 'The undercustomer takes four hundred and turns his back for the length of a cigarette.'],
      ['steal', { skills: { security: 55 } }, 'The collar-ward gives on the third pin. Nobody hears it.'],
      ['combat', null, 'The undercustomer is not paid enough to die for a loft. He does anyway.'],
    ] },
  { id: 'mag_the_seized_hull', t: 'The Seized Hull', cat: 'side', shape: 'S1', kind: 'retrieval', stakes: 4,
    giver: ['shipwright-oleen', 'lilmoth-yard'], topic: 'the seized hull',
    hook: 'Oleen wants her tools back off a hull the customs house has chained shut. She will not say why she is not asking the customs house.',
    fx: ['corrode'], school: 'sorcery', req: { skills: { sorcery: 45 } }, knowledge: ['chain_iron_from_stormhold'],
    magic: 'Stormhold iron rots green when you ask it to. The chain came apart in my hands and left a stain on the deck that is still there.',
    alts: [
      ['persuade', { disposition: 60 }, 'The customs clerk decides, out loud, that the seal was never properly lodged.'],
      ['steal', { skills: { security: 40 } }, 'The padlock is older than the seal on it.'],
    ] },
  { id: 'mag_the_barred_window', t: 'The Barred Window', cat: 'side', shape: 'S1', kind: 'theft', stakes: 3,
    giver: ['fence-ashul', 'gideon-lowmarket'], topic: 'the barred window', mo: true,
    hook: 'Ashul wants a reliquary out of a shrine-house that has no door on the street side and a guard on the other.',
    fx: ['telekinesis'], school: 'sorcery', req: { skills: { sorcery: 45 } },
    magic: 'Twenty-five metres of reach and a barred window are the same thing as an open door. The guard never turned round.',
    alts: [
      ['combat', null, 'I went in through the guard. The reliquary is worth less now that it is known to be missing, and the shrine-house has a body in it.'],
    ] },
  // ---- S2 TRAVERSAL ---------------------------------------------------------------------------
  { id: 'mag_the_drowned_wreck', t: 'The Drowned Wreck', cat: 'side', shape: 'S2', kind: 'retrieval', stakes: 4,
    giver: ['widow-ineel', 'thornmarsh-stilts'], topic: 'the drowned wreck',
    hook: 'Ineel says her husband went down with the Saltgirl and that the ship is nine metres under at the bar mouth. She wants the log, not the man.',
    fx: ['slowfall', 'breathe_water'], school: 'warding', req: { skills: { warding: 0 } },
    magic: 'Off the bar head is a nine-metre drop and then nine metres of water. I went down both of them slowly and came up with the log. It says he turned the ship around.',
    alts: [
      ['wait', { knowledge: ['thornmarsh_tide_table'] }, 'The spring tide takes four metres off the bar for eleven minutes. I did not need a spell; I needed a table.'],
      ['persuade', { disposition: 55 }, 'A Naga diver goes down for me and asks for nothing, which is worse.'],
    ] },
  { id: 'mag_the_xanmeer_shelf', t: 'The Xanmeer Shelf', cat: 'main', shape: 'S2', kind: 'investigation', stakes: 8,
    giver: ['rootkeeper-jeen', 'helstrom-undertemple'], topic: 'the upper shelf', mo: true,
    hook: 'Jeen says the answer is on the shelf above the plaza and that the stair to it fell in before her grandmother was born.',
    fx: ['levitate', 'slowfall'], school: 'warding', req: { skills: { warding: 65 } }, knowledge: ['xanmeer_shelf_is_reachable'],
    magic: 'Twelve metres of climb cost me eighteen of sap and most of an afternoon. The carving on the shelf is not in Jel and it is not in Cyrodiilic.',
    alts: [
      ['combat', null, 'The hackwings over the plaza have to be cleared before the west buttress can be climbed at all. It takes most of a day and there are a lot of them.'],
    ] },
  { id: 'mag_the_sunken_causeway', t: 'The Sunken Causeway', cat: 'side', shape: 'S2', kind: 'errand', stakes: 3,
    giver: ['warden-eshi', 'thornmarsh-hall'], topic: 'the causeway',
    hook: 'Eshi mentions that nobody has walked the old causeway to Salt Hills since the water came up over it.',
    fx: ['buoyancy', 'slowfall'], school: 'warding', req: { skills: { warding: 25 } },
    magic: 'I walked the causeway on top of the water it is under. It is still a road; it is simply a road below a road.',
    alts: [
      ['trade', { gold: 60 }, 'The barge takes sixty gold and two hours and lands you at the far end anyway.'],
      ['wait', { knowledge: ['thornmarsh_tide_table'] }, 'At low spring the causeway is ankle-deep for forty minutes.'],
    ] },
  // ---- S3 CONCEALMENT -------------------------------------------------------------------------
  { id: 'mag_the_deep_kin_conclave', t: 'The Deep-Kin Conclave', cat: 'faction', fac: 'deep_kin', shape: 'S3', kind: 'politics', stakes: 7,
    giver: ['xul-aneekh-speaker', 'deep-marshes-hollow'], topic: 'the conclave',
    hook: 'The conclave admits no foreigner and no one whose name is not spoken by someone inside. I am both.',
    fx: ['false_face'], school: 'veiling', req: { skills: { veiling: 65 } },
    magic: 'I wore a face that was not mine for three minutes and heard what they decided. I have not been able to stop thinking about whose face it was.',
    alts: [
      ['persuade', { faction_rank: { faction: 'deep_kin', min_rank: 4 } }, 'Rank four walks in through the front of the hollow.'],
      ['lore_knowledge', { knowledge: ['the_name_teel_ashaan'] }, 'Speaking a name you were given inside is the whole of the door.'],
    ] },
  { id: 'mag_the_counting_house', t: 'The Counting House', cat: 'side', shape: 'S3', kind: 'theft', stakes: 5,
    giver: ['fence-ashul', 'gideon-lowmarket'], topic: 'the counting house',
    hook: 'Two clerks, one lamp, and a strongbox that is only open between the eighth and ninth bell.',
    fx: ['invisibility'], school: 'veiling', req: { skills: { veiling: 45 } },
    magic: 'The water-film held until I touched the box. It was enough; I was already past them.',
    alts: [
      ['sneak', { skills: { sneak: 60 } }, 'The lamp has a blind side and the clerks are not looking for one.'],
      ['bribe', { gold: 700 }, 'One clerk is cheaper than the other and knows it.'],
      ['combat', null, 'Two clerks. It is not difficult and it is not quiet.'],
    ] },
  { id: 'mag_the_quiet_floor', t: 'The Quiet Floor', cat: 'side', shape: 'S3', kind: 'investigation', stakes: 4,
    giver: ['scribe-hulen', 'stormhold-archive'], topic: 'the quiet floor',
    hook: 'Hulen wants to know who has been in the archive at night. The floor above the archive is boards over a drum of empty air.',
    fx: ['muffle'], school: 'veiling', req: { skills: { veiling: 0 } },
    magic: 'I crossed the drum floor without it saying anything about me, and watched the archivist do the same on his own.',
    alts: [
      ['sneak', { skills: { sneak: 50 } }, 'Along the joists, one foot at a time, is slow and silent.'],
      ['persuade', { disposition: 70 }, 'The night warden tells me who signs in, which is the same answer with less floor.'],
    ] },
  // ---- S4 SOCIAL ------------------------------------------------------------------------------
  { id: 'mag_the_witness', t: 'The Witness', cat: 'faction', fac: 'the_imperial_assize', shape: 'S4', kind: 'moral_dilemma', stakes: 6,
    giver: ['assizer-corvo', 'gideon-court'], topic: 'the witness',
    hook: 'The woman saw it. She will not say so, and Corvo will not say why she will not.',
    fx: ['charm'], school: 'veiling', req: { skills: { veiling: 0 } },
    magic: 'She told me everything in a warm room and I have thought about that room since. What she said was true. That is not the same as it being mine to have.',
    alts: [
      ['bribe', { gold: 225, disposition: 40 }, 'Two hundred and twenty-five gold and she testifies, and she is afraid the whole time.'],
      ['lore_knowledge', { knowledge: ['the_thing_she_is_afraid_of'] }, 'I found what she is afraid of and dealt with it. She testified without being asked.'],
      ['intimidate', { attributes: { strength: 45 } }, 'She testified. She will not look at me in the street.'],
    ] },
  { id: 'mag_the_stilt_house_dog', t: 'The Stilt-House Guard', cat: 'side', shape: 'S4', kind: 'errand', stakes: 2,
    giver: ['herbwife-ossa', 'thornmarsh-stilts'], topic: 'the guar in the yard',
    hook: 'Ossa cannot get to her own drying racks. The guar in the yard is not hers and will not move.',
    fx: ['calm_beast'], school: 'root_speech', req: { skills: { root_speech: 25 } },
    magic: 'I asked the guar to be still and it was still, and Ossa got her racks back without anything dying in her yard.',
    alts: [
      ['trade', { items: ['saltrice_bundle'] }, 'A bundle of saltrice moves a guar further than a spell does.'],
      ['combat', null, 'The guar is dead. Ossa has her racks and does not thank me.'],
    ] },
  { id: 'mag_the_two_brothers', t: 'The Two Brothers', cat: 'side', shape: 'S4', kind: 'rival_conflict', stakes: 6,
    giver: ['innkeeper-veth', 'blackrose-inn'], topic: 'the two brothers', mo: true,
    hook: 'Veth wants the older brother out of her inn and the younger one to stop paying for him to be in it.',
    fx: ['demoralise'], school: 'veiling', req: { skills: { veiling: 25 } },
    magic: 'I put enough fear in him to walk. He walked. He is somewhere, and I do not know where, and that is now a thing about me.',
    alts: [
      ['combat', null, 'The older brother is dead in the common room and the younger one saw it.'],
    ] },
  // ---- S5 KNOWLEDGE ---------------------------------------------------------------------------
  { id: 'mag_who_paid_him', t: 'Who Paid Him', cat: 'main', shape: 'S5', kind: 'investigation', stakes: 8,
    giver: ['assizer-corvo', 'gideon-court'], topic: 'the dead runner', mo: true,
    hook: 'The runner is dead in an alley with a full purse, which means he was not killed for the purse.',
    fx: ['speak_to_the_dead'], school: 'root_speech', req: { skills: { root_speech: 45 } }, knowledge: ['the_runners_name'],
    magic: 'I asked him and he answered, in the flat way they answer. He named a house. He did not name a person, because he never saw one.',
    alts: [
      ['combat', null, 'The house sends someone to stop me asking. What he carries answers the question, and I had to take it off him.'],
    ] },
  { id: 'mag_the_lost_key', t: 'The Lost Key', cat: 'side', shape: 'S5', kind: 'retrieval', stakes: 3,
    giver: ['shipwright-oleen', 'lilmoth-yard'], topic: 'the lost key',
    hook: 'The key to the yard store went into the mud somewhere between the slip and the gate, some time in the last three years.',
    fx: ['detect_key'], school: 'veiling', req: { skills: { veiling: 25 } },
    magic: 'It is four metres from the gate, under sixty centimetres of yard, and it has been there long enough to be part of the yard.',
    alts: [
      ['trade', { gold: 90 }, 'A new lock is ninety gold and takes an hour.'],
      ['persuade', { disposition: 50 }, 'The old yardman remembers the day it went and roughly where he was standing.'],
    ] },
  { id: 'mag_the_hollow_count', t: 'The Hollow Count', cat: 'faction', fac: 'the_rootkeepers', shape: 'S5', kind: 'investigation', stakes: 6,
    giver: ['rootkeeper-jeen', 'helstrom-undertemple'], topic: 'the hollow count',
    hook: 'Jeen wants to know how many are living in the hollow under the east root. Nobody who goes in comes back saying a number.',
    fx: ['detect_life'], school: 'veiling', req: { skills: { veiling: 25 } },
    magic: 'Eleven warm smudges, and one of them is very large and has not moved in a long time. I did not go in.',
    alts: [
      ['sneak', { skills: { sneak: 65 } }, 'You can count them from the lip if you are patient and low.'],
      ['combat', null, 'I counted them by killing them, which is a count Jeen did not want.'],
    ] },
  // ---- S6 SURVIVAL ----------------------------------------------------------------------------
  { id: 'mag_the_kiln_flues', t: 'The Kiln Flues', cat: 'side', shape: 'S6', kind: 'retrieval', stakes: 5,
    giver: ['potter-mek', 'stone-wastes-kiln'], topic: 'the flues',
    hook: 'Mek dropped a whole firing into the flue and the flue is hot on a cycle nobody has written down.',
    fx: ['resist_element'], school: 'root_speech', req: { skills: { root_speech: 0 } },
    magic: 'Thick skin and eleven seconds. My eyebrows are a separate problem.',
    alts: [
      ['wait', { knowledge: ['the_kiln_cycle'] }, 'The cycle is nine minutes on and four off, and everyone in the Stone Wastes knows it except me.'],
      ['bribe', { gold: 150 }, 'A Naga walks in and out of the flue for a hundred and fifty gold and calls it easy money.'],
    ] },
  { id: 'mag_the_rot_house', t: 'The Rot House', cat: 'side', shape: 'S6', kind: 'errand', stakes: 5,
    giver: ['herbwife-ossa', 'thornmarsh-stilts'], topic: 'the rot house',
    hook: 'The house at the end of the walk has had swamp-rot in it for two seasons and the family are still in it.',
    fx: ['cure_disease', 'resist_disease'], school: 'root_speech', req: { skills: { root_speech: 0 } },
    magic: 'I cleaned the blood of three people and burned the reed mats. The rot came out of the mats, which nobody had thought to say.',
    alts: [
      ['trade', { gold: 240 }, 'The temple sells the cure at eighty a head and does not ask about the mats.'],
      ['persuade', { disposition: 60 }, 'The family can be talked into leaving the house, which cures them and ends the house.'],
    ] },
  { id: 'mag_the_burning_bank', t: 'The Burning Bank', cat: 'side', shape: 'S6', kind: 'weird', stakes: 4,
    giver: ['warden-eshi', 'thornmarsh-hall'], topic: 'the voriplasm',
    hook: 'Something clear and slow has come up the bank and is on the path, and Eshi says it is not an animal and not a plant.',
    fx: ['fire_damage'], school: 'sorcery', req: { skills: { sorcery: 0 } },
    magic: 'Burning resin takes voriplasm off a bank the way salt takes a slug. The path is a path again and the bank is black.',
    alts: [
      ['wait', null, 'It goes back down at the turn of the tide, four hours later, and comes back the next day.'],
      ['lore_knowledge', { knowledge: ['voriplasm_hates_salt'] }, 'Two barrows of salt from the pans, spread thin. It will not cross it again.'],
    ] },
  // ---- S7 DENIAL ------------------------------------------------------------------------------
  { id: 'mag_ninety_seconds', t: 'Ninety Seconds', cat: 'main', shape: 'S7', kind: 'politics', stakes: 9,
    giver: ['rootkeeper-jeen', 'deep-marshes-hollow'], topic: 'the naming', mo: true,
    hook: 'The naming takes ninety seconds from the first word and cannot be undone once it is finished.',
    fx: ['silence'], school: 'veiling', req: { skills: { veiling: 45 } }, knowledge: ['the_naming_needs_a_voice'],
    magic: 'I took the speaker\'s voice and the ninety seconds ran out with nothing in them. The congregation stood there and then went home.',
    alts: [
      ['combat', null, 'The speaker is dead and the naming stopped, and now there is a dead speaker.'],
      ['persuade', { disposition: 65, knowledge: ['what_the_naming_costs'] }, 'I told the congregation what it would cost them. Eleven of them left and it needed twelve.'],
    ] },
  { id: 'mag_the_far_exit', t: 'The Far Exit', cat: 'faction', fac: 'the_dockhands', shape: 'S7', kind: 'retrieval', stakes: 6,
    giver: ['harbourmistress-tesh', 'lilmoth-customs'], topic: 'the far exit',
    hook: 'What Tesh wants is in a room with four of them in it, and she does not want four bodies in a room she has to explain.',
    fx: ['paralyse', 'slowfall'], school: 'veiling', req: { skills: { veiling: 65 }, },
    magic: 'I stilled the room, walked through it, and went out of the far door, which opens onto nine metres of nothing and then the wharf. They were still standing when I left and I did not take anything else.',
    alts: [
      ['sneak', { skills: { sneak: 70 } }, 'Four of them, one lamp, and a long way to the far door.'],
      ['combat', null, 'Four bodies in a room Tesh has to explain.'],
    ] },
  { id: 'mag_the_door_that_stays_shut', t: 'The Door That Stays Shut', cat: 'side', shape: 'S7', kind: 'escort', stakes: 5,
    giver: ['innkeeper-veth', 'blackrose-inn'], topic: 'the cellar door',
    hook: 'Veth needs the cellar door to stay shut for one night with something on the other side of it.',
    fx: ['lock_lock'], school: 'warding', req: { skills: { warding: 0 } },
    magic: 'I sealed the door harder than it was built and sat against it. Whatever it was stopped trying at about the fourth bell.',
    alts: [
      ['trade', { gold: 40 }, 'Forty gold of iron bar and a carpenter who is awake at that hour.'],
      ['combat', null, 'I opened the door instead. It is dealt with and Veth has a new cellar door to buy.'],
    ] },
  // ---- S8 REPAIR ------------------------------------------------------------------------------
  { id: 'mag_the_broken_heirloom', t: 'The Broken Heirloom', cat: 'side', shape: 'S8', kind: 'moral_dilemma', stakes: 4,
    giver: ['widow-ineel', 'thornmarsh-stilts'], topic: 'the heirloom', mo: true,
    hook: 'It came apart in my hands and the family will not talk to a stranger holding it in pieces.',
    fx: ['mend_item'], school: 'root_speech', req: { skills: { root_speech: 25 } },
    magic: 'I put it back together well enough that only I know. That is a thing I now know about myself.',
    alts: [
      ['combat', null, 'The family found out how it broke. It ended badly and the heirloom is still in pieces.'],
    ] },
  { id: 'mag_the_stilled_man', t: 'The Stilled Man', cat: 'side', shape: 'S8', kind: 'errand', stakes: 5,
    giver: ['herbwife-ossa', 'thornmarsh-stilts'], topic: 'the stilled man',
    hook: 'A hunter came back from the deep marsh standing up and has not moved since. He is warm and he is looking at us.',
    fx: ['cure_paralysis'], school: 'root_speech', req: { skills: { root_speech: 25 } },
    magic: 'I loosened the joint and he fell down and swore at me for four minutes without stopping. He remembers all of it.',
    alts: [
      ['trade', { gold: 80 }, 'The temple has a draught for it and charges eighty.'],
      ['wait', null, 'It wears off in nine days. He remembers those too.'],
    ] },
  { id: 'mag_the_hollowed_scribe', t: 'The Hollowed Scribe', cat: 'faction', fac: 'the_rootkeepers', shape: 'S8', kind: 'investigation', stakes: 7,
    giver: ['scribe-hulen', 'stormhold-archive'], topic: 'the hollowed scribe',
    hook: 'Hulen\'s assistant can still write and can no longer read. Something took the part of him that knew what the marks meant.',
    fx: ['restore_attribute'], school: 'root_speech', req: { skills: { root_speech: 25 } }, knowledge: ['what_took_the_scribe'],
    magic: 'I put back what was taken. He read the first line aloud and then would not read the second.',
    alts: [
      ['lore_knowledge', { knowledge: ['what_took_the_scribe', 'the_gem_that_holds_him'] }, 'Breaking the gem gives it back on its own, and breaks something else.'],
      ['combat', null, 'I killed the thing that took it. He got it back and it was not clean.'],
    ] },
];

const SCHOOL_SKILL = { sorcery: 'sorcery', root_speech: 'root_speech', warding: 'warding', veiling: 'veiling' };

function build(q, i) {
  // W1-18: the journal index bands are RI-QST04 §B and they are binding — 10 accepted,
  // 11-39 progress, 70-89 failure, 90-99 success (one index per resolution), 100 closed. The
  // first cut of this generator wrote every ending as `state: 'complete'` at indices 40-70+,
  // which is not a state quest.schema.json declares (so the file did not validate) and put
  // successes in the failure band (so RI-QST04 check 5 fired on all 24). Fixed here rather
  // than in the emitted JSON, because the emitted JSON is generated.
  const jIdx = { hook: 10, magic: 90 };
  const journal = [
    { index: jIdx.hook, text: q.hook, state: 'active' },
    { index: 30, text: 'There is more than one way at this. There always is; the trick is noticing the second one before you have used the first.', state: 'active' },
    { index: 70, text: 'It resolved itself while I was elsewhere, and not well. Nobody has raised it with me since.', state: 'failure' },
    { index: jIdx.magic, text: q.magic, state: 'success' },
  ];
  let n = 91;
  const resolutions = [{
    id: `${q.id}__magic`,
    method: 'magic_utility',
    requires: {
      ...(q.req || {}),
      spell_effects: q.fx,
      ...(q.knowledge ? { knowledge: q.knowledge } : {}),
    },
    violence_required: false,
    journal_index: jIdx.magic,
    outcome: q.magic,
    morally_better: null,
  }];
  for (const [method, requires, outcome] of q.alts) {
    journal.push({ index: n, text: outcome, state: 'success' });
    resolutions.push({
      id: `${q.id}__${method}`,
      method,
      ...(requires ? { requires } : {}),
      violence_required: method === 'combat',
      journal_index: n,
      outcome,
      morally_better: null,
    });
    n += 1;
  }
  journal.sort((a, b) => a.index - b.index);
  return {
    // RI-QST04 §A: `^Q-[A-Z]{2,6}-[0-9]{2,3}$`. The first cut of this generator used the
    // authoring slug as the id, so none of the 24 validated. The slug survives as `slugOf`,
    // which is stripped before the file is written.
    id: `Q-MAG-${String(i + 1).padStart(2, '0')}`,
    slugOf: q.id,
    title: q.t,
    category: q.cat,
    ...(q.fac ? { faction: q.fac } : {}),
    ...(q.cat === 'main' ? { act: 2 } : {}),
    discovery: q.cat === 'main' ? 'given' : (i % 4 === 0 ? 'overheard' : 'given'),
    giver: { npc_id: q.giver[0], location: q.giver[1], honest: true },
    opens_by: {
      topic: q.topic,
      // The schema requires `overheard_from` whenever discovery is `overheard`: a quest you
      // hear about must have someone to have heard it from (RI-JRN07 M-Q4).
      ...(q.cat !== 'main' && i % 4 === 0 ? { overheard_from: [q.rumour_from || 'innkeeper-veth', 'herbwife-ossa'] } : {}),
    },
    task_kind: q.kind,
    stakes: q.stakes,
    directions: 'Given in prose by the giver and repeated in the journal. There is no marker of any kind on this quest and there is none anywhere in this build.',
    journal,
    resolutions,
    can_fail: true,
    failure_states: [{
      id: `${q.id}__too_late`,
      cause: 'The situation resolves itself, badly, without you.',
      journal_index: 70,
      recoverable: false,
      consequence: 'The giver stops raising the topic. Nobody explains why.',
    }],
    deceit: null,
    kill_required_npcs: [],
    rewards: [
      { type: q.stakes >= 7 ? 'information' : 'gold', unique_named: false, amount: q.stakes * 45 },
    ],
    consequences: {
      npc_disposition: { [q.giver[0]]: 8 },
      ...(q.fac ? { faction_reputation: { [q.fac]: 5 } } : {}),
    },
    notes: `RI-MAG04 shape ${q.shape}. Magic is a ROUTE, never a REQUIREMENT: ${resolutions.length - 1} non-magic resolution(s) exist${q.mo ? ', though this is one of the Q6 quests where magic is the only NON-VIOLENT one — combat remains available' : ''}.`,
  };
}

// ---------------------------------------------------------------------------------------------
// W1-18 addendum. Three fields these 24 quests shipped without, each of which is load-bearing
// for an item outside RI-MAG04 and none of which changes a magic number:
//
//  * `dir` — real prose wayfinding. The shipped placeholder read "There is no marker of any
//    kind on this quest…", which contains the literal token `marker` and is therefore a hit for
//    RI-DLG05 §D rule 2 and RI-JRN07 M-Q17, both of which grep the quest corpus. It was also
//    not directions: RI-QST04 §D requires 100% of quests to carry wayfinding "sufficient to
//    reach the target without a marker", and a sentence about markers is not that.
//  * `br` — the branch condition. RI-QST04 §D wants mean branches >= 1.3 and hard-fails below
//    1.0; a quest with four resolutions and no declared fork is a menu, not a branch.
//  * `rep2` / `sil` — a second faction on the reputation delta (RI-QST04 §D, >= 30% of quests)
//    and a handful of silent failures (5-15% of failure states).
//
// The magic route, its `requires`, its effects and every line of authored prose are untouched.
const EXTRA = {
  mag_the_warded_ledger: { dir: 'The customs house is the long grey building at the head of the Lilmoth wharf, the one with the crane arm. The loft door is off the inside stair, past the weighing floor, and it is the only door on that landing.', br: 'The loft is open and the last four pages are in another hand: keep reading, take the ledger, or put it back', rep2: ['the_imperial_assize', -4] },
  mag_the_seized_hull: { dir: 'Oleen keeps her yard at the south end of the Lilmoth strand, where the mud starts. The seized hull is the one careened furthest out with a customs chain through the rudder head.', br: 'The chain is off: take the tools only, or take what else the hull is carrying', rep2: ['the_dockhands', 3] },
  mag_the_barred_window: { dir: 'Ashul trades out of the low market in Gideon, under the timber arcade. The shrine-house is three streets north, blind wall to the street, and the barred window is the high one on the alley side.', br: 'The reliquary is in reach: take it quietly, or be seen taking it', sil: true },
  mag_the_drowned_wreck: { dir: 'Ineel lives on the stilts at the Thornmarsh bar. The Saltgirl went down off the bar head, straight out from her ladder, and you can see the mast stub at low water.', br: 'The log says he turned the ship around: tell her, or give her the log unread' },
  mag_the_xanmeer_shelf: { dir: 'The undertemple stair comes up into the Helstrom plaza. The shelf is the terrace above the west face, over the fallen stair, and the carving is on the inner wall where the roof still holds.', br: 'The carving is in neither Jel nor Cyrodiilic: copy it, take it, or leave it where the Deep-Kin can still read it', rep2: ['deep_kin', -6] },
  mag_the_sunken_causeway: { dir: 'The causeway leaves Thorn at the gate Eshi keeps and runs on toward the Salt Hills. Follow the line of drowned posts; where the posts stop, the road has gone.', br: 'The far end is walkable: report it open, or keep it to yourself' },
  mag_the_deep_kin_conclave: { dir: 'The hollow is a day into the Deep Marshes on the root track that leaves Helstrom by the eastern sapwell. Follow the cut roots; where the cutting stops, you are inside their ground.', br: 'What the conclave decided is now known to you: carry it to the coast, or keep it', rep2: ['the_wet_ledger', -8] },
  mag_the_counting_house: { dir: 'The counting house is the tall narrow one on the Gideon market cross, with the shutters that are never open. The strongbox room is at the top of the inside stair.', br: 'The box is open: take the coin, take the book of names, or take both' },
  mag_the_quiet_floor: { dir: 'The archive is under the Stormhold garrison, down the stair beside the granary. The drum floor is the boarded room above it, reached from the mess passage.', br: 'You know who has been coming at night: tell Hulen, or ask the archivist first', sil: true },
  mag_the_witness: { dir: 'The court sits in the Imperial compound in Gideon. The woman keeps a stall at the fish steps below the bridge, and she is there before the second bell and gone after it.', br: 'She has told you what she saw: enter it as testimony, or use it and leave her out of it', rep2: ['the_wet_ledger', -5] },
  mag_the_stilt_house_dog: { dir: "Ossa's racks are behind the third stilt house on the Thornmarsh boardwalk, the one with the split ladder. The yard is under the house and the guar is in it." , br: 'The yard is clear: return the guar to its owner, or say nothing about whose it was' },
  mag_the_two_brothers: { dir: 'The inn is inside the Blackrose gate, first building on the left. The brothers work the lease gang and come back through the yard at dusk.', br: 'You know which brother lied: say so in front of both, or take one of them aside', rep2: ['the_imperial_assize', -6] },
  mag_who_paid_him: { dir: 'The runner went down on the Gideon road, at the ford below the mile post where the bank is cut. The body was carried back to the court cellar.', br: 'The purse names a payer: give the name to Corvo, or to the payer', rep2: ['the_wet_ledger', -7] },
  mag_the_lost_key: { dir: 'Oleen thinks it went into the mud between her yard and the tide line, somewhere along the plank walk she uses twice a day.', br: 'The key is found: hand it back, or copy it first' },
  mag_the_hollow_count: { dir: 'The sapwells are under Helstrom, down the root stair from the undertemple. The count is kept on the wall of the furthest chamber, where the roots come through the floor.', br: 'The count does not match the wall: tell Jeen, or tell the coast', rep2: ['ixtu_vakh', -9] },
  mag_the_kiln_flues: { dir: "Mek's kiln stands on the Stone Wastes road, an hour east of the last well, and you will see its smoke before its roof. The flues are the brick runs behind the firing shed.", br: 'The flue is clear: fire it now, or wait for the wind to turn' },
  mag_the_rot_house: { dir: 'The rot house is the shut one at the end of the Thornmarsh boardwalk, past the racks, where the planks give under you.', br: 'The house can be saved or burned: choose before the rot reaches the walkway', sil: true },
  mag_the_burning_bank: { dir: 'The voriplasm is in the reed bank on the Thorn side of the water, upstream of the gate, where the current slows and the reeds are yellow.', br: 'The bank is dealt with: tell Eshi how, or let her assume' },
  mag_ninety_seconds: { dir: 'The naming is held at the hollow in the Deep Marshes, on the root track east of the Helstrom sapwell. It begins when the water goes still and it does not wait.', br: 'The naming is done: keep the name, or give it away' },
  mag_the_far_exit: { dir: 'The far exit is the seaward end of the Lilmoth customs cellars, reached from the wharf under the crane arm and coming out on the rocks below the old quarter.', br: 'The passage is open: use it once, or tell the harbourmistress it exists' },
  mag_the_door_that_stays_shut: { dir: "The cellar door is at the back of the Blackrose inn yard, under the outside stair, and it has not been opened since Veth's father held the lease.", br: 'The cellar is open: tell Veth what is in it, or shut it again' },
  mag_the_broken_heirloom: { dir: 'Ineel keeps the pieces in the chest under her window on the Thornmarsh stilts. The smith who could match the work is in Stormhold, inside the wall, on the smiths’ row.', br: 'The heirloom is whole: return it, or keep the piece that was not hers' },
  mag_the_stilled_man: { dir: 'The man is in the back room of the herb house on the Thornmarsh boardwalk, second door past the racks. He has not moved since the tide before last.', br: 'He wakes or he does not: tell his people the truth, or the kinder version', sil: true },
  mag_the_hollowed_scribe: { dir: 'The scribe worked the copying desk in the Stormhold archive, down the stair beside the granary, and his room is the last cell on the archive passage.', br: 'What was taken out of him is on the desk: burn it, or read it' },
};

const quests = Q.map(build).map((q) => {
  const x = EXTRA[q.slugOf];
  if (!x) throw new Error(`gen-magic-quests: no W1-18 addendum for ${q.id}`);
  q.directions = x.dir;
  // The branch sits at the last non-terminal journal index — the point where the quest is
  // solved and the player has learned something that makes the ending a choice.
  const forkAt = q.journal.filter((e) => e.state === 'active').map((e) => e.index).sort((a, b) => b - a)[0];
  q.branches = [{
    id: `${q.id}__fork`,
    at_journal_index: forkAt,
    condition: x.br,
    leads_to: q.resolutions.map((r) => r.id),
    irreversible: true,
  }];
  if (x.sil) q.failure_states[0].silent = true;
  if (x.rep2) {
    q.consequences.faction_reputation = { ...(q.consequences.faction_reputation || {}), [x.rep2[0]]: x.rep2[1] };
  }
  q.notes = `${q.notes} Authoring slug: ${q.slugOf}.`;
  delete q.slugOf;
  return q;
});

const doc = {
  schema: 'elder-souls/quests@1',
  id: 'magic-utility-quests',
  corpus_item: 'RI-MAG04 §A (the census Q1-Q12), §C (the eight solution shapes)',
  element_schema: 'corpus/30-quests/quest.schema.json',
  note: "Each element of `quests` validates against corpus/30-quests/quest.schema.json. The wrapper exists because that schema is `additionalProperties: false` and HARNESS §7 rule 5 requires a `schema` field on every game/data file; putting the schema id on the container rather than amending someone else's schema for a housekeeping field is the smaller change.",
  generated_by: 'tools/analysis/gen-magic-quests.mjs',
  quests,
};

fs.writeFileSync(path.join(ROOT, 'game/data/quests/magic-utility.json'), JSON.stringify(doc, null, 1) + '\n');
console.log(`wrote ${quests.length} magic quests`);

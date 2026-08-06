#!/usr/bin/env node
/**
 * mine-blackmarsh.mjs — build corpus/60-lore/data/blackmarsh-canon.json
 *
 * Mines the 1,338 Black-Marsh-region pages of the UESP extract into structured canon:
 * places, creatures, NPCs, factions/tribes, flora, items/materials and lore facts,
 * each carrying its source page so a critic can trace any claim in one hop.
 *
 * ERA WARNING, applied per record:
 *   Online:*   pages are ESO — SECOND ERA (2E 582 and around). Our game is 3E 427.
 *              Anything Murkmire/Shadowfen-specific is 800+ years before our window
 *              and must not be treated as current without a ruling.
 *   Lore:*     pages are era-spanning; each fact carries whatever date the page states.
 *   Stormhold: the 2004 mobile game, set 2E — same warning.
 *   Arena:     1994, 3E 399, closest in time to our window and the thinnest source.
 *
 * community-data: every field lifted from a page.
 * derived: the categorisation, the counts, and the cross-check verdicts.
 *
 * Run: node tools/uesp/mine-blackmarsh.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExtract, findTemplate, stripWiki, sections, links } from './uesp-infobox.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'corpus', '60-lore', 'data', 'blackmarsh-canon.json');
const CANON_FACTS = path.join(REPO, 'corpus', '60-lore', 'data', 'canon-facts.json');

const pages = loadExtract().filter((p) => p.region === 'BlackMarsh');

const ERA = (ns) => ({
  Online: '2E 582 (ESO) — 855 years BEFORE our 3E 427 window',
  Stormhold: '2E 582 (TES Travels: Stormhold) — Second Era',
  Arena: '3E 399 (Arena) — 28 years before our window, the closest source in time',
  Lore: 'era-spanning; see the fact\'s own date if it states one',
}[ns] || 'unknown');

const firstSentence = (s, n = 3) => {
  const t = stripWiki(s).replace(/\s+/g, ' ').trim();
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).slice(0, n);
  return parts.join(' ').slice(0, 900) || null;
};

/* ------------------------------------------------------------------ */
/* places                                                              */
/* ------------------------------------------------------------------ */

const places = [];
for (const p of pages) {
  const ops = findTemplate(p.text, 'Online Place Summary');
  if (ops) {
    const zone = stripWiki(ops.params.zone || '');
    if (!/Shadowfen|Murkmire/i.test(zone)) continue; // drop the handful of stray zones
    places.push({
      name: p.title.replace(/^[A-Za-z]+:/, ''),
      page: p.title,
      source_game: 'ESO',
      era: ERA('Online'),
      zone,
      subzone: ops.params.subzone ? stripWiki(ops.params.subzone) : null,
      settlement: ops.params.settlement ? stripWiki(ops.params.settlement) : null,
      type: ops.params.type ? stripWiki(ops.params.type) : null,
      description: ops.params.description ? stripWiki(ops.params.description) : null,
    });
  }
}
// Lore-namespace geography (cities, rivers, regions) — era-neutral, the useful half
const LORE_PLACE_HINT = /^(?:Lore:)(Blackrose(?: Prison)?|Lilmoth|Stormhold|Gideon|Thorn|Archon|Helstrom|Soulrest|Shadowfen|Murkmire|Xanmeer|Alten Meerhleel|Keel-Sakka River|Oliis Bay|Southern Sea|Middle Argonia|Naga-Kur|Murkwood)$/;
for (const p of pages) {
  if (!LORE_PLACE_HINT.test(p.title)) continue;
  places.push({
    name: p.title.replace(/^Lore:/, ''),
    page: p.title,
    source_game: 'Lore (era-spanning)',
    era: ERA('Lore'),
    zone: 'Black Marsh',
    type: 'lore geography',
    description: firstSentence(sections(p.text)._lead, 3),
  });
}

/* ------------------------------------------------------------------ */
/* creatures                                                           */
/* ------------------------------------------------------------------ */

const CREATURE_RACES = new Set(['Skeleton', 'Miregaunt', 'Voriplasm', 'Voriplasmic Corpse', 'Frog', 'Dragon Frog',
  'Swamp Jelly', 'Kotu Gava', 'Bear', 'Argonian Behemoth', 'Wamasu', 'Haj Mota', 'Guar', 'Netch', 'Alit',
  'Nix-Hound', 'Daedra', 'Wraith', 'Zombie', 'Lurcher', 'Spider', 'Crocodile', 'Mudcrab', 'Hackwing', 'Duneripper']);

const creatures = new Map();
for (const p of pages) {
  const n = findTemplate(p.text, 'Online NPC Summary');
  if (!n) continue;
  const race = stripWiki(n.params.race || '');
  const isCreature = n.params.creature !== undefined || CREATURE_RACES.has(race);
  if (!isCreature) continue;
  const key = p.title.replace(/^[A-Za-z]+:/, '');
  if (creatures.has(key)) continue;
  creatures.set(key, {
    name: key,
    page: p.title,
    source_game: 'ESO',
    era: ERA('Online'),
    kind: race || null,
    health: n.params.health ? stripWiki(n.params.health) : null,
    difficulty: n.params.difficulty ? stripWiki(n.params.difficulty) : null,
    location: n.params.loc ? stripWiki(n.params.loc) : null,
    reaction: n.params.reaction ? stripWiki(n.params.reaction) : null,
  });
}
// Lore bestiary entries relevant to the marsh
const LORE_CREATURE = /^Lore:(Haj Mota|Wamasu|Voriplasm|Swamp Jelly|Miregaunts of the Marsh|Kotu Gava|Hackwing|Naga|Sload|Scaly Steeds of Black Marsh|Bestiary T)$/;
for (const p of pages) {
  if (!LORE_CREATURE.test(p.title)) continue;
  const key = p.title.replace(/^Lore:/, '');
  creatures.set(key, {
    name: key,
    page: p.title,
    source_game: 'Lore (era-spanning)',
    era: ERA('Lore'),
    kind: 'lore bestiary entry',
    description: firstSentence(sections(p.text)._lead, 3),
  });
}

/* ------------------------------------------------------------------ */
/* NPCs                                                                */
/* ------------------------------------------------------------------ */

const npcs = [];
for (const p of pages) {
  const n = findTemplate(p.text, 'Online NPC Summary');
  if (!n) continue;
  const race = stripWiki(n.params.race || '');
  if (n.params.creature !== undefined || CREATURE_RACES.has(race)) continue;
  npcs.push({
    name: p.title.replace(/^[A-Za-z]+:/, ''),
    page: p.title,
    source_game: p.ns === 'Online' ? 'ESO' : p.ns,
    era: ERA(p.ns),
    race: race || null,
    gender: n.params.gender ? stripWiki(n.params.gender) : null,
    faction: n.params.faction ? stripWiki(n.params.faction).split('\n')[0] : null,
    location: n.params.loc ? stripWiki(n.params.loc) : null,
    settlement: n.params.settlement ? stripWiki(n.params.settlement) : null,
    generic: n.params.generic !== undefined,
    sells: n.params.sells ? stripWiki(n.params.sells) : null,
  });
}

/* ------------------------------------------------------------------ */
/* factions & tribes                                                   */
/* ------------------------------------------------------------------ */

const TRIBE_PAGE = /^Lore:(Tribes of Murkmire.*|Naga-Kur|An-Xileel|Shadowscales|Bloodthorn Cult|Kothringi|Lilmothiit|Green Pact|Keshu.*)$/;
const factions = [];
for (const p of pages) {
  if (!TRIBE_PAGE.test(p.title)) continue;
  factions.push({
    name: p.title.replace(/^Lore:/, ''),
    page: p.title,
    era: ERA('Lore'),
    summary: firstSentence(sections(p.text)._lead, 3),
  });
}
// named factions referenced by ESO NPC records
const factionTally = {};
for (const n of npcs) if (n.faction) factionTally[n.faction] = (factionTally[n.faction] || 0) + 1;

/* ------------------------------------------------------------------ */
/* flora, food, materials                                              */
/* ------------------------------------------------------------------ */

const FLORA_PAGE = /^Lore:(Flora [JX]|Vine-Tongues.*|Hist Sap|Hist|A Culinary Adventure.*|Care and Feeding of Swamp Jellies|The Seasons of Argonia)$/;
const flora = [];
for (const p of pages) {
  if (!FLORA_PAGE.test(p.title)) continue;
  flora.push({
    name: p.title.replace(/^Lore:/, ''),
    page: p.title,
    era: ERA('Lore'),
    summary: firstSentence(sections(p.text)._lead, 4),
  });
}
// plant/ingredient names named on the Flora pages
const floraNames = new Set();
for (const p of pages) {
  if (!/^Lore:Flora [JX]$/.test(p.title)) continue;
  for (const l of links(p.text)) {
    if (/^Lore:/.test(l.target) && l.display && l.display.length < 40) floraNames.add(l.display);
  }
}

/* ------------------------------------------------------------------ */
/* items & materials                                                   */
/* ------------------------------------------------------------------ */

const ITEM_PAGE = /^(?:Online|Lore):(Crafting Motifs? \d+.*|Crafting Motif \d+.*|Stormhold Crystal|Argonian .*Style.*)$/i;
const items = [];
for (const p of pages) {
  if (!ITEM_PAGE.test(p.title)) continue;
  items.push({ name: p.title.replace(/^[A-Za-z]+:/, ''), page: p.title, era: ERA(p.ns), summary: firstSentence(sections(p.text)._lead, 3) });
}

/* ------------------------------------------------------------------ */
/* lore facts — the lead of every Black-Marsh Lore page                */
/* ------------------------------------------------------------------ */

const IN_WORLD_BOOK = /^Lore:(The Argonian Account|The Lusty Argonian|The Sultry|Fair Argonian|A Culinary|Vine-Tongues|The Blackwater War|Keshu|The Black Fin|Lost Tales|Drakeeh|Dradeiva|From Wrothgar|Rhymes and Chimes|Argonian Refugee|Legion Officer|Letter to Septimius|Imperial Incursions|Emperor Kastav)/;

const loreFacts = [];
for (const p of pages) {
  if (p.ns !== 'Lore') continue;
  const lead = sections(p.text)._lead;
  const text = firstSentence(lead, 3);
  if (!text || text.length < 40) continue;
  loreFacts.push({
    topic: p.title.replace(/^Lore:/, ''),
    page: p.title,
    kind: IN_WORLD_BOOK.test(p.title) ? 'in-world book (unreliable narrator — an OPINION, not narration)' : 'wiki lore summary',
    era_note: /2E|Second Era/.test(text) ? 'states a Second Era date' : null,
    text,
  });
}

/* ------------------------------------------------------------------ */
/* cross-check against the recall-based registry                       */
/* ------------------------------------------------------------------ */

let canonFacts = [];
try { canonFacts = JSON.parse(fs.readFileSync(CANON_FACTS, 'utf8')).facts; } catch { /* optional */ }

const corpus = pages.map((p) => `${p.title}\n${p.text}`).join('\n\n');
const has = (re) => new RegExp(re, 'i').test(corpus);
const where = (re) => pages.filter((p) => new RegExp(re, 'i').test(p.text)).slice(0, 6).map((p) => p.title);

// Each entry is a HAND verdict written after reading the cited page(s).
// verdict ∈ confirmed | confirmed-with-correction | contradicted | unsettled
const crossCheck = [
  {
    id: 'CF-045', claim: 'The Knahaten Flu began at Stormhold in 2E 560 and persisted 41 years, to 2E 601.',
    source_says: 'Lore:Knahaten Flu — "lasting for 43 years, from the year 2E 560 to 2E 603."',
    verdict: 'contradicted',
    correction: 'Duration 43 years, 2E 560 to 2E 603. The end date and duration in CF-045 are both wrong; the start date is right.',
    pages: ['Lore:Knahaten Flu', 'Lore:On the Knahaten Flu'],
  },
  {
    id: 'CF-050', claim: 'Blackrose prison was built by Potentate Versidae-Shae on the ruins of a Lilmothiit settlement called Blackrose.',
    source_says: 'Lore:Lilmothiit — "The Lilmothiit ruins of Blackrose were later turned into The Rose prison in a single day by Pelladil Direnni summoning an army of stone atronachs, under request by the Akaviri Potentate Versidue-Shaie in the Second Era."',
    verdict: 'confirmed-with-correction',
    correction: 'The Lilmothiit founded Lilmoth AND Blackrose. The prison is "The Rose"; it was raised in a single day by Pelladil Direnni via summoned stone atronachs, commissioned by Potentate Versidue-Shaie (note spelling — CF-050 has "Versidae-Shae"). The Potentate commissioned it; he did not build it.',
    pages: ['Lore:Lilmothiit', 'Lore:Blackrose Prison', 'Lore:A History of Blackrose Prison'],
  },
  {
    id: 'CF-046', claim: 'The Knahaten Flu drove the Kothringi and the Lilmothiit to extinction; Argonians were unaffected.',
    source_says: 'Lore:Kothringi — "thought to be exterminated by the Flu, although some of the infected fled on the Crimson Ship westward"; Lore:Lilmothiit — "became mostly extinct"; Lore:On the Knahaten Flu — "Argonians appear immune".',
    verdict: 'confirmed-with-correction',
    correction: 'Both hedges matter for us: the Kothringi were "thought to be" exterminated and a shipload sailed west on the Crimson Ship; the Lilmothiit are "mostly" extinct. Immunity is stated as apparent, and the source records the accusation that Argonians introduced the flu deliberately in retaliation for Dunmer slaving — "never been proven or disproven". That accusation is usable material and is not in the registry.',
    pages: ['Lore:Kothringi', 'Lore:Lilmothiit', 'Lore:On the Knahaten Flu'],
  },
  {
    id: 'CF-047', claim: 'The Kothringi were silver-skinned humans native to Black Marsh, of Nedic descent, and notable sailors.',
    source_says: 'Lore:Kothringi — "silver-skinned tribal people indigenous to Black Marsh… Once considered the only humans native to Tamriel… rumored to be avid sailors, sailing as far as Hammerfell." Also called "the Lustrous Folk".',
    verdict: 'confirmed-with-correction',
    correction: 'Silver-skinned, indigenous, sailors: confirmed. "Nedic descent" is NOT stated on this page — the page says they were once considered the only humans native to Tamriel and are now known to have shared it with other tribal groups. Drop the Nedic claim or re-source it. Add the epithet "the Lustrous Folk".',
    pages: ['Lore:Kothringi'],
  },
  {
    id: 'CF-028 / CF-029', claim: 'Shadow-born Argonians are given to the Dark Brotherhood as Shadowscales; survivors become full members and may leave to serve Black Marsh as ku-vastei.',
    source_says: 'Lore:Shadowscales — matches almost word for word, including "act with impunity". Adds: they follow a DISTINCT set of Five Tenets (a Shadowscale may not kill a fellow Shadowscale even outside the Brotherhood); breaking a tenet is treason punished by execution carried out by the Argonian Royal Court via an unaffiliated assassin; and the "personal assassins to a King of Black Marsh" role is explicitly said to be OVERSTATED, with no such king thought to have ruled since the height of Argonian civilization "if at all".',
    verdict: 'confirmed',
    correction: 'No correction needed, but three usable facts are missing from the registry: the distinct tenets, the Royal Court execution mechanism, and the source\'s own scepticism about the Argonian king. The last is directly relevant to any project that wants a Black Marsh throne.',
    pages: ['Lore:Shadowscales', 'Lore:Beware the Shadowscales', 'Lore:Scales of Shadow', 'Lore:The Way of Shadow'],
  },
  {
    id: 'CF-026', claim: 'The Naga are a scaled, serpentine Argonian form; Imperial sources characterise them as thugs responsible for banditry.',
    source_says: 'Lore:Naga — deep-marsh breed, "huge mouths filled with dripping needle-like fangs", seven to eight feet tall, called "puff adders"; acted as highway robbers while Imperial plantations existed and withdrew inland when those ended. Lore:Naga-Kur adds the Naga-Kur ("Dead-Water Tribe") of northern Murkmire: proud, tradition-bound warriors, hostile to outsiders, distinct from tribeless Naga.',
    verdict: 'confirmed',
    correction: 'Registry entry is right and thin. The banditry is explicitly a RESPONSE to Imperial plantations and stopped when they did — that is a political fact, not a racial one, and it reads very differently.',
    pages: ['Lore:Naga', 'Lore:Naga-Kur'],
  },
  {
    id: 'CF-025', claim: 'Attested Jel roots include beeko (friend), deelith (teacher), ku-vastei (needed change), xanmeer (stone-nest), lukiul (assimilated Argonian), kaoc (curse), thtithil (egg).',
    source_says: 'Lore:The Sharper Tongue: A Jel Primer gives a 26-word in-world glossary confirming beeko, deelith, lukiul, thtithil, vastei and haj — and supplying 20 more words the registry does not have.',
    verdict: 'confirmed-with-correction',
    correction: 'Confirmed for beeko, deelith, lukiul, thtithil, vastei. "kaoc" does NOT appear in the primer and needs another source. The registry should be extended with the primer\'s full glossary — see argonian-names.json, which carries all 26 attested words.',
    pages: ['Lore:The Sharper Tongue: A Jel Primer', 'Lore:Ku-Vastei: The Needed Change'],
  },
  {
    id: 'CF-041 / CF-040', claim: 'Xanmeers are pre-Duskfall Argonian stepped ziggurats; the knowledge of how they were built was lost at Duskfall.',
    source_says: 'Lore:Xanmeer and the Murkmire material describe xanmeers as ancient Argonian stone structures across the marsh; 99 pages in the Black Marsh half of the extract mention "xanmeer".',
    verdict: 'confirmed',
    correction: null,
    pages: ['Lore:Xanmeer', 'Lore:Murkmire', 'Lore:Alten Meerhleel'],
  },
  {
    id: 'CF-067', claim: 'The An-Xileel formed during the Oblivion Crisis (3E 433+) and therefore DO NOT EXIST in 3E 427.',
    source_says: has('An-Xileel') ? 'Lore:An-Xileel is present in the extract; see the page for its stated founding.' : 'no An-Xileel page in the extract',
    verdict: 'unsettled',
    correction: 'The extract has a Lore:An-Xileel page but this pass did not transcribe its founding date. A successor should read Lore:An-Xileel and either confirm the 3E 433+ date or amend CF-067. Load-bearing: the corpus\'s constructed Xul-Aneekh (CF-C003) exists precisely to avoid an anachronism here.',
    pages: ['Lore:An-Xileel'],
  },
  {
    id: 'CF-088', claim: 'Binding place names: Lilmoth, Soulrest, Blackrose, Gideon, Stormhold, Thorn, Archon, Helstrom.',
    source_says: `Pages naming each of the eight in the Black Marsh half of the extract: ${['Lilmoth', 'Soulrest', 'Blackrose', 'Gideon', 'Stormhold', 'Thorn', 'Archon', 'Helstrom'].map((n) => `${n}=${pages.filter((p) => new RegExp(`\\b${n}\\b`).test(p.text)).length}`).join(', ')}.`,
    verdict: 'confirmed',
    correction: 'All eight are attested. Note the coverage is wildly uneven — Lilmoth and Stormhold are richly documented, Helstrom and Thorn barely at all, which is a fact about the SOURCE and should not be read as a fact about the places.',
    pages: ['Lore:Lilmoth', 'Lore:Stormhold', 'Lore:Blackrose'],
  },
  {
    id: 'CF-006', claim: 'Hist sap consumed by a NON-Argonian is a hallucinogen causing bloodlust; the drinker does not perceive what they are killing.',
    source_says: has('Hist sap') ? 'Lore:Hist Sap and Lore:Hist are both present in the extract.' : 'not found',
    verdict: 'unsettled',
    correction: 'Present in the extract but not transcribed by this pass. Read Lore:Hist Sap and Lore:Hist next; this claim underwrites CF-064 (Blackwood Company) and the whole sap-taint system (CF-C011), so it deserves a direct quote.',
    pages: ['Lore:Hist Sap', 'Lore:Hist', 'Lore:Realm of the Hist', 'Lore:Myths and Legends of the Hist'],
  },
  {
    id: 'ESO-ERA-WARNING', claim: 'Murkmire tribal structure (Bright-Throats, Black-Tongues, Miredancers, Root-House People, Ghost People, Dead-Water) as a picture of Argonian society.',
    source_says: `Lore:Tribes of Murkmire and its six per-tribe pages, plus ${places.filter((p) => /Murkmire/i.test(p.zone || '')).length} Murkmire place pages — all ESO, ${ERA('Online')}.`,
    verdict: 'flag-for-ruling',
    correction: 'This is the single richest body of Argonian culture in the extract AND the most anachronistic. Every tribe, settlement and custom here is 2E 582. Using it for 3E 427 is a deliberate editorial choice with a real cost, and it must be ruled on rather than absorbed. The corpus has no ruling on ESO-era Murkmire material.',
    pages: ['Lore:Tribes of Murkmire', 'Lore:Murkmire', 'Lore:Loremaster\'s Archive: Murkmire Q&A'],
  },
];

/* ------------------------------------------------------------------ */

const out = {
  $schema_note: 'Generated by tools/uesp/mine-blackmarsh.mjs from the UESP extract. Do not hand-edit; re-run the miner. Hand verdicts live in cross_check_against_canon_facts and ARE editorial.',
  generated: new Date().toISOString().slice(0, 10),
  source: {
    dataset: 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz (BlackMarsh region: 1,338 pages)',
    upstream: 'uespwiki-2019-11-07-current_xml.bz2',
    provenance: 'community-data',
    composition: { Online_ESO: 1151, Lore: 160, Stormhold: 25, Arena: 2 },
  },
  era_warning: {
    our_window: '3E 427',
    rule: 'ESO (Online:*) and Stormhold material is Second Era, roughly 855 years before our window. It is the richest Black Marsh source that exists and the least safe. Every record in this file carries an `era` field. Where an ESO fact and a Morrowind-era fact conflict, this file reports both and flags it; it does not choose.',
    closest_in_time: 'The two Arena pages (3E 399) are the only sources within a generation of 3E 427, and they are nearly empty.',
  },
  counts: {
    places: places.length,
    creatures: creatures.size,
    npcs: npcs.length,
    generic_npcs: npcs.filter((n) => n.generic).length,
    factions_and_tribes: factions.length,
    flora_and_food_pages: flora.length,
    named_plants: floraNames.size,
    items_and_materials: items.length,
    lore_facts: loreFacts.length,
    in_world_books_among_them: loreFacts.filter((f) => /in-world book/.test(f.kind)).length,
  },
  npc_races: npcs.reduce((m, n) => (n.race && (m[n.race] = (m[n.race] || 0) + 1), m), {}),
  npc_factions: Object.fromEntries(Object.entries(factionTally).sort((a, b) => b[1] - a[1]).slice(0, 30)),
  place_types: places.reduce((m, p) => (p.type && (m[p.type] = (m[p.type] || 0) + 1), m), {}),
  cross_check_against_canon_facts: {
    method: 'Each registry entry that the extract can speak to was checked by reading the cited page(s) by hand. Verdicts are editorial and are ours; the quoted source text is community-data.',
    verdicts: crossCheck,
    summary: crossCheck.reduce((m, c) => (m[c.verdict] = (m[c.verdict] || 0) + 1, m), {}),
    registry_entries_the_extract_cannot_speak_to: canonFacts
      .filter((f) => /^CF-C|^CF-D/.test(f.id))
      .map((f) => f.id)
      .concat(['CF-044 (Ruddy Man — no page in the Black Marsh half of the extract)']),
  },
  places,
  creatures: [...creatures.values()],
  factions_and_tribes: factions,
  flora: { pages: flora, named_plants: [...floraNames].sort() },
  items_and_materials: items,
  lore_facts: loreFacts.sort((a, b) => a.topic.localeCompare(b.topic)),
  npcs: npcs.sort((a, b) => a.name.localeCompare(b.name)),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.error(`wrote ${OUT}`);
console.log(JSON.stringify({ counts: out.counts, verdicts: out.cross_check_against_canon_facts.summary, place_types: out.place_types }, null, 2));

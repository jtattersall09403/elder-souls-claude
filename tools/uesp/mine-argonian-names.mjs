#!/usr/bin/env node
/**
 * mine-argonian-names.mjs — build corpus/60-lore/data/argonian-names.json
 *
 * Every attested Argonian personal name, place name and Jel word in the extract
 * (both regions) plus the names already in argonian-dialogue-corpus.json, then
 * runs the corpus's own constructed validator (corpus/80-methods/jel-phonotactics.py)
 * against the ATTESTED words to see whether our invented phonology can accept
 * Bethesda's and ZOS's actual Argonian.
 *
 * community-data: the names and the in-world Jel glossary.
 * derived: the classification, the counts, and the validator verdict.
 *
 * Run: node tools/uesp/mine-argonian-names.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadExtract, findTemplate, stripWiki, sections } from './uesp-infobox.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'corpus', '60-lore', 'data', 'argonian-names.json');
const VALIDATOR = path.join(REPO, 'corpus', '80-methods', 'jel-phonotactics.py');
const DIALOGUE = path.join(REPO, 'corpus', '60-lore', 'data', 'argonian-dialogue-corpus.json');

const pages = loadExtract();

/* ------------------------------------------------------------------ */
/* 1. the in-world Jel glossary                                        */
/* ------------------------------------------------------------------ */
// Lore:The Sharper Tongue: A Jel Primer is an in-world glossary, one
// "Word: gloss" line per entry. This is the densest attested Jel in the extract.

const glossary = [];
const primer = pages.find((p) => p.title === 'Lore:The Sharper Tongue: A Jel Primer');
if (primer) {
  const body = stripWiki(primer.text);
  for (const line of body.split('\n')) {
    const m = /^\s*([A-Z][a-zA-Z-]{1,14})\s*:\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    if (/^(References|Notes|See Also)$/i.test(m[1])) continue;
    glossary.push({
      word: m[1],
      gloss: m[2].trim().replace(/\s+/g, ' '),
      source: 'Lore:The Sharper Tongue: A Jel Primer',
      source_kind: 'in-world book, authored by an Argonian narrator — an in-fiction primer, not a scholarly grammar',
      provenance: 'community-data',
    });
  }
}

// other attested Jel words and compounds found across the extract
const EXTRA_JEL = [
  ['Xanmeer', 'stone-nest; the ancient stepped ziggurats', 'Lore:Xanmeer'],
  ['Ku-Vastei', 'the needed change', 'Lore:Ku-Vastei: The Needed Change'],
  ['Haj Mota', 'hidden shell; the great turtle-beast', 'Lore:Haj Mota'],
  ['Saxhleel', 'the Argonians\' own word for themselves; "People of the Root"', 'Lore:From Argonian to Saxhleel'],
  ['Naga-Kur', 'the Dead-Water Tribe of northern Murkmire', 'Lore:Naga-Kur'],
  ['Xal-Vakka Aloe', 'sacred-sun aloe — a plant name built from xal (sacred) + vakka (sun)', 'Lore:Flora X'],
  ['Xthari', 'a marsh plant', 'Lore:Flora X'],
  ['Xinchei-Konu', 'a monument said to create xal-vastei (sacred change)', 'Lore:The Sharper Tongue: A Jel Primer'],
  ['Alten Meerhleel', 'a named Argonian ruin', 'Lore:Alten Meerhleel'],
  ['Teeba-Hatsei', 'a named Argonian figure/place', 'Lore:Teeba-Hatsei'],
].filter(([w]) => !glossary.some((g) => g.word.toLowerCase() === w.toLowerCase()))
  .map(([word, gloss, source]) => ({ word, gloss, source, source_kind: 'wiki lore page', provenance: 'community-data' }));

/* ------------------------------------------------------------------ */
/* 2. personal names                                                   */
/* ------------------------------------------------------------------ */

const ARGONIAN_RACE = /^(Argonian|Naga|Argonian Behemoth|Saxhleel)$/i;

const people = new Map();
function addPerson(name, rec) {
  const key = name.trim();
  if (!key || people.has(key)) return;
  people.set(key, { name: key, ...rec });
}

for (const p of pages) {
  for (const tplName of ['NPC Summary', 'Online NPC Summary']) {
    const n = findTemplate(p.text, tplName);
    if (!n) continue;
    const race = stripWiki(n.params.race || '');
    if (!ARGONIAN_RACE.test(race)) continue;
    const name = p.title.replace(/^[A-Za-z]+:/, '').replace(/\s*\(.*\)$/, '');
    addPerson(name, {
      page: p.title,
      race,
      gender: n.params.gender ? stripWiki(n.params.gender) : null,
      source_game: p.ns === 'Online' ? 'ESO (2E 582)' : p.ns === 'Stormhold' ? 'Stormhold (2E)' : `${p.ns} (3E 427)`,
      region: p.region,
    });
  }
}

// names named in Lore pages (Keshu, Na-Kesh, Beela-Kaar, Drakeeh, Xukas …)
const LORE_NAMED = /^Lore:(Keshu|Tree-Minder Na-Kesh|The Curse of Beela-Kaar|Teeba-Hatsei|Drakeeh the Unchained's Journal)$/;
for (const p of pages) {
  if (!LORE_NAMED.test(p.title)) continue;
  const name = p.title.replace(/^Lore:/, '').replace(/^(Tree-Minder|The Curse of)\s+/, '').replace(/'s Journal.*$/, '').replace(/ the Unchained$/, '');
  addPerson(name, { page: p.title, race: 'Argonian', gender: null, source_game: 'Lore', region: p.region });
}

// names already in our dialogue corpus (ours + canon mixed; flagged as such)
let dialogueNames = [];
try {
  const dj = JSON.parse(fs.readFileSync(DIALOGUE, 'utf8'));
  const seen = new Set();
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (/^(speaker|npc|name|character)$/i.test(k) && typeof v === 'string' && /-/.test(v) && v.length < 50) seen.add(v.trim());
        else walk(v);
      }
    }
  })(dj);
  dialogueNames = [...seen].sort();
} catch { /* optional */ }

/* ------------------------------------------------------------------ */
/* 3. classify name shape                                              */
/* ------------------------------------------------------------------ */

const HYPHEN_TAMRIELIC = /^[A-Z][a-z]+(-[A-Za-z']+)+$/;
const JEL_STYLE = /^[A-Z][a-z]*(-[A-Z][a-z]*)?$/;

const classified = [...people.values()].map((p) => {
  const words = p.name.split('-');
  let shape;
  if (HYPHEN_TAMRIELIC.test(p.name) && words.length >= 2 && /^(Hides|Lifts|Sees|Keeps|Walks|Swims|Counts|Tastes|Speaks|Talks|Runs|Breaks|Bites|Drinks|Holds|Sings|Waits|Watches|Wades|Hunts|Digs|Weaves|Beams|Cuts|Deep|Many|Three|Nine|Fal|Cuts|Sun|Green|Bright|Silent|Swims|Chews|Fights|Blooms|Grabs|Gives|Takes|Never|Always|Onsi|Heem)/.test(words[0])) shape = 'tamrielic-hyphenated';
  else if (words.length >= 3) shape = 'tamrielic-hyphenated';
  else if (words.length === 2 && /^[A-Z][a-z]+$/.test(words[0]) && /^[A-Z][a-z]+$/.test(words[1])) shape = 'jel-compound (Xxx-Yyy)';
  else if (words.length === 1) shape = 'jel-single';
  else shape = 'other';
  return { ...p, shape, word_count: words.length };
});

const shapeTally = classified.reduce((m, p) => (m[p.shape] = (m[p.shape] || 0) + 1, m), {});
const wordCountTally = classified.filter((p) => p.shape === 'tamrielic-hyphenated')
  .reduce((m, p) => (m[p.word_count] = (m[p.word_count] || 0) + 1, m), {});

// first words of hyphenated names — the "verb" slot RI-LOR04 legislates
const verbSlot = {};
for (const p of classified) {
  if (p.shape !== 'tamrielic-hyphenated') continue;
  const w = p.name.split('-')[0];
  verbSlot[w] = (verbSlot[w] || 0) + 1;
}

/* ------------------------------------------------------------------ */
/* 4. place names                                                      */
/* ------------------------------------------------------------------ */

const placeNames = new Set();
for (const p of pages) {
  if (p.region !== 'BlackMarsh') continue;
  const ops = findTemplate(p.text, 'Online Place Summary');
  if (!ops) continue;
  const zone = stripWiki(ops.params.zone || '');
  if (!/Shadowfen|Murkmire/i.test(zone)) continue;
  placeNames.add(p.title.replace(/^Online:/, ''));
}
const jelLookingPlaces = [...placeNames].filter((n) => /x|hleel|meer|xith|teel|kkh|zz|-/i.test(n) && !/^(The|Old|New) /.test(n)).sort();

/* ------------------------------------------------------------------ */
/* 5. validate the ATTESTED Jel against OUR constructed phonotactics   */
/* ------------------------------------------------------------------ */

const attestedWords = [...new Set([...glossary.map((g) => g.word), ...EXTRA_JEL.map((g) => g.word)])]
  .filter((w) => !/\s/.test(w)); // validator takes single tokens

let validator = { ran: false };
try {
  const tmp = path.join(os.tmpdir(), 'uesp-jel-attested.txt');
  fs.writeFileSync(tmp, attestedWords.join('\n') + '\n');
  let raw = '';
  try {
    raw = execFileSync('python3', [VALIDATOR, '--names', tmp, '--culture', 'jel', '--verbose'], { encoding: 'utf8' });
  } catch (e) {
    raw = (e.stdout || '') + (e.stderr || ''); // exit 1 = FAIL, which is the interesting case
  }
  const rate = /violation rate:\s*([\d.]+)%/.exec(raw);
  const viol = raw.split('\n')
    .filter((l) => /\[jel\]/.test(l))
    .map((l) => l.trim().replace(/\s{2,}/g, ' '));
  validator = {
    ran: true,
    command: `python3 corpus/80-methods/jel-phonotactics.py --names <attested Jel> --culture jel --verbose`,
    words_tested: attestedWords.length,
    violation_rate_percent: rate ? Number(rate[1]) : null,
    threshold_percent: 5,
    result: /RESULT:\s*(\w+)/.exec(raw)?.[1] || null,
    rejected_attested_words: viol,
  };
} catch (e) {
  validator = { ran: false, error: String(e) };
}

/* ------------------------------------------------------------------ */
/* 6. gloss conflicts between attested Jel and our lexicon             */
/* ------------------------------------------------------------------ */

let lexRoots = [];
try { lexRoots = JSON.parse(fs.readFileSync(path.join(REPO, 'corpus', '60-lore', 'data', 'jel-lexicon.json'), 'utf8')).roots; } catch { /* optional */ }

const attestedByWord = new Map([...glossary, ...EXTRA_JEL].map((g) => [g.word.toLowerCase(), g]));
const glossConflicts = [];
for (const r of lexRoots) {
  const a = attestedByWord.get(r.root.toLowerCase());
  if (!a) continue;
  glossConflicts.push({
    root: r.root,
    our_gloss: r.gloss,
    our_provenance: r.provenance,
    attested_gloss: a.gloss,
    attested_source: a.source,
    verdict: null, // filled by hand below
  });
}
// hand verdicts, written after reading the primer
const HAND = {
  xul: ['CONTRADICTED', 'The primer glosses xul as "Death, or pertaining to death. Also known as rebirth, for they are thought to be one and the same." Our lexicon has xul = "root, that which goes down" (marked `inferred`). Every coined term built on it — xul-teekh (souls), ixtu-xul (sapwell), xul-vaska, xul-hesh, xul-aneekh (the Deep-Kin) — therefore reads to a Jel speaker as death-X, not root-X. For xul-teekh (soul-residue of a death) and xul-hesh (soul-trapping) this is a lucky improvement. For xul-aneekh ("Deep-Kin") it is wrong: it reads as "Death-Kin".'],
  uxith: ['CONTRADICTED', 'The primer glosses uxith as "Nest, home, bed. For my people, these concepts are one in the same." Our lexicon has uxith = "old, long-standing, kept" AND marks it `community-data`, i.e. claims a source. It does not have one. This is the clearest case in the corpus of recall being logged as sourced.'],
  ojel: ['CONTRADICTED', 'The primer glosses ojel as "Not of a tribe, outsider. Literally, Not of Argonian Tongue." Our lexicon has ojel = "tongue, the organ" (`inferred`). The morphology our entry guesses at (o- + jel) is right; the gloss is not. Ojel is the Argonian word for a foreigner, which is far more useful than "tongue" and should replace it.'],
  kaal: ['CONTRADICTED', 'The primer glosses kaal as "War captain. The more violent the tribe, the more this title is revered." Our lexicon coins kaal = "to kneel, to put the hand down into" as `constructed`. A constructed root has landed on an attested one with an unrelated meaning. Rename ours.'],
  vastei: ['CONFIRMED', 'Primer: "Vastei: Change. Perhaps the greatest driving force behind my people\'s motivation." Matches.'],
  beeko: ['CONFIRMED', 'Primer: "Beeko: Friend." Our added gloss "one bound to you by water" is ours, not the source\'s. The primer does give real compounds: Deek-Beeko, Raj-Beeko, Beek-Ojel, Uxith-Beeko.'],
  deelith: ['CONFIRMED', 'Primer: "Deelith: Teacher, or more accurately, one who passes wisdom to another." Matches.'],
  lukiul: ['CONFIRMED', 'Primer: "Lukiul: An Argonian that has assimilated into a non-Argonian culture." Our gloss adds "salted one", which is ours.'],
  haj: ['CONFIRMED', 'Primer: "Haj: Hides, hidden. It\'s easy to see why it is part of the creature haj mota\'s name." This also confirms the corpus\'s decomposition of haj mota.'],
  naga: ['CONFIRMED', 'Lore:Naga. Matches.'],
  xeech: ['CONFIRMED-AND-DEEPENED', 'Primer: "Xeech: Nut, seed. Also the beginning, birth, something with unreleased potential." Our gloss is just "seed"; the attested word already carries the metaphor the corpus was going to have to invent.'],
  kaoc: ['UNSETTLED', 'Not in the primer. The lexicon marks it `community-data` and it is the only Jel item containing "c"; it needs another source or a downgrade.'],
  jel: ['CONFIRMED-INDIRECTLY', 'The primer does not define jel, but glosses ojel as "Non-Speaker of Jel", which attests the root.'],
};
for (const c of glossConflicts) {
  const h = HAND[c.root.toLowerCase()];
  if (h) { c.verdict = h[0]; c.note = h[1]; }
  else c.verdict = 'not-checked';
}

/* attested words our lexicon does not have at all */
const missing = [...glossary, ...EXTRA_JEL]
  .filter((g) => !lexRoots.some((r) => r.root.toLowerCase() === g.word.toLowerCase()))
  .map((g) => ({ word: g.word, gloss: g.gloss, source: g.source }));

/* ------------------------------------------------------------------ */

const out = {
  $schema_note: 'Generated by tools/uesp/mine-argonian-names.mjs from the UESP extract. Hand verdicts in gloss_conflicts and phonotactic_validation.interpretation ARE editorial.',
  generated: new Date().toISOString().slice(0, 10),
  source: {
    dataset: 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz (both regions)',
    provenance: 'community-data for every name and gloss; derived for classification, counts and verdicts',
    era_note: 'ESO names are 2E 582; Morrowind/Tribunal/Bloodmoon names are 3E 427 — the era of our game. Where the two disagree about naming FASHION, the Morrowind-era set is the one to imitate.',
  },
  counts: {
    attested_jel_words: glossary.length + EXTRA_JEL.length,
    primer_glossary_entries: glossary.length,
    argonian_personal_names: classified.length,
    names_by_era: classified.reduce((m, p) => (m[p.source_game] = (m[p.source_game] || 0) + 1, m), {}),
    names_by_shape: shapeTally,
    hyphenated_name_word_counts: wordCountTally,
    black_marsh_place_names: placeNames.size,
    names_in_our_dialogue_corpus: dialogueNames.length,
  },

  phonotactic_validation: {
    question: 'RI-LOR04 asks whether the constructed Jel phonotactics in jel-lexicon.json actually match real Argonian naming. This runs the corpus\'s own validator against the words Bethesda and ZOS actually shipped.',
    ...validator,
    interpretation: validator.ran && validator.violation_rate_percent > 5 ? [
      `THE CONSTRUCTED PHONOTACTICS REJECT REAL JEL. ${validator.violation_rate_percent}% of attested Jel words fail a validator whose own pass threshold is 5%.`,
      'The rejections are not edge cases. Saxhleel — the Argonians\' word for themselves — is rejected for the medial cluster "xhl". Thtithil (egg), which the corpus already cites as canon in CF-025, is rejected for the initial cluster "tht". Xeech (seed), a root our own lexicon lists, is rejected for the final cluster "ch".',
      'Two of the failures are our forbidden-cluster list being stricter than canon: greel (enemy) uses "gr" and krona (big) uses "kr", both banned outright as "epic-fantasy" clusters. Canon Jel has them.',
      'One is our no-geminates rule: vakka (sun) has "kk". The rule exists for good reasons and it is wrong.',
      'This does NOT mean the phonology is bad design — a constructed dialect may legitimately be narrower than the attested corpus. It means the validator is currently calibrated to fail canon, which is the opposite of what a canon-fidelity tool should do. Either the attested words go into attested_exceptions (they are, after all, attested), or the cluster and geminate rules are relaxed to admit them. Doing neither ships a validator that would reject an Argonian saying their own name for their own people.',
    ] : ['validator did not run or passed'],
  },

  gloss_conflicts: {
    method: 'Every root in jel-lexicon.json that also appears in an attested source, compared by hand.',
    checked: glossConflicts.length,
    contradicted: glossConflicts.filter((c) => c.verdict === 'CONTRADICTED').length,
    entries: glossConflicts,
  },

  attested_words_missing_from_our_lexicon: missing,

  jel_glossary: [...glossary, ...EXTRA_JEL],

  naming_grammar_as_attested: {
    note: 'RI-LOR04 legislates "[Verb-3sg] - [optional Determiner|Possessive] - [Noun], 2-4 words, modal 3" for Tamrielic Argonian names. This is what the shipped games actually do.',
    shape_distribution: shapeTally,
    hyphenated_word_count_distribution: wordCountTally,
    most_common_first_words: Object.entries(verbSlot).sort((a, b) => b[1] - a[1]).slice(0, 40),
  },

  personal_names: classified.sort((a, b) => a.name.localeCompare(b.name)),
  black_marsh_place_names: [...placeNames].sort(),
  jel_looking_place_names: jelLookingPlaces,
  names_in_our_dialogue_corpus: dialogueNames,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.error(`wrote ${OUT}`);
console.log(JSON.stringify({
  counts: out.counts,
  validation: { rate: validator.violation_rate_percent, result: validator.result, rejected: validator.rejected_attested_words },
  gloss_conflicts: glossConflicts.map((c) => `${c.root}: ${c.verdict}`),
  missing: missing.length,
}, null, 2));

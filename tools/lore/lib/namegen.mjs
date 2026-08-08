// namegen.mjs — the province's ONE name generator, per culture.
//
// WHY THIS FILE EXISTS. `tools/world/build-property.mjs` had two flat arrays, GIVEN and EPITHET,
// and produced every roster name as `GIVEN + ' ' + EPITHET` with no knowledge of the person's
// race. That is how the shipped tree got an Argonian called `Sedura Nine-Teeth` — *sedura* is a
// Dunmer honorific — and `Marks-The-Ledger of Nine Debts` filed as a Dunmer. It is also how
// 55.8% of named Argonians ended up carrying a hyphenated-English descriptive name against
// RI-LOR04 §4's attested 11%, which §4 fails by its own wording:
//
//   "A settlement roster in which most Argonians carry hyphenated English names has failed this
//    section however well each individual name scores."
//
// WHAT IS AUTHORED HERE AND WHAT IS COMPOSED, because RI-LOR04 §8 ("a lexicon nobody uses") is
// the exact failure this file exists to avoid:
//
//   * The Jel material is NOT authored here. Every element comes from the 75 roots and the 9+9
//     affixes in `corpus/60-lore/data/jel-lexicon.json`, and every coined Jel name this module
//     offers has been through `corpus/80-methods/jel-phonotactics.py --mode coinage`, which is
//     the item's own validator in its strict mode. A candidate it rejects is dropped, not shipped.
//   * The Tamrielic-descriptive material is NOT authored here either: the verbs, determiners and
//     nouns are `jel-lexicon.json → tamrielic_name_grammar`, and so is the blocklist.
//   * The other five cultures' stock IS authored here, from RI-LOR04 §5's shape table.
//
// THE SHARE IS THE POINT. `argonianNameFor()` gives a Tamrielic-descriptive name to 11% of
// Argonians and a Jel name to the rest, because that is the attested distribution in
// `argonian-names.json → naming_grammar_as_attested.shape_distribution` (jel-single 182,
// jel-compound 142, tamrielic-descriptive 43, mixed 10 => 86% Jel / 11% descriptive). The share
// is enforced by INDEX, not by a die roll: the nth Argonian is descriptive iff
// `(n * 100) % 100 < 11` under a fixed permutation, so a roster of 200 lands within one name of
// 11% and a roster of 9 is never 33%.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const R = (p) => path.join(ROOT, p);

const LEX = JSON.parse(fs.readFileSync(R('corpus/60-lore/data/jel-lexicon.json'), 'utf8'));

// A deterministic mixer. Never runs in the simulation; runs here, once, and its output is
// committed JSON a critic reads. Same shape as build-property.mjs's, on purpose.
export function mix(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- Jel, composed from the lexicon

const ROOTS = LEX.roots.map((r) => r.root).filter((r) => /^[a-z]+$/.test(r));
const PREFIXES = LEX.morphology.prefixes.map((p) => p.form.replace(/-$/, ''));
const SUFFIXES = LEX.morphology.suffixes.map((s) => s.form.replace(/^-/, ''));

// Names attested in the shipped games. We do NOT coin on top of them and we do not reuse them as
// roster names — a generated villager called Huleeya is the same defect in the other direction.
const ATTESTED_EXCLUDE = new Set(
  (() => {
    try {
      const a = JSON.parse(fs.readFileSync(R('corpus/60-lore/data/argonian-names.json'), 'utf8'));
      return (a.personal_names || []).map((n) => String(n.name).toLowerCase());
    } catch { return []; }
  })(),
);

/** Every coinable Jel single-word form: root, prefix+root, root+suffix. */
export function jelSingleCandidates() {
  const out = new Set();
  for (const r of ROOTS) {
    for (const s of SUFFIXES) out.add(cap(r + s));
    for (const p of PREFIXES) out.add(cap(p + r));
  }
  return [...out].filter((n) => !ATTESTED_EXCLUDE.has(n.toLowerCase()));
}

/** Every coinable Jel two-element compound: Root-Root, hyphenated (RI-LOR04 §2 compounding). */
export function jelCompoundCandidates() {
  const out = new Set();
  for (const a of ROOTS) for (const b of ROOTS) {
    if (a === b) continue;
    out.add(`${cap(a)}-${cap(b)}`);
  }
  return [...out].filter((n) => !ATTESTED_EXCLUDE.has(n.toLowerCase()));
}

// ---------------------------------------------------------------- Tamrielic-descriptive

const TG = LEX.tamrielic_name_grammar;
const BLOCK_NOUNS = new Set((TG.blocklist_nouns || []).map((s) => s.toLowerCase()));
const BLOCK_FORMS = (TG.blocklist_forms || []).map((s) => s.toLowerCase());

/**
 * The secondary, Tamrielic-facing form. Word count is 2 at the mode (attested: 2 x31, 3 x6),
 * so this offers 2-word and 3-word shapes at roughly that ratio and nothing longer.
 * Nouns with a space in them (`Wet Days`) are skipped: they make a 2-word name read as 3.
 */
export function descriptiveCandidates() {
  const verbs = TG.verbs.filter((v) => !BLOCK_NOUNS.has(v.toLowerCase()));
  const nouns = TG.nouns.filter((n) => !n.includes(' ') && !BLOCK_NOUNS.has(n.toLowerCase()));
  const dets = TG.determiners;
  const out = new Set();
  for (const v of verbs) for (const n of nouns) out.add(`${v}-${n}`);
  for (const v of verbs) for (const d of dets) for (const n of nouns) {
    if (out.size > 40000) break;
    out.add(`${v}-${d}-${n}`);
  }
  return [...out].filter((n) => {
    const low = n.toLowerCase();
    if (BLOCK_FORMS.some((f) => low.includes(f.toLowerCase()))) return false;
    return !ATTESTED_EXCLUDE.has(low);
  });
}

// ---------------------------------------------------------------- the other cultures (RI-LOR04 §5)
// Authored here from §5's shape table. No apostrophes outside Khajiit; no hyphens outside
// Argonian; Dunmer take no English words.

const IMPERIAL_PRAENOMEN = ['Sergius', 'Casimir', 'Marcia', 'Lucia', 'Falco', 'Decius', 'Corvus', 'Vitellia',
  'Aulus', 'Petronia', 'Gaius', 'Livia', 'Mettius', 'Octavia', 'Rufus', 'Valeria', 'Titus', 'Drusilla',
  'Quintus', 'Aemilia', 'Marius', 'Cornelia', 'Publius', 'Julia', 'Lucius', 'Antonia', 'Servius', 'Fulvia'];
const IMPERIAL_NOMEN = ['Verrent', 'Bellandus', 'Ottellus', 'Menandra', 'Drusius', 'Arral', 'Aldeyn', 'Carinus',
  'Sabinus', 'Velleius', 'Nerentius', 'Maronius', 'Tullianus', 'Cassian', 'Voranus', 'Lentulus', 'Silvanus',
  'Aurelius', 'Terentius', 'Balbinus', 'Crescentius', 'Pomponius'];

const DUNMER_GIVEN = ['Andrel', 'Ivrys', 'Fals', 'Ravel', 'Drovas', 'Neloth', 'Sedura', 'Bevene', 'Llarara',
  'Nartise', 'Onwen', 'Falura', 'Ranaso', 'Sondaale', 'Vaman', 'Dram', 'Tuls', 'Idrano', 'Athyn', 'Galyn',
  'Mavon', 'Nevrasa', 'Sethan', 'Velas', 'Yakum', 'Drelas'];
const DUNMER_HOUSE = ['Vorin', 'Dram', 'Rethan', 'Sedran', 'Reln', 'Vaun', 'Dares', 'Sarethi', 'Indoril',
  'Andas', 'Beleth', 'Uveran', 'Hlarel', 'Solas', 'Themis', 'Ralen'];

const KHAJIIT_PREFIX = ["J'", "S'", "Ra'", "Ri'", "Dro'", "Ma'"];
const KHAJIIT_STEM = ['zhirr', 'dashi', 'kamma', 'shanji', 'nirra', 'zeeba', 'khali', 'sabir', 'jhera', 'tanni'];

const NORD_NAMES = ['Halgrid', 'Sorli', 'Brynja', 'Torvald', 'Ingunn', 'Vagn', 'Hrefna', 'Sigurd', 'Astrid',
  'Bjarni', 'Gunhild', 'Ulfar'];
const BRETON_NAMES = ['Perrine', 'Guilbert', 'Alienor', 'Marcel', 'Jocelyne', 'Renaud', 'Ysolde', 'Amaury',
  'Berengere', 'Thierry'];
const KOTHRINGI_NAMES = ['Serrin', 'Halveth', 'Mereth', 'Ardan', 'Iselen', 'Tavir', 'Nerin', 'Alveth',
  'Corren', 'Vaseth'];

function pairStock(a, b) {
  const out = [];
  for (const x of a) for (const y of b) out.push(`${x} ${y}`);
  return out;
}

export const CULTURE_STOCK = {
  imperial: () => pairStock(IMPERIAL_PRAENOMEN, IMPERIAL_NOMEN),
  dunmer: () => pairStock(DUNMER_GIVEN, DUNMER_HOUSE),
  khajiit: () => {
    const out = [];
    for (const p of KHAJIIT_PREFIX) for (const s of KHAJIIT_STEM) out.push(p + s);
    return out;
  },
  nord: () => NORD_NAMES.slice(),
  breton: () => BRETON_NAMES.slice(),
  kothringi: () => KOTHRINGI_NAMES.slice(),
};

/** RI-LOR04 §5 plus §4: which naming system does a `race` field select? */
export function cultureForRace(race) {
  const r = String(race || '').toLowerCase();
  if (/argonian|saxhleel|naga|lizard/.test(r)) return 'argonian';
  if (/dunmer|dark ?elf/.test(r)) return 'dunmer';
  if (/imperial|cyrod/.test(r)) return 'imperial';
  if (/khajiit|cathay|suthay/.test(r)) return 'khajiit';
  if (/nord/.test(r)) return 'nord';
  if (/breton/.test(r)) return 'breton';
  if (/kothringi/.test(r)) return 'kothringi';
  return null;   // deliberately NOT a default: an unrecognised race is reported, not guessed at
}

// ---------------------------------------------------------------- assignment

/**
 * The attested Argonian share, from `argonian-names.json → naming_grammar_as_attested`.
 * jel-single 182 + jel-compound 142 = 324 of 377 = 86%; tamrielic-descriptive 43 = 11%.
 */
export const ATTESTED_DESCRIPTIVE_SHARE = 0.11;

/**
 * Assign names to people, deterministically, uniquely, and at the attested share.
 *
 * @param people  [{ key, race }]  — `key` is the npc id, and the ONLY thing the name depends on,
 *                                   so a roster reordering does not reshuffle the province.
 * @param pools   { jelSingle, jelCompound, descriptive }  — validated candidate lists
 * @returns Map key -> name
 */
export function assign(people, pools, reserved = []) {
  // Sort by key so the descriptive slice is a property of the roster and not of file order.
  const sorted = people.slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const argonians = sorted.filter((p) => cultureForRace(p.race) === 'argonian');
  const nDesc = Math.round(argonians.length * ATTESTED_DESCRIPTIVE_SHARE);
  // Which Argonians get the Tamrielic-facing name: a fixed permutation of the roster, first
  // nDesc taken. Deterministic, and independent of how many Argonians there happen to be.
  const order = argonians.map((p) => ({ p, r: mix(`${p.key}:descriptive`) })).sort((a, b) => a.r - b.r);
  const descriptiveKeys = new Set(order.slice(0, nDesc).map((o) => o.p.key));

  // Names already borne by somebody this tool must not rename — the hand-authored cast. A coined
  // villager called Hosk-Vei is the same collision as a reused generated name, from the other end.
  const taken = new Set(reserved);
  const out = new Map();
  const take = (pool, key) => {
    if (!pool || !pool.length) return null;
    let i = mix(key) % pool.length;
    for (let g = 0; g < pool.length; g++) {
      const cand = pool[(i + g * 7919) % pool.length];
      if (!taken.has(cand)) { taken.add(cand); return cand; }
    }
    return null;
  };

  for (const p of sorted) {
    const culture = cultureForRace(p.race);
    let name = null;
    if (culture === 'argonian') {
      if (descriptiveKeys.has(p.key)) name = take(pools.descriptive, `${p.key}:d`);
      else {
        // 182 : 142 single : compound among the Jel share, the attested ratio.
        const single = (mix(`${p.key}:shape`) % 324) < 182;
        name = take(single ? pools.jelSingle : pools.jelCompound, `${p.key}:j`)
          || take(single ? pools.jelCompound : pools.jelSingle, `${p.key}:j2`);
      }
    } else if (culture && CULTURE_STOCK[culture]) {
      name = take(pools[culture] || CULTURE_STOCK[culture](), `${p.key}:${culture}`);
    }
    if (name) out.set(p.key, name);
  }
  return out;
}

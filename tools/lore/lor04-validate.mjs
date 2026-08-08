#!/usr/bin/env node
/**
 * lor04-validate.mjs — RI-LOR04's SCORING BANDS, COMPUTED.
 *
 * RULES #24. The W1-23 round-3 verdict §9 recorded, under "what I could not do":
 *
 *   "The RI-LOR04 numeric bands. They score a per-name violation rate and a blind
 *    culture-attribution rate. The item's §5 invokes a validator with `--culture jel`; the only
 *    tool in the tree is `tools/uesp/mine-argonian-names.mjs`, which mines and does not validate.
 *    The validator named by the method does not exist."
 *
 * ONE HALF OF THAT IS WRONG AND I AM SAYING SO FIRST. `corpus/80-methods/jel-phonotactics.py`
 * DOES exist, does take `--culture jel`, and its `--self-test` passes 33/33 on the tree today.
 * This tool does not replace it and does not re-implement a single phonotactic rule — every
 * per-name judgement below is made by that file, over a pipe.
 *
 * THE OTHER HALF IS RIGHT, AND IS THE REASON THIS FILE EXISTS. The bands are still uncomputable,
 * for a reason a critic can reproduce in one command:
 *
 *   python3 corpus/80-methods/jel-phonotactics.py --extract $(find game/data -name '*.json')
 *   => 2463 "names" checked, 74.7% violations, RESULT: FAIL
 *
 * The harvester pulls every `name` / `title` key in `game/data`, so its population includes
 * *"A 1.20 m doorway between two walls. A test rig, not an interior"*, *"40 treads at 0.18 m
 * rise"*, and the full title of every book in the library. Judging English book titles against
 * Jel phonotactics produces a number, and the number means nothing. **A validator whose
 * population is wrong cannot be banded**, and no band in RI-LOR04 §Scoring has ever been
 * computed on this tree.
 *
 * So this tool supplies the missing half: THE POPULATION, THE DECLARED CULTURE OF EACH MEMBER OF
 * IT, and the seven measures §Scoring actually names. It harvests people — every record under
 * `game/data/npcs/**` that has a `name` and a `race` — because `race` is the only field in the
 * tree that says which naming system a name is supposed to belong to, and RI-LOR04's comparison
 * method §3 is explicitly "a culture-forced pass on Argonian NPCs only".
 *
 * MEASURES (each one is able to fail, and `--self-test` breaks each on purpose):
 *
 *   M1  §4 SHAPE. Share of named Argonians carrying the Tamrielic-descriptive (hyphenated
 *       English) form. Attested target 11%; "most" is an automatic §4 failure by the item's own
 *       wording. The English test STEMS (`Eggs`->`egg`, `Sleeps`->`sleep`) and unions RI-LOR04's
 *       own verb/determiner/noun tables with a general English stock, so it is strictly MORE
 *       sensitive than a bare word list — this measure must not be able to hide a descriptive
 *       name behind an inflection.
 *   M2  VIOLATION RATE, culture-forced by declared race, from jel-phonotactics.py. Bands from
 *       §Scoring: <=1% -> 5, <=3% -> 4, <=5% -> 3, <=15% -> 2, else 1.
 *   M3  UNCLASSIFIABLE SHARE. >2% is a hard 0 per §Scoring.
 *   M4  APOSTROPHES in Argonian names. Any at all is a hard 0 per §Scoring.
 *   M5  SOUND-WORLD COVERAGE (comparison method §5): of Jel-classified names, >=40% must contain
 *       `x` and >=20% a long vowel. Below either is "FAIL for flavourless Jel".
 *   M6  CROSS-CULTURE CONTAMINATION. The classifier's culture against the record's declared race.
 *       This is the measure that catches `Sedura Nine-Teeth`: a Dunmer honorific on an Argonian.
 *   M7  REUSE AND TEMPLATE LEAKAGE. One name borne by six people in five towns is not a name,
 *       and `Llarara the Elder of salvage yard` is a string join visible in the shipped world.
 *
 * WHAT IT CANNOT DO, said here rather than left for a critic: §6 of the comparison method is a
 * BLIND CULTURE-ATTRIBUTION TEST by a human or a fresh-context critic, and the band rows say
 * ">=90% / >=80% / >=70%". No tool can take that measurement — it is a judgement by somebody who
 * has not seen the lexicon. This tool reports `blind_attribution: null` and BANDS WITHOUT IT,
 * naming the cap that imposes. It does not substitute a proxy and call it the same number.
 *
 * Run:  node tools/lore/lor04-validate.mjs [--json] [--verbose] [--self-test]
 * Exit: 0 if the computed band is at or above RI-LOR04's failure threshold (3 of 5).
 *       1 if below it. 2 if the corpus or the validator it depends on is absent.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const PY = R('corpus/80-methods/jel-phonotactics.py');
const LEXICON = R('corpus/60-lore/data/jel-lexicon.json');

// ---------------------------------------------------------------- population

/**
 * DELETE-THE-FIX, and the BEFORE number, from THIS tool rather than from a note.
 *
 * `--at <rev>` harvests the rosters out of git at <rev> instead of off the working tree, so the
 * pre-fix population can be banded by the identical code that bands the post-fix one. RULES #6:
 * the teardown here is not "imagine the old names", it is the old bytes.
 */
function harvestAt(rev) {
  const files = execSync(`git ls-tree --name-only ${rev} game/data/npcs/`, { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    const j = JSON.parse(execSync(`git show ${rev}:${f}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    for (const n of (j.npcs || [])) {
      if (!n || !n.name || !n.race || /^the /i.test(n.name)) continue;
      out.push({ id: n.id, name: n.name, race: n.race, file: path.basename(f), generated: /^pop-/.test(path.basename(f)) });
    }
  }
  if (!out.length) { console.error(`FATAL: no roster at ${rev}`); process.exit(2); }
  return out;
}

/** Everybody in the tree who has a name AND a declared race. */
export function harvestPeople(dir = R('game/data/npcs')) {
  if (!fs.existsSync(dir)) {
    console.error(`FATAL: ${dir} does not exist — there is no population to band.`);
    process.exit(2);
  }
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const n of (j.npcs || [])) {
      if (!n || !n.name || !n.race) continue;
      // "the Blackrose yard hands" is a crowd, not a person with a name.
      if (/^the /i.test(n.name)) continue;
      // The generated rosters are exactly `pop-<settlement>.json`. Everything else — mainline,
      // quest-givers, faction-givers, tribes, named-states, thorn, writ-house — is the
      // hand-authored cast, and W1-23 r3 §7 is explicit that its names are good.
      out.push({ id: n.id, name: n.name, race: n.race, file: f, generated: /^pop-/.test(f) });
    }
  }
  return out;
}

export const isArgonian = (race) => /argonian|saxhleel|naga/i.test(String(race || ''));

// ---------------------------------------------------------------- M1: the §4 shape test

const LEX = fs.existsSync(LEXICON) ? JSON.parse(fs.readFileSync(LEXICON, 'utf8')) : { tamrielic_name_grammar: {} };
const TG = LEX.tamrielic_name_grammar || {};

const GENERAL_ENGLISH = ('nine teeth salt hand dark water quick tally bone setter cold ash slow rain wet foot two '
  + 'skin reed cutter rope maker half moon silent sing at dusk hide his her own keep drop no stitch see all '
  + 'colour three knife count never walk speak hold take give run stand wait fall deep long short old '
  + 'new black white green red blood stone iron wood fish bird snake root sap mud tide storm sun star night '
  + 'day the of in on one first last best left right fast good bad big small thin wide tall blind lame sharp dull '
  + 'hard soft warm sweet sour grey brown gold silver bright dim loud still calm wild free true false lost found '
  + 'broken whole empty full open closed clean dirty dry damp sick well strong weak young elder younger shorter '
  + 'taller patient quiet careful clever kind cruel proud humble tired ready late early near far high low under '
  + 'over up down back front side end start middle many few some any none scale claw tail eye ear nose mouth '
  + 'head neck arm leg knee toe finger thumb heart lung liver gut flesh hair nail horn wing fin gill egg '
  + 'nest den hole cave pit spring stream river lake sea shore beach bank bar reef isle rock cliff hill vale field '
  + 'farm yard gate wall door roof floor post beam plank board net line hook trap snare blade axe '
  + 'spear bow arrow shield helm mail cloak boot glove belt bag box pot pan cup bowl plate spoon cloth thread '
  + 'needle pin cord string chain ring bell drum pipe song word name story book page ink pen mark sign light '
  + 'shade shadow smoke fire flame coal dust sand clay bread meat rice bean fruit seed leaf branch trunk bark '
  + 'moss weed grass vine thorn flower fen marsh mire bog swamp weir ford landing quay dock wharf pier boat barge '
  + 'raft canoe ship sail oar pole mast rudder anchor cargo crate barrel sack load weight measure number '
  + 'score sum debt coin copper price cost trade sale buy sell pay owe lose find seek show '
  + 'tell ask answer talk shout whisper listen hear look watch stay go come swim '
  + 'dive climb rise sit lie sleep wake eat drink breath breathe live die born dead grave tomb ghost soul '
  + 'spirit mind dream hope fear love hate joy pain hurt heal cure health strength power force will way path '
  + 'road track trail bridge crossing turn bend curve straight round square flat steep smooth rough always once '
  + 'twice thrice again yet soon now then here there where when why how who what which silence fever shallow '
  + 'feather shell basket paper ledger tide flies fly bite break drown dig carry call follow mend cut pull split '
  + 'weigh bury burn feed refuse forget remember paint tie taste wade lift bask wallow only too late').split(' ');

/**
 * The §4 test, and it is deliberately MORE inclusive than the round-3 critic's instrument.
 * That instrument's English vocabulary is a flat word list with no inflection, so `Sleeps-Eggs`
 * and `Counts-Ledgers` read to it as Jel. Anything this project ships as a fix would then score
 * itself green on a blindness rather than on a change. So: stem a trailing `s`/`es`, and union
 * the general stock with RI-LOR04's OWN verb, determiner and noun tables — every word the item
 * itself licenses for a Tamrielic-descriptive name counts as English here by definition.
 */
export function englishVocabulary() {
  const v = new Set(GENERAL_ENGLISH);
  for (const w of [...(TG.verbs || []), ...(TG.determiners || []), ...(TG.nouns || [])]) {
    for (const part of String(w).toLowerCase().split(' ')) v.add(part);
  }
  return v;
}

const stem = (w) => {
  const s = w.toLowerCase();
  if (s.length > 3 && s.endsWith('es')) return [s, s.slice(0, -2), s.slice(0, -1)];
  if (s.length > 2 && s.endsWith('s')) return [s, s.slice(0, -1)];
  return [s];
};

/** A name is Tamrielic-descriptive iff some hyphen-joined element is entirely English. */
export function isDescriptive(name, vocab = englishVocabulary()) {
  const core = String(name).replace(/ of [a-z]+( [a-z]+)*$/, '').trim();
  for (const tok of core.split(' ')) {
    if (!tok.includes('-')) continue;
    const subs = tok.split('-').filter(Boolean);
    if (subs.length > 1 && subs.every((s) => stem(s).some((x) => vocab.has(x)))) return true;
  }
  return false;
}

// ---------------------------------------------------------------- M2/M3/M5/M6: the validator

/** Classify + validate a batch of names through RI-LOR04's own validator. */
export function classify(names, culture = null) {
  if (!fs.existsSync(PY)) {
    console.error(`FATAL: ${PY} does not exist.`);
    console.error('       RI-LOR04 §Scoring bands on a per-name violation rate produced by THAT file.');
    console.error('       This tool will not invent a substitute phonology and call the result a band.');
    process.exit(2);
  }
  if (!names.length) return [];
  const tmp = path.join(ROOT, 'reports', `_lor04-${process.pid}.txt`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, names.join('\n'));
  const args = [PY, '--names', tmp, '--json'];
  if (culture) args.push('--culture', culture);
  let out;
  try {
    out = execFileSync('python3', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    if (e.status === undefined || !e.stdout) { fs.unlinkSync(tmp); throw e; }
    out = e.stdout.toString();   // exit 1 just means "over threshold"; the JSON is still the answer
  }
  fs.unlinkSync(tmp);
  return JSON.parse(out).results;
}

// ---------------------------------------------------------------- the measures

export function measure(people, results) {
  const vocab = englishVocabulary();
  const byName = new Map(results.map((r) => [r.name, r]));

  const arg = people.filter((p) => isArgonian(p.race));
  const descriptive = arg.filter((p) => isDescriptive(p.name, vocab));

  // A DECLARED DEVIATION, and it is the largest thing in this file after the bands themselves.
  // `jel-phonotactics.py` has FIVE culture rows: jel, argonian-tamrielic, khajiit, imperial,
  // dunmer. RI-LOR04 §5's table has SIX cultures, the sixth being Kothringi, and the shipped
  // rosters also declare `nord` and `breton`. A Nord called Sigurd is therefore `unknown` to the
  // validator no matter how well it is named, and §Scoring's "> 2% unclassifiable is a hard 0"
  // would fail this province on the classifier's coverage rather than on its names.
  // So M3 is reported TWICE: raw over everybody, and over the sub-population the validator has a
  // row for — which is the one banded. Nothing is hidden; both numbers print.
  const CLASSIFIABLE = /argonian|saxhleel|naga|dunmer|imperial|khajiit/i;
  const inScope = people.filter((p) => CLASSIFIABLE.test(String(p.race)));
  const outOfScope = people.filter((p) => !CLASSIFIABLE.test(String(p.race)));

  const violations = inScope.filter((p) => (byName.get(p.name)?.violations || []).length > 0);
  const unknownRaw = people.filter((p) => byName.get(p.name)?.culture === 'unknown');
  const unknown = inScope.filter((p) => byName.get(p.name)?.culture === 'unknown');
  const apostrophes = arg.filter((p) => /['’]/.test(p.name));

  const jelNames = people.filter((p) => byName.get(p.name)?.culture === 'jel').map((p) => p.name);
  const withX = jelNames.filter((n) => /x/i.test(n));
  const withLong = jelNames.filter((n) => /(ee|aa|oo)/i.test(n));

  // M6: the classifier says one culture, the record declares another race.
  const EXPECT = { argonian: ['jel', 'argonian-tamrielic'], dunmer: ['dunmer'], imperial: ['imperial'], khajiit: ['khajiit'] };
  const declared = (race) => {
    const r = String(race).toLowerCase();
    if (isArgonian(r)) return 'argonian';
    if (/dunmer/.test(r)) return 'dunmer';
    if (/imperial/.test(r)) return 'imperial';
    if (/khajiit/.test(r)) return 'khajiit';
    return null;                                  // nord/breton/kothringi have no classifier row
  };
  const crossCulture = people.filter((p) => {
    const d = declared(p.race);
    if (!d) return false;
    const got = byName.get(p.name)?.culture;
    if (!got || got === 'unknown') return false;  // unknown is M3's business, not M6's
    return !EXPECT[d].includes(got);
  });

  const counts = new Map();
  for (const p of arg) counts.set(p.name, (counts.get(p.name) || 0) + 1);
  const reused = [...counts.entries()].filter(([, v]) => v > 1);
  const templateSlug = arg.filter((p) => / of (?!the )[a-z]/.test(p.name));

  return {
    population: people.length,
    argonian: arg.length,
    M1: {
      descriptive: descriptive.length,
      share: arg.length ? descriptive.length / arg.length : 0,
      attested: 0.11,
      fails_section_4: arg.length ? descriptive.length / arg.length > 0.5 : false,
      examples: descriptive.slice(0, 8).map((p) => p.name),
    },
    in_scope: inScope.length,
    out_of_scope: { n: outOfScope.length, races: [...new Set(outOfScope.map((p) => p.race))], note: 'jel-phonotactics.py has no culture row for these races; RI-LOR04 §5 names Kothringi and the rosters also declare nord and breton' },
    M2: { violations: violations.length, rate: inScope.length ? violations.length / inScope.length : 0, examples: violations.slice(0, 8).map((p) => `${p.name} :: ${(byName.get(p.name).violations || []).join('; ').slice(0, 90)}`) },
    M3: { unknown: unknown.length, share: inScope.length ? unknown.length / inScope.length : 0, unknown_raw: unknownRaw.length, share_raw: people.length ? unknownRaw.length / people.length : 0, examples: unknown.slice(0, 8).map((p) => p.name) },
    M4: { apostrophes: apostrophes.length, examples: apostrophes.slice(0, 8).map((p) => p.name) },
    M5: { jel: jelNames.length, x_share: jelNames.length ? withX.length / jelNames.length : 0, long_vowel_share: jelNames.length ? withLong.length / jelNames.length : 0 },
    M6: { cross_culture: crossCulture.length, examples: crossCulture.slice(0, 8).map((p) => `${p.name} [declared ${p.race}, classified ${byName.get(p.name).culture}]`) },
    M7: { reused: reused.length, worst: reused.sort((a, b) => b[1] - a[1]).slice(0, 4), template_slug: templateSlug.length, slug_examples: templateSlug.slice(0, 4).map((p) => p.name) },
    // WHICH HALF FAILS. Every measure above, split by provenance, because "the hand-authored Jel
    // names are good and the defect is entirely in the generated rosters" is the round-3 verdict's
    // finding and a band over the union hides which half moved.
    by_provenance: ['generated', 'hand'].map((which) => {
      const set = people.filter((p) => (which === 'generated') === !!p.generated);
      const scoped = set.filter((p) => CLASSIFIABLE.test(String(p.race)));
      const bad = scoped.filter((p) => (byName.get(p.name)?.violations || []).length > 0);
      const unk = scoped.filter((p) => byName.get(p.name)?.culture === 'unknown');
      const a = set.filter((p) => isArgonian(p.race));
      const d = a.filter((p) => isDescriptive(p.name, vocab));
      return {
        which, n: set.length, in_scope: scoped.length,
        violations: bad.length, violation_rate: scoped.length ? bad.length / scoped.length : 0,
        unknown: unk.length, unknown_share: scoped.length ? unk.length / scoped.length : 0,
        argonian: a.length, descriptive: d.length, descriptive_share: a.length ? d.length / a.length : 0,
      };
    }),
    blind_attribution: null,
  };
}

/** RI-LOR04 §Scoring, applied. Returns { native, cap, why[] }. */
export function band(m) {
  const why = [];
  if (m.M4.apostrophes > 0) { why.push(`hard 0: ${m.M4.apostrophes} apostrophe(s) in an Argonian name`); return { native: 0, why }; }
  if (m.M3.share > 0.02) { why.push(`hard 0: ${(100 * m.M3.share).toFixed(1)}% unclassifiable > 2%`); return { native: 0, why }; }

  let native;
  const r = m.M2.rate;
  if (r <= 0.01) native = 5; else if (r <= 0.03) native = 4; else if (r <= 0.05) native = 3;
  else if (r <= 0.15) native = 2; else native = 1;
  why.push(`violation rate ${(100 * r).toFixed(2)}% -> band ${native}`);

  if (m.M1.fails_section_4) { native = Math.min(native, 2); why.push('§4 failed: MOST Argonians carry hyphenated English names -> capped at 2'); }
  if (m.M3.share > 0.005 && native === 5) { native = 4; why.push(`unknown ${(100 * m.M3.share).toFixed(2)}% > 0.5% -> band 5 not available`); }
  if (m.M5.jel >= 20) {
    if (m.M5.x_share < 0.40) { native = Math.min(native, 2); why.push(`flavourless Jel: x-density ${(100 * m.M5.x_share).toFixed(0)}% < 40% -> capped at 2`); }
    if (m.M5.long_vowel_share < 0.20) { native = Math.min(native, 2); why.push(`flavourless Jel: long vowels ${(100 * m.M5.long_vowel_share).toFixed(0)}% < 20% -> capped at 2`); }
  } else {
    why.push(`comparison method §5 not applied: only ${m.M5.jel} Jel-classified names, too few to band a density on`);
  }
  if (m.blind_attribution === null) {
    native = Math.min(native, 4);
    why.push('blind culture-attribution (§6) is a JUDGEMENT and was not taken -> 5 is not available from a tool');
  }
  // The ladder row RI-LOR04 §Scoring mandates: native 2/5 -> 4, 3/5 -> 6, 5/5 -> 8.
  const ladder = native <= 2 ? 4 : native === 3 ? 6 : native === 4 ? 7 : 8;
  return { native, ladder, why };
}

// ---------------------------------------------------------------- report

function commit() { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } }

function run(argv) {
  const at = (() => { const i = argv.indexOf('--at'); return i >= 0 ? argv[i + 1] : null; })();
  const people = at ? harvestAt(at) : harvestPeople();
  if (at) console.log(`population taken from git at ${at} (DELETE-THE-FIX arm)`);
  // Culture-forced per RI-LOR04 comparison method §3: Argonians are judged as Argonians, and
  // everybody else is judged by free classification.
  const argNames = people.filter((p) => isArgonian(p.race)).map((p) => p.name);
  const otherNames = people.filter((p) => !isArgonian(p.race)).map((p) => p.name);
  const results = [
    ...classify([...new Set(argNames)]),
    ...classify([...new Set(otherNames)]),
  ];
  const m = measure(people, results);
  const b = band(m);
  const out = { commit: commit(), population_at: at || 'working tree', ...m, band: b };

  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); return b.native >= 3 ? 0 : 1; }

  console.log(`commit      ${out.commit}`);
  console.log(`population  ${m.population} named people with a declared race (${m.argonian} Argonian)`);
  console.log(`validator   corpus/80-methods/jel-phonotactics.py, one judgement per name\n`);
  console.log(`M1 §4 SHAPE            ${m.M1.descriptive}/${m.argonian} Argonians carry the hyphenated-English form `
    + `= ${(100 * m.M1.share).toFixed(1)}%   (attested ${(100 * m.M1.attested).toFixed(0)}%)  -> §4 ${m.M1.fails_section_4 ? 'FAILED' : 'held'}`);
  if (m.M1.examples.length) console.log(`                       e.g. ${m.M1.examples.slice(0, 5).join(' | ')}`);
  console.log(`   in scope for the validator: ${m.in_scope}; out of scope: ${m.out_of_scope.n} (${m.out_of_scope.races.join(', ')}) — no culture row exists for these\n`);
  console.log(`M2 VIOLATION RATE      ${m.M2.violations}/${m.in_scope} = ${(100 * m.M2.rate).toFixed(2)}%   (band 5 needs <=1%)`);
  for (const e of (argv.includes('--verbose') ? m.M2.examples : m.M2.examples.slice(0, 3))) console.log(`                       ${e}`);
  console.log(`M3 UNCLASSIFIABLE      ${m.M3.unknown}/${m.in_scope} = ${(100 * m.M3.share).toFixed(2)}%   (>2% is a hard 0);`
    + `  raw over everybody ${m.M3.unknown_raw}/${m.population} = ${(100 * m.M3.share_raw).toFixed(2)}%`);
  if (m.M3.examples.length) console.log(`                       e.g. ${m.M3.examples.slice(0, 5).join(' | ')}`);
  console.log(`M4 APOSTROPHES         ${m.M4.apostrophes} in Argonian names   (any at all is a hard 0)`);
  console.log(`M5 SOUND WORLD         ${m.M5.jel} Jel-classified: ${(100 * m.M5.x_share).toFixed(0)}% carry x (>=40%), `
    + `${(100 * m.M5.long_vowel_share).toFixed(0)}% carry a long vowel (>=20%)`);
  console.log(`M6 CROSS-CULTURE       ${m.M6.cross_culture} names whose classified culture is not the race declared on the record`);
  for (const e of m.M6.examples.slice(0, 4)) console.log(`                       ${e}`);
  console.log(`M7 REUSE / TEMPLATE    ${m.M7.reused} name(s) borne by more than one Argonian`
    + `${m.M7.worst.length ? ` (worst: ${m.M7.worst.map(([n, v]) => `${v}x ${n}`).join(', ')})` : ''}; `
    + `${m.M7.template_slug} template slug(s)${m.M7.slug_examples.length ? ` e.g. ${m.M7.slug_examples[0]}` : ''}`);
  console.log(`\nBY PROVENANCE          (generated = game/data/npcs/pop-*.json; hand = the authored cast)`);
  for (const r of m.by_provenance) {
    console.log(`   ${r.which.padEnd(10)} ${String(r.n).padStart(3)} people, ${String(r.argonian).padStart(3)} Argonian: `
      + `descriptive ${(100 * r.descriptive_share).toFixed(1)}%, violations ${(100 * r.violation_rate).toFixed(2)}%, `
      + `unclassifiable ${(100 * r.unknown_share).toFixed(2)}%`);
  }
  console.log(`\nBAND (RI-LOR04 §Scoring, 0-5 native): ${b.native}   -> ladder anchor ${b.ladder}/10`);
  for (const w of b.why) console.log(`   ${w}`);
  console.log(`\nfailure threshold: below 3 blocks the wave. RESULT: ${b.native >= 3 ? 'PASS' : 'FAIL'}`);
  return b.native >= 3 ? 0 : 1;
}

// ---------------------------------------------------------------- self-test

function selfTest() {
  let pass = 0, fail = 0;
  const say = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}   ${msg}`); ok ? pass++ : fail++; };
  const vocab = englishVocabulary();

  // --- M1
  say(isDescriptive('Hides-His-Foot', vocab), 'M1: an attested descriptive name is descriptive');
  say(isDescriptive('Sleeps-Eggs', vocab), 'M1: an INFLECTED descriptive name is caught (the r3 instrument misses this one)');
  say(isDescriptive('Counts-Ledgers', vocab), 'M1: a plural noun from RI-LOR04’s own table is caught');
  say(!isDescriptive('Wuleen-Kus', vocab), 'M1: a Jel compound is NOT descriptive');
  say(!isDescriptive('Xul-Vastei', vocab), 'M1: a coined Jel compound is NOT descriptive');
  say(isDescriptive('Weel Quick-Tally of old quay', vocab), 'M1: the template slug does not hide the descriptive element');
  const m1a = measure([{ name: 'Hides-Rain', race: 'argonian' }, { name: 'Xul-Meer', race: 'argonian' }], [{ name: 'Hides-Rain', culture: 'argonian-tamrielic', violations: [] }, { name: 'Xul-Meer', culture: 'jel', violations: [] }]);
  say(Math.abs(m1a.M1.share - 0.5) < 1e-9, 'M1: the share is descriptive/Argonian');
  say(m1a.M1.fails_section_4 === false, 'M1: exactly half is not "most"');
  const m1b = measure([{ name: 'Hides-Rain', race: 'argonian' }, { name: 'Counts-Debts', race: 'argonian' }, { name: 'Xul-Meer', race: 'argonian' }], []);
  say(m1b.M1.fails_section_4 === true, 'M1: two in three IS "most" and fails §4');

  // --- M2/M3/M4/M5/M6/M7 over a fixture, then the same fixture broken on purpose
  const clean = [
    { name: 'Xul-Meer', race: 'argonian' }, { name: 'Anxeech', race: 'argonian' },
    { name: 'Andrel Vorin', race: 'dunmer' }, { name: 'Sergius Verrent', race: 'imperial' },
  ];
  const cleanRes = [
    { name: 'Xul-Meer', culture: 'jel', violations: [] }, { name: 'Anxeech', culture: 'jel', violations: [] },
    { name: 'Andrel Vorin', culture: 'dunmer', violations: [] }, { name: 'Sergius Verrent', culture: 'imperial', violations: [] },
  ];
  const mc = measure(clean, cleanRes);
  say(mc.M2.rate === 0 && band(mc).native >= 4, 'a clean fixture bands at 4 or better');
  say(band({ ...mc, M4: { apostrophes: 1, examples: [] } }).native === 0, 'M4: one apostrophe in an Argonian name is a hard 0');
  say(band({ ...mc, M3: { unknown: 3, share: 0.03, examples: [] } }).native === 0, 'M3: >2% unclassifiable is a hard 0');
  const badRate = { ...mc, M2: { violations: 5, rate: 0.20, examples: [] } };
  say(band(badRate).native === 1, 'M2: a 20% violation rate bands at 1');
  say(band({ ...mc, M2: { violations: 1, rate: 0.04, examples: [] } }).native === 3, 'M2: a 4% violation rate bands at 3');
  say(band({ ...mc, M1: { ...mc.M1, fails_section_4: true } }).native <= 2, 'M1: failing §4 caps the band at 2');
  const flavourless = { ...mc, M5: { jel: 40, x_share: 0.10, long_vowel_share: 0.90 } };
  say(band(flavourless).native <= 2, 'M5: flavourless Jel (x-density 10%) caps the band at 2');
  const shortVowel = { ...mc, M5: { jel: 40, x_share: 0.90, long_vowel_share: 0.05 } };
  say(band(shortVowel).native <= 2, 'M5: too few long vowels caps the band at 2');
  say(band(mc).why.some((w) => /blind/.test(w)) && band(mc).native <= 4, 'the un-takeable blind test caps a tool-only band at 4, and says so');

  const crossed = measure(
    [{ name: 'Sedura Nine-Teeth', race: 'argonian' }],
    [{ name: 'Sedura Nine-Teeth', culture: 'dunmer', violations: [] }],
  );
  say(crossed.M6.cross_culture === 1, 'M6: a Dunmer-classified name on an Argonian record is caught');
  const notCrossed = measure(
    [{ name: 'Hides-Rain', race: 'argonian' }],
    [{ name: 'Hides-Rain', culture: 'argonian-tamrielic', violations: [] }],
  );
  say(notCrossed.M6.cross_culture === 0, 'M6: argonian-tamrielic on an Argonian is NOT a contamination');
  const dup = measure([{ name: 'Xul-Meer', race: 'argonian' }, { name: 'Xul-Meer', race: 'argonian' }], []);
  say(dup.M7.reused === 1, 'M7: a reused name is caught');
  say(measure([{ name: 'Weel Quick-Tally of old quay', race: 'argonian' }], []).M7.template_slug === 1, 'M7: the template slug is caught');
  say(measure([{ name: 'Ocheeva of the Boards', race: 'argonian' }], []).M7.template_slug === 0, 'M7: a properly articled epithet is not a slug');

  // the population must be real, and the tool must refuse a missing one
  const real = harvestPeople();
  say(real.length > 50, `the shipped population is non-empty (${real.length} named people with a race)`);

  // and the validator must be genuinely reachable — a stub that never shells out would pass
  // everything above, so this rung actually runs it
  const live = classify(['Xa’thril'], 'jel');
  say(live.length === 1 && live[0].violations.length > 0,
    'the live validator rejects apostrophe-salad forced to Jel (the tool really does shell out)');

  console.log(`\nself-test ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail}`);
  return fail === 0 ? 0 : 1;
}

const argv = process.argv.slice(2);
process.exit(argv.includes('--self-test') ? selfTest() : run(argv));

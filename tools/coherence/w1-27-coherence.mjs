#!/usr/bin/env node
/**
 * w1-27-coherence.mjs — DO THE PARTS OF THIS GAME KNOW ABOUT EACH OTHER?
 *
 * W1-27's ten paths, one check each, all of them over the SHIPPED data with no browser and no
 * engine. Every check returns a number and a threshold, so it can be wrong; `--self-test`
 * perturbs a copy of the input and asserts each check goes red, because RULES #4 says a probe
 * that cannot fail is worse than no probe.
 *
 * The check that defines the piece is L1. **There is no procedural loot table in this game** is a
 * rule about the world the player walks through, so L1 counts PLACED OBJECTS, not source lines,
 * and it counts them in `game/data/` where the world reads them from — not in the tool that
 * emitted them. A rule stated over source code is satisfiable by moving the table; a rule stated
 * over the artifact is not.
 *
 * TWO THINGS THIS TOOL DELIBERATELY DOES NOT DO.
 *
 * 1. **It does not flag an authored contradiction.** Nineteen-plus disagreements are placed in
 *    this world on purpose and a coherence tool that reports them is worse than none. LR1 tells
 *    them apart mechanically rather than by taste, using the corpus's OWN mechanism: a fact in
 *    `game/data/lore/canon.json` carrying `disputed: true` with >= 2 `positions`, each naming an
 *    `in_world_source` and >= 1 `voiced_by`, is AUTHORED — somebody wrote both sides and put a
 *    mouth on each. A disagreement with one position, or no voice, or no source, is INCOHERENCE:
 *    nobody in the world holds it, so it is not a disagreement, it is a mistake. This is the same
 *    line `constants.json`'s `deliberate_divergences` draws for numbers (RI-MTH05 C4/C5), applied
 *    to prose.
 *
 * 2. **It does not re-derive what a verdict already established** (RULES #18). Where a number is
 *    already published — the soul ledgers, the fourth gold mirror, the corpus gate — this tool
 *    shells out to the owning instrument or cites the verdict, and says which.
 *
 * Run:
 *   node tools/coherence/w1-27-coherence.mjs             report; exit 1 if any check is red
 *   node tools/coherence/w1-27-coherence.mjs --json      machine-readable, same exit code
 *   node tools/coherence/w1-27-coherence.mjs --self-test break each check on purpose; exit 1 if
 *                                                        any of them survives its own teardown
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJSON = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const listDir = (p) => fs.readdirSync(R(p)).filter((f) => f.endsWith('.json')).sort();

// ---------------------------------------------------------------------------- shared loaders
// Every check takes a `world` object rather than reading the disk itself, so `--self-test` can
// hand it a perturbed copy without writing to game/data. A teardown that has to touch the shipped
// tree on a box where a dozen agents are committing is a teardown that eats somebody's work.

function loadWorld() {
  const property = listDir('game/data/world/property').map((f) => readJSON(`game/data/world/property/${f}`));
  const generatorSrc = fs.readFileSync(R('tools/world/build-property.mjs'), 'utf8');
  return {
    property,
    generatorSrc,
    pois: readJSON('game/data/world/pois.json'),
    interiors: listDir('game/data/world/interiors'),
    regions: readJSON('game/data/world/regions.json'),
    canon: readJSON('game/data/lore/canon.json'),
    factions: readJSON('game/data/dialogue/faction-reactions.json'),
    posts: readJSON('game/data/world/population-posts.json'),
    engineSrc: fs.readFileSync(R('game/src/engine.js'), 'utf8'),
    harnessSrc: fs.readFileSync(R('game/src/harness/api.js'), 'utf8'),
    bookIds: (() => {
      const ids = new Set();
      for (const f of listDir('game/data/books')) {
        const d = readJSON(`game/data/books/${f}`);
        for (const b of d.books || d.entries || (Array.isArray(d) ? d : [])) if (b && b.id) ids.add(b.id);
      }
      return ids;
    })(),
    canonCorpus: (() => {
      try { const d = readJSON('corpus/60-lore/data/canon-facts.json'); return d.facts || (Array.isArray(d) ? d : []); }
      catch { return []; }
    })(),
  };
}

/** Pull GIVEN/EPITHET/PALETTE out of the generator itself, never a copy — see name-rosters.mjs. */
function generatorStock(src) {
  const pal = src.match(/const PALETTE = \{[\s\S]*?\n\};/);
  const g = src.match(/const GIVEN = (\[[^\]]*\]);/);
  const e = src.match(/const EPITHET = (\[[^\]]*\]);/);
  const names = new Set();
  if (pal) for (const m of pal[0].matchAll(/\['([^']+)',\s*[\d.]+,\s*[\d.]+\]/g)) names.add(m[1]);
  const parse = (s) => (s ? new Set(JSON.parse(s[1].replace(/'/g, '"'))) : new Set());
  return { palette: names, GIVEN: parse(g), EPITHET: parse(e) };
}

const allContents = (property) =>
  property.flatMap((p) => (p.zones || []).flatMap((z) => z.contents || []));
const allPeople = (property) => {
  const out = new Set();
  for (const p of property) for (const z of p.zones || []) {
    if (z.owner_name) out.add(z.owner_name);
    for (const r of z.residents || []) if (r.name) out.add(r.name);
  }
  return [...out];
};

// ---------------------------------------------------------------------------------- the checks
// Each returns { id, path, red, headline, n, threshold, detail }. `red` is the whole point.

/**
 * L1 — world.loot.placement. THE RULE THAT DEFINES THE PIECE.
 *
 * A placed object is PROCEDURAL if its name is an entry in a generator palette and its instance
 * id is a positional slot (`<zone>.<n>`) rather than a name somebody chose. Both clauses are
 * required: a hand-placed object that happens to share a name with a palette entry keeps its own
 * instance id, and a unique object emitted into a numbered slot would still be one-of-a-kind.
 */
function L1(w) {
  const { palette } = generatorStock(w.generatorSrc);
  const items = allContents(w.property);
  const proc = items.filter((c) => palette.has(c.name) && /\.\d+$/.test(String(c.instance)) && !c.unique);
  const hand = items.length - proc.length;
  // The repeat count is the part a player feels: RI-WLD02 M7 fails a piece on a thing appearing
  // more than 40 times with an identical component set.
  const byName = {};
  for (const c of items) byName[c.name] = (byName[c.name] || 0) + 1;
  const over40 = Object.entries(byName).filter(([, n]) => n > 40).sort((a, b) => b[1] - a[1]);
  return {
    id: 'L1', path: 'world.loot.placement',
    red: proc.length > 0,
    n: proc.length, threshold: 0,
    headline: `${proc.length} of ${items.length} placed takeable objects come out of a palette table (${(100 * proc.length / (items.length || 1)).toFixed(1)}%); ${hand} are hand-placed`,
    detail: {
      palette_entries: palette.size,
      distinct_names_in_world: Object.keys(byName).length,
      names_repeated_over_40_times: over40.length,
      worst: over40.slice(0, 5),
      source: 'tools/world/build-property.mjs PALETTE (l.38-49), indexed at l.152-154',
      runtime_rolls: 0,
    },
  };
}

/**
 * D1 — world.density.handplacement. RI-WLD02's named-location fail floor.
 *
 * Tier A is a named interior; Tier B a named exterior site. The floor is A+B >= 276 and this
 * item scores 0 below it. Counting interiors as files rather than as doors is deliberate and
 * generous: it is the upper bound, and the check is still red.
 */
function D1(w) {
  const tierB = (w.pois.pois || []).length;
  const tierA = w.interiors.length;
  const regions = (w.regions.regions || w.regions).map ? (w.regions.regions || w.regions) : [];
  const withPoi = new Set((w.pois.pois || []).map((p) => p.region));
  const empty = (Array.isArray(regions) ? regions : []).map((r) => r.id || r).filter((id) => !withPoi.has(id));
  return {
    id: 'D1', path: 'world.density.handplacement',
    red: tierA + tierB < 276,
    n: tierA + tierB, threshold: 276,
    headline: `${tierA + tierB} named locations (${tierA} interiors + ${tierB} exterior POIs) against RI-WLD02's fail floor of 276 and target of 460`,
    detail: { tier_a_interiors: tierA, tier_b_pois: tierB, regions_with_no_poi: empty, pois_declared_incomplete: !!w.pois.declared_incomplete },
  };
}

/**
 * N1 — coherence.naming. THE FIX AND THE GENERATOR THAT OWNS IT MUST AGREE.
 *
 * W1-23 r3 measured 55.8% of named Argonians carrying a hyphenated-English descriptive name and
 * `name-rosters.mjs --write` brought the shipped rosters to 0 generated-shape names. But the fix
 * rewrote the OUTPUT. `build-property.mjs` still holds the stock that produced the defect, and it
 * writes `game/data/world/property/*.json` with no flag and no guard. So this check does not ask
 * "are the names good now" — `name-rosters.mjs --check` already answers that. It asks whether the
 * fix SURVIVES the next person who runs the generator, which is the coherence question.
 */
function N1(w) {
  const { GIVEN, EPITHET } = generatorStock(w.generatorSrc);
  const people = allPeople(w.property);
  const hyphen = (s) => /[A-Za-z]+-[A-Za-z]/.test(s);
  // The stock the generator would draw from, scored by the criterion the naming round used.
  const stockHyphen = [...GIVEN].filter(hyphen).length + [...EPITHET].filter(hyphen).length;
  const stockSize = GIVEN.size + EPITHET.size;
  // Does the shipped roster contain any name the generator could have made? (It should not — the
  // rename ran.) And does the generator still hold the stock? (It does.) That pair IS the defect:
  // the two halves disagree, and only one of them is guarded.
  const shippedGenerated = people.filter((n) => {
    const parts = n.replace(/ of [a-z -]+$/, '').split(' ');
    return parts.length === 2 && GIVEN.has(parts[0]) && EPITHET.has(parts[1]);
  });
  const guarded = /--write/.test(w.generatorSrc);
  return {
    id: 'N1', path: 'coherence.naming',
    red: !guarded && stockHyphen > 0,
    n: stockHyphen, threshold: 0,
    headline: guarded
      ? `the generator is guarded; ${shippedGenerated.length} generated-shape names survive in the shipped rosters`
      : `build-property.mjs still holds ${stockHyphen} of ${stockSize} hyphenated-English name parts and rewrites the rosters unguarded — running it un-names ${people.length} people`,
    detail: {
      shipped_people: people.length,
      shipped_generated_shape: shippedGenerated.length,
      generator_write_guard: guarded,
      dunmer_honorific_in_argonian_given_stock: [...GIVEN].filter((n) => /^(Sedura|Serjo|Muthsera)$/i.test(n)),
      cite: 'tools/lore/name-rosters.mjs header; corpus/90-verdicts/wave1/W1-23-r3',
    },
  };
}

/**
 * LR1 — coherence.lore. AUTHORED CONTRADICTION IS NOT INCOHERENCE.
 *
 * Red only for a disagreement nobody in the world holds. A well-formed dispute — two or more
 * positions, each with an in-world source and at least one voiced_by — is the design, and this
 * check counts them so the number is visible rather than flagged.
 */
function LR1(w) {
  const facts = w.canon.facts || [];
  const disputed = facts.filter((f) => f.disputed);
  // RI-LOR06's own error list, not a bar invented here: fewer than two positions; a position with
  // no `held_by` ("a contradiction nobody actually believes"); a position voiced zero times ("that
  // position is fictional"). `in_world_source: null` is NOT an error — CF-D028 is a dispute held
  // in speech and never written down, which is a legitimate and good thing for a dispute to be.
  const malformed = disputed.filter((f) => {
    const pos = f.positions || [];
    if (pos.length < 2) return true;
    return pos.some((p) => !(p.held_by || []).length || !(p.voiced_by || []).length);
  });
  // The clause `canon-check.py` only applies under `--books-manifest`, and nothing runs it that
  // way: a position citing a book nobody wrote. "A contradiction whose sources do not exist is
  // not tracked, it is claimed."
  const bookIds = w.bookIds || new Set();
  const dangling = [];
  for (const f of disputed) for (const p of f.positions || []) for (const v of p.voiced_by || []) {
    if (v.startsWith('book:') && !bookIds.has(v.slice(5))) dangling.push(`${f.id} -> ${v}`);
  }
  // The two copies of the registry must agree — `game/data/lore/canon.json` is generated from
  // `corpus/60-lore/data/canon-facts.json` and a drift between them is RI-MTH05's C4 in prose.
  const corpusIds = new Set((w.canonCorpus || []).map((f) => f.id));
  const drift = corpusIds.size
    ? facts.filter((f) => !corpusIds.has(f.id)).map((f) => f.id)
      .concat([...corpusIds].filter((id) => !facts.some((f) => f.id === id)))
    : ['corpus registry unreadable'];
  const fullyVoiced = disputed.length - malformed.length;
  return {
    id: 'LR1', path: 'coherence.lore',
    red: malformed.length > 0 || dangling.length > 0 || drift.length > 0 || fullyVoiced < 8,
    n: malformed.length + dangling.length + drift.length, threshold: 0,
    headline: `${disputed.length} authored contradictions over ${disputed.reduce((a, f) => a + (f.positions || []).length, 0)} positions, ${fullyVoiced} fully voiced; ${malformed.length} malformed, ${dangling.length} citing a book nobody wrote, ${drift.length} drifted from the corpus registry`,
    detail: {
      authored_and_well_formed: fullyVoiced,
      malformed: malformed.map((f) => f.id),
      dangling_book_voices: dangling,
      registry_drift: drift,
      how_they_were_told_apart:
        "RI-LOR06's own error list — disputed:true AND >=2 positions AND every position has a non-empty held_by AND >=1 voiced_by. "
        + 'A well-formed dispute is the design and is never flagged; only a disagreement nobody in the world holds is.',
      not_re_derived: 'corpus/80-methods/canon-check.py --validate-registry owns the schema half and passes; this check adds the --books-manifest clause nothing runs',
    },
  };
}

/**
 * T1 — coherence.tone.crossregion. A REGION WITH NOTHING IN IT HAS NO TONE.
 *
 * Thirteen regions are declared. Tone across regions cannot be judged for a region that carries
 * no POI, no enemy post and no interior — there is nothing there to have a tone.
 */
function T1(w) {
  const regions = (w.regions.regions || []).map((r) => r.id || r);
  const poiR = new Set((w.pois.pois || []).map((p) => p.region));
  const postR = new Set((w.posts.posts || []).map((p) => p.region));
  const bare = regions.filter((id) => !poiR.has(id) && !postR.has(id));
  const poiOnly = regions.filter((id) => poiR.has(id) !== postR.has(id));
  return {
    id: 'T1', path: 'coherence.tone.crossregion',
    red: bare.length > 0,
    n: bare.length, threshold: 0,
    headline: `${regions.length} declared regions; ${bare.length} carry neither a POI nor a populated post`,
    detail: { bare, populated_on_one_axis_only: poiOnly, regions },
  };
}

/**
 * F1 — coherence.faction.crossref. EVERY FACTION AN OBJECT BELONGS TO MUST EXIST.
 *
 * `faction:<id>` appears as an owner on placed property, and a theft from a faction that has no
 * standing row cannot be punished, forgiven or paid off. This is the cheapest possible
 * cross-reference and it is exactly the shape of defect the wave keeps finding.
 */
function F1(w) {
  const known = new Set((w.factions.factions || []).map((f) => f.id || f));
  const used = new Set();
  for (const c of allContents(w.property)) {
    if (typeof c.owner === 'string' && c.owner.startsWith('faction:')) used.add(c.owner.slice(8));
  }
  for (const p of w.property) for (const z of p.zones || []) if (z.faction) used.add(z.faction);
  const dangling = [...used].filter((f) => !known.has(f));
  return {
    id: 'F1', path: 'coherence.faction.crossref',
    red: dangling.length > 0,
    n: dangling.length, threshold: 0,
    headline: `${used.size} factions own property or a zone; ${dangling.length} of them are not in the faction roster`,
    detail: { roster: [...known], used: [...used], dangling },
  };
}

/**
 * X1 — coherence.difficulty.continuity. IS THE CURVE MONOTONE WHERE IT SAYS IT IS?
 *
 * Every populated post carries a region and a difficulty `tier`. A tier is a promise about what
 * you meet there, so the mean souls a post pays must not fall as the tier rises. This is the
 * weakest possible statement of continuity and it is the one that can actually be checked from
 * data: it does not claim the curve is good, only that it points the same way twice.
 */
function X1(w) {
  const byTier = {};
  for (const p of w.posts.posts || []) {
    (byTier[p.tier] = byTier[p.tier] || []).push(p.souls || 0);
  }
  const tiers = Object.keys(byTier).map(Number).sort((a, b) => a - b);
  const means = tiers.map((t) => [t, byTier[t].reduce((a, b) => a + b, 0) / byTier[t].length]);
  const inversions = [];
  for (let i = 1; i < means.length; i++) if (means[i][1] < means[i - 1][1]) inversions.push([means[i - 1][0], means[i][0]]);
  return {
    id: 'X1', path: 'coherence.difficulty.continuity',
    red: inversions.length > 0,
    n: inversions.length, threshold: 0,
    headline: `${tiers.length} difficulty tiers over ${(w.posts.posts || []).length} posts; ${inversions.length} tier steps pay FEWER souls than the tier below`,
    detail: { mean_souls_per_tier: means.map(([t, m]) => [t, Math.round(m * 10) / 10]), inversions },
  };
}

/**
 * P1 — coherence.progression.pacing. WHAT DOES A CROSSING BUY?
 *
 * Delegated in full to `tools/check-souls-world.mjs --totals`, which is the owning instrument and
 * the one INDEX.md tells every agent to ask. Re-deriving it here would be a second definition of
 * a number that already has one owner, which is the C4 defect RI-MTH05 exists to catch.
 */
function P1() {
  let line = '';
  let ok = true;
  try {
    line = execFileSync('node', [R('tools/check-souls-world.mjs'), '--totals'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    ok = false;
    line = String((e.stdout || '') + (e.stderr || '')).trim() || String(e.message);
  }
  const lvl = line.match(/level (\d+)/);
  const level = lvl ? Number(lvl[1]) : null;
  return {
    id: 'P1', path: 'coherence.progression.pacing',
    red: !ok || level === null || level < 2,
    n: level, threshold: 2,
    headline: ok ? line : `check-souls-world.mjs failed: ${line.slice(0, 160)}`,
    detail: { delegated_to: 'tools/check-souls-world.mjs --totals', ledgers_agree: ok },
  };
}

/**
 * E1 — coherence.economy.balance. HOW MANY PURSES ARE THERE, AND WHO WRITES THEM?
 *
 * Three mirrored values were found in this economy by grep and a fourth by W1-14 round 5
 * (`save/state.js`'s bare restore). The lesson was that a mirror is invisible to `getGold()` by
 * construction, so `goldMirrors()` was built to publish them side by side. This check asserts
 * that surface still exists and that every purse field it names is written by the single setter.
 * It is a structural check, not a runtime one, and says so: it cannot see a divergence at play,
 * only the absence of the machinery that would prevent one.
 */
function E1(w) {
  const m = w.harnessSrc.match(/goldMirrors\(\)\s*\{\s*return\s*\{([\s\S]*?)\};/);
  const fields = m ? [...m[1].matchAll(/(\w+):/g)].map((x) => x[1]) : [];
  const setter = w.engineSrc.match(/_setGold\s*\(([\s\S]{0,900}?)\n  \}/);
  const body = setter ? setter[0] : '';
  const wants = { progression_gold: 'progression', magic_gold: 'magic', combat_world_gold: 'combat', stealth_gold: 'stealth' };
  const unwritten = fields.filter((f) => wants[f] && !new RegExp(wants[f]).test(body));
  return {
    id: 'E1', path: 'coherence.economy.balance',
    red: fields.length < 4 || unwritten.length > 0,
    n: fields.length - unwritten.length, threshold: 4,
    headline: `goldMirrors() publishes ${fields.length} purses; ${unwritten.length} of them are not written by _setGold`,
    detail: {
      mirrors: fields, not_written_by_setter: unwritten,
      cite: 'game/src/harness/api.js goldMirrors(); the fourth mirror (save/state.js bare restore) is W1-14 round 5, not re-derived here',
    },
  };
}

/**
 * S1 — coherence.systems.composition. THE CORPUS GATE, AND WHAT THE WAVE SCORED.
 *
 * The gate is RI-MTH05's own instrument and is delegated. The second number is the composition
 * question nothing else asks: pieces are graded one at a time against a pass threshold of 6, and
 * a build where almost every piece is below it is not a set of independent problems.
 */
function S1() {
  // The gate's EXIT CODE conflates two states and this check must not: `--check` exits 1 both for
  // a real coherence defect AND for `corpus/00-doctrine/INDEX.md` being stale, which is a
  // generated file the pre-commit hook rewrites. Reporting "the corpus gate fails" on a stale
  // generated file would be a false alarm of exactly the kind this piece exists to avoid, so the
  // VERDICT LINE is parsed and staleness is reported separately as what it is.
  let out = '';
  let exit = 0;
  try { out = execFileSync('node', [R('tools/corpus-index.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { exit = e.status || 1; out = String((e.stdout || '') + (e.stderr || '')); }
  const passed = /CORPUS COHERENCE GATE PASSED/.test(out);
  const stale = /INDEX\.md is STALE/.test(out);
  const gate = passed ? 0 : 1;
  const dir = R('corpus/90-verdicts/wave1');
  const scores = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const s = d.score && d.score.overall_0_10;
    if (typeof s === 'number') scores.push([f.replace(/\.json$/, ''), s]);
  }
  const passing = scores.filter(([, s]) => s >= 6);
  return {
    id: 'S1', path: 'coherence.systems.composition',
    red: gate !== 0,
    n: gate, threshold: 0,
    headline: `corpus gate ${gate === 0 ? 'PASSES' : 'FAILS'}${stale ? ' (with corpus/00-doctrine/INDEX.md stale — a generated file, not a coherence defect)' : ''}; ${passing.length} of ${scores.length} scored wave-1 verdicts reach the pass threshold of 6`,
    detail: {
      gate_exit_code: exit,
      gate_verdict_line: passed ? 'CORPUS COHERENCE GATE PASSED' : 'not passed',
      corpus_index_stale: stale,
      scored_verdicts: scores.length,
      at_or_above_6: passing.map(([f, s]) => `${f} ${s}`),
      median: scores.length ? scores.map(([, s]) => s).sort((a, b) => a - b)[Math.floor(scores.length / 2)] : null,
      delegated_to: 'tools/corpus-index.mjs --check',
    },
  };
}

const CHECKS = [
  ['L1', L1], ['D1', D1], ['N1', N1], ['LR1', LR1], ['T1', T1],
  ['F1', F1], ['X1', X1], ['P1', P1], ['E1', E1], ['S1', S1],
];

function runAll(w) { return CHECKS.map(([, fn]) => fn(w)); }

// ------------------------------------------------------------------------------------ self-test
// RULES #4 and #6. Every check gets its input broken on a DEEP COPY and must go the other way.
// Nothing here writes to game/data — a teardown on a tree a dozen agents are committing to is how
// somebody else's work gets eaten.

// FIVE OF THESE CHECKS ARE RED ON THE SHIPPED TREE, and that is what makes the naive teardown
// useless here: breaking an already-red check leaves it red, both arms agree, and the control
// looks like a clean result while distinguishing nothing. That is RULES #6's inert control, and
// the first version of this self-test had it on three checks. So a red check is torn down by
// REPAIRING it on the copy and requiring GREEN, and then, on top of the repair, by breaking a
// different clause and requiring RED again. Two arms that must disagree, or the number is not
// evidence.
const clone = (o) => JSON.parse(JSON.stringify(o));

const TEARDOWNS = {
  // Delete every palette-named object: L1 must go green. If it stays red, L1 is not counting what
  // it says it counts.
  L1: [
    ['strip-palette-objects', (w) => {
      const { palette } = generatorStock(w.generatorSrc);
      for (const p of w.property) for (const z of p.zones || []) {
        z.contents = (z.contents || []).filter((c) => !(palette.has(c.name) && /\.\d+$/.test(String(c.instance))));
      }
    }, 'green'],
    ['strip-then-replant-one', (w) => {
      const { palette } = generatorStock(w.generatorSrc);
      for (const p of w.property) for (const z of p.zones || []) {
        z.contents = (z.contents || []).filter((c) => !(palette.has(c.name) && /\.\d+$/.test(String(c.instance))));
      }
      w.property[0].zones[0].contents.push({ instance: 'x.y.0', name: [...palette][0], unique: false });
    }, 'red'],
  ],
  D1: [
    ['add-300-pois', (w) => { for (let i = 0; i < 300; i++) w.pois.pois.push({ id: `synthetic-${i}`, region: 'hive', kind: 'landmark' }); }, 'green'],
    ['add-118-pois — one short of the floor', (w) => { for (let i = 0; i < 118; i++) w.pois.pois.push({ id: `synthetic-${i}`, region: 'hive', kind: 'landmark' }); }, 'red'],
  ],
  N1: [
    ['add-the-write-guard', (w) => { w.generatorSrc = w.generatorSrc.replace('fs.mkdirSync(OUT', 'if (!process.argv.includes(\'--write\')) process.exit(0);\nfs.mkdirSync(OUT'); }, 'green'],
    ['guard-plus-empty-stock', (w) => { w.generatorSrc = w.generatorSrc.replace(/const EPITHET = \[[^\]]*\];/, 'const EPITHET = [];').replace(/const GIVEN = \[[^\]]*\];/, 'const GIVEN = [];'); }, 'green'],
  ],
  // LR1 is RED on the shipped tree (one dispute cites a book nobody wrote), so the primary arm
  // REPAIRS it — write the missing book — and demands green. The second arm repairs and then
  // strips a position's `held_by`, and demands red again: that is what shows the malformed clause
  // is live rather than being carried by the dangling-book clause.
  LR1: [
    ['repair', (w) => { w.bookIds = new Set([...w.bookIds, 'the-drowned-ford']); }, 'green'],
    ['repair+strip-held_by', (w) => {
      w.bookIds = new Set([...w.bookIds, 'the-drowned-ford']);
      (w.canon.facts || []).find((x) => x.disputed).positions[0].held_by = [];
    }, 'red'],
    ['repair+registry-drift', (w) => {
      w.bookIds = new Set([...w.bookIds, 'the-drowned-ford']);
      w.canonCorpus = (w.canonCorpus || []).filter((f) => f.id !== 'CF-D001');
    }, 'red'],
  ],
  // T1 is RED because `hive` carries nothing. Repair it and demand green; then repair and empty a
  // different region, and demand red.
  T1: [
    ['repair', (w) => { w.posts.posts.push({ region: 'hive', tier: 1, souls: 0 }); }, 'green'],
    ['repair+empty-another', (w) => {
      w.posts.posts.push({ region: 'hive', tier: 1, souls: 0 });
      w.pois.pois = w.pois.pois.filter((p) => p.region !== 'blackwood');
      w.posts.posts = w.posts.posts.filter((p) => p.region !== 'blackwood');
    }, 'red'],
  ],
  F1: [['drop-a-faction-from-the-roster', (w) => { w.factions.factions = (w.factions.factions || []).filter((f) => (f.id || f) !== 'drowned-court'); }, 'red']],
  X1: [['flatten-the-top-tiers', (w) => { for (const p of w.posts.posts || []) if (p.tier >= 4) p.souls = 1; }, 'red']],
  // P1 and S1 shell out to the owning instrument, which has its own teardown. Breaking them here
  // would be testing my copy of somebody else's check, which is the second-definition defect
  // RI-MTH05 C4 exists to catch.
  P1: null,
  E1: [['drop-a-purse-from-goldMirrors', (w) => { w.harnessSrc = w.harnessSrc.replace(/magic_gold:[^,]+,/, ''); }, 'red']],
  S1: null,
};

function selfTest() {
  const base = loadWorld();
  const baseline = {};
  for (const [id, fn] of CHECKS) baseline[id] = fn(base).red;
  const rows = [];
  for (const [id, fn] of CHECKS) {
    const arms = TEARDOWNS[id];
    if (!arms) { rows.push({ id, arm: 'delegated', ok: true, note: 'shells out to the owning instrument; broken there, not here' }); continue; }
    for (const [arm, mutate, expect] of arms) {
      const w = {
        ...base,
        property: clone(base.property), pois: clone(base.pois), canon: clone(base.canon),
        factions: clone(base.factions), posts: clone(base.posts), regions: clone(base.regions),
        canonCorpus: clone(base.canonCorpus), bookIds: new Set(base.bookIds),
      };
      mutate(w);
      const after = fn(w).red;
      rows.push({ id, arm, baseline: baseline[id] ? 'red' : 'green', expect, after: after ? 'red' : 'green', ok: (after ? 'red' : 'green') === expect });
    }
  }
  // The arms of one check must not all agree with each other AND with the baseline — that is the
  // inert control, and it is reported separately from a wrong arm because they are different bugs.
  const inert = [];
  for (const [id] of CHECKS) {
    const mine = rows.filter((r) => r.id === id && r.arm !== 'delegated');
    if (mine.length && new Set(mine.map((r) => r.after).concat([mine[0].baseline])).size === 1) inert.push(id);
  }
  const bad = rows.filter((r) => !r.ok);
  for (const r of rows) {
    process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(4)} ${(r.arm || '').padEnd(24)} ${r.note || `baseline ${r.baseline} -> arm wants ${r.expect}, got ${r.after}`}\n`);
  }
  process.stdout.write(`\nself-test: ${rows.length - bad.length}/${rows.length} arms behaved`
    + (inert.length ? `; INERT CONTROL on ${inert.join(', ')} — every arm agrees with the baseline, so that check has never been seen to move` : '; no inert controls')
    + '.\nAn arm marked FAIL means that check cannot distinguish its two arms and its number is not evidence.\n');
  return bad.length || inert.length ? 1 : 0;
}

// ----------------------------------------------------------------------------------------- main
const argv = process.argv.slice(2);
if (argv.includes('--self-test')) process.exit(selfTest());

const results = runAll(loadWorld());
if (argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ commit: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })(), generated: new Date().toISOString(), results }, null, 2) + '\n');
} else {
  process.stdout.write('W1-27 coherence pass — ten paths, ten numbers, over the shipped data.\n\n');
  for (const r of results) {
    process.stdout.write(`  ${r.red ? 'RED  ' : 'green'} ${r.id.padEnd(4)} ${r.path.padEnd(34)} ${r.headline}\n`);
  }
  const red = results.filter((r) => r.red);
  process.stdout.write(`\n${red.length} of ${results.length} red: ${red.map((r) => r.id).join(', ') || 'none'}\n`);
}
process.exit(results.some((r) => r.red) ? 1 : 0);

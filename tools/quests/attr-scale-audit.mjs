#!/usr/bin/env node
// attr-scale-audit.mjs — every attribute and skill demand in the quest tree, against the
// ceiling a real character can actually reach, with reserve.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
//
// Quest demands were authored on **Morrowind's 0-100 attribute scale**. This game's attributes do
// not work that way. `game/src/character/derive.js:359` grants **+1 to the governing attribute per
// multiple of 15 crossed in a governing skill**, and nothing else in the shipped build ever adds
// an attribute point (see THE SECOND STREAM, below). So an attribute is worth
//
//     creation value  +  6 per skill that governs it          (15/30/45/60/75/90 = six crossings)
//
// and no more. Measured over the 240 signatures the character builder can actually produce
// (`reports/faction-signature-sweep.json`), PERSONALITY tops out at **18 / 22 / 31** across the
// p10, median and best sheet. A resolution demanding personality 40 is therefore not difficult.
// It is unreachable by construction, by every character the game can create, forever.
//
// Three main-quest endings were rescaled this way in W1-19 round 2 and the defect was then found
// twice more by builders who were looking for something else. **This tool exists so it is found
// once, mechanically, by everybody, before it is authored** — which is the only version of the
// fix that survives the next author.
//
// ---------------------------------------------------------------------------------------------
// THE TWO FAILURES, AND WHY CLAMPING IS NOT THE FIX
// ---------------------------------------------------------------------------------------------
//
// A demand nobody can meet and a demand everybody meets are both defects, and clamping to the
// measured ceiling produces the first one at a margin of zero. W1-19 round 1 clamped nine gates
// to exactly the ceiling and shut Act IV for **11 of 40 signatures** — one point lower and the
// same numbers would have passed. So every band below carries a **reserve**, and the reserve is
// the point of the tool rather than a decoration on it.
//
//   vacuous        need <= at_creation.min          every one of the 240 sheets has this already
//   anyone         need <= at_creation.p10          90% have it at creation, no investment
//   specialist     need <= ceiling(p10)    - RESERVE  a bottom-decile sheet that maxes the governors
//   dedicated      need <= ceiling(median) - RESERVE  a median sheet that maxes the governors
//   ---- everything past here is a defect ----
//   no_reserve     need <= ceiling(median)          reachable with a margin of zero. THE W1-19 R1 BUG.
//   max_only       need <= ceiling(max)             one sheet in 240, and only if it maxes the governors
//   unreachable    need >  ceiling(max)             no character the game can create
//
// RESERVE = 2 is not arbitrary: it is what the three landed fixes used (Q-MAIN-08 personality 17
// against a p10 ceiling of 18; Q-MAIN-13 willpower 20 against 22; Q-MAIN-23 personality 20
// against a median ceiling of 22), and it is one more than the margin that failed.
//
// ---------------------------------------------------------------------------------------------
// THE SECOND STREAM — READ THIS BEFORE YOU TRUST A CEILING
// ---------------------------------------------------------------------------------------------
//
// RI-PRG02 §2 specifies TWO streams of attribute points: **bought** (one per level, ~81 over a
// first clear) and **earned** (+1 per multiple of 15 in a governing skill, ~27). The bought stream
// is implemented — `engine.js _spendSouls()` adds +1 to any attribute per level — and it is
// **dead**, because nothing in `game/src/**` ever adds to `soulsHeld` except `sim/death.js:589`
// recovering a bloodstain you already paid for. No kill, no quest, no loot awards souls.
// `soulsHeld` starts at 0 and `soulsToNextLevel()` can never be paid.
//
// So the ceilings this tool checks against are the ceilings of a game with half its progression
// missing, and they are correct **today** for a contingent reason rather than a structural one.
// This is why the bands are computed from the sweep at run time and not written down anywhere:
// the day somebody wires kill-souls, the sweep moves, these bands move with it, and this same
// tool starts reporting the demands as `vacuous` instead of `unreachable`. One instrument, both
// directions. Hard-coding a rescaled number into every quest file would have been silently wrong
// on that day and nobody would have known.
//
// ---------------------------------------------------------------------------------------------
// Run:  node tools/quests/attr-scale-audit.mjs [--sheet p10|median|max] [--json] [--all]
//       node tools/quests/attr-scale-audit.mjs --self-test
// Exit: 0 clean, 1 defects found, 2 the instrument could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);

export const RESERVE = 2;
/** RI-PRG02 §2 / character/derive.js:359 — 15/30/45/60/75/90 is six crossings to the skill cap. */
export const POINTS_PER_SKILL = 6;
/** ARBITRATION.md: the corpus sets a >=45% non-combat resolution bar. */
export const NON_COMBAT_BAR = 0.45;

// ---------------------------------------------------------------------------------------------
// The bands, computed from a measured sweep. Nothing here is a written-down number.
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} perAttribute  sweep.per_attribute — {at_creation:{min,p10,median,max}, reachable_ceiling:{from_p10,from_median,from_max}}
 * @returns {(a:string, need:number) => {band:string, defect:boolean, caps:object}}
 */
export function attributeClassifier(perAttribute) {
  return function classify(a, need) {
    const c = perAttribute[a];
    if (!c) return { band: 'no_such_attribute', defect: true, caps: null };
    const cap = {
      vacuous: c.at_creation.min,
      anyone: c.at_creation.p10,
      specialist: c.reachable_ceiling.from_p10 - RESERVE,
      dedicated: c.reachable_ceiling.from_median - RESERVE,
      no_reserve: c.reachable_ceiling.from_median,
      max_only: c.reachable_ceiling.from_max,
    };
    for (const band of ['vacuous', 'anyone', 'specialist', 'dedicated', 'no_reserve', 'max_only']) {
      if (need <= cap[band]) {
        return { band, defect: band === 'no_reserve' || band === 'max_only', caps: cap };
      }
    }
    return { band: 'unreachable', defect: true, caps: cap };
  };
}

/**
 * Skill demands. A skill runs to its cap by use, so the failure modes are different: a key that
 * is not in the register (which reads 0/45 forever and can never move), a demand past the cap,
 * and a demand at or under the value every character starts with.
 *
 * A vacuous skill demand is only a DEFECT when it is the resolution's sole requirement. Seven of
 * the magic-utility routes declare `{skill: 0}` beside a real `spell_effects` requirement, and
 * that is a deliberate tier-0 marker, not a decorative gate — the spell is the gate.
 */
export function skillClassifier(register, baseValue, cap) {
  const ids = new Set(register);
  return function classify(s, need, resolutionHasOtherRequirement) {
    if (!ids.has(s)) {
      const near = [...ids].find((x) => x.replace(/[-_\s]/g, '') === String(s).replace(/[-_\s]/g, ''));
      return { band: 'no_such_skill', defect: true, near: near || null };
    }
    if (need > cap) return { band: 'above_cap', defect: true, near: null };
    if (need <= baseValue) return { band: 'vacuous', defect: !resolutionHasOtherRequirement, near: null };
    return { band: 'reachable', defect: false, near: null };
  };
}

// ---------------------------------------------------------------------------------------------
// Walking the tree
// ---------------------------------------------------------------------------------------------

const NON_STAT_REQUIREMENT_KEYS = ['items', 'knowledge', 'spell_effects', 'disposition', 'gold', 'faction_rank'];

/** Every demand in one quest book, flat. Exported so --self-test can feed it a synthetic book. */
export function demandsOf(book) {
  const out = [];
  for (const { file, quest: q } of book) {
    for (const r of q.resolutions || []) {
      const req = r.requires || {};
      const others = NON_STAT_REQUIREMENT_KEYS.some((k) => {
        const v = req[k];
        return Array.isArray(v) ? v.length > 0 : v != null;
      }) || (r.requires_knowing || []).length > 0;
      for (const [key, need] of Object.entries(req.attributes || {})) {
        out.push({ file, quest: q.id, resolution: r.id, kind: 'attribute', key, need, violence: r.violence_required === true, others });
      }
      for (const [key, need] of Object.entries(req.skills || {})) {
        out.push({ file, quest: q.id, resolution: r.id, kind: 'skill', key, need, violence: r.violence_required === true, others });
      }
    }
  }
  return out;
}

/**
 * The audit. Pure — takes the book and the measured sweep, returns the report.
 * @param {Array<{file:string, quest:object}>} book
 * @param {object} sweep      reports/faction-signature-sweep.json
 * @param {object} skillsDoc  game/data/progression/skills.json
 * @param {string} sheet      'p10' | 'median' | 'max'
 */
export function audit(book, sweep, skillsDoc, sheet = 'p10') {
  const classA = attributeClassifier(sweep.per_attribute);
  const register = (skillsDoc.skills || []).map((s) => s.id);
  const classS = skillClassifier(register, skillsDoc.base_value ?? 5, skillsDoc.cap ?? 100);
  const ceilKey = sheet === 'median' ? 'from_median' : sheet === 'max' ? 'from_max' : 'from_p10';

  const demands = demandsOf(book).map((d) => {
    const c = d.kind === 'attribute' ? classA(d.key, d.need) : classS(d.key, d.need, d.others);
    return { ...d, band: c.band, defect: c.defect, caps: c.caps || null, near: c.near || null };
  });

  // Reachability of each resolution ON THE CHOSEN SHEET. Distinct from the band: a demand can be
  // in-band and still out of reach for a bottom-decile character, which is a build you did not
  // take rather than a defect. Only "no reachable ending at all" is a dead end.
  const attainable = (d) => {
    if (d.kind === 'attribute') {
      const c = sweep.per_attribute[d.key];
      return !!c && d.need <= c.reachable_ceiling[ceilKey];
    }
    return register.includes(d.key) && d.need <= (skillsDoc.cap ?? 100);
  };
  const byResolution = new Map();
  for (const d of demands) {
    const k = `${d.quest}::${d.resolution}`;
    if (!byResolution.has(k)) byResolution.set(k, []);
    byResolution.get(k).push(d);
  }

  const quests = [];
  for (const { file, quest: q } of book) {
    const rs = q.resolutions || [];
    if (!rs.length) continue;
    const rows = rs.map((r) => {
      const ds = byResolution.get(`${q.id}::${r.id}`) || [];
      const blocked = ds.filter((d) => !attainable(d));
      return { id: r.id, violence: r.violence_required === true, reachable: blocked.length === 0, blocked };
    });
    const reachable = rows.filter((r) => r.reachable);
    quests.push({
      file, id: q.id, resolutions: rows,
      any_reachable: reachable.length > 0,
      nonviolent_reachable: reachable.some((r) => !r.violence),
      has_nonviolent_authored: rows.some((r) => !r.violence),
    });
  }

  // ---- the LADDER ---------------------------------------------------------------------------
  //
  // The bands say what is reachable. They do not say the demands are ordered, and the two are
  // different failures. A faction line's rank-8 ending should be its hardest social check; if a
  // rank-6 quest asks more personality than the rank-8 one, the line reads as noise even though
  // every rung is individually legal. This matters most right after a rescale, because the way
  // a ladder gets flattened is somebody clamping the top three rungs to the cap and leaving the
  // bottom ones alone — which is exactly what the naive fix to this defect produces.
  //
  // Scope: quest ids of the form Q-XXXX-<n> for n in 0..8, which is the rank ladder RI-QST03 §B
  // defines. Quests numbered above 8 are outside the ladder and are not ordered against it.
  const rung = new Map();                    // "LINE|attribute" -> {n: maxDemand}
  for (const d of demands.filter((x) => x.kind === 'attribute')) {
    const m = /^(Q-[A-Z]+)-(\d+)$/.exec(d.quest);
    if (!m || Number(m[2]) > 8) continue;
    const k = `${m[1]}|${d.key}`;
    if (!rung.has(k)) rung.set(k, {});
    const row = rung.get(k), n = Number(m[2]);
    row[n] = Math.max(row[n] || 0, d.need);
  }
  const ladders = [];
  for (const [k, row] of rung) {
    const ns = Object.keys(row).map(Number).sort((a, b) => a - b);
    const inversions = [];
    for (let i = 1; i < ns.length; i++) if (row[ns[i]] < row[ns[i - 1]]) inversions.push(`rank ${ns[i - 1]} asks ${row[ns[i - 1]]} but rank ${ns[i]} asks only ${row[ns[i]]}`);
    const [line, attribute] = k.split('|');
    ladders.push({ line, attribute, rungs: ns.map((n) => [n, row[n]]), inversions, monotone: inversions.length === 0 });
  }

  const defects = demands.filter((d) => d.defect);
  const withNV = quests.filter((q) => q.nonviolent_reachable).length;
  const authoredNV = quests.filter((q) => q.has_nonviolent_authored).length;

  // THE QUEST-LEVEL RATE IS THE INSENSITIVE ONE AND MUST NOT BE REPORTED ALONE. Most quests here
  // carry four or five endings, so a quest keeps its "has a non-violent exit" tick until the LAST
  // talk route is shut. Q-BLAK-01 has three non-violent routes of which two are permanently shut
  // — one by an unreachable personality demand, one by a skill id that does not exist — and the
  // quest-level number does not move at all, because the third is a sneak route. The player has
  // lost every route that involves speaking to anybody and the headline says 98.9%.
  //
  // So the resolution-level rate is reported beside it: of every non-violent ending an author
  // actually wrote, how many can be taken. That is the number an unreachable gate moves.
  const nvRes = [];
  for (const q of quests) for (const r of q.resolutions) if (!r.violence) nvRes.push({ quest: q.id, ...r });
  const nvShut = nvRes.filter((r) => !r.reachable);

  return {
    tool: 'attr-scale-audit', sheet, reserve: RESERVE,
    counts: {
      quests: quests.length, resolutions: byResolution.size,
      attribute_demands: demands.filter((d) => d.kind === 'attribute').length,
      skill_demands: demands.filter((d) => d.kind === 'skill').length,
      defects: defects.length,
    },
    non_combat: {
      bar: NON_COMBAT_BAR,
      quests_with_a_nonviolent_resolution_authored: authoredNV,
      quests_with_a_nonviolent_resolution_REACHABLE: withNV,
      fraction: quests.length ? +(withNV / quests.length).toFixed(4) : 0,
      meets_bar: quests.length ? withNV / quests.length >= NON_COMBAT_BAR : false,
      shut_by_an_unreachable_gate: authoredNV - withNV,
      // the sensitive one
      nonviolent_resolutions_authored: nvRes.length,
      nonviolent_resolutions_reachable: nvRes.length - nvShut.length,
      nonviolent_resolution_fraction: nvRes.length ? +((nvRes.length - nvShut.length) / nvRes.length).toFixed(4) : 0,
      // Split, because the two are not the same failure. A route shut by a DEFECT is shut for
      // every character forever. A route shut because it sits above a bottom-decile sheet's
      // ceiling but inside a legal band is a build the player did not take, which is the design
      // working. Only the first number is a bug, and reporting them together hides it.
      nonviolent_resolutions_shut_by_defect: nvShut.filter((r) => r.blocked.some((b) => b.defect)).length,
      nonviolent_resolutions_shut: nvShut.map((r) => `${r.quest} ${r.id}: ` +
        r.blocked.map((b) => `${b.key} ${b.need} (${b.band}${b.defect ? ', DEFECT' : ''})`).join(', ')),
    },
    ladders,
    ladder_inversions: ladders.filter((l) => !l.monotone).length,
    dead_ends: quests.filter((q) => !q.any_reachable).map((q) => q.id),
    violence_only: quests.filter((q) => q.any_reachable && q.has_nonviolent_authored && !q.nonviolent_reachable).map((q) => q.id),
    defects, demands, quests,
  };
}

// ---------------------------------------------------------------------------------------------
// Loading the real thing
// ---------------------------------------------------------------------------------------------

export function loadBook(dir) {
  const book = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const q of (Array.isArray(doc) ? doc : doc.quests || [])) if (q && q.id) book.push({ file: f, quest: q });
  }
  return book;
}

// ---------------------------------------------------------------------------------------------
// --self-test. A probe that cannot fail is worse than no probe (AGENT-PROTOCOL, failure mode 2),
// so each rule is fed a book that violates exactly that rule and nothing else, and must go red.
// The last case is the control: a clean book must stay clean, or every "red" above is vacuous.
// ---------------------------------------------------------------------------------------------

function selfTest() {
  // A synthetic sweep with round numbers, so the expected bands are arithmetic and not a lookup.
  // personality: creation min 3 / p10 6 / median 10; 2 governing skills => ceilings 18 / 22 / 31.
  const sweep = {
    per_attribute: {
      personality: { at_creation: { min: 3, p10: 6, median: 10, max: 19 }, skills_that_raise_it: 2,
        reachable_ceiling: { from_p10: 18, from_median: 22, from_max: 31 } },
    },
  };
  const skillsDoc = { base_value: 5, cap: 100, skills: [{ id: 'speechcraft' }, { id: 'root-speech' }] };
  const q = (id, resolutions) => [{ file: 'synthetic.json', quest: { id, resolutions } }];
  const run = (book) => audit(book, sweep, skillsDoc, 'p10');
  const bandOf = (book) => run(book).demands[0].band;

  const cases = [
    // Each of these asserts the BAND *and* the defect verdict. Asserting only the band leaves the
    // suite green when someone flips `defect` to false, which is the mutation that would ship the
    // whole class silently — found by mutating this file on purpose and watching it stay green.
    ['a Morrowind-scale demand is unreachable AND is a defect',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 40 } } }])).demands[0];
        return d.band === 'unreachable' && d.defect === true; }],
    ['an unreachable demand is counted in defects and in dead_ends, not merely labelled',
      () => { const r = run(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 40 } } }]));
        return r.defects.length === 1 && r.counts.defects === 1; }],
    ['a demand only the best of 240 sheets reaches is max_only AND is a defect',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 28 } } }])).demands[0];
        return d.band === 'max_only' && d.defect === true; }],
    ['THE ZERO-MARGIN BUG: a demand clamped to the median ceiling has no reserve',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 22 } } }])).demands[0];
        return d.band === 'no_reserve' && d.defect === true; }],
    ['one point of reserve is still not enough',
      () => bandOf(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 21 } } }])) === 'no_reserve'],
    ['two points of reserve passes as dedicated',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 20 } } }])).demands[0];
        return d.band === 'dedicated' && d.defect === false; }],
    ['a specialist demand sits under the p10 ceiling with reserve',
      () => bandOf(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 16 } } }])) === 'specialist'],
    ['a demand every sheet has at creation is vacuous',
      () => bandOf(q('Q-T', [{ id: 'r', requires: { attributes: { personality: 3 } } }])) === 'vacuous'],
    ['an attribute that is not on the sheet is a defect',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { attributes: { charisma: 10 } } }])).demands[0];
        return d.band === 'no_such_attribute' && d.defect === true; }],

    ['a skill id that does not exist is a defect',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { skills: { scribing: 40 } } }])).demands[0];
        return d.band === 'no_such_skill' && d.defect === true && d.near === null; }],
    ['THE UNDERSCORE BUG: root_speech is caught and the real id is named',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { skills: { root_speech: 45 } } }])).demands[0];
        return d.band === 'no_such_skill' && d.near === 'root-speech'; }],
    ['a skill demand past the cap is a defect',
      () => run(q('Q-T', [{ id: 'r', requires: { skills: { speechcraft: 140 } } }])).demands[0].defect === true],
    ['a bare skill: 0 with nothing else is a decorative gate',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { skills: { speechcraft: 0 } } }])).demands[0];
        return d.band === 'vacuous' && d.defect === true; }],
    ['skill: 0 beside a real spell_effects requirement is a tier marker, not a defect',
      () => { const d = run(q('Q-T', [{ id: 'r', requires: { skills: { speechcraft: 0 }, spell_effects: ['charm'] } }])).demands[0];
        return d.band === 'vacuous' && d.defect === false; }],

    ['a quest whose every ending is out of reach is a dead end',
      () => run(q('Q-T', [{ id: 'r', violence_required: false, requires: { attributes: { personality: 40 } } }])).dead_ends.length === 1],
    ['an unreachable talk gate converts a talkable quest into a violent one',
      () => { const r = run(q('Q-T', [
          { id: 'talk', violence_required: false, requires: { attributes: { personality: 40 } } },
          { id: 'kill', violence_required: true, requires: {} }]));
        return r.violence_only.length === 1 && r.non_combat.shut_by_an_unreachable_gate === 1; }],
    ['the non-combat fraction falls when a talk gate is out of reach',
      () => { const shut = run(q('Q-T', [
          { id: 'talk', violence_required: false, requires: { attributes: { personality: 40 } } },
          { id: 'kill', violence_required: true, requires: {} }])).non_combat.fraction;
        const open = run(q('Q-T', [
          { id: 'talk', violence_required: false, requires: { attributes: { personality: 16 } } },
          { id: 'kill', violence_required: true, requires: {} }])).non_combat.fraction;
        return shut === 0 && open === 1; }],

    ['a flattened ladder is caught: rank 6 asking more than rank 8',
      () => { const r = audit([
          { file: 's.json', quest: { id: 'Q-AAA-6', resolutions: [{ id: 'a', requires: { attributes: { personality: 20 } } }] } },
          { file: 's.json', quest: { id: 'Q-AAA-8', resolutions: [{ id: 'b', requires: { attributes: { personality: 16 } } }] } },
        ], sweep, skillsDoc, 'p10');
        return r.ladder_inversions === 1; }],
    ['a monotone ladder is not flagged',
      () => { const r = audit([
          { file: 's.json', quest: { id: 'Q-AAA-6', resolutions: [{ id: 'a', requires: { attributes: { personality: 17 } } }] } },
          { file: 's.json', quest: { id: 'Q-AAA-8', resolutions: [{ id: 'b', requires: { attributes: { personality: 20 } } }] } },
        ], sweep, skillsDoc, 'p10');
        return r.ladder_inversions === 0; }],
    ['quests numbered above the 8-rank ladder are not ordered against it',
      () => { const r = audit([
          { file: 's.json', quest: { id: 'Q-AAA-8', resolutions: [{ id: 'a', requires: { attributes: { personality: 20 } } }] } },
          { file: 's.json', quest: { id: 'Q-AAA-13', resolutions: [{ id: 'b', requires: { attributes: { personality: 16 } } }] } },
        ], sweep, skillsDoc, 'p10');
        return r.ladder_inversions === 0; }],
    ['CONTROL: a clean book reports no defects and no dead ends',
      () => { const r = run(q('Q-T', [
          { id: 'talk', violence_required: false, requires: { attributes: { personality: 16 }, skills: { speechcraft: 40 } } },
          { id: 'kill', violence_required: true, requires: {} }]));
        return r.defects.length === 0 && r.dead_ends.length === 0 && r.violence_only.length === 0; }],
  ];

  let bad = 0;
  for (const [name, run_] of cases) {
    let ok = false, err = null;
    try { ok = run_() === true; } catch (e) { err = e.message; }
    if (!ok) { console.error(`  FAIL  ${name}${err ? ` — threw: ${err}` : ''}`); bad++; }
    else if (has('verbose')) console.log(`  ok    ${name}`);
  }
  console.log(`attr-scale-audit --self-test: ${cases.length - bad}/${cases.length} rules go red on their own violation.`);
  return bad;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('attr-scale-audit.mjs')) {
  if (has('self-test')) process.exit(selfTest() ? 1 : 0);

  const sweepPath = path.join(ROOT, 'reports/faction-signature-sweep.json');
  if (!fs.existsSync(sweepPath)) {
    console.error(`attr-scale-audit: ${sweepPath} does not exist — this tool has no ceilings without a measured sweep.`);
    console.error('Run: node tools/quests/faction-signature-sweep.mjs --out reports/faction-signature-sweep.json');
    process.exit(2);
  }
  const sweep = JSON.parse(fs.readFileSync(sweepPath, 'utf8'));
  if (!sweep.per_attribute) { console.error('attr-scale-audit: the sweep has no per_attribute block — re-run it with the current tool.'); process.exit(2); }
  const skillsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/skills.json'), 'utf8'));
  const book = loadBook(path.join(ROOT, 'game/data/quests'));
  const sheet = String(arg('sheet', 'p10'));
  const rep = audit(book, sweep, skillsDoc, sheet);

  if (has('json')) { console.log(JSON.stringify(rep, null, 2)); process.exit(rep.defects.length ? 1 : 0); }

  console.log(`attr-scale-audit: ${rep.counts.quests} quests, ${rep.counts.resolutions} resolutions, ` +
    `${rep.counts.attribute_demands} attribute demands, ${rep.counts.skill_demands} skill demands. ` +
    `Reachability sheet: ${sheet}. Reserve: ${RESERVE}.`);

  console.log('\nThe scale every demand is judged against (measured, 240 signatures):');
  console.log('  attribute     creation p10   governors   ceiling p10/med/max   specialist  dedicated (HARD CAP)');
  for (const [a, c] of Object.entries(sweep.per_attribute)) {
    const rc = c.reachable_ceiling;
    console.log(`  ${a.padEnd(13)} ${String(c.at_creation.p10).padStart(3)}          ${String(c.skills_that_raise_it).padStart(2)}` +
      `          ${String(rc.from_p10).padStart(3)}/${String(rc.from_median).padStart(3)}/${String(rc.from_max).padStart(3)}` +
      `           ${String(rc.from_p10 - RESERVE).padStart(4)}       ${String(rc.from_median - RESERVE).padStart(4)}`);
  }

  if (rep.defects.length) {
    console.log(`\n${rep.defects.length} DEFECT(S):`);
    for (const d of rep.defects.sort((x, y) => y.need - x.need)) {
      const extra = d.kind === 'attribute'
        ? `ceiling ${d.caps.no_reserve} median / ${d.caps.max_only} best-of-240; hard cap ${d.caps.dedicated}`
        : d.near ? `did you mean '${d.near}'?` : 'no skill of that name exists in progression/skills.json';
      console.log(`  [${d.band.padEnd(18)}] ${d.file} ${d.quest} ${d.resolution}: ${d.key} ${d.need} — ${extra}`);
    }
  } else {
    console.log('\nNo defects: every demand is inside a band a real character can reach, with reserve.');
  }

  if (has('all')) {
    console.log('\nEvery demand, by band:');
    const order = ['unreachable', 'max_only', 'no_reserve', 'no_such_skill', 'no_such_attribute', 'above_cap', 'dedicated', 'specialist', 'anyone', 'vacuous', 'reachable'];
    for (const b of order) {
      const rows = rep.demands.filter((d) => d.band === b);
      if (!rows.length) continue;
      console.log(`  -- ${b} (${rows.length})`);
      for (const d of rows.sort((x, y) => y.need - x.need)) console.log(`     ${d.quest} ${d.resolution}: ${d.key} ${d.need}`);
    }
  }

  console.log(`\nThe rank ladders (a line's rank-8 ending must be its hardest check; ranks 0-8 only):`);
  for (const l of rep.ladders.sort((a, b) => (a.line + a.attribute).localeCompare(b.line + b.attribute))) {
    console.log(`  ${l.monotone ? 'ok      ' : 'INVERTED'} ${(l.line + ' ' + l.attribute).padEnd(24)}` +
      l.rungs.map(([n, v]) => `${n}:${v}`).join(' ') + (l.inversions.length ? `   << ${l.inversions.join('; ')}` : ''));
  }

  const nc = rep.non_combat;
  console.log('\nThe non-violent floor (ARBITRATION.md: a fight with a person must have a non-lethal exit; corpus bar >=45%):');
  console.log(`  quests with a non-violent resolution AUTHORED   ${nc.quests_with_a_nonviolent_resolution_authored}/${rep.counts.quests}`);
  console.log(`  quests with a non-violent resolution REACHABLE  ${nc.quests_with_a_nonviolent_resolution_REACHABLE}/${rep.counts.quests}  = ${(nc.fraction * 100).toFixed(1)}%  ${nc.meets_bar ? 'MEETS the 45% bar' : 'BELOW the 45% bar'}`);
  console.log(`  talkable quests silently converted to violent ones by an unreachable gate: ${nc.shut_by_an_unreachable_gate}` +
    (rep.violence_only.length ? ` (${rep.violence_only.join(', ')})` : ''));
  console.log(`\n  and the number the quest-level rate cannot see —`);
  console.log(`  non-violent RESOLUTIONS authored    ${nc.nonviolent_resolutions_authored}`);
  console.log(`  non-violent RESOLUTIONS reachable   ${nc.nonviolent_resolutions_reachable}  = ${(nc.nonviolent_resolution_fraction * 100).toFixed(1)}% of what was written`);
  if (nc.nonviolent_resolutions_shut.length) {
    console.log(`  of those, shut by a DEFECT (shut for every character, forever): ${nc.nonviolent_resolutions_shut_by_defect}`);
    console.log(`  SHUT (${nc.nonviolent_resolutions_shut.length}) — a route an author wrote and this sheet cannot take:`);
    for (const s of nc.nonviolent_resolutions_shut) console.log(`     ${s}`);
  }
  if (rep.dead_ends.length) console.log(`  DEAD ENDS — no reachable ending at all on a ${sheet} sheet: ${rep.dead_ends.join(', ')}`);

  process.exit(rep.defects.length ? 1 : 0);
}

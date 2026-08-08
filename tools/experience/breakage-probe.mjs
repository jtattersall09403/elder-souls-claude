#!/usr/bin/env node
// breakage-probe.mjs — RI-EXP06 Steps 1 and 2: the register, run, and diffed against its own past.
//
//   node tools/experience/breakage-probe.mjs \
//     --probes corpus/95-experience/RI-EXP06.probes.json \
//     --out reports/experience/w1/breakage-register.json
//   node tools/experience/breakage-probe.mjs --baseline reports/experience/breakage-register-baseline.json
//
// "Probes are ASSERTIONS THAT THE BREAKAGE SUCCEEDS — the inverse of every other test in the
// project." And Step 2 is the teeth: the previous wave's register is loaded and diffed, and a
// `pass -> fail` with no strike recorded is a `REGRESSION`, which is hard fail 4 and makes the
// wave DEAD. "A sanctioned breakage stopped working and nobody struck it ... a silent regression
// is indistinguishable from a design decision after one wave and impossible to reconstruct after
// two."
//
// WHAT THIS TOOL ACTUALLY MEASURES, STATED PLAINLY (RULES #26).
//
// The item's Step 1 wants each probe run as a live harness scenario that PERFORMS the breakage.
// Most of the fifteen cannot be performed on this build, because the systems are not there:
// there is no alchemy brewing loop, no enchanting bench, no merchant container to rob. Writing
// fifteen browser scenarios that all report "the verb does not exist" would be fifteen absence
// reports wearing a probe's clothes.
//
// So each entry is measured on TWO axes and both are reported separately, never merged:
//
//   SUBSTRATE   is the machinery this breakage needs present at all? (`absent` => the entry is
//               `unmeasurable ⇒ 0` and listed, exactly as the item requires)
//   CLOSURE     is the specific mechanism the entry's own "Red if" clause names — a magnitude
//               cap, an `essential` flag, an `is_quest_item` sell block, a de-aggro-at-the-town-
//               boundary rule, an unreachable-player enrage — PRESENT in the tree?
//
// A `live` verdict here means "the substrate exists and nothing that would close it is in the
// tree". That is **strictly weaker than "the breakage was performed"**, it is marked
// `evidence: "static_absence_of_closure"` on every row, and a critic should read it as a
// regression detector rather than as a demonstration. It is, however, exactly the thing the item
// says the register is for: "a test that goes red the day somebody quietly closes it."
//
// SELF-TEST (RULES #4). Each closure detector is run through the sabotage facility with the
// closing mechanism INJECTED into a copy of the tree, and must go red. A detector whose pattern
// matches nothing either way is an assertion that cannot fail, and is reported as such rather
// than counted as a pass.
//
// EXIT: 0 all bars met · 2 a REGRESSION (hard fail 4) · 3 fewer than 12 live entries ·
//       4 probes_run < 0.80 · 5 self-test failed · 6 the probes artifact is absent.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT } from './lib/sabotage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// THE DETECTOR TABLE. One row per register entry. `substrate` is what has to exist for the
// breakage to be possible; `closure` is the entry's own "Red if" clause turned into something a
// machine can look for. Both are quoted from RI-EXP06 §B in the `from` field so a reader can
// check the translation rather than the regex.

const D = (id, from, substrate, closure) => ({ id, from, substrate, closure });

const DETECTORS = [
  D('B-01', 'Red the moment a magnitude cap, a diminishing-returns curve or a self-stacking prohibition is added',
    [{ what: 'an alchemy / brewing surface', re: /\balchem|\bbrew/i }],
    [{ what: 'a magnitude cap or self-stacking prohibition on potions', re: /cannot_brew_while|no_self_stack|potion_magnitude_cap|diminishing[_ ]returns|max_stacked_potions/i }]),
  D('B-02', 'Red if a "sustained skill" check, a base-skill-only evaluation, or a rank rollback is added',
    [{ what: 'fortify_skill, and a rank ladder with skill thresholds', re: /fortify_skill/i }, { what: 'faction rank thresholds', re: /skill_min|rank_gate|faction-gates/i }],
    [{ what: 'a base-skill-only rank evaluation or a rank rollback', re: /base_skill_only|sustained_skill|rank_rollback|revoke_rank_on_expiry/i }]),
  D('B-03', 'Red if a height clamp or an exterior blocking volume appears',
    [{ what: 'a levitate effect', re: /\blevitate\b/i }],
    [{ what: 'a levitation height clamp or an exterior blocking volume', re: /levitat\w*[_ ]?(height[_ ])?clamp|max_levitate_height|exterior_block(ing)?_volume|invisible_ceiling/i }]),
  D('B-04', 'Red if any soft wall, level gate or difficulty warning is added to that route',
    [{ what: 'a region tier ladder', re: /"tier"\s*:\s*[1-5]|region_tier|tier_[1-5]/i }],
    [{ what: 'a level gate or "you are not strong enough" refusal on a route', re: /not_strong_enough|level_required|min_player_level|are not strong enough|soft_wall/i }]),
  D('B-05', 'Red if the NPC becomes unkillable/essential, if a game-over fires, or if the quest silently reassigns to a substitute NPC',
    [{ what: 'a main quest with a named informant and a backpath', re: /mainline-backpath|severance|thread of prophecy/i }],
    [{ what: 'an essential/unkillable NPC flag, or a game-over on an NPC death', re: /"essential"\s*:\s*true|unkillable|cannot_be_killed|game_over_on_death|protected_npc/i }]),
  D('B-06', 'Red if merchant inventories become virtual, if the gold pool is untakeable, or if merchants respawn',
    [{ what: 'merchant services and a gold pool', re: /"services"|merchant_gold|gold_pool/i }],
    [{ what: 'virtual merchant inventories, an untakeable gold pool, or merchant respawn', re: /virtual_inventory|merchant_respawn|gold_pool_untakeable|respawn_merchants/i }]),
  D('B-07', 'Red if the magnitude is clamped, if velocity is capped, or if the scrolls are removed for being dangerous',
    [{ what: 'the Scrolls of the Drowned Step (RI-EXP01 B09)', re: /drowned[_ -]step|fortify[_ ]athletics/i }],
    [{ what: 'an athletics magnitude clamp or a velocity cap', re: /athletics_clamp|max_athletics|velocity_cap|clamp_fortify/i }]),
  D('B-08', 'assert no per-day, per-rest or per-session cap fires  (CONDITIONAL — corpus/25-magic/ ruling)',
    [{ what: 'soul gems and an enchanting surface', re: /soul_gem|soul_trap/i }, { what: 'enchanting', re: /enchant/i }],
    [{ what: 'a per-day / per-rest / per-session enchanting cap', re: /enchant\w*_per_(day|rest|session)|max_enchants_per/i }]),
  D('B-09', 'the clamp is on arbitrage ratios, not on the disposition-price curve',
    [{ what: 'a disposition-to-price curve', re: /disposition[\s\S]{0,80}price|price[\s\S]{0,80}disposition/i }],
    [{ what: 'a clamp on the disposition-price curve itself', re: /disposition_price_clamp|max_disposition_discount|price_curve_cap/i }]),
  D('B-10', 'Red if bosses become parley-exempt, if the boss despawns, or if souls are awarded anyway',
    [
      { what: 'a parley verb on bodies that can speak', re: /\bparley\b/i },
      {
        // B-10's probe is "enter the arena ... invoke parley ... assert the boss entity persists
        // in a later session". There has to BE a boss. The shipped roster has tiers trash, prop
        // and elite and nothing at boss tier, so this half of the substrate is absent and the
        // entry is `unmeasurable => 0` rather than passing on the elite that does have a parley.
        what: 'an enemy at boss tier for the parley to end',
        data: (files) => {
          const out = [];
          for (const f of files) {
            if (!/^game\/data\/combat\/enemies\/.*\.json$/.test(f.rel)) continue;
            let j; try { j = JSON.parse(f.text); } catch { continue; }
            if (/^boss$/i.test(String(j.tier || ''))) out.push({ file: f.rel, line: null, text: `${j.id}: tier ${j.tier}` });
          }
          return out;
        },
      },
    ],
    [{
      what: 'a NAMED, FACTIONED, HUMANOID boss with no parley path (S13 calls that a DEFECT), ' +
        'or souls awarded on a parley',
      data: (files, inject) => {
        const out = [];
        for (const f of files) {
          if (!/^game\/data\/combat\/enemies\/.*\.json$/.test(f.rel)) continue;
          let j; try { j = JSON.parse(f.text); } catch { continue; }
          const arch = String(j.archetype || '').toUpperCase();
          if (arch === 'DUMMY' || arch === 'FIXTURE' || arch === 'BEAST') continue;  // fixtures, and S13's own exemption
          // TIER, not the id. The first version keyed `boss` off a regex over the id and matched
          // `drowned_greater` on the letters "great" — a tier-`trash` Deep-Drowned reported as a
          // boss with no parley path. The statblock carries `tier`; use it.
          const tier = String(j.tier || '').toLowerCase();
          if (tier !== 'boss' && tier !== 'elite') continue;
          const p = j.parley;
          const speaks = p && typeof p === 'object' && (p.npc_id || p.true_name_topic || p.faction);
          if (!speaks) out.push({ file: f.rel, line: null, text: `${j.id}: archetype ${j.archetype}, parley ${JSON.stringify(p)}` });
        }
        if (inject && /parley/i.test(inject.text)) out.push({ file: inject.rel, line: 1, text: inject.text });
        return out;
      },
    }]),
  D('B-11', 'Red if hostiles de-aggro on entering a settlement volume, if NPCs become non-combatant to each other, or if a "no monsters in town" despawn rule appears',
    [{ what: 'a leash rule (RI-AI01)', re: /\bleash\b/i }],
    [{ what: 'a settlement de-aggro or no-monsters-in-town despawn rule', re: /deaggro_in_settlement|no_monsters_in_town|despawn_in_settlement|settlement_safe_volume/i }]),
  D('B-12', 'Red the day an `is_quest_item` sell-block is added',
    [{ what: 'an inventory with sellable items', re: /"gold_price"|"sell"|barter/i }],
    [{
      what: 'an is_quest_item sell block',
      re: /is_quest_item|quest_item_locked|cannot_sell_quest|quest_items?_unsellable/i,
      benign: [
        { re: /soul[_ ]?gem|filled gems|SG-3/i, why: 'the soul-gem economy\'s own unsellable rule (SG-3), which is not a quest-item sell block' },
      ],
    }]),
  D('B-13', 'Red if a "quest locks cannot be opened by magic" exception list appears',
    [{ what: 'an open_lock effect and tiered locks', re: /open_lock/i }],
    [{ what: 'an unopenable-by-effect lock flag or exception list', re: /unopenable_by_effect|no_magic_unlock|quest_lock_exempt|magic_immune_lock/i }]),
  D('B-14', 'Red if knowledge gates are re-expressed as quest-stage gates',
    [{ what: 'requires_knowing on quest resolutions', re: /requires_knowing/i }],
    [{ what: 'the knowledge gate replaced by a stage gate', re: /knowledge_requires_stage|requires_stage_not_knowledge/i }]),
  D('B-15', 'Red if an unreachable-player enrage rule is added',
    [{ what: 'a boss arena with geometry', re: /boss_arena|fog_gate|arena/i }],
    [{ what: 'an unreachable-player enrage, anti-cheese teleport or arena invisible wall', re: /enrage|anti_cheese|unreachable_teleport|arena_invisible_wall/i }]),
];

// ---------------------------------------------------------------------------------------------

function loadTree() {
  const roots = [path.join(REPO, 'game/data'), path.join(REPO, 'game/src')];
  const files = [];
  for (const root of roots) {
    (function w(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) w(p);
        else if (/\.(json|js|mjs)$/.test(e.name)) files.push({ rel: path.relative(REPO, p), text: fs.readFileSync(p, 'utf8') });
      }
    })(root);
  }
  return files;
}

/**
 * Line-level, and it has to be.
 *
 * The first version of this file matched whole FILES and produced two false CLOSED verdicts on
 * the shipped tree, both of which read as findings and neither of which was one:
 *
 *   B-10  `PARLEY_EXEMPT` in `combat/parley.json` and `beast_slitherfang.json` is seam S13
 *         working correctly — "beasts and mindless things are exempt ... the exemption is a
 *         declaration, not an omission". The entry's "Red if" is about BOSSES becoming exempt.
 *   B-12  "Filled gems unsellable (SG-3)" in `magic/enchanting.json` is a soul-gem economy rule
 *         and has nothing to do with an `is_quest_item` sell block.
 *
 * A regression detector that cries wolf twice on its first run is a detector nobody reads by the
 * third wave. So a match is a match on a LINE, every match is reported with its file and line
 * number, and a pattern may declare `benign` contexts — which are NOT dropped silently: they are
 * carried in `benign_matches` with the reason, so a critic can disagree with the exclusion.
 */
function hits(files, spec, inject) {
  const re = spec.re, benign = spec.benign || [];
  const found = [], excluded = [];
  const scan = (rel, text) => {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      const b = benign.find((x) => x.re.test(lines[i]));
      const row = { file: rel, line: i + 1, text: lines[i].trim().slice(0, 160) };
      if (b) excluded.push({ ...row, benign_because: b.why });
      else found.push(row);
      if (found.length >= 8) return;
    }
  };
  for (const f of files) {
    scan(f.rel, inject && inject.rel === f.rel ? f.text + '\n' + inject.text : f.text);
    if (found.length >= 8) break;
  }
  if (inject && !files.some((f) => f.rel === inject.rel)) scan(inject.rel, inject.text);
  return { found, excluded };
}

/**
 * Run one entry. `inject` optionally appends text to a file, which is how the self-test proves a
 * closure detector can fire. Returns a row with the two axes kept apart.
 */
export function runEntry(det, entry, files, inject = null) {
  const one = (spec) => {
    // A `data` check reads the parsed records instead of grepping text. Text is the cheap way
    // to find an arriving mechanism and it is what produced this file's two false positives on
    // its first run; where the entry's claim is really about the SHAPE OF THE DATA, say so in
    // data. B-10 is the case: the entry warns that BOSSES become parley-exempt, and the tree is
    // full of correct S13 exemptions for beasts that no regex can tell apart from the wrong one.
    if (spec.data) { const found = spec.data(files, inject) || []; return { what: spec.what, found, benign: [], kind: 'data' }; }
    const h = hits(files, spec, inject);
    return { what: spec.what, found: h.found, benign: h.excluded, kind: 'text' };
  };
  const substrate = det.substrate.map(one);
  const closure = det.closure.map(one);
  const substrateOk = substrate.every((s) => s.found.length > 0);
  const closed = closure.some((c) => c.found.length > 0);
  const status = !substrateOk ? 'absent_system' : closed ? 'closed' : 'live';
  return {
    id: det.id,
    title: entry ? entry.title : null,
    systemic: entry ? entry.systemic : null,
    permanent: entry ? entry.permanent : null,
    conditional: entry ? entry.conditional : false,
    register_status: entry ? entry.status : 'live',
    closes_if: entry ? entry.closes_if : det.from,
    assertions_declared: entry ? entry.probe.assertions.length : 0,
    substrate, closure,
    substrate_present: substrateOk,
    closure_present: closed,
    status,
    pass: status === 'live',
    // The honest label. Nothing here performed the breakage.
    evidence: 'static_absence_of_closure',
    evidence_note: 'The substrate was found in the tree and no mechanism matching this entry\'s own ' +
      '"Red if" clause was found. The breakage was NOT performed in a running build; RI-EXP06 Step 1 ' +
      'asks for that and this run does not supply it.',
    unmeasurable: status === 'absent_system',
  };
}

// ---------------------------------------------------------------------------------------------
// Step 2: the regression comparison. This is the teeth.

const DIFF = {
  'pass|pass': 'held', 'pass|fail': 'REGRESSION', 'fail|pass': 'recovered', 'fail|fail': 'still_failing',
};

function compare(current, baseline) {
  const prev = new Map((baseline && baseline.rows ? baseline.rows : []).map((r) => [r.id, r]));
  const rows = [];
  for (const r of current) {
    const p = prev.get(r.id);
    if (!p) { rows.push({ id: r.id, result: 'new', current: r.pass ? 'pass' : 'fail' }); continue; }
    const key = `${p.pass ? 'pass' : 'fail'}|${r.pass ? 'pass' : 'fail'}`;
    let result = DIFF[key];
    if (result === 'REGRESSION' && r.register_status === 'struck') result = 'struck';
    rows.push({ id: r.id, result, previous: p.pass ? 'pass' : 'fail', current: r.pass ? 'pass' : 'fail', previous_at: baseline.at || null });
  }
  for (const [id] of prev) if (!current.some((r) => r.id === id)) rows.push({ id, result: 'vanished_from_the_register' });
  return rows;
}

// ---------------------------------------------------------------------------------------------

async function selfTest(files, entriesById) {
  say('SELF-TEST — inject each entry\'s own closing mechanism into a copy of the tree; the detector must go red.');
  // A representative token per detector, drawn from its own closure pattern.
  const TOKENS = {
    'B-01': 'cannot_brew_while_affected: true', 'B-02': 'base_skill_only: true', 'B-03': 'max_levitate_height: 40',
    'B-04': '"not_strong_enough": "You are not strong enough."', 'B-05': '"essential": true',
    'B-06': 'virtual_inventory: true', 'B-07': 'velocity_cap: 12', 'B-08': 'max_enchants_per_day: 1',
    'B-09': 'disposition_price_clamp: 0.1', 'B-10': 'parley_exempt: ["boss"]', 'B-11': 'no_monsters_in_town: true',
    'B-12': 'is_quest_item: true', 'B-13': 'unopenable_by_effect: true', 'B-14': 'knowledge_requires_stage: true',
    'B-15': 'enrage: { unreachable_player: true }',
  };
  let ok = true;
  for (const det of DETECTORS) {
    const entry = entriesById.get(det.id);
    const r = await runControl({
      id: det.id,
      what: `does the closure detector for ${det.id} fire when the closing mechanism arrives?`,
      metric: 'register entry status',
      // What `support` counts here: the substrate hits the register entry was decided on.
      unit: 'substrate occurrences found for this register entry',
      factors: [{ id: 'closure_arrives', what: `inject: ${TOKENS[det.id]}` }],
      measure: async (broken) => {
        const inj = broken.length ? { rel: 'game/data/__selftest_injected.json', text: TOKENS[det.id] } : null;
        const row = runEntry(det, entry, files, inj);
        return { value: row.status, support: row.substrate.reduce((s, x) => s + x.found.length, 0) };
      },
      // The substrate must be present in BOTH arms or the detector is being tested against a
      // system that is not there, and the result says nothing about the detector.
      minSupport: 1,
    });
    // An entry whose SUBSTRATE is absent cannot be exercised at all: with no alchemy in the tree
    // there is nothing for a magnitude cap to cap, and both arms correctly read `absent_system`.
    // That is not a detector failure and it is not a pass either — it is `unmeasurable => 0`,
    // which is what the row already says, so the self-test records it and moves on.
    const substratePresent = runEntry(det, entry, files).substrate_present;
    const good = r.verdict === VERDICT.OK || !substratePresent;
    const why = !substratePresent ? 'substrate absent — unmeasurable, the detector cannot be exercised here' : r.verdict;
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${det.id}  ${String(why).padEnd(12)} ${r.arms.map((a) => a.value).join(' -> ')}`);
    if (!good) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — a detector that cannot fire on its own injected closure is not a detector.`);
  return ok;
}

async function main() {
  const probesPath = path.resolve(REPO, arg('probes', 'corpus/95-experience/RI-EXP06.probes.json'));
  if (!fs.existsSync(probesPath)) { say(`ABSENT: ${path.relative(REPO, probesPath)} — run tools/experience/probes-from-md.mjs first.`); process.exit(6); }
  const probes = JSON.parse(fs.readFileSync(probesPath, 'utf8'));
  const entriesById = new Map(probes.entries.map((e) => [e.id, e]));
  const files = loadTree();

  if (has('self-test')) process.exit((await selfTest(files, entriesById)) ? 0 : 5);

  // `--demo-regression=B-nn` proves STEP 2's teeth, not just the detector's. It injects that
  // entry's closing mechanism IN MEMORY ONLY — nothing is written into game/ — and the diff
  // against the baseline must come back REGRESSION. Without this, "regressions: 0" is a number
  // whose ability to be anything else has never been demonstrated, which is the whole disease
  // this piece exists to treat.
  const demo = arg('demo-regression', null);
  const DEMO_TOKENS = {
    'B-01': 'cannot_brew_while_affected: true', 'B-02': 'base_skill_only: true', 'B-03': 'max_levitate_height: 40',
    'B-04': '"not_strong_enough": "You are not strong enough."', 'B-05': '"essential": true',
    'B-06': 'virtual_inventory: true', 'B-07': 'velocity_cap: 12', 'B-08': 'max_enchants_per_day: 1',
    'B-09': 'disposition_price_clamp: 0.1', 'B-10': 'parley_exempt', 'B-11': 'no_monsters_in_town: true',
    'B-12': 'is_quest_item: true', 'B-13': 'unopenable_by_effect: true', 'B-14': 'knowledge_requires_stage: true',
    'B-15': 'enrage: { unreachable_player: true }',
  };
  const inject = demo ? { rel: 'game/data/__demo_regression.json', text: DEMO_TOKENS[demo] || demo } : null;
  if (demo) say(`!! --demo-regression=${demo}: injecting "${inject.text}" IN MEMORY ONLY. Nothing is written to game/.`);
  const rows = DETECTORS.map((d) => runEntry(d, entriesById.get(d.id), files, d.id === demo ? inject : null));
  const live = rows.filter((r) => r.register_status === 'live');
  const passing = rows.filter((r) => r.pass);
  const absent = rows.filter((r) => r.status === 'absent_system');
  const closed = rows.filter((r) => r.status === 'closed');

  const baselinePath = path.resolve(REPO, arg('baseline', 'reports/experience/breakage-register-baseline.json'));
  const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
  const diff = baseline ? compare(rows, baseline) : null;
  const regressions = diff ? diff.filter((d) => d.result === 'REGRESSION') : [];

  const metrics = {
    live_entries: live.length,
    probes_passing: passing.length,
    probes_passing_fraction: live.length ? Math.round((passing.length / live.length) * 100) / 100 : 0,
    systemic_passing: passing.filter((r) => r.systemic).length,
    permanent_passing: passing.filter((r) => r.permanent).length,
    regressions: regressions.length,
    probes_run: rows.length,
    probes_run_fraction: probes.entries.length ? Math.round((rows.length / probes.entries.length) * 100) / 100 : 0,
    unmeasurable_entries: absent.map((r) => r.id),
    closed_entries: closed.map((r) => r.id),
    works_isolated_fails_in_chain: null,
  };
  const bars = {
    live_entries: metrics.live_entries >= 12,
    probes_passing: metrics.probes_passing >= 12 && metrics.probes_passing_fraction >= 0.85,
    systemic_passing: metrics.systemic_passing >= 4,
    permanent_passing: metrics.permanent_passing >= 2,
    regressions: metrics.regressions === 0,
    probes_run: metrics.probes_run_fraction >= 0.80,
  };

  const out = {
    schema: 'elder-souls/exp06-register@1',
    tool: 'tools/experience/breakage-probe.mjs',
    at: new Date().toISOString(),
    evidence_class: 'static_absence_of_closure',
    evidence_caveat: 'RI-EXP06 Step 1 asks each probe to be RUN as a harness scenario that performs the ' +
      'breakage. This run does not perform any breakage; it asserts, per entry, that the substrate is in ' +
      'the tree and that the mechanism the entry\'s own "Red if" clause names is not. That is a regression ' +
      'detector, which is what §C is for, and it is weaker than a demonstration. Do not report it as one.',
    sabotage_control: 'not_applicable',
    sabotage_control_reason: 'RI-EXP06 Comparison method: "No sabotage control is defined for this item, ' +
      'and that is deliberate rather than an omission ... a probe either fires or it does not."',
    baseline: baseline ? path.relative(REPO, baselinePath) : null,
    baseline_absent_note: baseline ? null : 'No previous register on disk, so every row is `new` and ' +
      'the REGRESSION column is unavailable this wave. THIS FILE IS THE BASELINE the next wave diffs ' +
      'against; that is why it is versioned under reports/.gitignore\'s baseline exception.',
    metrics, bars, diff, rows,
  };
  const outPath = path.resolve(REPO, arg('out', 'reports/experience/w1/breakage-register.json'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  if (has('write-baseline')) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify(out, null, 2) + '\n');
    say(`wrote the baseline ${path.relative(REPO, baselinePath)} — the next wave diffs against this.`);
  }

  say(`breakage-probe — ${rows.length} of ${probes.entries.length} register entries, static closure detection.`);
  for (const r of rows) {
    say(`  ${(r.status === 'live' ? 'live ' : r.status === 'closed' ? 'CLOSED' : 'ABSENT').padEnd(7)} ${r.id}  ` +
      `${r.systemic ? 'Sys ' : '    '}${r.permanent ? 'Perm ' : '     '} ${r.title}`);
    if (r.status === 'absent_system') say(`          substrate missing: ${r.substrate.filter((s) => !s.found.length).map((s) => s.what).join('; ')}`);
    if (r.status === 'closed') say(`          CLOSED BY: ${r.closure.filter((c) => c.found.length).map((c) => `${c.what} @ ${c.found.slice(0, 3).map((f) => f.file + ':' + f.line).join(', ')}`).join('; ')}`);
    const ben = r.closure.flatMap((c) => c.benign);
    if (ben.length) say(`          (${ben.length} match(es) excluded as benign: ${[...new Set(ben.map((b) => b.benign_because))].join('; ')})`);
  }
  say('');
  for (const [k, v] of Object.entries(bars)) say(`  ${v ? 'ok  ' : 'BELOW'} ${k.padEnd(20)} ${JSON.stringify(metrics[k])}`);
  if (diff) { const bad = diff.filter((d) => d.result === 'REGRESSION'); say(`  regressions: ${bad.length}${bad.length ? ' — ' + bad.map((d) => d.id).join(', ') : ''}`); }
  else say('  no baseline on disk: the durability half is UNAVAILABLE this wave and this run is the baseline.');
  say(`wrote ${path.relative(REPO, outPath)}`);

  if (regressions.length) process.exit(2);
  if (!bars.live_entries) process.exit(3);
  if (!bars.probes_run) process.exit(4);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('breakage-probe.mjs')) main();
export { DETECTORS };

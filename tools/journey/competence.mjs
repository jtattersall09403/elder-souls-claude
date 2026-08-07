#!/usr/bin/env node
// competence.mjs — RI-JRN02 §C, K1..K7: did the player get BETTER?
//
// Named by: RI-JRN02's Comparison method, verbatim:
//   node tools/journey/competence.mjs --in reports/journeys/<runId> --early E_first --late E_late
//
// RI-JRN02 §C's own framing, which is the reason this file is worth writing:
//   "Beats measure what happened. Cadence measures how busy the player was. Neither measures
//    whether the player got BETTER, and getting better is the entire promise of the Souls half."
//
// THE TWO WAYS THIS CHECK GETS GAMED, both closed here rather than left to a critic's diligence:
//
//   1. Improve against a WEAKER enemy. RI-JRN02 K7: "E_late's enemy must have equal or greater
//      RI-AI05 tier than E_first's." So this tool resolves both encounters' enemy ids to their
//      shipped statblocks and REFUSES the comparison when the late tier is lower. It does not
//      report a nicer number with a footnote; it reports `unmeasurable` with the reason.
//   2. Improve because of GEAR. RI-JRN02 §C: "using the same agent, the same character build,
//      and no equipment upgrade between them. If the improvement requires better gear, the game
//      taught the player to shop, not to fight."
//
// ROUND 2 (TOOL-COVERAGE-R1 §5): the gear clause COULD NOT FAIL. `compareLoadouts()` returns
// `{ changed: null }` when no trace record carries `player.loadout`, the caller tested
// `if (gear && gear.changed)`, and `null` is falsy — so no blocker was raised when the clause
// could not be checked at all, and the self-test's own fixture never emitted the field. A
// competence curve bought entirely with gear was certified whenever the trace omitted the
// loadout. The three states are now distinct: `true` -> GEAR_CHANGED, `null` -> GEAR_UNCHECKABLE
// (both void the comparison), `false` -> proceed. So the loadout is captured at both encounters
//      and any difference invalidates the comparison.
//
// AND THE THIRD, WHICH IS THIS BUILD'S ACTUAL SITUATION:
//   The engine declares `enemy DECISION-MAKING` not implemented (`getCapabilityReport()`:
//   "enemy statblocks declare ai='scripted'; actions come from the scenario file on declared
//   frames"). Against a scripted enemy that does the same thing at the same frame every time,
//   "the player got better" is not a measurement of the player — it is a measurement of how many
//   times the same script has been replayed. K5 (`block_timing`, reactive vs pre-emptive) and K6
//   (`heal_read`, heals begun inside an enemy PUNISH WINDOW) are not merely hard here, they are
//   undefined: a scripted enemy has no punish window because it is not reading the player.
//   This tool says so and exits non-zero. It does not compute a number that would be mistaken
//   for a competence curve.
//
// EXIT CODES: 0 the curve was measured and meets §C's requirement; 1 measured and does not meet
//             it, OR could not be measured (the reason is printed); 2 usage; 20 no trace.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, readJsonl, die, EXIT,
} from '../lib/cli.mjs';
import { loadEnemies } from '../lib/gamedata.mjs';

const GEAR_FIELDS = ['weapon_id', 'weapon_class', 'offhand_kind', 'equip_load_pct', 'roll_class', 'attuned'];
const REPORTED_NOT_BLOCKING = ['stance'];

export function loadoutFrom(rec) {
  const p = (rec && rec.player) || null;
  if (!p) return null;
  // A trace that carries an explicit loadout still wins — this is additive, not a replacement.
  if (p.loadout && typeof p.loadout === 'object') return { source: 'player.loadout', fields: { ...p.loadout } };
  const fields = {};
  for (const k of [...GEAR_FIELDS, ...REPORTED_NOT_BLOCKING]) if (p[k] !== undefined) fields[k] = p[k];
  return Object.keys(fields).length ? { source: 'player.{' + Object.keys(fields).join(',') + '}', fields } : null;
}


const USAGE = `
competence.mjs — RI-JRN02 §C, K1..K7: the competence curve.

USAGE
  node tools/journey/competence.mjs --in reports/journeys/<runId> --early E_first --late E_late
  node tools/journey/competence.mjs --in <runDir> --auto
  node tools/journey/competence.mjs --self-test

OPTIONS
  --in DIR        a journey-run.mjs run directory (needs trace.jsonl)
  --early ID      the early encounter's id, or a frame range "12000-18000"
  --late ID       the late encounter's id, or a frame range
  --auto          pick E_first as the first hostile encounter after minute 18 and E_late as the
                  one closest to minute 55, per RI-JRN02 §C
  --fps N         simulation rate (default 60)
  --json PATH     write the result
  --self-test     prove the instrument can fail

METRICS
  K1 hit_taken_rate    damage events on the player per 60 s of COMBAT      (lower is better)
  K2 roll_efficiency   rolls whose i-frames overlapped an incoming hitbox  (higher is better)
  K3 stamina_floor     fraction of combat frames at stamina < 10%          (lower is better)
  K4 whiff_rate        attacks whose active window contained no hurtbox    (lower is better)
  K5 block_timing      blocks pressed AFTER the windup began (reactive)    (higher is better)
  K6 heal_read         heals begun inside an enemy punish window           (lower is better)

REQUIREMENT (RI-JRN02 §C)
  E_late better on >= 4 of 6, with roll_efficiency +0.15 absolute and hit_taken_rate -30%,
  same agent, same build, NO equipment upgrade between them.
  K7: E_late's enemy tier >= E_first's, or the comparison is void.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['self-test']) process.exit(selfTest());

const inDir = args.in ? path.resolve(String(args.in)) : null;
if (!inDir) die(EXIT.USAGE, '--in <journey run directory> is required');
const tracePath = path.join(inDir, 'trace.jsonl');
if (!fs.existsSync(tracePath)) {
  die(EXIT.MEASUREMENT_FAIL,
    `${path.relative(REPO_ROOT, tracePath)} does not exist. competence.mjs measures a RUN ` +
    `(RI-MTH07). Produce one with journey-run.mjs --journey jrn02-first-hour --duration-min 60.`);
}

const records = readJsonl(tracePath);
const fps = Number(args.fps || 60);
const runManifest = (() => {
  const p = path.join(inDir, 'journey.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
})();

const result = analyse(records, {
  fps,
  early: args.early ? String(args.early) : null,
  late: args.late ? String(args.late) : null,
  auto: !!args.auto || (!args.early && !args.late),
  capability: runManifest && runManifest.capability_report,
});

writeJson(args.json ? String(args.json) : path.join(inDir, 'competence.json'), result);
report(result);
process.exit(result.ok ? 0 : 1);

// ---------------------------------------------------------------------------------------------
/** The shipped trace numbers its frames `f` (HARNESS.md §5). Round 2 read `frame` and got 0. */
export function frameOf(r) { return Number((r && (r.f ?? r.frame)) ?? 0); }

export function analyse(records, opts = {}) {
  const fps = opts.fps || 60;
  const frames = records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');
  const enemies = safeEnemies();

  const blockers = [];

  // --- Blocker 0: is there an enemy that can be got better AGAINST? -----------------------
  // The capability report is the build's own declaration and outranks any inference.
  const cap = opts.capability;
  const aiAbsent = cap && (cap.not_implemented || []).some((n) => /enemy DECISION-MAKING/i.test(n.what || ''));
  if (aiAbsent) {
    const owner = (cap.not_implemented.find((n) => /enemy DECISION-MAKING/i.test(n.what || '')) || {}).owner;
    blockers.push({
      code: 'NO_AI',
      why: 'The build declares enemy DECISION-MAKING not implemented: enemy statblocks declare ' +
           "ai='scripted' and actions come from the scenario file on declared frames. Against an " +
           'enemy that performs the same action on the same frame every run, "the player got ' +
           'better" measures how many times a fixed script has been replayed, not competence. ' +
           'K5 (reactive vs pre-emptive block) and K6 (heals inside a PUNISH WINDOW) are not ' +
           'merely hard to measure here — a scripted enemy has no punish window, because it is ' +
           'not reading the player, so the quantity K6 names does not exist.',
      owner: owner || 'RI-AI01..07 / wave-1 piece W1-12',
    });
  }

  if (!frames.length) {
    blockers.push({ code: 'NO_FRAMES', why: 'the trace carries 0 simulation frames', owner: 'the run' });
  }

  // --- pick the two encounters --------------------------------------------------------------
  const encounters = findEncounters(frames, fps);
  let E_first = null, E_late = null;
  if (opts.early && opts.late && !/^\d+-\d+$/.test(opts.early)) {
    E_first = encounters.find((e) => e.id === opts.early) || null;
    E_late = encounters.find((e) => e.id === opts.late) || null;
  } else if (opts.early && /^\d+-\d+$/.test(opts.early)) {
    const [a, b] = opts.early.split('-').map(Number);
    const [c, d] = String(opts.late || '').split('-').map(Number);
    E_first = { id: 'early-range', from: a, to: b, enemies: [] };
    E_late = Number.isFinite(c) ? { id: 'late-range', from: c, to: d, enemies: [] } : null;
  } else {
    // RI-JRN02 §C: first hostile encounter after minute 18; the one closest to minute 55.
    E_first = encounters.find((e) => e.from >= 18 * 60 * fps) || null;
    if (encounters.length) {
      const target = 55 * 60 * fps;
      E_late = encounters.slice().sort((a, b) => Math.abs(a.from - target) - Math.abs(b.from - target))[0];
      if (E_late && E_first && E_late.id === E_first.id) E_late = null;
    }
  }

  if (!E_first || !E_late) {
    blockers.push({
      code: 'NO_ENCOUNTER_PAIR',
      why: `RI-JRN02 §C needs the first hostile encounter after minute 18 and the one closest to ` +
           `minute 55. This trace contains ${encounters.length} hostile encounter(s)` +
           (encounters.length ? ` at ${encounters.map((e) => (e.from / fps / 60).toFixed(1) + ' min').join(', ')}` : '') +
           `. Without two matched encounters there is no curve to measure — and an hour with fewer ` +
           `than two hostile encounters is itself a RI-JRN02 C5 finding.`,
      owner: 'the run / the build',
    });
  }

  // --- K7 and the gear clause, BEFORE any metric is computed --------------------------------
  let k7 = null, gear = null;
  if (E_first && E_late) {
    const tierOf = (e) => {
      const ids = e.enemies || [];
      const tiers = ids.map((id) => (enemies[id] || {}).tier).filter(Boolean);
      return tiers.length ? tiers : null;
    };
    const RANK = { trash: 1, elite: 2, boss: 3 };
    const a = tierOf(E_first), b = tierOf(E_late);
    if (!a || !b) {
      k7 = { status: 'unmeasurable', why: 'one or both encounters name no enemy id resolvable to a shipped statblock' };
      blockers.push({ code: 'K7_UNRESOLVED', why: k7.why, owner: 'the trace (encounter records must name the enemy)' });
    } else {
      const ra = Math.max(...a.map((t) => RANK[t] || 0));
      const rb = Math.max(...b.map((t) => RANK[t] || 0));
      // TOOL-COVERAGE-R1 §5, secondary: "K7 compares only the three-value tier ladder.
      // champion_hist_marked (2,876 hp) and cst_sap_speaker (380 hp) are BOTH elite, so a 7.6x
      // weakening between E_first and E_late rates K7: pass. The tool obeys K7 to the letter and
      // the letter is thin." The letter is still what gates — moving the threshold is not this
      // tool's call — but the spread is now reported alongside it so a critic can see what the
      // tier label is hiding, and a spread beyond `hp_spread_notice` is called out by name.
      const spreadOf = (ids) => {
        const rows = ids.map((id) => enemies[id]).filter(Boolean);
        return {
          statblocks: ids.slice(),
          hp: rows.map((r) => r.hp || 0),
          hp_total: rows.reduce((t, r) => t + (r.hp || 0), 0),
          armour_rating: rows.map((r) => r.armour_rating || 0),
          attack_count: rows.map((r) => Object.keys(r.attacks || {}).length),
        };
      };
      const sa = spreadOf(E_first.enemies || []), sb = spreadOf(E_late.enemies || []);
      const ratio = sa.hp_total > 0 && sb.hp_total > 0 ? +(sb.hp_total / sa.hp_total).toFixed(2) : null;
      k7 = {
        status: rb >= ra ? 'pass' : 'fail', early_tiers: a, late_tiers: b,
        why: rb >= ra ? null : 'E_late is a WEAKER enemy than E_first',
        spread: {
          E_first: sa, E_late: sb,
          late_over_first_hp: ratio,
          note: ratio !== null && ratio < 0.5
            ? `E_late's cohort carries ${ratio}x E_first's hit points at the SAME tier label. K7's ` +
              'three-value ladder cannot see that; the improvement may be an easier fight rather ' +
              'than a better player. Reported, not enforced — the threshold is RI-JRN02\'s.'
            : null,
        },
      };
      if (rb < ra) {
        blockers.push({
          code: 'K7_WEAKER_LATE',
          why: `E_late's enemy tier (${b.join(',')}) is below E_first's (${a.join(',')}). RI-JRN02 K7: ` +
               '"measuring improvement against a weaker enemy is meaningless and is the obvious way ' +
               'this check gets gamed." The comparison is void, not merely caveated.',
          owner: 'the run (choose matched encounters)',
        });
      }
    }
    // THE GEAR CLAUSE. TOOL-COVERAGE-R1 §5: round 1 read
    //     if (gear && gear.changed) { blockers.push({ code: 'GEAR_CHANGED', ... }) }
    // and `compareLoadouts` returns `{ changed: null }` when no trace record carries
    // `player.loadout`. `null` is falsy, so NO blocker was raised when the clause could not be
    // checked at all — and the self-test's own fixture never emitted the field, which is why
    // "a real improvement is recognised" passed with the gear clause silently unchecked. A
    // competence curve bought entirely with gear was certified whenever the trace omitted the
    // loadout. An unavailable check is `unmeasurable`, exactly as K7 is when it cannot resolve
    // a statblock; it is never a pass. The three states are now distinct and all three block
    // or proceed explicitly.
    gear = compareLoadouts(frames, E_first, E_late);
    if (gear.changed === true) {
      blockers.push({
        code: 'GEAR_CHANGED',
        why: `the loadout differs between E_first and E_late (${gear.diff.join('; ')}). RI-JRN02 §C ` +
             'requires "no equipment upgrade between them: if the improvement requires better gear, ' +
             'the game taught the player to shop, not to fight."',
        owner: 'the run',
      });
    } else if (gear.changed === null) {
      blockers.push({
        code: 'GEAR_UNCHECKABLE',
        why: `${gear.why} RI-JRN02 §C's no-upgrade clause is a REQUIREMENT of the comparison, not ` +
             'an optional caveat: a competence curve bought entirely with better gear is exactly ' +
             'what the clause exists to reject, and a trace that cannot show the loadout cannot ' +
             'distinguish that case from a real one. The comparison is void, not caveated.',
        owner: 'the trace (needs player.loadout on at least one record at or before each encounter)',
      });
    }
  }

  // --- the six metrics ------------------------------------------------------------------------
  const metrics = (E_first && E_late) ? {
    E_first: measure(frames, E_first, fps),
    E_late: measure(frames, E_late, fps),
  } : null;

  let comparison = null;
  if (metrics) {
    const better = {
      K1: metrics.E_late.K1 !== null && metrics.E_first.K1 !== null && metrics.E_late.K1 < metrics.E_first.K1,
      K2: metrics.E_late.K2 !== null && metrics.E_first.K2 !== null && metrics.E_late.K2 > metrics.E_first.K2,
      K3: metrics.E_late.K3 !== null && metrics.E_first.K3 !== null && metrics.E_late.K3 < metrics.E_first.K3,
      K4: metrics.E_late.K4 !== null && metrics.E_first.K4 !== null && metrics.E_late.K4 < metrics.E_first.K4,
      K5: metrics.E_late.K5 !== null && metrics.E_first.K5 !== null && metrics.E_late.K5 > metrics.E_first.K5,
      K6: metrics.E_late.K6 !== null && metrics.E_first.K6 !== null && metrics.E_late.K6 < metrics.E_first.K6,
    };
    const improvedCount = Object.values(better).filter(Boolean).length;
    const rollDelta = (metrics.E_late.K2 !== null && metrics.E_first.K2 !== null) ? metrics.E_late.K2 - metrics.E_first.K2 : null;
    const hitDrop = (metrics.E_late.K1 !== null && metrics.E_first.K1 > 0) ? 1 - metrics.E_late.K1 / metrics.E_first.K1 : null;
    comparison = {
      better, improved_count: improvedCount, required: 4,
      roll_efficiency_delta: rollDelta, roll_efficiency_required: 0.15,
      hit_taken_rate_drop: hitDrop, hit_taken_rate_required: 0.30,
      meets: improvedCount >= 4 && rollDelta !== null && rollDelta >= 0.15 && hitDrop !== null && hitDrop >= 0.30,
      unmeasured_metrics: Object.entries(metrics.E_late).filter(([, v]) => v === null).map(([k]) => k),
    };
  }

  return {
    schema: 'elder-souls/competence@1',
    tool: 'tools/journey/competence.mjs',
    item: 'RI-JRN02 §C (K1..K7)',
    frames: frames.length, fps,
    encounters_found: encounters.map((e) => ({ id: e.id, from_min: +(e.from / fps / 60).toFixed(1), enemies: e.enemies })),
    E_first: E_first ? { id: E_first.id, from: E_first.from, to: E_first.to, enemies: E_first.enemies } : null,
    E_late: E_late ? { id: E_late.id, from: E_late.from, to: E_late.to, enemies: E_late.enemies } : null,
    K7: k7, gear,
    metrics, comparison,
    blockers,
    // The one line that matters: a competence curve is claimable only when NOTHING blocks it.
    ok: blockers.length === 0 && !!comparison && comparison.meets,
    status: blockers.length ? 'unmeasurable' : (comparison && comparison.meets ? 'meets' : 'does_not_meet'),
  };
}

function safeEnemies() { try { return loadEnemies(); } catch { return {}; } }

/** Contiguous runs of frames carrying a hostile in AGGRO or a combat marker. */
function findEncounters(frames, fps) {
  const out = [];
  let cur = null;
  const GAP = 5 * fps;
  for (const r of frames) {
    const evs = Array.isArray(r.events) ? r.events : [];
    const ids = new Set();
    let hostile = false;
    for (const e of evs) {
      if (!e) continue;
      if (['attack_start', 'hit', 'enemy_state', 'zone_alert', 'detect', 'spawn'].includes(e.type)) {
        if (e.who || e.eid || e.id) ids.add(String(e.statblock || e.enemy || e.who || e.eid || e.id));
        if (e.type !== 'spawn') hostile = true;
      }
    }
    if (Array.isArray(r.enemies)) {
      for (const en of r.enemies) {
        if (en && en.alertState === 'AGGRO') { hostile = true; if (en.statblock || en.id) ids.add(String(en.statblock || en.id)); }
      }
    }
    const fr = frameOf(r);
    if (hostile) {
      if (cur && fr - cur.to <= GAP) { cur.to = fr; for (const i of ids) cur.enemies.push(i); }
      else { if (cur) out.push(cur); cur = { id: `E${out.length + 1}`, from: fr, to: fr, enemies: [...ids] }; }
    }
  }
  if (cur) out.push(cur);
  for (const e of out) e.enemies = [...new Set(e.enemies)].filter(Boolean);
  return out;
}

/**
 * The no-upgrade clause. Returns `changed: true | false | null`, and the CALLER blocks on both
 * `true` and `null` — see the GEAR_CHANGED / GEAR_UNCHECKABLE branches above.
 *
 * `at(f)` walks backwards for the most recent record carrying `player.loadout`, and it reports
 * WHICH FRAME that observation came from. That matters: if the observation used for E_late
 * predates E_first, then nothing in the trace shows what the player was wearing at the second
 * encounter, and inheriting the first encounter's kit would certify "unchanged" from an
 * observation that was never taken. A stale observation is not evidence of no change; it is the
 * absence of evidence, and it degrades to `null`.
 */
// ROUND 3 (TOOL-COVERAGE-R2 §6). Round 2 fixed the clause so it BLOCKS when it cannot be
// checked — and then it could never be checked, because it looked for `player.loadout` and
// NO TRACE IN THIS TREE HAS EVER CARRIED THAT FIELD. A census of the 3 780-record trace at
// reports/journeys/w1-13-jrn06/trace.jsonl finds 0 records with `player.loadout` and every one
// of these instead:
//
//   weapon_id  weapon_class  stance  offhand_kind  roll_class  equip_load_pct  attuned  estus …
//
// So on EVERY real run the clause returned GEAR_UNCHECKABLE and voided the comparison, and the
// tool named "the trace" as owner for data the trace was already emitting. Round 1 shipped a
// clause that could not fail; round 2 shipped one that could not pass. The loadout is now read
// from the fields that exist, with `player.loadout` still honoured where a future trace carries
// it, and GEAR_UNCHECKABLE kept for when even these are missing.
//
// WHAT COUNTS AS GEAR. RI-JRN02 §C: "no equipment upgrade between them... if the improvement
// requires better gear, the game taught the player to shop, not to fight." So the blocking set
// is what you would have to GO AND GET: the weapon, the offhand, the burden you are carrying,
// the roll class that burden buys you, and the spells you have attuned. `stance` is in the trace
// and is reported, but it does NOT block: holding the same sword in two hands is a decision made
// in the fight, not a trip to a merchant, and blocking on it would void every real comparison —
// which is the failure this round exists to stop repeating in the other direction.
function compareLoadouts(frames, a, b) {
  const at = (f) => {
    for (let i = frames.length - 1; i >= 0; i--) {
      const r = frames[i];
      if (frameOf(r) > f) continue;
      const l = loadoutFrom(r);
      if (l) return { loadout: l.fields, source: l.source, frame: frameOf(r) };
    }
    return null;
  };
  const oa = at(a.from), ob = at(b.from);
  if (!oa || !ob) {
    return {
      changed: null,
      observed_at: { E_first: oa ? oa.frame : null, E_late: ob ? ob.frame : null },
      why: 'no trace record at or before ' + (!oa ? 'E_first' : 'E_late') + ' carries a loadout — ' +
           `neither player.loadout nor any of ${[...GEAR_FIELDS, ...REPORTED_NOT_BLOCKING].join(', ')} — ` +
           'so the no-upgrade clause cannot be checked.',
    };
  }
  if (ob.frame < a.from) {
    return {
      changed: null,
      observed_at: { E_first: oa.frame, E_late: ob.frame },
      why: `the most recent loadout observation before E_late is at frame ${ob.frame}, which is ` +
           `BEFORE E_first began (frame ${a.from}). Nothing in the trace shows what the player was ` +
           `wearing at the second encounter, so "unchanged" would be inferred from an observation ` +
           `that was never taken. Absence of evidence is not evidence of no change.`,
    };
  }
  const la = oa.loadout, lb = ob.loadout;
  const diff = [], nonBlocking = [];
  for (const k of new Set([...Object.keys(la), ...Object.keys(lb)])) {
    if (JSON.stringify(la[k]) === JSON.stringify(lb[k])) continue;
    const line = `${k}: ${JSON.stringify(la[k])} -> ${JSON.stringify(lb[k])}`;
    if (REPORTED_NOT_BLOCKING.includes(k)) nonBlocking.push(line); else diff.push(line);
  }
  return {
    changed: diff.length > 0,
    diff,
    reported_not_blocking: nonBlocking,
    gear_fields: GEAR_FIELDS,
    source: { E_first: oa.source, E_late: ob.source },
    observed_at: { E_first: oa.frame, E_late: ob.frame },
    loadouts: { E_first: la, E_late: lb },
  };
}

/** K1..K6 over one encounter window. `null` where the trace does not carry the field. */
function measure(frames, enc, fps) {
  const win = frames.filter((r) => frameOf(r) >= enc.from && frameOf(r) <= enc.to);
  const seconds = Math.max(1e-6, (enc.to - enc.from) / fps);
  let hitsTaken = 0, rolls = 0, rollsWithOverlap = 0, lowStamina = 0, attacks = 0, whiffs = 0;
  let blocks = 0, reactiveBlocks = 0, heals = 0, healsInPunish = 0;
  let sawStamina = false, sawRollWindow = false, sawBlockTiming = false, sawPunishWindow = false;

  for (const r of win) {
    for (const e of (r.events || [])) {
      if (!e || !e.type) continue;
      if (e.type === 'hit' && (e.target === 'player' || e.to === 'player' || e.who === 'player')) hitsTaken++;
      if (e.type === 'roll_start') {
        rolls++;
        if (e.iframe_overlap !== undefined) { sawRollWindow = true; if (e.iframe_overlap) rollsWithOverlap++; }
      }
      if (e.type === 'iframe_dodge') { sawRollWindow = true; rollsWithOverlap++; }
      if (e.type === 'attack_start' && (e.who === 'player' || e.by === 'player')) attacks++;
      if (e.type === 'whiff' && (e.who === 'player' || e.by === 'player')) whiffs++;
      if (e.type === 'block' || e.type === 'block_success') {
        blocks++;
        if (e.reactive !== undefined) { sawBlockTiming = true; if (e.reactive) reactiveBlocks++; }
        else if (e.pressed_after_windup !== undefined) { sawBlockTiming = true; if (e.pressed_after_windup) reactiveBlocks++; }
      }
      if (e.type === 'heal') {
        heals++;
        if (e.in_punish_window !== undefined) { sawPunishWindow = true; if (e.in_punish_window) healsInPunish++; }
      }
    }
    const st = r.player && (r.player.stamina ?? r.player.sta);
    const stMax = r.player && (r.player.stamina_max ?? r.player.staMax);
    if (Number.isFinite(st) && Number.isFinite(stMax) && stMax > 0) { sawStamina = true; if (st / stMax < 0.10) lowStamina++; }
  }

  return {
    frames: win.length, seconds: +seconds.toFixed(1),
    K1: +(hitsTaken / (seconds / 60)).toFixed(3),
    K2: sawRollWindow && rolls > 0 ? +(rollsWithOverlap / rolls).toFixed(3) : null,
    K3: sawStamina && win.length ? +(lowStamina / win.length).toFixed(3) : null,
    K4: attacks > 0 ? +(whiffs / attacks).toFixed(3) : null,
    K5: sawBlockTiming && blocks > 0 ? +(reactiveBlocks / blocks).toFixed(3) : null,
    K6: sawPunishWindow ? +(healsInPunish / Math.max(1, heals)).toFixed(3) : null,
    _missing_fields: [
      !sawRollWindow ? 'K2 needs roll_start.iframe_overlap or an iframe_dodge event' : null,
      !sawStamina ? 'K3 needs player.stamina and player.stamina_max in the frame record' : null,
      !sawBlockTiming ? 'K5 needs block.reactive (or block.pressed_after_windup)' : null,
      !sawPunishWindow ? 'K6 needs heal.in_punish_window, which requires an enemy that HAS punish windows (RI-AI03)' : null,
    ].filter(Boolean),
  };
}

function report(r) {
  process.stdout.write(`competence: ${r.frames} frames, ${r.encounters_found.length} hostile encounter(s)\n`);
  if (r.blockers.length) {
    process.stdout.write(`  STATUS: unmeasurable — ${r.blockers.length} blocker(s)\n`);
    for (const b of r.blockers) process.stdout.write(`    [${b.code}] ${b.why}\n      owner: ${b.owner}\n`);
    return;
  }
  process.stdout.write(`  E_first ${JSON.stringify(r.metrics.E_first)}\n  E_late  ${JSON.stringify(r.metrics.E_late)}\n`);
  process.stdout.write(`  improved on ${r.comparison.improved_count}/6 (need 4); roll +${r.comparison.roll_efficiency_delta} (need 0.15); ` +
    `hits -${((r.comparison.hit_taken_rate_drop || 0) * 100).toFixed(0)}% (need 30%)\n`);
  process.stdout.write(`  ${r.comparison.meets ? 'MEETS' : 'DOES NOT MEET'} RI-JRN02 §C\n`);
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };
  const fps = 60;

  // `loadout` defaults to a fixed kit. ROUND 2: round 1's fixture never emitted `player.loadout`
  // at all, which is exactly why "a real improvement is recognised" passed with the gear clause
  // silently unchecked (TOOL-COVERAGE-R1 §5). Passing `loadout: null` reproduces the absent-field
  // case ON PURPOSE, and it must now BLOCK rather than proceed.
  const KIT = { right: 'iron-longsword', left: 'kite-shield', armour: 'chitin-cuirass' };
  // ROUND 3: the SHIPPED trace shape. `reports/journeys/w1-13-jrn06/trace.jsonl` carries these
  // fields on all 3 780 records and `player.loadout` on none, and numbers its frames `f`.
  const REAL_KIT = {
    weapon_id: 'wpn-iron-longsword', weapon_class: 'straight_sword', offhand_kind: 'shield',
    equip_load_pct: 41, roll_class: 'medium', attuned: ['spl-flare'], stance: 'one_handed',
  };
  const mkEnc = (fromMin, n, statblock, { hits, rollOverlap, rolls, loadout = KIT, realKit = null, frameKey = 'frame' }) => {
    const out = [];
    const f0 = Math.round(fromMin * 60 * fps);
    for (let i = 0; i < n; i++) {
      const evs = [{ type: 'enemy_state', statblock, alertState: 'AGGRO' }];
      if (i < hits) evs.push({ type: 'hit', target: 'player' });
      if (i < rolls) evs.push({ type: 'roll_start', iframe_overlap: i < rollOverlap });
      const player = { stamina: 50, stamina_max: 100 };
      if (realKit) Object.assign(player, realKit);
      else if (loadout) player.loadout = loadout;
      const rec = { events: evs, enemies: [{ statblock, alertState: 'AGGRO' }], player };
      rec[frameKey] = f0 + i * 10;
      out.push(rec);
    }
    return out;
  };

  // 1. Empty trace: unmeasurable, never "meets".
  const empty = analyse([{ _: 'header' }], { fps });
  ok('empty trace is unmeasurable, never "meets"',
    !empty.ok && empty.status === 'unmeasurable' && empty.blockers.some((b) => b.code === 'NO_FRAMES'),
    `status=${empty.status}, blockers=${empty.blockers.map((b) => b.code).join(',')}`);

  // 2. A genuine improvement against an equal-tier enemy must be recognised.
  const good = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12 }),
    ...mkEnc(55, 120, 'champion_hist_marked', { hits: 10, rolls: 60, rollOverlap: 45 })];
  const goodR = analyse(good, { fps, auto: true });
  ok('a real improvement against an equal-tier enemy is recognised',
    goodR.blockers.length === 0 && goodR.comparison && goodR.comparison.roll_efficiency_delta >= 0.15,
    goodR.blockers.length ? `blocked: ${goodR.blockers.map((b) => b.code).join(',')}`
      : `improved ${goodR.comparison.improved_count}/6, roll +${goodR.comparison.roll_efficiency_delta}, hits -${((goodR.comparison.hit_taken_rate_drop || 0) * 100).toFixed(0)}%`);

  // 3. THE FALSIFICATION K7: the same improvement against a WEAKER late enemy must be VOID,
  //    not merely caveated. This is RI-JRN02's named gaming route.
  const gamed = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12 }),
    ...mkEnc(55, 120, 'drowned_lesser', { hits: 10, rolls: 60, rollOverlap: 45 })];
  const gamedR = analyse(gamed, { fps, auto: true });
  ok('K7 voids an improvement measured against a weaker late enemy (falsification)',
    gamedR.status === 'unmeasurable' && gamedR.blockers.some((b) => b.code === 'K7_WEAKER_LATE'),
    gamedR.blockers.map((b) => b.code).join(',') || `status=${gamedR.status} — K7 DID NOT FIRE`);

  // 4. THE OTHER FALSIFICATION: a build with no enemy AI cannot claim a competence curve.
  const noAi = analyse(good, {
    fps, auto: true,
    capability: { not_implemented: [{ what: 'enemy DECISION-MAKING (approach, circle, commit)', owner: 'W1-12' }] },
  });
  ok('a scripted-enemy build cannot claim a competence curve (falsification)',
    noAi.status === 'unmeasurable' && noAi.blockers.some((b) => b.code === 'NO_AI'),
    noAi.blockers.map((b) => b.code).join(',') || 'NO_AI DID NOT FIRE');

  // 5. Missing trace fields must yield null metrics, not zeros that read as perfect scores.
  const thin = [{ _: 'header' },
    ...mkEnc(19, 60, 'champion_hist_marked', { hits: 5, rolls: 0, rollOverlap: 0 }),
    ...mkEnc(55, 60, 'champion_hist_marked', { hits: 2, rolls: 0, rollOverlap: 0 })];
  const thinR = analyse(thin, { fps, auto: true });
  ok('absent trace fields give null, not 0',
    thinR.metrics && thinR.metrics.E_late.K2 === null && thinR.metrics.E_late.K5 === null,
    `K2=${thinR.metrics && thinR.metrics.E_late.K2}, K5=${thinR.metrics && thinR.metrics.E_late.K5}, ` +
    `missing: ${thinR.metrics && thinR.metrics.E_late._missing_fields.length}`);

  // ---- THE ROUND-2 FALSIFICATIONS: the gear clause, in all three of its states --------------
  //
  // TOOL-COVERAGE-R1 §5's three-run table, reproduced here so the regression is permanent:
  //   loadout present, unchanged -> changed: false -> proceeds          (correct)
  //   loadout present, upgraded  -> changed: true  -> GEAR_CHANGED      (correct)
  //   loadout field ABSENT       -> changed: null  -> ROUND 1 PROCEEDED (the defect)
  const upgraded = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12, loadout: KIT }),
    ...mkEnc(55, 120, 'champion_hist_marked', { hits: 10, rolls: 60, rollOverlap: 45, loadout: { ...KIT, right: 'ebony-greatsword' } })];
  const upgradedR = analyse(upgraded, { fps, auto: true });
  ok('gear clause: an UPGRADE between the two encounters voids the comparison',
    upgradedR.status === 'unmeasurable' && upgradedR.blockers.some((b) => b.code === 'GEAR_CHANGED'),
    `gear.changed=${upgradedR.gear && upgradedR.gear.changed}, blockers=${upgradedR.blockers.map((b) => b.code).join(',') || '(none)'}`);

  const noLoadout = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12, loadout: null }),
    ...mkEnc(55, 120, 'champion_hist_marked', { hits: 10, rolls: 60, rollOverlap: 45, loadout: null })];
  const noLoadoutR = analyse(noLoadout, { fps, auto: true });
  ok('gear clause: an ABSENT loadout field is UNMEASURABLE, not a silent pass (falsification)',
    noLoadoutR.status === 'unmeasurable' && noLoadoutR.blockers.some((b) => b.code === 'GEAR_UNCHECKABLE')
      && noLoadoutR.gear && noLoadoutR.gear.changed === null,
    `gear.changed=${noLoadoutR.gear && noLoadoutR.gear.changed}, status=${noLoadoutR.status}, ` +
    `blockers=${noLoadoutR.blockers.map((b) => b.code).join(',') || '(none)'} ` +
    `(round 1: changed=null is falsy, no blocker, PROCEEDS — a curve bought with gear was certified)`);

  ok('gear clause: an UNCHANGED loadout proceeds (the clause is not a blanket refusal)',
    goodR.gear && goodR.gear.changed === false && !goodR.blockers.some((b) => String(b.code).startsWith('GEAR')),
    `gear.changed=${goodR.gear && goodR.gear.changed}, blockers=${goodR.blockers.map((b) => b.code).join(',') || '(none)'}`);

  // ---- K7's tier ladder is thin, and the spread is now reported alongside it -----------------
  const sameTier = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12 }),
    ...mkEnc(55, 120, 'cst_sap_speaker', { hits: 10, rolls: 60, rollOverlap: 45 })];
  const sameTierR = analyse(sameTier, { fps, auto: true });
  ok('K7 reports the hp spread the tier label hides (champion 2876 hp vs sap-speaker 380, both elite)',
    sameTierR.K7 && sameTierR.K7.status === 'pass' && sameTierR.K7.spread
      && sameTierR.K7.spread.late_over_first_hp !== null && sameTierR.K7.spread.late_over_first_hp < 0.5
      && !!sameTierR.K7.spread.note,
    `K7=${sameTierR.K7 && sameTierR.K7.status} (tier ladder), late/first hp = ` +
    `${sameTierR.K7 && sameTierR.K7.spread && sameTierR.K7.spread.late_over_first_hp} — ` +
    `${(sameTierR.K7 && sameTierR.K7.spread && sameTierR.K7.spread.note) ? 'noted' : 'NOT NOTED'}`);

  // ---- ROUND 3 (TOOL-COVERAGE-R2 §6): the clause must be LIVE against the REAL trace shape ----
  //
  // Round 2's clause looked for `player.loadout`, which no trace in this tree has ever carried,
  // so on every real run it returned GEAR_UNCHECKABLE and voided the comparison. Round 1 shipped
  // a clause that could not fail; round 2 shipped one that could not pass. These three cases use
  // the fields the shipped trace actually emits, keyed `f` as the shipped trace keys them.
  const realGreen = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12, realKit: REAL_KIT, frameKey: 'f' }),
    ...mkEnc(55, 120, 'champion_hist_marked', { hits: 10, rolls: 60, rollOverlap: 45, realKit: REAL_KIT, frameKey: 'f' })];
  const realGreenR = analyse(realGreen, { fps, auto: true });
  ok('GREEN: the gear clause is LIVE against the trace fields that exist, and PROCEEDS when the kit is unchanged',
    realGreenR.gear && realGreenR.gear.changed === false
    && !realGreenR.blockers.some((b) => b.code.startsWith('GEAR')),
    `read from ${realGreenR.gear && realGreenR.gear.source && realGreenR.gear.source.E_first}; ` +
    `changed=${realGreenR.gear && realGreenR.gear.changed}; blockers=` +
    `${realGreenR.blockers.map((b) => b.code).join(',') || '(none)'} — round 2 returned ` +
    `GEAR_UNCHECKABLE here and voided every real run`);

  const realRed = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12, realKit: REAL_KIT, frameKey: 'f' }),
    ...mkEnc(55, 120, 'champion_hist_marked', {
      hits: 10, rolls: 60, rollOverlap: 45, frameKey: 'f',
      realKit: { ...REAL_KIT, weapon_id: 'wpn-ebony-greatsword', weapon_class: 'greatsword', equip_load_pct: 63, roll_class: 'heavy' },
    })];
  const realRedR = analyse(realRed, { fps, auto: true });
  ok('RED: a weapon and burden change between the encounters VOIDS the comparison',
    realRedR.gear && realRedR.gear.changed === true
    && realRedR.blockers.some((b) => b.code === 'GEAR_CHANGED'),
    `diff: ${(realRedR.gear && realRedR.gear.diff || []).join('; ')}`);

  const realStance = [{ _: 'header' },
    ...mkEnc(19, 120, 'champion_hist_marked', { hits: 40, rolls: 60, rollOverlap: 12, realKit: REAL_KIT, frameKey: 'f' }),
    ...mkEnc(55, 120, 'champion_hist_marked', {
      hits: 10, rolls: 60, rollOverlap: 45, frameKey: 'f',
      realKit: { ...REAL_KIT, stance: 'two_handed' },
    })];
  const realStanceR = analyse(realStance, { fps, auto: true });
  ok('a STANCE change is reported but does NOT void: two-handing the same sword is not a shopping trip',
    realStanceR.gear && realStanceR.gear.changed === false
    && (realStanceR.gear.reported_not_blocking || []).length === 1
    && !realStanceR.blockers.some((b) => b.code.startsWith('GEAR')),
    `reported_not_blocking: ${(realStanceR.gear.reported_not_blocking || []).join('; ')} — RI-JRN02 §C ` +
    `bans an equipment UPGRADE; a clause that voided on stance would void every real fight, which ` +
    `is the "cannot pass" failure in a different coat`);

  ok('the shipped frame key `f` is read (round 2 read `frame`, so every window was empty)',
    !!realGreenR.E_first && realGreenR.E_first.from > 0 && realGreenR.E_late.from > realGreenR.E_first.from,
    `E_first window ${realGreenR.E_first && realGreenR.E_first.from}-${realGreenR.E_first && realGreenR.E_first.to}, ` +
    `E_late ${realGreenR.E_late && realGreenR.E_late.from}-${realGreenR.E_late && realGreenR.E_late.to}, ` +
    'from records keyed `f`');

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\ncompetence self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

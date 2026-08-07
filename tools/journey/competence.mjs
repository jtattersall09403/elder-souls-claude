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
//      taught the player to shop, not to fight." So the loadout is captured at both encounters
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
      k7 = { status: rb >= ra ? 'pass' : 'fail', early_tiers: a, late_tiers: b, why: rb >= ra ? null : 'E_late is a WEAKER enemy than E_first' };
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
    gear = compareLoadouts(frames, E_first, E_late);
    if (gear && gear.changed) {
      blockers.push({
        code: 'GEAR_CHANGED',
        why: `the loadout differs between E_first and E_late (${gear.diff.join('; ')}). RI-JRN02 §C ` +
             'requires "no equipment upgrade between them: if the improvement requires better gear, ' +
             'the game taught the player to shop, not to fight."',
        owner: 'the run',
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
    const fr = r.frame ?? 0;
    if (hostile) {
      if (cur && fr - cur.to <= GAP) { cur.to = fr; for (const i of ids) cur.enemies.push(i); }
      else { if (cur) out.push(cur); cur = { id: `E${out.length + 1}`, from: fr, to: fr, enemies: [...ids] }; }
    }
  }
  if (cur) out.push(cur);
  for (const e of out) e.enemies = [...new Set(e.enemies)].filter(Boolean);
  return out;
}

function compareLoadouts(frames, a, b) {
  const at = (f) => {
    for (let i = frames.length - 1; i >= 0; i--) {
      const r = frames[i];
      if ((r.frame ?? 0) <= f && r.player && r.player.loadout) return r.player.loadout;
    }
    return null;
  };
  const la = at(a.from), lb = at(b.from);
  if (!la || !lb) return { changed: null, why: 'no trace record carries player.loadout, so the no-upgrade clause cannot be checked' };
  const diff = [];
  for (const k of new Set([...Object.keys(la), ...Object.keys(lb)])) {
    if (JSON.stringify(la[k]) !== JSON.stringify(lb[k])) diff.push(`${k}: ${JSON.stringify(la[k])} -> ${JSON.stringify(lb[k])}`);
  }
  return { changed: diff.length > 0, diff };
}

/** K1..K6 over one encounter window. `null` where the trace does not carry the field. */
function measure(frames, enc, fps) {
  const win = frames.filter((r) => (r.frame ?? 0) >= enc.from && (r.frame ?? 0) <= enc.to);
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

  const mkEnc = (fromMin, n, statblock, { hits, rollOverlap, rolls }) => {
    const out = [];
    const f0 = Math.round(fromMin * 60 * fps);
    for (let i = 0; i < n; i++) {
      const evs = [{ type: 'enemy_state', statblock, alertState: 'AGGRO' }];
      if (i < hits) evs.push({ type: 'hit', target: 'player' });
      if (i < rolls) evs.push({ type: 'roll_start', iframe_overlap: i < rollOverlap });
      out.push({ frame: f0 + i * 10, events: evs, enemies: [{ statblock, alertState: 'AGGRO' }], player: { stamina: 50, stamina_max: 100 } });
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

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\ncompetence self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}

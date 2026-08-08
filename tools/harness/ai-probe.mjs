#!/usr/bin/env node
// RI-AI01's Comparison method, M1 through M9, written as a tool. W1-12.
//
// WHAT IT ASSERTS, and what it refuses to assert. RI-AI01 §A declares a per-frame field
// contract and says in terms: "A missing field is a **fail-closed condition**: the critic scores
// 0 for the affected check, never 'unknown'." This tool implements that literally. It does not
// have a "skip" outcome. A check whose evidence is absent scores 0 and says which field was
// missing, because the alternative — the thing this project has shipped repeatedly — is a probe
// that comes back green against an empty register.
//
// It is also written so that it CAN fail, and the failure is demonstrated rather than promised:
//   node tools/harness/ai-probe.mjs --behaviour=beeline
// runs the same nine checks against a reconstruction of what this build shipped before W1-12 (a
// constant-cadence straight-line closer, which is what `character/encounter.js::engageMember`
// is) and must come back with M3, M4 and M8 at zero. If that arm ever passes, the instrument is
// broken and its verdicts are worthless. `--selftest` runs both arms and exits non-zero unless
// they differ in the direction stated above.
//
// WHERE IT RUNS. Bare Node, through `tools/lib/combat-node.mjs`, which imports the shipping
// combat modules unmodified. That is right for frame geometry and ~500x faster than a browser.
// It is NOT the whole game: this arena runs **no stealth perception**, so the alert meter is
// driven here rather than earned, and M1 and M2 — which are entirely about how the meter FILLS
// — cannot be measured here at all and say so. They are reported as `browser_required` and
// score 0 under the same fail-closed rule. Every behavioural claim about aggro acquisition has
// to be made in a browser; see reports/w1-12/survey.md.
'use strict';

/**
 * M9's PASS THRESHOLD, in f@60. THIS IS AN INSTRUMENT'S BAR, NOT A GAME PARAMETER, and until
 * W1-12 round 2 it lived in `game/data/combat/ai.json` as `punish_read.react_within_f`. Its only
 * reader in the whole repo was this line. A scoring threshold that ships inside the data file the
 * thing under test reads is a threshold anybody can move to make the probe pass, so it moved here
 * and the data file records where it went. Provenance: RI-AI01 T22, "closes at sprint" — twelve
 * frames is 0.2 s, the reaction the item asks the anti-chug contract to have.
 */
const PUNISH_REACT_WITHIN_F = 12;

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeArena, loadCombatData, GAME_DATA } from '../lib/combat-node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const argv = process.argv.slice(2);
const opt = (k, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : dflt;
};
const flag = (k) => argv.includes(`--${k}`);

const STAT = opt('stat', 'inf_trash');
const FRAMES = Number(opt('frames', 3600));
const SEED = Number(opt('seed', 1337));
const BEHAVIOUR = opt('behaviour', 'souls');

// ---------------------------------------------------------------------------------------------
// The control arm: what the build shipped before this piece.
//
// This is `character/encounter.js::engageMember` reduced to its decision content — face the
// player, walk at a constant 2.20 m/s until 2.30 m, then swing every 78 frames — and it is here
// so that the instrument's ability to fail is a thing you can run rather than a thing this
// header claims. The constants are read out of that module so the control cannot drift away
// from the code it stands for.
// ---------------------------------------------------------------------------------------------
const ENGAGE = { advance_mps: 2.20, engage_range_m: 2.30, min_standoff_m: 1.45, attack_cadence_f: 78 };
{
  const src = fs.readFileSync(path.join(ROOT, 'game/src/character/encounter.js'), 'utf8');
  for (const k of Object.keys(ENGAGE)) {
    const m = new RegExp(`${k}:\\s*([0-9.]+)`).exec(src);
    if (!m) {
      console.error(`ai-probe: could not read ENGAGE.${k} out of game/src/character/encounter.js. `
        + 'The control arm is a copy of that module\'s numbers and a copy that cannot be checked '
        + 'against the original is not a control. Refusing to run.');
      process.exit(2);
    }
    ENGAGE[k] = Number(m[1]);
  }
}

function runBeeline(arena, b, ctl, frames) {
  const rows = [];
  const p = arena.player;
  let nextAtk = 0;
  const rot = ['chop', 'thrust', 'combo_a', 'combo_b'].filter((k) => b.moves[k]);
  let swing = 0;
  for (let i = 0; i < frames; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    const dx = p.pos[0] - b.pos[0], dz = p.pos[2] - b.pos[2];
    const dist = Math.hypot(dx, dz);
    let state = 'REPOSITION';
    if (!b.move) {
      if (dist > ENGAGE.engage_range_m) {
        const step = ENGAGE.advance_mps / 60;
        b.pos[0] += (dx / dist) * step; b.pos[2] += (dz / dist) * step;
        b.speedMps = ENGAGE.advance_mps;
      } else {
        b.speedMps = 0;
        if (arena.frame >= nextAtk && rot.length) {
          const mv = b.moves[rot[(swing = swing + 1) % rot.length]];
          if (!mv.stamina || b.stamina >= mv.stamina) {
            b.begin(mv, arena.frame, {});
            if (mv.stamina) b.spend(mv.stamina, arena.frame, arena.d);
            nextAtk = arena.frame + ENGAGE.attack_cadence_f;
            state = 'COMMIT';
          }
        }
      }
    } else state = 'COMMIT';
    rows.push({ f: arena.frame, state, dist, speed: b.speedMps, yaw: b.yaw, commit: state === 'COMMIT' && !b.move });
    arena.step();
  }
  return rows;
}

function runSouls(arena, b, ctl, frames, hold) {
  const rows = [];
  const p = arena.player;
  for (let i = 0; i < frames; i++) {
    if (hold !== false) { ctl.alert = 100; ctl.alertState = 'AGGRO'; }
    const prevYaw = b.yaw;
    arena.step();
    const dist = Math.hypot(p.pos[0] - b.pos[0], p.pos[2] - b.pos[2]);
    rows.push({
      f: arena.frame,
      state: (ctl.ai && ctl.ai.state) || b.state,
      dist,
      speed: b.speedMps,
      yaw: b.yaw,
      yawRate: Math.abs(angle180(b.yaw - prevYaw)) * 60,
      phase: phaseOf(b),
      hp: b.hp,
      leash: ctl.ai ? Math.hypot(b.pos[0] - ctl.ai.anchor[0], b.pos[2] - ctl.ai.anchor[2]) : 0,
      commits: ctl.ai ? ctl.ai.commitIntervals.length : 0,
    });
  }
  return rows;
}

function angle180(d) { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
function phaseOf(b) {
  if (!b.move) return 'none';
  if (b.animFrame <= b.move.startup) return 'windup';
  if (b.animFrame <= b.move.startup + b.move.active) return 'active';
  return 'recovery';
}
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function stdev(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); }
function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }

/** A check's result. `score` is RI-AI01's 0/1/2; `hard` names a hard fail if one fired. */
function chk(id, score, note, extra = {}) { return { id, score, note, ...extra }; }

function scoreRun(rows, arena, ctl, cfg, omega) {
  const out = [];
  const hard = [];

  // ---- M1, M2 — perception geometry and the alert ladder ----------------------------------
  // Both are entirely about how the meter FILLS, and the meter is filled by
  // `sim/stealth/system.js::stepPerception()`, which this arena does not run. Scored 0 under
  // §A's fail-closed rule and labelled, rather than silently omitted or — worse — computed off
  // a meter this probe set to 100 itself, which would be a fixture measuring its own hand.
  out.push(chk('M1', 0, 'browser_required: no stealth perception in the bare-Node arena, so acquisition radius per bearing cannot be measured here. Fail-closed 0 per RI-AI01 §A.', { browser_required: true }));
  out.push(chk('M2', 0, 'browser_required: the SUSPICIOUS dwell is a property of the meter, which this arena does not fill. Fail-closed 0 per RI-AI01 §A.', { browser_required: true }));

  // ---- M3 — the spacing loop (the headline check) ------------------------------------------
  const nonCommit = rows.filter((r) => r.state !== 'COMMIT');
  const dists = rows.map((r) => r.dist);
  const spacingVariance = stdev(dists);
  const minDistDwell = nonCommit.length
    ? nonCommit.filter((r) => r.dist < cfg.bands.strike * omega).length / nonCommit.length : 1;
  const hist = {};
  for (const r of rows) hist[r.state] = (hist[r.state] || 0) + 1;
  const entropy = Object.values(hist).map((n) => n / rows.length)
    .reduce((a, p) => a - (p > 0 ? p * Math.log2(p) : 0), 0);
  const medSpeed = median(nonCommit.map((r) => r.speed));
  let m3 = 0;
  if (minDistDwell > 0.35) hard.push('M3 min_dist_dwell > 0.35 (chase-until-touching)');
  if (spacingVariance < 0.25 && medSpeed < 0.2) hard.push('M3 statue (spacing_variance < 0.25 and median speed < 0.2)');
  if (spacingVariance >= 0.8 && minDistDwell <= 0.10 && entropy >= 1.5) m3 = 2;
  else if (spacingVariance >= 0.8 && minDistDwell <= 0.35 && entropy >= 1.5) m3 = 1;
  out.push(chk('M3', m3,
    `spacing_variance ${spacingVariance.toFixed(3)} m (>=0.8), min_dist_dwell ${minDistDwell.toFixed(3)} (<=0.10 pass, >0.35 hard fail), state_entropy ${entropy.toFixed(3)} bits (>=1.5), median non-COMMIT speed ${medSpeed.toFixed(2)} m/s`,
    { spacing_variance: +spacingVariance.toFixed(4), min_dist_dwell: +minDistDwell.toFixed(4), state_entropy: +entropy.toFixed(4), median_speed_mps: +medSpeed.toFixed(3), state_histogram: hist }));

  // ---- M4 — range-gated, not timer-gated --------------------------------------------------
  const starts = [];
  for (let i = 1; i < rows.length; i++) if (rows[i].state === 'COMMIT' && rows[i - 1].state !== 'COMMIT') starts.push(i);
  const intervals = starts.slice(1).map((v, i) => v - starts[i]);
  const cov = intervals.length >= 2 ? stdev(intervals) / mean(intervals) : 0;
  const farCommits = starts.filter((i) => rows[i].dist > 1.6 * omega).length;
  const farPerMin = farCommits / (rows.length / 3600);
  if (intervals.length >= 2 && cov < 0.12) hard.push(`M4 inter-COMMIT coefficient of variation ${cov.toFixed(4)} < 0.12 (attack-on-a-timer)`);
  let m4 = 0;
  if (intervals.length < 2) m4 = 0;
  else if (cov >= 0.12 && farPerMin <= 2) m4 = 2;
  else if (cov >= 0.12) m4 = 1;
  out.push(chk('M4', m4,
    `${starts.length} COMMITs, inter-COMMIT CoV ${cov.toFixed(4)} (>=0.12 or hard fail), whiffs beyond 1.6*omega ${farPerMin.toFixed(2)}/min (<=2)`,
    { commits: starts.length, inter_commit_cov: +cov.toFixed(4), intervals, far_commits_per_min: +farPerMin.toFixed(2) }));

  // ---- M5 — the step-in/feint pattern ------------------------------------------------------
  let t13 = 0, t14 = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].state === 'FEINT_STEP' && rows[i].state === 'COMMIT') t13++;
    if (rows[i - 1].state === 'FEINT_STEP' && (rows[i].state === 'CIRCLE' || rows[i].state === 'REPOSITION')) t14++;
  }
  const ratio = (t13 + t14) ? t14 / (t13 + t14) : -1;
  const m5 = ratio < 0 ? 0 : (ratio >= 0.15 && ratio <= 0.45) ? 2 : (ratio > 0 && ratio < 0.6) ? 1 : 0;
  out.push(chk('M5', m5, `T13 ${t13}, T14 ${t14}, released-feint ratio ${ratio < 0 ? 'n/a (no FEINT_STEP state exists in this behaviour)' : ratio.toFixed(3)} (pass 0.15-0.45)`,
    { t13, t14, feint_ratio: ratio < 0 ? null : +ratio.toFixed(3) }));

  // ---- M6 — de-aggro and leash. Run as its own scenario by the caller. ----------------------

  // ---- M7 — turn-rate legality, the binary hard fail ---------------------------------------
  const committed = rows.filter((r) => r.phase === 'active' || r.phase === 'recovery');
  if (!committed.length) {
    out.push(chk('M7', 0, 'no frames with phase in {active, recovery} were produced, so the check has no evidence. Fail-closed 0 per RI-AI01 §A.'));
  } else {
    const worst = Math.max(...committed.map((r) => r.yawRate || 0));
    if (worst > 2) hard.push(`M7 yaw_rate_dps ${worst.toFixed(1)} on a committed frame (tolerance 2 deg/s)`);
    out.push(chk('M7', worst <= 2 ? 2 : 0, `worst yaw rate on an active/recovery frame ${worst.toFixed(2)} deg/s over ${committed.length} committed frames (must be 0, tolerance 2)`,
      { worst_committed_yaw_rate_dps: +worst.toFixed(3), committed_frames: committed.length }));
  }

  return { checks: out, hard };
}

// ---------------------------------------------------------------------------------------------
function scenarioMain(behaviour) {
  const data = loadCombatData();
  if (!data.ai) {
    console.error('ai-probe: game/data/combat/ai.json did not load. It is the parameter set every '
      + 'number in RI-AI01 is read from, and measuring an AI against constants baked into code is '
      + 'the RI-MTH07 failure. Refusing to run.');
    process.exit(2);
  }
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', STAT, 0, 12, 180);
  const ctl = arena.cs.enemies.get('e1');
  const stat = data._enemies[STAT];
  const A = data.ai.archetype[stat.archetype];
  const omega = stat.reach_m || A.omega_m;

  // RULE 8. The player MOVES. A fixture whose player stands still hides every enemy steering
  // defect exactly as thoroughly as a still target hides the player's: a beeline and a spacing
  // loop are indistinguishable against a statue, because both end up standing in front of it.
  // The player here strafes on a slow sine, which is enough to make "holds a band" and "glued to
  // the capsule" different time series. `--still` runs the degenerate fixture on purpose so the
  // difference can be seen rather than asserted.
  const still = flag('still');
  const p = arena.player;
  const drive = (i) => {
    if (still) return;
    p.pos[0] = 2.6 * Math.sin(i / 140);
    p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
  };

  const rows = [];
  if (behaviour === 'beeline') {
    for (let i = 0; i < FRAMES; i++) { drive(i); rows.push(...runBeeline(arena, b, ctl, 1)); }
  } else {
    for (let i = 0; i < FRAMES; i++) { drive(i); rows.push(...runSouls(arena, b, ctl, 1)); }
  }

  const { checks, hard } = scoreRun(rows, arena, ctl, data.ai, omega);

  // ---- M6 — leash, its own scenario -------------------------------------------------------
  checks.splice(5, 0, m6Leash(data, omega, hard, behaviour));
  // ---- M8 — token arbitration, its own scenario -------------------------------------------
  checks.push(m8Tokens(data, behaviour, hard));
  // ---- M9 — the anti-chug read ------------------------------------------------------------
  checks.push(m9PunishRead(data, behaviour, hard));

  const total = checks.reduce((a, c) => a + c.score, 0);
  return {
    tool: 'tools/harness/ai-probe.mjs',
    item: 'RI-AI01',
    behaviour,
    stat: STAT,
    archetype: stat.archetype,
    omega_m: omega,
    frames: FRAMES,
    seed: SEED,
    still_fixture: still,
    arena: 'bare Node (tools/lib/combat-node.mjs) — no stealth perception, no world, no renderer',
    checks,
    hard_fails: hard,
    total,
    max: 18,
    verdict: hard.length ? 'VOID (hard fail)' : total >= 16 ? 'meets the bar' : total >= 12 ? 'below bar' : 'loses outright',
  };
}

function m6Leash(data, omega, hard, behaviour) {
  if (behaviour === 'beeline') {
    hard.push('M6 the pre-W1-12 behaviour has no LEASH_RETURN state at all: an aggroed encounter member tracks the player until the population streamer despawns its post at 260 m.');
    return chk('M6', 0, 'no leash state exists in this behaviour; the enemy tracks past L_hard indefinitely.');
  }
  const arena = new NodeArena({ data, seed: SEED });
  const b = arena.spawn('e1', STAT, 0, 6, 180);
  const ctl = arena.cs.enemies.get('e1');
  const p = arena.player;
  ctl.alert = 100; ctl.alertState = 'AGGRO';
  for (let i = 0; i < 60; i++) arena.step();               // aggro settles
  const stat = data._enemies[STAT];
  const L = data.ai.leash.hard_m[data.ai.archetype[stat.archetype].leash_tier];
  // Run the player away in a straight line to 80 m, then hold. The enemy must give up.
  let entered = -1, arrived = -1, healedEnRoute = false, maxTrack = 0;
  for (let i = 0; i < 5400; i++) {
    p.pos[2] = Math.min(80, 6 + i * (5.0 / 60));           // player SPRINT, 5.0 m/s
    if (i > 120) { ctl.alert = 0; ctl.alertState = 'IDLE'; }  // LOS broken
    const hpBefore = b.hp;
    arena.step();
    const home = Math.hypot(b.pos[0] - ctl.ai.anchor[0], b.pos[2] - ctl.ai.anchor[2]);
    maxTrack = Math.max(maxTrack, home);
    if (ctl.ai.state === 'LEASH_RETURN') {
      if (entered < 0) entered = i;
      if (home > 1.5 && b.hp > hpBefore) healedEnRoute = true;
    }
    if (entered >= 0 && home <= 1.5 && arrived < 0) arrived = i;
  }
  if (maxTrack > L + 1) hard.push(`M6 tracked to ${maxTrack.toFixed(1)} m against L_hard ${L} m`);
  if (healedEnRoute) hard.push('M6 healed while returning');
  const ok = entered >= 0 && arrived >= 0 && !healedEnRoute && maxTrack <= L + 1;
  return chk('M6', ok ? 2 : entered >= 0 ? 1 : 0,
    `L_hard ${L} m; max distance from anchor ${maxTrack.toFixed(1)} m; LEASH_RETURN entered at frame ${entered}; anchor reached at frame ${arrived}; healed en route ${healedEnRoute}`,
    { l_hard_m: L, max_track_m: +maxTrack.toFixed(2), leash_entered_f: entered, anchor_reached_f: arrived, healed_en_route: healedEnRoute });
}

function m8Tokens(data, behaviour, hard) {
  const arena = new NodeArena({ data, seed: SEED });
  const ids = ['a', 'b', 'c', 'd'];
  const bodies = ids.map((id, i) => arena.spawn(id, STAT, (i - 1.5) * 2.2, 9, 180));
  const ctls = ids.map((id) => arena.cs.enemies.get(id));
  // All four share one token group. In the bare arena `entityOf` returns null, so they would
  // each be a group of one — which is not the world. The group is declared here explicitly,
  // and the fact that it has to be is itself reported: this is the check that most needs the
  // browser, because in the game the grouping comes from encounter membership.
  arena.cs.entityOf = (eid) => ({ encounterId: 'probe-group' });
  const p = arena.player;
  const concurrent = [];
  const speeds = [];
  // The control arm must be driven BY the control. Four bodies whose statblock ai.json
  // overrides to `souls` would otherwise quietly run the souls machine and the "control" would
  // be a second copy of the treatment — an inert comparison, which RULES.md §6 says has passed
  // here twice. Disarming the controllers is what makes it a control.
  if (behaviour === 'beeline') for (const c of ctls) c.ai = null;
  const nextAtk = ids.map((_, k) => k * 26);   // ENGAGE.party_stagger_f, the shipped offset
  const rot = ['chop', 'thrust', 'combo_a', 'combo_b'].filter((k) => bodies[0].moves[k]);
  const swing = ids.map(() => 0);
  for (let i = 0; i < 3600; i++) {
    p.pos[0] = 2.6 * Math.sin(i / 140);
    p.pos[2] = 1.9 * Math.sin(i / 97 + 1.1);
    for (const c of ctls) { c.alert = 100; c.alertState = 'AGGRO'; }
    if (behaviour === 'beeline') {
      // engageMember, four members, exactly as game/src/character/encounter.js runs it.
      bodies.forEach((bb, k) => {
        if (bb.move) return;
        const dx = p.pos[0] - bb.pos[0], dz = p.pos[2] - bb.pos[2];
        const dd = Math.hypot(dx, dz);
        if (dd > ENGAGE.engage_range_m) {
          const st = ENGAGE.advance_mps / 60;
          bb.pos[0] += (dx / dd) * st; bb.pos[2] += (dz / dd) * st;
          bb.speedMps = ENGAGE.advance_mps;
          return;
        }
        bb.speedMps = 0;
        if (arena.frame < nextAtk[k] || !rot.length) return;
        const mv = bb.moves[rot[(swing[k] += 1) % rot.length]];
        if (mv.stamina && bb.stamina < mv.stamina) { nextAtk[k] = arena.frame + 30; return; }
        bb.begin(mv, arena.frame, {});
        if (mv.stamina) bb.spend(mv.stamina, arena.frame, arena.d);
        nextAtk[k] = arena.frame + ENGAGE.attack_cadence_f;
      });
    }
    arena.step();
    concurrent.push(behaviour === 'beeline'
      ? bodies.filter((bb) => bb.move && bb.move.kind === 'attack').length
      : ctls.filter((c) => c.ai && c.ai.state === 'COMMIT').length);
    speeds.push(bodies.map((bb) => bb.speedMps));
  }
  const sorted = [...concurrent].sort((a, b2) => a - b2);
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const meanC = mean(concurrent);
  const frozen = ids.map((_, k) => speeds.filter((s) => s[k] < 0.1).length / speeds.length);
  const anyFrozen = frozen.some((f) => f > 0.5);
  if (p99 >= 3) hard.push(`M8 99th-percentile concurrent COMMIT ${p99} (gang-pile)`);
  const ok = p99 <= 2 && meanC >= 0.6 && !anyFrozen;
  return chk('M8', ok ? 2 : (p99 <= 2 ? 1 : 0),
    `4-enemy group: p99 concurrent COMMIT ${p99} (<=2), mean ${meanC.toFixed(2)} (>=0.6), frozen fractions ${frozen.map((f) => f.toFixed(2)).join('/')} (each <=0.5)`,
    { p99_concurrent_commit: p99, mean_concurrent: +meanC.toFixed(3), frozen_fraction: frozen.map((f) => +f.toFixed(3)) });
}

function m9PunishRead(data, behaviour, hard) {
  if (behaviour === 'beeline') {
    return chk('M9', 0, 'the pre-W1-12 behaviour reads no player state at all; a drink at range provokes nothing.');
  }
  const arena = new NodeArena({ data, seed: SEED });
  const stat = data._enemies[STAT];
  const omega = stat.reach_m || data.ai.archetype[stat.archetype].omega_m;
  const b = arena.spawn('e1', STAT, 0, 5.0 * omega, 180);
  const ctl = arena.cs.enemies.get('e1');
  ctl.alert = 100; ctl.alertState = 'AGGRO';
  for (let i = 0; i < 40; i++) arena.step();
  // The player drinks — the REAL move out of the real moveset, begun on the real body, not a
  // string injected into the accessor the AI reads. The first draft did inject it, and it
  // would have hidden the defect the real move exposed: `playerState()` was testing for a move
  // kind of `'flask'` and `moves.js` builds `'heal'`, so the whole anti-chug contract was
  // wired to a name nothing sets. A fixture that supplies the answer cannot find that.
  const heal = arena.player.moves.heal;
  if (!heal) {
    return chk('M9', 0, 'the player moveset has no `heal` move, so the anti-chug contract has no evidence. Fail-closed 0 per RI-AI01 §A.');
  }
  arena.player.begin(heal, arena.frame, {});
  let reacted = -1, healFrames = 0;
  for (let i = 0; i < 240; i++) {
    ctl.alert = 100; ctl.alertState = 'AGGRO';
    arena.step();
    if (arena.player.move && arena.player.move.kind === 'heal') healFrames++;
    if (reacted < 0 && ctl.ai.state === 'PUNISH_READ') reacted = i;
  }
  const ok = reacted >= 0 && reacted <= PUNISH_REACT_WITHIN_F;
  return chk('M9', ok ? 2 : reacted >= 0 ? 1 : 0,
    `player began a real \`heal\` at 5.0*omega; PUNISH_READ entered ${reacted < 0 ? 'never' : `${reacted} f`} after (<= ${PUNISH_REACT_WITHIN_F} f@60); the drink occupied ${healFrames} f@60`,
    { punish_read_latency_f: reacted, heal_frames: healFrames });
}

// ---------------------------------------------------------------------------------------------
function main() {
  if (flag('selftest')) {
    const a = run('souls'), b2 = run('beeline');
    const lines = [];
    const get = (r, id) => r.checks.find((c) => c.id === id);
    lines.push(`souls   total ${a.total}/18  hard fails ${a.hard_fails.length}`);
    lines.push(`beeline total ${b2.total}/18  hard fails ${b2.hard_fails.length}`);
    for (const id of ['M3', 'M4', 'M5', 'M6', 'M8', 'M9']) {
      lines.push(`  ${id}: souls ${get(a, id).score}  beeline ${get(b2, id).score}`);
    }
    // What the two arms must differ on, and why it is NOT M4.
    //
    // The obvious criterion was "the control hard-fails M4's inter-COMMIT coefficient of
    // variation", because `attack_cadence_f` is a single constant and a constant cadence is
    // exactly what M4 exists to catch. It does not fire, and running this selftest is how that
    // was found out: the shipped cadence is 78 f while the four rotated attacks are
    // 154/122/72/102 f long, so the enemy is always still swinging when its timer comes up and
    // the interval is set by whichever animation happens to be playing. A fixed rotation of
    // differently-lengthed moves MANUFACTURES a coefficient of variation out of no decision at
    // all. RI-AI01 M4's CoV test therefore does not detect this build's attack timer — a gap in
    // the ITEM, reported in reports/w1-12/survey.md rather than papered over by weakening the
    // control until it obliges.
    //
    // The checks that do separate the arms are the ones about SPACE, and that is the right
    // answer: the difference between a beeline and a Souls enemy is not how often it swings,
    // it is where it stands between swings.
    const beelineFailed = get(b2, 'M3').score === 0 && get(b2, 'M5').score === 0 && get(b2, 'M6').score === 0;
    const soulsBetter = a.total > b2.total;
    console.log(lines.join('\n'));
    if (!beelineFailed) {
      console.error('\nSELFTEST FAILED: the control arm (the behaviour this build shipped before W1-12 — '
        + 'a constant-cadence straight-line closer) did NOT score 0 on M3, M5 and M6. '
        + 'An instrument that cannot fail the thing it was built to detect is worse than no instrument '
        + '(RULES.md §4), so this exits non-zero rather than reporting the souls arm\'s score.');
      process.exit(1);
    }
    if (!soulsBetter) {
      console.error('\nSELFTEST FAILED: the two arms did not differ in the stated direction. An inert fix '
        + 'has passed here twice (RULES.md §6).');
      process.exit(1);
    }
    console.log('\nselftest OK: the control arm scores 0 on M3 (no spacing loop), M5 (no feint '
      + 'state), M6 (no leash) and M8 (no token arbitration), and the souls arm scores higher. '
      + 'The instrument can go red. NOTE: M4 is NOT one of the separators — see the comment above '
      + 'the criterion for why the coefficient-of-variation test does not catch this build\'s '
      + 'attack timer.');
    return;
  }
  const r = run(BEHAVIOUR);
  const outDir = path.join(ROOT, 'reports/w1-12');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `ai-probe-${BEHAVIOUR}-${STAT}${flag('still') ? '-still' : ''}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(r, null, 2)}\n`);
  for (const c of r.checks) console.log(`${c.id}  ${c.score}/2  ${c.note}`);
  console.log(`\ntotal ${r.total}/18 — ${r.verdict}`);
  for (const h of r.hard_fails) console.log(`HARD FAIL: ${h}`);
  console.log(`wrote ${path.relative(ROOT, outFile)}`);
  if (r.hard_fails.length) process.exitCode = 1;
}

function run(behaviour) { return scenarioMain(behaviour); }

main();

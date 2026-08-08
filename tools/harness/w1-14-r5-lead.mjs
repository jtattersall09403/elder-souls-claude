#!/usr/bin/env node
// w1-14-r5-lead.mjs — CAN A BOLT HIT A BODY THAT WALKS?
//
// `GAP-W1-magic-bolt-cannot-lead-a-body-that-walks` is the W1-14 round-4 verdict's single
// biggest gap and it had been named for two rounds before anybody measured it. It survived
// because every fixture that has ever measured magic in this project used a target that does
// not move — RULES.md #8 in its purest form.
//
// THIS FIXTURE OBEYS RULE 8 AGAINST ITSELF. The round-4 critic found the defect with ONE range
// and one direction of travel, and its own §12 says so: "if you fix the leading and then measure
// it against a target moving in one direction at one speed, you have built the next round's
// finding." So the grid here is RANGE x SPEED x DIRECTION x CAST CLASS:
//
//   * five ranges          6, 10, 14, 20, 28 m
//   * eleven motions       still; strafe left and RIGHT at 1.5, 3.0 and 5.0 m/s; retreat;
//                          advance; both diagonals; and a real ORBIT around the caster, whose
//                          path is curved and therefore violates the constant-velocity
//                          assumption the fix is built on. That last one is in the table on
//                          purpose: a fixture that only ever presents straight lines to a
//                          straight-line predictor is a fixture that agrees with itself.
//   * four ballistic classes  CANTRIP and GREAT declare `turn_rate_dps: 0` and are expected to
//                          MISS a moving body — they are the dodgeable ones, by declaration —
//                          against LIGHT and HEAVY which declare an arc.
//   * five damage effects   at the acceptance cells, because the round-4 table reported all five
//                          at zero and a fix that repairs one of them has repaired nothing.
//
// THE TARGET'S MOTION IS DEMONSTRATED, NOT ASSUMED. Every cell reports the displacement it
// measured off `listEntities()`, and the run FAILS if a cell that was supposed to move did not:
// the round-4 critic's first attempt at this arm was vacuous for exactly that reason and it says
// so in its own §11.
//
// ARMS
//   (default)          the fix, at this commit — THE POSITIVE ARM, published with the teardowns
//   --break=nolead     pure pursuit: the bolt steers at where the body IS. Round 4's world.
//   --arm=dodge        a body that ROLLS out of the path after the tracking cutoff. This is the
//                      arm that stops the remedy being "home harder": a fix that lands every
//                      bolt including this one has broken RI-CMB01's dodge contract, and that is
//                      an AR-1 problem rather than a win.
//
// USAGE  node tools/harness/w1-14-r5-lead.mjs [--break nolead] [--out <dir>] [--quick]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r5-lead.mjs — a bolt against a body that is going somewhere.

  --break nolead   pure pursuit (round 4's world). Default: the fix.
  --quick          the acceptance grid only (2 ranges x 4 motions x 5 effects), no class sweep.
  --out <dir>      report directory (default reports/w1-14-r5)

Exit 4 if any cell that declares motion could not be shown to have moved — an unmovable target
makes the whole comparison vacuous, which is the failure this tool exists to avoid.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const BREAK = args.break ? String(args.break) : null;
const QUICK = !!args.quick;
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r5');
ensureDir(outDir);

const RUN = (page, opts) => page.evaluate(async (o) => {
  const H = window.__HARNESS;
  await H.ready();
  const r2 = (v) => Math.round(v * 100) / 100;

  const setupCaster = () => {
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(4000000); H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  };
  const posOf = (eid) => {
    const e = (H.listEntities() || []).find((x) => x.eid === eid || x.id === eid);
    return e && e.pos ? e.pos.slice() : null;
  };

  // Motions are declared as a per-frame displacement in metres, which at 60 f@60 is m/s / 60.
  // `orbit` is a function of the frame rather than a constant, so its path is a real arc.
  const MOTIONS = {
    still:        { label: 'standing still',                    v: () => [0, 0] },
    strafe_r15:   { label: 'walking right, 1.5 m/s',            v: () => [1.5 / 60, 0] },
    strafe_l15:   { label: 'walking LEFT, 1.5 m/s',             v: () => [-1.5 / 60, 0] },
    strafe_r30:   { label: 'jogging right, 3.0 m/s',            v: () => [3.0 / 60, 0] },
    strafe_l30:   { label: 'jogging LEFT, 3.0 m/s',             v: () => [-3.0 / 60, 0] },
    strafe_r50:   { label: 'sprinting right, 5.0 m/s',          v: () => [5.0 / 60, 0] },
    retreat_30:   { label: 'retreating along the axis, 3.0 m/s', v: () => [0, 3.0 / 60] },
    advance_30:   { label: 'closing along the axis, 3.0 m/s',   v: () => [0, -3.0 / 60] },
    diag_out:     { label: 'away and across, 1.5 + 1.5 m/s',    v: () => [1.5 / 60, 1.5 / 60] },
    diag_in:      { label: 'in and across, 1.5 + 1.5 m/s',      v: () => [1.5 / 60, -1.5 / 60] },
    orbit:        { label: 'circling the caster at 1.5 m/s',    orbit: 1.5 },
  };

  /**
   * One cell. Spawns a body at `dz` metres straight ahead, presses the real cast button, and
   * drives the body along the declared path one frame at a time while the bolt is in the air.
   */
  const cell = (eff, dz, motionId, cls, dodge, aim) => {
    const M = MOTIONS[motionId];
    H.setSeed(31); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    setupCaster();
    if (o.brk === 'nolead') H.__breakLead(true); else if (H.__breakLead) H.__breakLead(false);
    const spec = { class: cls, range: 'projectile', effects: [{ effect: eff, magnitude: 20, duration_s: 0, area_r_m: 0 }] };
    const mk = H.makeSpell(spec, `r5 lead ${eff} ${cls} ${dz} ${motionId}`);
    if (mk.refused) return { refused: mk.reason || mk.gate };
    H.setAttuned([mk.spell.id]);
    const sp = H.spawn('drowned_lesser', 0, dz);
    const eid = sp && sp.eid ? sp.eid : sp;
    // IS THE CASTER LOOKING AT THE THING THEY ARE CASTING AT?
    //
    // This dimension is here because the first run of this probe reported a miss at 6 m against
    // a 3 m/s crosser and the frame dump said why: the body had walked 1.45 m — 13.6 degrees —
    // off the caster's nose during the 24-frame startup, and the caster never turned, so most
    // of the arc the bolt was being asked to buy was correcting the PLAYER'S AIM. RI-MAG01 M4
    // exists to stop a bolt doing that (median residual aim error >= 25 deg at the release
    // frame, and a FAIL below 10), so a lead that closed it would be auto-aim wearing a fix's
    // name. Lock-on is a free action at any stamina (RI-CMB03 §B) and a locked, stationary body
    // turns onto its target (`combat/player.js` ~1069). So both are measured: `locked` is a
    // player who is looking at the enemy, `free` is a player who is not, and the second one
    // missing at close range against a fast crosser is the aim contract working.
    const locked = aim !== 'free';
    if (locked) H.lockOn(eid);
    const p0 = posOf(eid);
    const hp0 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
    H.magicEventsDrain(); H.traceDrain();
    // The body is driven from the first frame, and the cast is pressed 30 frames in — so the
    // caster is tracking a body that is ALREADY moving when the button goes down, which is the
    // case a fight actually presents. Pressing on frame 2 against a body that started moving on
    // frame 2 is a standing start dressed as a strafe.
    const PRESS_F = 30;
    H.queueInputs([{ f: PRESS_F, press: ['light'] }, { f: PRESS_F + 3, release: ['light'] }]);
    let x = 0, z = dz, ang = 0;
    const R = Math.hypot(0, dz) || 1;
    for (let f = 0; f < 260; f++) {
      H.stepFrames(1);
      if (M.orbit) {
        // A real arc: constant tangential speed about the caster, radius held.
        ang += (M.orbit / R) / 60;
        x = R * Math.sin(ang); z = R * Math.cos(ang);
        H.setEntityPos(eid, x, z);
      } else {
        const [vx, vz] = M.v(f);
        if (vx || vz) { x += vx; z += vz; H.setEntityPos(eid, x, z); }
      }
      // THE DODGE ARM. A roll is a fast lateral displacement, and it is applied LATE — after the
      // tracking cutoff has closed — which is when a player who reads the bolt would roll.
      if (dodge && f === PRESS_F + dodge.atF) { x += dodge.dx; H.setEntityPos(eid, x, z); }
    }
    const p1 = posOf(eid);
    const after = (H.getCombatState().enemies.find((e) => e.id === eid) || {});
    const mev = H.magicEventsDrain();
    const tr = H.traceDrain();
    const hits = (tr.events || tr || []).filter((e) => e.kind === 'spell_hit' || e.type === 'spell_hit');
    const miss = mev.filter((e) => e.kind === 'spell_miss');
    const hitEv = hits.find((e) => !e.miss) || null;
    const out = {
      damage: hp0 !== undefined && after.hp !== undefined ? r2(hp0 - after.hp) : null,
      moved_m: p0 && p1 ? r2(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])) : null,
      closest_m: hitEv ? hitEv.closest_m : (miss.length ? miss[0].closest_m : null),
      hit_radius_m: miss.length ? miss[0].hit_radius_m : (hitEv ? null : null),
      travel_f: hitEv ? hitEv.travel_f : (miss.length ? miss[0].travel_f : null),
      cutoff_f: miss.length ? miss[0].tracking_cutoff_f : null,
      led: hitEv ? hitEv.led : (miss.length ? miss[0].led : null),
      missed: miss.length > 0 && !hitEv,
    };
    try { H.despawn(eid); } catch (e) { /* gone */ }
    return out;
  };

  const out = { arm: o.brk || 'fix', quick: !!o.quick };
  const RANGES = o.quick ? [6, 14] : [6, 10, 14, 20, 28];
  const MOT = o.quick ? ['still', 'strafe_r15', 'strafe_r30', 'retreat_30']
    : Object.keys(MOTIONS);
  const EFFECTS = ['damage_health', 'fire_damage', 'frost_damage', 'shock_damage', 'poison_damage'];

  // ---- A. THE ACCEPTANCE GRID: five damage effects, LIGHT/projectile ---------------------------
  // The round-4 verdict's acceptance is written as a probe assertion and this is it, widened to
  // five ranges and eleven motions because one of each is how the defect survived two rounds.
  out.grid = {};
  for (const dz of RANGES) {
    for (const m of MOT) {
      const key = `${dz}m_${m}`;
      out.grid[key] = { range_m: dz, motion: m, label: MOTIONS[m].label };
      for (const eff of EFFECTS) out.grid[key][eff] = cell(eff, dz, m, 'LIGHT', null, 'locked');
    }
  }

  // ---- A2. THE SAME GRID WITH THE CASTER NOT LOOKING AT ANYTHING -------------------------------
  // Published beside A rather than instead of it. Where these two differ, the difference is the
  // player's own aim error and not the bolt's steering, and that distinction is the one thing
  // RI-MAG01 M4 will not let a fix blur.
  out.grid_free = {};
  for (const dz of RANGES) {
    for (const m of MOT) {
      const key = `${dz}m_${m}`;
      out.grid_free[key] = { range_m: dz, motion: m, label: MOTIONS[m].label };
      out.grid_free[key].damage_health = cell('damage_health', dz, m, 'LIGHT', null, 'free');
    }
  }

  // ---- B. THE CAST CLASSES: which spells are SUPPOSED to be dodgeable --------------------------
  // CANTRIP and GREAT declare `turn_rate_dps: 0` and `tracking_cutoff: null` in cast-classes.json.
  // They are unguided by declaration and a lead is not given to them, so they miss a walking body
  // and that is the design rather than the defect. This arm is what turns that sentence into a
  // measurement.
  if (!o.quick) {
    out.classes = {};
    for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT']) {
      out.classes[cls] = {};
      for (const dz of [6, 14, 20]) {
        for (const m of ['still', 'strafe_r15', 'strafe_r30']) {
          out.classes[cls][`${dz}m_${m}`] = cell('damage_health', dz, m, cls, null, 'locked');
        }
      }
    }
  }

  // ---- C. THE DODGE ARM -------------------------------------------------------------------------
  // A body that changes its course after the cutoff must still get away, or the lead has become
  // homing and RI-CMB01's `min_dodge_window_f: 20` is a lie. The roll is 2.6 m of lateral
  // displacement (RI-CMB01's own roll distance band) applied at the frame the bolt is roughly 20
  // f@60 from arriving.
  out.dodge = {};
  for (const dz of [10, 14, 20]) {
    // TIMED OFF THE RELEASE FRAME, NOT OFF THE PRESS. The first version of this arm put the roll
    // at `(journey - 20)` frames after the BUTTON, and LIGHT has 24 frames of startup — so at 10
    // and 14 m the roll fired seven frames BEFORE the bolt existed and the arm was measuring a
    // body that had already stepped aside, not a body dodging. It reported 48 damage on a
    // "dodged" cell and 0 on an undodged one, which is the shape of a fixture measuring itself.
    // Release is `startup + 1` (LIGHT startup 24), so the bolt is in the air from PRESS_F + 25.
    const RELEASE = 25;
    const journeyF = Math.round((dz / 16) * 60);
    const atF = RELEASE + Math.max(1, journeyF - 20);   // min_dodge_window_f before it arrives
    out.dodge[`${dz}m`] = {
      at_frame_after_press: atF, release_frame_after_press: RELEASE, journey_f: journeyF,
      no_roll: cell('damage_health', dz, 'strafe_r15', 'LIGHT', null, 'locked'),
      rolled: cell('damage_health', dz, 'strafe_r15', 'LIGHT', { atF, dx: 2.6 }, 'locked'),
      rolled_from_still: cell('damage_health', dz, 'still', 'LIGHT', { atF, dx: 2.6 }, 'locked'),
    };
  }
  return out;
}, opts);

(async () => {
  const git = gitInfo();
  const { page, close } = await launchGame();
  let data;
  try { data = await RUN(page, { brk: BREAK, quick: QUICK }); } finally { await close(); }

  // RULE 8'S OWN GUARD: a cell that declared motion and did not move makes the comparison
  // vacuous. That is exactly how the round-4 critic's first moving-target arm failed, and it
  // says so in its own §11. This is the check that stops it happening twice.
  const vacuous = [];
  for (const [k, row] of Object.entries(data.grid || {})) {
    if (row.motion === 'still') continue;
    const d = row.damage_health && row.damage_health.moved_m;
    if (!(d > 0.5)) vacuous.push(`${k}: moved ${d} m`);
  }

  const cells = [];
  for (const [k, row] of Object.entries(data.grid || {})) {
    for (const eff of ['damage_health', 'fire_damage', 'frost_damage', 'shock_damage', 'poison_damage']) {
      if (row[eff] && row[eff].damage !== null && row[eff].damage !== undefined) cells.push({ k, eff, ...row[eff] });
    }
  }
  const zeroes = cells.filter((c) => !(c.damage > 0));
  const summary = {
    schema: 'elder-souls/w1-14-r5-lead@1',
    commit: git.commit, dirty: git.dirty, arm: data.arm,
    cells: cells.length, delivered: cells.length - zeroes.length, zero: zeroes.length,
    zero_cells: zeroes.map((c) => `${c.k}/${c.eff} (closest ${c.closest_m} m)`),
    vacuous_cells: vacuous,
    ...data,
  };
  writeJson(path.join(outDir, BREAK ? `lead-${BREAK}.json` : 'lead-fix.json'), summary);

  log(`arm=${data.arm}  cells=${cells.length}  delivered=${cells.length - zeroes.length}  zero=${zeroes.length}`);
  for (const z of zeroes.slice(0, 20)) log(`  ZERO  ${z.k}/${z.eff}  closest ${z.closest_m} m`);
  if (vacuous.length) {
    log(`VACUOUS: ${vacuous.length} cell(s) declared motion and did not move.`);
    for (const v of vacuous.slice(0, 10)) log(`  ${v}`);
    process.exit(4);
  }
  process.exit(EXIT.OK);
})();

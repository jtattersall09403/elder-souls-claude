#!/usr/bin/env node
// critic-w1-14-r4-motion.mjs — THE THREE THINGS MY FIRST PASS COULD NOT SETTLE.
//
//  A. A MOVING BODY (rule 8 — "a still target hides every steering defect"). The round-3 verdict
//     carried "a spell does not connect with a moving body" as its second-most-serious finding
//     and round 4 declares it untouched. My first arm aggroed the target and got identical
//     damage to the stationary control — but `getCombatState().enemies[]` carries no position,
//     so I could not show the body had moved at all, and an arm that cannot demonstrate motion
//     is a second copy of the stationary control. This one DRIVES the target: `setEntityPos`
//     translates it laterally every frame while the bolt is in the air, and the displacement is
//     measured off `listEntities()` and reported next to the damage.
//
//  B. THE DRAG. The round's status file says the pre-fix magic gravity "pulled every body in the
//     world toward y = 0 on every frame". Measured with `airborne` alongside `pos_y`, because a
//     body whose y never moves and whose `airborne` flag is stuck true is a different defect
//     from a body being dragged through the street, and only one of the two is what happened.
//
//  C. AN OVER-RESERVOIR CAST. Round 3 §9 reported "an empty event stream: no cast_start, no
//     refusal, no input_dropped" and round 4 carried it forward unexamined. `INPUT_DROPPED` is a
//     COMBAT-bus event and `magicEventsDrain()` does not carry it, so a probe that drains only
//     the magic stream would see exactly that emptiness whether or not a refusal was emitted.
//     This arm reads BOTH streams for a spell whose cost genuinely exceeds `focus_max`.
//
// USAGE  node tools/harness/critic-w1-14-r4-motion.mjs [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-motion.mjs — a target that really moves, the drag, the refusal.

  --out <dir>   report directory (default reports/critic-w1-14-r4)

Exits non-zero if the moving arm cannot be shown to have moved — an unmovable target makes the
whole comparison vacuous, which is the failure this tool exists to avoid.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);

const RUN = (page) => page.evaluate(async () => {
  const H = window.__HARNESS;
  await H.ready();
  const out = {};
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

  // ---- A. A TARGET THAT REALLY MOVES ---------------------------------------------------------
  {
    const MODES = {
      still:        { dz: 14.0, vx: 0,      vz: 0 },
      // A WALK, not a teleport-sprint. `traversal.json`'s walk is ~1.5 m/s = 0.025 m per frame.
      strafe_walk:  { dz: 14.0, vx: 0.025,  vz: 0 },
      // A JOG at ~3 m/s, which is what a Souls enemy circling actually does.
      strafe_jog:   { dz: 14.0, vx: 0.05,   vz: 0 },
      // The same walk at ordinary fighting range rather than across a field.
      near_walk:    { dz: 6.0,  vx: 0.025,  vz: 0 },
      retreat:      { dz: 14.0, vx: 0,      vz: 0.05 },
      strafe:       { dz: 14.0, vx: 0.09,   vz: 0 },
    };
    const arm = (mode) => {
      const M = MODES[mode];
      const results = {};
      for (const eff of ['damage_health', 'fire_damage', 'frost_damage', 'shock_damage', 'poison_damage']) {
        H.setSeed(31); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
        setupCaster();
        const spec = { class: 'LIGHT', range: 'projectile', effects: [{ effect: eff, magnitude: 20, duration_s: 0, area_r_m: 0 }] };
        const mk = H.makeSpell(spec, `critic motion ${eff} ${mode}`);
        if (mk.refused) { results[eff] = { refused: mk.reason || mk.gate }; continue; }
        H.setAttuned([mk.spell.id]);
        const sp = H.spawn('drowned_lesser', 0, M.dz);
        const eid = sp && sp.eid ? sp.eid : sp;
        H.stepFrames(4);
        const p0 = posOf(eid);
        const hp0 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
        H.magicEventsDrain();
        // Press, then DRIVE the body sideways one frame at a time while the bolt flies.
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 5, release: ['light'] }]);
        for (let f = 0; f < 200; f++) {
          H.stepFrames(1);
          if (M.vx || M.vz) H.setEntityPos(eid, (f + 1) * M.vx, M.dz + (f + 1) * M.vz);
        }
        const p1 = posOf(eid);
        const after = (H.getCombatState().enemies.find((e) => e.id === eid) || {});
        results[eff] = {
          hp_before: hp0, hp_after: after.hp,
          damage: hp0 !== undefined && after.hp !== undefined ? Math.round((hp0 - after.hp) * 100) / 100 : null,
          from: p0 ? p0.map((v) => Math.round(v * 100) / 100) : null,
          to: p1 ? p1.map((v) => Math.round(v * 100) / 100) : null,
          moved_m: p0 && p1 ? Math.round(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) * 100) / 100 : null,
        };
        try { H.despawn(eid); } catch (e) { /* gone */ }
      }
      return results;
    };
    out.motion = { still: arm('still'), strafe_walk: arm('strafe_walk'), strafe_jog: arm('strafe_jog'), near_walk: arm('near_walk'), retreat: arm('retreat'), strafe: arm('strafe') };
  }

  // ---- B. THE DRAG, with `airborne` beside the height -----------------------------------------
  {
    const trace = (broken, state) => {
      H.setSeed(5); H.loadState(state); H.stepFrames(4); H.loadState(state);
      H.setRenderRate(0);
      if (H.__breakGroundPlane) H.__breakGroundPlane(!!broken);
      const rows = [];
      for (let i = 0; i < 10; i++) { const m = H.getMagicState(); rows.push([m.pos_y_m, m.airborne ? 1 : 0]); H.stepFrames(10); }
      if (H.__breakGroundPlane) H.__breakGroundPlane(false);
      return rows;
    };
    out.drag = {
      note: '[pos_y_m, airborne] sampled every 10 f@60',
      lilmoth_fixed: trace(false, 'town-lilmoth'), lilmoth_broken: trace(true, 'town-lilmoth'),
      boardwalk_fixed: trace(false, 'cam_boardwalk'), boardwalk_broken: trace(true, 'cam_boardwalk'),
    };
  }

  // ---- C. AN OVER-RESERVOIR CAST, on BOTH streams ---------------------------------------------
  {
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    setupCaster();
    // Three effects at their most: a cost that genuinely exceeds the reservoir.
    const spec = {
      class: 'RITUAL',
      range: 'target',
      effects: [
        { effect: 'damage_health', magnitude: 200, duration_s: 0, area_r_m: 0 },
        { effect: 'fire_damage', magnitude: 100, duration_s: 30, area_r_m: 8 },
        { effect: 'frost_damage', magnitude: 100, duration_s: 30, area_r_m: 8 },
      ],
    };
    const q = H.quoteSpell(spec);
    const mk = H.makeSpell(spec, 'critic over reservoir');
    let row = { quote_focus_cost: q.focus_cost, quote_refused: !!q.refused, quote_gate: q.gate || null, over_reservoir: q.over_reservoir, made: !mk.refused };
    if (!mk.refused) {
      H.setAttuned([mk.spell.id]); H.hearthRest(); H.setAttuned([mk.spell.id]);
      const m0 = H.getMagicState();
      H.magicEventsDrain();
      const pc = H.pressCast(150);
      const evs = H.magicEventsDrain();
      row = {
        ...row, focus: m0.focus, focus_max: m0.focus_max,
        magic_stream: evs.map((e) => e.kind),
        combat_stream_drops: pc.drops,
        focus_after: H.getMagicState().focus,
      };
    }
    out.over_reservoir = row;
  }
  return out;
});

const handle = await launchGame(args);
let res;
try { res = await RUN(handle.page); } finally { await handle.close(); }

const fails = [];
const moved = Object.values(res.motion.strafe_walk).map((r) => r.moved_m).filter((v) => v !== null);
if (!moved.length || Math.max(...moved) < 1) fails.push(`the moving arm did not move (max displacement ${moved.length ? Math.max(...moved) : 'n/a'} m) — the comparison would be vacuous`);

const report = { schema: 'elder-souls/critic-w1-14-r4-motion@1', commit: gitInfo().commit, ...res, pass: fails.length === 0, failures: fails };
writeJson(path.join(outDir, 'motion.json'), report);
for (const eff of Object.keys(res.motion.still)) {
  const cells = Object.keys(res.motion).map((m) => `${m} ${String(res.motion[m][eff].damage).padStart(4)}/${String(res.motion[m][eff].moved_m).padStart(5)}m`);
  log(`A ${eff.padEnd(15)} ${cells.join(' | ')}`);
}
log(`B lilmoth  FIXED  ${JSON.stringify(res.drag.lilmoth_fixed)}`);
log(`B lilmoth  BROKEN ${JSON.stringify(res.drag.lilmoth_broken)}`);
log(`B boardwlk FIXED  ${JSON.stringify(res.drag.boardwalk_fixed)}`);
log(`B boardwlk BROKEN ${JSON.stringify(res.drag.boardwalk_broken)}`);
log(`C over-reservoir: ${JSON.stringify(res.over_reservoir)}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'motion.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);

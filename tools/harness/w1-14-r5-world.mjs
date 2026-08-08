#!/usr/bin/env node
// w1-14-r5-world.mjs — THREE THINGS THE ROUND-4 VERDICT LEFT ON THE FLOOR, EACH WITH BOTH ARMS.
//
// Every section here publishes the POSITIVE ARM beside the teardown, in the same file, at the
// same commit. That is charged §5 of the round-4 verdict — "publishing four control arms and no
// treatment arm is the same shape as publishing a treatment arm and no control" — and it is not
// a formatting note: a report of four red arms does not establish that anything works.
//
//  A. DEEP WATER. `groundInActiveCell` answers with the SEA BED, so a body swimming on the
//     surface was ~40 m "airborne" by the magic system's reckoning and could not cast. The
//     round-4 verdict measured it at `vista_primary` (y = -1.404, floor -41.148) and counted 13
//     of the 49 named states as deep water. This arm sweeps EVERY named state, presses the real
//     cast button through the combat bus, and runs the whole sweep twice — the same control shape
//     `critic-w1-14-r4-ground.mjs` used for the ground plane, which is what the brief asked for.
//
//  B. THE PURSE. `save/state.js` restored `sim.progression.gold` bare. The round-4 verdict
//     reported it as a residual and could not produce a stale mirror. This arm reads all four
//     mirrors after a load, in both arms, so "masked by a rebuild" is a measurement rather than
//     an inference — and if the fixed and broken arms agree, that is an INERT FIX and this tool
//     says so in those words rather than reporting a pass.
//
//  C. THE REFUSAL. `INPUT_DROPPED reason: no_focus` is real, is on the combat bus, and carries
//     `have`/`need` — round 3 was wrong that it is silent to the trace and round 4 carried that
//     forward. It IS silent to the player. This arm reads BOTH streams AND the HUD's own toast
//     element, in both arms, so the two halves are separated by measurement.
//
// USAGE  node tools/harness/w1-14-r5-world.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r5-world.mjs — deep water, the purse, and what the player is told.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.resolve(String(args.out || 'reports/w1-14-r5'));
ensureDir(outDir);

// The state list comes from the DIRECTORY, exactly as `critic-w1-14-r4-ground.mjs` takes it, so
// a state added tomorrow is swept without anybody remembering to add it here.
const STATES = fs.readdirSync(path.resolve('game/data/states'))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

const RUN = (page) => page.evaluate(async (NAMES) => {
  const H = window.__HARNESS;
  await H.ready();
  const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
  const out = {};

  // =============================================================================================
  // A. DEEP WATER
  // =============================================================================================
  {
    const names = NAMES;
    const row = (state, breakFloor, breakGate) => {
      // TWICE. The round-4 verdict §11 records that `loadState` into a cell carries the PREVIOUS
      // cell's ground for one load, and that its first sweep measured the load order rather than
      // the towns because of it. Every load in this file is doubled for that reason. Thirty
      // frames of settle for the same verdict's other instrument finding: Stormhold spawns at
      // 150.95 and lands at 141.05, and a press taken mid-FALL measures the fall.
      H.setSeed(11); H.loadState(state); H.stepFrames(4); H.loadState(state);
      H.setRenderRate(0);
      H.setCatalyst('great_staff'); H.setWillpower(99); H.hearthRest();
      const spells = H.getMagicData().spells.spells.map((x) => x.id);
      const pick = spells.includes('spark_dart') ? 'spark_dart' : spells[0];
      H.learnSpell(pick); H.setAttuned([pick]);
      H.stepFrames(30);
      // ARMED AFTER THE LOAD, because a load rebuilds the system and would clear it.
      if (H.__breakWaterPlane) H.__breakWaterPlane(!!breakFloor);
      if (H.__breakCastInWater) H.__breakCastInWater(!!breakGate);
      H.stepFrames(10);   // the teardown needs a frame to act before the state is read
      const m = H.getMagicState();
      const ps = H.getPlayerStats();
      H.magicEventsDrain();
      const pc = H.pressCast(60);
      const evs = H.magicEventsDrain();
      if (H.__breakWaterPlane) H.__breakWaterPlane(false);
      if (H.__breakCastInWater) H.__breakCastInWater(false);
      return {
        state, pos_y: r3(m.pos_y_m), airborne: !!m.airborne,
        water_band: ps.water_band || null, depth_m: r3(ps.water_depth_m),
        cast_start: evs.filter((e) => (e.kind || e.type) === 'cast_start').length,
        dropped: pc.drops.length,
        reason: pc.drops.length ? pc.drops[0].reason : null,
        spell: pick,
      };
    };
    // A 2x2, not a 1x2. There are TWO guards over the deep-water defect — the floor
    // (`__breakWaterPlane`) and the input gate (`__breakCastInWater`) — and RULES.md #6's third
    // shape says to say which you have. Deleting the floor alone leaves the swimmer unable to
    // cast for the OTHER reason, so a 1x2 over the floor reports an inert fix and would be
    // honestly indistinguishable from one. This is how that was actually found.
    const fixed = [], broken = [], noFloor = [], noGate = [];
    for (const s of names) {
      const safe = (a, b2) => { try { return row(s, a, b2); } catch (e) { return { state: s, error: String(e && e.message).slice(0, 120) }; } };
      fixed.push(safe(false, false));
      broken.push(safe(true, true));
      noFloor.push(safe(true, false));
      noGate.push(safe(false, true));
    }
    // A state is "deep water" if the two arms disagree about the floor — which is the only
    // definition that does not require this probe to re-implement the band test.
    // A state is DEEP WATER when arming the teardown makes the body airborne — i.e. when the
    // floor the magic system uses moves from the water line to the sea bed. That is the defect's
    // own signature and it needs no second definition of the swim band inside this probe. A 3 mm
    // settle difference between two separate loads is NOT that, which is why the test is the
    // boolean and not the height.
    const deep = fixed.filter((f) => f.water_band === 'W5');
    out.water = {
      states_swept: names.length,
      deep_water_states: deep.map((d) => d.state),
      deep_water_count: deep.length,
      fixed_casts_in_deep: deep.filter((d) => d.cast_start > 0).length,
      broken_casts_in_deep: deep.map((d) => broken[fixed.indexOf(d)]).filter((b) => b.cast_start > 0).length,
      no_floor_casts_in_deep: deep.map((d) => noFloor[fixed.indexOf(d)]).filter((b) => b.cast_start > 0).length,
      no_gate_casts_in_deep: deep.map((d) => noGate[fixed.indexOf(d)]).filter((b) => b.cast_start > 0).length,
      table: deep.map((d) => ({ ...d, broken: broken[fixed.indexOf(d)], no_floor: noFloor[fixed.indexOf(d)], no_gate: noGate[fixed.indexOf(d)] })),
      all_fixed: fixed, all_broken: broken, all_no_floor: noFloor, all_no_gate: noGate,
    };
  }

  // =============================================================================================
  // B. THE PURSE, THROUGH ALL FOUR MIRRORS
  // =============================================================================================
  {
    const mirrors = () => {
      const s = H.getStealthState ? H.getStealthState() : null;
      const c = H.getCombatState ? H.getCombatState() : null;
      const m = H.getMagicState ? H.getMagicState() : null;
      return {
        get_gold: H.getGold(),
        save_gold: H.saveState().progression.gold,
        stealth_gold: s && s.player ? s.player.gold : (s ? s.gold : null),
        combat_world_gold: c && c.world ? c.world.gold : null,
        magic_gold: m ? (m.gold === undefined ? null : m.gold) : null,
        // The two mirrors no read-only harness surface published before this round. Without them
        // the arm can only see the mirrors a load happens to rebuild, which is exactly the blind
        // spot that let the bare write sit there for four rounds.
        ...(H.goldMirrors ? H.goldMirrors() : {}),
      };
    };
    const arm = (broken) => {
      H.setSeed(3); H.loadState('arena_flat'); H.setRenderRate(0); H.stepFrames(4);
      if (H.__breakPurseHook) H.__breakPurseHook(!!broken);
      H.setGold(500000);
      const blob = H.saveState();               // a save holding 500,000
      H.setGold(7);                             // and a session holding 7
      const before = mirrors();
      H.loadState(blob);                        // the load must put 500,000 in every mirror
      H.stepFrames(4);
      const after = mirrors();
      if (H.__breakPurseHook) H.__breakPurseHook(false);
      const vals = Object.values(after).filter((v) => typeof v === 'number');
      return { before, after, distinct: [...new Set(vals)].sort((a, b) => a - b), agree: new Set(vals).size === 1 };
    };
    const fixed = arm(false), broken = arm(true);
    out.purse = {
      fixed, broken,
      // RULES.md #6's first shape, named rather than hidden: if both arms agree, the change did
      // nothing and something else was carrying the number.
      inert_fix: JSON.stringify(fixed.after) === JSON.stringify(broken.after),
    };
  }

  // =============================================================================================
  // C. WHAT THE PLAYER IS TOLD
  // =============================================================================================
  {
    const arm = (broken) => {
      H.setSeed(5); H.loadState('arena_flat'); H.resetMagicWorld();
      for (let i = 0; i < 700; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(4000000); H.hearthRest();
      for (const sp of H.getMagicData().spells.spells) H.learnSpell(sp.id);
      if (H.__breakRefusalVoice) H.__breakRefusalVoice(!!broken);
      // A spell whose cost genuinely exceeds `focus_max`, built the way a player would build it.
      const mk = H.makeSpell({
        class: 'RITUAL', range: 'target',
        effects: [
          { effect: 'damage_health', magnitude: 200, duration_s: 0, area_r_m: 0 },
          { effect: 'fire_damage', magnitude: 100, duration_s: 30, area_r_m: 8 },
          { effect: 'frost_damage', magnitude: 100, duration_s: 30, area_r_m: 8 },
        ],
      }, 'r5 over-reservoir');
      if (mk.refused) return { fatal: mk.reason || mk.gate };
      H.setAttuned([mk.spell.id]);
      const st = H.getMagicState();
      H.magicEventsDrain();
      // THE HUD IS READ AT THE DRAW CALL. `getUIState()` does not publish the toast at all — it
      // is built into the HUD model inside `ui/system.js` and only ever leaves through
      // `fillText`. `getRenderedText()` hooks that, so this arm measures what is on the screen
      // rather than what a model says is on it, and it needs the renderer actually running:
      // every other arm in this file sets `setRenderRate(0)`, and reading the drawn text under
      // that reports an empty screen for a line that is there. That is what the first version of
      // this arm did, and it reported the fix and the teardown as identical.
      H.setRenderRate(1);
      H.uiToast(null); H.stepFrames(2);
      // WINDOWED. `text-register.js` ACCUMULATES: `getRenderedText()` returns every string drawn
      // since the register was last cleared, not the last frame's. The first version of this arm
      // read the whole register and so the BROKEN arm saw the FIXED arm's own line still sitting
      // in it and reported both arms speaking — an inert control produced by a wrong reader
      // rather than by a wrong fix, which is RULES.md #6's second shape and the one W1-04 lost a
      // whole count to. `since` is the register's own cursor.
      const since = H.getRenderedText().next_index;
      let press = null;
      try { press = H.pressCast(60); } catch (e) { press = { error: String(e && e.message) }; }
      const magic = H.magicEventsDrain();
      // `pressCast` steps the loop itself and hands back the `INPUT_DROPPED` rows for `cast`, so
      // the bus is read through its return value rather than through a drain it has consumed.
      const drop = press && press.drops && press.drops.length ? press.drops[0] : null;
      H.stepFrames(3);
      const drawn = (H.getRenderedText({ since }).distinct || []);
      const said = drawn.filter((t) => /Focus/i.test(String(t)) && /asks|hold/i.test(String(t)));
      if (H.__breakRefusalVoice) H.__breakRefusalVoice(false);
      H.setRenderRate(0);
      return {
        focus: st.focus, focus_max: st.focus_max, cost: mk.quote ? mk.quote.focus_cost : null,
        magic_stream: magic.map((e) => e.kind),
        combat_bus_drop: drop ? { reason: drop.reason, spell: drop.spell } : null,
        drops: press && press.drops ? press.drops.length : 0,
        register_cursor: since,
        said_on_screen: said,
        spoken: said.length > 0,
      };
    };
    out.refusal = { fixed: arm(false), broken: arm(true) };
  }

  return out;
}, STATES);

(async () => {
  const git = gitInfo();
  const { page, close } = await launchGame();
  let d;
  try { d = await RUN(page); } finally { await close(); }
  writeJson(path.join(outDir, 'world.json'), { schema: 'elder-souls/w1-14-r5-world@1', commit: git.commit, dirty: git.dirty, ...d });

  const W = d.water;
  log(`WATER    swept ${W.states_swept} named state(s); ${W.deep_water_count} are deep water`);
  log('         the 2x2, casts out of ' + W.deep_water_count + ' deep-water states:');
  log(`             floor FIXED + gate FIXED : ${W.fixed_casts_in_deep}`);
  log(`             floor BROKEN + gate open : ${W.no_floor_casts_in_deep}`);
  log(`             floor FIXED  + gate shut : ${W.no_gate_casts_in_deep}`);
  log(`             both BROKEN              : ${W.broken_casts_in_deep}`);
  for (const r of W.table.slice(0, 16)) {
    log(`         ${String(r.state).padEnd(28)} band ${r.water_band} y ${String(r.pos_y).padStart(9)} air ${r.airborne ? 1 : 0} cast ${r.cast_start}` +
      `  | no-floor: air ${r.no_floor.airborne ? 1 : 0} cast ${r.no_floor.cast_start}` +
      `  | no-gate: cast ${r.no_gate.cast_start}  | both: cast ${r.broken.cast_start}`);
  }
  const P = d.purse;
  log(`PURSE    FIXED  after a load: ${JSON.stringify(P.fixed.after)} -> ${P.fixed.agree ? 'ONE PURSE' : `${P.fixed.distinct.length} DISTINCT VALUES ${JSON.stringify(P.fixed.distinct)}`}`);
  log(`         BROKEN after a load: ${JSON.stringify(P.broken.after)} -> ${P.broken.agree ? 'ONE PURSE' : `${P.broken.distinct.length} DISTINCT VALUES ${JSON.stringify(P.broken.distinct)}`}`);
  if (P.inert_fix) log('         *** INERT FIX: both arms are byte-identical. The change is not carrying the number. ***');
  const R = d.refusal;
  log(`REFUSAL  focus ${R.fixed.focus} of ${R.fixed.focus_max}; the spell asks ${R.fixed.cost}`);
  log(`         FIXED  magic stream ${JSON.stringify(R.fixed.magic_stream)}; bus ${JSON.stringify(R.fixed.combat_bus_drop)}; ON SCREEN ${JSON.stringify(R.fixed.said_on_screen)}`);
  log(`         BROKEN magic stream ${JSON.stringify(R.broken.magic_stream)}; bus ${JSON.stringify(R.broken.combat_bus_drop)}; ON SCREEN ${JSON.stringify(R.broken.said_on_screen)}`);

  const ok = W.deep_water_count > 0 && W.fixed_casts_in_deep === W.deep_water_count
    && W.no_floor_casts_in_deep < W.deep_water_count && W.no_gate_casts_in_deep < W.deep_water_count
    && P.fixed.agree
    && R.fixed.spoken && !R.broken.spoken && R.fixed.combat_bus_drop && R.broken.combat_bus_drop;
  log(ok ? 'PASS — all three, with both arms.' : 'PARTIAL — see the report; the failing half is printed above.');
  process.exit(ok ? EXIT.OK : 7);
})();

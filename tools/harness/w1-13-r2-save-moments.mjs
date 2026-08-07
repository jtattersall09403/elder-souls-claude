#!/usr/bin/env node
/**
 * w1-13-r2-save-moments.mjs — VARY WHEN YOU SAVE, NOT ONLY WHAT.
 *
 * W1-13 round 2, closing `secondary_observations[0]` of the round-1 verdict: a save taken while
 * the death surface was up destroyed 4,200 souls on load, on both the browser-restart and the
 * same-session route, against a control that returned all 4,200. The mechanism was that
 * `DeathSystem`'s in-flight state (`active`, `deathFrame`, `controllableAt`) was not durable, so
 * the first frame after the load saw `hp <= 0 && !active`, fired a fresh `die()` carrying
 * `soulsHeld = 0`, and took D16's second-death branch against a death that never happened.
 *
 * The round-1 critic's other half is the reason this file exists rather than a re-run of
 * `critic-w1-13-a.mjs`: widening the SEED sweep from 2 to 10 changed nothing and widening the
 * MOMENT changed everything. So this sweeps the moment — nine of them, across the whole death,
 * the whole fall, and a doubled death — and audits the LIVE WORLD after each load, never the blob.
 *
 * Each row also carries its own control: the same trial with the save taken at a moment where
 * nothing is in flight. `--delete-the-fix` neuters `DeathSystem.prototype.restoreInFlight` in the
 * page, which must put every row back to the round-1 answer.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r2-save-moments.mjs [--out <file>] [--delete-the-fix] [--souls 4200]'); process.exit(0); }
const SOULS = Number(args.souls ?? 4200);
const deleteTheFix = !!args['delete-the-fix'];
const out = { schema: 'w1-13/r2-save-moments@1', souls: SOULS, delete_the_fix: deleteTheFix, rows: [] };
let handle;

const neuter = async (h) => h.page.evaluate(() => {
  const eng = window.__ENGINE;
  const proto = eng && eng.death ? Object.getPrototypeOf(eng.death) : null;
  if (!proto) return { ok: false };
  const had = typeof proto.restoreInFlight === 'function';
  proto.restoreInFlight = function () { return null; };   // round-1 behaviour, exactly
  return { ok: true, had_method: had };
});

/** Rest at a well (the only thing that sets a respawn point) and bank `souls`. */
async function setup(h) {
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 0);
  if (deleteTheFix) await neuter(h);
  const list = await h.h('listHearths');
  const well = list.hearths.find((x) => x.id === 'hearth-archon') || list.hearths[0];
  await h.h('teleport', well.pos[0], well.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', well.id);
  const blob = await h.h('saveState');
  blob.character.souls_held = SOULS;
  await h.h('restoreState', blob);
  await h.h('stepFrames', 2);
  return well;
}

/** Load a blob, let the world settle, walk onto whatever bloom exists, report the purse. */
async function recoverAfter(h, blob) {
  await h.h('loadState', blob);
  await h.h('stepFrames', 1);
  const one = await h.h('getDeathState');
  await h.h('stepFrames', 320);
  const d = await h.h('getDeathState');
  let touched = null;
  if (d.bloodstain) {
    await h.h('teleport', d.bloodstain.pos[0], d.bloodstain.pos[2]);
    await h.h('stepFrames', 5);
    touched = await h.h('getDeathState');
  }
  const held = touched ? touched.souls_held : d.souls_held;
  return {
    after_1_frame: {
      surface_active: one.surface_active, souls_held: one.souls_held,
      bloom: one.bloodstain ? one.bloodstain.souls : null,
      deaths_this_session: one.deaths_this_session,
      stains_lost_to_second_death: one.stains_lost_to_second_death,
    },
    after_settle: {
      surface_active: d.surface_active, souls_held: d.souls_held,
      bloom: d.bloodstain ? d.bloodstain.souls : null,
      deaths_this_session: d.deaths_this_session,
      stains_lost_to_second_death: d.stains_lost_to_second_death,
    },
    recoverable: held,
    destroyed: SOULS - held,
  };
}

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---- A. THE MOMENT SWEEP across the 150-frame death surface -------------------------------
  // 0 is the frame the surface goes up; 149 is the last frame before control returns; 200 is
  // after the respawn and is the round-1 critic's clean control.
  for (const atFrame of [0, 1, 20, 75, 149, 200]) {
    const well = await setup(h);
    await h.h('teleport', well.pos[0] + 40, well.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);                     // the death fires from _afterStep
    if (atFrame > 0) await h.h('stepFrames', atFrame);
    const mid = await h.h('getDeathState');
    const blob = await h.h('saveState');
    const r = await recoverAfter(h, blob);
    const row = {
      moment: `death_surface_frame_${atFrame}`,
      is_control: atFrame >= 150,
      surface_active_at_save: mid.surface_active,
      surface_frames_left_at_save: mid.surface_frames_left,
      bloom_at_save: mid.bloodstain ? mid.bloodstain.souls : null,
      hp_at_save: blob.character ? blob.character.hp : null,
      in_flight_in_blob: blob.death ? !!blob.death.in_flight : null,
      ...r,
      pass: r.destroyed === 0,
    };
    out.rows.push(row);
    log(`${row.moment}: surface=${row.surface_active_at_save} -> ${r.recoverable}/${SOULS} recoverable `
      + `(deaths ${r.after_settle.deaths_this_session}, stains lost ${r.after_settle.stains_lost_to_second_death}) `
      + `${row.pass ? 'PASS' : 'LOST ' + r.destroyed}`);
  }

  // ---- B. A SAVE TAKEN MID-FALL, before the ground has decided anything ----------------------
  {
    const well = await setup(h);
    await h.h('teleport', well.pos[0] + 40, well.pos[2] + 40, { y: well.pos[1] + 90 });
    await h.h('stepFrames', 20);                    // airborne, hp still full
    const air = await h.h('getPlayerStats');
    const blob = await h.h('saveState');
    const r = await recoverAfter(h, blob);
    out.rows.push({
      moment: 'mid_fall_still_alive', is_control: false,
      state_at_save: air.state, airborne_at_save: air.airborne, hp_at_save: air.hp,
      in_flight_in_blob: blob.death ? !!blob.death.in_flight : null,
      ...r, pass: r.destroyed === 0,
    });
    log(`mid_fall_still_alive: state=${air.state} -> ${r.recoverable}/${SOULS} recoverable`);
  }

  // ---- C. A SAVE TAKEN ON THE FRAME A LETHAL FALL LANDS ---------------------------------------
  {
    const well = await setup(h);
    await h.h('teleport', well.pos[0] + 40, well.pos[2] + 40, { y: well.pos[1] + 120 });
    // Step until HP reaches 0, then save on that very frame.
    let landed = null;
    for (let i = 0; i < 400 && !landed; i++) {
      await h.h('stepFrames', 1);
      const st = await h.h('getPlayerStats');
      if (st.hp <= 0) landed = st;
    }
    const d0 = await h.h('getDeathState');
    const blob = await h.h('saveState');
    const r = await recoverAfter(h, blob);
    out.rows.push({
      moment: 'lethal_fall_landing_frame', is_control: false,
      hp_at_save: landed ? landed.hp : null,
      surface_active_at_save: d0.surface_active,
      cause_at_save: d0.cause || (d0.last_death && d0.last_death.cause) || null,
      in_flight_in_blob: blob.death ? !!blob.death.in_flight : null,
      ...r, pass: r.destroyed === 0,
    });
    log(`lethal_fall_landing_frame: hp=${landed ? landed.hp : '?'} surface=${d0.surface_active} -> ${r.recoverable}/${SOULS} recoverable`);
  }

  // ---- D. A SAVE TAKEN MID-DEATH WITH A BLOOM ALREADY OUTSTANDING -----------------------------
  //         The doubled death. D16 says the first bloom is destroyed, so `recoverable` here is
  //         the SECOND death's tithe and must be exactly that — not zero, and not both.
  {
    const well = await setup(h);
    await h.h('teleport', well.pos[0] + 40, well.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 200);                   // first death completes, bloom outstanding
    const b1 = await h.h('saveState');
    b1.character.souls_held = 1500;                 // bank a second, smaller purse
    await h.h('restoreState', b1);
    await h.h('stepFrames', 2);
    await h.h('teleport', well.pos[0] + 80, well.pos[2] + 20);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);
    const mid = await h.h('getDeathState');
    const blob = await h.h('saveState');
    await h.h('loadState', blob);
    await h.h('stepFrames', 1);
    const one = await h.h('getDeathState');
    await h.h('stepFrames', 320);
    const d = await h.h('getDeathState');
    let held = d.souls_held;
    if (d.bloodstain) {
      await h.h('teleport', d.bloodstain.pos[0], d.bloodstain.pos[2]);
      await h.h('stepFrames', 5);
      held = (await h.h('getDeathState')).souls_held;
    }
    out.rows.push({
      moment: 'second_death_in_flight_with_bloom_outstanding', is_control: false,
      second_purse: 1500,
      bloom_at_save: mid.bloodstain ? mid.bloodstain.souls : null,
      stains_lost_at_save: mid.stains_lost_to_second_death,
      after_1_frame: { surface_active: one.surface_active, bloom: one.bloodstain ? one.bloodstain.souls : null, deaths_this_session: one.deaths_this_session, stains_lost_to_second_death: one.stains_lost_to_second_death },
      after_settle: { bloom: d.bloodstain ? d.bloodstain.souls : null, deaths_this_session: d.deaths_this_session, stains_lost_to_second_death: d.stains_lost_to_second_death },
      recoverable: held,
      expected: 1500,
      // The load must not manufacture a THIRD death: exactly two, and exactly one stain lost.
      pass: held === 1500 && d.deaths_this_session === 2 && d.stains_lost_to_second_death === 1,
    });
    const rr = out.rows[out.rows.length - 1];
    log(`second_death_in_flight: recovered ${held}/1500, deaths=${d.deaths_this_session}, stains lost=${d.stains_lost_to_second_death} ${rr.pass ? 'PASS' : 'FAIL'}`);
  }

  out.summary = {
    rows: out.rows.length,
    passing: out.rows.filter((r) => r.pass).length,
    failing: out.rows.filter((r) => !r.pass).map((r) => ({ moment: r.moment, destroyed: r.destroyed ?? null, recoverable: r.recoverable })),
  };
  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  log(`SUMMARY ${JSON.stringify(out.summary)}`);
  if (!deleteTheFix && out.summary.passing !== out.rows.length) process.exitCode = 1;
} catch (e) {
  out.error = String((e && e.stack) || e);
  if (args.out) writeJson(args.out, out);
  log('w1-13-r2-save-moments: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}

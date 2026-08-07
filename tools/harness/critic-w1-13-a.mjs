#!/usr/bin/env node
/**
 * critic-w1-13-a.mjs — W1-13 round-1 critic, probe A: DOES A SAVE TAKEN MID-DEATH DESTROY SOULS?
 *
 * Written by the W1-13 critic under `orchestration/TOOL-LOOP.md` rule 1 and declared in the
 * verdict under `method_deviations`. RI-JRN06 M-D16 measures whether the bloom survives a save
 * taken at REST. Nothing in the corpus measures a save taken WHILE THE DEATH SURFACE IS UP, and
 * the sibling save critic (`W1-SAVE-r1`) found that mid-death saves fail 10/10 on the save side.
 * Death is exactly where the two meet, so it is measured here.
 *
 * EVERY assertion below reads the LIVE WORLD after a load — `getDeathState()`, `getPlayerStats()`
 * — never the blob. Auditing the blob is what the sibling critic showed to be a fixed-point test.
 *
 * Sequence, per trial:
 *   1. rest at a well (the only thing that sets a respawn point)
 *   2. bank N souls, walk out, die  -> a bloom holding N
 *   3. saveState() WHILE THE SURFACE IS UP
 *   4. reload the page (a real browser restart, not an in-session loadState)
 *   5. loadState(blob), step, and ask the LIVE WORLD what the player has
 *
 * Exit non-zero if any trial loses souls it should not have lost.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `
critic-w1-13-a.mjs — a save taken mid-death, audited on the live world after the load.

USAGE
  node tools/harness/critic-w1-13-a.mjs [--out <file>] [--souls 4200]
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const SOULS = Number(args.souls ?? 4200);

const out = { schema: 'critic/w1-13-a@1', trials: [], notes: [] };
let handle;

async function bootReady(page) {
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready && window.__HARNESS.ready());
}

/** Put the player at a well, rest (sets the respawn point), bank souls, and step out. */
async function setup(h, souls) {
  await h.h('loadState', 'default');
  const list = await h.h('listHearths');
  const well = list.hearths.find((x) => x.id === 'hearth-archon') || list.hearths[0];
  await h.h('teleport', well.pos[0], well.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', well.id);
  // Bank souls through the save path (there is no grant verb); read them back off the live world.
  const blob = await h.h('saveState');
  // The purse is at `blob.character.souls_held` — NOT `blob.progression.*`, which is where a
  // reader would guess and where this probe first put it, scoring a null run as a total loss.
  blob.character.souls_held = souls;
  await h.h('restoreState', blob);
  await h.h('stepFrames', 2);
  const st = await h.h('getDeathState');
  return { well, souls_live: st.souls_held, hearth_last_rested: st.hearth_last_rested };
}

try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const h = handle;

  // ---------------------------------------------------------------------------------------
  // TRIAL 1 — save WHILE THE DEATH SURFACE IS UP, reload the browser, load, audit live.
  // ---------------------------------------------------------------------------------------
  {
    const s = await setup(h, SOULS);
    // walk out a little so the death point is not the well itself
    await h.h('teleport', s.well.pos[0] + 40, s.well.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);            // the death fires from _afterStep
    const mid = await h.h('getDeathState');
    const blob = await h.h('saveState');   // <- SAVE TAKEN MID-DEATH, surface up
    const t = {
      id: 'T1_mid_death_save_browser_restart',
      souls_before: s.souls_live,
      surface_active_at_save: mid.surface_active,
      surface_frames_left_at_save: mid.surface_frames_left,
      bloom_at_save: mid.bloodstain ? { souls: mid.bloodstain.souls, pos: mid.bloodstain.pos } : null,
      souls_held_at_save: mid.souls_held,
      blob_bloom_souls: blob.death && blob.death.bloodstain ? blob.death.bloodstain.souls : null,
      blob_hp: blob.character ? blob.character.hp : null,
    };

    // A REAL restart: reload the page so the DeathSystem is constructed fresh.
    await h.page.reload({ waitUntil: 'load', timeout: 60000 });
    await bootReady(h.page);
    await h.h('loadState', blob);
    t.after_load_immediate = await h.h('getDeathState').then((d) => ({
      surface_active: d.surface_active,
      bloom: d.bloodstain ? { souls: d.bloodstain.souls } : null,
      souls_held: d.souls_held,
      deaths_this_session: d.deaths_this_session,
    }));
    await h.h('stepFrames', 1);
    t.after_1_frame = await h.h('getDeathState').then((d) => ({
      surface_active: d.surface_active,
      bloom: d.bloodstain ? { souls: d.bloodstain.souls, pos: d.bloodstain.pos } : null,
      souls_held: d.souls_held,
      deaths_this_session: d.deaths_this_session,
      stains_lost_to_second_death: d.stains_lost_to_second_death,
    }));
    await h.h('stepFrames', 200);
    const d2 = await h.h('getDeathState');
    t.after_200_frames = {
      surface_active: d2.surface_active,
      bloom: d2.bloodstain ? { souls: d2.bloodstain.souls, pos: d2.bloodstain.pos } : null,
      souls_held: d2.souls_held,
      deaths_this_session: d2.deaths_this_session,
      stains_lost_to_second_death: d2.stains_lost_to_second_death,
    };
    // Can the player recover what remains? Walk onto whatever bloom is there.
    if (d2.bloodstain) {
      await h.h('teleport', d2.bloodstain.pos[0], d2.bloodstain.pos[2]);
      await h.h('stepFrames', 4);
      const d3 = await h.h('getDeathState');
      t.after_touching_bloom = { souls_held: d3.souls_held, bloom: d3.bloodstain ? d3.bloodstain.souls : null };
    }
    const recoverable = t.after_touching_bloom ? t.after_touching_bloom.souls_held : t.after_200_frames.souls_held;
    t.souls_recoverable_after_load = recoverable;
    t.souls_destroyed_by_the_save = SOULS - recoverable;
    t.pass = t.souls_destroyed_by_the_save === 0;
    out.trials.push(t);
    log(`T1 mid-death save + browser restart: ${SOULS} souls in -> ${recoverable} recoverable  (${t.pass ? 'PASS' : 'LOST ' + t.souls_destroyed_by_the_save})`);
  }

  // ---------------------------------------------------------------------------------------
  // TRIAL 2 — control: save at REST (no death in flight), same restart, same audit.
  // If T1 loses souls and T2 does not, the loss is the mid-death save's, not the save's.
  // ---------------------------------------------------------------------------------------
  {
    await handle.page.reload({ waitUntil: 'load', timeout: 60000 });
    await bootReady(handle.page);
    const s = await setup(h, SOULS);
    await h.h('teleport', s.well.pos[0] + 40, s.well.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);            // let the surface close and the respawn happen
    const alive = await h.h('getDeathState');
    const blob = await h.h('saveState');     // <- SAVE TAKEN AFTER the respawn, bloom outstanding
    const t = {
      id: 'T2_control_save_after_respawn',
      surface_active_at_save: alive.surface_active,
      bloom_at_save: alive.bloodstain ? alive.bloodstain.souls : null,
    };
    await handle.page.reload({ waitUntil: 'load', timeout: 60000 });
    await bootReady(handle.page);
    await h.h('loadState', blob);
    await h.h('stepFrames', 2);
    const d = await h.h('getDeathState');
    t.after_load = { bloom: d.bloodstain ? { souls: d.bloodstain.souls, pos: d.bloodstain.pos } : null, souls_held: d.souls_held };
    if (d.bloodstain) {
      await h.h('teleport', d.bloodstain.pos[0], d.bloodstain.pos[2]);
      await h.h('stepFrames', 4);
      const d3 = await h.h('getDeathState');
      t.after_touching_bloom = { souls_held: d3.souls_held, bloom: d3.bloodstain ? d3.bloodstain.souls : null };
    }
    const rec = t.after_touching_bloom ? t.after_touching_bloom.souls_held : t.after_load.souls_held;
    t.souls_recoverable_after_load = rec;
    t.souls_destroyed_by_the_save = SOULS - rec;
    t.pass = t.souls_destroyed_by_the_save === 0;
    out.trials.push(t);
    log(`T2 control (save after respawn) + restart: ${SOULS} in -> ${rec} recoverable  (${t.pass ? 'PASS' : 'LOST ' + t.souls_destroyed_by_the_save})`);
  }

  // ---------------------------------------------------------------------------------------
  // TRIAL 3 — same session, no restart: loadState(blob) of a mid-death save.
  // ---------------------------------------------------------------------------------------
  {
    await handle.page.reload({ waitUntil: 'load', timeout: 60000 });
    await bootReady(handle.page);
    const s = await setup(h, SOULS);
    await h.h('teleport', s.well.pos[0] + 40, s.well.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);
    const blob = await h.h('saveState');
    await h.h('stepFrames', 200);           // let this session finish the death
    await h.h('loadState', blob);           // now load the mid-death save back, same session
    await h.h('stepFrames', 2);
    const d = await h.h('getDeathState');
    const t = {
      id: 'T3_mid_death_save_same_session_load',
      after_load: { surface_active: d.surface_active, bloom: d.bloodstain ? { souls: d.bloodstain.souls } : null, souls_held: d.souls_held, deaths_this_session: d.deaths_this_session },
    };
    await h.h('stepFrames', 300);
    const d2 = await h.h('getDeathState');
    t.after_300 = { surface_active: d2.surface_active, bloom: d2.bloodstain ? { souls: d2.bloodstain.souls, pos: d2.bloodstain.pos } : null, souls_held: d2.souls_held, deaths_this_session: d2.deaths_this_session };
    if (d2.bloodstain) {
      await h.h('teleport', d2.bloodstain.pos[0], d2.bloodstain.pos[2]);
      await h.h('stepFrames', 4);
      const d3 = await h.h('getDeathState');
      t.after_touching_bloom = { souls_held: d3.souls_held };
    }
    const rec = t.after_touching_bloom ? t.after_touching_bloom.souls_held : t.after_300.souls_held;
    t.souls_recoverable_after_load = rec;
    t.souls_destroyed_by_the_save = SOULS - rec;
    t.pass = t.souls_destroyed_by_the_save === 0;
    out.trials.push(t);
    log(`T3 mid-death save, same-session load: ${SOULS} in -> ${rec} recoverable  (${t.pass ? 'PASS' : 'LOST ' + t.souls_destroyed_by_the_save})`);
  }

  out.page_errors = handle.errors.slice(0, 10);
  out.ok = out.trials.every((t) => t.pass);
  if (args.out) writeJson(args.out, out);
  else console.log(JSON.stringify(out, null, 1));
  process.exitCode = out.ok ? 0 : 1;
} catch (e) {
  out.error = String(e && e.message || e);
  out.ok = false;
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-a: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}

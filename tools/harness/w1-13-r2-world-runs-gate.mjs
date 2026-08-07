#!/usr/bin/env node
/**
 * w1-13-r2-world-runs-gate.mjs — does RI-JRN06's entry gate actually save the item?
 *
 * W1-13 round 2. `tools/journey/jrn06-death.mjs` was found reporting nineteen `[OK]` rows
 * against a **stopped simulation**: `damagePlayer(1e5)` followed by `stepFrames` produced no
 * death, no surface, no bloodstain and no record, twenty times in a row, and the only place the
 * failures appeared was inside a summary map nobody reads first.
 *
 * THE MECHANISM, in three facts:
 *   1. `Engine._step()` returns early while a UI screen is open outside combat. That is S14 and
 *      it is correct — "outside a fight, in a menu, the simulation does not advance".
 *   2. `loadState()` DOES NOT CLOSE AN OPEN SCREEN.
 *   3. therefore one screen left open by an earlier leg of `journey-run.mjs` freezes every block
 *      of RI-JRN06, and no `loadState` inside it can recover.
 *
 * `runJrn06()` now closes whatever is up and PROVES the world moves before it measures anything.
 * This file is the proof that the gate does what it says, and it is deliberately cheap: it does
 * not run the item, it runs the three facts and the recovery, so it can be taken on a loaded box
 * where the full journey cannot.
 *
 * Each row carries its own control, because the whole point is that the failing state and the
 * healthy state must be distinguishable.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r2-world-runs-gate.mjs [--out <file>]'); process.exit(0); }

const out = { schema: 'w1-13/r2-world-runs-gate@1', rows: [] };
let handle;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  const H = (m, ...a) => h.h(m, ...a);
  const frame = async () => { const r = await H('getFrame'); return typeof r === 'number' ? r : (r && r.frame); };
  const openScreen = (n) => h.page.evaluate(async (s) => {
    try { return { ok: true, mode: await window.__HARNESS.openMenu(s) }; }
    catch (e) { return { ok: false, threw: String((e && e.message) || e) }; }
  }, n);

  await H('loadState', 'default');
  await H('setRenderRate', 0);

  // ---- 1. THE CONTROL. A healthy world: frames advance, a death registers. -----------------
  {
    const f0 = await frame();
    await H('stepFrames', 5);
    const advanced = (await frame()) - f0;
    const list = await H('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await H('teleport', hearth.pos[0], hearth.pos[2]); await H('stepFrames', 2);
    await H('restAt', hearth.id);
    await H('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18); await H('stepFrames', 4);
    const before = (await H('getDeathState')).deaths_this_session;
    await H('damagePlayer', 100000, { stagger: false });
    await H('stepFrames', 1);
    const surface = (await H('getDeathState')).surface_active;
    await H('stepFrames', 220);
    const d = await H('getDeathState');
    out.rows.push({
      id: 'control_healthy_world',
      ui_mode: (await H('getUIState')).mode,
      frames_advanced_by_stepFrames_5: advanced,
      surface_went_up: surface,
      deaths_this_session: [before, d.deaths_this_session],
      bloodstain: d.bloodstain ? { souls: d.bloodstain.souls } : null,
      pass: advanced === 5 && surface === true && d.deaths_this_session === before + 1,
    });
  }

  // ---- 2. THE FAILURE. A screen open outside combat: the world stops and nothing dies. ------
  {
    await H('loadState', 'default');
    const opened = await openScreen('sheet');
    const mode = (await H('getUIState')).mode;
    const f0 = await frame();
    await H('stepFrames', 10);
    const advanced = (await frame()) - f0;
    const list = await H('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await H('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
    await H('stepFrames', 4);
    const before = (await H('getDeathState')).deaths_this_session;
    await H('damagePlayer', 100000, { stagger: false });
    await H('stepFrames', 1);
    const d = await H('getDeathState');
    out.rows.push({
      id: 'failure_screen_open_stops_the_world',
      opened, ui_mode: mode,
      frames_advanced_by_stepFrames_10: advanced,
      surface_went_up: d.surface_active,
      deaths_this_session: [before, d.deaths_this_session],
      // This is the state the journey was measuring in, and every check in it reported OK.
      pass: advanced === 0 && d.surface_active === false && d.deaths_this_session === before,
      _means: 'The world is stopped. damagePlayer(1e5) killed nobody. This is the state twenty '
        + 'scripted deaths were driven in, and nineteen checks reported [OK] from it.',
    });
  }

  // ---- 3. loadState DOES NOT RESCUE IT. ----------------------------------------------------
  {
    await H('loadState', 'arena_flat');
    const mode = (await H('getUIState')).mode;
    const f0 = await frame();
    await H('stepFrames', 5);
    const advanced = (await frame()) - f0;
    out.rows.push({
      id: 'loadState_does_not_close_the_screen',
      ui_mode_after_loadState: mode,
      frames_advanced_by_stepFrames_5: advanced,
      pass: mode === 'sheet' && advanced === 0,
      _means: 'A screen survives a state load, so no loadState inside RI-JRN06 could ever have '
        + 'recovered the item once an upstream leg left one open.',
    });
  }

  // ---- 4. THE GATE. closeMenu, then the world moves and a death registers again. ------------
  {
    await H('closeMenu').catch(() => {});
    const mode = (await H('getUIState')).mode;
    const f0 = await frame();
    await H('stepFrames', 5);
    const advanced = (await frame()) - f0;
    await H('loadState', 'default');
    const list = await H('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await H('teleport', hearth.pos[0], hearth.pos[2]); await H('stepFrames', 2);
    await H('restAt', hearth.id);
    const b0 = await H('saveState');
    b0.character.souls_held = 4200;
    await H('restoreState', b0);
    await H('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18); await H('stepFrames', 4);
    const before = (await H('getDeathState')).deaths_this_session;
    await H('damagePlayer', 100000, { stagger: false });
    await H('stepFrames', 1);
    const surface = (await H('getDeathState')).surface_active;
    await H('stepFrames', 220);
    const d = await H('getDeathState');
    out.rows.push({
      id: 'gate_recovers_it',
      ui_mode_after_closeMenu: mode,
      frames_advanced_by_stepFrames_5: advanced,
      surface_went_up: surface,
      deaths_this_session: [before, d.deaths_this_session],
      bloodstain_souls: d.bloodstain ? d.bloodstain.souls : null,
      respawned_at: d.last_respawn ? d.last_respawn.at : null,
      pass: mode === 'world' && advanced === 5 && surface === true
        && d.deaths_this_session === before + 1 && !!d.bloodstain && d.bloodstain.souls === 4200,
    });
  }

  out.summary = {
    rows: out.rows.length,
    passing: out.rows.filter((r) => r.pass).length,
    all_pass: out.rows.every((r) => r.pass),
  };
  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  for (const r of out.rows) log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id}`);
  log(`SUMMARY ${JSON.stringify(out.summary)}`);
  if (!out.summary.all_pass) process.exitCode = 1;
} catch (e) {
  out.error = String((e && e.stack) || e);
  if (args.out) writeJson(args.out, out);
  log('w1-13-r2-world-runs-gate: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}

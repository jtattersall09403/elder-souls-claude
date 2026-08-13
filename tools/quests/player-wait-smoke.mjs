#!/usr/bin/env node
// Focused consumption check for the player-facing wait screen. Every transition below is driven
// by the shipped menu, peer-navigation, movement-axis and confirm inputs.
import { parseArgs, wantsHelp, usage, writeJson, log, EXIT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
player-wait-smoke.mjs — exercise the production wait menu and its combat refusal.

USAGE
  node tools/quests/player-wait-smoke.mjs [--chromium <path>] [--out <file>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
let handle;
try {
  handle = await launchGame({ ...args, width: 1280, height: 720, timeout: Number(args.timeout || 90000) });
  const report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.loadState('soulrest-quay');
    H.clearInputs(); H.stepFrames(4);

    const tap = (action) => {
      H.queueInputs([{ f: 0, press: [action] }]); H.stepFrames(1);
      H.queueInputs([{ f: 0, release: [action] }]); H.stepFrames(1);
    };
    const axis = (move) => { H.queueInputs([{ f: 0, move }]); H.stepFrames(1); };
    const before = { env: H.getEnvironment(), stats: H.getPlayerStats(), where: H.whereAmI() };
    const modes = [];
    tap('menu'); modes.push(H.getUIState().mode);
    for (let i = 0; i < 8 && H.getUIState().mode !== 'wait'; i++) {
      tap('swap_right'); modes.push(H.getUIState().mode);
    }
    const waitOpen = H.getUIState();
    axis([0, -1]); axis([0, 0]);
    axis([0, -1]); axis([0, 0]);
    const selected = H.getUIState();
    tap('interact'); H.clearInputs(); H.stepFrames(2);
    const after = { env: H.getEnvironment(), stats: H.getPlayerStats(), where: H.whereAmI(), ui: H.getUIState() };
    const hourDelta = ((after.env.time_of_day - before.env.time_of_day) % 24 + 24) % 24;
    const moved = Math.hypot(...after.where.pos.map((v, i) => v - before.where.pos[i]));

    // Combat arm: the pause menu remains usable, but wait is absent from its advertised and
    // input-walkable destinations while the live fight controls retain the swap actions.
    const foe = H.spawn('guard_legion', after.where.pos[0] + 4, after.where.pos[2] + 1, {});
    H.aggro(foe); H.stepFrames(3);
    tap('menu');
    const combatMenu = H.getUIState();
    const combatModes = [combatMenu.mode];
    for (let i = 0; i < 8; i++) { tap('swap_right'); combatModes.push(H.getUIState().mode); }
    const combatAfter = H.getUIState();
    tap('menu');

    const checks = {
      reached_wait_by_input: waitOpen.mode === 'wait',
      selected_three_hours: selected.focus && selected.focus.hours === 3,
      returned_to_world: after.ui.mode === 'world',
      clock_advanced_three_hours: Math.abs(hourDelta - 3) < 0.01,
      body_did_not_move: moved < 1e-6,
      hp_not_restored: after.stats.hp === before.stats.hp,
      flask_not_restored: after.stats.estus === before.stats.estus,
      wait_hidden_in_combat: !combatMenu.navigable.includes('wait') && !combatMenu.nav.walkable.includes('wait'),
      combat_input_did_not_reach_wait: !combatModes.includes('wait') && combatAfter.mode !== 'wait',
    };
    return {
      ok: Object.values(checks).every(Boolean), checks, modes, combat_modes: combatModes,
      before, selected: { mode: selected.mode, focus: selected.focus }, after,
      observed_hour_delta: hourDelta, position_delta_m: moved,
    };
  });
  if (args.out) writeJson(String(args.out), report);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.ok) process.exitCode = EXIT.MEASUREMENT_FAIL;
  else log('player-wait-smoke: PASS — wait advanced the calendar by production input and refused combat');
} catch (e) {
  process.stderr.write(String(e && e.stack || e) + '\n');
  process.exitCode = EXIT.HARNESS_ERROR;
} finally {
  if (handle) await handle.close();
}

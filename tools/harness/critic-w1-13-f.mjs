#!/usr/bin/env node
/**
 * critic-w1-13-f.mjs — W1-13 round-1 critic, probe F: CAN YOU LEVEL UP AT A SAPWELL?
 *
 * `RI-PRG04` §1 makes it binding and exclusive: a HEARTH is where you "spend souls, +1
 * attribute per level ... THE ONLY PLACE LEVELLING IS POSSIBLE". `game/src/ui/system.js` gates
 * the level-up screen on `ctx.atHearth` in three places, and `game/src/engine.js:2011` computes
 * that flag as:
 *
 *     atHearth: !!(this.hearths && this.hearths.atHearth && this.hearths.atHearth(this.sim))
 *               || !!this.sim._uiForceHearth
 *
 * `HearthSystem` (game/src/sim/hearth.js) defines `list/get/count/nearest/at/gateAt/menu`. It
 * does not define `atHearth`. So the first disjunct is `undefined` at every sapwell in the
 * province and the flag can only be raised by `setAtHearth()`, a harness override.
 *
 * This probe asks the LIVE UI, standing on the basin, whether the screen is offered — and then
 * asks again with the override on, so a null answer is distinguishable from a broken probe.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-f.mjs [--out <file>]'); process.exit(0); }
const out = { schema: 'critic/w1-13-f@1', wells: [], override: null };
let handle;

/** `handle.h()` exits the process on an in-page throw, and here the throw IS the result. */
const tryOpen = (h, name) => h.page.evaluate(async (n) => {
  try { return { ok: true, result: await window.__HARNESS.openMenu(n) }; }
  catch (e) { return { ok: false, threw: String(e && e.message || e) }; }
}, name);

const probeUI = async (h) => {
  const ui = await h.h('getUIState');
  const ctx = await h.hOpt('getUIContext');
  return {
    mode: ui.mode,
    screens_offered: ui.screens || ui.available || ui.tabs || null,
    at_hearth_flag: ctx ? ctx.atHearth : (ui.atHearth !== undefined ? ui.atHearth : null),
    hearth_name: ctx ? ctx.hearthName : (ui.hearthName || null),
    raw_keys: Object.keys(ui),
  };
};

try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const h = handle;
  await h.h('setRenderRate', 0);
  const list = await h.h('listHearths');

  for (const id of ['hearth-archon', 'hearth-lilmoth', 'hearth-gideon']) {
    const w = list.hearths.find((x) => x.id === id);
    if (!w) continue;
    await h.h('loadState', 'default');
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 4);
    const standing = (await h.h('listHearths')).standing_at;   // the registry says we are on it
    await h.h('restAt', w.id);
    await h.h('stepFrames', 4);
    const ui = await probeUI(h);
    // Try to actually open the screen the way the input layer would.
    const opened = await tryOpen(h, 'levelup');
    const after = await h.h('getUIState');
    out.wells.push({
      hearth: id, basin: w.pos,
      registry_says_standing_at: standing,
      ui: ui,
      open_levelup_result: opened,
      ui_mode_after: after.mode,
      levelup_reachable: after.mode === 'levelup',
    });
    log(`${id}: registry standing_at=${standing}  atHearth=${ui.at_hearth_flag}  open -> ${opened.ok ? 'OPENED' : 'REFUSED'}  mode=${after.mode}`);
  }

  // The control: raise the override and confirm the screen IS reachable, so "not reachable"
  // above is a statement about the flag and not about this probe.
  {
    const w = list.hearths.find((x) => x.id === 'hearth-archon');
    await h.h('loadState', 'default');
    await h.h('teleport', w.pos[0], w.pos[2]);
    await h.h('stepFrames', 3);
    await h.h('restAt', w.id);
    const set = await h.hOpt('setAtHearth', true);
    await h.h('stepFrames', 3);
    const ui = await probeUI(h);
    const opened = await tryOpen(h, 'levelup');
    const after = await h.h('getUIState');
    out.override = {
      setAtHearth: set, ui, open_levelup_result: opened, ui_mode_after: after.mode,
      levelup_reachable: after.mode === 'levelup',
      _note: 'setAtHearth() is a harness override with no in-game counterpart. If the screen is '
        + 'reachable HERE and not at the basin, the sapwell is not what opens it.',
    };
    log(`override setAtHearth(true): atHearth=${ui.at_hearth_flag}  open -> ${opened.ok ? 'OPENED' : 'REFUSED'}  mode=${after.mode}`);
  }

  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
} catch (e) {
  out.error = String(e && e.stack || e);
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-f: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}

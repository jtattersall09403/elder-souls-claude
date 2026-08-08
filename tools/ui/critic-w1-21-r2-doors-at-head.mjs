#!/usr/bin/env node
// critic-w1-21-r2-doors-at-head.mjs — RULES 12, applied to the round's headline result.
//
// Pass B of `critic-w1-21-r2-a.mjs` measured the six doors with real key presses at `e97347f`.
// While I was writing up, neighbours committed `345dcca` and `cc70ad2`, and one of them changes
// `game/src/input/real.js` — the exact file pass B exists to measure. The new block routes a
// keydown to a focused text field BEFORE the movement and control maps, gated on
// `this.textFocus && this.textFocus()`, which is null everywhere outside a naming surface.
//
// Reading the guard says the walk is unaffected. This runs it instead. Nothing else: no walk, no
// teleport, no forgery — just the six doors, at HEAD, in about a minute.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('critic-w1-21-r2-doors-at-head.mjs — re-stamp pass B at HEAD.');
const say = (s) => process.stdout.write(s + '\n');
const RUN = path.join(RUNS_DIR, String(args.out || 'CRITIC-W1-21-R2'));
ensureDir(RUN);

const out = { probe: 'critic-w1-21-r2-doors-at-head', at: new Date().toISOString(), checks: [] };
const h = await launchGame({ width: 1280, height: 720, timeout: 300000 });
try {
  await h.h('setRenderRate', 60);
  await h.h('loadState', 'ui-journal');
  await h.h('setAtHearth', true);
  await h.h('stepFrames', 4);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 2);
  const mode = async () => (await h.h('getUIState')).mode;
  const key = async (code) => {
    await h.page.keyboard.down(code); await h.h('stepFrames', 1);
    await h.page.keyboard.up(code); await h.h('stepFrames', 2);
  };
  out.textFocus_is_null = await h.page.evaluate(() => window.__ENGINE.real.textFocus === null);
  await h.h('closeMenu'); await h.h('stepFrames', 2);
  const seq = [await mode()];
  await key('KeyQ'); const unbound = await mode();
  await key('KeyM'); seq.push(await mode());
  for (let i = 0; i < 6; i++) { await key('Digit3'); seq.push(await mode()); }
  await key('Escape'); const closed = await mode();
  out.walk = seq; out.unbound_key_moved_nothing = unbound === 'world'; out.escape_closed = closed;
  out.text_chars_taken = await h.page.evaluate(() => window.__ENGINE.real.textCharsTaken);
  const SIX = ['inventory', 'journal', 'sheet', 'spells', 'map', 'levelup'];
  const missing = SIX.filter((s) => !seq.includes(s));
  out.pass = missing.length === 0 && unbound === 'world' && closed === 'world';
  say(`  textFocus null: ${out.textFocus_is_null}; textCharsTaken after the walk: ${out.text_chars_taken}`);
  say(`  KeyQ (unbound): world -> ${unbound}`);
  say(`  walk: ${seq.join(' -> ')}`);
  say(`  Escape from ${seq[seq.length - 1]} -> ${closed}`);
  say(`${out.pass ? 'ok  ' : 'FAIL'} B-at-HEAD  the six doors still open on real key presses  — missing [${missing.join(',') || '-'}]`);
} finally { await h.close(); }
writeJson(path.join(RUN, 'doors-at-head.json'), out);
process.exit(out.pass ? 0 : 1);

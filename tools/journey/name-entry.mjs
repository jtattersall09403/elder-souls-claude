#!/usr/bin/env node
// name-entry.mjs — can a player type their own name?
//
// Owner: the W1-26 round-2 critic. Rule 24: `RI-JRN09` M2 and `RI-CHR01` §1 row 1 both rest on
// the player supplying a hatch-name, and no instrument in the tree has ever supplied one the way
// a player does. Every probe calls `__HARNESS.censusAnswer('Silence-Under-Salt')`, which hands
// the string straight to `Census.answer()` and never touches the keyboard path at all.
//
// THE MECHANISM UNDER TEST. `game/src/input/real.js` `attach()` handles a `keydown` in this
// order:
//
//     const dir = this.moveCodes[e.code];   if (dir)    { ...; return; }   // W A S D, arrows
//     const action = this.controlMap[e.code]; if (action) { this._down(...); return; }
//     if (this.onTextChar) { ... this.onTextChar(e.key); }                 // text entry, LAST
//
// So a letter that is bound to a movement direction or to an action is consumed as a button and
// never reaches the text field. `game/data/input/profiles.json` binds fourteen letters, four
// digits and `Space`. Two of the fourteen are worse than dropped: `KeyE` is `interact`, which
// COMMITS the node, and `Space` is `roll`.
//
// WHAT THIS TOOL DOES. It derives the unreachable characters from the bindings DATA (never from
// a list typed here), then types two names into `hold.hatch-name` through real DOM key events
// and reads back what the census recorded:
//
//   ARM A (control)      a name built only from UNBOUND characters. Must round-trip verbatim.
//                        If it does not, the defect is in the typing path, not in the bindings,
//                        and this tool says so instead of blaming the bindings.
//   ARM B (perturbation) a name containing bound letters. Predicted, character for character,
//                        from the bindings alone BEFORE the browser is asked.
//
// Two arms that differ only in which letters were pressed. If A round-trips and B comes back as
// the prediction, the binding shadow is the cause and nothing else is.
//
// The node is REACHED through the harness (`censusBegin` / `censusEnter`) because reaching it is
// not what is being measured and a real-input approach costs eight minutes on this box; the
// MEASUREMENT — every keystroke — is real DOM input into the real listeners, with the engine in
// `play-instrumented` so `input/real.js` is attached. That deviation is stated here and in the
// artifact rather than buried.
//
// EXIT: non-zero when a typed name is not recorded verbatim.
//
// USAGE
//   node tools/journey/name-entry.mjs [--json <path>] [--race saxhleel]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
name-entry.mjs — type a hatch-name on a real keyboard and read back what was recorded.

USAGE
  node tools/journey/name-entry.mjs [--json <path>] [--race <id>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'journeys', 'w1-26-r2-name-entry.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

// ---- derive the shadowed characters from the DATA -------------------------------------------
const profiles = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/input/profiles.json'), 'utf8'));
const codes = new Set();
for (const list of Object.values(profiles.desktop.bindings)) for (const c of list) if (c) codes.add(c);
for (const list of Object.values(profiles.desktop.move)) for (const c of list) if (c) codes.add(c);
const boundLetters = [...codes].filter((c) => /^Key[A-Z]$/.test(c)).map((c) => c.slice(3)).sort();
const boundDigits = [...codes].filter((c) => /^Digit[0-9]$/.test(c)).map((c) => c.slice(5)).sort();
const spaceBound = codes.has('Space');
const commitLetters = Object.entries(profiles.desktop.bindings)
  .filter(([action]) => action === 'interact')
  .flatMap(([, list]) => list).filter((c) => /^Key[A-Z]$/.test(c)).map((c) => c.slice(3));

/** What `input/real.js` will let through, given those bindings. */
const shadowed = (ch) => boundLetters.includes(ch.toUpperCase()) || boundDigits.includes(ch) || (ch === ' ' && spaceBound);
const predict = (name) => [...name].filter((ch) => !shadowed(ch)).join('');

const ARM_A = 'Hio-Junnilo';           // h i o j u n l — every character unbound
const ARM_B = 'Silt-Under-Salt';       // the name the round-1 and round-2 probes used

const out = {
  schema: 'elder-souls/name-entry@1',
  piece: 'W1-26',
  role: 'critic round 2',
  items: ['RI-JRN09', 'RI-CHR01'],
  question: 'Does the hatch-name a player types on a keyboard reach the census intact?',
  method_deviation: 'the node is reached through censusBegin/censusEnter; every keystroke measured is a real DOM key event into input/real.js with the engine in play-instrumented mode',
  bindings: { bound_letters: boundLetters, bound_digits: boundDigits, space_bound: spaceBound, interact_letters: commitLetters },
  predicted: { [ARM_A]: predict(ARM_A), [ARM_B]: predict(ARM_B) },
  arms: [],
  passes: [], failures: [],
};
const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out[id] = { ok: true, ...d }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out[id] = { ok: false, ...d }; };

say(`  bindings shadow ${boundLetters.length} of 26 letters: ${boundLetters.join(' ')}`);
say(`  digits ${boundDigits.join(' ')}; space bound to a button: ${spaceBound}`);
say(`  'interact' (which COMMITS the node) is on: ${commitLetters.join(', ') || 'no letter'}`);
say(`  predicted from the data alone: ${JSON.stringify(ARM_A)} -> ${JSON.stringify(predict(ARM_A))}`);
say(`                                 ${JSON.stringify(ARM_B)} -> ${JSON.stringify(predict(ARM_B))}`);
say('');

const h = await launchGame({ width: 640, height: 360, timeout: 180000 });
let exitCode = 0;
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());

  const modeRes = await h.page.evaluate(() => (window.__HARNESS.setMode ? window.__HARNESS.setMode('play-instrumented') : undefined));
  out.mode = modeRes === undefined ? 'setMode absent' : modeRes;
  if (modeRes === undefined) {
    fail('N0', 'window.__HARNESS.setMode is absent, so the real listeners cannot be attached and nothing below is a keyboard measurement', {});
    throw new Error('setMode absent');
  }
  await h.page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  for (const name of [ARM_A, ARM_B]) {
    // A fresh scene per arm, so the two differ only in which keys were pressed.
    const opened = await h.page.evaluate((race) => {
      window.__HARNESS.censusBegin({ race });
      window.__HARNESS.censusEnter && window.__HARNESS.censusEnter('talk');
      const e = window.__ENGINE; const st = e.census.state();
      return { node: st.node, kind: st.input ? st.input.kind : null, takes_input: !!(e.censusSurface && e.censusSurface.takesInput) };
    }, String(args.race || 'saxhleel'));
    await h.page.evaluate(() => window.__HARNESS.stepFrames(4));
    // One character, one fixed step. A player types slower than 60 Hz, so this removes frame
    // rate from the question entirely and leaves only the binding shadow.
    const perChar = [];
    for (const ch of name) {
      await h.page.keyboard.press(ch === ' ' ? 'Space' : ch);
      await h.page.evaluate(() => window.__HARNESS.stepFrames(1));
      const s = await h.page.evaluate(() => {
        const e = window.__ENGINE;
        return { typed: e.censusSurface ? e.censusSurface.typed : null, node: e.census.state().node, takes_input: !!(e.censusSurface && e.censusSurface.takesInput) };
      });
      perChar.push({ pressed: ch, typed_after: s.typed, node: s.node });
      if (s.node !== opened.node) break;   // the node committed itself mid-word
    }
    const end = await h.page.evaluate(() => {
      const e = window.__ENGINE;
      return { typed: e.censusSurface ? e.censusSurface.typed : null, node: e.census.state().node, hatchName: e.census.spec.hatchName };
    });
    const committed_early = end.node !== opened.node;
    const got = committed_early ? end.hatchName : end.typed;
    const arm = { name, opened_at: opened.node, predicted: predict(name), got, verbatim: got === name, committed_early, committed_at_node: end.node, per_char: perChar };
    out.arms.push(arm);
    say(`  typed ${JSON.stringify(name)} -> recorded ${JSON.stringify(got)}${committed_early ? `  (the scene COMMITTED mid-word and moved to ${end.node})` : ''}`);
  }

  const a = out.arms[0], b = out.arms[1];
  if (a.verbatim) {
    pass('N1', `a name of unbound characters round-trips verbatim (${JSON.stringify(a.name)})`, { got: a.got });
  } else {
    fail('N1', `even a name of unbound characters is corrupted (${JSON.stringify(a.name)} -> ${JSON.stringify(a.got)}) — the defect is in the typing path, not only in the bindings`, { arm: a });
  }
  if (b.verbatim) {
    pass('N2', `a name containing bound letters round-trips verbatim (${JSON.stringify(b.name)})`, { got: b.got });
  } else {
    fail('N2', `a name containing bound letters is recorded as ${JSON.stringify(b.got)} — ${b.committed_early ? 'and the scene committed it mid-word' : 'characters are silently dropped'}`, { arm: b, predicted: b.predicted, prediction_held: b.got === b.predicted });
  }
  out.prediction_held = b.got === b.predicted;
  if (out.prediction_held) say(`  the prediction made from game/data/input/profiles.json alone holds character for character.`);
  out.conditions = { loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number) };
} catch (e) {
  fail('RUN', `the probe threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);

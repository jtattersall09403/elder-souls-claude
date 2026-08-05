// Scenario loading + input-script normalisation.
// Spec: corpus/80-methods/HARNESS.md §4 (scripted input) and §6 (scenarios).
import fs from 'node:fs';
import path from 'node:path';
import { TOOLS_DIR, EXIT, die, readJson } from './cli.mjs';

export const SCENARIO_DIR = path.join(TOOLS_DIR, 'harness', 'scenarios');

/** The complete, closed set of logical buttons. The game MUST accept exactly these names. */
export const BUTTONS = [
  'light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump',
  'use_item', 'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu',
];

export function listScenarios() {
  if (!fs.existsSync(SCENARIO_DIR)) return [];
  return fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json')).sort();
}

export function loadScenario(nameOrPath) {
  const direct = path.resolve(String(nameOrPath));
  const byName = path.join(SCENARIO_DIR, String(nameOrPath) + '.json');
  const p = fs.existsSync(direct) && direct.endsWith('.json') ? direct
    : fs.existsSync(byName) ? byName : null;
  if (!p) {
    die(EXIT.USAGE,
      `unknown scenario '${nameOrPath}'. Available: ${listScenarios().join(', ') || '(none)'}\n` +
      `  Scenario files live in ${SCENARIO_DIR}`);
  }
  const s = readJson(p);
  s.__path = p;
  s.id = s.id || path.basename(p, '.json');
  return normaliseScenario(s);
}

export function normaliseScenario(s) {
  s.seed = Number.isFinite(s.seed) ? s.seed : 1337;
  s.frames = Number.isFinite(s.frames) ? s.frames : 600;
  s.warmupFrames = Number.isFinite(s.warmupFrames) ? s.warmupFrames : 30;
  s.setup = Array.isArray(s.setup) ? s.setup : [];
  s.world = s.world || {};
  s.inputs = normaliseInputs(s.inputs || []);
  s.trace = Object.assign({ shape: 'frame', enemies: true, hitboxes: true, events: true }, s.trace || {});
  return s;
}

/**
 * Normalise an input script into the canonical event list the game receives.
 * Accepted sugar:
 *   {f, tap: "light"|["light"], hold?: n}   → press at f, release at f+hold (default 2)
 *   {f, hold: ["sprint"], until: n}         → press at f, release at until
 *   {f, press: [...], release: [...]}       → literal
 *   {f, move: [mx,my]} / {f, look: [lx,ly]} → axis set, persists until changed
 * Output records are strictly: {f, press?:[], release?:[], move?:[x,y], look?:[x,y]}
 */
export function normaliseInputs(script) {
  const events = [];
  const push = (f, key, val) => {
    if (!Number.isInteger(f) || f < 0) throw new Error(`input event has invalid frame: ${JSON.stringify(f)}`);
    let e = events.find((x) => x.f === f);
    if (!e) { e = { f }; events.push(e); }
    if (key === 'press' || key === 'release') { e[key] = [...new Set([...(e[key] || []), ...val])]; }
    else e[key] = val;
  };
  for (const raw of script) {
    const f = raw.f ?? raw.frame ?? 0;
    if (raw.move) push(f, 'move', [Number(raw.move[0]) || 0, Number(raw.move[1]) || 0]);
    if (raw.look) push(f, 'look', [Number(raw.look[0]) || 0, Number(raw.look[1]) || 0]);
    if (raw.press) push(f, 'press', arr(raw.press));
    if (raw.release) push(f, 'release', arr(raw.release));
    if (raw.tap) {
      const btns = arr(raw.tap);
      const dur = Number.isFinite(raw.hold) ? raw.hold : 2;
      push(f, 'press', btns); push(f + dur, 'release', btns);
    } else if (raw.hold && Array.isArray(raw.hold)) {
      const btns = arr(raw.hold);
      push(f, 'press', btns);
      if (Number.isFinite(raw.until)) push(raw.until, 'release', btns);
    }
  }
  for (const e of events) {
    for (const b of [...(e.press || []), ...(e.release || [])]) {
      if (!BUTTONS.includes(b)) {
        throw new Error(`unknown button '${b}'. Legal buttons: ${BUTTONS.join(', ')}`);
      }
    }
  }
  return events.sort((a, b) => a.f - b.f);
}

function arr(v) { return Array.isArray(v) ? v : [v]; }

/** Longest frame referenced by the script — a scenario must run at least this long. */
export function scriptLastFrame(events) {
  return events.reduce((m, e) => Math.max(m, e.f), 0);
}

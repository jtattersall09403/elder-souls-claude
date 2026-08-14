// opening.mjs — THE OPENING A PLAYER ACTUALLY GETS, as one shared function.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------------------------
//
// `reports/spawn-truth/2026-08-14-spawn-truth.md` settled a factual disagreement by playing the
// game: **the game starts in Thorn, and every "first ten minutes" measurement this project has
// taken was taken at Lilmoth.**
//
// The mechanism is one line in `game/src/main.js`:
//
//     const stateName = params.get('state') || 'default';
//
// and one line in `tools/lib/browser.mjs#resolveEntry()`, which builds the route `/game/index.html`
// with no query string at all. So every harness tool in the fleet boots into
// `game/data/states/default.json` — *"A fresh character on the harbour steps at Lilmoth"* — which
// is a perfectly good place to measure THE WORLD from and is not, and has never been, where a
// player who clicks **New** ends up. `Engine._titleApply('new')` calls `censusBegin({})`, which
// stages `barge-hold` and then `writ-house`, both tagged `"settlement": "thorn"`.
//
// The debug default is NOT being deleted: booting straight into a known world coordinate is the
// right thing for a tool that measures terrain, weather or a settlement other than Thorn. What
// changed is which one you get by DEFAULT when you claim to be measuring "the opening", and how
// loudly the other one announces itself.
//
// ---------------------------------------------------------------------------------------------
// WHAT YOU GET
// ---------------------------------------------------------------------------------------------
//
//   `playToWritHouse(g)`   title -> New -> the whole census graph -> control handed back, in the
//                          Writ House at Tidewrack. Every input goes through the same verbs
//                          `interact` reaches (`titleActivate`, `censusEnter`, `censusAnswer`).
//   `leaveWritHouse(g)`    out through the door, through `leaveInterior()` — the real placement,
//                          not a teleport. Returns where you landed and which way you face.
//   `startOpening(g, o)`   both of the above, with `{ start: 'debug' }` to opt into the Lilmoth
//                          harness default instead — and a banner in the log when you do.
//   `debugSpawnBanner()`   the banner on its own, for a tool that boots the debug default for its
//                          own reasons and wants to say so.
//
// The census answers are deterministic (questionnaire options cycled, first pick taken, two fixed
// names) so two runs of a measuring tool are comparable, which is the whole point of a harness.
'use strict';

/** The interiors character creation happens in, in order, and the town they are both in. */
export const OPENING = Object.freeze({
  settlement: 'thorn',
  interiors: Object.freeze(['barge-hold', 'writ-house']),
  ends_in: 'writ-house',
  evidence: 'reports/spawn-truth/2026-08-14-spawn-truth.md',
});

/** The harness/debug boot, named so a tool can say which one it used. */
export const DEBUG_SPAWN = Object.freeze({
  state: 'default',
  file: 'game/data/states/default.json',
  settlement: 'lilmoth',
  why_it_exists: 'a known world coordinate to measure terrain and weather from, with no scene to drive',
});

/**
 * THE LOUD PART. A tool that measures the debug spawn and calls it "the opening" is the exact
 * mistake that cost this project the visual audit, the first-ten-minutes build AND its critic, so
 * this is a banner and not a one-line note.
 */
export function debugSpawnBanner(label = 'this run') {
  const bar = '='.repeat(78);
  return [
    bar,
    `!! ${label.toUpperCase()} IS MEASURING THE DEBUG SPAWN, NOT THE GAME'S OPENING.`,
    '',
    `   ${DEBUG_SPAWN.file} puts the body on the harbour steps at`,
    `   ${DEBUG_SPAWN.settlement.toUpperCase()}. A player who clicks "New" never passes through it: the title`,
    `   screen goes to censusBegin({}) -> barge-hold -> writ-house, both of which are in`,
    `   ${OPENING.settlement.toUpperCase()}. See ${OPENING.evidence}.`,
    '',
    '   Nothing measured here is evidence about what a new player sees.',
    bar,
  ].join('\n');
}

/**
 * Title -> New -> the whole character-creation graph, driven through the real verbs.
 *
 * @param {object} g       a `launchGame()` handle
 * @param {object} [opts]  `{ onStage(name, state) }` to photograph or log each stage
 * @returns {Promise<object>} `{ stages, node, interior, settlement, pos, yaw }`
 */
export async function playToWritHouse(g, opts = {}) {
  const onStage = typeof opts.onStage === 'function' ? opts.onStage : async () => {};
  const stages = [];
  const mark = async (name) => {
    const t = await g.page.evaluate(() => {
      const s = window.__ENGINE.sim;
      return {
        interior: s.env.interior, settlement: s.env.settlement,
        pos: s.player.pos.map((n) => +n.toFixed(2)), yaw: +s.player.yaw.toFixed(1),
        cam_yaw: s.camera ? +s.camera.yaw.toFixed(1) : null,
      };
    });
    stages.push({ stage: name, ...t });
    await onStage(name, t);
    return t;
  };

  await g.h('titleShow');
  await mark('title');
  await g.h('titleActivate', 'new');
  await mark('barge-hold');

  // The census graph. `guard` is a bound, not a schedule: the graph is finite and a run that
  // hits the bound is a defect in the graph, reported rather than swallowed.
  let qi = 0;
  let guard = 0;
  for (; guard < 250; guard++) {
    const st = await g.h('getCensusState');
    if (st.done) break;
    if (st.paused) { await g.h('censusEnter', st.resume_by); continue; }
    const inp = st.input;
    if (!inp) { await g.h('censusAnswer', null); continue; }
    let v;
    if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
    else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
    else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
    else if (st.node === 'writ.class-routes') v = 'questionnaire';
    else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
    await g.h('censusAnswer', v);
  }
  const end = await mark('writ-house-done');
  return { stages, exhausted_guard: guard >= 250, ...end };
}

/**
 * Out of the Writ House through the door, by the door verb — `leaveInterior()`, the same call
 * `stepSettlement` makes off the `interact` latch, which is what actually places the body.
 *
 * NOT a `teleport()`. The spawn-truth pass could not drive a walk to the door (the greedy walker
 * sticks on room geometry at x≈4.17, and the pre-existing `w1-26-r2-arrival.mjs` sticks at the
 * same coordinate independently — an open, separate defect) and fell back to `H.teleport()`,
 * which reaches the same coordinate but is NOT the same code path: a teleport takes `opts.yaw`
 * and a door does not. Measuring the door defect through a teleport would measure the instrument.
 */
export async function leaveWritHouse(g, interiorId) {
  const before = await g.page.evaluate(() => ({
    yaw: +window.__ENGINE.sim.player.yaw.toFixed(1),
    cam_yaw: window.__ENGINE.sim.camera ? +window.__ENGINE.sim.camera.yaw.toFixed(1) : null,
  }));
  const left = await g.h('exitInterior', ...(interiorId ? [interiorId] : []));
  await g.h('stepFrames', 6);
  const after = await g.page.evaluate(() => {
    const s = window.__ENGINE.sim;
    return {
      interior: s.env.interior, settlement: s.env.settlement,
      pos: s.player.pos.map((n) => +n.toFixed(2)), yaw: +s.player.yaw.toFixed(1),
      cam_yaw: s.camera ? +s.camera.yaw.toFixed(1) : null,
    };
  });
  return { before, left, after };
}

/**
 * The one call a measuring tool should make.
 *
 * `start: 'shipping'` (the default) is title -> New -> census -> out of the writ house door.
 * `start: 'debug'` leaves the boot state alone — Lilmoth — and prints the banner.
 */
export async function startOpening(g, opts = {}) {
  const start = String(opts.start || 'shipping');
  const say = typeof opts.log === 'function' ? opts.log : (s) => process.stdout.write(s + '\n');
  if (start === 'debug') {
    say(debugSpawnBanner(opts.label || 'this run'));
    const at = await g.page.evaluate(() => {
      const s = window.__ENGINE.sim;
      return { interior: s.env.interior, settlement: s.env.settlement, pos: s.player.pos.map((n) => +n.toFixed(2)), yaw: +s.player.yaw.toFixed(1) };
    });
    return { start, debug_spawn: DEBUG_SPAWN, ...at };
  }
  if (start !== 'shipping') throw new Error(`startOpening: unknown start '${start}' (want 'shipping' or 'debug')`);
  const creation = await playToWritHouse(g, opts);
  const exit = await leaveWritHouse(g, creation.interior || OPENING.ends_in);
  return { start, opening: OPENING, creation, exit, ...exit.after };
}

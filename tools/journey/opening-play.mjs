#!/usr/bin/env node
// opening-play.mjs — the opening, played. No harness verbs, no flags, no state set from outside.
//
// Owner: the W1-26 round-2 critic. Rule 24: this is an instrument a method named and nobody had
// built. Every other probe pointed at this scene drives it through `__HARNESS` — `queueInputs()`,
// `censusAnswer()`, `titleActivate()`, `stepFrames()`. Those are the harness's own words for what
// a player does, and they are not the same path: `stepFrames()` runs the fixed step directly,
// while a player's frame arrives through `requestAnimationFrame`; `queueInputs()` writes a script
// into `InputPipeline`, while a player's key arrives on a `window` `keydown` listener in
// `input/real.js` and has to survive `hasFocus`, pointer lock, `PREVENT_DEFAULT_CODES`,
// `_captureControl`, the control map and `consumeUI`.
//
// So this probe does the one thing no probe in the tree does:
//
//   * boots `game/index.html` with NO query string at all, and with `navigator.webdriver` forced
//     false, so `main.js` mode selection resolves to `'play'` the way it resolves for a human. In
//     `'play'` the sim advances ONLY from rAF — `stepFrames()` is never called here.
//   * drives every input with `page.keyboard` / `page.mouse`, i.e. real DOM events.
//   * reads state back through read-only accessors only (`getTitleState`, `getRenderedText`,
//     `getCensusState`, `sim.player.pos`) and never writes any.
//
// WHAT IT ASSERTS, each quoted from the item it comes from:
//   P1  play mode is reached with no flag                       (§P gate 1: "no flags")
//   P2  a title surface is drawn and its rows are legible        RI-JRN01 M20
//   P3  the title is navigable and committable BY KEY ALONE      RI-JRN01 O17
//   P4  `New` from the title puts a body in a world              §P gate 1
//   P5  the body moves under held movement keys                  RI-JRN01 O6
//   P6  nothing has asked the player who they are yet            RI-JRN01 O6 / How-we-lose #5
//   P7  the scene begins when the player reaches for a person    RI-JRN01 O6
//   P8  a character-defining answer can be given by key alone     RI-JRN09 M1 / RI-JRN01 O17
//   P9  no drawn string in the whole run tells the player what to do
//                                                                RI-JRN01 M9 (AR-2), HF3
//
// It exits non-zero when any of them fails, and `--red-team=<mode>` proves that it can:
//   --red-team=deaf     swallow every keydown before `input/real.js` sees it. P3 must go red.
//   --red-team=plant    draw an imperative string through the real vector glyph path. P9 must
//                       go red.
//   --red-team=harness  boot in harness mode (`?harness=1`). P1 must go red.
// In every red-team mode the exit code is INVERTED and the run passes only when a failure whose
// id matches the mode's signature is present. An unrelated failure is reported as the build's,
// never as the sabotage's — a red team that passes on any failure at all proves nothing.
//
// USAGE
//   node tools/journey/opening-play.mjs [--json <path>] [--shots <dir>] [--width N --height N]
//                                       [--wander-frames N] [--red-team deaf|plant|harness]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
opening-play.mjs — play the opening through real input only, in play mode, with no flags.

USAGE
  node tools/journey/opening-play.mjs [--json <path>] [--shots <dir>]
                                      [--width N] [--height N] [--wander-frames N]
                                      [--red-team deaf|plant|harness]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const WIDTH = Number(args.width || 960);
const HEIGHT = Number(args.height || 540);
const WANDER_FRAMES = Number(args['wander-frames'] || 900);
const RED = args['red-team'] ? String(args['red-team']) : null;
if (RED && !['deaf', 'plant', 'harness'].includes(RED)) {
  console.error(`unknown --red-team mode '${RED}' — expected deaf|plant|harness`);
  process.exit(2);
}
const RED_SIGNATURE = { deaf: 'P3', plant: 'P9', harness: 'P1' };

const shotsDir = args.shots ? path.resolve(String(args.shots)) : path.join(REPO_ROOT, 'docs', 'shots');
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'journeys', 'w1-26-r2-play.json');
ensureDir(path.dirname(jsonPath));
if (!RED) ensureDir(shotsDir);

const say = (s) => process.stdout.write(s + '\n');
const out = {
  schema: 'elder-souls/opening-play@1',
  piece: 'W1-26',
  role: 'critic round 2',
  items: ['RI-JRN01', 'RI-JRN09'],
  red_team: RED,
  drive: 'real DOM input only — page.keyboard / page.mouse. No __HARNESS mutator is called.',
  viewport: { width: WIDTH, height: HEIGHT },
  conditions: {},
  checks: {},
  shots: [],
  passes: [],
  failures: [],
};

const pass = (id, what, detail) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...detail }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, detail) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...detail }; say(`  FAIL ${id}  ${what}`); };

/** Load average, so every number below is reported under a stated load (rule 26). */
function loadavg() {
  try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); }
  catch { return null; }
}

/** Strings that command the player. `RI-JRN01` M9's clause and `RI-EXP01`'s tutorial_text. */
const IMPERATIVE = /^(press|hold|tap|click|use|push|move|walk|go|take|open|close|talk|speak|look|aim|pick|select|choose|enter|swipe|drag|attack|block|dodge|roll|equip|find|head|return|follow|try|now|you must|you should|you can|to \w+,)\b/i;
const EXPLAINS = /\b(tutorial|controls?:|hint|objective|press [a-z0-9]+ to|hold [a-z0-9]+ to|use the \w+ to|this is your)\b/i;

const h = await launchGame({
  width: WIDTH, height: HEIGHT, timeout: 180000,
  // The ONE thing that is not a player's browser: Playwright announces `navigator.webdriver`,
  // and `main.js` reads it to pick harness mode. Forcing it false is how this run reproduces a
  // human's first launch — it does not touch the game, it removes the automation tell. In
  // `--red-team=harness` it is left alone, and P1 must notice.
  initScripts: [
    ...(RED === 'harness' ? [] : ["Object.defineProperty(navigator,'webdriver',{get:()=>false,configurable:true});"]),
    ...(RED === 'deaf' ? ["window.addEventListener('keydown',(e)=>{e.stopImmediatePropagation();},true);"] : []),
  ],
  ...(RED === 'harness' ? { entry: path.join(REPO_ROOT, 'game', 'index.html') } : {}),
});

let exitCode = 0;
try {
  out.conditions.loadavg_at_start = loadavg();
  out.conditions.url = h.url;

  await h.page.waitForFunction(() => window.__HARNESS && typeof window.__HARNESS.ready === 'function', { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  out.conditions.commit = String(process.env.ES_COMMIT || '');

  // ---- P1 — play mode, reached with no flag -----------------------------------------------
  const boot = await h.page.evaluate(() => ({
    mode: window.__ENGINE.mode,
    search: location.search,
    webdriver: navigator.webdriver === true,
  }));
  out.checks.boot = boot;
  if (boot.mode === 'play' && boot.search === '') {
    pass('P1', 'play mode reached with no query string', boot);
  } else {
    fail('P1', `mode is '${boot.mode}' with search '${boot.search}' — not a player's first launch`, boot);
  }

  // ---- the rendered-text watermark. Read-only; advanced immediately before each act. -------
  const mark = () => h.page.evaluate(() => window.__HARNESS.getRenderedText({}).next_index);
  const since = (m) => h.page.evaluate((mm) => window.__HARNESS.getRenderedText({ since: mm }), m);
  const frame = () => h.page.evaluate(() => window.__ENGINE.sim.frame);
  const pos = () => h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());

  /** Wait for the rAF loop to advance `n` sim frames, with a wall-clock ceiling. */
  async function advance(n, capMs = 180000) {
    const f0 = await frame();
    const t0 = Date.now();
    let f = f0;
    while (f - f0 < n && Date.now() - t0 < capMs) {
      await h.page.waitForTimeout(120);
      f = await frame();
    }
    return { from: f0, to: f, advanced: f - f0, ms: Date.now() - t0 };
  }

  /** Sim frames per second as the rAF loop actually delivers them, under a stated load. */
  async function fps(label, capMs = 20000) {
    const f0 = await frame(); const t0 = Date.now();
    await h.page.waitForTimeout(capMs);
    const f1 = await frame(); const ms = Date.now() - t0;
    const v = Number(((f1 - f0) / (ms / 1000)).toFixed(2));
    out.conditions[`fps_${label}`] = { sim_fps: v, frames: f1 - f0, ms, loadavg: loadavg() };
    say(`  [fps ${label}] ${v} sim fps at ${WIDTH}x${HEIGHT}, loadavg ${JSON.stringify(loadavg())}`);
    return v;
  }
  out.conditions.fps_note = 'rAF-driven play mode, headless SwiftShader, under the stated load, on a box shared with other agents\' browsers. An upper bound on badness, not a machine spec.';
  await fps('at_title', 12000);

  /**
   * A frame of the run. Rule 27 wants a picture; `ARBITRATION` S34(b) forbids a PLACED capture
   * as evidence of arrival, and nothing here is placed — the body walked to where it stands, so
   * these are admissible as evidence of arrival by construction. A screenshot on a 1 fps box is
   * slow and must not be allowed to kill the run, so a failure is recorded, not thrown.
   */
  async function shot(name) {
    if (RED) return null;
    const p = path.join(shotsDir, `2026-08-08-w1-26-r2-${name}.png`);
    try {
      await h.page.screenshot({ path: p, timeout: 120000, animations: 'disabled' });
      out.shots.push(path.relative(REPO_ROOT, p));
      say(`  [shot] ${path.relative(REPO_ROOT, p)}`);
      return p;
    } catch (e) {
      out.shots.push({ wanted: path.relative(REPO_ROOT, p), failed: String(e && e.message || e).split('\n')[0] });
      say(`  [shot] FAILED ${name}: ${String(e && e.message || e).split('\n')[0]}`);
      return null;
    }
  }

  const allText = [];
  const harvest = async (m, beat) => {
    const r = await since(m);
    for (const e of (r.entries || [])) allText.push({ beat, text: e.text, surface: e.surface, clipped: !!e.clipped });
    return r;
  };

  // ---- P2 — a title surface is drawn ------------------------------------------------------
  // Read the register from index 0, not from a watermark: the title is painted during boot, so
  // anything taken `since` a mark set afterwards is empty and would read as "nothing was drawn".
  // (That is a real trap — this probe reported "0 of 5 rows" on its first run for exactly it.)
  let m = 0;
  const titleText = await harvest(0, 'title');
  const t0 = await h.page.evaluate(() => window.__HARNESS.getTitleState());
  out.checks.title_state = t0;
  const titleStrings = [...new Set(allText.filter((e) => e.beat === 'title').map((e) => e.text))];
  out.checks.title_drawn_strings = titleStrings;
  const rowsDrawn = t0.options.filter((o) => titleStrings.some((s) => s.replace(/\s+/g, '').includes(o.label.replace(/\s+/g, ''))));
  if (t0.present && t0.shown && rowsDrawn.length === t0.options.length) {
    pass('P2', `title shown and all ${t0.options.length} rows drawn`, { rows: t0.options.map((o) => o.label), distinct_strings: titleStrings.length });
  } else {
    fail('P2', `title drew ${rowsDrawn.length} of ${t0.options.length} rows`, { drawn: titleStrings, rows: t0.options.map((o) => o.label) });
  }
  await shot('01-title-first-launch');

  // ---- P3 — the title is navigable and committable by key alone ---------------------------
  const selBefore = t0.selected_id;
  await h.page.keyboard.down('ArrowDown'); await advance(4, 10000); await h.page.keyboard.up('ArrowDown');
  await advance(3, 10000);
  const selAfter = await h.page.evaluate(() => window.__HARNESS.getTitleState().selected_id);
  await h.page.keyboard.down('ArrowUp'); await advance(4, 10000); await h.page.keyboard.up('ArrowUp');
  await advance(3, 10000);
  const selBack = await h.page.evaluate(() => window.__HARNESS.getTitleState().selected_id);
  out.checks.title_nav = { before: selBefore, after_down: selAfter, after_up: selBack };
  const moved = selAfter !== selBefore;

  // Commit `New` with the bound key. `interact` is KeyE / Enter (game/data/input/profiles.json).
  // Select it first, by key, rather than trusting the default focus.
  for (let i = 0; i < 8 && (await h.page.evaluate(() => window.__HARNESS.getTitleState().selected_id)) !== 'new'; i++) {
    await h.page.keyboard.down('ArrowUp'); await advance(3, 8000); await h.page.keyboard.up('ArrowUp'); await advance(2, 8000);
  }
  const selNow = await h.page.evaluate(() => window.__HARNESS.getTitleState().selected_id);
  m = await mark();
  await h.page.keyboard.press('Enter');
  await advance(30, 60000);
  const t1 = await h.page.evaluate(() => window.__HARNESS.getTitleState());
  out.checks.title_after_enter = { shown: t1.shown, dismissed_by: t1.dismissed_by, in_session: t1.in_session, inputs_taken: t1.inputs_taken };
  if (moved && selNow === 'new' && t1.shown === false) {
    pass('P3', `title navigated and committed by key alone (dismissed_by '${t1.dismissed_by}')`, out.checks.title_nav);
  } else {
    fail('P3', `title not driveable by key: selection ${selBefore}->${selAfter}, on 'new'=${selNow === 'new'}, still shown=${t1.shown}`, { ...out.checks.title_nav, selNow, shown: t1.shown });
  }

  // ---- P4 — `New` puts a body in a world --------------------------------------------------
  await advance(60, 120000);
  const world = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    return {
      cell: e.sim.env && e.sim.env.cell ? e.sim.env.cell : (e.cellFor ? e.cellFor(e.sim.env) : null),
      interior: e.sim.env ? e.sim.env.interior : null,
      pos: e.sim.player.pos.slice(),
      npcs: e.sim.npcs.filter((n) => n.visible !== false).map((n) => ({ id: n.id, name: n.name, pos: n.pos.slice() })),
      props: e.sim.props.filter((p) => !p.taken).map((p) => p.name),
    };
  });
  out.checks.world = world;
  if (world.pos && world.npcs.length > 0) {
    pass('P4', `a body stands in '${world.interior || world.cell}' with ${world.npcs.length} person(s) present`, { interior: world.interior, npcs: world.npcs.map((n) => n.name) });
  } else {
    fail('P4', 'no world, or nobody in it', world);
  }
  await shot('02-hold-first-frame');
  await fps('in_world', 12000);

  // ---- P6 (taken first — it is a property of the frame the world opens on) ----------------
  const censusAtOpen = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const st = e.census ? e.census.state() : null;
    return {
      census_present: !!e.census,
      paused: st ? !!e.census.paused : null,
      node: st ? st.node : null,
      resume_by: st ? st.resume_by || null : null,
      takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      field_written: st && st.fields ? Object.keys(st.fields).length : null,
    };
  });
  out.checks.census_at_open = censusAtOpen;

  // ---- P5 — the body moves under held movement keys ---------------------------------------
  const posA = await pos();
  await h.page.keyboard.down('KeyW');
  const wander = await advance(WANDER_FRAMES, 600000);
  await h.page.keyboard.up('KeyW');
  await advance(5, 10000);
  const posB = await pos();
  const dist = Math.hypot(posB[0] - posA[0], posB[2] - posA[2]);
  out.checks.locomotion = { from: posA, to: posB, metres: Number(dist.toFixed(4)), frames: wander.advanced, seconds_of_play: Number((wander.advanced / 60).toFixed(2)), wall_ms: wander.ms };
  if (dist > 0.5) {
    pass('P5', `held movement keys moved the body ${dist.toFixed(2)} m over ${wander.advanced} frames`, out.checks.locomotion);
  } else {
    fail('P5', `held movement keys moved the body ${dist.toFixed(4)} m — a body that cannot walk`, out.checks.locomotion);
  }

  // ---- P6 — nothing has asked the player who they are yet ---------------------------------
  const censusAfterWander = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const st = e.census ? e.census.state() : null;
    return {
      paused: st ? !!e.census.paused : null,
      node: st ? st.node : null,
      takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      fields: st && st.fields ? Object.keys(st.fields) : [],
    };
  });
  out.checks.census_after_wander = censusAfterWander;
  const playSeconds = Number((wander.advanced / 60).toFixed(2));
  out.checks.available_play_s_before_first_question = playSeconds;
  if (!censusAfterWander.takes_input && censusAfterWander.fields.length === 0) {
    pass('P6', `${playSeconds} s of play and ${dist.toFixed(1)} m walked with nothing asked and no field written`, { node: censusAfterWander.node, o6_threshold_s: 60, reached_s: playSeconds, met: playSeconds >= 60 });
  } else {
    fail('P6', `a question or a field arrived unasked at ${playSeconds} s (node ${censusAfterWander.node}, takes_input ${censusAfterWander.takes_input}, fields ${censusAfterWander.fields.join(',')})`, censusAfterWander);
  }

  // ---- P7 — the scene begins when the player reaches for a person --------------------------
  // Walk to the speaker the paused node names, then press `interact`. Both by key.
  const speaker = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const st = e.census ? e.census.state() : null;
    const who = st && st.speaker ? e.sim.findNPC(st.speaker) : null;
    return who ? { id: who.id, name: who.name, pos: who.pos.slice() } : null;
  });
  out.checks.speaker = speaker;
  let approach = null;
  if (speaker) {
    approach = await walkTo(h, speaker.pos, advance, pos);
    out.checks.approach = approach;
  }
  m = await mark();
  await h.page.keyboard.press('KeyE');
  await advance(20, 60000);
  const censusAfterReach = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const st = e.census ? e.census.state() : null;
    return {
      node: st ? st.node : null,
      takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      paused: st ? !!e.census.paused : null,
      question: st ? (st.question ? st.question.text : null) : null,
      line: st ? st.line || null : null,
      options: st && st.options ? st.options.map((o) => o.label || o.text || o.id) : [],
    };
  });
  out.checks.census_after_reach = censusAfterReach;
  await harvest(m, 'first-exchange');
  if (censusAfterReach.takes_input) {
    pass('P7', `pressing interact beside ${speaker ? speaker.name : 'the speaker'} opened the scene at '${censusAfterReach.node}'`, censusAfterReach);
  } else {
    fail('P7', `interact beside the speaker did not open the scene (node ${censusAfterReach.node}, dist ${approach ? approach.final_dist : 'n/a'} m)`, { ...censusAfterReach, approach });
  }
  await shot('03-first-exchange');

  // ---- P8 — an answer can be given by key alone -------------------------------------------
  // `Census.state()` puts the offered answers on `input.options` and the answers the player has
  // given on the census's own `spec` — not on a `fields` map. (The first draft of this probe
  // read `st.fields` and `st.options`, found both undefined, and reported "fields 0 -> 0" for a
  // node that had in fact taken the name. Read the shape the module actually returns.)
  const before = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return { node: st ? st.node : null, spec: e.census ? { ...e.census.spec } : null, options: st && st.input ? (st.input.options || []).length : 0, input_kind: st && st.input ? st.input.kind : null };
  });
  m = await mark();
  // Pick the first offered answer with the bound `interact` key. If the node is a text node the
  // surface takes characters instead, so type a name first — both are real DOM key events.
  const TYPED = 'Silt-Under-Salt';
  const isText = before.input_kind === 'text';
  if (isText) { await h.page.keyboard.type(TYPED, { delay: 40 }); await advance(8, 30000); }
  await h.page.keyboard.press('Enter');
  await advance(30, 90000);
  const after = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return { node: st ? st.node : null, spec: e.census ? { ...e.census.spec } : null, spoken: st && st.spoken ? st.spoken.map((s) => s.line) : [] };
  });
  await harvest(m, 'answered');
  // What the scene now holds that it did not hold before — the answer, in the scene's own record.
  const changed = [];
  for (const k of Object.keys(after.spec || {})) {
    const a = JSON.stringify((before.spec || {})[k]), b = JSON.stringify(after.spec[k]);
    if (a !== b) changed.push({ field: k, from: (before.spec || {})[k], to: after.spec[k] });
  }
  out.checks.answer = { input_kind: before.input_kind, typed: isText ? TYPED : null, before_node: before.node, after_node: after.node, spec_changed: changed, spoken_back: after.spoken };
  const advancedNode = after.node && after.node !== before.node;
  if (advancedNode && changed.length) {
    pass('P8', `an answer given by key alone was written down (${before.node} -> ${after.node}; ${changed.map((c) => `${c.field}=${JSON.stringify(c.to)}`).join(', ')})`, out.checks.answer);
  } else if (advancedNode) {
    fail('P8', `the scene advanced ${before.node} -> ${after.node} but recorded nothing the player gave it`, out.checks.answer);
  } else {
    fail('P8', `the scene did not take an answer given by key (still at ${after.node})`, out.checks.answer);
  }

  // ---- P10 — the scene can be finished, by the player, from the title ----------------------
  // `hold.out` is the second hand-back node (`resume_by: 'walk'`): the way from "somebody asked
  // my hatch-name" to "somebody is writing me down" is a walk up the companionway, and
  // `_censusStep` releases it at `pos[2] >= 4.2 && |pos[0]| <= 1.6`. Walk there and keep going.
  const walkOut = await walkTo(h, [0, 5.0, 5.0], advance, pos);
  out.checks.walk_out = walkOut;
  await advance(40, 120000);
  let deskNode = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return {
      node: st ? st.node : null, paused: st ? !!e.census.paused : null,
      place: st ? st.place : null, takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      refusal: e.censusSurface ? e.censusSurface.refusal || null : null,
      interior: e.sim.env ? e.sim.env.interior : null,
    };
  });
  out.checks.after_companionway = { ...deskNode };
  // At the desk the node auto-advances into `writ.race-observed`, whose only input is the
  // correction. Press the bound key a few times, exactly as a stuck player would.
  const presses = [];
  for (let i = 0; i < 4; i++) {
    m = await mark();
    await h.page.keyboard.press('Enter');
    await advance(20, 60000);
    deskNode = await h.page.evaluate(() => {
      const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
      return {
        node: st ? st.node : null,
        takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
        refusal: e.censusSurface ? e.censusSurface.refusal || null : null,
        race: e.census ? e.census.spec.race : null,
      };
    });
    presses.push({ press: i + 1, ...deskNode });
    await harvest(m, 'at-the-desk');
    if (deskNode.node && deskNode.node !== 'writ.race-observed' && deskNode.node !== 'writ.enter') break;
  }
  out.checks.desk_presses = presses;
  const last = presses[presses.length - 1] || {};
  // The desk must actually have been reached. The first draft treated "still at hold.out" as
  // "not stuck" and passed on a run whose walker never left the barge hold — a probe that
  // cannot tell "the scene went on" from "the scene never started" is worse than no probe.
  const reachedDesk = ['writ.enter', 'writ.race-observed', 'writ.sex'].includes(deskNode.node)
    || (out.checks.after_companionway.place && out.checks.after_companionway.place !== 'barge-hold');
  const stuck = !reachedDesk || last.node === 'writ.race-observed' || !!last.refusal;
  out.checks.reached_desk = reachedDesk;
  const censusEvents = await h.page.evaluate(() => {
    const evs = (window.__HARNESS.getEvents ? window.__HARNESS.getEvents() : []) || [];
    return evs.filter((e) => e.type === 'census_refused').slice(-3);
  }).catch(() => []);
  out.checks.census_refused_events = censusEvents;
  await shot('04-jeeh-ei-or-the-desk');
  if (!stuck) {
    pass('P10', `the scene moved past the desk to '${last.node}'`, { presses, race: last.race });
  } else {
    fail('P10', reachedDesk
      ? `the scene cannot be finished from the title: stuck at '${last.node}' after ${presses.length} presses of the bound key` + (last.refusal ? `, refusal "${last.refusal}"` : '')
      : `the walker never left the barge hold (moved ${walkOut.total_moved_m} m over ${walkOut.iterations} attempts, final ${JSON.stringify(walkOut.final_pos)}, trigger is z>=4.2 and |x|<=1.6) — the desk was not reached, so this leg is UNMEASURED rather than passed`,
    { presses, reached_desk: reachedDesk, walk_out: walkOut, race_observed: last.race, census_refused_events: censusEvents });
  }

  // ---- P9 — nothing drawn tells the player what to do -------------------------------------
  if (RED === 'plant') {
    await h.page.evaluate(() => {
      // Through the REAL vector glyph path, which is the one M9's domain lives on.
      const r = window.__ENGINE.renderer;
      const s = r.menus || r.hud || r.title;
      if (s && s.ctx && s.ctx.__esNoteText) s.ctx.__esNoteText('Press E to talk to her', 10, 10, 12, 'menus');
    });
    await advance(3, 10000);
    allText.push({ beat: 'red-team', text: 'Press E to talk to her', surface: 'menus', clipped: false });
  }
  const distinct = [...new Set(allText.map((e) => e.text))];
  const instructions = distinct.filter((s) => IMPERATIVE.test(s.trim()) || EXPLAINS.test(s));
  out.checks.explanation = {
    distinct_strings_drawn: distinct.length,
    instruction_like: instructions,
    count: instructions.length,
    patterns: { imperative: String(IMPERATIVE), explains: String(EXPLAINS) },
  };
  out.all_drawn_strings = distinct;
  if (instructions.length === 0) {
    pass('P9', `${distinct.length} distinct strings drawn across the whole opening, none of them an instruction`, { distinct: distinct.length });
  } else {
    fail('P9', `${instructions.length} drawn string(s) tell the player what to do: ${instructions.map((s) => JSON.stringify(s)).join(', ')}`, out.checks.explanation);
  }

  out.conditions.loadavg_at_end = loadavg();
  out.conditions.page_errors = h.errors.slice(0, 5);
} catch (e) {
  fail('RUN', `the probe threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 6).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

// ---- exit ---------------------------------------------------------------------------------
out.summary = { pass: out.passes.length, fail: out.failures.length };
writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
for (const s of out.shots) say(`  shot: ${s}`);

if (RED) {
  const sig = RED_SIGNATURE[RED];
  const hit = out.failures.includes(sig);
  const collateral = out.failures.filter((f) => f !== sig);
  out.red_team_result = { mode: RED, signature: sig, signature_failed: hit, collateral };
  writeJson(jsonPath, out);
  say('');
  say(`  RED TEAM '${RED}': signature ${sig} ${hit ? 'WENT RED as required' : 'DID NOT go red — the probe cannot see this sabotage'}`);
  if (collateral.length) say(`  collateral failures (the BUILD's, not the sabotage's): ${collateral.join(', ')}`);
  exitCode = hit ? 0 : 1;
} else {
  exitCode = out.failures.length ? 1 : 0;
}
process.exit(exitCode);

/**
 * Walk to a point with the four movement keys and nothing else.
 *
 * Deliberately NOT by mouse look: `input/real.js` only accumulates look from `movementX` while
 * `document.pointerLockElement === canvas`, and pointer lock in headless Chromium is not a thing
 * a probe should depend on. Locomotion is camera-relative (`sim/player.js` §4:
 * `dir = right*moveX + forward*moveY`, `forward = (sin cy, cos cy)`, `right = (cos cy, -sin cy)`),
 * so the world-space vector to the target is projected onto that basis and the two keys whose
 * axes it needs are HELD. Eight directions, which is what a keyboard gives a player too.
 */
async function walkTo(handle, target, advance, pos) {
  const steps = [];
  const KEY = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' };
  // The eight directions a keyboard can produce, for the unstick sweep below.
  const SWEEP = [
    [KEY.fwd], [KEY.fwd, KEY.right], [KEY.right], [KEY.back, KEY.right],
    [KEY.back], [KEY.back, KEY.left], [KEY.left], [KEY.fwd, KEY.left],
  ];
  let stuckFor = 0, sweepAt = 0;
  for (let i = 0; i < 20; i++) {
    const st = await handle.page.evaluate(() => ({
      p: window.__ENGINE.sim.player.pos.slice(),
      cy: window.__ENGINE.sim.camera.yaw,
    }));
    const dx = target[0] - st.p[0], dz = target[2] - st.p[2];
    const d = Math.hypot(dx, dz);
    const prev = steps.length ? steps[steps.length - 1].pos : null;
    const movedSinceLast = prev ? Math.hypot(st.p[0] - prev[0], st.p[2] - prev[2]) : Infinity;
    steps.push({ dist: Number(d.toFixed(3)), pos: st.p.map((v) => Number(v.toFixed(3))), camera_yaw: st.cy, moved_since_last: Number(movedSinceLast.toFixed(3)) });
    if (d <= 1.5) break;
    let held;
    if (movedSinceLast < 0.05) {
      // PINNED. A body pressed into a crate does not move on the one axis that points at the
      // target, and a walker that keeps pressing the same key measures the crate. Sweep the
      // other seven directions before concluding anything — the round-2 draft of this probe did
      // NOT do this, held `KeyD` twelve times against the same wall, and reported a false pass.
      stuckFor++;
      held = SWEEP[sweepAt % SWEEP.length];
      sweepAt++;
    } else {
      stuckFor = 0; sweepAt = 0;
      const cy = st.cy * Math.PI / 180;
      const mx = dx * Math.cos(cy) - dz * Math.sin(cy);   // right component
      const my = dx * Math.sin(cy) + dz * Math.cos(cy);   // forward component
      held = [];
      if (my > d * 0.35) held.push(KEY.fwd); else if (my < -d * 0.35) held.push(KEY.back);
      if (mx > d * 0.35) held.push(KEY.right); else if (mx < -d * 0.35) held.push(KEY.left);
      if (!held.length) held.push(KEY.fwd);
    }
    for (const k of held) await handle.page.keyboard.down(k);
    // W1-26 r3: carry what the WORLD did while the key was held. "moved 0.000 m" says nothing
    // about why — a body pressed into a crate and a simulation that is not advancing at all
    // produce the identical number, and the r2 run of this probe reported twenty zeroes with no
    // way to tell which it had seen. `frames_advanced: 0` is a frozen world and is not a pin.
    const adv = await advance(Math.max(12, Math.min(120, Math.round(d * 20))), 120000);
    steps[steps.length - 1].frames_advanced = adv.advanced;
    steps[steps.length - 1].advance_ms = adv.ms;
    for (const k of held) await handle.page.keyboard.up(k);
    await advance(3, 10000);
  }
  const p = await pos();
  const totalMoved = steps.length > 1 ? steps.reduce((a, s, i) => a + (i ? s.moved_since_last : 0), 0) : 0;
  return {
    steps, iterations: steps.length,
    total_moved_m: Number(totalMoved.toFixed(3)),
    final_dist: Number(Math.hypot(target[0] - p[0], target[2] - p[2]).toFixed(3)),
    final_pos: p.map((v) => Number(v.toFixed(3))),
    reached: Math.hypot(target[0] - p[0], target[2] - p[2]) <= 1.5,
    // The distinction the r2 run of this probe could not make. A walk that moved nothing across
    // a world that advanced no frames is a STOPPED WORLD, and calling it geometry sends the next
    // builder to look at the crates.
    frames_advanced_total: steps.reduce((a, s) => a + (s.frames_advanced || 0), 0),
    world_was_running: steps.some((s) => (s.frames_advanced || 0) > 0),
  };
}

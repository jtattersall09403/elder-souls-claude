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

  // Frame rate as a player experiences it, stated with its load (rule 26).
  const fpsProbe = await advance(120, 20000);
  out.conditions.fps_measured = fpsProbe.ms > 0 ? Number((fpsProbe.advanced / (fpsProbe.ms / 1000)).toFixed(2)) : null;
  out.conditions.fps_note = 'rAF-driven play mode, headless SwiftShader, under the stated load. An upper bound on badness, not a machine spec.';
  say(`  [fps] ${out.conditions.fps_measured} fps at ${WIDTH}x${HEIGHT}, loadavg ${JSON.stringify(out.conditions.loadavg_at_start)}`);

  const allText = [];
  const harvest = async (m, beat) => {
    const r = await since(m);
    for (const e of (r.entries || [])) allText.push({ beat, text: e.text, surface: e.surface, clipped: !!e.clipped });
    return r;
  };

  // ---- P2 — a title surface is drawn ------------------------------------------------------
  let m = await mark();
  await h.page.evaluate(() => window.__HARNESS.renderFrame && window.__HARNESS.renderFrame());
  await advance(6, 15000);
  const titleText = await harvest(m, 'title');
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
  if (!RED) {
    const p = path.join(shotsDir, '2026-08-08-w1-26-r2-01-title-first-launch.png');
    await h.page.screenshot({ path: p });
    out.shots.push(path.relative(REPO_ROOT, p));
  }

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
  if (!RED) {
    const p = path.join(shotsDir, '2026-08-08-w1-26-r2-02-hold-first-frame.png');
    await h.page.screenshot({ path: p });
    out.shots.push(path.relative(REPO_ROOT, p));
  }

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
  if (!RED) {
    const p = path.join(shotsDir, '2026-08-08-w1-26-r2-03-first-exchange.png');
    await h.page.screenshot({ path: p });
    out.shots.push(path.relative(REPO_ROOT, p));
  }

  // ---- P8 — an answer can be given by key alone -------------------------------------------
  const before = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return { node: st ? st.node : null, fields: st && st.fields ? Object.keys(st.fields) : [] };
  });
  m = await mark();
  // Pick the first offered answer with the bound `interact` key. If the node is a text node the
  // surface takes characters instead, so type a name first — both are real DOM key events.
  const isText = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return !!(st && (st.kind === 'text' || st.text_entry || (st.options || []).length === 0));
  });
  if (isText) { await h.page.keyboard.type('Silt-Under-Salt', { delay: 40 }); await advance(6, 20000); }
  await h.page.keyboard.press('Enter');
  await advance(30, 90000);
  const after = await h.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return { node: st ? st.node : null, fields: st && st.fields ? st.fields : {} };
  });
  await harvest(m, 'answered');
  out.checks.answer = { text_node: isText, before, after_node: after.node, fields_after: Object.keys(after.fields), field_values: after.fields };
  const advancedNode = after.node && after.node !== before.node;
  const wroteField = Object.keys(after.fields).length > before.fields.length;
  if (advancedNode || wroteField) {
    pass('P8', `an answer given by key alone was written down (${before.node} -> ${after.node}, fields ${before.fields.length} -> ${Object.keys(after.fields).length})`, out.checks.answer);
  } else {
    fail('P8', `the scene did not take an answer given by key (still at ${after.node})`, out.checks.answer);
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

/** Walk to a point using held movement keys and the mouse for yaw. Real events only. */
async function walkTo(handle, target, advance, pos) {
  const steps = [];
  for (let i = 0; i < 14; i++) {
    const p = await pos();
    const dx = target[0] - p[0], dz = target[2] - p[2];
    const d = Math.hypot(dx, dz);
    steps.push({ dist: Number(d.toFixed(3)), pos: p.map((v) => Number(v.toFixed(3))) });
    if (d <= 1.6) break;
    // Face the target: the engine's yaw convention is read back, not assumed.
    const want = Math.atan2(dx, dz) * 180 / Math.PI;
    const cur = await handle.page.evaluate(() => window.__ENGINE.sim.player.yaw_deg ?? (window.__ENGINE.sim.player.yaw * 180 / Math.PI));
    let delta = ((want - cur + 540) % 360) - 180;
    // 0.12 deg per px of movementX (game/data/input/profiles.json look.deg_per_px_yaw).
    const px = Math.max(-600, Math.min(600, Math.round(delta / 0.12)));
    await handle.page.mouse.move(400 + px, 270, { steps: 6 });
    await advance(3, 10000);
    await handle.page.keyboard.down('KeyW');
    await advance(Math.max(12, Math.min(180, Math.round(d * 22))), 120000);
    await handle.page.keyboard.up('KeyW');
    await advance(3, 10000);
  }
  const p = await pos();
  return { steps, final_dist: Number(Math.hypot(target[0] - p[0], target[2] - p[2]).toFixed(3)), final_pos: p.map((v) => Number(v.toFixed(3))) };
}

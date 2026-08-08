#!/usr/bin/env node
// touch-run.mjs — CAN A PHONE PLAY THIS? Driven by real touch events and nothing else.
//
// Owner: W1-TOUCH. Items: RI-JRN04 §G (T1–T9, M-P21/M-P22), RI-JRN01 O17, RI-MTH07.
//
// WHY THIS EXISTS. `tools/journey/opening-play.mjs` plays the opening on a keyboard;
// `tools/gamepad/pad-run.mjs` plays it on a pad. Nothing in the tree had ever put a FINGER on
// the glass. `tools/harness/w1-14-r4-touch.mjs` is about a touch *spell* and is unrelated.
// M-P21 ("touch parity") and M-P22 were therefore unmeasured, which scores 0 fail-closed and
// looks from outside exactly like a design failure.
//
// WHAT DRIVES IT, and this is the whole point of the file.
//
//   Every input below is a CDP `Input.dispatchTouchEvent`. Chromium turns those into real
//   `touchstart`/`touchmove`/`touchend` and the real `pointerdown`/`pointermove`/`pointerup`
//   with `pointerType === 'touch'` that `input/touch.js attach()` listens for. There is:
//     * NO `__HARNESS.touchDown/touchMove/touchUp` — those exist and they bypass the listener,
//       the hit test's coordinate space and the browser's own pointer bookkeeping, which is
//       three of the four things that can be broken about a touch control.
//     * NO `queueInputs`, no `censusAnswer`, no `titleActivate`, no `openMenu`.
//     * NO keyboard event of any kind in the touch legs. `page.keyboard` is used ONLY in the
//       `differential` leg, whose entire job is to prove the keyboard still works.
//   Harness calls are made for SETUP (`loadState`, `setSeed`, `setMode`) and for READING
//   (`touchState`, `touchLayout`, `getInputEdges`, `getInputState`, `getTitleState`). Reading
//   `touchLayout()` to find a button is not a shortcut: `TouchInput.layout()` is the ONE array
//   the renderer draws from and the hit test reads, so tapping its centre is tapping the pixel
//   a player sees. Its own docstring is where that invariant is written down.
//
// THE VIEWPORT IS A REAL PHONE VIEWPORT. `browser.newContext({hasTouch, isMobile, viewport,
// deviceScaleFactor})` — `isMobile` is what makes `(pointer: coarse)` and `(hover: none)` match,
// which is the ONLY thing `input/viewport.js detectDeviceClass()` consults (H2: never a
// user-agent string). No override is passed to `setViewport()`. The device class is inferred by
// the same media queries a phone's browser answers.
//
// RULES 8 — A STILL TARGET HIDES EVERY STEERING DEFECT, AND ONE INSTANT IS A STILL TARGET.
//   The `float` leg starts drags from three different places and compares the RESULTING WALK,
//   not the stick numbers, because a stick that reports correctly and moves nothing is the
//   defect. The `curve` leg samples every deflection over 90 frames and reports the distance at
//   30/60/90, so a body that lurches once and stops cannot pass as one that walks.
//
// LEGS
//   opening       title -> New -> walk to her -> talk -> census -> a name -> the desk, ON TOUCH,
//                 in six phone/tablet viewports across both orientations
//   reach         T1: all sixteen actions of the closed set, each reached by a real tap, counted
//                 from `getInputEdges()`. The drawer opened and closed by touch.
//   float         T2: three drags from three origins; same finger displacement, same walk
//   curve         walk speed against thumb deflection, published, plus the double-deadzone check
//   gate          T5: the roll/sprint discriminator at 4/8/11/12/13/20 frames on BOTH the touch
//                 path and the pad path, in one page, against one shared implementation
//   differential  the keyboard opening and the pad opening still complete
//
// TEARDOWNS (RULES 4/6) — each must make a NAMED check go red, and nothing else:
//   --break-deaf        swallow every pointerdown before input/touch.js sees it. Every touch leg
//                       must go red. This is the control for "is the finger doing the work".
//   --break-fixed-stick pin the floating stick's origin to a fixed rosette. `float` must go red.
//   --break-deadzone    put `locomotion.move_deadzone` back to 0.15. `curve` must report the
//                       double-application again, at the deflection the pad round measured.
//   --break-gate        set the touch gate to 1 frame. `gate` must go red on the TOUCH arm only
//                       — which is how you tell a shared rule from a shared data file.
//   --serve-patched     serve a COPY of game/ with one line of `input/hold-gate.js` changed, and
//                       run `gate` against it. BOTH arms must go red together. If only one does,
//                       there are still two implementations and T5 is a comment.
//   --break-overlap     delete the T8 clause-2 fix on the live page: put `keepOnly` back to null
//                       and the panel's right edge back to 0.90 W. `T8-OVERLAP` must go red and
//                       must name the seven controls that were sitting on the name ledger.
//
// USAGE
//   node tools/touch/touch-run.mjs --leg all
//   node tools/touch/touch-run.mjs --leg opening --profile phone-844x390
//   node tools/touch/touch-run.mjs --leg gate --serve-patched
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS, loadPlaywright } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const USAGE = `
touch-run.mjs — the touch path, end to end, driven by real touch events only.

  --leg <name>       opening | reach | float | curve | gate | differential | all  (default all)
  --profile <id>     restrict the opening leg to one viewport profile
  --out <dir>        report directory (default reports/w1-touch)
  --shots <dir>      screenshot directory (default docs/shots)
  --break-deaf | --break-fixed-stick | --break-deadzone | --break-gate | --serve-patched
                     teardowns; see the header. Exit code is INVERTED under a teardown: the run
                     passes only when the named check goes red.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const LEG = String(args.leg || 'all');
const OUT = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-touch');
const SHOTS = args.shots ? path.resolve(String(args.shots)) : path.join(REPO_ROOT, 'docs', 'shots');
const DATE = String(args.date || new Date().toISOString().slice(0, 10));
ensureDir(OUT); ensureDir(SHOTS);

const BREAK = {
  deaf: !!args['break-deaf'],
  fixedStick: !!args['break-fixed-stick'],
  deadzone: !!args['break-deadzone'],
  gate: !!args['break-gate'],
  patched: !!args['serve-patched'],
  overlap: !!args['break-overlap'],
};
const ANY_BREAK = Object.entries(BREAK).filter(([, v]) => v).map(([k]) => k);
// Which check id each teardown MUST make go red. A teardown that passes on any failure at all
// proves nothing (RULES 4), so the signature is named and collateral is reported separately.
const SIGNATURE = { deaf: 'T-OPEN', fixedStick: 'T2', deadzone: 'T4-DZ', gate: 'T5-TOUCH', patched: 'T5-SHARED', overlap: 'T8-OVERLAP' };

const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };
const commit = String(process.env.ES_COMMIT || (() => { try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { return ''; } })());

const out = {
  schema: 'elder-souls/touch-run@1',
  piece: 'W1-TOUCH',
  items: ['RI-JRN04 §G (T1-T9, M-P21, M-P22)', 'RI-JRN01 O17', 'RI-MTH07'],
  commit,
  leg: LEG,
  teardowns: ANY_BREAK,
  drive: 'CDP Input.dispatchTouchEvent only. No __HARNESS.touchDown/Move/Up, no queueInputs, no keyboard in any touch leg.',
  conditions: { loadavg_at_start: loadavg(), node: process.version },
  checks: {},
  passes: [],
  failures: [],
  shots: [],
};
const pass = (id, what, detail) => { if (!out.passes.includes(id)) out.passes.push(id); out.checks[id] = { ok: true, what, ...detail }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, detail) => { if (!out.failures.includes(id)) out.failures.push(id); out.checks[id] = { ok: false, what, ...detail }; say(`  FAIL ${id}  ${what}`); };

// ---- viewport profiles ---------------------------------------------------------------------
// Real device logical sizes. `dpr` is the device pixel ratio the phone reports; the layout is in
// CSS px so it must be independent of it, which is itself a thing worth varying.
const PROFILES = [
  { id: 'phone-small-667x375',   w: 667,  h: 375,  dpr: 2, kind: 'small phone',  orientation: 'landscape' },
  { id: 'phone-844x390',         w: 844,  h: 390,  dpr: 3, kind: 'reference phone', orientation: 'landscape' },
  { id: 'phone-large-932x430',   w: 932,  h: 430,  dpr: 3, kind: 'large phone',  orientation: 'landscape' },
  { id: 'tablet-1180x820',       w: 1180, h: 820,  dpr: 2, kind: 'tablet',       orientation: 'landscape' },
  { id: 'phone-portrait-390x844', w: 390, h: 844,  dpr: 3, kind: 'reference phone', orientation: 'portrait' },
  { id: 'tablet-portrait-820x1180', w: 820, h: 1180, dpr: 2, kind: 'tablet',    orientation: 'portrait' },
];

// ---- the patched tree, for --serve-patched ---------------------------------------------------
function makePatchedTree() {
  const dst = path.join(OUT, 'patched-tree');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  const p = path.join(dst, 'game', 'src', 'input', 'hold-gate.js');
  const src = fs.readFileSync(p, 'utf8');
  const patched = src.replace('export const DEFAULT_HOLD_GATE_FRAMES = 12;', 'export const DEFAULT_HOLD_GATE_FRAMES = 12;')
    .replace('return framesHeld(frame, pressFrame) >= holdGateFrames(gate);',
      'return framesHeld(frame, pressFrame) >= 1;   // SABOTAGE: tools/touch/touch-run.mjs --serve-patched');
  if (patched === src) throw new Error('--serve-patched: the sabotage did NOT apply — hold-gate.js does not contain the line it expects. The teardown is inert and every number below would be void.');
  fs.writeFileSync(p, patched);
  return dst;
}

// ---- one browser, kept -----------------------------------------------------------------------
const { chromium } = await loadPlaywright();
const serveRoot = BREAK.patched ? makePatchedTree() : REPO_ROOT;
if (BREAK.patched) say(`  [teardown] serving a PATCHED copy of the tree from ${path.relative(REPO_ROOT, serveRoot)} — hold-gate.js shouldPromote() now promotes at 1 frame`);
const server = await serveDir(serveRoot);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
say(`  [browser] one instance, pid ${browser.__pid || 'n/a'}; served from ${server.origin}`);

/** A phone-shaped page with real touch. `query` selects the mode; '' is a player's first launch. */
async function openPhone(prof, query = '') {
  const ctx = await browser.newContext({
    viewport: { width: prof.w, height: prof.h },
    deviceScaleFactor: prof.dpr,
    hasTouch: true,
    isMobile: true,
    colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'UTC',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); });
  if (BREAK.deaf) {
    // The control for "is the finger doing the work". Swallowed in the CAPTURE phase on the
    // canvas, so `input/touch.js`'s own listener never runs while the browser still delivers
    // the event — a sabotage of the game's ear, not of the instrument's mouth.
    await page.addInitScript(() => {
      window.addEventListener('pointerdown', (e) => e.stopImmediatePropagation(), true);
      window.addEventListener('pointermove', (e) => e.stopImmediatePropagation(), true);
    });
  }
  if (BREAK.fixedStick) {
    // T2 deleted: the stick becomes a fixed rosette at the bottom-left, as it was before §G.
    await page.addInitScript(() => {
      const iv = setInterval(() => {
        const e = window.__ENGINE;
        if (!e || !e.real || !e.real.touch) return;
        clearInterval(iv);
        const t = e.real.touch;
        const orig = t.down.bind(t);
        t.down = function (id, x, y) {
          const r = orig(id, x, y);
          if (r === 'stick') { this.stick.ox = 120; this.stick.oy = this.viewport.h - 120; }
          return r;
        };
      }, 10);
    });
  }
  await page.goto(server.origin + '/game/index.html' + query, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.version, null, { timeout: 240000 });
  await page.evaluate(() => window.__HARNESS.ready());
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors, prof, finger: new Finger(cdp, page) };
}

/**
 * A hand. Every method is one CDP touch dispatch; the active-point list is carried so that
 * multi-touch is real multi-touch (T9) and not four sequential taps pretending.
 */
class Finger {
  constructor(cdp) { this.cdp = cdp; this.pts = new Map(); }
  _list() { return Array.from(this.pts.values()).map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 12, radiusY: 12, force: 1 })); }
  async down(id, x, y) { this.pts.set(id, { id, x, y }); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: this._list() }); }
  async move(id, x, y) { const p = this.pts.get(id); if (!p) return; p.x = x; p.y = y; await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: this._list() }); }
  async up(id) { this.pts.delete(id); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: this._list() }); }
  async allUp() { this.pts.clear(); await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
}

// ---- per-page helpers -------------------------------------------------------------------------
const mk = (H) => ({
  frame: () => H.page.evaluate(() => window.__ENGINE.sim.frame),
  pos: () => H.page.evaluate(() => window.__ENGINE.sim.player.pos.slice()),
  yaw: () => H.page.evaluate(() => window.__ENGINE.sim.camera.yaw),
  touch: () => H.page.evaluate(() => window.__HARNESS.touchState()),
  layout: () => H.page.evaluate(() => window.__HARNESS.touchLayout()),
  title: () => H.page.evaluate(() => window.__HARNESS.getTitleState()),
  edges: () => H.page.evaluate(() => window.__HARNESS.getInputEdges()),
  step: (n) => H.page.evaluate((k) => window.__HARNESS.stepFrames(k), n),
  census: () => H.page.evaluate(() => {
    const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
    return {
      node: st ? st.node : null,
      takes_input: !!(e.censusSurface && e.censusSurface.takesInput),
      kind: st && st.input ? st.input.kind : null,
      options: (e.censusSurface && e.censusSurface.options ? e.censusSurface.options : []).map((o) => o.text || o.id),
      sel: e.censusSurface ? e.censusSurface.sel : null,
      speaker: st ? st.speaker || null : null,
      place: st ? st.place || null : null,
      spec: e.census ? { ...e.census.spec } : null,
    };
  }),
});

/** Wait for the rAF loop (play mode) to advance n sim frames. */
async function advance(H, n, capMs = 120000) {
  const f = () => H.page.evaluate(() => window.__ENGINE.sim.frame);
  const f0 = await f(); const t0 = Date.now();
  let cur = f0;
  while (cur - f0 < n && Date.now() - t0 < capMs) { await H.page.waitForTimeout(60); cur = await f(); }
  return { advanced: cur - f0, ms: Date.now() - t0 };
}

/** The centre of a laid-out control, in CSS px. Null when it is not on the glass. */
function centreOf(layout, action) {
  const c = (layout || []).find((x) => x.action === action);
  return c ? { x: c.x, y: c.y, r: c.r } : null;
}

/** One real tap on a control, held for `holdMs`. Play mode: wall-clock, like a thumb. */
async function tapPlay(H, layout, action, holdMs = 90) {
  const c = centreOf(layout, action);
  if (!c) return { tapped: false, why: `'${action}' is not laid out` };
  await H.finger.down(9, c.x, c.y);
  await H.page.waitForTimeout(holdMs);
  await H.finger.up(9);
  await H.page.waitForTimeout(40);
  return { tapped: true, at: [c.x, c.y] };
}

/** Hold the floating stick at (mx,my) in stick space from `origin`, for `ms`. */
async function stickHold(H, origin, mx, my, ms, R = 90) {
  await H.finger.down(1, origin.x, origin.y);
  await H.page.waitForTimeout(20);
  await H.finger.move(1, origin.x + mx * R, origin.y - my * R);
  await H.page.waitForTimeout(ms);
  await H.finger.up(1);
}

// =============================================================================================
// LEG: opening
// =============================================================================================
async function legOpening(prof) {
  say(`\n-- LEG opening · ${prof.id} (${prof.kind}, ${prof.orientation}, ${prof.w}x${prof.h} @${prof.dpr}x) ------`);
  const H = await openPhone(prof, '');            // NO query string: a player's first launch
  const g = mk(H);
  const rec = { profile: prof, beats: [] };
  try {
    const boot = await H.page.evaluate(() => ({
      mode: window.__ENGINE.mode, search: location.search,
      deviceClass: window.__HARNESS.getViewport().deviceClass,
      coarse: matchMedia('(pointer: coarse)').matches, noHover: matchMedia('(hover: none)').matches,
      touch: window.__HARNESS.touchState(),
      rotate: window.__HARNESS.getViewport().rotateState,
    }));
    rec.boot = boot;
    say(`     mode '${boot.mode}' search '${boot.search}' deviceClass '${boot.deviceClass}' touch.shown ${boot.touch.shown} insetViolations ${boot.touch.insetViolations}`);

    // ---- portrait: H1 says a rotate state appears, and it must recover on a REAL rotation ----
    if (prof.orientation === 'portrait') {
      rec.rotate_state_in_portrait = boot.rotate;
      await H.page.setViewportSize({ width: prof.h, height: prof.w });
      await H.page.waitForTimeout(400);
      const after = await H.page.evaluate(() => ({
        rotate: window.__HARNESS.getViewport().rotateState,
        size: window.__HARNESS.getViewport().size,
        touch: window.__HARNESS.touchState(),
        frame: window.__ENGINE.sim.frame,
      }));
      rec.after_rotation = after;
      if (boot.rotate && boot.rotate.kind === 'rotate' && !after.rotate && after.touch.insetViolations === 0) {
        pass(`T-ROT/${prof.id}`, `held in portrait the game shows a rotate state ("${boot.rotate.line}") and recovers on a real rotation with no reload, controls relaid at ${after.size.w}x${after.size.h}`, rec.after_rotation);
      } else {
        fail(`T-ROT/${prof.id}`, `portrait handling wrong: rotate in portrait = ${JSON.stringify(boot.rotate)}, after rotation = ${JSON.stringify(after.rotate)}`, rec);
      }
      // and then play the opening in the landscape it just recovered into
      prof = { ...prof, w: prof.h, h: prof.w };
    }

    // ---- beat 1: the title, on touch alone --------------------------------------------------
    let t = await g.title();
    rec.title_at_boot = t;
    if (!t.shown) { fail(`T-OPEN/${prof.id}`, 'no title surface on a phone-shaped first launch', t); return rec; }
    const layout0 = await g.layout();
    rec.controls_on_title = (layout0 || []).map((c) => c.action);

    // Move the selection with the STICK, one flick per row, then commit with `interact`.
    // A flick is a real drag: land, pull past the 0.5 axis deadzone, hold ~8 frames, lift.
    const stickOrigin = { x: Math.round(prof.w * 0.25), y: Math.round(prof.h * 0.62) };
    const flick = async (dirUp) => { await stickHold(H, stickOrigin, 0, dirUp ? 1 : -1, 140); await H.page.waitForTimeout(60); };
    // The selection ALREADY defaults to 'new', so a loop that stops when it is on 'new' does
    // zero flicks and proves nothing about the stick — the first run of this leg reported
    // "0 flick(s)" under a headline that said the title had been navigated. Move OFF it first,
    // check the surface actually moved, then come back.
    const selStart = t.selected_id;
    await flick(false);
    const selDown = (await g.title()).selected_id;
    let guard = 0;
    while ((await g.title()).selected_id !== 'new' && guard++ < 8) await flick(true);
    t = await g.title();
    rec.title_after_stick = { selected_at_boot: selStart, after_one_flick_down: selDown, selected_id: t.selected_id, inputs_taken: t.inputs_taken, flicks_back_up: guard };
    const navigated = t.selected_id === 'new' && selDown !== selStart;

    const lay = await g.layout();
    await tapPlay(H, lay, 'interact', 120);
    await advance(H, 40, 60000);
    const t1 = await g.title();
    rec.title_after_interact = { shown: t1.shown, dismissed_by: t1.dismissed_by, inputs_taken: t1.inputs_taken };
    if (navigated && t1.shown === false) {
      pass(`T-TITLE/${prof.id}`, `the title was navigated by the floating stick — one flick down moved '${selStart}' -> '${selDown}', ${guard} flick(s) back up returned to 'new' — and committed by a tap on the 'interact' button (dismissed_by '${t1.dismissed_by}')`, rec.title_after_stick);
    } else {
      fail(`T-TITLE/${prof.id}`, `title not driveable by touch: boot '${selStart}', one flick down gave '${selDown}', ${guard} flicks up gave '${t.selected_id}', still shown = ${t1.shown}`, { ...rec.title_after_stick, ...rec.title_after_interact });
    }

    await advance(H, 60, 120000);
    const world = await H.page.evaluate(() => {
      const e = window.__ENGINE;
      return { interior: e.sim.env ? e.sim.env.interior : null, pos: e.sim.player.pos.slice(), npcs: e.sim.npcs.filter((n) => n.visible !== false).map((n) => ({ id: n.id, name: n.name, pos: n.pos.slice() })) };
    });
    rec.world = world;
    await shot(H, `${DATE}-w1-touch-${prof.id}-01-in-the-hold`);

    // ---- beat 2: walk to her, on the stick --------------------------------------------------
    const c0 = await g.census();
    rec.census_at_open = c0;
    const speaker = await H.page.evaluate(() => {
      const e = window.__ENGINE; const st = e.census ? e.census.state() : null;
      const who = st && st.speaker ? e.sim.findNPC(st.speaker) : null;
      return who ? { id: who.id, name: who.name, pos: who.pos.slice() } : null;
    });
    rec.speaker = speaker;
    const walk = speaker ? await walkToOnTouch(H, g, speaker.pos, stickOrigin, 1.4) : null;
    rec.walk_to_speaker = walk;
    if (walk && walk.final_dist <= 1.6 && walk.total_moved_m > 0.5) {
      pass(`T-WALK/${prof.id}`, `walked ${walk.total_moved_m} m to ${speaker.name} on the floating stick alone, final distance ${walk.final_dist} m`, { iterations: walk.iterations });
    } else {
      fail(`T-WALK/${prof.id}`, `could not walk to the speaker on touch: moved ${walk ? walk.total_moved_m : 'n/a'} m, final distance ${walk ? walk.final_dist : 'n/a'} m`, walk || {});
    }

    // ---- beat 3: talk. A tap on `interact`. -------------------------------------------------
    await tapPlay(H, await g.layout(), 'interact', 120);
    await advance(H, 30, 60000);
    let c = await g.census();
    rec.census_after_interact = c;
    if (c.takes_input) pass(`T-TALK/${prof.id}`, `a tap on 'interact' beside ${speaker ? speaker.name : 'her'} opened the scene at '${c.node}'`, { kind: c.kind, options: c.options.length });
    else fail(`T-TALK/${prof.id}`, `the tap did not open the scene (node '${c.node}')`, c);

    // ---- T8, SECOND CLAUSE: the arc must not sit on the surface being read -------------------
    // The panel's rectangle comes from `UILayer.metrics()`, which is computed FROM THE LAYOUT the
    // paint pass uses, not from a readback — so this compares the drawn panel with the drawn
    // controls, and both are the same objects the hit tests read.
    if (BREAK.overlap) {
      // DELETE-THE-FIX, on the live page: both halves at once, because either alone leaves the
      // other carrying the number (RULES 6, "two guards for one defect").
      await H.page.evaluate(() => {
        const e = window.__ENGINE;
        e._touchTalkSuppression = () => null;
        const setter = e.renderer.ui.setTouchClearRight.bind(e.renderer.ui);
        e.renderer.ui.setTouchClearRight = () => setter(null);
        e.renderer.ui.setTouchClearRight(null);
      });
      await advance(H, 6, 30000);
    }
    const ov = await H.page.evaluate(() => {
      const e = window.__ENGINE;
      const m = e.renderer.ui.metrics();
      const panel = m && m.panel_px && m.open !== false ? { w: m.panel_px[0], h: m.panel_px[1] } : null;
      const W = e.renderer.ui.canvas.width, Hh = e.renderer.ui.canvas.height;
      const controls = window.__HARNESS.touchLayout() || [];
      if (!panel) return { panel: null, controls: controls.map((c) => c.action) };
      // `render/ui.js`: x0 = round(W*0.10); y0 = H - panelH - round(H*0.045).
      const x0 = Math.round(W * 0.10), y0 = Hh - panel.h - Math.round(Hh * 0.045);
      const rect = { x0, y0, x1: x0 + panel.w, y1: y0 + panel.h };
      const hits = controls.filter((c) => c.x + c.r > rect.x0 && c.x - c.r < rect.x1 && c.y + c.r > rect.y0 && c.y - c.r < rect.y1);
      return {
        canvas: { w: W, h: Hh },
        panel_rect: rect,
        panel_width_frac: Number((panel.w / W).toFixed(4)),
        controls_drawn: controls.map((c) => c.action),
        overlapping: hits.map((c) => ({ action: c.action, box: [c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r] })),
        reduced_to: (e._touchOverlayModel() || {}).reduced_to_by_talking || null,
      };
    });
    rec.t8_overlap = ov;
    if (ov.panel_rect && ov.overlapping.length === 0) {
      pass(`T8-OVERLAP/${prof.id}`, `with the name ledger open, 0 of ${ov.controls_drawn.length} drawn controls touch the dialogue panel — the arc is reduced to [${(ov.reduced_to || []).join(', ')}] and the panel stops at ${ov.panel_rect.x1} px (${(ov.panel_width_frac * 100).toFixed(0)}% of the frame)`, { panel: ov.panel_rect, controls: ov.controls_drawn });
    } else {
      fail(`T8-OVERLAP/${prof.id}`, ov.panel_rect
        ? `${ov.overlapping.length} of ${ov.controls_drawn.length} drawn controls sit ON the dialogue panel — a player choosing a name cannot read what is under [${ov.overlapping.map((o) => o.action).join(', ')}]`
        : `no dialogue panel was open when T8 was measured, so the check is UNMEASURED rather than passed (controls drawn: ${ov.controls_drawn.join(', ')})`, ov);
    }
    await shot(H, `${DATE}-w1-touch-${prof.id}-02-the-scene`);

    // ---- beat 4: a name, from the ledger, on the stick ---------------------------------------
    // RULING R1 (status file): touch reuses the pad's answer unchanged. `_nameOptions()` turns
    // every text node into a pick list and `CensusSurface.step` reads `moveY` + `interact` —
    // both device-neutral, so this needs no touch-specific code and no on-screen keyboard,
    // which RI-JRN01 O8 forbids.
    const nameBefore = c;
    let picked = null;
    if (c.takes_input) {
      // move the caret down twice on the stick, then commit — so the pick is demonstrably the
      // player's and not the default highlight.
      await stickHold(H, stickOrigin, 0, -1, 140); await H.page.waitForTimeout(80);
      await stickHold(H, stickOrigin, 0, -1, 140); await H.page.waitForTimeout(80);
      const moved = await g.census();
      picked = moved.options[moved.sel] || null;
      rec.caret = { from: nameBefore.sel, to: moved.sel, will_pick: picked, offered: moved.options };
      await tapPlay(H, await g.layout(), 'interact', 120);
      await advance(H, 40, 60000);
    }
    const c2 = await g.census();
    rec.census_after_answer = c2;
    const specChanged = [];
    for (const k of Object.keys(c2.spec || {})) {
      if (JSON.stringify((nameBefore.spec || {})[k]) !== JSON.stringify(c2.spec[k])) specChanged.push({ field: k, to: c2.spec[k] });
    }
    rec.spec_changed = specChanged;
    if (c2.node && c2.node !== nameBefore.node && specChanged.length) {
      pass(`T-NAME/${prof.id}`, `a name was chosen from the ledger by stick and tap and written down (${nameBefore.node} -> ${c2.node}; ${specChanged.map((s) => `${s.field}=${JSON.stringify(s.to)}`).join(', ')})`, rec.caret);
    } else {
      fail(`T-NAME/${prof.id}`, `the scene took nothing on touch (still '${c2.node}', spec unchanged)`, { caret: rec.caret, after: c2 });
    }

    // ---- beat 5: out of the hold and to the desk, on the stick -------------------------------
    const walkOut = await walkToOnTouch(H, g, [0, 5.0, 5.4], stickOrigin, 1.2, 24);
    rec.walk_out = walkOut;
    await advance(H, 60, 120000);
    let desk = await g.census();
    const presses = [];
    for (let i = 0; i < 5; i++) {
      await tapPlay(H, await g.layout(), 'interact', 110);
      await advance(H, 24, 60000);
      desk = await g.census();
      presses.push({ tap: i + 1, node: desk.node, place: desk.place, takes_input: desk.takes_input });
      if (desk.node && !['writ.race-observed', 'writ.enter', 'hold.out'].includes(desk.node)) break;
    }
    rec.desk = { presses, final: desk };
    const reachedDesk = (desk.place && desk.place !== 'barge-hold') || ['writ.enter', 'writ.race-observed', 'writ.sex'].includes(desk.node);
    const movedOn = desk.node && desk.node !== 'writ.race-observed' && desk.node !== 'hold.out';
    if (reachedDesk && movedOn) {
      pass(`T-OPEN/${prof.id}`, `THE WHOLE OPENING ON TOUCH ALONE: title -> New -> ${walk ? walk.total_moved_m : '?'} m walked -> talked -> a name from the ledger -> out of the hold -> '${desk.node}'`, { place: desk.place, node: desk.node, spec: desk.spec });
    } else {
      fail(`T-OPEN/${prof.id}`, `the opening did not finish on touch: reached the desk = ${reachedDesk}, final node '${desk.node}' after ${presses.length} taps (walked out ${walkOut.total_moved_m} m to ${JSON.stringify(walkOut.final_pos)})`, rec.desk);
    }
    await shot(H, `${DATE}-w1-touch-${prof.id}-03-the-desk`);
    rec.page_errors = H.errors.slice(0, 5);
  } catch (e) {
    fail(`T-OPEN/${prof.id}`, `the opening leg threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
    rec.threw = String(e && e.message || e);
  } finally {
    await H.ctx.close();
  }
  return rec;
}

/**
 * Walk to a world point on the FLOATING STICK. Camera-relative, exactly as `sim/player.js`
 * composes it: `dir = right*moveX + forward*moveY`. The thumb is pushed toward where the player
 * wants to go, which is the only steering a touch player has, and the stick is held at FULL
 * deflection so this leg measures reachability and not the response curve (that is `curve`).
 */
async function walkToOnTouch(H, g, target, origin, within = 1.5, iterations = 20) {
  const steps = [];
  let total = 0;
  let prev = null;
  // Eight bearings, for the unstick sweep — a body pressed into a crate does not move on the one
  // axis that points at the target, and a walker that keeps pushing the same way measures the crate.
  const SWEEP = [[0, 1], [0.7, 0.7], [1, 0], [0.7, -0.7], [0, -1], [-0.7, -0.7], [-1, 0], [-0.7, 0.7]];
  let sweepAt = 0;
  let last = null;
  for (let i = 0; i < iterations; i++) {
    const st = await H.page.evaluate(() => ({ p: window.__ENGINE.sim.player.pos.slice(), cy: window.__ENGINE.sim.camera.yaw }));
    const dx = target[0] - st.p[0], dz = target[2] - st.p[2];
    const d = Math.hypot(dx, dz);
    const movedSince = prev ? Math.hypot(st.p[0] - prev[0], st.p[2] - prev[2]) : Infinity;
    if (prev) total += movedSince;
    steps.push({ dist: Number(d.toFixed(3)), pos: st.p.map((v) => Number(v.toFixed(3))), yaw: Number(st.cy.toFixed(1)), moved_since: Number(movedSince === Infinity ? 0 : movedSince.toFixed(3)) });
    prev = st.p;
    last = st.p;
    if (d <= within) break;
    let mx, my;
    if (movedSince < 0.05) { [mx, my] = SWEEP[sweepAt % 8]; sweepAt++; }
    else {
      sweepAt = 0;
      const cy = st.cy * Math.PI / 180;
      const rx = dx * Math.cos(cy) - dz * Math.sin(cy);
      const fy = dx * Math.sin(cy) + dz * Math.cos(cy);
      const m = Math.hypot(rx, fy) || 1;
      mx = rx / m; my = fy / m;
    }
    const ms = Math.max(220, Math.min(1400, Math.round(d * 260)));
    await stickHold(H, origin, mx, my, ms);
    const adv = await advance(H, 10, 30000);
    steps[steps.length - 1].frames_advanced = adv.advanced;
    steps[steps.length - 1].pushed = [Number(mx.toFixed(2)), Number(my.toFixed(2))];
  }
  return {
    iterations: steps.length,
    final_dist: steps.length ? steps[steps.length - 1].dist : null,
    final_pos: last ? last.map((v) => Number(v.toFixed(3))) : null,
    total_moved_m: Number(total.toFixed(3)),
    steps,
  };
}

async function shot(H, name) {
  const p = path.join(SHOTS, `${name}.png`);
  try { await H.page.screenshot({ path: p, timeout: 120000, animations: 'disabled' }); out.shots.push(path.relative(REPO_ROOT, p)); say(`     [shot] ${path.relative(REPO_ROOT, p)}`); }
  catch (e) { say(`     [shot] FAILED ${name}: ${String(e && e.message || e).split('\n')[0]}`); }
}

// =============================================================================================
// LEG: reach (T1)
// =============================================================================================
async function legReach() {
  say('\n-- LEG reach · T1, all sixteen actions, counted not asserted --------------------------');
  const prof = PROFILES[1];
  const H = await openPhone(prof, '?mode=play-instrumented&state=arena_flat');
  const g = mk(H);
  const rec = {};
  try {
    await H.page.evaluate(() => { window.__HARNESS.setSeed(4711); window.__HARNESS.loadState('arena_flat'); });
    await g.step(4);
    const CLOSED = ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump', 'use_item',
      'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu', 'crouch', 'spell_cycle'];
    rec.closed_set = CLOSED;
    const reached = {};
    const norm = (es) => es.map((e) => (typeof e === 'string' ? e : e.button || e.action || e.name || JSON.stringify(e)));

    /** one real tap on a control, frame-exact: down, step, up, step. */
    const tapF = async (x, y, holdFrames) => {
      await H.finger.down(7, x, y);
      await g.step(Math.max(1, holdFrames));
      await H.finger.up(7);
      await g.step(3);
    };
    // `InputPipeline.edges` is a ring that TRUNCATES ITSELF at 64 entries inside `latchForStep`,
    // so slicing it by a remembered index silently loses edges. Clear the log first, then read
    // it whole. Clearing a diagnostic log is not driving input — the finger below still does all
    // the work — and the first draft of this leg reported 0/16 because it read `e.action` on a
    // record whose field is `e.button`.
    const edgesSince = async (fn) => {
      await H.page.evaluate(() => { window.__ENGINE.input.edges.length = 0; });
      await fn();
      return norm(await g.edges());
    };

    // --- the ten direct buttons + the roll gate's two halves ---------------------------------
    const lay = await g.layout();
    rec.direct_controls = lay.filter((c) => !c.drawer && !c.fromDrawer).map((c) => c.action);
    for (const c of lay) {
      if (c.drawer || c.fromDrawer) continue;
      const hold = c.gate ? 4 : 2;                    // a gated control is TAPPED here
      const fired = await edgesSince(() => tapF(c.x, c.y, hold));
      for (const a of fired) reached[a] = { via: `tap on the '${c.action}' control`, hold_frames: hold };
      rec[`tap_${c.action}`] = fired;
    }
    // the roll control HELD past the gate must give `sprint`
    const rollC = centreOf(lay, 'roll');
    const sprintFired = await edgesSince(() => tapF(rollC.x, rollC.y, 20));
    for (const a of sprintFired) reached[a] = { via: "the 'roll' control HELD past the 12-frame gate", hold_frames: 20 };
    rec.hold_roll_20f = sprintFired;

    // --- the drawer: open, reach the five behind it, close ------------------------------------
    const drawerC = centreOf(lay, '__drawer');
    const st0 = await g.touch();
    await tapF(drawerC.x, drawerC.y, 2);
    const st1 = await g.touch();
    const opened = await g.layout();
    rec.drawer = { before: st0.drawerOpen, after_first_tap: st1.drawerOpen, petals: opened.filter((c) => c.fromDrawer).map((c) => c.action) };
    for (const c of opened) {
      if (!c.fromDrawer) continue;
      // Each petal closes the drawer on press, so reopen before the next one — which is also
      // the thing a player does.
      const fired = await edgesSince(() => tapF(c.x, c.y, 2));
      for (const a of fired) reached[a] = { via: `tap on the '${c.action}' petal behind the ONE drawer control`, hold_frames: 2 };
      rec[`petal_${c.action}`] = fired;
      const s = await g.touch();
      if (!s.drawerOpen) await tapF(drawerC.x, drawerC.y, 2);
    }
    // and it must CLOSE by touch as well as open
    const openNow = (await g.touch()).drawerOpen;
    if (openNow) await tapF(drawerC.x, drawerC.y, 2);
    const closedNow = (await g.touch()).drawerOpen;
    rec.drawer.closed_by_second_tap = !closedNow;

    const got = CLOSED.filter((a) => reached[a]);
    const missing = CLOSED.filter((a) => !reached[a]);
    rec.reached = reached;
    rec.count = got.length;
    rec.missing = missing;
    say(`     ${got.length}/16 actions fired from a real tap; direct ${rec.direct_controls.length}, drawer petals ${rec.drawer.petals.length}`);
    if (got.length === 16 && rec.drawer.after_first_tap === true && rec.drawer.closed_by_second_tap) {
      pass('T1', `all 16 actions of the closed set were reached by a real touch and COUNTED from getInputEdges() — ${rec.direct_controls.length} direct, ${rec.drawer.petals.length} behind the one drawer, sprint on the roll control's hold gate; the drawer opened and closed on touch`, { direct: rec.direct_controls, petals: rec.drawer.petals });
    } else {
      fail('T1', `${got.length}/16 reached on touch; missing: ${missing.join(', ') || 'none'} (drawer opened ${rec.drawer.after_first_tap}, closed ${rec.drawer.closed_by_second_tap})`, rec);
    }

    // --- T9, on the way past: stick + camera + two buttons at once ----------------------------
    const l2 = await g.layout();
    const b1 = centreOf(l2, 'block'), b2 = centreOf(l2, 'light');
    await H.finger.down(1, 120, 260);                       // stick
    await H.finger.move(1, 180, 200);
    await H.finger.down(2, Math.round(prof.w * 0.62), 120);  // camera drag
    await H.finger.move(2, Math.round(prof.w * 0.62) + 40, 130);
    await H.finger.down(3, b1.x, b1.y);
    await H.finger.down(4, b2.x, b2.y);
    await g.step(3);
    const multi = await g.touch();
    rec.multitouch = multi;
    await H.finger.allUp();
    await g.step(3);
    if (multi.pointers === 4 && multi.roles.includes('stick') && multi.roles.includes('camera') && multi.roles.filter((r) => r === 'button').length === 2) {
      pass('T9', `four simultaneous real touches all registered: ${multi.roles.join(' + ')}, held ${multi.held.join(', ')}`, multi);
    } else {
      fail('T9', `simultaneous touches dropped: ${multi.pointers} pointer(s), roles ${JSON.stringify(multi.roles)}`, multi);
    }
    rec.page_errors = H.errors.slice(0, 5);
  } catch (e) {
    fail('T1', `the reach leg threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: float (T2)
// =============================================================================================
async function legFloat() {
  say('\n-- LEG float · T2, the origin follows the thumb ---------------------------------------');
  const prof = PROFILES[1];
  const H = await openPhone(prof, '?mode=play-instrumented&state=arena_flat');
  const g = mk(H);
  const rec = { origins: [] };
  try {
    await H.page.evaluate(() => { window.__HARNESS.setSeed(4711); window.__HARNESS.loadState('arena_flat'); });
    await g.step(8);
    // Three places a thumb might land, all in the left half, deliberately far apart — including
    // one in the top-left corner, which a FIXED rosette could never be.
    const ORIGINS = [{ x: 90, y: 300 }, { x: 300, y: 200 }, { x: 60, y: 70 }];
    const R = 90, DEFL = 0.8, FRAMES = 60;
    for (const o of ORIGINS) {
      await H.page.evaluate(() => { window.__HARNESS.setSeed(4711); window.__HARNESS.loadState('arena_flat'); });
      await g.step(4);
      const p0 = await g.pos();
      await H.finger.down(1, o.x, o.y);
      await g.step(1);
      const stickAtDown = await g.touch();
      await H.finger.move(1, o.x, o.y - DEFL * R);          // straight "forward"
      await g.step(FRAMES);
      const stickHeld = await g.touch();
      await H.finger.up(1);
      await g.step(2);
      const p1 = await g.pos();
      const d = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      rec.origins.push({
        thumb_landed_at: o,
        stick_origin_reported: { ox: stickAtDown.stick.ox, oy: stickAtDown.stick.oy },
        origin_follows_thumb: stickAtDown.stick.ox === o.x && stickAtDown.stick.oy === o.y,
        stick_vector: { x: Number(stickHeld.stick.x.toFixed(4)), y: Number(stickHeld.stick.y.toFixed(4)) },
        walked_m: Number(d.toFixed(4)),
        frames: FRAMES,
      });
      say(`     thumb at (${o.x},${o.y}) -> origin (${stickAtDown.stick.ox},${stickAtDown.stick.oy}), stick y=${stickHeld.stick.y.toFixed(3)}, walked ${d.toFixed(3)} m`);
    }
    const allFollow = rec.origins.every((r) => r.origin_follows_thumb);
    const ds = rec.origins.map((r) => r.walked_m);
    const spread = Math.max(...ds) - Math.min(...ds);
    const rel = spread / (Math.max(...ds) || 1);
    rec.walk_spread_m = Number(spread.toFixed(4));
    rec.walk_spread_relative = Number(rel.toFixed(4));
    if (allFollow && Math.min(...ds) > 0.5 && rel <= 0.05) {
      pass('T2', `three drags from three different places produced the same walk: origins ${rec.origins.map((r) => `(${r.thumb_landed_at.x},${r.thumb_landed_at.y})`).join(' ')} each became the stick centre exactly, and the same finger displacement walked ${ds.map((d) => d.toFixed(3)).join(' / ')} m (spread ${(rel * 100).toFixed(2)}%)`, { walked: ds });
    } else {
      fail('T2', `the stick does not float: origins followed thumb = ${allFollow}, walks ${ds.map((d) => d.toFixed(3)).join(' / ')} m (spread ${(rel * 100).toFixed(1)}%)`, rec);
    }
    rec.page_errors = H.errors.slice(0, 5);
  } catch (e) {
    fail('T2', `the float leg threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: curve  (walk speed against thumb distance; the double-deadzone check)
// =============================================================================================
async function legCurve() {
  say('\n-- LEG curve · walk speed vs thumb deflection, and the double-deadzone check ----------');
  const prof = PROFILES[1];
  const H = await openPhone(prof, '?mode=play-instrumented&state=arena_flat');
  const g = mk(H);
  const rec = {};
  try {
    const live = await H.page.evaluate(() => ({
      move_deadzone: window.__ENGINE.combat.d.locomotion.move_deadzone,
      inner: window.__ENGINE.data.inputProfiles.analog.left_stick.inner_deadzone,
      outer: window.__ENGINE.data.inputProfiles.analog.left_stick.outer_saturation,
      walk_run: window.__ENGINE.data.inputProfiles.analog.left_stick.walk_run_threshold,
    }));
    rec.live_constants = live;
    say(`     live: touch/pad pre-shape inner=${live.inner} outer=${live.outer}; combat/player.js move_deadzone=${live.move_deadzone}`);

    const DEFL = [0.05, 0.10, 0.14, 0.16, 0.20, 0.25, 0.30, 0.40, 0.50, 0.55, 0.60, 0.70, 0.85, 1.00];
    const O = { x: 200, y: 260 }, R = 90;

    // `loadState()` REBUILDS `engine.combat.d` from the data, so a deadzone written once before
    // the sweep is silently reverted by the first row. That is RULES 6's INERT CONTROL, and the
    // first run of this leg produced two byte-identical arms because of it — the check called it
    // ("either touch never reached that branch, or the control is inert") rather than passing on
    // a number that meant nothing. The deadzone is now written AFTER every load and read back,
    // and the readback is published so an inert arm can never look like a null result again.
    const sweep = async (label, deadzone) => {
      const rows = [];
      let dzSeen = null;
      for (const d of DEFL) {
        await H.page.evaluate((dz) => { window.__HARNESS.setSeed(4711); window.__HARNESS.loadState('arena_flat'); window.__ENGINE.combat.d.locomotion.move_deadzone = dz; }, deadzone);
        dzSeen = await H.page.evaluate(() => window.__ENGINE.combat.d.locomotion.move_deadzone);
        if (dzSeen !== deadzone) throw new Error(`the arm did not take: asked for move_deadzone ${deadzone}, the live object holds ${dzSeen}`);
        await g.step(4);
        const p0 = await g.pos();
        await H.finger.down(1, O.x, O.y);
        await g.step(1);
        await H.finger.move(1, O.x, O.y - d * R);
        // RULES 8: three instants, not one. A body that lurches once and stops is not walking.
        await g.step(30); const p30 = await g.pos();
        await g.step(30); const p60 = await g.pos();
        await g.step(30); const p90 = await g.pos();
        const stick = await g.touch();
        // `getInputState()` carries no move vector — the first draft read it and published
        // fourteen zeroes. The pipeline's own latched vector is `engine.input.moveX/moveY`,
        // which is what `combat/player.js` reads.
        const mv = await H.page.evaluate(() => ({ moveX: window.__ENGINE.input.moveX, moveY: window.__ENGINE.input.moveY }));
        await H.finger.up(1);
        await g.step(2);
        const dist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
        const total = dist(p0, p90);
        rows.push({
          deflection: d,
          finger_px_from_origin: Number((d * R).toFixed(1)),
          stick_magnitude: Number(Math.hypot(stick.stick.x, stick.stick.y).toFixed(4)),
          move_vector_magnitude: Number(Math.hypot(mv.moveX || 0, mv.moveY || 0).toFixed(4)),
          m_at_30f: Number(dist(p0, p30).toFixed(4)),
          m_at_60f: Number(dist(p0, p60).toFixed(4)),
          m_at_90f: Number(total.toFixed(4)),
          m_per_s: Number((total / 1.5).toFixed(4)),
        });
        say(`     ${label} deflection ${d.toFixed(2)} (${(d * R).toFixed(0)} px)  move|v|=${rows[rows.length - 1].move_vector_magnitude.toFixed(3)}  ${rows[rows.length - 1].m_per_s.toFixed(3)} m/s   [30f ${rows[rows.length - 1].m_at_30f.toFixed(3)} · 60f ${rows[rows.length - 1].m_at_60f.toFixed(3)} · 90f ${total.toFixed(3)}]`);
      }
      const firstLive = rows.find((r) => r.m_per_s > 0.01);
      return { rows, first_live_deflection: firstLive ? firstLive.deflection : null, move_deadzone_readback: dzSeen };
    };

    rec.shipped = await sweep('SHIPPED  ', live.move_deadzone);
    rec.shipped.note = 'the tree as it ships, move_deadzone = ' + live.move_deadzone;

    // DELETE-THE-FIX. Put the pad round's second deadzone back and re-sweep. If the touch path
    // was never affected, this arm is identical and the pad round's fix does NOT cover touch —
    // which is exactly the question the dispatch asked.
    rec.deadzone_restored = await sweep('DZ=0.15  ', 0.15);
    rec.deadzone_restored.note = 'W1-GAMEPAD F4 deleted: combat/player.js move_deadzone put back to 0.15 after every loadState, readback asserted';

    const a = rec.shipped.first_live_deflection, b = rec.deadzone_restored.first_live_deflection;
    rec.first_live = { shipped: a, with_second_deadzone: b };
    const monotone = rec.shipped.rows.filter((r) => r.deflection >= 0.2).every((r, i, arr) => i === 0 || r.m_per_s >= arr[i - 1].m_per_s - 0.02);
    rec.monotonic_above_0_2 = monotone;

    if (a !== null && b !== null && b > a && monotone) {
      pass('T4-DZ', `walk speed varies with thumb distance and the pad round's fix DOES cover the touch path: shipped, the body is alive from deflection ${a} (${(a * 90).toFixed(0)} px of thumb travel); with combat/player.js move_deadzone put back to 0.15 the same finger is dead until ${b} — ${(((b - a) / 1) * 100).toFixed(0)} points of stick range returned, and the response is monotone above 0.2`,
        { curve: rec.shipped.rows.map((r) => [r.deflection, r.m_per_s]), restored: rec.deadzone_restored.rows.map((r) => [r.deflection, r.m_per_s]) });
    } else if (a !== null && b !== null && b === a) {
      fail('T4-DZ', `the second deadzone makes NO difference on the touch path (first live ${a} in both arms) — either touch never reached that branch, or the control is inert. Either way the number above is not evidence.`, rec.first_live);
    } else {
      fail('T4-DZ', `the touch stick does not produce a graded walk: first live deflection ${a} (shipped) / ${b} (deadzone restored), monotone above 0.2 = ${monotone}`, rec.first_live);
    }
    rec.page_errors = H.errors.slice(0, 5);
  } catch (e) {
    fail('T4-DZ', `the curve leg threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: gate (T5) — the SAME discriminator on both paths, in one page
// =============================================================================================
async function legGate() {
  say('\n-- LEG gate · T5, the roll/sprint discriminator on touch AND on the pad ----------------');
  const prof = PROFILES[1];
  const H = await openPhone(prof, '?mode=play-instrumented&state=arena_flat');
  const g = mk(H);
  const rec = {};
  try {
    await H.page.evaluate(() => { window.__HARNESS.setSeed(4711); window.__HARNESS.loadState('arena_flat'); });
    await g.step(4);
    if (BREAK.gate) {
      const r = await H.page.evaluate(() => window.__HARNESS.perturbInput({ path: 'touch.buttons.0.hold_gate.frames', value: 1 }));
      rec.break_gate_applied = r;
      say(`     [teardown] --break-gate: touch roll gate frames ${r.before} -> ${r.after} (the PAD's row is untouched)`);
    }
    const HOLDS = [4, 8, 11, 12, 13, 20];
    const norm = (es) => es.map((e) => (typeof e === 'string' ? e : e.button || e.action || e.name || JSON.stringify(e)));
    // See the note in the reach leg: the edge log truncates itself at 64, so it is cleared and
    // read whole rather than sliced by index.
    const edgesSince = async (fn) => { await H.page.evaluate(() => { window.__ENGINE.input.edges.length = 0; }); await fn(); return norm(await g.edges()); };
    const verdict = (fired) => {
      const roll = fired.some((e) => /roll/.test(e)), sprint = fired.some((e) => /sprint/.test(e));
      return roll && sprint ? 'BOTH' : roll ? 'roll' : sprint ? 'sprint' : 'NEITHER';
    };

    // --- touch arm: a real finger on the roll control -----------------------------------------
    const lay = await g.layout();
    const rollC = centreOf(lay, 'roll');
    rec.touch_control = rollC;
    const touchArm = [];
    for (const n of HOLDS) {
      const fired = await edgesSince(async () => {
        await H.finger.down(6, rollC.x, rollC.y);
        await g.step(n);
        await H.finger.up(6);
        await g.step(3);
      });
      touchArm.push({ frames_held: n, edges: fired, verdict: verdict(fired) });
      say(`     touch  held ${String(n).padStart(2)} f -> ${verdict(fired)}   [${fired.join(', ')}]`);
    }
    rec.touch = touchArm;

    // --- pad arm: the same button, the same page, index 1 --------------------------------------
    const padArm = [];
    for (const n of HOLDS) {
      const fired = await edgesSince(async () => {
        for (let i = 0; i < n; i++) { await H.page.evaluate(() => window.__HARNESS.gamepad({ buttons: [0, 1] })); await g.step(1); }
        await H.page.evaluate(() => window.__HARNESS.gamepad({ buttons: [0, 0] }));
        await g.step(3);
      });
      padArm.push({ frames_held: n, edges: fired, verdict: verdict(fired) });
      say(`     pad    held ${String(n).padStart(2)} f -> ${verdict(fired)}   [${fired.join(', ')}]`);
    }
    rec.pad = padArm;
    await H.page.evaluate(() => window.__HARNESS.gamepad(null));

    const agree = HOLDS.every((n, i) => touchArm[i].verdict === padArm[i].verdict);
    const boundaryTouch = touchArm.find((r) => r.verdict === 'sprint');
    const boundaryPad = padArm.find((r) => r.verdict === 'sprint');
    rec.agreement = { agree, boundary_touch: boundaryTouch ? boundaryTouch.frames_held : null, boundary_pad: boundaryPad ? boundaryPad.frames_held : null };
    rec.shared_module = 'game/src/input/hold-gate.js shouldPromote()';

    const canonical = touchArm.every((r) => (r.frames_held <= 11 ? r.verdict === 'roll' : r.verdict === 'sprint'));
    if (BREAK.gate) {
      const touchBroken = touchArm.some((r) => r.frames_held <= 11 && r.verdict !== 'roll');
      const padStillRight = padArm.every((r) => (r.frames_held <= 11 ? r.verdict === 'roll' : r.verdict === 'sprint'));
      if (touchBroken && padStillRight) pass('T5-TOUCH', `--break-gate went red on the TOUCH arm only (touch boundary ${rec.agreement.boundary_touch} f, pad still ${rec.agreement.boundary_pad} f) — the DATA rows are separate, as they must be`, rec.agreement);
      else fail('T5-TOUCH', `--break-gate did not isolate: touch broken = ${touchBroken}, pad still correct = ${padStillRight}`, rec.agreement);
    } else if (BREAK.patched) {
      const bothBroken = touchArm.some((r) => r.frames_held <= 11 && r.verdict !== 'roll') && padArm.some((r) => r.frames_held <= 11 && r.verdict !== 'roll');
      if (bothBroken) pass('T5-SHARED', `one line changed in game/src/input/hold-gate.js and BOTH arms went red together (touch boundary ${rec.agreement.boundary_touch} f, pad ${rec.agreement.boundary_pad} f) — the discriminator is ONE implementation, not two that agree`, rec.agreement);
      else fail('T5-SHARED', `patching hold-gate.js did NOT break both arms — touch ${JSON.stringify(touchArm.map((r) => r.verdict))}, pad ${JSON.stringify(padArm.map((r) => r.verdict))}. There is still a second implementation.`, rec.agreement);
    } else if (agree && canonical) {
      pass('T5', `the touchscreen and the pad give the identical verdict at every one of ${HOLDS.join('/')} frames — roll at <= 11, sprint from 12 — measured on both paths in one page, against one implementation (${rec.shared_module})`, { touch: touchArm.map((r) => [r.frames_held, r.verdict]), pad: padArm.map((r) => [r.frames_held, r.verdict]) });
    } else {
      fail('T5', `the two paths disagree or the boundary is wrong: touch ${JSON.stringify(touchArm.map((r) => [r.frames_held, r.verdict]))} vs pad ${JSON.stringify(padArm.map((r) => [r.frames_held, r.verdict]))}`, rec.agreement);
    }
    rec.page_errors = H.errors.slice(0, 5);
  } catch (e) {
    fail('T5', `the gate leg threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 5).join('\n') });
  } finally { await H.ctx.close(); }
  return rec;
}

// =============================================================================================
// LEG: differential — the keyboard and the pad still work
// =============================================================================================
async function legDifferential() {
  say('\n-- LEG differential · nothing I added broke the keyboard or the pad -------------------');
  const rec = {};
  const run = (cmd) => {
    const t0 = Date.now();
    try {
      const stdout = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 1800000, stdio: ['ignore', 'pipe', 'pipe'] });
      return { cmd, exit: 0, ms: Date.now() - t0, tail: stdout.trim().split('\n').slice(-8).join('\n') };
    } catch (e) {
      return { cmd, exit: e.status === undefined ? -1 : e.status, ms: Date.now() - t0, tail: String((e.stdout || '') + (e.stderr || '')).trim().split('\n').slice(-14).join('\n') };
    }
  };
  rec.keyboard = run('node tools/journey/opening-play.mjs --json reports/w1-touch/differential-keyboard.json --shots reports/w1-touch/shots-keyboard --tag w1-touch-differential');
  say(`     keyboard opening: exit ${rec.keyboard.exit} in ${(rec.keyboard.ms / 1000).toFixed(0)} s`);
  say(rec.keyboard.tail.split('\n').map((l) => '       ' + l).join('\n'));
  rec.pad = run('node tools/gamepad/pad-run.mjs --leg opening --out reports/w1-touch/pad');
  say(`     pad opening: exit ${rec.pad.exit} in ${(rec.pad.ms / 1000).toFixed(0)} s`);
  say(rec.pad.tail.split('\n').map((l) => '       ' + l).join('\n'));
  if (rec.keyboard.exit === 0 && rec.pad.exit === 0) {
    pass('T-DIFF', `with touch measured and the discriminator shared, the KEYBOARD opening still completes (opening-play.mjs exit 0) and the PAD opening still completes (pad-run.mjs --leg opening exit 0)`, { keyboard_ms: rec.keyboard.ms, pad_ms: rec.pad.ms });
  } else {
    fail('T-DIFF', `a differential arm regressed: keyboard exit ${rec.keyboard.exit}, pad exit ${rec.pad.exit}`, rec);
  }
  return rec;
}

// =============================================================================================
// run
// =============================================================================================
const want = (name) => LEG === 'all' || LEG === name;
try {
  if (want('opening')) {
    out.checks.opening = [];
    const list = args.profile ? PROFILES.filter((p) => p.id === String(args.profile)) : PROFILES;
    if (!list.length) throw new Error(`no viewport profile '${args.profile}'. Known: ${PROFILES.map((p) => p.id).join(', ')}`);
    for (const p of list) out.checks.opening.push(await legOpening(p));
  }
  if (want('reach')) out.checks.reach = await legReach();
  if (want('float')) out.checks.float = await legFloat();
  if (want('curve')) out.checks.curve = await legCurve();
  if (want('gate')) out.checks.gate = await legGate();
  if (want('differential')) out.checks.differential = await legDifferential();
} catch (e) {
  fail('RUN', `the run threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 6).join('\n') });
} finally {
  try { await browser.close(); } catch { /* ignore */ }
  try { await server.close(); } catch { /* ignore */ }
}

out.conditions.loadavg_at_end = loadavg();
out.summary = { pass: out.passes.length, fail: out.failures.length };
const artifact = path.join(OUT, ANY_BREAK.length ? `touch-run-teardown-${ANY_BREAK.join('-')}-${LEG}.json` : `touch-run-${LEG}.json`);
writeJson(artifact, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, artifact)}`);

let exitCode = out.failures.length ? 1 : 0;
if (ANY_BREAK.length === 1) {
  const sig = SIGNATURE[ANY_BREAK[0]];
  // A signature check that is a per-profile id (T-OPEN/<profile>) matches by prefix.
  const hit = out.failures.some((f) => f === sig || f.startsWith(sig + '/')) || (out.checks[sig] && out.checks[sig].ok === true && (sig === 'T5-TOUCH' || sig === 'T5-SHARED' || sig === 'T4-DZ'));
  const collateral = out.failures.filter((f) => !(f === sig || f.startsWith(sig + '/')));
  out.teardown_result = { teardown: ANY_BREAK[0], signature: sig, signature_reported: hit, collateral };
  writeJson(artifact, out);
  say(`  TEARDOWN '${ANY_BREAK[0]}': signature ${sig} ${hit ? 'REPORTED as required' : 'DID NOT report — the instrument cannot see this sabotage'}`);
  if (collateral.length) say(`  collateral: ${collateral.join(', ')}`);
  exitCode = hit ? 0 : 1;
}
process.exit(exitCode);

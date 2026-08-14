#!/usr/bin/env node
// hud-compass-probe.mjs — the compass and minimal mode, in the running game. ONE browser.
//
// Owner: HUD-MORROWIND. Rule 21 says launch one browser and keep it, so everything this piece
// needs a live game for is in this one file and one process.
//
// Directive §2 is the shape of this tool: *"many screenshots AND MOTION SEQUENCES, from many
// angles, taken from the actual running game"*, because *"something may seem ok when inspected
// statically in isolation, but if you actually play the game for a short time then major issues
// become immediately clear."* A still photograph of a compass proves nothing at all about a
// compass — the whole claim is about what happens when you turn — so §A below is a motion
// sequence through a full 360°, and the screenshot pack in §F is a strip of that rotation plus
// both modes at five viewports over a bright scene and a dark one.
//
// EVERY CHECK HERE HAS A NULL CONTROL THAT MUST COME OUT WORSE, and they are RUN rather than
// asserted (rule 6, and W1-04's inert control specifically):
//
//   A3 "the dial redraws as you turn"      <- A4 the same instrument over a STILL camera, which
//                                             must find no change. A "did any pixel move" check
//                                             passes on a still camera too, and would be noise.
//   A1 "the bearing is right"              <- computed here from the camera forward vector, NOT
//                                             imported from compass.js, so a sign flip in the
//                                             thing under test cannot move the yardstick.
//   C1 "quest state does not touch it"     <- C2 the SAME crop diff over a 3-degree yaw nudge,
//                                             which must go non-zero. Otherwise C1 is a
//                                             statement about a blind instrument.
//   D1 "minimal is smaller than full"      <- D3 the same comparison with both arms set to
//                                             'full', which must fail. Otherwise D1 would pass
//                                             on a minimal mode that did nothing.
//   B1 "no dial in a fight"                <- B2 the same read out of a fight, which must find
//                                             one. Absence proves nothing without the presence.
//
// EXIT 0 = every check passed · 1 = a check failed.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
hud-compass-probe.mjs — the Morrowind compass and minimal mode, measured in the running game.

USAGE
  node tools/ui/hud-compass-probe.mjs [--no-shots] [--json]

EXIT 0 = every check passes · 1 = a check failed
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.join(REPO_ROOT, 'reports/hud-morrowind');
const SHOTS = path.join(REPO_ROOT, 'docs/shots');
ensureDir(OUT); ensureDir(SHOTS);
const WANT_SHOTS = !args['no-shots'];

const checks = [];
const push = (id, pass, detail) => {
  checks.push({ id, pass, detail });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`);
};

function decode(u) { return PNG.sync.read(Buffer.from(String(u).split(',')[1], 'base64')); }

/** Crop a rect out of a decoded PNG into a flat RGB array. Clamped to the image. */
function crop(png, rect) {
  const x0 = Math.max(0, Math.round(rect[0])), y0 = Math.max(0, Math.round(rect[1]));
  const x1 = Math.min(png.width, Math.round(rect[0] + rect[2]));
  const y1 = Math.min(png.height, Math.round(rect[1] + rect[3]));
  const out = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * png.width + x) * 4;
      out.push(png.data[o], png.data[o + 1], png.data[o + 2]);
    }
  }
  return out;
}

/** Pixels differing by more than 6 on any channel, between two equal-length crops. */
function cropDiff(a, b) {
  if (a.length !== b.length) return Math.max(a.length, b.length) / 3;
  let d = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (Math.abs(a[i] - b[i]) > 6 || Math.abs(a[i + 1] - b[i + 1]) > 6 || Math.abs(a[i + 2] - b[i + 2]) > 6) d++;
  }
  return d;
}

/**
 * THE INDEPENDENT DERIVATION. Deliberately NOT `compass.bearingFromYaw` — see the header.
 * Camera forward is `[sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)]` (engine.js:6295);
 * north is −Z and east is +X (screens/map.js draws z downward; interior-lighting.js:311 calls
 * the low-z wall north). Bearing clockwise from north of (dx, dz) is `atan2(dx, −dz)`.
 */
function expectedBearing(yawDeg) {
  const y = yawDeg * Math.PI / 180;
  let b = Math.atan2(Math.sin(y), -Math.cos(y)) * 180 / Math.PI;
  return b < 0 ? b + 360 : b;
}
const CARDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function expectedCardinal(bearing) { return CARDS[Math.round(bearing / 45) % 8]; }

const out = {
  schema: 'elder-souls/hud-compass-probe@1',
  at: new Date().toISOString(),
  commit: (process.env.GIT_COMMIT || '').slice(0, 12) || null,
  data: {}, checks: [],
};

const h = await launchGame({ width: 1280, height: 720, timeout: 300000 });
const shotsWritten = [];

/** Read the drawn dial element and the HUD block out of `getUIState()`. */
async function readHud() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const dial = (s.elements || []).find((e) => e.kind === 'bearing_dial' && e.visible) || null;
    return {
      hud: s.hud,
      dial: dial ? { rect: dial.rect.slice(), text: dial.text, meta: dial.meta } : null,
      persistentIds: (s.elements || []).filter((e) => e.visible && e.id.startsWith('hud.')).map((e) => e.id),
      forbidden: (s.elements || []).filter((e) => ['compass', 'minimap', 'map', 'quest_marker', 'waypoint',
        'objective_tracker', 'map_pin'].includes(e.kind)).map((e) => e.kind),
      screen: s.screen,
    };
  });
}

/** Put the camera at a yaw and advance one frame, through the fixed step. */
async function setYaw(deg) {
  await h.page.evaluate((d) => {
    window.__ENGINE.sim.camera.yaw = d;
  }, deg);
  await h.h('stepFrames', 1);
}

try {
  await h.h('setRenderRate', 60);
  await h.h('setDevicePixelRatio', 1);

  // ---- get outdoors, in daylight, standing still --------------------------------------------
  const placed = await h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    try { A.closeMenu(); } catch { /* */ }
    A.loadState('default');
    for (let i = 0; i < 4; i++) A.stepFrames(1);
    try { A.exitInterior(); } catch { /* */ }
    for (let i = 0; i < 6; i++) A.stepFrames(1);
    const site = (eng.field.sites || [])[0];
    if (site) { try { A.teleport(site.x, site.z); } catch { /* */ } }
    for (let i = 0; i < 20; i++) A.stepFrames(1);
    return {
      pos: eng.sim.player.pos.slice(),
      interior: !!eng.sim.env.interior,
      inCombat: eng.inCombat(),
      timeOfDay: eng.sim.env.timeOfDay,
    };
  });
  log(`  placed at (${placed.pos[0].toFixed(0)}, ${placed.pos[2].toFixed(0)}), interior=${placed.interior}, inCombat=${placed.inCombat}`);
  out.data.placed = placed;

  // `--shots-only` jumps straight to §F. It exists because the picture pack is the long, cheap,
  // interruptible half of this tool and §A–§E is the short, load-bearing half: the first
  // complete run on this box had all thirteen measurement checks green and was then killed
  // mid-pack when something outside this process closed its browser (rule 21's "never
  // `pkill -f headless_shell`" failure, seen from the receiving end). Re-running fifteen minutes
  // of measurement to finish thirteen photographs is waste, so it does not have to.
  measure: {
  if (args['shots-only']) break measure;

  // ===========================================================================================
  // A. THE MOTION SEQUENCE — a full circle, 24 stops, 15 degrees apart
  // ===========================================================================================
  //
  // Rule 8: a still target hides every steering defect, and one instant is a still target in
  // time. A compass is exactly the element that cannot be measured at one instant, which is why
  // this is the first thing in the file.
  const YAWS = [];
  for (let i = 0; i < 24; i++) YAWS.push(i * 15);

  const sweep = [];
  let dialRect = null;
  for (const yaw of YAWS) {
    await setYaw(yaw);
    const r = await readHud();
    if (!r.dial) { sweep.push({ yaw, dial: null }); continue; }
    dialRect = r.dial.rect;
    const png = decode(await h.h('screenshot'));
    sweep.push({
      yaw,
      bearing: r.dial.meta.bearing_deg,
      cardinal: r.dial.meta.cardinal,
      text: r.dial.text,
      want_bearing: +expectedBearing(yaw).toFixed(2),
      want_cardinal: expectedCardinal(expectedBearing(yaw)),
      pix: crop(png, r.dial.rect),
    });
  }
  out.data.sweep = sweep.map(({ pix, ...rest }) => rest);

  // A1 — the bearing agrees with the independent derivation at every stop.
  {
    const bad = sweep.filter((f) => {
      if (!f.bearing && f.bearing !== 0) return true;
      let d = Math.abs(f.bearing - f.want_bearing) % 360;
      if (d > 180) d = 360 - d;
      return d > 0.02;
    });
    push('A1.bearing-tracks-the-camera', bad.length === 0,
      `${sweep.length - bad.length}/${sweep.length} stops agree with atan2(fwd.x, −fwd.z) to 0.02°` +
      (bad.length ? ` — worst at yaw ${bad[0].yaw}: got ${bad[0].bearing}, want ${bad[0].want_bearing}` : ''));
  }

  // A2 — the letter at the index is the right one, and the circle actually passes all eight.
  {
    const wrong = sweep.filter((f) => f.cardinal !== f.want_cardinal);
    const seen = new Set(sweep.map((f) => f.cardinal));
    push('A2.every-compass-point-comes-round', wrong.length === 0 && seen.size === 8,
      `${sweep.length - wrong.length}/${sweep.length} stops name the right point; ` +
      `${seen.size}/8 distinct points seen over the circle [${[...seen].join(' ')}]`);
  }

  // A3 — the DIAL REDRAWS. Element metadata moving is not the same as pixels moving, and this
  // project has shipped a screen whose model moved and whose frame did not (W1-21 r2: 0 px on a
  // real focus press). So this is measured in the framebuffer.
  let stepDiffs = [];
  for (let i = 1; i < sweep.length; i++) {
    if (sweep[i].pix && sweep[i - 1].pix) stepDiffs.push(cropDiff(sweep[i - 1].pix, sweep[i].pix));
  }
  const minStep = stepDiffs.length ? Math.min(...stepDiffs) : 0;
  const medStep = stepDiffs.length ? stepDiffs.slice().sort((a, b) => a - b)[stepDiffs.length >> 1] : 0;
  out.data.sweep_step_diff_px = stepDiffs;

  // A4 — THE NULL CONTROL for A3, taken FIRST because A3's threshold is derived from it.
  //
  // THIS CHECK ORIGINALLY DEMANDED ZERO AND FAILED AT 65 px, AND THE DEMAND WAS WRONG. The
  // dial's housing is `chitin_dark` at 0.82 alpha, so the live world shows through it — leaves,
  // water and cloud shadow keep moving while the camera does not. A crop of a translucent
  // element over a running world is never byte-identical between frames and never could be.
  //
  // So the honest instrument is a SEPARATION, not a zero: how much does the dial's rectangle
  // change when the world moves and the camera does not, against how much it changes when the
  // camera turns 15°? A4 measures the floor, A3 asserts the turn clears it by 4×. That is a
  // control that can still go red — freeze the dial and every turn drops to the still floor —
  // and it does not lie about what a translucent element over a live world can promise.
  await setYaw(0);
  const still = [];
  for (let i = 0; i < 12; i++) {
    await h.h('stepFrames', 1);
    still.push(crop(decode(await h.h('screenshot')), dialRect));
  }
  const stillDiffs = [];
  for (let i = 1; i < still.length; i++) stillDiffs.push(cropDiff(still[i - 1], still[i]));
  const maxStill = Math.max(...stillDiffs);
  out.data.still_step_diff_px = stillDiffs;
  push('A4.null-control-the-still-floor-is-far-below-a-turn', maxStill * 4 < minStep,
    `${stillDiffs.length} frames with the camera pinned move the dial's rect by at most ` +
    `${maxStill} px — the world showing through 0.82-alpha chitin — against a minimum of ` +
    `${minStep} px for a 15° turn: a ${(minStep / Math.max(1, maxStill)).toFixed(1)}× separation`);

  push('A3.the-dial-redraws-when-you-turn',
    stepDiffs.length === 23 && minStep > maxStill * 4,
    `all ${stepDiffs.length} consecutive 15° steps changed the dial by more than 4× the ` +
    `still-camera floor of ${maxStill} px; min ${minStep} px, median ${medStep} px`);

  // ===========================================================================================
  // B. THE BOUNDARY — RI-UIX01 §B X6. There is no compass in a fight.
  // ===========================================================================================
  {
    const before = await readHud();
    push('B2.null-control-the-dial-is-there-out-of-a-fight', !!before.dial && before.hud.bearing_drawn,
      `out of combat: ${before.dial ? '1' : '0'} bearing_dial, heading ` +
      `${before.hud.bearing_cardinal} (${before.hud.bearing_deg}°)`);

    // `inf_trash` is the ordinary infantry archetype in `game/data/combat/enemies/`, and
    // `Engine.inCombat()` returns true for any live hostile body within 30 m. Spawning one is a
    // real fight by the project's own definition (ARBITRATION §1), not a flag flipped on the
    // side. The archetype id is checked against the build's own register first, so this fails
    // loudly with the real list rather than silently declining to enter combat — which is
    // exactly what the first run of this tool did, and it took B1 and E2 down with it.
    const fight = await h.page.evaluate(() => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const p = eng.sim.player;
      const known = Object.keys(eng.data.enemies || {});
      const id = ['inf_trash', 'cam_levy', 'drowned_lesser'].find((k) => known.includes(k)) || null;
      if (!id) return { inCombat: false, why: `no usable archetype among ${known.join(', ')}` };
      A.spawn(id, p.pos[0] + 4, p.pos[2] + 4, { as: 'compass-probe-foe' });
      for (let i = 0; i < 4; i++) A.stepFrames(1);
      return { inCombat: eng.inCombat(), archetype: id };
    });
    const during = await readHud();
    out.data.combat = { entered: fight.inCombat, dial: during.dial, hud: during.hud };
    push('B1.no-dial-in-a-fight', fight.inCombat && !during.dial && during.hud.bearing_drawn === false,
      fight.inCombat
        ? `a fight is live and the census carries ${during.dial ? 1 : 0} bearing_dial; ` +
          `state says: "${during.hud.bearing_withheld_because}"`
        : 'COULD NOT ENTER COMBAT — this check did not run and is reported failed rather than skipped');

    // B3 — and the forbidden names are still absent everywhere. `compass` stays in
    // FORBIDDEN_KINDS; this build emits none, in or out of a fight, as it did before this piece.
    push('B3.forbidden-kinds-still-zero', during.forbidden.length === 0 && before.forbidden.length === 0,
      `0 elements of kind compass/minimap/map/quest_marker/waypoint/objective_tracker/map_pin, ` +
      'in a fight and out of one');

    // leave the fight
    await h.page.evaluate(() => {
      const eng = window.__ENGINE;
      const i = eng.sim.entities.findIndex((e) => e.eid === 'compass-probe-foe');
      if (i >= 0) eng.sim.entities.splice(i, 1);
      eng.sim.player.lockOn = null;
      for (let k = 0; k < 6; k++) window.__HARNESS.stepFrames(1);
    });
    const after = await readHud();
    push('B4.the-dial-comes-back', !!after.dial,
      `with the fight over the dial is drawn again at ${after.dial ? after.dial.meta.cardinal : '-'}`);
  }

  // ===========================================================================================
  // C. RI-UIX02 DETECTOR 3 — nothing on this dial is a function of quest state
  // ===========================================================================================
  //
  // The definition of an objective marker, regardless of what it looks like: "anything on screen
  // that changes when quest state changes and nothing else does". Body and camera pinned, quest
  // flags moved, pixels diffed.
  //
  // IT IS A THREE-ARM COMPARISON AND THE FIRST VERSION WAS A TWO-ARM ONE, WHICH IS WHY IT
  // REPORTED A FALSE POSITIVE. Advance four frames while setting quest flags and the dial's rect
  // changed by 43 px — and 43 px is what four frames of a live world showing through 0.82-alpha
  // chitin costs whatever you do with the quest log. The arm that was missing is the one that
  // advances the same four frames and touches NOTHING, and the question is not "did the pixels
  // move" but "did the quest arm move them any more than the do-nothing arm did".
  {
    await setYaw(37);
    const rect = (await readHud()).dial.rect;
    const a = crop(decode(await h.h('screenshot')), rect);

    // arm 1 — four frames, nothing touched. The floor.
    await h.h('stepFrames', 4);
    const noop = crop(decode(await h.h('screenshot')), rect);
    const noopDiff = cropDiff(a, noop);

    // arm 2 — four frames, quest flags set.
    const moved = await h.page.evaluate(() => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const before = JSON.stringify(eng.sim.quest);
      let set = 0;
      for (const f of ['compass_probe_a', 'compass_probe_b', 'compass_probe_c']) {
        try { A.questSetFlag(f, true); set++; } catch { /* */ }
      }
      for (let i = 0; i < 4; i++) A.stepFrames(1);
      return { set, changed: JSON.stringify(eng.sim.quest) !== before };
    });
    const b = crop(decode(await h.h('screenshot')), rect);
    const questDiff = cropDiff(noop, b);
    out.data.quest = {
      flags_set: moved.set, quest_state_changed: moved.changed,
      noop_arm_diff_px: noopDiff, quest_arm_diff_px: questDiff,
    };
    // The quest arm must not exceed the do-nothing arm by more than the do-nothing arm's own
    // size — i.e. quest state buys no change the clock was not already buying.
    push('C1.quest-state-does-not-touch-the-dial',
      moved.changed && questDiff <= Math.max(noopDiff, 4) * 2,
      moved.changed
        ? `${moved.set} flags set and sim.quest changed. Four frames touching nothing move the ` +
          `dial's rect by ${noopDiff} px (the world behind translucent chitin); four frames with ` +
          `the quest log moving cost ${questDiff} px — no separable quest signal`
        : 'QUEST STATE DID NOT CHANGE — the check did not run and is reported failed, not skipped');

    // C2 — THE NULL CONTROL. The same crop, the same diff function, the same rect, moved by
    // three degrees of yaw. Without it, C1's "no separable signal" could just as easily be an
    // instrument that cannot see anything at all in that rectangle.
    await setYaw(40);
    const c = crop(decode(await h.h('screenshot')), rect);
    const yawDiff = cropDiff(b, c);
    out.data.quest.null_control_yaw3_diff_px = yawDiff;
    push('C2.null-control-a-3-degree-turn-does-move-it', yawDiff > Math.max(noopDiff, questDiff) * 3,
      `the same crop and the same diff over a 3° turn: ${yawDiff} px, against ${noopDiff} px ` +
      `(do-nothing) and ${questDiff} px (quest) — the instrument can see a real change in that rect`);
  }

  // ===========================================================================================
  // D. MINIMAL MODE
  // ===========================================================================================
  {
    await setYaw(200);
    await h.h('setHudMode', 'full');
    const full = await readHud();
    await h.h('setHudMode', 'minimal');
    const min = await readHud();
    out.data.modes = {
      full: { ids: full.persistentIds, persistent: full.hud.persistent_count, coverage: full.hud.coverage_pct },
      minimal: { ids: min.persistentIds, persistent: min.hud.persistent_count, coverage: min.hud.coverage_pct },
    };

    push('D1.minimal-is-strictly-smaller', min.hud.coverage_pct < full.hud.coverage_pct,
      `persistent HUD coverage ${full.hud.coverage_pct}% full -> ${min.hud.coverage_pct}% minimal ` +
      `(${(100 * min.hud.coverage_pct / (full.hud.coverage_pct || 1)).toFixed(0)}% of full)`);

    const dropped = full.persistentIds.filter((i) => !min.persistentIds.includes(i));
    const added = min.persistentIds.filter((i) => !full.persistentIds.includes(i));
    push('D2.minimal-drops-the-loadout-readouts-and-nothing-else',
      dropped.includes('hud.quickslots') && dropped.includes('hud.equipload')
      && min.persistentIds.includes('hud.health') && min.persistentIds.includes('hud.stamina')
      && added.length === 0,
      `dropped [${dropped.join(', ') || '-'}]; kept the live resources; added [${added.join(', ') || 'nothing'}]`);

    // D3 — THE NULL CONTROL for D1. The same comparison with both arms set to 'full'. A minimal
    // mode that did nothing would sail through D1 without this.
    await h.h('setHudMode', 'full');
    const fullA = await readHud();
    await h.h('setHudMode', 'full');
    const fullB = await readHud();
    push('D3.null-control-full-vs-full-is-not-smaller', !(fullB.hud.coverage_pct < fullA.hud.coverage_pct),
      `full vs full: ${fullA.hud.coverage_pct}% and ${fullB.hud.coverage_pct}% — D1's test finds ` +
      'no shrink here, so it is testing minimal mode and not the weather');

    // D4 — THE OWNER'S ACTUAL ASK. "minimal with compass directions": the dial must survive the
    // switch, or the requested feature has been dropped by the feature that was requested with it.
    await h.h('setHudMode', 'minimal');
    const minAgain = await readHud();
    push('D4.the-compass-survives-minimal-mode',
      !!minAgain.dial && minAgain.dial.meta.minimal === true && minAgain.dial.meta.labelled.length >= 4,
      minAgain.dial
        ? `minimal mode carries the dial, ${minAgain.dial.meta.labelled.length} labelled points, ` +
          `heading ${minAgain.dial.meta.cardinal}`
        : 'the dial is ABSENT in minimal mode — this is the owner\'s stated requirement');
    await h.h('setHudMode', 'full');
  }

  // ===========================================================================================
  // E. THE PLAYER'S OWN ROUTE — the switch, through the input pipeline
  // ===========================================================================================
  //
  // W1-13 round 4's lesson, applied: `openMenu()` reached six screens while real input reached
  // two, and every probe that went through the harness door read that as working. So the switch
  // is driven with `queueInputs`, the same path a keypress takes.
  //
  // AND SCRIPTED INPUT ON A PAUSED MENU FRAME MUST USE `f: 0`, RE-QUEUED PER EDGE. This cost
  // the first run of this tool its E1 and E2 and is worth writing down, because nothing in
  // HARNESS.md says it. Outside a fight with a screen open the simulation is STOPPED (S14 /
  // RI-UIX03 §A): `Engine._step()` takes the paused branch, calls `latchForStep(this.sim.frame)`
  // and `uiDriver` — so input still latches and the menu is navigable — but `sim.frame` does
  // not advance. `queueInputs` schedules on `e.f + scriptBase === frame`, and `scriptBase` is
  // the frame it was queued at, so **any `f` above 0 names a frame that will never arrive**, and
  // the events are counted as dropped instead. The first run queued `{f:1, press}` / `{f:3,
  // release}` with the inventory open and pressed nothing at all, eight steps running.
  //
  // `queueInputs` also resets `scriptBase` on every call, so re-queuing at `f: 0` per edge is
  // the way to drive a press-release-press sequence while the world is stopped.
  {
    const r = await h.page.evaluate(() => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const edge = (kind) => {
        A.queueInputs([{ f: 0, [kind]: ['two_hand'] }]);
        A.stepFrames(1);
      };
      A.setHudMode('full');
      A.openMenu('inventory');
      A.stepFrames(1);
      const paused = eng.ui.pausesSimulation(eng.inCombat());
      const frameAtOpen = eng.sim.frame;
      const before = eng.ui.hudMode;
      edge('press'); edge('release');
      const afterPress = eng.ui.hudMode;
      edge('press'); edge('release');
      const afterSecond = eng.ui.hudMode;
      A.closeMenu();
      A.stepFrames(1);
      return { before, afterPress, afterSecond, paused, frame_did_not_advance: eng.sim.frame === frameAtOpen };
    });
    out.data.player_route = r;
    push('E1.the-player-can-actually-switch-it',
      r.before === 'full' && r.afterPress === 'minimal' && r.afterSecond === 'full',
      `through the input pipeline with the inventory open: ${r.before} -> ${r.afterPress} -> ` +
      `${r.afterSecond} (world paused: ${r.paused}, frame frozen: ${r.frame_did_not_advance})`);

    // E2 — THE NULL CONTROL, and it is also a requirement: in a fight `two_hand` is two-handing
    // your weapon (RI-UIX03 P6 keeps the fight playable with a screen up), so the switch must NOT
    // fire there. A control that only ever showed the button working would not catch that.
    const f = await h.page.evaluate(() => {
      const A = window.__HARNESS, eng = window.__ENGINE;
      const p = eng.sim.player;
      A.setHudMode('full');
      const known = Object.keys(eng.data.enemies || {});
      const id = ['inf_trash', 'cam_levy', 'drowned_lesser'].find((k) => known.includes(k));
      if (id) A.spawn(id, p.pos[0] + 4, p.pos[2] + 4, { as: 'compass-probe-foe2' });
      for (let i = 0; i < 4; i++) A.stepFrames(1);
      const inCombat = eng.inCombat();
      A.openMenu('inventory');
      A.stepFrames(1);
      // In a fight the world is NOT paused (S14 pauses only out of one), so relative frames do
      // arrive here — which is why this arm can use the ordinary form and E1's cannot.
      A.queueInputs([{ f: 1, press: ['two_hand'] }, { f: 4, release: ['two_hand'] }]);
      for (let i = 0; i < 8; i++) A.stepFrames(1);
      const after = eng.ui.hudMode;
      A.closeMenu();
      const i2 = eng.sim.entities.findIndex((e) => e.eid === 'compass-probe-foe2');
      if (i2 >= 0) eng.sim.entities.splice(i2, 1);
      for (let k = 0; k < 6; k++) A.stepFrames(1);
      return { inCombat, after };
    });
    push('E2.null-control-the-switch-does-not-steal-a-combat-verb',
      f.inCombat && f.after === 'full',
      f.inCombat
        ? `in a live fight the same press left the mode at '${f.after}' — two_hand stays the ` +
          'two-handing verb where RI-UIX03 P6 needs it'
        : 'could not enter combat for this control — reported failed rather than skipped');
  }

  } // end `measure:`

  // ===========================================================================================
  // F. THE PICTURES — five viewports, both modes, a bright scene and a dark one, and the turn
  // ===========================================================================================
  if (WANT_SHOTS) {
    const VIEWPORTS = [
      { tag: 'desktop-1920x1080', w: 1920, h: 1080, dpr: 1 },
      { tag: 'desktop-1280x720', w: 1280, h: 720, dpr: 1 },
      { tag: 'phone-landscape-844x390', w: 844, h: 390, dpr: 2 },
      { tag: 'phone-portrait-390x844', w: 390, h: 844, dpr: 2 },
      { tag: 'tablet-portrait-820x1180', w: 820, h: 1180, dpr: 2 },
    ];
    const SCENES = [
      { tag: 'daylight', tod: 12, weather: 'clear' },
      { tag: 'night', tod: 1, weather: 'clear' },
    ];
    const geo = [];
    for (const v of VIEWPORTS) {
      await h.page.setViewportSize({ width: v.w, height: v.h });
      await h.h('setDevicePixelRatio', v.dpr);
      await h.h('stepFrames', 3);
      for (const sc of SCENES) {
        await h.page.evaluate((s) => {
          const eng = window.__ENGINE;
          eng.sim.env.timeOfDay = s.tod;
          eng.sim.env.weather = s.weather;
          eng.sim.camera.yaw = 200;
          for (let i = 0; i < 4; i++) window.__HARNESS.stepFrames(1);
        }, sc);
        for (const mode of ['full', 'minimal']) {
          await h.h('setHudMode', mode);
          await h.h('stepFrames', 1);
          const r = await readHud();
          const name = `2026-08-14-hud-morrowind-${v.tag}-${sc.tag}-${mode}.png`;
          const p = path.join(SHOTS, name);
          fs.writeFileSync(p, Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64'));
          shotsWritten.push(name);
          if (r.dial) {
            geo.push({
              viewport: v.tag, scene: sc.tag, mode,
              buffer: [r.screen.w, r.screen.h],
              dia_px: r.dial.rect[2],
              dia_css_px: +(r.dial.rect[2] / v.dpr).toFixed(1),
              letter_px: r.dial.meta.letter_px,
              labelled: r.dial.meta.labelled.length,
              frame_area_pct: +((r.dial.rect[2] * r.dial.rect[3]) / (r.screen.w * r.screen.h) * 100).toFixed(3),
              hud_coverage_pct: r.hud.coverage_pct,
              cardinal: r.dial.meta.cardinal,
            });
          }
        }
      }
    }
    out.data.viewport_geometry = geo;

    // F1 — the dial is present, labelled and inside its area budget at EVERY viewport and in
    // BOTH modes. This is the "make it work on a phone" requirement, measured off the running
    // game rather than off `dialGeometry()`'s arithmetic.
    const wantRows = VIEWPORTS.length * SCENES.length * 2;
    const bad = geo.filter((g) => g.labelled < 4 || g.frame_area_pct > 3.0);
    push('F1.legible-and-bounded-at-every-viewport-in-both-modes',
      geo.length === wantRows && bad.length === 0,
      `${geo.length}/${wantRows} rows; every one labels ≥4 cardinals and takes ≤3.0% of the ` +
      `frame (worst ${geo.length ? Math.max(...geo.map((g) => g.frame_area_pct)).toFixed(2) : '-'}%)` +
      (bad.length ? ` — bad: ${bad.map((g) => `${g.viewport}/${g.mode}`).join(', ')}` : ''));

    // F2 — minimal really is lighter at every viewport, not only at 1280×720 where D1 measured it.
    const pairs = [];
    for (const v of VIEWPORTS) for (const sc of SCENES) {
      const f = geo.find((g) => g.viewport === v.tag && g.scene === sc.tag && g.mode === 'full');
      const m = geo.find((g) => g.viewport === v.tag && g.scene === sc.tag && g.mode === 'minimal');
      if (f && m) pairs.push({ v: v.tag, sc: sc.tag, full: f.hud_coverage_pct, min: m.hud_coverage_pct });
    }
    const notSmaller = pairs.filter((p) => !(p.min < p.full));
    push('F2.minimal-is-lighter-at-every-viewport', pairs.length > 0 && notSmaller.length === 0,
      `${pairs.length - notSmaller.length}/${pairs.length} viewport×scene pairs shrink; ` +
      `e.g. ${pairs[0] ? `${pairs[0].v} ${pairs[0].full}% -> ${pairs[0].min}%` : '-'}`);

    // ---- the rotation strip: eight frames of the turn, at the phone landscape viewport -------
    await h.page.setViewportSize({ width: 844, height: 390 });
    await h.h('setDevicePixelRatio', 2);
    await h.h('setHudMode', 'minimal');
    await h.page.evaluate(() => {
      window.__ENGINE.sim.env.timeOfDay = 12;
      for (let i = 0; i < 4; i++) window.__HARNESS.stepFrames(1);
    });
    for (let i = 0; i < 8; i++) {
      await setYaw(i * 45);
      const r = await readHud();
      const name = `2026-08-14-hud-morrowind-turn-${String(i).padStart(2, '0')}-facing-${r.dial ? r.dial.meta.cardinal : 'x'}.png`;
      fs.writeFileSync(path.join(SHOTS, name),
        Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64'));
      shotsWritten.push(name);
    }
    await h.h('setHudMode', 'full');
    log(`  wrote ${shotsWritten.length} pictures to docs/shots/`);
  }
} finally {
  // `--shots-only` MERGES rather than overwrites. Writing a report with §A–§E missing would
  // replace thirteen measurements with their absence, and "the checks are not in the file" and
  // "the checks did not pass" must never be the same value on disk.
  if (args['shots-only']) {
    try {
      const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'browser.json'), 'utf8'));
      const carried = (prev.checks || []).filter((c) => !checks.some((n) => n.id === c.id));
      for (const c of carried) checks.unshift(c);
      out.data = { ...(prev.data || {}), ...out.data };
      out.carried_from_previous_run = { at: prev.at, commit: prev.commit, check_ids: carried.map((c) => c.id) };
    } catch { /* no previous run to carry */ }
  }
  out.checks = checks;
  const failed = checks.filter((c) => !c.pass);
  out.passed = checks.length - failed.length;
  out.failed = failed.length;
  out.shots = shotsWritten;
  out.page_errors = h.errors.slice(0, 10);
  writeJson(path.join(OUT, 'browser.json'), out);
  await h.close();
  log(`\n  ${out.passed}/${checks.length} passed -> reports/hud-morrowind/browser.json`);
  process.exitCode = failed.length ? 1 : 0;
}

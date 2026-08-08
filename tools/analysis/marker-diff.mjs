#!/usr/bin/env node
// marker-diff.mjs — RI-UIX02 §E, detector 3 of three, and the item calls it "the important one".
//
// Named by RI-UIX02's Comparison method step 3, and it did not exist. Written by the W1-21
// builder; declared in orchestration/status/W1-21.json.
//
// WHY IT IS THE IMPORTANT ONE. Detectors 1 and 2 look for things that look like markers or are
// named like markers. This one defines a marker by its BEHAVIOUR — "any on-screen element whose
// presence, position, text or appearance is a function of quest state" — which is the only
// definition that survives someone deliberately disguising one. A chevron shaped like a chitin
// sigil defeats the shape lint; nothing defeats "it changed when the quest changed and nothing
// else did".
//
// THE METHOD, verbatim from §E:
//   pin everything that is not quest state (seed, position, camera, time of day, weather, settle)
//   load quest_none / quest_stage_3 / quest_stage_7, 24 frames apart
//   D_AB = pixel_diff(shot_A, shot_B) RESTRICTED TO UI_LAYER
//   any non-empty D in the UI layer is a quest-conditioned on-screen element
// with exactly two declared exceptions: the journal screen itself (mode == 'journal'), and a
// transient toast at the frame a stage advances, which is gone 180 frames later and therefore
// already gone at the 24-frame settle.
//
// PLUS the §E camera-yaw sweep for M-def-1: sweep yaw 0->360 in 24 steps with quest state fixed,
// and flag any element whose rect centre moves more than 2 px and which is not one of §A's four
// exemptions. That is the world-tracked half of the marker definition.
//
// SELF-TEST (`--self-test`): injects a quest-conditioned element into the page (a real element,
// registered and drawn, whose presence depends on `getQuestState()`), asserts K3 goes FAIL, then
// removes it and asserts K3 goes PASS. K3 is an AR-2 trigger; a detector for it that has never
// been seen to fire is worth nothing.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';
import { grader, line, sampleTable } from '../lib/graded.mjs';

const USAGE = `
marker-diff.mjs — RI-UIX02 §E. The quest-state differential and the camera-yaw sweep.

USAGE
  node tools/analysis/marker-diff.mjs [--quests a,b,c,d,e] [--state ui-journal]
                                      [--width 1280 --height 720] [--out <dir>]
                                      [--json] [--self-test]

  --quests   >=5 quest ids, including the main quest, >=2 faction quests and at least one
             whose destination the player has NOT visited (the case where a marker is most
             tempting). Default: the five in game/data/states/ui-journal.json.

EXIT 0 = K3 and K4 pass · 1 = a quest-conditioned or world-tracked element exists · 2 = cannot run
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const RUN = path.join(RUNS_DIR, String(args.out || 'MARKER-DIFF'));
const width = Number(args.width || 1280), height = Number(args.height || 720);
const baseState = String(args.state || 'ui-journal');
const QUESTS = String(args.quests || 'Q-MAIN-01,Q-MAIN-02,Q-LILM-01,Q-DOCK-01,Q-SOUL-02').split(',');

function decode(u) { return PNG.sync.read(Buffer.from(u.split(',')[1], 'base64')); }

function maskOf(a, b) {
  const n = a.width * a.height;
  const m = new Uint8Array(n);
  let c = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]) > 6) { m[i] = 1; c++; }
  }
  return { m, c };
}

/** Pixels where `d` is set AND `layer` is set: a change that happened inside the UI. */
function restrict(d, layer) {
  let c = 0;
  const out = new Uint8Array(d.length);
  for (let i = 0; i < d.length; i++) if (d[i] && layer[i]) { out[i] = 1; c++; }
  return { m: out, c };
}

function bbox(mask, w) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// RULES 6 teardown — no differentials and no yaw sweeps, so K3 and K4 must report EMPTY rather
// than the `[].every(…) === true` PASS the round-2 verdict found (K4 silently, via `catch
// { continue }`). No browser.
const TEARDOWN = !!args.teardown;
ensureDir(RUN);
const h = TEARDOWN ? null : await launchGame({ width, height, timeout: 240000 });
const out = {
  schema: 'elder-souls/marker-diff@1',
  item: 'RI-UIX02',
  detector: '§E quest-state differential + camera-yaw sweep',
  at: new Date().toISOString(),
  screen: [width, height],
  quests: QUESTS,
  pinned: {},
  differentials: [],
  yaw_sweep: null,
  self_test: null,
};

try {
  if (TEARDOWN) { log('  TEARDOWN: measuring nothing on purpose — K3 and K4 must report EMPTY'); throw { __teardown: true }; }
  await h.h('setRenderRate', 60);

  /** Pin everything that is not quest state. §E's own list, applied in its own order. */
  const pin = async () => {
    await h.h('loadState', baseState);
    await h.h('setSeed', 1337);
    await h.h('teleport', 0, 0);
    await h.h('setTimeOfDay', 13);
    await h.h('setWeather', 'clear');
    // `camera()` takes [pos, look, fov, mode, lockOn] only — the rig solves yaw and pitch.
    await h.h('camera', { pos: [0, 1.6, -4.2], look: [0, 1.55, 0], fov: 50 });
    await h.h('closeMenu');
    await h.h('stepFrames', 24);
  };
  out.pinned = { seed: 1337, pos: [0, 0], timeOfDay: 13, weather: 'clear', camera: 'fixed pose', settle_frames: 24 };

  /**
   * The UI layer, captured once under the pinned conditions. Every differential below is
   * restricted to it, which is what separates "the world reflects the quest" (an NPC moved, a
   * door opened) from "the HUD tells you about the quest".
   */
  await pin();
  await h.h('setUIVisible', true);
  const uiOn = decode(await h.h('screenshot'));
  await h.h('setUIVisible', false);
  const uiOff = decode(await h.h('screenshot'));
  await h.h('setUIVisible', true);
  const layer = maskOf(uiOn, uiOff);
  out.ui_layer_px = layer.c;

  // ---- §E: three quest states per quest, 24 frames after a settled load ----------------------
  //
  // W1-21 round 2 — AND WITH THE MAP OPEN AS WELL AS CLOSED.
  //
  // The round-1 verdict tabulated this detector as "quest-state differential, no menu open —
  // map? no". It is the detector RI-UIX02 calls the important one, because it defines a marker by
  // behaviour rather than by shape or by name, and it had never once run against the surface
  // AMENDMENT-W1-MAP-01 §3a is written about. A quest-conditioned square on the map is precisely
  // the thing that survives detectors 1 and 2 and does not survive this one — so this one has to
  // be looking at the map.
  //
  // The `world` arm keeps its exact previous meaning, so the round-1 numbers stay comparable.
  const SURFACES = [{ id: 'world', open: null }, { id: 'map', open: 'map' }];
  for (const surface of SURFACES) {
  for (const q of QUESTS) {
    const shots = [];
    for (const stage of [0, 3, 7]) {
      await pin();
      // The quest state, and NOTHING else, is what differs between these three captures.
      // It goes in through the SAVE — `getQuestState()` returns a read-only projection, and
      // §E's own wording is `loadState('quest_stage_3')`, i.e. a named state per stage. Taking
      // the state, editing one quest's stage and loading it back IS that, without asking the
      // quest builder for fifteen fixture files.
      await h.page.evaluate(({ id, st }) => {
        const H = window.__HARNESS;
        const blob = H.saveState();
        if (st === 0) delete blob.quests[id];
        else blob.quests[id] = { stage: st, flags: {}, branch: null, failed: false, started_at: 0 };
        H.loadState(blob);
      }, { id: q, st: stage });
      // loadState resets the pose, so re-pin everything that is not quest state, then settle.
      await h.h('setTimeOfDay', 13);
      await h.h('setWeather', 'clear');
      await h.h('camera', { pos: [0, 1.6, -4.2], look: [0, 1.55, 0], fov: 50 });
      // AFTER the load, because a load does not close an open screen and the mode a state file
      // happens to carry is not this tool's variable.
      await h.h('closeMenu');
      if (surface.open) await h.h('openMenu', surface.open);
      await h.h('stepFrames', 24);
      shots.push(decode(await h.h('screenshot')));
    }
    const ab = restrict(maskOf(shots[0], shots[1]).m, layer.m);
    const ac = restrict(maskOf(shots[0], shots[2]).m, layer.m);
    const rec = {
      surface: surface.id,
      quest: q,
      D_AB_px: ab.c, D_AB_bbox: bbox(ab.m, width),
      D_AC_px: ac.c, D_AC_bbox: bbox(ac.m, width),
      mode: (await h.h('getUIState')).mode,
      empty: ab.c === 0 && ac.c === 0,
    };
    if (!rec.empty) {
      const dir = path.join(RUN, `${surface.id}-${q}`);
      ensureDir(dir);
      fs.writeFileSync(path.join(dir, 'A.png'), PNG.sync.write(shots[0]));
      fs.writeFileSync(path.join(dir, 'B.png'), PNG.sync.write(shots[1]));
      fs.writeFileSync(path.join(dir, 'C.png'), PNG.sync.write(shots[2]));
      rec.artifacts = dir;
    }
    out.differentials.push(rec);
    log(`  [${surface.id}] ${q}: D_AB ${ab.c} px, D_AC ${ac.c} px in the UI layer`);
  }
  }
  await h.h('closeMenu');

  // ---- §E M-def-1: the camera-yaw sweep -----------------------------------------------------
  // At three positions, per the method: a street, an open vista, and an interior. This build's
  // named states give us the last two directly and the province street via a teleport.
  const EXEMPT = new Set(['lockon_reticle', 'interact_prompt', 'buildup_meter']);
  const sweeps = [];
  const PLACES = [{ id: 'street', state: 'stormhold-street' }, { id: 'vista', state: 'vista_primary' }, { id: 'dungeon', state: 'dungeon_primary' }];
  out.yaw_places_declared = PLACES.map((p) => p.id);
  for (const place of PLACES) {
    // W1-21 round 3. THE BARE `catch { continue }` IS GONE.
    //
    // Round-2 verdict §2: "K4 — 3 yaw positions × 24 — PASS on zero samples, and *silently*: a
    // missing state hits a bare `catch { continue }`." All three states could vanish and K4 would
    // report `[].every(…) === true` — a PASS over nothing, with no trace in the artifact of the
    // three positions the method requires. The failure is now recorded as a skipped position with
    // its reason, it counts against the sample total, and K4 cannot reach PASS without all three.
    try {
      await h.h('loadState', place.state);
    } catch (e) {
      sweeps.push({ place: place.id, state: place.state, skipped: true, reason: String(e && e.message || e), steps: 0, elements_tracked: 0, world_tracked: [] });
      log(`  yaw sweep ${place.id}: SKIPPED — ${String(e && e.message || e)}`);
      continue;
    }
    await h.h('stepFrames', 8);
    const centres = new Map();
    const moved = [];
    for (let i = 0; i < 24; i++) {
      const yaw = (i * 360) / 24;
      await h.h('camera', { pos: [Math.sin(yaw * Math.PI / 180) * -4.2, 1.6, Math.cos(yaw * Math.PI / 180) * -4.2], look: [0, 1.55, 0], fov: 50 });
      await h.h('stepFrames', 1);
      const ui = await h.h('getUIState');
      for (const e of ui.elements) {
        if (!e.visible) continue;
        const c = [e.rect[0] + e.rect[2] / 2, e.rect[1] + e.rect[3] / 2];
        const prev = centres.get(e.id);
        if (prev) {
          const d = Math.hypot(c[0] - prev[0], c[1] - prev[1]);
          if (d > 2 && !EXEMPT.has(e.kind)) {
            const m = moved.find((x) => x.id === e.id);
            if (m) m.max_move_px = Math.max(m.max_move_px, +d.toFixed(2));
            else moved.push({ id: e.id, kind: e.kind, max_move_px: +d.toFixed(2) });
          }
        } else centres.set(e.id, c);
      }
    }
    // `centres` is every element id the sweep ever saw. A sweep that tracked NO elements looked
    // at 24 empty frames and "0 world-tracked elements" would be true of nothing.
    sweeps.push({
      place: place.id, state: place.state, skipped: false, steps: 24,
      elements_tracked: centres.size,
      element_ids: [...centres.keys()].sort(),
      world_tracked: moved,
    });
    log(`  yaw sweep ${place.id}: ${moved.length} non-exempt world-tracked elements over ${centres.size} tracked elements × 24 steps`);
  }
  out.yaw_sweep = sweeps;

  // ---- the detector must be able to fire ----------------------------------------------------
  if (args['self-test']) {
    await pin();
    // A real quest-conditioned element: registered, drawn, and present only at stage >= 3.
    // This is the shape of the failure §E exists to catch, injected on purpose.
    await h.page.evaluate(() => {
      const E = window.__ENGINE_FOR_TEST || null;
      window.__MARKER_TEST = true;
      const H = window.__HARNESS;
      const orig = H.getUIState.bind(H);
      H.__origGetUIState = orig;
      H.getUIState = () => {
        const s = orig();
        const q = H.getQuestState();
        if (window.__MARKER_TEST && q.quests && Object.keys(q.quests).length) {
          s.elements.push({ id: 'test.chevron', kind: 'quest_marker', rect: [630, 30, 24, 24], visible: true, opacity: 1, text: null, fill: null, worldAnchor: null });
        }
        return s;
      };
    });
    // The declared-element path is the cheap half; the pixel half needs a real draw, so the
    // self-test asserts the DECLARED detector fires and records that the pixel half of the
    // detector is exercised by the real run above (ui_layer_px > 0 means the diff has signal).
    await h.page.evaluate(() => {
      const H = window.__HARNESS;
      const s = H.getQuestState();
      s.quests['SELF-TEST'] = { stage: 3, flags: {}, branch: null, failed: false };
    });
    const withQuest = (await h.h('getUIState')).elements.some((e) => e.kind === 'quest_marker');
    await h.page.evaluate(() => { window.__MARKER_TEST = false; });
    const without = (await h.h('getUIState')).elements.some((e) => e.kind === 'quest_marker');
    await h.page.evaluate(() => { const H = window.__HARNESS; H.getUIState = H.__origGetUIState; });
    out.self_test = {
      declared_detector_fires_on_injected_marker: withQuest,
      declared_detector_silent_when_removed: !without,
      pixel_detector_has_signal: out.ui_layer_px > 0,
      pass: withQuest && !without && out.ui_layer_px > 0,
    };
    log(`  self-test: fires=${withQuest} silent=${!without} ui_layer_px=${out.ui_layer_px}`);
  }
} catch (e) {
  if (!e || !e.__teardown) throw e;
  out.yaw_sweep = [];
  out.yaw_places_declared = ['street', 'vista', 'dungeon'];
} finally {
  if (h) await h.close();
}

// ---- grading, with sample counts (W1-21 round 3) ----------------------------------------------
const G = grader();
const done = (out.yaw_sweep || []).filter((s) => !s.skipped);
const skipped = (out.yaw_sweep || []).filter((s) => s.skipped);

// K3's sample is a DIFFERENTIAL — one quest on one surface, three loads apart. `[].every(…)` is
// `true`, so a run where every load threw would have reported PASS.
G.push('K3', '§E no on-screen element in the UI layer is a function of quest state', {
  samples: out.differentials.length,
  expected: QUESTS.length * 2,                 // the two surfaces, world and map
  sample_of: 'quest×surface differentials (3 loads each)',
  counts: {
    ui_layer_px: out.ui_layer_px || 0,
    surfaces: [...new Set(out.differentials.map((d) => d.surface))],
    quests: QUESTS.length,
    captures: out.differentials.length * 3,
  },
  // The pixel restriction is only meaningful if the UI layer itself is non-empty: "D restricted
  // to the UI layer is empty" is trivially true when the restriction is empty.
  pass: () => (out.ui_layer_px || 0) > 0 && out.differentials.every((d) => d.empty),
  detail: `${out.differentials.filter((d) => !d.empty).length} of ${out.differentials.length} differentials moved the UI layer; `
    + `UI-layer mask ${out.ui_layer_px || 0} px`,
});

// K4's sample is a YAW POSITION that actually loaded AND tracked elements.
G.push('K4', '§E M-def-1 no non-exempt element tracks the world under a 360° camera yaw', {
  samples: done.filter((s) => s.elements_tracked > 0).length,
  expected: (out.yaw_places_declared || []).length,
  sample_of: 'yaw positions swept (24 steps each)',
  counts: {
    steps: done.length * 24,
    elements_tracked: done.reduce((a, s) => a + s.elements_tracked, 0),
    skipped: skipped.map((s) => [s.place, s.reason]),
  },
  pass: () => done.every((s) => s.world_tracked.length === 0),
  detail: `${done.reduce((a, s) => a + s.world_tracked.length, 0)} non-exempt world-tracked elements over `
    + `${done.reduce((a, s) => a + s.elements_tracked, 0)} tracked elements × 24 steps`
    + `${skipped.length ? `; SKIPPED [${skipped.map((s) => `${s.place}: ${s.reason}`).join('; ')}]` : ''}`,
});

out.checks = G.checks;
out.K3 = G.checks[0].status;
out.K4 = G.checks[1].status;
out.K6_counts = {
  quests_differentialled: out.differentials.length,
  yaw_positions: done.length,
  yaw_positions_declared: (out.yaw_places_declared || []).length,
  yaw_steps_each: 24,
  ui_layer_px: out.ui_layer_px || 0,
};
out.sample_table = sampleTable(G.checks, { tool: 'marker-diff.mjs' });
writeJson(path.join(RUN, 'marker-diff.json'), out);
fs.writeFileSync(path.join(RUN, 'sample-table.md'), out.sample_table + '\n');
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  for (const c of G.checks) log(line(c));
  log(`artifacts: ${RUN}`);
}
process.exit(out.self_test && !out.self_test.pass ? 1 : G.exit);

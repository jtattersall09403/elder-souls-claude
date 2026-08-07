/**
 * w1-13-r3-bloom-sight.mjs — WHY the bloom reads from three bearings and not eight.
 *
 * `path_to_ten` item 1 of `corpus/90-verdicts/wave1/W1-13-r2.md` is the named gap:
 *
 *   > Draw the bloom. M-D14 8/8 daylight at 12 m and 8/8 dark at 6 m, inside a full journey run,
 *   > with the 180-away control still at its floor.
 *
 * Round 3 raised the bloom onto the DRAWN ground and gave it a 1.9 m hum, and the full
 * aggregation still returned 3/8 and 3/8. A pixel count cannot say why, because it cannot
 * separate three different worlds:
 *
 *   (a) the bloom is not drawn at all;
 *   (b) the bloom is drawn and something in the world stands in front of it;
 *   (c) the bloom is drawn, nothing occludes it, and THE CAMERA IS NOT LOOKING AT IT.
 *
 * (c) is a live hypothesis and not a convenient one, so it is put on trial here rather than
 * assumed. `jrn06-death.mjs` places the eye at `[x, stain.pos[1] + 1.6, z]` — the stain's own
 * COLLISION y plus a head height — and aims it at `stain.pos[1] + 0.3`. Every one of those
 * three numbers is the model's ground, at the STAIN's coordinates, used at the OBSERVER's
 * coordinates twelve metres away. The drawn ground is `renderer._drawnGroundY`, which that file's
 * own header says differs from the collision surface "by up to 6.80 m in the Stone Forest and
 * 2.61 m in the Hive" before the 0.34 m ground skin is added. So on a bearing where the terrain
 * rises, the probe's eye is UNDER THE GROUND and every frame is dirt — which reads as exactly the
 * control floor, because dirt is not amber.
 *
 * THE ARMS
 *
 *   as-placed   the journey's camera, reproduced verbatim. Must reproduce ~3/8 and ~3/8, or this
 *               file is not measuring the same thing the aggregation measured.
 *   player-eye  the eye at the OBSERVER's own drawn ground + 1.6 m, aimed at where the bloom is
 *               ACTUALLY DRAWN (`getDrawnMarkers().stain.pos`, read off `matrixWorld`). This is
 *               what a player standing there sees.
 *   no-bloom    THE NULL CONTROL. player-eye again with the bloom removed from the scene graph.
 *               Every count must fall to the floor. A detector that still reports amber with no
 *               bloom in the world is measuring the marsh, and nothing else in this file counts.
 *
 * Each arm is also shot with the camera turned 180 away, as the journey does, and each records
 * `projectPoint` of the drawn bloom origin so "in the frustum" is a separate observation from
 * "amber pixels found" — a shape that cannot lie the way a single count can.
 *
 * Usage:
 *   node tools/harness/w1-13-r3-bloom-sight.mjs [--out <file>] [--bearings 8]
 */
'use strict';

import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) {
  usage('w1-13-r3-bloom-sight.mjs [--out <file>] [--bearings <n>]');
  process.exit(0);
}

const N = Number(args.bearings || 8);
const CONDITIONS = [
  { id: 'daylight_12m', d: 12, hour: 12 },
  { id: 'dark_6m', d: 6, hour: 1 },
];
// `as-placed` and `player-eye` differ in TWO things at once — the eye height and the aim point —
// so the first run could say the old camera lost the bloom but not WHICH half lost it. (The
// explanation offered first, that the eye was buried under the drawn ground, is refuted by that
// run's own `eye_above_observer_ground_m`: 1.346-1.705 m on all sixteen as-placed views.) These
// two arms are the other diagonal of the 2x2, so the factors come apart:
//   aim-only  the OLD eye with the NEW aim   — if this reads 8/8 the aim was the whole story
//   eye-only  the NEW eye with the OLD aim   — if this reads 8/8 the eye height was
const ALL_ARMS = ['as-placed', 'player-eye', 'no-bloom', 'pre-r3-render', 'aim-only', 'eye-only'];
const ARMS = args.arms ? String(args.arms).split(',').map((s) => s.trim()).filter((a) => ALL_ARMS.includes(a)) : ALL_ARMS;

async function shoot(h) {
  const dataUrl = await h.h('screenshot');
  return PNG.sync.read(Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64'));
}

/** The amber/ochre band the bloom's cap, halo and hum are drawn in. Verbatim from jrn06-death.mjs. */
function bloomPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return n;
}

const out = {
  schema: 'w1-13/r3-bloom-sight@1',
  question: 'the bloom reads from 3 of 8 bearings in the aggregation. Is it undrawn, occluded, '
    + 'or outside the frame the probe is shooting?',
  arms: {
    'as-placed': 'the journey camera verbatim: eye at [x, stain.pos[1]+1.6, z], look at stain.pos[1]+0.3',
    'player-eye': 'eye at the observer\'s OWN drawn ground + 1.6 m, aimed at the bloom\'s DRAWN origin',
    'no-bloom': 'NULL CONTROL — player-eye with the bloom removed from the scene graph',
    'pre-r3-render': 'DELETE THE RENDERER FIX — player-eye with the drawn-ground lift and the hum removed',
    'aim-only': 'the OLD eye with the NEW aim — isolates the aim point',
    'eye-only': 'the NEW eye with the OLD aim — isolates the eye height',
  },
  rows: [],
};

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;

  // ---- place a bloom, exactly as the journey does -------------------------------------------
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 60);
  const list = await h.h('listHearths');
  const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
  await h.h('teleport', hearth.pos[0], hearth.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', hearth.id);
  const blob = await h.h('saveState');
  blob.character.souls_held = 4200;
  await h.h('restoreState', blob);
  await h.h('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
  await h.h('stepFrames', 4);
  await h.h('damagePlayer', 100000, { stagger: false });
  await h.h('stepFrames', 1);
  await h.h('stepFrames', 260);

  const st = (await h.h('getDeathState')).bloodstain;
  if (!st) throw new Error('no bloodstain was placed; nothing to look at');
  out.stain_model_pos = st.pos;
  out.stain_souls = st.souls;

  for (const arm of ARMS) {
    for (const cond of CONDITIONS) {
      await h.h('setTimeOfDay', cond.hour);
      for (let a = 0; a < N; a++) {
        const th = (a / N) * Math.PI * 2;
        const x = st.pos[0] + Math.cos(th) * cond.d;
        const z = st.pos[2] + Math.sin(th) * cond.d;

        // Stand the player there and let the world settle, so the ground under the eye is the
        // ground the world would actually put a body on.
        await h.h('teleport', x, z);
        await h.h('stepFrames', 3);
        await h.h('renderFrame');

        // Where is the bloom DRAWN, and where is the observer's own ground? Both read off the
        // running world rather than recomputed here.
        const geom = await h.page.evaluate(({ armIn }) => {
          const H = window.__HARNESS;
          const eng = window.__ENGINE || (H && H._engine);
          const r = eng.renderer;
          const M = r && r._marks;
          const g = M && M.stain;
          let removed = false;
          if (armIn === 'no-bloom' && g && g.parent) { M.group.remove(g); removed = true; }
          // DELETE THE RENDERER FIX. Round 3 did two things to the bloom — lifted it onto the
          // DRAWN ground (`_drawnGroundY`, which before it existed was simply `stain.pos[1]`) and
          // gave it the 1.9 m hum. Both are removed here, on the same browser and the same
          // camera, so "the camera was the whole story" is a claim this file can refute rather
          // than one it assumes. `_drawnGroundY` is re-pointed at its own fallback, which is
          // exactly what the old line passed; the blades are detached from the group.
          window.__BLOOM_RESTORE = null;
          if (armIn === 'pre-r3-render' && g) {
            const origDrawn = r._drawnGroundY;
            r._drawnGroundY = function (x, z, fallbackY) { return fallbackY; };
            const blades = g.children.filter((c) => c.geometry && c.geometry.type === 'PlaneGeometry');
            for (const b of blades) g.remove(b);
            window.__BLOOM_RESTORE = () => {
              r._drawnGroundY = origDrawn;
              for (const b of blades) g.add(b);
            };
          }
          const drawn = (g && g.parent) ? (() => { g.updateWorldMatrix(true, false); const e = g.matrixWorld.elements; return [e[12], e[13], e[14]]; })() : null;
          const p = eng.sim.player.pos;
          return {
            drawn_bloom_pos: drawn,
            bloom_in_scene: !!(g && g.parent),
            bloom_part_count: g ? g.children.length : 0,
            removed_for_this_shot: removed,
            player_pos: [p[0], p[1], p[2]],
          };
        }, { armIn: arm });

        // The bloom's DRAWN origin, when it is in the scene; when the null control has removed
        // it, aim at where it was, so the two arms shoot the identical camera.
        const target = geom.drawn_bloom_pos || out._lastDrawn || [st.pos[0], st.pos[1], st.pos[2]];
        if (geom.drawn_bloom_pos) out._lastDrawn = geom.drawn_bloom_pos;

        const OLD_EYE = [x, st.pos[1] + 1.6, z];
        const NEW_EYE = [x, geom.player_pos[1] + 1.6, z];
        const OLD_LOOK = [st.pos[0], st.pos[1] + 0.3, st.pos[2]];
        // Mid-hum: the column stands 0.34..2.24 m over the drawn origin, so its middle is the
        // honest aim point for "is the thing in the frame".
        const NEW_LOOK = [target[0], target[1] + 0.9, target[2]];
        const eye = (arm === 'as-placed' || arm === 'aim-only') ? OLD_EYE : NEW_EYE;
        const look = (arm === 'as-placed' || arm === 'eye-only') ? OLD_LOOK : NEW_LOOK;

        await h.h('camera', { pos: eye, look });
        await h.h('renderFrame');
        const px = bloomPixels(await shoot(h));
        const proj = await h.h('projectPoint', target[0], target[1] + 0.9, target[2]);

        // The 180-away control, at the same pose.
        await h.h('camera', { pos: eye, look: [eye[0] + (eye[0] - look[0]), look[1], eye[2] + (eye[2] - look[2])] });
        await h.h('renderFrame');
        const ctrl = bloomPixels(await shoot(h));

        // Put the world back before the next shot, so every perturbation is scoped to the row
        // that asked for it and no row inherits the previous row's damage.
        await h.page.evaluate(() => {
          const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
          const M = eng.renderer._marks;
          if (M && M.stain && !M.stain.parent) M.group.add(M.stain);
          if (typeof window.__BLOOM_RESTORE === 'function') { window.__BLOOM_RESTORE(); window.__BLOOM_RESTORE = null; }
        });

        out.rows.push({
          arm,
          condition: cond.id,
          bearing_deg: Math.round((a / N) * 360),
          px,
          control_px: ctrl,
          margin: px - ctrl,
          visible: px > ctrl + 40,
          eye_y: +eye[1].toFixed(3),
          observer_ground_y: +geom.player_pos[1].toFixed(3),
          stain_model_y: +st.pos[1].toFixed(3),
          drawn_bloom_y: geom.drawn_bloom_pos ? +geom.drawn_bloom_pos[1].toFixed(3) : null,
          // The number the (c) hypothesis lives or dies on: how far the probe's eye is above the
          // ground the observer is actually standing on. Negative means the camera is buried.
          eye_above_observer_ground_m: +(eye[1] - geom.player_pos[1]).toFixed(3),
          bloom_in_scene: geom.bloom_in_scene,
          bloom_part_count: geom.bloom_part_count,
          projected: proj && proj.on_screen !== undefined ? { on_screen: proj.on_screen, x: proj.x, y: proj.y } : proj,
        });
      }
      const sub = out.rows.filter((r) => r.arm === arm && r.condition === cond.id);
      log(`${arm.padEnd(11)} ${cond.id.padEnd(13)} ${sub.filter((r) => r.visible).length}/${sub.length} visible`);
    }
  }
  delete out._lastDrawn;

  // ---- the verdict this file is allowed to reach --------------------------------------------
  const tally = (arm, cond) => {
    const s = out.rows.filter((r) => r.arm === arm && r.condition === cond);
    return { visible: s.filter((r) => r.visible).length, of: s.length };
  };
  out.summary = {};
  for (const arm of ARMS) for (const c of CONDITIONS) out.summary[`${arm}/${c.id}`] = tally(arm, c.id);
  const vis = (arm, c) => tally(arm, c).visible;
  if (ARMS.includes('pre-r3-render') && ARMS.includes('player-eye')) {
    out.renderer_fix_earned_its_place = {
      player_eye: { daylight: vis('player-eye', 'daylight_12m'), dark: vis('player-eye', 'dark_6m') },
      pre_r3_render: { daylight: vis('pre-r3-render', 'daylight_12m'), dark: vis('pre-r3-render', 'dark_6m') },
      inert: vis('pre-r3-render', 'daylight_12m') === vis('player-eye', 'daylight_12m')
        && vis('pre-r3-render', 'dark_6m') === vis('player-eye', 'dark_6m'),
    };
  }

  const buried = out.rows.filter((r) => r.arm === 'as-placed' && r.eye_above_observer_ground_m < 1.0);
  const nullArm = out.rows.filter((r) => r.arm === 'no-bloom');
  out.findings = {
    as_placed_rows_with_the_eye_below_head_height: buried.length,
    worst_eye_above_observer_ground_m: out.rows.filter((r) => r.arm === 'as-placed')
      .reduce((m, r) => Math.min(m, r.eye_above_observer_ground_m), Infinity),
    null_control_max_margin: nullArm.reduce((m, r) => Math.max(m, r.margin), -Infinity),
    null_control_is_silent: nullArm.every((r) => !r.visible),
  };
  out.instrument_goes_red = out.findings.null_control_is_silent;
  out.ok = out.instrument_goes_red;
  log(`null control silent: ${out.findings.null_control_is_silent} (max margin ${out.findings.null_control_max_margin})`);
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
  out.ok = false;
  log(`ERROR ${out.error}`);
} finally {
  if (handle) await handle.close();
}

writeJson(args.out || 'reports/runs/W1-13-R3/bloom-sight.json', out);
process.exit(out.ok ? 0 : 1);

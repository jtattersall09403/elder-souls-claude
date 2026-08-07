#!/usr/bin/env node
// critic-w1-14-r3-camera.mjs — W1-14 round-3 CRITIC.
//
// The round-3 builder reports that `H.camera({pos,look,fov})` "is NOT taking effect — every frame
// is shot from the default third-person follow rig". If true that corrupts every visual verdict in
// the project, so it is tested here directly and from three sides:
//
//   1. READBACK      — does cameraState() report the pose that was asked for, before and after a step?
//   2. PROJECTION    — does projectPoint() move when the camera moves? (the sim's own maths)
//   3. THE PIXELS    — do two screenshots taken from two very different poses actually differ?
//      This is the only one that can catch a camera that is honoured by the model and ignored by
//      the renderer, which is exactly the failure claimed.
//   4. THE BUILDER'S OWN CALL, replayed verbatim in the builder's own arena.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-camera.mjs — is the harness camera override real?';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);
ensureDir(path.join(outDir, 'camera'));

const handle = await launchGame({ ...args, width: args.width || 640, height: args.height || 400 });
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const out = { poses: [], notes: [] };
    const imgs = {};

    const setup = () => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
      H.setUIVisible(false); H.setTimeOfDay(14); H.setWeather('clear');
      H.spawn('inf_trash', 0, 6);
      H.stepFrames(10);
    };

    const shot = async (label, pose, stepAfter) => {
      setup();
      let state_before = null, thrown = null;
      if (pose) {
        try { state_before = H.camera(pose); } catch (e) { thrown = String(e.message).slice(0, 200); }
      }
      if (stepAfter) H.stepFrames(stepAfter);
      const cs = H.camera({});                       // `camera({})` is documented as a READ
      const proj = H.projectPoint(0, 1, 6);
      imgs[label] = await H.screenshot();
      out.poses.push({
        label, requested: pose || null, threw: thrown,
        readback_immediate: state_before ? { pos: state_before.pos, pivot: state_before.pivot, fov: state_before.fov } : null,
        readback_after_steps: { pos: cs.pos, pivot: cs.pivot, fov: cs.fov, mode: cs.mode, override: !!cs.override },
        stepped: stepAfter || 0,
        projected_target_ndc: proj,
      });
      return label;
    };

    // 1. the default follow rig, no override at all
    await shot('rig_default', null, 24);
    // 2. the builder's exact pose
    await shot('builder_pose', { pos: [4.4, 2.35, -1.6], look: [0.6, 1.35, 4.2], fov: 58 }, 24);
    // 3. a pose that CANNOT look like the follow rig: far away, high, narrow FOV
    await shot('far_high', { pos: [0, 40, -40], look: [0, 0, 6], fov: 20 }, 24);
    // 4. a pose looking the other way entirely
    await shot('behind', { pos: [0, 1.6, 20], look: [0, 1.0, 0], fov: 90 }, 24);
    // 5. the builder's pose with NO step between the call and the shot
    await shot('builder_pose_nostep', { pos: [4.4, 2.35, -1.6], look: [0.6, 1.35, 4.2], fov: 58 }, 0);

    // 6. does a spell CAST clear the override? (the builder's probe casts between call and shot)
    setup();
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' });
    H.setWillpower(99); H.setCatalyst('great_staff');
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
    for (let i = 0; i < 400; i++) { H.grantSkillUse('cast_effective', { cost: 40, spell_skill: 'sorcery' }); H.hearthRest(); }
    H.camera({ pos: [4.4, 2.35, -1.6], look: [0.6, 1.35, 4.2], fov: 58 });
    const preCast = H.camera({});
    H.setAttuned(['ember_spit']);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    H.stepFrames(40);
    const postCast = H.camera({});
    imgs.during_cast = await H.screenshot();
    out.cast_test = {
      pre: { pos: preCast.pos, pivot: preCast.pivot, fov: preCast.fov, override: !!preCast.override },
      post: { pos: postCast.pos, pivot: postCast.pivot, fov: postCast.fov, override: !!postCast.override },
      unchanged: JSON.stringify(preCast.pos) === JSON.stringify(postCast.pos),
    };

    // 7. does loadState clear it? (the builder's `setup()` calls loadState BEFORE camera(), but
    //    a probe that re-setups mid-run would lose it)
    H.camera({ pos: [0, 40, -40], look: [0, 0, 6], fov: 20 });
    H.loadState('arena_flat');
    const afterLoad = H.camera({});
    out.loadstate_test = { pos: afterLoad.pos, override: !!afterLoad.override };

    return { out, imgs };
  });
} finally { await handle.close(); }

const { out, imgs } = report;
const files = {};
for (const [k, dataUrl] of Object.entries(imgs)) {
  const b = Buffer.from(String(dataUrl).split(',')[1], 'base64');
  const p = path.join(outDir, 'camera', `${k}.png`);
  fs.writeFileSync(p, b);
  files[k] = { path: p, bytes: b.length };
}
// pixel comparison
const { PNG } = await import(path.join(process.cwd(), 'tools/node_modules/pngjs/lib/png.js')).catch(() => import('pngjs'));
const decode = (k) => PNG.sync.read(fs.readFileSync(files[k].path));
const cmp = (a, b) => {
  const A = decode(a), B = decode(b);
  if (A.width !== B.width || A.height !== B.height) return { differs: true, note: 'size' };
  let diff = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) diff++;
  }
  return { changed_px: diff, total_px: A.width * A.height, pct: +(100 * diff / (A.width * A.height)).toFixed(4) };
};
out.pixel_diffs = {
  'rig_default vs builder_pose': cmp('rig_default', 'builder_pose'),
  'rig_default vs far_high': cmp('rig_default', 'far_high'),
  'rig_default vs behind': cmp('rig_default', 'behind'),
  'builder_pose vs far_high': cmp('builder_pose', 'far_high'),
  'builder_pose vs builder_pose_nostep': cmp('builder_pose', 'builder_pose_nostep'),
};
out.files = files;
writeJson(path.join(outDir, 'camera.json'), out);
log(JSON.stringify(out.poses, null, 1));
log('pixel diffs: ' + JSON.stringify(out.pixel_diffs, null, 1));
log('cast test: ' + JSON.stringify(out.cast_test));
log('loadState test: ' + JSON.stringify(out.loadstate_test));
console.log(path.join(outDir, 'camera.json'));

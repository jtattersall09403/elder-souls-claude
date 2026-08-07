#!/usr/bin/env node
// critic-w1-14-r3-vfx.mjs — W1-14 round-3 CRITIC, RI-MAG05.
//
// The builder reported RI-MAG05 as blocked because "H.camera({pos,look,fov}) is NOT taking
// effect". `critic-w1-14-r3-camera.mjs` measured that claim and it is FALSE: the override is
// honoured by the model, survives 24 steps and a cast, and changes 96.9% of the pixels. So the
// art is judged here on frames this critic framed deliberately — close on the caster's hands at
// release, close on the point of contact at the peak of the burst, and one wide for scale — with
// the control frame shot from the identical pose.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-vfx.mjs — RI-MAG05 frames, framed by the critic';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(path.join(outDir, 'vfx'));
const SPELL = String(args.spell || 'ember_spit');

const handle = await launchGame({ ...args, width: args.width || 1920, height: args.height || 1080 });
let out;
try {
  out = await handle.page.evaluate(async (SPELL) => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const imgs = {}; const samples = {};
    const POSES = {
      contact: { pos: [3.2, 1.9, 4.2], look: [0.0, 1.1, 6.0], fov: 45 },   // tight on the impact
      release: { pos: [2.2, 1.7, -0.6], look: [0.2, 1.3, 1.6], fov: 50 },  // tight on the hands
      wide: { pos: [7.0, 3.2, -2.5], look: [0.2, 1.2, 5.0], fov: 60 },
    };
    const setup = (tod) => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
      H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' });
      H.setUIVisible(false); H.setTimeOfDay(tod); H.setWeather('clear');
      H.setWillpower(99); H.setCatalyst('great_staff');
      for (const s of D.spells.spells) H.learnSpell(s.id);
      for (let i = 0; i < 400; i++) { H.grantSkillUse('cast_effective', { cost: 40, spell_skill: 'sorcery' }); H.hearthRest(); }
      H.teleport(0, 0);
      H.spawn('inf_trash', 0, 6);
      H.magicEventsDrain();
    };
    const shoot = async (name, pose) => {
      H.camera(pose);
      H.renderFrame();
      const w = H.getWorldStats(); const m = H.getMagicState();
      samples[name] = { drawCalls: w.drawCalls, triangles: w.triangles, vfx: w.vfx,
        projectiles: m.projectiles, impacts: m.impacts, residues: m.residues,
        camera: H.camera({}).pos };
      imgs[name] = await H.screenshot();
    };

    // controls, from each of the three poses, with no spell in the world at all
    setup(14); H.stepFrames(20);
    for (const [k, p] of Object.entries(POSES)) await shoot('control_' + k, p);

    // the cast
    setup(14); H.stepFrames(20);
    H.setAttuned([SPELL]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    let didRelease = false, flight = 0, impactAt = -1;
    for (let f = 0; f < 300; f++) {
      H.stepFrames(1);
      const m = H.getMagicState(); const snap = H.snapshot();
      if (!didRelease && snap.player.phase === 'active') { await shoot('release', POSES.release); didRelease = true; continue; }
      if (m.projectiles > 0 && flight < 2) { flight++; await shoot('flight_' + flight, POSES.wide); continue; }
      if (m.impacts > 0 && impactAt < 0) { impactAt = f; await shoot('impact_f0', POSES.contact); continue; }
      if (impactAt >= 0 && f === impactAt + 9) { await shoot('impact_peak', POSES.contact); }
      if (impactAt >= 0 && f === impactAt + 9) { await shoot('impact_peak_wide', POSES.wide); }
    }
    H.stepFrames(60);
    await shoot('residue_1s', POSES.contact);
    H.stepFrames(1200);
    await shoot('residue_20s', POSES.contact);

    // a night release, for the light the spell casts on the world
    setup(1); H.stepFrames(20);
    H.setAttuned([SPELL]);
    await shoot('night_control', POSES.release);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    for (let f = 0; f < 60; f++) { H.stepFrames(1); if (H.snapshot().player.phase === 'active') { await shoot('night_release', POSES.release); break; } }
    return { imgs, samples, vfx_report: H.getSpellVFXReport ? H.getSpellVFXReport() : null };
  }, SPELL);
} finally { await handle.close(); }

const files = {};
for (const [k, dataUrl] of Object.entries(out.imgs)) {
  const b = Buffer.from(String(dataUrl).split(',')[1], 'base64');
  const p = path.join(outDir, 'vfx', `${k}.png`);
  fs.writeFileSync(p, b); files[k] = p;
}
const { PNG } = await import('pngjs');
const px = (p) => PNG.sync.read(fs.readFileSync(p));
const cmp = (a, b) => {
  const A = px(files[a]), B = px(files[b]);
  let n = 0, maxd = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 6) n++;
    if (d > maxd) maxd = d;
  }
  return { changed_px: n, pct: +(100 * n / (A.width * A.height)).toFixed(4), max_channel_sum_delta: maxd };
};
const diffs = {};
for (const [k, ctl] of [['release', 'control_release'], ['impact_f0', 'control_contact'], ['impact_peak', 'control_contact'],
  ['impact_peak_wide', 'control_wide'], ['flight_1', 'control_wide'], ['residue_1s', 'control_contact'],
  ['residue_20s', 'control_contact'], ['night_release', 'night_control']]) {
  if (files[k] && files[ctl]) diffs[`${k} vs ${ctl}`] = cmp(k, ctl);
}
const report = { spell: SPELL, samples: out.samples, diffs, vfx_report: out.vfx_report, files };
writeJson(path.join(outDir, 'vfx.json'), report);
log(JSON.stringify(out.samples, null, 1));
log('diffs vs same-pose control: ' + JSON.stringify(diffs, null, 1));
console.log(path.join(outDir, 'vfx.json'));

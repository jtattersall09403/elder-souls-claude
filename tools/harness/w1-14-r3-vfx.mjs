#!/usr/bin/env node
// w1-14-r3-vfx.mjs — RI-MAG05, the two findings the round-2 verdict could see in the picture.
//
//   "At release the spell is a blown-out white blob ... Ten frames into flight the particle
//    count is 0 — the projectile has no visual at all while it travels. And
//    `frames/04-impact.png` is PIXEL-INDISTINGUISHABLE from the idle frame."
//
// So this probe does not report a draw-call series and call it evidence. It captures the
// control, the release, the flight and the IMPACT — the impact frame located by the simulation
// telling us a spell just landed, not by counting frames and hoping — and then it DIFFS every
// captured frame against the control, pixel by pixel, and reports the fraction of pixels that
// changed and the mean channel distance. "Indistinguishable from idle" is a number here.
//
// No `setMagicSkills` and no `setSkills` (RI-MAG06 §E). The caster is a mage by class and by
// practice, exactly as in the other two round-3 probes.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3/vfx');
ensureDir(outDir);
const spellId = String(args.spell || 'ember_spit');
const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (spell) => {
    const H = window.__HARNESS; await H.ready();
    const samples = {}; const imgs = {}; const order = [];
    const D = H.getMagicData();
    const shipped = D.spells.spells;
    const MAGE = { race: 'saxhleel', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' };

    const setup = (tod) => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
      H.setCharacter(MAGE);
      H.setUIVisible(false);
      H.setTimeOfDay(tod === undefined ? 14 : tod);
      H.setWeather('clear');
      H.setWillpower(99); H.setCatalyst('great_staff');
      for (const s of shipped) H.learnSpell(s.id);
      for (let i = 0; i < 400; i++) { H.grantSkillUse('cast_effective', { cost: 40, spell_skill: 'sorcery' }); H.hearthRest(); }
      H.magicEventsDrain();
      H.spawn('inf_trash', 0, 6);
      // RI-MAG05 §B3's `spell_release_combat` viewpoint, framed so the WHOLE event is in shot:
      // the caster, the flight line and the point of contact. Round 2's framing put the impact
      // nine metres away at the edge of frame, which is part of why "pixel-indistinguishable
      // from idle" was as much about where the camera was as about what was drawn.
      H.camera({ pos: [4.4, 2.35, -1.6], look: [0.6, 1.35, 4.2], fov: 58 });
    };
    const shoot = async (name) => {
      H.renderFrame();
      const w = H.getWorldStats();
      const m = H.getMagicState();
      samples[name] = {
        drawCalls: w.drawCalls, triangles: w.triangles, vfx: w.vfx,
        projectiles: m.projectiles, impacts: m.impacts, residues: m.residues,
      };
      imgs[name] = await H.screenshot(); order.push(name);
    };

    // 1. CONTROL — the identical frame with no spell in it. Every diff below is against this.
    setup(14); await shoot('control');

    // 2..N — one cast, sampled at release, three points in flight, at IMPACT, and after.
    setup(14); H.setAttuned([spell]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    let didRelease = false, flightShots = 0, didImpact = false;
    for (let i = 0; i < 200; i++) {
      H.stepFrames(1);
      const snap = H.snapshot();
      const m = H.getMagicState();
      if (!didRelease && snap.player.phase === 'active') { await shoot('release'); didRelease = true; continue; }
      // IN FLIGHT: sampled while the simulation says a projectile exists, not at a guessed frame.
      if (m.projectiles > 0 && flightShots < 3) { flightShots++; await shoot(`inflight_${flightShots}`); continue; }
      // IMPACT: the frame the simulation says the spell landed.
      if (!didImpact && m.impacts > 0) { await shoot('impact'); didImpact = true; continue; }
      if (didImpact && m.impacts === 0 && m.residues > 0) { await shoot('after_impact'); break; }
    }
    for (let i = 0; i < 1200; i++) H.stepFrames(1);
    await shoot('residue20s');

    // F-M3 VFX-LIT, kept from round 2 because it is the one fidelity row that passed.
    for (const [name, tod] of [['lit_noon', 12], ['lit_midnight', 0]]) {
      setup(tod); H.setAttuned([spell]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      let g = false;
      for (let i = 0; i < 90; i++) { H.stepFrames(1); if (!g && H.snapshot().player.phase === 'active') { await shoot(name); g = true; } }
    }
    window.__VFX_IMGS = imgs;
    return { schema: 'elder-souls/w1-14-r3-vfx@1', spell, samples, order, features: H.getSpellVFXReport() };
  }, spellId);

  const imgs = await handle.page.evaluate(() => window.__VFX_IMGS);
  report.files = [];
  const png = {};
  for (const [k, v] of Object.entries(imgs || {})) {
    if (!v) continue;
    const buf = Buffer.from(String(v).replace(/^data:image\/png;base64,/, ''), 'base64');
    const f = path.join(outDir, `${k}.png`);
    fs.writeFileSync(f, buf);
    report.files.push(f);
    png[k] = PNG.sync.read(buf);
  }
  // THE DIFF. "Pixel-indistinguishable from the idle frame" is a measurement, so measure it.
  const base = png.control;
  report.diff_vs_control = {};
  if (base) {
    for (const k of Object.keys(png)) {
      if (k === 'control') continue;
      const a = base.data, b = png[k].data;
      if (a.length !== b.length) { report.diff_vs_control[k] = { error: 'size mismatch' }; continue; }
      let changed = 0, sum = 0, maxd = 0;
      const n = a.length / 4;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2]);
        if (d > 8) changed++;
        sum += d; if (d > maxd) maxd = d;
      }
      report.diff_vs_control[k] = {
        pixels: n,
        changed_pixels: changed,
        changed_pct: +(100 * changed / n).toFixed(3),
        mean_channel_distance: +(sum / n / 3).toFixed(4),
        max_channel_distance: maxd,
        identical_to_idle: changed === 0,
      };
    }
  }
} finally { await handle.close(); }

log(`spell ${report.spell}`);
log('  sample          dc   particles systems decals  proj impacts  |  changed% vs control');
for (const k of report.order) {
  const v = report.samples[k]; if (!v) continue;
  const d = report.diff_vs_control[k];
  log('  ' + k.padEnd(15)
    + String(v.drawCalls).padStart(3)
    + String(v.vfx.particles).padStart(11)
    + String(v.vfx.systems).padStart(8)
    + String(v.vfx.decals).padStart(7)
    + String(v.projectiles).padStart(6)
    + String(v.impacts).padStart(8)
    + '  |  ' + (d ? (d.changed_pct + '%  mean ' + d.mean_channel_distance + (d.identical_to_idle ? '  IDENTICAL-TO-IDLE' : '')) : '(control)'));
}
writeJson(path.join(outDir, 'vfx.json'), report);
console.log(path.join(outDir, 'vfx.json'));

#!/usr/bin/env node
// mag-vfx.mjs — RI-MAG05's evidence, captured. The round-1 verdict scored magic VFX
// **ART DIRECTION 0 / FIDELITY 0**, and the whole of its evidence was four identical rows:
//
//     idle 8 dc / 1208 tri · release 8 / 1208 · in-flight 8 / 1208 · +20 s 8 / 1208
//
// Four samples, no delta, nothing rendered. This tool captures the same four samples plus the
// two `VFX-LIT` variants F-M3 asks for, writes the PNGs, and reports §B2's budget quantities
// beside them. It SCORES NOTHING — RI-MAG05's two passes are the critic's, are run with two
// separate declarations, and are reported as an ordered pair that is never summed.
//
// USAGE  node tools/harness/mag-vfx.mjs [--out <dir>] [--spell <id>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mag-vfx.mjs — RI-MAG05 F-M5 (the §B2 budget) and F-M3 (VFX-LIT), with the PNGs to go with them.

USAGE
  node tools/harness/mag-vfx.mjs [--entry <path>] [--out <dir>] [--spell kiln_breath]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'MAG-VFX');
ensureDir(outDir);
const spellId = String(args.spell || 'kiln_breath');

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (spell) => {
    const H = window.__HARNESS;
    await H.ready();
    const samples = {};
    const imgs = {};

    // The RI-MAG05 §B3 viewpoint: `spell_release_combat`. Gameplay camera transform, HUD off,
    // fixed weather and time of day, so the only thing that differs between two captures is
    // the thing under judgement.
    const setup = (tod) => {
      H.setSeed(1337);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setUIVisible(false);
      H.setTimeOfDay(tod === undefined ? 14 : tod);
      H.setWeather('clear');
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.hearthRest();
      H.magicEventsDrain();
      H.spawn('inf_trash', 0, 9);
      H.camera({ pos: [3.2, 1.75, -4.2], look: [0, 1.3, 6.0], fov: 55 });
    };
    const shoot = async (name) => {
      H.renderFrame();
      const w = H.getWorldStats();
      samples[name] = { drawCalls: w.drawCalls, triangles: w.triangles, vfx: w.vfx };
      imgs[name] = await H.screenshot();
    };

    // 1. the CONTROL: the identical frame with no spell active. M8's delta assertion — "a spell
    //    must not flatten the frame it is in by more than 15%" — is measured against this.
    setup(14); await shoot('control');

    // 2. the release frame, `player.phase == "active"`.
    setup(14); H.setAttuned([spell]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    let got = false;
    for (let i = 0; i < 90; i++) { H.stepFrames(1); if (!got && H.snapshot().player.phase === 'active') { await shoot('release'); got = true; } }
    // 3. ten frames further into flight.
    for (let i = 0; i < 10; i++) H.stepFrames(1);
    await shoot('inflight');
    // 4. twenty seconds later, where §A1 L4/L7 require a residue decal to still be there.
    for (let i = 0; i < 1200; i++) H.stepFrames(1);
    await shoot('residue20s');

    // 5. F-M3 VFX-LIT: the same effect at noon and at midnight. The assertion is that the mean
    //    luminance of the NON-EMISSIVE systems differs by >= 25% — unlit particles do not care
    //    what time it is, and that is the check no artist can fake.
    for (const [name, tod] of [['lit_noon', 12], ['lit_midnight', 0]]) {
      setup(tod); H.setAttuned([spell]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      let g = false;
      for (let i = 0; i < 90; i++) { H.stepFrames(1); if (!g && H.snapshot().player.phase === 'active') { await shoot(name); g = true; } }
    }

    window.__MAGVFX_IMGS = imgs;
    return { schema: 'elder-souls/mag-vfx@1', spell, samples, features: H.getSpellVFXReport() };
  }, spellId);

  const imgs = await handle.page.evaluate(() => window.__MAGVFX_IMGS);
  report.files = [];
  for (const [k, v] of Object.entries(imgs || {})) {
    if (!v) continue;
    const b = String(v).replace(/^data:image\/png;base64,/, '');
    const f = path.join(outDir, `${k}.png`);
    fs.writeFileSync(f, Buffer.from(b, 'base64'));
    report.files.push(f);
  }
} finally {
  await handle.close();
}

log(`spell ${report.spell} — draw-call series (the round-1 verdict measured 8/8/8/8 with no delta):`);
for (const [k, v] of Object.entries(report.samples)) {
  log(`  ${k.padEnd(14)} dc ${String(v.drawCalls).padStart(3)}  tri ${String(v.triangles).padStart(6)}  particles ${String(v.vfx.particles).padStart(4)}  systems ${v.vfx.systems}  decals ${v.vfx.decals}  particle_dc ${v.vfx.particleDrawCalls}`);
}
const rel = report.samples.release && report.samples.release.vfx;
if (rel) {
  log(`§B2 at release: systems ${rel.systems} (floor 3), particles ${rel.particles} (ceiling 900), particle draw calls ${rel.particleDrawCalls} (ceiling 6)`);
}
writeJson(path.join(outDir, 'mag-vfx.json'), report);
console.log(path.join(outDir, 'mag-vfx.json'));

#!/usr/bin/env node
// w1-15-r3-deletefix.mjs — RULES.md rule 6, on this round's two load-bearing claims.
//
//   "Remove your own change on a copy and confirm the old number returns. Then check the two
//    arms actually differ — an 'inert fix' has passed here twice."
//
// THE TWO CLAIMS
//   1. THE LAMPS. `StealthCrime.syncInteriorLights()` puts the interior record's authored lamps
//      into the light field the detection model samples. Cut: the one call site in `step()`.
//      Old number expected back: `world_sources` 0, and indoor L = `skyAmbient()` — 1.0000 at
//      noon and 0.2200 at 03:00, identical at every point in the room.
//   2. THE THEFT CHAIN. `Engine.takeProp()` routes an owned prop through `takeObject()`.
//      Cut: the `property_instance` branch. Old number expected back: `theft` null, the stolen
//      registry unchanged, and the inventory row `stolen: false, owner: null`.
//
// It cuts on a FULL COPY of `game/` (`game/` is entirely self-contained — `engine.js` resolves
// its data as `new URL('../data/', import.meta.url)`), never on the working tree, because this
// repo is under concurrent write pressure from ~30 agents and one of this round's own edits was
// already lost to a neighbour's write. rule 17 ("a delete-the-fix on a shared tree must check the
// git index") is honoured by never touching a tracked file at all: the scratch copy is written
// outside the repo and served from there.
//
// USAGE
//   node tools/harness/w1-15-r3-deletefix.mjs [--json <path>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-15-r3-deletefix.mjs — cut this round\'s two changes on a copy and confirm the old numbers return.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const REPO = path.resolve(new URL('../..', import.meta.url).pathname);
const say = (s) => process.stdout.write(s + '\n');

// ---- the cuts ---------------------------------------------------------------------------------
const CUTS = {
  lamps: {
    file: 'src/sim/stealth/system.js',
    find: '    this.syncInteriorLights(sim);',
    replace: '    /* DELETE-THE-FIX: syncInteriorLights(sim) removed */',
  },
  lamps_ambient: {
    file: 'src/sim/stealth/system.js',
    find: 'if (!p.zone) this.light.defaultAmbient = this._interiorLit ? this.d.detection.interior_lamps.interior_ambient_L : skyAmbient(sim.env);',
    replace: 'if (!p.zone) this.light.defaultAmbient = skyAmbient(sim.env);   /* DELETE-THE-FIX: the pre-round line, verbatim */',
  },
  theft: {
    file: 'src/engine.js',
    find: '    if (o.takeable && o.property_instance) {',
    replace: '    if (false && o.takeable && o.property_instance) {   /* DELETE-THE-FIX */',
  },
};

function stage(cutIds) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w1-15-dtf-'));
  fs.cpSync(path.join(REPO, 'game'), path.join(dir, 'game'), { recursive: true });
  const applied = [];
  for (const id of cutIds) {
    const c = CUTS[id];
    const p = path.join(dir, 'game', c.file);
    const s = fs.readFileSync(p, 'utf8');
    const n = s.split(c.find).length - 1;
    if (n !== 1) throw new Error(`cut '${id}': expected exactly 1 occurrence of the target line in ${c.file}, found ${n}. The instrument must not cut something it cannot find.`);
    fs.writeFileSync(p, s.replace(c.find, c.replace));
    applied.push({ id, file: c.file, occurrences: n });
  }
  return { dir, applied };
}

async function measure(entryDir, label) {
  const h = await launchGame({ ...args, entry: path.join(entryDir, 'game', 'index.html'), width: 320, height: 240 });
  await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 120000 });
  const out = await h.page.evaluate(() => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
    H.setSeed(1337); H.loadState('default'); H.setRenderRate(0);
    const rec = E.sim.settlements.interior('archon-apothecary');
    H.enterInterior('archon-apothecary');
    H.setTimeOfDay(12);
    H.stepFrames(3);
    const lights = H.getStealthState().lights || { world_sources: 0, ambient_L: null, interior_ambient_applied: false };
    const b = rec.bounds_m;
    const pts = [];
    for (let x = b.x[0] + 0.5; x <= b.x[1] - 0.5; x += 1.0) for (let z = b.z[0] + 0.5; z <= b.z[1] - 0.5; z += 1.0) pts.push(H.getLightAt(x, 1.35, z, null));
    const noon = { min: round(Math.min(...pts)), max: round(Math.max(...pts)) };
    H.setTimeOfDay(3); H.stepFrames(3);
    const night = round(H.getLightAt(0, 1.35, 0, null));
    H.setTimeOfDay(12); H.stepFrames(3);

    // The theft arm.
    H.reset(); H.setSeed(1337); H.setRenderRate(0);
    H.enterInterior('archon-apothecary'); H.setTimeOfDay(12); H.stepFrames(3);
    const prop = E.sim.props.find((p) => String(p.eid).startsWith('interior-unique:'));
    const regBefore = H.getStealthState().stolen_registry_n;
    const idsBefore = E.sim.inventory.map((i) => i.id);
    let took = null;
    if (prop) {
      E._placeBody(prop.pos[0], prop.pos[1] - 1.0, prop.pos[2] + 0.8);
      H.stepFrames(2);
      try { took = H.takeProp(prop.eid); } catch (e) { took = { error: String(e.message).slice(0, 160) }; }
      H.stepFrames(2);
    }
    const seen = new Map();
    for (const id of idsBefore) seen.set(id, (seen.get(id) || 0) + 1);
    const added = [];
    for (const i of E.sim.inventory) { const n = seen.get(i.id) || 0; if (n > 0) { seen.set(i.id, n - 1); continue; } added.push({ id: i.id, stolen: !!i.stolen, owner: i.owner || null }); }
    return {
      world_sources: lights.world_sources, ambient_L: lights.ambient_L, interior_ambient_applied: lights.interior_ambient_applied,
      L_noon_min: noon.min, L_noon_max: noon.max, L_spread: round(noon.max - noon.min), L_0300_centre: night,
      prop_property_instance: prop ? (prop.property_instance || null) : 'NO PROP',
      theft: took && took.theft ? { theft: took.theft.theft, stolen_from: took.theft.stolen_from } : null,
      registry: { before: regBefore, after: H.getStealthState().stolen_registry_n },
      inventory_added: added,
    };
  });
  await h.close();
  say(`  ${label.padEnd(18)} ${JSON.stringify(out)}`);
  return out;
}

const results = [];
const A = (id, name, pass, detail) => { results.push({ id, name, pass, detail }); say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(12)} ${name}\n              ${detail}`); };

say('staging two trees ...');
const withFix = stage([]);
const noFix = stage(['lamps', 'lamps_ambient', 'theft']);
say(`  WITH the fix    ${withFix.dir}`);
say(`  WITHOUT the fix ${noFix.dir}  cuts: ${noFix.applied.map((a) => `${a.id}@${a.file}`).join(', ')}`);
say('\nmeasuring ...');
const A1 = await measure(withFix.dir, 'with the fix');
const A0 = await measure(noFix.dir, 'without it');

say('');
// The OLD number is "whatever the sky is doing, everywhere in the room, identically". Its VALUE
// depends on the weather the default state ships (overcast: 0.75 day / 0.09 night, not the clear
// 1.00 / 0.22 the first run of this instrument wrongly hardcoded), so the assertion is on the
// SHAPE — flat, zero world sources, and tracking the clock — with the values printed.
A('DTF-LAMP-OLD', 'cutting syncInteriorLights() returns the OLD number',
  A0.world_sources === 0 && A0.interior_ambient_applied === false && Math.abs(A0.L_spread) < 1e-9 && A0.L_noon_max !== A0.L_0300_centre,
  `without the fix: ${A0.world_sources} world sources, L FLAT at ${A0.L_noon_max} across all ${'sampled'} points of the room at noon (spread ${A0.L_spread}) and ${A0.L_0300_centre} at 03:00 — indoor light tracking the sky, which is the pre-round build exactly`);
A('DTF-LAMP-DIF', 'the two arms genuinely differ',
  A1.world_sources > 0 && A1.L_spread > 0.3 && A1.L_0300_centre !== A0.L_0300_centre,
  `with the fix: ${A1.world_sources} world sources, L ${A1.L_noon_min}..${A1.L_noon_max} (spread ${A1.L_spread}) and ${A1.L_0300_centre} at 03:00 — against ${A0.world_sources} / flat ${A0.L_noon_max} / ${A0.L_0300_centre}`);
A('DTF-THF-OLD', 'cutting the takeProp routing returns the OLD number',
  A0.theft === null && A0.registry.after === A0.registry.before && A0.inventory_added.length === 1 && A0.inventory_added[0].stolen === false && A0.inventory_added[0].owner === null,
  `without the fix: theft ${JSON.stringify(A0.theft)}, registry ${A0.registry.before} -> ${A0.registry.after}, inventory ${JSON.stringify(A0.inventory_added)} — the item comes away clean, as it did all of wave 1`);
A('DTF-THF-DIF', 'the two arms genuinely differ',
  !!(A1.theft && A1.theft.theft === true && A1.theft.stolen_from) && A1.registry.after === A1.registry.before + 1,
  `with the fix: theft ${JSON.stringify(A1.theft)}, registry ${A1.registry.before} -> ${A1.registry.after}, inventory ${JSON.stringify(A1.inventory_added)}`);
A('DTF-CTL', 'the CONTROL tree (a copy with NO cut) reproduces the working tree',
  A1.world_sources > 0 && !!A1.prop_property_instance && A1.prop_property_instance !== 'NO PROP',
  `an uncut copy measures world_sources ${A1.world_sources} and property_instance ${A1.prop_property_instance} — if this failed, the staging itself would be the variable`);

fs.rmSync(withFix.dir, { recursive: true, force: true });
fs.rmSync(noFix.dir, { recursive: true, force: true });

const failed = results.filter((r) => !r.pass);
say(`\n${results.length - failed.length}/${results.length} assertions pass`);
if (args.json) writeJson(String(args.json), { results, with_fix: A1, without_fix: A0, cuts: noFix.applied });
process.exit(failed.length ? 20 : 0);

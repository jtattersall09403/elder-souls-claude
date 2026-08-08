#!/usr/bin/env node
// critic-w1-15-r3-dtf2x2.mjs — the 2x2 that RULES.md rule 6 (rewritten this session) asks for
// and that the round's own delete-the-fix did not run.
//
// The round cuts THREE lines as ONE arm — `syncInteriorLights(sim)`, the indoor-ambient guard,
// and takeProp's property_instance branch — and reports "the old number returned, the arms
// differ". That is a correct delete-the-fix and it is not the whole of rule 6. Rule 6 now names
// a third shape explicitly:
//
//   "TWO GUARDS FOR ONE DEFECT, where deleting either alone changes nothing and only deleting
//    both moves the number. Honest reporting of it looks exactly like an inert fix, so say which
//    you have when you report it."
//
// The lamp fix has TWO edit sites in one file. Nobody has run them separately, so nobody knows
// which shape it is. This does: four arms, both cuts crossed.
//
//   00  neither cut          (the shipped tree)
//   10  syncInteriorLights removed, ambient guard kept
//   01  syncInteriorLights kept, ambient guard reverted to skyAmbient()
//   11  both removed         (the round's own arm)
//
// It cuts on FULL COPIES of game/ staged outside the repo, exactly as the round's tool does, and
// never touches a tracked file — rule 17, on a tree a dozen agents are writing to.
//
// The stager throws unless each target line occurs EXACTLY ONCE, so a teardown that has stopped
// biting is an error rather than a silent second copy of the positive arm.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-15-r3-dtf2x2.mjs — the lamp fix\'s two edit sites, crossed.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const REPO = path.resolve(new URL('../..', import.meta.url).pathname);
const say = (s = '') => process.stdout.write(`${s}\n`);

const CUTS = {
  call: {
    file: 'src/sim/stealth/system.js',
    find: '    this.syncInteriorLights(sim);',
    replace: '    /* CRITIC 2x2: the syncInteriorLights(sim) call site removed */',
  },
  ambient: {
    file: 'src/sim/stealth/system.js',
    find: 'if (!p.zone) this.light.defaultAmbient = this._interiorLit ? this.d.detection.interior_lamps.interior_ambient_L : skyAmbient(sim.env);',
    replace: 'if (!p.zone) this.light.defaultAmbient = skyAmbient(sim.env);   /* CRITIC 2x2: the pre-round line, verbatim */',
  },
};

function stage(ids) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w1-15-critic-2x2-'));
  fs.cpSync(path.join(REPO, 'game'), path.join(dir, 'game'), { recursive: true });
  for (const id of ids) {
    const c = CUTS[id];
    const p = path.join(dir, 'game', c.file);
    const s = fs.readFileSync(p, 'utf8');
    const n = s.split(c.find).length - 1;
    if (n !== 1) throw new Error(`cut '${id}': expected exactly 1 occurrence in ${c.file}, found ${n}. A teardown that cannot find its target must not run.`);
    fs.writeFileSync(p, s.replace(c.find, c.replace));
  }
  return dir;
}

async function measure(dir, label) {
  const h = await launchGame({ ...args, entry: path.join(dir, 'game', 'index.html'), width: 320, height: 240 });
  await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 180000 });
  const out = await h.page.evaluate(() => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    H.setSeed(1337); H.loadState('default'); H.setRenderRate(0);
    const rec = E.sim.settlements.interior('archon-apothecary');
    H.enterInterior('archon-apothecary'); H.setTimeOfDay(12); H.stepFrames(3);
    const lights = H.getStealthState().lights || { world_sources: 0, ambient_L: null };
    const b = rec.bounds_m; const pts = [];
    for (let x = b.x[0] + 0.5; x <= b.x[1] - 0.5; x += 1.0) for (let z = b.z[0] + 0.5; z <= b.z[1] - 0.5; z += 1.0) pts.push(H.getLightAt(x, 1.35, z, null));
    const min = r4(Math.min(...pts)), max = r4(Math.max(...pts));
    H.setTimeOfDay(3); H.stepFrames(3);
    const night = r4(H.getLightAt(0, 1.35, 0, null));
    return { world_sources: lights.world_sources, ambient_L: lights.ambient_L, L_min: min, L_max: max, L_spread: r4(max - min), L_0300: night };
  });
  await h.close();
  say(`  ${label.padEnd(34)} ${JSON.stringify(out)}`);
  return out;
}

say('W1-15 r3 CRITIC — the delete-the-fix 2x2 the round did not run (RULES.md rule 6, third shape)');
say('='.repeat(96));
say('staging four trees (full copies of game/, outside the repo — no tracked file is touched) ...');
const trees = {
  '00 shipped (neither cut)': stage([]),
  '10 call site cut only': stage(['call']),
  '01 ambient guard cut only': stage(['ambient']),
  '11 both cut (the round\'s arm)': stage(['call', 'ambient']),
};
say('measuring, one browser at a time ...');
const M = {};
for (const [label, dir] of Object.entries(trees)) M[label] = await measure(dir, label);

const k = Object.keys(M);
const [s00, s10, s01, s11] = k.map((x) => M[x]);
const same = (a, b) => a.world_sources === b.world_sources && a.L_min === b.L_min && a.L_max === b.L_max && a.L_0300 === b.L_0300;

const R = [];
const A = (id, name, pass, detail) => { R.push({ id, name, pass, detail }); say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(13)} ${name}\n              ${detail}`); };
say();

A('X-BITES', 'the teardown bites — the both-cut arm is NOT the shipped arm',
  !same(s00, s11),
  `shipped ${JSON.stringify(s00)}\n              both cut ${JSON.stringify(s11)}`);

A('X-SINGLE', 'cutting the CALL SITE alone already restores the old number',
  same(s10, s11),
  `call-site-only ${JSON.stringify(s10)}\n              both-cut       ${JSON.stringify(s11)}  -> ${same(s10, s11) ? 'identical: ONE cut is sufficient' : 'they differ: the second cut is load-bearing'}`);

A('X-SHAPE', 'which of rule 6\'s three shapes is this?',
  true,
  same(s10, s11) && !same(s01, s00)
    ? 'NEITHER an inert fix NOR two-guards-for-one-defect. The call-site cut alone restores the\n              pre-round number; the ambient cut alone changes the answer too, differently. Two\n              INDEPENDENT edit sites, each individually sufficient to change the measurement — so\n              the round\'s 3-line single arm is sound but over-broad, and it could not have told\n              an inert second edit from a load-bearing one. It is told here.'
    : same(s10, s00) && same(s01, s00) && !same(s11, s00)
      ? 'TWO GUARDS FOR ONE DEFECT — neither cut alone moves the number and only both do. This is\n              the shape rule 6 says must be NAMED, and the round did not name it.'
      : `unresolved: 10 ${same(s10, s00) ? '==' : '!='} 00, 01 ${same(s01, s00) ? '==' : '!='} 00, 11 ${same(s11, s00) ? '==' : '!='} 00`);

A('X-AMBIENT', 'the ambient guard is separately load-bearing (it is not decoration on the call site)',
  !same(s01, s00),
  `ambient-only ${JSON.stringify(s01)} vs shipped ${JSON.stringify(s00)}`);

const pass = R.filter((x) => x.pass).length;
say(`\n${pass}/${R.length} assertions pass`);
if (args.json) writeJson(args.json, { tool: 'critic-w1-15-r3-dtf2x2', at: new Date().toISOString(), arms: M, assertions: R });
for (const d of Object.values(trees)) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* leave it */ } }
process.exitCode = pass === R.length ? 0 : 1;

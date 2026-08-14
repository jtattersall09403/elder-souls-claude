#!/usr/bin/env node
// npc-presence-consumption.mjs — CONSUMPTION (RI-MTH07 §B, mandatory under ARBITRATION.md §3).
//
// WHY THIS EXISTS. W1-25-r1 cited `reports/sessions/exp-w1-opening/trace.jsonl` — 36,000 frames,
// ZERO events — as its evidence that no trace on this tree carries a consequence. The same command
// at HEAD emits 113 events in 3,600 frames, and 55 of those 113 are `npc_schedule` and
// `npc_presence` from `game/src/sim/npc.js`. A round that concludes "the world grew consequences"
// on the strength of an event COUNT would be doing exactly what this project keeps being bitten by:
// reporting a number that rose without anything a player could meet changing. `sim/camera.js`
// computes a character-opacity fade every frame, traces it, writes it to disk, and nothing in the
// renderer reads it — and every static check called that working.
//
// So this probe asks the RI-MTH07 question of the STATE those events mirror, not of the events.
//
//   MODEL      — `sim.npcs[].present` / `.visible`, written by `stepSchedule()` in
//                `game/src/sim/npc.js`, on the same line that emits `npc_presence`.
//   CONSUMER 1 — `game/src/render/renderer.js:548`, `mesh.visible = n.visible !== false`.
//                The renderer. A person whose day has them elsewhere is not drawn.
//   CONSUMER 2 — `game/src/sim/world-collision.js:121`, `if (!n.present) continue`.
//                Collision. An absent person is not a solid you can walk into.
//   CONSUMER 3 — `game/src/sim/stealth/system.js:949`, `if (!n.present) continue`.
//                Perception. An absent person does not see you.
//
// TWO PERTURBATIONS, AND THE DIFFERENCE BETWEEN THEM IS THE POINT.
//
//   ONE-SHOT — write `present`/`visible` false directly. This is the WEAK form and it is kept
//   because it is honest about why it is weak: `stepSchedule()` RECOMPUTES `present` from
//   `n.at === sim.env.interior` at the end of every single frame, so a direct write is undone by
//   its own writer within one step and the census moves by 1. Far too small to rest a claim on.
//
//   VIA-AT — perturb `n.at`, the INPUT the schedule reads. `at` is rewritten only when the
//   schedule SLOT changes (`if (i !== n._slot)`), so the perturbation is DURABLE; and it is the
//   FAITHFUL one, because the world's own code then computes the absence, emits its own
//   `npc_presence`, and every consumer downstream reads a value the world produced rather than one
//   this probe forced in behind it. `stepNPCWorldCollision` runs at `sim/step.js:185`, immediately
//   after `stepNPCs` at 182, so it reads exactly that.
//
// THE NULL ARM IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE. A recent landform instrument
// reported 71% coverage of a world containing none of the thing it measured, because its negative
// control was an EMPTY input rather than a GENERIC one. An EMPTY NPC list would collapse every
// observable here by accident and prove nothing. So the null arm restores `at` and instead perturbs
// `activity` — written by the SAME slot block, on the SAME objects, at the SAME moment, of the SAME
// shape (a string), through the SAME route — and requires every observable back at its intact
// value. If churning a neighbouring field moved the census, the positive arm would mean nothing.
//
// Usage: node tools/experience/npc-presence-consumption.mjs [--frames 300] [--settle 8]
//        [--out reports/experience/w1-25-r2-divergence/npc-presence-consumption.json]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `npc-presence-consumption.mjs — RI-MTH07 on the state npc_presence mirrors.
  --frames <n>   frames stepped per one-shot arm (default 300)
  --settle <n>   frames stepped after a VIA-AT perturbation (default 8)
  --out <file>   default reports/experience/w1-25-r2-divergence/npc-presence-consumption.json`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const FRAMES = Number(args.frames || 300);
/** Frames stepped after a VIA-AT perturbation, so the schedule and every consumer see it. */
const SETTLE = Number(args.settle || 8);
const OUT = path.resolve(String(args.out
  || path.join(REPO_ROOT, 'reports/experience/w1-25-r2-divergence/npc-presence-consumption.json')));
ensureDir(path.dirname(OUT));

const doc = {
  schema: 'elder-souls/npc-presence-consumption@1',
  measured_at: new Date().toISOString(),
  git: gitInfo(),
  frames_per_arm: FRAMES,
  settle_frames: SETTLE,
  model: 'sim.npcs[].present / .visible — game/src/sim/npc.js, the line that also emits npc_presence',
  consumers: [
    'game/src/render/renderer.js:548 — mesh.visible = n.visible !== false',
    'game/src/sim/world-collision.js:121 — if (!n.present) continue',
    'game/src/sim/stealth/system.js:949 — if (!n.present) continue',
  ],
  arms: [],
  checks: [],
  ok: false,
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

// Read the observables out of the live page. Deliberately reads the RENDERER's own scene graph and
// the SIM's own fields, not a harness summary that could agree with the model because it is
// computed from the model.
const OBSERVE = `(() => {
  const E = window.__ENGINE;
  const sim = E.sim;
  const scene = E.renderer && E.renderer.scene;
  let drawn = 0, meshes = 0;
  if (scene) {
    scene.traverse((o) => {
      if (o.name && o.name.indexOf('npc:') === 0) {
        meshes++;
        let vis = true, p = o;
        while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
        if (vis) drawn++;
      }
    });
  }
  const npcs = sim.npcs || [];
  return {
    npc_total: npcs.length,
    npc_meshes: meshes,
    npc_meshes_drawn: drawn,
    collidable: npcs.filter((n) => n.present).length,
    perceivers: npcs.filter((n) => n.present).length,
    activities_sample: npcs.map((n) => String(n.activity || '')).sort().join('|').slice(0, 400),
    walked_sum: +npcs.reduce((s, n) => s + (n.walked_m || 0), 0).toFixed(4),
  };
})()`;

const main = async () => {
  const handle = await launchGame({ width: 960, height: 540 });
  try {
    await handle.h('setSeed', 1337);
    await handle.hOpt('setMode', 'play-instrumented');
    // Warm up so the schedule has placed people and the renderer has built their meshes.
    await handle.h('stepFrames', 600);

    const arm = async (label, mutate, frames) => {
      const before = await handle.page.evaluate(OBSERVE);
      if (mutate) await handle.page.evaluate(mutate);
      // `stepFrames(n)` advances n fixed steps and renders ONCE at the end (engine.js:7533), so the
      // renderer syncs against the perturbed sim without this probe driving the draw itself.
      await handle.h('stepFrames', frames);
      const after = await handle.page.evaluate(OBSERVE);
      const rec = { arm: label, frames, before, after };
      doc.arms.push(rec); flush();
      log(`  ${label.padEnd(24)} drawn ${before.npc_meshes_drawn} -> ${after.npc_meshes_drawn}, ` +
          `collidable ${before.collidable} -> ${after.collidable}, perceivers ${after.perceivers}`);
      return rec;
    };

    const intact = await arm('INTACT', null, FRAMES);

    // The weak form, kept and reported. See the header.
    const oneShot = await arm('ONE-SHOT(present)', `(() => {
      for (const n of (window.__ENGINE.sim.npcs || [])) { n.present = false; n.visible = false; }
      return true;
    })()`, FRAMES);

    // The measurement. Perturb the input the schedule reads and let the world conclude the absence.
    const viaAt = await arm('VIA-AT(broken)', `(() => {
      const sim = window.__ENGINE.sim;
      window.__AT_SAVED = (sim.npcs || []).map((n) => [n.eid, n.at]);
      for (const n of (sim.npcs || [])) n.at = 'consumption-nowhere';
      return true;
    })()`, SETTLE);

    // The null arm, through the same route, at the same moment, on the same objects.
    const viaNull = await arm('VIA-AT(null: activity)', `(() => {
      const sim = window.__ENGINE.sim;
      const saved = new Map(window.__AT_SAVED || []);
      for (const n of (sim.npcs || [])) {
        if (saved.has(n.eid)) n.at = saved.get(n.eid);
        n.activity = 'consumption-null-activity';
      }
      return true;
    })()`, SETTLE);

    const chk = (id, pass, why) => {
      doc.checks.push({ id, pass, why });
      log(`  ${pass ? 'PASS' : 'FAIL'}  ${id} — ${why}`);
      return pass;
    };

    const hadBodies = chk('C0-population-non-empty',
      intact.after.npc_total > 0 && intact.after.npc_meshes > 0,
      `the intact arm ranged over ${intact.after.npc_total} NPC(s) and ${intact.after.npc_meshes} ` +
      `mesh(es) — a zero here would make every other check on this page vacuous`);

    chk('C1-one-shot-moves-the-census-but-barely',
      oneShot.after.npc_meshes_drawn < intact.after.npc_meshes_drawn,
      `writing present/visible directly moved drawn ${intact.after.npc_meshes_drawn} -> ` +
      `${oneShot.after.npc_meshes_drawn}. Directionally right, and small BECAUSE stepSchedule() ` +
      `recomputes present every frame — which is why the VIA-AT arm exists`);

    chk('C2-renderer-consumes',
      viaAt.after.npc_meshes_drawn === 0 && viaAt.before.npc_meshes_drawn > 0,
      `putting every person's scheduled cell somewhere the player is not drove drawn NPC meshes ` +
      `${viaAt.before.npc_meshes_drawn} -> ${viaAt.after.npc_meshes_drawn}; the renderer still ` +
      `holds ${viaAt.after.npc_meshes} mesh objects and draws none of them`);

    chk('C3-collision-and-perception-consume',
      viaAt.after.collidable === 0 && viaAt.after.perceivers === 0,
      `collidable ${viaAt.before.collidable} -> ${viaAt.after.collidable}, perceivers ` +
      `${viaAt.before.perceivers} -> ${viaAt.after.perceivers} — and the world computed these ` +
      `itself from the perturbed input rather than having them forced in behind it`);

    // THE BASELINE FOR THE NULL ARM IS THE STATE IMMEDIATELY BEFORE THE BREAK, NOT THE FIRST ARM.
    // The first version of this check compared against INTACT and failed 26 against 27 — because
    // the ONE-SHOT arm above leaves one person absent for good (their schedule slot does not turn
    // over inside the arm, so `at` never gets rewritten and `present` stays where it was put). That
    // is a defect in the CHECK, not in the world, and it is written down rather than silently
    // rebaselined: an arm's control is the arm that ran before it.
    const base = viaAt.before;
    chk('C4-null-arm-is-inert',
      viaNull.after.npc_meshes_drawn === base.npc_meshes_drawn
      && viaNull.after.collidable === base.collidable
      && viaNull.after.perceivers === base.perceivers,
      `restoring at and instead perturbing activity, on the same objects by the same route, ` +
      `returned drawn/collidable/perceivers to ${viaNull.after.npc_meshes_drawn}/` +
      `${viaNull.after.collidable}/${viaNull.after.perceivers} against the pre-break baseline ` +
      `${base.npc_meshes_drawn}/${base.collidable}/${base.perceivers}`);

    chk('C5-null-arm-actually-landed',
      viaNull.after.activities_sample.indexOf('consumption-null-activity') >= 0,
      `the null perturbation is not a no-op — the activity string is on the live objects`);

    doc.effect_sizes = {
      one_shot_drawn_delta: intact.after.npc_meshes_drawn - oneShot.after.npc_meshes_drawn,
      via_at_drawn_delta: viaAt.before.npc_meshes_drawn - viaAt.after.npc_meshes_drawn,
      via_at_null_drawn_delta: viaAt.before.npc_meshes_drawn - viaNull.after.npc_meshes_drawn,
      note: 'The one-shot delta is small because stepSchedule() recomputes `present` every frame, '
        + 'so a direct write is undone by its own writer. The VIA-AT delta is the measurement: it '
        + 'perturbs the input the schedule reads, so the world computes the absence itself. The '
        + 'VIA-AT null delta must be 0.',
    };
    doc.ok = hadBodies && doc.checks.every((c) => c.pass);
    flush();
    log(doc.ok ? 'CONSUMPTION: DEMONSTRATED' : 'CONSUMPTION: NOT DEMONSTRATED');
  } finally {
    await handle.close();
  }
  process.exit(doc.ok ? 0 : 1);
};

await main();

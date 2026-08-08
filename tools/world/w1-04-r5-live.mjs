#!/usr/bin/env node
/*
 * W1-04 round 5 — WHERE THE BODY STANDS ONE FRAME AFTER THE DOOR.
 *
 * The round-4 verdict's blocking gap is `GAP-W1-the-door-puts-you-inside-the-building`, and the
 * dispatch is explicit about why four rounds walked past it: every previous measurement asked a
 * question about the DATA — "is `continuity.exterior_spawn` inside a wall box?" — and the answer
 * to a question about data is a property of a file. This asks a question about a BODY:
 *
 *     go through the door, come back out, step the fixed step ONCE, and ask the running world
 *     where the player is standing and what building is over its head.
 *
 * That is a different quantity from the offline one and it can disagree with it: the position is
 * read after `leaveInterior()` -> `placeBody()` -> one fixed step of physics and collision, so a
 * doorstep the solver ejects, or fails to eject, shows up here and nowhere else.
 *
 * SECTIONS, each written to disk as it finishes (the round-4 builder AND its critic both lost a
 * live run to one `page.evaluate` that outlived its wrapper; this one chunks in eights):
 *
 *   L1  THE SWEEP, LIVE. Every enterable door: enter, step, leave, step ONE frame, then
 *       `whereAmI().pos` and `buildingAt()`. Reports how many bodies stand inside a building.
 *   L2  THE CONTROL, LIVE — rule 6, and the arm I have watched go red. The round-5 doorstep
 *       derivation is UNDONE on the live records (`exterior_spawn` and `door` restored from the
 *       `*_declared` stashes this round writes) and the IDENTICAL sweep is re-run. If this arm
 *       does not come back with bodies under roofs, L1 is not measuring the fix.
 *   L3  CAN YOU GET BACK IN? The other half of the same defect, pointed the other way: a doorstep
 *       far enough out to be outside is a doorstep you may not be able to re-enter from.
 *       `whereAmI().door_in_reach` is the field `sim/settlement.js#doorAt()` fills, so this is the
 *       reach table the game itself uses and not a distance this tool invents.
 *
 * ONE BROWSER, launched here and kept for the whole run. Never `pkill -f headless_shell`.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));
const OUT = path.join(ROOT, 'reports/w1-04-r5');
fs.mkdirSync(OUT, { recursive: true });

const argOf = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const CAP = Number(argOf('--doors', '0')) || 0;
const CHUNK = Number(argOf('--chunk', '8')) || 8;

const out = {
  tool: 'tools/world/w1-04-r5-live.mjs',
  when: new Date().toISOString(),
  commit: process.env.W1_04_COMMIT || null,
  door_cap: CAP || null, chunk: CHUNK,
  sections: {}, failures: [],
};
const save = () => fs.writeFileSync(path.join(OUT, 'live.json'), JSON.stringify(out, null, 2));
save();

const B = await launchGame({ width: 1024, height: 640 });
const errs = [];
B.page.on('pageerror', (e) => errs.push(String(e)));
// One rendered frame per SIM frame is the default, and it makes a 224-visit sweep take an hour.
// Nothing measured here is read off the picture — the body's position comes from the fixed step
// and `buildingAt()` from the plan — so the render rate goes to zero and the fixed step is the
// only thing being paid for. Said out loud because it is a claim: if any number below were read
// off the frame, this line would silently break it.
await B.page.evaluate(() => window.__HARNESS.setRenderRate(0));

/** The sweep itself, run inside the page over ONE chunk of door ids. */
const SWEEP = (ids) => {
  const H = window.__HARNESS;
  const rows = [];
  for (const id of ids) {
    try {
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
      const rec = H.__w1_04_interior(id);
      const r = H.enterInterior(id);
      if (!r || !r.entered) { rows.push({ id, skipped: r ? r.reason : 'no-result' }); continue; }
      H.stepFrames(2);
      const inside_before = H.whereAmI().interior;
      H.exitInterior();
      // ONE FRAME. Not two, not "after it settles" — the frame the player is looking at when the
      // room goes away.
      H.stepFrames(1);
      const w = H.whereAmI();
      const p = w.pos;
      const hit = H.buildingAt(p[0], p[2], 0);
      rows.push({
        id,
        building: rec && rec.continuity ? rec.continuity.building : null,
        settlement: rec ? rec.settlement : null,
        entered: inside_before === id,
        pos: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)],
        inside_building: hit ? hit.building : null,
        inside_settlement: hit ? hit.settlement : null,
        inside_the_one_just_left: !!(hit && rec && rec.continuity && hit.building === rec.continuity.building),
        door_in_reach: w.door_in_reach ? w.door_in_reach.interior : null,
        door_dist_m: w.door_in_reach ? w.door_in_reach.dist_m : null,
        still_in_interior: w.interior,
      });
    } catch (e) { rows.push({ id, error: String((e && e.message) || e) }); }
  }
  return rows;
};

/** Roll a set of sweep rows up into the numbers the acceptance is stated in. */
function rollup(rows) {
  const done = rows.filter((r) => r.entered);
  return {
    doors_tested: done.length,
    skipped: rows.length - done.length,
    bodies_inside_a_building: done.filter((r) => r.inside_building).length,
    bodies_inside_the_building_just_left: done.filter((r) => r.inside_the_one_just_left).length,
    still_reporting_an_interior: done.filter((r) => r.still_in_interior).length,
    door_back_in_reach: done.filter((r) => r.door_in_reach).length,
    offenders: done.filter((r) => r.inside_building).slice(0, 20),
  };
}

async function sweepAll(ids, label) {
  const rows = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = await B.page.evaluate(SWEEP, ids.slice(i, i + CHUNK));
    rows.push(...part);
    // WRITE AS YOU GO (rule 2). A run that dies at door 90 still published 88.
    out.sections[label] = { partial: true, rows_so_far: rows.length, ...rollup(rows) };
    save();
    process.stdout.write(`  ${label}: ${rows.length}/${ids.length}\r`);
  }
  const roll = rollup(rows);
  out.sections[label] = { ...roll, rows };
  save();
  console.log(`  ${label}: ${roll.doors_tested} doors, ${roll.bodies_inside_a_building} bodies inside a building (${roll.bodies_inside_the_building_just_left} inside the one just left), door back in reach ${roll.door_back_in_reach}`);
  return roll;
}

try {
  // Which doors. Every interior whose record names a building — the 112 the offline census counts.
  const ids = await B.page.evaluate((cap) => {
    const H = window.__HARNESS;
    const list = H.listInteriors().map((i) => i.id).filter((id) => {
      const rec = H.__w1_04_interior(id);
      return !!(rec && rec.continuity && rec.continuity.building && Array.isArray(rec.continuity.exterior_spawn));
    });
    return cap ? list.slice(0, cap) : list;
  }, CAP);
  out.doors = ids.length;
  save();
  console.log(`L1  ${ids.length} doors with a building and a declared doorstep`);

  // ---- L1: the sweep, on the shipped build ----------------------------------------------------
  const live = await sweepAll(ids, 'L1_live');
  if (live.doors_tested < 40) out.failures.push(`L1: only ${live.doors_tested} doors tested; the acceptance asks for at least 40`);
  if (live.bodies_inside_a_building) out.failures.push(`L1: ${live.bodies_inside_a_building} of ${live.doors_tested} bodies stand inside a building one frame after leaving it`);

  // ---- L2: the control — undo THIS ROUND'S doorstep derivation in the live page ---------------
  const undone = await B.page.evaluate(() => {
    const E = window.__ENGINE;
    let spawns = 0, doors = 0;
    for (const rec of Object.values(E.data.interiors || {})) {
      const c = rec.continuity;
      if (c && Array.isArray(c.exterior_spawn_declared)) { c.exterior_spawn = c.exterior_spawn_declared.slice(); spawns++; }
    }
    for (const doc of Object.values(E.data.settlements || {})) {
      for (const b of doc.buildings || []) {
        if (!Array.isArray(b.door_declared) || !Array.isArray(b.door)) continue;
        // In place, because `SettlementSystem`'s reach table holds this array itself.
        b.door[0] = b.door_declared[0]; b.door[1] = b.door_declared[1]; b.door[2] = b.door_declared[2];
        doors++;
      }
    }
    return { spawns, doors };
  });
  out.sections.L2_control_setup = undone;
  save();
  console.log(`L2  control: restored ${undone.spawns} declared doorsteps and ${undone.doors} declared doors on the live records`);
  if (!undone.spawns || !undone.doors) out.failures.push('L2: the control restored nothing — it is inert, and an inert control is a second copy of the experiment');
  const cut = await sweepAll(ids, 'L2_control');

  // Put the world back, so anything that runs after this in the same page is not lied to.
  const restored = await B.page.evaluate(() => {
    const E = window.__ENGINE;
    E.renderer.province.setSettlements(Object.values(E.data.settlements || {}), E.data.interiors || {});
    return true;
  });
  out.sections.L2_world_restored = restored;

  out.sections.L3_reach = {
    what: 'can you get back in from where the door left you — `whereAmI().door_in_reach`, the reach table sim/settlement.js itself fills',
    live_door_back_in_reach: live.door_back_in_reach,
    live_doors: live.doors_tested,
    control_door_back_in_reach: cut.door_back_in_reach,
  };

  // THE CONTROL MUST GO RED. This is the assertion, not a remark.
  if (!(cut.bodies_inside_a_building > live.bodies_inside_a_building)) {
    out.failures.push(`L2: the control did NOT go red — live ${live.bodies_inside_a_building} inside, control ${cut.bodies_inside_a_building} inside. Rule 6: both arms are the positive arm.`);
  }
  out.headline = {
    doors: live.doors_tested,
    bodies_inside_a_building_SHIPPED: live.bodies_inside_a_building,
    bodies_inside_a_building_CONTROL: cut.bodies_inside_a_building,
    inside_the_one_just_left_CONTROL: cut.bodies_inside_the_building_just_left,
    door_back_in_reach_SHIPPED: live.door_back_in_reach,
    door_back_in_reach_CONTROL: cut.door_back_in_reach,
  };
  out.page_errors = errs.slice(0, 10);
  save();
  console.log('');
  console.log(`HEADLINE  ${JSON.stringify(out.headline, null, 1)}`);
  for (const f of out.failures) console.log(`  ! ${f}`);
  console.log(`  -> ${path.relative(ROOT, path.join(OUT, 'live.json'))}`);
} finally {
  await B.close();
}
process.exit(out.failures.length ? 1 : 0);

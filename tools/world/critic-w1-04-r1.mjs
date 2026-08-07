#!/usr/bin/env node
/**
 * critic-w1-04-r1.mjs — the W1-04 round-1 CRITIC's own instrument. Written by the critic,
 * declared under method_deviations in corpus/90-verdicts/wave1/W1-04-r1.md.
 *
 * It does not reuse tools/world/w1-04-consumption.mjs, because a critic that re-runs the
 * builder's probe has only confirmed that the builder's probe runs. Every quantity here is
 * read off the live Engine through __HARNESS / __ENGINE and the perturbations are the
 * critic's own.
 *
 * Three angles the brief names, plus the picture:
 *   A  SCHEDULES  — does anybody actually go home, and does the WORLD change when they do?
 *   B  OWNERSHIP + LOCKS — perturb an owner and a lock; watch behaviour change.
 *   C  WALK IN AND LOOK — is a named interior a place, or one hall wearing 115 names?
 *   D  VP04-settlement-street — is the subject in the frame?
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson, log } from '../lib/cli.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const args = parseArgs(process.argv.slice(2));
const outFile = args.out || 'reports/critic-w1-04-r1.json';
const R = { checks: [], notes: [] };
const add = (id, verdict, detail) => { R.checks.push({ id, verdict, ...detail }); log(`${verdict.padEnd(10)} ${id}  ${JSON.stringify(detail).slice(0, 260)}`); };

const handle = await launchGame({ timeout: Number(args.timeout ?? 90000), width: 1280, height: 720 });
const { page } = handle;
const Hraw = (fn, ...a) => page.evaluate(({ f, a }) => {
  // eslint-disable-next-line no-new-func
  return (new Function('h', 'E', `return (${f})(h, E, ...${JSON.stringify(a)})`))(window.__HARNESS, window.__ENGINE);
}, { f: fn.toString(), a });
const H = async (fn, ...a) => { try { return await Hraw(fn, ...a); } catch (e) { return { __error: String(e.message).split('\n')[0] }; } };

try {
  R.build = await H((h) => h.getBuildInfo());

  // ---------------------------------------------------------------- A. SCHEDULES ------------
  // Put the body in Thorn, let the town populate itself off the live step, then run the clock.
  const arrive = await H((h, E) => {
    const s = h.__w1_04_settlement('thorn');
    h.teleport(s.pos[0] + 4, s.pos[2] + 4);
    h.setTimeOfDay(12);
    h.stepFrames(4);
    return { settlement: E.sim.env.settlement, npcs: E.sim.npcs.length, pos: [...E.sim.player.pos] };
  });
  R.arrive = arrive;

  const day = await H((h, E) => {
    const snap = (hour) => {
      h.setTimeOfDay(hour);
      h.stepFrames(3);
      return h.whereIsEveryone().map((n) => ({ eid: n.eid, at: n.at, present: n.present, pos: n.pos.map((v) => Math.round(v * 100) / 100) }));
    };
    const noon = snap(12), night = snap(3), back = snap(12);
    return { noon, night, back };
  });
  {
    const byId = new Map(day.noon.map((n) => [n.eid, n]));
    let cellChanged = 0, posChanged = 0, outdoorsNoon = 0, outdoorsNight = 0;
    for (const n of day.night) {
      const m = byId.get(n.eid); if (!m) continue;
      if (m.at !== n.at) cellChanged++;
      if (m.pos[0] !== n.pos[0] || m.pos[2] !== n.pos[2]) posChanged++;
    }
    for (const n of day.noon) if (n.at === null) outdoorsNoon++;
    for (const n of day.night) if (n.at === null) outdoorsNight++;
    add('A1-cell-changes-with-the-clock', cellChanged > 0 ? 'CONSUMED' : 'DEAD',
      { people: day.noon.length, changed_cell_noon_to_3am: cellChanged, outdoors_noon: outdoorsNoon, outdoors_3am: outdoorsNight });
    add('A2-does-anybody-WALK', posChanged > 0 ? 'MOVES' : 'NOBODY-MOVES',
      { people: day.noon.length, changed_position_noon_to_3am: posChanged,
        note: 'stepSchedule docstring claims it changes pos ("they walk to the slot\'s anchor")' });
  }

  // A3. Perturb ONE person's schedule and watch the world disagree. Falsifiable both ways.
  const pert = await H((h, E) => {
    const n = E.sim.npcs.find((x) => x.schedule.length > 1 && x.home_interior);
    if (!n) return { skipped: 'no scheduled npc in this town' };
    h.setTimeOfDay(3); h.stepFrames(3);
    const before = { at: n.at, present: n.present, visible: n.visible };
    const saved = n.schedule.map((s) => ({ ...s }));
    // Send her somewhere else for the whole day.
    n.schedule = [{ from: 0, to: 24, at: 'thorn-inn', activity: 'tavern' }];
    n._slot = -1;
    h.stepFrames(3);
    const after = { at: n.at, present: n.present, visible: n.visible };
    n.schedule = saved; n._slot = -1; h.stepFrames(3);
    const restored = { at: n.at, present: n.present };
    return { eid: n.eid, before, after, restored };
  });
  R.perturb_schedule = pert;
  add('A3-perturb-one-schedule', pert.skipped ? 'SKIPPED' : (pert.before.at !== pert.after.at && pert.restored.at === pert.before.at ? 'CONSUMED' : 'DEAD'), pert);

  // A4. Does the RENDERER see any of it? A person who is `present` must be drawn.
  const drawn = await H((h, E) => {
    h.setTimeOfDay(12); h.stepFrames(3);
    const inside = h.enterInterior('thorn-hall');
    h.stepFrames(3);
    const occ = h.listInteriors('thorn').find((i) => i.id === 'thorn-hall');
    const people = h.whereIsEveryone().filter((n) => n.present);
    const r = E.renderer;
    const npcGroup = r && r.cells ? null : null;
    return { inside, occupants: occ ? occ.occupants : null, present_count: people.length,
      present: people.slice(0, 12).map((p) => ({ eid: p.eid, at: p.at, pos: p.pos.map((v) => Math.round(v * 10) / 10) })),
      env: { interior: E.sim.env.interior, settlement: E.sim.env.settlement }, body: [...E.sim.player.pos] };
  });
  R.inside_thorn_hall = drawn;
  add('A4-thorn-hall-occupancy', (drawn.occupants && drawn.occupants.length) ? 'POPULATED' : 'EMPTY', {
    interior: 'thorn-hall', occupants: drawn.occupants, present_anywhere: drawn.present_count, body: drawn.body });

  // ---------------------------------------------------------------- B. OWNERSHIP + LOCKS -----
  const own = await H((h, E) => {
    // A witness is what turns a theft into a bounty; without one the crime system correctly
    // files nothing, so the perturbation is run WITH an observer both times.
    const zones = h.listPropertyZones();
    let hit = null;
    for (const z of zones) {
      const zz = h.__w1_04_zone(z.id);
      if (zz && (zz.contents || []).filter((c) => c.owner).length >= 2) { hit = zz; break; }
    }
    if (!hit) return { skipped: 'no zone with two owned objects' };
    const [i1, i2] = hit.contents.filter((c) => c.owner);
    const obs = [{ eid: 'critic-witness', faction: null, civ_state: 'CALM' }];
    const bounty = () => JSON.parse(JSON.stringify(h.getCrimeState().bounty));
    const b0 = bounty();
    const owned = h.takeObject(i1.instance, { observedBy: obs });
    const b1 = bounty();
    // PERTURB: strip the owner off the second object and take it the same way.
    const savedOwner = i2.owner, savedScope = i2.owner_scope;
    i2.owner = null; i2.owner_scope = null;
    const unowned = h.takeObject(i2.instance, { observedBy: obs });
    const b2 = bounty();
    i2.owner = savedOwner; i2.owner_scope = savedScope;
    return { zone: hit.id, owned_item: i1.instance, unowned_item: i2.instance,
      owned: { r: owned, bounty_before: b0, bounty_after: b1 },
      unowned: { r: unowned, bounty_before: b1, bounty_after: b2 } };
  });
  R.ownership = own;
  add('B1-owner-perturbation', own.skipped ? 'SKIPPED'
    : (own.owned.r.theft === true && own.unowned.r.theft === false ? 'CONSUMED' : 'DEAD'), own);

  const lock = await H((h, E) => {
    let z = null, L = null;
    for (const doc of Object.values(E.data.property || {})) {
      for (const zz of doc.zones || []) if ((zz.locks || []).length) { z = zz; L = zz.locks[0]; break; }
      if (z) break;
    }
    if (!z) return { skipped: 'no locked zone' };
    // The refusal is a THROW with the gate in the message, so the observable is the message.
    const attempt = () => { try { return { ok: true, block: h.lockBegin(L.id) }; } catch (e) { return { ok: false, refusal: String(e.message) }; } };
    const saved = L.tier;
    const a = attempt();
    L.tier = Math.min(5, saved + 2);
    const b = attempt();
    L.tier = saved;
    const c = attempt();
    return { zone: z.id, lock: L.id, tier_before: saved, tier_perturbed: Math.min(5, saved + 2), a, b, c };
  });
  R.locks = lock;
  add('B2-lock-tier-perturbation', lock.skipped ? 'SKIPPED'
    : (JSON.stringify(lock.a) !== JSON.stringify(lock.b) && JSON.stringify(lock.a) === JSON.stringify(lock.c) ? 'CONSUMED' : 'DEAD'), lock);

  // B3. Hours: the same zone at noon and at 3am.
  const hours = await H((h, E) => {
    const rows = [];
    for (const doc of Object.values(E.data.property || {})) {
      for (const z of doc.zones || []) {
        if (z.class !== 'shop' && z.class !== 'shop_closed') continue;
        h.setTimeOfDay(12); const noon = h.trespassCheck(z.id);
        h.setTimeOfDay(3); const night = h.trespassCheck(z.id);
        rows.push({ zone: z.id, cls: z.class, noon: noon.trespassing, night: night.trespassing });
        if (rows.length >= 6) break;
      }
      if (rows.length >= 6) break;
    }
    const differ = rows.filter((r) => r.noon !== r.night).length;
    return { rows, differ };
  });
  R.hours = hours;
  add('B3-shop-hours-change-trespass', hours.differ > 0 ? 'CONSUMED' : 'DEAD', hours);

  // ---------------------------------------------------------------- C. WALK IN AND LOOK ------
  const cells = await H((h, E) => {
    const ids = h.listInteriors().map((i) => i.id);
    const map = {};
    for (const id of ids) {
      const kind = E.cellFor({ ...E.sim.env, interior: id });
      map[kind] = (map[kind] || 0) + 1;
    }
    // Triangle budget of the generic interior cell vs the province.
    const tri = (g) => { let t = 0; g && g.traverse((o) => { if (o.geometry) { const p = o.geometry.attributes && o.geometry.attributes.position; t += p ? p.count / 3 : 0; } }); return Math.round(t); };
    const r = E.renderer;
    const cellTris = {};
    if (r && r.cells) for (const k of Object.keys(r.cells)) cellTris[k] = tri(r.cells[k]);
    return { interiors: ids.length, by_cell: map, cell_triangles: cellTris };
  });
  R.cells = cells;
  add('C1-named-interiors-with-own-geometry',
    (cells.by_cell.interior || 0) === 0 ? 'ALL-BESPOKE' : 'SHARED-HALL',
    { interiors: cells.interiors, by_cell: cells.by_cell, generic_hall_triangles: cells.cell_triangles.interior });

  // C2. Are the props/lights/containers on the record ever instantiated?
  const furn = await H((h, E) => {
    const d = h.__w1_04_interior('archon-apothecary');
    const r = E.renderer;
    let sceneLights = 0;
    r && r.cells && r.cells.interior && r.cells.interior.traverse((o) => { if (o.isLight) sceneLights++; });
    return { record_props: (d.props || []).length, record_lights: (d.lights || []).length,
      record_containers: (d.containers || []).length, unique_item: d.unique_item ? d.unique_item.id : null,
      lights_in_the_drawn_hall: sceneLights };
  });
  R.furnishing = furn;
  add('C2-record-furnishing-instantiated', 'INSPECT', furn);

  // C3. Screenshot three different named interiors and compare the pixels.
  R.interior_shots = [];
  const shotIds = (args.shots ? String(args.shots) : 'archon-apothecary,helstrom-guild-mages,thorn-house-0,thorn-hall').split(',');
  for (const id of shotIds) {
    const st = await H((h, E, iid) => {
      const r = h.enterInterior(iid);
      h.setTimeOfDay(12);
      h.stepFrames(8);
      h.renderFrame();
      const d = h.__w1_04_interior(iid);
      return { r, cell: E.cellFor(E.sim.env), name: d && d.name, kind: d && d.interior_kind,
        occupants: h.listInteriors().filter((x) => x.id === iid).map((x) => x.occupants)[0] || [],
        body: [...E.sim.player.pos] };
    }, id);
    R.interior_shots.push({ id, ...st });
    log(`cell ${id} -> ${st.cell} occupants=${(st.occupants || []).length}`);
  }
  {
    const cellsUsed = new Set(R.interior_shots.map((s) => s.cell));
    add('C3-do-different-interiors-use-different-cells',
      cellsUsed.size === R.interior_shots.length ? 'DISTINCT' : 'ONE-CELL',
      { visited: R.interior_shots.length, distinct_cells: [...cellsUsed],
        rows: R.interior_shots.map((s) => ({ id: s.id, kind: s.kind, cell: s.cell, occupants: (s.occupants || []).length })) });
  }

  // ---------------------------------------------------------------- D. VP04 ------------------
  const vp = JSON.parse(fs.readFileSync('tools/harness/viewpoints.json', 'utf8'));
  const list = Array.isArray(vp) ? vp : (vp.viewpoints || Object.values(vp));
  const v4 = list.find((x) => String(x.id || x.name).includes('VP04'));
  R.vp04 = await H((h, E, cam, world) => {
    h.exitInterior();
    h.teleport(cam.pos[0], cam.pos[2]);
    if (world && world.timeOfDay !== undefined) h.setTimeOfDay(world.timeOfDay);
    h.stepFrames(6);
    h.camera({ pos: cam.pos, look: cam.look, fov: cam.fov });
    h.stepFrames(2);
    h.renderFrame();
    const people = h.whereIsEveryone().filter((n) => n.present);
    return { settlement: E.sim.env.settlement, interior: E.sim.env.interior,
      npcs_in_world: E.sim.npcs.length, present: people.length,
      present_ids: people.slice(0, 20).map((p) => p.eid),
      body: [...E.sim.player.pos], anchor: null };
  }, v4.camera, v4.world);
  add('D1-VP04-camera-stands-in-the-town', R.vp04.settlement === 'thorn' ? 'IN-TOWN' : 'NOT-IN-TOWN', R.vp04);
} finally {
  try { writeJson(outFile, R); } catch (e) { /* */ }
  await handle.close();
}
log(`wrote ${outFile}`);

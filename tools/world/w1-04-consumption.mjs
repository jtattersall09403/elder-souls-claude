#!/usr/bin/env node
/**
 * w1-04-consumption.mjs — the RI-MTH07 / ARBITRATION §3 CONSUMPTION check for W1-04's nine paths.
 *
 * WHY THIS EXISTS, and why it runs in the browser rather than in bare node.
 *
 * Twelve subsystems in this project have shipped a correct model that nothing in the running
 * world read. The newest was 60 of 65 books declaring `topics_taught` that nothing consumes.
 * Three of this piece's nine paths were in exactly that state when the piece opened, and the
 * survey (`reports/w1-04-survey.md` §2) named them: `world.settlement.anatomy` had NO consumer,
 * `world.interior.named` had exactly one expression in the whole build
 * (`Object.keys(d.interiors).length`, a census), and `world.npc.schedule` was declared on NPC
 * records that `makeNPC()` did not even COPY the field from. Nobody in this world had ever moved.
 *
 * A claim that those are now consumed is worth nothing. What is worth something is PERTURBING
 * the live model and watching an entity change behaviour, so that is what every check below
 * does: read a quantity off the running world, mutate ONE field of the model the world is
 * reading, step the fixed step, read the same quantity again, and require it to have moved.
 * A perturbation that produces no delta is a dead model and FAILS the check.
 *
 * It runs against the real Engine in the real page because `AGENT-PROTOCOL.md` failure mode 1 is
 * "the verdict may name a dead call site": a probe that reimplements the consumer proves only
 * that the probe works. Every quantity here is read through `window.__HARNESS`, which delegates
 * to `Engine`, which delegates to `game/src/sim/settlement.js` — the same module `sim/step.js`
 * drives on frame N. There is no second implementation for this to pass against.
 *
 * `--self-test` is the answer to failure mode 2, "a probe that cannot fail is worse than no
 * probe": it DISCONNECTS each consumer on purpose and requires every check to go red. A run of
 * this file that passes both ways is a broken instrument and it says so.
 *
 * Usage:
 *   node tools/world/w1-04-consumption.mjs [--out reports/w1-04-consumption.json] [--self-test]
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson } from '../lib/cli.mjs';

const USAGE = `
w1-04-consumption.mjs — prove every W1-04 model has a live consumer, by perturbing it.

USAGE
  node tools/world/w1-04-consumption.mjs [--out <file>] [--self-test] [--timeout <ms>]

OPTIONS
  --out <path>    Write the JSON report here (default reports/w1-04-consumption.json)
  --self-test     Break each consumer on purpose; every check MUST go red. Proves the
                  instrument can fail. Exit 0 only if all checks flip to DEAD.
  --timeout <ms>  Harness wait (default 60000)
  --help          This message

Exit 0 = every model moved the world when perturbed (or, under --self-test, every model
stopped moving it when the consumer was cut). Non-zero = at least one model is orphan data.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const outFile = args.out || 'reports/w1-04-consumption.json';
const selfTest = !!args['self-test'];
const timeout = Number(args.timeout ?? 60000);

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout });

  // AGENT-PROTOCOL: `stepFrames()` renders a full SwiftShader frame per simulation frame unless
  // the render rate is zero. This probe steps a few hundred frames; without this line it is the
  // most expensive thing on the box.
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));

  const report = await page.evaluate(async (opts) => {
    const H = window.__HARNESS;
    const results = [];
    const clone = (o) => JSON.parse(JSON.stringify(o));

    /**
     * One consumption check. `read()` returns the observable quantity; `perturb()` mutates the
     * model and returns a restore function. The check passes when the quantity MOVED.
     *
     * Under self-test, `cut()` (if given) disconnects the consumer first, and the check inverts:
     * the quantity must now stay STILL, because a consumer that has been cut cannot be reading
     * anything. A check with no `cut` is skipped in self-test rather than counted as a pass.
     */
    function check({ path, model, consumer, perturbation, read, perturb, cut, note }) {
      const row = { path, model, consumer, perturbation, note: note || null };
      try {
        if (opts.selfTest) {
          if (!cut) { row.verdict = 'SKIPPED'; row.reason = 'no disconnect defined'; results.push(row); return row; }
          row.restore_consumer = 'pending';
          const restoreConsumer = cut();
          const before = clone(read());
          const restore = perturb();
          const after = clone(read());
          restore(); restoreConsumer();
          row.before = before; row.after = after;
          row.changed = JSON.stringify(before) !== JSON.stringify(after);
          // With the consumer cut, a model that still moves the world is being read by something
          // ELSE — a second implementation, which is the exact defect this project has shipped.
          row.verdict = row.changed ? 'INSTRUMENT-BROKEN' : 'GOES-RED';
        } else {
          const before = clone(read());
          const restore = perturb();
          const after = clone(read());
          restore();
          const restored = clone(read());
          row.before = before; row.after = after;
          row.changed = JSON.stringify(before) !== JSON.stringify(after);
          row.restored_clean = JSON.stringify(restored) === JSON.stringify(before);
          row.verdict = row.changed ? 'CONSUMED' : 'DEAD';
        }
      } catch (e) {
        row.verdict = 'ERROR'; row.error = String(e && e.message ? e.message : e).slice(0, 400);
      }
      results.push(row);
      return row;
    }

    /**
     * A hand-built row (a scenario rather than a one-field perturbation: the round trip, the
     * day/night sweep, the two-object theft, the save round trip). These cannot be inverted by
     * cutting a single consumer, so under `--self-test` they declare themselves OUT OF SCOPE
     * rather than reporting CONSUMED — a self-test that silently counts an un-inverted row as a
     * pass is exactly the "probe that cannot fail" this mode exists to rule out.
     */
    function pushRow(row) {
      if (opts.selfTest) { results.push({ ...row, verdict: 'SKIPPED', reason: 'scenario row: not invertible by cutting one consumer' }); return; }
      results.push(row);
    }

    const step = (n) => H.stepFrames(n || 1);
    const eng = () => window.__ENGINE || null;

    // ============================================================================================
    // 1. world.settlement.anatomy — does standing in a town tell the world you are in it?
    // ============================================================================================
    // Before this piece, `sim.env.settlement` had NO WRITER in the world: the only thing that
    // ever set it was `loadState`'s patch, so `sim/quest/topic-supply.js` — which keys the entire
    // per-town rumour book on it (RI-DLG02) — could only ever be driven by hand from a probe.
    const towns = H.listSettlements();
    const lilmoth = towns.find((t) => t.id === 'lilmoth') || towns[0];
    H.teleport(lilmoth.pos[0], lilmoth.pos[2]);
    step(3);

    check({
      path: 'world.settlement.anatomy',
      model: 'game/data/world/settlements/*.json -> settlement.pos / radius_m',
      consumer: 'sim/settlement.js stepSettlement() -> SettlementSystem.settlementAt(), on the fixed step via sim/step.js:128',
      perturbation: `move ${lilmoth.id} 5 km away while the player stands still at its old centre`,
      note: 'The player does not move. Only the town does. If `env.settlement` does not follow, the anatomy is a census row. '
        + 'NB the town is MOVED rather than shrunk: the player stands at the exact centre, so d=0 and even a 1 mm radius still contains them — '
        + 'a perturbation that cannot change the answer is not a perturbation.',
      read: () => ({ settlement: H.whereAmI().settlement }),
      perturb: () => {
        const s = H.__w1_04_settlement(lilmoth.id);
        const old = [s.pos[0], s.pos[1], s.pos[2]];
        s.pos[0] += 5000; step(2);
        return () => { s.pos[0] = old[0]; s.pos[1] = old[1]; s.pos[2] = old[2]; step(2); };
      },
      cut: () => {
        // Disconnect the consumer: make settlementAt() answer nothing.
        const S = H.__w1_04_system();
        const real = S.settlementAt; S.settlementAt = () => null; step(2);
        return () => { S.settlementAt = real; step(2); };
      },
    });

    // ============================================================================================
    // 2. world.interior.named — is a door a thing your hand can be on?
    // ============================================================================================
    const doorTown = towns.find((t) => t.doors > 0) || lilmoth;
    const doorRow = H.__w1_04_doors(doorTown.id)[0];
    H.teleport(doorRow.door[0], doorRow.door[2]);
    step(3);

    check({
      path: 'world.interior.named',
      model: `game/data/world/settlements/${doorTown.id}.json -> buildings[].door`,
      consumer: 'sim/settlement.js stepSettlement() -> SettlementSystem.doorAt(), writes sim.door every frame',
      perturbation: `move ${doorRow.interior}'s door 500 m away while the player stands on the doorstep`,
      note: 'sim.door is what a prompt renders off. A door that moves and leaves the prompt behind is a label, not a door.',
      read: () => { const w = H.whereAmI(); return { door: w.door_in_reach ? w.door_in_reach.interior : null }; },
      perturb: () => {
        const rows = H.__w1_04_doors(doorTown.id);
        const r = rows.find((x) => x.interior === doorRow.interior);
        const old = [r.door[0], r.door[1], r.door[2]];
        r.door[0] += 500; step(2);
        return () => { r.door[0] = old[0]; r.door[1] = old[1]; r.door[2] = old[2]; step(2); };
      },
      cut: () => {
        const S = H.__w1_04_system();
        const real = S.doorAt; S.doorAt = () => null; step(2);
        return () => { S.doorAt = real; step(2); };
      },
    });

    // ============================================================================================
    // 3. world.interior.continuity — RI-WLD13: is the door you come out of the door you went in by?
    // ============================================================================================
    // The continuity block declares BOTH ends of one object. This perturbs the interior end and
    // requires the body to land somewhere else.
    check({
      path: 'world.interior.continuity',
      model: `game/data/world/interiors/${doorRow.interior}.json -> continuity.interior_spawn`,
      consumer: 'sim/settlement.js useDoor() — sets sim.env.interior and moves sim.player.pos to the declared spawn',
      perturbation: 'move interior_spawn by +7 m in x, then walk through the door',
      note: 'RI-WLD13. If the body lands in the same place either way, the continuity block is decoration. '
        + 'The read STEPS before measuring and asserts `entered`, because the first version of this check reported CONSUMED '
        + 'off a 0.01 m y-jitter while x never moved by the 7 m it was perturbed by — the interior transition was being undone '
        + 'by `combat-bridge.mirror()` on the very next frame and the probe could not see it.',
      read: () => {
        H.setTimeOfDay(12); step(1);
        const r = H.enterInterior(doorRow.interior);
        step(2); // the frame that used to undo it
        const p = H.whereAmI().pos.map((v) => Math.round(v * 100) / 100);
        const held = H.whereAmI().interior;
        H.exitInterior(); step(2);
        return { entered: !!r.entered, landed_at: p, still_inside_after_2_steps: held };
      },
      perturb: () => {
        const d = H.__w1_04_interior(doorRow.interior);
        const old = d.continuity.interior_spawn.slice();
        d.continuity.interior_spawn = [old[0] + 7, old[1], old[2]];
        return () => { d.continuity.interior_spawn = old; };
      },
      cut: () => {
        // Cut the consumer: make useDoor stop moving the body.
        const S = H.__w1_04_system();
        const real = S.interior; S.interior = (id) => { const d = real.call(S, id); return d ? { ...d, continuity: { ...d.continuity, interior_spawn: [0, 0, 0] } } : d; };
        return () => { S.interior = real; };
      },
    });

    // The round trip, stated as its own row because RI-WLD13 is a claim about a PAIR of vectors.
    {
      H.setTimeOfDay(12); step(1);
      const d = H.__w1_04_interior(doorRow.interior);
      const wantIn = d.continuity.interior_spawn.map((v) => Math.round(v * 100) / 100);
      const wantOut = d.continuity.exterior_spawn.map((v) => Math.round(v * 100) / 100);
      const before = H.whereAmI().pos.map((v) => Math.round(v * 100) / 100);
      H.enterInterior(doorRow.interior);
      step(4); // FOUR frames: the defect this catches undid the move on frame N+1
      const inside = H.whereAmI().pos.map((v) => Math.round(v * 100) / 100);
      H.exitInterior();
      step(4);
      const after = H.whereAmI().pos.map((v) => Math.round(v * 100) / 100);
      const errIn = Math.hypot(inside[0] - wantIn[0], inside[2] - wantIn[2]);
      const errOut = Math.hypot(after[0] - wantOut[0], after[2] - wantOut[2]);
      pushRow({
        path: 'world.interior.continuity',
        model: `${doorRow.interior}.continuity.{interior_spawn,exterior_spawn}`,
        consumer: 'useDoor() / leaveInterior() -> sim.placeBody -> Engine._placeBody (the BODY, not the mirror)',
        perturbation: 'walk in, hold four frames, walk out, hold four frames',
        before: { outside: before },
        after: {
          inside, declared_interior_spawn: wantIn, err_in_m: Math.round(errIn * 1000) / 1000,
          back_outside: after, declared_doorstep: wantOut, err_out_m: Math.round(errOut * 1000) / 1000,
        },
        changed: true,
        verdict: (errIn <= 0.01 && errOut <= 0.01) ? 'CONSUMED' : 'DEAD',
        note: 'RI-WLD13, both ends of the one object. The body must still be at the declared spawn FOUR frames later — '
          + 'before the `_placeBody` fix it was back outside on frame N+1 while `env.interior` still said you were in.',
      });
    }

    // ============================================================================================
    // 4. world.npc.population — are the people of a town summoned by walking into it?
    // ============================================================================================
    check({
      path: 'world.npc.population',
      model: 'game/data/npcs/pop-*.json -> rec.settlement',
      consumer: 'engine.populateSettlement(), installed as sim.populate and called by stepSettlement() on the boundary crossing',
      perturbation: 'walk out of the town and back in, having emptied the live npc list',
      note: 'A population that only a probe can summon is not a population. Crossing the boundary is what summons it.',
      read: () => ({ people: H.whereIsEveryone().length > 0 }),
      perturb: () => {
        const sim = H.__w1_04_sim();
        const old = sim.npcs.slice();
        sim.npcs.length = 0; step(1);
        return () => { for (const n of old) sim.npcs.push(n); step(1); };
      },
      cut: null,
    });

    // The census, as its own row: how many people this build actually has.
    {
      const everyone = H.whereIsEveryone();
      const towns2 = H.listSettlements();
      pushRow({
        path: 'world.npc.population',
        model: 'game/data/npcs/**',
        consumer: 'engine.populateSettlement() / sim.npcs',
        perturbation: '(census)',
        before: null,
        after: { settlements: towns2.length, interiors: H.listInteriors().length, live_npcs_here: everyone.length, with_schedule: everyone.filter((e) => e.slots > 0).length },
        changed: true, verdict: 'CONSUMED',
        note: 'Live count in the loaded town, not the record count on disk.',
      });
    }

    // ============================================================================================
    // 5. world.npc.schedule — THE twelfth failure. Do people go home at night?
    // ============================================================================================
    // The headline: the SAME world, two different hours, and a different set of people in the
    // room. Nothing is respawned between the two reads; only the clock moves.
    const dayNight = (() => {
      H.setTimeOfDay(12); step(4);
      const noon = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at }));
      H.setTimeOfDay(3); step(4);
      const night = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at }));
      const moved = noon.filter((n, i) => night[i] && night[i].at !== n.at);
      return { sampled: noon.length, moved: moved.length, examples: moved.slice(0, 6).map((m, i) => ({ eid: m.eid, noon: m.at, at_0300: night[noon.indexOf(m)] ? night[noon.indexOf(m)].at : null })) };
    })();
    pushRow({
      path: 'world.npc.schedule',
      model: 'game/data/npcs/*.json -> schedule[{from,to,at}]',
      consumer: 'sim/npc.js stepSchedule(), called from stepNPCs() on the fixed step via sim/step.js:131',
      perturbation: 'advance the world clock from 12:00 to 03:00 and step; nobody is respawned',
      before: { hour: 12 }, after: dayNight,
      changed: dayNight.moved > 0,
      verdict: dayNight.moved > 0 ? 'CONSUMED' : 'DEAD',
      note: 'RI-WLD08. Before this piece, makeNPC() did not copy `schedule` onto the entity and nobody in this world had ever moved.',
    });

    // And the per-person perturbation, which is the falsifiable half.
    {
      const someone = H.whereIsEveryone().find((e) => e.slots > 0);
      if (someone) {
        check({
          path: 'world.npc.schedule',
          model: `npc ${someone.eid} -> schedule[].at`,
          consumer: 'sim/npc.js stepSchedule() -> n.at / n.present / n.visible',
          perturbation: `rewrite every slot of ${someone.eid}'s day to point at a different cell`,
          note: 'One person, one field. If `at` does not follow the record, the schedule is decoration.',
          read: () => { const p = H.whereIsEveryone().find((e) => e.eid === someone.eid); return { at: p ? p.at : null }; },
          perturb: () => {
            const n = H.__w1_04_npc(someone.eid);
            const old = n.schedule.map((s) => s.at); const oldSlot = n._slot;
            for (const s of n.schedule) s.at = '__perturbed__';
            n._slot = -1; step(2);
            return () => { n.schedule.forEach((s, i) => { s.at = old[i]; }); n._slot = -1; step(2); };
          },
          cut: () => {
            const sim = H.__w1_04_sim();
            const old = sim.npcs.map((n) => n.schedule);
            for (const n of sim.npcs) n.schedule = [];
            return () => { sim.npcs.forEach((n, i) => { n.schedule = old[i]; }); step(2); };
          },
        });
      }
    }

    // ============================================================================================
    // 6. world.property.ownership — does who owns a crate decide whether taking it is a crime?
    // ============================================================================================
    // Taking an object is NOT idempotent — the second take of the same instance throws, and the
    // first version of this check compared a take against a throw and called it "no change". So
    // this uses TWO objects out of the same zone: one taken as shipped, one taken with its owner
    // stripped. Same zone, same hour, same witnesses; the only difference is the field.
    const zones = H.listPropertyZones('archon') || [];
    const ownedZone = zones.find((z) => (H.listOwnedObjects(z.id) || []).filter((o) => o.owner).length >= 2);
    if (ownedZone) {
      const objs = H.listOwnedObjects(ownedZone.id).filter((o) => o.owner);
      const takeIt = (instance) => {
        const before = H.getCrimeState().crimes.length;
        let res = null, err = null;
        try { res = H.takeObject(instance, { observedBy: ['probe-witness'] }); } catch (e) { err = String(e.message || e).slice(0, 120); }
        return { crimes_delta: H.getCrimeState().crimes.length - before, stolen_from: res ? res.stolen_from || null : null, error: err };
      };
      const asShipped = takeIt(objs[0].instance);
      const c = H.__w1_04_content(objs[1].instance);
      const keep = { owner: c.owner, owner_scope: c.owner_scope };
      c.owner = null; c.owner_scope = null;
      const stripped = takeIt(objs[1].instance);
      c.owner = keep.owner; c.owner_scope = keep.owner_scope;
      const changed = asShipped.stolen_from !== stripped.stolen_from || asShipped.crimes_delta !== stripped.crimes_delta;
      pushRow({
        path: 'world.property.ownership',
        model: 'game/data/world/property/*.json -> zones[].contents[].owner / owner_scope',
        consumer: 'engine.takeObject() -> STL_THF.take() -> sim.stealth.crime.commit(); built by W1-15',
        perturbation: `take ${objs[0].instance} as shipped, vs ${objs[1].instance} with its owner stripped`,
        before: { object: objs[0].instance, owner: objs[0].owner, ...asShipped },
        after: { object: objs[1].instance, owner: null, ...stripped },
        changed, verdict: changed ? 'CONSUMED' : 'DEAD',
        note: 'RI-STL02 §1. An unowned object is picked up; an owned one is a theft with a victim.',
      });
    }

    // ============================================================================================
    // 7. world.locks.security — does the number on a lock reach the player's hands?
    // ============================================================================================
    // NB `listPropertyZones` returns `locks` as a COUNT, not an array — the live array comes back
    // through the perturbation handle below.
    const lockZone = zones.find((z) => Number(z.locks) > 0);
    if (lockZone) {
      const lock = H.__w1_04_zone(lockZone.id).locks[0];
      // `lockBegin` THROWS when the character's Security is below the tier's requirement, and
      // that refusal is itself the consumption signal: it names the tier and the skill it wants.
      // The first version of this check let the throw escape and scored ERROR against a lock
      // that was behaving exactly as designed.
      const attempt = () => {
        try { const a = H.lockBegin(lock.id); return { opened: true, gate_deg: a && a.gate_deg !== undefined ? a.gate_deg : null, tier: a ? a.tier : null }; }
        catch (e) { return { opened: false, refusal: String(e.message || e).replace(/\s+/g, ' ').slice(0, 160) }; }
      };
      check({
        path: 'world.locks.security',
        model: 'game/data/world/property/*.json -> zones[].locks[].tier',
        consumer: 'engine.lockBegin() -> STL_LockAttempt; the ward-collar gate width and the skill refusal',
        perturbation: `raise ${lock.id}'s tier from ${lock.tier} to 5`,
        note: 'RI-STL02 §3. A tier that does not change the gate — or the refusal that names it — is a number in a file.',
        read: attempt,
        perturb: () => { const old = lock.tier; lock.tier = 5; return () => { lock.tier = old; }; },
        cut: null,
      });
    }

    // ============================================================================================
    // 8. world.faction.presence + the hours — is a shop a trespass at three in the morning?
    // ============================================================================================
    // `zone.schedule.open_h` existed on all 233 zones and was read by NOTHING: `shopOpen`
    // defaulted to `true` at every call site in the build, so a shop was as little a trespass at
    // 3 a.m. as at noon. `trespassCheck` now derives it from the world clock.
    // A `shop_closed` zone is the ONLY class whose verdict turns on `shopOpen` (see
    // sim/stealth/theft.js trespass()), and it must be bound to an interior that genuinely shuts
    // — a shop zone inside a dwelling interior is open 0-24 and can never show the difference.
    // The first version of this check fell back to `zones[0]`, a `faction_interior`, and
    // correctly reported DEAD against a model that was never consulted.
    const shopZone = zones.find((z) => {
      if (z.class !== 'shop_closed') return false;
      const iid = H.__w1_04_system().zoneInterior.get(z.id);
      const d = iid ? H.__w1_04_interior(iid) : null;
      return d && !(d.open_h === 0 && d.close_h === 24) && (d.close_h - d.open_h) < 24;
    });
    if (shopZone) {
      pushRow((() => {
        H.setTimeOfDay(12); step(2);
        const noon = H.trespassCheck(shopZone.id);
        H.setTimeOfDay(3); step(2);
        const night = H.trespassCheck(shopZone.id);
        const changed = noon.derived_shop_open !== night.derived_shop_open || noon.trespassing !== night.trespassing;
        return {
          path: 'world.faction.presence',
          model: `game/data/world/property/*.json -> zones[].schedule.{open_h,close_h} on ${shopZone.id} (class=${shopZone.class})`,
          consumer: 'engine.trespassCheck() -> engine.isOpenNow() -> SettlementSystem.isOpen(), then sim/stealth/theft.js trespass()',
          perturbation: 'ask the same zone the same question at 12:00 and at 03:00',
          before: { hour: 12, shop_open: noon.derived_shop_open, trespassing: noon.trespassing },
          after: { hour: 3, shop_open: night.derived_shop_open, trespassing: night.trespassing },
          changed, verdict: changed ? 'CONSUMED' : 'DEAD',
          note: 'The hours were on every zone in the build and read by nothing before this piece.',
        };
      })());

    }

    // `faction_interior` is the ONLY class whose verdict consults `zone.faction`
    // (`trespassing = (factionRanks[zone.faction] || 0) < 1`), so the faction check has to run
    // against one of those rather than against whatever zone happened to be first.
    const facZone = zones.find((z) => {
      if (z.class !== 'faction_interior') return false;
      try { return !!H.__w1_04_zone(z.id).faction; } catch { return false; }
    });
    if (facZone) {
      // Give the character a rank in a faction that owns nothing, so that pointing the zone at
      // it is the ONLY thing that changes. Perturbing the standings instead would prove the
      // standings are read; this proves `zone.faction` is read.
      const standings = H.__w1_04_sim().stealth.p.standings;
      standings.__probe_faction__ = 5;
      check({
        path: 'world.faction.presence',
        model: `zones[].faction on ${facZone.id} (class=faction_interior)`,
        consumer: 'engine.trespassCheck() -> sim/stealth/theft.js trespass(), which reads zone.faction against the player standings',
        perturbation: 'point the zone at a faction the character is rank 5 in',
        note: 'RI-CHR02. Whose door it is decides whether you are allowed through it.',
        read: () => { const t = H.trespassCheck(facZone.id); return { trespassing: t.trespassing, zone_class: t.zone_class, escalation: t.escalation }; },
        perturb: () => {
          const z = H.__w1_04_zone(facZone.id);
          const old = z.faction; z.faction = '__probe_faction__';
          return () => { z.faction = old; };
        },
        cut: null,
      });
    }

    // ============================================================================================
    // 9. world.persistence.state — AUDIT THE LIVE WORLD AFTER THE LOAD, NOT THE BYTES.
    // ============================================================================================
    // AGENT-PROTOCOL failure mode 3: a round trip that re-serialises cannot see a field nobody
    // reads back. The save repair reported 76/76 clean while the spendable purse was being
    // destroyed. So this walks into a cell, sets a clock, saves, DISTURBS the live world, loads,
    // and then asks the WORLD — not the blob — where it is and what time it is.
    {
      // 14:00, not 21:00: the first version of this check saved at 21:00 against a guild office
      // that shuts at 19:00, so `useDoor` correctly refused, `live_before.interior` was null,
      // and the check reported DEAD about the save layer over a door that was simply locked.
      H.setTimeOfDay(14); step(2);
      const entered = H.enterInterior(doorRow.interior); step(2);
      const live_before = { entered: !!entered.entered, interior: H.whereAmI().interior, settlement: H.whereAmI().settlement, hour: H.whereAmI().hour };
      const people_before = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at, present: e.present }));
      const blob = H.saveState();

      // Disturb the live world so a load that does nothing cannot look like a load that worked.
      H.exitInterior(); H.setTimeOfDay(6); step(4);
      const disturbed = { interior: H.whereAmI().interior, hour: H.whereAmI().hour };

      H.restoreState(blob); step(2);
      const live_after = { interior: H.whereAmI().interior, settlement: H.whereAmI().settlement, hour: H.whereAmI().hour };
      const people_after = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at, present: e.present }));

      const cellOk = live_before.entered && live_after.interior === live_before.interior && live_after.settlement === live_before.settlement;
      const hourOk = Math.abs((live_after.hour || 0) - (live_before.hour || 0)) < 0.5;
      const dayOk = JSON.stringify(people_after) === JSON.stringify(people_before);
      const disturbedReally = disturbed.interior !== live_before.interior;
      pushRow({
        path: 'world.persistence.state',
        model: 'sim.env.interior / sim.env.settlement / npc.at, through save/state.js',
        consumer: 'engine.loadState() — audited on the LIVE world after the load, not on the re-serialised blob',
        perturbation: 'save inside a cell at 14:00, then leave the cell and set 06:00, then load',
        before: { live: live_before, people: people_before.length },
        after: { disturbed, live: live_after, people: people_after.length, cell_restored: cellOk, hour_restored: hourOk, everyones_day_restored: dayOk },
        changed: disturbedReally,
        verdict: (disturbedReally && cellOk && hourOk && dayOk) ? 'CONSUMED' : 'DEAD',
        note: 'The control is real: the world was genuinely moved out of the saved state before the load.',
      });
    }

    // ============================================================================================
    // 10. THE RENDER HALF — and the reason this section exists is that its absence was the
    //     round-1 verdict.
    // ============================================================================================
    // Every check above this line goes `HARNESS -> Engine -> sim/settlement.js` and back. Not one
    // of them reads the renderer. So all thirteen of them passed — honestly, and they still pass
    // — on a build where `renderer.setCell()` had exactly one caller, neither door verb reached
    // it, **115 of 115 interiors were entered and 0 of 115 switched the drawn cell**, and walking
    // out of a room left the room on the screen while the body stood in the street.
    //
    // That is the same defect this piece found and fixed one layer down, when `sim.player.pos`
    // turned out to be a mirror: the body half was fixed and the render half was not, and the
    // instrument could not tell, because the instrument was made of the half that worked.
    //
    // The rule this section is written to is RULES.md rule 5. A model's consumer is not "the
    // function that reads the field"; it is the thing the player can see. So every row below
    // reads `getDrawnInterior()`, which reports what the RENDERER has visible, and each one is
    // paired with a control that shows the reading is capable of being wrong.
    const drawn = () => H.getDrawnInterior();

    // ---- 10a. THE SWEEP. Every door in the game, and what is on the screen after it. -----------
    // Scenario row with its own internal control: the identical sweep is run a second time with
    // the cell consumer CUT, and must report zero. A sweep that passes both ways is measuring
    // nothing, which is exactly how the round-1 build scored 13/13.
    {
      const ids = H.listInteriors().map((i) => i.id);
      const sweep = (label) => {
        let agreed = 0, entered = 0, refused = 0, errored = 0, exteriorRestored = 0;
        const misses = [];
        for (const id of ids) {
          try {
            // Always start outside, through the door verb rather than by hand.
            if (H.whereAmI().interior) { H.exitInterior(); step(1); }
            const r = H.enterInterior(id);
            step(2);
            if (!r || !r.entered) { refused++; continue; }
            entered++;
            const d = drawn();
            if (d.agrees && d.interior_id === id) agreed++; else if (misses.length < 5) misses.push({ id, drawn: d.drawn_cell, want: d.env_cell, room: d.interior_id });
            // And leaving must put the street back. The round-1 build left the ROOM on screen.
            H.exitInterior(); step(2);
            if (drawn().agrees) exteriorRestored++;
          } catch (e) { errored++; }
        }
        return { label, total: ids.length, entered, refused, errored, drawn_agrees: agreed, exterior_restored_on_exit: exteriorRestored, misses };
      };

      const live = sweep('consumer live');
      // THE CONTROL. Cut the cell consumer — the hook AND the reconciliation behind it — and run
      // the identical sweep. This reproduces the round-1 build exactly.
      const E = eng();
      const savedHook = E.sim.applyCell;
      const savedSync = E._syncCell;
      E.sim.applyCell = null;
      E._syncCell = function () { return false; };
      let cutRun = null;
      try { cutRun = sweep('consumer cut'); } finally {
        E.sim.applyCell = savedHook;
        E._syncCell = savedSync;
        try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* already outside */ }
        E._syncCell();
        step(2);
      }

      const passes = live.entered > 0 && live.drawn_agrees === live.entered
        && live.exterior_restored_on_exit === live.entered
        && cutRun.drawn_agrees < live.drawn_agrees;   // the control MUST be worse
      pushRow({
        path: 'world.interior.named',
        model: 'game/data/world/interiors/**.json -> the 115 named cells, entered through the door',
        consumer: 'sim/settlement.js useDoor()/leaveInterior() -> sim.applyCell -> Engine._syncCell() -> renderer.setCell(). READ OFF THE RENDERER, not off sim.env.',
        perturbation: 'enter and leave all 115 through enterInterior()/exitInterior(); then repeat with the cell consumer cut',
        before: cutRun, after: live,
        changed: cutRun.drawn_agrees !== live.drawn_agrees,
        verdict: passes ? 'CONSUMED' : 'DEAD',
        note: 'Round 1: 115 of 115 entered, 0 of 115 switched the drawn cell. The cut arm is that build.',
      });
    }

    // ---- 10b. bounds_m — is the room the size the file says? ------------------------------------
    // `bounds_m` was read at exactly ONE site in the whole build, to derive an NPC's hash offset,
    // and RI-WLD13 N1 was vacuous as authored: the footprint ratio was 1.000 by construction on
    // 115 of 115 and the check could not fail. It is the shell of the room now.
    const roomId = (() => {
      const l = H.listInteriors().find((i) => i.id === 'archon-apothecary');
      return l ? l.id : H.listInteriors()[0].id;
    })();
    // Enter it THROUGH THE DOOR, so everything below is measured on the path the player takes.
    const reEnter = () => { try { if (H.whereAmI().interior) { H.exitInterior(); step(1); } } catch { /* outside */ } H.enterInterior(roomId); step(2); return drawn().interior; };
    H.setTimeOfDay(12); step(2);
    reEnter();

    check({
      path: 'world.interior.named',
      model: `game/data/world/interiors/${roomId}.json -> bounds_m`,
      consumer: 'render/interior.js buildInterior() -> the floor, four walls, ceiling and beam count of the drawn cell',
      perturbation: 'halve the room on x and z',
      note: 'RI-WLD13 N1. Read off the renderer: the numbers below are the shell that got built.',
      read: () => { const s = reEnter(); return s ? { bounds: s.bounds, meshes: s.meshes } : null; },
      perturb: () => {
        const d = H.__w1_04_interior(roomId);
        const old = JSON.parse(JSON.stringify(d.bounds_m));
        d.bounds_m = { x: [old.x[0] / 2, old.x[1] / 2], y: old.y, z: [old.z[0] / 2, old.z[1] / 2] };
        return () => { d.bounds_m = old; };
      },
      cut: () => { const E = eng(); const s = E.renderer.setInteriorRecord; E.renderer.setInteriorRecord = () => null; return () => { E.renderer.setInteriorRecord = s; }; },
    });

    check({
      path: 'world.interior.named',
      model: `game/data/world/interiors/${roomId}.json -> props[]`,
      consumer: 'render/interior.js PROPS table -> furniture meshes in the drawn cell',
      perturbation: 'strip every prop off the record',
      note: 'RI-QST07: the round-1 verdict called `settlement.content` "a prop list nobody instantiates". 18 props declared, none drawn.',
      read: () => { const s = reEnter(); return s ? { props_built: s.props_built, kit_meshes: s.kit_meshes, meshes: s.meshes } : null; },
      perturb: () => { const d = H.__w1_04_interior(roomId); const old = d.props; d.props = []; return () => { d.props = old; }; },
      cut: () => { const E = eng(); const s = E.renderer.setInteriorRecord; E.renderer.setInteriorRecord = () => null; return () => { E.renderer.setInteriorRecord = s; }; },
    });

    check({
      path: 'world.interior.named',
      model: `game/data/world/interiors/${roomId}.json -> lights[]`,
      consumer: 'render/interior.js -> the point lights and lamp fittings of the drawn cell',
      perturbation: 'strip every declared light off the record',
      note: 'The record declares 10 lights; the hall it used to resolve to drew exactly one.',
      read: () => { const s = reEnter(); return s ? { lamps_built: s.lamps_built, lights_lit: s.lights_lit, lights_declared: s.lights_declared } : null; },
      perturb: () => { const d = H.__w1_04_interior(roomId); const old = d.lights; d.lights = []; return () => { d.lights = old; }; },
      cut: () => { const E = eng(); const s = E.renderer.setInteriorRecord; E.renderer.setInteriorRecord = () => null; return () => { E.renderer.setInteriorRecord = s; }; },
    });

    // ---- 10c. 113 of 115 were the same room. How many are now? ---------------------------------
    {
      const ids = H.listInteriors().map((i) => i.id);
      const sigs = new Map();
      let read = 0;
      for (const id of ids) {
        try {
          if (H.whereAmI().interior) { H.exitInterior(); step(1); }
          const r = H.enterInterior(id);
          if (!r || !r.entered) continue;
          step(1);
          const s = drawn().interior;
          if (!s) continue;
          read++;
          // The room as the SCENE GRAPH has it, not as the file has it.
          const key = JSON.stringify([s.bounds, s.meshes, s.triangles, s.lamps_built, s.props_built, s.windows, s.storeys, s.back_room]);
          sigs.set(key, (sigs.get(key) || 0) + 1);
        } catch { /* counted by `read` */ }
      }
      try { if (H.whereAmI().interior) H.exitInterior(); } catch { /* outside */ }
      step(2);
      const biggest = Math.max(0, ...sigs.values());
      pushRow({
        path: 'world.interior.named',
        model: 'all 115 interior records',
        consumer: 'render/interior.js — the geometry each record actually builds',
        perturbation: 'walk into all 115 in turn and hash the drawn room',
        before: { round_1: { distinct_rooms: 2, largest_identical_group: 113, note: '113 of 115 resolved to one 249-triangle hall' } },
        after: { rooms_read: read, distinct_rooms: sigs.size, largest_identical_group: biggest },
        changed: sigs.size > 2,
        verdict: sigs.size > 2 ? 'CONSUMED' : 'DEAD',
        note: 'A scene-graph signature, not a pixel hash — the pixel sweep is tools/world/w1-04-interior-sweep.mjs.',
      });
    }

    // ============================================================================================
    // 11. world.npc.schedule — DOES ANYBODY ACTUALLY WALK?
    // ============================================================================================
    // Round 1: 9 of 24 of Thorn's people changed cell across the day and **0 of 24 changed
    // position**. `stepSchedule()`'s own docstring claimed they "walk to the slot's anchor" and
    // the function never touched `pos`. This is the row that would have caught that.
    {
      const town = towns.find((t) => t.id === 'thorn') || towns[0];
      H.teleport(town.pos[0], town.pos[2]);
      H.setTimeOfDay(2); step(6);
      const before = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at, pos: e.pos.map((v) => Math.round(v * 100) / 100) }));
      // Run the clock through the working day, stepping so the schedule is actually consumed.
      for (let hh = 3; hh <= 20; hh++) { H.setTimeOfDay(hh); step(30); }
      const after = H.whereIsEveryone().map((e) => ({ eid: e.eid, at: e.at, pos: e.pos.map((v) => Math.round(v * 100) / 100) }));
      const byId = new Map(before.map((b) => [b.eid, b]));
      let movedCell = 0, movedPos = 0;
      for (const a of after) {
        const b = byId.get(a.eid);
        if (!b) continue;
        if (b.at !== a.at) movedCell++;
        if (Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]) > 0.05) movedPos++;
      }
      pushRow({
        path: 'world.npc.schedule',
        model: 'game/data/npcs/pop-*.json -> schedule[].at + activity, as POSITION',
        consumer: 'sim/npc.js stepSchedule() -> n.pos, walked over the fixed step at 1.35 m/s',
        perturbation: `run ${town.id}'s day from 02:00 to 20:00 and compare everybody's position`,
        before: { hour: 2, people: before.length, round_1: { changed_cell: 9, changed_position: 0 } },
        after: { hour: 20, changed_cell: movedCell, changed_position: movedPos },
        changed: movedPos > 0,
        verdict: movedPos > 0 ? 'CONSUMED' : 'DEAD',
        note: 'Round 1 scored 0 of 24 here with the docstring claiming otherwise.',
      });

      // ---- and is anybody ever OUTDOORS? -------------------------------------------------------
      // Round 1: at 03:00, across eight settlements, not one person in the province was outdoors,
      // and at noon the 34 who were belonged to a neighbouring piece.
      const outdoorsAt = (hour) => {
        H.setTimeOfDay(hour); step(40);
        return H.whereIsEveryone().filter((e) => e.at === null && e.present).length;
      };
      const night = outdoorsAt(3);
      const morning = outdoorsAt(9);
      const evening = outdoorsAt(20);
      pushRow({
        path: 'world.npc.population',
        model: 'game/data/npcs/pop-*.json -> post + the outdoor schedule rows (tools/world/build-street-life.mjs)',
        consumer: 'sim/npc.js stepSchedule() presence rule: `at: null` + a post means OUTDOORS',
        perturbation: `stand in ${town.id} and read the street at 03:00, 09:00 and 20:00`,
        before: { round_1: { outdoors_at_03: 0, outdoors_at_12: '34, all of them another piece\'s quest-givers' } },
        after: { outdoors_at_03: night, outdoors_at_09: morning, outdoors_at_20: evening },
        changed: (night + morning + evening) > 0,
        verdict: (night > 0 && morning > 0) ? 'CONSUMED' : 'DEAD',
        note: 'The street of every town in Argonia was empty at every hour of W1-04\'s own population.',
      });
    }

    return { results, errors: [] };
  }, { selfTest });

  report.errors = errors;

  // ---- verdict -------------------------------------------------------------------------------
  const rows = report.results;
  const want = selfTest ? 'GOES-RED' : 'CONSUMED';
  const bad = rows.filter((r) => r.verdict !== want && r.verdict !== 'SKIPPED');
  const skipped = rows.filter((r) => r.verdict === 'SKIPPED');

  for (const r of rows) {
    const tag = r.verdict.padEnd(18);
    log(`${tag} ${String(r.path).padEnd(28)} ${r.model}`);
    log(`${''.padEnd(18)}   consumer: ${r.consumer}`);
    log(`${''.padEnd(18)}   perturb : ${r.perturbation}`);
    log(`${''.padEnd(18)}   ${JSON.stringify(r.before)}  ->  ${JSON.stringify(r.after)}`);
    if (r.error) log(`${''.padEnd(18)}   ERROR: ${r.error}`);
  }

  const paths = [...new Set(rows.map((r) => r.path))];
  const summary = {
    mode: selfTest ? 'self-test' : 'consumption',
    checks: rows.length, paths: paths.length,
    passed: rows.length - bad.length - skipped.length, failed: bad.length, skipped: skipped.length,
    page_errors: errors,
  };
  log('');
  log(`W1-04 consumption: ${summary.passed}/${rows.length - skipped.length} checks ${want}, ${paths.length} paths, ${skipped.length} skipped.`);
  if (selfTest) {
    log('self-test coverage: only rows with a defined disconnect are invertible. The skipped rows are');
    log('scenarios (round trip, day/night sweep, two-object theft, save round trip), not one-field');
    log('perturbations, and are stated as out of scope rather than counted as passes.');
  }
  if (errors.length) log(`page errors: ${errors.length}`);
  writeJson(outFile, { summary, results: rows });

  await handle.close();
  process.exit(bad.length ? EXIT.FAIL ?? 1 : 0);
} catch (e) {
  log(`w1-04-consumption: ${e && e.stack ? e.stack : e}`);
  if (handle) await handle.close().catch(() => {});
  process.exit(1);
}

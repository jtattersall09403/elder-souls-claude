#!/usr/bin/env node
/**
 * w1-13-r2-levelling-loop.mjs — THE WHOLE LOOP, WALKED, WITH THE MONEY SPENT AT THE END.
 *
 * W1-13 round 2. The round-1 verdict's named gap was that the level-up screen — `RI-PRG04` §1's
 * "the only place levelling is possible" — was refused at all 29 sapwells, because
 * `game/src/engine.js` gated it on `HearthSystem.atHearth()` and `HearthSystem` had no such
 * method. The remedy is one method body. THE METHOD BODY IS NOT THE DELIVERABLE: this probe is,
 * because a gate that opens is worth nothing unless the thing behind it takes your souls.
 *
 * What it does, per well, with NO `setAtHearth()` anywhere in the path:
 *
 *   1. Stand 60 m off the basin and WALK IN through `walkPath` — ordinary locomotion, the
 *      province streamed around the body by `_streamProvince()` from the fixed step.
 *   2. Rest. (`restAt` is the interaction verb; the arrival is walked.)
 *   3. Open the level-up screen — through `openMenu`, which runs the same `ctx.atHearth` gate
 *      the input layer runs.
 *   4. Spend, through THE REAL INPUT PATH: `interact` to arm the preview, `interact` again to
 *      confirm, exactly as `RI-UIX03` L6 requires. No `_spendSouls()` call, no harness verb
 *      that skips the screen.
 *   5. Read back level, souls held, souls spent and the attribute, and confirm the `level_up`
 *      trace event fired.
 *   6. Walk 50 m off the basin and try again — it must be REFUSED. A gate that is always open
 *      is not a gate, and "reachable at a well" means nothing without "and nowhere else".
 *   7. Save, reload the blob, and read the spend back off the LIVE world (level, attributes,
 *      souls held, souls spent), because a spend that does not survive is not a spend.
 *
 * DELETE-THE-FIX. `--delete-the-fix` monkey-patches `HearthSystem.prototype.atHearth` back to
 * `undefined` in the page before measuring, so every number below can be shown to move when the
 * fix is removed. A probe that cannot fail is worse than no probe (AGENT-PROTOCOL).
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r2-levelling-loop.mjs [--out <file>] [--delete-the-fix]'); process.exit(0); }

const WELLS = String(args.wells || 'hearth-archon,hearth-lilmoth,hearth-gideon').split(',');
const deleteTheFix = !!args['delete-the-fix'];
const out = {
  schema: 'w1-13/r2-levelling-loop@1',
  delete_the_fix: deleteTheFix,
  used_setAtHearth: false,          // asserted below; the whole point is that it stays false
  wells: [],
};
let handle;

const tryOpen = (h, name) => h.page.evaluate(async (n) => {
  try { return { ok: true, mode: await window.__HARNESS.openMenu(n) }; }
  catch (e) { return { ok: false, threw: String((e && e.message) || e) }; }
}, name);

try {
  // 320x240 unless a picture is being taken: a stepping loop that renders is the most expensive
  // thing on this box (AGENT-PROTOCOL), and this one steps tens of thousands of frames.
  handle = await launchGame({
    ...args,
    width: args.shot ? Number(args.width || 1280) : 320,
    height: args.shot ? Number(args.height || 720) : 240,
  });
  const h = handle;
  await h.h('setRenderRate', 0);

  if (deleteTheFix) {
    // Reach the class through a live instance's prototype — the module is not a global.
    const r = await h.page.evaluate(() => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const hs = eng && eng.hearths;
      if (!hs) return { ok: false, why: 'no hearth system reachable from the page' };
      const proto = Object.getPrototypeOf(hs);
      const had = typeof proto.atHearth === 'function';
      delete proto.atHearth;
      return { ok: true, had_method: had, still_has: typeof proto.atHearth };
    });
    out.delete_the_fix_result = r;
    log(`delete-the-fix: ${JSON.stringify(r)}`);
  }

  const list = await h.h('listHearths');
  out.hearths_in_province = list.count;

  for (const id of WELLS) {
    const w = list.hearths.find((x) => x.id === id);
    if (!w) { out.wells.push({ hearth: id, error: 'no such well' }); continue; }
    const rec = { hearth: id, basin: w.pos, interact_radius_m: w.interact_radius_m };

    await h.h('loadState', 'default');
    // Bank 4,200 souls the way the sibling probes do — through the save blob, which is the only
    // route the harness offers. This is the STARTING purse, not the thing under test.
    {
      const b0 = await h.h('saveState');
      b0.character.souls_held = 4200;
      await h.h('restoreState', b0);
      await h.h('stepFrames', 1);
    }

    // ---- 1. WALK IN. Start 60 m out on a bearing that is not axis-aligned, so the last leg is
    //         ordinary locomotion across streamed province ground rather than a placement.
    const th = 0.9;
    const start = [w.pos[0] + Math.cos(th) * 60, w.pos[2] + Math.sin(th) * 60];
    const walk = await h.h('walkPath', [start, [w.pos[0], w.pos[2]]], { speed: 'jog', arrive_m: 1.2, maxFrames: 20000 });
    const posAfterWalk = (await h.h('getPlayerStats')).pos;
    const standing = (await h.h('listHearths')).standing_at;
    rec.walk = {
      from: [+start[0].toFixed(1), +start[1].toFixed(1)],
      arrived: walk.arrived, aborted: walk.aborted, frames: walk.frames,
      path_m: walk.path_m, minutes: walk.minutes,
      dist_to_basin_m: +Math.hypot(posAfterWalk[0] - w.pos[0], posAfterWalk[2] - w.pos[2]).toFixed(3),
      registry_standing_at: standing,
    };

    // ---- 2. REST.
    const rest = await h.h('restAt', id);
    await h.h('stepFrames', 4);
    rec.rest = { at: rest.hearth || rest.at || null, clock_hours: rest.clock_advanced_hours || rest.hours || null };

    const before = await h.h('getPlayerStats');
    const ui0 = await h.h('getUIState');
    rec.before = {
      level: before.level, souls: before.souls,
      souls_to_next: before.souls_to_next !== undefined ? before.souls_to_next : null,
      souls_spent: before.souls_spent,
      attributes: before.attributes || null,
      at_hearth: ui0.at_hearth, at_hearth_real: ui0.at_hearth_real,
      at_hearth_overridden: ui0.at_hearth_overridden, at_hearth_id: ui0.at_hearth_id,
      levelup_in_navigable: (ui0.navigable || []).includes('levelup'),
    };
    if (ui0.at_hearth_overridden) out.used_setAtHearth = true;

    // ---- 3. OPEN.
    const opened = await tryOpen(h, 'levelup');
    const uiOpen = await h.h('getUIState');
    rec.open = { ...opened, mode: uiOpen.mode, reachable: uiOpen.mode === 'levelup' };

    // ---- 4a. THE PHOTOGRAPH, optional and only at the first well.
    //
    // `--shot <path>` renders the open level-up screen. It is taken HERE, between the open and
    // the spend, because this is the frame the round-1 verdict says did not exist: the screen
    // `RI-PRG04` §1 calls "the only place levelling is possible", standing on a sapwell basin
    // the body WALKED to, with 4,200 souls in the purse. It goes through this probe's own
    // browser rather than `tools/capture/` because the capture daemon has no walking mode and
    // no way to open a menu — and because what is being photographed is the end of a stepped
    // sequence, not the appearance of a place.
    //
    // Render is off for the whole run (`setRenderRate(0)`); it is turned on for this one frame
    // and turned straight back off, so the cost is one frame and not the run.
    if (args.shot && !out.shot && uiOpen.mode === 'levelup') {
      await h.h('setRenderRate', 60);
      await h.h('stepFrames', 2);
      await h.page.screenshot({ path: String(args.shot) });
      await h.h('setRenderRate', 0);
      out.shot = {
        path: String(args.shot), well: id,
        arrival: 'walked', walked_m: rec.walk.path_m, walk_frames: rec.walk.frames,
        souls_in_purse: rec.before.souls, level: rec.before.level,
        used_setAtHearth: out.used_setAtHearth,
        _admissibility: 'Evidence of a UI SURFACE existing and being legible at a sapwell. The '
          + 'walked arrival is evidenced by rec.walk in this file (walkPath, ordinary locomotion), '
          + 'not by the picture; a photograph is never evidence of arrival (ARBITRATION S34(b)).',
      };
      log(`shot: ${args.shot}`);
    }

    // ---- 4. SPEND, through the real input path (arm, then confirm — RI-UIX03 L6).
    if (uiOpen.mode === 'levelup') {
      // S14: OUTSIDE A FIGHT AN OPEN SCREEN STOPS THE WORLD, so `sim.frame` does not advance
      // while the level-up screen is up and a multi-frame scripted script would sit in the
      // queue forever. Each press is therefore its own one-frame script, which is also exactly
      // what a player does: press, release, press. Two confirms — RI-UIX03 L6's preview then
      // commit — and no third, so an accidental double-spend would show as level +2.
      //
      // Read off THE TRACE, which is the surface the acceptance criterion names. A paused frame
      // used to write no record at all, so `level_up` — emitted on a paused frame, always —
      // could not reach a trace on any build; `_afterStep()` now writes one record for a paused
      // frame that actually emitted something. `snapshot()` is kept as the second reading,
      // because the bus is not cleared between paused frames and a snapshot therefore repeats
      // an event until the next real step: two independent counts, deduplicated by frame.
      await h.h('traceStart', { events: true });
      const snapUps = [];
      for (const ev of [['press'], ['release'], ['press'], ['release']]) {
        await h.h('queueInputs', [{ f: 0, [ev[0]]: ['interact'] }]);
        await h.h('stepFrames', 1);
        const snap = await h.h('snapshot');
        for (const e of (snap.events || [])) if (e.type === 'level_up') snapUps.push(e);
      }
      const recs = await h.h('traceDrain');
      await h.h('traceStop');
      const ups = [];
      for (const f of recs) for (const e of (f.events || [])) if (e.type === 'level_up') ups.push(e);
      const distinctFrames = new Set(ups.map((e) => e.f));
      rec.spend = {
        level_up_events: distinctFrames.size,
        level_up_records_in_trace: ups.length,
        level_up_seen_by_snapshot: new Set(snapUps.map((e) => e.f)).size,
        event: ups[0] || snapUps[0] || null,
      };
    } else {
      rec.spend = { level_up_events: 0, event: null, _why: 'the screen never opened' };
    }

    const after = await h.h('getPlayerStats');
    rec.after = {
      level: after.level, souls: after.souls, souls_spent: after.souls_spent,
      souls_to_next: after.souls_to_next, attributes: after.attributes || null,
    };
    rec.delta = {
      level: after.level - before.level,
      souls: after.souls - before.souls,
      souls_expected: rec.before.souls_to_next === null ? null : -rec.before.souls_to_next,
      souls_matches_cost: rec.before.souls_to_next !== null
        && (before.souls - after.souls) === rec.before.souls_to_next,
      attribute_raised: (() => {
        const a = before.attributes || {}, b = after.attributes || {};
        return Object.keys(b).filter((k) => (b[k] || 0) > (a[k] || 0));
      })(),
    };
    await h.h('closeMenu').catch(() => {});

    // ---- 6. AND NOWHERE ELSE. Walk 50 m off the basin; the screen must be refused.
    await h.h('closeMenu').catch(() => {});
    const off = [w.pos[0] + Math.cos(th) * 50, w.pos[2] + Math.sin(th) * 50];
    await h.h('walkPath', [[w.pos[0], w.pos[2]], off], { speed: 'jog', arrive_m: 1.5, maxFrames: 20000 });
    const posOff = (await h.h('getPlayerStats')).pos;
    const uiOff = await h.h('getUIState');
    const openedOff = await tryOpen(h, 'levelup');
    const uiOff2 = await h.h('getUIState');
    rec.off_basin = {
      dist_to_basin_m: +Math.hypot(posOff[0] - w.pos[0], posOff[2] - w.pos[2]).toFixed(2),
      at_hearth: uiOff.at_hearth, at_hearth_real: uiOff.at_hearth_real,
      levelup_in_navigable: (uiOff.navigable || []).includes('levelup'),
      open: openedOff, mode_after: uiOff2.mode,
      refused: uiOff2.mode !== 'levelup',
    };
    await h.h('closeMenu').catch(() => {});

    // ---- 7. AND IT SURVIVES A SAVE. Read the LIVE world after the load, not the blob.
    const blob = await h.h('saveState');
    await h.h('loadState', 'default');
    const wiped = await h.h('getPlayerStats');
    await h.h('loadState', blob);
    const reloaded = await h.h('getPlayerStats');
    rec.persistence = {
      control_after_default_reload: { level: wiped.level, souls: wiped.souls },
      after_blob_reload: { level: reloaded.level, souls: reloaded.souls, attributes: reloaded.attributes || null },
      level_survived: reloaded.level === after.level,
      souls_survived: reloaded.souls === after.souls,
      attributes_survived: JSON.stringify(reloaded.attributes) === JSON.stringify(after.attributes),
    };

    rec.pass = !!(rec.walk.arrived && rec.open.reachable && rec.delta.level === 1
      && rec.delta.souls_matches_cost && rec.spend.level_up_events === 1
      && rec.off_basin.refused && rec.persistence.level_survived
      && rec.persistence.souls_survived && rec.persistence.attributes_survived);
    out.wells.push(rec);
    log(`${id}: walked ${rec.walk.path_m} m (${rec.walk.frames} f) -> rest -> open=${rec.open.reachable} `
      + `level ${before.level}->${after.level} souls ${before.souls}->${after.souls} `
      + `(cost ${rec.before.souls_to_next}) off-basin refused=${rec.off_basin.refused} `
      + `survives-save=${rec.persistence.level_survived && rec.persistence.souls_survived} PASS=${rec.pass}`);
  }

  out.summary = {
    wells: out.wells.length,
    passing: out.wells.filter((w) => w.pass).length,
    levelup_reachable_at: out.wells.filter((w) => w.open && w.open.reachable).map((w) => w.hearth),
    refused_off_basin_at: out.wells.filter((w) => w.off_basin && w.off_basin.refused).map((w) => w.hearth),
    used_setAtHearth: out.used_setAtHearth,
  };
  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  log(`SUMMARY ${JSON.stringify(out.summary)}`);
  if (!deleteTheFix && out.summary.passing !== out.wells.length) process.exitCode = 1;
} catch (e) {
  out.error = String((e && e.stack) || e);
  if (args.out) writeJson(args.out, out);
  log('w1-13-r2-levelling-loop: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}

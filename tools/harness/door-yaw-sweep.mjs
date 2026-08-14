#!/usr/bin/env node
// door-yaw-sweep.mjs — ALL 115 INTERIORS, BOTH DIRECTIONS, AND A DEFINITION OF "CORRECT".
//
// WHY THIS EXISTS BESIDE `door-exit-yaw.mjs`. That tool established the mechanism and measured
// eleven interiors; `reports/spawn-yaw/2026-08-14-door-exit-yaw.md` §6 says plainly that the
// all-115 sweep did not finish. This one is the population sweep, and it changes the instrument in
// three ways that the eleven-row run could not have caught:
//
//  1. **A wall is not the only way to face wrongly.** "Facing away from the door" is satisfied by a
//     player put down in an alley staring at the opposite wall two metres away. So the judgement is
//     TWO numbers, not one:
//       clearance_m   — distance to the first solid straight ahead at eye height (0.25 m march,
//                       12 m cap), against `Engine.solidAt` = `sim.cell.contains()`: the same
//                       collision set the body is depenetrated against and the camera arm casts
//                       into. Not a re-derivation of the geometry — the geometry.
//       occluded_frac — of a 21-ray fan across the forward 60° of view (±30°, 3° apart, eye
//                       height), the fraction whose first solid is CLOSER THAN `--near` (3 m).
//                       This is "how much of what you are looking at is a wall in your face".
//     PASS = clearance_m >= --min-clear (3 m) AND occluded_frac <= --max-occl (0.34).
//     Stated before the measurement, applied unchanged to every row and to both arms.
//
//  2. **THE CAMERA IS THE THING THE PLAYER LOOKS THROUGH.** The body can be turned correctly while
//     the view is not: `stepCamera`'s auto-recentre is clamped to 1.5°/frame, so a camera 170° out
//     takes ~113 frames to come round. Every row is therefore judged on `sim.camera.yaw` and
//     records `sim.player.yaw` and `combat.player.yaw` beside it. Those are the three fields that
//     must all be written; a row where they disagree is reported as a disagreement, not averaged.
//
//  3. **ONE INSTANT IS A STILL TARGET** (RULES.md rule 8). A doorstep audit once reported 0 of 115
//     bodies stuck inside a building, measured one frame after the door; at 30, 120 and 600 frames
//     the same 115 doors gave 8, 10 and 10, because the collision solver slides the body into a
//     neighbour and it rests there. So every row is measured at frame 1, 30 and 120 after the door
//     verb returns, and all three are published.
//
// Both directions, through the REAL verbs — `H.enterInterior(id)` is `useDoor()` and
// `H.exitInterior()` is `leaveInterior()`, the two functions `stepSettlement()` calls off the
// `interact` latch. Not `teleport()`: teleport takes `opts.yaw` and a door does not, so measuring
// the door defect through a teleport measures the instrument.
//
// THE ADVERSARIAL SEED. Before every door the body, the combat body and the camera are all set to
// `--seed-yaw` (200° by default). The defect is precisely that the prior yaw survives a placement,
// so a rule that ignores the prior yaw must be blind to that number and a rule that does not must
// show it.
//
// A SHUT SHOP IS A LOCKED DOOR, NOT A MEASUREMENT. `useDoor()` refuses one and `sim.env.interior`
// stays null, so an unguarded exit would then measure the OUTDOOR point and file it as the way in.
// The clock is set to `--hour` (12) before each row so the population is the population, and every
// refusal is still recorded rather than silently dropped.
//
// ARMS. `--entry <html>` points the browser at another tree, which is how the BEFORE arm and the
// delete-the-fix control are run: build a clone with `tools/control-clone.mjs`, revert the yaw
// write in it, and point this tool at `<clone>/game/index.html`. The tool records the entry it
// used and the sha256 of the two files that carry the fix, so a JSON file cannot claim to be an
// arm it is not.
//
// USAGE
//   node tools/harness/door-yaw-sweep.mjs --json <path> [--label after] [--entry <html>]
//        [--only a,b] [--limit N] [--reach 12] [--near 3] [--min-clear 3] [--max-occl 0.34]
//        [--seed-yaw 200] [--hour 12] [--frames 1,30,120] [--resume]
'use strict';

import path from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
door-yaw-sweep.mjs — all 115 interiors, both directions, clearance + view-occlusion at 3 frame marks.

USAGE
  node tools/harness/door-yaw-sweep.mjs --json <path> [--label after] [--entry <html>]
       [--only a,b] [--limit N] [--reach 12] [--near 3] [--min-clear 3] [--max-occl 0.34]
       [--seed-yaw 200] [--hour 12] [--frames 1,30,120] [--resume]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const REACH = Number(args.reach || 12);
const NEAR = Number(args.near || 3);
const MIN_CLEAR = Number(args['min-clear'] || 3);
const MAX_OCCL = Number(args['max-occl'] || 0.34);
const SEED_YAW = args['seed-yaw'] === undefined ? 200 : Number(args['seed-yaw']);
const HOUR = args.hour === undefined ? 12 : Number(args.hour);
const FRAMES = String(args.frames || '1,30,120').split(',').map((s) => Number(s.trim())).filter((n) => n >= 0);
const LABEL = String(args.label || 'after');
const outDir = path.join(REPORTS_DIR, 'door-yaw');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, `sweep-${LABEL}.json`);
const say = (s) => process.stdout.write(s + '\n');

/** Which tree is this arm actually measuring? A label is a claim; a hash is evidence. */
function fixFingerprint(entryHtml) {
  const gameDir = entryHtml ? path.dirname(path.resolve(entryHtml)) : path.join(REPO_ROOT, 'game');
  const out = {};
  for (const rel of ['src/sim/settlement.js', 'src/engine.js']) {
    const p = path.join(gameDir, rel);
    if (!existsSync(p)) { out[rel] = null; continue; }
    const src = readFileSync(p, 'utf8');
    out[rel] = {
      sha256: createHash('sha256').update(src).digest('hex').slice(0, 16),
      // The three fields the fix must write, counted in the source of the tree under test. A
      // BEFORE arm that still contains them is not a BEFORE arm, and this is how that is caught
      // instead of assumed.
      writes_sim_player_yaw: /p\.yaw\s*=\s*y360/.test(src),
      writes_camera_yaw: /this\.sim\.camera\.yaw\s*=\s*y360/.test(src),
      writes_combat_yaw: /b\.yaw\s*=\s*p\.yaw/.test(src),
      has_exitFacing: /export function exitFacing/.test(src),
      has_entryFacing: /export function entryFacing/.test(src),
    };
  }
  return { game_dir: gameDir, files: out };
}

// The in-page half. Installed once, called per interior — a 115-interior sweep inside one
// `page.evaluate` is one opaque blocking promise with no way to say which row it hung on.
const IN_PAGE = `
window.__DYS = {
  d2r: Math.PI / 180,
  norm(a) { return ((a % 360) + 360) % 360; },
  fwd(yaw) { const r = yaw * this.d2r; return [Math.sin(r), Math.cos(r)]; },
  /** Distance to the first solid along \`yaw\` at \`eye\`, marched in 0.25 m steps to \`reach\`. */
  clearance(x, z, yaw, eye, reach) {
    const E = window.__ENGINE, f = this.fwd(yaw);
    for (let d = 0.25; d <= reach + 1e-9; d += 0.25) {
      const q = E.solidAt(x + f[0] * d, eye, z + f[1] * d);
      if (q && q.solid) return +(d - 0.25).toFixed(2);
    }
    return reach;
  },
  /**
   * The fraction of the forward 60 degrees of view blocked closer than \`near\`.
   * 21 rays, 3 degrees apart, +/- 30 degrees off the facing. This is the half of the definition
   * that "facing away from the door you came through" cannot express: an alley exit can face
   * perfectly away from its own door and still be a wall two metres wide across the whole view.
   */
  occluded(x, z, yaw, eye, near, reach) {
    let blocked = 0, n = 0, sum = 0;
    for (let a = -30; a <= 30 + 1e-9; a += 3) {
      const c = this.clearance(x, z, yaw + a, eye, reach);
      n++; sum += c;
      if (c < near) blocked++;
    }
    return { frac: +(blocked / n).toFixed(4), rays: n, mean_m: +(sum / n).toFixed(2) };
  },
  /** The ceiling this STANDING POINT can offer: the best of 36 ten-degree bearings. */
  best(x, z, eye, near, reach, minClear, maxOccl) {
    let bv = -1, by = 0, anyPass = false, bestOccl = 1;
    for (let a = 0; a < 360; a += 10) {
      const c = this.clearance(x, z, a, eye, reach);
      const o = this.occluded(x, z, a, eye, near, reach).frac;
      if (c >= minClear && o <= maxOccl) anyPass = true;
      if (o < bestOccl) bestOccl = o;
      if (c > bv) { bv = c; by = a; }
    }
    return { clearance_m: bv, yaw_deg: by, best_occluded_frac: bestOccl, point_can_pass: anyPass };
  },
  /** One measurement point: where the three yaw fields are, and what the view along them is. */
  sample(near, reach) {
    const E = window.__ENGINE;
    const p = E.sim.player.pos;
    const eye = p[1] + 1.6;
    const camYaw = E.sim.camera ? this.norm(E.sim.camera.yaw) : null;
    const bodyYaw = this.norm(E.sim.player.yaw);
    const combatYaw = (E.combat && E.combat.player) ? this.norm(E.combat.player.yaw) : null;
    const judged = camYaw === null ? bodyYaw : camYaw;
    const occ = this.occluded(p[0], p[2], judged, eye, near, reach);
    let inside = null;
    try {
      inside = !!(E.renderer && E.renderer.province && E.renderer.province.buildingAt(p[0], p[2]));
    } catch (e) { inside = null; }
    return {
      pos: [+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)],
      cam_yaw_deg: camYaw === null ? null : +camYaw.toFixed(1),
      body_yaw_deg: +bodyYaw.toFixed(1),
      combat_yaw_deg: combatYaw === null ? null : +combatYaw.toFixed(1),
      clearance_m: this.clearance(p[0], p[2], judged, eye, reach),
      body_clearance_m: this.clearance(p[0], p[2], bodyYaw, eye, reach),
      occluded_frac: occ.frac,
      fan_mean_m: occ.mean_m,
      inside_a_building: inside,
    };
  },
  /** Put all three yaw fields somewhere deliberately wrong, so a placement that ignores them shows. */
  seed(yaw) {
    const E = window.__ENGINE;
    E.sim.player.yaw = yaw;
    if (E.combat && E.combat.player) E.combat.player.yaw = yaw;
    if (E.sim.camera) { E.sim.camera.yaw = yaw; E.sim.camera.yawRate = 0; }
  },
};
`;

const main = async () => {
  const entryArg = args.entry ? String(args.entry) : null;
  const fp = fixFingerprint(entryArg);
  const g = await launchGame({ width: 640, height: 360, entry: entryArg || undefined });
  const { page } = g;
  await g.h('ready');
  await page.evaluate(IN_PAGE);

  // Sorted BY TOWN. Each row teleports to its own doorstep, and a teleport across the province
  // opens a streaming boundary: ~15-25 s inside a town you are already standing in, 200-480 s for
  // the first interior of a new town. Sorting turns 115 town changes into 8.
  const ids = await page.evaluate(() => {
    const I = window.__ENGINE.data.interiors;
    return Object.keys(I).sort((a, b) => {
      const sa = String(I[a].settlement || ''), sb = String(I[b].settlement || '');
      return sa === sb ? (a < b ? -1 : 1) : (sa < sb ? -1 : 1);
    });
  });
  const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
  let list = (only ? ids.filter((i) => only.includes(i)) : ids);
  if (args.limit) list = list.slice(0, Number(args.limit));

  let out = {
    schema: 'elder-souls/door-yaw-sweep@1',
    label: LABEL,
    generated_at: new Date().toISOString(),
    commit: null,
    loadavg: readFileSync('/proc/loadavg', 'utf8').trim(),
    entry: entryArg || '(repo tree) game/index.html',
    fix_fingerprint: fp,
    population: ids.length,
    definition: {
      clearance_m: `distance to first solid at eye height (pos.y + 1.6), 0.25 m march, ${REACH} m cap, against Engine.solidAt() = sim.cell.contains()`,
      occluded_frac: `fraction of 21 rays across the forward 60 deg (+/-30, 3 deg apart) whose first solid is closer than ${NEAR} m`,
      judged_on: 'sim.camera.yaw — what the player looks through. body and combat yaw recorded beside it.',
      pass: `clearance_m >= ${MIN_CLEAR} AND occluded_frac <= ${MAX_OCCL}`,
      frames_after_door: FRAMES,
      seed_yaw_deg: SEED_YAW,
      hour: HOUR,
    },
    rows: [],
  };
  try {
    out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
  } catch { /* not fatal */ }

  // --resume: keep rows already on disk. A town change costs minutes and this box restarts.
  const done = new Set();
  if (args.resume && existsSync(jsonPath)) {
    try {
      const prev = JSON.parse(readFileSync(jsonPath, 'utf8'));
      if (prev && Array.isArray(prev.rows) && prev.label === LABEL) {
        out.rows = prev.rows; for (const r of prev.rows) done.add(r.id);
        say(`resuming: ${done.size} row(s) already on disk`);
      }
    } catch { /* start clean */ }
  }

  try {
    let n = 0;
    for (const id of list) {
      n++;
      if (done.has(id)) continue;
      const t0 = Date.now();
      const row = await page.evaluate(async (o) => {
        const H = window.__HARNESS, E = window.__ENGINE, X = window.__DYS;
        const rec = E.data.interiors[o.id];
        const cont = (rec && rec.continuity) || {};
        const spawn = cont.exterior_spawn || rec.exterior_door;
        const isp = cont.interior_spawn;
        if (!spawn || !isp) return { id: o.id, settlement: rec && rec.settlement, skipped: 'no continuity vectors' };

        // Stand on the doorstep, outdoors, with all three yaw fields deliberately wrong.
        E.sim.env.timeOfDay = o.hour;
        H.teleport(spawn[0], spawn[2], { yaw: o.seed });
        H.stepFrames(6);
        X.seed(o.seed);
        H.stepFrames(1);
        const before = X.sample(o.near, o.reach);

        const r = { id: o.id, settlement: rec.settlement, entry_side: cont.entry_side,
          declared_bearing_deg: Number(rec.door_world_bearing_deg),
          doorstep_before: before, enter: null, exit: null };

        // ---- THE WAY IN --------------------------------------------------------------------
        let entered = false;
        try {
          const res = H.enterInterior(o.id);
          if (res && res.entered === false) {
            r.enter = { refused: res.reason || 'refused' };
          } else {
            entered = true;
            r.enter = { yaw_source: (res && res.yaw_source) || null,
              yaw_returned_deg: (res && res.yaw_deg) === undefined ? null : res.yaw_deg, marks: {} };
            let f = 0;
            for (const m of o.frames) { H.stepFrames(m - f); f = m; r.enter.marks['f' + m] = X.sample(o.near, o.reach); }
            r.enter.best = X.best(E.sim.player.pos[0], E.sim.player.pos[2], E.sim.player.pos[1] + 1.6,
              o.near, o.reach, o.minClear, o.maxOccl);
          }
        } catch (e) { r.enter = { error: String((e && e.message) || e) }; }

        // ---- THE WAY OUT -------------------------------------------------------------------
        // Only meaningful if we actually got in; otherwise `exitInterior()` would measure the
        // outdoor point again and file it as the exit, which is a vacuous positive arm.
        if (entered) {
          try {
            // Re-seed inside, so the exit's prior yaw is adversarial too and not merely whatever
            // the entry fix happened to leave. Otherwise the BEFORE arm's exit inherits the
            // BEFORE arm's entry and the two failures are not separable.
            X.seed(o.seed);
            H.stepFrames(1);
            const res = H.exitInterior();
            r.exit = { yaw_source: (res && res.yaw_source) || null,
              yaw_returned_deg: (res && res.yaw_deg) === undefined ? null : res.yaw_deg, marks: {} };
            let f = 0;
            for (const m of o.frames) { H.stepFrames(m - f); f = m; r.exit.marks['f' + m] = X.sample(o.near, o.reach); }
            const p = E.sim.player.pos;
            r.exit.best = X.best(p[0], p[2], p[1] + 1.6, o.near, o.reach, o.minClear, o.maxOccl);
          } catch (e) { r.exit = { error: String((e && e.message) || e) }; }
        } else if (!r.enter || !r.enter.refused) {
          r.exit = { skipped: 'never entered' };
        } else {
          r.exit = { skipped: 'door refused: ' + r.enter.refused };
        }
        return r;
      }, { id, seed: SEED_YAW, reach: REACH, near: NEAR, hour: HOUR, frames: FRAMES,
           minClear: MIN_CLEAR, maxOccl: MAX_OCCL });
      row.ms = Date.now() - t0;
      out.rows.push(row);
      // WRITTEN AFTER EVERY ROW. The first full-tree attempt at this sweep was killed at 35
      // minutes and produced zero bytes because the only write was after the loop.
      writeJson(jsonPath, summarise(out));
      const e = row.exit && row.exit.marks && row.exit.marks.f1;
      say(`  ${n}/${list.length} ${id}${e ? `  exit f1 clear ${e.clearance_m} m occl ${e.occluded_frac}` : `  ${JSON.stringify(row.exit || row.enter || row.skipped)}`} (${(row.ms / 1000).toFixed(1)} s)`);
    }
  } finally { await g.close(); }

  out = summarise(out);
  writeJson(jsonPath, out);
  report(out);
};

/** The roll-up. Kept a pure function of `out.rows` so a partial file summarises correctly too. */
function summarise(out) {
  const rows = out.rows;
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const passOf = (s) => s && s.clearance_m >= MIN_CLEAR && s.occluded_frac <= MAX_OCCL;
  const side = (key) => {
    const acc = {};
    for (const m of FRAMES) {
      const ss = rows.map((r) => r[key] && r[key].marks && r[key].marks['f' + m]).filter(Boolean);
      if (!ss.length) continue;
      acc['f' + m] = {
        n: ss.length,
        median_clearance_m: med(ss.map((s) => s.clearance_m)),
        median_occluded_frac: med(ss.map((s) => s.occluded_frac)),
        failing: ss.filter((s) => !passOf(s)).length,
        failing_ids: rows.filter((r) => r[key] && r[key].marks && r[key].marks['f' + m] && !passOf(r[key].marks['f' + m])).map((r) => r.id),
        under_2m: ss.filter((s) => s.clearance_m < 2).length,
        at_cap: ss.filter((s) => s.clearance_m >= REACH).length,
        inside_a_building: ss.filter((s) => s.inside_a_building).length,
      };
    }
    // The three fields. A row where the camera and the body disagree by more than half a degree
    // is the inert-fix shape, and it is counted rather than averaged away.
    const f1 = rows.map((r) => r[key] && r[key].marks && r[key].marks.f1).filter(Boolean);
    const dis = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    acc.three_fields = {
      n: f1.length,
      cam_matches_body: f1.filter((s) => s.cam_yaw_deg === null || dis(s.cam_yaw_deg, s.body_yaw_deg) < 0.5).length,
      combat_matches_body: f1.filter((s) => s.combat_yaw_deg === null || dis(s.combat_yaw_deg, s.body_yaw_deg) < 0.5).length,
      still_at_seed_yaw: f1.filter((s) => dis(s.body_yaw_deg, SEED_YAW) < 0.5).length,
      cam_still_at_seed_yaw: f1.filter((s) => s.cam_yaw_deg !== null && dis(s.cam_yaw_deg, SEED_YAW) < 0.5).length,
    };
    acc.yaw_sources = rows.reduce((a, r) => { const k = (r[key] && r[key].yaw_source) || '(none)'; a[k] = (a[k] || 0) + 1; return a; }, {});
    // Point-limited vs rule-limited: a doorstep where NO bearing passes is a bad POINT, and
    // charging the facing rule for it would be wrong in both directions.
    const withBest = rows.filter((r) => r[key] && r[key].best);
    acc.point_cannot_pass = withBest.filter((r) => !r[key].best.point_can_pass).map((r) => r.id);
    return acc;
  };
  out.summary = {
    rows: rows.length,
    population: out.population,
    skipped: rows.filter((r) => r.skipped).map((r) => ({ id: r.id, why: r.skipped })),
    refused: rows.filter((r) => r.enter && r.enter.refused).map((r) => ({ id: r.id, why: r.enter.refused })),
    errors: rows.filter((r) => (r.enter && r.enter.error) || (r.exit && r.exit.error))
      .map((r) => ({ id: r.id, enter: r.enter && r.enter.error, exit: r.exit && r.exit.error })),
    doorstep_before: {
      n: rows.filter((r) => r.doorstep_before).length,
      failing: rows.filter((r) => r.doorstep_before && !passOf(r.doorstep_before)).length,
    },
    enter: side('enter'),
    exit: side('exit'),
  };
  return out;
}

function report(out) {
  const S = out.summary;
  say('');
  say(`door-yaw-sweep [${out.label}] — ${S.rows} of ${out.population} interiors, commit ${out.commit}`);
  say(`  entry: ${out.entry}`);
  const ff = out.fix_fingerprint.files['src/engine.js'];
  if (ff) say(`  engine.js ${ff.sha256}  writes: player=${ff.writes_sim_player_yaw} camera=${ff.writes_camera_yaw} combat=${ff.writes_combat_yaw}`);
  const sf = out.fix_fingerprint.files['src/sim/settlement.js'];
  if (sf) say(`  settlement.js ${sf.sha256}  exitFacing=${sf.has_exitFacing} entryFacing=${sf.has_entryFacing}`);
  say(`  PASS = clearance >= ${MIN_CLEAR} m AND occluded_frac <= ${MAX_OCCL} (near = ${NEAR} m), judged on sim.camera.yaw`);
  for (const key of ['enter', 'exit']) {
    say(`  ${key.toUpperCase()}:`);
    for (const m of FRAMES) {
      const v = S[key]['f' + m];
      if (!v) continue;
      say(`    frame ${String(m).padStart(3)}  FAILING ${String(v.failing).padStart(3)}/${v.n}   median clear ${String(v.median_clearance_m).padStart(5)} m  median occl ${v.median_occluded_frac}  under 2 m ${v.under_2m}  inside a building ${v.inside_a_building}`);
    }
    const t = S[key].three_fields;
    say(`    three fields: cam==body ${t.cam_matches_body}/${t.n}  combat==body ${t.combat_matches_body}/${t.n}  body STILL at seed ${t.still_at_seed_yaw}/${t.n}  camera STILL at seed ${t.cam_still_at_seed_yaw}/${t.n}`);
    say(`    yaw sources: ${JSON.stringify(S[key].yaw_sources)}`);
    say(`    points where NO bearing passes: ${S[key].point_cannot_pass.length}${S[key].point_cannot_pass.length ? ' — ' + S[key].point_cannot_pass.slice(0, 8).join(', ') : ''}`);
  }
  if (S.refused.length) say(`  doors refused: ${S.refused.length} — ${S.refused.slice(0, 6).map((r) => r.id + ':' + r.why).join(', ')}`);
  if (S.errors.length) say(`  errors: ${S.errors.length} — ${S.errors.slice(0, 4).map((r) => r.id).join(', ')}`);
  say(`  json: ${path.relative(REPO_ROOT, jsonPath)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

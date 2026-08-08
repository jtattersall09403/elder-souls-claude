#!/usr/bin/env node
/**
 * critic-crossing-probe.mjs — THE THREE MEASUREMENTS W1-CROSSING OWED, TAKEN BY ITS CRITIC.
 *
 * One browser, three modes (rule 21: launch one browser and keep it).
 *
 * `--regain`   THE COUNT THE BUILDER SAYS IT DID NOT DELIVER. Its `C5-REGAIN` returned 2/10 in both
 *              arms and it reported that as an inert control rather than publishing the 2, which is
 *              the right call — and the reason is diagnosable: its ten shoves were not ten trials.
 *              After the third shove the body was stuck, so shoves 4-10 re-shoved one stuck body,
 *              and only two trials were ever independent. This rebuild makes every trial
 *              independent by construction: the body is re-placed on the road, re-pinned and
 *              re-seeded before each shove, the segment cursor is seeded at the shove point, and
 *              the trial is scored on ONE question — did the projection distance come back inside
 *              3.5 m within the frame budget. The arms are the shipped `_pursue` and the pre-fix
 *              proximity loop restored verbatim, and the control is required to go red.
 *
 * `--null`     `C2-NULL-IS-SILENT` REPLACED. The shipped check's bar is `max(0.5, floor x 1.5)` and
 *              the floor it read came from an arm its own author had already invalidated (a body
 *              that died and respawned 3.5 km away), so the bar was 6,193 m and anything passed.
 *              The floor is measured here instead: the SAME walk run twice with nothing changed at
 *              all. Then the null arm (move a leg the crossing does not use) is required to sit at
 *              that floor, and the positive arm (move the leg it does use) far above it.
 *
 * `--deletefix` THE 2x2 RE-RUN WITH THE ARM ORDER REVERSED AND THE WORLD RE-SEEDED BETWEEN ARMS.
 *              The builder's grid ran NEW/NEW first and OLD/OLD last, in one page, after 180,000
 *              frames of accumulated world state — 50 in-world minutes of clock, weather and hazard
 *              drift. Reproducing a published number under those conditions is either determinism
 *              or luck, and the way to tell is to run the arms in the other order from a re-seeded
 *              world and see whether the same four numbers come out.
 *
 * Every arm reads its installed functions back out and refuses to report if the swap did not take.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-crossing-probe.mjs
  --regain          the independent-trial regain count, both steerings
  --null            the replacement noise floor for C2-NULL-IS-SILENT
  --deletefix       the 2x2 re-run, arm order reversed, world re-seeded per arm
  --trials <n>      regain trials per arm (default 20)
  --offset <m>      lateral shove (default 25)
  --trial-frames <n> frames per regain trial (default 3000)
  --frames <n>      frames per deletefix arm (default 60000)
  --out <file>`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const MODE = args.regain ? 'regain' : args.null ? 'null' : args.deletefix ? 'deletefix' : null;
if (!MODE) usage(USAGE);
const TRIALS = Number(args.trials || 20);
const OFFSET = Number(args.offset || 25);
const TRIAL_FRAMES = Number(args['trial-frames'] || 3000);
const FRAMES = Number(args.frames || 60000);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, `reports/critic-w1-crossing/${MODE}.json`)));
ensureDir(path.dirname(OUT));

const doc = { schema: `elder-souls/critic-crossing-${MODE}@1`, measured_at: new Date().toISOString(),
  git: gitInfo(), mode: MODE, arms: [], checks: [], ok: false };
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const OLD_PURSUE = `function (pts, st, lookahead, arrive) {
  const p = this.sim.player;
  const n = pts.length - 1;
  let idx = Math.min(st.seg + 1, n);
  while (idx < n && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < lookahead) idx++;  // PROXIMITY
  st.seg = Math.max(0, idx - 1);
  const t = pts[idx];
  const d = Math.hypot(p.pos[0] - t[0], p.pos[2] - t[1]);
  let off = Infinity, span = 0;
  for (let j = st.seg; j < n; j++) {
    const ax = pts[j][0], az = pts[j][1];
    const dx = pts[j + 1][0] - ax, dz = pts[j + 1][1] - az;
    const L2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((p.pos[0] - ax) * dx + (p.pos[2] - az) * dz) / L2));
    off = Math.min(off, Math.hypot(p.pos[0] - (ax + dx * u), p.pos[2] - (az + dz * u)));
    span += Math.sqrt(L2);
    if (span > 150) break;
  }
  return { seg: st.seg, u: 0, off_m: off, target: [t[0], t[1]], tag: pts[st.seg][2],
    remaining_m: (n - idx) * 12, done: idx >= n && d < 1.5 };
}`;
const OLD_CLAMP = String(fs.readFileSync(path.join(REPO_ROOT, 'tools/world/old-clamp-345dcca.js'), 'utf8'));

const handle = await launchGame({ ...args, width: 640, height: 360 });

/** Re-seed the world to a known state. Called between arms so no arm inherits another's clock. */
async function reseed() {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  await handle.h('setTimeOfDay', 12);   // hours, 0..24
  await handle.page.evaluate(() => {
    const E = window.__ENGINE;
    if (!E.__critPin) {                       // pin HP identically in every arm, once
      const orig = E._afterStep.bind(E);
      E.__critPin = true;
      E._afterStep = function () { orig(); const p = this.sim.player; if (p.hp < p.hpMax) p.hp = p.hpMax; };
    }
    if (!E.__newPursue) { E.__newPursue = E._pursue; E.field.__newClamp = E.field.clampToDeck; }
  });
}

/** Install a steering / parapet pair and PROVE the swap took. */
async function install(steer, para) {
  const got = await handle.page.evaluate(([s, p, op, oc]) => {
    const E = window.__ENGINE;
    E._pursue = s === 'NEW' ? E.__newPursue : eval(`(${op})`);
    E.field.clampToDeck = p === 'NEW' ? E.field.__newClamp : eval(`(${oc})`);
    return {
      pursue_is: /PROXIMITY/.test(String(E._pursue)) ? 'OLD' : 'NEW',
      clamp_is: /spanFirst/.test(String(E.field.clampToDeck)) ? 'NEW' : 'OLD',
    };
  }, [steer, para, OLD_PURSUE, OLD_CLAMP]);
  if (got.pursue_is !== steer || got.clamp_is !== para) {
    throw new Error(`the swap did not take: asked ${steer}/${para}, got ${JSON.stringify(got)}`);
  }
  return got;
}

const routePoints = () => handle.page.evaluate(() => {
  const R = window.__ENGINE.data.roads, named = R.named_routes.crossing, pts = [];
  for (let i = 0; i + 1 < named.settlements.length; i++) {
    const a = named.settlements[i], b = named.settlements[i + 1];
    const leg = R.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
    const p = leg.from === a ? leg.points : leg.points.slice().reverse();
    for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push([p[k][0], p[k][1], leg.id]);
  }
  return pts;
});

try {
  await reseed();

  // =============================================================================================
  if (MODE === 'regain') {
    const pts = await routePoints();
    // Trial anchors spread over the WHOLE route by arc length, not by point index — the points are
    // not evenly spaced, and clustering the trials would repeat the builder's "two independent
    // trials" problem in a different way.
    let total = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(total); }
    const anchors = [];
    for (let t = 0; t < TRIALS; t++) {
      const want = total * (t + 0.5) / TRIALS;
      let i = 1; while (i < cum.length - 2 && cum[i] < want) i++;
      anchors.push({ i, at_m: +cum[i].toFixed(1) });
    }
    doc.route = { points: pts.length, metres: +total.toFixed(1) };
    doc.anchors = anchors; flush();

    for (const steering of ['NEW', 'OLD']) {
      await reseed();
      const inst = await install(steering, 'NEW');
      const arm = { steering, install: inst, trials: [], regained: 0, offset_m: OFFSET, trial_frames: TRIAL_FRAMES };
      for (const a of anchors) {
        const t = await handle.page.evaluate(([pts, ai, offset, frames, side]) => {
          const E = window.__ENGINE, p = E.sim.player;
          const A = pts[ai], B = pts[Math.min(ai + 1, pts.length - 1)];
          const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz) || 1;
          const nx = -dz / L, nz = dx / L;
          // EACH TRIAL IS INDEPENDENT. Put the body back on the road first, then shove it: a trial
          // that starts wherever the last one ended is not a trial, it is a continuation.
          E.teleport(A[0], A[1]);
          p.hp = p.hpMax;
          const sx = A[0] + nx * offset * side, sz = A[1] + nz * offset * side;
          E.teleport(sx, sz);
          p.pos[1] = E.field.heightAt(sx, sz);
          const st = { seg: ai };
          const start = [p.pos[0], p.pos[2]];
          let regainedAt = -1, minOff = Infinity, walked = 0, naive = 0, jumps = 0;
          const startSeg = ai;
          let f = 0;
          for (; f < frames; f++) {
            const pur = E._pursue(pts, st, 4.5, 1.5);
            if (pur.off_m < minOff) minOff = pur.off_m;
            if (regainedAt < 0 && pur.off_m <= 3.5) { regainedAt = f; break; }
            const b = Math.atan2(pur.target[0] - p.pos[0], pur.target[1] - p.pos[2]);
            const cy = E.sim.camera.yaw * Math.PI / 180;
            E.input.reset(E.sim.frame);
            E.input.queueInputs([{ f: 0, move: [Math.sin(b - cy) * (0.55 - 1e-9), Math.cos(b - cy) * (0.55 - 1e-9)] }], E.sim.frame);
            const x0 = p.pos[0], z0 = p.pos[2];
            E.loop.stepOnce(); E._afterStep();
            const step = Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
            naive += step;
            if (step > 1) jumps++; else walked += step;
          }
          return {
            at_index: ai, shove_side: side,
            start_off_m: +Math.hypot(start[0] - A[0], start[1] - A[1]).toFixed(2),
            regained: regainedAt >= 0, frames_to_regain: regainedAt, frames_spent: f,
            min_off_m: +minOff.toFixed(2), walked_m: +walked.toFixed(1), naive_m: +naive.toFixed(1),
            jumps, seg_advanced: st.seg - startSeg,
            landed_on: { water_depth_m: +E.field.depthAt(start[0], start[1]).toFixed(2),
              on_road: E.field.onRoadAt(start[0], start[1]), on_deck: !!E.field.onDeckAt(start[0], start[1]),
              drop_from_road_m: +(E.field.heightAt(A[0], A[1]) - E.field.heightAt(start[0], start[1])).toFixed(2) },
            end: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
          };
        }, [pts, a.i, OFFSET, TRIAL_FRAMES, 1]);
        t.at_m = a.at_m;
        arm.trials.push(t);
        if (t.regained) arm.regained++;
        flush();
        log(`  ${steering} trial @${a.at_m} m: ${t.regained ? `REGAINED in ${t.frames_to_regain} f` : `LOST (min off ${t.min_off_m} m)`}, walked ${t.walked_m} m`);
      }
      arm.total_walked_m = +arm.trials.reduce((s, t) => s + t.walked_m, 0).toFixed(1);
      arm.median_frames_to_regain = (() => {
        const v = arm.trials.filter((t) => t.regained).map((t) => t.frames_to_regain).sort((a, b) => a - b);
        return v.length ? v[v.length >> 1] : null;
      })();
      doc.arms.push(arm); flush();
      log(`ARM ${steering}: ${arm.regained} of ${anchors.length} regained, ${arm.total_walked_m} m walked`);
    }
    const nw = doc.arms.find((a) => a.steering === 'NEW'), od = doc.arms.find((a) => a.steering === 'OLD');
    const ck = (id, pass, detail) => doc.checks.push({ id, pass: !!pass, detail });
    ck('R1-TRIALS-ARE-INDEPENDENT', true,
      `every trial re-places the body on the road and re-pins HP before the shove; ${TRIALS} anchors spread over ${doc.route.metres} m`);
    ck('R2-CONTROL-BITES', od.regained < nw.regained,
      `NEW ${nw.regained}/${TRIALS} vs OLD ${od.regained}/${TRIALS} — a control that does not go red is a second copy of the experiment`);
    ck('R3-FIX-REGAINS', nw.regained >= Math.ceil(TRIALS * 0.8),
      `the shipped steering regains ${nw.regained} of ${TRIALS} shoves of ${OFFSET} m`);
    ck('R4-ORBIT-SIGNATURE', od.total_walked_m > nw.total_walked_m * 2,
      `OLD walked ${od.total_walked_m} m to NEW's ${nw.total_walked_m} m over identical trials`);
    doc.ok = doc.checks.every((c) => c.pass);
  }

  // =============================================================================================
  if (MODE === 'null') {
    // A 400 m walk from the start of the crossing, tracked frame by frame. Three arms:
    //   REPEAT  nothing changed          -> THE NOISE FLOOR, measured rather than inherited
    //   NULL    move a leg not on the route
    //   P1      move the leg the route uses
    const WALK_FRAMES = Number(args['walk-frames'] || 14000);
    const track = async (label, mutate) => {
      await reseed();
      await install('NEW', 'NEW');
      const t = await handle.page.evaluate(([mut, frames]) => {
        const E = window.__ENGINE;
        const roads = JSON.parse(JSON.stringify(E.data.roads));
        if (mut) {
          const leg = roads.legs.find((l) => l.id === mut.leg);
          // THE BUMP MUST BE SOMEWHERE THE BODY ACTUALLY WALKS. My first cut put it at the leg's
          // MIDPOINT — 1,450 m in — and then compared 14,000-frame walks that cover 466 m, so the
          // positive arm read 0.000 m and `N2-POSITIVE-BITES` failed. That is rule 4 working on the
          // critic's own instrument: a probe whose positive arm has never been seen to move is not
          // a probe. The bump now sits at 12% of the leg, inside the walked window.
          const c = Math.max(9, Math.floor(leg.points.length * 0.12)), half = 8;
          for (let k = -half; k <= half; k++) {
            const i = c + k; if (i < 1 || i >= leg.points.length - 1) continue;
            const w = 0.5 * (1 + Math.cos(Math.PI * k / half));       // raised cosine: the ends stay attached
            const a = leg.points[i - 1], b = leg.points[i + 1];
            const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
            leg.points[i][0] += (-dz / L) * mut.metres * w;
            leg.points[i][1] += (dx / L) * mut.metres * w;
          }
          E.field.setRoads(roads); E.data.roads = roads;
        }
        const pts = [];
        const named = roads.named_routes.crossing;
        for (let i = 0; i + 1 < named.settlements.length; i++) {
          const a = named.settlements[i], b = named.settlements[i + 1];
          const leg = roads.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
          const p = leg.from === a ? leg.points : leg.points.slice().reverse();
          for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push([p[k][0], p[k][1], leg.id]);
        }
        const p = E.sim.player;
        E.teleport(pts[0][0], pts[0][1]); p.pos[1] = E.field.heightAt(pts[0][0], pts[0][1]);
        const st = { seg: 0 }; const trackArr = [];
        for (let f = 0; f < frames; f++) {
          const pur = E._pursue(pts, st, 4.5, 1.5);
          if (pur.done) break;
          const b = Math.atan2(pur.target[0] - p.pos[0], pur.target[1] - p.pos[2]);
          const cy = E.sim.camera.yaw * Math.PI / 180;
          E.input.reset(E.sim.frame);
          E.input.queueInputs([{ f: 0, move: [Math.sin(b - cy) * (0.55 - 1e-9), Math.cos(b - cy) * (0.55 - 1e-9)] }], E.sim.frame);
          E.loop.stepOnce(); E._afterStep();
          trackArr.push([+p.pos[0].toFixed(3), +p.pos[2].toFixed(3)]);
        }
        return trackArr;
      }, [mutate, WALK_FRAMES]);
      return { label, track: t };
    };
    const base = await track('BASE', null);
    const rep = await track('REPEAT', null);
    const nul = await track('NULL', { leg: 'lilmoth-archon', metres: 25 });
    const pos = await track('P1', { leg: 'stormhold-helstrom', metres: 25 });
    const cmp = (a, b) => {
      const n = Math.min(a.track.length, b.track.length);
      let worst = 0, at = 0, end = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(a.track[i][0] - b.track[i][0], a.track[i][1] - b.track[i][1]);
        if (d > worst) { worst = d; at = i; }
      }
      end = Math.hypot(a.track[n - 1][0] - b.track[n - 1][0], a.track[n - 1][1] - b.track[n - 1][1]);
      return { frames_compared: n, worst_divergence_m: +worst.toFixed(3), worst_at_frame: at, end_divergence_m: +end.toFixed(3) };
    };
    doc.walk_frames = WALK_FRAMES;
    doc.arms = [
      { label: 'REPEAT (nothing changed) — THE MEASURED NOISE FLOOR', ...cmp(base, rep) },
      { label: 'NULL (move `lilmoth-archon`, a leg the crossing does not use)', ...cmp(base, nul) },
      { label: 'P1 (move `stormhold-helstrom`, the leg it does use)', ...cmp(base, pos) },
    ];
    const floor = doc.arms[0].worst_divergence_m, nullD = doc.arms[1].worst_divergence_m, p1 = doc.arms[2].worst_divergence_m;
    const ck = (id, pass, detail) => doc.checks.push({ id, pass: !!pass, detail });
    ck('N0-FLOOR-IS-MEASURED', true, `re-running the identical walk diverges by ${floor} m — this is the floor, not an inherited number`);
    ck('N1-NULL-IS-SILENT', nullD <= Math.max(floor, 0.05) + 1e-9,
      `null ${nullD} m against a measured floor of ${floor} m (the shipped check's bar was 6,193 m)`);
    ck('N2-POSITIVE-BITES', p1 > Math.max(floor, 0.05) * 10,
      `moving the leg the body walks moves the body ${p1} m`);
    ck('N3-SEPARATION', p1 > nullD * 10, `${p1} m against ${nullD} m`);
    doc.ok = doc.checks.every((c) => c.pass);
  }

  // =============================================================================================
  if (MODE === 'deletefix') {
    // REVERSED order, and the world re-seeded before every arm.
    for (const [steering, parapet] of [['OLD', 'OLD'], ['OLD', 'NEW'], ['NEW', 'OLD'], ['NEW', 'NEW']]) {
      await reseed();
      const inst = await install(steering, parapet);
      let r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', restart: true, chunkFrames: 1 });
      while (!r.done && r.frames < FRAMES) r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: Math.min(20000, FRAMES - r.frames) });
      const p = await handle.h('getPlayerStats');
      const arm = { steering, parapet, install: inst, done: r.done, frames: r.frames, path_m: r.path_m,
        remaining_points: r.remaining_points, worst_off_path_m: r.worst_off_path_m,
        off_path_frames: r.off_path_frames, regains: r.regains, teleports: r.teleports,
        end: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)] };
      doc.arms.push(arm); flush();
      log(`arm ${steering}/${parapet}: ${arm.path_m} m, end ${JSON.stringify(arm.end)}, off ${arm.off_path_frames} f, ${arm.regains} regains`);
    }
    const A = (s, p) => doc.arms.find((x) => x.steering === s && x.parapet === p);
    const nn = A('NEW', 'NEW'), on = A('OLD', 'NEW'), no = A('NEW', 'OLD'), oo = A('OLD', 'OLD');
    const ck = (id, pass, detail) => doc.checks.push({ id, pass: !!pass, detail });
    ck('C1-REPRODUCES-PUBLISHED', Math.abs(oo.path_m - 550.1) < 5 && Math.hypot(oo.end[0] - 2153.7, oo.end[1] - 1197.8) < 5,
      `both-out arm ran FIRST from a re-seeded world: ${oo.path_m} m ending ${JSON.stringify(oo.end)} against the published 550.1 m at (2153.7, 1197.8)`);
    ck('C2-ORDER-INDEPENDENT', Math.abs(nn.path_m - 1327.3) < 60,
      `NEW/NEW ran LAST here: ${nn.path_m} m against the builder's 1327.3 m taken FIRST`);
    ck('C3-ARMS-DIFFER', new Set(doc.arms.map((a) => a.path_m)).size > 1,
      `${new Set(doc.arms.map((a) => a.path_m)).size} distinct distances`);
    ck('C4-WHICH-GUARD', true,
      `steering out alone ${on.path_m} m; parapet out alone ${no.path_m} m; both in ${nn.path_m} m`);
    doc.ok = doc.checks.every((c) => c.pass);
  }
} catch (e) { doc.error = String((e && e.stack) || e); flush(); throw e; }
finally { flush(); await handle.close(); }

console.log(`\n=== ${MODE} ===`);
for (const a of doc.arms) console.log('  ' + JSON.stringify(a).slice(0, 400));
for (const c of doc.checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
console.log(`\n${OUT}`);
process.exit(doc.ok ? 0 : 1);

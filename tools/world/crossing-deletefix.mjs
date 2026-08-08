#!/usr/bin/env node
/**
 * crossing-deletefix.mjs — RULES rule 6, run as a 2x2, with the control arms watched going red.
 *
 * W1-CROSSING lands two changes and rule 6 names three different things that can be true of a
 * pair like that, which look identical in a report unless you run the grid:
 *
 *   - an INERT FIX     — the change does nothing and something else carries the number;
 *   - an INERT CONTROL — the teardown does nothing, so both arms are the positive arm;
 *   - TWO GUARDS FOR ONE DEFECT — neither alone moves the number and only both together do.
 *
 * So: four arms, `steering` x `parapet`, each NEW or OLD, and OLD means **the pre-fix code put
 * back**, not the feature switched off. The old steering is reinstated as a replacement `_pursue`
 * that reproduces the shipped-at-345dcca loop exactly (advance the waypoint index on proximity,
 * beeline at that waypoint); the old parapet is the verbatim `clampToDeck` from 345dcca. Both are
 * installed on the LIVE objects the walk uses, and each arm re-reads them back out and refuses to
 * report if the install did not take — a control nobody has watched fail is a second copy of the
 * experiment.
 *
 * The measurement is the crossing walked for a fixed frame budget, which makes the arms
 * commensurable without paying for four full crossings: with the fix out, the published number to
 * reproduce is **550.1 m and a body at (2153.7, 1197.8)**.
 *
 * Usage: node tools/world/crossing-deletefix.mjs [--frames 60000] [--out reports/w1-crossing/deletefix.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `crossing-deletefix.mjs — the 2x2.
  --frames <n>   frame budget per arm (default 60000 — the budget the 550.1 m stall was published at)
  --out <file>   default reports/w1-crossing/deletefix.json`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const FRAMES = Number(args.frames || 60000);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/w1-crossing/deletefix.json')));
ensureDir(path.dirname(OUT));

const doc = {
  schema: 'elder-souls/crossing-deletefix@1', measured_at: new Date().toISOString(), git: gitInfo(),
  frames_per_arm: FRAMES, teardown_base: '345dcca (the last revision before W1-CROSSING)',
  arms: [], checks: [], ok: false,
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const OLD_PURSUE = `function (pts, st, lookahead, arrive) {
  // THE PRE-W1-CROSSING LOOP, restored. Advance the waypoint index on PROXIMITY and steer straight
  // at that one waypoint. \`st.seg\` stands in for the old \`w.idx - 1\`.
  const p = this.sim.player;
  const n = pts.length - 1;
  let idx = Math.min(st.seg + 1, n);
  while (idx < n && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < lookahead) idx++;
  st.seg = Math.max(0, idx - 1);
  const t = pts[idx];
  const d = Math.hypot(p.pos[0] - t[0], p.pos[2] - t[1]);
  // Reporting only — measured the same way in both arms so the off-path census is comparable.
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
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  // Stash the shipped implementations once, so every arm restores from the same origin.
  await handle.page.evaluate(() => {
    const E = window.__ENGINE;
    E.__newPursue = E._pursue;
    E.field.__newClamp = E.field.clampToDeck;
  });

  for (const steering of ['NEW', 'OLD']) {
    for (const parapet of ['NEW', 'OLD']) {
      const install = await handle.page.evaluate(([steer, para, oldPursue, oldClamp]) => {
        const E = window.__ENGINE;
        E._pursue = steer === 'NEW' ? E.__newPursue : eval(`(${oldPursue})`);
        E.field.clampToDeck = para === 'NEW' ? E.field.__newClamp : eval(`(${oldClamp})`);
        // THE CONTROL MUST BE SEEN TO BITE. Read the installed functions back out and prove they
        // are the ones asked for — W1-04's wall-collision control nulled a field one line before
        // calling a function that never read it, and all fifteen walks came back byte-identical.
        const src = { pursue: String(E._pursue).slice(0, 120), clamp: String(E.field.clampToDeck).slice(0, 120) };
        return {
          steering_is_new: E._pursue === E.__newPursue,
          parapet_is_new: E.field.clampToDeck === E.field.__newClamp,
          pursue_mentions_projection: /PROXIMITY/.test(String(E._pursue)) ? 'OLD' : 'NEW',
          clamp_mentions_end_flags: /spanFirst/.test(String(E.field.clampToDeck)) ? 'NEW' : 'OLD',
          src,
        };
      }, [steering, parapet, OLD_PURSUE, OLD_CLAMP]);
      if (install.pursue_mentions_projection !== steering || install.clamp_mentions_end_flags !== parapet) {
        throw new Error(`arm ${steering}/${parapet}: the teardown did not take — ${JSON.stringify(install)}. Refusing to report an arm that did not happen.`);
      }
      log(`arm steering=${steering} parapet=${parapet} ...`);
      let r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', restart: true, chunkFrames: 1 });
      while (!r.done && r.frames < FRAMES) r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: Math.min(20000, FRAMES - r.frames) });
      const p = await handle.h('getPlayerStats');
      const arm = { steering, parapet, install, done: r.done, frames: r.frames, path_m: r.path_m,
        minutes: r.minutes, remaining_points: r.remaining_points,
        worst_off_path_m: r.worst_off_path_m, off_path_frames: r.off_path_frames, regains: r.regains,
        end: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)] };
      doc.arms.push(arm); flush();
      log(`  ${arm.path_m} m, ${arm.frames} f, ${arm.remaining_points} pts left, end ${JSON.stringify(arm.end)}, `
        + `off-path worst ${arm.worst_off_path_m} m / ${arm.off_path_frames} f / ${arm.regains} regains`);
    }
  }
} catch (e) { doc.error = String(e && e.stack || e); flush(); throw e; }
finally { flush(); await handle.close(); }

const A = (s, p) => doc.arms.find((x) => x.steering === s && x.parapet === p);
const nn = A('NEW', 'NEW'), on = A('OLD', 'NEW'), no = A('NEW', 'OLD'), oo = A('OLD', 'OLD');
const ck = (id, pass, detail) => doc.checks.push({ id, pass: !!pass, detail });
ck('D1-FIX-CARRIES', nn.path_m > oo.path_m * 1.5,
  `both fixes in: ${nn.path_m} m; both out: ${oo.path_m} m`);
ck('D2-CONTROL-BITES', oo.path_m < nn.path_m * 0.7,
  `the teardown arm goes red — ${oo.path_m} m against the published pre-fix 550.1 m stall`);
ck('D3-WHICH-GUARD', true,
  `steering alone out: ${on.path_m} m; parapet alone out: ${no.path_m} m. `
  + (on.path_m < nn.path_m * 0.7 && no.path_m >= nn.path_m * 0.7
    ? 'THE STEERING IS THE FIX; the parapet is not load-bearing for this walk.'
    : on.path_m >= nn.path_m * 0.7 && no.path_m >= nn.path_m * 0.7
      ? 'TWO GUARDS FOR ONE DEFECT — neither alone moves it (rule 6, third shape).'
      : 'both are independently load-bearing.'));
ck('D4-ARMS-DIFFER', new Set(doc.arms.map((a) => a.path_m)).size > 1,
  `${new Set(doc.arms.map((a) => a.path_m)).size} distinct distances across 4 arms — an inert control would give 1`);
doc.ok = doc.checks.every((c) => c.pass);
flush();

console.log('\nsteering parapet   path_m  frames  left  worst_off  regains   end');
for (const a of doc.arms) console.log(`  ${a.steering.padEnd(7)} ${a.parapet.padEnd(8)} ${String(a.path_m).padStart(8)} ${String(a.frames).padStart(7)} ${String(a.remaining_points).padStart(5)} ${String(a.worst_off_path_m).padStart(10)} ${String(a.regains).padStart(8)}   ${JSON.stringify(a.end)}`);
for (const c of doc.checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
console.log(`\n${OUT}`);
process.exit(doc.ok ? 0 : 1);

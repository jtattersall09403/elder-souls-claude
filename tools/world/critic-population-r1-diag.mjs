#!/usr/bin/env node
/**
 * critic-population-r1-diag.mjs — WHY DID 6,000 m OF THE CROSSING MATERIALISE NOTHING?
 *
 * The round-1 critic's C1 arm walked 5,999.4 m of `named_routes.crossing` and reported
 * `spawned: 0` at all 200 samples. The builder's A1, at 0b2d6ef, reported 10 posts over
 * 1,229 m of the SAME route. Either the population pump has stopped firing since, or the
 * critic's instrument is wrong. A critic who publishes the first without excluding the second
 * has failed (RULES 4, RULES 10).
 *
 * Five questions, cheapest first, no walking:
 *   D1  Does the system exist and hold the table?      posts/dormant counts at boot.
 *   D2  What cell does the streamer think it is in?    `cellFor(sim.env)` + skipped_cell.
 *   D3  Teleport ONTO a post and step. Does it build?  The A5-style standing census.
 *   D4  Does stepping alone pump it?                   stats.steps must rise.
 *   D5  Is it the ROUTE HEAD specifically?             stand at the route head and step.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/world/population/critic-r1-diag.json');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/population-posts.json'), 'utf8')).posts;
const out = { tool: 'critic-population-r1-diag', at: new Date().toISOString(), D: {} };
try { out.commit = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* detached */ }
try { out.loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch { /* no procfs */ }
try { out.browsers = Number(execFileSync('bash', ['-lc', 'pgrep -c headless_shell || echo 0']).toString().trim()); } catch { /* none */ }

const look = () => {
  const H = window.__HARNESS, E = window.__ENGINE;
  const r = H.populationReport();
  return {
    cell: E.cellFor(E.sim.env),
    env_region: E.sim.env.region,
    env_interior: E.sim.env.interior,
    pos: { x: +E.sim.player.pos[0].toFixed(1), z: +E.sim.player.pos[2].toFixed(1) },
    frame: E.sim.frame,
    posts_total: r.posts_total, dormant: r.dormant, resident: r.resident, cleared: r.cleared,
    live_posts: r.live_posts, live_bodies: r.live_bodies, candidates: r.candidates,
    enabled: r.enabled, stats: r.stats, faults: r.faults.length,
    stream: r.stream,
    pop_bodies_in_entities: E.sim.entities.filter((e) => e.populationPost).length,
    entities_total: E.sim.entities.length,
  };
};

const handle = await launchGame({ width: 320, height: 240 });
handle.page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
try {
  await handle.page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 120000 });
  await handle.h('setRenderRate', 0);

  // D1/D2 — at boot, before anything is loaded.
  out.D.D1_boot = await handle.page.evaluate(look);

  await handle.h('loadState', 'default');
  await handle.h('clearInputs');
  await handle.h('stepFrames', 120);
  out.D.D2_after_default = await handle.page.evaluate(look);

  // D3 — stand ON a road post and step. No walking, no route.
  const p = posts.find((q) => q.id === 'pop-0001');
  out.D.target = p;
  await handle.h('teleport', p.x + 5, p.z + 5);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 600);
  out.D.D3_standing_on_post = await handle.page.evaluate(look);

  // D4 — does the pump run at all? steps must have risen between D2 and D3.
  out.D.D4_pump_runs = {
    steps_d2: out.D.D2_after_default.stats.steps,
    steps_d3: out.D.D3_standing_on_post.stats.steps,
    skipped_cell_d3: out.D.D3_standing_on_post.stats.skipped_cell,
    pump_is_running: out.D.D3_standing_on_post.stats.steps > out.D.D2_after_default.stats.steps,
    gated_out_by_cell: out.D.D3_standing_on_post.stats.skipped_cell > 0,
  };

  // D5 — the route head, where C1 started.
  await handle.h('teleport', 2171.5, 761);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 600);
  out.D.D5_route_head = await handle.page.evaluate(look);

  // D6 — a tier-5 post, to rule out "only this one post is broken".
  const t5 = posts.filter((q) => q.tier === 5 && q.bodies >= 2).sort((a, b) => b.souls - a.souls)[0];
  out.D.t5_target = t5;
  await handle.h('teleport', t5.x + 5, t5.z + 5);
  await handle.h('clearInputs');
  await handle.h('stepFrames', 600);
  out.D.D6_t5_post = await handle.page.evaluate(look);
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  try { await handle.close(); } catch { /* dead page */ }
}
console.log(JSON.stringify(out.D, null, 1));
console.log(`\nwrote ${OUT}`);

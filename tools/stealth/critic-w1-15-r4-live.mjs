#!/usr/bin/env node
// W1-15 ROUND 4 CRITIC — THE TWO THINGS THAT NEED A REAL BROWSER.
//
// ONE browser, launched once and kept (RULES.md 21).
//
//   A. THE FRAME-TIME NUMBER THE ROUND'S OWN RULING NEEDS AND DID NOT TAKE.
//      `world/interior-lighting.js` deletes `LIT_CAP` and marks the deletion REVERSIBLE against
//      "a measured frame-time regression attributable to >5 point lights in one room" — and the
//      round then published, in its own `not_done`: *"No timing figure appears anywhere in this
//      round's output."* The reversal condition of the round's own ruling is therefore unmeasured.
//      This arm measures it, in the worst room in the corpus (`thorn-hall`, 14 deduped lamps),
//      by drawing the SAME room with its lamp list truncated to 5 and with all 14, timing real
//      `renderer.render()` calls against a real WebGL context.
//
//      THE CONTROL THAT MUST GO RED: an arm with 40 lamps. If 5 -> 14 -> 40 does not move the
//      number monotonically, this instrument cannot see point-light cost at all and its "no
//      regression" result is worthless rather than reassuring. Checked, not assumed.
//
//   B. THE THIRD SITE, LIVE. `engine.js#cellFor()` routes `writ-house` and `barge-hold` to
//      `render/places.js`, which builds its own `PointLight`s and never calls
//      `world/interior-lighting.js`. Offline this critic measured 47 of 108 floor cells in
//      `writ-house` drawn lit and simulated dark. This arm walks the player in and asks the
//      RUNNING world which cell is drawn and what the stealth system thinks is lighting it.
//
// USAGE
//   node tools/stealth/critic-w1-15-r4-live.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-15-r4-live.mjs — the LIT_CAP frame-time number, and the third lighting site.

USAGE
  node tools/stealth/critic-w1-15-r4-live.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const h = await launchGame({ ...args, width: 960, height: 600 });
await h.page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 120000 });

const R = [];
const say = (s) => process.stdout.write(s + '\n');
const A = (id, name, got, pass, target) => { R.push({ id, name, got: String(got), target, pass }); say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${name}\n            got     ${got}\n            target  ${target}`); };

const N_RENDER = Number(args['renders'] || 60);
const OUT = { frametime: [] };

// The arms are driven one `page.evaluate` at a time so node can print progress between them: the
// first version of this file did all five inside one call, produced nothing for 900 s on a box at
// 7.5 per core, and was killed by its own timeout with no partial result. A long measurement that
// cannot say where it is is a measurement you cannot budget.
await h.page.evaluate(() => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('default');
  const E = window.__ENGINE;
  // Stash the room's declared lamps once, so every arm starts from the same list.
  const REC = E.settlements.interior('thorn-hall');
  window.__CRIT = { REC, declared: REC.lights.map((L) => ({ ...L, pos: L.pos.slice() })) };
});
OUT.webgl = await h.page.evaluate(() => {
  const gl = window.__ENGINE.renderer && window.__ENGINE.renderer.renderer;
  if (!gl) return { context: 'none' };
  try { const g = gl.getContext(); const d = g.getExtension('WEBGL_debug_renderer_info'); return { context: 'live', renderer_info: d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'unavailable' }; } catch (e) { return { context: 'live', renderer_info: 'unavailable' }; }
});
say(`  webgl: ${OUT.webgl.renderer_info || OUT.webgl.context}\n`);

// Interleaved A-B-A-C-A so a box that gets busier mid-run is visible rather than attributed.
for (const [label, kind] of [['cap5_as_LIT_CAP_shipped', 5], ['all14_as_this_round_ships', 0], ['cap5_repeat', 5], ['CONTROL_40_lamps', 40], ['all14_repeat', 0]]) {
  const t0 = Date.now();
  const row = await h.page.evaluate(async ({ label, kind, n }) => {
    const E = window.__ENGINE, C = window.__CRIT;
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    // Deduped the way both readers do it, so "5 lamps" means five POINT LIGHTS and not five rows.
    const seen = new Set(), uniq = [];
    for (const L of C.declared) { const p = L.pos, k = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`; if (seen.has(k)) continue; seen.add(k); uniq.push(L); }
    let rows = uniq;
    if (kind === 5) rows = uniq.slice(0, 5);
    if (kind === 40) { rows = []; for (let i = 0; i < 40; i++) { const s = uniq[i % uniq.length]; rows.push({ ...s, pos: [s.pos[0] + (i % 7) * 0.31, s.pos[1], s.pos[2] + Math.floor(i / 7) * 0.29] }); } }
    C.REC.lights = rows;
    // The room is drawn through the SHIPPED path, so what is timed is the renderer the player
    // runs. The only thing varied is the length of the record's `lights[]` — exactly what
    // `LIT_CAP` used to bound.
    E.enterInterior('thorn-hall');
    E.stepFrames(2);
    const s = E.renderer.interiorSummary || {};
    for (let i = 0; i < 10; i++) E.renderer.render(E.sim);        // shader compile is not frame time
    const samples = [];
    for (let i = 0; i < n; i++) { const a = performance.now(); E.renderer.render(E.sim); samples.push(performance.now() - a); }
    samples.sort((a, b) => a - b);
    return { arm: label, point_lights: s.lights_lit === undefined ? null : s.lights_lit,
      median_ms: r4(samples[Math.floor(samples.length / 2)]), mean_ms: r4(samples.reduce((a, b) => a + b, 0) / samples.length),
      p95_ms: r4(samples[Math.floor(samples.length * 0.95)]), n: samples.length };
  }, { label, kind, n: N_RENDER });
  OUT.frametime.push(row);
  say(`  ${row.arm.padEnd(28)} ${String(row.point_lights).padStart(3)} lights   median ${String(row.median_ms).padStart(8)} ms   mean ${String(row.mean_ms).padStart(8)} ms   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await h.page.evaluate(() => { const C = window.__CRIT; C.REC.lights = C.declared; window.__ENGINE.enterInterior('thorn-hall'); window.__ENGINE.stepFrames(2); });

Object.assign(OUT, await h.page.evaluate(async () => {
  const H = window.__HARNESS, E = window.__ENGINE;
  const O = {};
  const r4 = (v) => Math.round(v * 1e4) / 1e4;

  // ---- B. THE THIRD SITE, LIVE ---------------------------------------------------------------
  H.setRenderRate(0);
  O.third_site = {};
  for (const id of ['writ-house', 'barge-hold', 'thorn-hall']) {
    try { E.exitInterior(); } catch (e) { /* already outside */ }
    E.setTimeOfDay(12);
    E.enterInterior(id);
    E.stepFrames(3);
    const st = H.getStealthState();
    const cell = E.cellFor(E.sim.env);
    O.third_site[id] = {
      cell_drawn: cell,
      drawn_by: cell === 'interior' ? 'render/interior.js (reads world/interior-lighting.js)' : 'render/places.js (does NOT)',
      // What the RENDERER actually has in that cell's scene graph, counted off the live graph.
      drawn_point_lights: (() => {
        const root = E.renderer.cells[cell === 'interior' ? 'interior' : cell];
        let n = 0; if (root) root.traverse((o) => { if (o.isPointLight) n++; });
        return root ? n : null;
      })(),
      sim_world_sources: st.lights ? st.lights.world_sources : null,
      sim_synthesized: st.lights ? st.lights.synthesized_lamps : null,
      sim_ambient_L: st.lights ? r4(st.lights.ambient_L) : null,
      sim_interior_ambient: st.lights ? st.lights.interior_ambient : null,
      player_L: r4(st.terms.L),
    };
  }
  return O;
}));

say('\nA. THE FRAME-TIME NUMBER — thorn-hall, the worst room in the corpus\n');
say('  arm                          point lights   median ms   mean ms   p95 ms');
for (const a of OUT.frametime) say(`  ${a.arm.padEnd(28)} ${String(a.point_lights).padStart(8)}   ${String(a.median_ms).padStart(9)}   ${String(a.mean_ms).padStart(7)}   ${String(a.p95_ms).padStart(6)}`);
say(`\n  webgl renderer: ${OUT.webgl.renderer_info || OUT.webgl.context}`);

const by = (n) => OUT.frametime.filter((a) => a.arm.startsWith(n));
const m5 = by('cap5').reduce((a, b) => a + b.median_ms, 0) / by('cap5').length;
const m14 = by('all14').reduce((a, b) => a + b.median_ms, 0) / by('all14').length;
const m40 = OUT.frametime.find((a) => a.arm === 'CONTROL_40_lamps').median_ms;
const drift = Math.abs(by('cap5')[0].median_ms - by('cap5')[1].median_ms);
A('CRIT-T1', 'the 40-lamp CONTROL must be slower than 5 — or this instrument cannot see lamp cost',
  `5 lamps ${m5.toFixed(3)} ms, 40 lamps ${m40.toFixed(3)} ms`, m40 > m5 * 1.02, 'the control goes red');
A('CRIT-T2', 'LIT_CAP\'s reversal condition: is 14 lamps slower than 5 by more than the box drifts?',
  `5 lamps ${m5.toFixed(3)} ms, 14 lamps ${m14.toFixed(3)} ms, baseline drift between the two cap5 arms ${drift.toFixed(3)} ms`,
  true, 'a number, not a verdict — the ruling stands or falls on it');

say('\nB. THE THIRD SITE, LIVE\n');
for (const [id, v] of Object.entries(OUT.third_site)) {
  say(`  ${id.padEnd(14)} cell=${String(v.cell_drawn).padEnd(12)} drawn point lights ${String(v.drawn_point_lights).padStart(3)}   sim sources ${String(v.sim_world_sources).padStart(3)} (${v.sim_synthesized} synthesized)   ambient ${v.sim_ambient_L}   player L ${v.player_L}`);
  say(`                 ${v.drawn_by}`);
}
const wh = OUT.third_site['writ-house'];
A('CRIT-P1', '`writ-house` is drawn by a file that does not read the shared lighting policy',
  `cell '${wh.cell_drawn}', ${wh.drawn_point_lights} drawn point lights vs ${wh.sim_world_sources} simulated source(s), ${wh.sim_synthesized} of them a fail-open the renderer never sees`,
  wh.cell_drawn !== 'interior', 'the round claims render/interior.js and sim/stealth/system.js are the only two readers');
const bh = OUT.third_site['barge-hold'];
A('CRIT-P2', '`barge-hold` likewise, and it is the first room of the game',
  `cell '${bh.cell_drawn}', ${bh.drawn_point_lights} drawn vs ${bh.sim_world_sources} simulated`,
  bh.cell_drawn !== 'interior', 'same');
const th = OUT.third_site['thorn-hall'];
A('CRIT-P3', 'CONTROL — an ordinary interior IS drawn by the file that reads the policy',
  `cell '${th.cell_drawn}', ${th.drawn_point_lights} drawn vs ${th.sim_world_sources} simulated`,
  th.cell_drawn === 'interior' && th.drawn_point_lights === th.sim_world_sources, 'drawn == simulated for a room on the shared path');

await h.close();
const pass = R.filter((r) => r.pass).length;
say(`\n${pass}/${R.length}`);
if (args.json) writeJson(args.json, { assertions: R, data: OUT });
process.exit(R.every((r) => r.pass) ? 0 : 1);

#!/usr/bin/env node
// critic-w1-07-r2i.mjs — CRITIC instrument, W1-07 round 2, pass I.
// Does the browser build resolve a hit where tools/lib/combat-node.mjs says it must?
// cmb-reach (Node arena) reports straight-sword vs inf_trash contiguous 0.05-1.80 m.
// This pins the enemy in place, records the true separation on every sampled frame, and
// swings. Any whiff inside the Node band with the separation confirmed is a browser/Node
// divergence, not a probe artifact.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeI');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2i.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 3500)); };

async function launch() {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 320, height: 240 }, locale: 'en-GB', timezoneId: 'UTC' });
  const page = await context.newPage();
  await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready());
  return {
    page,
    async h(m, ...a) {
      const r = await page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
      if (r.err) throw new Error(`${m}(): ${r.err}`);
      return r.ok;
    },
    async soft(m, ...a) {
      return page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
    },
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
  };
}

const CH = { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' };

async function sweep(h, enemyId) {
  const rows = [];
  for (const d of [0.4, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8]) {
    await h.h('loadState', 'default');
    await h.h('setCharacter', CH);
    // spawn() takes WORLD coordinates; pass I's first run placed the dummy at the world
    // origin 5.7 km from the player, which invalidated its numbers. Place it relative to the
    // player, in front of the player's facing, and verify the separation before swinging.
    const ps0 = await h.h('getPlayerStats');
    const pp0 = ps0.pos || (ps0.player && ps0.player.pos);
    const yaw = ((ps0.yaw_deg !== undefined ? ps0.yaw_deg : (ps0.player && ps0.player.yaw_deg)) || 0) * Math.PI / 180;
    const ex = pp0[0] + Math.sin(yaw) * d, ez = pp0[2] + Math.cos(yaw) * d;
    const eid = await h.h('spawn', enemyId, ex, ez, { as: 'dummy' });
    await h.soft('setEntityPos', eid, ex, ez);
    await h.soft('lockOn', eid);
    await h.h('traceStart');
    // one swing, then look
    await h.h('queueInputs', [{ f: 6, press: ['light'] }, { f: 9, release: ['light'] }]);
    const samples = [];
    for (let k = 0; k < 12; k++) {
      await h.h('stepFrames', 10);
      const cs = await h.h('getCombatState');
      const ents = await h.h('listEntities');
      const ps = await h.h('getPlayerStats');
      const p = cs.player, e = (cs.enemies || [])[0];
      const ee = (Array.isArray(ents) ? ents : []).find((x) => x.eid === eid) || null;
      const pp = (ps && ps.pos) || (ps && ps.player && ps.player.pos) || null;
      if (!e) break;
      const sep = (ee && pp) ? +Math.hypot(ee.pos[0] - pp[0], ee.pos[2] - pp[2]).toFixed(3) : null;
      samples.push({ f: cs.frame, sep, e_pos: ee && ee.pos, p_pos: pp, p_state: p.state, e_hp: e.hp });
    }
    const t = await h.soft('traceDrain');
    const flat = [];
    const push = (x) => { if (Array.isArray(x)) x.forEach(push); else if (x && typeof x === 'object') { if (Array.isArray(x.events)) x.events.forEach(push); else flat.push(x); } };
    push(t.ok);
    const kinds = {}; for (const ev of flat) { const k = ev.type || ev.kind; kinds[k] = (kinds[k] || 0) + 1; }
    const cs = await h.h('getCombatState');
    const e = (cs.enemies || [])[0];
    rows.push({
      spawn_dist_m: d, enemy: enemyId,
      separation_min: Math.min(...samples.map((s) => (s.sep === null ? Infinity : s.sep))),
      separation_max: Math.max(...samples.map((s) => (s.sep === null ? -Infinity : s.sep))),
      enemy_hp_after: e ? e.hp : null,
      hit: !!(e && e.hp < e.hp_max),
      kinds, samples: samples.slice(0, 6),
    });
  }
  return rows;
}

async function main() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const trash = await sweep(h, 'inf_trash');
  let champ = null;
  try { champ = await sweep(h, 'champion_hist_marked'); } catch (e) { champ = [{ error: String(e.message) }]; }
  const geom = await h.soft('getHitGeometry');
  await h.close();
  T('I1-browser-vs-node-hit-resolution', {
    node_arena_says: 'cmb-reach --probe player --enemy inf_trash --weapons straight-sword => contiguous hits 0.05..1.80 m, ACCEPTANCE pass',
    browser_inf_trash: trash,
    browser_champion: champ,
    hit_geometry_sample: geom && geom.ok ? Object.keys(geom.ok) : geom,
  });
}

try { await main(); }
finally { fs.writeFileSync(path.join(OUT, 'probeI.json'), JSON.stringify(rec, null, 2)); }

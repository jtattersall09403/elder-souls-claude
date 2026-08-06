#!/usr/bin/env node
// critic-w1-07-r2b.mjs — CRITIC instrument, W1-07 round 2, pass B: CONSUMPTION (RI-MTH07).
//
// For every model this piece ships, PERTURB THE MODEL AND WATCH AN ENTITY CHANGE.
// Perturbation is done by intercepting the HTTP fetch of the data file with Playwright's
// route API and serving a mutated body — nothing on disk is touched, and the perturbed run
// is a genuine cold boot of the game against a different model.
//
// Models under test:
//   M1  race-reactions.json     (the 12x10 matrix + upbringing table)
//   M2  the RI-PRG02 derivation curves (character/derive.js constants, perturbed via attributes)
//   M3  birthsigns.json         (the composition: power scale, drawback, Kaal-Kaal halving)
//   M4  greetings.json          (300 cells / 1,500 lines)
//   M5  dialogue/topics/40-race-gated.json (96 race-gated topic records)
//   M6  rumours.json / slavery-lines.json
//
// A model whose perturbation changes NOTHING an entity does is `unmeasurable => 0`.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeB');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2b.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log(id, JSON.stringify(o).slice(0, 400)); };

/**
 * Boot the game with zero or more data files rewritten in flight.
 * @param {Record<string, (doc:any)=>any>} mutations  keyed by the tail of the URL path
 */
async function boot(mutations = {}) {
  const h = await launchGame({ width: 320, height: 240 });
  return h;
}
async function bootMutated(mutations) {
  const { chromium } = await import('playwright');
  void chromium;
  const h = await launchGameWithRoutes(mutations);
  return h;
}

// launchGame() goes straight to the page, so route installation has to happen inside a
// re-implementation. Instead we exploit that the game re-reads its data on `reset`? It does
// not. So: install the route by launching with a blank page first is not available either.
// The supported path is a second browser context — do it manually here.
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

async function launchGameWithRoutes(mutations) {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 320, height: 240 }, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'UTC' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  const hits = [];
  if (Object.keys(mutations).length) {
    await page.route('**/game/data/**', async (route) => {
      const url = route.request().url();
      for (const [tail, fn] of Object.entries(mutations)) {
        if (url.endsWith(tail)) {
          const res = await route.fetch();
          const doc = JSON.parse(await res.text());
          const out = fn(doc);
          hits.push(tail);
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
        }
      }
      return route.continue();
    });
  }
  await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready());
  const h = {
    page, browser, context, server, errors, hits,
    async h(m, ...a) {
      const r = await page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; }
        catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
      if (r.err) throw new Error(`${m}(): ${r.err}`);
      return r.ok;
    },
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
  };
  return h;
}

// ---------------------------------------------------------------------------------------
// M1 — the reaction matrix. Perturb one cell; does a PERSON in the room change?
// ---------------------------------------------------------------------------------------
async function m1() {
  const measure = async (h) => {
    await h.h('setMode', 'harness');
    await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', sex: 'female', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'X', hatch_name: 'Y' });
    await h.h('loadState', 'helstrom-market');
    const npcs = await h.h('listNPCs');
    const out = { npcs: npcs.map((n) => ({ eid: n.eid, group: n.reaction_group })) };
    out.disp = {};
    for (const n of npcs) out.disp[n.eid] = await h.h('npcDisposition', n.eid);
    out.price = await h.h('getPriceQuote', { group: 'RG-DEEP', base_price: 60 });
    out.reaction = await h.h('getReaction', { group: 'RG-DEEP' });
    return out;
  };
  const base = await launchGameWithRoutes({});
  const A = await measure(base); await base.close();
  const pert = await launchGameWithRoutes({
    'progression/race-reactions.json': (d) => { d.matrix['RG-DEEP'].dunmer = 14; return d; },
  });
  const B = await measure(pert);
  const hits = pert.hits.slice(); await pert.close();
  const changedNpcs = Object.keys(A.disp).filter((k) => B.disp[k] && A.disp[k].disposition !== B.disp[k].disposition);
  T('M1-reaction-matrix-consumption', {
    route_hit: hits,
    baseline_disp: Object.fromEntries(Object.entries(A.disp).map(([k, v]) => [k, [v.group, v.disposition, v.band]])),
    perturbed_disp: Object.fromEntries(Object.entries(B.disp).map(([k, v]) => [k, [v.group, v.disposition, v.band]])),
    entities_whose_disposition_moved: changedNpcs,
    price_before: A.price && A.price.buy, price_after: B.price && B.price.buy,
    verdict: changedNpcs.length ? 'a person in the room changed' : 'NO ENTITY CHANGED',
  });
  return { A, B };
}

// ---------------------------------------------------------------------------------------
// M2 — the derivation curves. Does the FIGHT read hp_max, or only getDerivedStats()?
// ---------------------------------------------------------------------------------------
async function m2() {
  const h = await launchGameWithRoutes({});
  const run = async (race, cls) => {
    await h.h('setMode', 'harness');
    await h.h('loadState', 'default');
    await h.h('setCharacter', { race, upbringing: 'foreign-born', sex: 'male', class: cls, birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' });
    const d = await h.h('getDerivedStats');
    const before = await h.h('getCombatState');
    // Deal a FIXED amount of damage and see how many hits it takes to fall over. If the fight
    // reads the pool, a VIG-6 Bosmer dies in fewer hits than a VIG-18 Orsimer.
    let hits = 0, dead = false;
    for (let i = 0; i < 40 && !dead; i++) {
      await h.h('damagePlayer', 50);
      hits++;
      const s = await h.h('getCombatState');
      const hp = s && s.player ? s.player.hp : null;
      if (hp !== null && hp <= 0) dead = true;
    }
    return {
      race, vig: d.from.vigour, end: d.from.endurance, wil: d.from.willpower,
      hp_max_sheet: d.hp_max, hp_max_live: d.live ? d.live.hp_max : null,
      stamina_max_live: d.live ? d.live.stamina_max : null,
      focus_max_live: d.focus_live ? d.focus_live.focus_max : null,
      hits_of_50_to_fall: hits, died: dead,
      combat_hp_max_before: before && before.player ? before.player.hp_max : null,
    };
  };
  const rows = [];
  rows.push(await run('orsimer', 'marsh-knight'));
  rows.push(await run('bosmer', 'wet-foot'));
  rows.push(await run('dunmer', 'salt-blade'));
  const curves = (await h.h('getDerivedStats')).curves;
  await h.close();
  T('M2-derivation-consumption', {
    rows, curves,
    verdict: (new Set(rows.map((r) => r.hits_of_50_to_fall))).size > 1
      ? 'the fight reads the pool: different VIGOUR, different number of hits to fall'
      : 'THE FIGHT DOES NOT READ THE POOL',
  });
  return rows;
}

// ---------------------------------------------------------------------------------------
// M3 — birthsigns. Perturb The Dry Well's power scale and its drawback.
// ---------------------------------------------------------------------------------------
async function m3() {
  const measure = async (h) => {
    await h.h('setMode', 'harness');
    await h.h('loadState', 'default');
    const out = {};
    for (const sign of ['raj-xul', 'nu-ixtu']) {
      await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'sap-reader', birthsign: sign, given_name: 'A', hatch_name: 'B' });
      const d = await h.h('getDerivedStats');
      const m0 = await h.h('getMagicState');
      // burn focus, then rest at a hearth: does it come back?
      let spent = null;
      try { spent = await h.h('setAttuned', null); } catch { /* ignore */ }
      const rest = await h.h('hearthRest');
      out[sign] = {
        focus_max: d.focus_max, focus_live: d.focus_live, restores_at_hearth: d.focus_restores_at_hearth,
        hearth: rest, magic_focus_max: m0 ? m0.focus_max : null, spent,
      };
    }
    // Kaal-Kaal composition
    await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'sap-reader', birthsign: 'kaal-kaal', birthsign_second: 'nu-ixtu', given_name: 'A', hatch_name: 'B' });
    const dk = await h.h('getDerivedStats');
    out['kaal-kaal+nu-ixtu'] = { focus_max: dk.focus_max, restores_at_hearth: dk.focus_restores_at_hearth };
    return out;
  };
  const base = await launchGameWithRoutes({});
  const A = await measure(base); await base.close();
  const pert = await launchGameWithRoutes({
    'progression/birthsigns.json': (d) => {
      const s = d.signs.find((x) => x.id === 'nu-ixtu');
      for (const k of Object.keys(s)) {
        if (typeof s[k] === 'object' && s[k]) JSON.stringify(s[k]);
      }
      // find the 1.6 multiplier wherever it lives and halve it
      const walk = (o) => {
        if (Array.isArray(o)) return o.forEach(walk);
        if (o && typeof o === 'object') {
          for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'number' && Math.abs(v - 1.6) < 1e-9) o[k] = 1.0;
            else walk(v);
          }
        }
      };
      walk(s);
      return d;
    },
  });
  const B = await measure(pert);
  const hits = pert.hits.slice(); await pert.close();
  T('M3-birthsign-consumption', {
    route_hit: hits, baseline: A, perturbed: B,
    verdict: A['nu-ixtu'].focus_max !== B['nu-ixtu'].focus_max
      ? 'the sign multiplier reaches the live focus pool'
      : 'THE SIGN MULTIPLIER IS NOT READ FROM DATA (hard-coded or unread)',
  });
  return { A, B };
}

// ---------------------------------------------------------------------------------------
// M4/M5/M6 — greetings, race-gated topics, rumours, slavery lines.
// Is there ANY path from the running world to these files?
// ---------------------------------------------------------------------------------------
async function m456() {
  const h = await launchGameWithRoutes({});
  await h.h('setMode', 'harness');
  await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' });
  await h.h('loadState', 'helstrom-market');
  const verbs = await h.page.evaluate(() => Object.keys(window.__HARNESS));
  const npcs = await h.h('listNPCs');
  const files = await h.h('dataFiles').catch(() => null);
  // Ask the world for a greeting by every plausible route.
  const attempts = {};
  for (const v of verbs) {
    if (/greet|rumour|rumor/i.test(v)) attempts[v] = 'verb exists';
  }
  // does any NPC's topic list carry a race-gated topic id?
  const gated = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/dialogue/topics/40-race-gated.json'), 'utf8'));
  const gatedIds = new Set((gated.topics || gated.records || []).map((t) => t.id));
  const npcTopics = new Set();
  for (const n of npcs) for (const t of n.topics) npcTopics.add(t);
  const overlap = [...npcTopics].filter((t) => gatedIds.has(t));
  await h.close();
  T('M4-greeting-consumption', {
    greeting_verbs_on_harness: Object.keys(attempts),
    npcs_in_state: npcs.map((n) => ({ eid: n.eid, group: n.reaction_group, topics: n.topics.length })),
    verdict: Object.keys(attempts).length ? 'a greeting verb exists' : 'NO VERB, NO RUNTIME PATH: greetings.json is loaded and read by nothing',
  });
  T('M5-race-gated-topic-consumption', {
    race_gated_topic_records: gatedIds.size,
    distinct_topic_ids_carried_by_live_npcs: npcTopics.size,
    overlap_count: overlap.length, overlap_sample: overlap.slice(0, 10),
    verdict: overlap.length ? 'a live NPC carries a race-gated topic' : 'NO LIVE NPC CARRIES ANY RACE-GATED TOPIC',
  });
  rec.data_files = files ? (Array.isArray(files) ? files.length : files) : null;
}

try {
  await m1();
  await m2();
  await m3();
  await m456();
} finally {
  fs.writeFileSync(path.join(OUT, 'probeB.json'), JSON.stringify(rec, null, 2));
}

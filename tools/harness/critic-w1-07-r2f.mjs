#!/usr/bin/env node
// critic-w1-07-r2f.mjs — CRITIC instrument, W1-07 round 2, pass F.
//  F1  RI-PRG03: do connecting hits bank progress, and do swings at air bank none?
//  F2  the questionnaire route's OUTPUT: does it produce a class, and can it reach >=10 of 14?
//  F3  RI-JRN01 O1/O3/M3: is there a title surface at all?
//  F4  price: the Mercantile-100 par clause, derived from the character.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeF');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2f.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 3500)); };

async function launch() {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 320, height: 240 }, locale: 'en-GB', timezoneId: 'UTC' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready());
  return {
    page, errors,
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

async function f1() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  await h.h('loadState', 'default');
  await h.h('setCharacter', CH);
  const s0 = await h.h('getSkillSheet');
  // A: swing at empty air.
  const inputs = [];
  for (let f = 10; f < 3000; f += 40) { inputs.push({ f, press: ['light'] }, { f: f + 2, release: ['light'] }); }
  await h.h('queueInputs', inputs);
  await h.h('stepFrames', 3000);
  const sAir = await h.h('getSkillSheet');
  // B: swing at a body.
  await h.h('loadState', 'default');
  await h.h('setCharacter', CH);
  const eid = await h.h('spawn', 'inf_trash', 0, 1.2, { as: 'dummy' });
  await h.soft('lockOn', eid);
  await h.soft('setLoadout', { weapon: 'straight-sword' });
  const sB0 = await h.h('getSkillSheet');
  await h.h('queueInputs', inputs);
  await h.h('traceStart').catch(() => {});
  await h.h('stepFrames', 3000);
  const evs = await h.h('traceDrain').catch(() => []);
  const all = Array.isArray(evs) ? evs : (evs && evs.events) || [];
  const flat = []; for (const x of all) { if (Array.isArray(x.events)) for (const e of x.events) flat.push(e); else flat.push(x); }
  const hits = flat.filter((e) => (e.kind || e.type) === 'HIT' && e.src === 'P').length;
  const kinds = {}; for (const e of flat) { const k = e.kind || e.type; kinds[k] = (kinds[k] || 0) + 1; }
  const sB = await h.h('getSkillSheet');
  const gate0 = await h.soft('grantSkillUse', 'lock_picked', { cost: 0 });
  const gate1 = await h.soft('grantSkillUse', 'lock_picked', { cost: 1 });
  await h.close();
  const pick = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'object' ? [v.value, v.progress] : v]).filter(([, v]) => Array.isArray(v) && (v[0] !== 5 || v[1])));
  T('F1-skills-by-use', {
    air_swings_progress: pick(sAir), baseline: pick(s0),
    hits_on_body: hits, event_kinds: kinds, body_progress: pick(sB), body_baseline: pick(sB0),
    cost_gate_zero: gate0, cost_gate_one: gate1,
  });
}

async function f2() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const classes = new Set();
  const answers = ['a', 'b', 'c', 'd'];
  for (let seedIdx = 0; seedIdx < 24; seedIdx++) {
    await h.h('censusBegin', { race: ['dunmer', 'saxhleel', 'naga', 'khajiit', 'nord', 'breton'][seedIdx % 6] });
    await h.h('censusAnswer', 'Silence-Under-Salt');
    await h.h('censusEnter');
    await h.h('censusAnswer', 'correct');
    await h.h('censusAnswer', 'unrecorded');
    await h.h('censusAnswer', ['interior', 'lukiul', 'foreign-born', 'blackrose'][seedIdx % 4]);
    await h.h('censusAnswer', 'Neras Athrenil');
    await h.h('censusAnswer', 'questionnaire');
    for (let q = 0; q < 12; q++) {
      const s = await h.h('getCensusState');
      if (!s.node || s.node !== 'writ.class-questions') break;
      await h.h('censusAnswer', answers[(seedIdx + q) % 4]);
    }
    let s = await h.h('getCensusState');
    if (s.node === 'writ.birthsign') await h.h('censusAnswer', 'raj-xul');
    const ch = await h.h('getCharacter');
    classes.add(ch && ch.class);
  }
  await h.close();
  T('F2-questionnaire-reachable-classes', {
    distinct_classes_reached: [...classes],
    count: classes.size,
    floor: '>= 10 of 14 (RI-CHR01 §5); >= 6 is the hard-fail floor',
  });
}

async function f3() {
  const h = await launch();
  const dom = await h.page.evaluate(() => ({
    body_text: document.body.innerText,
    elements: Array.from(document.querySelectorAll('body *')).map((e) => e.tagName),
  }));
  const ax = await h.page.accessibility.snapshot();
  const ui = await h.soft('getUIState');
  const modes = await h.soft('listPerspectiveModes');
  await h.close();
  T('F3-title-surface', {
    dom, accessibility_tree: ax, getUIState: ui,
    perspective_modes: modes && modes.ok,
    verdict: (dom.elements.filter((t) => t !== 'CANVAS' && t !== 'SCRIPT').length === 0)
      ? 'NO TITLE SURFACE AND NO FOCUSABLE ELEMENT EXISTS: RI-JRN01 O1/O3 and M3 are unbuilt'
      : 'something exists in the DOM',
  });
}

async function f4() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  await h.h('loadState', 'helstrom-market');
  const out = {};
  await h.h('setCharacter', { ...CH, class: 'salt-blade' });
  out.untrained = await h.h('getPriceQuote', { group: 'RG-DEEP', base_price: 60 });
  await h.h('setSkills', { mercantile: 100 }).catch(() => {});
  await h.h('setAttributes', { personality: 60 }).catch(() => {});
  out.trained = await h.h('getPriceQuote', { group: 'RG-DEEP', base_price: 60 });
  out.sheet = await h.h('getPlayerStats');
  await h.close();
  T('F4-price-par-clause', {
    untrained_effective_buy: out.untrained.effective_buy_mult,
    trained_effective_buy: out.trained.effective_buy_mult,
    untrained_surcharge_only: out.untrained.buy_surcharge_only,
    trained_surcharge_only: out.trained.buy_surcharge_only,
    trained_terms: out.trained.skill_terms,
    bar: '[0.98, 1.05] for the Mercantile-100 / PER-60 Dunmer (RI-CHR02 M7)',
    in_bar: out.trained.effective_buy_mult >= 0.98 && out.trained.effective_buy_mult <= 1.05,
  });
}

try { await f1(); await f2(); await f3(); await f4(); }
finally { fs.writeFileSync(path.join(OUT, 'probeF.json'), JSON.stringify(rec, null, 2)); }

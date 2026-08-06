#!/usr/bin/env node
// critic-w1-07-r2g.mjs — CRITIC instrument, W1-07 round 2, pass G.
//  G1  RI-CHR01 §5: how many of the 14 NAMED classes are reachable from the questionnaire?
//  G2  RI-PRG03: connecting hits vs swings at air, with the player actually landing hits.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeG');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2g.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 3000)); };

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

async function g1() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const RACES = ['dunmer', 'saxhleel', 'naga', 'khajiit', 'nord', 'breton', 'imperial', 'orsimer', 'bosmer', 'redguard'];
  const UP = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
  const named = new Set(); const families = new Set(); const custom = [];
  const rows = [];
  let n = 0;
  for (let i = 0; i < 160; i++) {
    const race = RACES[i % 10], up = UP[(i / 10 | 0) % 4];
    await h.h('censusBegin', { race });
    await h.h('censusAnswer', 'Silence-Under-Salt');
    await h.h('censusEnter');
    await h.h('censusAnswer', 'correct');
    await h.h('censusAnswer', 'unrecorded');
    await h.h('censusAnswer', up);
    await h.h('censusAnswer', 'Neras Athrenil');
    await h.h('censusAnswer', 'questionnaire');
    // a deterministic but varied answer pattern per run
    for (let q = 0; q < 12; q++) {
      const s = await h.h('getCensusState');
      if (!s.node || s.node !== 'writ.class-questions') break;
      await h.h('censusAnswer', 'abcd'[(i * 7 + q * 3 + (q * q)) % 4]);
    }
    let s = await h.h('getCensusState');
    if (s.node === 'writ.class-custom-name') { await h.h('censusAnswer', 'Nameless'); s = await h.h('getCensusState'); }
    if (s.node === 'writ.birthsign') { await h.h('censusAnswer', 'raj-xul'); }
    const ch = await h.h('getCharacter');
    n++;
    if (ch.class_id && ch.class_id !== 'custom') named.add(ch.class_id); else custom.push(ch.class_name);
    families.add(ch.class_family);
    if (rows.length < 8) rows.push({ race, up, class_id: ch.class_id, class_name: ch.class_name, family: ch.class_family, fit: ch.class_family_fit });
  }
  const all = await h.h('getCreationData');
  const roster = (all.classes && all.classes.classes ? all.classes.classes : []).map((c) => c.id);
  await h.close();
  T('G1-questionnaire-named-class-reach', {
    runs: n, roster_size: roster.length, roster,
    named_classes_reached: [...named], named_count: named.size,
    runs_producing_custom: custom.length, custom_names_sample: [...new Set(custom)].slice(0, 6),
    families_reached: [...families],
    sample_rows: rows,
    bar: 'RI-CHR01 scoring: >= 10 of 14 named classes questionnaire-reachable for the 10 band, >= 6 for the pass floor, < 6 = we lose',
  });
}

async function g2() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const CH = { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' };
  const run = async (withTarget) => {
    await h.h('loadState', 'default');
    await h.h('setCharacter', CH);
    let eid = null;
    if (withTarget) {
      eid = await h.h('spawn', 'inf_trash', 0, 1.4, { as: 'dummy' });
      await h.soft('lockOn', eid);
    }
    const before = await h.h('getSkillSheet');
    const inputs = [];
    for (let f = 20; f < 3400; f += 46) inputs.push({ f, press: ['light'] }, { f: f + 2, release: ['light'] });
    await h.h('queueInputs', inputs);
    await h.h('combatTraceStart').catch(() => {});
    await h.h('stepFrames', 3400);
    const drained = await h.soft('combatTraceDrain');
    const flat = [];
    const push = (x) => { if (Array.isArray(x)) x.forEach(push); else if (x && typeof x === 'object') { if (Array.isArray(x.events)) x.events.forEach(push); else flat.push(x); } };
    push(drained.ok);
    const kinds = {}; for (const e of flat) { const k = e.kind || e.type; kinds[k] = (kinds[k] || 0) + 1; }
    const after = await h.h('getSkillSheet');
    return { withTarget, kinds, blades_before: before.blades, blades_after: after.blades };
  };
  const air = await run(false);
  const body = await run(true);
  const g0 = await h.soft('grantSkillUse', 'lock_picked', { cost: 0 });
  const g1c = await h.soft('grantSkillUse', 'lock_picked', { cost: 1 });
  await h.close();
  T('G2-skills-by-use', { air, body, cost_gate_zero: g0, cost_gate_one: g1c });
}

try { await g1(); await g2(); }
finally { fs.writeFileSync(path.join(OUT, 'probeG.json'), JSON.stringify(rec, null, 2)); }

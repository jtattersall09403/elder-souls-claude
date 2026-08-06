#!/usr/bin/env node
// critic-w1-07-r2h.mjs — CRITIC instrument, W1-07 round 2, pass H.
//  H1  RI-CHR01 §5 redone with an UNBIASED answer pattern (pass G's pattern only ever
//      selected answers a and c; that was a probe defect and its number is withdrawn).
//  H2  RI-PRG03: the player actually swinging and connecting, diagnosed step by step.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeH');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2h.mjs', tests: [] };
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

// A deliberately even answer pattern: every run walks a different permutation of a,b,c,d.
const PATTERNS = [];
for (const perm of ['abcd', 'badc', 'cdab', 'dcba', 'acbd', 'bdac', 'cadb', 'dbca']) PATTERNS.push(perm);

async function h1() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  const RACES = ['dunmer', 'saxhleel', 'naga', 'khajiit', 'nord', 'breton', 'imperial', 'orsimer', 'bosmer', 'redguard'];
  const UP = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
  const named = new Map(); const families = new Map(); let custom = 0, runs = 0;
  const answerHistogram = { a: 0, b: 0, c: 0, d: 0 };
  const rows = [];
  for (let i = 0; i < 240; i++) {
    const race = RACES[i % 10], up = UP[(i / 10 | 0) % 4], pat = PATTERNS[i % PATTERNS.length];
    await h.h('censusBegin', { race });
    await h.h('censusAnswer', 'Silence-Under-Salt');
    await h.h('censusEnter');
    await h.h('censusAnswer', 'correct');
    await h.h('censusAnswer', 'unrecorded');
    await h.h('censusAnswer', up);
    await h.h('censusAnswer', 'Neras Athrenil');
    await h.h('censusAnswer', 'questionnaire');
    for (let q = 0; q < 12; q++) {
      const s = await h.h('getCensusState');
      if (!s.node || s.node !== 'writ.class-questions') break;
      const ans = pat[(q + (i / 8 | 0)) % 4];
      answerHistogram[ans]++;
      await h.h('censusAnswer', ans);
    }
    let s = await h.h('getCensusState');
    if (s.node === 'writ.class-custom-name') { await h.h('censusAnswer', 'Nameless'); s = await h.h('getCensusState'); }
    if (s.node === 'writ.birthsign') await h.h('censusAnswer', 'raj-xul');
    const ch = await h.h('getCharacter');
    runs++;
    if (ch.class_id && ch.class_id !== 'custom') named.set(ch.class_id, (named.get(ch.class_id) || 0) + 1); else custom++;
    families.set(ch.class_family, (families.get(ch.class_family) || 0) + 1);
    if (rows.length < 6) rows.push({ race, up, pat, class_id: ch.class_id, class_name: ch.class_name, family: ch.class_family, fit: ch.class_family_fit });
  }
  const cd = await h.h('getCreationData');
  const roster = (cd.classes && cd.classes.classes ? cd.classes.classes : []).map((c) => c.id);
  await h.close();
  T('H1-questionnaire-named-class-reach', {
    runs, answer_histogram: answerHistogram, roster_size: roster.length,
    named_classes_reached: [...named.entries()], named_count: named.size,
    runs_producing_custom: custom, families: [...families.entries()], sample_rows: rows,
    bar: 'RI-CHR01 scoring: >= 10 of 14 named classes questionnaire-reachable for 10; >= 6 for the pass floor; < 6 = the 0 band',
  });
}

async function h2() {
  const h = await launch();
  await h.h('setRenderRate', 0);
  await h.h('setMode', 'harness');
  await h.h('loadState', 'default');
  await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', sex: 'male', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'A', hatch_name: 'B' });
  const eid = await h.h('spawn', 'inf_trash', 0, 1.4, { as: 'dummy' });
  const lock = await h.soft('lockOn', eid);
  const cs0 = await h.h('getCombatState');
  const before = await h.h('getSkillSheet');
  await h.h('traceStart');
  const inputs = [];
  for (let f = 20; f < 3400; f += 60) inputs.push({ f, press: ['light'] }, { f: f + 3, release: ['light'] });
  await h.h('queueInputs', inputs);
  const states = [];
  for (let k = 0; k < 34; k++) {
    await h.h('stepFrames', 100);
    const cs = await h.h('getCombatState');
    if (states.length < 8) states.push({ f: cs.frame, p_state: cs.player && cs.player.state, p_move: cs.player && cs.player.move, e_hp: (cs.enemies || [])[0] && (cs.enemies || [])[0].hp });
  }
  const t = await h.soft('traceDrain');
  const flat = [];
  const push = (x) => { if (Array.isArray(x)) x.forEach(push); else if (x && typeof x === 'object') { if (Array.isArray(x.events)) x.events.forEach(push); else flat.push(x); } };
  push(t.ok);
  const kinds = {}; for (const e of flat) { const k = e.type || e.kind; kinds[k] = (kinds[k] || 0) + 1; }
  const hits = flat.filter((e) => (e.type || e.kind) === 'HIT' && e.src === 'P');
  const after = await h.h('getSkillSheet');
  const cs1 = await h.h('getCombatState');
  await h.close();
  T('H2-player-hits-and-skill-progress', {
    lock_on: lock, event_kinds: kinds,
    player_hits: hits.length, sample_hit: hits[0] || null,
    blades_before: before.blades, blades_after: after.blades,
    enemy_hp_before: (cs0.enemies || [])[0] && (cs0.enemies || [])[0].hp,
    enemy_hp_after: (cs1.enemies || [])[0] && (cs1.enemies || [])[0].hp,
    state_samples: states,
  });
}

try { await h1(); await h2(); }
finally { fs.writeFileSync(path.join(OUT, 'probeH.json'), JSON.stringify(rec, null, 2)); }

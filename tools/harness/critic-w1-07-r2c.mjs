#!/usr/bin/env node
// critic-w1-07-r2c.mjs — CRITIC instrument, W1-07 round 2, pass C.
// Re-runs the reaction-matrix perturbation with the character set AFTER loadState (pass B's
// ordering let loadState reset the character, which would have produced a false finding), and
// adds: race-conditioned topic offers, the observability of The Dry Well's drawback once Focus
// is actually SPENT, and the questionnaire's dilemma text against what is drawn.
import fs from 'node:fs';
import path from 'node:path';
import { serveDir } from '../lib/serve.mjs';
import { DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeC');
fs.mkdirSync(OUT, { recursive: true });
const rec = { generated_by: 'tools/harness/critic-w1-07-r2c.mjs', tests: [] };
const T = (id, o) => { rec.tests.push({ id, ...o }); console.log('\n== ' + id + '\n' + JSON.stringify(o, null, 1).slice(0, 2500)); };

async function launch(mutations = {}) {
  const { chromium } = await import('playwright');
  const server = await serveDir(REPO);
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: { width: 320, height: 240 }, locale: 'en-GB', timezoneId: 'UTC' });
  const page = await context.newPage();
  const errors = []; const hits = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  if (Object.keys(mutations).length) {
    await page.route('**/game/data/**', async (route) => {
      const url = route.request().url();
      for (const [tail, fn] of Object.entries(mutations)) {
        if (url.endsWith(tail)) {
          const res = await route.fetch();
          const doc = fn(JSON.parse(await res.text()));
          hits.push(tail);
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doc) });
        }
      }
      return route.continue();
    });
  }
  await page.goto(server.origin + '/game/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.ready());
  return {
    page, errors, hits,
    async h(m, ...a) {
      const r = await page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
      if (r.err) throw new Error(`${m}(): ${r.err}`);
      return r.ok;
    },
    async hSoft(m, ...a) {
      return page.evaluate(async ({ m, a }) => {
        try { return { ok: await window.__HARNESS[m](...a) }; } catch (e) { return { err: String(e && e.message || e) }; }
      }, { m, a });
    },
    async close() { try { await context.close(); } catch {} try { await browser.close(); } catch {} await server.close(); },
  };
}

const CH = (race, up) => ({ race, upbringing: up, sex: 'female', class: 'salt-blade', birthsign: 'raj-xul', given_name: 'Neras', hatch_name: 'Silence-Under-Salt' });

// ---- C1: the matrix, with the character set AFTER the state loads -----------------------
async function c1() {
  const measure = async (h) => {
    await h.h('setMode', 'harness');
    await h.h('loadState', 'helstrom-market');
    const out = {};
    for (const [race, up] of [['dunmer', 'foreign-born'], ['saxhleel', 'interior']]) {
      await h.h('setCharacter', CH(race, up));
      const npcs = await h.h('listNPCs');
      const row = {};
      for (const n of npcs) {
        const d = await h.h('npcDisposition', n.eid);
        row[n.eid] = { group: d.group, disp: d.disposition, band: d.band, term: d.term, topics: n.topics.slice() };
      }
      row._price = await h.h('getPriceQuote', { group: 'RG-DEEP', base_price: 60 });
      out[race] = row;
    }
    return out;
  };
  const a = await launch({}); const A = await measure(a); const errA = a.errors.slice(); await a.close();
  const b = await launch({ 'progression/race-reactions.json': (d) => { d.matrix['RG-DEEP'].dunmer = 14; return d; } });
  const B = await measure(b); const hits = b.hits.slice(); await b.close();

  const moved = [];
  for (const eid of Object.keys(A.dunmer)) {
    if (eid.startsWith('_')) continue;
    if (A.dunmer[eid].disp !== B.dunmer[eid].disp) moved.push({ eid, group: A.dunmer[eid].group, before: A.dunmer[eid].disp, after: B.dunmer[eid].disp });
  }
  // race changes the topic list an NPC offers?
  const topicDiff = [];
  for (const eid of Object.keys(A.dunmer)) {
    if (eid.startsWith('_')) continue;
    const td = A.dunmer[eid].topics.join(','), ts = A.saxhleel[eid].topics.join(',');
    topicDiff.push({ eid, dunmer_topics: A.dunmer[eid].topics, saxhleel_topics: A.saxhleel[eid].topics, identical: td === ts });
  }
  T('C1-matrix-perturbation-vs-entity', {
    route_hit: hits, page_errors: errA,
    baseline_dunmer: Object.fromEntries(Object.entries(A.dunmer).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, [v.group, v.disp, v.band, v.term]])),
    perturbed_dunmer: Object.fromEntries(Object.entries(B.dunmer).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, [v.group, v.disp, v.band, v.term]])),
    baseline_saxhleel: Object.fromEntries(Object.entries(A.saxhleel).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, [v.group, v.disp, v.band, v.term]])),
    entities_whose_disposition_moved: moved,
    price_dunmer_before: A.dunmer._price, price_dunmer_after: B.dunmer._price,
    verdict_matrix: moved.length ? 'PERTURBING THE MATRIX MOVED A PERSON IN THE ROOM' : 'the matrix perturbation changed nothing about any entity',
  });
  T('C1b-topics-by-race', {
    per_npc: topicDiff,
    all_identical: topicDiff.every((t) => t.identical),
    verdict: topicDiff.every((t) => t.identical)
      ? 'THE TOPIC LIST AN NPC OFFERS IS IDENTICAL FOR A DUNMER AND A SAXHLEEL — requires.race/forbids.race is never evaluated'
      : 'race filters the topic list',
  });
}

// ---- C2: is The Dry Well's drawback OBSERVABLE once Focus is spent? ---------------------
async function c2() {
  const h = await launch({});
  const run = async (sign) => {
    await h.h('setMode', 'harness');
    await h.h('loadState', 'default');
    await h.h('setCharacter', { ...CH('breton', 'foreign-born'), class: 'sap-reader', birthsign: sign });
    const d0 = await h.h('getDerivedStats');
    const before = await h.h('getMagicState');
    // Spend focus: learn a spell, attune it, cast it.
    const spells = await h.hSoft('getMagicData');
    let cast = null, spent = null;
    const spellId = (() => {
      const md = spells.ok;
      if (!md) return null;
      const list = md.spells || md.effects || [];
      const arr = Array.isArray(list) ? list : Object.values(list);
      const s = arr.find((x) => x && (x.id || x.spell_id));
      return s ? (s.id || s.spell_id) : null;
    })();
    if (spellId) {
      await h.hSoft('learnSpell', spellId);
      await h.hSoft('setAttuned', [spellId]);
      cast = await h.hSoft('queueInputs', [{ frame: 1, action: 'cast', down: true }]);
      await h.hSoft('stepFrames', 120);
      spent = await h.hSoft('getMagicState');
    }
    const rest = await h.h('hearthRest');
    const after = await h.h('getMagicState');
    return { sign, spell_used: spellId, focus_max: d0.focus_max, before: before && { f: before.focus, m: before.focus_max }, spent: spent && spent.ok && { f: spent.ok.focus, m: spent.ok.focus_max }, hearth: rest, after: { f: after.focus, m: after.focus_max } };
  };
  const rows = [await run('raj-xul'), await run('nu-ixtu')];
  await h.close();
  T('C2-dry-well-drawback-observable', {
    rows,
    verdict: 'see focus before/after: the drawback is only observable if Focus can actually be spent below max',
  });
}

// ---- C3: the questionnaire's dilemma text, model vs drawn -------------------------------
async function c3() {
  const h = await launch({});
  await h.h('setMode', 'harness');
  await h.h('censusBegin', { race: 'dunmer' });
  await h.h('censusAnswer', 'Silence-Under-Salt');
  await h.h('censusEnter');
  await h.h('censusAnswer', 'correct');
  await h.h('censusAnswer', 'unrecorded');
  await h.h('censusAnswer', 'interior');
  await h.h('censusAnswer', 'Neras Athrenil');
  await h.h('censusAnswer', 'questionnaire');
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const st = await h.h('getCensusState');
    if (!st.node || st.node !== 'writ.class-questions') break;
    rows.push({
      i, question_number: st.question_number, question_id: st.question && st.question.id,
      question_text: st.question && st.question.text,
      line_field: st.line,
      rendered_text: st.surface ? st.surface.rendered_text : null,
      question_text_is_drawn: !!(st.question && st.surface && st.surface.rendered_text.some((t) => t === st.question.text)),
    });
    await h.h('censusAnswer', 'a');
  }
  const done = await h.h('getCensusState');
  const writ = await h.h('readWrit');
  await h.close();
  T('C3-questionnaire-text-rendered', {
    rows: rows.map((r) => ({ i: r.i, q: r.question_id, question_text: r.question_text, line_drawn: r.line_field, drawn: r.question_text_is_drawn })),
    distinct_question_texts: new Set(rows.map((r) => r.question_text)).size,
    distinct_drawn_lines: new Set(rows.map((r) => r.line_field)).size,
    questions_whose_text_reaches_the_frame: rows.filter((r) => r.question_text_is_drawn).length,
    writ_present: !!writ,
    writ_rendered_after_stamp: done.surface ? done.surface.rendered_text : null,
    verdict: rows.filter((r) => r.question_text_is_drawn).length === 0
      ? 'NONE OF THE TEN DILEMMAS IS EVER DRAWN. The player sees four answers with no question.'
      : 'the dilemma text reaches the frame',
  });
}

try { await c1(); await c2(); await c3(); }
finally { fs.writeFileSync(path.join(OUT, 'probeC.json'), JSON.stringify(rec, null, 2)); }

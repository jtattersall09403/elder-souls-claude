#!/usr/bin/env node
// critic-w1-07b.mjs — W1-07 CRITIC probe B: does race change the world in the RUNNING build?
// RI-CHR02 methods 3, 7, 8, 9 driven live, plus the close-range encounter behaviour the
// shipped scenario never reaches.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/probeB');
fs.mkdirSync(OUT, { recursive: true });

const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const GROUPS = ['RG-DEEP', 'RG-ROOT', 'RG-LUKIUL', 'RG-NAGA', 'RG-LEDGER', 'RG-EMPIRE', 'RG-DRES', 'RG-BWC', 'RG-VAKH', 'RG-COURT', 'RG-TOWN', 'RG-OUTLAW'];

const h = await launchGame({ width: 1280, height: 720 });
const rec = { url: h.url, build: h.buildInfo, sections: {} };

try {
  // ---- 1. the matrix, read from the running build ------------------------------------------
  const data = await h.h('getCreationData');
  fs.writeFileSync(path.join(OUT, 'creation-data.json'), JSON.stringify(data, null, 2));
  rec.sections.data_sizes = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : typeof v)]));

  // ---- 2. RI-CHR02 method 3: the disposition oracle, live -----------------------------------
  const disp = {};
  for (const g of GROUPS) {
    disp[g] = {};
    for (const r of RACES) {
      disp[g][r] = await h.h('getReaction', { group: g, race: r, upbringing: 'foreign-born', baseDisposition: 50, personality: 10 });
    }
  }
  rec.sections.disposition = disp;

  // the §4a worked rows A-E
  rec.sections.worked_4a = {};
  for (const [k, q] of Object.entries({
    A: { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'interior' },
    B: { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'lukiul' },
    C: { group: 'RG-DEEP', race: 'imperial', upbringing: 'foreign-born' },
    D: { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born' },
    E: { group: 'RG-DEEP', race: 'dunmer', upbringing: 'lukiul' },
  })) rec.sections.worked_4a[k] = await h.h('getReaction', { ...q, baseDisposition: 50, personality: 10 });

  // ---- 3. RI-CHR02 method 7: prices --------------------------------------------------------
  rec.sections.prices = {};
  for (const [k, q] of Object.entries({
    sax_interior: { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'interior' },
    imp_foreign: { group: 'RG-DEEP', race: 'imperial', upbringing: 'foreign-born' },
    dun_foreign: { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born' },
    dun_best_social: { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born', mercantile: 100, personality: 60 },
  })) rec.sections.prices[k] = await h.h('getPriceQuote', { ...q, item: 'healing-draught', base: 60 });

  // ---- 4. RI-CHR02 method 9: guard terms ---------------------------------------------------
  rec.sections.guards = {};
  for (const r of RACES) rec.sections.guards[r] = await h.h('getGuardTerms', r);

  // ---- 5. AR-3 at close range: does the aggro band actually fire? ---------------------------
  // The shipped scenario never gets the player inside 18.2 m at HEAD, so the <=14 m Khajiit
  // band is never exercised. Drive the player in by hand and watch the encounter.
  rec.sections.encounter = {};
  for (const r of ['saxhleel', 'dunmer', 'khajiit', 'nord']) {
    await h.h('setCharacter', { race: r, upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul', name: 'Probe', sex: 'unrecorded' });
    await h.h('loadState', 'wld-dres-raid-road');
    const spawned = { note: 'encounter is spawned by the state; not respawned' };
    const track = [];
    let ev = [];
    await h.h('traceStart', { shape: 'frame', enemies: true, events: true });
    // step the player toward the party in 2 m increments and record what the encounter does
    for (let z = 30; z >= 2; z -= 2) {
      await h.h('teleport', 0, z, {});
      await h.h('stepFrames', 30);
      const st = await h.hOpt('getEncounterState', 'dres-raid-party');
      const drained = await h.hOpt('traceDrain');
      const events = (drained || []).flatMap((f) => (f.events || []).map((e) => ({ f: f.f, ...e })));
      ev = ev.concat(events);
      const ents = await h.hOpt('listEntities') || [];
      const en = ents.filter((e) => String(e.id || e.eid || '').includes('dres'));
      track.push({ z, encounter_state: st, n_entities: en.length, states: en.map((e) => e.state), events: events.map((e) => `${e.type}:${e.to || e.kind || ''}@${e.dist_m ?? ''}`) });
    }
    rec.sections.encounter[r] = { spawned, track, all_events: ev };
  }

  // ---- 6. does anything in the world READ the matrix? --------------------------------------
  await h.h('loadState', 'writ-house');
  rec.sections.writ_house_entities = await h.hOpt('listEntities');
  rec.sections.states_tried = {};
  for (const s of ['helstrom-market', 'stormhold-street', 'rootlands-well-graph', 'writ-house']) {
    try {
      const r = await h.page.evaluate(async (st) => { try { await window.__HARNESS.loadState(st); return { ok: true, entities: (window.__HARNESS.listEntities() || []).length }; } catch (e) { return { ok: false, err: String(e.message || e) }; } }, s);
      rec.sections.states_tried[s] = r;
    } catch (e) { rec.sections.states_tried[s] = { ok: false, err: String(e) }; }
  }
} catch (e) {
  rec.error = String(e && e.stack || e);
} finally {
  rec.page_errors = h.errors.slice(0, 10);
  await h.close();
}
fs.writeFileSync(path.join(OUT, 'probeB.json'), JSON.stringify(rec, null, 2));
console.log('wrote probeB.json; error:', rec.error ? rec.error.slice(0, 500) : 'none');

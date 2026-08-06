#!/usr/bin/env node
// critic-w1-07c.mjs — W1-07 CRITIC probe C.
// RI-PRG02 (the sheet, two streams), RI-PRG03 (skills by use, S3 purity),
// RI-CHR03 (drawbacks that bind), and the "does anything ever attack" AR-3 question.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/probeC');
fs.mkdirSync(OUT, { recursive: true });
const h = await launchGame({ width: 1280, height: 720 });
const rec = { url: h.url, build: h.buildInfo, s: {} };
const spec = (p) => ({ race: 'dunmer', upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul', name: 'Probe', sex: 'unrecorded', ...p });

try {
  // ---- 1. the composed sheet -----------------------------------------------------------------
  rec.s.sheet = {};
  for (const [k, p] of Object.entries({
    salt_blade_dunmer: {},
    sap_reader_orsimer: { race: 'orsimer', class: 'sap-reader' },
    wet_foot_khajiit: { race: 'khajiit', class: 'wet-foot' },
  })) rec.s.sheet[k] = await h.h('setCharacter', spec(p));
  rec.s.getCharacter = await h.h('getCharacter');
  rec.s.playerStats = await h.h('getPlayerStats');

  // ---- 2. prices, this time feeding RI-PRG05's own multiplier as the API demands --------------
  rec.s.price_par = {
    raw: await h.h('getPriceQuote', { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born', base_price: 60 }),
    with_fence_mult: await h.h('getPriceQuote', { group: 'RG-DEEP', race: 'dunmer', upbringing: 'foreign-born', base_price: 60, skill_buy_mult: 0.80, skill_sell_mult: 1.0 }),
    sax_ref: await h.h('getPriceQuote', { group: 'RG-DEEP', race: 'saxhleel', upbringing: 'interior', base_price: 60 }),
  };

  // ---- 3. RI-CHR03 method 2: the Dry Well must have ZERO Focus regen, ever --------------------
  rec.s.dry_well = {};
  for (const sign of ['nu-ixtu', 'raj-xul']) {
    await h.h('setCharacter', spec({ birthsign: sign }));
    await h.h('loadState', 'arena_flat').catch(() => {});
    const f0 = await h.hOpt('getMagicState');
    const series = [];
    for (let i = 0; i < 12; i++) { await h.h('stepFrames', 300); const m = await h.hOpt('getMagicState'); series.push(m && (m.focus ?? m.reservoir ?? null)); }
    rec.s.dry_well[sign] = { char: (await h.h('getCharacter')), focus_start: f0 && (f0.focus ?? f0.reservoir ?? null), series, magic_state_sample: f0 };
  }
  // Kaal-Kaal composition (method 9)
  try {
    rec.s.kaal_kaal = await h.h('setCharacter', spec({ birthsign: 'kaal-kaal', second_birthsign: 'nu-ixtu' }));
  } catch (e) { rec.s.kaal_kaal_err = String(e.message || e); }

  // ---- 4. RI-PRG03: do skills improve by use? -------------------------------------------------
  await h.h('setCharacter', spec({}));
  await h.h('loadState', 'arena_duel');
  const before = await h.h('getCharacter');
  const ents0 = await h.hOpt('listEntities');
  rec.s.skill_use = { entities: ents0, before_skills: before && before.skills };
  // land a long series of swings on whatever is here
  await h.h('queueInputs', Array.from({ length: 60 }, (_, i) => ({ f: 10 + i * 30, press: ['attack_light'] })));
  await h.h('stepFrames', 2000);
  const after = await h.h('getCharacter');
  rec.s.skill_use.after_skills = after && after.skills;
  rec.s.skill_use.player_after = await h.h('getPlayerStats');

  // ---- 5. "who attacks you": drop the player next to the raid party and wait ------------------
  rec.s.attack_test = {};
  for (const race of ['saxhleel', 'dunmer']) {
    const page = h.page;
    await page.evaluate(async (r) => {
      const H = window.__HARNESS;
      H.reset({});
      H.setCharacter({ race: r, upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul', name: 'P', sex: 'unrecorded' });
      await H.loadState('wld-dres-raid-road');
    }, race);
    const encState = await h.hOpt('getEncounterState', 'dres-raid-party');
    const ents = await h.hOpt('listEntities') || [];
    const dres = ents.filter((e) => String(e.eid || e.id || '').includes('dres'));
    // stand 3 m from the first raider
    const t = dres[0];
    if (t && t.pos) await h.h('teleport', t.pos[0] + 3, t.pos[2], {});
    const hp0 = (await h.h('getPlayerStats')).hp;
    await h.h('traceStart', { shape: 'frame', enemies: true, events: true });
    await h.h('stepFrames', 900);
    const drained = await h.hOpt('traceDrain') || [];
    await h.h('traceStop');
    const evs = drained.flatMap((f) => (f.events || []).map((e) => ({ f: f.f, ...e })));
    const hp1 = (await h.h('getPlayerStats')).hp;
    const states = {};
    for (const f of drained) for (const e of f.enemies || []) states[(e.eid || e.id) + ':' + e.state] = (states[(e.eid || e.id) + ':' + e.state] || 0) + 1;
    rec.s.attack_test[race] = { encounter_race_reported: encState && encState.race, n_dres: dres.length, hp_before: hp0, hp_after: hp1, damage_taken: hp0 - hp1, event_types: evs.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {}), enemy_state_histogram: states, events_sample: evs.slice(0, 12) };
  }

  // ---- 6. control: does the combat system attack AT ALL in this build? ------------------------
  await h.h('reset', {});
  await h.h('loadState', 'arena_duel');
  const ents = await h.hOpt('listEntities') || [];
  const foe = ents.find((e) => e.kind === 'enemy' || String(e.eid || '').match(/inf|enemy|dgr/));
  if (foe) { await h.hOpt('aggro', foe.eid || foe.id); }
  const hp0 = (await h.h('getPlayerStats')).hp;
  await h.h('stepFrames', 900);
  const hp1 = (await h.h('getPlayerStats')).hp;
  rec.s.control_arena = { entities: ents.map((e) => ({ eid: e.eid || e.id, kind: e.kind, state: e.state })), hp_before: hp0, hp_after: hp1, damage_taken: hp0 - hp1 };
} catch (e) {
  rec.error = String(e && e.stack || e);
} finally {
  rec.page_errors = h.errors.slice(0, 10);
  await h.close();
}
fs.writeFileSync(path.join(OUT, 'probeC.json'), JSON.stringify(rec, null, 2));
console.log('wrote probeC.json; error:', rec.error ? rec.error.slice(0, 600) : 'none');

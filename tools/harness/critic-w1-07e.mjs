#!/usr/bin/env node
// critic-w1-07e.mjs — W1-07 CRITIC probe E: RI-PRG03's headline, fairly.
// Land REAL connecting hits (the Cost Gate's only qualifying event for a weapon skill) and
// then ask whether the skill moved. Also: the earned-attribute stream (RI-PRG02 §2).
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/probeE');
fs.mkdirSync(OUT, { recursive: true });
const h = await launchGame({ width: 1280, height: 720 });
const rec = { url: h.url, build: h.buildInfo };
try {
  await h.h('reset', {});
  await h.h('setSeed', 1337);
  await h.h('loadState', 'arena_flat');
  await h.h('teleport', 0, 0, {});
  await h.h('spawn', 'inf_trash', 0, 7, { as: 'e0' });
  const ch0 = await h.h('setCharacter', { race: 'dunmer', upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul', name: 'A', sex: 'unrecorded' });
  const ents = await h.hOpt('listEntities') || [];
  const foe = ents[0];
  await h.hOpt('lockOn', 'e0');
  // walk into contact then swing on a long cycle so every swing has a fresh target
  const script = [];
  script.push({ f: 0, move: [0, 1] });
  script.push({ f: 90, move: [0, 0] });
  for (let i = 0; i < 100; i++) { script.push({ f: 100 + i * 35, press: ['light'] }); script.push({ f: 102 + i * 35, release: ['light'] }); }
  await h.h('queueInputs', script);
  await h.h('traceStart', { shape: 'frame', enemies: true, events: true });
  let hits = 0, evAll = [];
  for (let b = 0; b < 12; b++) {
    await h.h('stepFrames', 300);
    const fr = await h.hOpt('traceDrain') || [];
    const evs = fr.flatMap((f) => (f.events || []).map((e) => ({ f: f.f, ...e })));
    evAll = evAll.concat(evs);
    hits += evs.filter((e) => e.type === 'hit' || e.type === 'HIT').length;
    // respawn the dummy if it died so hits keep accruing
    const alive = (await h.hOpt('listEntities') || []).length;
    if (alive === 0) { try { await h.h('spawn', 'inf_trash', 0, 3, { as: 'e' + b }); await h.hOpt('lockOn', 'e' + b); } catch { /* */ } }
  }
  await h.h('traceStop');
  const ch1 = await h.h('getCharacter');
  rec.hits_landed = hits;
  rec.event_counts = evAll.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {});
  rec.skills_before = ch0.skills;
  rec.skills_after = ch1.skills;
  rec.skills_changed = JSON.stringify(ch0.skills) !== JSON.stringify(ch1.skills);
  rec.attributes_before = ch0.attributes;
  rec.attributes_after = ch1.attributes;
  rec.attributes_changed = JSON.stringify(ch0.attributes) !== JSON.stringify(ch1.attributes);
  rec.character_after_keys = Object.keys(ch1);
  rec.progress_fields = Object.fromEntries(Object.entries(ch1).filter(([k]) => /progress|xp|use|earn|level/i.test(k)));
  rec.player_stats = await h.h('getPlayerStats');
} catch (e) { rec.error = String(e && e.stack || e); } finally { rec.page_errors = h.errors.slice(0, 8); await h.close(); }
fs.writeFileSync(path.join(OUT, 'probeE.json'), JSON.stringify(rec, null, 2));
console.log('hits:', rec.hits_landed, 'skills changed:', rec.skills_changed, 'attrs changed:', rec.attributes_changed, 'events:', JSON.stringify(rec.event_counts));

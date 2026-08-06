#!/usr/bin/env node
// critic-w1-07d.mjs — W1-07 CRITIC probe D: seam S3.
// (a) does weapon skill change DAMAGE?  (b) does it change WHETHER a swing lands or when?
// (c) do skills improve by use?  RI-PRG03 methods 3, 4, 5; RI-PRG02 method 5.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/probeD');
fs.mkdirSync(OUT, { recursive: true });
const h = await launchGame({ width: 1280, height: 720 });
const rec = { url: h.url, build: h.buildInfo, runs: {} };
const SPEC = {
  // Blades 25 (Salt-Blade sets blades to 25) vs Blades 5 (Sap-Reader touches no weapon skill)
  blades25: { race: 'dunmer', upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul', name: 'A', sex: 'unrecorded' },
  blades5: { race: 'breton', upbringing: 'foreign-born', class: 'sap-reader', birthsign: 'raj-xul', name: 'B', sex: 'unrecorded' },
};

try {
  for (const [k, spec] of Object.entries(SPEC)) {
    await h.h('reset', {});
    await h.h('setSeed', 1337);
    await h.h('loadState', 'arena_duel');
    const ch = await h.h('setCharacter', spec);
    const ents = await h.hOpt('listEntities') || [];
    const foe = ents[0];
    // identical scripted swing script for both
    await h.h('queueInputs', Array.from({ length: 24 }, (_, i) => ({ f: 30 + i * 90, press: ['light'] })));
    await h.h('combatTraceStart', {});
    await h.h('traceStart', { shape: 'frame', enemies: true, events: true });
    await h.h('stepFrames', 2400);
    const frames = await h.hOpt('traceDrain') || [];
    const cmb = await h.hOpt('combatTraceDrain') || [];
    await h.h('traceStop');
    const evs = frames.flatMap((f) => (f.events || []).map((e) => ({ f: f.f, ...e })));
    const hits = evs.filter((e) => /hit|HIT|damage/i.test(String(e.type)));
    const after = await h.h('getCharacter');
    rec.runs[k] = {
      character_skills: ch && ch.skills,
      foe,
      event_type_counts: evs.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {}),
      hit_events: hits.map((e) => ({ f: e.f, type: e.type, dmg: e.damage ?? e.dmg ?? e.amount ?? null, target: e.target ?? e.eid ?? null })),
      hit_frames: hits.map((e) => e.f),
      combat_trace_len: cmb.length,
      combat_trace_sample: cmb.slice(0, 3),
      skills_after: after && after.skills,
      skills_changed: JSON.stringify(ch && ch.skills) !== JSON.stringify(after && after.skills),
    };
  }
  rec.comparison = {
    hit_frames_identical: JSON.stringify(rec.runs.blades25.hit_frames) === JSON.stringify(rec.runs.blades5.hit_frames),
    damages_25: rec.runs.blades25.hit_events.map((e) => e.dmg),
    damages_5: rec.runs.blades5.hit_events.map((e) => e.dmg),
  };
} catch (e) {
  rec.error = String(e && e.stack || e);
} finally {
  rec.page_errors = h.errors.slice(0, 8);
  await h.close();
}
fs.writeFileSync(path.join(OUT, 'probeD.json'), JSON.stringify(rec, null, 2));
console.log('wrote probeD.json; error:', rec.error ? rec.error.slice(0, 500) : 'none');
console.log(JSON.stringify(rec.comparison));

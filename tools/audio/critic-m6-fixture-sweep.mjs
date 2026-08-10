#!/usr/bin/env node
// critic-m6-fixture-sweep.mjs — is RI-AUD01 M6's PASS a property of the PANNER or of the FIXTURE?
//
// Written for the W1-11 round-1 verdict (TOOL-LOOP rule 1: the method named a tool that did not
// exist, so it is built, and it is built so that it can fail).
//
// W1-11 shipped a fix to game/src/audio/impact-audio.js: a voice is positioned at the body the
// weapon MET (`e.dst`) rather than at the attacker, and a sabotage switch
// (`ImpactAudio.panSource = 'attacker'`) restores the old rule so the before-picture is measured
// rather than remembered. Its browser probe runs THREE arms and reports
//   shipped + orbiting target  r = 0.9999   PASS
//   legacy  + orbiting target  r = -0.5207  RED
//   shipped + still target     r = null     cannot decide
// and concludes `detector_goes_red = true`.
//
// THE QUESTION THIS TOOL ASKS. Under the legacy rule the voice sits at the attacker, so for a
// blow the PLAYER lands dx = dz = 0 and
//     pan = sin(atan2(0,0) - playerYaw) = sin(-playerYaw)
// which does not read the target's position AT ALL. Its correlation with the target's true
// bearing is therefore not a property of the bug — it is whatever the fixture's player-yaw
// history happens to make it. This tool sweeps the fixture and reports r for both rules.
//
// HOW IT CAN FAIL: if the legacy rule's r stayed below 0.80 on every fixture, this tool prints
// `LEGACY_NEVER_PASSES` and exits 0 with no finding. It exits 3 only when it has actually
// constructed a fixture on which the BROKEN rule passes M6.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const { ImpactAudio } = await import(`${ROOT}/game/src/audio/impact-audio.js`);
const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/audio/impact/classes.json`, 'utf8'));
const D = loadCombatData();
const OUT = process.argv[2] || null;

const pearson = (xs, ys) => { const n = xs.length; if (n < 2) return null;
  const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n; let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){const a=xs[i]-mx,b=ys[i]-my;sxy+=a*b;sxx+=a*a;syy+=b*b;}
  if(sxx===0||syy===0)return null; return sxy/Math.sqrt(sxx*syy); };

/**
 * @param fixture  orbit_player | orbit_world | still | player_turns | player_turns_pinned
 */
function run(fixture, panSource, opts = {}) {
  const amp = opts.yawAmp ?? 35, cycles = opts.cycles ?? 96, R = 1.4;
  const a = new NodeArena({ data: D, loadout: { weapon: 'csw_drowned_kris' } });
  a.bus = { emit: (f) => ({ f }) };
  const audio = new ImpactAudio(CLASSES, { seed: 1337, playerId: a.player.id, trigger_source: 'resolution' });
  audio.panSource = panSource;
  a.cs.setAudio(audio);
  const e = a.spawn('AUD', 'mat_flesh', 0, fixture.startsWith('player_turns') ? 1.15 : 1.4, 180);
  if (fixture === 'orbit_player' || fixture === 'still') a.lockOn('AUD');
  e.hp = 1e9;
  const world = []; let theta = fixture.startsWith('orbit') ? -40 : 0, ph = 0;
  for (let k = 0; k < cycles; k++) {
    a.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
    for (let f = 0; f < 46; f++) {
      const p = a.player;
      if (fixture.startsWith('orbit')) {
        theta += 0.9; if (theta > 40) theta = -40;
        const rad = ((fixture === 'orbit_player' ? p.yaw : 0) + theta) * Math.PI / 180;
        e.pos[0] = p.pos[0] + R * Math.sin(rad); e.pos[2] = p.pos[2] + R * Math.cos(rad);
      } else if (fixture.startsWith('player_turns')) {
        // The enemy STANDS STILL in the world; the PLAYER turns on the spot. Ordinary play.
        ph += 0.09;
        if (fixture === 'player_turns_pinned') { p.pos[0] = 0; p.pos[2] = 0; e.pos[0] = 0; e.pos[2] = 1.15; }
        p.yaw = amp * Math.sin(ph);
      }
      world.push({ frame: a.frame + 1, ex: e.pos[0], ez: e.pos[2], px: p.pos[0], pz: p.pos[2], pyaw: p.yaw });
      a.step();
    }
  }
  const byFrame = new Map(world.map(w => [w.frame, w]));
  const pts = [];
  for (const row of audio.log) {
    if (row.class === 'whiff') continue;
    const w = byFrame.get(row.frame); if (!w) continue;
    let rel = Math.atan2(w.ex - w.px, w.ez - w.pz) * 180 / Math.PI - w.pyaw;
    while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
    pts.push({ pan: row.pan, sinb: Math.sin(rel * Math.PI / 180), rel, dist: row.distance_m });
  }
  const r = pearson(pts.map(p => p.sinb), pts.map(p => p.pan));
  return { fixture, rule: panSource === 'attacker' ? 'LEGACY (attacker position)' : 'SHIPPED (impact position)',
    impacts: pts.length,
    bearing_spread_deg: pts.length ? +(Math.max(...pts.map(p=>p.rel)) - Math.min(...pts.map(p=>p.rel))).toFixed(1) : 0,
    pan_distinct: new Set(pts.map(p=>p.pan.toFixed(4))).size,
    distance_m_max: pts.length ? +Math.max(...pts.map(p=>p.dist)).toFixed(4) : null,
    all_noncontact_distances_positive: pts.length > 0 && pts.every(p => p.dist > 0),
    r: r === null ? null : +r.toFixed(4),
    M6_PASSES: r !== null && r >= 0.8 && pts.length >= 20
      && pts.every(p => p.dist > 0)
      && (Math.max(...pts.map(p => p.rel)) - Math.min(...pts.map(p => p.rel))) >= 70 };
}

const rows = [];
for (const fx of ['orbit_player', 'orbit_world', 'still', 'player_turns', 'player_turns_pinned'])
  for (const rule of ['impact', 'attacker'])
    rows.push(run(fx, rule, { cycles: fx === 'player_turns_pinned' ? 200 : 96 }));

const legacy = rows.filter(r => r.rule.startsWith('LEGACY'));
const legacyPass = legacy.filter(r => r.M6_PASSES);
const rs = legacy.filter(r => r.r !== null).map(r => r.r);
const out = {
  generated: new Date().toISOString(),
  question: 'Is RI-AUD01 M6 PASS a property of the panner or of the fixture?',
  m6_bar: { r_min: 0.8, events_min: 20, bearing_span_min_deg: 70, noncontact_distance_m: '>0' },
  rows,
  legacy_r_range: rs.length ? [Math.min(...rs), Math.max(...rs)] : null,
  legacy_fixtures_on_which_the_BROKEN_rule_PASSES_M6: legacyPass.map(r => r.fixture),
  distance_m_max_under_legacy: [...new Set(legacy.map(r => r.distance_m_max))],
  finding: legacyPass.length
    ? 'M6 as specified (Pearson r of pan against bearing) does NOT discriminate the two rules. The invariant that does is distance_m: under the legacy rule every player-landed blow is 0.0000 m from the listener on every fixture.'
    : 'LEGACY_NEVER_PASSES — no fixture found on which the broken rule passes M6.',
};
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 2)); }
for (const r of rows) console.log(`${r.fixture.padEnd(20)} ${r.rule.padEnd(28)} n=${String(r.impacts).padStart(3)} spread=${String(r.bearing_spread_deg).padStart(5)}deg dist_max=${r.distance_m_max} r=${r.r} ${r.M6_PASSES ? 'M6 PASSES' : 'M6 fails'}`);
console.log('\nlegacy r range:', out.legacy_r_range, '  broken rule passes M6 on:', out.legacy_fixtures_on_which_the_BROKEN_rule_PASSES_M6);
process.exit(legacyPass.length ? 3 : 0);

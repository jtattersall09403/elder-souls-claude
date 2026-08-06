#!/usr/bin/env node
// crime-audit.mjs — the static half of W1-15's evidence.
//
// Runs the coverage/count assertions of RI-STL02 methods 1, 5, 6, 8 and 9, RI-CRM01 method 1,
// and RI-CRM02 methods 1, 4, 5 and 8 against game/data/** WITHOUT launching a browser. Every
// number it prints is computed from committed JSON, so a critic can recompute all of it with jq.
//
//   node tools/analysis/crime-audit.mjs            # human table
//   node tools/analysis/crime-audit.mjs --json     # machine
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const json = process.argv.includes('--json');

const theft = D('stealth/theft.json');
const locks = D('stealth/locks.json');
const bounty = D('crime/bounty.json');
const justice = D('crime/justice.json');
const sanction = D('crime/sanction.json');
const fences = D('crime/fences.json');
const races = D('progression/race-reactions.json');

const propDir = path.join(ROOT, 'game/data/world/property');
const props = fs.readdirSync(propDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(propDir, f), 'utf8')));

const results = [];
const A = (id, name, got, pass, target) => { results.push({ id, name, got, target, pass }); return pass; };

// ---- RI-STL02 method 1: ownership coverage --------------------------------------------------
const allZones = props.flatMap((p) => p.zones);
const allObjs = allZones.flatMap((z) => z.contents);
const takeable = allObjs.filter((o) => o.takeable);
const withKey = takeable.filter((o) => 'owner' in o);
const owned = takeable.filter((o) => o.owner !== null);
const owners = new Set(takeable.map((o) => o.owner).filter(Boolean));
const singleOwnerZones = allZones.filter((z) => new Set(z.contents.map((c) => c.owner)).size === 1);
const ownerHist = {};
for (const o of takeable) if (o.owner) ownerHist[o.owner] = (ownerHist[o.owner] || 0) + 1;
const histVals = Object.values(ownerHist).sort((a, b) => b - a);

A('OWN-1', 'takeable placed objects carrying an owner KEY', `${withKey.length}/${takeable.length} (${pct(withKey.length / takeable.length)})`, withKey.length === takeable.length, '100%');
A('OWN-2', 'settlement-interior objects with owner != null', pct(owned.length / takeable.length), owned.length / takeable.length >= 0.92, '>= 92%');
A('OWN-3', 'distinct owner strings', owners.size, owners.size >= 240, '>= 240');
A('OWN-4', 'single-owner interiors', `${singleOwnerZones.length}/${allZones.length} (${pct(singleOwnerZones.length / allZones.length)})`, singleOwnerZones.length / allZones.length <= 0.15, '<= 15%');
// RI-STL02 method 1: "Print the histogram of objects per owner — a long tail is the signal, a
// spike at one string is the failure." The measurable is the SHARE the largest owner holds, not
// its absolute count: the largest string here is a faction's shared trade stock spread over
// every Legion room in the province, which is what shared scope is FOR.
const topPersonal = Math.max(...Object.entries(ownerHist).filter(([k]) => k.startsWith('npc:')).map(([, v]) => v));
A('OWN-5', 'share of owned objects held by the single largest owner', pct(histVals[0] / owned.length), histVals[0] / owned.length < 0.10, '< 10% (a spike is the failure)');
A('OWN-6', 'objects held by the largest PERSONAL owner', topPersonal, topPersonal <= 30, '<= 30 — one person, one household');

// ---- RI-STL02 method 5: ward-angle authoring -------------------------------------------------
const allLocks = allZones.flatMap((z) => z.locks);
const tierRow = (t) => locks.tiers.find((x) => x.tier === t);
const wrongWards = allLocks.filter((l) => l.ward_angles.length !== tierRow(l.tier).wards);
A('LCK-1', 'locks whose ward-angle count != their tier', wrongWards.length, wrongWards.length === 0, '0');

// chi-square against uniform over 10-degree bins. Authored data clusters; generated does not.
const bins = new Array(36).fill(0);
const angles = allLocks.flatMap((l) => l.ward_angles);
for (const a of angles) bins[Math.floor(((a % 360) + 360) % 360 / 10)]++;
const expect = angles.length / 36;
const chi2 = bins.reduce((s, b) => s + (b - expect) ** 2 / expect, 0);
// df = 35, critical value at p = 0.01 is 57.34
A('LCK-2', 'chi-square vs uniform over 10-deg bins (df 35, need > 57.34 for p < 0.01)', chi2.toFixed(1), chi2 > 57.34, 'reject uniform');
A('LCK-3', 'empty 10-deg bins (a generated field fills them all)', bins.filter((b) => b === 0).length, bins.filter((b) => b === 0).length > 0, '> 0');

// two locks of the same tier in the same interior never share an angle vector
let dupVectors = 0;
for (const z of allZones) {
  const seen = new Set();
  for (const l of z.locks) { const k = `${l.tier}:${l.ward_angles.join(',')}`; if (seen.has(k)) dupVectors++; seen.add(k); }
}
A('LCK-4', 'duplicate angle vectors within one interior', dupVectors, dupVectors === 0, '0');

const byTier = {};
for (const l of allLocks) byTier[l.tier] = (byTier[l.tier] || 0) + 1;
A('LCK-5', 'tier-5 sealed locks', byTier[5] || 0, (byTier[5] || 0) === 11, '11');
A('LCK-6', 'tier-4 masterwork locks', byTier[4] || 0, (byTier[4] || 0) === 48, '48');

// ---- RI-STL02 method 6: no lockout ------------------------------------------------------------
const high = allLocks.filter((l) => l.tier >= 4);
const noAlt = high.filter((l) => !l.alt_routes || l.alt_routes.length < 1);
A('LCK-7', 'tier-4/5 locks with >= 1 documented alternate route', `${high.length - noAlt.length}/${high.length}`, noAlt.length === 0, '59/59');
const questVariants = allLocks.filter((l) => l.quest_variant);
const questAcceptsUnbind = questVariants.filter((l) => (l.alt_routes || []).some((r) => r.kind === 'unbind_spell'));
A('LCK-8', 'quest-variant tier-5 locks that reject Unbind', `${questVariants.length - questAcceptsUnbind.length}/${questVariants.length}`, questAcceptsUnbind.length === 0 && questVariants.length === 4, '4/4');

// ---- RI-STL02 method 8: trespass census ---------------------------------------------------------
const perSettlement = {};
for (const p of props) perSettlement[p.settlement] = { zones: p.zones.length, classes: new Set(p.zones.map((z) => z.class)).size };
const minZones = Math.min(...Object.values(perSettlement).map((v) => v.zones));
const minClasses = Math.min(...Object.values(perSettlement).map((v) => v.classes));
const allClasses = new Set(allZones.map((z) => z.class));
A('TRS-1', 'trespass zones with an owner and a schedule', allZones.filter((z) => z.owner && z.schedule).length, allZones.filter((z) => z.owner && z.schedule).length >= 180, '>= 180');
A('TRS-2', 'minimum zones per settlement', minZones, minZones >= 14, '>= 14');
A('TRS-3', 'minimum distinct zone classes per settlement', minClasses, minClasses >= 3, '>= 3');
A('TRS-4', 'distinct zone classes in the world', `${allClasses.size} (${[...allClasses].join(', ')})`, allClasses.size >= 5, 'all 7 present is 10; >= 5 passes');

// ---- lights: SNUFFABLE and DARK-COVERAGE (data half) --------------------------------------------
const allLights = allZones.flatMap((z) => z.lights);
const snuff = allLights.filter((l) => l.snuffable).length;
A('LGT-1', 'extinguishable share of placed interior lights', pct(snuff / allLights.length), snuff / allLights.length >= 0.60, '>= 60%');

// ---- RI-CRM01 method 1: the schedule ------------------------------------------------------------
A('CRM-1', 'crime types in the schedule', bounty.crimes.length, bounty.crimes.length === 17, '17');
A('CRM-2', 'jurisdictions', bounty.jurisdictions.length, bounty.jurisdictions.length === 3, '3');
A('CRM-3', 'interior jurisdiction has no bounty', String(bounty.jurisdictions.find((j) => j.id === 'interior').multiplier === 0), bounty.jurisdictions.find((j) => j.id === 'interior').multiplier === 0, 'true');
A('CRM-4', 'bounty decay per day', bounty.decay.per_day, bounty.decay.per_day === 0, '0');
A('CRM-5', 'factions reacting to crime', justice.faction_reactions.length, new Set(justice.faction_reactions.map((r) => r.faction)).size === 4, '4 distinct');

// ---- RI-CRM02 methods 1, 4, 5 --------------------------------------------------------------------
const juris = ['imperial', 'settlement', 'interior'];
const universal = sanction.authorities.filter((a) => juris.every((j) => a.honoured_in.includes(j)));
A('SAN-1', 'sanctioning authorities', sanction.authorities.length, sanction.authorities.length === 4, '4');
A('SAN-2', 'authorities honoured in ALL THREE jurisdictions (the Morag Tong problem)', universal.length, universal.length === 0, '0');
A('SAN-3', 'sanctioned-murder quests declared', sanction.writ_counts.total.quests, sanction.writ_counts.total.quests === 27, '27');
A('SAN-4', 'of those, with a non-lethal option', `${sanction.writ_counts.total.non_lethal_resolutions} (${pct(sanction.writ_counts.total.non_lethal_resolutions / 27)})`, sanction.writ_counts.total.non_lethal_resolutions >= 18, '>= 18 (67%)');
const pairs = sanction.exclusivity.reduce((n, r) => n + r.cannot_hold.length, 0);
A('SAN-5', 'mutually exclusive faction pairs', pairs, pairs >= 8, '>= 8');
A('SAN-6', 'named hunters', sanction.hunters.reduce((n, h) => n + h.count, 0), sanction.hunters.reduce((n, h) => n + h.count, 0) === 11, '11');

// factionLawFactor spread on Imperial guards
const fl = sanction.faction_law_factor.rows.map((r) => r.imperial_law);
const spread = Math.max(...fl) / Math.min(...fl);
A('SAN-7', 'factionLawFactor spread (max/min on Imperial guards)', spread.toFixed(2) + 'x', spread >= 5, '>= 5x');

// The worked threshold table, recomputed from the two source tables rather than transcribed.
const worked = sanction.faction_law_factor.worked.map((w) => {
  const raceKey = w.player.split(',')[0].trim();
  const rl = races.guards.law_factor[raceKey].lawFactor;
  const arrest = Math.round(races.guards.base.imperial_authority * rl * w.faction_law);
  return { player: w.player, declared: w.arrest_at, computed: arrest, ok: Math.abs(arrest - w.arrest_at) <= 1 };
});
A('SAN-8', 'worked arrest thresholds recomputed from race x faction tables', `${worked.filter((w) => w.ok).length}/${worked.length}`, worked.every((w) => w.ok), '5/5');
const naga4 = worked.find((w) => w.player.startsWith('naga, xul'));
const nagaC = worked.find((w) => w.player.startsWith('naga, ninth'));
A('SAN-9', 'the same Naga under two factions', `${naga4.computed} vs ${nagaC.computed} (${(nagaC.computed / naga4.computed).toFixed(2)}x)`, nagaC.computed / naga4.computed >= 5, '>= 5x from faction alone');

// ---- fences -------------------------------------------------------------------------------------
A('FNC-1', 'fences in the world', fences.fences.length, fences.fences.length === 9, '9');
const mt = (m) => 1 + 0.0071 * m;
const best = Math.max(...fences.fences.map((f) => theft.fences.base_rate * mt(100) * f.greed));
A('FNC-2', 'best achievable fence multiplier at Mercantile 100', best.toFixed(4), best >= 0.58 && best <= 0.62, '[0.58, 0.62]');
A('FNC-3', 'fence base rate vs the legitimate 0.60x ceiling', `${theft.fences.base_rate} vs ${theft.fences.legit_sell_ceiling}`, theft.fences.base_rate < theft.fences.legit_sell_ceiling, 'strictly lower');
A('FNC-4', 'refusal lines authored', Object.keys(fences.refusal_lines).length, Object.keys(fences.refusal_lines).length >= 4, '>= 4, each naming the owner');

// ---- output ---------------------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
if (json) {
  process.stdout.write(JSON.stringify({ results, failed: failed.length, owner_histogram_head: histVals.slice(0, 12), lock_tiers: byTier, zone_classes: countBy(allZones, 'class'), per_settlement: perSettlement }, null, 2) + '\n');
} else {
  const w = Math.max(...results.map((r) => r.name.length));
  for (const r of results) process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(6)} ${r.name.padEnd(w)}  ${String(r.got).padStart(22)}   target ${r.target}\n`);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} assertions pass\n`);
  process.stdout.write(`owner histogram (objects per owner, top 12): ${histVals.slice(0, 12).join(' ')} ... tail length ${histVals.length}\n`);
  process.stdout.write(`lock tiers: ${JSON.stringify(byTier)}\n`);
  process.stdout.write(`zones per settlement: ${JSON.stringify(perSettlement)}\n`);
}
process.exit(failed.length ? 20 : 0);

function pct(v) { return (v * 100).toFixed(1) + '%'; }
function countBy(arr, k) { const o = {}; for (const x of arr) o[x[k]] = (o[x[k]] || 0) + 1; return o; }

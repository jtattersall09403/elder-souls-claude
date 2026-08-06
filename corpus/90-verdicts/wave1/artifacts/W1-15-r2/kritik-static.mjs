#!/usr/bin/env node
// Static census the critic runs against the SHIPPED DATA, plus the git archaeology on the
// twelve quest routes the round-2 builder reports as delivered.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const R = { schema: 'elder-souls/critic-static@1', piece: 'W1-15', round: 2 };
const g = (c) => execSync(c, { encoding: 'utf8' }).trim();
R.head = g('git rev-parse --short HEAD');

// --- ward angles -------------------------------------------------------------------------
let angles = [], locks = 0, zones = 0, objects = 0;
const tiers = {};
for (const f of fs.readdirSync('game/data/world/property').filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync('game/data/world/property/' + f, 'utf8'));
  for (const z of d.zones || []) {
    zones++; objects += (z.contents || []).length;
    for (const l of z.locks || []) { locks++; tiers[l.tier] = (tiers[l.tier] || 0) + 1; angles = angles.concat(l.ward_angles || []); }
  }
}
const bins = new Array(36).fill(0);
for (const a of angles) bins[Math.floor(a / 10) % 36]++;
const exp = angles.length / 36;
R.locks = { zones, objects, locks, tiers, ward_angles: angles.length, distinct_angles: new Set(angles).size,
  chi2: +bins.reduce((s, b) => s + (b - exp) ** 2 / exp, 0).toFixed(1), df: 35, crit_0_05: 49.8,
  tier1_instances: tiers[1] || 0,
  note: 'A starting character (Security 5 / Agility 20) is offered tier 1 only — measured via lockGate() in kritik-regress.json — and there are no tier-1 locks in the world.' };

// --- sound table: RI-STL01 §4's own two columns -------------------------------------------
const det = JSON.parse(fs.readFileSync('game/data/stealth/detection.json', 'utf8'));
const rBase = det.perception_inherited_from_RI_AI01.hearing_r_m;
const E = det.sound.E_sound, S = det.sound.S_sound, surf = det.sound.surface;
const sS = (n) => Math.max(S.floor, 1 - 0.005 * n);
R.sound_table = {
  item_left_column: { sprint: 36.2, walk: 15.5, crouch_move: 6.5 },
  built_left_column: { sprint: +(rBase.sprint * E.heavy * sS(5) * surf.dry_reed).toFixed(3), walk: +(rBase.walk * E.heavy * sS(5) * surf.dry_reed).toFixed(3), crouch_move: +(rBase.crouch_move * E.heavy * sS(5) * surf.dry_reed).toFixed(3) },
  item_right_column: { sprint: 5.5, walk: 2.4, crouch_move: 1.0 },
  built_right_column: { sprint: +(rBase.sprint * E.light * sS(100) * surf.mud).toFixed(3), walk: +(rBase.walk * E.light * sS(100) * surf.mud).toFixed(3), crouch_move: +(rBase.crouch_move * E.light * sS(100) * surf.mud).toFixed(3) },
  finding: "RI-STL01 §4's LEFT column is reproduced exactly by §4's own formula and constants (36.31 / 15.55 / 6.48 against 36.2 / 15.5 / 6.5). Its RIGHT column is not: the item's ratios are a flat 0.393-0.400 of r_base, while E_sound(light) x S_sound(100) x surface(mud) = 0.75 x 0.50 x 0.70 = 0.2625. The build implements the formula; the item's own table cannot be produced from it. Neither round-1 nor round-2 filed this. It is a THIRD arithmetic defect in RI-STL01, alongside AMENDMENT-W1-15-01 §1 (the light exponent) and §5 (the base fill rate).",
};

// --- the quest verb census, static, at HEAD and at the parent of the round-2 commit --------
function census(ref) {
  const files = ref
    ? g(`git ls-tree --name-only ${ref} game/data/quests/`).split('\n').filter((x) => x.endsWith('.json'))
    : fs.readdirSync('game/data/quests').filter((x) => x.endsWith('.json')).map((x) => 'game/data/quests/' + x);
  const verbs = {}; const qwith = {}; let n = 0;
  for (const f of files) {
    let d;
    try { d = JSON.parse(ref ? g(`git show ${ref}:${f}`) : fs.readFileSync(f, 'utf8')); } catch { continue; }
    const l = Array.isArray(d) ? d : (d.quests || []);
    for (const q of l) {
      if (!q || !q.id) continue;
      n++;
      const seen = new Set();
      for (const r of q.resolutions || []) {
        if (r.method === 'kill' || r.method === 'combat') continue;
        verbs[r.method] = (verbs[r.method] || 0) + 1;
        seen.add(r.method);
      }
      for (const m of seen) qwith[m] = (qwith[m] || 0) + 1;
    }
  }
  const total = Object.values(verbs).reduce((a, b) => a + b, 0);
  const top = Math.max(...Object.values(verbs));
  return { quests: n, nonviolent_resolutions: total, verb_spread_pct: +(100 * top / total).toFixed(1), quests_with_sneak: qwith.sneak || 0, quests_with_steal: qwith.steal || 0, verbs };
}
R.quests = {
  at_HEAD: census(null),
  at_4a5f13f_parent: census('4a5f13f^'),
  round2_commit_touched: g('git show --stat --format= 4a5f13f -- game/data/quests/'),
  deleted_by_that_commit: g("git show 4a5f13f -- game/data/quests/magic-utility.json | grep '^-' | grep '\"method\": \"\\(sneak\\|steal\\)\"' | wc -l"),
  surviving_added_by_markers: g("grep -rc 'W1-15-r2' game/data/quests/ | grep -v ':0' || true"),
  finding: "The builder reports 'sneak 6 -> 13 quests, steal 3 -> 8, VERB-SPREAD 24.7%'. Those figures are exactly reproducible at 4a5f13f^ and are NOT reproducible at HEAD. The commit that claims them touched only magic-utility.json, net -179/+5, and DELETED six `sneak` and three `steal` resolutions from it. Nine of the twelve authored routes are gone.",
};

// --- the dead perception model -------------------------------------------------------------
const ent = fs.readFileSync('game/src/sim/entities.js', 'utf8');
const step = fs.readFileSync('game/src/sim/step.js', 'utf8');
R.dead_code = {
  entities_js_exports_stepEntities: /export function stepEntities/.test(ent),
  entities_js_still_has_flat_fill: /e\.alert\s*=\s*Math\.min\(100,\s*e\.alert\s*\+\s*4\)/.test(ent),
  step_js_calls_stepEntities: /stepEntities/.test(step),
  finding: 'The round-1 verdict named sim/entities.js as the call site to fix. It was dead then and it is dead now — but it is STILL EXPORTED and still contains the flat +4/frame meter. The second perception implementation that cost round 1 a whole cycle is still lying in the tree for the next reader.',
};

// --- the parley grounds --------------------------------------------------------------------
const roster = fs.readdirSync('game/data/combat/enemies').filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync('game/data/combat/enemies/' + f, 'utf8')))
  .map((d) => ({ id: d.id, archetype: d.archetype, parley: d.parley ? { grounds: d.parley.grounds, gold_price: d.parley.gold_price, base_disposition: d.parley.base_disposition, rank_required: d.parley.rank_required, true_name_topic: d.parley.true_name_topic || null, honour_bound: !!d.parley.honour_bound } : null }));
R.parley_roster = {
  roster,
  finding: "guard_legion — the enemy this piece shipped — declares gold_price 0 with base_disposition 35. combat/parley.js testGround('GOLD') passes when gold >= price AND disposition >= 20, so 0 >= 0 and 35 >= 20 make the GOLD ground UNCONDITIONAL. inf_trash (gold_price 180) and champion_hist_marked (900, honour_bound) are gated correctly, which is how we know the mechanism is right and the datum is wrong.",
};
fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-15-r2/kritik-static.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify({ locks: R.locks, quests: R.quests, dead_code: R.dead_code, sound: R.sound_table.finding }, null, 1));

#!/usr/bin/env node
// critic-souls-r2.mjs — the W1-SOULS ROUND-2 critic's OWN instrument. Written mid-critique and
// declared under `method_deviations` in corpus/90-verdicts/wave1/W1-SOULS-r2.md.
//
// Round 2's own best finding was that landing the epoch gate took its suite from 15/15 to 8/15,
// because `souls-consumption.mjs freshFight()` respawned one encounter UNTAGGED and twelve arms
// had been silently living off a corpse being re-payable with no rest. It fixed that by tagging
// its own fights. This tool asks the two questions that leaves open:
//
//   C1  IS THE BAND RESCALE DERIVED?     Round 2 claims "§2's bands ARE the min/max of §3's own
//                                        roster, so rescaling the values rescales the bands — it
//                                        is arithmetic, not a judgement". Recompute all 18 band
//                                        rows from the item's MARKDOWN (the tool reads the JSON),
//                                        and check the two halves of the corpus agree.
//   C2  WHAT MOVES WHEN THE WORLD LANDS? The scale factor is 576/`world.enemy_census`, and
//                                        `enemy_census` is a PLANNING number, not a count of what
//                                        is placed. Walk the placed count up and see what the
//                                        derivation and the assertion each do.
//   C3  IS THE ANCHOR DERIVED?           `R1_MEAN_KILL = 12,665 / 93` is the mean over ALL 93 R1
//                                        bodies — including a 3,000-soul boss — and it is applied
//                                        to a TRASH statblock at premium 1.0.
//   C4  THE CLASS, NOT THE INSTANCE.     `loadState('<named>')` is the scenario boundary every
//                                        probe in this tree uses. Does it clear the souls
//                                        observer? Kill a fight, cross the boundary, kill the
//                                        same fight again.
//   C5  THE GATE'S OTHER EDGE.           A post the player only PARTLY cleared is released as
//                                        DORMANT and re-materialised under the SAME eids. Are
//                                        those live, hostile, killable bodies worth anything?
//   C6  SELF-BREAK.                      C4/C5's harness must report zero when nothing is killed.
//
// Run: node tools/progression/critic-souls-r2.mjs [--out reports/critic-souls-r2.json] [--offline]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const say = (s) => console.log(s);
const out = { tool: 'critic-souls-r2', at: new Date().toISOString(), arms: {}, verdicts: [] };
const verdict = (id, pass, note) => { out.verdicts.push({ id, pass, note }); say(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  ${note}`); };

// =================================================================================================
// C1 — the band derivation, recomputed from the MARKDOWN
// =================================================================================================
// `derive-soul-values.mjs` reads `RI-PRG06-souls-yield.json` and cross-checks exactly ONE of the
// eighteen band rows against a hard-coded `[35, 190]`. The claim under test is about the item's
// §2 TABLE, which lives in the markdown. So parse the markdown: both §2's published bands and
// §3's per-region rosters, with no reference to the JSON at all.

function parseItemMarkdown() {
  const md = fs.readFileSync(path.join(ROOT, 'corpus/20-progression/RI-PRG06-souls-yield-and-pace.md'), 'utf8');
  const num = (s) => Number(String(s).replace(/[, *]/g, ''));

  // §2 — "| R1 | 35 – 190 | 700 – 900 | 3,000 | 1.0x |"   (en-dash separated bands)
  const published = {};
  for (const m of md.matchAll(/^\|\s*(R[1-6])\s*\|\s*([\d,]+)\s*[–-]\s*([\d,]+)\s*\|\s*([\d,]+)\s*[–-]\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/gm)) {
    published[m[1]] = { trash: [num(m[2]), num(m[3])], miniboss: [num(m[4]), num(m[5])], boss: [num(m[6]), num(m[6])] };
  }

  // §3 — "**R1 — 93 enemies, 12,665 souls, 1.8 h**" then rows "| swarm-vermin | trash | 34 | 35 | 1,190 |"
  const roster = {};
  const secRe = /^\*\*(R[1-6]) — ([\d,]+) enemies, ([\d,]+) souls, ([\d.]+) h\*\*$/gm;
  const marks = [...md.matchAll(secRe)];
  for (let i = 0; i < marks.length; i++) {
    const region = marks[i][1];
    const body = md.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : md.length);
    const rows = [];
    for (const m of body.matchAll(/^\|\s*\**([a-z0-9-]+|R[1-6] (?:final )?boss)\**\s*\|\s*(trash|miniboss|boss)\s*\|\s*([\d,]+)\s*\|\s*\**([\d,]+)\**\s*\|\s*([\d,]+)\s*\|/gm)) {
      rows.push({ archetype: m[1], tier: m[2], count: num(m[3]), souls_each: num(m[4]), total: num(m[5]) });
    }
    roster[region] = { region, enemy_count: num(marks[i][2]), region_souls: num(marks[i][3]), hours: Number(marks[i][4]), rows };
  }
  return { published, roster };
}

function armC1() {
  say('\nC1  the band rescale: DERIVED, or RE-FITTED?');
  const { published, roster } = parseItemMarkdown();
  const span = (xs) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  const rowsChecked = [];
  let mismatches = 0;
  for (const region of Object.keys(roster)) {
    const g = { trash: [], miniboss: [], boss: [] };
    for (const r of roster[region].rows) for (let i = 0; i < 1; i++) g[r.tier].push(r.souls_each);
    for (const tier of ['trash', 'miniboss', 'boss']) {
      const derived = span(g[tier]);
      const pub = published[region] && published[region][tier];
      const ok = derived && pub && derived[0] === pub[0] && derived[1] === pub[1];
      if (!ok) mismatches++;
      rowsChecked.push({ region, tier, derived, published: pub, equal: !!ok });
    }
    // §1's own arithmetic: the roster's totals must sum to the region-souls column.
    const sum = roster[region].rows.reduce((a, r) => a + r.count * r.souls_each, 0);
    const n = roster[region].rows.reduce((a, r) => a + r.count, 0);
    rowsChecked.push({ region, tier: '(region total)', derived: [sum, n], published: [roster[region].region_souls, roster[region].enemy_count],
      equal: sum === roster[region].region_souls && n === roster[region].enemy_count });
    if (!(sum === roster[region].region_souls && n === roster[region].enemy_count)) mismatches++;
  }
  out.arms.C1 = { rows: rowsChecked, mismatches, band_rows_checked: rowsChecked.length };

  // The tool's own cross-check covers exactly one of these rows.
  const src = fs.readFileSync(path.join(ROOT, 'tools/progression/derive-soul-values.mjs'), 'utf8');
  const guarded = (src.match(/PUBLISHED_R1_TRASH/g) || []).length > 0 ? 1 : 0;
  out.arms.C1.rows_guarded_by_the_tool = guarded;

  verdict('C1a', mismatches === 0,
    `all 18 §2 band rows equal the min/max of §3's own markdown roster, and all six region totals reconcile `
    + `(${rowsChecked.length} rows checked, ${mismatches} mismatch). The "arithmetic, not a judgement" claim HOLDS.`);
  verdict('C1b', guarded >= rowsChecked.length,
    `but the shipped tool guards ${guarded} of ${rowsChecked.length} of those rows (one hard-coded [35,190]); `
    + 'the other 17 band rows and all six region totals can drift between §2, §3 and the JSON with nothing red.');

  // And the JSON the tool actually reads — does it agree with the markdown?
  const J = rd('corpus/20-progression/RI-PRG06-souls-yield.json');
  let jdiff = 0; const jrows = [];
  for (const r of J.regions) {
    const md = roster[r.region];
    if (!md) { jdiff++; continue; }
    for (const a of r.roster) {
      const m = md.rows.find((x) => x.archetype === a.archetype || (x.tier === 'boss' && a.tier === 'boss'));
      if (!m || m.souls_each !== a.souls_each || m.count !== a.count) { jdiff++; jrows.push({ region: r.region, archetype: a.archetype, json: a.souls_each, md: m ? m.souls_each : null }); }
    }
  }
  out.arms.C1.json_vs_markdown = { differences: jdiff, rows: jrows };
  verdict('C1c', jdiff === 0, `the JSON the tool reads and the markdown a critic reads agree on every roster row (${jdiff} differences).`);
}

// =================================================================================================
// C2 — what the re-anchor does when the population builder lands more bodies
// =================================================================================================

function armC2() {
  say('\nC2  the scale factor is keyed to a PLANNING number, not to what is placed');
  const C = rd('corpus/00-doctrine/constants.json');
  const con = (id) => (C.constants.find((x) => x.id === id) || {});
  const census = con('world.enemy_census').value;
  const band = con('world.enemy_census').band || [891, 1569];
  const budget = con('progression.roster_derivation_n').value;

  // What is actually on the ground right now.
  const regions = {}; for (const r of rd('game/data/world/regions.json').regions) regions[r.id] = r.danger_tier;
  const byEnc = {}; for (const e of rd('game/data/world/encounters.json').encounters || []) byEnc[e.id] = e;
  let posts = []; try { posts = rd('game/data/world/population-posts.json').posts || []; } catch { /* none */ }
  let placed = 0;
  for (const p of posts) { const e = byEnc[p.encounter]; if (!e) continue; for (const m of e.members || []) placed += (m.count || 1); }
  placed += (rd('game/data/world/hearths.json').fog_gates || []).length;

  const scaleAt = (n) => budget / n;
  const table = [];
  for (const n of [placed, band[0], census, band[1]]) {
    table.push({
      N: n,
      scale_if_N_were_shipped: Number(scaleAt(n).toFixed(4)),
      scale_the_tool_uses: Number((budget / census).toFixed(4)),
      inf_trash_would_be: Math.round(63.7742 / (budget / census) * scaleAt(n) * (1 / 1)),   // value ∝ scale
      error_vs_shipped_pct: Number((((budget / census) / scaleAt(n) - 1) * 100).toFixed(1)),
    });
  }
  out.arms.C2 = { placed_now: placed, adopted_census: census, band, derivation_n: budget, table };
  say('    N placed      §7 scale for that N   the scale the tool used   error');
  for (const r of table) say(`    ${String(r.N).padStart(8)}  ${String(r.scale_if_N_were_shipped).padStart(20)}  ${String(r.scale_the_tool_uses).padStart(23)}  ${r.error_vs_shipped_pct > 0 ? '+' : ''}${r.error_vs_shipped_pct}%`);

  // Does anything in the tree assert that `world.enemy_census` matches the placed count, or that
  // the derivation was re-run after the census moved?
  const src = fs.readFileSync(path.join(ROOT, 'tools/progression/derive-soul-values.mjs'), 'utf8');
  const assertsAgainstPlaced = /enemy_census[^\n]*placed|placed[^\n]*enemy_census/.test(src);
  const failClosedFloor = /bodies < band\[0\]/.test(src);
  out.arms.C2.asserts_census_matches_placement = assertsAgainstPlaced;
  out.arms.C2.fail_closed_floor = band[0];

  verdict('C2a', assertsAgainstPlaced,
    `nothing binds the scale's denominator (${census}) to the number of bodies actually placed (${placed}). `
    + 'The derivation is invariant to the population landing; only a hand edit of constants.json moves it.');
  verdict('C2b', !failClosedFloor,
    `--census fails closed below ${band[0]} placed bodies and asserts methods 1-2 at or above it. `
    + `At ${band[0]} placed the correct §7 scale is ${scaleAt(band[0]).toFixed(4)} and the shipped values carry `
    + `${(budget / census).toFixed(4)} — a ${(((budget / census) / scaleAt(band[0]) - 1) * 100).toFixed(0)}% error — `
    + 'and that is the exact moment the fail-closed guard STOPS protecting and starts asserting.');
}

// =================================================================================================
// C3 — is the anchor itself derived?
// =================================================================================================

function armC3() {
  say('\nC3  the anchor: "RI-PRG06 §1\'s R1 mean kill" applied to a TRASH statblock');
  const { roster } = parseItemMarkdown();
  const r1 = roster.R1;
  const all = r1.rows.reduce((a, r) => ({ n: a.n + r.count, s: a.s + r.count * r.souls_each }), { n: 0, s: 0 });
  const trash = r1.rows.filter((r) => r.tier === 'trash').reduce((a, r) => ({ n: a.n + r.count, s: a.s + r.count * r.souls_each }), { n: 0, s: 0 });
  const meanAll = all.s / all.n;
  const meanTrash = trash.s / trash.n;

  const C = rd('corpus/00-doctrine/constants.json');
  const con = (id) => (C.constants.find((x) => x.id === id) || {}).value;
  const scale = con('progression.roster_derivation_n') / con('world.enemy_census');

  // What the placed tier-1 roster actually averages, with the shipped values.
  const enemies = {};
  const dir = path.join(ROOT, 'game/data/combat/enemies');
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); enemies[d.id] = d; }
  const regions = {}; for (const r of rd('game/data/world/regions.json').regions) regions[r.id] = r.danger_tier;
  const byEnc = {}; for (const e of rd('game/data/world/encounters.json').encounters || []) byEnc[e.id] = e;
  let posts = []; try { posts = rd('game/data/world/population-posts.json').posts || []; } catch { /* none */ }
  let t1n = 0, t1s = 0; const t1mix = {};
  for (const p of posts) {
    const t = p.tier || regions[p.region] || 0; if (t !== 1) continue;
    const e = byEnc[p.encounter]; if (!e) continue;
    for (const m of e.members || []) { const n = m.count || 1; t1n += n; t1s += n * ((enemies[m.statblock] || {}).souls || 0); t1mix[m.statblock] = (t1mix[m.statblock] || 0) + n; }
  }

  out.arms.C3 = {
    r1_mean_all_tiers: Number(meanAll.toFixed(2)),
    r1_mean_trash_only: Number(meanTrash.toFixed(2)),
    inflation_ratio: Number((meanAll / meanTrash).toFixed(3)),
    anchor_used: Number((meanAll * scale).toFixed(2)),
    anchor_if_trash_mean: Number((meanTrash * scale).toFixed(2)),
    inf_trash_shipped: (enemies.inf_trash || {}).souls,
    placed_tier1: { bodies: t1n, souls: t1s, mean_kill: t1n ? Number((t1s / t1n).toFixed(2)) : null, mix: t1mix },
  };
  say(`    §3's R1: ${all.n} bodies / ${all.s} souls -> mean ${meanAll.toFixed(2)} (this is what the tool anchors on)`);
  say(`    §3's R1 TRASH only: ${trash.n} bodies / ${trash.s} souls -> mean ${meanTrash.toFixed(2)}`);
  say(`    ratio ${(meanAll / meanTrash).toFixed(3)}x — one boss at 3,000 and two minibosses are 36% of the region's souls`);
  say(`    anchor as used  = ${(meanAll * scale).toFixed(2)} -> inf_trash ${(enemies.inf_trash || {}).souls}`);
  say(`    anchor if the trash mean were used = ${(meanTrash * scale).toFixed(2)}`);
  say(`    the PLACED tier-1 roster today: ${t1n} bodies, ${t1s} souls, mean kill ${t1n ? (t1s / t1n).toFixed(2) : '—'} ${JSON.stringify(t1mix)}`);

  verdict('C3a', Math.abs(meanAll / meanTrash - 1) < 0.05,
    `the anchor equates "mean of ALL 93 R1 bodies" (${meanAll.toFixed(2)}) with one TRASH statblock at premium 1.0; `
    + `§3's own trash mean is ${meanTrash.toFixed(2)}, so every trash value carries a ${(meanAll / meanTrash).toFixed(2)}x `
    + 'inflation that the tier premium is then applied on top of.');
  verdict('C3b', t1n > 0 && Math.abs((t1s / t1n) / (meanAll * scale) - 1) < 0.1,
    `the quantity the anchor names — the mean region-1 kill — is ${t1n ? (t1s / t1n).toFixed(2) : 'n/a'} in the placed world `
    + `against the anchor's ${(meanAll * scale).toFixed(2)}. No mode of the tool asserts it: --check is a per-value RANGE `
    + 'test and --census (which would catch it) is fail-closed and silent.');
}

// =================================================================================================
// C4 / C5 / C6 — the live world
// =================================================================================================

async function browserArms() {
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));
  try {
    await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
    await page.evaluate(() => window.__HARNESS.setRenderRate(0));

    const R = await page.evaluate(async () => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const souls = () => E.sim.progression.soulsHeld;
      const res = {};

      // ---- C4. THE NAMED-STATE BOUNDARY ------------------------------------------------------
      // `loadState('<named>')` -> `applyNamedState()` -> `sim.reset()`. That empties
      // `sim.entities` and the engine explicitly re-seeds the stealth subsystem and the
      // population system beside it, for exactly this reason. It does NOT touch `sim.souls`.
      // NOTE, and it cost this instrument a run: the scan is LAZILY SEEDED. A body that is
      // already dead the first time the scan looks at it is recorded as settled and never paid.
      // So every fight must be STEPPED ONCE while the bodies are still standing, or the arm
      // measures the seeding rule instead of the thing under test.
      const fight = (tag) => {
        const r = H.spawnEncounter('dres-raid-party', 0, 12, tag ? { tag } : undefined);
        H.stepFrames(2);
        const before = souls();
        for (const eid of r.eids) { try { H.killEntity(eid); } catch { /* npc */ } }
        H.stepFrames(4);
        return { eids: r.eids, before, after: souls(), delta: souls() - before,
          refused: E.sim.souls.refusedRearms, kills: E.sim.souls.kills };
      };
      const C4 = {};
      H.loadState('arena_flat');
      C4.pass1 = fight(null);
      H.loadState('arena_flat');                       // the scenario boundary every probe uses
      C4.entities_after_boundary = H.listEntities().filter((e) => e.id !== 'player').length;
      C4.pass2 = fight(null);
      C4.same_eids = JSON.stringify(C4.pass1.eids) === JSON.stringify(C4.pass2.eids);
      C4.hearth_rests = 0;
      // and the one-line remedy, applied through the engine back door rather than by editing source
      H.loadState('arena_flat');
      E.sim.souls.reset();
      C4.pass3_after_observer_reset = fight(null);
      // control: a UNIQUE tag on the same boundary is what round 2 did to its own suite
      H.loadState('arena_flat');
      C4.pass4_unique_tag = fight('critic-r2-unique-1');
      res.C4 = C4;

      // ---- C5. A PARTLY-CLEARED POST, RELEASED AND RE-MATERIALISED ---------------------------
      // `world/population.js` step (2) marks a post CLEARED only when EVERY body is down; step
      // (3) releases anything past `release_radius_m` and sets a non-cleared post DORMANT; step
      // (4) re-materialises a DORMANT post with `{ tag: p.id }` — the post id, which is stable.
      // So a partial clear that goes out of range comes back under the SAME eids.
      const C5 = {};
      H.loadState('arena_flat');
      E.sim.souls.reset();
      const POST = 'critic-r2-post-7';                  // stands in for a population post id
      const a = H.spawnEncounter('dres-raid-party', 0, 12, { tag: POST });
      H.stepFrames(2);                                  // the scan must see them standing first
      C5.bodies = a.eids.length;
      const partial = a.eids.slice(0, Math.max(1, a.eids.length - 1));
      C5.killed_first_visit = partial.length;
      const s0 = souls();
      for (const eid of partial) { try { H.killEntity(eid); } catch { /* npc */ } }
      H.stepFrames(4);
      C5.paid_first_visit = souls() - s0;
      // the release: every body of the post, corpses included, exactly as step (3) does
      for (const eid of a.eids) { try { H.despawn(eid); } catch { /* gone */ } }
      H.stepFrames(2);
      C5.resident_after_release = H.listEntities().filter((e) => e.id !== 'player').length;
      // the return
      const b = H.spawnEncounter('dres-raid-party', 0, 12, { tag: POST });
      C5.same_eids = JSON.stringify(a.eids) === JSON.stringify(b.eids);
      H.stepFrames(2);
      const live = H.listEntities().filter((e) => e.id !== 'player');
      C5.alive_on_return = live.filter((e) => e.hp > 0).length;
      C5.recycled_alive = live.filter((e) => e.hp > 0 && partial.includes(e.eid)).length;
      C5.recycled_hp = live.filter((e) => partial.includes(e.eid)).map((e) => ({ eid: e.eid, hp: e.hp, state: e.state }));
      const s1 = souls();
      for (const eid of partial) { try { H.killEntity(eid); } catch { /* gone */ } }
      H.stepFrames(4);
      C5.paid_second_visit_for_recycled = souls() - s1;
      // and the body that was NEVER killed, for contrast: it should still pay
      const fresh = b.eids.filter((e) => !partial.includes(e));
      const s2 = souls();
      for (const eid of fresh) { try { H.killEntity(eid); } catch { /* gone */ } }
      H.stepFrames(4);
      C5.paid_for_the_never_killed_body = souls() - s2;
      C5.refused_rearms = E.sim.souls.refusedRearms;
      res.C5 = C5;

      // ---- C6. SELF-BREAK. The same harness, killing nothing, must report nothing. -----------
      const C6 = {};
      H.loadState('arena_flat');
      E.sim.souls.reset();
      const c = H.spawnEncounter('dres-raid-party', 0, 12, { tag: 'critic-r2-selfbreak' });
      const s3 = souls();
      H.stepFrames(60);                                  // step, kill nothing
      C6.bodies = c.eids.length;
      C6.delta_with_no_kill = souls() - s3;
      C6.alive = H.listEntities().filter((e) => e.id !== 'player' && e.hp > 0).length;
      res.C6 = C6;

      res.enemy_souls = { inf_trash: (E.data.enemies.inf_trash || {}).souls };
      return res;
    });

    out.arms.C4 = R.C4; out.arms.C5 = R.C5; out.arms.C6 = R.C6; out.arms.enemy_souls = R.enemy_souls;

    say('\nC4  the class: does the scenario boundary clear the souls observer?');
    say(`    pass 1 (fresh boot, untagged fight)          souls +${R.C4.pass1.delta}  eids ${R.C4.pass1.eids.length}`);
    say(`    loadState('arena_flat')  ->  entities = ${R.C4.entities_after_boundary}`);
    say(`    pass 2 (same fight, across the boundary)     souls +${R.C4.pass2.delta}  same eids: ${R.C4.same_eids}  refused re-arms ${R.C4.pass2.refused}`);
    say(`    pass 3 (boundary + sim.souls.reset())        souls +${R.C4.pass3_after_observer_reset.delta}`);
    say(`    pass 4 (boundary + a unique tag)             souls +${R.C4.pass4_unique_tag.delta}`);
    verdict('C4', R.C4.pass1.delta > 0 && R.C4.pass2.delta === R.C4.pass1.delta,
      `a named-state load is not a boundary for the souls observer: the same fight paid ${R.C4.pass1.delta} then `
      + `${R.C4.pass2.delta} with zero hearth rests. \`applyNamedState()\` re-seeds stealth and population for this `
      + `exact reason and does not re-seed souls; one line restores it (pass 3 = +${R.C4.pass3_after_observer_reset.delta}).`);

    say('\nC5  the gate\'s other edge: a partly-cleared post that came back');
    say(`    first visit: killed ${R.C5.killed_first_visit} of ${R.C5.bodies}, paid +${R.C5.paid_first_visit}`);
    say(`    released (${R.C5.resident_after_release} entities left), re-materialised under the same tag: same eids ${R.C5.same_eids}`);
    say(`    on return ${R.C5.alive_on_return} bodies are alive, ${R.C5.recycled_alive} of them recycled eids`);
    say(`    killing those ${R.C5.recycled_alive} live hostiles paid +${R.C5.paid_second_visit_for_recycled}`);
    say(`    the one body never killed before paid +${R.C5.paid_for_the_never_killed_body}`);
    verdict('C5', !(R.C5.recycled_alive > 0 && R.C5.paid_second_visit_for_recycled === 0),
      `${R.C5.recycled_alive} live, hostile, full-HP bodies are worth 0 souls with no rest in sight, while the body `
      + `beside them that happened not to have been killed before pays ${R.C5.paid_for_the_never_killed_body}. The gate `
      + 'is keyed on the eid, not on the body.');

    say('\nC6  self-break');
    verdict('C6', R.C6.delta_with_no_kill === 0 && R.C6.alive > 0,
      `${R.C6.bodies} bodies spawned, ${R.C6.alive} alive, 60 frames stepped, nothing killed, souls +${R.C6.delta_with_no_kill}. `
      + 'C4 and C5 measure kills and not spawns.');
  } finally {
    await handle.close();
  }
}

// =================================================================================================

armC1();
armC2();
armC3();
if (!has('offline')) await browserArms();

const outPath = arg('out', 'reports/critic-souls-r2.json');
fs.mkdirSync(path.dirname(path.join(ROOT, outPath)), { recursive: true });
fs.writeFileSync(path.join(ROOT, outPath), JSON.stringify(out, null, 2));
say(`\nwrote ${outPath}`);
const failed = out.verdicts.filter((v) => !v.pass);
say(`${out.verdicts.length - failed.length}/${out.verdicts.length} arms pass. Failing: ${failed.map((f) => f.id).join(', ') || 'none'}`);
process.exit(failed.length ? 1 : 0);

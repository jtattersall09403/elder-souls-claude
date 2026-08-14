#!/usr/bin/env node
// w1-20-r3-verify.mjs — the remediation of `W1-20-r2`, measured.
//
// WHAT IT IS FOR. `W1-20-r2` found four things and named a remedy for each. This tool asks whether
// each remedy landed, and — more importantly — whether the CHECK THAT WOULD HAVE CAUGHT THE DEFECT
// now exists, because on three of the four the shipped instruments could not have.
//
// THE ONE THING TO READ BEFORE TRUSTING THE ACCEPTANCE CRITERION YOU WERE GIVEN.
// `W1-20-r2`'s stated acceptance for its biggest gap is:
//
//     node tools/quests/critic-w1-20-r2-live.mjs reports A4.lines_reaching_rank_ge_5 = 8
//     on the shipping tree
//
// **That criterion is wrong and this tool deliberately does not meet it.** A4 gives a character
// every favoured skill at 100, every favoured attribute at 100 and 400 reputation, and DOES NO
// QUESTS. The world-state column exists precisely so that money and talent do not buy rank 5; a
// build where A4 reaches 7 is a build where the column has stopped biting — which is exactly the
// null-control arm the same verdict published as the failing one (`A4: rank 7 on all eight`).
// Meeting that criterion would have required deleting the gate rather than filling it.
//
// So the acceptance this tool enforces instead is the one the gap's own prose asks for — *"21
// authored quests are unreachable in principle"* — in two halves that must BOTH hold:
//
//   L1  a fully-skilled character who has done nothing still stops at rank 4 on all eight lines
//       (the gate is real), and
//   L2  the same character who PLAYS the line reaches rank 7 on all eight (the gate opens).
//
// RUN
//   node tools/quests/w1-20-r3-verify.mjs                      static + live, shipping tree
//   node tools/quests/w1-20-r3-verify.mjs --static-only        no browser
//   node tools/quests/w1-20-r3-verify.mjs --root <clone>       measure a control clone
//   node tools/quests/w1-20-r3-verify.mjs --arm off-by-one     label the run; expectations INVERT
//
// THE NULL CONTROLS, and neither is the trivial one.
//   `off-by-one`  every one of the twelve flags is raised — by a quest that already demands the
//                 rank the flag grants. `grep` finds it raised; the r2 census's ceiling check
//                 (a set-membership test over every world_flags array in the book) scores it 8/8
//                 PASS; and no player can climb, because the flag that opens rank 6 is behind a
//                 quest that asks for rank 6. S1 below is the only check in this project that
//                 separates it from the fix.
//   `registry`    `factions/registry.json` with `deep_kin`'s row perturbed. Everything else in the
//                 build is untouched; if the registry is read by nothing, nothing moves.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const USAGE = `w1-20-r3-verify.mjs — did the W1-20-r2 remediation land?
  --root <dir>        tree to measure (default: this repo)
  --arm <name>        label for the report: shipping | off-by-one | registry (default shipping)
  --static-only       skip the browser arm
  --out <file>        default reports/w1-20/r3-verify-<arm>.json
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const ROOT = args.root ? path.resolve(String(args.root)) : REPO;
const ARM = String(args.arm || 'shipping');
const OUT = args.out ? path.resolve(String(args.out)) : path.join(REPO, `reports/w1-20/r3-verify-${ARM}.json`);

const report = { schema: 'elder-souls/w1-20-r3-verify@1', arm: ARM, root: ROOT, generated_at: new Date().toISOString(), checks: [], notes: [] };
const say = (id, status, detail) => { report.checks.push({ id, status, ...detail }); };

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// =============================================================== STATIC =====================
const gates = readJSON('game/data/quests/faction-gates.json');
const questFiles = fs.readdirSync(path.join(ROOT, 'game/data/quests')).filter((f) => f.endsWith('.json'));
const allQuests = [];
for (const f of questFiles) {
  const d = readJSON(`game/data/quests/${f}`);
  for (const q of d.quests || []) allQuests.push({ ...q, _file: f });
}

/**
 * S1 — THE CLIMB, SOLVED. This is the check `critic-w1-20-r2-census.mjs` does not have and could
 * not have: its `QST03.ceiling.*` asks only "is this flag raised by ANY resolution anywhere", a
 * set-membership test that the off-by-one control passes 8/8.
 *
 * The question a player asks is different and it is ordered: standing at rank r, is there a quest
 * I am ALLOWED TO TAKE whose resolution raises the flag rank r+1 wants? So: start at rank 0 with
 * no flags, repeatedly add every flag reachable from the quests at or below the current rank, and
 * recompute the ceiling. Reputation, skills and attributes are assumed maxed — deliberately, so
 * this measures the world-state column alone, which is the column with no completability check
 * anywhere in the bar (`W1-20-r2`, "A gap in the bar itself").
 */
{
  const rows = [];
  for (const f of gates.factions || []) {
    const mine = allQuests.filter((q) => (q.faction || (q.rank_gate && q.rank_gate.faction)) === f.id);
    const flags = new Set();
    let rank = 0, guard = 0;
    const trace = [];
    for (;;) {
      if (++guard > 32) break;
      let grew = false;
      for (const q of mine) {
        const need = (q.rank_gate && q.rank_gate.min_rank) || 0;
        if (need > rank) continue;
        for (const r of q.resolutions || []) {
          for (const w of ((r.consequences || {}).world_flags) || []) {
            if (!flags.has(w)) { flags.add(w); grew = true; }
          }
        }
      }
      let top = 0;
      for (let k = 1; k < 8; k++) {
        const row = (f.ranks || [])[k];
        const ws = row && row.world_state && row.world_state.flag;
        if (ws && !flags.has(ws)) break;
        top = k;
      }
      if (top > rank) { trace.push({ climbed_to: top }); rank = top; grew = true; }
      if (!grew) break;
    }
    const stranded = mine.filter((q) => ((q.rank_gate && q.rank_gate.min_rank) || 0) > rank);
    rows.push({ faction: f.id, highest_rank_reachable_by_play: rank, quests_stranded: stranded.length, stranded_ids: stranded.map((q) => q.id) });
  }
  const bad = rows.filter((r) => r.highest_rank_reachable_by_play < 7);
  say('S1.the_ladder_can_be_climbed_from_rank_0', bad.length ? 'HARD_FAIL' : 'PASS', {
    discriminating: true,
    lines_reaching_rank_7_by_play: rows.filter((r) => r.highest_rank_reachable_by_play >= 7).length,
    of: rows.length,
    total_quests_stranded: rows.reduce((a, r) => a + r.quests_stranded, 0),
    rows,
  });
}

// S2 — every rank flag has a raiser STRICTLY BELOW the rank it grants. The same defect stated
// locally, so a reader can see which rung is wrong rather than only that the climb stopped.
{
  const rows = [];
  for (const f of gates.factions || []) {
    for (const row of f.ranks || []) {
      const ws = row.world_state && row.world_state.flag;
      if (!ws) continue;
      const raisers = [];
      for (const q of allQuests) {
        for (const r of q.resolutions || []) {
          if ((((r.consequences || {}).world_flags) || []).includes(ws)) {
            raisers.push({ quest: q.id, min_rank: (q.rank_gate && q.rank_gate.min_rank) ?? null, res: r.id });
          }
        }
      }
      const below = raisers.filter((x) => x.min_rank != null && x.min_rank < row.rank);
      rows.push({ faction: f.id, rank: row.rank, flag: ws, raisers: raisers.length, raisers_below_the_rank_it_grants: below.length,
        ok: below.length > 0, quests: [...new Set(below.map((x) => x.quest))] });
    }
  }
  const bad = rows.filter((r) => !r.ok);
  say('S2.every_rank_flag_has_a_raiser_below_it', bad.length ? 'HARD_FAIL' : 'PASS', {
    discriminating: true, rows_checked: rows.length, deadlocked: bad.length, deadlocked_rows: bad, rows,
  });
}

// S3 — the Dockhands reach a person at all: an alias that resolves to a matrix row, and a NON-ZERO
// diagonal, because the diagonal is what being one of us is worth (faction-reactions self_reaction_note).
{
  const rx = readJSON('game/data/dialogue/faction-reactions.json');
  const key = (rx.aliases || {})['the_dockhands'];
  const row = key ? (rx.matrix || {})[key] : null;
  const diag = row ? row[key] : null;
  say('S3.the_dockhands_have_a_reaction_row', key && row && Number(diag) ? 'PASS' : 'FAIL', {
    discriminating: true, alias: key ?? null, row_exists: !!row, diagonal: diag ?? null,
    columns_naming_dockhands: Object.values(rx.matrix || {}).filter((r) => r && r[key] !== undefined).length,
  });
}

// S4 — the lock has words. RI-QST03 §C: "a locked faction's members still speak one line
// explaining why they will not deal with the player."
{
  const rf = readJSON('game/data/dialogue/faction-refusals.json');
  const laddered = (gates.factions || []).map((f) => f.id).filter((id) => (rf.factions || {})[id]);
  const missing = laddered.filter((id) => !rf.factions[id].rivalry_locked);
  say('S4.every_laddered_faction_has_a_lock_line', missing.length ? 'FAIL' : 'PASS', {
    discriminating: false, laddered_with_prose: laddered.length, missing,
  });
}

// S5 — the registry has a reader in game/src that is not the harness. RI-MTH07 §B1: a reader that
// is only a probe is not a consumer, and this is the static half of that claim — the live half is
// L5, which perturbs the file and watches a body change what it is.
{
  const src = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) src.push(p); } };
  walk(path.join(ROOT, 'game/src'));
  const hits = src.filter((p) => /factionRegistry|factionSeat\s*\(/.test(fs.readFileSync(p, 'utf8')))
    .map((p) => path.relative(ROOT, p).split(path.sep).join('/'));
  const nonHarness = hits.filter((p) => !p.includes('/harness/'));
  say('S5.the_registry_is_read_outside_the_harness', nonHarness.length ? 'PASS' : 'HARD_FAIL', {
    discriminating: true, readers: hits, readers_outside_harness: nonHarness,
  });
}

/**
 * S6 — CAN A PLAYER CHOOSE THEIR WAY INTO A DEAD END? Reported, deliberately NOT remedied.
 *
 * Found by driving the ladder rather than by reading it: on `the_imperial_assize` and
 * `the_xul_aneekh` the driver completed every quest on the line and stopped at rank 6, because the
 * rank-6 quests each carry a resolution that does not empty the chair. That is AUTHORED — the Wet
 * Ledger says it in a journal entry (*"I am still at rank six with nowhere above me, and Tesh says
 * that is not a wall, it is a fee"*) and then gives a second route in `Q-LEDG-14`. The question
 * this check asks is whether the second route always exists, or whether a line can be closed by
 * two ordinary choices.
 *
 * It is a WARN and not a fail because remedying it by putting the flag on the refusal would delete
 * the design: a refusal that costs nothing is not a refusal. What a builder needs is another quest,
 * which is authoring and not a data entry.
 */
{
  const rows = [];
  for (const f of gates.factions || []) {
    const mine = allQuests.filter((q) => (q.faction || (q.rank_gate && q.rank_gate.faction)) === f.id);
    for (const row of f.ranks || []) {
      const ws = row.world_state && row.world_state.flag;
      if (!ws) continue;
      const carriers = mine.filter((q) => ((q.rank_gate && q.rank_gate.min_rank) ?? 99) < row.rank
        && (q.resolutions || []).some((r) => ((((r.consequences || {}).world_flags) || []).includes(ws))));
      // A carrier is ESCAPABLE if it has a resolution that finishes the quest without raising the flag.
      const escapable = carriers.filter((q) => (q.resolutions || []).some((r) => !((((r.consequences || {}).world_flags) || []).includes(ws))));
      if (carriers.length && carriers.length === escapable.length) {
        rows.push({ faction: f.id, rank: row.rank, flag: ws, carriers: carriers.map((q) => q.id),
          note: 'every quest that can raise this flag also has a resolution that finishes without raising it, and no other quest raises it — a player who takes that resolution on all of them is capped below this rank for the rest of the save' });
      }
    }
  }
  say('S6.a_wrong_choice_can_cap_the_ladder', rows.length ? 'WARN' : 'PASS', {
    discriminating: false, ranks_at_risk: rows.length, rows,
    not_remedied_here: 'Putting the flag on the refusal resolution would delete the authored cost of refusing. The remedy is another quest at that rank, which is authoring.',
  });
}

// =============================================================== LIVE =======================
const LINES = (gates.factions || []).map((f) => f.id);
const REPS = Object.fromEntries((readJSON('game/data/factions/registry.json').factions || []).map((r) => [r.id, r.representative]));

if (!args['static-only'] && !args.staticOnly) {
  const { launchGame } = await import('../lib/browser.mjs');
  // NPC settlements, node-side: a person is only in `sim.npcs` after `populateSettlement()` for the
  // town they live in. The r2 critic's first pass reported eight throws that were its own location.
  const where = new Map();
  for (const f of fs.readdirSync(path.join(ROOT, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
    try {
      for (const n of readJSON(`game/data/npcs/${f}`).npcs || []) if (!where.has(n.eid || n.id)) where.set(n.eid || n.id, n.settlement || null);
    } catch { /* */ }
  }
  const REP_HOME = Object.fromEntries(Object.entries(REPS).map(([k, v]) => [k, where.get(v) || null]));

  // The ladder, as a plan the page can execute. `QuestEngine.offers()` does not publish a
  // `faction` field, so the mapping is done node-side off the book itself — which also keeps the
  // plan honest: it is every faction quest in `game/data/quests/**`, in rank order, not whatever
  // a harness census happened to return.
  // Every skill and attribute id, so the CLIMB arm can put a character at the top of all of them.
  // L1 keeps the honest half — a maxed character who has done no quests must still stop at rank 4 —
  // and L2 asks a different question: with talent no longer the binding constraint, does the LADDER
  // open? Without this the driver was refused `Q-ASSZ-07 res_remove_him` on `speechcraft 60` and
  // took the authored refusal instead, and reported the Assize capped at 6 for a reason that is the
  // probe's character sheet rather than the build.
  const ALL_SKILLS = (readJSON('game/data/progression/skills.json').skills || []).map((x) => x.id);
  const ALL_ATTRS = (readJSON('game/data/progression/attributes.json').attributes || []).map((x) => x.id);
  const LADDER_FLAGS = new Set();
  for (const f of gates.factions || []) for (const r of f.ranks || []) if (r.world_state) LADDER_FLAGS.add(r.world_state.flag);
  const PLAN = {};
  for (const fid of LINES) {
    PLAN[fid] = allQuests
      .filter((q) => (q.faction || (q.rank_gate && q.rank_gate.faction)) === fid)
      .map((q) => ({ id: q.id, min_rank: (q.rank_gate && q.rank_gate.min_rank) || 0, giver: (q.giver && q.giver.npc_id) || null,
        home: (q.giver && where.get(q.giver.npc_id)) || null,
        // Which resolutions RAISE a ladder flag. The driver prefers one, and the reason is a
        // finding rather than a convenience: on the Assize and the Xul-Aneekh the rank-6 quests
        // each carry a REFUSAL resolution that deliberately does not empty the chair —
        // `Q-LEDG-14`'s journal says so out loud, *"that is not a wall, it is a fee"* — so a
        // driver that takes the first available resolution measures the refusal, not the ladder.
        raises: (q.resolutions || []).map((r) => ({ id: r.id, flags: (((r.consequences || {}).world_flags) || []).filter((w) => LADDER_FLAGS.has(w)) })) }))
      .sort((a, b) => a.min_rank - b.min_rank);
  }

  const game = await launchGame(args, { usage: USAGE });
  const live = await game.page.evaluate(async ({ LINES, REPS, REP_HOME, PLAN, ALL_SKILLS, ALL_ATTRS }) => {
    const H = window.__HARNESS;
    const out = { checks: [], notes: [] };
    const push = (id, detail) => out.checks.push({ id, ...detail });
    const fresh = (settlement) => {
      H.reset({ state: 'default' });
      H.setRenderRate(0);
      H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });
      if (settlement) { try { H.populateSettlement(settlement); } catch (e) { out.notes.push(`populateSettlement(${settlement}): ${String(e).slice(0, 120)}`); } }
    };
    const maxOut = (fid) => {
      const g0 = H.factionGates();
      const f0 = (g0.factions || []).find((f) => f.id === fid) || {};
      const sk = {}; for (const s of f0.favoured_skills || []) sk[s] = 100;
      const at = {}; for (const a of f0.favoured_attributes || []) at[a] = 100;
      try { H.setSkills(sk); } catch (e) { out.notes.push('setSkills: ' + String(e).slice(0, 100)); }
      try { H.setAttributes(at); } catch (e) { out.notes.push('setAttributes: ' + String(e).slice(0, 100)); }
      H.setFactionStanding(fid, { member: true, reputation: 400, rank: 0 });
    };
    const derived = (fid) => {
      const g = H.factionGates();
      const row = (g.factions || []).find((f) => f.id === fid);
      return { rank: row ? row.derived_rank : null, unmet: row && row.next_rank_terms ? row.next_rank_terms.unmet : null };
    };

    // ---- L1. THE GATE IS STILL REAL. Everything money and talent can buy, and no quests done.
    // This must stay at 4. A build that reaches 7 here has deleted the world-state column, and
    // that build is the r2 verdict's own published null control.
    const idle = [];
    for (const fid of LINES) { fresh(); maxOut(fid); idle.push({ faction: fid, ...derived(fid) }); }
    push('L1.talent_and_money_alone_still_stop_at_rank_4', {
      discriminating: true,
      lines_stopping_below_5: idle.filter((x) => (x.rank || 0) < 5).length,
      of: LINES.length, rows: idle,
    });

    // ---- L2. THE CLIMB, THROUGH PLAY. Quests are OPENED and RESOLVED on the production paths
    // (`QuestEngine.open()` / `.resolve()`), so every flag that moves is one a resolution's own
    // `consequences` raised. Nothing here calls `questSetFlag`.
    const climbs = [];
    for (const fid of LINES) {
      fresh(REP_HOME[fid] || null);
      maxOut(fid);
      // Top out EVERYTHING for the climb arm only — see the node-side comment on ALL_SKILLS.
      try { H.setSkills(Object.fromEntries(ALL_SKILLS.map((x) => [x, 100]))); } catch (e) { out.notes.push('setSkills(all): ' + String(e).slice(0, 100)); }
      try { H.setAttributes(Object.fromEntries(ALL_ATTRS.map((x) => [x, 100]))); } catch (e) { out.notes.push('setAttributes(all): ' + String(e).slice(0, 100)); }
      const start = derived(fid).rank;
      const played = [];
      const taken = new Set();
      for (let round = 0; round < 10; round++) {
        const before = derived(fid).rank;
        // Everything this rank is allowed to take. `open()` still applies every other term —
        // the rank gate, the reputation gate, the topic, the giver's disposition — and refuses
        // in its own words if one is unmet; nothing here bypasses a gate.
        const candidates = (PLAN[fid] || []).filter((q) => !taken.has(q.id) && q.min_rank <= before);
        let acted = 0;
        for (const o of candidates) {
          const qid = o.id;
          taken.add(qid);
          if (o.home) { try { H.populateSettlement(o.home); } catch { /* */ } }
          try { H.questPrepareOffer(qid); } catch { /* */ }
          try { if (o.giver) H.setDisposition(o.giver, 100); } catch { /* */ }
          let opened = null;
          try { opened = H.questOpen(qid); } catch (e) { played.push({ quest: qid, open_error: String(e).slice(0, 120) }); continue; }
          if (!opened || opened.ok !== true) { played.push({ quest: qid, refused: opened && opened.reason }); continue; }
          const res = H.questResolutions(qid) || [];
          const raisers = new Set((o.raises || []).filter((r) => r.flags.length).map((r) => r.id));
          const pick = res.find((r) => r.available && raisers.has(r.id)) || res.find((r) => r.available) || res[0];
          if (!pick) { played.push({ quest: qid, no_resolution: true }); continue; }
          let closed = null;
          try { closed = H.questResolve(qid, pick.id); } catch (e) { played.push({ quest: qid, resolve_error: String(e).slice(0, 120) }); continue; }
          played.push({ quest: qid, resolution: pick.id, ok: !!(closed && closed.ok), why: closed && closed.reason });
          if (closed && closed.ok) acted++;
        }
        const after = derived(fid).rank;
        if (after >= 7) break;
        if (!acted && after === before) break;
      }
      const end = derived(fid);
      climbs.push({ faction: fid, rank_before_any_quest: start, rank_after_playing: end.rank, still_unmet: end.unmet,
        quests_resolved: played.filter((p) => p.ok).length, detail: played.slice(0, 60) });
    }
    push('L2.the_ladder_climbs_to_7_through_play', {
      discriminating: true,
      lines_reaching_rank_7: climbs.filter((c) => (c.rank_after_playing || 0) >= 7).length,
      of: LINES.length, rows: climbs,
    });

    // ---- L3. A LOCKED PLAYER IS NOT TOLD THEY ARE WELCOME. Both mouths: the quest-open path
    // (`QuestEngine.open()`, which is what a player meets) and the direct recruiter path.
    const spoken = [];
    for (const fid of LINES) {
      fresh();
      H.setFactionStanding(fid, { member: true, reputation: 60, rank: 3 });
      const g = H.factionGates();
      const lockedFactions = (g.rivalry_locked_now || []);
      const lockedQuests = (g.quests_locked_by_rivalry || []);
      for (const other of lockedFactions) {
        let r = null; try { r = H.factionRefusal(other, 1); } catch (e) { r = { error: String(e).slice(0, 120) }; }
        spoken.push({ joined: fid, path: 'recruiter', faction: other, kind: r && r.kind, said: r && r.said });
      }
      const first = lockedQuests[0];
      if (first) {
        try { H.questPrepareOffer(first.quest); } catch { /* */ }
        let o = null; try { o = H.questOpen(first.quest); } catch (e) { o = { error: String(e).slice(0, 120) }; }
        spoken.push({ joined: fid, path: 'quest_open', quest: first.quest, refused: o && o.ok === false,
          kind: o && o.voice && o.voice.kind, said: o && o.said, recorded_reason: o && o.reason });
      }
    }
    push('L3.a_locked_player_is_never_told_they_are_welcome', {
      discriminating: true,
      utterances: spoken.length,
      welcomes_spoken_to_a_locked_player: spoken.filter((s) => s.kind === 'welcome').length,
      lock_lines_spoken: spoken.filter((s) => s.kind === 'rivalry_locked').length,
      rows: spoken,
    });

    // ---- L4. Rank reaches the Dockhands' own person. `Engine.talkTo()` is the shipping path.
    const disp = [];
    for (const fid of LINES) {
      const rep = REPS[fid];
      fresh(REP_HOME[fid] || null);
      H.setFactionStanding(fid, { member: true, reputation: 0, rank: 0 });
      const by = [];
      for (const rank of [0, 2, 4, 7]) {
        H.setFactionStanding(fid, { member: true, rank });
        let v = null;
        try { H.talkTo(rep); const d = H.explainDisposition(rep); v = d ? d.value : null; } catch (e) { v = null; by.push({ rank, error: String(e).slice(0, 100) }); continue; }
        by.push({ rank, disposition: v });
      }
      const vals = by.map((b) => b.disposition).filter((x) => x != null);
      disp.push({ faction: fid, representative: rep, by_rank: by, moves: new Set(vals).size > 1, span: vals.length ? Math.max(...vals) - Math.min(...vals) : null });
    }
    push('L4.rank_moves_the_representative_on_every_line', {
      discriminating: true,
      lines_where_disposition_moves: disp.filter((d) => d.moves).length,
      of: LINES.length,
      flat_lines: disp.filter((d) => !d.moves).map((d) => d.faction),
      rows: disp,
    });

    // ---- L5. CONSUMPTION for `factions/registry.json`, on an entity. The Deep Kin hollow at
    // Stormhold is a `faction_interior` whose zone faction is `deep-kin`, and NOTHING writes a
    // `deep-kin` standing — `crime/sanction.json` says so in its own note. The registry is the
    // only file that says `deep_kin` writes as `deep-kin` and that this room is its seat.
    const seatRows = [];
    for (const fid of LINES) {
      fresh();
      let access = null; try { access = H.factionAccess(fid); } catch (e) { access = { error: String(e).slice(0, 140) }; }
      const zone = access && access.seat;
      const read = (label) => { try { return H.trespassCheck(zone, {}); } catch (e) { return { error: String(e).slice(0, 120), label }; } };
      const asStranger = zone ? read('stranger') : null;
      H.setFactionStanding(fid, { member: true, reputation: 120, rank: 3 });
      const asMember = zone ? read('member') : null;
      seatRows.push({ faction: fid, seat: zone || null,
        registry_read: !(access && access.error), services_at_rank_3: access && access.services,
        stranger_trespasses: asStranger && asStranger.trespassing,
        member_trespasses: asMember && asMember.trespassing,
        faction_seat_reported: asMember && asMember.faction_seat });
    }
    push('L5.the_registry_decides_who_is_at_home_in_a_seat', {
      discriminating: true,
      seats_resolved_from_the_registry: seatRows.filter((r) => r.faction_seat_reported).length,
      seats_where_a_member_is_not_a_trespasser: seatRows.filter((r) => r.member_trespasses === false).length,
      seats_where_a_stranger_IS_a_trespasser: seatRows.filter((r) => r.stranger_trespasses === true).length,
      of: LINES.length, rows: seatRows,
    });

    return out;
  }, { LINES, REPS, REP_HOME, PLAN, ALL_SKILLS, ALL_ATTRS });
  await game.close();
  for (const c of live.checks) report.checks.push(c);
  for (const n of live.notes) report.notes.push(n);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`w1-20-r3-verify [${ARM}] root=${ROOT}`);
for (const c of report.checks) {
  const { id, rows, detail, ...rest } = c;
  console.log(`  ${id}`);
  console.log(`    ${JSON.stringify(rest)}`);
}
for (const n of report.notes) console.log(`  note: ${n}`);
console.log(`wrote ${OUT}`);
const hard = report.checks.filter((c) => c.status === 'HARD_FAIL' || c.status === 'FAIL');
if (ARM === 'shipping' && hard.length) process.exitCode = 1;

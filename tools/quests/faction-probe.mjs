#!/usr/bin/env node
// faction-probe.mjs — the CONSUMPTION probe for the faction questlines (RI-MTH07, ARBITRATION §3).
//
// The rule this exists to satisfy: "for every model a piece ships, name the world-side consumer
// and demonstrate it by perturbing the model and watching an entity change behaviour." Three
// models are shipped here and each has its consumer named and exercised:
//
//   MODEL                          WORLD-SIDE CONSUMER
//   game/data/quests/faction-*.json   QuestBook (engine.js:326) -> QuestEngine.offers()
//   faction-gates.json ladders        FactionGates (engine.js:327) -> QuestEngine.context()
//                                     derives rank from reputation+attributes+skills+flags ->
//                                     gate.js canOffer() refuses or permits
//   faction-gates.json exclusivity    QuestEngine.context() rivalry derivation -> ctx.locked ->
//                                     gate.js canOffer() -> the offer disappears with a reason
//
// Nothing here computes an answer. Every number is read back out of a decision the shipped build
// made, through `window.__HARNESS`. The walk drives ONE FULL QUESTLINE FROM A COLD START to its
// rank ceiling using only three things a player can actually get — a topic somebody said out
// loud, reputation the quests award, and skills that rise by use — and never sets a rank, because
// rank is derived. Then it breaks each model on purpose and watches the offers change.
//
// Run: node tools/quests/faction-probe.mjs [--line the_wet_ledger] [--out report.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// attribute -> the skills whose use raises it. READ from the file the engine reads.
const GOVERNS = {};
for (const s of JSON.parse(fs.readFileSync(ROOT + '/game/data/progression/skills.json', 'utf8')).skills) {
  (GOVERNS[s.governing] = GOVERNS[s.governing] || []).push(s.id);
}

const USAGE = `
faction-probe.mjs — drive a faction questline through the live offer gate from a cold start.

USAGE
  node tools/quests/faction-probe.mjs [--line <faction_id>] [--rival <faction_id>] [--out <file>]
                                      [--refuse] [--signatures N|all] [--refuse-rank R] [--quiet]

  --refuse         take the refusal at --refuse-rank (default 6) on purpose in the MAIN walk, so
                   P4/P13/P14 are answered about a character who said no to the seat.
  --signatures N   also walk the line with N further character signatures and report how far each
                   got. 'all' runs the whole roster. Round 1's ladder clamped at 3 of 7 because a
                   best case was mistaken for the case; this is the check for that.
  --refuse-sweep   run the refusing walk as an EXTRA walk alongside the ordinary one, so the two
                   can be compared on the same page.

Exit 0 = the line was walked rank 0 -> rank 7 through questOffers(), both perturbations were
observed, joining the rival closed the line, and the shipped giver-presence gate refused nothing.
Non-zero = a model nothing reads, or a walk that was not standing in the world.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const LINE = String(args.line || 'the_wet_ledger');
const RIVAL = String(args.rival || 'the_imperial_assize');
const REFUSE = !!args.refuse;
const REFUSE_SWEEP = !!args['refuse-sweep'];
const REFUSE_RANK = args['refuse-rank'] === undefined ? 6 : Number(args['refuse-rank']);
// W1-FACTIONS r3. REAL SIGNATURES, NOT A BEST CASE. Each row is a character somebody would
// actually make, and the four fields are read by `setCharacter` — race, upbringing, class,
// birthsign. The first is the one both previous rounds used and is walked as the primary; the
// rest exist to find out whether the ladder is climbable by anyone else. A ladder that only the
// signature it was tuned on can climb is a ladder with one player.
const ROSTER = [
  { race: 'saxhleel', upbringing: 'marsh-born', class: 'root-speaker', birthsign: 'the-shadow' },
  { race: 'imperial', upbringing: 'colonial', class: 'legionary', birthsign: 'the-tower' },
  { race: 'dunmer', upbringing: 'exile', class: 'blade-for-hire', birthsign: 'the-warrior' },
  { race: 'naga', upbringing: 'deep-marsh', class: 'hunter', birthsign: 'raj-xul' },
  { race: 'saxhleel', upbringing: 'lukiul', class: 'scribe', birthsign: 'the-lady' },
  { race: 'khajiit', upbringing: 'caravan', class: 'thief', birthsign: 'the-shadow' },
  { race: 'argonian', upbringing: 'imperial-raised', class: 'merchant', birthsign: 'the-lord' },
];
const NSIG = args.signatures === undefined ? 0 : (String(args.signatures) === 'all' ? ROSTER.length : Number(args.signatures));
const SIGNATURES = ROSTER.slice(0, Math.max(0, NSIG));
const QUIET = !!args.quiet;
const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };

let handle;
const out = { tool: 'faction-probe', line: LINE, rival: RIVAL, checks: [], failures: [] };
const check = (id, ok, measured) => {
  out.checks.push({ id, ok: !!ok, measured });
  if (!ok) out.failures.push(`${id}: ${measured}`);
  say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}`);
};

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  page.on('pageerror', (e) => out.failures.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(({ LINE, RIVAL, GOVERNS }) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    // W1-FACTIONS round 3. THE WALK IS NOW A FUNCTION, so that the two measurements the round-2
    // verdict listed as UNMEASURED BY ANYBODY can be taken with the SAME instrument rather than a
    // second one written to agree with the first:
    //   * the REFUSING walk  (--refuse): take the rank-6 refusal on purpose and see if rank 7
    //     still arrives. Round 2 asserted it by construction and never played it.
    //   * the MULTI-SIGNATURE sweep (--signatures): the same ladder against real characters
    //     rather than the one signature it was tuned on. Round 1's ladder clamped at 3 of 7
    //     precisely because a best case was mistaken for the case.
    //
    // `cfg.signature` is the character. `cfg.refuseAtRank` makes the chooser prefer a `refuse`
    // ending at that rank if the quest has one. Everything else is byte-for-byte the round-2 walk.
    function walkLine(cfg) {
      H.reset({ state: 'default' });
      H.setRenderRate(0);
      const res = {};

      // A real character, not a bare sim. This is the signature the rank gates must clear.
      res.signature = cfg.signature;
      res.refuse_at_rank = cfg.refuseAtRank ?? null;
      H.setCharacter(cfg.signature);
      res.attrs = H.getPlayerStats().attributes;
      // W1-FACTIONS r3 / GAP-FCT-03. THE GATE IS NEVER SUSPENDED. `questPresenceGate` is read,
      // not written: the walk must satisfy the shipped presence term by going where the giver is,
      // and the miss counter is asserted at zero at the end. The round-2 numbers were taken in a
      // world with nobody in it, so `open()` refused and this probe's own reputation fallback
      // fired — and the claim "the walk wrote no reputation" was a fact about the fallback.
      res.presence_gate_at_start = H.questPresenceGate();

      // ---- RAISING A SKILL THE WAY PLAY RAISES ONE ------------------------------------------
      // `setSkills()` writes the register directly and grants NOTHING to the governing attribute,
      // so a probe that uses it can never clear an attribute gate and would report the ladder
      // unreachable when it is not. `grantSkillUse()` is the play path: `character/skilluse.js`
      // banks progress through `derive.js bankProgress`, which applies RI-PRG03 §4's +3-levels-
      // per-rest clamp and RI-PRG02 §2's earned-attribute grant at every multiple of 15. So this
      // rests at the hearth between batches exactly as a player would, and every attribute point
      // the character ends with was earned by a skill crossing 15/30/45/60/75/90.
      const USE_FOR = {
        security: ['lock_picked', { cost: 1 }],
        sneak: ['stealth_opener', { cost: 1 }],
        speechcraft: ['persuade_success', { cost: 1 }],
        mercantile: ['barter_turnover', { cost: 1, gold: 2500 }],
        acrobatics: ['drop_landed', { cost: 1 }],
        athletics: ['sprint_interval', { cost: 1 }],
        survival: ['flora_gathered', { cost: 1 }],
        alchemy: ['potion_brewed', { cost: 1 }],
        shieldcraft: ['parry', { cost: 1 }],
        sorcery: ['cast_effective', { cost: 1, spell_skill: 'sorcery' }],
        warding: ['cast_effective', { cost: 1, spell_skill: 'warding' }],
        veiling: ['cast_effective', { cost: 1, spell_skill: 'veiling' }],
        'root-speech': ['cast_effective', { cost: 1, spell_skill: 'root-speech' }],
        blades: ['weapon_hit', { cost: 40, weapon_class: 'straight_sword' }],
        'axes-maces': ['weapon_hit', { cost: 40, weapon_class: 'axe' }],
        polearms: ['weapon_hit', { cost: 40, weapon_class: 'spear' }],
        greatweapons: ['weapon_hit', { cost: 40, weapon_class: 'greatsword' }],
        'claw-fang': ['weapon_hit', { cost: 40, weapon_class: 'FST' }],
        marksman: ['marksman_hit', { cost: 40, range_m: 20 }],
      };
      const raiseLog = [];
      function raise(skill, target) {
        const row = USE_FOR[skill];
        if (!row) { raiseLog.push({ skill, refused: 'no use event maps to this skill' }); return; }
        const attrBefore = { ...H.getPlayerStats().attributes };
        let uses = 0, rests = 0, guard = 0;
        while ((H.getSkills()[skill] || 0) < target && guard++ < 4000) {
          const r = H.grantSkillUse(row[0], row[1]);
          uses++;
          if (r && r.rest_clamped) { H.hearthRest(); rests++; }
          else if (r && r.granted === 0 && r.gained === 0 && !r.refused && uses > 3000) break;
        }
        const attrAfter = H.getPlayerStats().attributes;
        const moved = Object.keys(attrAfter).filter((k) => attrAfter[k] !== attrBefore[k]).map((k) => `${k} ${attrBefore[k]}->${attrAfter[k]}`);
        raiseLog.push({ skill, to: H.getSkills()[skill], target, uses, rests, attributes_earned: moved });
      }

      // The only route an attribute has in this build. GOVERNS comes in from
      // `game/data/progression/skills.json` — the same file the engine loads — rather than being
      // restated here, because a restated attribute list is how `intelligence` (not an attribute
      // in this game; the sheet says `intellect`) survived in three faction ladders.
      function raiseAttribute(attr, want) {
        const owned = (GOVERNS[attr] || []).filter((s) => USE_FOR[s]);
        if (!owned.length) { raiseLog.push({ attribute: attr, refused: `no usable skill governs ${attr}` }); return; }
        let guard = 0;
        const stuck = new Set();
        while ((H.getPlayerStats().attributes[attr] || 0) < want && guard++ < 40) {
          const cur = H.getSkills();
          // Only skills that still HAVE a next multiple of 15 under the cap, and that have not
          // already refused to move. The first version took the single cheapest crossing and
          // `break`-ed the moment that one skill passed 90 — so willpower stopped at 17 with
          // `warding` maxed at 90 and `veiling` still sitting at 15, five crossings unspent, and
          // the Xul-Aneekh's ceiling quest reported unreachable when it was two skills away.
          const live = owned.filter((s) => !stuck.has(s) && (Math.floor((cur[s] || 0) / 15) + 1) * 15 <= 100);
          if (!live.length) break;
          const pick = live.slice().sort((a, b) => (((15 - ((cur[a] || 0) % 15)) - (15 - ((cur[b] || 0) % 15)))))[0];
          const next = (Math.floor((cur[pick] || 0) / 15) + 1) * 15;
          raise(pick, next);
          if ((H.getSkills()[pick] || 0) < next) stuck.add(pick);   // that skill will not move; try another
        }
      }

      const defs = {};
      for (const id of H.questBook()) defs[id] = H.questDef(id);

      // ---- FINISHING A QUEST THE WAY A PLAYER FINISHES ONE -----------------------------------
      // The first version of this probe picked `resolutions.find(available) || resolutions[0]` and
      // called resolve. Every rank-3-and-up quest on the line refused, silently, because a
      // resolution carries its OWN `requires` — sneak 32 AND security 32, or speechcraft 32, or
      // 1100 gold — and the probe had only ever raised the skills the RANK GATE named. So the
      // chain never completed and eight of nine quests reported "requires Q-LEDG-03 first". That
      // is not the ladder's defect; it was the probe grinding for the door and not for the work.
      //
      // A player picks a resolution and then goes and becomes able to do it. So does this: it
      // takes the CHEAPEST unmet resolution, prefers a NON-VIOLENT one, and pays for it with the
      // same two things play has — skill use through `grantSkillUse` (never `setSkills`), and
      // gold. Attributes are still never set; they rise only where a governed skill crosses 15.
      // `questDef()` is a DELIBERATELY trimmed view — id, giver, opens_by, rank_gate — and carries
      // neither `resolutions[].requires` nor `consequences`. Reading requirements off it silently
      // produced `{}` for every resolution, so this probe's first version raised nothing, paid
      // nothing, and then reported the line unwalkable and `res_kill_her` non-violent. The
      // authoritative readers are `questResolutions()` (availability + why) and
      // `questResolutionRequirements()` (the actual demand, including `requires_knowing`).
      const resolveLog = [];
      const probeSetFlags = new Set();
      const setFlag = (f) => { probeSetFlags.add(f); return H.questSetFlag(f, true); };
      function needOf(qid, rid) { try { return H.questResolutionRequirements(qid, rid); } catch (e) { return {}; } }
      function conseqOf(qid, rid) { try { return H.questResolutionConsequences(qid, rid); } catch (e) { return {}; } }
      function cost(need) {
        return Object.values(need.skills || {}).reduce((a, b) => a + b, 0)
          + Object.values(need.attributes || {}).reduce((a, b) => a + b, 0) * 10
          + (need.gold || 0) / 100
          + (need.requires_knowing || []).length;   // a reveal is cheap but not free
      }
      // W1-FACTIONS round 2. THE FLAGS THE LADDER ITSELF ASKS FOR, read off the shipped gate rather
      // than named here. Every rank of every faction carries a `world_state` term, and the rank-7
      // term is "the first chair of the Ledger is empty and you emptied it". Round 1's chooser took
      // the CHEAPEST ending, a refusal asks for nothing, and a refusal is precisely the ending that
      // does not empty the chair — so all three lines ended by poking the rank-7 flag in by hand.
      // "Rank 7 reached" and "walked without killing" were each true and never true together.
      const LADDER_FLAGS = new Set();
      {
        const fx = (H.factionGates().factions || []).find((f) => f.id === LINE) || {};
        for (const row of fx.ranks || []) if (row && row.world_state && row.world_state.flag) LADDER_FLAGS.add(row.world_state.flag);
      }
      // W1-FACTIONS r2, found by this probe going red on two lines the moment expulsion shipped.
      // RI-QST03 §D expulsion is now a live consumer: an ending that hands the house's own papers
      // to its rival raises a flag that closes the whole line. The round-2 chooser was picking
      // `res_publish_the_rooms` and `res_to_the_assize` — both excellent endings, both a career
      // ending — and then reporting the ladder unreachable. A player walking a CAREER does not take
      // those, so neither does the walk. They are still reachable, still authored, and the seam
      // probe (tools/quests/faction-seam-probe.mjs) is where they are exercised on purpose.
      const EXPELS = new Set();
      for (const row of (H.factionDiscipline().declared || [])) {
        if (row.faction !== LINE) continue;
        for (const f of row.expelled_by || []) EXPELS.add(f);
      }
      res.expulsion_causes_avoided_by_the_walk = [...EXPELS];
      const flagsUp = () => new Set(H.questWorldFlags());
      function finish(id) {
        const rows = H.questResolutions(id) || [];
        if (!rows.length) { resolveLog.push({ quest: id, refused: 'the book offers no resolutions' }); return null; }
        const needs = new Map(rows.map((r) => [r.id, needOf(id, r.id)]));
        const gives = new Map(rows.map((r) => [r.id, conseqOf(id, r.id)]));
        const up = flagsUp();
        // A ladder flag this ending would raise that is not up yet. This is the whole of the fix:
        // the chooser now plays for the SEAT rather than for the cheapest exit, and it still refuses
        // violence outright — the two preferences are ordered so that a line which can only be
        // vacated with a sword shows up as the walk stopping at rank 6, not as a silent poke.
        const wanted = (rid) => ((gives.get(rid) || {}).world_flags || []).filter((f) => LADDER_FLAGS.has(f) && !up.has(f)).length;
        // Prefer, in order: no violence (never); an ending that advances the ladder; one already
        // available; the cheapest to become able to do.
        const expels = (rid) => ((gives.get(rid) || {}).world_flags || []).some((f) => EXPELS.has(f));
        // W1-FACTIONS r3, `--refuse`. At the named rank the walk takes a REFUSAL on purpose, in
        // front of every other preference except violence. Round 2 claimed "you can refuse the
        // seat at rank 6 and still reach rank 7" and never played it once; the round-2 critic's
        // chooser stalled at rank 4 and could not either. This makes the claim a measurement:
        // if refusing costs the ladder its ceiling, `P4` goes red on this run and says so.
        const refusing = cfg.refuseAtRank != null && (defs[id] && defs[id].rank_gate && defs[id].rank_gate.min_rank === cfg.refuseAtRank);
        const isRefusal = (rid) => (needs.get(rid) || {}).method === 'refuse';
        const rank = (row) => (row.violence_required || needs.get(row.id).violence_required ? 100000 : 0)
          + (expels(row.id) ? 50000 : 0)
          + (refusing ? (isRefusal(row.id) ? -30000 : 0) : 0)
          + (wanted(row.id) ? 0 : 20000)
          + (row.available ? 0 : 1000)
          + cost(needs.get(row.id));
        const order = rows.slice().sort((a, b) => rank(a) - rank(b));
        for (const row of order) {
          const need = needs.get(row.id) || {};
          // (i) the SHEET, paid for by use — never `setSkills`, never a set attribute.
          for (const [sk, lvl] of Object.entries(need.skills || {})) if ((H.getSkills()[sk] || 0) < lvl) raise(sk, lvl);
          // (ia) an ATTRIBUTE a resolution asks for is still never written. It is bought the only
          //      way this build sells one: push a skill the attribute GOVERNS past its next
          //      multiple of 15 and take the +1 (`character/derive.js:359`). Without this,
          //      `Q-ASSZ-06 res_lease_stands` — "personality 16/20", the Assize's own non-violent
          //      exit at rank 5 — was unreachable and the line dead-ended one quest short of its
          //      ceiling, on an attribute that was four skill-crossings away the whole time.
          for (const [at, want] of Object.entries(need.attributes || {})) raiseAttribute(at, want);
          // (ii) the PURSE.
          if (need.gold && H.getGold() < need.gold) H.setGold(need.gold);
          // (iii) the THINGS YOU FOUND OUT. `requires_knowing` names reveals the quest declares
          //       under `revealed_by` — a ledger you read, a rival who talked, a porter you asked.
          //       Without these, four of nine Wet Ledger quests had no reachable resolution and the
          //       line dead-ended at rank 3 for reasons that had nothing to do with the ladder.
          for (const rev of need.requires_knowing || []) { try { H.questReveal(id, rev); } catch (e) { /* not revealable here */ } }
          const after = (H.questResolutions(id) || []).find((x) => x.id === row.id);
          if (!after || !after.available) continue;
          const done = H.questResolve(id, row.id);
          // GAP-FCT-01. `resolve()` now runs the offer gate, so a refusal here is a real refusal and
          // is recorded as one. Round 1 discarded this return value entirely; every resolution in
          // every walk it reported had been applied outside every gate this system has.
          if (!done || !done.ok) { resolveLog.push({ quest: id, resolution: row.id, refused_by_the_gate: (done || {}).reason || 'no return' }); continue; }
          resolveLog.push({
            quest: id, resolution: row.id, method: need.method,
            violence_required: !!(row.violence_required || need.violence_required),
            ladder_flags_raised: ((gives.get(row.id) || {}).world_flags || []).filter((f) => LADDER_FLAGS.has(f)),
            would_have_been_expelled: expels(row.id),
            refused_on_purpose: !!(refusing && isRefusal(row.id)),
            paid_for: Object.keys(need).filter((k) => k !== 'method' && k !== 'journal_index' && k !== 'violence_required'),
          });
          return done && (done.resolution || row.id);
        }
        // Re-read, so the refusal reports the sheet AS IT IS NOW rather than as it was before the
        // probe spent 300 skill-uses on it. The stale copy said "willpower 10/24" about a
        // character that was standing at 17 by then, which sent the diagnosis to the wrong place.
        const nowRows = H.questResolutions(id) || [];
        resolveLog.push({ quest: id, refused: 'no resolution became available', why: nowRows.map((x) => ({ id: x.id, why: x.why })) });
        return null;
      }
      // ---- GAP-FCT-03. GO TO WHERE THE PERSON IS, BEFORE ASKING THEM FOR WORK. ---------------
      //
      // This is the whole of the round-2 verdict's §1. `QuestEngine.open()` grew a presence term
      // — *"A quest is a thing a person asks you to do. If there is no person, there is no
      // quest."* — and this probe booted a bare world and never put anybody in it. So `open()`
      // refused seventeen times, this probe's own `grantRep()` fallback fired to satisfy the rank
      // terms by hand, and the round's proudest claim ("the walk wrote no reputation at all")
      // became a statement about the fallback rather than about the content.
      //
      // The fix is NOT to suspend the gate, and it is NOT `spawnNPC({ from_record })` — which
      // conjures a body out of nothing and cannot go red. It is `H.travelToGiver()`, which reads
      // the giver's own record, populates the settlement or the site they belong to, and comes
      // back `present: false` with a reason when the person has no place in the world. Every
      // journey is logged, and `P17` asserts the presence gate refused nothing.
      const travelLog = [];
      function goTo(id, why) {
        let t;
        try { t = H.travelToGiver(id); } catch (e) { t = { quest: id, present: false, why: `travelToGiver threw: ${String(e).slice(0, 120)}` }; }
        travelLog.push({ ...t, as: why });
        return t;
      }
      const inLine = (id) => defs[id] && defs[id].rank_gate && defs[id].rank_gate.faction === LINE;
      const line = Object.values(defs).filter((d) => d.rank_gate && d.rank_gate.faction === LINE)
        .sort((a, b) => (a.rank_gate.min_rank - b.rank_gate.min_rank) || a.id.localeCompare(b.id));
      res.line_ids = line.map((d) => `${d.id}@r${d.rank_gate.min_rank}`);

      // ---- COLD START. Nothing granted. -----------------------------------------------------
      const cold = H.questOffers().filter((o) => inLine(o.id));
      res.cold = { offerable: cold.filter((o) => o.offerable).map((o) => o.id), n: cold.length, why_rank0: (cold.find((o) => defs[o.id].rank_gate.min_rank === 0) || {}).why };

      // ---- WALK THE LADDER, only ever granting things play grants. --------------------------
      const walk = [];
      const unmetWorldState = [];
      const openLog = [];
      // W1-FACTIONS r2. EVERYTHING THE WALK IS HANDED, itemised. Round 1's report could not say
      // whether the ladder was climbed or written in; these two logs are the difference. A walk
      // that never writes a reputation is a walk the QUESTS paid for.
      const repWrites = [], dispWrites = [];
      const grantRep = (f, v, why) => { repWrites.push({ faction: f, reputation: v, why }); return H.setFactionStanding(f, { member: true, reputation: v }); };
      const grantDisp = (n, v, why) => { dispWrites.push({ npc: n, to: v, why }); return H.setDisposition(n, v); };
      for (const d of line) {
        // (a) THE WORDS. Only ever the topics the quest itself declares it opens on. The forward
        //     `hooks.json` edges would grant these by playing; the probe short-circuits the
        //     journal write, not the requirement.
        for (const t of [d.opens_by && d.opens_by.topic, ...((d.opens_by && d.opens_by.prerequisite_topics) || [])]) {
          if (t) { try { H.learnTopic(t); } catch (e) { /* not a topic this build knows */ } }
        }
        // (b) THE PREREQUISITE QUESTS, finished the way finishing them would.
        for (const pq of (d.opens_by && d.opens_by.prerequisite_quests) || []) {
          try {
            goTo(pq, 'prerequisite');
            const o = H.questOpen(pq);
            openLog.push({ quest: pq, as: 'prerequisite', ...o });
            if (o && o.ok) finish(pq);
          } catch (e) { openLog.push({ quest: pq, as: 'prerequisite', threw: String(e).slice(0, 160) }); }
        }
        // (c) THE SHEET AND THE STANDING, to whatever the LADDER asks for — read out of the
        //     refusal's own four-part statement, never guessed. Rank is NEVER set: it is derived.
        let o = H.questOffers().find((x) => x.id === d.id);
        let guard = 0;
        while (o && !o.offerable && guard++ < 14) {
          const g = o.gate;
          if (g) for (const t of g.terms || []) {
            if (!t.met && t.kind === 'reputation') grantRep(LINE, t.need, `rank term at ${d.id}`);
            if (!t.met && (t.kind === 'skill_1' || t.kind === 'skill_2')) {
              const cur = H.getSkills();
              const best = (t.what || []).slice().sort((a, b) => (cur[b] || 0) - (cur[a] || 0));
              raise(best[t.kind === 'skill_1' ? 0 : 1], t.need);
            }
            // THE FLAG IS NOT POKED ANY MORE. A rank's world_state term is raised by finishing the
            // quest that raises it, or it is not raised at all and the walk stops there and says so.
            // Round 1 poked all three lines' rank-7 flags and then reported "top derived rank 7".
            if (!t.met && t.kind === 'world_state') unmetWorldState.push({ quest: d.id, flag: t.what, text: t.need });
            // The attribute term is NEVER set. It rises only where `raise()` above made a
            // governed skill cross a multiple of 15, which is the one route the game has.
          }
          if (d.rank_gate && d.rank_gate.min_reputation != null) {
            const st = H.getFactionStanding()[LINE] || {};
            if ((st.reputation || 0) < d.rank_gate.min_reputation) grantRep(LINE, d.rank_gate.min_reputation, `min_reputation on ${d.id}`);
          }
          const gv = d.giver;
          if (gv && gv.disposition_min != null) {
            const have = (H.getGateDispositions() || {})[gv.npc_id] || 0;
            if (have < gv.disposition_min) grantDisp(gv.npc_id, Math.min(100, gv.disposition_min + 15), `giver.disposition_min on ${d.id}`);
          }
          o = H.questOffers().find((x) => x.id === d.id);
        }
        const gates = H.factionGates();
        const row = (gates.factions || []).find((f) => f.id === LINE) || {};
        walk.push({
          id: d.id, min_rank: d.rank_gate.min_rank, giver: d.giver && d.giver.npc_id,
          offerable: !!(o && o.offerable), why: (o && o.why) || [],
          derived_rank: row.derived_rank, reputation: row.reputation,
        });
        // THE LAST QUEST ON THE LINE IS LEFT STANDING, DELIBERATELY. The perturbations below ask
        // "what closes when I break the model", and once every quest on the line is resolved there
        // is nothing left for them to close — the first run of this probe reported "closed 0
        // offers" against a lockout that was working perfectly, purely because the walk had
        // consumed its own evidence. So the ceiling quest is brought to offerable and held there,
        // perturbed against, and only then taken.
        const isLast = d === line[line.length - 1];
        if (o && o.offerable && !isLast) {
          try {
            const t = goTo(d.id, 'line');
            walk[walk.length - 1].giver_present = !!(t && t.present);
            walk[walk.length - 1].went_to = (t && t.went_to) || null;
            const op = H.questOpen(d.id);
            openLog.push({ quest: d.id, as: 'line', ...op });
            walk[walk.length - 1].opened = !!(op && op.ok);
            if (op && op.ok) walk[walk.length - 1].resolved = finish(d.id);
            else walk[walk.length - 1].open_refusal = (op || {}).reason;
          } catch (e) { walk[walk.length - 1].resolve_error = String(e).slice(0, 200); }
        }
      }
      res.steps = walk;
      res.resolutions = resolveLog;
      res.held_open_for_perturbation = line[line.length - 1].id;
      res.skill_raises = raiseLog;
      res.attrs_end = H.getPlayerStats().attributes;
      res.skills_end = H.getSkills();
      const gatesNow = H.factionGates();
      res.final = (gatesNow.factions || []).find((f) => f.id === LINE) || null;

      // ---- PERTURBATION 1: break the LADDER. Zero the reputation the ranks are derived from. --
      const before = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
      const savedRep = (H.getFactionStanding()[LINE] || {}).reputation || 0;
      H.setFactionStanding(LINE, { reputation: 0 });
      const rankAfter = (H.factionGates().factions.find((f) => f.id === LINE) || {}).derived_rank;
      const after = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
      res.perturb_ladder = { rank_before: res.final && res.final.derived_rank, rank_after: rankAfter, offerable_before: before, offerable_after: after, closed: before.filter((x) => !after.includes(x)) };
      H.setFactionStanding(LINE, { reputation: savedRep });

      // ---- PERTURBATION 2: break the EXCLUSIVITY. Join the rival and watch the line close. ----
      const lineBefore = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
      // Reputation 112 and not 40. The exclusivity table has two shapes: `enemy_pairs`, which
      // close at ANY rank, and `earned`, which close only at a declared rank — the Assize closes
      // the Xul-Aneekh at rank 4, needing reputation 52. Joining at 40 derived rank 3 and the
      // lockout correctly did not fire, which the probe then reported as the model having no
      // consumer. A perturbation that does not reach the threshold it is testing measures nothing.
      // 112 is the rank-7 reputation, so every declared exclusion is in scope.
      H.setFactionStanding(RIVAL, { member: true, reputation: 112 });
      const g2 = H.factionGates();
      const lineAfter = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
      const refusals = H.questOffers().filter((o) => inLine(o.id) && !o.offerable).map((o) => ({ id: o.id, why: o.why }));
      res.perturb_exclusion = {
        declared: g2.declared_exclusivity,
        rival_closes: (g2.factions.find((f) => f.id === RIVAL) || {}).closes,
        rivalry_locked_now: g2.rivalry_locked_now,
        offerable_before: lineBefore, offerable_after: lineAfter,
        closed: lineBefore.filter((x) => !lineAfter.includes(x)),
        example_refusal: (refusals.find((x) => (x.why || []).some((w) => /will not deal with you/.test(w))) || {}).why,
        quests_locked_by_rivalry: (g2.quests_locked_by_rivalry || []).length,
      };
      H.setFactionStanding(RIVAL, { member: false, reputation: 0 });

      // ---- AND NOW TAKE THE CEILING QUEST, so the line is actually finished. -------------------
      const top = line[line.length - 1];
      const topOffer = H.questOffers().find((x) => x.id === top.id);
      if (topOffer && topOffer.offerable) {
        try {
          goTo(top.id, 'ceiling');
          const op = H.questOpen(top.id);
          openLog.push({ quest: top.id, as: 'ceiling', ...op });
          if (op && op.ok) res.ceiling_resolved = finish(top.id); else res.ceiling_open_refusal = (op || {}).reason;
        } catch (e) { res.ceiling_error = String(e).slice(0, 200); }
      } else { res.ceiling_open_refusal = `never became offerable: ${JSON.stringify((topOffer || {}).why)}`; }
      res.opens = openLog;
      res.unmet_world_state = unmetWorldState;
      res.reputation_writes = repWrites;
      res.disposition_writes = dispWrites;
      const st = walk.find((s) => s.id === top.id); if (st) st.resolved = res.ceiling_resolved;

      // ---- THE CONSEQUENCE, READ OFF THE LIVE WORLD -------------------------------------------
      // Not off the quest file. `questWorldFlags()` reads `sim.quest.flags`, which is what the
      // machine wrote when each resolution was applied. A line that raises no flag has changed
      // nothing about the world it is set in, whatever its journal says.
      res.world_flags_now = H.questWorldFlags();
      res.flags_the_probe_set_itself = [...probeSetFlags].sort();
      // The flags that are up which the probe never wrote. Those are the ones the RESOLUTIONS
      // raised, and they are the only honest evidence that finishing a quest changed the world
      // rather than a journal. A check that counted every set flag would pass on the three the
      // probe pokes in to clear the rank-5/6/7 world_state terms.
      res.flags_raised_by_the_quests = res.world_flags_now.filter((f) => !probeSetFlags.has(f));
      // ---- GAP-FCT-03, read off the SHIPPED GATE and not off this probe's own bookkeeping. ----
      // `questPresenceGate()` returns the engine's own counter. Non-zero means `open()` was asked
      // for a quest whose giver was nowhere, which is the exact condition that silently turned
      // the round-2 numbers into the fallback's numbers.
      res.presence_gate_at_end = H.questPresenceGate();
      res.travel = travelLog;
      res.travel_failures = travelLog.filter((t) => !t.present);
      return res;
    }

    // ---- WHICH WALKS TO TAKE -----------------------------------------------------------------
    // The primary signature is the one round 1 and round 2 both used, kept so the numbers are
    // comparable. `--signatures` adds real alternatives; `--refuse` re-walks refusing.
    const PRIMARY = { race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' };
    const main = walkLine({ signature: PRIMARY, refuseAtRank: REFUSE ? REFUSE_RANK : null });
    // A compact summary per extra signature — the whole walk object per character would be
    // megabytes, and the question the sweep answers is "how far does THIS person get".
    const digest = (w) => ({
      signature: w.signature,
      top_rank: w.final && w.final.derived_rank,
      reputation: w.final && w.final.reputation,
      offerable: (w.steps || []).filter((s) => s.offerable).length,
      of: (w.steps || []).length,
      resolutions_taken: (w.resolutions || []).filter((x) => x.resolution).length,
      violent: (w.resolutions || []).filter((x) => x.resolution && x.violence_required).length,
      reputation_writes: (w.reputation_writes || []).length,
      flags_poked: (w.flags_the_probe_set_itself || []).length,
      presence_misses: (w.presence_gate_at_end || {}).misses,
      stalled_at: ((w.steps || []).find((s) => !s.offerable) || {}).id || null,
      stall_reason: ((w.steps || []).find((s) => !s.offerable) || {}).why || null,
      attrs_end: w.attrs_end,
    });
    const sweep = SIGNATURES.map((s) => digest(walkLine({ signature: s, refuseAtRank: null })));
    const refusing = REFUSE_SWEEP ? digest(walkLine({ signature: PRIMARY, refuseAtRank: REFUSE_RANK })) : null;
    return { ...main, sweep, refusing_walk: refusing, primary_signature: PRIMARY };
  }, { LINE, RIVAL, GOVERNS, SIGNATURES, REFUSE, REFUSE_SWEEP, REFUSE_RANK });

  out.measured = r;
  say(`\nline: ${(r.line_ids || []).join(' ')}`);
  say(`cold start refusal on the rank-0 quest: ${JSON.stringify(r.cold.why_rank0)}`);
  for (const s of r.steps) say(`  r${s.min_rank} ${s.id.padEnd(11)} offerable=${s.offerable ? 'yes' : 'NO '} rank=${s.derived_rank} rep=${s.reputation} ${s.offerable ? '' : JSON.stringify(s.why)}`);

  check('P1_line_is_a_line', (r.line_ids || []).length >= 8, `${(r.line_ids || []).length} quests gated on ${LINE}, ranks ${(r.steps || []).map((s) => s.min_rank).join('/')}`);
  check('P2_cold_start_closed', (r.cold.offerable || []).length === 0, `cold start offers ${(r.cold.offerable || []).length} of ${r.cold.n} ${LINE} quests — a line handed to you for free is not a ladder`);
  const walked = (r.steps || []).filter((s) => s.offerable).length;
  check('P3_every_rank_reachable', walked === (r.steps || []).length, `${walked}/${(r.steps || []).length} quests in the line became offerable by playing`);
  const favA = (r.final && r.final.favoured_attributes) || [];
  check('P4_ladder_reaches_ceiling', r.final && r.final.derived_rank >= 7, `top derived rank ${r.final && r.final.derived_rank} (${r.final && r.final.ranks && r.final.ranks[r.final.derived_rank] ? r.final.ranks[r.final.derived_rank].name : '?'}) at reputation ${r.final && r.final.reputation}; favoured attributes now ${favA.map((a) => `${a} ${r.attrs_end[a]}`).join(', ')} against a rank-7 demand of ${r.final && r.final.ranks ? r.final.ranks[7].attribute : '?'}`);
  check('P8_attributes_were_EARNED', (r.skill_raises || []).some((x) => (x.attributes_earned || []).length),
    `attribute points granted by skill use, never set: ${(r.skill_raises || []).flatMap((x) => x.attributes_earned || []).join('; ') || 'NONE'}`);
  check('P5_ladder_perturbation_bites', (r.perturb_ladder.closed || []).length > 0 && r.perturb_ladder.rank_after < r.perturb_ladder.rank_before,
    `zeroing reputation moved the DERIVED rank ${r.perturb_ladder.rank_before} -> ${r.perturb_ladder.rank_after} and closed ${(r.perturb_ladder.closed || []).length} offers`);
  check('P6_exclusion_bites', (r.perturb_exclusion.closed || []).length > 0,
    `joining ${RIVAL} closed ${(r.perturb_exclusion.closed || []).length} ${LINE} offers; ${RIVAL} closes ${JSON.stringify(r.perturb_exclusion.rival_closes)}`);
  check('P7_lockout_is_legible', !!r.perturb_exclusion.example_refusal,
    `the refusal a giver would speak: ${JSON.stringify(r.perturb_exclusion.example_refusal)}`);
  const taken = (r.resolutions || []).filter((x) => x.resolution);
  const nonviolent = taken.filter((x) => !x.violence_required);
  check('P9_the_line_can_be_walked_without_killing', taken.length > 0 && nonviolent.length === taken.length,
    `${nonviolent.length}/${taken.length} resolutions the walk actually took required no violence: ${taken.map((x) => `${x.quest}:${x.resolution}${x.violence_required ? '(VIOLENT)' : ''}`).join(' ')}`);
  check('P10_the_world_changed', (r.flags_raised_by_the_quests || []).length > 0,
    `${(r.flags_raised_by_the_quests || []).length} world flag(s) are set in sim.quest.flags that the probe never wrote — i.e. raised by the resolutions themselves: ${(r.flags_raised_by_the_quests || []).join(', ') || 'NONE — the line is a journal and nothing else'} (the probe poked in ${(r.flags_the_probe_set_itself || []).join(', ') || 'nothing'} to clear rank world_state terms)`);
  const refused = (r.resolutions || []).filter((x) => x.refused || x.refused_by_the_gate);
  check('P11_every_quest_taken_could_be_finished', refused.length === 0,
    refused.length ? `${refused.length} quest(s) had no reachable resolution: ${refused.map((x) => `${x.quest}${x.refused_by_the_gate ? ` (gate: ${x.refused_by_the_gate})` : ''}`).join(', ')}` : `all ${taken.length} quests opened on the walk reached a resolution`);
  // ---- W1-FACTIONS round 2 -----------------------------------------------------------------
  // The three checks the round-1 verdict says were never taken together. P4 and P9 were each
  // true and jointly untested, because the walk poked the rank-7 flag in and then read the rank
  // back out of the gate it had just satisfied by hand.
  check('P12_no_rank_flag_was_poked', (r.flags_the_probe_set_itself || []).length === 0,
    (r.flags_the_probe_set_itself || []).length
      ? `the probe wrote ${(r.flags_the_probe_set_itself || []).join(', ')} into sim.quest.flags — every rank derived above it is the probe's own arithmetic`
      : `the probe wrote no world flag; every world_state term the ladder asked for was raised by a resolution or was not raised at all`);
  const ladderFlags = (r.final && (r.final.ranks || []).map((x) => x && x.world_state && x.world_state.flag).filter(Boolean)) || [];
  const rank7Flag = ladderFlags[ladderFlags.length - 1];
  check('P13_the_seat_was_vacated_by_PLAY', !!rank7Flag && (r.flags_raised_by_the_quests || []).includes(rank7Flag),
    `the rank-7 world_state term is ${JSON.stringify(rank7Flag)}; raised by a resolution the walk took: ${(r.flags_raised_by_the_quests || []).includes(rank7Flag)}. Endings that raised a ladder flag: ${(r.resolutions || []).filter((x) => (x.ladder_flags_raised || []).length).map((x) => `${x.quest}:${x.resolution}->${x.ladder_flags_raised.join('+')}`).join(' ') || 'NONE'}`);
  check('P14_rank7_AND_nonviolent_together', r.final && r.final.derived_rank >= 7 && taken.length > 0 && nonviolent.length === taken.length && (r.flags_the_probe_set_itself || []).length === 0,
    `derived rank ${r.final && r.final.derived_rank}, ${nonviolent.length}/${taken.length} endings non-violent, ${(r.flags_the_probe_set_itself || []).length} flags poked — the three claims held at the same time on the same character`);
  // "already opened" / "quest is closed" are idempotency, not a bypass — the prerequisite pass
  // opens and finishes a quest that the line loop then reaches again. A refusal with any OTHER
  // reason is the offer gate saying no, and a walk that carried on past one is measuring nothing.
  const idempotent = /^(already opened|quest is closed)$/;
  const badOpen = (r.opens || []).filter((o) => o.threw || (o.ok === false && !idempotent.test(String(o.reason || ''))));
  check('P15_every_open_went_through_the_offer_gate', badOpen.length === 0,
    badOpen.length ? `${badOpen.length} questOpen call(s) were refused by the gate and the walk carried on regardless: ${badOpen.map((o) => `${o.quest}: ${o.reason || o.threw}`).join(' | ')}` : `${(r.opens || []).length} questOpen calls, ${(r.opens || []).filter((o) => o.ok).length} accepted and ${(r.opens || []).length - (r.opens || []).filter((o) => o.ok).length} idempotent re-opens; none refused by the gate`);
  check('P16_the_reputation_was_EARNED', (r.reputation_writes || []).length === 0,
    (r.reputation_writes || []).length
      ? `the walk WROTE reputation ${(r.reputation_writes || []).map((w) => `${w.reputation} (${w.why})`).join(', ')} — every rank derived after that is partly the probe's`
      : `the walk wrote no reputation at all; ${(r.final || {}).reputation} was paid entirely by the quests' own consequences`);

  out.ok = out.failures.length === 0;
  if (args.out) writeJson(args.out, out);
  say(`\n${out.ok ? 'PASS' : 'FAIL'} — ${out.checks.filter((c) => c.ok).length}/${out.checks.length} checks`);
  await handle.close();
  process.exit(out.ok ? 0 : 1);
} catch (e) {
  console.error(String((e && e.stack) || e));
  if (args.out) writeJson(args.out, { ...out, error: String(e).slice(0, 500) });
  if (handle) await handle.close().catch(() => {});
  process.exit(2);
}

#!/usr/bin/env node
// viability-walk.mjs — build viability measured by PLAYING. Real character signatures driven
// through the shipping gates, in the running engine, from a cold start, GRANTED NOTHING.
//
// =============================================================================================
// WHY THIS EXISTS, and why it is the second of two instruments rather than the sixth version of
// one (orchestration/NEXT-DISPATCH.md §R).
//
// `tools/analysis/build-viability.mjs` — now `tools/analysis/impossibility-screen.mjs` — was
// rejected five times running. Every rejection was the same shape wearing different clothes: a
// value the tool handed to a synthetic character and then measured. A constant (`gold = 1e9`), a
// Proxy (`reputation` answering 100 to everything), an empty Set that answered `true` to every
// membership test, a union, and finally a "derived" value computed from an optimistic assumption.
// Each rebuild replaced one fiction with a smaller one.
//
// TOOL-COVERAGE-R4 DEFECT L is the proof that the approach itself was the defect rather than any
// one grant: `worldFlags` was granted as the UNION of every resolution of every quest. 601 of the
// 755 shipped world flags are contested — every producer of them is one branch of a branching
// quest — so the tool was asking "can this character finish the game?" of a world in which
// `archon_vats_open` and `archon_vats_burned` are both true at once, and `ixtu_vakh_trusts_player`
// sits beside `ixtu_vakh_closed_to_player`. There is no grant that makes that world real.
//
// So the ruling: THE GRANTED CHARACTER IS THE DEFECT. The screen keeps the fast static walk and
// is forbidden, in code, to report a positive. This tool answers the question the screen cannot,
// the only way it can honestly be answered — by playing it.
//
// THE ARGUMENT THIS TOOL HAS TO SURVIVE, because it is a good one and it is not mine.
// `orchestration/status/tool-build-viability-r6.json` argued against exactly this, citing
// `game/src/harness/api.js:1610-1617`: W1-FACTIONS round 1's live in-engine walk "chose the
// cheapest ending at every rank — always the refusal, because a refusal asks for nothing — and
// then poked the rank-7 world flag in by hand to get past the gate it had just declined to open.
// 'Rank 7 reached' and 'walked without killing' were each true and had never been true together."
// The point stands: A LIVE PROBE DOES NOT REMOVE THE SUBSTITUTION CLASS BY BEING LIVE. It
// relocates it inside the engine, where no ledger prints it.
//
// This tool's answer is not "that will not happen to me". It is a fence and a ledger:
//
//   1. THE GRANT FENCE. The walk does not hold `window.__HARNESS`. It holds a facade built from
//      an ENUMERATED ALLOW-LIST of verbs, and every verb that hands the character something it
//      did not earn — `setGold`, `setSkills`, `setAttributes`, `setFactionStanding`,
//      `questSetFlag`, `learnTopic`, `spawnNPC`, ... — is present on the facade only as a
//      function that THROWS and counts the attempt. `--falsify grant-fence` proves it throws.
//      W1-FACTIONS round 1's exact failure — poking a rank-7 world flag in by hand — is
//      `questSetFlag`, and on this facade it is not reachable.
//   2. THE CALL LEDGER. Every harness call the walk makes is tallied by verb and published on
//      the artifact. A reader can see the whole vocabulary the walk used and check it against
//      the allow-list without reading this file.
//   3. THE CHEAPEST-ENDING TRAP, named and measured. W1-FACTIONS round 1 took the refusal at
//      every rank because a refusal asks for nothing. This walk records, per resolution taken,
//      whether it was a refusal-shaped ending (no requirements at all), and reports the count. A
//      run that finished the book on nothing but free endings says so on its own front page.
//
// SCOPE OF THE FENCE, stated so it is not mistaken for a sandbox. It covers THIS TOOL'S OWN CODE
// PATH. `orchestration/INDEX.md` records that `main.js` publishes `window.__ENGINE` as a back
// door around harness-level prohibitions, and a facade cannot close that. What closes it here is
// that the string `__ENGINE` does not occur in this file and `__HARNESS` occurs exactly once —
// an invariant this tool CHECKS AGAINST ITS OWN SOURCE on every run (`selfSourceAudit`) and fails
// on. That is a real check, and it is weaker than a sandbox; both facts are reported.
//
// AND THE HISTORY OF THE SHAPE THIS FOLLOWS. `tools/quests/mainline-chain-floor.mjs` is the model
// for this walk, INCLUDING its first version's defect, which is the reason the model is worth
// following. That version called
//     H.spawnNPC({ from_record: giver, pos: [0, 0, 2] })
// on a standing refusal — it conjured the giver it was testing for — and 40 of 40 signatures then
// completed both chains in a world where nine of ninety-four givers existed. The honest
// replacement is `H.travelToGiver(id)`, which runs the world's own `populateSettlement` /
// `populateSite` and returns `present: false` when the person's record names no place at all.
// This walk uses `travelToGiver`, `spawnNPC` is on the denied list, and a giver who is not there
// stops the walk exactly where a player would be stopped.
//
// WHAT THIS WALK DOES NOT MEASURE, said before any number is printed:
//
//   * RI-CHR01 §5 criterion 4, `tier5_survivable`, is NOT WALKED. Surviving a danger-tier-5 fight
//     is a combat measurement that needs a driven fight, and a walk that scored it off a damage
//     model would be doing the exact thing this tool exists to stop. Every artifact carries
//     `criteria_not_walked: ["tier5_survivable"]` and every verdict field is named for the
//     criteria it did walk. There is no field on this artifact that claims a character is viable
//     full stop, because this tool did not measure that.
//   * THE WHOLE GRID. 540 cells (10 races x 6 class families x 3 birthsign families x 3
//     upbringing classes) over 5,040 concrete characters is not affordable as a played walk. The
//     sample is stratified and the coverage table is computed and printed, not asserted. See
//     `buildSample()`.
//
// A NARROW HONEST NUMBER AND A WIDE LABELLED SCREEN BEAT ONE WIDE NUMBER THAT HAS BEEN WRONG
// FIVE TIMES.
//
// USAGE
//   node tools/quests/viability-walk.mjs [--out <dir>] [--json] [--sample N]
//                                        [--sabotage no-bootstrap|hand-feed|grant-everything]
//                                        [--falsify grant-fence|source-audit]
//
//   --sabotage no-bootstrap      skip the one world action the walk is allowed (greeting a carter
//                                on the Soulrest quay). Nothing supplies the opening topic, so
//                                every signature must stop at the first main-quest gate. If
//                                completion does NOT collapse, the walk is being carried by
//                                something it has not declared.
//   --sabotage hand-feed         call `learnTopic()` before every gate, the way the round-1
//                                mainline tools did. This is a GRANT, so it can only run with the
//                                fence lowered, and the artifact is stamped `granted_nothing:
//                                false` and cannot exit 0. If completion IMPROVES, the world's own
//                                AddTopic edges are not carrying the chain.
//   --sabotage grant-everything  the instrument's own headline control, and the ruling's claim
//                                made falsifiable: hand the character the things five rounds of
//                                the static tool handed it — gold, skills, attributes, faction
//                                standing, world flags — and re-walk. If the result does NOT move,
//                                then the grants never mattered and the whole rename was a waste;
//                                if it moves a long way, that distance is the size of the fiction
//                                the screen is still living in. Either way it is a measurement
//                                rather than an argument.
//
//   --falsify grant-fence        call a denied verb through the facade and require it to throw.
//   --falsify source-audit       corrupt the source invariant in memory and require the audit to
//                                go red. A check that cannot fail is worse than no check.
// =============================================================================================
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
viability-walk.mjs — viability measured by playing, from a cold start, granted nothing.

USAGE
  node tools/quests/viability-walk.mjs [--out <dir>] [--json] [--sample N]
                                       [--sabotage no-bootstrap|hand-feed|grant-everything]
                                       [--falsify grant-fence|source-audit]

  This tool walks a STRATIFIED SAMPLE and says so. It does not walk criterion 4
  (tier5_survivable) at all. See the header of this file for both, at length.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-VIABILITY-WALK');
const sabotage = args.sabotage ? String(args.sabotage) : null;
if (sabotage && !['no-bootstrap', 'hand-feed', 'grant-everything'].includes(sabotage)) usage(USAGE);
const falsify = args.falsify ? String(args.falsify) : null;
if (falsify && !['grant-fence', 'source-audit'].includes(falsify)) usage(USAGE);
const SAMPLE_N = Number.isFinite(Number(args.sample)) ? Number(args.sample) : 40;
const MAX_ROUNDS = Number.isFinite(Number(args['max-rounds'])) ? Number(args['max-rounds']) : 6;

const SELF = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SELF), '..', '..');

// =============================================================================================
// THE ALLOW-LIST AND THE DENY-LIST.
//
// Deny-by-default: the facade carries the allowed verbs and nothing else, so a verb nobody
// thought about is simply absent rather than silently available. The deny list is separate and
// explicit ON TOP of that, because "absent" and "refused" read differently in a stack trace and
// because the refusal message is the place to say WHY a verb is a grant.
//
// A verb is a GRANT if it moves the character or the world to a state the character did not
// reach by playing. A verb is an ACTION if a player at a keyboard could cause it. `setCharacter`
// is neither: it is CREATION, it happens exactly once before play, and the fence counts its
// calls and refuses a second one per signature.
// =============================================================================================
const ALLOWED_VERBS = [
  // creation and the cold start
  'ready', 'setRenderRate', 'setSeed', 'loadState', 'setCharacter',
  // observation only
  'getQuestState', 'questOffers', 'questDef', 'questResolutions', 'questBook',
  'questWorldFlags', 'getGold', 'factionGates', 'getGateDispositions', 'getCharacter',
  'getSkills', 'getPlayerStats', 'whereAmI', 'listNPCs',
  // things a player does
  'travelToGiver', 'questOpen', 'questResolve',
  'talkTo', 'conversationSay', 'conversationPersuade', 'conversationClose',
];
const DENIED_VERBS = {
  setGold: 'a purse the character did not earn (five rounds of the static tool granted gold; the last of them as a sum over every reward in the book at once)',
  setSkills: 'skills the character did not train',
  setAttributes: 'attributes the character did not level',
  setMagicSkills: 'skills the character did not train',
  setWillpower: 'a stat the character did not level',
  setFactionStanding: 'standing the character did not earn — this is W1-FACTIONS round 1\'s exact failure',
  setFactionStandings: 'standing the character did not earn',
  syncFactionStandings: 'standing the character did not earn',
  questSetFlag: 'a world flag no play produced — literally the rank-7 poke that made "rank 7 reached" and "walked without killing" true separately and never together',
  setWorldKnowledge: 'knowledge nobody taught the character',
  learnTopic: 'a topic nobody said out loud — RI-MTH07\'s hand-feed failure',
  grantSkillUse: 'skill progress the character did not use anything to get',
  spawnNPC: 'a person the world does not contain — mainline-chain-floor round 1 conjured the giver it was testing for',
  spawnCivilian: 'a person the world does not contain',
  populateSettlement: 'use travelToGiver, which is the world\'s own call and can return present:false',
  populateSite: 'use travelToGiver, which is the world\'s own call and can return present:false',
  setDisposition: 'a feeling the character did not earn',
  setAttuned: 'an attunement the character did not make',
  setLoadout: 'equipment the character did not acquire',
  teleport: 'travel the character did not make — use travelToGiver',
  questFail: 'an outcome the walk chose rather than played',
  questPresenceGate: 'turning off the check that the giver is actually there',
  questReveal: 'foreknowledge nothing in the world can produce. `QuestEngine.reveal()` is the ONLY '
    + 'writer of a `know:` flag, and its only non-harness caller is a `hooks.json` row carrying a '
    + 'quest+reveal pair — of which this tree ships ZERO of 18. So every call to it is the '
    + 'instrument handing the character a fact no play yields',
  questNote: 'journal progress the walk decided rather than played. A journal index advances '
    + 'because something happened in the world; setting it by number is the walk asserting the '
    + 'thing it is supposed to be measuring',
};

// THE DIRECTION OF THIS TOOL'S ERROR, stated once and carried on every artifact.
//
// Refusing `questReveal` and `questNote` costs reach: a resolution gated on a reveal is
// unreachable to this walk, and so is one gated on a journal index. Both refusals are deliberate
// and both push the same way — THIS WALK UNDER-CLAIMS. Where the screen's grants make its
// positives worthless, the walk's refusals make its negatives soft: a signature this walk could
// not carry to the end might still be carryable by a player through a channel the walk declines
// to use. That asymmetry is the point. An instrument that under-claims cannot manufacture a false
// green, which is the failure five rounds of the static tool kept producing.
const WALK_UNDERCLAIMS = [
  'questReveal is refused, so any resolution gated on a `know:` flag is unreachable here. On this '
  + 'tree that is not a loss of realism: 0 of 18 shipped hooks.json rows carry a quest+reveal pair, '
  + 'so no play produces one either — but the walk would report the same stop even if one did.',
  'questNote is refused, so any resolution gated on a journal index the walk did not reach by '
  + 'completing quests is unreachable here.',
  'the walk takes the first non-violent available resolution, then any available one. It does not '
  + 'search for the resolution that would open the most later quests, so a signature that stops '
  + 'may have been carryable by a different (still legitimate) choice.',
];

// =============================================================================================
// selfSourceAudit — the invariant that makes the grant fence mean anything.
//
// A facade only fences the code that goes through it. This tool therefore asserts, against its
// own bytes, that there is no second door: `window.__HARNESS` is read exactly once (to build the
// facade) and `window.__ENGINE` — which `main.js` publishes and which INDEX.md records as a way
// around harness-level prohibitions — is never named at all.
//
// The counts are of the SOURCE TEXT, which includes this comment, so the strings are assembled
// rather than written out. That is not obfuscation; it is the only way a file can count its own
// mentions of a token without the counting changing the answer.
// =============================================================================================
function selfSourceAudit(sourceText) {
  const HARNESS_TOKEN = '__' + 'HARNESS';
  const ENGINE_TOKEN = '__' + 'ENGINE';
  // Comment-only lines are excluded, so the header above can name both doors as many times as it
  // needs to explain them. A token on a line that ALSO carries code still counts: the rule is
  // "code that mentions it", not "text that does not look like a comment". This is deliberately
  // the conservative direction — hiding a back door after a semicolon does not get past it.
  const code = sourceText.split('\n')
    .filter((ln) => { const t = ln.trim(); return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')); })
    .join('\n');
  const harness = code.split(HARNESS_TOKEN).length - 1;
  const engine = code.split(ENGINE_TOKEN).length - 1;
  const problems = [];
  if (harness !== 1) problems.push(`window.${HARNESS_TOKEN} is named ${harness} time(s); the facade is built from exactly one read and every other reference is a way round the grant fence`);
  if (engine !== 0) problems.push(`window.${ENGINE_TOKEN} is named ${engine} time(s); it is the documented back door around harness prohibitions (INDEX.md) and this tool must not touch it`);
  return { ok: problems.length === 0, harness_mentions: harness, engine_mentions: engine, problems };
}

// =============================================================================================
// buildSample — THE STRATIFIED SAMPLE, and the honest statement of what it is not.
//
// The concrete character space shipped in game/data/progression is
//   10 races x 14 classes x 9 birthsigns x 4 upbringings = 5,040 characters,
// which projects onto RI-CHR01's 540-cell grid (10 x 6 class families x 3 sign families x 3
// upbringing signature classes). A played walk over either is not affordable, so:
//
//   THE SAMPLE IS THE COMPLETE race x upbringing GRID — all 10 x 4 = 40 — with class and
//   birthsign assigned by co-prime rotation over the shipped lists.
//
// race x upbringing is complete on purpose rather than by budget: those two axes are the input to
// `derivedDisposition()`, and disposition is what the quest offer gates actually read, so it is
// the pair most likely to make a gate bite differently. Class and birthsign rotate, which gives
// every one of the 14 classes and all 9 birthsigns at least two appearances and covers every
// class-family x sign-family pair, but does NOT cover the 126 concrete class x birthsign pairs.
//
// WHAT THIS IS NOT: it is not the grid, it is not a random sample, and it carries no confidence
// interval. 40 of 5,040 concrete characters is 0.79%. Coverage is COMPUTED below and printed;
// nothing here is asserted. `--sample N` widens or narrows it and the coverage table moves with
// it, which is how a reader can tell the claim is measured rather than declared.
// =============================================================================================
function buildSample(prog, n) {
  const races = prog.races.races.map((r) => r.id);
  const classes = prog.classes.classes.map((c) => ({ id: c.id, family: c.family }));
  const signs = prog.birthsigns.signs.map((s) => ({ id: s.id, family: s.family }));
  const ups = prog.reactions.upbringings.map((u) => ({ id: u.id, cls: u.signature_class }));

  const rows = [];
  const total = races.length * ups.length;
  const want = Math.max(1, Math.min(n, total));
  let k = 0;
  for (const up of ups) {
    for (const race of races) {
      if (rows.length >= want) break;
      // Co-prime strides so class and birthsign do not lock in phase with race or upbringing.
      const c = classes[(k * 3) % classes.length];
      const s = signs[(k * 5) % signs.length];
      rows.push({
        race, upbringing: up.id, upbringing_class: up.cls,
        class_id: c.id, class_family: c.family,
        birthsign: s.id, birthsign_family: s.family,
        cell: `${race}/${c.family}/${s.family}/${up.cls}`,
      });
      k++;
    }
  }

  // Coverage, computed off the rows that were actually built.
  const cov = (key, universe) => {
    const seen = new Set(rows.map((r) => r[key]));
    return { covered: seen.size, of: universe.length, missing: universe.filter((u) => !seen.has(u)).sort() };
  };
  const pairs = (a, b, ua, ub) => {
    const seen = new Set(rows.map((r) => `${r[a]}|${r[b]}`));
    const all = [];
    for (const x of ua) for (const y of ub) all.push(`${x}|${y}`);
    return { covered: seen.size, of: all.length, missing_examples: all.filter((p) => !seen.has(p)).slice(0, 8) };
  };
  const famsC = [...new Set(classes.map((c) => c.family))];
  const famsS = [...new Set(signs.map((s) => s.family))];
  const coverage = {
    rows: rows.length,
    concrete_space: races.length * classes.length * signs.length * ups.length,
    grid_cells_540: races.length * famsC.length * famsS.length * [...new Set(ups.map((u) => u.cls))].length,
    distinct_grid_cells_hit: new Set(rows.map((r) => r.cell)).size,
    race: cov('race', races),
    upbringing: cov('upbringing', ups.map((u) => u.id)),
    class_id: cov('class_id', classes.map((c) => c.id)),
    birthsign: cov('birthsign', signs.map((s) => s.id)),
    pair_race_x_upbringing: pairs('race', 'upbringing', races, ups.map((u) => u.id)),
    pair_classfamily_x_signfamily: pairs('class_family', 'birthsign_family', famsC, famsS),
    pair_class_x_birthsign_NOT_COVERED: pairs('class_id', 'birthsign', classes.map((c) => c.id), signs.map((s) => s.id)),
  };
  return { rows, coverage };
}

// ---------------------------------------------------------------------------------------------
// Node side: read the shipped tables, build the sample, run the audits, drive the browser.
// ---------------------------------------------------------------------------------------------
const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, 'game/data', p), 'utf8'));
const prog = {
  races: rd('progression/races.json'),
  classes: rd('progression/classes.json'),
  birthsigns: rd('progression/birthsigns.json'),
  reactions: rd('progression/race-reactions.json'),
};
const { rows: SAMPLE, coverage: COVERAGE } = buildSample(prog, SAMPLE_N);

let sourceText = fs.readFileSync(SELF, 'utf8');
if (falsify === 'source-audit') {
  // The audit's own falsifier: plant a second door in the text the audit reads and require it to
  // go red. Nothing on disk is touched.
  const audit = selfSourceAudit(sourceText + '\nconst backdoor = window.' + '__' + 'ENGINE;\n');
  const clean = selfSourceAudit(sourceText);
  const ok = !audit.ok && clean.ok;
  process.stdout.write(`--falsify source-audit: planted back door -> ${audit.ok ? 'AUDIT STAYED GREEN (BAD)' : 'audit RED, as required'}\n`);
  process.stdout.write(`                        clean source      -> ${clean.ok ? 'audit green, as required' : `AUDIT RED ON A CLEAN FILE (BAD): ${clean.problems.join('; ')}`}\n`);
  process.stdout.write(ok ? 'source audit is falsifiable and is green on this file.\n' : 'SOURCE AUDIT IS NOT SOUND.\n');
  process.exit(ok ? 0 : 1);
}
const SOURCE_AUDIT = selfSourceAudit(sourceText);
if (!SOURCE_AUDIT.ok) {
  process.stderr.write(`[viability-walk] SOURCE AUDIT FAILED — the grant fence has a second door:\n`);
  for (const p of SOURCE_AUDIT.problems) process.stderr.write(`  ${p}\n`);
  process.exit(1);
}

// The main quest, read from the shipped book so the walk can say whether it FINISHED rather than
// only how many quests it happened to close.
const mainline = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/quests/mainline.json'), 'utf8'));
const MAIN_CHAIN = [...mainline.acts.flatMap((a) => a.quests), ...mainline.aftermath.quests];

// quest id -> { resolution id -> true when it demands NOTHING }. The cheapest-ending trap, made
// countable. Read from the shipped book because the harness's quest view does not carry
// resolution requirements; nothing here decides what the character may do.
const FREE_ENDINGS = (() => {
  const dir = path.join(REPO, 'game/data/quests');
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f === 'hooks.json') continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const q of doc.quests || []) {
      out[q.id] = {};
      for (const r of q.resolutions || []) out[q.id][r.id] = Object.keys(r.requires || {}).length === 0;
    }
  }
  return out;
})();

const STATE = 'soulrest-quay';
const BOOTSTRAP_NPC = 'bone-ladder-carter';

ensureDir(outDir);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 1800000) });
let report;
try {
  report = await handle.page.evaluate(async (IN) => {
    const {
      sample, sabotage, falsify, STATE, BOOTSTRAP_NPC, MAIN_CHAIN, MAX_ROUNDS,
      ALLOWED_VERBS, DENIED_VERBS, freeEndings,
    } = IN;

    // ---- THE GRANT FENCE ---------------------------------------------------------------------
    // The one and only read of the harness in this file. Everything below holds `H`, which is a
    // facade: the allow-listed verbs, tallied, plus the denied verbs as throwing stubs.
    const RAW = window.__HARNESS;
    await RAW.ready();

    const tally = {};
    const denials = [];
    const missingVerbs = [];
    let fenceLowered = false;             // only --sabotage grant-everything / hand-feed lowers it
    const grantsUsed = [];

    const H = {};
    for (const verb of ALLOWED_VERBS) {
      if (typeof RAW[verb] !== 'function') { missingVerbs.push(verb); continue; }
      H[verb] = (...a) => { tally[verb] = (tally[verb] || 0) + 1; return RAW[verb](...a); };
    }
    for (const [verb, why] of Object.entries(DENIED_VERBS)) {
      H[verb] = (...a) => {
        if (fenceLowered && typeof RAW[verb] === 'function') {
          grantsUsed.push(verb);
          tally[`GRANTED:${verb}`] = (tally[`GRANTED:${verb}`] || 0) + 1;
          return RAW[verb](...a);
        }
        denials.push(verb);
        throw new Error(`grant fence: ${verb}() is a GRANT, not a play — ${why}. This walk is granted nothing.`);
      };
    }

    if (falsify === 'grant-fence') {
      const probes = ['setGold', 'questSetFlag', 'learnTopic', 'spawnNPC', 'setFactionStanding', 'questReveal', 'questNote'];
      const out = [];
      for (const v of probes) {
        let threw = null;
        try { H[v](v === 'setGold' ? 999999 : 'Q-MAIN-06', 1); } catch (e) { threw = String(e.message || e); }
        out.push({ verb: v, refused: !!threw, message: threw });
      }
      // The green control: an allow-listed observation must NOT throw.
      let controlOk = true, controlErr = null;
      try { H.getQuestState(); } catch (e) { controlOk = false; controlErr = String(e.message || e); }
      return { falsify: 'grant-fence', probes: out, control_allowed_verb_works: controlOk, control_error: controlErr };
    }

    // ---- helpers -----------------------------------------------------------------------------
    const ranksNow = () => {
      const g = H.factionGates();
      if (!g || !g.factions) return {};
      const out = {};
      for (const f of g.factions) out[f.id] = f.derived_rank || 0;
      return out;
    };

    /**
     * A resolution that demands nothing at all is the "cheapest ending" W1-FACTIONS round 1 took
     * at every rank. It is a legitimate play — refusing is a real choice — but a walk that
     * finished the book entirely on free endings has measured something other than the gates,
     * so each one is counted and reported.
     */
    // `H.questDef()` deliberately does not expose resolutions, so the requirement shape comes
    // from the shipped book, read on the Node side and passed in. That is reading the paperwork
    // to know WHAT TO LOOK AT; every decision about what the character may do is still the
    // engine's, through `questResolutions` and `questResolve`.
    const isFreeEnding = (id, resId) => {
      const q = freeEndings[id];
      return q ? !!q[resId] : null;
    };

    const playOne = (row) => {
      const out = {
        ...row,
        completed: [], refused: [], violent: [], free_endings: [], giver_absent: [], reveals_refused: [],
        main_chain_completed: 0, main_chain_length: MAIN_CHAIN.length,
        rounds_used: 0, gold_start: null, gold_end: null,
        ranks_start: null, ranks_end: null, persuasion: [],
      };

      // ---- COLD START. setSeed / loadState / setCharacter, and nothing else. -----------------
      H.setSeed(1337);
      H.loadState(STATE);
      H.setRenderRate(0);
      H.setCharacter({
        race: row.race, upbringing: row.upbringing, class: row.class_id, birthsign: row.birthsign,
      });
      out.gold_start = H.getGold ? H.getGold() : null;
      out.ranks_start = ranksNow();

      // ---- THE GRANTS, only under --sabotage grant-everything -------------------------------
      // The ruling's claim, made falsifiable. These are the five things the static screen still
      // hands its synthetic character. If handing them to a REAL character does not move the
      // walk, the screen's fictions were harmless and this whole split was unnecessary.
      if (sabotage === 'grant-everything') {
        fenceLowered = true;
        try { H.setGold(1000000); } catch (e) { out.grant_error = String(e.message || e); }
        try { H.setAttributes({ strength: 100, endurance: 100, agility: 100, intelligence: 100, willpower: 100, personality: 100, speed: 100, luck: 100 }); } catch (e) { /* shape may differ */ }
        try { H.setSkills({}); } catch (e) { /* shape may differ */ }
        try {
          const g = H.factionGates();
          for (const f of (g.factions || [])) H.setFactionStanding(f.id, { member: true, rank: 7, reputation: 9999 });
        } catch (e) { /* refused shapes are recorded by the tally */ }
        try {
          // Every world flag every resolution anywhere produces, all true at once — the screen's
          // `worldFlags` union, 601 of whose members are contested with each other.
          for (const id of H.questBook()) {
            const def = H.questDef(id);
            for (const r of (def.resolutions || [])) {
              for (const fl of (((r.consequences || {}).world_flags) || [])) H.questSetFlag(fl, true);
            }
          }
        } catch (e) { /* recorded by the tally */ }
        fenceLowered = false;
      }

      // ---- THE ONE WORLD ACTION: walk up to a carter and be greeted. ------------------------
      const boot = { topics_before: H.getQuestState().topicsKnown.length };
      if (sabotage !== 'no-bootstrap') {
        try { H.talkTo(BOOTSTRAP_NPC); H.conversationClose(); } catch (e) { out.bootstrap_error = String(e.message || e); }
      }
      boot.topics_after = H.getQuestState().topicsKnown.length;
      out.bootstrap = boot;

      // ---- PLAY. Greedy rounds: everything the world will offer, until nothing new opens. ----
      const done = new Set();
      for (let round = 0; round < MAX_ROUNDS; round++) {
        out.rounds_used = round + 1;
        let progressed = false;
        const offers = H.questOffers();
        if (!Array.isArray(offers)) { out.no_quest_runtime = offers; break; }
        for (const off of offers) {
          if (done.has(off.id)) continue;
          // COST, AND WHY THIS FILTER IS NOT A SHORTCUT PAST A GATE. `travelToGiver` runs the
          // world's own populateSettlement/populateSite, so walking to all ~120 givers on every
          // round for every signature is tens of thousands of settlement populations and the run
          // does not finish. A quest the shipping `canOffer` refuses is not opened by walking to
          // the person: `open()` asks the same predicate again. The ONE exception is a refusal
          // that is purely about how the giver feels, because that is the one a player can stand
          // there and change — so those are still visited and still argued with. Everything else
          // is recorded with the shipping predicate's own reason and left for the next round,
          // when a completed quest may have moved it.
          const whys = Array.isArray(off.why) ? off.why : [];
          const persuadable = whys.length > 0 && whys.every((w) => / disposition -?\d+(\.\d+)?\/-?\d/.test(String(w)));
          if (!off.offerable && !persuadable) continue;

          if (sabotage === 'hand-feed') {
            fenceLowered = true;
            try {
              const def = H.questDef(off.id);
              const ob = def.opens_by || {};
              if (ob.topic) H.learnTopic(ob.topic);
              for (const t of (ob.prerequisite_topics || [])) H.learnTopic(t);
            } catch (e) { /* recorded by the tally */ }
            fenceLowered = false;
          }

          // Go to where the giver lives, the world's own way. present:false is a real stop.
          let trip = null;
          try { trip = H.travelToGiver(off.id); } catch (e) { trip = { present: false, why: String(e.message || e) }; }
          if (trip && !trip.present) out.giver_absent.push({ quest: off.id, why: trip.why });

          let o;
          try { o = H.questOpen(off.id); } catch (e) { o = { ok: false, reason: String(e.message || e) }; }

          // Refused on standing? Do what a player does: stand there and talk them round, with
          // the character's OWN purse. No purse is granted; if they cannot pay, they cannot pay.
          if (!o.ok && /disposition \d/.test(String(o.reason || ''))) {
            const giver = trip && trip.giver;
            if (giver) {
              try {
                H.talkTo(giver);
                const att = { quest: off.id, npc: giver, tries: [] };
                for (let k = 0; k < 6 && !o.ok; k++) {
                  const gold = H.getGold ? H.getGold() : 0;
                  const verb = gold >= 1000 ? 'bribe1000' : gold >= 100 ? 'bribe100' : gold >= 10 ? 'bribe10' : 'admire';
                  const r = H.conversationPersuade(verb);
                  att.tries.push({ verb, success: !!r.success, gold_left: r.gold_left });
                  o = H.questOpen(off.id);
                }
                att.opened = o.ok;
                out.persuasion.push(att);
                H.conversationClose();
              } catch (e) { /* the conversation refused; recorded by the refusal below */ }
            }
          }

          if (!o.ok) { continue; }   // not a permanent verdict: a later round may open it

          // NO REVEALS AND NO JOURNAL POKES. An earlier version of this loop called
          // `questReveal` for every id in the quest's `deceit.revealed_by` and `questNote` for
          // every active journal index. Both were wrong twice over. They were SILENT NO-OPS —
          // `H.questDef()` returns a curated view with no `deceit`, `journal` or `resolutions` on
          // it, so the loop iterated `undefined` and the tool reported `free_endings: 0` as a
          // vacuous zero. And had they worked they would have been GRANTS: `reveal()` has no
          // world-side caller on this tree at all. Both verbs are on the deny list now, so the
          // fence refuses them rather than this loop remembering not to call them.

          let avail = [];
          try { avail = H.questResolutions(off.id); } catch (e) { avail = []; }
          const pick = avail.find((a) => a.available && a.violence_required === false)
                    || avail.find((a) => a.available);
          if (!pick) {
            out.refused.push({ quest: off.id, gate: 'resolution', why: avail.map((a) => `${a.id}: ${(a.why || []).join('; ')}`).join(' | ').slice(0, 300) });
            done.add(off.id);
            continue;
          }
          let res;
          try { res = H.questResolve(off.id, pick.id); } catch (e) { res = { ok: false, reason: String(e.message || e) }; }
          if (!res.ok) {
            out.refused.push({ quest: off.id, gate: 'resolve', why: String(res.reason).slice(0, 300) });
            done.add(off.id);
            continue;
          }
          if (pick.violence_required) out.violent.push(off.id);
          if (isFreeEnding(off.id, pick.id)) out.free_endings.push(`${off.id}:${pick.id}`);
          out.completed.push(off.id);
          done.add(off.id);
          progressed = true;
        }
        if (!progressed) break;
      }

      // ---- what the world says at the end ----------------------------------------------------
      const qs = H.getQuestState();
      out.gold_end = H.getGold ? H.getGold() : null;
      out.ranks_end = ranksNow();
      out.topics_known = (qs.topicsKnown || []).length;
      out.journal_n = (qs.journal || []).length;
      const completedSet = new Set(out.completed);
      out.main_chain_completed = MAIN_CHAIN.filter((q) => completedSet.has(q)).length;
      out.main_quest_finished = out.main_chain_completed === MAIN_CHAIN.length;
      out.main_chain_first_missing = MAIN_CHAIN.find((q) => !completedSet.has(q)) || null;
      out.factions_at_rank_5 = Object.values(out.ranks_end).filter((r) => r >= 5).length;
      // The still-unoffered quests and the gate that is holding each one. This is the product:
      // what a real character, having played everything it could, is still shut out of.
      const finalOffers = H.questOffers();
      out.still_shut_out = (Array.isArray(finalOffers) ? finalOffers : [])
        .filter((o) => !completedSet.has(o.id) && !o.offerable)
        .map((o) => ({ quest: o.id, gate: o.gate || null, why: String(o.why || '').slice(0, 220) }));
      return out;
    };

    // The driver is installed rather than run, so Node can call it ONE SIGNATURE AT A TIME and
    // print progress. A single 40-signature `evaluate` is a black box: the first version of this
    // tool ran for twenty-five minutes with nothing on stdout and no way to tell slow from hung,
    // which is exactly the state RULES.md rule 26 is about.
    window.__vwalk = {
      playOne,
      summary: () => ({
        schema: 'elder-souls/viability-walk@1',
        harness_version: RAW.version,
        harness_calls: tally,
        denied_calls: denials,
        allowed_verbs_missing_from_harness: missingVerbs,
        grants_used: grantsUsed,
      }),
    };
    return { installed: true, missing_verbs: missingVerbs };
  }, {
    sample: SAMPLE, sabotage, falsify, STATE, BOOTSTRAP_NPC, MAIN_CHAIN, MAX_ROUNDS,
    ALLOWED_VERBS, DENIED_VERBS, freeEndings: FREE_ENDINGS,
  });

  if (falsify !== 'grant-fence') {
    const rows = [];
    const t0 = Date.now();
    for (let i = 0; i < SAMPLE.length; i++) {
      const r = await handle.page.evaluate((row) => window.__vwalk.playOne(row), SAMPLE[i]);
      rows.push(r);
      const el = (Date.now() - t0) / 1000;
      process.stderr.write(
        `[viability-walk] ${String(i + 1).padStart(3)}/${SAMPLE.length} ${SAMPLE[i].race}/${SAMPLE[i].upbringing} `
        + `completed ${String(r.completed.length).padStart(3)} quests, main ${r.main_chain_completed}/${r.main_chain_length}`
        + `${r.main_chain_first_missing ? ' (stops at ' + r.main_chain_first_missing + ')' : ''} `
        + `— ${el.toFixed(0)}s elapsed, ~${(el / (i + 1) * (SAMPLE.length - i - 1)).toFixed(0)}s left\n`);
    }
    const meta = await handle.page.evaluate(() => window.__vwalk.summary());
    report = { ...meta, rows };
  }
} finally { await handle.close(); }

// ---------------------------------------------------------------------------------------------
// --falsify grant-fence: report and exit. The instrument is calibrated in BOTH directions —
// every denied verb must throw, and an allowed verb must not.
// ---------------------------------------------------------------------------------------------
if (falsify === 'grant-fence') {
  const bad = report.probes.filter((p) => !p.refused);
  process.stdout.write(`\n--falsify grant-fence — ${report.probes.length - bad.length}/${report.probes.length} denied verbs refused\n`);
  for (const p of report.probes) {
    process.stdout.write(`  ${p.refused ? 'ok  ' : 'FAIL'} ${p.verb}() ${p.refused ? '-> ' + String(p.message).slice(0, 120) : '-> DID NOT THROW; the walk can grant itself this'}\n`);
  }
  process.stdout.write(`  ${report.control_allowed_verb_works ? 'ok  ' : 'FAIL'} [GREEN CONTROL] getQuestState() is allowed and works${report.control_allowed_verb_works ? '' : ` -> ${report.control_error}`}\n`);
  const ok = bad.length === 0 && report.control_allowed_verb_works;
  process.stdout.write(ok ? '\nThe grant fence refuses every grant and passes every play.\n' : '\nGRANT FENCE IS NOT SOUND.\n');
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
// Reduce.
// ---------------------------------------------------------------------------------------------
const rows = report.rows;
const grantedNothing = report.grants_used.length === 0 && !sabotage;
const finishedMain = rows.filter((r) => r.main_quest_finished).length;
const threeAtFive = rows.filter((r) => r.factions_at_rank_5 >= 3).length;
const bothGateCriteria = rows.filter((r) => r.main_quest_finished && r.factions_at_rank_5 >= 3).length;

// WHERE THE MAIN QUEST STOPS, and where the reason for it lives. The first version of this
// reduce looked only in `still_shut_out`, which holds the quests the offer gate never offered.
// The whole sampled grid stops on a quest that WAS offered and then had no resolution the
// character could take, so every stop printed with an empty reason while the artifact underneath
// carried it in `refused`. A headline that drops the cause is the failure this project keeps
// finding in other people's tools.
const stopTally = new Map();
for (const r of rows) {
  const s = r.main_chain_first_missing;
  if (!s) continue;
  const ref = r.refused.find((x) => x.quest === s);
  const shut = r.still_shut_out.find((x) => x.quest === s);
  const key = ref
    ? `${s} [offered, then ${ref.gate}] — ${ref.why}`
    : `${s} [${shut ? 'not offered' : 'never reached'}] — ${shut ? shut.why : 'the chain stopped earlier'}`;
  stopTally.set(key, (stopTally.get(key) || 0) + 1);
}
const revealsRefused = new Map();
for (const r of rows) for (const rr of r.reveals_refused) {
  const k = `${rr.quest}:${rr.reveal} — ${rr.why}`;
  revealsRefused.set(k, (revealsRefused.get(k) || 0) + 1);
}

const out = {
  tool: 'tools/quests/viability-walk.mjs',
  schema: 'elder-souls/viability-walk@1',
  measured_at: new Date().toISOString(),
  sabotage,
  // ---- THE HONESTY BLOCK. It is first because it conditions every number under it. ----------
  what_this_is:
    'Viability measured by PLAYING: each character is created at a cold start and then driven '
    + 'through the shipping quest gates with nothing granted to it. It walks a STRATIFIED SAMPLE, '
    + 'not the grid, and it does NOT walk RI-CHR01 criterion 4 (tier5_survivable) at all. Every '
    + 'verdict field below is named for the criteria it walked; there is no field that says a '
    + 'character is viable full stop, because this run did not measure that.',
  criteria_walked: ['main_quest', 'three_factions_rank5', 'gates_actually_refused'],
  criteria_not_walked: ['tier5_survivable'],
  this_walk_under_claims: WALK_UNDERCLAIMS,
  criteria_not_walked_why:
    'surviving a danger-tier-5 fight needs a driven fight; scoring it off a damage model is the '
    + 'class of substitution this instrument exists to remove.',
  granted_nothing: grantedNothing,
  grant_fence: {
    allowed_verbs: ALLOWED_VERBS,
    denied_verbs: Object.keys(DENIED_VERBS),
    denied_calls_attempted: report.denied_calls,
    grants_actually_used: report.grants_used,
    allowed_verbs_missing_from_harness: report.allowed_verbs_missing_from_harness,
    scope: 'this tool\'s own code path. window.__' + 'ENGINE is a documented back door around '
      + 'harness prohibitions (INDEX.md) and a facade cannot close it; what closes it here is the '
      + 'source audit below, which is a weaker guarantee than a sandbox and is reported as one.',
  },
  source_audit: SOURCE_AUDIT,
  sample: { requested: SAMPLE_N, walked: rows.length, coverage: COVERAGE },
  harness_calls: report.harness_calls,
  harness_version: report.harness_version,
  // ---- THE RESULT ---------------------------------------------------------------------------
  played: {
    signatures: rows.length,
    finished_the_main_quest: finishedMain,
    reached_three_factions_at_rank_5: threeAtFive,
    passed_both_walked_gate_criteria: bothGateCriteria,
    main_chain_length: MAIN_CHAIN.length,
    median_main_chain_completed: (() => {
      const v = rows.map((r) => r.main_chain_completed).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : null;
    })(),
    quests_completed_min: Math.min(...rows.map((r) => r.completed.length)),
    quests_completed_max: Math.max(...rows.map((r) => r.completed.length)),
    free_endings_taken: rows.reduce((n, r) => n + r.free_endings.length, 0),
    violent_resolutions_taken: rows.reduce((n, r) => n + r.violent.length, 0),
    givers_not_in_the_world: [...new Set(rows.flatMap((r) => r.giver_absent.map((g) => g.quest)))],
  },
  reveals_refused: [...revealsRefused].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([why, n]) => ({ signatures: n, reveal: why })),
  where_the_main_quest_stops: [...stopTally].sort((a, b) => b[1] - a[1]).map(([why, n]) => ({ signatures: n, stop: why })),
  rows,
};

const artifact = path.join(outDir, `viability-walk${sabotage ? '-' + sabotage : ''}.json`);
writeJson(artifact, out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nviability-walk — ${rows.length} signatures PLAYED from a cold start${sabotage ? `  [SABOTAGE ${sabotage}]` : ''}`);
  console.log(`  granted nothing: ${grantedNothing}${report.grants_used.length ? `  (GRANTS USED: ${[...new Set(report.grants_used)].join(', ')})` : ''}`);
  console.log(`  sample: ${rows.length} of ${COVERAGE.concrete_space} concrete characters (${(100 * rows.length / COVERAGE.concrete_space).toFixed(2)}%), `
            + `${COVERAGE.distinct_grid_cells_hit} of ${COVERAGE.grid_cells_540} RI-CHR01 grid cells`);
  console.log(`          race ${COVERAGE.race.covered}/${COVERAGE.race.of}, upbringing ${COVERAGE.upbringing.covered}/${COVERAGE.upbringing.of}, `
            + `class ${COVERAGE.class_id.covered}/${COVERAGE.class_id.of}, birthsign ${COVERAGE.birthsign.covered}/${COVERAGE.birthsign.of}`);
  console.log(`          race x upbringing ${COVERAGE.pair_race_x_upbringing.covered}/${COVERAGE.pair_race_x_upbringing.of} (complete by design), `
            + `class x birthsign ${COVERAGE.pair_class_x_birthsign_NOT_COVERED.covered}/${COVERAGE.pair_class_x_birthsign_NOT_COVERED.of} (NOT a design goal)`);
  console.log(`  NOT WALKED: tier5_survivable — ${out.criteria_not_walked_why}`);
  for (const u of WALK_UNDERCLAIMS) console.log(`  UNDER-CLAIMS: ${u}`);
  console.log('');
  console.log(`  finished the main quest                ${finishedMain}/${rows.length}   (chain is ${MAIN_CHAIN.length} quests)`);
  console.log(`  reached three factions at rank 5       ${threeAtFive}/${rows.length}`);
  console.log(`  passed BOTH walked gate criteria       ${bothGateCriteria}/${rows.length}`);
  console.log(`  quests completed per signature         ${out.played.quests_completed_min}..${out.played.quests_completed_max}`);
  console.log(`  endings that demanded nothing          ${out.played.free_endings_taken}  (the W1-FACTIONS round-1 trap, counted)`);
  console.log(`  violent resolutions taken              ${out.played.violent_resolutions_taken}`);
  if (out.played.givers_not_in_the_world.length) {
    console.log(`  GIVERS NOT IN THE WORLD                ${out.played.givers_not_in_the_world.length}: ${out.played.givers_not_in_the_world.slice(0, 8).join(', ')}`);
  }
  if (out.reveals_refused.length) {
    console.log('\n  reveals a player asked for and did not get:');
    for (const rr of out.reveals_refused.slice(0, 6)) console.log(`    x${String(rr.signatures).padStart(3)}  ${rr.reveal.slice(0, 150)}`);
  }
  console.log('\n  where the main quest stops:');
  for (const s of out.where_the_main_quest_stops.slice(0, 8)) console.log(`    x${String(s.signatures).padStart(3)}  ${s.stop.slice(0, 150)}`);
  console.log(`\nwrote ${artifact}`);
}

// EXIT. 0 only when the walk was granted nothing AND every sampled signature played to the end of
// the criteria this tool actually walks. There is no threshold and no target: a sampled walk with
// a pass mark would be a viability figure with the sampling hidden inside it.
const ok = grantedNothing && bothGateCriteria === rows.length && SOURCE_AUDIT.ok;
process.exit(ok ? 0 : 1);

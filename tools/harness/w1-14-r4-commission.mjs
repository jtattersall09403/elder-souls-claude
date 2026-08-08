#!/usr/bin/env node
// w1-14-r4-commission.mjs — CAN A PLAYER WALK TO SOMEBODY AND HAVE A SPELL MADE?
//
// `GAP-W1-magic-spellmaking-has-no-world-side-surface` (W1-14 round-3 verdict §13), the round's
// single biggest gap: *"`makeSpell` and `enchantQuote` each have exactly one caller in the entire
// build and it is `window.__HARNESS`. There is nowhere to walk to."*
//
// THE ACCEPTANCE THIS ANSWERS, re-worded by that verdict so it cannot be satisfied by the harness:
//
//   > A probe that NEVER CALLS `H.makeSpell`, `H.enchantQuote` or `H.enchanterOpen` walks the
//   > player to a named settlement, opens a conversation with a named NPC through `H.talkTo`,
//   > selects a spellmaking topic through `H.conversationSay`, and commissions 19 of 20 tuples
//   > that are legal under RI-MAG02 and absent from `spells.json` — including one three-effect
//   > spell, one at an effect's `magnitude.max`, one at `duration.max_s`, one whose `focus_cost`
//   > exceeds `focus_max`, and one deliberately nonsensical — asserting each appears in
//   > `saveState()`, each computes RI-MAG02 §D's `focus_base` exactly, and each castable one
//   > delivers its commissioned magnitude. The twentieth, the effect-count-over-skill-cap case,
//   > is refused with its number. Gold decreases by the quoted price and by nothing else.
//
// HOW THE FORBIDDEN-VERB RULE IS ENFORCED RATHER THAN PROMISED. The tool reads ITS OWN BYTES at
// startup and refuses to run if the four forbidden names appear anywhere in it (`w1-23-r4` and
// `W1-READABLES-r2` do the same and it is the reason their numbers are worth anything). The only
// magic verbs used are read-only observers — `getMagicState`, `getMagicWorld`, `commissionState`
// — plus `learnSpell`, which is how a player comes to own an effect at all (buying a spell) and
// which is the input to the effect-knowledge gate, not a way round it.
//
// SECOND IMPLEMENTATION OF THE PRICE, ON PURPOSE. `focus_base` is recomputed here from RI-MAG02
// §D's published formula rather than by importing `sim/magic/cost.js`. `tools/analysis/magic-audit.mjs`
// imports the game's own file deliberately — that check is "does the shipped shelf match the code
// that runs" — but this one is "does the counter charge what the ITEM says", and a check that
// imports the thing under test cannot answer it.
//
// FOUR CONTROLS, and each one is a different world (RULES.md #6):
//   A  the door removed        `H.__breakCommissionCounter()` — same town, same person, same
//                              subject, no counter. The NPC is still there, which is what makes
//                              this a control on the DOOR rather than on the placement.
//   B  the wrong person        an ordinary townsman in the same square, same subject.
//   C  an enchanter, not a     the Stormhold enchanter: raises the subject, gets a REFUSAL LINE
//      spellwright             that names the towns that do the work, and no counter.
//   D  the quest gate          the Stone Wastes recluse before `mag_recluse_introduction`.
//
// USAGE  node tools/harness/w1-14-r4-commission.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r4-commission.mjs — spellmaking, reached by walking up to somebody (RI-MAG03 M1)

  --out <dir>   report directory (default reports/w1-14-r4)

Exit 0 only if the walk, the conversation, 19 commissions, the refusal, the purse and the cast
all hold, AND all four controls come back empty.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r4');
ensureDir(outDir);

// ---- THE SELF-GAG. Read our own bytes; refuse to run if we can reach the model directly. -------
const SELF = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
const FORBIDDEN = ['makeSpell', 'quoteSpell', 'enchantQuote', 'enchanterOpen', '__ENGINE'];
{
  // The list itself contains the words, so the check looks for them as CALLS.
  const hits = FORBIDDEN.filter((n) => new RegExp(`[.\\[]\\s*['"\`]?${n}['"\`]?\\s*[\\](]`).test(SELF));
  if (hits.length) {
    log(`REFUSING TO RUN: this tool names ${hits.join(', ')} as a call. The acceptance forbids it.`);
    process.exit(EXIT.MEASUREMENT_FAIL);
  }
}

// ---- RI-MAG02 §D, transcribed from the item ----------------------------------------------------
const RANGE_MULT = { self: 0.70, touch: 0.85, target: 1.00, projectile: 1.15, area_at_range: 1.25 };
const focusBaseD = (weight, M, D, A, range) => {
  const core = Math.pow(M, 1.30) + 0.7 * Math.pow(D, 0.95) + 0.55 * Math.pow(M, 0.80) * Math.pow(D, 0.45);
  return Math.ceil(weight * core * (1 + 0.09 * Math.pow(A, 1.25)) * RANGE_MULT[range] / 10);
};

const handle = await launchGame(args);
let out;
try {
  out = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const log2 = [];
    const D = H.getMagicData();
    const EFF = {};
    for (const e of D.effects.effects) EFF[e.id] = e;
    const shipped = new Set(D.spells.spells.map((s) => JSON.stringify({
      e: s.effects.map((t) => `${t.effect}:${t.magnitude}:${t.duration_s}:${t.area_r_m}`).sort(), r: s.range, c: s.class,
    })));

    // ------------------------------------------------------------------------------------------
    // THE WALK. A named settlement, from the state file that puts a player in it, on foot.
    // ------------------------------------------------------------------------------------------
    const WRIGHT = 'spellwright-lilmoth';
    const POST = [2784.2, 5060.1];
    H.setSeed(4242);
    H.loadState('town-lilmoth');
    H.setRenderRate(0);
    const start = H.getPlayerStats().pos.slice();
    let walk = null;
    try { walk = H.walkPath([[start[0], start[2]], POST], { speed: 'walk', arrive_m: 1.6 }); }
    catch (err) { log2.push(`walkPath: ${err && err.message}`); }
    const standing = H.getPlayerStats().pos.slice();

    // Is the person actually in the world, and how far away are they?
    const people = H.listNPCs();
    const wrow = people.find((n) => n.eid === WRIGHT || n.id === WRIGHT) || null;
    const wpos = wrow ? (wrow.pos || null) : null;
    const dist = wpos ? Math.round(Math.hypot(wpos[0] - standing[0], wpos[2] - standing[2]) * 100) / 100 : null;

    // ------------------------------------------------------------------------------------------
    // THE CHARACTER. A caster who can pay, who knows effects (because they have bought spells),
    // and whose school skills are high enough for five-effect spells. Every one of these is an
    // ARENA verb; none of them is a way into the commission surface.
    // ------------------------------------------------------------------------------------------
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99);
    H.setCatalyst('great_staff');
    H.setGold(4000000);
    H.hearthRest();
    for (const s of D.spells.spells) H.learnSpell(s.id);
    const focusMax = H.getMagicState().focus_max;

    // ------------------------------------------------------------------------------------------
    // THE CONVERSATION. Two verbs, both of them the ones a player uses on anybody.
    // ------------------------------------------------------------------------------------------
    const greet = H.talkTo(WRIGHT);
    const topicsOffered = greet.topics.map((t) => t.id);
    const opened = H.conversationSay('spellmaking');
    const counterOpened = !!(opened && opened.commission);

    // ---- driving the counter, with nothing but `conversationSay` -------------------------------
    const say = (id) => H.conversationSay(id);
    const st = () => H.commissionState();
    const press = (id) => { const r = say(id); return r; };
    const setNumber = (which, want) => {
      // `commission.term.<field>` opens the step menu; the steps are min/max/+-10/+-1. Reaching an
      // exact number this way is what a player does with a d-pad, so the probe does it too.
      press(`commission.term.${which}`);
      press('commission.step.min');
      let guard = 0;
      const cur = () => {
        const s = st();
        const t = s.draft.terms[s.draft.terms.length - 1];
        return which === 'magnitude' ? t.magnitude : which === 'duration' ? t.duration_s : t.area_r_m;
      };
      while (cur() < want && guard++ < 400) press(cur() + 10 <= want ? 'commission.step.up10' : 'commission.step.up1');
      press('commission.back');
      return cur();
    };
    const addTerm = (t) => {
      press('commission.effect.add');
      press(`commission.effect.${t.effect}`);
      setNumber('magnitude', t.magnitude);
      if (t.duration_s) setNumber('duration', t.duration_s);
      if (t.area_r_m) setNumber('area', t.area_r_m);
      press('commission.back');
    };
    const setRange = (r) => { let g = 0; while (st().draft.range !== r && g++ < 12) press('commission.range'); return st().draft.range; };
    const setClass = (c) => { let g = 0; while (st().draft.class !== c && g++ < 12) press('commission.class'); return st().draft.class; };

    // ------------------------------------------------------------------------------------------
    // THE TWENTY TUPLES. Legal under RI-MAG02, absent from `spells.json`, and covering every case
    // the acceptance names by hand rather than by luck.
    // ------------------------------------------------------------------------------------------
    const TUPLES = [
      { why: 'plain', effects: [{ effect: 'fire_damage', magnitude: 23, duration_s: 0, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' },
      { why: 'two-effect area (the round-3 critic\'s own commission)', effects: [{ effect: 'fire_damage', magnitude: 25, duration_s: 6, area_r_m: 5 }, { effect: 'demoralise', magnitude: 20, duration_s: 10, area_r_m: 5 }], range: 'area_at_range', class: 'HEAVY' },
      { why: 'THREE-EFFECT', effects: [{ effect: 'frost_damage', magnitude: 14, duration_s: 3, area_r_m: 0 }, { effect: 'shock_damage', magnitude: 11, duration_s: 0, area_r_m: 0 }, { effect: 'poison_damage', magnitude: 9, duration_s: 4, area_r_m: 0 }], range: 'target', class: 'LIGHT' },
      { why: 'at magnitude.max', effects: [{ effect: 'damage_health', magnitude: 200, duration_s: 0, area_r_m: 0 }], range: 'touch', class: 'HEAVY' },
      { why: 'at duration.max_s', effects: [{ effect: 'poison_damage', magnitude: 6, duration_s: 120, area_r_m: 0 }], range: 'target', class: 'LIGHT' },
      { why: 'focus_cost over focus_max (made and sold anyway)', effects: [{ effect: 'fire_damage', magnitude: 200, duration_s: 30, area_r_m: 8 }], range: 'area_at_range', class: 'HEAVY' },
      { why: 'DELIBERATELY NONSENSICAL — a healing bolt fired at somebody else', effects: [{ effect: 'restore_health', magnitude: 40, duration_s: 0, area_r_m: 0 }, { effect: 'poison_damage', magnitude: 40, duration_s: 5, area_r_m: 0 }], range: 'target', class: 'LIGHT' },
      { why: 'cheapest thing the counter will sell', effects: [{ effect: 'night_eye', magnitude: 1, duration_s: 1, area_r_m: 0 }], range: 'self', class: 'CANTRIP' },
      { why: 'a ward and a light, together', effects: [{ effect: 'shield', magnitude: 18, duration_s: 25, area_r_m: 0 }, { effect: 'night_eye', magnitude: 12, duration_s: 25, area_r_m: 0 }], range: 'self', class: 'LIGHT' },
      { why: 'a summon at a magnitude no shelf spell uses', effects: [{ effect: 'bind_lesser', magnitude: 37, duration_s: 24, area_r_m: 0 }], range: 'self', class: 'HEAVY' },
      { why: 'burden at range', effects: [{ effect: 'burden', magnitude: 45, duration_s: 20, area_r_m: 0 }], range: 'target', class: 'LIGHT' },
      { why: 'silence and demoralise: end a fight without killing', effects: [{ effect: 'silence', magnitude: 12, duration_s: 12, area_r_m: 0 }, { effect: 'demoralise', magnitude: 30, duration_s: 12, area_r_m: 0 }], range: 'target', class: 'LIGHT' },
      { why: 'an area heal', effects: [{ effect: 'restore_health', magnitude: 22, duration_s: 0, area_r_m: 4 }], range: 'area_at_range', class: 'LIGHT' },
      { why: 'invisibility, briefly, cheaply', effects: [{ effect: 'invisibility', magnitude: 1, duration_s: 8, area_r_m: 0 }], range: 'self', class: 'CANTRIP' },
      { why: 'open at a distance', effects: [{ effect: 'open_lock', magnitude: 55, duration_s: 0, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' },
      { why: 'feather and leap: a mule that jumps', effects: [{ effect: 'feather', magnitude: 60, duration_s: 30, area_r_m: 0 }, { effect: 'leap', magnitude: 20, duration_s: 30, area_r_m: 0 }], range: 'self', class: 'LIGHT' },
      { why: 'soul trap on a bolt', effects: [{ effect: 'soul_trap', magnitude: 1, duration_s: 20, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' },
      { why: 'detect life, wide', effects: [{ effect: 'detect_life', magnitude: 40, duration_s: 20, area_r_m: 0 }], range: 'self', class: 'LIGHT' },
      { why: 'frost at touch, which used to be the cheapest and strongest range in the table', effects: [{ effect: 'frost_damage', magnitude: 31, duration_s: 0, area_r_m: 0 }], range: 'touch', class: 'LIGHT' },
      // #20 — the one that MUST be refused, with its number.
      { why: 'SIX EFFECTS — over the effect-count cap of five', mustRefuse: 'effect_count',
        effects: [
          { effect: 'fire_damage', magnitude: 5, duration_s: 0, area_r_m: 0 },
          { effect: 'frost_damage', magnitude: 5, duration_s: 0, area_r_m: 0 },
          { effect: 'shock_damage', magnitude: 5, duration_s: 0, area_r_m: 0 },
          { effect: 'poison_damage', magnitude: 5, duration_s: 0, area_r_m: 0 },
          { effect: 'damage_health', magnitude: 5, duration_s: 0, area_r_m: 0 },
          { effect: 'drain_health', magnitude: 5, duration_s: 0, area_r_m: 0 },
        ], range: 'touch', class: 'LIGHT' },
    ];

    const results = [];
    for (const T of TUPLES) {
      const goldBefore = H.getGold();
      // Clear whatever is on the slate from the last one, by taking each term out again.
      let g = 0;
      while (st().draft.terms.length && g++ < 12) { press(`commission.term.${st().draft.terms.length - 1}`); press('commission.term.remove'); }
      for (const t of T.effects) addTerm(t);
      const r = setRange(T.range);
      const c = setClass(T.class);
      const before = st();
      const quote = before.quote;
      const res = press('commission.confirm');
      const after = st();
      const goldAfter = H.getGold();
      const key = JSON.stringify({ e: (before.draft.terms).map((t) => `${t.effect}:${t.magnitude}:${t.duration_s}:${t.area_r_m}`).sort(), r, c });
      results.push({
        why: T.why,
        wanted: T.effects, range_set: r, class_set: c,
        must_refuse: T.mustRefuse || null,
        clamped_terms: before.draft.terms,
        // The catalogue weights for this draft, carried out of the page so the Node half can
        // recompute RI-MAG02 §D's `focus_base` from the ITEM rather than from the code.
        weights: Object.fromEntries(before.draft.terms.map((t) => [t.effect, EFF[t.effect].weight])),
        quote: quote ? {
          refused: !!quote.refused, gate: quote.gate || null, reason: quote.reason || null,
          focus_base: quote.focus_base, focus_cost: quote.focus_cost, gold: quote.gold,
          tier: quote.tier, skill_req: quote.skill_req, over_reservoir: quote.over_reservoir,
          castable_now: quote.castable_now, attunable_now: quote.attunable_now, notes: quote.notes,
        } : null,
        commissioned: res.commissioned || null,
        refused: res.refused || null,
        line_after: after ? after.line : null,
        gold: [goldBefore, goldAfter],
        gold_delta: goldBefore - goldAfter,
        absent_from_shelf: !shipped.has(key),
      });
      if (T.mustRefuse) {
        // A refused draft stays on the slate; take it off so the next tuple starts clean.
        let h = 0;
        while (st().draft.terms.length && h++ < 12) { press(`commission.term.${st().draft.terms.length - 1}`); press('commission.term.remove'); }
      }
    }

    // ---- IT IS IN THE SAVE ---------------------------------------------------------------------
    const saved = H.saveState();
    const savedCustom = (() => {
      const txt = JSON.stringify(saved);
      return results.filter((r) => r.commissioned).map((r) => ({ id: r.commissioned, in_save: txt.includes(r.commissioned) }));
    })();

    // ---- AND IT CASTS. The whole point: a spell nobody wrote, in a fight. ------------------------
    const castables = results.filter((r) => r.commissioned && r.quote && r.quote.castable_now && r.quote.attunable_now);
    const pick = castables.find((r) => r.wanted.length === 1 && r.wanted[0].effect === 'fire_damage') || castables[0] || null;
    let cast = null;
    if (pick) {
      // CAST WHERE IT WAS BOUGHT. The first draft of this loaded `arena_flat` for the fight and
      // `setAttuned` threw with `Known: 72 shipped + 0 commissioned` — loading a state rebuilds
      // the MagicSystem and the commissioned shelf goes with it. That is not a defect to route
      // around, it is the reason the cast belongs in the town: the spell is cast in the street
      // it was paid for in, twenty metres from the person who wrote it.
      H.conversationClose();
      H.hearthRest();
      const here = H.getPlayerStats().pos;
      const e = H.spawn('inf_trash', here[0] + 6.0, here[2] + 1.0);
      const eid = e && e.eid ? e.eid : e;
      H.lockOn(eid);
      H.magicEventsDrain();
      const hp0 = H.getCombatState().enemies.find((x) => x.id === eid).hp;
      H.setAttuned([pick.commissioned]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(240);
      const hp1 = H.getCombatState().enemies.find((x) => x.id === eid).hp;
      const ev = H.magicEventsDrain();
      cast = {
        spell: pick.commissioned,
        commissioned_magnitude: pick.clamped_terms[0].magnitude,
        declared_output_per_point: EFF[pick.clamped_terms[0].effect].magnitude.output_per_point,
        hp: [hp0, hp1], damage: Math.round((hp0 - hp1) * 100) / 100,
        applied: ev.filter((x) => x.kind === 'effect_apply').length,
        events: ev.filter((x) => ['cast_start', 'cast_release', 'focus_spend', 'effect_apply', 'spell_hit'].includes(x.kind)).map((x) => x.kind),
      };
    }

    return {
      walk: walk ? { frames: walk.frames, distance_m: walk.distance_m ?? walk.dist_m ?? null, aborted: walk.aborted || null } : null,
      start, standing, wright_pos: wpos, distance_to_wright_m: dist,
      wright_in_world: !!wrow,
      npc_count: people.length,
      greeting: greet.greeting,
      topics_offered: topicsOffered,
      counter_opened: counterOpened,
      opening_line: opened && opened.commission ? opened.commission.line : null,
      focus_max: focusMax,
      results, saved_custom: savedCustom, cast, notes: log2,
    };
  });

  // ---- THE FOUR CONTROLS, each in its own page -----------------------------------------------
  const controlArm = async (which) => {
    const p = await handle.page.context().newPage();
    await p.goto(handle.page.url(), { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.__HARNESS, null, { timeout: 30000 });
    const r = await p.evaluate(async (WHICH) => {
      const H = window.__HARNESS;
      await H.ready();
      H.setSeed(4242);
      if (WHICH === 'gate') H.loadState('stone-wastes-count'); else if (WHICH === 'enchanter') H.loadState('town-stormhold'); else H.loadState('town-lilmoth');
      H.setRenderRate(0);
      H.setGold(4000000);
      for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
      if (WHICH === 'nodoor') { if (!H.__breakCommissionCounter) return { fatal: 'H.__breakCommissionCounter absent' }; H.__breakCommissionCounter(true); }
      const who = WHICH === 'wrongperson' ? (H.listNPCs().find((n) => n.eid !== 'spellwright-lilmoth' && n.settlement === 'lilmoth') || {}).eid
        : WHICH === 'enchanter' ? 'enchanter-stormhold'
          : WHICH === 'gate' ? 'spellwright-recluse' : 'spellwright-lilmoth';
      if (!who) return { fatal: 'no such person in the world' };
      let greet;
      try { greet = H.talkTo(who); } catch (err) { return { who, fatal: String(err && err.message) }; }
      const said = H.conversationSay('spellmaking');
      return {
        who, in_world: true,
        topics: greet.topics.map((t) => t.id),
        counter: !!H.commissionState(),
        said_text: said && said.said ? said.said : null,
        said_source: said ? said.said_source : null,
      };
    }, which);
    await p.close();
    return r;
  };
  out.controls = {
    A_door_removed: await controlArm('nodoor'),
    B_wrong_person: await controlArm('wrongperson'),
    C_enchanter_not_spellwright: await controlArm('enchanter'),
    D_quest_gate: await controlArm('gate'),
  };
} finally {
  await handle.close();
}

// ---- the assertions ---------------------------------------------------------------------------
const fails = [];
const push = (ok, why) => { if (!ok) fails.push(why); };
push(out.wright_in_world, 'the Lilmoth spellwright is not a person in the world');
push(out.distance_to_wright_m !== null && out.distance_to_wright_m < 4,
  `the player finished the walk ${out.distance_to_wright_m} m from the spellwright — "standing in front of" is not established`);
push(out.topics_offered.includes('spellmaking'), `the spellwright does not offer the subject (offered: ${out.topics_offered.join(', ')})`);
push(out.counter_opened, 'raising the subject did not open a counter');

const made = out.results.filter((r) => r.commissioned);
const refusedRow = out.results.find((r) => r.must_refuse);
push(made.length === 19, `${made.length} of 20 tuples were commissioned; the acceptance is 19`);
push(!!refusedRow && refusedRow.refused === 'effect_count',
  `the six-effect tuple came back '${refusedRow && refusedRow.refused}' rather than refused on effect_count`);
push(!!refusedRow && /skill/.test(String(refusedRow.line_after || '')),
  'the effect-count refusal does not state its number');
push(out.results.every((r) => r.absent_from_shelf), 'a commissioned tuple is already on the shipped shelf, so it proves nothing');

for (const r of made) {
  // RI-MAG02 §D, recomputed here from the item.
  const want = r.clamped_terms.reduce((s, t) => s + focusBaseD(r.weights[t.effect], t.magnitude, t.duration_s, t.area_r_m, r.range_set), 0);
  if (want !== r.quote.focus_base) fails.push(`${r.commissioned}: the counter charged focus_base ${r.quote.focus_base}; RI-MAG02 §D recomputed here says ${want}`);
  push(r.gold_delta === r.quote.gold, `${r.commissioned}: the purse moved ${r.gold_delta} and the quote said ${r.quote.gold}`);
}
const over = made.find((r) => r.quote && r.quote.over_reservoir === true) || made.find((r) => r.quote && r.quote.focus_cost > out.focus_max);
push(!!over, 'no tuple exceeded focus_max, so the "made and sold anyway" case was not exercised');
push(!!out.cast && out.cast.damage > 0, `the commissioned spell did not deliver (${JSON.stringify(out.cast)})`);
push(!!out.cast && out.cast.applied === 1, `the commissioned spell applied ${out.cast && out.cast.applied} times`);
const savedBad = (out.saved_custom || []).filter((s) => !s.in_save);
push(savedBad.length === 0, `${savedBad.length} commissioned spell(s) are not in saveState()`);

for (const [k, c] of Object.entries(out.controls)) {
  if (c.fatal) { fails.push(`control ${k}: ${c.fatal}`); continue; }
  if (c.counter) fails.push(`INERT CONTROL ${k}: a counter opened anyway`);
}
push(out.controls.C_enchanter_not_spellwright && !!out.controls.C_enchanter_not_spellwright.said_text,
  'the enchanter said nothing when the subject was raised — a refusal that is silent is not a refusal');

const report = {
  schema: 'elder-souls/w1-14-r4-commission@1',
  commit: gitInfo().commit,
  forbidden_verbs_absent_from_this_tool: FORBIDDEN,
  ...out,
  pass: fails.length === 0,
  failures: fails,
};
writeJson(path.join(outDir, 'commission-through-play.json'), report);
log(`walked ${out.start.map((v) => Math.round(v)).join(',')} -> ${out.standing.map((v) => Math.round(v)).join(',')}; ${out.distance_to_wright_m} m from the spellwright`);
log(`topics offered: ${out.topics_offered.join(', ')}`);
log(`counter opened: ${out.counter_opened}   "${String(out.opening_line).slice(0, 90)}"`);
log(`commissioned ${made.length} of ${out.results.length}; refusal row = ${refusedRow && refusedRow.refused}`);
for (const r of out.results) log(`  ${r.commissioned || 'REFUSED ' + r.refused}  base ${r.quote && r.quote.focus_base} cost ${r.quote && r.quote.focus_cost} gold ${r.quote && r.quote.gold} paid ${r.gold_delta}  — ${r.why}`);
log(`cast: ${JSON.stringify(out.cast)}`);
for (const [k, c] of Object.entries(out.controls)) log(`control ${k}: counter=${c.counter} said="${String(c.said_text || '').slice(0, 70)}"`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'commission-through-play.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);

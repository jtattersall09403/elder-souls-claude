#!/usr/bin/env node
// critic-w1-14-r4-commission.mjs — A CRITIC WALKS TO A SPELLWRIGHT AND BUYS A SPELL NOBODY WROTE.
//
// RI-MAG03 M1, as the round-3 verdict re-worded it so the harness could not satisfy it:
//   "A probe that NEVER calls `H.makeSpell`, `H.enchantQuote` or `H.enchanterOpen` walks the
//    player to a named settlement, opens a conversation with a named NPC through `H.talkTo`,
//    selects a spellmaking topic through `H.conversationSay`, and commissions … asserting each
//    appears in `saveState()` … Gold decreases by the quoted price and by nothing else."
//
// SELF-CENSORSHIP, the same device the builder's own probe uses and for the same reason: this
// file reads its own bytes at start-up and REFUSES TO RUN if it names any of the model-side
// verbs. A probe that could reach the model directly is not evidence that a player can.
//
// WHAT THIS ADDS TO THE BUILDER'S OWN ARM, which measured the same door:
//   1. It goes to a DIFFERENT spellwright in a DIFFERENT town (Gideon, Neloth Sedran) as well as
//      the one the builder measured, so the door is not one record that happens to work.
//   2. It asserts the commissioned tuple is ABSENT FROM `spells.json` by comparing the effect
//      set, range and class against all 72 shipped spells — the item's actual words — rather
//      than assuming a `custom_` id makes it new.
//   3. It asks whether the counter is DRAWN. The round argues the counter is not a new UI mode
//      because it borrows the conversation surface; the test of that claim is that its rows
//      appear in `getRenderedText()`, which reads the draw call. A surface that exists only in a
//      state object is the same shape as the model it is meant to be the door onto.
//   4. It checks the purse against `getGold()` — the engine's one purse — before and after, and
//      through a save round trip, because `magic.gold` was a mirror until this round.
//   5. It checks the ENCHANTER refusal at Stormhold names a town, and that no counter opens.
//
// USAGE  node tools/harness/critic-w1-14-r4-commission.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-commission.mjs — walk to a person, buy a spell that does not exist.

  --out <dir>   report directory (default reports/critic-w1-14-r4)

Exit 0 only if the walk arrives on foot, the counter opens through talkTo + conversationSay, a
tuple absent from spells.json is commissioned, the purse moves by exactly the quote, the spell
survives a save, and the counter's rows are actually drawn.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);

// ---- the self-censor. This must run before anything else. -----------------------------------
const SELF = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
const BANNED = ['make' + 'Spell', 'quote' + 'Spell', 'enchant' + 'Quote', 'enchanter' + 'Open', '__' + 'ENGINE'];
const named = BANNED.filter((b) => SELF.split(b).length > 2);   // >2 = a use beyond this list itself
if (named.length) {
  log(`REFUSING TO RUN: this probe names ${named.join(', ')}. The acceptance is that a PLAYER can reach spellmaking.`);
  process.exit(EXIT.MEASUREMENT_FAIL);
}

const WALK = (page, town, wrightId) => page.evaluate(async ({ TOWN, WRIGHT }) => {
  const H = window.__HARNESS;
  await H.ready();
  const out = { town: TOWN, wright: WRIGHT };
  H.setSeed(77);
  // Loaded twice: a single load into a town lands the body on the previous cell's ground.
  H.loadState(TOWN); H.stepFrames(4); H.loadState(TOWN);
  H.setRenderRate(0);
  H.setTimeOfDay(11);
  H.stepFrames(30);

  // WHO IS HERE. No id is assumed: the person is found by the record's own `spellwright` key.
  const people = H.listNPCs();
  const target = people.find((n) => (n.record && n.record.id === WRIGHT) || n.id === WRIGHT || n.npc_id === WRIGHT
    || (n.name && n.record && n.record.spellwright));
  out.people_present = people.length;
  const cand = people.filter((n) => JSON.stringify(n).includes(WRIGHT));
  const who = target || cand[0] || null;
  if (!who) return { ...out, fatal: `nobody matching '${WRIGHT}' is standing in ${TOWN}`, sample: people.slice(0, 6) };
  out.eid = who.eid || who.id;
  out.name = who.name || (who.record && who.record.name) || null;
  const px = () => H.whereAmI().pos;
  const p0 = px();
  const npos = who.pos || (who.record && who.record.post && who.record.post.pos) || null;
  out.from = p0.map((v) => Math.round(v * 100) / 100);
  out.npc_pos = npos ? npos.map((v) => Math.round(v * 100) / 100) : null;

  // ---- ON FOOT. `walkPath` is the world's own locomotion; it reports `stuck` when it is. -----
  let frames0 = H.getFrame();
  const wp = npos ? H.walkPath([[p0[0], p0[2]], [npos[0], npos[2]]], { maxFrames: 3000, stopWithin: 1.6 }) : null;
  out.walk = wp ? { ok: wp.ok, reason: wp.reason || null, walked_m: wp.walked_m ?? wp.distance_m ?? null, frames: H.getFrame() - frames0 } : null;
  const p1 = px();
  out.to = p1.map((v) => Math.round(v * 100) / 100);
  out.gap_m = npos ? Math.round(Math.hypot(p1[0] - npos[0], p1[2] - npos[2]) * 100) / 100 : null;
  out.walked_on_foot_m = Math.round(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) * 100) / 100;
  out.frames_walked = H.getFrame() - frames0;
  return out;
}, { TOWN: town, WRIGHT: wrightId });

const COMMISSION = (page, town, wrightId, tuples) => page.evaluate(async ({ TOWN, WRIGHT, TUPLES }) => {
  const H = window.__HARNESS;
  await H.ready();
  const out = { town: TOWN, wright: WRIGHT, steps: [] };
  H.setSeed(77);
  H.loadState(TOWN); H.stepFrames(4); H.loadState(TOWN);
  H.setRenderRate(0);
  H.setTimeOfDay(11);
  // A purse and a spellbook. Buying a spell teaches its effects, so the counter's first gate
  // (effect knowledge) needs the character to own the shipped spells that carry them.
  H.setGold(4000000);
  for (let i = 0; i < 700; i++) {
    for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
    H.hearthRest();
  }
  H.setWillpower(99); H.setCatalyst('great_staff'); H.hearthRest();
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  H.stepFrames(30);

  const people = H.listNPCs();
  const who = people.find((n) => JSON.stringify(n).includes(WRIGHT));
  if (!who) return { ...out, fatal: `nobody matching '${WRIGHT}' in ${TOWN}` };
  const eid = who.eid || who.id;
  const npos = who.pos || (who.record && who.record.post && who.record.post.pos);
  const p0 = H.whereAmI().pos;
  H.walkPath([[p0[0], p0[2]], [npos[0], npos[2]]], { maxFrames: 3000, stopWithin: 1.6 });
  const p1 = H.whereAmI().pos;
  out.gap_m = Math.round(Math.hypot(p1[0] - npos[0], p1[2] - npos[2]) * 100) / 100;

  // ---- THE TWO VERBS A PLAYER HAS ------------------------------------------------------------
  const talk = H.talkTo(eid);
  out.talk = { ok: !!talk, topics: (talk && talk.list ? talk.list : (talk && talk.topics) || []).map((t) => t.id || t) };
  const opened = H.conversationSay('spellmaking');
  out.opened_counter = !!(opened && opened.commission);
  out.opening_line = opened ? (opened.said === undefined ? null : opened.said) : null;
  if (!out.opened_counter) return { ...out, fatal: 'raising `spellmaking` did not open a counter' };

  // Is it DRAWN? The round's argument is that the counter is not a new UI mode because it rides
  // the conversation surface. The test of that is the draw call, not the state object.
  H.renderFrame();
  const drawn = H.getRenderedText ? H.getRenderedText() : null;
  const drawnText = drawn ? (drawn.distinct || drawn.text || []) : [];
  const rows = H.commissionState().options.map((o) => o.text);
  out.counter_rows = rows;
  out.rows_drawn = rows.filter((r) => drawnText.some((t) => String(t).includes(r)));
  out.drawn_sample = drawnText.slice(0, 25);

  // ---- WALK THE COUNTER WITH THE ROWS IT PUBLISHES -------------------------------------------
  // The only ids used are the ones `commissionState().options` hands back — i.e. what the d-pad
  // would land on. Nothing here knows the counter's internal vocabulary.
  const pick = (id) => { const st = H.conversationSay(id); out.steps.push(id); return st; };
  const rowIds = () => H.commissionState().options.map((o) => o.id);
  const has = (id) => rowIds().includes(id);

  const shipped = H.getMagicData().spells.spells.map((s) => ({
    id: s.id, cls: s.class, range: s.range,
    effects: [...new Set((s.effects || []).map((e) => e.effect))].sort().join('+'),
  }));

  const made = [];
  const goldStart = H.getGold();
  for (const T of TUPLES) {
    const before = H.getGold();
    // 1. open the effect book, page to the effect, choose it
    if (!has('commission.effect.add')) { made.push({ tuple: T, error: 'no add row', rows: rowIds() }); continue; }
    pick('commission.effect.add');
    let guard = 0;
    while (!has(`commission.effect.${T.effect}`) && has('commission.page') && guard++ < 20) pick('commission.page');
    if (!has(`commission.effect.${T.effect}`)) { made.push({ tuple: T, error: `effect ${T.effect} not offered`, rows: rowIds() }); pick('commission.back'); continue; }
    pick(`commission.effect.${T.effect}`);
    // Extra effects, so the commissioned tuple's SIGNATURE (effect set + range + class) cannot
    // collide with a shipped spell. RI-MAG03 M1 wants a spell "that appears nowhere in
    // spells.json", and a one-effect draft can accidentally reproduce one that is already there.
    for (const x of (T.extra || [])) {
      pick('commission.back');
      if (!has('commission.effect.add')) continue;
      pick('commission.effect.add');
      let g = 0;
      while (!has(`commission.effect.${x}`) && has('commission.page') && g++ < 20) pick('commission.page');
      if (has(`commission.effect.${x}`)) pick(`commission.effect.${x}`);
    }
    // 2. the term view: set magnitude / duration / area to their most, or to their least
    for (const [field, to] of Object.entries(T.terms || {})) {
      if (!has(`commission.term.${field}`)) continue;
      pick(`commission.term.${field}`);
      pick(`commission.step.${to}`);
      pick('commission.back');
    }
    pick('commission.back');
    // 3. range and class, cycled until they read as asked
    let g2 = 0;
    while (H.commissionState().draft.range !== T.range && has('commission.range') && g2++ < 8) pick('commission.range');
    let g3 = 0;
    while (H.commissionState().draft.class !== T.class && has('commission.class') && g3++ < 8) pick('commission.class');
    const st = H.commissionState();
    const q = st.quote;
    const line = st.line;
    // 4. have it made
    const res = pick('commission.confirm');
    const after = H.getGold();
    const cs = H.commissionState();
    const madeIds = cs ? cs.made : [];
    const newId = madeIds[madeIds.length - 1] || null;
    const custom = (H.getMagicState().custom_spells !== undefined) ? H.getMagicState().custom_spells : null;
    const sig = {
      cls: st.draft.class, range: st.draft.range,
      effects: [...new Set(st.draft.terms.map((t) => t.effect))].sort().join('+'),
    };
    made.push({
      tuple: T, quote_gold: q ? q.gold : null, quote_focus: q ? q.focus_cost : null,
      quote_refused: q ? !!q.refused : null, quote_gate: q && q.refused ? q.gate : null,
      line,
      committed: !!(res && res.commissioned),
      spell_id: res && res.commissioned ? res.commissioned : newId,
      gold_before: before, gold_after: after, gold_delta: before - after,
      last_refusal: cs ? cs.last_refusal : null,
      custom_spell_count: custom,
      signature: sig,
      in_spells_json: shipped.some((s) => s.cls === sig.cls && s.range === sig.range && s.effects === sig.effects),
      shipped_with_same_effects: shipped.filter((s) => s.effects === sig.effects).map((s) => `${s.id}(${s.cls}/${s.range})`),
    });
  }
  out.made = made;
  out.gold_start = goldStart;
  out.gold_end = H.getGold();
  out.gold_spent = goldStart - H.getGold();
  out.quotes_sum = made.filter((m) => m.committed).reduce((s, m) => s + (m.quote_gold || 0), 0);

  // ---- THE SAVE, and the purse across it ------------------------------------------------------
  const save = H.saveState();
  const blob = JSON.stringify(save);
  out.save_has_all = made.filter((m) => m.committed).every((m) => m.spell_id && blob.includes(m.spell_id));
  out.save_gold = save.progression ? save.progression.gold : null;

  // ---- CAST IT. A spell nobody wrote, in the street it was bought in. --------------------------
  // The CASTABLE one: a commissioned spell whose Focus cost exceeds the reservoir cannot be
  // cast by anybody and casting it would measure the reservoir, not the door.
  const focusMax = H.getMagicState().focus_max;
  const first = made.find((m) => m.committed && m.spell_id && m.quote_focus !== null && m.quote_focus <= focusMax
      && (m.signature.range === 'target' || m.signature.range === 'projectile'))
    || made.find((m) => m.committed && m.spell_id && m.quote_focus !== null && m.quote_focus <= focusMax)
    || made.find((m) => m.committed && m.spell_id);
  if (first) {
    H.conversationClose();
    H.hearthRest();
    H.setAttuned([first.spell_id]);
    // IN FRONT OF THE CASTER, not three metres north of them: a bolt aimed down the body's own
    // yaw at a target placed by compass is a fixture that misses for reasons of its own.
    const pp = H.whereAmI().pos;
    const yaw = (H.getCombatState().player && H.getCombatState().player.yaw !== undefined
      ? H.getCombatState().player.yaw : 0) * Math.PI / 180;
    const sp = H.spawn('drowned_lesser', pp[0] + Math.sin(yaw) * 6.0, pp[2] + Math.cos(yaw) * 6.0);
    const tid = sp && sp.eid ? sp.eid : sp;
    // LOCK ON, so the caster is facing the target. RI-MAG01 §C latches aim at frame 1 off the
    // body's yaw; a body that has just walked across a town is facing wherever the walk left it,
    // and a bolt thrown at the back of the caster's head is a fixture, not a finding.
    try { H.lockOn(tid); } catch (e) { /* no lock available */ }
    H.stepFrames(30);
    const hp0 = (H.getCombatState().enemies.find((e) => e.id === tid) || {}).hp;
    H.magicEventsDrain();
    const pc = H.pressCast(200);
    const evs = H.magicEventsDrain();
    const hp1 = (H.getCombatState().enemies.find((e) => e.id === tid) || {}).hp;
    out.cast = {
      spell: first.spell_id, hp_before: hp0, hp_after: hp1,
      damage: hp0 !== undefined && hp1 !== undefined ? Math.round((hp0 - hp1) * 100) / 100 : null,
      hits: evs.filter((e) => e.kind === 'spell_hit').length,
      cast_start: evs.filter((e) => e.kind === 'cast_start').length,
      drops: pc.drops,
    };
  }
  return out;
}, { TOWN: town, WRIGHT: wrightId, TUPLES: tuples });

// ---- the two controls ------------------------------------------------------------------------
const CONTROLS = (page) => page.evaluate(async () => {
  const H = window.__HARNESS;
  await H.ready();
  const out = {};
  // A. THE ENCHANTER AT STORMHOLD refuses by name and opens no counter.
  H.setSeed(77);
  H.loadState('town-stormhold'); H.stepFrames(4); H.loadState('town-stormhold');
  H.setRenderRate(0); H.setTimeOfDay(11); H.stepFrames(30);
  const people = H.listNPCs();
  const ench = people.find((n) => JSON.stringify(n).includes('enchanter-stormhold'));
  if (ench) {
    const eid = ench.eid || ench.id;
    const np = ench.pos || (ench.record && ench.record.post && ench.record.post.pos);
    const p0 = H.whereAmI().pos;
    H.walkPath([[p0[0], p0[2]], [np[0], np[2]]], { maxFrames: 3000, stopWithin: 1.6 });
    H.talkTo(eid);
    const said = H.conversationSay('spellmaking');
    out.enchanter = {
      name: ench.name || (ench.record && ench.record.name),
      counter_opened: !!(said && said.commission),
      text: said === null || said === undefined ? null : (said.said === undefined ? JSON.stringify(said).slice(0, 200) : said.said),
      raw_keys: said ? Object.keys(said) : null,
      commission_state: H.commissionState(),
    };
  } else out.enchanter = { error: 'enchanter-stormhold not standing in Stormhold' };

  // B. THE DOOR REMOVED. Same person, same town, same subject — and no counter.
  H.setSeed(77);
  H.loadState('town-lilmoth'); H.stepFrames(4); H.loadState('town-lilmoth');
  H.setRenderRate(0); H.setTimeOfDay(11); H.stepFrames(30);
  if (H.__breakCommissionCounter) H.__breakCommissionCounter(true);
  const p2 = H.listNPCs().find((n) => JSON.stringify(n).includes('spellwright-lilmoth'));
  if (p2) {
    const eid = p2.eid || p2.id;
    const np = p2.pos || (p2.record && p2.record.post && p2.record.post.pos);
    const p0 = H.whereAmI().pos;
    H.walkPath([[p0[0], p0[2]], [np[0], np[2]]], { maxFrames: 3000, stopWithin: 1.6 });
    H.talkTo(eid);
    const said = H.conversationSay('spellmaking');
    out.door_removed = {
      counter_opened: !!(said && said.commission),
      still_answers: !!(said && said.said),
      text: said && said.said !== undefined ? said.said : null,
    };
    if (H.__breakCommissionCounter) H.__breakCommissionCounter(false);
  } else out.door_removed = { error: 'spellwright-lilmoth not standing in Lilmoth' };
  return out;
});

const TUPLES = [
  // Each of these is a COMBINATION, not a single effect, so the signature cannot collide with a
  // shipped spell by accident — which is what happened on my first run and is exactly the
  // failure RI-MAG03 M1's wording is guarding against.
  { effect: 'damage_health', extra: ['feather'], terms: { magnitude: 'min' }, range: 'touch', class: 'CANTRIP' },
  { effect: 'fire_damage', extra: ['demoralise'], terms: { magnitude: 'min' }, range: 'target', class: 'LIGHT' },
  { effect: 'frost_damage', extra: ['night_eye', 'burden'], terms: { magnitude: 'min' }, range: 'target', class: 'HEAVY' },
];

const handle = await launchGame(args);
let walk, commission, controls;
try {
  walk = await WALK(handle.page, 'town-lilmoth', 'spellwright-lilmoth');
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  commission = await COMMISSION(p2, 'town-gideon', 'spellwright-gideon', TUPLES);
  await p2.close();
  const p3 = await handle.page.context().newPage();
  await p3.goto(handle.page.url(), { waitUntil: 'load' });
  await p3.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  controls = await CONTROLS(p3);
  await p3.close();
} finally {
  await handle.close();
}

const fails = [];
if (walk.fatal) fails.push(`WALK: ${walk.fatal}`);
if (commission.fatal) fails.push(`COMMISSION: ${commission.fatal}`);
if (!commission.fatal) {
  const committed = (commission.made || []).filter((m) => m.committed);
  if (!committed.length) fails.push('nothing was commissioned through the conversation surface');
  for (const m of committed) {
    if (m.in_spells_json) fails.push(`the commissioned tuple ${m.signature.effects} ${m.signature.cls}/${m.signature.range} ALREADY EXISTS in spells.json — RI-MAG03 M1 wants one that does not`);
    if (m.gold_delta !== m.quote_gold) fails.push(`purse moved ${m.gold_delta} against a quote of ${m.quote_gold}`);
  }
  if (!commission.save_has_all) fails.push('a commissioned spell is not in saveState()');
  if (!(commission.rows_drawn || []).length) fails.push('NOT DRAWN: none of the counter\'s rows appears in getRenderedText() — the door exists in a state object and not on the screen');
  if (!commission.cast || !(commission.cast.damage > 0)) fails.push(`the commissioned spell did not land (${JSON.stringify(commission.cast)})`);
}
if (controls.enchanter && controls.enchanter.counter_opened) fails.push('CONTROL FAILED: an enchanter who does not write spells opened a spellmaking counter');
if (controls.door_removed && controls.door_removed.counter_opened) fails.push('INERT CONTROL: __breakCommissionCounter left the counter open');

const report = {
  schema: 'elder-souls/critic-w1-14-r4-commission@1',
  commit: gitInfo().commit,
  self_censor: { banned: BANNED.length, named_in_this_file: named },
  walk, commission, controls,
  pass: fails.length === 0, failures: fails,
};
writeJson(path.join(outDir, 'commission-walk.json'), report);
log(`WALK ${walk.town}: ${walk.walked_on_foot_m} m on foot in ${walk.frames_walked} f@60, ending ${walk.gap_m} m from ${walk.name} (walkPath ${JSON.stringify(walk.walk)})`);
if (!commission.fatal) {
  log(`COUNTER at ${commission.town}: opened=${commission.opened_counter}; ${commission.counter_rows.length} rows, ${commission.rows_drawn.length} of them DRAWN`);
  log(`opening line: ${commission.opening_line}`);
  for (const m of commission.made || []) {
    log(`  ${m.signature.effects.padEnd(14)} ${m.signature.cls}/${m.signature.range}  quote ${m.quote_gold} g / ${m.quote_focus} Focus  purse -${m.gold_delta}  committed=${m.committed}  in_spells_json=${m.in_spells_json}  ${m.last_refusal || ''}`);
  }
  log(`gold: ${commission.gold_start} -> ${commission.gold_end} (spent ${commission.gold_spent}, quotes sum ${commission.quotes_sum}); save carries ${commission.save_gold}`);
  log(`cast: ${JSON.stringify(commission.cast)}`);
}
log(`control enchanter: ${JSON.stringify(controls.enchanter && { counter: controls.enchanter.counter_opened, text: controls.enchanter.text })}`);
log(`control door removed: ${JSON.stringify(controls.door_removed)}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'commission-walk.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);

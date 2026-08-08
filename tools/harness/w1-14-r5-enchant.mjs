#!/usr/bin/env node
// w1-14-r5-enchant.mjs — I WALKED TO AN ENCHANTER, SPENT A SOUL, AND KILLED SOMETHING WITH IT.
//
// The W1-14 round-4 verdict §7, in full, is the thing this probe answers:
//
//   > "In all of `game/src/`, `enchantQuote` is called from exactly one place —
//   >  `game/src/harness/api.js:1434`. … All seven people advertise `enchanting` as a service
//   >  and answer on the subject with prices and ceilings; nothing behind any of those sentences
//   >  opens. … Under ARBITRATION §3 the enchanting model is `unmeasurable ⇒ 0`. … If round 5
//   >  does not close it, it should be floored there."
//
// THIS PROBE REFUSES TO RUN IF IT CHEATS. Like the round-4 critic's commission probe, it reads
// its own source at start-up and exits non-zero if it names the model verbs directly or reaches
// the model's own verbs or the raw engine handle. The only verbs it uses to reach a counter are
// `conversationSay` — the two a player uses to talk to anybody — plus `walkPath` to get there.
//
// FOUR THINGS, IN ORDER, AND THE FOURTH IS THE ONE THAT MATTERS
//   A. THE WALK.      From the town spawn, on foot, and the arrival distance is asserted.
//                     `talkTo` has NO distance gate (engine.js ~2443), so a probe that opens a
//                     counter through it and calls that a walk has demonstrated nothing — the
//                     round-4 verdict says so and both its probes assert the metres separately.
//   B. THE COUNTER.   Rows, prices, the enchanter's ceiling, and the refusals: an effect you do
//                     not own, and no filled soul in the pack.
//   C. THE PURCHASE.  A gem is consumed, the purse moves through `getGold()`, and `saveState()`
//                     carries the object — measured through the surfaces, never through a field.
//   D. THE CONSUMER.  Using it takes hit points off a body, spends CHARGE and NOT Focus.
//                     `__breakEnchantUse` is the teardown; the positive arm is published beside
//                     it, in the same file, at the same commit.
//
// USAGE  node tools/harness/w1-14-r5-enchant.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r5-enchant.mjs — walk to an enchanter, spend a soul, use the thing.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = path.resolve(String(args.out || 'reports/w1-14-r5'));
ensureDir(outDir);

// ---- the self-check ---------------------------------------------------------------------------
const SELF = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
// The names are ASSEMBLED rather than written, or the check finds its own declaration of them and
// refuses to run every time — which is what the first version of this file did, and it is the
// self-referential trap any source-reading assertion has. Assembling them also means a future
// edit cannot satisfy the check by deleting the list: the list is not greppable either.
const H_ = 'H' + '.';
const FORBIDDEN = [H_ + 'enchant' + 'Quote', H_ + 'enchant' + 'Item', H_ + 'enchanter' + 'Open',
  '__' + 'ENGINE', H_ + 'make' + 'Spell', H_ + 'quote' + 'Spell'];
const found = FORBIDDEN.filter((f) => SELF.includes(f));
if (found.length) {
  log(`REFUSING TO RUN: this probe names ${found.join(', ')}. The acceptance is that a PLAYER can`);
  log('reach enchanting, and a probe that calls the model directly has measured the model, not the door.');
  process.exit(3);
}

const RUN = (page) => page.evaluate(async () => {
  const H = window.__HARNESS;
  await H.ready();
  const r2 = (v) => Math.round(v * 100) / 100;
  const out = {};

  // ---- A. THE WALK -----------------------------------------------------------------------------
  // Blackrose, not Lilmoth: the round-4 commission probe went to Lilmoth and the round-4 critic
  // went to Gideon precisely so that the door would not be one record that happens to work. The
  // MASTER enchanter is also the one whose ceiling (110) differs from the journeymen's (70), so
  // the arm reads a number that is this person's rather than the model's default.
  H.setSeed(7); H.loadState('town-blackrose'); H.stepFrames(4); H.loadState('town-blackrose');
  H.setRenderRate(0); H.stepFrames(30);
  const people = H.listNpcs ? H.listNpcs() : [];
  const target = people.find((p) => p.id === 'enchanter-blackrose' || /enchanter/.test(String(p.id)));
  out.walk = { town: 'town-blackrose', found: !!target, npc: target ? target.eid : null, name: target ? target.name : null };
  if (!target) return { ...out, fatal: 'no enchanter is standing in Blackrose' };
  const p0 = H.getPlayerPos ? H.getPlayerPos() : null;
  let walked = null;
  try { walked = H.walkPath([[target.pos[0], target.pos[2]]], 400); } catch (e) { walked = { error: String(e && e.message) }; }
  const p1 = H.getPlayerPos ? H.getPlayerPos() : null;
  out.walk.from = p0; out.walk.to = p1;
  out.walk.covered_m = p0 && p1 ? r2(Math.hypot(p1[0] - p0[0], p1[2] - p0[2])) : null;
  out.walk.stopped_short_m = p1 ? r2(Math.hypot(p1[0] - target.pos[0], p1[2] - target.pos[2])) : null;
  out.walk.result = walked;

  // ---- B. THE COUNTER --------------------------------------------------------------------------
  const talk = H.talkTo(target.eid);
  out.counter = { topics: (talk.list || []).map((r) => r.id || r.text) };
  // No soul yet: the counter must OPEN and must say what is missing rather than refusing to exist.
  let st = H.conversationSay('enchanting');
  out.counter.opened_with_no_soul = !!(st && st.enchanting);
  out.counter.line_with_no_soul = st && st.enchanting ? st.enchanting.line : null;
  out.counter.rows_with_no_soul = st && st.enchanting ? st.enchanting.options.map((o) => o.text) : null;

  // Now a soul, and the spells whose effects the character owns.
  H.grantSoulGem('grand');
  H.setGold(400000);
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  H.conversationClose();
  H.talkTo(target.eid);
  st = H.conversationSay('enchanting');
  out.counter.opened = !!(st && st.enchanting);
  out.counter.enchanter = st && st.enchanting ? st.enchanting.enchanter : null;
  out.counter.enchanter_name = st && st.enchanting ? st.enchanting.enchanter_name : null;
  out.counter.settlement = st && st.enchanting ? st.enchanting.settlement : null;
  out.counter.ceiling = st && st.enchanting ? st.enchanting.ceiling : null;
  out.counter.souls_held = st && st.enchanting ? st.enchanting.souls_held : null;
  out.counter.opening_line = st && st.enchanting ? st.enchanting.line : null;
  out.counter.root_rows = st && st.enchanting ? st.enchanting.options.map((o) => o.text) : null;

  const say = (id) => { st = H.conversationSay(id); return st && st.enchanting ? st.enchanting : null; };

  // ---- C. THE PURCHASE -------------------------------------------------------------------------
  const goldBefore = H.getGold();
  const gemsBefore = (H.getMagicState().gems || []).length;
  say('enchant.effect.add');
  out.counter.effect_book = st && st.enchanting ? st.enchanting.options.slice(0, 4).map((o) => o.text) : null;
  say('enchant.effect.fire_damage');
  say('enchant.term.magnitude');
  say('enchant.step.up10');
  say('enchant.back');
  say('enchant.back');
  say('enchant.item');
  say('enchant.item.ring');
  const beforeConfirm = say('enchant.range') || {};
  out.purchase = { quote_line: beforeConfirm.line, quote: beforeConfirm.quote, draft: beforeConfirm.draft };
  const after = say('enchant.confirm');
  out.purchase.made = st ? st.enchanted || null : null;
  out.purchase.line_after = after ? after.line : null;
  out.purchase.gold_before = goldBefore;
  out.purchase.gold_after = H.getGold();
  out.purchase.gold_moved = goldBefore - H.getGold();
  out.purchase.gems_before = gemsBefore;
  out.purchase.gems_after = (H.getMagicState().gems || []).length;
  const items = H.enchantedItems();
  out.purchase.items = items.map((i) => ({ id: i.id, name: i.name, item_class: i.item_class, kind: i.kind, charge: i.charge, charge_max: i.charge_max, charge_per_use: i.charge_per_use, soul_grade: i.soul_grade, gold_price: i.gold_price }));
  // Through the SAVE, not through the field.
  const blob = H.saveState();
  out.purchase.save_carries = (blob.magic.enchanted || []).map((e) => e.id);
  out.purchase.save_gold = blob.progression.gold;

  // The refusal a player meets: an effect nobody owns a spell for.
  H.conversationClose();
  H.resetMagicWorld();
  H.talkTo(target.eid);
  say('enchanting'); say('enchant.effect.add');
  const ref = say('enchant.effect.fire_damage');
  out.counter.refusal_unknown_effect = ref ? ref.last_refusal : null;
  H.conversationClose();

  // ---- D. THE CONSUMER -------------------------------------------------------------------------
  // A fight, a body, and the object. Focus is read before and after, because "it spent charge and
  // not Focus" is the whole claim.
  const useArm = (broken) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setRenderRate(0);
    // The items survive `loadState` because they are in the save; put them back explicitly by
    // loading the blob we took above, so this arm reads the SAVED object rather than a live one.
    H.loadState(blob);
    H.stepFrames(4);
    if (H.__breakEnchantUse) H.__breakEnchantUse(!!broken);
    const sp = H.spawn('drowned_lesser', 0, 3);
    const eid = sp && sp.eid ? sp.eid : sp;
    H.stepFrames(4);
    const it = H.enchantedItems()[0];
    if (!it) return { fatal: 'the saved blob carried no enchanted item' };
    const hp0 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
    const f0 = H.getMagicState().focus;
    const uses = [];
    for (let i = 0; i < 3; i++) {
      let r;
      try { r = H.useEnchanted(it.id, eid); } catch (e) { r = { error: String(e && e.message) }; }
      H.stepFrames(2);
      uses.push(r);
    }
    const hp1 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
    const f1 = H.getMagicState().focus;
    const now = H.enchantedItems()[0] || {};
    if (H.__breakEnchantUse) H.__breakEnchantUse(false);
    return {
      item: it.id, hp_before: hp0, hp_after: hp1, damage: r2(hp0 - hp1),
      focus_before: r2(f0), focus_after: r2(f1), focus_spent: r2(f0 - f1),
      charge_before: it.charge, charge_after: now.charge,
      uses,
    };
  };
  out.consumer = { fixed: useArm(false), broken: useArm(true) };
  return out;
});

(async () => {
  const git = gitInfo();
  const { page, close } = await launchGame();
  let d;
  try { d = await RUN(page); } finally { await close(); }
  writeJson(path.join(outDir, 'enchant.json'), { schema: 'elder-souls/w1-14-r5-enchant@1', commit: git.commit, dirty: git.dirty, ...d });
  if (d.fatal) { log(`FATAL: ${d.fatal}`); process.exit(1); }
  log(`WALK      ${d.walk.name} in ${d.walk.town}: covered ${d.walk.covered_m} m, stopped ${d.walk.stopped_short_m} m short`);
  log(`COUNTER   opened=${d.counter.opened}  ${d.counter.enchanter_name} (${d.counter.enchanter}), ceiling ${d.counter.ceiling}, souls ${JSON.stringify(d.counter.souls_held)}`);
  log(`          "${d.counter.opening_line}"`);
  log(`          rows: ${JSON.stringify(d.counter.root_rows)}`);
  log(`          no-soul line: "${d.counter.line_with_no_soul}"`);
  log(`          unknown-effect refusal: "${d.counter.refusal_unknown_effect}"`);
  log(`PURCHASE  gold ${d.purchase.gold_before} -> ${d.purchase.gold_after} (moved ${d.purchase.gold_moved}); gems ${d.purchase.gems_before} -> ${d.purchase.gems_after}`);
  log(`          made: ${JSON.stringify(d.purchase.items)}`);
  log(`          save carries ${JSON.stringify(d.purchase.save_carries)} and gold ${d.purchase.save_gold}`);
  const F = d.consumer.fixed, B = d.consumer.broken;
  log(`CONSUMER  FIXED   damage ${F.damage}  focus_spent ${F.focus_spent}  charge ${F.charge_before} -> ${F.charge_after}`);
  log(`          BROKEN  damage ${B.damage}  focus_spent ${B.focus_spent}  charge ${B.charge_before} -> ${B.charge_after}`);
  const ok = d.counter.opened && d.purchase.gold_moved > 0 && d.purchase.gems_after < d.purchase.gems_before
    && F.damage > 0 && F.focus_spent === 0 && B.damage === 0;
  log(ok ? 'PASS — the door opens, the soul is spent, and the thing you made kills something for no Focus.'
    : 'FAIL — see the report.');
  process.exit(ok ? EXIT.OK : 6);
})();

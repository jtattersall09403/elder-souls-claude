/**
 * w1-13-r3-levelling.mjs — does a level buy anything, and does the screen speak the character's
 * language? With the fix deleted on every number.
 *
 * `path_to_ten` items 3 and 4 of `corpus/90-verdicts/wave1/W1-13-r2.md`:
 *
 *   3. Make a level buy something. Acceptance: `probe-b.mjs`'s `no-character` arm reports the
 *      same `hp_max` / `stamina_max` / `focus_max` deltas as its `with-character` arm, and
 *      `sim._poolsDirty` returns to `false` after every spend.
 *   4. Make the level-up screen list the character's attributes. Zero rows for an attribute the
 *      character does not carry; zero attributes the character carries missing from the screen;
 *      and `_spendSouls` refuses an id outside the declared set instead of minting it.
 *
 * WHAT ROUND 2 MEASURED, and why this file exists in this shape. On the shipped `default`
 * state — the one round 2 used for its ENTIRE levelling demonstration — 37,652 souls across 24
 * levels moved `hp_max` 620 -> 620, `stamina_max` 120 -> 120, `focus_max` 94 -> 94, with
 * `sim._poolsDirty` left `true` forever, because `Engine.applyDerivedPools()` opened
 * `const ch = this.sim.character; if (!ch) return null;` and `sim.character` is null in every
 * named state in the build. The screen meanwhile listed TEN attributes against a character
 * carrying SIX, in two different vocabularies: seven rows for attributes nothing in the game
 * reads, three real attributes unreachable, and `_spendSouls` minting the fictitious key at 11
 * on confirm.
 *
 * THE ARMS. Every number here is taken twice, in one browser, on identical frames:
 *
 *   A1 `no-character`         — the shipped `default` state. THE ARM THAT FAILED.
 *   A2 `with-character`       — `setCharacter()` first. Round 2's working control.
 *   A3 `no-character/no-fix`  — A1 with `applyDerivedPools` monkeypatched back to its round-2
 *                               body (`if (!this.sim.character) return null`). If the fix is
 *                               the thing that moved the pools, THIS ARM MUST GO BACK TO ZERO.
 *                               If A1 and A3 agree, the fix is inert and must not be claimed —
 *                               which is exactly how round 2's respawn-drift claim died.
 *
 *   V1 vocabulary, live       — the DRAWN rows (`getUIState().elements[].meta.attribute`)
 *                               against `sim.progression.attributes`' own keys, plus a spend of
 *                               an id that is in neither.
 *   V2 vocabulary, fix deleted — the stale six put back into the register by hand. The screen
 *                               must REFUSE to open and the mismatch must be reported.
 *
 * Usage: node tools/harness/w1-13-r3-levelling.mjs [--out <file>]
 */
'use strict';

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r3-levelling.mjs [--out <file>]'); process.exit(0); }

const out = { schema: 'w1-13/r3-levelling@1', taken_at: new Date().toISOString(), arms: [], vocabulary: {} };
let handle;

// The page-side body is shared by all three pool arms so that the only difference between them
// is the two flags. A probe whose arms are separate code is a probe whose arms can drift.
const IDENTITY_ATTRIBUTES = {
  strength: 12, endurance: 20, agility: 10, speed: 10, vigour: 10,
  willpower: 10, intellect: 10, 'hist-bond': 10, personality: 10, luck: 10,
};

// NOTE: `page.evaluate` serialises only its ARGUMENT — this body has no closure over the
// module scope, so `IDENTITY_ATTRIBUTES` is passed in rather than referenced.
const ARM_BODY = async ({ mk, deleteTheFix, forceIdentity, identity }) => {
  const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
  const H = window.__HARNESS;
  let restore = null;
  try {
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    if (deleteTheFix) {
      // THE PERTURBATION: `applyDerivedPools()` exactly as round 2 shipped it.
      const orig = eng.applyDerivedPools;
      restore = () => { eng.applyDerivedPools = orig; };
      eng.applyDerivedPools = function (o) {
        if (!this.sim.character) return null;
        return orig.call(this, o);
      };
    }
    if (mk) {
      try { H.setCharacter({ race: 'saxhleel', class: 'salt-blade', birthsign: 'raj-xul', upbringing: 'interior' }); }
      catch (e) { return { fatal: 'setCharacter failed: ' + String(e.message || e) }; }
      H.stepFrames(2);
    }
    if (forceIdentity) {
      // THE SAME-START CONTROL. `setCharacter()` composes a sheet (endurance 16, intellect 7,
      // personality 6, ...) that stands at a DIFFERENT point of a NON-LINEAR curve from the
      // identity register the characterless state carries — so "the two arms report the same
      // delta" cannot be true of them as they ship, whatever the pool code does. Put the two
      // arms on the same point of the curve and the comparison becomes a real one: with the
      // anchor being a CONSTANT added to an absolute derivation, the DELTA a spend produces
      // must be identical in both, and any residual difference is the birthsign term, which is
      // the one thing the verdict says should apply only when a character exists.
      Object.assign(eng.sim.progression.attributes, identity);
      eng.sim._poolsDirty = true;
      eng.applyDerivedPools({ refill: true, why: 'probe: same-start control' });
      H.stepFrames(2);
    }
    const b0 = H.saveState(); b0.character.souls_held = 400000; H.restoreState(b0); H.stepFrames(1);

    const list = H.listHearths();
    const w = (list.hearths || []).find((x) => x.id === 'hearth-archon') || list.hearths[0];
    H.teleport(w.pos[0], w.pos[2]); H.stepFrames(10);
    H.restAt(w.id); H.stepFrames(2);

    const read = () => {
      const s = H.getPlayerStats();
      const b = eng.combat && eng.combat.player;
      return {
        level: s.level, souls: s.souls, attributes: { ...s.attributes },
        stats_hp_max: s.hp_max, stats_stamina_max: s.stamina_max, stats_focus_max: s.focus_max,
        body_hp_max: b ? b.hpMax : null, body_stamina_max: b ? b.staminaMax : null,
        magic_focus_max: eng.magic ? eng.magic.focusMax : null,
        has_character: !!eng.sim.character,
        pools_dirty: !!eng.sim._poolsDirty,
      };
    };

    const spend = (attrId, times) => {
      const before = read();
      let promised = null;
      const dirtyAfterEach = [];
      for (let n = 0; n < times; n++) {
        H.openMenu('levelup');
        const s = H.getUIState();
        const rows = (s.elements || []).filter((e) => e.kind === 'attribute_row');
        const cur = Math.max(0, rows.findIndex((e) => e.focused));
        const want = rows.findIndex((e) => e.meta && e.meta.attribute === attrId);
        if (want < 0) return { attribute: attrId, refused: 'no such row', rows_offered: rows.map((e) => e.meta && e.meta.attribute) };
        const steps = want - cur, dir = steps >= 0 ? -1 : 1;
        for (let k = 0; k < Math.abs(steps); k++) {
          H.queueInputs([{ f: 0, move: [0, dir] }]); H.stepFrames(1);
          H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
        }
        if (promised === null) {
          const p = (H.getUIState().elements || []).find((e) => e.kind === 'attribute_preview');
          promised = p && p.meta ? p.meta.derived : null;
        }
        for (const k of ['press', 'release', 'press', 'release']) {
          H.queueInputs([{ f: 0, [k]: ['interact'] }]); H.stepFrames(1);
        }
        H.closeMenu();
        H.stepFrames(30);                 // world running, screen closed: S14 cannot be the excuse
        dirtyAfterEach.push(!!eng.sim._poolsDirty);
      }
      H.stepFrames(120);
      const after = read();
      return {
        attribute: attrId, levels_bought: times,
        the_screen_promised: promised,
        before, after,
        souls_spent: before.souls - after.souls,
        attribute_moved: (after.attributes[attrId] || 0) - (before.attributes[attrId] || 0),
        hp_max_moved: after.body_hp_max - before.body_hp_max,
        stamina_max_moved: after.body_stamina_max - before.body_stamina_max,
        focus_max_moved: (after.magic_focus_max || 0) - (before.magic_focus_max || 0),
        pools_dirty_after_each_spend: dirtyAfterEach,
        pools_dirty_ever_stuck: dirtyAfterEach.some(Boolean),
      };
    };

    return {
      at_start: read(),
      vigour: spend('vigour', 8),
      endurance: spend('endurance', 8),
      willpower: spend('willpower', 8),
    };
  } catch (e) {
    return { fatal: String((e && e.stack) || e) };
  } finally {
    if (restore) restore();
  }
};

try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  const arm = async (label, mk, deleteTheFix, forceIdentity) => {
    const r = await h.page.evaluate(ARM_BODY, { mk, deleteTheFix, forceIdentity, identity: IDENTITY_ATTRIBUTES });
    r.arm = label; r.delete_the_fix = !!deleteTheFix; r.same_start_control = !!forceIdentity;
    out.arms.push(r);
    log(`${label.padEnd(34)} has_character=${r.at_start && r.at_start.has_character} `
      + `hp+${r.vigour && r.vigour.hp_max_moved} st+${r.endurance && r.endurance.stamina_max_moved} `
      + `fp+${r.willpower && r.willpower.focus_max_moved}`);
    return r;
  };

  const a1 = await arm('no-character (shipped default)', false, false, false);
  const a2 = await arm('with-character (setCharacter)', true, false, false);
  const a3 = await arm('no-character / FIX DELETED', false, true, false);
  const a4 = await arm('with-character @ IDENTITY (same start)', true, false, true);

  // ---- V1: the two vocabularies, read off the DRAWN elements -------------------------------
  out.vocabulary.live = await h.page.evaluate(async () => {
    const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
    const H = window.__HARNESS;
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    const b0 = H.saveState(); b0.character.souls_held = 400000; H.restoreState(b0); H.stepFrames(1);
    const list = H.listHearths();
    const w = (list.hearths || []).find((x) => x.id === 'hearth-archon') || list.hearths[0];
    H.teleport(w.pos[0], w.pos[2]); H.stepFrames(10); H.restAt(w.id); H.stepFrames(2);

    let opened = null, openError = null;
    try { opened = H.openMenu('levelup'); } catch (e) { openError = String(e.message || e); }
    const s = H.getUIState();
    const drawn = (s.elements || []).filter((e) => e.kind === 'attribute_row')
      .map((e) => e.meta && e.meta.attribute).filter(Boolean);
    const carried = Object.keys(eng.sim.progression.attributes || {});
    H.closeMenu(); H.stepFrames(2);

    // `_spendSouls` with an id in NEITHER vocabulary. Round 2's body was
    // `prog.attributes[id] = (prog.attributes[id] || 10) + 1` with no validation, which is what
    // minted seven fictitious rows at 11 on confirm. The purse must not move either.
    const soulsBefore = eng.sim.progression.soulsHeld;
    let mintError = null, minted = null;
    try { eng._spendSouls('dexterity'); } catch (e) { mintError = String(e.message || e); }
    minted = eng.sim.progression.attributes.dexterity === undefined ? null : eng.sim.progression.attributes.dexterity;
    const soulsAfter = eng.sim.progression.soulsHeld;

    return {
      opened: !!opened, open_error: openError,
      drawn_rows: drawn.slice().sort(),
      carried_attributes: carried.slice().sort(),
      vocabulary_report: typeof eng.attributeVocabulary === 'function' ? eng.attributeVocabulary() : null,
      on_screen_not_carried: drawn.filter((k) => !carried.includes(k)),
      carried_not_on_screen: carried.filter((k) => !drawn.includes(k)),
      undeclared_spend: {
        id: 'dexterity',
        threw: mintError, minted_value: minted,
        souls_before: soulsBefore, souls_after: soulsAfter,
        purse_moved: soulsBefore !== soulsAfter,
      },
    };
  });

  // ---- V2: the vocabulary fix deleted — the stale six put back by hand ----------------------
  out.vocabulary.fix_deleted = await h.page.evaluate(async () => {
    const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
    const H = window.__HARNESS;
    H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
    const b0 = H.saveState(); b0.character.souls_held = 400000; H.restoreState(b0); H.stepFrames(1);
    const list = H.listHearths();
    const w = (list.hearths || []).find((x) => x.id === 'hearth-archon') || list.hearths[0];
    // REST FIRST. `openMenu('levelup')` also refuses off a hearth (RI-UIX03 L1), and a refusal
    // for the wrong reason would score this arm green while proving nothing. Standing at the
    // basin means the ONLY thing left that can refuse is the vocabulary gate, and the error
    // text is checked rather than merely the refusal.
    H.teleport(w.pos[0], w.pos[2]); H.stepFrames(10); H.restAt(w.id); H.stepFrames(2);
    let openedBefore = null;
    try { openedBefore = H.openMenu('levelup'); H.closeMenu(); H.stepFrames(2); } catch { openedBefore = false; }

    // THE PERTURBATION: `sim/state.js`'s round-2 `makeProgression()` register, written straight
    // over the live one. Nothing else is touched.
    eng.sim.progression.attributes = { vigour: 10, endurance: 20, strength: 12, dexterity: 12, intelligence: 10, faith: 10 };
    const rep = typeof eng.attributeVocabulary === 'function' ? eng.attributeVocabulary() : null;
    let opened = null, openError = null;
    try { opened = H.openMenu('levelup'); } catch (e) { openError = String(e.message || e); }
    const mode = H.getUIState().mode;
    try { H.closeMenu(); } catch { /* nothing to close */ }
    return {
      register_forced_to: Object.keys(eng.sim.progression.attributes).sort(),
      opened_at_the_same_basin_BEFORE_the_perturbation: !!openedBefore,
      vocabulary_report: rep,
      opened: !!opened, open_error: openError, ui_mode_after_open_attempt: mode,
      // The gate must refuse, at a hearth, FOR THE VOCABULARY REASON — and it must have opened
      // at that same basin one statement earlier, or the arm is measuring the hearth gate.
      gate_refused: !!openedBefore && !opened && mode !== 'levelup'
        && /speaking different\s+languages/.test(String(openError || '')),
    };
  });

  // ---- verdicts -----------------------------------------------------------------------------
  const moved = (a) => (a && a.vigour && !a.vigour.refused)
    ? { hp: a.vigour.hp_max_moved, st: a.endurance.stamina_max_moved, fp: a.willpower.focus_max_moved }
    : null;
  const m1 = moved(a1), m2 = moved(a2), m3 = moved(a3), m4 = moved(a4);
  const dirtyStuck = (a) => !!(a && a.vigour && !a.vigour.refused
    && (a.vigour.pools_dirty_ever_stuck || a.endurance.pools_dirty_ever_stuck || a.willpower.pools_dirty_ever_stuck));
  out.t3_a_level_buys_something = {
    no_character: m1, with_character: m2, fix_deleted: m3, with_character_same_start: m4,
    pools_dirty_ever_stuck: dirtyStuck(a1),
    pools_dirty_ever_stuck_with_the_fix_deleted: dirtyStuck(a3),
    // DELETE-THE-FIX: the arm without the change must NOT move the pools.
    fix_deleted_moves_nothing: !!(m3 && m3.hp === 0 && m3.st === 0 && m3.fp === 0),
    arms_differ: !!(m1 && m3 && (m1.hp !== m3.hp || m1.st !== m3.st || m1.fp !== m3.fp)),
    // THE HONEST FORM OF THE VERDICT'S ACCEPTANCE. Its literal wording is "the `no-character`
    // arm reports the same hp_max / stamina_max / focus_max deltas as its `with-character`
    // arm". As the two arms SHIP that is not achievable by any pool code: `setCharacter()`
    // composes endurance 16 against the identity register's 20, and the curves are non-linear,
    // so equal deltas would mean the sheet was being ignored. Put both arms on the same point
    // of the curve (`with_character_same_start`) and the comparison is the one the acceptance
    // was reaching for.
    same_deltas_at_the_same_start: !!(m1 && m4 && m1.hp === m4.hp && m1.st === m4.st),
    focus_differs_by_the_birthsign_only: (m1 && m4) ? { no_character: m1.fp, with_character: m4.fp } : null,
    _acceptance_note: 'hp_max and stamina_max deltas must be IDENTICAL between the anchored '
      + '(characterless) arm and the absolute (character) arm at the same attributes, because the '
      + 'anchor is a constant added to an absolute derivation. focus_max is allowed to differ and '
      + 'is EXPECTED to: RI-CHR03\'s birthsign multiplies the reservoir, and the verdict\'s own '
      + 'remedy says to "apply the birthsign terms only when sim.character exists".',
    pass: !!(m1 && m2 && m3 && m4
      && m1.hp > 0 && m1.st > 0 && m1.fp > 0
      && m1.hp === m4.hp && m1.st === m4.st
      && m3.hp === 0 && m3.st === 0 && m3.fp === 0
      && !dirtyStuck(a1) && dirtyStuck(a3)),
  };
  const v = out.vocabulary.live || {};
  out.t4_one_vocabulary = {
    drawn_rows: v.drawn_rows, carried: v.carried_attributes,
    on_screen_not_carried: v.on_screen_not_carried, carried_not_on_screen: v.carried_not_on_screen,
    undeclared_spend_refused: !!(v.undeclared_spend && v.undeclared_spend.minted_value === null && !v.undeclared_spend.purse_moved),
    gate_refuses_a_mismatched_register: !!(out.vocabulary.fix_deleted && out.vocabulary.fix_deleted.gate_refused),
    pass: !!(v.opened
      && (v.on_screen_not_carried || []).length === 0
      && (v.carried_not_on_screen || []).length === 0
      && v.undeclared_spend && v.undeclared_spend.minted_value === null && !v.undeclared_spend.purse_moved
      && out.vocabulary.fix_deleted && out.vocabulary.fix_deleted.gate_refused),
  };
  out.pass = out.t3_a_level_buys_something.pass && out.t4_one_vocabulary.pass;

  log('');
  log(`T3 a level buys something: ${out.t3_a_level_buys_something.pass ? 'PASS' : 'FAIL'}  `
    + `no-char ${JSON.stringify(m1)} · with-char ${JSON.stringify(m2)} · same-start ${JSON.stringify(m4)} · FIX DELETED ${JSON.stringify(m3)}`);
  log(`T4 one vocabulary:         ${out.t4_one_vocabulary.pass ? 'PASS' : 'FAIL'}  `
    + `on_screen_not_carried=${JSON.stringify(v.on_screen_not_carried)} carried_not_on_screen=${JSON.stringify(v.carried_not_on_screen)}`);
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  log('FATAL ' + out.fatal);
} finally {
  if (handle) await handle.close().catch(() => {});
}
writeJson(String(args.out || 'reports/runs/W1-13-R3/levelling.json'), out);
process.exit(out.pass ? 0 : 1);

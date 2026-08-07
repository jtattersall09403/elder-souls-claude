#!/usr/bin/env node
/**
 * critic-w1-13-r2-b.mjs — W1-13 round-2 CRITIC probe B: DOES THE SPEND BUY ANYTHING?
 *
 * Round 1's gap was that the level-up screen could not be opened. Round 2 opened it and proved
 * that souls leave the purse. This probe asks the next question, which is the only one the
 * player cares about: after the souls have gone, IS THE CHARACTER DIFFERENT?
 *
 * The observable is the pool the fight actually uses — `hp_max`, `stamina_max`, `focus_max` —
 * read off the LIVE world and off the COMBAT BODY (`combat.player.hpMax`), which
 * `Engine.applyDerivedPools()`'s own header calls "the authority", after the world has been
 * stepped with the screen closed so S14's pause cannot be the excuse.
 *
 * Each spend is put through the screen's OWN PREVIEW first (`levelup.preview.meta.derived`,
 * the numbers the player is shown before confirming), so the comparison is between what the
 * interface promised and what arrived.
 *
 * FALSIFIABILITY. Two arms, same probe, same browser, same frames:
 *   arm `no-character` — the shipped `default` state, which is what every named state, every
 *                        scenario and the round-2 builder's own levelling probe uses.
 *   arm `with-character` — a character written down through `setCharacter()` first.
 * If the instrument were broken, both arms would read the same. They must not.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r2-b.mjs [--out <file>]'); process.exit(0); }

const out = { schema: 'critic/w1-13-r2-b@1', taken_at: new Date().toISOString(), arms: [] };
let handle;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  const arm = async (label, makeCharacter) => {
    const r = await h.page.evaluate(async ({ mk }) => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
      if (mk) {
        // The route the game itself uses at the end of the census: a written-down character.
        try { H.setCharacter({ race: 'saxhleel', class: 'salt-blade', birthsign: 'raj-xul' }); }
        catch (e) { return { label: 'setCharacter failed', why: String(e.message || e) }; }
        H.stepFrames(2);
      }
      const b0 = H.saveState(); b0.character.souls_held = 400000; H.restoreState(b0); H.stepFrames(1);

      const list = H.listHearths();
      const w = (list.hearths || []).find((x) => x.id === 'hearth-archon');
      H.teleport(w.pos[0], w.pos[2]); H.stepFrames(10);
      H.restAt('hearth-archon'); H.stepFrames(2);

      const read = () => {
        const s = H.getPlayerStats();
        const b = eng.combat && eng.combat.player;
        return {
          level: s.level, souls: s.souls, attributes: { ...s.attributes },
          stats_hp_max: s.hp_max, stats_stamina_max: s.stamina_max, stats_focus_max: s.focus_max,
          body_hp_max: b ? b.hpMax : null, body_stamina_max: b ? b.staminaMax : null,
          magic_focus_max: eng.magic ? eng.magic.focusMax : null,
          sim_pools: eng.sim.pools ? { hp_max: eng.sim.pools.hp_max, stamina_max: eng.sim.pools.stamina_max } : null,
          has_character: !!eng.sim.character,
          pools_dirty: !!eng.sim._poolsDirty,
        };
      };

      const spend = (attrId, times) => {
        const before = read();
        let promised = null;
        for (let n = 0; n < times; n++) {
          H.openMenu('levelup');
          const s = H.getUIState();
          const rows = (s.elements || []).filter((e) => e.kind === 'attribute_row');
          const cur = Math.max(0, rows.findIndex((e) => e.focused));
          const want = rows.findIndex((e) => e.meta && e.meta.attribute === attrId);
          if (want < 0) return { attribute: attrId, refused: 'no such row' };
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
          H.stepFrames(30);          // world running, screen closed: S14 cannot be the excuse
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
        };
      };

      return {
        at_start: read(),
        vigour: spend('vigour', 8),
        endurance: spend('endurance', 8),
        willpower: spend('willpower', 8),
      };
    }, { mk: makeCharacter });
    r.arm = label;
    out.arms.push(r);
    log(`${label}: has_character=${r.at_start && r.at_start.has_character} `
      + `hp+${r.vigour && r.vigour.hp_max_moved} st+${r.endurance && r.endurance.stamina_max_moved} `
      + `fp+${r.willpower && r.willpower.focus_max_moved}`);
  };

  await arm('no-character (the shipped default state)', false);
  await arm('with-character (setCharacter first)', true);
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  log('FATAL ' + out.fatal);
} finally {
  if (handle && handle.close) await handle.close();
}
writeJson(String(args.out || 'reports/runs/critic-W1-13-R2/probe-b.json'), out);
log('written');

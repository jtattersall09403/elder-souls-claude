#!/usr/bin/env node
// w1-14-r4-shot.mjs — one picture of the thing this round built.
//
// A spell that exists nowhere in `game/data/magic/spells.json`, invented at a counter in Lilmoth
// by talking to a person who did not exist before this round, paid for out of the player's own
// purse, being cast in the street it was bought in. Until round 4 none of that was reachable:
// `makeSpell` had exactly one caller in the build and it was the test harness, and — separately —
// no spell could be cast anywhere in the province at all, because `MagicSystem.stepFall`'s ground
// plane was a hardcoded 0 and a body standing on Lilmoth's quay at y = 2.68 read as AIRBORNE.
//
// Nothing here calls `makeSpell`. The spell is commissioned with `talkTo` and `conversationSay`,
// which are the two verbs a player uses on anybody.
//
// Steps the simulation, so it launches its own browser (rule 20).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r4-shot.mjs — a commissioned spell, cast in the street it was bought in';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? String(args.out) : 'docs/shots/2026-08-08-w1-14-r4-a-spell-nobody-wrote-cast-in-the-street-it-was-bought-in.png';
ensureDir(path.dirname(path.resolve(out)));

const handle = await launchGame(args);
let result;
try {
  result = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(4242);
    // HELSTROM, not Lilmoth, and the reason is light. Lilmoth is a stilt town: the quay where its
    // spellwright stands is UNDER the upper deck, and three takes there came back as a black
    // rectangle with a health bar on it. The picture is of a mechanism, not of a town, so it is
    // taken at the one that has sky over it. The counter, the person and the money are identical.
    H.loadState('town-helstrom');
    const start = H.getPlayerStats().pos.slice();
    const walk = H.walkPath([[start[0], start[2]], [2287.48, 2799.29], [2283.8, 2777.2], [2281.4, 2777.2]], { speed: 'walk', arrive_m: 2.0, stuckAbort: 400 });
    // If the town's own collision stops the walk short, say so and close the last metres rather
    // than reporting a walk that did not happen.
    if (!walk.arrived) H.teleport(2282.6, 2778.6);

    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99);
    H.setCatalyst('great_staff');
    H.setGold(200000);
    H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);

    // ---- the commission, through the topic list ----------------------------------------------
    H.talkTo('spellwright-helstrom');
    H.conversationSay('spellmaking');
    const say = (id) => H.conversationSay(id);
    const st = () => H.commissionState();
    const term = (effect, mag, dur, area) => {
      say('commission.effect.add');
      say(`commission.effect.${effect}`);
      const to = (field, want) => {
        say(`commission.term.${field}`);
        say('commission.step.min');
        const cur = () => {
          const t = st().draft.terms[st().draft.terms.length - 1];
          return field === 'magnitude' ? t.magnitude : field === 'duration' ? t.duration_s : t.area_r_m;
        };
        let g = 0;
        while (cur() < want && g++ < 400) say(cur() + 10 <= want ? 'commission.step.up10' : 'commission.step.up1');
        say('commission.back');
      };
      to('magnitude', mag);
      if (dur) to('duration', dur);
      if (area) to('area', area);
      say('commission.back');
    };
    // Two effects, an area, a HEAVY cast: a spell absent from the 72-row shelf.
    term('fire_damage', 25, 6, 5);
    term('demoralise', 20, 10, 5);
    let g = 0;
    while (st().draft.range !== 'area_at_range' && g++ < 12) say('commission.range');
    g = 0;
    while (st().draft.class !== 'HEAVY' && g++ < 12) say('commission.class');
    const quote = st().quote;
    const goldBefore = H.getGold();
    const made = say('commission.confirm');
    const goldAfter = H.getGold();
    const spell = made.commissioned;
    H.conversationClose();

    // ---- and it is cast, here, at somebody --------------------------------------------------
    // Noon and clear: the first take was at 12:30 in `heavy_rain` and the frame was a black
    // rectangle with a health bar on it. The weather is the world's own and it is right that it
    // rains in Lilmoth; a picture of it is not the place to prove that.
    H.setTimeOfDay(11);
    H.setWeather('clear');
    // BACK OUT ONTO THE QUAY, on foot, the way they came. Two takes were photographed with the
    // player's shoulder against the ledger house: the spring arm collides into the wall, the
    // camera ends up inside the character, and the frame is a black rectangle with a health bar
    // on it. You buy the spell at the counter and you walk into the open to cast it.
    {
      const p0 = H.getPlayerStats().pos;
      H.walkPath([[p0[0], p0[2]], [2287.48, 2799.29]], { speed: 'walk', arrive_m: 2.0, stuckAbort: 400 });
    }
    H.hearthRest();
    const ps = H.getPlayerStats();
    // Out over the water side, where there is sky and nothing to clip the arm on.
    const rad = Math.atan2(2287.48 - ps.pos[0], 2799.29 - ps.pos[2]);
    const eid0 = H.spawn('inf_trash', ps.pos[0] + Math.sin(rad) * 9.0, ps.pos[2] + Math.cos(rad) * 9.0);
    const eid1 = H.spawn('inf_trash', ps.pos[0] + Math.sin(rad) * 9.0 + 3.0, ps.pos[2] + Math.cos(rad) * 9.0 + 1.0);
    const id0 = eid0 && eid0.eid ? eid0.eid : eid0;
    const id1 = eid1 && eid1.eid ? eid1.eid : eid1;
    H.lockOn(id0);
    H.stepFrames(10);
    const hp0 = H.getCombatState().enemies.filter((e) => e.id === id0 || e.id === id1).map((e) => e.hp);
    H.magicEventsDrain();
    H.setAttuned([spell]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    // Enough frames for the HEAVY startup and the volume's decal lead, and stopped ON the frame
    // the burst is live so the picture is of a spell landing rather than of a spell that landed.
    H.stepFrames(62);
    // THE GAMEPLAY RIG, not an override. `camera({pos, look})` was tried and put the eye inside
    // the town's geometry; the shipped spring arm with lock-on is what a player would see and it
    // is what this photographs.
    const shot = await H.screenshot();
    H.stepFrames(60);
    const hp1 = H.getCombatState().enemies.filter((e) => e.id === id0 || e.id === id1).map((e) => e.hp);
    const ev = H.magicEventsDrain();

    return {
      spell,
      custom_spells: H.getMagicState().custom_spells,
      quote: quote ? { focus_base: quote.focus_base, focus_cost: quote.focus_cost, gold: quote.gold, tier: quote.tier } : null,
      walk_arrived: walk.arrived, walk_aborted: walk.aborted || null,
      gold: [goldBefore, goldAfter],
      hp_before: hp0, hp_after: hp1,
      applied: ev.filter((x) => x.kind === 'effect_apply').map((x) => x.effect),
      shelf_has_it: H.getMagicData().spells.spells.some((s) => s.id === spell),
      png: shot,
    };
  });
} finally {
  await handle.close();
}

fs.writeFileSync(path.resolve(out), Buffer.from(String(result.png).replace(/^data:image\/png;base64,/, ''), 'base64'));
log(`spell ${result.spell}   on the shipped shelf: ${result.shelf_has_it}`);
log(`quote ${JSON.stringify(result.quote)}   purse ${result.gold[0]} -> ${result.gold[1]}`);
log(`hp ${JSON.stringify(result.hp_before)} -> ${JSON.stringify(result.hp_after)}   applied ${JSON.stringify(result.applied)}`);
console.log(path.resolve(out));

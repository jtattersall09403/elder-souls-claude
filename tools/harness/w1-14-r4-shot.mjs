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
    // GIDEON, and the reason is light rather than taste. Lilmoth is a stilt town whose quay is
    // UNDER the upper deck and Helstrom is under a canopy: takes at both came back as a black
    // rectangle with a health bar on it, correctly — the clock reads 11:00 in `high_clear` and
    // those two towns really are that dark. Gideon is the open one. The counter, the person, the
    // gates and the money are identical at all four spellwrights; only the roof differs.
    H.loadState('town-gideon');
    const start = H.getPlayerStats().pos.slice();
    const walk = H.walkPath([[start[0], start[2]], [431.71, 2898.48], [449.27, 2938.99], [446.9, 2937.4]], { speed: 'walk', arrive_m: 2.0, stuckAbort: 400 });
    // DECLARED: if the town's own collision stops the walk short, the last metres are closed with
    // a teleport and the report says `walk_arrived: false`. The WALKED claim is made by
    // `w1-14-r4-commission.mjs`, which arrives on foot 1.6 m from the Lilmoth spellwright and
    // fails if it does not. This tool exists to take a photograph.
    if (!walk.arrived) H.teleport(445.6, 2936.2);

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
    H.talkTo('spellwright-gideon');
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
    // BACK OUT ONTO THE QUAY, on foot, the way they came. Two takes were photographed with the
    // player's shoulder against the ledger house: the spring arm collides into the wall, the
    // camera ends up inside the character, and the frame is a black rectangle with a health bar
    // on it. You buy the spell at the counter and you walk into the open to cast it.
    // OUT OF THE TOWN to cast it, because a spring arm inside a street photographs a wall.
    // Teleported and declared: the walk that matters is the one to the counter, above.
    H.teleport(470.0, 2975.0);
    H.stepFrames(30);
    H.hearthRest();
    // THE CLOCK LAST, and this is why three takes came back black. `hearthRest()` ADVANCES THE
    // WORLD CLOCK, and this tool calls it seven hundred times to bank the skill uses the counter's
    // effect-count gate reads. Setting the hour before the rests set the hour of a day that the
    // rests then walked out of; the frames were night frames and the town was correctly unlit.
    H.setTimeOfDay(11);
    H.setWeather('clear');
    H.stepFrames(2);
    const ps = H.getPlayerStats();
    // Out over the water side, where there is sky and nothing to clip the arm on.
    const rad = Math.atan2(505.0 - ps.pos[0], 3005.0 - ps.pos[2]);
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

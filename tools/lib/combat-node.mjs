// combat-node.mjs — build a CombatSystem in bare Node, from the same modules the game runs.
//
// WHY THIS EXISTS. Every W1-09 measurement to date has gone through headless Chromium, which
// costs ~20 s per launch and takes the whole of engine.js, the renderer, the world, magic and
// character creation with it. That is the right instrument for a verdict (it measures the
// shipping game) and the wrong one for a geometry sweep of 41 distances x 14 attacks, which is
// 574 fights.
//
// This module imports `game/src/combat/*.js` **directly, unmodified**. It is not a
// reimplementation and it must never become one: if a number measured here disagrees with the
// same number measured through `window.__HARNESS`, the disagreement is a defect in this file
// and the browser wins. `cmb-reach.mjs --verify` runs a sample of rows through both and fails
// if they differ, so the claim is checked rather than asserted.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CombatSystem } from '../../game/src/combat/system.js';
import { InputPipeline } from '../../game/src/input/pipeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const GAME_DATA = path.resolve(HERE, '../../game/data');

const PLAYER_CONST = {
  walk_mps: 2.0, jog_mps: 4.4, sprint_mps: 6.6, turn_rate_dps: 480,
};

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

/** Every game/data/combat/** file plus the spine movesets, in the shape CombatSystem wants. */
export function loadCombatData(root = GAME_DATA) {
  const combat = {};
  for (const f of fs.readdirSync(path.join(root, 'combat'))) {
    if (!f.endsWith('.json')) continue;
    combat[f.replace(/\.json$/, '')] = readJson(path.join(root, 'combat', f));
  }
  const movesets = {};
  for (const f of fs.readdirSync(path.join(root, 'combat/spine'))) {
    if (!f.endsWith('.json')) continue;
    const doc = readJson(path.join(root, 'combat/spine', f));
    movesets[doc.id] = doc;
  }
  const enemies = {};
  for (const f of fs.readdirSync(path.join(root, 'combat/enemies'))) {
    if (!f.endsWith('.json')) continue;
    const doc = readJson(path.join(root, 'combat/enemies', f));
    enemies[doc.id] = doc;
  }
  // W1-10's 87-weapon roster, class table and clip registry. The FIGHT reads these — see
  // Engine._combatData(). Loading them here is what keeps this arena the same game.
  const weaponMovesets = {}, spellMovesets = {};
  const msDir = path.join(root, 'combat/movesets');
  if (fs.existsSync(msDir)) {
    for (const f of fs.readdirSync(msDir)) {
      if (!f.endsWith('.json')) continue;
      const doc = readJson(path.join(msDir, f));
      if (doc.spell_id) spellMovesets[doc.spell_id] = doc;
      else if (doc.weapon_id) weaponMovesets[doc.weapon_id] = doc;
    }
  }
  const weapons = {};
  const wDir = path.join(root, 'weapons');
  if (fs.existsSync(wDir)) {
    for (const f of fs.readdirSync(wDir)) {
      if (!f.endsWith('.json')) continue;
      weapons[f.replace(/\.json$/, '')] = readJson(path.join(wDir, f));
    }
  }
  return {
    weaponMovesets,
    weaponClasses: weapons.classes,
    clipRegistry: weapons['clip-registry'],
    offhand: weapons.offhand,
    frames: combat.frames, roll: combat.roll, stamina: combat.stamina, poise: combat.poise,
    hitgeometry: combat.hitgeometry, lockon: combat.lockon, flask: combat.flask,
    parley: combat.parley, skeleton: combat.skeleton, clips: combat.clips,
    movesets, _enemies: enemies, input: combat.input,
    locomotion: {
      walk_mps: PLAYER_CONST.walk_mps, jog_mps: PLAYER_CONST.jog_mps,
      sprint_mps: PLAYER_CONST.sprint_mps, turn_rate_dps: PLAYER_CONST.turn_rate_dps,
      turn_rate_moving_dps: 720, turn_rate_stationary_dps: 480,
      turn_in_place_threshold_deg: 100, turn_in_place_frames: 18,
      move_deadzone: 0.15, walk_run_threshold: 0.55,
    },
  };
}

/** The minimal `sim` and `bus` the combat step needs. */
export class NodeArena {
  constructor(opts = {}) {
    this.d = opts.data || loadCombatData(opts.root);
    this.cs = new CombatSystem(this.d);
    this.sim = { frame: 0, hitstopUntil: 0 };
    this.events = [];
    this.bus = {
      emit: (f, kind) => { const e = { f, kind }; this.events.push(e); return e; },
    };
    this.frame = 0;
    this.input = new InputPipeline();
    this.input.reset(0);
    this.player = this.cs.createPlayer(opts.loadout || { weapon: 'straight-sword' });
    // W1-10's MovesetLibrary path reads `player.weaponId`, which only `rebuildPlayerLoadout()`
    // assigns; `createPlayer()` does not. In the browser the boot sequence happens to call
    // setLoadout() and paper over it. Calling it here keeps this arena on the same code path
    // rather than assigning the field behind the system's back.
    if (this.cs.lib && this.player.weaponId === undefined) this.cs.rebuildPlayerLoadout({});
  }

  spawn(id, statId, x, z, yaw) {
    const stat = this.d._enemies[statId];
    if (!stat) throw new Error(`no enemy archetype '${statId}'`);
    return this.cs.spawnEnemy(id, stat, x, z, yaw);
  }

  script(eid, entries) { this.cs.enemies.get(eid).loadScript(entries, this.frame); }

  queueInputs(script) { this.input.queueInputs(script, this.frame); }

  lockOn(id) { this.cs.setLock(id); }

  /** One fixed step. Latches the scripted input exactly as the engine's step does. */
  step() {
    this.frame++;
    this.sim.frame = this.frame;
    this.input.latchForStep(this.frame);
    this.cs.step(this.frame, this.input, null, this.bus, this.sim);
    return this.frame;
  }

  drain() { const e = this.events; this.events = []; return e; }
}

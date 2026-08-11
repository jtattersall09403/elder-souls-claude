// S44 AQ-02 camera-consumption matrix. Uses the exact fixed-step consumer with pooled events.
'use strict';
import { EventBus } from '../../game/src/sim/events.js';
import { SimState } from '../../game/src/sim/state.js';
import { consumePlayerDamageShake } from '../../game/src/sim/step.js';

const cases = [
  ['player_takes_damage', [{ type: 'IMPACT', src: 'E', dst: 'P', dmg: 20 }], true],
  ['player_deals_damage', [{ type: 'IMPACT', src: 'P', dst: 'E', dmg: 20 }], false],
  ['whiff', [{ type: 'WHIFF', src: 'P' }], false],
  ['block_with_chip', [{ type: 'BLOCK', src: 'E', dst: 'P' }, { type: 'IMPACT', src: 'E', dst: 'P', dmg: 2 }], false],
  ['parry', [{ type: 'PARRY', src: 'P', dst: 'E' }], false],
  ['enemy_death', [{ type: 'DEATH', who: 'E', by: 'P' }], false],
  ['landing', [{ type: 'world_landed', who: 'P' }], false],
];

const rows = [];
for (const [name, events, expected] of cases) {
  const sim = new SimState(); sim.frame = 100;
  const combat = { player: { id: 'P', hpMax: 100 } };
  const bus = new EventBus();
  for (const src of events) {
    const e = bus.emit(sim.frame, src.type);
    for (const [k, v] of Object.entries(src)) if (k !== 'type') e[k] = v;
  }
  const consumed = consumePlayerDamageShake(sim, combat, bus);
  rows.push({ name, expected, consumed, amp_deg: sim.camera.shakeAmp,
    pass: consumed === expected && ((sim.camera.shakeAmp > 0) === expected) });
}

// Delete/disconnect control: no consumer call leaves the authorised arm observably zero.
const disconnected = new SimState(); disconnected.frame = 100;
const disconnectRed = disconnected.camera.shakeAmp === 0;
const pass = rows.every((r) => r.pass) && disconnectRed;
console.log(JSON.stringify({ authority: 'S44 AQ-02', rows, disconnect_control_authorised_goes_red: disconnectRed, pass }, null, 2));
if (process.argv.includes('--gate') && !pass) process.exit(1);

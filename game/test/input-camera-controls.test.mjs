import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { GamepadRouter } from '../src/input/gamepad.js';
import { InputPipeline } from '../src/input/pipeline.js';
import { TouchInput } from '../src/input/touch.js';

const profiles = JSON.parse(await readFile(new URL('../data/input/profiles.json', import.meta.url)));
const quirks = JSON.parse(await readFile(new URL('../data/input/pad-quirks.json', import.meta.url)));

test('mobile camera drag reverses the old direction on both axes', () => {
  const pipe = new InputPipeline();
  const touch = new TouchInput(pipe, null, profiles);
  touch.setViewport(844, 390, 1);

  assert.equal(touch.down(1, 500, 200), 'camera');
  touch.move(1, 520, 180);

  assert.equal(pipe.lookX, -20 * profiles.touch.camera.deg_per_css_px_yaw,
    'a rightward swipe must use the right-turn camera sign');
  assert.equal(pipe.lookY, -20 * profiles.touch.camera.deg_per_css_px_pitch,
    'an upward swipe must use the look-up camera sign');
});

test('GameSir right stick owns both camera axes and cannot trigger parry', () => {
  const pipe = new InputPipeline();
  const router = new GamepadRouter(pipe, profiles, quirks);
  const buttons = Array.from({ length: 18 }, () => ({ value: 0, pressed: false }));
  const pad = {
    id: 'GameSir-X2s Type-C (Vendor: 3537 Product: 1004)',
    index: 0,
    mapping: '',
    connected: true,
    buttons,
    // left x/y, right x/y, left/right trigger. Right stick is up and right.
    axes: [0, 0, 0.8, -0.7, -1, -1],
  };

  const snap = router.normalise(pad);
  assert.deepEqual(snap.axes, [0, 0, 0.8, -0.7]);
  assert.equal(snap.values[6], 0, 'right-stick Y must not leak into the parry trigger');

  router.poll([pad], 1);
  assert.ok(pipe.lookX < 0, 'right-stick X must use the reversed horizontal camera sign');
  assert.ok(pipe.lookY < 0, 'right-stick up must use the look-up camera sign');
  assert.equal(pipe.pendingPress, 0, 'moving the right stick must not emit any action edge');
});

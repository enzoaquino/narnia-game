import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dpadDirections, TOUCH_CODES } from '../src/engine/touch.js';
import { Input } from '../src/engine/input.js';

const R = 50; // D-pad radius used in these tests

test('inside the dead zone means no direction', () => {
  assert.deepEqual(dpadDirections(0, 0, R), []);
  assert.deepEqual(dpadDirections(R * 0.2, -R * 0.1, R), []);
});

test('straight out from the centre gives one direction', () => {
  assert.deepEqual(dpadDirections(0, -40, R), ['up']);
  assert.deepEqual(dpadDirections(0, 40, R), ['down']);
  assert.deepEqual(dpadDirections(-40, 0, R), ['left']);
  assert.deepEqual(dpadDirections(40, 0, R), ['right']);
});

test('a little off-axis still counts as straight', () => {
  assert.deepEqual(dpadDirections(10, -40, R), ['up']); // ~14 degrees off
  assert.deepEqual(dpadDirections(40, 12, R), ['right']);
});

test('the diagonals give two directions', () => {
  assert.deepEqual(dpadDirections(30, -30, R).sort(), ['right', 'up']);
  assert.deepEqual(dpadDirections(-30, 30, R).sort(), ['down', 'left']);
  assert.deepEqual(dpadDirections(-30, -30, R).sort(), ['left', 'up']);
  assert.deepEqual(dpadDirections(30, 30, R).sort(), ['down', 'right']);
});

test('sliding past the edge of the pad keeps the direction', () => {
  assert.deepEqual(dpadDirections(0, -500, R), ['up']);
});

test('touch codes drive the same actions as the keyboard', () => {
  const input = new Input();
  input.keyDown(TOUCH_CODES.up);
  input.keyDown(TOUCH_CODES.sword);
  assert.ok(input.isDown('up'));
  assert.ok(input.wasPressed('attack'));
  input.keyDown(TOUCH_CODES.talk);
  assert.ok(input.wasPressed('interact'));
  input.keyUp(TOUCH_CODES.up);
  assert.ok(!input.isDown('up'));
  for (const dir of ['down', 'left', 'right']) {
    input.keyDown(TOUCH_CODES[dir]);
    assert.ok(input.isDown(dir), dir);
  }
});

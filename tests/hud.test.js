import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heartStates } from '../src/game/hud.js';

test('heartStates turns half-heart health into heart icons', () => {
  assert.deepEqual(heartStates(6, 6), ['full', 'full', 'full']);
  assert.deepEqual(heartStates(5, 6), ['full', 'full', 'half']);
  assert.deepEqual(heartStates(3, 6), ['full', 'half', 'empty']);
  assert.deepEqual(heartStates(0, 6), ['empty', 'empty', 'empty']);
});

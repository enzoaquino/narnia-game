import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facingFromVector, chooseFacing } from '../src/game/direction.js';

test('facingFromVector picks the dominant axis', () => {
  assert.equal(facingFromVector(1, 0.5), 'right');
  assert.equal(facingFromVector(-1, 0), 'left');
  assert.equal(facingFromVector(0.2, 1), 'down');
  assert.equal(facingFromVector(0, -1), 'up');
});

test('chooseFacing follows a single held direction', () => {
  assert.equal(chooseFacing('down', 1, 0), 'right');
  assert.equal(chooseFacing('down', 0, -1), 'up');
});

test('chooseFacing keeps the current facing when it is one of two held directions', () => {
  assert.equal(chooseFacing('up', 1, -1), 'up');
  assert.equal(chooseFacing('left', -1, 1), 'left');
});

test('chooseFacing prefers horizontal when moving diagonally away from the current facing', () => {
  assert.equal(chooseFacing('down', 1, -1), 'right');
});

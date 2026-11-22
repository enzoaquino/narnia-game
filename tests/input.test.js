import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/engine/input.js';

test('arrow keys and WASD map to the same actions', () => {
  const input = new Input();
  input.keyDown('ArrowLeft');
  assert.equal(input.isDown('left'), true);
  input.keyUp('ArrowLeft');
  assert.equal(input.isDown('left'), false);
  input.keyDown('KeyA');
  assert.equal(input.isDown('left'), true);
  for (const [code, action] of [['KeyW', 'up'], ['KeyS', 'down'], ['KeyD', 'right'], ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowRight', 'right']]) {
    input.keyDown(code);
    assert.equal(input.isDown(action), true, code);
  }
});

test('an action stays down while either of its keys is held', () => {
  const input = new Input();
  input.keyDown('ArrowLeft');
  input.keyDown('KeyA');
  input.keyUp('ArrowLeft');
  assert.equal(input.isDown('left'), true);
  input.keyUp('KeyA');
  assert.equal(input.isDown('left'), false);
});

test('Space attacks, E and Enter interact, N starts a new game', () => {
  const input = new Input();
  input.keyDown('Space');
  input.keyDown('KeyE');
  input.keyDown('KeyN');
  assert.equal(input.wasPressed('attack'), true);
  assert.equal(input.wasPressed('interact'), true);
  assert.equal(input.wasPressed('newGame'), true);
  input.endFrame();
  input.keyDown('Enter');
  assert.equal(input.wasPressed('interact'), true);
});

test('wasPressed lasts until endFrame and is not repeated while held', () => {
  const input = new Input();
  input.keyDown('Space');
  assert.equal(input.wasPressed('attack'), true);
  input.endFrame();
  assert.equal(input.wasPressed('attack'), false);
  input.keyDown('Space'); // keyboard auto-repeat sends keydown again while held
  assert.equal(input.wasPressed('attack'), false);
  assert.equal(input.isDown('attack'), true);
});

test('keyDown reports whether the game uses the key', () => {
  const input = new Input();
  assert.equal(input.keyDown('KeyE'), true);
  assert.equal(input.keyDown('KeyQ'), false);
});

test('clear releases everything', () => {
  const input = new Input();
  input.keyDown('ArrowUp');
  input.clear();
  assert.equal(input.isDown('up'), false);
  assert.equal(input.wasPressed('up'), false);
});

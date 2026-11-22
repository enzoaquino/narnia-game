import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wolf } from '../src/game/enemies.js';
import { WOLF, STEP, TILE } from '../src/config.js';
import { gridSolid, seqRng, run } from './helpers.js';

const FIELD = gridSolid([
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
]);
const FAR_AWAY = { center: () => ({ x: 5000, y: 5000 }) };

test('a wolf starts at full health, centered in its tile', () => {
  const w = Wolf.atTile(3, 3, seqRng([0]));
  assert.equal(w.x, 3 * TILE + 2);
  assert.equal(w.y, 3 * TILE + 2);
  assert.equal(w.health, WOLF.health);
  assert.equal(w.dead, false);
});

test('wanders in the direction chosen by rng when the player is far away', () => {
  // 0.3 * 5 options → index 1 = right; 0.99 makes the wander timer long
  const w = Wolf.atTile(3, 3, seqRng([0.3, 0.99]));
  const x0 = w.x;
  run(30, () => w.update(STEP, FAR_AWAY, FIELD));
  assert.ok(w.x > x0);
  assert.equal(w.state, 'wander');
  assert.equal(w.facing, 'right');
});

test('chases the player when within chaseRadius', () => {
  const w = Wolf.atTile(3, 3, seqRng([0]));
  const start = w.center();
  const target = { x: start.x + 40, y: start.y };
  const player = { center: () => target };
  run(10, () => w.update(STEP, player, FIELD));
  assert.equal(w.state, 'chase');
  assert.ok(Math.hypot(target.x - w.center().x, target.y - w.center().y) < 40);
});

test('does not walk through walls', () => {
  // 0.5 * 5 → index 2 = left
  const w = Wolf.atTile(1, 3, seqRng([0.5]));
  run(120, () => w.update(STEP, FAR_AWAY, FIELD));
  assert.equal(w.x, TILE);
});

test('a hit removes health and knocks back; hits during hurtTime are ignored', () => {
  const w = Wolf.atTile(5, 3, seqRng([0]));
  const x0 = w.x;
  assert.equal(w.hurt(1, w.x - 10, w.y + w.h / 2), true);
  assert.equal(w.health, WOLF.health - 1);
  assert.equal(w.hurt(1, 0, 0), false);
  run(5, () => w.update(STEP, FAR_AWAY, FIELD));
  assert.ok(w.x > x0, 'knocked to the right');
});

test('two hits defeat a wolf, and a defeated wolf stops', () => {
  const w = Wolf.atTile(5, 3, seqRng([0.3, 0.99]));
  w.hurt(1, 0, 0);
  run(Math.ceil(WOLF.hurtTime / STEP) + 1, () => w.update(STEP, FAR_AWAY, FIELD));
  assert.equal(w.hurt(1, 0, 0), true);
  assert.equal(w.dead, true);
  const x = w.x;
  run(10, () => w.update(STEP, FAR_AWAY, FIELD));
  assert.equal(w.x, x);
  assert.equal(w.hurt(1, 0, 0), false);
});

test('spriteName reflects facing', () => {
  const w = Wolf.atTile(3, 3, seqRng([0.3, 0.99]));
  w.update(STEP, FAR_AWAY, FIELD);
  assert.match(w.spriteName(), /^wolf_right_[01]$/);
});

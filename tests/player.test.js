import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/game/player.js';
import { PLAYER, STEP, TILE } from '../src/config.js';
import { gridSolid, fakeInput, run } from './helpers.js';

const FIELD = gridSolid([
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '##########',
]);
const NONE = fakeInput();
const hold = (...down) => fakeInput({ down });
const press = (...pressed) => fakeInput({ pressed });
const newPlayer = () => Player.atTile(4, 3, 'down');

test('atTile centers the collision box in the tile', () => {
  const p = Player.atTile(4, 3, 'left');
  assert.equal(p.x, 4 * TILE + 2);
  assert.equal(p.y, 3 * TILE + 2);
  assert.equal(p.facing, 'left');
  assert.equal(p.health, PLAYER.maxHealth);
});

test('moves at PLAYER.speed and faces the direction of travel', () => {
  const p = newPlayer();
  const x0 = p.x;
  run(30, () => p.update(STEP, hold('right'), FIELD));
  assert.ok(Math.abs(p.x - x0 - PLAYER.speed * 0.5) < 0.01, `moved ${p.x - x0}`);
  assert.equal(p.facing, 'right');
  assert.equal(p.moving, true);
});

test('diagonal movement is not faster than straight movement', () => {
  const p = newPlayer();
  const [x0, y0] = [p.x, p.y];
  run(30, () => p.update(STEP, hold('right', 'down'), FIELD));
  assert.ok(Math.abs(Math.hypot(p.x - x0, p.y - y0) - PLAYER.speed * 0.5) < 0.01);
});

test('walls stop the player', () => {
  const p = newPlayer();
  run(120, () => p.update(STEP, hold('left'), FIELD));
  assert.equal(p.x, TILE);
});

test('pressing attack swings the sword in front of the player', () => {
  const p = newPlayer();
  p.facing = 'right';
  p.update(STEP, press('attack'), FIELD);
  assert.equal(p.attacking, true);
  const s = p.swordBox();
  assert.equal(s.x, p.x + p.w);
  assert.equal(s.w, PLAYER.swordReach);
  assert.equal(s.h, PLAYER.swordWidth);
});

test('the sword box sits on the facing side', () => {
  for (const [facing, check] of [
    ['up', (p, s) => s.y + s.h === p.y],
    ['down', (p, s) => s.y === p.y + p.h],
    ['left', (p, s) => s.x + s.w === p.x],
  ]) {
    const p = newPlayer();
    p.facing = facing;
    p.update(STEP, press('attack'), FIELD);
    assert.ok(check(p, p.swordBox()), facing);
  }
});

test('the player cannot move while swinging', () => {
  const p = newPlayer();
  p.update(STEP, press('attack'), FIELD);
  const x0 = p.x;
  run(5, () => p.update(STEP, hold('right'), FIELD));
  assert.equal(p.x, x0);
});

test('the swing ends after swordTime and cannot restart during the cooldown', () => {
  const p = newPlayer();
  p.update(STEP, press('attack'), FIELD);
  run(Math.ceil(PLAYER.swordTime / STEP) + 1, () => p.update(STEP, NONE, FIELD));
  assert.equal(p.attacking, false);
  assert.equal(p.swordBox(), null);
  p.update(STEP, press('attack'), FIELD);
  assert.equal(p.attacking, false, 'still cooling down');
  run(Math.ceil(PLAYER.swordCooldown / STEP) + 1, () => p.update(STEP, NONE, FIELD));
  p.update(STEP, press('attack'), FIELD);
  assert.equal(p.attacking, true);
});

test('hurt removes health, knocks back, and grants invulnerability', () => {
  const p = newPlayer();
  const x0 = p.x;
  assert.equal(p.hurt(1, p.x - 10, p.y + p.h / 2), true); // hit from the left
  assert.equal(p.health, PLAYER.maxHealth - 1);
  run(5, () => p.update(STEP, NONE, FIELD));
  assert.ok(p.x > x0, 'knocked to the right');
  assert.equal(p.hurt(1, 0, 0), false, 'invulnerable');
  assert.equal(p.health, PLAYER.maxHealth - 1);
});

test('invulnerability wears off', () => {
  const p = newPlayer();
  p.hurt(1, 0, 0);
  run(Math.ceil(PLAYER.invulnTime / STEP) + 1, () => p.update(STEP, NONE, FIELD));
  assert.equal(p.hurt(1, 0, 0), true);
  assert.equal(p.health, PLAYER.maxHealth - 2);
});

test('health stops at zero and the player is dead', () => {
  const p = newPlayer();
  p.hurt(99, 0, 0);
  assert.equal(p.health, 0);
  assert.equal(p.dead, true);
});

test('heal is capped at maxHealth', () => {
  const p = newPlayer();
  p.hurt(3, 0, 0);
  p.heal(2);
  assert.equal(p.health, PLAYER.maxHealth - 1);
  p.heal(10);
  assert.equal(p.health, PLAYER.maxHealth);
});

test('spriteName reflects facing and walk frame', () => {
  const p = newPlayer();
  assert.equal(p.spriteName(), 'lucy_down_0');
  const seen = new Set();
  run(40, () => {
    p.update(STEP, hold('right'), FIELD);
    seen.add(p.spriteName());
  });
  assert.deepEqual([...seen].sort(), ['lucy_right_0', 'lucy_right_1']);
});

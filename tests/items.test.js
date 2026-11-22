import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pickup } from '../src/game/items.js';
import { Player } from '../src/game/player.js';
import { TILE, PICKUP_SIZE, HEART_HEAL, PLAYER } from '../src/config.js';

test('atTile centers the pickup in the tile', () => {
  const k = Pickup.atTile('key', 3, 2);
  assert.equal(k.x, 3 * TILE + (TILE - PICKUP_SIZE) / 2);
  assert.equal(k.y, 2 * TILE + (TILE - PICKUP_SIZE) / 2);
  assert.equal(k.w, PICKUP_SIZE);
});

test('centeredOn centers the pickup on a point', () => {
  const h = Pickup.centeredOn('heart', 100, 50);
  assert.equal(h.x + h.w / 2, 100);
  assert.equal(h.y + h.h / 2, 50);
});

test('a key gives the player the key', () => {
  const p = Player.atTile(1, 1);
  const k = Pickup.atTile('key', 1, 1);
  k.applyTo(p);
  assert.equal(p.hasKey, true);
  assert.equal(k.taken, true);
  assert.equal(k.spriteName(), 'key');
});

test('a heart heals HEART_HEAL, capped at max health', () => {
  const p = Player.atTile(1, 1);
  p.hurt(3, 0, 0);
  const h = Pickup.atTile('heart', 1, 1);
  h.applyTo(p);
  assert.equal(p.health, PLAYER.maxHealth - 3 + HEART_HEAL);
  assert.equal(h.taken, true);
  assert.equal(h.spriteName(), 'heart_full');
});

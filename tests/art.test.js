import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, PALETTE, SPRITE_GROUPS } from '../src/art/index.js';
import { resolveSprite } from '../src/engine/sprites.js';

const dirs = ['down', 'up', 'right', 'left'];
const REQUIRED = {
  '16x16': [
    'snow', 'path', 'tree', 'rock', 'lamppost', 'wardrobe', 'door_locked', 'door_open',
    ...dirs.flatMap((d) => [`lucy_${d}_0`, `lucy_${d}_1`]),
    ...dirs.map((d) => `tumnus_${d}`),
    ...dirs.flatMap((d) => [`wolf_${d}_0`, `wolf_${d}_1`]),
  ],
  '8x12': ['sword_up', 'sword_down'],
  '12x8': ['sword_right', 'sword_left'],
  '8x8': ['heart_full', 'heart_half', 'heart_empty', 'key'],
};

for (const [size, names] of Object.entries(REQUIRED)) {
  for (const name of names) {
    test(`${name} exists and is ${size}`, () => {
      const s = resolveSprite(SPRITES, name, PALETTE);
      assert.equal(`${s.width}x${s.height}`, size);
    });
  }
}

test('every defined sprite resolves without errors', () => {
  for (const name of Object.keys(SPRITES)) resolveSprite(SPRITES, name, PALETTE);
});

test('floor tiles are fully opaque (they are drawn under everything)', () => {
  for (const name of ['snow', 'path']) {
    assert.ok(!resolveSprite(SPRITES, name, PALETTE).pixels.includes(null), name);
  }
});

test('every sprite appears in exactly one preview group', () => {
  const grouped = Object.values(SPRITE_GROUPS).flat();
  assert.equal(new Set(grouped).size, grouped.length, 'a sprite is listed twice');
  assert.deepEqual([...grouped].sort(), Object.keys(SPRITES).sort());
});

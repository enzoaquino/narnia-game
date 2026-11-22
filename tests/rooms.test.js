import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS } from '../src/rooms/index.js';
import lanternWaste from '../src/rooms/room1-lantern-waste.js';
import { validateRoomDef, legendFor } from '../src/game/roomdef.js';
import { Room } from '../src/game/room.js';
import { SPRITES } from '../src/art/index.js';
import { TILE, STEP, DOOR_OPEN_TIME } from '../src/config.js';
import { fakeInput, run } from './helpers.js';

const NONE = fakeInput();

test('there is at least one room and every room is valid', () => {
  assert.ok(ROOMS.length >= 1);
  for (const def of ROOMS) assert.deepEqual(validateRoomDef(def), [], def.name);
});

test('room ids are unique', () => {
  const ids = ROOMS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every room only uses sprites that exist', () => {
  for (const def of ROOMS) {
    const legend = legendFor(def);
    for (const row of def.map) for (const ch of row) assert.ok(SPRITES[legend[ch].tile], `${def.name}: tile ${legend[ch].tile}`);
    for (const e of def.entities.filter((x) => x.type === 'npc')) {
      for (const d of ['down', 'up', 'left', 'right']) assert.ok(SPRITES[`${e.sprite}_${d}`], `${def.name}: ${e.sprite}_${d}`);
    }
  }
});

test('Lantern Waste can be completed', () => {
  const room = new Room(lanternWaste, { rng: () => 0.99 });
  assert.equal(room.takeDialogue().speaker, 'Lucy');
  assert.equal(room.enemies.length, 3);

  for (const w of room.enemies) w.dead = true;
  room.update(STEP, NONE); // fires onEnemiesCleared

  const p = room.player;
  p.x = 8 * TILE + 2; // just left of Mr. Tumnus at (9, 4)
  p.y = 4 * TILE + 2;
  room.update(STEP, fakeInput({ pressed: ['interact'] }));
  const talk = room.takeDialogue();
  assert.equal(talk.speaker, 'Mr. Tumnus');
  assert.match(talk.lines[0], /wolves/);
  talk.onDone();
  assert.equal(p.hasKey, true);

  p.x = 8 * TILE + 2; // tile above the exit at (8, 10)
  p.y = 9 * TILE + 2;
  run(10, () => room.update(STEP, fakeInput({ down: ['down'] })));
  run(Math.ceil(DOOR_OPEN_TIME / STEP) + 1, () => room.update(STEP, NONE));
  assert.equal(room.completed, true);
});

test('Lantern Waste only plays the intro on the first attempt', () => {
  assert.equal(new Room(lanternWaste, { attempt: 2 }).takeDialogue(), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/game/room.js';
import { RoomError } from '../src/game/roomdef.js';
import { TILE, STEP, DOOR_OPEN_TIME, PLAYER } from '../src/config.js';
import { TEST_MAP, testRoomDef, fakeInput, run } from './helpers.js';

const NONE = fakeInput();
const hold = (...down) => fakeInput({ down });
const press = (...pressed) => fakeInput({ pressed });
const NO_DROP = () => 0.99; // rng: hearts never drop; wandering wolves go "up"
const ALWAYS_DROP = () => 0; // rng: hearts always drop; wandering wolves stand still
const tumnus = { type: 'npc', id: 'tumnus', name: 'Mr. Tumnus', sprite: 'tumnus', x: 7, y: 3, dialogue: ['Hello!'] };

test('the player starts on the spawn tile facing into the room', () => {
  const room = new Room(testRoomDef());
  assert.equal(room.player.x, 7 * TILE + 2);
  assert.equal(room.player.y, 1 * TILE + 2);
  assert.equal(room.player.facing, 'down');
  assert.equal(room.name, 'Test Room');
  assert.equal(room.attempt, 1);
});

test('invalid room definitions throw RoomError', () => {
  assert.throws(() => new Room(testRoomDef({ map: TEST_MAP.slice(1) })), RoomError);
});

test('NPC tiles and the outside of the map are solid', () => {
  const room = new Room(testRoomDef({ entities: [tumnus] }));
  assert.equal(room.isSolidAt(7, 3), true);
  assert.equal(room.isSolidAt(8, 3), false);
  assert.equal(room.isSolidAt(-1, 0), true);
});

test('onEnter runs once when the room is built', () => {
  let entered = 0;
  const room = new Room(testRoomDef({ hooks: { onEnter: () => entered++ } }));
  room.update(STEP, NONE);
  assert.equal(entered, 1);
});

function roomWithWolfNextToPlayer(rng, hooks = {}) {
  const room = new Room(testRoomDef({ entities: [{ type: 'wolf', x: 10, y: 5 }], hooks }), { rng });
  const p = room.player;
  p.x = 5 * TILE;
  p.y = 5 * TILE + 2;
  p.facing = 'right';
  const wolf = room.enemies[0];
  wolf.health = 1;
  wolf.x = p.x + p.w + 2;
  wolf.y = p.y;
  return room;
}

test('the sword defeats a wolf and onEnemiesCleared fires once', () => {
  let cleared = 0;
  const room = roomWithWolfNextToPlayer(NO_DROP, { onEnemiesCleared: () => cleared++ });
  room.update(STEP, press('attack'));
  assert.equal(room.enemiesRemaining(), 0);
  assert.equal(room.enemies.length, 0);
  assert.equal(cleared, 1);
  run(30, () => room.update(STEP, NONE));
  assert.equal(cleared, 1);
  assert.equal(room.pickups.length, 0);
});

test('a defeated wolf can drop a heart', () => {
  const room = roomWithWolfNextToPlayer(ALWAYS_DROP);
  room.update(STEP, press('attack'));
  assert.equal(room.pickups.length, 1);
  assert.equal(room.pickups[0].kind, 'heart');
});

test('touching a wolf hurts the player', () => {
  const room = new Room(testRoomDef({ entities: [{ type: 'wolf', x: 10, y: 5 }] }), { rng: NO_DROP });
  const wolf = room.enemies[0];
  wolf.x = room.player.x;
  wolf.y = room.player.y;
  room.update(STEP, NONE);
  assert.equal(room.player.health, PLAYER.maxHealth - 1);
});

test('walking onto a pickup collects it', () => {
  const room = new Room(testRoomDef({ entities: [{ type: 'key', x: 7, y: 2 }] }));
  run(20, () => room.update(STEP, hold('down')));
  assert.equal(room.player.hasKey, true);
  assert.equal(room.pickups.length, 0);
});

function talkToTumnus(room) {
  run(30, () => room.update(STEP, hold('down'))); // walk down until blocked by Tumnus's tile
  room.update(STEP, press('interact'));
  return room.takeDialogue();
}

test('pressing interact next to an NPC queues their dialogue', () => {
  const room = new Room(testRoomDef({ entities: [tumnus] }));
  const talk = talkToTumnus(room);
  assert.equal(talk.speaker, 'Mr. Tumnus');
  assert.deepEqual(talk.lines, ['Hello!']);
  assert.equal(room.takeDialogue(), null);
});

test('finishing a conversation runs the NPC onDone set by a hook', () => {
  const room = new Room(testRoomDef({
    entities: [tumnus],
    hooks: { onEnter: (r) => r.npc('tumnus').onDone(() => r.giveKey()) },
  }));
  const talk = talkToTumnus(room);
  assert.equal(room.player.hasKey, false);
  talk.onDone();
  assert.equal(room.player.hasKey, true);
});

test('say queues dialogue from hooks', () => {
  const room = new Room(testRoomDef({ hooks: { onEnter: (r) => r.say('Lucy', ['Snow!']) } }));
  assert.deepEqual(room.takeDialogue().lines, ['Snow!']);
});

test('npc() throws for an unknown id', () => {
  const room = new Room(testRoomDef());
  assert.throws(() => room.npc('aslan'), /aslan/);
});

function standAboveExit(room) {
  room.player.x = 7 * TILE + 2;
  room.player.y = 9 * TILE + 2;
}

test('the exit does nothing without the key', () => {
  const room = new Room(testRoomDef());
  standAboveExit(room);
  run(60, () => room.update(STEP, hold('down')));
  assert.equal(room.exitOpen, false);
  assert.equal(room.completed, false);
});

test('touching the exit with the key opens it, then completes the room', () => {
  const room = new Room(testRoomDef());
  room.giveKey();
  standAboveExit(room);
  run(10, () => room.update(STEP, hold('down')));
  assert.equal(room.exitOpen, true);
  assert.equal(room.tiles[10][7], 'door_open');
  assert.equal(room.player.hasKey, false);
  assert.equal(room.completed, false);
  run(Math.ceil(DOOR_OPEN_TIME / STEP) + 1, () => room.update(STEP, NONE));
  assert.equal(room.completed, true);
});

test('the room fails when the player runs out of health, and stops updating', () => {
  const room = new Room(testRoomDef());
  room.player.hurt(99, 0, 0);
  assert.equal(room.failed, true);
  const y = room.player.y;
  run(10, () => room.update(STEP, hold('down')));
  assert.equal(room.player.y, y);
});

test('spawn adds wolves at runtime and re-arms onEnemiesCleared', () => {
  let cleared = 0;
  const room = new Room(testRoomDef({ hooks: { onEnemiesCleared: () => cleared++ } }), { rng: NO_DROP });
  room.update(STEP, NONE);
  assert.equal(cleared, 0, 'a room with no wolves never fires');
  room.spawn({ type: 'wolf', x: 12, y: 8 });
  assert.equal(room.enemiesRemaining(), 1);
  room.enemies[0].dead = true;
  room.update(STEP, NONE);
  assert.equal(cleared, 1);
});

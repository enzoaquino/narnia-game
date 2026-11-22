import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRoomDef, parseRoomDef, RoomError } from '../src/game/roomdef.js';
import { TEST_MAP, testRoomDef, withRow } from './helpers.js';

const npc = (extra = {}) => ({ type: 'npc', id: 'tumnus', sprite: 'tumnus', x: 2, y: 2, dialogue: ['Hi'], ...extra });

test('a valid room has no errors', () => {
  assert.deepEqual(validateRoomDef(testRoomDef({ entities: [npc(), { type: 'wolf', x: 10, y: 6 }] })), []);
});

test('the map must have 11 rows', () => {
  assert.match(validateRoomDef(testRoomDef({ map: TEST_MAP.slice(1) })).join(), /must have 11 rows \(found 10\)/);
});

test('each row must have 16 characters', () => {
  assert.match(validateRoomDef(testRoomDef({ map: withRow(TEST_MAP, 3, 'T...T') })).join(), /row 3 must have 16 characters \(found 5\)/);
});

test('unknown tile characters are reported with their position', () => {
  const map = withRow(TEST_MAP, 2, 'T....Q.........T');
  assert.match(validateRoomDef(testRoomDef({ map })).join(), /unknown tile "Q" at column 5, row 2/);
});

test('the map needs exactly one exit', () => {
  const map = withRow(TEST_MAP, 10, 'TTTTTTTTTTTTTTTT');
  assert.match(validateRoomDef(testRoomDef({ map })).join(), /exactly one exit \(found 0\)/);
});

test('the map needs exactly one entrance', () => {
  const map = withRow(TEST_MAP, 5, 'T......W.......T');
  assert.match(validateRoomDef(testRoomDef({ map })).join(), /exactly one entrance \(found 2\)/);
});

test('the entrance needs open floor next to it', () => {
  const map = withRow(TEST_MAP, 0, 'WTTTTTTTTTTTTTTT');
  assert.match(validateRoomDef(testRoomDef({ map })).join(), /no open floor next to the entrance/);
});

test('a room legend can add tiles', () => {
  const def = testRoomDef({
    legend: { '~': { tile: 'ice', solid: false } },
    map: withRow(TEST_MAP, 2, 'T~.............T'),
  });
  assert.deepEqual(validateRoomDef(def), []);
});

test('unknown entity types are reported', () => {
  assert.match(validateRoomDef(testRoomDef({ entities: [{ type: 'dragon', x: 2, y: 2 }] })).join(), /unknown entity type "dragon"/);
});

test('entities must be inside the map', () => {
  assert.match(validateRoomDef(testRoomDef({ entities: [{ type: 'wolf', x: 16, y: 2 }] })).join(), /outside the map/);
});

test('entities cannot start on a solid tile', () => {
  assert.match(validateRoomDef(testRoomDef({ entities: [{ type: 'wolf', x: 5, y: 3 }] })).join(), /solid tile/);
});

test('NPCs need an id, a sprite and dialogue', () => {
  const errors = validateRoomDef(testRoomDef({ entities: [{ type: 'npc', x: 2, y: 2 }] })).join('\n');
  assert.match(errors, /needs an id/);
  assert.match(errors, /needs a sprite/);
  assert.match(errors, /dialogue/);
});

test('NPC ids must be unique', () => {
  const errors = validateRoomDef(testRoomDef({ entities: [npc(), npc({ x: 3 })] })).join();
  assert.match(errors, /duplicate NPC id "tumnus"/);
});

test('parseRoomDef returns tiles, solidity, doors and the spawn point', () => {
  const p = parseRoomDef(testRoomDef());
  assert.equal(p.tiles[0][7], 'wardrobe');
  assert.equal(p.tiles[1][1], 'snow');
  assert.equal(p.tiles[10][7], 'door_locked');
  assert.equal(p.solid[3][5], true);
  assert.equal(p.solid[1][1], false);
  assert.deepEqual(p.entrance, { col: 7, row: 0 });
  assert.deepEqual(p.exit, { col: 7, row: 10 });
  assert.deepEqual(p.spawn, { col: 7, row: 1, facing: 'down' });
});

test('the spawn faces away from an entrance on the left wall', () => {
  const map = TEST_MAP.map((r, i) => (i === 0 ? 'TTTTTTTTTTTTTTTT' : i === 5 ? 'W..............T' : r));
  assert.deepEqual(parseRoomDef(testRoomDef({ map })).spawn, { col: 1, row: 5, facing: 'right' });
});

test('parseRoomDef throws a RoomError listing every problem', () => {
  const map = withRow(withRow(TEST_MAP, 2, 'T....Q.........T'), 10, 'TTTTTTTTTTTTTTTT');
  assert.throws(
    () => parseRoomDef(testRoomDef({ map })),
    (err) => err instanceof RoomError && err.errors.length === 2 && /Test Room/.test(err.message),
  );
});

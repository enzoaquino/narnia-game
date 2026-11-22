import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Npc } from '../src/game/npc.js';
import { Player } from '../src/game/player.js';
import { TILE } from '../src/config.js';

const tumnus = () => new Npc({ id: 'tumnus', name: 'Mr. Tumnus', sprite: 'tumnus', x: 5, y: 4, dialogue: ['Hello!'] });

test('position comes from tile coordinates; name defaults to id', () => {
  const n = tumnus();
  assert.deepEqual([n.col, n.row, n.x, n.y, n.w, n.h], [5, 4, 5 * TILE, 4 * TILE, TILE, TILE]);
  assert.equal(new Npc({ id: 'beaver', sprite: 'b', x: 1, y: 1, dialogue: ['x'] }).name, 'beaver');
});

test('turns to face a nearby player and ignores a distant one', () => {
  const n = tumnus();
  n.notice(Player.atTile(4, 4));
  assert.equal(n.facing, 'left');
  n.notice(Player.atTile(5, 5));
  assert.equal(n.facing, 'down');
  n.notice(Player.atTile(14, 9));
  assert.equal(n.facing, 'down');
  assert.equal(n.spriteName(), 'tumnus_down');
});

test('canTalkTo is true only for an adjacent player', () => {
  const n = tumnus();
  assert.equal(n.canTalkTo(Player.atTile(4, 4)), true);
  assert.equal(n.canTalkTo(Player.atTile(2, 4)), false);
});

test('setDialogue copies the lines and chains', () => {
  const n = tumnus();
  const lines = ['One', 'Two'];
  assert.equal(n.setDialogue(lines), n);
  lines.push('Three');
  assert.deepEqual(n.dialogue, ['One', 'Two']);
});

test('onDone runs once, on the next finished conversation', () => {
  const n = tumnus();
  let calls = 0;
  assert.equal(n.onDone(() => calls++), n);
  n.finishTalking();
  n.finishTalking();
  assert.equal(calls, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TitleScene } from '../src/game/scenes/title.js';
import { PlayScene } from '../src/game/scenes/play.js';
import { VictoryScene } from '../src/game/scenes/victory.js';
import { DialogueScene } from '../src/game/dialogue.js';
import { STEP, DEATH_PAUSE, PLAYER } from '../src/config.js';
import { testRoomDef, fakeInput, run } from './helpers.js';

const NONE = fakeInput();
const press = (...pressed) => fakeInput({ pressed });

function fakeGame({ rooms = [testRoomDef({ id: 'a' }), testRoomDef({ id: 'b' })], saved = null } = {}) {
  const calls = [];
  return {
    rooms,
    rng: () => 0.99,
    calls,
    stored: saved,
    save: {
      load() { return this.owner.stored; },
      save(data) { this.owner.stored = data; },
      clear() { this.owner.stored = null; calls.push(['clear']); },
    },
    title: () => calls.push(['title']),
    start: (i) => calls.push(['start', i]),
    win: () => calls.push(['win']),
    init() { this.save.owner = this; return this; },
  }.init();
}

test('title resumes from a saved room', () => {
  const game = fakeGame({ saved: { roomIndex: 1 } });
  const title = new TitleScene(game);
  assert.equal(title.resumeIndex, 1);
  title.update(STEP, press('attack'));
  assert.deepEqual(game.calls, [['start', 1]]);
});

test('title ignores a save that points past the last room', () => {
  assert.equal(new TitleScene(fakeGame({ saved: { roomIndex: 9 } })).resumeIndex, 0);
});

test('title: N clears the save and starts from room 0', () => {
  const game = fakeGame({ saved: { roomIndex: 1 } });
  new TitleScene(game).update(STEP, press('newGame'));
  assert.deepEqual(game.calls, [['clear'], ['start', 0]]);
});

test('entering a room saves progress', () => {
  const game = fakeGame();
  new PlayScene(game, 1);
  assert.deepEqual(game.stored, { roomIndex: 1 });
});

test('completing a room starts the next one; completing the last one wins', () => {
  const game = fakeGame();
  const first = new PlayScene(game, 0);
  first.room.completed = true;
  first.update(STEP, NONE);
  const last = new PlayScene(game, 1);
  last.room.completed = true;
  last.update(STEP, NONE);
  assert.deepEqual(game.calls, [['start', 1], ['win']]);
});

test('a dialogue request opens a DialogueScene on the stack', () => {
  const game = fakeGame({ rooms: [testRoomDef({ hooks: { onEnter: (r) => r.say('Lucy', ['Hi']) } })] });
  const play = new PlayScene(game, 0);
  const pushed = [];
  play.stack = { push: (s) => pushed.push(s) };
  play.update(STEP, NONE);
  assert.equal(pushed.length, 1);
  assert.ok(pushed[0] instanceof DialogueScene);
  assert.equal(pushed[0].speaker, 'Lucy');
});

test('when the player is defeated the room restarts after a pause', () => {
  const game = fakeGame();
  const play = new PlayScene(game, 0);
  const firstRoom = play.room;
  play.room.player.hurt(99, 0, 0);
  play.update(STEP, NONE);
  assert.ok(play.deathTimer > 0);
  run(Math.ceil(DEATH_PAUSE / STEP) + 1, () => play.update(STEP, NONE));
  assert.notEqual(play.room, firstRoom);
  assert.equal(play.room.player.health, PLAYER.maxHealth);
  assert.equal(play.room.attempt, 2);
});

test('victory waits briefly, then Space starts a new game', () => {
  const game = fakeGame();
  const v = new VictoryScene(game);
  v.update(STEP, press('attack'));
  assert.deepEqual(game.calls, []);
  run(60, () => v.update(STEP, NONE));
  v.update(STEP, press('attack'));
  assert.deepEqual(game.calls, [['start', 0]]);
});

/** Records the strings a scene draws. */
function textsOf(scene) {
  const texts = [];
  scene.render({ rect() {}, sprite() {}, text: (s) => texts.push(s) });
  return texts;
}

test('title shows keyboard hints until the screen is touched', () => {
  const game = fakeGame({ saved: { roomIndex: 1 } });
  const keys = textsOf(new TitleScene(game));
  assert.ok(keys.includes('Press Space to continue (room 2)'));
  assert.ok(keys.includes('Press N for a new game'));
  assert.ok(keys.includes('Arrows/WASD move · Space sword · E talk'));
  game.touch = true;
  const touch = textsOf(new TitleScene(game));
  assert.ok(touch.includes('Tap Sword to continue (room 2)'));
  assert.ok(touch.includes('Tap Talk for a new game'));
  assert.ok(touch.includes('D-pad move · Sword · Talk'));
  assert.ok(textsOf(new TitleScene(Object.assign(fakeGame(), { touch: true }))).includes('Tap Sword to start'));
});

test('title on touch: Talk starts a new game when there is a save to continue', () => {
  const game = Object.assign(fakeGame({ saved: { roomIndex: 1 } }), { touch: true });
  new TitleScene(game).update(STEP, press('interact'));
  assert.deepEqual(game.calls, [['clear'], ['start', 0]]);
  const fresh = Object.assign(fakeGame(), { touch: true });
  new TitleScene(fresh).update(STEP, press('interact'));
  assert.deepEqual(fresh.calls, [['start', 0]]);
});

test('title with a keyboard: E still continues from the save', () => {
  const game = fakeGame({ saved: { roomIndex: 1 } });
  new TitleScene(game).update(STEP, press('interact'));
  assert.deepEqual(game.calls, [['start', 1]]);
});

test('victory hint follows the input in use', () => {
  const game = fakeGame();
  assert.ok(textsOf(new VictoryScene(game)).includes('Press Space to play again'));
  game.touch = true;
  assert.ok(textsOf(new VictoryScene(game)).includes('Tap Sword to play again'));
});

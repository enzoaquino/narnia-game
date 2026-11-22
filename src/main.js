import { STEP, MAX_FRAME } from './config.js';
import { Input, attachKeyboard } from './engine/input.js';
import { attachTouch } from './engine/touch.js';
import { Renderer } from './engine/renderer.js';
import { createSpriteCache } from './engine/sprites.js';
import { SceneStack } from './engine/scenes.js';
import { createSave } from './engine/save.js';
import { SPRITES, PALETTE } from './art/index.js';
import { ROOMS } from './rooms/index.js';
import { validateRoomDef, RoomError } from './game/roomdef.js';
import { TitleScene } from './game/scenes/title.js';
import { PlayScene } from './game/scenes/play.js';
import { VictoryScene } from './game/scenes/victory.js';

const sprites = createSpriteCache(SPRITES, PALETTE);
const renderer = new Renderer(document.getElementById('game'), sprites);
const input = new Input();
attachKeyboard(input, window);
const scenes = new SceneStack();

// Shared context the scenes use to move between screens.
const game = {
  rooms: ROOMS,
  save: createSave(),
  rng: Math.random,
  title: () => scenes.reset(new TitleScene(game)),
  start: (index) => scenes.reset(new PlayScene(game, index)),
  win: () => {
    game.save.clear();
    scenes.reset(new VictoryScene(game));
  },
  touch: false, // true once the on-screen controls are in use; scenes show touch hints
};

attachTouch(input, {
  dpad: document.getElementById('dpad'),
  sword: document.getElementById('btn-sword'),
  talk: document.getElementById('btn-talk'),
  onFirstTouch: () => { game.touch = true; },
});

let running = true;

function fail(err) {
  running = false;
  console.error(err);
  renderer.error(err);
}

// Catch broken rooms and sprites at startup, with a readable message.
function checkContent() {
  if (ROOMS.length === 0) throw new Error('There are no rooms. Add one to src/rooms/index.js.');
  for (const def of ROOMS) {
    const errors = validateRoomDef(def);
    if (errors.length) throw new RoomError(def.name ?? def.id ?? 'unnamed room', errors);
  }
  for (const name of Object.keys(SPRITES)) sprites.get(name);
}

let last = performance.now();
let acc = 0;

function frame(now) {
  if (!running) return;
  try {
    acc += Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      scenes.update(STEP, input);
      input.endFrame();
      acc -= STEP;
    }
    scenes.render(renderer);
    requestAnimationFrame(frame);
  } catch (err) {
    fail(err);
  }
}

try {
  checkContent();
  game.title();
  requestAnimationFrame(frame);
} catch (err) {
  fail(err);
}

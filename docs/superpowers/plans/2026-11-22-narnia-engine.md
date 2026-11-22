# Narnia Engine + Room 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small top-down Zelda-style browser game engine with one playable placeholder room (Lantern Waste), deployable as static files to GitHub Pages.

**Architecture:** Plain ES modules on a `<canvas>` with no build step. `src/engine/` is game-agnostic plumbing: collision, input, sprites, renderer, scenes, save and text. `src/game/` holds the entities, room runtime and scenes. `src/art/` holds pixel-art data and `src/rooms/` holds room definitions. Only `renderer.js` and `sprites.js` touch the canvas and only `input.js` touches keyboard events, so all logic is unit-tested in Node.

**Tech Stack:** HTML5 Canvas 2D, JavaScript ES modules, Node 24 built-in test runner (`node:test`, `node:assert/strict`), `python3 -m http.server` for local serving.

**Spec:** `docs/superpowers/specs/2026-11-22-narnia-engine-design.md`. Read it alongside this plan. `CLAUDE.md` has the project rules.

## Global Constraints

- No build step, no npm dependencies, no `package.json`. Plain HTML + JS ES modules.
- Relative paths only for modules and assets. The site is served from `username.github.io/<repo>/`.
- No external runtime requests (no CDNs, web fonts or analytics).
- Keyboard only: Arrows/WASD move, Space attacks, E/Enter interacts. N (new game) works on the title screen only.
- Only `src/engine/renderer.js` and `src/engine/sprites.js` touch canvas/DOM. Only `src/engine/input.js` touches keyboard events. Everything else must import cleanly in Node.
- Tunable numbers live in `src/config.js`.
- Grid: 16×16 px tiles, rooms 16 columns × 11 rows, 16 px HUD on top, 256×192 native, integer scaling, smoothing off.
- Health is in half-hearts. Player max is 6 (3 hearts). Enemy contact deals 1 (half a heart).
- Content is for kids: gentle text and visuals.
- **Test command** (Node comes from nvm and isn't on PATH, and nvm's `default` alias is broken on this machine, so always select 24 explicitly):
  `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test` runs everything.
  Append a file path to run one file: `... && node --test tests/collision.test.js`.
  Note: `node --test tests/` (a directory) does NOT work.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or add a remote.

## File Map

```
index.html                     page shell, boot-error fallback, loads src/main.js
sprites.html                   sprite preview page
.gitignore
src/
  config.js                    all tunable numbers
  main.js                      boot, content checks, fixed-timestep loop, game context
  engine/
    collision.js               overlaps, boxHitsSolid, moveAndSlide (+ corner nudge)
    input.js                   Input (key→action state), attachKeyboard (DOM)
    sprites.js                 parseSprite, flipH, flipV, resolveSprite, createSpriteCache (DOM)
    text.js                    wrapText
    scenes.js                  SceneStack
    save.js                    createSave (localStorage, safe)
    renderer.js                Renderer (canvas, scaling, sprite/rect/text, error screen)
  game/
    direction.js               DIRS, facingFromVector, chooseFacing
    roomdef.js                 DEFAULT_LEGEND, ENTITY_TYPES, validateRoomDef, parseRoomDef, RoomError, legendFor
    player.js                  Player
    enemies.js                 Wolf
    npc.js                     Npc
    items.js                   Pickup (key, heart)
    room.js                    Room runtime (entities, combat, hooks, exit)
    dialogue.js                paginate, DialogueScene
    hud.js                     heartStates, drawHud
    roomview.js                drawRoom
    scenes/title.js            TitleScene
    scenes/play.js             PlayScene
    scenes/victory.js          VictoryScene
  art/
    palette.js                 PALETTE (shared colors)
    tiles.js                   TILE_SPRITES
    characters.js              CHARACTER_SPRITES
    items.js                   ITEM_SPRITES (hearts, key, swords)
    index.js                   SPRITES, PALETTE, SPRITE_GROUPS
  rooms/
    index.js                   ROOMS (play order)
    room1-lantern-waste.js
tests/
  helpers.js                   shared fixtures (not a test file)
  *.test.js
README.md
PLAYTEST.md
```

Deviations from the spec's file tree, which Task 15 will update in the spec: `door.js` is dropped because doors are tiles handled by `room.js`. Added files are `roomdef.js` (validation, split out of `room.js`), `roomview.js` (room drawing), `direction.js`, `engine/text.js`, and `art/items.js`.

---

### Task 1: Project skeleton, config, and collision

**Files:**
- Create: `.gitignore`, `src/config.js`, `src/engine/collision.js`, `tests/helpers.js`, `tests/collision.test.js`
- Modify: `CLAUDE.md` (test command)

**Interfaces:**
- Produces: `src/config.js` constants (below). `overlaps(a, b) → boolean`. `boxHitsSolid(box, isSolidAt) → boolean`. `moveAndSlide(box, dx, dy, isSolidAt, nudge = 0) → {x, y}`. A box is `{x, y, w, h}` in pixels. `isSolidAt(col, row) → boolean`, and out-of-bounds must return true.
- Produces (tests): `tests/helpers.js` exports `gridSolid(rows)`, `fakeInput({down, pressed})`, `seqRng(values)`, `run(n, fn)`, `TEST_MAP`, `testRoomDef(overrides)`, `withRow(map, row, text)`.

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
```

- [ ] **Step 2: Create `src/config.js`**

```js
// Every tunable number lives here.
// Units: pixels, seconds, and half-hearts for health.

export const GAME_TITLE = 'Through the Wardrobe';
export const GAME_SUBTITLE = 'A Narnia Adventure';

export const TILE = 16;
export const ROOM_COLS = 16;
export const ROOM_ROWS = 11;
export const HUD_HEIGHT = 16;
export const VIEW_WIDTH = TILE * ROOM_COLS; // 256
export const VIEW_HEIGHT = TILE * ROOM_ROWS + HUD_HEIGHT; // 192
export const MIN_SCALE = 2;

export const STEP = 1 / 60; // fixed update timestep
export const MAX_FRAME = 0.25; // longest frame we simulate (e.g. after a tab switch)

export const PLAYER = {
  box: { w: 12, h: 12 },
  spriteOffset: { x: 2, y: 4 }, // sprite is drawn at (x - ox, y - oy)
  speed: 64,
  maxHealth: 6,
  swordTime: 0.25,
  swordCooldown: 0.15,
  swordReach: 12,
  swordWidth: 8,
  invulnTime: 1.0,
  knockbackSpeed: 160,
  knockbackTime: 0.15,
  walkFrameTime: 0.15,
  cornerNudge: 6,
};

export const WOLF = {
  box: { w: 12, h: 12 },
  spriteOffset: { x: 2, y: 4 },
  wanderSpeed: 28,
  chaseSpeed: 44,
  chaseRadius: 56,
  wanderMinTime: 0.6,
  wanderMaxTime: 1.6,
  health: 2,
  damage: 1,
  hurtTime: 0.3, // must be longer than PLAYER.swordTime so one swing = one hit
  knockbackSpeed: 150,
  knockbackTime: 0.15,
  heartDropChance: 0.35,
  walkFrameTime: 0.2,
};

export const NPC = { talkDistance: 22, noticeDistance: 48 };
export const PICKUP_SIZE = 8;
export const HEART_HEAL = 2;
export const DOOR_OPEN_TIME = 0.5;
export const DEATH_PAUSE = 1.0;

export const DIALOGUE = {
  charsPerSecond: 40,
  maxCharsPerLine: 44,
  linesPerPage: 3,
};
```

- [ ] **Step 3: Create `tests/helpers.js`**

```js
// Shared test fixtures. Not a test file (no .test.js suffix).

/** isSolidAt for a grid of strings where '#' is solid. Outside the grid is solid. */
export function gridSolid(rows) {
  return (col, row) =>
    row < 0 || row >= rows.length || col < 0 || col >= rows[0].length || rows[row][col] === '#';
}

/** A stand-in for Input: actions held down and actions pressed this step. */
export function fakeInput({ down = [], pressed = [] } = {}) {
  const d = new Set(down);
  const p = new Set(pressed);
  return { isDown: (a) => d.has(a), wasPressed: (a) => p.has(a) };
}

/** Deterministic rng that cycles through the given values. */
export function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

export function run(n, fn) {
  for (let i = 0; i < n; i++) fn(i);
}

export const TEST_MAP = [
  'TTTTTTTWTTTTTTTT',
  'T..............T',
  'T..............T',
  'T....R.........T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'TTTTTTTXTTTTTTTT',
];

export function testRoomDef(overrides = {}) {
  return { id: 'test', name: 'Test Room', map: TEST_MAP, entities: [], hooks: {}, ...overrides };
}

export function withRow(map, row, text) {
  return map.map((r, i) => (i === row ? text : r));
}
```

- [ ] **Step 4: Write the failing collision tests in `tests/collision.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, boxHitsSolid, moveAndSlide } from '../src/engine/collision.js';
import { gridSolid } from './helpers.js';

// 6 columns x 5 rows of 16px tiles; '#' is solid.
const OPEN = gridSolid([
  '######',
  '#....#',
  '#....#',
  '#....#',
  '######',
]);

test('overlaps: overlapping boxes', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
});

test('overlaps: boxes that only touch edges do not overlap', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test('boxHitsSolid: a box on open floor is clear', () => {
  assert.equal(boxHitsSolid({ x: 20, y: 20, w: 12, h: 12 }, OPEN), false);
});

test('boxHitsSolid: a box exactly against a wall edge is clear', () => {
  assert.equal(boxHitsSolid({ x: 16, y: 20, w: 12, h: 12 }, OPEN), false);
});

test('boxHitsSolid: a box poking into a wall hits', () => {
  assert.equal(boxHitsSolid({ x: 15, y: 20, w: 12, h: 12 }, OPEN), true);
});

test('boxHitsSolid: outside the grid counts as solid', () => {
  assert.equal(boxHitsSolid({ x: -20, y: 20, w: 12, h: 12 }, OPEN), true);
});

test('moveAndSlide: free movement moves the full amount', () => {
  assert.deepEqual(moveAndSlide({ x: 20, y: 20, w: 12, h: 12 }, 3, 2, OPEN), { x: 23, y: 22 });
});

test('moveAndSlide: stops flush against a wall on the right', () => {
  // right wall is column 5 (x 80..96), so the box's right edge stops at 80
  assert.deepEqual(moveAndSlide({ x: 66, y: 20, w: 12, h: 12 }, 5, 0, OPEN), { x: 68, y: 20 });
});

test('moveAndSlide: stops flush against a wall on the left', () => {
  assert.deepEqual(moveAndSlide({ x: 18, y: 20, w: 12, h: 12 }, -5, 0, OPEN), { x: 16, y: 20 });
});

test('moveAndSlide: stops flush against walls above and below', () => {
  assert.deepEqual(moveAndSlide({ x: 20, y: 18, w: 12, h: 12 }, 0, -5, OPEN), { x: 20, y: 16 });
  // bottom wall is row 4 (y 64..80), so the box's bottom stops at 64
  assert.deepEqual(moveAndSlide({ x: 20, y: 50, w: 12, h: 12 }, 0, 5, OPEN), { x: 20, y: 52 });
});

test('moveAndSlide: slides along a wall when moving diagonally into it', () => {
  assert.deepEqual(moveAndSlide({ x: 68, y: 20, w: 12, h: 12 }, 3, 2, OPEN), { x: 68, y: 22 });
});

// Wall at column 3 with a one-tile gap at row 2 (y 32..48).
const GAP = gridSolid([
  '######',
  '#..#..',
  '#.....',
  '#..#..',
  '######',
]);

test('moveAndSlide: corner nudge guides the box into a one-tile gap', () => {
  // The box is 2px too high to fit the gap and pushes right into the wall.
  let box = { x: 36, y: 30, w: 12, h: 12 };
  for (let i = 0; i < 40; i++) box = { ...box, ...moveAndSlide(box, 1, 0, GAP, 6) };
  assert.ok(box.x > 48, `expected to pass through the gap, x=${box.x}`);
  assert.ok(box.y >= 32 && box.y <= 36, `expected to be inside the gap row, y=${box.y}`);
});

test('moveAndSlide: without nudge the box stays stuck on the corner', () => {
  let box = { x: 36, y: 30, w: 12, h: 12 };
  for (let i = 0; i < 40; i++) box = { ...box, ...moveAndSlide(box, 1, 0, GAP, 0) };
  assert.deepEqual({ x: box.x, y: box.y }, { x: 36, y: 30 });
});
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/collision.test.js`
Expected: FAIL with `Cannot find module .../src/engine/collision.js`.

- [ ] **Step 6: Implement `src/engine/collision.js`**

```js
import { TILE } from '../config.js';

const EPS = 1e-4;

/** True when two boxes ({x, y, w, h}) overlap. Touching edges do not count. */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when any tile under the box is solid. isSolidAt(col, row) -> boolean. */
export function boxHitsSolid(box, isSolidAt) {
  const c0 = Math.floor(box.x / TILE);
  const c1 = Math.floor((box.x + box.w - EPS) / TILE);
  const r0 = Math.floor(box.y / TILE);
  const r1 = Math.floor((box.y + box.h - EPS) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolidAt(c, r)) return true;
    }
  }
  return false;
}

/**
 * Move a box by (dx, dy), stopping flush against solid tiles and sliding
 * along them. Moves X first, then Y. When blocked on one axis with no input
 * on the other, `nudge` (px) lets the box slip around corners into gaps.
 * Returns the new {x, y}; does not modify the box.
 */
export function moveAndSlide(box, dx, dy, isSolidAt, nudge = 0) {
  const cur = { x: box.x, y: box.y, w: box.w, h: box.h };
  if (dx !== 0) {
    const r = moveAxis(cur, 'x', dx, isSolidAt);
    cur.x = r.pos;
    if (r.blocked && dy === 0 && nudge > 0) {
      cur.y = cornerNudge(cur, 'x', Math.sign(dx), isSolidAt, nudge);
    }
  }
  if (dy !== 0) {
    const r = moveAxis(cur, 'y', dy, isSolidAt);
    cur.y = r.pos;
    if (r.blocked && dx === 0 && nudge > 0) {
      cur.x = cornerNudge(cur, 'y', Math.sign(dy), isSolidAt, nudge);
    }
  }
  return { x: cur.x, y: cur.y };
}

function moveAxis(box, axis, delta, isSolidAt) {
  const pos = box[axis] + delta;
  if (!boxHitsSolid({ ...box, [axis]: pos }, isSolidAt)) return { pos, blocked: false };
  const size = axis === 'x' ? box.w : box.h;
  const snapped =
    delta > 0
      ? Math.max(box[axis], Math.floor((pos + size - EPS) / TILE) * TILE - size)
      : Math.min(box[axis], (Math.floor(pos / TILE) + 1) * TILE);
  return { pos: snapped, blocked: true };
}

// Blocked moving along `axis`: look up to maxNudge px either side on the
// perpendicular axis for an opening, and step 1px toward the nearest one.
function cornerNudge(box, axis, dir, isSolidAt, maxNudge) {
  const perp = axis === 'x' ? 'y' : 'x';
  for (let k = 1; k <= maxNudge; k++) {
    for (const side of [-1, 1]) {
      const probe = { ...box, [perp]: box[perp] + side * k };
      probe[axis] += dir;
      const firstStep = { ...box, [perp]: box[perp] + side };
      if (!boxHitsSolid(probe, isSolidAt) && !boxHitsSolid(firstStep, isSolidAt)) {
        return box[perp] + side;
      }
    }
  }
  return box[perp];
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/collision.test.js`
Expected: PASS, 13 tests, 0 failures.

- [ ] **Step 8: Fix the test command in `CLAUDE.md`**

In the Commands block, replace:
```
# Tests: Node's built-in runner. Node comes from nvm and isn't on PATH by default.
source ~/.nvm/nvm.sh && node --test tests/
```
with:
```
# Tests: Node's built-in runner finds tests/*.test.js automatically.
# Node comes from nvm and isn't on PATH; nvm's default alias is broken here, so pick 24 explicitly.
source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test
# One file: ... && node --test tests/collision.test.js   (a bare directory like tests/ does NOT work)
```
In the Verification section, replace `` `node --test tests/` passes `` with `` the full test command passes ``.

- [ ] **Step 9: Commit**

```bash
git add .gitignore src/config.js src/engine/collision.js tests/helpers.js tests/collision.test.js CLAUDE.md
git commit -m "feat: add config and tile collision with corner nudge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Keyboard input

**Files:**
- Create: `src/engine/input.js`, `tests/input.test.js`

**Interfaces:**
- Produces: `KEY_ACTIONS` (code → action). `class Input` with `keyDown(code) → boolean` (true if the game uses the key), `keyUp(code) → boolean`, `isDown(action)`, `wasPressed(action)`, `endFrame()` and `clear()`. `attachKeyboard(input, target)`.
- Actions: `'up' | 'down' | 'left' | 'right' | 'attack' | 'interact' | 'newGame'`.
- Contract for the loop (Task 14): call `input.endFrame()` after **each fixed update step**, so a press is seen by exactly one update.

- [ ] **Step 1: Write the failing tests in `tests/input.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/engine/input.js';

test('arrow keys and WASD map to the same actions', () => {
  const input = new Input();
  input.keyDown('ArrowLeft');
  assert.equal(input.isDown('left'), true);
  input.keyUp('ArrowLeft');
  assert.equal(input.isDown('left'), false);
  input.keyDown('KeyA');
  assert.equal(input.isDown('left'), true);
  for (const [code, action] of [['KeyW', 'up'], ['KeyS', 'down'], ['KeyD', 'right'], ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowRight', 'right']]) {
    input.keyDown(code);
    assert.equal(input.isDown(action), true, code);
  }
});

test('an action stays down while either of its keys is held', () => {
  const input = new Input();
  input.keyDown('ArrowLeft');
  input.keyDown('KeyA');
  input.keyUp('ArrowLeft');
  assert.equal(input.isDown('left'), true);
  input.keyUp('KeyA');
  assert.equal(input.isDown('left'), false);
});

test('Space attacks, E and Enter interact, N starts a new game', () => {
  const input = new Input();
  input.keyDown('Space');
  input.keyDown('KeyE');
  input.keyDown('KeyN');
  assert.equal(input.wasPressed('attack'), true);
  assert.equal(input.wasPressed('interact'), true);
  assert.equal(input.wasPressed('newGame'), true);
  input.endFrame();
  input.keyDown('Enter');
  assert.equal(input.wasPressed('interact'), true);
});

test('wasPressed lasts until endFrame and is not repeated while held', () => {
  const input = new Input();
  input.keyDown('Space');
  assert.equal(input.wasPressed('attack'), true);
  input.endFrame();
  assert.equal(input.wasPressed('attack'), false);
  input.keyDown('Space'); // keyboard auto-repeat sends keydown again while held
  assert.equal(input.wasPressed('attack'), false);
  assert.equal(input.isDown('attack'), true);
});

test('keyDown reports whether the game uses the key', () => {
  const input = new Input();
  assert.equal(input.keyDown('KeyE'), true);
  assert.equal(input.keyDown('KeyQ'), false);
});

test('clear releases everything', () => {
  const input = new Input();
  input.keyDown('ArrowUp');
  input.clear();
  assert.equal(input.isDown('up'), false);
  assert.equal(input.wasPressed('up'), false);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/input.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/engine/input.js`**

```js
// Keyboard → game actions. Only this file touches keyboard events.

export const KEY_ACTIONS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'attack',
  KeyE: 'interact',
  Enter: 'interact',
  KeyN: 'newGame',
};

export class Input {
  constructor() {
    this.downKeys = new Set();
    this.pressed = new Set();
  }

  /** Returns true when the key is used by the game (so the page shouldn't scroll). */
  keyDown(code) {
    const action = KEY_ACTIONS[code];
    if (!action) return false;
    if (!this.downKeys.has(code)) this.pressed.add(action);
    this.downKeys.add(code);
    return true;
  }

  keyUp(code) {
    this.downKeys.delete(code);
    return code in KEY_ACTIONS;
  }

  isDown(action) {
    for (const code of this.downKeys) {
      if (KEY_ACTIONS[code] === action) return true;
    }
    return false;
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  /** Call after each fixed update step. */
  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.downKeys.clear();
    this.pressed.clear();
  }
}

export function attachKeyboard(input, target = window) {
  target.addEventListener('keydown', (e) => {
    if (input.keyDown(e.code)) e.preventDefault();
  });
  target.addEventListener('keyup', (e) => {
    if (input.keyUp(e.code)) e.preventDefault();
  });
  target.addEventListener('blur', () => input.clear());
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/input.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/input.js tests/input.test.js
git commit -m "feat: add keyboard input with per-step presses" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sprite parsing and cache

**Files:**
- Create: `src/engine/sprites.js`, `tests/sprites.test.js`

**Interfaces:**
- Produces: `parseSprite(rows, palette) → {width, height, pixels}`, where `pixels` is a row-major array of color strings or `null` for transparent. `flipH(sprite)` and `flipV(sprite)` return new sprites. `resolveSprite(defs, name, basePalette) → sprite`. `createSpriteCache(defs, basePalette) → { get(name) → HTMLCanvasElement }` (DOM; not unit-tested).
- Sprite definition formats: `{ rows: string[], palette?: {char: color|null} }`, `{ mirrorOf: 'otherName' }` (left-right flip) or `{ flipOf: 'otherName' }` (top-bottom flip).

- [ ] **Step 1: Write the failing tests in `tests/sprites.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSprite, flipH, flipV, resolveSprite } from '../src/engine/sprites.js';

const PAL = { '.': null, r: '#ff0000', b: '#0000ff' };

test('parseSprite reads size and colors row by row', () => {
  const s = parseSprite(['r.', 'bb', '.r'], PAL);
  assert.equal(s.width, 2);
  assert.equal(s.height, 3);
  assert.deepEqual(s.pixels, ['#ff0000', null, '#0000ff', '#0000ff', null, '#ff0000']);
});

test('parseSprite rejects ragged rows', () => {
  assert.throws(() => parseSprite(['rr', 'r'], PAL), /row 1/);
});

test('parseSprite rejects unknown color characters', () => {
  assert.throws(() => parseSprite(['rz'], PAL), /"z"/);
});

test('flipH mirrors left-right', () => {
  assert.deepEqual(flipH(parseSprite(['rb', '.r'], PAL)).pixels, ['#0000ff', '#ff0000', '#ff0000', null]);
});

test('flipV mirrors top-bottom', () => {
  assert.deepEqual(flipV(parseSprite(['rb', '.r'], PAL)).pixels, [null, '#ff0000', '#ff0000', '#0000ff']);
});

test('resolveSprite merges the base palette with the sprite palette', () => {
  const defs = { a: { rows: ['rg'], palette: { g: '#00ff00' } } };
  assert.deepEqual(resolveSprite(defs, 'a', PAL).pixels, ['#ff0000', '#00ff00']);
});

test('resolveSprite follows mirrorOf and flipOf', () => {
  const defs = {
    a: { rows: ['rb'] },
    b: { mirrorOf: 'a' },
    c: { rows: ['r', 'b'] },
    d: { flipOf: 'c' },
  };
  assert.deepEqual(resolveSprite(defs, 'b', PAL).pixels, ['#0000ff', '#ff0000']);
  assert.deepEqual(resolveSprite(defs, 'd', PAL).pixels, ['#0000ff', '#ff0000']);
});

test('resolveSprite names the sprite in errors', () => {
  assert.throws(() => resolveSprite({ bad: { rows: ['rz'] } }, 'bad', PAL), /bad/);
  assert.throws(() => resolveSprite({}, 'missing', PAL), /missing/);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/sprites.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/engine/sprites.js`**

```js
// Pixel-art sprites defined as strings. Parsing is pure; createSpriteCache
// turns parsed sprites into canvases (one of the two files allowed to touch the DOM).

export function parseSprite(rows, palette) {
  const height = rows.length;
  const width = rows[0].length;
  const pixels = [];
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`row ${y} has ${row.length} pixels, expected ${width}`);
    }
    for (const ch of row) {
      if (!(ch in palette)) throw new Error(`unknown color "${ch}" in row ${y}`);
      pixels.push(palette[ch]);
    }
  });
  return { width, height, pixels };
}

export function flipH({ width, height, pixels }) {
  const out = [];
  for (let y = 0; y < height; y++) {
    for (let x = width - 1; x >= 0; x--) out.push(pixels[y * width + x]);
  }
  return { width, height, pixels: out };
}

export function flipV({ width, height, pixels }) {
  const out = [];
  for (let y = height - 1; y >= 0; y--) {
    out.push(...pixels.slice(y * width, (y + 1) * width));
  }
  return { width, height, pixels: out };
}

export function resolveSprite(defs, name, basePalette) {
  const def = defs[name];
  if (!def) throw new Error(`unknown sprite "${name}"`);
  try {
    if (def.mirrorOf) return flipH(resolveSprite(defs, def.mirrorOf, basePalette));
    if (def.flipOf) return flipV(resolveSprite(defs, def.flipOf, basePalette));
    return parseSprite(def.rows, { ...basePalette, ...(def.palette ?? {}) });
  } catch (err) {
    throw new Error(`sprite "${name}": ${err.message}`);
  }
}

export function createSpriteCache(defs, basePalette) {
  const cache = new Map();
  return {
    get(name) {
      if (!cache.has(name)) cache.set(name, toCanvas(resolveSprite(defs, name, basePalette)));
      return cache.get(name);
    },
  };
}

function toCanvas({ width, height, pixels }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  pixels.forEach((color, i) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(i % width, Math.floor(i / width), 1, 1);
  });
  return canvas;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/sprites.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/sprites.js tests/sprites.test.js
git commit -m "feat: add string-based sprite parsing and canvas cache" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pixel art and sprite preview page

This task is visual. The test locks down the **names and sizes** the engine relies on. The drawing itself is iterated by rendering `sprites.html` and looking at screenshots, so execute it in the main session (with a browser) rather than handing it to a subagent without one. Worked examples below show the format. Every other sprite follows the design notes.

**Files:**
- Create: `src/art/palette.js`, `src/art/tiles.js`, `src/art/characters.js`, `src/art/items.js`, `src/art/index.js`, `sprites.html`, `tests/art.test.js`

**Interfaces:**
- Consumes: `resolveSprite`, `createSpriteCache` (Task 3).
- Produces: `SPRITES` (all definitions merged), `PALETTE`, `SPRITE_GROUPS` (`{ Tiles: [...names], Characters: [...], Items: [...] }`) from `src/art/index.js`.
- Sprite names used by later tasks (exact):
  - Tiles (16×16): `snow`, `path`, `tree`, `rock`, `lamppost`, `wardrobe`, `door_locked`, `door_open`
  - Lucy (16×16): `lucy_{down,up,right,left}_{0,1}`
  - Mr. Tumnus (16×16): `tumnus_{down,up,right,left}`
  - Wolf (16×16): `wolf_{down,up,right,left}_{0,1}`
  - Swords: `sword_up`, `sword_down` (8×12); `sword_right`, `sword_left` (12×8)
  - Items (8×8): `heart_full`, `heart_half`, `heart_empty`, `key`

- [ ] **Step 1: Write the failing manifest test in `tests/art.test.js`**

```js
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/art.test.js`
Expected: FAIL with `Cannot find module .../src/art/index.js`.

- [ ] **Step 3: Create `src/art/palette.js`**

```js
// Shared colors for all sprites. One character per color; '.' is transparent.
// A sprite may add or override entries with its own `palette`.
export const PALETTE = {
  '.': null,
  k: '#1b1b2a', // outline / darkest
  w: '#ffffff', // white highlight
  s: '#e8f0f8', // snow
  S: '#c9d7e8', // snow shadow
  B: '#9db2cc', // deep snow shadow / trodden path
  n: '#4a2f1b', // dark wood
  N: '#6e4526', // wood
  o: '#9a6634', // light wood
  g: '#24503a', // dark pine
  G: '#35704c', // pine
  r: '#5d6370', // iron / dark stone
  R: '#8d95a3', // stone / steel
  y: '#ffe27a', // lamp light / gold
  Y: '#e0a63c', // dark gold
  f: '#f2c6a0', // skin
  F: '#d39b74', // skin shadow
  h: '#7a4a24', // brown hair / fur
  H: '#a8693a', // light brown fur
  b: '#3f6fb5', // blue
  e: '#d6324a', // red
  E: '#8f1d30', // dark red
  q: '#5f6270', // wolf dark grey
  Q: '#8e919c', // wolf grey
  z: '#cfd2d8', // wolf light grey
};
```

- [ ] **Step 4: Create `src/art/index.js`**

```js
import { PALETTE } from './palette.js';
import { TILE_SPRITES } from './tiles.js';
import { CHARACTER_SPRITES } from './characters.js';
import { ITEM_SPRITES } from './items.js';

export { PALETTE };

export const SPRITES = { ...TILE_SPRITES, ...CHARACTER_SPRITES, ...ITEM_SPRITES };

export const SPRITE_GROUPS = {
  Tiles: Object.keys(TILE_SPRITES),
  Characters: Object.keys(CHARACTER_SPRITES),
  Items: Object.keys(ITEM_SPRITES),
};
```

- [ ] **Step 5: Create `src/art/tiles.js` with all 8 tiles**

The file exports `TILE_SPRITES`. `snow` is given in full as the format example:

```js
export const TILE_SPRITES = {
  snow: {
    rows: [
      'ssssssssssssssss',
      'ssssssSsssssssss',
      'ssssssssssssssss',
      'sssssssssssSssss',
      'ssSsssssssssssss',
      'ssssssssssssssss',
      'ssssssssSsssssss',
      'ssssssssssssssss',
      'ssssssssssssssSs',
      'sssSssssssssssss',
      'ssssssssssssssss',
      'sssssssssSssssss',
      'ssssssssssssssss',
      'sSssssssssssssss',
      'sssssssssssssSss',
      'ssssssssssssssss',
    ],
  },
  // path, tree, rock, lamppost, wardrobe, door_locked, door_open — see design notes
};
```

Design notes (all 16×16):
- `path`: trodden snow. Mostly `S` with scattered `B` speckles. Fully opaque, and it must tile seamlessly in every direction.
- `tree`: snowy evergreen on a transparent (`.`) background, since it's drawn over `snow`. A triangular pine in `g`/`G` with `s`/`w` snow on the branch tops, a short `n` trunk at the bottom centre and a `k` outline.
- `rock`: a grey boulder in `R` with `r` shading, a `k` outline and a snow cap (`s`/`w`) on top. Transparent background.
- `lamppost`: a thin `k`/`r` iron post up the centre, a lamp housing at the top with a glowing `y`/`Y` centre, and a small base. Transparent background. This is the iconic object of Room 1, so it must be instantly recognisable.
- `wardrobe`: the front of a wooden wardrobe filling the tile (`N`/`o` panels, `n` frame), with two doors slightly ajar showing a `k` gap in the middle and tiny `y` knobs. Opaque.
- `door_locked`: a wooden gate (`N`/`o` planks) in a stone frame (`R`/`r`), with a visible `y` keyhole or lock plate. Opaque.
- `door_open`: the same stone frame with a dark (`k`) opening. Opaque.

- [ ] **Step 6: Create `src/art/characters.js` with Lucy, Mr. Tumnus, and the wolf**

The file exports `CHARACTER_SPRITES`. The left-facing sprites are mirrors:

```js
export const CHARACTER_SPRITES = {
  // lucy_down_0, lucy_down_1, lucy_up_0, lucy_up_1, lucy_right_0, lucy_right_1: drawn
  lucy_left_0: { mirrorOf: 'lucy_right_0' },
  lucy_left_1: { mirrorOf: 'lucy_right_1' },
  // tumnus_down, tumnus_up, tumnus_right: drawn
  tumnus_left: { mirrorOf: 'tumnus_right' },
  // wolf_down_0, wolf_down_1, wolf_up_0, wolf_up_1, wolf_right_0, wolf_right_1: drawn
  wolf_left_0: { mirrorOf: 'wolf_right_0' },
  wolf_left_1: { mirrorOf: 'wolf_right_1' },
};
```

Design notes (16×16, transparent background, `k` outline). Feet sit on the bottom row and the body fills roughly the bottom 12 rows, because the collision box is 12×12 at offset (2, 4).
- **Lucy:** shoulder-length `h` hair, `f`/`F` skin, a `b` blue dress, `k` shoes. `down` shows her face (two `k` eye pixels), `up` shows the back of her hair, and `right` is a side profile. Frame `_1` swaps which leg is forward (shift the feet 1px). She must read as a small girl at 1× scale.
- **Mr. Tumnus:** a faun. Curly `h` hair with two small `R`/`w` horns, `f` skin, an `e`/`E` red scarf, `H` furry goat legs with `k` hooves, and an optional small `k` umbrella held in `right`. One frame per direction.
- **Wolf:** `q`/`Q`/`z` grey with pointed ears, `k` eye and nose pixels, and a lighter `z` belly. `right` is a four-legged side view with tail and snout, `down` is front-facing, and `up` shows the back and tail. Frame `_1` moves the legs. It should look like a menacing but not scary (kid-friendly) wolf.

- [ ] **Step 7: Create `src/art/items.js` with hearts, key, and swords**

`heart_full` and `sword_up` are given in full as format examples:

```js
export const ITEM_SPRITES = {
  heart_full: {
    rows: [
      '.kk.kk..',
      'kwekeek.',
      'keeeeek.',
      'keeeeek.',
      '.keeek..',
      '..kek...',
      '...k....',
      '........',
    ],
  },
  // heart_half, heart_empty, key: see design notes
  sword_up: {
    rows: [
      '...kk...',
      '..kwRk..',
      '..kwRk..',
      '..kwRk..',
      '..kwRk..',
      '..kwRk..',
      '..kwRk..',
      '.kYyyYk.',
      'kYYyyYYk',
      '...nn...',
      '...nn...',
      '...kk...',
    ],
  },
  sword_down: { flipOf: 'sword_up' },
  // sword_right (12×8): blade pointing right, hilt on the left: drawn
  sword_left: { mirrorOf: 'sword_right' },
};
```

Design notes:
- `heart_half` (8×8): the same outline as `heart_full`, with the left half filled `e` and the right half empty (dark `E` or `k` interior).
- `heart_empty` (8×8): the same outline, with a dark (`E`) interior.
- `key` (8×8): a gold key (`y`/`Y`, `k` outline) with a round bow on the left and teeth on the right.
- `sword_right` (12×8): `sword_up` rotated to point right, with the blade along the middle rows, the guard near the left and the grip at the far left.

- [ ] **Step 8: Run the art tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/art.test.js`
Expected: PASS (36 named-sprite tests + 3 others).

- [ ] **Step 9: Create `sprites.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sprite Preview</title>
<style>
  body { margin: 16px; background: #1b1f2a; color: #e8f0f8; font: 14px system-ui, sans-serif; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { margin: 0; padding: 8px; background: #2a3040; border-radius: 6px; text-align: center; }
  canvas { display: block; image-rendering: pixelated; }
  figcaption { margin-top: 6px; font: 12px monospace; }
  .error { color: #ff9aa8; white-space: pre-wrap; font-family: monospace; }
</style>
</head>
<body>
<h1>Sprite preview</h1>
<p>Each sprite at 6×, on snow (left) and on dark (right). Serve the project locally (see README) to view this page.</p>
<main id="out"></main>
<script type="module">
  import { SPRITES, PALETTE, SPRITE_GROUPS } from './src/art/index.js';
  import { createSpriteCache } from './src/engine/sprites.js';

  const ZOOM = 6;
  const out = document.getElementById('out');
  const cache = createSpriteCache(SPRITES, PALETTE);

  function section(title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'grid';
    out.append(h2, grid);
    return grid;
  }

  // Tiling check: a small patch of floor with a tree, rock and lamp-post.
  const patch = [
    ['snow', 'snow', 'path', 'snow', 'snow', 'tree'],
    ['snow', 'rock', 'path', 'lamppost', 'snow', 'snow'],
    ['snow', 'snow', 'path', 'path', 'path', 'snow'],
  ];
  const tiling = document.createElement('canvas');
  tiling.width = 6 * 16 * 4;
  tiling.height = 3 * 16 * 4;
  const tctx = tiling.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  patch.forEach((row, r) => row.forEach((name, c) => {
    tctx.drawImage(cache.get('snow'), c * 64, r * 64, 64, 64);
    tctx.drawImage(cache.get(name), c * 64, r * 64, 64, 64);
  }));
  section('Tiling check (4×)').append(tiling);

  for (const [group, names] of Object.entries(SPRITE_GROUPS)) {
    const grid = section(group);
    for (const name of names) {
      const fig = document.createElement('figure');
      try {
        const img = cache.get(name);
        const w = img.width * ZOOM;
        const h = img.height * ZOOM;
        const c = document.createElement('canvas');
        c.width = w * 2 + ZOOM;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = PALETTE.s;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#10141f';
        ctx.fillRect(w + ZOOM, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.drawImage(img, w + ZOOM, 0, w, h);
        const cap = document.createElement('figcaption');
        cap.textContent = `${name} (${img.width}×${img.height})`;
        fig.append(c, cap);
      } catch (err) {
        const div = document.createElement('div');
        div.className = 'error';
        div.textContent = `${name}\n${err.message}`;
        fig.append(div);
      }
      grid.append(fig);
    }
  }
</script>
</body>
</html>
```

- [ ] **Step 10: Review the art visually and iterate**

Start a server in the background: `python3 -m http.server 8000` (from the project root). Open `http://localhost:8000/sprites.html` in a browser (use the claude-in-chrome skill) and screenshot it. Check against this list, editing sprites and re-screenshotting until every item holds:
- There are no red error boxes.
- Snow and path tile seamlessly in the tiling check, with no visible grid seams.
- Tree, rock and lamp-post have transparent backgrounds (snow shows through on the left preview).
- Lucy, Tumnus and the wolf are each recognisable at a glance and clearly different from one another.
- Walk frames `_0` and `_1` differ visibly in the legs. Left-facing sprites face left.
- Hearts read as full, half and empty, and the key reads as a key.

Re-run `node --test tests/art.test.js` after edits.

- [ ] **Step 11: Commit**

```bash
git add src/art sprites.html tests/art.test.js
git commit -m "feat: add pixel art for room 1 and sprite preview page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Room definitions: legend, validation, parsing

**Files:**
- Create: `src/game/roomdef.js`, `tests/roomdef.test.js`

**Interfaces:**
- Consumes: `ROOM_COLS`, `ROOM_ROWS` from config.
- Produces:
  - `DEFAULT_LEGEND`: char → `{ tile: spriteName, solid: boolean, role?: 'entrance' | 'exit' }`
  - `ENTITY_TYPES`: `['npc', 'wolf', 'key', 'heart']`
  - `legendFor(def)` → merged legend
  - `validateRoomDef(def) → string[]` (empty when valid)
  - `parseRoomDef(def) → { tiles: string[][], solid: boolean[][], entrance: {col,row}, exit: {col,row}, spawn: {col,row,facing} }`, which throws `RoomError`
  - `class RoomError extends Error` with `.errors: string[]`
- Room definition: `{ id, name, map: string[11] of length 16, legend?, entities: [{type, x, y, ...}], hooks? }`. NPC entities also need `id`, `sprite` and `dialogue: string[]`, and may have `name`.

- [ ] **Step 1: Write the failing tests in `tests/roomdef.test.js`**

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/roomdef.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/game/roomdef.js`**

```js
import { ROOM_COLS, ROOM_ROWS } from '../config.js';

// Map characters → tiles. Rooms may add or override entries via `legend`.
export const DEFAULT_LEGEND = {
  '.': { tile: 'snow', solid: false },
  ',': { tile: 'path', solid: false },
  T: { tile: 'tree', solid: true },
  R: { tile: 'rock', solid: true },
  L: { tile: 'lamppost', solid: true },
  W: { tile: 'wardrobe', solid: true, role: 'entrance' },
  X: { tile: 'door_locked', solid: true, role: 'exit' },
};

export const ENTITY_TYPES = ['npc', 'wolf', 'key', 'heart'];

// Where the player appears next to the entrance: the first open neighbour in
// this order, facing away from the entrance.
const NEIGHBORS = [
  { dc: 0, dr: 1, facing: 'down' },
  { dc: 0, dr: -1, facing: 'up' },
  { dc: 1, dr: 0, facing: 'right' },
  { dc: -1, dr: 0, facing: 'left' },
];

export class RoomError extends Error {
  constructor(roomName, errors) {
    super(`Room "${roomName}" has problems:\n- ${errors.join('\n- ')}`);
    this.name = 'RoomError';
    this.errors = errors;
  }
}

export function legendFor(def) {
  return { ...DEFAULT_LEGEND, ...(def.legend ?? {}) };
}

export function validateRoomDef(def) {
  const errors = [];
  const { map } = def;
  if (!Array.isArray(map) || map.length !== ROOM_ROWS) {
    errors.push(`map must have ${ROOM_ROWS} rows (found ${Array.isArray(map) ? map.length : 'none'})`);
    return errors;
  }
  map.forEach((row, r) => {
    if (typeof row !== 'string' || row.length !== ROOM_COLS) {
      errors.push(`row ${r} must have ${ROOM_COLS} characters (found ${row?.length ?? 0})`);
    }
  });
  if (errors.length) return errors;

  const legend = legendFor(def);
  const doors = { entrance: [], exit: [] };
  map.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const tile = legend[ch];
      if (!tile) errors.push(`unknown tile "${ch}" at column ${c}, row ${r}`);
      else if (tile.role) doors[tile.role].push({ col: c, row: r });
    });
  });
  for (const role of ['entrance', 'exit']) {
    if (doors[role].length !== 1) errors.push(`map needs exactly one ${role} (found ${doors[role].length})`);
  }
  if (doors.entrance.length === 1 && !findSpawn(map, legend, doors.entrance[0])) {
    errors.push('there is no open floor next to the entrance');
  }

  const npcIds = new Set();
  (def.entities ?? []).forEach((e, i) => {
    const label = `entity ${i} (${e.type})`;
    if (!ENTITY_TYPES.includes(e.type)) {
      errors.push(`${label}: unknown entity type "${e.type}"`);
      return;
    }
    const inside = Number.isInteger(e.x) && Number.isInteger(e.y) && e.x >= 0 && e.x < ROOM_COLS && e.y >= 0 && e.y < ROOM_ROWS;
    if (!inside) errors.push(`${label} at ${e.x},${e.y} is outside the map`);
    else if (legend[map[e.y][e.x]]?.solid ?? true) errors.push(`${label} at ${e.x},${e.y} is on a solid tile`);
    if (e.type === 'npc') {
      if (!e.id) errors.push(`${label} needs an id`);
      else if (npcIds.has(e.id)) errors.push(`${label}: duplicate NPC id "${e.id}"`);
      else npcIds.add(e.id);
      if (!e.sprite) errors.push(`${label} needs a sprite`);
      if (!Array.isArray(e.dialogue) || e.dialogue.length === 0) errors.push(`${label} needs at least one line of dialogue`);
    }
  });
  return errors;
}

export function parseRoomDef(def) {
  const errors = validateRoomDef(def);
  if (errors.length) throw new RoomError(def.name ?? def.id ?? 'unnamed room', errors);
  const legend = legendFor(def);
  const tiles = def.map.map((row) => [...row].map((ch) => legend[ch].tile));
  const solid = def.map.map((row) => [...row].map((ch) => legend[ch].solid));
  let entrance;
  let exit;
  def.map.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (legend[ch].role === 'entrance') entrance = { col: c, row: r };
      if (legend[ch].role === 'exit') exit = { col: c, row: r };
    });
  });
  return { tiles, solid, entrance, exit, spawn: findSpawn(def.map, legend, entrance) };
}

function findSpawn(map, legend, { col, row }) {
  for (const n of NEIGHBORS) {
    const c = col + n.dc;
    const r = row + n.dr;
    if (r < 0 || r >= map.length || c < 0 || c >= map[r].length) continue;
    const tile = legend[map[r][c]];
    if (tile && !tile.solid) return { col: c, row: r, facing: n.facing };
  }
  return null;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/roomdef.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/roomdef.js tests/roomdef.test.js
git commit -m "feat: add room definition legend, validation and parsing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Directions and the player

**Files:**
- Create: `src/game/direction.js`, `src/game/player.js`, `tests/direction.test.js`, `tests/player.test.js`

**Interfaces:**
- Consumes: `moveAndSlide` (Task 1), `PLAYER` and `TILE` from config. Input is anything with `isDown(action)` and `wasPressed(action)`.
- Produces:
  - `DIRS`: `{ up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} }`
  - `facingFromVector(vx, vy) → 'up'|'down'|'left'|'right'`
  - `chooseFacing(current, ix, iy) → facing`
  - `class Player`, constructed as `new Player(x, y, facing)` or `Player.atTile(col, row, facing = 'down')`.
    - Fields: `x`, `y`, `w`, `h`, `facing`, `health`, `maxHealth`, `invuln`, `hasKey`, `moving`
    - Getters: `dead`, `attacking`
    - Methods: `center() → {x, y}`, `update(dt, input, isSolidAt)`, `swordBox() → box | null`, `hurt(amount, fromX, fromY) → boolean`, `heal(amount)`, `spriteName() → 'lucy_<facing>_<0|1>'`

- [ ] **Step 1: Write the failing tests in `tests/direction.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facingFromVector, chooseFacing } from '../src/game/direction.js';

test('facingFromVector picks the dominant axis', () => {
  assert.equal(facingFromVector(1, 0.5), 'right');
  assert.equal(facingFromVector(-1, 0), 'left');
  assert.equal(facingFromVector(0.2, 1), 'down');
  assert.equal(facingFromVector(0, -1), 'up');
});

test('chooseFacing follows a single held direction', () => {
  assert.equal(chooseFacing('down', 1, 0), 'right');
  assert.equal(chooseFacing('down', 0, -1), 'up');
});

test('chooseFacing keeps the current facing when it is one of two held directions', () => {
  assert.equal(chooseFacing('up', 1, -1), 'up');
  assert.equal(chooseFacing('left', -1, 1), 'left');
});

test('chooseFacing prefers horizontal when moving diagonally away from the current facing', () => {
  assert.equal(chooseFacing('down', 1, -1), 'right');
});
```

- [ ] **Step 2: Write the failing tests in `tests/player.test.js`**

```js
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/direction.test.js tests/player.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `src/game/direction.js`**

```js
export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Facing for a movement vector: whichever axis is larger wins (ties go horizontal). */
export function facingFromVector(vx, vy) {
  if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** Facing from held input (ix, iy in -1..1). Diagonals keep the current facing when it matches. */
export function chooseFacing(current, ix, iy) {
  if (ix !== 0 && iy !== 0) {
    const keeps =
      (current === 'left' && ix < 0) ||
      (current === 'right' && ix > 0) ||
      (current === 'up' && iy < 0) ||
      (current === 'down' && iy > 0);
    if (keeps) return current;
    return ix > 0 ? 'right' : 'left';
  }
  if (ix !== 0) return ix > 0 ? 'right' : 'left';
  return iy > 0 ? 'down' : 'up';
}
```

- [ ] **Step 5: Implement `src/game/player.js`**

```js
import { PLAYER, TILE } from '../config.js';
import { moveAndSlide } from '../engine/collision.js';
import { DIRS, chooseFacing } from './direction.js';

export class Player {
  constructor(x, y, facing = 'down') {
    this.x = x;
    this.y = y;
    this.w = PLAYER.box.w;
    this.h = PLAYER.box.h;
    this.facing = facing;
    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.invuln = 0;
    this.knockTime = 0;
    this.knockVx = 0;
    this.knockVy = 0;
    this.swordTimer = 0;
    this.cooldown = 0;
    this.hasKey = false;
    this.moving = false;
    this.animTime = 0;
  }

  static atTile(col, row, facing = 'down') {
    return new Player(
      col * TILE + (TILE - PLAYER.box.w) / 2,
      row * TILE + (TILE - PLAYER.box.h) / 2,
      facing,
    );
  }

  get dead() {
    return this.health <= 0;
  }

  get attacking() {
    return this.swordTimer > 0;
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  update(dt, input, isSolidAt) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.moving = false;

    if (this.knockTime > 0) {
      this.knockTime -= dt;
      this.moveBy(this.knockVx * dt, this.knockVy * dt, isSolidAt, 0);
      return;
    }
    if (this.swordTimer > 0) {
      this.swordTimer -= dt;
      if (this.swordTimer <= 0) {
        this.swordTimer = 0;
        this.cooldown = PLAYER.swordCooldown;
      }
      return;
    }
    if (input.wasPressed('attack') && this.cooldown === 0) {
      this.swordTimer = PLAYER.swordTime;
      return;
    }

    const ix = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const iy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    if (ix === 0 && iy === 0) return;
    this.moving = true;
    this.facing = chooseFacing(this.facing, ix, iy);
    const step = (PLAYER.speed * dt) / Math.hypot(ix, iy);
    this.moveBy(ix * step, iy * step, isSolidAt, PLAYER.cornerNudge);
    this.animTime += dt;
  }

  moveBy(dx, dy, isSolidAt, nudge) {
    const p = moveAndSlide(this, dx, dy, isSolidAt, nudge);
    this.x = p.x;
    this.y = p.y;
  }

  swordBox() {
    if (!this.attacking) return null;
    const reach = PLAYER.swordReach;
    const width = PLAYER.swordWidth;
    const { x: cx, y: cy } = this.center();
    switch (this.facing) {
      case 'up':
        return { x: cx - width / 2, y: this.y - reach, w: width, h: reach };
      case 'down':
        return { x: cx - width / 2, y: this.y + this.h, w: width, h: reach };
      case 'left':
        return { x: this.x - reach, y: cy - width / 2, w: reach, h: width };
      default:
        return { x: this.x + this.w, y: cy - width / 2, w: reach, h: width };
    }
  }

  /** Returns true if the hit landed (false while invulnerable or dead). */
  hurt(amount, fromX, fromY) {
    if (this.invuln > 0 || this.dead) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = PLAYER.invulnTime;
    this.swordTimer = 0;
    const c = this.center();
    let vx = c.x - fromX;
    let vy = c.y - fromY;
    let len = Math.hypot(vx, vy);
    if (len === 0) {
      vx = -DIRS[this.facing].x;
      vy = -DIRS[this.facing].y;
      len = 1;
    }
    this.knockVx = (vx / len) * PLAYER.knockbackSpeed;
    this.knockVy = (vy / len) * PLAYER.knockbackSpeed;
    this.knockTime = PLAYER.knockbackTime;
    return true;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  spriteName() {
    const frame = this.moving ? Math.floor(this.animTime / PLAYER.walkFrameTime) % 2 : 0;
    return `lucy_${this.facing}_${frame}`;
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/direction.test.js tests/player.test.js`
Expected: PASS, 17 tests.

- [ ] **Step 7: Commit**

```bash
git add src/game/direction.js src/game/player.js tests/direction.test.js tests/player.test.js
git commit -m "feat: add player movement, sword, damage and knockback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wolf enemy

**Files:**
- Create: `src/game/enemies.js`, `tests/enemies.test.js`

**Interfaces:**
- Consumes: `moveAndSlide`, `facingFromVector`, `WOLF` and `TILE` from config. A "player" is anything with `center() → {x, y}`.
- Produces: `class Wolf`, constructed as `new Wolf(x, y, rng = Math.random)` or `Wolf.atTile(col, row, rng)`.
  - Fields: `x`, `y`, `w`, `h`, `health`, `damage`, `dead`, `state` (`'wander'|'chase'`), `facing`, `hurtTimer`
  - Methods: `center()`, `update(dt, player, isSolidAt)`, `hurt(amount, fromX, fromY) → boolean`, `spriteName() → 'wolf_<facing>_<0|1>'`
  - Wander uses `rng()` twice per pick: first for the direction index into `[still, right, left, down, up]`, then for the timer.

- [ ] **Step 1: Write the failing tests in `tests/enemies.test.js`**

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/enemies.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/game/enemies.js`**

```js
import { TILE, WOLF } from '../config.js';
import { moveAndSlide } from '../engine/collision.js';
import { facingFromVector } from './direction.js';

const WANDER_DIRS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** The White Witch's wolf: wanders, chases the player when close, 2 hits to defeat. */
export class Wolf {
  constructor(x, y, rng = Math.random) {
    this.x = x;
    this.y = y;
    this.w = WOLF.box.w;
    this.h = WOLF.box.h;
    this.rng = rng;
    this.health = WOLF.health;
    this.damage = WOLF.damage;
    this.dead = false;
    this.state = 'wander';
    this.facing = 'down';
    this.dir = WANDER_DIRS[0];
    this.wanderTimer = 0;
    this.hurtTimer = 0;
    this.knockTime = 0;
    this.knockVx = 0;
    this.knockVy = 0;
    this.moving = false;
    this.animTime = 0;
  }

  static atTile(col, row, rng) {
    return new Wolf(col * TILE + (TILE - WOLF.box.w) / 2, row * TILE + (TILE - WOLF.box.h) / 2, rng);
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  update(dt, player, isSolidAt) {
    if (this.dead) return;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.moving = false;
    if (this.knockTime > 0) {
      this.knockTime -= dt;
      this.moveBy(this.knockVx * dt, this.knockVy * dt, isSolidAt);
      return;
    }

    const me = this.center();
    const target = player.center();
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const dist = Math.hypot(dx, dy);
    let vx = 0;
    let vy = 0;
    let speed = 0;
    if (dist <= WOLF.chaseRadius) {
      this.state = 'chase';
      if (dist > 0) {
        vx = dx / dist;
        vy = dy / dist;
        speed = WOLF.chaseSpeed;
      }
    } else {
      this.state = 'wander';
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) this.pickWanderDir();
      vx = this.dir.x;
      vy = this.dir.y;
      speed = WOLF.wanderSpeed;
    }
    if (vx === 0 && vy === 0) return;

    this.moving = true;
    this.facing = facingFromVector(vx, vy);
    const [bx, by] = [this.x, this.y];
    this.moveBy(vx * speed * dt, vy * speed * dt, isSolidAt);
    this.animTime += dt;
    if (this.state === 'wander' && this.x === bx && this.y === by) this.wanderTimer = 0;
  }

  pickWanderDir() {
    this.dir = WANDER_DIRS[Math.floor(this.rng() * WANDER_DIRS.length)];
    this.wanderTimer = WOLF.wanderMinTime + this.rng() * (WOLF.wanderMaxTime - WOLF.wanderMinTime);
  }

  moveBy(dx, dy, isSolidAt) {
    const p = moveAndSlide(this, dx, dy, isSolidAt, 0);
    this.x = p.x;
    this.y = p.y;
  }

  /** Returns true if the hit landed. */
  hurt(amount, fromX, fromY) {
    if (this.dead || this.hurtTimer > 0) return false;
    this.health -= amount;
    this.hurtTimer = WOLF.hurtTime;
    const c = this.center();
    const vx = c.x - fromX;
    const vy = c.y - fromY;
    const len = Math.hypot(vx, vy) || 1;
    this.knockVx = (vx / len) * WOLF.knockbackSpeed;
    this.knockVy = (vy / len) * WOLF.knockbackSpeed;
    this.knockTime = WOLF.knockbackTime;
    if (this.health <= 0) this.dead = true;
    return true;
  }

  spriteName() {
    const frame = this.moving ? Math.floor(this.animTime / WOLF.walkFrameTime) % 2 : 0;
    return `wolf_${this.facing}_${frame}`;
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/enemies.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemies.js tests/enemies.test.js
git commit -m "feat: add wolf enemy with wander, chase and knockback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: NPCs and pickups

**Files:**
- Create: `src/game/npc.js`, `src/game/items.js`, `tests/npc.test.js`, `tests/items.test.js`

**Interfaces:**
- Consumes: `facingFromVector`, `Player` (tests only), and `TILE`, `NPC`, `PICKUP_SIZE`, `HEART_HEAL` from config.
- Produces:
  - `class Npc`, constructed as `new Npc({ id, name?, sprite, x, y, dialogue })` with x/y in **tiles**.
    - Fields: `id`, `name` (defaults to `id`), `sprite`, `col`, `row`, `x`, `y`, `w`, `h`, `dialogue`, `facing`
    - Methods: `center()`, `notice(player)` (turns to face a nearby player), `canTalkTo(player) → boolean`, `setDialogue(lines) → this`, `onDone(fn) → this`, `finishTalking()` (runs and clears the onDone callback), `spriteName() → '<sprite>_<facing>'`
  - `class Pickup`, constructed as `new Pickup(kind, x, y)`, `Pickup.atTile(kind, col, row)` or `Pickup.centeredOn(kind, cx, cy)`, where `kind` is `'key'|'heart'`.
    - Fields: `kind`, `x`, `y`, `w`, `h`, `taken`
    - Methods: `applyTo(player)`, `spriteName() → 'key' | 'heart_full'`

- [ ] **Step 1: Write the failing tests in `tests/npc.test.js`**

```js
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
```

- [ ] **Step 2: Write the failing tests in `tests/items.test.js`**

```js
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/npc.test.js tests/items.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `src/game/npc.js`**

```js
import { TILE, NPC } from '../config.js';
import { facingFromVector } from './direction.js';

/** A character who stands on one tile (which becomes solid) and talks. */
export class Npc {
  constructor({ id, name, sprite, x, y, dialogue }) {
    this.id = id;
    this.name = name ?? id;
    this.sprite = sprite;
    this.col = x;
    this.row = y;
    this.x = x * TILE;
    this.y = y * TILE;
    this.w = TILE;
    this.h = TILE;
    this.dialogue = [...dialogue];
    this.facing = 'down';
    this.doneCallback = null;
  }

  center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 };
  }

  distanceTo(player) {
    const a = this.center();
    const b = player.center();
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  notice(player) {
    const d = this.distanceTo(player);
    if (d === 0 || d > NPC.noticeDistance) return;
    const a = this.center();
    const b = player.center();
    this.facing = facingFromVector(b.x - a.x, b.y - a.y);
  }

  canTalkTo(player) {
    return this.distanceTo(player) <= NPC.talkDistance;
  }

  setDialogue(lines) {
    this.dialogue = [...lines];
    return this;
  }

  onDone(fn) {
    this.doneCallback = fn;
    return this;
  }

  finishTalking() {
    const fn = this.doneCallback;
    this.doneCallback = null;
    fn?.();
  }

  spriteName() {
    return `${this.sprite}_${this.facing}`;
  }
}
```

- [ ] **Step 5: Implement `src/game/items.js`**

```js
import { TILE, PICKUP_SIZE, HEART_HEAL } from '../config.js';

/** Something the player collects by touching it: 'key' or 'heart'. */
export class Pickup {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.w = PICKUP_SIZE;
    this.h = PICKUP_SIZE;
    this.taken = false;
  }

  static atTile(kind, col, row) {
    const pad = (TILE - PICKUP_SIZE) / 2;
    return new Pickup(kind, col * TILE + pad, row * TILE + pad);
  }

  static centeredOn(kind, cx, cy) {
    return new Pickup(kind, cx - PICKUP_SIZE / 2, cy - PICKUP_SIZE / 2);
  }

  applyTo(player) {
    if (this.kind === 'key') player.hasKey = true;
    if (this.kind === 'heart') player.heal(HEART_HEAL);
    this.taken = true;
  }

  spriteName() {
    return this.kind === 'key' ? 'key' : 'heart_full';
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/npc.test.js tests/items.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add src/game/npc.js src/game/items.js tests/npc.test.js tests/items.test.js
git commit -m "feat: add NPCs and key/heart pickups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Room runtime

**Files:**
- Create: `src/game/room.js`, `tests/room.test.js`

**Interfaces:**
- Consumes: `parseRoomDef` and `RoomError` (Task 5), `Player` (Task 6), `Wolf` (Task 7), `Npc` and `Pickup` (Task 8), `overlaps` (Task 1), and `TILE`, `DOOR_OPEN_TIME`, `WOLF` from config.
- Produces: `class Room`, constructed as `new Room(def, { rng = Math.random, attempt = 1 })`. It throws `RoomError` for invalid defs.
  - Fields: `def`, `attempt`, `tiles` (`string[][]`, mutable: the exit becomes `'door_open'`), `player`, `enemies`, `npcs`, `pickups`, `exit`, `exitOpen`, `completed`
  - Getters: `name`, `failed` (player dead)
  - Methods: `update(dt, input)`, `isSolidAt(col, row)` (bound), `takeDialogue() → { speaker, lines, onDone } | null`
  - Hook API: `npc(id)`, `giveKey()`, `spawn(entityDef)`, `enemiesRemaining()`, `say(speaker, lines, onDone?)`, `player`
  - Hooks called: `hooks.onEnter(room)` at the end of the constructor, and `hooks.onEnemiesCleared(room)` once each time the last enemy falls.

- [ ] **Step 1: Write the failing tests in `tests/room.test.js`**

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/room.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/game/room.js`**

```js
import { TILE, DOOR_OPEN_TIME, WOLF } from '../config.js';
import { overlaps } from '../engine/collision.js';
import { parseRoomDef } from './roomdef.js';
import { Player } from './player.js';
import { Wolf } from './enemies.js';
import { Npc } from './npc.js';
import { Pickup } from './items.js';

/** A live room built from a room definition. Hooks receive this object. */
export class Room {
  constructor(def, { rng = Math.random, attempt = 1 } = {}) {
    const grid = parseRoomDef(def); // throws RoomError when the definition is broken
    this.def = def;
    this.rng = rng;
    this.attempt = attempt;
    this.tiles = grid.tiles;
    this.solid = grid.solid;
    this.entrance = grid.entrance;
    this.exit = grid.exit;
    this.player = Player.atTile(grid.spawn.col, grid.spawn.row, grid.spawn.facing);
    this.enemies = [];
    this.npcs = [];
    this.pickups = [];
    this.dialogueQueue = [];
    this.hadEnemies = false;
    this.clearedFired = false;
    this.exitOpen = false;
    this.exitTimer = 0;
    this.completed = false;
    this.isSolidAt = this.isSolidAt.bind(this);
    for (const e of def.entities ?? []) this.spawn(e);
    def.hooks?.onEnter?.(this);
  }

  get name() {
    return this.def.name;
  }

  get failed() {
    return this.player.dead;
  }

  // ----- hook API -----

  spawn(e) {
    switch (e.type) {
      case 'wolf':
        this.enemies.push(Wolf.atTile(e.x, e.y, this.rng));
        this.hadEnemies = true;
        this.clearedFired = false;
        break;
      case 'npc':
        this.npcs.push(new Npc(e));
        break;
      case 'key':
      case 'heart':
        this.pickups.push(Pickup.atTile(e.type, e.x, e.y));
        break;
      default:
        throw new Error(`unknown entity type "${e.type}"`);
    }
  }

  npc(id) {
    const found = this.npcs.find((n) => n.id === id);
    if (!found) throw new Error(`no NPC with id "${id}" in room "${this.name}"`);
    return found;
  }

  giveKey() {
    this.player.hasKey = true;
  }

  enemiesRemaining() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  say(speaker, lines, onDone) {
    this.dialogueQueue.push({ speaker, lines: [...lines], onDone });
  }

  // ----- engine API -----

  takeDialogue() {
    return this.dialogueQueue.shift() ?? null;
  }

  isSolidAt(col, row) {
    if (row < 0 || row >= this.solid.length || col < 0 || col >= this.solid[0].length) return true;
    if (this.solid[row][col]) return true;
    return this.npcs.some((n) => n.col === col && n.row === row);
  }

  update(dt, input) {
    if (this.completed || this.failed) return;
    if (this.exitOpen) {
      this.exitTimer -= dt;
      if (this.exitTimer <= 0) this.completed = true;
      return;
    }

    const p = this.player;
    p.update(dt, input, this.isSolidAt);

    for (const n of this.npcs) n.notice(p);
    if (input.wasPressed('interact')) {
      const n = this.npcs.find((npc) => npc.canTalkTo(p));
      if (n) this.say(n.name, n.dialogue, () => n.finishTalking());
    }

    for (const e of this.enemies) e.update(dt, p, this.isSolidAt);

    const sword = p.swordBox();
    if (sword) {
      const { x, y } = p.center();
      for (const e of this.enemies) {
        if (!e.dead && overlaps(sword, e) && e.hurt(1, x, y) && e.dead) this.dropLoot(e);
      }
    }

    for (const e of this.enemies) {
      if (!e.dead && overlaps(e, p)) {
        const c = e.center();
        p.hurt(e.damage, c.x, c.y);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    for (const item of this.pickups) {
      if (overlaps(item, p)) item.applyTo(p);
    }
    this.pickups = this.pickups.filter((i) => !i.taken);

    if (this.hadEnemies && !this.clearedFired && this.enemies.length === 0) {
      this.clearedFired = true;
      this.def.hooks?.onEnemiesCleared?.(this);
    }

    if (p.hasKey && this.touchingExit()) {
      p.hasKey = false;
      this.exitOpen = true;
      this.exitTimer = DOOR_OPEN_TIME;
      this.tiles[this.exit.row][this.exit.col] = 'door_open';
    }
  }

  dropLoot(enemy) {
    if (this.rng() < WOLF.heartDropChance) {
      const c = enemy.center();
      this.pickups.push(Pickup.centeredOn('heart', c.x, c.y));
    }
  }

  touchingExit() {
    // The exit tile grown by 1px, so standing flush against it counts.
    const zone = { x: this.exit.col * TILE - 1, y: this.exit.row * TILE - 1, w: TILE + 2, h: TILE + 2 };
    return overlaps(this.player, zone);
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/room.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Run the whole suite**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test`
Expected: PASS, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/game/room.js tests/room.test.js
git commit -m "feat: add room runtime with combat, pickups, hooks and exit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Text wrapping and the dialogue box

**Files:**
- Create: `src/engine/text.js`, `src/game/dialogue.js`, `tests/text.test.js`, `tests/dialogue.test.js`

**Interfaces:**
- Consumes: `DIALOGUE`, `VIEW_WIDTH`, `VIEW_HEIGHT` from config. The renderer API (Task 14) is used only in `render(r)`: `r.rect`, `r.strokeRect`, `r.text`.
- Produces:
  - `wrapText(text, maxChars) → string[]`
  - `paginate(lines, maxChars, linesPerPage) → string[][]`
  - `class DialogueScene`, constructed as `new DialogueScene(speaker, lines, onDone)`
    - Fields: `speaker`, `pages`, `page`, `shown`, `done`, `stack` (set by `SceneStack`)
    - Getters: `pageLength`, `pageComplete`
    - Methods: `visibleLines() → string[]`, `update(dt, input)`, `render(r)`
  - Behaviour: E/Enter (`interact`) completes the page, then advances, and on the last page closes it (`stack.pop()`, then `onDone()`).

- [ ] **Step 1: Write the failing tests in `tests/text.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../src/engine/text.js';

test('short text stays on one line', () => {
  assert.deepEqual(wrapText('Hello there', 20), ['Hello there']);
});

test('wraps at word boundaries', () => {
  assert.deepEqual(wrapText('the quick brown fox jumps', 10), ['the quick', 'brown fox', 'jumps']);
});

test('a word longer than the limit gets its own line', () => {
  assert.deepEqual(wrapText('a supercalifragilistic b', 5), ['a', 'supercalifragilistic', 'b']);
});

test('extra whitespace collapses; empty text gives no lines', () => {
  assert.deepEqual(wrapText('  a   b ', 10), ['a b']);
  assert.deepEqual(wrapText('', 10), []);
});
```

- [ ] **Step 2: Write the failing tests in `tests/dialogue.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DialogueScene, paginate } from '../src/game/dialogue.js';
import { fakeInput } from './helpers.js';

const NONE = fakeInput();
const NEXT = fakeInput({ pressed: ['interact'] });

test('paginate wraps each line and splits long ones into pages', () => {
  assert.deepEqual(paginate(['aa bb cc dd', 'ee'], 5, 2), [['aa bb', 'cc dd'], ['ee']]);
  assert.deepEqual(paginate(['aa bb cc dd ee'], 5, 2), [['aa bb', 'cc dd'], ['ee']]);
});

test('text types out over time', () => {
  const d = new DialogueScene('Mr. Tumnus', ['Hello there']);
  d.update(0.25, NONE); // 40 chars/s → 10 chars
  assert.deepEqual(d.visibleLines(), ['Hello ther']);
  assert.equal(d.pageComplete, false);
});

test('interact completes the current page instantly', () => {
  const d = new DialogueScene('Mr. Tumnus', ['Hello there']);
  d.update(0.01, NEXT);
  assert.equal(d.pageComplete, true);
  assert.deepEqual(d.visibleLines(), ['Hello there']);
});

test('interact on a complete page goes to the next page', () => {
  const d = new DialogueScene('Mr. Tumnus', ['One', 'Two']);
  d.update(0.01, NEXT);
  d.update(0.01, NEXT);
  assert.equal(d.page, 1);
  assert.equal(d.shown < d.pageLength, true);
});

test('interact on the last complete page closes the box and calls onDone once', () => {
  let done = 0;
  let popped = 0;
  const d = new DialogueScene('Lucy', ['Hi'], () => done++);
  d.stack = { pop: () => popped++ };
  d.update(0.01, NEXT); // complete
  d.update(0.01, NEXT); // close
  d.update(0.01, NEXT); // ignored
  assert.equal(d.done, true);
  assert.equal(popped, 1);
  assert.equal(done, 1);
});

test('visible text spans wrapped lines', () => {
  const d = new DialogueScene('Lucy', ['word '.repeat(12).trim()]);
  d.update(0.01, NEXT);
  assert.equal(d.visibleLines().length, 2);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/text.test.js tests/dialogue.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `src/engine/text.js`**

```js
/** Split text into lines of at most maxChars, breaking at spaces. Long words get their own line. */
export function wrapText(text, maxChars) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
```

- [ ] **Step 5: Implement `src/game/dialogue.js`**

```js
import { DIALOGUE, VIEW_WIDTH, VIEW_HEIGHT } from '../config.js';
import { wrapText } from '../engine/text.js';

export function paginate(lines, maxChars, linesPerPage) {
  const pages = [];
  for (const line of lines) {
    const wrapped = wrapText(line, maxChars);
    for (let i = 0; i < wrapped.length; i += linesPerPage) pages.push(wrapped.slice(i, i + linesPerPage));
  }
  return pages;
}

/** Overlay scene: a text box with a typewriter effect. Gameplay below is paused. */
export class DialogueScene {
  constructor(speaker, lines, onDone) {
    this.speaker = speaker;
    this.pages = paginate(lines, DIALOGUE.maxCharsPerLine, DIALOGUE.linesPerPage);
    if (this.pages.length === 0) this.pages = [[]];
    this.page = 0;
    this.shown = 0;
    this.onDone = onDone;
    this.done = false;
    this.time = 0;
  }

  get pageLength() {
    return this.pages[this.page].join('').length;
  }

  get pageComplete() {
    return this.shown >= this.pageLength;
  }

  visibleLines() {
    let left = Math.floor(this.shown);
    const out = [];
    for (const line of this.pages[this.page]) {
      if (left <= 0) break;
      out.push(line.slice(0, left));
      left -= line.length;
    }
    return out;
  }

  update(dt, input) {
    if (this.done) return;
    this.time += dt;
    this.shown = Math.min(this.pageLength, this.shown + DIALOGUE.charsPerSecond * dt);
    if (!input.wasPressed('interact')) return;
    if (!this.pageComplete) {
      this.shown = this.pageLength;
    } else if (this.page < this.pages.length - 1) {
      this.page += 1;
      this.shown = 0;
    } else {
      this.done = true;
      this.stack?.pop();
      this.onDone?.();
    }
  }

  render(r) {
    const h = 50;
    const x = 4;
    const y = VIEW_HEIGHT - h - 4;
    const w = VIEW_WIDTH - 8;
    r.rect(x, y, w, h, '#10141f');
    r.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1, '#e8f0f8');
    r.text(this.speaker, x + 6, y + 4, { color: '#ffe27a', bold: true });
    this.visibleLines().forEach((line, i) => r.text(line, x + 6, y + 16 + i * 10));
    if (this.pageComplete && Math.floor(this.time * 3) % 2 === 0) {
      r.text('E ▸', x + w - 18, y + h - 11, { color: '#ffe27a' });
    }
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/text.test.js tests/dialogue.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 7: Commit**

```bash
git add src/engine/text.js src/game/dialogue.js tests/text.test.js tests/dialogue.test.js
git commit -m "feat: add text wrapping and typewriter dialogue box" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Scene stack and save

**Files:**
- Create: `src/engine/scenes.js`, `src/engine/save.js`, `tests/scenes.test.js`, `tests/save.test.js`

**Interfaces:**
- Produces:
  - `class SceneStack` with `top`, `push(scene)` (sets `scene.stack`), `pop() → scene`, `reset(scene)` (clear, then push), `update(dt, input)` (top scene only) and `render(r)` (all scenes, bottom to top). Scenes implement `update(dt, input)` and `render(r)`.
  - `createSave(storage?) → { load() → {roomIndex} | null, save(data), clear() }`. It never throws.

- [ ] **Step 1: Write the failing tests in `tests/scenes.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneStack } from '../src/engine/scenes.js';

function scene(name, log) {
  return {
    update: () => log.push(`update ${name}`),
    render: () => log.push(`render ${name}`),
  };
}

test('push and pop manage the top scene and set scene.stack', () => {
  const stack = new SceneStack();
  const a = scene('a', []);
  const b = scene('b', []);
  stack.push(a);
  stack.push(b);
  assert.equal(stack.top, b);
  assert.equal(b.stack, stack);
  assert.equal(stack.pop(), b);
  assert.equal(stack.top, a);
});

test('only the top scene updates, but every scene renders bottom to top', () => {
  const log = [];
  const stack = new SceneStack();
  stack.push(scene('play', log));
  stack.push(scene('dialogue', log));
  stack.update(0.016, {});
  stack.render({});
  assert.deepEqual(log, ['update dialogue', 'render play', 'render dialogue']);
});

test('reset replaces everything with one scene', () => {
  const stack = new SceneStack();
  stack.push(scene('a', []));
  stack.push(scene('b', []));
  const c = scene('c', []);
  stack.reset(c);
  assert.equal(stack.top, c);
  stack.pop();
  assert.equal(stack.top, null);
});
```

- [ ] **Step 2: Write the failing tests in `tests/save.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/engine/save.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test('saves and loads the room index', () => {
  const save = createSave(memoryStorage());
  assert.equal(save.load(), null);
  save.save({ roomIndex: 2 });
  assert.deepEqual(save.load(), { roomIndex: 2 });
  save.clear();
  assert.equal(save.load(), null);
});

test('ignores corrupt or invalid saved data', () => {
  const storage = memoryStorage();
  const save = createSave(storage);
  storage.setItem('narnia-save-v1', '{not json');
  assert.equal(save.load(), null);
  storage.setItem('narnia-save-v1', JSON.stringify({ roomIndex: -1 }));
  assert.equal(save.load(), null);
  storage.setItem('narnia-save-v1', JSON.stringify({ roomIndex: 'two' }));
  assert.equal(save.load(), null);
});

test('never throws when storage is missing or blocked', () => {
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  for (const storage of [null, throwing]) {
    const save = createSave(storage);
    assert.doesNotThrow(() => save.save({ roomIndex: 1 }));
    assert.equal(save.load(), null);
    assert.doesNotThrow(() => save.clear());
  }
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/scenes.test.js tests/save.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `src/engine/scenes.js`**

```js
/** A stack of scenes. Only the top one updates; all of them render, bottom first. */
export class SceneStack {
  constructor() {
    this.scenes = [];
  }

  get top() {
    return this.scenes[this.scenes.length - 1] ?? null;
  }

  push(scene) {
    scene.stack = this;
    this.scenes.push(scene);
  }

  pop() {
    return this.scenes.pop();
  }

  reset(scene) {
    this.scenes = [];
    this.push(scene);
  }

  update(dt, input) {
    this.top?.update(dt, input);
  }

  render(r) {
    for (const scene of this.scenes) scene.render(r);
  }
}
```

- [ ] **Step 5: Implement `src/engine/save.js`**

```js
const KEY = 'narnia-save-v1';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Remembers which room the player reached. Silently does nothing if storage is unavailable. */
export function createSave(storage = defaultStorage()) {
  return {
    load() {
      try {
        const raw = storage?.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return Number.isInteger(data?.roomIndex) && data.roomIndex >= 0 ? { roomIndex: data.roomIndex } : null;
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        storage?.setItem(KEY, JSON.stringify(data));
      } catch {
        // storage full or blocked: progress just isn't remembered
      }
    },
    clear() {
      try {
        storage?.removeItem(KEY);
      } catch {
        // ignore
      }
    },
  };
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/scenes.test.js tests/save.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/engine/scenes.js src/engine/save.js tests/scenes.test.js tests/save.test.js
git commit -m "feat: add scene stack and safe localStorage save" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Room 1 (Lantern Waste) and the room list

**Files:**
- Create: `src/rooms/room1-lantern-waste.js`, `src/rooms/index.js`, `tests/rooms.test.js`

**Interfaces:**
- Consumes: `Room` (Task 9), `validateRoomDef` and `legendFor` (Task 5), `SPRITES` (Task 4).
- Produces: `ROOMS` (array of room definitions in play order) from `src/rooms/index.js`, and a default export from each room file.

- [ ] **Step 1: Write the failing tests in `tests/rooms.test.js`**

```js
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/rooms.test.js`
Expected: FAIL with `Cannot find module .../src/rooms/index.js`.

- [ ] **Step 3: Create `src/rooms/room1-lantern-waste.js`**

```js
// Room 1: Lantern Waste. PLACEHOLDER until the kids' outline arrives.
// Lucy steps out of the wardrobe into a snowy wood with a lamp-post.
// Goal: chase off the White Witch's wolves; then Mr. Tumnus gives Lucy the key.
//
// Map legend: . snow  , path  T tree  R rock  L lamp-post  W wardrobe (entrance)  X exit
export default {
  id: 'lantern-waste',
  name: 'Lantern Waste',
  map: [
    'TTTTTTTWTTTTTTTT',
    'TT.....,......TT',
    'T......,...R...T',
    'T..T...,.......T',
    'T.....,L,..T...T',
    'T......,.......T',
    'T.R....,....R..T',
    'T......,,......T',
    'T..T....,...T..T',
    'TT......,.....TT',
    'TTTTTTTTXTTTTTTT',
  ],
  entities: [
    {
      type: 'npc',
      id: 'tumnus',
      name: 'Mr. Tumnus',
      sprite: 'tumnus',
      x: 9,
      y: 4,
      dialogue: [
        'Oh! A Daughter of Eve, here in Narnia! I am Mr. Tumnus.',
        "Careful! The White Witch's wolves are prowling these woods.",
        'If you could chase them away, I could show you the way on.',
      ],
    },
    { type: 'wolf', x: 3, y: 6 },
    { type: 'wolf', x: 12, y: 3 },
    { type: 'wolf', x: 11, y: 8 },
  ],
  hooks: {
    onEnter(room) {
      if (room.attempt === 1) {
        room.say('Lucy', ['Snow? Inside a wardrobe? And a lamp-post in the middle of a wood!']);
      }
    },
    onEnemiesCleared(room) {
      room
        .npc('tumnus')
        .setDialogue([
          'You chased off the wolves! How brave you are.',
          'Here, take this key. It opens the old gate to the south.',
        ])
        .onDone(() => {
          room.giveKey();
          room.npc('tumnus').setDialogue(['Hurry along now, and mind the Witch!']);
        });
    },
  },
};
```

- [ ] **Step 4: Create `src/rooms/index.js`**

```js
// Rooms in play order. To add a room: create roomN-<name>.js, import it here, add it to the list.
import lanternWaste from './room1-lantern-waste.js';

export const ROOMS = [lanternWaste];
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/rooms.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/rooms tests/rooms.test.js
git commit -m "feat: add Lantern Waste placeholder room" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Scenes (title, play, victory), HUD and room drawing

**Files:**
- Create: `src/game/hud.js`, `src/game/roomview.js`, `src/game/scenes/title.js`, `src/game/scenes/play.js`, `src/game/scenes/victory.js`, `tests/hud.test.js`, `tests/scenes-game.test.js`

**Interfaces:**
- Consumes: `Room` (Task 9), `DialogueScene` (Task 10), and config. The renderer API comes from Task 14: `r.clear(color)`, `r.rect(x,y,w,h,color)`, `r.strokeRect(...)`, `r.sprite(name, x, y, alpha?)`, `r.text(str, x, y, {color, size, align, bold})`, `r.withOffset(dx, dy, fn)`.
- Consumes a **game context** object (built in Task 14's `main.js`): `{ rooms, save, rng, title(), start(index), win() }`.
- Produces:
  - `heartStates(health, maxHealth) → ('full'|'half'|'empty')[]`, `drawHud(r, room)`
  - `drawRoom(r, room)`
  - `new TitleScene(game)` with `resumeIndex`
  - `new PlayScene(game, index)` with `room`, `deathTimer` and `attempt`
  - `new VictoryScene(game)`

- [ ] **Step 1: Write the failing tests in `tests/hud.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heartStates } from '../src/game/hud.js';

test('heartStates turns half-heart health into heart icons', () => {
  assert.deepEqual(heartStates(6, 6), ['full', 'full', 'full']);
  assert.deepEqual(heartStates(5, 6), ['full', 'full', 'half']);
  assert.deepEqual(heartStates(3, 6), ['full', 'half', 'empty']);
  assert.deepEqual(heartStates(0, 6), ['empty', 'empty', 'empty']);
});
```

- [ ] **Step 2: Write the failing tests in `tests/scenes-game.test.js`**

```js
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
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/hud.test.js tests/scenes-game.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 4: Implement `src/game/hud.js`**

```js
import { VIEW_WIDTH, HUD_HEIGHT } from '../config.js';

export function heartStates(health, maxHealth) {
  const states = [];
  for (let i = 0; i < maxHealth / 2; i++) {
    const left = health - i * 2;
    states.push(left >= 2 ? 'full' : left === 1 ? 'half' : 'empty');
  }
  return states;
}

export function drawHud(r, room) {
  const p = room.player;
  r.rect(0, 0, VIEW_WIDTH, HUD_HEIGHT, '#10141f');
  heartStates(p.health, p.maxHealth).forEach((state, i) => r.sprite(`heart_${state}`, 4 + i * 10, 4));
  r.text(room.name, VIEW_WIDTH / 2, 4, { align: 'center', color: '#e8f0f8' });
  if (p.hasKey) r.sprite('key', VIEW_WIDTH - 12, 4);
}
```

- [ ] **Step 5: Implement `src/game/roomview.js`**

```js
import { TILE, PLAYER, WOLF } from '../config.js';

/** Draw tiles, then everything that moves, back to front by the bottom of each box. */
export function drawRoom(r, room) {
  room.tiles.forEach((row, rowIndex) => {
    row.forEach((tile, col) => {
      const x = col * TILE;
      const y = rowIndex * TILE;
      r.sprite('snow', x, y);
      if (tile !== 'snow') r.sprite(tile, x, y);
    });
  });

  const drawables = [
    ...room.pickups.map((i) => ({ bottom: i.y + i.h, draw: () => r.sprite(i.spriteName(), i.x, i.y) })),
    ...room.npcs.map((n) => ({ bottom: n.y + n.h, draw: () => r.sprite(n.spriteName(), n.x, n.y) })),
    ...room.enemies.map((e) => ({ bottom: e.y + e.h, draw: () => drawWolf(r, e) })),
    { bottom: room.player.y + room.player.h, draw: () => drawPlayer(r, room.player) },
  ];
  drawables.sort((a, b) => a.bottom - b.bottom).forEach((d) => d.draw());
}

function drawWolf(r, wolf) {
  const alpha = wolf.hurtTimer > 0 ? 0.5 : 1;
  r.sprite(wolf.spriteName(), wolf.x - WOLF.spriteOffset.x, wolf.y - WOLF.spriteOffset.y, alpha);
}

function drawPlayer(r, p) {
  if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 1) return; // flicker while invulnerable
  const sword = p.swordBox();
  const drawSword = () => {
    if (sword) r.sprite(`sword_${p.facing}`, sword.x, sword.y);
  };
  if (p.facing === 'up') drawSword(); // behind Lucy
  r.sprite(p.spriteName(), p.x - PLAYER.spriteOffset.x, p.y - PLAYER.spriteOffset.y);
  if (p.facing !== 'up') drawSword();
}
```

- [ ] **Step 6: Implement `src/game/scenes/title.js`**

```js
import { GAME_TITLE, GAME_SUBTITLE, VIEW_WIDTH, VIEW_HEIGHT, TILE } from '../../config.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
    const saved = game.save.load();
    this.resumeIndex = saved && saved.roomIndex < game.rooms.length ? saved.roomIndex : 0;
  }

  update(dt, input) {
    this.time += dt;
    if (input.wasPressed('newGame')) {
      this.game.save.clear();
      this.game.start(0);
    } else if (input.wasPressed('attack') || input.wasPressed('interact')) {
      this.game.start(this.resumeIndex);
    }
  }

  render(r) {
    drawSnowField(r);
    r.rect(16, 28, VIEW_WIDTH - 32, 58, 'rgba(16, 20, 31, 0.85)');
    r.text(GAME_TITLE, VIEW_WIDTH / 2, 38, { align: 'center', size: 16, bold: true, color: '#ffe27a' });
    r.text(GAME_SUBTITLE, VIEW_WIDTH / 2, 62, { align: 'center', color: '#e8f0f8' });
    r.sprite('lamppost', VIEW_WIDTH / 2 - 8, 96);
    const dark = '#10141f';
    if (Math.floor(this.time * 2) % 2 === 0) {
      const label = this.resumeIndex > 0 ? `Press Space to continue (room ${this.resumeIndex + 1})` : 'Press Space to start';
      r.text(label, VIEW_WIDTH / 2, 124, { align: 'center', bold: true, color: dark });
    }
    if (this.resumeIndex > 0) r.text('Press N for a new game', VIEW_WIDTH / 2, 138, { align: 'center', color: dark });
    r.text('Arrows/WASD move · Space sword · E talk', VIEW_WIDTH / 2, 172, { align: 'center', color: dark });
  }
}

export function drawSnowField(r) {
  for (let y = 0; y < VIEW_HEIGHT; y += TILE) {
    for (let x = 0; x < VIEW_WIDTH; x += TILE) r.sprite('snow', x, y);
  }
}
```

- [ ] **Step 7: Implement `src/game/scenes/play.js`**

```js
import { HUD_HEIGHT, DEATH_PAUSE, VIEW_WIDTH, VIEW_HEIGHT } from '../../config.js';
import { Room } from '../room.js';
import { DialogueScene } from '../dialogue.js';
import { drawRoom } from '../roomview.js';
import { drawHud } from '../hud.js';

export class PlayScene {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.attempt = 1;
    this.deathTimer = 0;
    this.room = this.buildRoom();
    game.save.save({ roomIndex: index });
  }

  buildRoom() {
    return new Room(this.game.rooms[this.index], { rng: this.game.rng, attempt: this.attempt });
  }

  update(dt, input) {
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.attempt += 1;
        this.room = this.buildRoom();
      }
      return;
    }

    this.room.update(dt, input);

    const talk = this.room.takeDialogue();
    if (talk) {
      this.stack.push(new DialogueScene(talk.speaker, talk.lines, talk.onDone));
      return;
    }
    if (this.room.failed) {
      this.deathTimer = DEATH_PAUSE;
      return;
    }
    if (this.room.completed) {
      const next = this.index + 1;
      if (next < this.game.rooms.length) this.game.start(next);
      else this.game.win();
    }
  }

  render(r) {
    r.clear('#000000');
    drawHud(r, this.room);
    r.withOffset(0, HUD_HEIGHT, () => drawRoom(r, this.room));
    if (this.deathTimer > 0) {
      r.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 'rgba(120, 0, 20, 0.45)');
      r.text('The wolves got you! Try again...', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 4, { align: 'center', bold: true });
    }
  }
}
```

- [ ] **Step 8: Implement `src/game/scenes/victory.js`**

```js
import { VIEW_WIDTH } from '../../config.js';
import { drawSnowField } from './title.js';

const INPUT_DELAY = 0.5; // so a key held from the last room doesn't skip this screen

export class VictoryScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
  }

  update(dt, input) {
    this.time += dt;
    if (this.time < INPUT_DELAY) return;
    if (input.wasPressed('attack') || input.wasPressed('interact')) this.game.start(0);
  }

  render(r) {
    drawSnowField(r);
    r.rect(16, 40, VIEW_WIDTH - 32, 70, 'rgba(16, 20, 31, 0.85)');
    r.text('You did it!', VIEW_WIDTH / 2, 50, { align: 'center', size: 16, bold: true, color: '#ffe27a' });
    r.text('Lucy made it all the way through Narnia.', VIEW_WIDTH / 2, 76, { align: 'center', color: '#e8f0f8' });
    r.text('Thanks for playing!', VIEW_WIDTH / 2, 90, { align: 'center', color: '#e8f0f8' });
    if (Math.floor(this.time * 2) % 2 === 0) {
      r.text('Press Space to play again', VIEW_WIDTH / 2, 140, { align: 'center', bold: true, color: '#10141f' });
    }
  }
}
```

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test tests/hud.test.js tests/scenes-game.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 10: Commit**

```bash
git add src/game/hud.js src/game/roomview.js src/game/scenes tests/hud.test.js tests/scenes-game.test.js
git commit -m "feat: add title, play and victory scenes with HUD and room drawing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Renderer, main loop, and page shell (first playable)

**Files:**
- Create: `src/engine/renderer.js`, `src/main.js`, `index.html`

**Interfaces:**
- Consumes: everything above.
- Produces: `class Renderer`, constructed as `new Renderer(canvas, spriteCache)`, with `clear`, `rect`, `strokeRect`, `sprite`, `text`, `withOffset` and `error(err)`, matching the API listed in Task 13. A running game at `index.html`.

These files are DOM-only and verified in a browser, not with unit tests.

- [ ] **Step 1: Implement `src/engine/renderer.js`**

```js
// The only file (besides sprites.js) that draws to the canvas.
// Everything is drawn in native 256×192 coordinates; the transform scales it up.
import { VIEW_WIDTH, VIEW_HEIGHT, MIN_SCALE } from '../config.js';
import { wrapText } from './text.js';

const FONT = '"Courier New", Courier, monospace';

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.base = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const fit = Math.floor(Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT));
    const scale = Math.max(MIN_SCALE, fit);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${VIEW_WIDTH * scale}px`;
    this.canvas.style.height = `${VIEW_HEIGHT * scale}px`;
    this.canvas.width = Math.round(VIEW_WIDTH * scale * dpr);
    this.canvas.height = Math.round(VIEW_HEIGHT * scale * dpr);
    this.base = scale * dpr;
    this.ctx.setTransform(this.base, 0, 0, this.base, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = '#000000') {
    this.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, color);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h, color) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
  }

  sprite(name, x, y, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.sprites.get(name), Math.round(x), Math.round(y));
    this.ctx.globalAlpha = 1;
  }

  text(str, x, y, { color = '#ffffff', size = 8, align = 'left', bold = false } = {}) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  withOffset(dx, dy, draw) {
    this.ctx.save();
    this.ctx.translate(dx, dy);
    try {
      draw();
    } finally {
      this.ctx.restore();
    }
  }

  /** Full-screen, readable error message (used instead of a blank canvas). */
  error(err) {
    this.ctx.setTransform(this.base, 0, 0, this.base, 0, 0);
    this.ctx.globalAlpha = 1;
    this.clear('#2a0d12');
    this.text('Oops! Something went wrong.', 8, 8, { color: '#ff9aa8', bold: true });
    const lines = String(err?.message ?? err).split('\n').flatMap((l) => wrapText(l, 48));
    lines.slice(0, 16).forEach((line, i) => this.text(line, 8, 24 + i * 10));
  }
}
```

- [ ] **Step 2: Implement `src/main.js`**

```js
import { STEP, MAX_FRAME } from './config.js';
import { Input, attachKeyboard } from './engine/input.js';
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
};

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
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Through the Wardrobe</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
  canvas { display: block; image-rendering: pixelated; }
  #boot-error { position: fixed; inset: 0; margin: 0; padding: 16px; color: #ff9aa8; background: #2a0d12; font: 14px/1.4 monospace; white-space: pre-wrap; }
</style>
</head>
<body>
<canvas id="game" aria-label="Through the Wardrobe game"></canvas>
<pre id="boot-error" hidden></pre>
<script>
  // Shows load-time problems (for example a typo in a room file) instead of a blank page.
  function showBootError(message) {
    const el = document.getElementById('boot-error');
    el.hidden = false;
    el.textContent += message + '\n';
  }
  window.addEventListener('error', (e) => showBootError(e.message || 'Something failed to load.'));
</script>
<script type="module" src="src/main.js"
  onerror="showBootError('Could not load the game. If you opened index.html directly, run a local server instead (see README.md).')"></script>
</body>
</html>
```

- [ ] **Step 4: Run the full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test`
Expected: PASS, 0 failures.

- [ ] **Step 5: Play the game in a browser**

Start the server in the background from the project root: `python3 -m http.server 8000`. Open `http://localhost:8000/` (claude-in-chrome skill), take screenshots, and read the console. Confirm each of these:
1. The title screen shows the snow, title, lamp-post and blinking prompt. There are no console errors.
2. Space starts Room 1 and Lucy's intro dialogue appears. E finishes the text and E again closes it.
3. Lucy appears just below the wardrobe facing down. Arrows/WASD move her smoothly and walls stop her.
4. Space swings the sword in the facing direction. Wolves flash when hit and vanish after 2 hits.
5. Wolves chase when close. Touching one removes half a heart, knocks Lucy back and makes her flicker.
6. Losing all hearts shows the red "Try again" overlay, then the room restarts without the intro.
7. With the wolves gone, Mr. Tumnus's new lines play and the key appears in the HUD.
8. Touching the exit gate with the key opens it, then the victory screen shows. Space restarts.
9. Refreshing mid-room shows "continue (room 1)" behaviour; with one room this is just "start". N works on the title.
10. Text is crisp and pixels are sharp at the window's scale.

Fix anything that fails (add a regression test when the bug is in logic), then re-run the suite.

- [ ] **Step 6: Check it works from a sub-path (like GitHub Pages)**

From the project's **parent** directory run `python3 -m http.server 8001` in the background and open `http://localhost:8001/narnia/`. The game must load and play exactly as before (this proves every path is relative). Stop both servers afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/engine/renderer.js src/main.js index.html
git commit -m "feat: add renderer, game loop and page shell; game is playable" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Docs, playtest checklist, and spec sync

**Files:**
- Create: `README.md`, `PLAYTEST.md`
- Modify: `docs/superpowers/specs/2026-11-22-narnia-engine-design.md` (architecture tree, test command), `CLAUDE.md` (only if anything changed during implementation)

- [ ] **Step 1: Create `README.md`**

````markdown
# Through the Wardrobe

A small top-down adventure game based on *The Lion, the Witch and the Wardrobe*, made for a school project. There are five rooms, and each one is a single screen with a locked exit you have to earn the key for.

## Play it locally

The game is plain HTML and JavaScript, with nothing to install or build. Browsers won't load the game's modules from a file you double-click, so start a tiny local server from this folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The sprite preview page is at <http://localhost:8000/sprites.html>.

## Controls

| Action | Keys |
|---|---|
| Move | Arrow keys or WASD |
| Sword | Space |
| Talk / next line | E or Enter |
| New game (title screen) | N |

## Run the tests

The tests use Node's built-in test runner (Node 18+, no packages):

```sh
source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test
```

## Put it on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, open **Settings → Pages**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. After a minute the game is live at `https://<username>.github.io/<repo>/`.

## How it's organised

- `src/engine/` is reusable plumbing: input, drawing, sprites, collision, scenes and saving.
- `src/game/` covers Lucy, the wolves, NPCs, items, rooms, dialogue and screens.
- `src/art/` holds every sprite, drawn as text (one character per pixel).
- `src/rooms/` has one file per room. `index.js` sets the play order.
- `src/config.js` holds all the numbers worth tweaking: speeds, health, timings.

## Add a room

1. Copy `src/rooms/room1-lantern-waste.js` to `src/rooms/room2-<name>.js`.
2. Draw the map with characters: 11 rows of 16. `W` is the entrance, `X` is the locked exit, `T` a tree, `R` a rock, `.` snow, `,` path.
3. List the characters and enemies in `entities`, and add rules in `hooks`. For example, `onEnemiesCleared` can give the key.
4. Import the room in `src/rooms/index.js` and add it to `ROOMS`.
5. Run the tests and play it. A mistake in the map shows a readable error instead of the game.

## Edit a sprite

Sprites live in `src/art/` as arrays of strings, with one character per pixel. The colours for each character are in `src/art/palette.js`, and `.` is transparent. Open `sprites.html` to see your changes at a large size.

## Something's wrong?

- **Blank page or "Could not load the game":** you probably opened `index.html` directly. Use the local server above.
- **A red error screen:** it names the room or sprite with the problem and what's wrong with it.
- **Start over from room 1:** press **N** on the title screen.
````

- [ ] **Step 2: Create `PLAYTEST.md`**

```markdown
# Playtest checklist

Run through the general checks and the section for any room you changed. Serve locally (`python3 -m http.server 8000`) and keep the browser console open; there should be no errors.

## General
- [ ] Title screen shows; Space starts; N starts a new game when a save exists.
- [ ] Refreshing mid-game returns to the title with "continue (room N)".
- [ ] Text is crisp; pixels are sharp; the page doesn't scroll when using arrow keys or Space.
- [ ] Losing all hearts shows "Try again" and restarts the current room at full health.
- [ ] Finishing the last room shows the victory screen; Space starts over from room 1.

## Room 1: Lantern Waste
- [ ] Lucy's intro line plays on entry (and not again after a retry).
- [ ] Lucy starts below the wardrobe, facing down.
- [ ] Walk along every wall and tree: no walking through anything, no getting stuck on corners.
- [ ] Mr. Tumnus faces Lucy when she's near; E next to him plays his warning.
- [ ] Three wolves wander, chase when close, take 2 hits, sometimes drop a heart.
- [ ] Touching a wolf costs half a heart with knockback and a short flicker.
- [ ] After all wolves are gone, Tumnus thanks Lucy and the key appears in the HUD.
- [ ] Touching the gate without the key does nothing; with the key it opens and the room ends.
```

- [ ] **Step 3: Sync the spec**

In `docs/superpowers/specs/2026-11-22-narnia-engine-design.md`:
- Replace the Architecture tree with the File Map from this plan, which has the real files.
- Under Testing → Automated, replace "Requires Node 18+ (available via nvm)." with "Run with `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test`."
- Under Controls, add the row `| New game (title screen only) | N |`.

- [ ] **Step 4: Final verification**

Run the full suite: `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test`. Expected: 0 failures. Then walk through `PLAYTEST.md` (General + Room 1) in the browser with screenshots, and note any item that fails.

- [ ] **Step 5: Commit**

```bash
git add README.md PLAYTEST.md docs/superpowers/specs/2026-11-22-narnia-engine-design.md CLAUDE.md
git commit -m "docs: add README, playtest checklist and sync spec with implementation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

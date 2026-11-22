# Narnia Game

A small top-down action-adventure game in the style of classic overhead Zelda, themed on *The Lion, the Witch and the Wardrobe*. It's for a kid's school project: the kids wrote the game outline and a parent codes it. There are five levels, and each level is a single room with an entrance door and a locked exit door that needs that room's key.

**The design spec is the source of truth:** `docs/superpowers/specs/2026-11-22-narnia-engine-design.md`. Read it before making engine or gameplay changes. If a change contradicts it, update the spec in the same change.

## Status

- The engine and Room 1 (Lantern Waste) are being built first. Room 1 is a **placeholder**.
- Rooms 2–5 wait on the kids' finished outline. Don't invent content for them. When the outline arrives, rooms are added as data files (see "Adding a room").

## Hard constraints

- **No build step, no npm dependencies.** Plain HTML and JavaScript ES modules on a `<canvas>`. The repo root is deployed as-is to GitHub Pages. Don't add a `package.json`, bundler, TypeScript, or framework without asking first.
- **Relative paths only** for modules and assets. The site is served from `username.github.io/<repo>/`, so a leading `/` breaks it.
- **No external runtime requests.** No CDNs, fonts or analytics. Everything ships in the repo.
- **Keyboard, plus touch on phones and tablets.** Arrows/WASD to move, Space to attack, E/Enter to interact; on touch screens an on-screen D-pad with Sword and Talk buttons (`src/engine/touch.js`). No gamepad or sound unless asked.
- **Content is for kids.** Keep text, combat and visuals gentle and age-appropriate.

## Commands

```sh
# Run locally (ES modules don't load from file://)
python3 -m http.server 8000      # then open http://localhost:8000
                                 # sprite preview: http://localhost:8000/sprites.html

# Tests: Node's built-in runner finds tests/*.test.js automatically.
# Node comes from nvm and isn't on PATH; nvm's default alias is broken here, so pick 24 explicitly.
source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test
# One file: ... && node --test tests/collision.test.js   (a bare directory like tests/ does NOT work)
```

## Architecture rules

- **Only `src/engine/renderer.js`, `src/engine/sprites.js` and `src/engine/touch.js` touch the canvas/DOM; only `src/engine/input.js` touches keyboard events and only `touch.js` touches pointer/touch events.** Everything else (collision, entities, room logic, validation, sprite *parsing*) is plain JS on plain data, so it runs in Node tests. Keep it that way. If game logic needs to draw, add a renderer helper.
- `src/engine/` is game-agnostic plumbing. `src/game/` is gameplay: entities, scenes, room runtime. `src/art/` holds sprite data only. `src/rooms/` holds room definitions only.
- Tunable numbers (speeds, timings, sizes, damage) live in `src/config.js`, not inline.
- Grid: 16×16 px tiles, 16×11 tile rooms, 16 px HUD strip on top (256×192 native), scaled up by an integer factor with smoothing off.
- Rooms are validated on load: size, legend, exactly one entrance and one exit, entities on non-solid tiles. A bad room shows a readable error on the canvas, never a blank screen. Keep validation in step when adding tile or entity types.

## Rooms

Each room is one module in `src/rooms/` exporting `{ id, name, map, legend?, entities, hooks }`. The map is 11 strings of 16 characters. Entity positions are in **tile** coordinates. Per-room rules live in hooks (`onEnter`, `onEnemiesCleared`, …) that use the room API (`room.npc(id)`, `room.giveKey()`, `room.spawn()`, `room.say()`, …). The full format and default tile legend are in the spec.

When a room needs something new, prefer adding a hook, a room-API method, or a new entity type over special-casing that room in engine code.

### Adding a room

1. Copy `src/rooms/room1-lantern-waste.js` to `roomN-<name>.js`.
2. Edit the map, entities and hooks.
3. Add any new sprites in `src/art/` and check them in `sprites.html`.
4. Register the room in `src/rooms/index.js` (the order there is the play order).
5. Add a section to `PLAYTEST.md`, then play through the room in the browser.

## Art

Sprites are 16×16 arrays of strings, one character per pixel, with a palette mapping characters to colors (`.` = transparent). Characters have 4 directions × 2 walk frames (left may mirror right). Shared colors live in `src/art/palette.js`. For any sprite work, use the `drawing-sprites` skill (`.claude/skills/drawing-sprites/`). Its `preview.mjs` renders sprites zoomed and in-game beside the existing cast. Don't judge pixel art from the strings alone.

## Verification

Before calling anything done:
1. The full test command passes. Add or adjust tests for any logic change.
2. Load the game in a real browser, play the affected part, and check screenshots. Passing tests don't prove the game renders or plays correctly.
3. For room changes, walk through that room's `PLAYTEST.md` section.

## Git

- Work on `main` unless asked otherwise. Commit in small, logical steps.
- **Never push or add a remote without asking.** The GitHub repo and Pages setup are the user's call.

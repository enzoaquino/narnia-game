# Narnia Game Engine — Design Spec

**Date:** 2026-11-22
**Status:** Draft for review

## Purpose

A simple browser-based, top-down action-adventure game (classic overhead
Zelda style) for a school project, themed on *The Lion, the Witch and the
Wardrobe*. The game has five levels; each level is a single room with an
entrance door and a locked exit door.

The kids' detailed level outline is not finished yet. This spec covers the
**engine** plus **Room 1** as a playable placeholder. Rooms 2–5 will be
added later as data files once the outline arrives.

## Scope

**In scope**
- Reusable engine: game loop, input, rendering, sprites, collision, scenes,
  save, dialogue, HUD.
- Core entity types: player, enemy (wolf), NPC, items (key, heart), doors.
- Room definition format and loader with validation.
- Room 1 (Lantern Waste) as a placeholder.
- Title screen and victory screen.
- In-code pixel-art sprites and a sprite preview page.
- Automated tests for non-rendering logic; manual playtest checklist.
- Static hosting on GitHub Pages.

**Out of scope (for now)**
- Rooms 2–5 content.
- Touch controls, gamepad support.
- Sound and music.
- Scrolling maps, multi-screen rooms.
- Multiple playable characters.

## Key Decisions

| Decision | Choice | Why |
|---|---|---|
| Tech | Plain HTML + JavaScript ES modules on `<canvas>`, no build step | Deploys to GitHub Pages as-is; nothing to install or rot; scope is small enough that a framework adds more than it saves. |
| Movement | Free (pixel) movement with tile-based wall collision | Matches classic Zelda feel; combat feels responsive. |
| Core loop | Explore + simple combat | Most Zelda-like and flexible for later rooms. |
| Art | 16×16 pixel art defined as strings in JS, scaled up crisply | No image files to manage; easy to edit and iterate. |
| Controls | Keyboard only | Target devices are laptops/Chromebooks. |
| Room format | One JS module per room: ASCII map + entity list + hooks | Adding a room is mostly data entry; hooks allow per-room rules without engine changes. |

## Gameplay

### Screen
- Room fills the screen: **16 × 11 tiles**, each tile **16 × 16 px**.
- Native resolution 256 × 176 for the room, plus a **16 px HUD strip** on
  top → 256 × 192 total. Scaled up by the largest integer factor that fits
  the window (minimum 2×), with image smoothing off.

### Controls
| Action | Keys |
|---|---|
| Move | Arrow keys or WASD |
| Attack (sword) | Space |
| Interact / advance dialogue | E or Enter |
| Start / confirm on title & victory screens | Space or Enter |
| New game (title screen only) | N |

### Player (Lucy)
- Moves in 4 directions at a fixed speed; diagonal input allowed, normalized
  so diagonal is not faster. Facing direction follows the last movement input.
- Sword swing on Space: short-lived hitbox in front of the player in the
  facing direction (~0.25 s), with a short cooldown. Player stops moving
  during the swing.
- **Health:** starts with 3 hearts (6 half-heart units). Enemy contact deals
  half a heart.
- On hit: knockback away from the source, then **~1 s invulnerability**
  (sprite flickers).
- **Death:** at 0 health, the current room restarts from its initial state
  with full health. No lives counter.

### Enemies
- Enemy types are small reusable behavior definitions. Initial type:
  - **Wolf** (the Witch's secret police): wanders randomly; switches to
    chasing when the player is within a radius; 2 hits to defeat; brief
    knockback when hit.
- Defeated enemies have a chance to drop a heart pickup (restores 1 heart).

### NPCs
- Stand still, face toward the player when nearby.
- When the player is adjacent and presses E, open dialogue.
- Dialogue lines can be changed at runtime by room hooks; an `onDone`
  callback fires when a dialogue finishes.

### Items
- **Key:** one per room. Picked up by touching it (or given directly by a
  hook). Shown in the HUD while held.
- **Heart:** restores 1 heart, capped at max health.

### Doors
- **Entrance:** where the player spawns when entering the room — on the
  first floor tile adjacent to the entrance tile, facing away from it. Not
  interactive.
- **Exit (locked):** always solid. If the player touches it while holding
  the room's key, the door shows its open sprite for a moment and the game
  transitions to the next room (the key is used up). After the last room,
  show the victory screen.

### Dialogue
- Box at the bottom of the screen with speaker name and text.
- Text appears with a typewriter effect; pressing E/Enter completes the
  current line instantly, or advances to the next line if complete.
- Gameplay (movement, enemies) pauses while dialogue is open.

### Scenes
- **Title:** game title, "Press Space to start". If a save exists, start
  from the saved room.
- **Play:** the active room.
- **Dialogue:** overlay on top of Play.
- **Victory:** shown after finishing the final room; option to play again
  (clears save).

### Save
- The index of the current room is saved to `localStorage` on entering each
  room. Wrapped in try/catch; if storage is unavailable, the game still
  runs, it just won't remember progress.

## Room 1 — Lantern Waste (placeholder)

- Snowy wood. Entrance is the **wardrobe**; the **lamp-post** stands near
  the middle. Trees and rocks form walls and obstacles.
- **Mr. Tumnus** stands near the lamp-post. Initial dialogue warns Lucy that
  the White Witch's wolves are about.
- **Two or three wolves** patrol the room.
- When all wolves are defeated (`onEnemiesCleared`), Tumnus's dialogue
  changes; when that dialogue finishes, he gives Lucy the key.
- Touching the exit with the key moves on to the next room (or the victory
  screen while Room 1 is the only room).

This will be replaced by the kids' version once the outline is ready.

## Architecture

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

### Separation rule
Only `engine/renderer.js` and `engine/sprites.js` touch the canvas/DOM, and
`engine/input.js` touches keyboard events. All game logic (collision, player,
enemies, room rules, validation) is plain JS operating on plain data, so it
can be tested in Node without a browser.

### Frame data flow
1. `input` snapshot for this frame.
2. Top scene `update(dt)`. For Play: room updates entities → entities read
   input, move via `collision.moveAndSlide`, check overlaps (sword vs.
   enemies, enemies vs. player, player vs. items/doors) → room checks hook
   conditions (e.g., enemies cleared).
3. Render: tiles → entities sorted by y → HUD → overlays (dialogue).
4. `input` clears per-frame "pressed" state.

### Room definition format

```js
export default {
  id: "lantern-waste",
  name: "Lantern Waste",
  map: [            // exactly 11 rows × 16 columns
    "TTTTTTTWTTTTTTTT",
    "T..............T",
    // ...
    "TTTTTTTXTTTTTTTT",
  ],
  legend: {         // optional per-room additions to the default legend
  },
  entities: [
    { type: "npc", id: "tumnus", sprite: "tumnus", x: 10, y: 4,
      dialogue: ["Good evening, Daughter of Eve!", "..."] },
    { type: "wolf", x: 3, y: 7 },
    { type: "wolf", x: 12, y: 8 },
  ],
  hooks: {
    onEnter(room) {},
    onEnemiesCleared(room) {
      room.npc("tumnus")
        .setDialogue(["You did it! Take this key."])
        .onDone(() => room.giveKey());
    },
  },
};
```

**Default tile legend** (extendable per room):

| Char | Tile | Solid |
|---|---|---|
| `.` | snow (floor) | no |
| `,` | path (floor) | no |
| `T` | tree | yes |
| `R` | rock | yes |
| `L` | lamp-post | yes |
| `W` | wardrobe — entrance | yes |
| `X` | exit door (locked) | yes |

Entity positions are in tile coordinates.

**Room API available to hooks:** `room.npc(id)`, `room.giveKey()`,
`room.spawn(entityDef)`, `room.enemiesRemaining()`, `room.player`,
`room.say(speaker, lines)`. New engine capabilities needed by later rooms
are added here or as new entity types.

### Validation (on room load)
- Map is exactly 11 rows of 16 characters.
- Every character is in the legend.
- Exactly one entrance and exactly one exit.
- Entity types are known; entity positions are inside the map and not on
  solid tiles.

A failure stops the game and draws a readable error message on the canvas
(and logs to the console) instead of a blank screen.

## Art

- Sprites are arrays of strings, one character per pixel, with a per-sprite
  palette mapping characters to colors (`.` = transparent).
- Characters: 4 directions × 2 walk frames (left may mirror right).
- `sprites.js` renders each sprite once to an offscreen canvas and caches it.
- **Sprite preview page** (`sprites.html`): renders every tile, character,
  and item scaled up with labels, for iteration and for reviewing art with
  the kids.
- Kids may later design sprites on 16×16 graph paper or in a pixel editor;
  these are converted to the string format by hand.

## Testing

**Automated** — Node's built-in test runner (`node --test`), no npm
dependencies. Run with `source ~/.nvm/nvm.sh && nvm use 24 >/dev/null && node --test`.
- Collision: AABB overlap; move-and-slide along walls; no corner sticking.
- Room validation: bad size, unknown char, missing/duplicate entrance or
  exit, entity on a solid tile.
- Sprite parsing: dimensions and palette lookup (parsing separated from
  canvas drawing).
- Player: damage, invulnerability window, knockback, death → room reset.
- Enemies: take damage, die after 2 hits, removed from room.
- Room flow: clearing enemies fires `onEnemiesCleared`; touching the
  exit while holding the key advances to the next room; touching it without
  the key does nothing.

**Manual** — `PLAYTEST.md` checklist per room: walk every wall, fight every
enemy, die once, complete the room, refresh mid-room to confirm save. The
game is also run in a real browser and checked visually via screenshots
before any work is called done.

## Running & Deployment

- **Local:** `python3 -m http.server` in the project root, then open
  `http://localhost:8000` (ES modules don't load from `file://`).
- **Deploy:** push to GitHub; Settings → Pages → Deploy from branch `main`,
  folder `/ (root)`. No build step. All asset/module paths are relative so
  the game works under `username.github.io/<repo>/`.

## Adding a Room (future workflow)

1. Copy `src/rooms/room1-lantern-waste.js` to `roomN-<name>.js`.
2. Edit the map, entities, and hooks.
3. Add any new sprites to `src/art/` and check them in `sprites.html`.
4. Add the room to `src/rooms/index.js`.
5. Add a section to `PLAYTEST.md` and play through it.

---
name: drawing-sprites
description: Use when adding or changing pixel-art sprites in this game (characters, NPCs, enemies, tiles, items in src/art/), or when a sprite looks wrong, unreadable, off-model, or inconsistent with the existing art.
---

# Drawing sprites

## Overview

Sprites are 16×16 string grids (one character per pixel, colors from `src/art/palette.js`). You cannot judge pixel art from the strings. **A sprite is done when it reads as the intended thing at game scale, next to the existing cast, and a viewer would name it without help.** "Recognizable but not perfect" or "a bit like a bear" means not done yet.

## The loop

1. **Name the 2–3 features that make it *this* thing** and not a neighbor (fox vs wolf: orange coat, white-tipped bushy tail, black legs; Witch vs Lucy: height, crown, pale skin). Exaggerate them; at 16 px, subtle features vanish.
   - **Every view needs at least one of those features.** The front (`_down`) view is the one seen most and the easiest to get wrong. A side-view feature like a tail or a snout disappears from the front, so bring one into view: the tail poking out to one side, the teeth, or a prop.
2. **Start from the closest existing sprite**, not a blank grid. Copy Tumnus for an upright NPC, Lucy for a walking child, the wolf for a four-legged animal. That keeps the outline weight, proportions, and feet line consistent with the rest of the art.
3. **Render it:**
   ```sh
   node .claude/skills/drawing-sprites/preview.mjs fox_ --out <scratchpad>/fox.png
   ```
   (`name_` matches a prefix. Prefix node as in CLAUDE.md. If `source` is blocked, call `~/.nvm/versions/node/v24*/bin/node` directly. If the shell refuses compound commands, edit sprites with Edit and run one plain command per call.) The tool prints errors and warnings and checks that `sprites.html` still draws every sprite. It then writes a PNG with:
   - a 12× zoom with a pixel grid, labelled with the row and column indexes into the strings;
   - a 6× in-game strip beside Lucy, Tumnus and a wolf, on snow and on the path.
4. **Read the PNG** and judge the **in-game strip first**. Does it read as the thing? Is it the right size next to Lucy? Does it stand out from the snow? Then use the zoomed grid to find the exact `row`/`column` to change.
5. Fix, then re-render. Repeat until step 4 passes for **every** view. Expect 3–5 rounds.
   - **If a view still doesn't read after 5 rounds,** stop. Put the problem first in your report ("the down view still reads as a bear"), along with what you would try next.
   - Don't call it done in a closing aside.
6. **Register and test:** add the new names to `REQUIRED` in `tests/art.test.js`. Run the full test command. Re-run the preview and check it prints `sprites.html: ok`.
7. Show the user the final PNG path. The kids are the art directors.

## Conventions

| Thing | Rule |
|---|---|
| Characters | 16×16. Feet on row 15. Body in roughly the bottom 12 rows (collision box 12×12 at offset 2,4). |
| Directions | `_down`, `_up`, `_right`; make `_left` with `{ mirrorOf: '<name>_right' }`. |
| Walkers (player, enemies) | Two frames per direction (`_0`, `_1`) whose legs differ. The tool warns if the frames are identical. |
| NPCs | One frame per direction (`tumnus_down`). |
| Small creatures (birds, mice) | Still a 16×16 canvas. Draw them at their real size, standing on row 15, with blank rows above. |
| Items / HUD | 8×8 (hearts, key). |
| Floor tiles | Fully opaque. Other tiles are drawn over snow. |
| Colors | Use shared palette letters. A sprite-local `palette: { x: '#hex' }` only for genuinely new colors, using an unused letter, never overriding a shared one. |
| Outline | `k` all the way around. Large areas of `s`, `S`, `w` or `B` disappear against the snow (a white apron vanishes; make it yellow). |
| Tone | Friendly and kid-appropriate. Enemies look grumpy, not gory. |

Sprites go in `src/art/characters.js`, `tiles.js` or `items.js`. Preview groups come from those files automatically.

## Common mistakes

- Judging from the strings, or from a full-page screenshot where sprites are tiny. Use the tool.
- Stopping when it's "close". Read the in-game strip as a stranger would.
- Copying the up view from the down view without removing the face.
- Forgetting `tests/art.test.js`, or leaving `_left` hand-drawn instead of mirrored.

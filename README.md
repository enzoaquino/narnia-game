# Through the Wardrobe

A small top-down adventure game based on *The Lion, the Witch and the Wardrobe*, made for a school project. The game is planned as five rooms, and Room 1 is built so far. Each room is a single screen with a locked exit you have to earn the key for.

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

The tests use Node's built-in test runner (Node 22.7 or newer, no packages):

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
2. Draw the map with characters: 11 rows of 16. `W` is the entrance, `X` is the locked exit, `T` a tree, `R` a rock, `L` a lamp-post, `.` snow, `,` path.
3. List the characters and enemies in `entities`, and add rules in `hooks`. For example, `onEnemiesCleared` can give the key.
4. Import the room in `src/rooms/index.js` and add it to `ROOMS`.
5. Run the tests and play it. A mistake in the map shows a readable error instead of the game.

## Edit a sprite

Sprites live in `src/art/` as arrays of strings, with one character per pixel. The colours for each character are in `src/art/palette.js`, and `.` is transparent. Open `sprites.html` to see your changes at a large size.

## Something's wrong?

- **Blank page or "Could not load the game":** you probably opened `index.html` directly. Use the local server above.
- **A red error screen:** it names the room or sprite with the problem and what's wrong with it.
- **Start over from room 1:** press **N** on the title screen.
- **Works locally but not on GitHub Pages:** filenames are case-sensitive once deployed, so `Room1.js` and `room1.js` are different files there. Match the case in every import exactly.

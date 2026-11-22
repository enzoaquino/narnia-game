# Playtest checklist

Run through the general checks and the section for any room you changed. Serve locally (`python3 -m http.server 8000`) and keep the browser console open; there should be no errors.

## General
- [ ] Title screen shows; Space starts; N starts a new game when a save exists.
- [ ] Refreshing mid-game returns to the title. Once there are 2+ rooms, refreshing in room 2 or later offers "continue (room N)" and "Press N for a new game".
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

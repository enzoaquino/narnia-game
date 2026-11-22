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

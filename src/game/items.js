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

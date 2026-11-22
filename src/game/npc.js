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

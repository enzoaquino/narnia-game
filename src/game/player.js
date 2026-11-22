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

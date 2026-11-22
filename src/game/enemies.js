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

import { TILE, DOOR_OPEN_TIME, WOLF } from '../config.js';
import { overlaps } from '../engine/collision.js';
import { parseRoomDef } from './roomdef.js';
import { Player } from './player.js';
import { Wolf } from './enemies.js';
import { Npc } from './npc.js';
import { Pickup } from './items.js';

/** A live room built from a room definition. Hooks receive this object. */
export class Room {
  constructor(def, { rng = Math.random, attempt = 1 } = {}) {
    const grid = parseRoomDef(def); // throws RoomError when the definition is broken
    this.def = def;
    this.rng = rng;
    this.attempt = attempt;
    this.tiles = grid.tiles;
    this.solid = grid.solid;
    this.entrance = grid.entrance;
    this.exit = grid.exit;
    this.player = Player.atTile(grid.spawn.col, grid.spawn.row, grid.spawn.facing);
    this.enemies = [];
    this.npcs = [];
    this.pickups = [];
    this.dialogueQueue = [];
    this.hadEnemies = false;
    this.clearedFired = false;
    this.exitOpen = false;
    this.exitTimer = 0;
    this.completed = false;
    this.isSolidAt = this.isSolidAt.bind(this);
    for (const e of def.entities ?? []) this.spawn(e);
    def.hooks?.onEnter?.(this);
  }

  get name() {
    return this.def.name;
  }

  get failed() {
    return this.player.dead;
  }

  // ----- hook API -----

  spawn(e) {
    switch (e.type) {
      case 'wolf':
        this.enemies.push(Wolf.atTile(e.x, e.y, this.rng));
        this.hadEnemies = true;
        this.clearedFired = false;
        break;
      case 'npc':
        this.npcs.push(new Npc(e));
        break;
      case 'key':
      case 'heart':
        this.pickups.push(Pickup.atTile(e.type, e.x, e.y));
        break;
      default:
        throw new Error(`unknown entity type "${e.type}"`);
    }
  }

  npc(id) {
    const found = this.npcs.find((n) => n.id === id);
    if (!found) throw new Error(`no NPC with id "${id}" in room "${this.name}"`);
    return found;
  }

  giveKey() {
    this.player.hasKey = true;
  }

  enemiesRemaining() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  say(speaker, lines, onDone) {
    this.dialogueQueue.push({ speaker, lines: [...lines], onDone });
  }

  // ----- engine API -----

  takeDialogue() {
    return this.dialogueQueue.shift() ?? null;
  }

  isSolidAt(col, row) {
    if (row < 0 || row >= this.solid.length || col < 0 || col >= this.solid[0].length) return true;
    if (this.solid[row][col]) return true;
    return this.npcs.some((n) => n.col === col && n.row === row);
  }

  update(dt, input) {
    if (this.completed || this.failed) return;
    if (this.exitOpen) {
      this.exitTimer -= dt;
      if (this.exitTimer <= 0) this.completed = true;
      return;
    }

    const p = this.player;
    p.update(dt, input, this.isSolidAt);

    for (const n of this.npcs) n.notice(p);
    if (input.wasPressed('interact')) {
      const n = this.npcs.find((npc) => npc.canTalkTo(p));
      if (n) this.say(n.name, n.dialogue, () => n.finishTalking());
    }

    for (const e of this.enemies) e.update(dt, p, this.isSolidAt);

    const sword = p.swordBox();
    if (sword) {
      const { x, y } = p.center();
      for (const e of this.enemies) {
        if (!e.dead && overlaps(sword, e) && e.hurt(1, x, y) && e.dead) this.dropLoot(e);
      }
    }

    for (const e of this.enemies) {
      if (!e.dead && overlaps(e, p)) {
        const c = e.center();
        p.hurt(e.damage, c.x, c.y);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    for (const item of this.pickups) {
      if (overlaps(item, p)) item.applyTo(p);
    }
    this.pickups = this.pickups.filter((i) => !i.taken);

    if (this.hadEnemies && !this.clearedFired && this.enemies.length === 0) {
      this.clearedFired = true;
      this.def.hooks?.onEnemiesCleared?.(this);
    }

    if (p.hasKey && this.touchingExit()) {
      p.hasKey = false;
      this.exitOpen = true;
      this.exitTimer = DOOR_OPEN_TIME;
      this.tiles[this.exit.row][this.exit.col] = 'door_open';
    }
  }

  dropLoot(enemy) {
    if (this.rng() < WOLF.heartDropChance) {
      const c = enemy.center();
      this.pickups.push(Pickup.centeredOn('heart', c.x, c.y));
    }
  }

  touchingExit() {
    // The exit tile grown by 1px, so standing flush against it counts.
    const zone = { x: this.exit.col * TILE - 1, y: this.exit.row * TILE - 1, w: TILE + 2, h: TILE + 2 };
    return overlaps(this.player, zone);
  }
}

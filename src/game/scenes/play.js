import { HUD_HEIGHT, DEATH_PAUSE, VIEW_WIDTH, VIEW_HEIGHT } from '../../config.js';
import { Room } from '../room.js';
import { DialogueScene } from '../dialogue.js';
import { drawRoom } from '../roomview.js';
import { drawHud } from '../hud.js';

export class PlayScene {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.attempt = 1;
    this.deathTimer = 0;
    this.room = this.buildRoom();
    game.save.save({ roomIndex: index });
  }

  buildRoom() {
    return new Room(this.game.rooms[this.index], { rng: this.game.rng, attempt: this.attempt });
  }

  update(dt, input) {
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.attempt += 1;
        this.room = this.buildRoom();
      }
      return;
    }

    this.room.update(dt, input);

    const talk = this.room.takeDialogue();
    if (talk) {
      this.stack.push(new DialogueScene(talk.speaker, talk.lines, talk.onDone));
      return;
    }
    if (this.room.failed) {
      this.deathTimer = DEATH_PAUSE;
      return;
    }
    if (this.room.completed) {
      const next = this.index + 1;
      if (next < this.game.rooms.length) this.game.start(next);
      else this.game.win();
    }
  }

  render(r) {
    r.clear('#000000');
    drawHud(r, this.room);
    r.withOffset(0, HUD_HEIGHT, () => drawRoom(r, this.room));
    if (this.deathTimer > 0) {
      r.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 'rgba(120, 0, 20, 0.45)');
      r.text('The wolves got you! Try again...', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 4, { align: 'center', bold: true });
    }
  }
}

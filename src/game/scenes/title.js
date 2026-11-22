import { GAME_TITLE, GAME_SUBTITLE, VIEW_WIDTH, VIEW_HEIGHT, TILE } from '../../config.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
    const saved = game.save.load();
    this.resumeIndex = saved && saved.roomIndex < game.rooms.length ? saved.roomIndex : 0;
  }

  update(dt, input) {
    this.time += dt;
    if (input.wasPressed('newGame')) {
      this.game.save.clear();
      this.game.start(0);
    } else if (input.wasPressed('attack') || input.wasPressed('interact')) {
      this.game.start(this.resumeIndex);
    }
  }

  render(r) {
    drawSnowField(r);
    r.rect(16, 28, VIEW_WIDTH - 32, 58, 'rgba(16, 20, 31, 0.85)');
    r.text(GAME_TITLE, VIEW_WIDTH / 2, 38, { align: 'center', size: 16, bold: true, color: '#ffe27a' });
    r.text(GAME_SUBTITLE, VIEW_WIDTH / 2, 62, { align: 'center', color: '#e8f0f8' });
    r.sprite('lamppost', VIEW_WIDTH / 2 - 8, 96);
    const dark = '#10141f';
    if (Math.floor(this.time * 2) % 2 === 0) {
      const label = this.resumeIndex > 0 ? `Press Space to continue (room ${this.resumeIndex + 1})` : 'Press Space to start';
      r.text(label, VIEW_WIDTH / 2, 124, { align: 'center', bold: true, color: dark });
    }
    if (this.resumeIndex > 0) r.text('Press N for a new game', VIEW_WIDTH / 2, 138, { align: 'center', color: dark });
    r.text('Arrows/WASD move · Space sword · E talk', VIEW_WIDTH / 2, 172, { align: 'center', color: dark });
  }
}

export function drawSnowField(r) {
  for (let y = 0; y < VIEW_HEIGHT; y += TILE) {
    for (let x = 0; x < VIEW_WIDTH; x += TILE) r.sprite('snow', x, y);
  }
}

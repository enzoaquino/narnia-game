import { VIEW_WIDTH } from '../../config.js';
import { drawSnowField } from './title.js';

const INPUT_DELAY = 0.5; // so a key held from the last room doesn't skip this screen

export class VictoryScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
  }

  update(dt, input) {
    this.time += dt;
    if (this.time < INPUT_DELAY) return;
    if (input.wasPressed('attack') || input.wasPressed('interact')) this.game.start(0);
  }

  render(r) {
    drawSnowField(r);
    r.rect(16, 40, VIEW_WIDTH - 32, 70, 'rgba(16, 20, 31, 0.85)');
    r.text('You did it!', VIEW_WIDTH / 2, 50, { align: 'center', size: 16, bold: true, color: '#ffe27a' });
    r.text('Lucy made it all the way through Narnia.', VIEW_WIDTH / 2, 76, { align: 'center', color: '#e8f0f8' });
    r.text('Thanks for playing!', VIEW_WIDTH / 2, 90, { align: 'center', color: '#e8f0f8' });
    if (Math.floor(this.time * 2) % 2 === 0) {
      r.text(this.game.touch ? 'Tap Sword to play again' : 'Press Space to play again', VIEW_WIDTH / 2, 140, { align: 'center', bold: true, color: '#10141f' });
    }
  }
}

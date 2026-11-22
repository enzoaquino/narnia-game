import { DIALOGUE, VIEW_WIDTH, VIEW_HEIGHT } from '../config.js';
import { wrapText } from '../engine/text.js';

export function paginate(lines, maxChars, linesPerPage) {
  const pages = [];
  for (const line of lines) {
    const wrapped = wrapText(line, maxChars);
    for (let i = 0; i < wrapped.length; i += linesPerPage) pages.push(wrapped.slice(i, i + linesPerPage));
  }
  return pages;
}

/** Overlay scene: a text box with a typewriter effect. Gameplay below is paused. */
export class DialogueScene {
  constructor(speaker, lines, onDone) {
    this.speaker = speaker;
    this.pages = paginate(lines, DIALOGUE.maxCharsPerLine, DIALOGUE.linesPerPage);
    if (this.pages.length === 0) this.pages = [[]];
    this.page = 0;
    this.shown = 0;
    this.onDone = onDone;
    this.done = false;
    this.time = 0;
  }

  get pageLength() {
    return this.pages[this.page].join('').length;
  }

  get pageComplete() {
    return this.shown >= this.pageLength;
  }

  visibleLines() {
    let left = Math.floor(this.shown);
    const out = [];
    for (const line of this.pages[this.page]) {
      if (left <= 0) break;
      out.push(line.slice(0, left));
      left -= line.length;
    }
    return out;
  }

  update(dt, input) {
    if (this.done) return;
    this.time += dt;
    this.shown = Math.min(this.pageLength, this.shown + DIALOGUE.charsPerSecond * dt);
    if (!input.wasPressed('interact')) return;
    if (!this.pageComplete) {
      this.shown = this.pageLength;
    } else if (this.page < this.pages.length - 1) {
      this.page += 1;
      this.shown = 0;
    } else {
      this.done = true;
      this.stack?.pop();
      this.onDone?.();
    }
  }

  render(r) {
    const h = 50;
    const x = 4;
    const y = VIEW_HEIGHT - h - 4;
    const w = VIEW_WIDTH - 8;
    r.rect(x, y, w, h, '#10141f');
    r.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1, '#e8f0f8');
    r.text(this.speaker, x + 6, y + 4, { color: '#ffe27a', bold: true });
    this.visibleLines().forEach((line, i) => r.text(line, x + 6, y + 16 + i * 10));
    if (this.pageComplete && Math.floor(this.time * 3) % 2 === 0) {
      r.text('E ▸', x + w - 18, y + h - 11, { color: '#ffe27a' });
    }
  }
}

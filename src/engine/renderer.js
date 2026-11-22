// The only file (besides sprites.js) that draws to the canvas.
// Everything is drawn in native 256×192 coordinates; the transform scales it up.
import { VIEW_WIDTH, VIEW_HEIGHT, MIN_SCALE } from '../config.js';
import { wrapText } from './text.js';

const FONT = '"Courier New", Courier, monospace';

export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.base = 1;
    this.lastError = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.watchPixelRatio();
  }

  /** A dpr change (browser zoom, moving to another screen) doesn't always fire 'resize'. */
  watchPixelRatio() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', () => {
      this.resize();
      this.watchPixelRatio();
    }, { once: true });
  }

  resize() {
    // Pick the integer scale in DEVICE pixels so every game pixel covers a whole number of
    // device pixels (fractional dpr such as 1.25 or 1.6 would otherwise give uneven pixels).
    // MIN_SCALE means "at least this many device pixels per game pixel".
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.floor(Math.min((window.innerWidth * dpr) / VIEW_WIDTH, (window.innerHeight * dpr) / VIEW_HEIGHT));
    const s = Math.max(MIN_SCALE, fit);
    this.canvas.width = VIEW_WIDTH * s; // setting width clears the canvas
    this.canvas.height = VIEW_HEIGHT * s;
    this.canvas.style.width = `${(VIEW_WIDTH * s) / dpr}px`;
    this.canvas.style.height = `${(VIEW_HEIGHT * s) / dpr}px`;
    this.base = s;
    this.ctx.setTransform(s, 0, 0, s, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    // The loop is stopped after an error, so redraw it or the screen stays blank.
    if (this.lastError) this.error(this.lastError);
  }

  clear(color = '#000000') {
    this.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT, color);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h, color) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, h);
  }

  sprite(name, x, y, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.sprites.get(name), Math.round(x), Math.round(y));
    this.ctx.globalAlpha = 1;
  }

  text(str, x, y, { color = '#ffffff', size = 8, align = 'left', bold = false } = {}) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  withOffset(dx, dy, draw) {
    this.ctx.save();
    this.ctx.translate(dx, dy);
    try {
      draw();
    } finally {
      this.ctx.restore();
    }
  }

  /** Full-screen, readable error message (used instead of a blank canvas). */
  error(err) {
    this.lastError = err;
    this.ctx.setTransform(this.base, 0, 0, this.base, 0, 0);
    this.ctx.globalAlpha = 1;
    this.clear('#2a0d12');
    this.text('Oops! Something went wrong.', 8, 8, { color: '#ff9aa8', bold: true });
    const lines = String(err?.message ?? err).split('\n').flatMap((l) => wrapText(l, 48));
    const MAX_LINES = 16;
    const shown = lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES - 1), '…'] : lines;
    shown.forEach((line, i) => this.text(line, 8, 24 + i * 10));
  }
}

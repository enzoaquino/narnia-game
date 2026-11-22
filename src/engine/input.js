// Keyboard → game actions. Only this file touches keyboard events.

export const KEY_ACTIONS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'attack',
  KeyE: 'interact',
  Enter: 'interact',
  KeyN: 'newGame',
};

export class Input {
  constructor() {
    this.downKeys = new Set();
    this.pressed = new Set();
  }

  /** Returns true when the key is used by the game (so the page shouldn't scroll). */
  keyDown(code) {
    const action = KEY_ACTIONS[code];
    if (!action) return false;
    if (!this.downKeys.has(code)) this.pressed.add(action);
    this.downKeys.add(code);
    return true;
  }

  keyUp(code) {
    this.downKeys.delete(code);
    return code in KEY_ACTIONS;
  }

  isDown(action) {
    for (const code of this.downKeys) {
      if (KEY_ACTIONS[code] === action) return true;
    }
    return false;
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  /** Call after each fixed update step. */
  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.downKeys.clear();
    this.pressed.clear();
  }
}

export function attachKeyboard(input, target = window) {
  target.addEventListener('keydown', (e) => {
    if (input.keyDown(e.code)) e.preventDefault();
  });
  target.addEventListener('keyup', (e) => {
    if (input.keyUp(e.code)) e.preventDefault();
  });
  target.addEventListener('blur', () => input.clear());
}

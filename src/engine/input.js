// Keyboard → game actions. Only this file touches keyboard events.
// The on-screen touch controls (touch.js) feed the same Input using the Touch* codes below.

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
  TouchUp: 'up',
  TouchDown: 'down',
  TouchLeft: 'left',
  TouchRight: 'right',
  TouchSword: 'attack',
  TouchTalk: 'interact',
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

/** Browser shortcuts (Cmd+A, Ctrl+W, Alt+...) aren't game input. */
export function shouldHandleKeyEvent(e) {
  return !(e.metaKey || e.ctrlKey || e.altKey);
}

export function attachKeyboard(input, target = window) {
  target.addEventListener('keydown', (e) => {
    if (!shouldHandleKeyEvent(e)) return;
    if (input.keyDown(e.code)) e.preventDefault();
  });
  target.addEventListener('keyup', (e) => {
    // On macOS, keyups for other keys never arrive while Cmd is held, so let go of everything.
    if (e.key === 'Meta') {
      input.clear();
      return;
    }
    if (input.keyUp(e.code)) e.preventDefault();
  });
  target.addEventListener('blur', () => input.clear());
}

// On-screen touch controls → the same Input the keyboard uses.
// Only this file reads pointer/touch events; besides renderer.js and sprites.js it is the
// only file that touches the DOM (it shows the controls and highlights pressed ones).
// The controls' markup and layout live in index.html.
import { TOUCH } from '../config.js';

/** Codes the touch controls send to Input (mapped to actions in input.js). */
export const TOUCH_CODES = {
  up: 'TouchUp',
  down: 'TouchDown',
  left: 'TouchLeft',
  right: 'TouchRight',
  sword: 'TouchSword',
  talk: 'TouchTalk',
};

const DIRS = ['up', 'down', 'left', 'right'];

// 45-degree sectors around the pad, starting at "right" and turning clockwise
// (screen y points down). Index = Math.round(angle / 45deg), from -4 to 4.
const SECTORS = {
  '0': ['right'],
  '1': ['down', 'right'],
  '2': ['down'],
  '3': ['down', 'left'],
  '4': ['left'],
  '-4': ['left'],
  '-3': ['up', 'left'],
  '-2': ['up'],
  '-1': ['up', 'right'],
};

/**
 * Which directions a finger at (dx, dy) from the pad's centre is pressing.
 * Inside the dead zone nothing is pressed; outside, the pad works at any distance,
 * so sliding past its edge keeps the direction.
 */
export function dpadDirections(dx, dy, radius) {
  if (Math.hypot(dx, dy) < radius * TOUCH.deadZone) return [];
  return SECTORS[String(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)))];
}

/**
 * Wires the on-screen controls to `input`. The controls stay hidden until the device
 * looks touch-first or the screen is touched; then `root` gets the `touch` class
 * (which shows them, see index.html) and `onFirstTouch` is called once.
 */
export function attachTouch(input, { dpad, sword, talk, root = document.body, onFirstTouch }) {
  if (!dpad || !sword || !talk) return;

  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    root.classList.add('touch');
    onFirstTouch?.();
  };
  if (window.matchMedia?.('(pointer: coarse)').matches) show();
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') show();
  }, { capture: true });

  // D-pad: one finger at a time; the direction follows the finger until it lifts.
  const held = new Set();
  let padPointer = null;
  const setDirs = (dirs) => {
    for (const d of DIRS) {
      if (dirs.includes(d) && !held.has(d)) {
        held.add(d);
        input.keyDown(TOUCH_CODES[d]);
      } else if (!dirs.includes(d) && held.has(d)) {
        held.delete(d);
        input.keyUp(TOUCH_CODES[d]);
      }
    }
    dpad.dataset.dirs = [...held].join(' ');
  };
  const track = (e) => {
    const r = dpad.getBoundingClientRect();
    setDirs(dpadDirections(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2));
  };
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (padPointer !== null) return;
    padPointer = e.pointerId;
    dpad.setPointerCapture?.(e.pointerId);
    track(e);
  });
  dpad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) track(e);
  });
  const padEnd = (e) => {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    setDirs([]);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) dpad.addEventListener(type, padEnd);

  // Buttons: held while any finger that started on them is down.
  const releases = [];
  const button = (el, code) => {
    const fingers = new Set();
    const release = () => {
      fingers.clear();
      input.keyUp(code);
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      fingers.add(e.pointerId);
      input.keyDown(code);
      el.classList.add('on');
    });
    const end = (e) => {
      if (fingers.delete(e.pointerId) && fingers.size === 0) release();
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, end);
    releases.push(release);
  };
  button(sword, TOUCH_CODES.sword);
  button(talk, TOUCH_CODES.talk);

  for (const el of [dpad, sword, talk]) el.addEventListener('contextmenu', (e) => e.preventDefault());

  // Switching apps or tabs mid-press: let go of everything (input.js clears Input on blur too).
  const releaseAll = () => {
    padPointer = null;
    setDirs([]);
    releases.forEach((r) => r());
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DialogueScene, paginate } from '../src/game/dialogue.js';
import { fakeInput } from './helpers.js';

const NONE = fakeInput();
const NEXT = fakeInput({ pressed: ['interact'] });

test('paginate wraps each line and splits long ones into pages', () => {
  assert.deepEqual(paginate(['aa bb cc dd', 'ee'], 5, 2), [['aa bb', 'cc dd'], ['ee']]);
  assert.deepEqual(paginate(['aa bb cc dd ee'], 5, 2), [['aa bb', 'cc dd'], ['ee']]);
});

test('text types out over time', () => {
  const d = new DialogueScene('Mr. Tumnus', ['Hello there']);
  d.update(0.25, NONE); // 40 chars/s → 10 chars
  assert.deepEqual(d.visibleLines(), ['Hello ther']);
  assert.equal(d.pageComplete, false);
});

test('interact completes the current page instantly', () => {
  const d = new DialogueScene('Mr. Tumnus', ['Hello there']);
  d.update(0.01, NEXT);
  assert.equal(d.pageComplete, true);
  assert.deepEqual(d.visibleLines(), ['Hello there']);
});

test('interact on a complete page goes to the next page', () => {
  const d = new DialogueScene('Mr. Tumnus', ['One', 'Two']);
  d.update(0.01, NEXT);
  d.update(0.01, NEXT);
  assert.equal(d.page, 1);
  assert.equal(d.shown < d.pageLength, true);
});

test('interact on the last complete page closes the box and calls onDone once', () => {
  let done = 0;
  let popped = 0;
  const d = new DialogueScene('Lucy', ['Hi'], () => done++);
  d.stack = { pop: () => popped++ };
  d.update(0.01, NEXT); // complete
  d.update(0.01, NEXT); // close
  d.update(0.01, NEXT); // ignored
  assert.equal(d.done, true);
  assert.equal(popped, 1);
  assert.equal(done, 1);
});

test('visible text spans wrapped lines', () => {
  const d = new DialogueScene('Lucy', ['word '.repeat(12).trim()]);
  d.update(0.01, NEXT);
  assert.equal(d.visibleLines().length, 2);
});

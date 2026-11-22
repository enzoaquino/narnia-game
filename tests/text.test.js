import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapText } from '../src/engine/text.js';

test('short text stays on one line', () => {
  assert.deepEqual(wrapText('Hello there', 20), ['Hello there']);
});

test('wraps at word boundaries', () => {
  assert.deepEqual(wrapText('the quick brown fox jumps', 10), ['the quick', 'brown fox', 'jumps']);
});

test('a word longer than the limit gets its own line', () => {
  assert.deepEqual(wrapText('a supercalifragilistic b', 5), ['a', 'supercalifragilistic', 'b']);
});

test('extra whitespace collapses; empty text gives no lines', () => {
  assert.deepEqual(wrapText('  a   b ', 10), ['a b']);
  assert.deepEqual(wrapText('', 10), []);
});

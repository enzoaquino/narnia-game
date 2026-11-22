import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, boxHitsSolid, moveAndSlide } from '../src/engine/collision.js';
import { gridSolid } from './helpers.js';

// 6 columns x 5 rows of 16px tiles; '#' is solid.
const OPEN = gridSolid([
  '######',
  '#....#',
  '#....#',
  '#....#',
  '######',
]);

test('overlaps: overlapping boxes', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
});

test('overlaps: boxes that only touch edges do not overlap', () => {
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test('boxHitsSolid: a box on open floor is clear', () => {
  assert.equal(boxHitsSolid({ x: 20, y: 20, w: 12, h: 12 }, OPEN), false);
});

test('boxHitsSolid: a box exactly against a wall edge is clear', () => {
  assert.equal(boxHitsSolid({ x: 16, y: 20, w: 12, h: 12 }, OPEN), false);
});

test('boxHitsSolid: a box poking into a wall hits', () => {
  assert.equal(boxHitsSolid({ x: 15, y: 20, w: 12, h: 12 }, OPEN), true);
});

test('boxHitsSolid: outside the grid counts as solid', () => {
  assert.equal(boxHitsSolid({ x: -20, y: 20, w: 12, h: 12 }, OPEN), true);
});

test('moveAndSlide: free movement moves the full amount', () => {
  assert.deepEqual(moveAndSlide({ x: 20, y: 20, w: 12, h: 12 }, 3, 2, OPEN), { x: 23, y: 22 });
});

test('moveAndSlide: stops flush against a wall on the right', () => {
  // right wall is column 5 (x 80..96), so the box's right edge stops at 80
  assert.deepEqual(moveAndSlide({ x: 66, y: 20, w: 12, h: 12 }, 5, 0, OPEN), { x: 68, y: 20 });
});

test('moveAndSlide: stops flush against a wall on the left', () => {
  assert.deepEqual(moveAndSlide({ x: 18, y: 20, w: 12, h: 12 }, -5, 0, OPEN), { x: 16, y: 20 });
});

test('moveAndSlide: stops flush against walls above and below', () => {
  assert.deepEqual(moveAndSlide({ x: 20, y: 18, w: 12, h: 12 }, 0, -5, OPEN), { x: 20, y: 16 });
  // bottom wall is row 4 (y 64..80), so the box's bottom stops at 64
  assert.deepEqual(moveAndSlide({ x: 20, y: 50, w: 12, h: 12 }, 0, 5, OPEN), { x: 20, y: 52 });
});

test('moveAndSlide: slides along a wall when moving diagonally into it', () => {
  assert.deepEqual(moveAndSlide({ x: 68, y: 20, w: 12, h: 12 }, 3, 2, OPEN), { x: 68, y: 22 });
});

// Wall at column 3 with a one-tile gap at row 2 (y 32..48).
const GAP = gridSolid([
  '######',
  '#..#..',
  '#.....',
  '#..#..',
  '######',
]);

test('moveAndSlide: corner nudge guides the box into a one-tile gap', () => {
  // The box is 2px too high to fit the gap and pushes right into the wall.
  let box = { x: 36, y: 30, w: 12, h: 12 };
  for (let i = 0; i < 40; i++) box = { ...box, ...moveAndSlide(box, 1, 0, GAP, 6) };
  assert.ok(box.x > 48, `expected to pass through the gap, x=${box.x}`);
  assert.ok(box.y >= 32 && box.y <= 36, `expected to be inside the gap row, y=${box.y}`);
});

test('moveAndSlide: without nudge the box stays stuck on the corner', () => {
  let box = { x: 36, y: 30, w: 12, h: 12 };
  for (let i = 0; i < 40; i++) box = { ...box, ...moveAndSlide(box, 1, 0, GAP, 0) };
  assert.deepEqual({ x: box.x, y: box.y }, { x: 36, y: 30 });
});

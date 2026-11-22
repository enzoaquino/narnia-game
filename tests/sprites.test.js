import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSprite, flipH, flipV, resolveSprite } from '../src/engine/sprites.js';

const PAL = { '.': null, r: '#ff0000', b: '#0000ff' };

test('parseSprite reads size and colors row by row', () => {
  const s = parseSprite(['r.', 'bb', '.r'], PAL);
  assert.equal(s.width, 2);
  assert.equal(s.height, 3);
  assert.deepEqual(s.pixels, ['#ff0000', null, '#0000ff', '#0000ff', null, '#ff0000']);
});

test('parseSprite rejects ragged rows', () => {
  assert.throws(() => parseSprite(['rr', 'r'], PAL), /row 1/);
});

test('parseSprite rejects unknown color characters', () => {
  assert.throws(() => parseSprite(['rz'], PAL), /"z"/);
});

test('flipH mirrors left-right', () => {
  assert.deepEqual(flipH(parseSprite(['rb', '.r'], PAL)).pixels, ['#0000ff', '#ff0000', '#ff0000', null]);
});

test('flipV mirrors top-bottom', () => {
  assert.deepEqual(flipV(parseSprite(['rb', '.r'], PAL)).pixels, [null, '#ff0000', '#ff0000', '#0000ff']);
});

test('resolveSprite merges the base palette with the sprite palette', () => {
  const defs = { a: { rows: ['rg'], palette: { g: '#00ff00' } } };
  assert.deepEqual(resolveSprite(defs, 'a', PAL).pixels, ['#ff0000', '#00ff00']);
});

test('resolveSprite follows mirrorOf and flipOf', () => {
  const defs = {
    a: { rows: ['rb'] },
    b: { mirrorOf: 'a' },
    c: { rows: ['r', 'b'] },
    d: { flipOf: 'c' },
  };
  assert.deepEqual(resolveSprite(defs, 'b', PAL).pixels, ['#0000ff', '#ff0000']);
  assert.deepEqual(resolveSprite(defs, 'd', PAL).pixels, ['#0000ff', '#ff0000']);
});

test('resolveSprite names the sprite in errors', () => {
  assert.throws(() => resolveSprite({ bad: { rows: ['rz'] } }, 'bad', PAL), /bad/);
  assert.throws(() => resolveSprite({}, 'missing', PAL), /missing/);
});

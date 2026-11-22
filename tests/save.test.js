import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/engine/save.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test('saves and loads the room index', () => {
  const save = createSave(memoryStorage());
  assert.equal(save.load(), null);
  save.save({ roomIndex: 2 });
  assert.deepEqual(save.load(), { roomIndex: 2 });
  save.clear();
  assert.equal(save.load(), null);
});

test('ignores corrupt or invalid saved data', () => {
  const storage = memoryStorage();
  const save = createSave(storage);
  storage.setItem('narnia-save-v1', '{not json');
  assert.equal(save.load(), null);
  storage.setItem('narnia-save-v1', JSON.stringify({ roomIndex: -1 }));
  assert.equal(save.load(), null);
  storage.setItem('narnia-save-v1', JSON.stringify({ roomIndex: 'two' }));
  assert.equal(save.load(), null);
});

test('never throws when storage is missing or blocked', () => {
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  for (const storage of [null, throwing]) {
    const save = createSave(storage);
    assert.doesNotThrow(() => save.save({ roomIndex: 1 }));
    assert.equal(save.load(), null);
    assert.doesNotThrow(() => save.clear());
  }
});

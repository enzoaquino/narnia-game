import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SceneStack } from '../src/engine/scenes.js';

function scene(name, log) {
  return {
    update: () => log.push(`update ${name}`),
    render: () => log.push(`render ${name}`),
  };
}

test('push and pop manage the top scene and set scene.stack', () => {
  const stack = new SceneStack();
  const a = scene('a', []);
  const b = scene('b', []);
  stack.push(a);
  stack.push(b);
  assert.equal(stack.top, b);
  assert.equal(b.stack, stack);
  assert.equal(stack.pop(), b);
  assert.equal(stack.top, a);
});

test('only the top scene updates, but every scene renders bottom to top', () => {
  const log = [];
  const stack = new SceneStack();
  stack.push(scene('play', log));
  stack.push(scene('dialogue', log));
  stack.update(0.016, {});
  stack.render({});
  assert.deepEqual(log, ['update dialogue', 'render play', 'render dialogue']);
});

test('reset replaces everything with one scene', () => {
  const stack = new SceneStack();
  stack.push(scene('a', []));
  stack.push(scene('b', []));
  const c = scene('c', []);
  stack.reset(c);
  assert.equal(stack.top, c);
  stack.pop();
  assert.equal(stack.top, null);
});

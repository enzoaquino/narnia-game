/** A stack of scenes. Only the top one updates; all of them render, bottom first. */
export class SceneStack {
  constructor() {
    this.scenes = [];
  }

  get top() {
    return this.scenes[this.scenes.length - 1] ?? null;
  }

  push(scene) {
    scene.stack = this;
    this.scenes.push(scene);
  }

  pop() {
    return this.scenes.pop();
  }

  reset(scene) {
    this.scenes = [];
    this.push(scene);
  }

  update(dt, input) {
    this.top?.update(dt, input);
  }

  render(r) {
    for (const scene of this.scenes) scene.render(r);
  }
}

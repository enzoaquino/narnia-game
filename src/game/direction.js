export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Facing for a movement vector: whichever axis is larger wins (ties go horizontal). */
export function facingFromVector(vx, vy) {
  if (Math.abs(vx) >= Math.abs(vy)) return vx >= 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** Facing from held input (ix, iy in -1..1). Diagonals keep the current facing when it matches. */
export function chooseFacing(current, ix, iy) {
  if (ix !== 0 && iy !== 0) {
    const keeps =
      (current === 'left' && ix < 0) ||
      (current === 'right' && ix > 0) ||
      (current === 'up' && iy < 0) ||
      (current === 'down' && iy > 0);
    if (keeps) return current;
    return ix > 0 ? 'right' : 'left';
  }
  if (ix !== 0) return ix > 0 ? 'right' : 'left';
  return iy > 0 ? 'down' : 'up';
}

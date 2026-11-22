import { TILE } from '../config.js';

const EPS = 1e-4;

/** True when two boxes ({x, y, w, h}) overlap. Touching edges do not count. */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when any tile under the box is solid. isSolidAt(col, row) -> boolean. */
export function boxHitsSolid(box, isSolidAt) {
  const c0 = Math.floor(box.x / TILE);
  const c1 = Math.floor((box.x + box.w - EPS) / TILE);
  const r0 = Math.floor(box.y / TILE);
  const r1 = Math.floor((box.y + box.h - EPS) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolidAt(c, r)) return true;
    }
  }
  return false;
}

/**
 * Move a box by (dx, dy), stopping flush against solid tiles and sliding
 * along them. Moves X first, then Y. When blocked on one axis with no input
 * on the other, `nudge` (px) lets the box slip around corners into gaps.
 * Returns the new {x, y}; does not modify the box.
 */
export function moveAndSlide(box, dx, dy, isSolidAt, nudge = 0) {
  const cur = { x: box.x, y: box.y, w: box.w, h: box.h };
  if (dx !== 0) {
    const r = moveAxis(cur, 'x', dx, isSolidAt);
    cur.x = r.pos;
    if (r.blocked && dy === 0 && nudge > 0) {
      cur.y = cornerNudge(cur, 'x', Math.sign(dx), isSolidAt, nudge);
    }
  }
  if (dy !== 0) {
    const r = moveAxis(cur, 'y', dy, isSolidAt);
    cur.y = r.pos;
    if (r.blocked && dx === 0 && nudge > 0) {
      cur.x = cornerNudge(cur, 'y', Math.sign(dy), isSolidAt, nudge);
    }
  }
  return { x: cur.x, y: cur.y };
}

function moveAxis(box, axis, delta, isSolidAt) {
  const pos = box[axis] + delta;
  if (!boxHitsSolid({ ...box, [axis]: pos }, isSolidAt)) return { pos, blocked: false };
  const size = axis === 'x' ? box.w : box.h;
  const snapped =
    delta > 0
      ? Math.max(box[axis], Math.floor((pos + size - EPS) / TILE) * TILE - size)
      : Math.min(box[axis], (Math.floor(pos / TILE) + 1) * TILE);
  return { pos: snapped, blocked: true };
}

// Blocked moving along `axis`: look up to maxNudge px either side on the
// perpendicular axis for an opening, and step 1px toward the nearest one.
function cornerNudge(box, axis, dir, isSolidAt, maxNudge) {
  const perp = axis === 'x' ? 'y' : 'x';
  for (let k = 1; k <= maxNudge; k++) {
    for (const side of [-1, 1]) {
      const probe = { ...box, [perp]: box[perp] + side * k };
      probe[axis] += dir;
      const firstStep = { ...box, [perp]: box[perp] + side };
      if (!boxHitsSolid(probe, isSolidAt) && !boxHitsSolid(firstStep, isSolidAt)) {
        return box[perp] + side;
      }
    }
  }
  return box[perp];
}

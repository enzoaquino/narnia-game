// Shared test fixtures. Not a test file (no .test.js suffix).

/** isSolidAt for a grid of strings where '#' is solid. Outside the grid is solid. */
export function gridSolid(rows) {
  return (col, row) =>
    row < 0 || row >= rows.length || col < 0 || col >= rows[0].length || rows[row][col] === '#';
}

/** A stand-in for Input: actions held down and actions pressed this step. */
export function fakeInput({ down = [], pressed = [] } = {}) {
  const d = new Set(down);
  const p = new Set(pressed);
  return { isDown: (a) => d.has(a), wasPressed: (a) => p.has(a) };
}

/** Deterministic rng that cycles through the given values. */
export function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

export function run(n, fn) {
  for (let i = 0; i < n; i++) fn(i);
}

export const TEST_MAP = [
  'TTTTTTTWTTTTTTTT',
  'T..............T',
  'T..............T',
  'T....R.........T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'T..............T',
  'TTTTTTTXTTTTTTTT',
];

export function testRoomDef(overrides = {}) {
  return { id: 'test', name: 'Test Room', map: TEST_MAP, entities: [], hooks: {}, ...overrides };
}

export function withRow(map, row, text) {
  return map.map((r, i) => (i === row ? text : r));
}

// Pixel-art sprites defined as strings. Parsing is pure; createSpriteCache
// turns parsed sprites into canvases (one of the two files allowed to touch the DOM).

export function parseSprite(rows, palette) {
  const height = rows.length;
  const width = rows[0].length;
  const pixels = [];
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`row ${y} has ${row.length} pixels, expected ${width}`);
    }
    for (const ch of row) {
      if (!(ch in palette)) throw new Error(`unknown color "${ch}" in row ${y}`);
      pixels.push(palette[ch]);
    }
  });
  return { width, height, pixels };
}

export function flipH({ width, height, pixels }) {
  const out = [];
  for (let y = 0; y < height; y++) {
    for (let x = width - 1; x >= 0; x--) out.push(pixels[y * width + x]);
  }
  return { width, height, pixels: out };
}

export function flipV({ width, height, pixels }) {
  const out = [];
  for (let y = height - 1; y >= 0; y--) {
    out.push(...pixels.slice(y * width, (y + 1) * width));
  }
  return { width, height, pixels: out };
}

export function resolveSprite(defs, name, basePalette) {
  const def = defs[name];
  if (!def) throw new Error(`unknown sprite "${name}"`);
  try {
    if (def.mirrorOf) return flipH(resolveSprite(defs, def.mirrorOf, basePalette));
    if (def.flipOf) return flipV(resolveSprite(defs, def.flipOf, basePalette));
    return parseSprite(def.rows, { ...basePalette, ...(def.palette ?? {}) });
  } catch (err) {
    throw new Error(`sprite "${name}": ${err.message}`);
  }
}

export function createSpriteCache(defs, basePalette) {
  const cache = new Map();
  return {
    get(name) {
      if (!cache.has(name)) cache.set(name, toCanvas(resolveSprite(defs, name, basePalette)));
      return cache.get(name);
    },
  };
}

function toCanvas({ width, height, pixels }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  pixels.forEach((color, i) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(i % width, Math.floor(i / width), 1, 1);
  });
  return canvas;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// macOS is case-insensitive but GitHub Pages is not, so a misspelled-case import
// works locally and breaks once deployed. Check exact filename case.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
}

function exactCaseExists(path) {
  if (!existsSync(path)) return false;
  const parts = path.slice(ROOT.length + 1).split(sep);
  let dir = ROOT;
  for (const part of parts) {
    if (!readdirSync(dir).includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
}

const SPEC = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g;

test('every relative import in src/ points at a file with exactly that case', () => {
  const files = jsFiles(SRC);
  assert.ok(files.length > 10);
  const bad = [];
  let count = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(SPEC)) {
      count++;
      const spec = m[1] ?? m[2];
      const target = resolve(dirname(file), spec);
      if (!exactCaseExists(target)) bad.push(`${file.slice(ROOT.length + 1)} imports ${spec}`);
    }
  }
  assert.ok(count > 20, 'the import regex should find imports');
  assert.deepEqual(bad, []);
});

test('the case check itself catches a wrong-case name', () => {
  assert.equal(exactCaseExists(join(SRC, 'config.js')), true);
  assert.equal(exactCaseExists(join(SRC, 'Config.js')), false);
});

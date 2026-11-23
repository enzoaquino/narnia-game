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

// index.html loads every module as `src/<file>?v=VERSION` (an import map), so a phone
// never mixes cached old files with new ones. The list there must match src/ exactly.
function versioning() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const version = html.match(/const VERSION = '([^']+)'/)?.[1];
  const list = html.match(/const MODULES = \[([\s\S]*?)\]/)?.[1];
  const modules = list ? [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  return { version, modules };
}

test('index.html lists every module in src/ for the version tag, and nothing else', () => {
  const { modules } = versioning();
  const actual = jsFiles(SRC).map((f) => f.slice(SRC.length + 1).split(sep).join('/')).sort();
  const missing = actual.filter((m) => !modules.includes(m));
  const extra = modules.filter((m) => !actual.includes(m));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] },
    'update MODULES in index.html: add new files under src/, remove deleted ones');
  assert.equal(new Set(modules).size, modules.length, 'a module is listed twice');
});

test('index.html has a VERSION for cache-busting', () => {
  assert.match(versioning().version ?? '', /^[\w.-]+$/);
});

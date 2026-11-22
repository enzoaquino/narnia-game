#!/usr/bin/env node
// Sprite preview for drawing-sprites: text checks + one zoomed screenshot.
//
//   node .claude/skills/drawing-sprites/preview.mjs <name|prefix_>... [--out file.png]
//
// A name ending in "_" matches every sprite with that prefix (e.g. "wolf_").
// Prints problems to stdout, writes a PNG (default: <tmp>/sprite-preview.png)
// and prints its path, then loads sprites.html and reports any sprite it can't draw. Run from the repo root. Needs Node 22.7+ and Chrome.
// Exit code: 0 ok, 1 sprite errors (bad rows/colors/unknown name), 2 tool failure.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, resolve, sep, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CHROME = process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ZOOM = 12;
const SCENE_ZOOM = 6;
const REFERENCE = ['lucy_down_0', 'tumnus_down', 'wolf_right_0']; // existing art for scale

// ---------- args ----------
const args = process.argv.slice(2);
let out = join(tmpdir(), 'sprite-preview.png');
const patterns = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = resolve(args[++i]);
  else patterns.push(args[i]);
}
if (!patterns.length) {
  console.error('usage: node .claude/skills/drawing-sprites/preview.mjs <name|prefix_>... [--out file.png]');
  process.exit(2);
}
if (!existsSync(join(ROOT, 'src/art/index.js'))) {
  console.error('run this from the repo root (src/art/index.js not found)');
  process.exit(2);
}

// ---------- text checks (pure Node) ----------
const { SPRITES, PALETTE, SPRITE_GROUPS } = await import(pathToFileURL(join(ROOT, 'src/art/index.js')));
const { resolveSprite } = await import(pathToFileURL(join(ROOT, 'src/engine/sprites.js')));

const all = Object.keys(SPRITES);
const names = [];
let errors = 0;
for (const p of patterns) {
  const hits = p.endsWith('_') ? all.filter((n) => n.startsWith(p)) : all.filter((n) => n === p);
  if (!hits.length) { console.log(`ERROR  no sprite matches "${p}"`); errors++; }
  for (const h of hits) if (!names.includes(h)) names.push(h);
}

const grouped = new Set(Object.values(SPRITE_GROUPS).flat());
const resolved = {};
for (const name of names) {
  let s;
  try { s = resolved[name] = resolveSprite(SPRITES, name, PALETTE); }
  catch (err) { console.log(`ERROR  ${err.message}`); errors++; continue; }
  const def = SPRITES[name];
  const notes = [];
  if (!grouped.has(name)) notes.push('not in SPRITE_GROUPS (src/art/index.js), so sprites.html will not show it');
  if (def.rows && def.palette) {
    const shared = Object.keys(def.palette).filter((c) => c in PALETTE);
    if (shared.length) notes.push(`own palette overrides shared color(s) ${shared.join(' ')}`);
  }
  const opaque = s.pixels.filter(Boolean).length;
  if (opaque === 0) notes.push('fully transparent');
  const directional = (SPRITE_GROUPS.Characters ?? []).includes(name);
  if (directional && (s.width !== 16 || s.height !== 16)) notes.push(`characters must be 16x16; count the rows and columns`);
  if (directional && s.width === 16 && s.height === 16) {
    const bottom = s.pixels.slice(15 * 16);
    if (bottom.every((px) => px === null)) notes.push('bottom row is empty: characters stand on row 15 (feet float)');
  }
  const kind = def.mirrorOf ? ` (mirror of ${def.mirrorOf})` : def.flipOf ? ` (flip of ${def.flipOf})` : '';
  console.log(`ok     ${name} ${s.width}x${s.height}${kind}${notes.length ? '\n         - ' + notes.join('\n         - ') : ''}`);
}
// Walk frames that are identical don't animate.
for (const name of names) {
  const m = name.match(/^(.*)_0$/);
  const other = m && `${m[1]}_1`;
  if (other && resolved[name] && resolved[other] &&
      JSON.stringify(resolved[name].pixels) === JSON.stringify(resolved[other].pixels)) {
    console.log(`WARN   ${name} and ${other} are identical: the walk cycle will not move`);
  }
}

// ---------- preview page ----------
const PAGE = `<!doctype html><meta charset="utf-8"><title>preview</title>
<style>
  body{margin:0;padding:16px;background:#1b1f2a;color:#e8f0f8;font:13px monospace;width:max-content}
  h2{font:bold 14px monospace;margin:14px 0 6px}
  .row{display:flex;gap:14px;flex-wrap:nowrap;align-items:flex-start}
  figure{margin:0;padding:6px;background:#2a3040;border-radius:4px}
  figcaption{margin-top:4px}
  canvas{display:block;image-rendering:pixelated}
  .err{color:#ff9aa8;white-space:pre}
</style>
<div id="out"></div>
<script type="module">
  import { SPRITES, PALETTE } from './src/art/index.js';
  import { createSpriteCache } from './src/engine/sprites.js';
  const names = ${JSON.stringify(names.filter((n) => resolved[n]))};
  const refs = ${JSON.stringify(REFERENCE)}.filter((n) => n in SPRITES && !names.includes(n));
  const Z = ${ZOOM}, SZ = ${SCENE_ZOOM};
  const cache = createSpriteCache(SPRITES, PALETTE);
  const out = document.getElementById('out');
  const el = (t, txt) => { const e = document.createElement(t); if (txt) e.textContent = txt; return e; };
  const section = (title) => { out.append(el('h2', title)); const r = el('div'); r.className = 'row'; out.append(r); return r; };

  // 1. Zoomed with a pixel grid and row/column numbers, on snow and on dark.
  const zoomRow = section('Zoomed ' + Z + 'x (numbers = column / row index into the strings)');
  for (const name of names) {
    const img = cache.get(name), w = img.width, h = img.height, M = 18;
    const c = el('canvas'); c.width = M + w * Z * 2 + Z * 2; c.height = M + h * Z;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#1b1f2a'; x.fillRect(0, 0, c.width, c.height);
    const panels = [[M, PALETTE.s], [M + w * Z + Z * 2, '#10141f']];
    for (const [ox, bg] of panels) {
      x.fillStyle = bg; x.fillRect(ox, M, w * Z, h * Z);
      x.drawImage(img, ox, M, w * Z, h * Z);
      x.strokeStyle = 'rgba(128,128,128,0.35)'; x.lineWidth = 1;
      for (let i = 0; i <= w; i++) { x.beginPath(); x.moveTo(ox + i * Z + .5, M); x.lineTo(ox + i * Z + .5, M + h * Z); x.stroke(); }
      for (let j = 0; j <= h; j++) { x.beginPath(); x.moveTo(ox, M + j * Z + .5); x.lineTo(ox + w * Z, M + j * Z + .5); x.stroke(); }
      x.fillStyle = '#9aa4b8'; x.font = '9px monospace'; x.textAlign = 'center';
      for (let i = 0; i < w; i++) x.fillText(String(i % 10), ox + i * Z + Z / 2, M - 5);
    }
    x.textAlign = 'right';
    for (let j = 0; j < h; j++) x.fillText(String(j), M - 3, M + j * Z + Z / 2 + 3);
    const f = el('figure'); f.append(c, el('figcaption', name + ' ' + w + 'x' + h)); zoomRow.append(f);
  }

  // 2. In-game look: actual 1x art scaled ${SCENE_ZOOM}x on a snow/path patch next to existing characters.
  const sceneRow = section('In the game at ' + SZ + 'x, beside existing art for scale (' + refs.join(', ') + ')');
  const cast = [...refs, ...names];
  const cols = Math.max(4, cast.length + 2), rows = 3;
  const sc = el('canvas'); sc.width = cols * 16 * SZ; sc.height = rows * 16 * SZ;
  const sx = sc.getContext('2d'); sx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    sx.drawImage(cache.get(r === 2 ? 'path' : 'snow'), c * 16 * SZ, r * 16 * SZ, 16 * SZ, 16 * SZ);
  cast.forEach((n, i) => {
    const img = cache.get(n);
    // Characters stand on row 1 (snow); everything else sits centred in its tile.
    const ox = (i + 1) * 16 * SZ + (16 - img.width) / 2 * SZ;
    const oy = 1 * 16 * SZ + (16 - img.height) / (img.height === 16 ? 1 : 2) * SZ;
    sx.drawImage(img, ox, oy, img.width * SZ, img.height * SZ);
    const img2 = img; // same sprite again on the trodden path row
    sx.drawImage(img2, ox, 2 * 16 * SZ + (16 - img.height) / (img.height === 16 ? 1 : 2) * SZ, img.width * SZ, img.height * SZ);
  });
  const sf = el('figure'); sf.append(sc); sceneRow.append(sf);
  window.__done = true;
</script>`;

// ---------- static server ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/__preview') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/__preview`;

// ---------- headless Chrome over CDP ----------
const profile = await mkdtemp(join(tmpdir(), 'sprite-preview-'));
let chrome;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shoot() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=/path/to/chrome)`);
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {}
  }
  if (!port) throw new Error('Chrome did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const pageErrors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100 && !(await evaluate('window.__done === true')) && !pageErrors.length; i++) await sleep(100);
  if (pageErrors.length) throw new Error('preview page error:\n' + pageErrors.join('\n'));
  if (!(await evaluate('window.__done === true'))) throw new Error('preview page did not finish rendering');
  const size = await evaluate('({w: document.body.scrollWidth, h: document.body.scrollHeight})');
  await send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: false });
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(shot.result.data, 'base64'));

  // Whole-page check: sprites.html must still draw every sprite.
  pageErrors.length = 0;
  await send('Page.navigate', { url: url.replace('/__preview', '/sprites.html') });
  let figs = 0;
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    figs = await evaluate('document.querySelectorAll("figure").length');
    if (figs >= Object.keys(SPRITES).length || pageErrors.length) break;
  }
  const broken = await evaluate('[...document.querySelectorAll(".error")].map((e) => e.textContent.replace(/\\n/g, ": "))');
  const problems = [...pageErrors, ...(broken ?? [])];
  if (figs < Object.keys(SPRITES).length) problems.push(`sprites.html drew ${figs} of ${Object.keys(SPRITES).length} sprites`);
  sheetReport = problems.length ? 'sprites.html: PROBLEMS\n  ' + problems.join('\n  ') : `sprites.html: ok (${figs} sprites)`;
  if (problems.length) errors++;
  ws.close();
}

let failed = false;
let sheetReport = '';
try {
  if (names.some((n) => resolved[n])) {
    await shoot();
    console.log(`\n${sheetReport}\nscreenshot: ${out}`);
  }
} catch (err) {
  console.error(`\npreview failed: ${err.message}`);
  failed = true;
} finally {
  chrome?.kill();
  server.close();
  await sleep(200);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
process.exit(failed ? 2 : errors ? 1 : 0);

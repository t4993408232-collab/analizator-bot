// Frame-exact render: headless Chromium draws window.frame(t) for t = i/FPS, JPEG frames are piped into ffmpeg with the track.
// Same pipeline as Silver Air (rocketmandrey/silver-air-stained-glass), made portable (Linux/macOS, GPU or SwiftShader).
//   node render.mjs                        -> out/video.mp4 (1080x1920, 30 fps, assets/track.m4a)
//   node render.mjs --sheet [--at 1,7.5,12] -> out/sheet.jpg (6 frames across the clip, or the given seconds)
//   node render.mjs --scale .5 --from 10 --to 15 --fps 24
// CHROME=/path/to/chrome overrides the browser; GPU=1 uses the hardware GPU instead of SwiftShader.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

const ROOT = import.meta.dirname, OUT = resolve(ROOT, 'out'), argv = process.argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i > 0 ? +argv[i + 1] : d; };
const FPS = opt('--fps', 30), SCALE = opt('--scale', 1), sheet = argv.includes('--sheet');
const { duration } = JSON.parse(readFileSync(resolve(ROOT, 'assets/timing.json')));
const T0 = opt('--from', 0), T1 = opt('--to', duration);
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => {
  const f = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (relative(ROOT, f).startsWith('..')) return res.writeHead(403).end();
  let body; try { body = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));

const gpu = process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0, args: [...gpu, '--no-sandbox', '--window-size=1080,1920'] });
const page = await browser.newPage();
page.on('console', m => ['error', 'warn'].includes(m.type()) && console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?scale=${SCALE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.ready === true', { timeout: 300000 });
const grab = t => page.evaluate(async t => { await window.frame(t); return document.getElementById('c').toDataURL('image/jpeg', .92); }, t);
mkdirSync(OUT, { recursive: true });

if (sheet) {
  const at = argv.includes('--at') ? argv[argv.indexOf('--at') + 1].split(',').map(Number) : [...Array(6)].map((_, i) => +(T0 + .5 + i * (T1 - T0 - 1) / 5).toFixed(2));
  const cells = []; for (const t of at) cells.push(await grab(t));
  const url = await page.evaluate(async cells => { const w = 270, h = 480, s = document.createElement('canvas'); s.width = w * cells.length; s.height = h;
    const x = s.getContext('2d'); for (let i = 0; i < cells.length; i++) { const im = new Image(); im.src = cells[i]; await im.decode(); x.drawImage(im, i * w, 0, w, h); }
    return s.toDataURL('image/jpeg', .9); }, cells);
  writeFileSync(resolve(OUT, 'sheet.jpg'), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote out/sheet.jpg');
} else {
  const n = Math.round((T1 - T0) * FPS), t0 = Date.now(), file = resolve(OUT, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(T0), '-i', resolve(ROOT, 'assets/track.m4a'), '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = Buffer.from((await grab(T0 + i / FPS)).split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (FPS * 2) === 0) console.log(`frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote', relative(ROOT, file));
}
await browser.close(); server.close(); process.exit(0);

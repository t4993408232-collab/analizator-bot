// Renders the loop frame by frame in headless Chromium and builds every deliverable from the brief:
//   node render.mjs                 -> out/DoctorTeam_Loop_4K.mp4, _FHD.mp4, _x10.mp4, DoctorTeam_QR_Frame_4K.png
//   node render.mjs --sheet --at 0.3,1.6,3,4.6,7,13.6 [--scale .25]   -> out/sheet.jpg (quick look)
// CHROME=/path/to/chrome overrides the browser; GPU=1 uses the hardware GPU.
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

const ROOT = import.meta.dirname, OUT = resolve(ROOT, 'out'), argv = process.argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(resolve(ROOT, 'config.json'))), FPS = cfg.fps, DUR = cfg.duration, sheet = argv.includes('--sheet');
const SCALE = +opt('--scale', sheet ? .25 : 1);
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const f = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (relative(ROOT, f).startsWith('..')) return res.writeHead(403).end();
  let body; try { body = readFileSync(f); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }).end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const gpu = process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0, args: [...gpu, '--no-sandbox'] });
const page = await browser.newPage();
page.on('console', m => ['error', 'warn'].includes(m.type()) && console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?scale=${SCALE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.ready === true', { timeout: 300000 });
const grab = (t, type = 'image/jpeg', q = .96) => page.evaluate(async (t, type, q) => { await window.frame(t); return document.getElementById('c').toDataURL(type, q); }, t, type, q);
const b64 = u => Buffer.from(u.split(',')[1], 'base64');
mkdirSync(OUT, { recursive: true });
const ff = args => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };

if (sheet) {
  const at = opt('--at', '0.3,1.6,3,4.7,7,13.6').split(',').map(Number), cells = [];
  for (const t of at) cells.push(await grab(t));
  const url = await page.evaluate(async cells => { const im0 = new Image(); im0.src = cells[0]; await im0.decode(); const w = im0.width, h = im0.height, cols = Math.min(3, cells.length), rows = Math.ceil(cells.length / cols);
    const s = document.createElement('canvas'); s.width = w * cols; s.height = h * rows; const x = s.getContext('2d');
    for (let i = 0; i < cells.length; i++) { const im = new Image(); im.src = cells[i]; await im.decode(); x.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h); }
    return s.toDataURL('image/jpeg', .9); }, cells);
  writeFileSync(resolve(OUT, 'sheet.jpg'), b64(url)); console.log('wrote out/sheet.jpg');
} else {
  const n = Math.round(DUR * FPS), t0 = Date.now(), f4 = resolve(OUT, 'DoctorTeam_Loop_4K.mp4');
  // 4K master: H.264 High, 25 fps, ~35 Mbit/s, closed GOP of one second, no audio track
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '5.1', '-pix_fmt', 'yuv420p', '-b:v', '35M', '-maxrate', '40M', '-bufsize', '80M',
    '-g', String(FPS), '-keyint_min', String(FPS), '-sc_threshold', '0', '-r', String(FPS), '-an', '-movflags', '+faststart', f4], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    if (!enc.stdin.write(b64(await grab(i / FPS)))) await new Promise(r => enc.stdin.once('drain', r));
    if (i % 50 === 0) console.log(`frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`);
  }
  enc.stdin.end(); await new Promise(r => enc.on('close', r));
  // print still of the QR frame, lossless
  writeFileSync(resolve(OUT, 'DoctorTeam_QR_Frame_4K.png'), b64(await grab(10, 'image/png')));
  ff(['-i', f4, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', '14M', '-maxrate', '16M', '-bufsize', '32M',
    '-g', String(FPS), '-r', String(FPS), '-an', '-movflags', '+faststart', resolve(OUT, 'DoctorTeam_Loop_FHD.mp4')]);
  ff(['-stream_loop', '9', '-i', f4, '-c', 'copy', '-an', '-movflags', '+faststart', resolve(OUT, 'DoctorTeam_Loop_x10.mp4')]);
  console.log('wrote out/: DoctorTeam_Loop_4K.mp4, DoctorTeam_Loop_FHD.mp4, DoctorTeam_Loop_x10.mp4, DoctorTeam_QR_Frame_4K.png');
}
await browser.close(); server.close(); process.exit(0);

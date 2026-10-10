// Покадровый рендер по методу Code-Video kit (render.mjs): headless Chromium рисует window.frame(t) для t = i/FPS,
// JPEG-кадры идут в ffmpeg через pipe вместе с синтезированной музыкой (out/<id>.wav).
//   node render.mjs <id>                          -> ../<id>.mp4 (1080x1920, 30 fps, H.264 + AAC)
//   node render.mjs <id> --sheet --at 0,1.5,16,32 -> out/<id>_sheet.jpg
//   node render.mjs <id> --cover                  -> ../<id>_cover.png
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';

const ROOT = import.meta.dirname, OUT = resolve(ROOT, 'out'), DEST = resolve(ROOT, '..'), argv = process.argv, id = argv[2];
const opt = (k, d) => { const i = argv.indexOf(k); return i > 0 ? +argv[i + 1] : d; };
const FPS = opt('--fps', 30), SCALE = opt('--scale', 1), sheet = argv.includes('--sheet'), cover = argv.includes('--cover');
const { duration } = JSON.parse(readFileSync(resolve(OUT, `${id}.timing.json`)));
const T0 = opt('--from', 0), T1 = opt('--to', duration);
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium'].find(existsSync);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
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
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?v=${id}&scale=${SCALE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.ready === true', { timeout: 300000 });
const grab = (t, fmt = 'image/jpeg') => page.evaluate(async (t, fmt) => { await (t < 0 ? window.cover() : window.frame(t)); return document.getElementById('c').toDataURL(fmt, .93); }, t, fmt);
mkdirSync(OUT, { recursive: true });

if (cover) {
  writeFileSync(resolve(DEST, `${id}_cover.png`), Buffer.from((await grab(-1, 'image/png')).split(',')[1], 'base64')); console.log('wrote cover', id);
} else if (sheet) {
  const at = argv.includes('--at') ? argv[argv.indexOf('--at') + 1].split(',').map(Number) : [0, 1.5, 4, 7, 11, 17, 23, 27, 31, duration - .05];
  const cells = []; for (const t of at) cells.push(await grab(t));
  const url = await page.evaluate(async (cells, at) => { const w = 360, h = 640, s = document.createElement('canvas'); s.width = w * cells.length; s.height = h + 40;
    const x = s.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, s.width, s.height);
    for (let i = 0; i < cells.length; i++) { const im = new Image(); im.src = cells[i]; await im.decode(); x.drawImage(im, i * w, 40, w, h);
      x.fillStyle = '#fff'; x.font = '28px sans-serif'; x.fillText(at[i] + ' s', i * w + 10, 30); x.strokeStyle = 'rgba(255,0,0,.6)'; x.beginPath(); x.moveTo(i * w, 40 + h * .75); x.lineTo(i * w + w, 40 + h * .75); x.stroke(); }
    return s.toDataURL('image/jpeg', .88); }, cells, at);
  writeFileSync(resolve(OUT, `${id}_sheet.jpg`), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote sheet', id);
} else {
  const n = Math.round((T1 - T0) * FPS), t0 = Date.now(), file = resolve(DEST, `${id}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(T0), '-i', resolve(OUT, `${id}.wav`), '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = Buffer.from((await grab(T0 + i / FPS)).split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (FPS * 5) === 0) console.log(`${id} frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('wrote', relative(ROOT, file));
}
await browser.close(); server.close(); process.exit(0);

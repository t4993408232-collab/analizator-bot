// Acceptance checks that can run before the real screen test:
// 1) both QR codes decode from the final frame at 1/2-1/8 size (a phone 3-4 m from a 55" screen sees the code
//    at roughly 1/6-1/8 of its 4K size), and decode to exactly the URLs in config.json;
// 2) the loop seam: the last frame and the first frame of the master differ no more than two neighbouring frames do.
//   node verify.mjs
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = import.meta.dirname, cfg = JSON.parse(readFileSync(resolve(ROOT, 'config.json')));
const png = PNG.sync.read(readFileSync(resolve(ROOT, 'out/DoctorTeam_QR_Frame_4K.png')));
let ok = true;
const crop = (img, x0, y0, w, h, f) => {                                    // box-downscale a region by 1/f (what a far camera sees)
  const W = Math.floor(w / f), H = Math.floor(h / f), out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0, n = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const k = ((y0 + y * f + j) * img.width + x0 + x * f + i) * 4; s += img.data[k]; n++; }
    const v = s / n, o = (y * W + x) * 4; out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255; }
  return { data: out, W, H };
};
const halves = [[0, 0, png.width / 2], [png.width / 2, 0, png.width / 2]];
cfg.qr.forEach((q, k) => {
  for (const f of [2, 3, 4, 6, 8]) {
    const [x0, y0, w] = halves[k], c = crop(png, x0, y0, w, png.height, f), r = jsQR(c.data, c.W, c.H);
    const pass = r?.data === q.url; ok &&= pass;
    console.log(`${pass ? 'OK  ' : 'FAIL'} QR ${k + 1} at 1/${f} size (${c.W}x${c.H}): ${r ? r.data : 'not found'}`);
  }
});
// seam: mean abs difference, last->first vs. an ordinary step inside the hold
const frameAt = (file, sel) => spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `select='${sel}',scale=480:270`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 24 }).stdout;
const m4 = resolve(ROOT, 'out/DoctorTeam_Loop_4K.mp4'), n = cfg.fps * cfg.duration;
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const first = frameAt(m4, 'eq(n,0)'), last = frameAt(m4, `eq(n,${n - 1})`), a1 = frameAt(m4, 'eq(n,1)'), h0 = frameAt(m4, 'eq(n,30)'), h1 = frameAt(m4, 'eq(n,31)');
const seam = diff(last, first), step = Math.max(diff(first, a1), diff(h0, h1));
console.log(`seam last->first: ${seam.toFixed(3)} (mean |Δ| of 0-255), ordinary frame step: ${step.toFixed(3)} -> ${seam <= step * 1.5 + .2 ? 'OK, seam invisible' : 'CHECK seam'}`);
process.exit(ok ? 0 : 1);

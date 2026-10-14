// Beat grid from audio without Python: ffmpeg decodes to mono PCM, spectral-flux onsets, tempo by autocorrelation,
// then a grid phase-locked to the strongest onsets. Writes assets/timing.json { duration, bpm, beats, downbeats }.
//   node beats.mjs assets/track.m4a [--bpm 120] [--offset 0]
// For real songs prefer librosa / madmom (downbeats) — this is the dependency-free fallback.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const file = process.argv[2] ?? 'assets/track.m4a', arg = k => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : undefined; };
const SR = 11025, HOP = 256;
const pcm = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }).stdout;
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4), duration = x.length / SR;

// onset strength: positive change of energy in 4 bands (cheap spectral flux)
const N = Math.floor(x.length / HOP), env = new Float32Array(N), bands = [[0, .02], [.02, .08], [.08, .25], [.25, 1]];
let prev = [0, 0, 0, 0];
for (let i = 0; i < N; i++) {
  const seg = x.subarray(i * HOP, i * HOP + 512); let lo = 0, d1 = 0, d2 = 0, hi = 0, p = 0;
  for (let j = 0; j < seg.length; j++) { const v = seg[j], d = v - p; p = v; lo += v * v; d1 += d * d; }
  for (let j = 2; j < seg.length; j++) { const dd = seg[j] - 2 * seg[j - 1] + seg[j - 2]; d2 += dd * dd; }
  hi = d2; const cur = [Math.log1p(lo * 100), Math.log1p(d1 * 100), Math.log1p(d2 * 100), Math.log1p(hi * 50)];
  env[i] = cur.reduce((s, v, k) => s + Math.max(0, v - prev[k]), 0); prev = cur;
}
const fps = SR / HOP;
// tempo: autocorrelation of the onset envelope in 60..180 BPM, weighted toward 120
let bpm = arg('--bpm');
if (!bpm) { let best = 0;
  for (let b = 60; b <= 180; b += .5) { const lag = fps * 60 / b; let s = 0;
    for (let i = Math.ceil(lag); i < N; i++) s += env[i] * (env[Math.round(i - lag)] || 0);
    s *= Math.exp(-((Math.log2(b / 120)) ** 2) * 2); if (s > best) { best = s; bpm = b; } } }
const P = 60 / bpm;
// phase: offset that collects the most onset energy on the grid
let off = arg('--offset'), bestS = -1;
if (off === undefined) for (let o = 0; o < P; o += .005) { let s = 0; for (let t = o; t < duration; t += P) s += env[Math.round(t * fps)] || 0; if (s > bestS) { bestS = s; off = o; } }
const beats = []; for (let t = off; t < duration; t += P) beats.push(+t.toFixed(3));
// downbeat phase: the beat index mod 4 with the most energy
const acc = [0, 1, 2, 3].map(k => beats.filter((_, i) => i % 4 === k).reduce((s, t) => s + (env[Math.round(t * fps)] || 0), 0));
const k0 = acc.indexOf(Math.max(...acc)), downbeats = beats.filter((_, i) => i % 4 === k0);
writeFileSync('assets/timing.json', JSON.stringify({ duration: +duration.toFixed(3), bpm, beats: beats.slice(k0), downbeats }));
console.log(`duration ${duration.toFixed(2)} s, ${bpm} BPM, first beat ${off.toFixed(3)} s, ${beats.length} beats -> assets/timing.json`);

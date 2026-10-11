// Тёплая музыка без сэмплов: пэд + бас + щипковая мелодия (Karplus-Strong / колокольчик / маримба) + мягкий бит.
// Пишет out/<id>.wav и out/<id>.timing.json { duration, bpm, beats, downbeats } — тот же формат, что kit/assets/timing.json.
//   node synth.mjs <id>        (параметры трека — в videos.js, поле music)
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { VIDEOS } from './videos.js';

const ROOT = import.meta.dirname, OUT = resolve(ROOT, 'out'); mkdirSync(OUT, { recursive: true });
const id = process.argv[2], V = VIDEOS.find(v => v.id === id); if (!V) throw new Error('unknown id ' + id);
const M = V.music, SR = 44100, DUR = V.duration, N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = M.seed; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hz = m => 440 * 2 ** ((m - 69) / 12);
const beat = 60 / M.bpm, bar = beat * 4;

// --- instruments: each adds into L/R at time t
function add(t0, buf, pan = 0, gain = 1) {
  const i0 = Math.round(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < buf.length && i0 + i < N; i++) if (i0 + i >= 0) { L[i0 + i] += buf[i] * gl; R[i0 + i] += buf[i] * gr; }
}
function pluck(f, len, bright = .5) {                       // Karplus-Strong: тёплая гитара/укулеле
  const n = Math.round(SR * len), p = Math.max(2, Math.round(SR / f)), d = new Float32Array(p), o = new Float32Array(n);
  for (let i = 0; i < p; i++) d[i] = (rnd() * 2 - 1);
  let prev = 0;
  for (let i = 0; i < n; i++) { const k = i % p, v = d[k]; const nv = (v * (0.5 + bright * .5) + prev * (0.5 - bright * .5)) * .996; prev = v; d[k] = nv; o[i] = v; }
  for (let i = 0; i < 80 && i < n; i++) o[i] *= i / 80;
  return o;
}
function bell(f, len, kind) {                               // колокольчик / маримба / музыкальная шкатулка (FM / аддитивно)
  const n = Math.round(SR * len), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR;
    if (kind === 'marimba') o[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5) + .35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 18)) * Math.min(1, t * 400);
    else if (kind === 'box') o[i] = (Math.sin(2 * Math.PI * f * t + .8 * Math.sin(2 * Math.PI * f * 3.5 * t) * Math.exp(-t * 6)) * Math.exp(-t * 3.2)) * Math.min(1, t * 600);
    else if (kind === 'flute') o[i] = (Math.sin(2 * Math.PI * f * t + .02 * Math.sin(2 * Math.PI * 5 * t) * f * .02) + .2 * Math.sin(4 * Math.PI * f * t)) * Math.min(1, t * 12) * Math.exp(-t * 1.6);
    else o[i] = (Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 4)) * Math.exp(-t * 2.4) * Math.min(1, t * 500);   // e-piano
  }
  return o;
}
function pad(fs, len) {                                     // мягкий пэд: детюн синусов + медленная атака
  const n = Math.round(SR * len), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / .6) * Math.min(1, (len - t) / .5); let s = 0;
    for (const f of fs) s += Math.sin(2 * Math.PI * f * t) + .6 * Math.sin(2 * Math.PI * f * 1.003 * t + 1) + .15 * Math.sin(4 * Math.PI * f * t);
    o[i] = s * env / fs.length; }
  return o;
}
function kick() { const n = Math.round(SR * .35), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (48 + 90 * Math.exp(-t * 30)) / SR; o[i] = Math.sin(ph) * Math.exp(-t * 9); } return o; }
function shaker() { const n = Math.round(SR * .09), o = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1, h = w - p; p = w; o[i] = h * Math.exp(-i / SR * 45) * Math.min(1, i / 60); } return o; }
function snap() { const n = Math.round(SR * .12), o = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; p = p * .5 + w * .5; o[i] = (p * .7 + Math.sin(i / SR * 2 * Math.PI * 1800) * .3) * Math.exp(-i / SR * 35); } return o; }

// --- arrangement
const scale = M.scale ?? [0, 2, 4, 7, 9];                   // мажорная пентатоника
const prog = M.prog ?? [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];   // I V vi IV
const root = M.root;
const bars = Math.ceil(DUR / bar);
// two-bar motif repeated with variation
const motif = []; for (let i = 0; i < 16; i++) motif.push(rnd() < M.density ? Math.floor(rnd() * 8) : -1);
const K = kick(), SH = shaker(), SN = snap();
for (let b = 0; b < bars; b++) {
  const t = b * bar, ch = prog[b % prog.length], intro = b < 1, outro = t > DUR - bar;
  add(t, pad(ch.map(s => hz(root + 12 + s)), bar + .4), 0, .07);
  add(t, bell(hz(root - 12 + ch[0]), bar * .9, 'marimba'), 0, .22);
  add(t + beat * 2.5, bell(hz(root - 12 + ch[0] + 7), beat, 'marimba'), 0, .12);
  for (let k = 0; k < 4; k++) {
    if (!intro && (k === 0 || (M.four && k === 2))) add(t + k * beat, K, 0, .32);
    if (!intro && k % 2 === 1 && M.snap) add(t + k * beat, SN, .1, .09);
    if (!intro) add(t + k * beat + beat / 2, SH, .35, .06);
  }
  if (outro) continue;
  for (let e = 0; e < 8; e++) {
    let deg = motif[(b % 2) * 8 + e]; if (deg < 0) continue;
    if (b % 4 === 3 && e > 4) deg = (deg + 2) % 8;            // variation at phrase end
    const oct = Math.floor(deg / scale.length), m = root + 24 + scale[deg % scale.length] + 12 * oct;
    const te = t + e * beat / 2 + (e % 2 ? M.swing ?? 0 : 0);
    const buf = M.lead === 'pluck' ? pluck(hz(m), 1.2, .55) : bell(hz(m), 1.4, M.lead);
    add(te, buf, (rnd() - .5) * .5, M.leadGain ?? .2);
  }
}
// --- simple stereo reverb (comb + allpass, Schroeder) and master
function reverb(x, combs, mix) { const y = new Float32Array(x.length);
  for (const c of combs) { const d = Math.round(c * SR), buf = new Float32Array(d); let j = 0, lp = 0;
    for (let i = 0; i < x.length; i++) { const o = buf[j]; lp = o * .6 + lp * .4; buf[j] = x[i] + lp * .78; j = (j + 1) % d; y[i] += o / combs.length; } }
  for (let i = 0; i < x.length; i++) y[i] = x[i] * (1 - mix) + y[i] * mix * 2.2; return y; }
const l2 = reverb(L, [.0297, .0371, .0411, .0437], .28), r2 = reverb(R, [.0311, .0353, .0423, .0451], .28);
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(l2[i]), Math.abs(r2[i]));
const g = .82 / peak, wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { const t = i / SR, f = Math.min(1, t / .05) * Math.min(1, (DUR - t) / .6);
  wav.writeInt16LE(Math.round(Math.tanh(l2[i] * g) * f * 32000), 44 + i * 4); wav.writeInt16LE(Math.round(Math.tanh(r2[i] * g) * f * 32000), 46 + i * 4); }
writeFileSync(resolve(OUT, `${id}.wav`), wav);
const beats = []; for (let t = 0; t < DUR; t += beat) beats.push(+t.toFixed(3));
writeFileSync(resolve(OUT, `${id}.timing.json`), JSON.stringify({ duration: DUR, bpm: M.bpm, beats, downbeats: beats.filter((_, i) => i % 4 === 0) }));
console.log(`${id}: ${DUR}s, ${M.bpm} BPM, root ${root}, lead ${M.lead}`);

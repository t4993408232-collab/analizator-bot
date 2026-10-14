// Sound as code: a tiny offline synth for node. Every instrument returns a mono Float32Array, a Mix places it
// at time t with gain/pan/reverb send, master() adds reverb, sidechain and a soft clip, wav() writes the file.
// Deterministic (seeded noise), so the same score always renders the same track.
import { writeFileSync } from 'node:fs';
export const SR = 48000;
const TAU = Math.PI * 2;
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const reseed = s => { seed = Math.max(1, Math.floor(s * 7919) % 2147483647); };
const noise = () => rnd() * 2 - 1;
const buf = d => new Float32Array(Math.max(1, Math.round(d * SR)));
export const midi = n => 440 * 2 ** ((n - 69) / 12);

// RBJ biquad; set() can be called per block for sweeps
export class Biquad {
  constructor(type, f, q = .707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) { this.q = q; const w = TAU * Math.min(f, SR * .45) / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w); let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a; this.b = [b0 / a0, b1 / a0, b2 / a0]; this.a = [-2 * c / a0, (1 - a) / a0]; return this; }
  run(x) { const y = this.b[0] * x + this.b[1] * this.x1 + this.b[2] * this.x2 - this.a[0] * this.y1 - this.a[1] * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
const filt = (a, type, f, q) => { const b = new Biquad(type, typeof f === 'number' ? f : f(0), q);
  for (let i = 0; i < a.length; i++) { if (typeof f === 'function' && i % 32 === 0) b.set(f(i / SR / (a.length / SR)), q); a[i] = b.run(a[i]); } return a; };

// ---------------- drums
export function kick(punch = 1) { const a = buf(.5); let ph = 0;
  for (let i = 0; i < a.length; i++) { const t = i / SR; ph += TAU * (44 + 120 * punch * Math.exp(-t * 30)) / SR;
    a[i] = Math.sin(ph) * Math.exp(-t * 6) * (1 + .8 * Math.exp(-t * 40)) + noise() * Math.exp(-t * 900) * .4; } return a; }
export function clap() { const a = buf(.35);
  for (let i = 0; i < a.length; i++) { const t = i / SR; let e = Math.exp(-t * 18) * .6; for (const d of [0, .011, .022]) if (t >= d) e = Math.max(e, Math.exp(-(t - d) * 160)); a[i] = noise() * e; }
  return filt(a, 'bp', 1300, .9); }
export function hat(open = false) { const a = buf(open ? .3 : .06);
  for (let i = 0; i < a.length; i++) a[i] = noise() * Math.exp(-i / SR * (open ? 14 : 70)); return filt(filt(a, 'hp', 7500, .8), 'hp', 6000, .6); }
export function crash() { const a = buf(2.2); for (let i = 0; i < a.length; i++) a[i] = noise() * Math.exp(-i / SR * 2.2); return filt(a, 'hp', 4500, .5); }

// ---------------- tonal
export function bass(f, d = .11) { const a = buf(d + .03); let ph = 0;
  for (let i = 0; i < a.length; i++) { const t = i / SR; ph += f / SR; const saw = 2 * (ph % 1) - 1;
    a[i] = (Math.sin(TAU * ph) * .8 + saw * .45) * Math.min(1, t * 400) * Math.exp(-t * 9) * (t < d ? 1 : Math.exp(-(t - d) * 120)); }
  return filt(a, 'lp', s => 200 + 1800 * Math.exp(-s * 6), 1.4); }
export function pluck(f, d = .8, bright = .5) { const a = buf(d), N = Math.round(SR / f), ring = new Float32Array(N);   // Karplus-Strong
  for (let i = 0; i < N; i++) ring[i] = noise(); let p = 0;
  for (let i = 0; i < a.length; i++) { const n = (p + 1) % N; const v = ring[p]; ring[p] = (v * (1 - bright) + (v + ring[n]) * .5 * bright) * .996; a[i] = v; p = n; }
  for (let i = 0; i < a.length; i++) a[i] *= Math.min(1, i / 40); return a; }
export function pad(fs, d, cutoff = 1400) { const a = buf(d), ph = fs.flatMap(f => [0, 0, 0].map(() => rnd()));
  for (let i = 0; i < a.length; i++) { const t = i / SR; let s = 0;
    fs.forEach((f, k) => [-.12, 0, .12].forEach((dt, j) => { const q = ph[k * 3 + j] += f * 2 ** (dt / 12) / SR; s += 2 * (q % 1) - 1; }));
    a[i] = s / (fs.length * 3) * Math.min(1, t / .4, (d - t) / .6); }
  return filt(a, 'lp', cutoff, .8); }
// bell / glass: inharmonic partials (struck glass ~ 1 : 2.76 : 5.40 : 8.93)
export function tink(f, d = 1.2, glass = true) { const a = buf(d), P = glass ? [1, 2.76, 5.4, 8.93] : [1, 2, 3.01, 4.2, 5.43], A = [1, .5, .25, .12, .06];
  for (let i = 0; i < a.length; i++) { const t = i / SR; let s = 0; P.forEach((r, k) => { s += Math.sin(TAU * f * r * t) * A[k] * Math.exp(-t * (glass ? 3 : 1.4) * (1 + k * 1.3)); });
    a[i] = s * Math.min(1, t * 2000); } return a; }

// ---------------- ASMR foley
export function key(big = false) {                                      // mechanical key: click + thock + release rattle
  const a = buf(big ? .25 : .12), fT = (big ? 120 : 170 + 70 * rnd()), rel = .045 + .03 * rnd();
  const c = buf(.12); for (let i = 0; i < c.length; i++) { const t = i / SR; c[i] = noise() * (Math.exp(-t * 1400) + (t > rel ? .35 * Math.exp(-(t - rel) * 1600) : 0)); }
  filt(c, 'bp', 3200 + 1600 * rnd(), 1.2);
  for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = Math.sin(TAU * fT * t) * Math.exp(-t * (big ? 22 : 45)) * (big ? 1.1 : .7) + (i < c.length ? c[i] * 2.2 : 0); }
  return a; }
export function crack() { const a = buf(1.6);
  for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = (rnd() < .02 * Math.exp(-t * 4) ? noise() * 3 : 0) + noise() * Math.exp(-t * 14) * .8; }
  filt(a, 'bp', 2400, .6); for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] += Math.sin(TAU * (38 + 40 * Math.exp(-t * 8)) * t) * Math.exp(-t * 3) * 1.2; } return a; }
export function whoosh(d = 1.4, up = false) { const a = buf(d); for (let i = 0; i < a.length; i++) a[i] = noise() * Math.sin(Math.PI * i / a.length) ** 2;
  return filt(a, 'bp', s => up ? 300 + 5000 * s * s : 400 + 2600 * Math.sin(Math.PI * s), 1.6); }
export function zap() { const a = buf(.3); let ph = 0;
  for (let i = 0; i < a.length; i++) { const t = i / SR; ph += (90 + 2400 * Math.exp(-t * 22)) / SR; a[i] = Math.sin(TAU * ph) * Math.exp(-t * 11); } return a; }
export function stamp() { const a = buf(.16); const p = buf(.16); for (let i = 0; i < p.length; i++) p[i] = noise() * Math.exp(-i / SR * 60); filt(p, 'bp', 1700, .7);
  for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = Math.sin(TAU * 95 * t) * Math.exp(-t * 35) + p[i] * 1.4; } return a; }
export function impact() { const a = buf(1.2), n = buf(1.2); for (let i = 0; i < n.length; i++) n[i] = noise() * Math.exp(-i / SR * 9); filt(n, 'lp', 900, .7);
  for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = Math.sin(TAU * (34 + 70 * Math.exp(-t * 14)) * t) * Math.exp(-t * 3.2) * 1.3 + n[i]; } return a; }
export function riser(d) { const a = buf(d); let ph = 0;
  for (let i = 0; i < a.length; i++) { const s = i / a.length; ph += (200 + 1400 * s * s) / SR; a[i] = noise() * s * s * .9 + Math.sin(TAU * ph) * s * s * .25; }
  return filt(a, 'bp', s => 400 + 7000 * s * s, 1.1); }
export function ticks(d, rate = 24) { const a = buf(d);                 // computer "thinking": tiny random clicks
  for (let k = 0; k < d * rate; k++) { const i0 = Math.floor(rnd() * a.length), f = 2000 + 5000 * rnd();
    for (let i = 0; i < 300 && i0 + i < a.length; i++) a[i0 + i] += Math.sin(TAU * f * i / SR) * Math.exp(-i / 40) * .6; } return a; }

// ---------------- mix
export class Mix {
  constructor(d) { this.n = Math.round(d * SR); this.L = new Float32Array(this.n); this.R = new Float32Array(this.n); this.sL = new Float32Array(this.n); this.sR = new Float32Array(this.n);
    this.duck = new Float32Array(this.n).fill(1); this.music = { L: new Float32Array(this.n), R: new Float32Array(this.n) }; }
  add(t, a, gain = 1, pan = 0, send = 0, music = false) {
    const i0 = Math.round(t * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    const L = music ? this.music.L : this.L, R = music ? this.music.R : this.R;
    for (let i = 0; i < a.length && i0 + i < this.n; i++) { if (i0 + i < 0) continue; const v = a[i];
      L[i0 + i] += v * gl; R[i0 + i] += v * gr; this.sL[i0 + i] += v * gl * send; this.sR[i0 + i] += v * gr * send; } }
  sidechain(t, depth = .65, rel = 9) { const i0 = Math.round(t * SR); for (let i = 0; i < SR && i0 + i < this.n; i++) this.duck[i0 + i] = Math.min(this.duck[i0 + i], 1 - depth * Math.exp(-i / SR * rel)); }
  master({ verb = .9, drive = 1.4, peak = .89 } = {}) {
    const rv = (x, off) => { const C = [1557, 1617, 1491, 1422].map(n => ({ b: new Float32Array(n + off), p: 0, f: 0 })), A = [556, 441].map(n => ({ b: new Float32Array(n + off), p: 0 })), y = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) { let s = 0;
        for (const c of C) { const o = c.b[c.p]; c.f = o * .75 + c.f * .25; c.b[c.p] = x[i] + c.f * .84; c.p = (c.p + 1) % c.b.length; s += o; }
        for (const a of A) { const o = a.b[a.p]; a.b[a.p] = s + o * .5; a.p = (a.p + 1) % a.b.length; s = o - s * .5; }
        y[i] = s * .25; } return y; };
    const wl = rv(this.sL, 0), wr = rv(this.sR, 23); let m = 0;
    for (let i = 0; i < this.n; i++) { for (const [D, W, M] of [[this.L, wl, this.music.L], [this.R, wr, this.music.R]]) { D[i] = Math.tanh((D[i] + M[i] * this.duck[i] + W[i] * verb) * drive) / drive; m = Math.max(m, Math.abs(D[i])); } }
    for (const D of [this.L, this.R]) for (let i = 0; i < this.n; i++) D[i] *= peak / m; return this; }
  wav(file) { const b = Buffer.alloc(44 + this.n * 4), w = (o, s) => b.write(s, o);
    w(0, 'RIFF'); b.writeUInt32LE(36 + this.n * 4, 4); w(8, 'WAVEfmt '); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
    b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); w(36, 'data'); b.writeUInt32LE(this.n * 4, 40);
    for (let i = 0; i < this.n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.R[i])) * 32767), 46 + i * 4); }
    writeFileSync(file, b); }
}

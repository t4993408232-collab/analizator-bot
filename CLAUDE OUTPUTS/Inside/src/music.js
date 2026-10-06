// Генеративный саундтрек к «Изнутри»: детерминированный синтез → 48 кГц stereo WAV.
const fs = require('fs');
const SR = 48000, DUR = 148, N = SR * DUR;
const L = new Float32Array(N), Rr = new Float32Array(N);       // dry
const SL = new Float32Array(N), SRb = new Float32Array(N);     // reverb send
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R = mulberry32(1006);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };

function polyblep(t, dt){ if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }

// ---- pad: detuned saws through a state-variable lowpass ----
function pad(t0, t1, notes, {gain = .05, cut = 900, cutMod = 400, fadeIn = 2.5, fadeOut = 2.5, pan = .35, send = .6, vib = 0} = {}){
  const s0 = Math.max(0, Math.floor((t0 - fadeIn) * SR)), s1 = Math.min(N, Math.floor((t1 + fadeOut) * SR));
  notes.forEach((m, ni) => {
    const voices = [-7, 0, 7].map(c => ({f:mtof(m) * Math.pow(2, c / 1200), ph:R(), p:(ni % 2 ? 1 : -1) * pan * (c ? Math.sign(c) : .3)}));
    let ic1 = 0, ic2 = 0, g = 0, a1 = 0, a2 = 0, a3 = 0;
    for (let i = s0; i < s1; i++) {
      const t = i / SR;
      if ((i & 31) === 0) {
        const fc = Math.min(8000, cut + cutMod * Math.sin(t * .23 + ni));
        g = Math.tan(Math.PI * fc / SR); const k = 1.2; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
      }
      const env = sstep(t0 - fadeIn, t0, t) * (1 - sstep(t1, t1 + fadeOut, t));
      let x = 0, xl = 0, xr = 0;
      for (const v of voices) {
        const f = v.f * (1 + vib * Math.sin(t * 5.1 + v.ph * 6));
        const dt = f / SR; v.ph += dt; if (v.ph >= 1) v.ph -= 1;
        const s = 2 * v.ph - 1 - polyblep(v.ph, dt);
        xl += s * (1 - v.p); xr += s * (1 + v.p); x += s;
      }
      // filter mono sum and use ratio for stereo spread (cheap)
      const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
      const y = v2 * env * gain / 3, sp = x !== 0 ? 1 : 0;
      const pl = sp ? clamp(.5 + .5 * (xl - xr) / (Math.abs(xl) + Math.abs(xr) + 1e-6), .2, .8) : .5;
      L[i] += y * pl * 2; Rr[i] += y * (1 - pl) * 2; SL[i] += y * send * pl * 2; SRb[i] += y * send * (1 - pl) * 2;
    }
  });
}
// ---- pluck: sine + octave with exp decay ----
function pluck(t, m, {gain = .12, dec = 1.4, pan = 0, send = .5, bright = .35} = {}){
  const f = mtof(m), s0 = Math.floor(t * SR), len = Math.floor(dec * 5 * SR);
  for (let i = 0; i < len && s0 + i < N; i++) {
    const tt = i / SR, a = Math.min(1, tt / .004);
    const y = a * gain * (Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt / dec) + bright * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt / (dec * .35))
      + .12 * Math.sin(6 * Math.PI * f * tt) * Math.exp(-tt / (dec * .15)));
    L[s0 + i] += y * (1 - pan) * .5 * 2; Rr[s0 + i] += y * (1 + pan) * .5 * 2;
    SL[s0 + i] += y * send * (1 - pan); SRb[s0 + i] += y * send * (1 + pan);
  }
}
function thump(t, {gain = .28} = {}){
  const s0 = Math.floor(t * SR); let ph = 0;
  for (let i = 0; i < SR * .6 && s0 + i < N; i++) { const tt = i / SR, f = 38 + 40 * Math.exp(-tt * 18); ph += f / SR;
    const y = gain * Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 6) * Math.min(1, tt / .003); L[s0 + i] += y; Rr[s0 + i] += y; }
}
function sub(t0, t1, m, gain = .1){
  const f = mtof(m);
  for (let i = Math.floor((t0 - 2) * SR); i < Math.min(N, (t1 + 2) * SR); i++) { if (i < 0) continue; const t = i / SR;
    const y = gain * Math.sin(2 * Math.PI * f * t) * sstep(t0 - 2, t0, t) * (1 - sstep(t1, t1 + 2, t)); L[i] += y; Rr[i] += y; }
}
// filtered noise "air"
{ let a = 0, b = 0;
  for (let i = 0; i < N; i++) { const t = i / SR, w = R() * 2 - 1, c = .02 + .015 * Math.sin(t * .17);
    a += c * (w - a); b += c * (a - b);
    const lvl = .05 + .07 * sstep(48, 52, t) * (1 - sstep(64, 67, t)) + .03 * sstep(86, 90, t) * (1 - sstep(104, 107, t));
    const fade = sstep(0, 2, t) * (1 - sstep(145, 148, t));
    L[i] += b * lvl * fade * 1.4; Rr[i] += (b * .7 + a * .3) * lvl * fade * 1.4; SL[i] += b * lvl * .3; SRb[i] += b * lvl * .3; } }

// ---- score ----
// S0 void: drone
pad(0, 13.5, [38, 45, 50, 57, 64], {gain:.045, cut:420, cutMod:120, fadeIn:.1, fadeOut:2});
sub(0, 14, 26, .07);
[69, 74, 76].forEach((m, k) => pluck(10.6 + k * .55, m, {gain:.11, dec:2.2, pan:(k - 1) * .5, send:.8}));
// S1/S2: arpeggios
const BEAT = 60 / 96, E8 = BEAT / 2;
pad(14, 30, [50, 53, 57, 60, 64], {gain:.05, cut:900, cutMod:400});
pad(30, 47.5, [46, 50, 53, 57, 60], {gain:.05, cut:1100, cutMod:500});
sub(14, 30, 38, .07); sub(30, 47.5, 34, .07);
function arp(t0, t1, scale, {step = E8, gain = .07, dec = .9, dens = .85, seedShift = 0} = {}){
  let k = 0;
  for (let t = t0; t < t1; t += step, k++) {
    if (R() > dens) continue;
    const m = scale[(k * 3 + Math.floor(R() * 2) + seedShift) % scale.length];
    const ramp = sstep(t0, t0 + 2, t) * (1 - sstep(t1 - 2, t1, t));
    pluck(t, m, {gain:gain * ramp * (k % 4 === 0 ? 1.25 : 1), dec, pan:Math.sin(k * 1.7) * .6, send:.55});
  }
}
arp(14.6, 30, [62, 65, 69, 72, 74, 77], {dens:.8});
arp(30, 47.5, [58, 62, 65, 69, 72, 74], {dens:.9});
for (let t = 33.5; t < 47; t += BEAT * 2) thump(t, {gain:.18});
// S3: layers — Gm9, pulse speeds up while diving
pad(48, 65.5, [43, 46, 50, 53, 57], {gain:.055, cut:700, cutMod:300});
sub(48, 65.5, 31, .09);
for (let t = 50.5, k = 0; t < 64.5; t += BEAT * (1.3 - .5 * (t - 50) / 15), k++) { thump(t, {gain:.22}); if (k % 2 === 0) pluck(t, [74, 70, 67, 65][k / 2 % 4], {gain:.05, dec:.6, send:.7}); }
// S4: choice — Fmaj7 → C/E; chimes on each pick
pad(66, 77.5, [41, 48, 53, 57, 64], {gain:.05, cut:1200, cutMod:500});
pad(77.5, 86, [40, 48, 52, 55, 62], {gain:.05, cut:1300, cutMod:500});
sub(66, 77.5, 29, .08); sub(77.5, 86, 28, .08);
[[63.2, 71.0, 72], [74.4, 78.0, 76], [80.4, 84.0, 79]].forEach(([tg, tc, m]) => {
  [0, 1, 2, 3, 4, 5, 6].forEach(i => pluck(tg + i * .14, [60, 64, 65, 67, 69, 72, 74][i] + 12, {gain:.045, dec:.7, pan:(i - 3) / 4, send:.7}));
  pluck(tc, m, {gain:.16, dec:3, send:.9}); pluck(tc, m - 12, {gain:.1, dec:3, send:.9});
});
// S5: voices — choir-ish pad with vibrato, dense arp
pad(86, 105, [46, 53, 57, 60, 64, 74], {gain:.06, cut:1500, cutMod:700, vib:.004, send:.8});
sub(86, 105, 34, .08);
arp(87, 104.5, [65, 69, 72, 74, 76, 79, 81], {step:E8 / 2, gain:.05, dec:.5, dens:.6});
// S6: doubt — sparse, unresolved
pad(106, 114, [43, 50, 53, 57], {gain:.05, cut:650, cutMod:250, vib:.002});
pad(114, 122, [39, 46, 50, 57], {gain:.05, cut:650, cutMod:250, vib:.002});
sub(106, 114, 31, .07); sub(114, 122, 27, .07);
[107.5, 110.3, 113.1, 116.4, 119.2].forEach((t, k) => pluck(t, [74, 69, 70, 74, 69][k], {gain:.09, dec:2.4, pan:k % 2 ? .4 : -.4, send:.9}));
// S7: you — warm, heartbeat
pad(122, 129, [46, 53, 58, 62, 65], {gain:.055, cut:1400, cutMod:500});
pad(129, 136, [45, 53, 57, 60, 65], {gain:.055, cut:1400, cutMod:500});
sub(122, 129, 34, .08); sub(129, 136, 33, .08);
for (let t = 124.2; t < 136.5; t += BEAT * 1.5) { thump(t, {gain:.2}); thump(t + .22, {gain:.11}); }
arp(124, 136, [65, 69, 70, 72, 74, 77], {step:E8, gain:.055, dec:1.1, dens:.7});
// S8: end — D major, fade
pad(136, 144.5, [38, 45, 50, 54, 57, 64], {gain:.055, cut:1100, cutMod:300, fadeOut:3.4});
sub(136, 144.5, 26, .07);
pluck(142.6, 74, {gain:.15, dec:3.5, send:1}); pluck(142.6, 78, {gain:.09, dec:3.5, send:1}); pluck(142.6, 81, {gain:.07, dec:3.5, send:1});

// ---- reverb (Freeverb-ish) ----
function freeverb(inp, spread){
  const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d => ({b:new Float32Array(Math.round((d + spread) * SR / 44100)), i:0, f:0}));
  const aps = [556, 441, 341, 225].map(d => ({b:new Float32Array(Math.round((d + spread) * SR / 44100)), i:0}));
  const fb = .86, damp = .3;
  for (let n = 0; n < N; n++) {
    const x = inp[n] * .015; let y = 0;
    for (const c of combs) { const o = c.b[c.i]; c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * fb; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of aps) { const o = a.b[a.i]; const v = -y + o; a.b[a.i] = y + o * .5; a.i = (a.i + 1) % a.b.length; y = v; }
    out[n] = y;
  }
  return out;
}
const WL = freeverb(SL, 0), WR = freeverb(SRb, 23);
// ping-pong delay on the wet bus for space
let peak = 0;
const OL = new Float32Array(N), OR = new Float32Array(N);
for (let n = 0; n < N; n++) {
  const fade = 1 - sstep(DUR - 3, DUR, n / SR);
  OL[n] = Math.tanh((L[n] + WL[n] * 2.2) * 1.1) * fade; OR[n] = Math.tanh((Rr[n] + WR[n] * 2.2) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(OL[n]), Math.abs(OR[n]));
}
const norm = .89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) { buf.writeInt16LE(Math.round(OL[n] * norm * 32767), 44 + n * 4); buf.writeInt16LE(Math.round(OR[n] * norm * 32767), 46 + n * 4); }
fs.writeFileSync(process.argv[2] || __dirname + '/music.wav', buf);
console.log('peak', peak.toFixed(3));

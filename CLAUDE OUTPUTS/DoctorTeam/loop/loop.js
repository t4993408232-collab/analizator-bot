// DoctorTeam promo loop, 14 s, 16:9. One particle system from the first frame to the last: a dot -> guests -> a ring
// "around people" -> the D/ mark inside the logo -> two frames -> QR codes -> back into one dot (seamless loop).
// window.frame(t) is a pure function of t; designed in 3840x2160 units, ?scale=.5 renders 1920x1080 previews.
import { loadSVG, drawSVG, samplePaths } from './logo.js';

const cfg = await (await fetch('config.json')).json(), QR = await (await fetch('assets/qr.json')).json();
const LOGO = await loadSVG('assets/doctorteam_primary_white.svg'), ICON = await loadSVG('assets/doctorteam_icon_white.svg');
const K = +(new URLSearchParams(location.search).get('scale') ?? 1), W = 3840, H = 2160, CX = W / 2, CY = H / 2, T = cfg.duration;
const cv = document.getElementById('c'); cv.width = Math.round(W * K); cv.height = Math.round(H * K);
const ctx = cv.getContext('2d'), C = cfg.colors, FONT = `"${cfg.font}", "Futura", sans-serif`;

// ---------------- math
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, s) => a + (b - a) * s;
const smooth = s => (s = clamp(s)) * s * (3 - 2 * s), outExpo = s => (s = clamp(s)) >= 1 ? 1 : 1 - 2 ** (-10 * s);
const outBack = (s, k = 1.7) => (s = clamp(s), 1 + (k + 1) * (s - 1) ** 3 + k * (s - 1) ** 2);       // ease-out with overshoot
const inOut = s => (s = clamp(s)) < .5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
const ramp = (t, a, b) => smooth((t - a) / (b - a)), win = (t, a, b, f) => ramp(t, a, a + f) * (1 - ramp(t, b - f, b));
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------- timeline (s) — matches the storyboard in the brief
const T_SPLIT = 1.0, T_RING = 2.4, T_LOGO = 3.8, T_OUT = 5.0, T_QR = 6.0, T_SEAM = 13.4;

// ---------------- layout: logo (centre), QR plates, centre mark
const LOGO_W = 1470, LOGO_X = CX - LOGO_W / 2, LOGO_Y = 980 - LOGO_W * LOGO.h / LOGO.w / 2, LOGO_S = LOGO_W / LOGO.w;
const MARK = [0, 6];                                                       // the D of DOCTOR and the slash of /TEAM = the D/ mark
const ICON_H = 190, ICON_W = ICON_H * ICON.w / ICON.h, PLATE = 860, PLATE_Y = 640, GAP = ICON_W + 2 * ICON_H;
const PLATES = [CX - GAP / 2 - PLATE, CX + GAP / 2].map((x, k) => {
  const q = QR[k], m = Math.floor(PLATE / (q.n + 8)), code = m * q.n;   // quiet zone >= 4 modules, extra margin stays white
  return { x, y: PLATE_Y, s: PLATE, m, ox: x + (PLATE - code) / 2, oy: PLATE_Y + (PLATE - code) / 2, q };
});

// ---------------- particles
const N = 720, P = [];
const STREAMS = [                                                            // guests flowing across the venue (cubic Béziers)
  [[-2200, -500], [-700, -900], [500, 300], [2200, -200]], [[-2200, 300], [-600, 700], [600, -600], [2200, 500]],
  [[-1900, -1150], [-300, -200], [300, 100], [1900, 1150]], [[-1900, 1150], [-400, 200], [400, -300], [1900, -1150]],
  [[2200, 50], [700, 450], [-500, -450], [-2200, -50]],
];
const bez = (B, u) => { const v = 1 - u; return [0, 1].map(j => v * v * v * B[0][j] + 3 * v * v * u * B[1][j] + 3 * v * u * u * B[2][j] + u * u * u * B[3][j]); };
for (let i = 0; i < N; i++) P.push({ i, h1: hash(i * 1.1), h2: hash(i * 2.3 + 5), h3: hash(i * 3.7 + 9), h4: hash(i * 5.3 + 2), d: hash(i * 7.9 + 4) * 2 - 1, k: i % STREAMS.length });
const flowAt = (p, t) => { const u = (p.h1 + (.07 + .05 * p.h2) * (t - T_SPLIT)) % 1, [x, y] = bez(STREAMS[p.k], u), off = (p.h4 - .5) * 260;
  const [x2, y2] = bez(STREAMS[p.k], Math.min(1, u + .01)), nx = -(y2 - y), ny = x2 - x, l = Math.hypot(nx, ny) || 1; return [x + nx / l * off, y + ny / l * off]; };
// ring order follows where each guest is when the ring forms, so nobody crosses the circle
[...P].sort((a, b) => Math.atan2(...flowAt(a, T_RING).reverse()) - Math.atan2(...flowAt(b, T_RING).reverse())).forEach((p, r) => { p.rank = r; });
const ringRot = t => 1.9 * (1 - Math.exp(-2.4 * Math.max(0, t - T_RING))) + .3 * Math.max(0, t - T_RING);
const ringAt = (p, t) => { const a = -Math.PI + p.rank / N * Math.PI * 2 + ringRot(t), R = 640 + (p.h4 - .5) * 90 + 18 * Math.sin(a * 3 + t * 2);
  return [Math.cos(a) * R, Math.sin(a) * R]; };
// mark points (D + /) and full-logo points, assigned by angle so the ring folds into the mark without crossings
seed = 11; const byAngle = pts => { const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  return pts.map(([x, y]) => [x - CX, y - CY, Math.atan2(y - cy, x - cx)]).sort((a, b) => a[2] - b[2]); };
const markPts = byAngle(samplePaths(LOGO, MARK, LOGO_X, LOGO_Y, LOGO_W, N, rnd));
const logoPts = samplePaths(LOGO, LOGO.paths.map((_, i) => i).filter(i => i < 11), LOGO_X, LOGO_Y, LOGO_W, N, rnd).map(([x, y]) => [x - CX, y - CY]);
const ROT = Math.round(ringRot(T_LOGO + .25) / (2 * Math.PI) * N);   // where the ring has turned to when it folds
P.forEach(p => { p.mark = markPts[((p.rank + ROT) % N + N) % N]; });
// frames: the dots split by side of the logo and settle on the perimeter of the two plates
const sorted = [...P].map((p, j) => ({ p, lp: logoPts[j] })).sort((a, b) => a.lp[0] - b.lp[0]);
sorted.forEach(({ p, lp }, j) => { p.logo = lp; p.side = j < N / 2 ? 0 : 1; });
const perim = (pl, u, m = 54) => { const x0 = pl.x - m, y0 = pl.y - m, s = pl.s + 2 * m, L = u * 4 * s % (4 * s);
  return L < s ? [x0 + L, y0] : L < 2 * s ? [x0 + s, y0 + L - s] : L < 3 * s ? [x0 + 3 * s - L, y0 + s] : [x0, y0 + 4 * s - L]; };
[0, 1].forEach(side => { const g = P.filter(p => p.side === side), pl = PLATES[side], cx = pl.x + pl.s / 2, cy = pl.y + pl.s / 2;
  g.sort((a, b) => Math.atan2(a.logo[1] + CY - cy, a.logo[0] + CX - cx) - Math.atan2(b.logo[1] + CY - cy, b.logo[0] + CX - cx))
    .forEach((p, j) => { p.u0 = (j / g.length + .875) % 1; }); });   // angle -pi = middle of the left edge
// QR modules that scatter at the seam
const MODS = []; PLATES.forEach((pl, k) => pl.q.rows.forEach((r, y) => [...r].forEach((b, x) => { if (b === '1' && hash(x * 13.1 + y * 7.7 + k) < .35) MODS.push([pl.ox + (x + .5) * pl.m - CX, pl.oy + (y + .5) * pl.m - CY, hash(x + y * 3.3 + k)]); })));
// ambient guests drifting in the margins during the QR hold (never over the codes)
const AMB = [...Array(110)].map((_, j) => ({ x: hash(j * 9.1) < .5 ? 60 + hash(j * 4.4) * 560 : W - 620 + hash(j * 4.4) * 560, y: hash(j * 6.2) * H, v: 18 + 30 * hash(j * 2.8), d: hash(j * 8.8) * 2 - 1 }));

// ---------------- dot sprites with depth of field (blur by distance from the focal plane)
const SPR = [0, 1.5, 3, 5, 8, 12].map(b => { const s = 96, c = new OffscreenCanvas(s, s), x = c.getContext('2d');
  x.filter = `blur(${b}px)`; x.fillStyle = '#fff'; x.beginPath(); x.arc(s / 2, s / 2, 14, 0, Math.PI * 2); x.fill(); return c; });
function dot(x, y, r, a, blur) { if (a <= .003 || r <= 0) return; const l = Math.min(SPR.length - 1, Math.round(blur)), s = r / 14 * 96;
  ctx.globalAlpha = Math.min(1, a) * (1 - l * .08); ctx.drawImage(SPR[l], x - s / 2, y - s / 2, s, s); }
// film grain, 4 tiles cycled by frame
const GR = [0, 1, 2, 3].map(k => { const c = new OffscreenCanvas(384, 384), x = c.getContext('2d'), im = x.createImageData(384, 384);
  for (let i = 0; i < im.data.length; i += 4) { const v = hash(i * .37 + k * 91.3) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); return ctx.createPattern(c, 'repeat'); });

// ---------------- particle state at t
function particle(p, t) {
  let x = 0, y = 0, a = p.i === 0 ? 1 : 0, r = 7, blur = 0;
  const st = T_SPLIT + p.h3 * .22;
  if (t >= T_SPLIT && t < T_SEAM) {
    const [fx, fy] = flowAt(p, t), sb = outBack((t - st) / .55, 1.3), z = 1.15 - .15 * inOut((t - T_SPLIT) / 1.4);
    x = fx * sb * z; y = fy * sb * z; a = p.i === 0 ? 1 : clamp((t - st) / .06);
    const D = ramp(t, 1.1, 1.5) * (1 - .55 * ramp(t, T_RING, T_RING + .6)); blur = Math.abs(p.d) * D * 5; r = 7 * (1 + .45 * p.d * D);
    if (t >= T_RING) { const s = outBack((t - T_RING - p.h3 * .18) / .62, 1.4), [rx, ry] = ringAt(p, t); x = lerp(x, rx, s); y = lerp(y, ry, s); }
    if (t >= T_LOGO) { const s = outBack((t - T_LOGO - p.h2 * .16) / .5, 1.15); x = lerp(x, p.mark[0], s); y = lerp(y, p.mark[1], s);
      blur *= 1 - s; r = lerp(r, 5.2, s); a *= 1 - ramp(t, 4.4, 4.62); }
    if (t >= 4.62) { const s = inOut((t - 4.62) / .3); x = lerp(p.mark[0], p.logo[0], s); y = lerp(p.mark[1], p.logo[1], s); }   // hidden under the logo
    if (t >= T_OUT) { const up = -900 * (inOut((t - T_OUT) / .6)), s = outBack((t - T_OUT - .05 - p.h3 * .15) / .62, 1.35);
      const [px, py] = perim(PLATES[p.side], p.u0 + .018 * Math.max(0, t - T_QR)); a = ramp(t, T_OUT, T_OUT + .08) * (.55 + .45 * smooth(s));
      x = lerp(p.logo[0], px - CX, s); y = lerp(p.logo[1] + up * (1 - s), py - CY, s); r = 6; blur = (1 - s) * Math.abs(p.d) * 3;
      if (t > T_QR) a *= .7 + .3 * Math.sin(t * 2.2 + p.h1 * 20); }                              // a soft shimmer, positions glide along the frame
  }
  if (t >= T_SEAM) {                                                         // seam: everything gathers into the single dot of frame 0
    const [px, py] = perim(PLATES[p.side], p.u0 + .018 * (T_SEAM - T_QR)), s = inOut((t - T_SEAM - p.h3 * .08) / .5);
    x = lerp(px - CX, 0, s); y = lerp(py - CY, 0, s); r = lerp(6, 7, s); blur = 0;
    a = p.i === 0 ? 1 : (.85) * (1 - ramp(t, 13.72, 13.93));
  }
  return [CX + x, CY + y, r, a, blur];
}
// the one dot: heartbeat (lub-dub) during the first second, identical at t = 0 and t = 14
const beat = (t, b) => { const x = (t - b) / .09; return x > 0 ? x * Math.exp(1 - x) : 0; };
const heart = t => t < T_SPLIT ? .55 * beat(t, .18) + .4 * beat(t, .42) + .25 * smooth((t - .7) / .3) : 0;

// ---------------- text
function text(s, x, y, px, { w = 500, color = C.white, a = 1, align = 'center', ls = 0 } = {}) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a); ctx.font = `${w} ${px}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${ls}px`; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore(); }
function words(t) {                                                          // 4 words x .35 s, enter with overshoot
  cfg.words.forEach((w, k) => { const s = T_SPLIT + k * .35, e = s + .35; if (t < s || t >= e) return;
    const o = outBack((t - s) / .16, 2), a = clamp((t - s) / .05) * (1 - ramp(t, e - .05, e));
    text(w, CX, CY + 60 * (1 - o), 200, { w: 500, a, ls: 2 }); });
}
function facts(t) {                                                          // three numbers in the ring, the counter rolls up
  const d = (T_LOGO - T_RING) / cfg.facts.length;
  cfg.facts.forEach((f, k) => { const s = T_RING + k * d, e = s + d; if (t < s || t >= e) return;
    const a = clamp((t - s) / .06) * (1 - ramp(t, e - .06, e)), n = Math.round(f.value * outExpo((t - s) / .32)), o = outBack((t - s) / .2, 2);
    text(`${f.prefix ?? ''}${Math.max(k === 2 ? 1 : 0, n)}${f.suffix}`, CX, CY - 40 + 30 * (1 - o), 330, { w: 600, a, ls: 4 });
    text(f.label, CX, CY + 175, 96, { w: 400, color: C.grey, a, ls: 12 }); });
}
function marquee(t) {                                                        // the slogan runs like on the site
  const a = ramp(t, 4.45, 4.75) * (1 - ramp(t, T_OUT, T_OUT + .3)); if (a <= 0) return;
  ctx.save(); ctx.font = `400 74px ${FONT}`; ctx.letterSpacing = '6px'; const w = ctx.measureText(cfg.slogan).width; ctx.restore();
  const y = LOGO_Y + LOGO.h * LOGO_S + 290 - 900 * inOut((t - T_OUT) / .6), off = (t * 420) % w;
  for (let x = -off; x < W; x += w) text(cfg.slogan, x, y, 74, { w: 400, color: C.grey, a, align: 'left', ls: 6 });
}

// ---------------- frame
window.frame = async t => {
  t = ((t % T) + T) % T;
  ctx.setTransform(K, 0, 0, K, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // grain (behind everything that must stay clean)
  ctx.globalAlpha = .035; ctx.fillStyle = GR[Math.floor(t * cfg.fps) % 4]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  // the first dot's glow
  const hb = heart(t), g0 = (1 - ramp(t, T_SPLIT, T_SPLIT + .3)) + ramp(t, 13.85, 14);
  if (g0 > 0) { const R = 160 + 220 * hb, gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, R); gr.addColorStop(0, `rgba(240,240,240,${.18 * g0 * (.6 + hb)})`); gr.addColorStop(1, 'rgba(240,240,240,0)');
    ctx.fillStyle = gr; ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R); }
  // ambient guests at the margins during the hold
  const am = ramp(t, T_QR - .2, T_QR + .5) * (1 - ramp(t, 13.1, T_SEAM));
  if (am > 0) AMB.forEach(q => dot(q.x + 14 * Math.sin(t * .6 + q.d * 9), ((q.y + q.v * t) % (H + 80)) - 40, 5 * (1 + .4 * q.d), am * .5, Math.abs(q.d) * 4));
  // the logo, built from the mark outwards; the end state is the reference SVG
  const lgA = ramp(t, 4.32, 4.6) * (1 - ramp(t, T_OUT + .05, T_OUT + .5)), up = -900 * inOut((t - T_OUT) / .6);
  if (lgA > 0) drawSVG(ctx, LOGO, LOGO_X, LOGO_Y + up, LOGO_W,
    i => MARK.includes(i) ? lgA : i < 11 ? lgA * ramp(t, 4.4 + i * .025, 4.62 + i * .025) : lgA * ramp(t, 4.6, 4.8),
    i => MARK.includes(i) || i >= 11 ? [0, 0] : [0, 26 * (1 - outBack((t - 4.4 - i * .025) / .3, 1.6))]);
  // particles
  for (const p of P) { const [x, y, r, a, b] = particle(p, t); dot(x, y, p.i === 0 ? r * (1 + 1.1 * hb) : r, a, b); }
  // QR plates: appear out of the frames 5.55-6.0, then stand perfectly still until the seam
  const qa = ramp(t, 5.5, 5.72) * (1 - ramp(t, T_SEAM, T_SEAM + .12));
  if (qa > 0) PLATES.forEach(pl => { ctx.globalAlpha = qa; ctx.fillStyle = C.plate; ctx.fillRect(pl.x, pl.y, pl.s, pl.s); ctx.fillStyle = C.code;
    const rev = t >= T_QR ? 2 : outExpo((t - 5.6) / .38) * 2;
    pl.q.rows.forEach((row, y) => { for (let x = 0; x < pl.q.n; x++) if (row[x] === '1' && (x + y) / pl.q.n < rev) ctx.fillRect(pl.ox + x * pl.m, pl.oy + y * pl.m, pl.m, pl.m); });
    ctx.globalAlpha = 1; });
  // modules scatter into dots at the seam and fly into the centre
  if (t >= T_SEAM) MODS.forEach(([mx, my, h]) => { const s = inOut((t - T_SEAM - .04 - h * .1) / .46); dot(CX + mx * (1 - s), CY + my * (1 - s), 7 * (1 - .3 * s), (1 - ramp(t, 13.7, 13.93)) * clamp((t - T_SEAM) / .05), (1 - s) * h * 2); });
  // centre mark, call to action, captions
  const ia = ramp(t, 5.7, 6.0) * (1 - ramp(t, 13.2, 13.42));
  if (ia > 0) { drawSVG(ctx, ICON, CX - ICON_W / 2, PLATE_Y + PLATE / 2 - ICON_H / 2, ICON_W, () => ia);
    text(cfg.cta, CX, 430, 112, { w: 500, a: ia, ls: 3 });
    PLATES.forEach((pl, k) => { text(cfg.qr[k].title, pl.x + pl.s / 2, 1640, 76, { w: 600, a: ia });
      text(cfg.qr[k].caption, pl.x + pl.s / 2, 1735, 54, { w: 400, color: C.grey, a: ia }); }); }
  words(t); facts(t); marquee(t);
};
await document.fonts.load(`500 100px "${cfg.font}"`).catch(() => {}); await document.fonts.load(`600 100px "${cfg.font}"`).catch(() => {}); await document.fonts.load(`400 100px "${cfg.font}"`).catch(() => {});
window.ready = true;

// "Видео без графики и монтажа — только код". 32 s, 1080x1920, picture = pure function of t.
// Story/timings live in story.js and are shared with sound.mjs, so each typed char has its click.
import { createEngine } from '../../lib/gl.js';
import { clamp, ramp, keyed, pulseAt, beatInfo, window_ } from '../../lib/time.js';
import stained from '../../scenes/stained.js';
import silk from '../../scenes/silk.js';
import tunnel from '../../scenes/tunnel.js';
import riso from '../../scenes/riso.js';
import stars from '../../scenes/stars.js';
import voidS from '../../scenes/void.js';
import { DURATION, TYPED, ENTER, SLAMS, DROP, SHATTER, OUTRO, SECTIONS, OUTRO_LINES, captionTimes, BEATS } from './story.js';

const qs = new URLSearchParams(location.search), K = +(qs.get('scale') ?? 1);
const W = Math.round(1080 * K), H = Math.round(1920 * K), FPS = 30;
const DB = BEATS.filter((_, i) => i % 4 === 0);
const glc = Object.assign(document.createElement('canvas'), { width: W, height: H });
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');
const E = createEngine(glc, W, H);
const SRC = { stained, silk, tunnel, riso, stars, void: voidS };
for (const [n, s] of Object.entries(SRC)) E.addScene(n, s);

const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace', SERIF = '"Cormorant Garamond", serif';
const ACCENT = '#e8875f', INK = '#f4ecdf';
const ctxAt = t => { const lastDown = DB.filter(d => d <= t).at(-1) ?? -9;
  return { ...beatInfo(t, BEATS), kick: t >= DROP && t < SHATTER || t >= OUTRO && t < 29 ? pulseAt(t, BEATS, 7) : pulseAt(t, SLAMS.map(s => s[0]), 5), down: pulseAt(t, DB, 2.5), wave: (t - lastDown) * .9 }; };

// uniforms per section
const U = {
  void: (t, c) => ({ uA: [.2 + .8 * ramp(t, 3.3, 3.8) + .6 * ramp(t, 6.5, 8), keyed(t, [[0, 0], [6, 0], [8, .3]]), .6, 1] }),
  stained: (t, c) => t < SHATTER - .7
    ? { uA: [c.wave, 2.4 * c.down, .5 + .9 * ramp(t, DROP, DROP + 1.2), 5], uB: [0, 0, 0, 0] }
    : { uA: [c.wave, 1.5 * c.down, 1.3, 4.5], uB: [clamp((t - SHATTER) / 1.6), 0, 0, 0] },
  silk: (t, c) => ({ uA: [1.3, keyed(t, [[12, 0], [16, .35]]), 1.15, 1.6] }),
  tunnel: (t, c) => ({ uA: [2.6 + 1.8 * ramp(t, 17, 20), 1, 1.2, .55] }),
  riso: (t, c) => ({ uA: [70, .006 + .02 * c.down, 2.4, .95] }),
  stars: (t, c) => ({ uA: [ramp(t, OUTRO, OUTRO + 1) * (1 + .15 * c.kick), keyed(t, [[OUTRO, 0], [29, .5]]) , 6, 1] }),
};
const uni = (s, t, c) => ({ uT: t, uBeat: c.kick, uBar: c.barPhase, uP: clamp((t - s.start) / (s.end - s.start)), uB: [0, 0, 0, 0], ...U[s.scene](t, c) });

// ---------------- text helpers
const font = (px, f = MONO, w = 400, it = '') => `${it} ${w} ${Math.round(px * K)}px ${f}`;
function txt(s, x, y, { px = 60, f = MONO, w = 400, it = '', color = INK, a = 1, align = 'center', glow = 0, glowColor = 'rgba(255,150,90,.8)', scale = 1, track = 0 } = {}) {
  if (a <= 0) return; o.save(); o.globalAlpha = clamp(a); o.font = font(px, f, w, it); o.textAlign = align; o.textBaseline = 'middle';
  o.letterSpacing = `${track * K}px`; o.translate(x, y); o.scale(scale, scale);
  if (glow) { o.shadowColor = glowColor; o.shadowBlur = glow * K; o.fillStyle = color; o.fillText(s, 0, 0); o.shadowBlur = 0; }
  o.fillStyle = color; o.fillText(s, 0, 0); o.restore();
}
const typedPart = (L, t) => L.text.slice(0, L.times.filter(x => x <= t).length);
const blink = t => (t * 2.2) % 1 < .55;

// 0–4: the prompt
function terminal(t) {
  const a = 1 - ramp(t, 3.7, 4.0), L = TYPED[0], s = typedPart(L, t), x0 = 90 * K, y = H * .46 - 40 * K * ramp(t, ENTER, ENTER + .25);
  o.save(); o.font = font(58, MONO, 400); const w = o.measureText(s).width; o.restore();
  txt(s, x0, y, { px: 58, align: 'left', a, glow: 14, glowColor: 'rgba(255,255,255,.25)' });
  if (t < ENTER && (blink(t) || t < L.end)) { o.globalAlpha = a; o.fillStyle = ACCENT; o.fillRect(x0 + w + 6 * K, y - 34 * K, 30 * K, 66 * K); o.globalAlpha = 1; }
  if (t >= ENTER) {
    const dots = '.'.repeat(1 + Math.floor((t - ENTER) * 6) % 3);
    txt('⏺ пишу код' + dots, x0, y + 90 * K, { px: 44, align: 'left', color: ACCENT, a: a * ramp(t, ENTER + .05, ENTER + .2) });
  }
}
// 4–7: three words slam on the beat
function slams(t) {
  SLAMS.forEach(([s, word], i) => {
    const e = (SLAMS[i + 1]?.[0] ?? 7.0) - .1; if (t < s || t >= e + .08) return;
    const k = t - s, sc = 1 + .35 * Math.exp(-k * 14), last = i === SLAMS.length - 1;
    txt(word, W / 2, H * .5, { px: last ? 120 : 104, w: 700, color: last ? ACCENT : INK, a: ramp(t, s, s + .04) * (1 - ramp(t, e, e + .08)), scale: sc, glow: last ? 40 : 18 });
  });
}
// 6.5–8.3: the real source of the scenes rains up the screen, faster and faster
const RAIN = Object.values(SRC).join('\n').split('\n').map(l => l.trim()).filter(l => l.length > 6 && !l.startsWith('//'));
function codeRain(t) {
  const a = ramp(t, 6.4, 6.9) * (1 - ramp(t, 7.9, 8.3)); if (a <= 0) return;
  const lh = 40 * K, speed = 600 * K * (t - 6.4) + 1400 * K * (t - 6.4) ** 2, off = speed % lh, first = Math.floor(speed / lh);
  o.save(); o.font = font(28, MONO); o.textBaseline = 'middle';
  for (let r = 0; r * lh < H + lh; r++) {
    const line = RAIN[(first + r) % RAIN.length], y = H - (r * lh + off), hot = (first + r) % 7 === 0;
    o.globalAlpha = a * (hot ? 1 : .7) * (.3 + .7 * Math.sin(Math.PI * clamp(y / H)));
    o.fillStyle = hot ? ACCENT : '#a9c4b4'; o.fillText(line.slice(0, 58), 50 * K, y);
  }
  o.restore();
}
// 8–26: what code makes this look
function caption(t, sec) {
  if (!sec.code) return;
  const ct = captionTimes(sec), n = ct.filter(x => x <= t).length, a = window_(t, sec.start, sec.end, .2);
  const code = sec.code.slice(0, n), y = H * .77;
  o.save(); o.font = font(46, MONO, 700); const w = o.measureText(sec.code).width + 56 * K; o.restore();
  o.save(); o.globalAlpha = a * .72; o.fillStyle = '#0b0b10'; const bx = W / 2 - w / 2, bh = 84 * K;
  o.beginPath(); o.roundRect(bx, y - bh / 2, w, bh, 18 * K); o.fill(); o.restore();
  txt(code + (n < sec.code.length || blink(t) ? '▍' : ' '), W / 2, y, { px: 46, w: 700, color: ACCENT, a });
  const la = ramp(t, ct.at(-1) + .05, ct.at(-1) + .3) * (1 - ramp(t, sec.end - .2, sec.end));
  const ink = sec.scene === 'riso';
  txt(sec.label, W / 2, y + 110 * K - 14 * K * (1 - la), { px: 92, f: SERIF, w: 600, it: 'italic', a: la, glow: ink ? 0 : 26, color: ink ? '#1d1a3a' : INK });
}
// 26–32: the claim and the sign-off
function outro(t) {
  OUTRO_LINES.forEach(([s, line], i) => {
    const last = i === OUTRO_LINES.length - 1, a = ramp(t, s, s + .25) * (1 - ramp(t, 28.9, 29.3)), sc = 1 + .2 * Math.exp(-(t - s) * 12);
    txt(line, W / 2, H * (.2 + i * .07), { px: last ? 96 : 64, f: MONO, w: last ? 700 : 400, color: last ? ACCENT : INK, a, scale: sc, glow: 20 });
  });
  const L = TYPED[1]; if (t < L.start) return;
  const s = typedPart(L, t), done = t >= L.end + .15, sc = done ? 1 + .12 * Math.exp(-(t - L.end - .15) * 8) : 1;
  txt(s + (blink(t) || !done ? '▍' : ' '), W / 2, H * .43, { px: 104, w: 700, color: INK, glow: done ? 60 : 20, scale: sc, a: 1 - ramp(t, DURATION - .8, DURATION) });
  txt('видео = код', W / 2, H * .43 - 105 * K, { px: 54, w: 700, color: ACCENT, glow: 20, a: ramp(t, L.end + .4, L.end + .8) * (1 - ramp(t, DURATION - .8, DURATION)) });
}
// render counter: the only "UI" — proves each frame is computed
function counter(t) {
  const f = Math.round(t * FPS);
  txt(`frame ${String(f).padStart(4, '0')} / ${DURATION * FPS}   t = ${t.toFixed(2)}s`, W / 2, 70 * K, { px: 26, color: '#ffffff', a: .5 * (1 - ramp(t, DURATION - .8, DURATION)), track: 2 });
}

window.frame = async t => {
  const c = ctxAt(t), k = Math.max(0, SECTIONS.findIndex(s => t >= s.start && t < s.end)), s = SECTIONS[t >= DURATION ? SECTIONS.length - 1 : k], nx = SECTIONS[SECTIONS.indexOf(s) + 1];
  const st = { a: { scene: s.scene, u: uni(s, t, c) }, post: {
    bloom: .7 + .5 * c.kick, ca: .002 + .006 * c.down + .02 * pulseAt(t, [SHATTER], 6), grain: .025, vig: .8,
    exposure: .9 * (1 - ramp(t, DURATION - .6, DURATION)), flash: .35 * pulseAt(t, [DROP, SHATTER], 5) } };
  if (nx && s.tr && t > s.end - s.tr[1]) { st.b = { scene: nx.scene, u: uni(nx, t, c) }; st.trans = { kind: s.tr[0], m: clamp((t - (s.end - s.tr[1])) / s.tr[1]) }; }
  E.render(st);
  // camera punch on the kick: the whole picture breathes 1-2 % on the beat
  const z = 1 + .018 * c.kick + .05 * pulseAt(t, [DROP, SHATTER], 4);
  o.fillStyle = '#000'; o.fillRect(0, 0, W, H);
  o.drawImage(glc, W * (1 - z) / 2, H * (1 - z) / 2, W * z, H * z);
  if (t < 4.1) terminal(t);
  slams(t); codeRain(t);
  if (t >= DROP && t < OUTRO) caption(t, s);
  if (t >= OUTRO - .1) outro(t);
  counter(t);
};
await Promise.all([document.fonts.load(font(40, SERIF, 600, 'italic')), document.fonts.load(font(40, MONO, 700)), document.fonts.load(font(40, MONO, 400))]).catch(() => {});
window.ready = true;

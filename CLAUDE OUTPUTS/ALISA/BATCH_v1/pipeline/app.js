// Ролик @ailisa.ai.daily: шейдерный фон из Code-Video kit (lib/gl.js + тёплые сцены) + Canvas2D-иллюстрации и кинетический текст.
// Кадр — чистая функция времени: window.frame(t). Ролик выбирается параметром ?v=<id>, обложка — window.cover().
import { createEngine } from './lib/gl.js';
import { clamp, ramp, keyed, pulseAt, beatInfo, sectionAt, window_ } from './lib/time.js';
import riso from './scenes/riso_warm.js';
import silk from './scenes/silk_warm.js';
import stained from './scenes/stained_warm.js';
import { VIDEOS } from './videos.js';
import { ILLOS, C, ink, rr, el, poly, badge } from './illos.js';

const qs = new URLSearchParams(location.search), SCALE = +(qs.get('scale') ?? 1), V = VIDEOS.find(v => v.id === qs.get('v')) ?? VIDEOS[0];
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE), GLS = .5;           // фон мягкий — считаем его в половинном разрешении
const timing = await (await fetch(`out/${V.id}.timing.json`)).json();
const BEATS = timing.beats, DB = timing.downbeats, DUR = V.duration;
const qb = x => BEATS.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a, BEATS[0]);   // событие — на ближайшую долю

const glc = Object.assign(document.createElement('canvas'), { width: Math.round(W * GLS), height: Math.round(H * GLS) });
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');
const E = createEngine(glc, glc.width, glc.height);
for (const [n, s] of Object.entries({ riso, silk, stained })) E.addScene(n, s);

// ---------- timeline (seconds, snapped to the beat grid of this track)
const T = { sit: 1.5, sit2: qb(3.6), photo: qb(6), flash: qb(7.6), ask: qb(8.6), ans: qb(13.8), res: qb(21.6), sum: 24, save: 29.2, loop: DUR - .45 };
const ink2 = V.ink;
const S = [
  { name: 'riso', start: 0, end: T.sit, tr: [0, .3], u: (t, c) => ({ uA: [56, .004 + .01 * c.down, .7, .75], uB: ink2 }) },
  { name: 'stained', start: T.sit, end: T.photo, tr: [1, .8], u: (t, c) => ({ uA: [c.wave, 1.4 * c.down, 1, 3.2], uB: [0, 0, 0, 0] }) },
  { name: 'riso', start: T.photo, end: T.sum, tr: [2, .7], u: (t, c) => ({ uA: [48, .003 + .008 * c.down, .45, .45], uB: ink2 }) },
  { name: 'silk', start: T.sum, end: T.save, tr: [0, .5], u: (t, c) => ({ uA: [.6, .45, 1, 1.4], uB: [0, 0, 0, 0] }) },
  { name: 'riso', start: T.save, end: DUR + 1, u: (t, c) => ({ uA: [56, .004 + .01 * c.down, .7, .75], uB: ink2 }) },
];
function ctxAt(t) { const b = beatInfo(t, BEATS), lastDown = DB.filter(d => d <= t).at(-1) ?? -9;
  return { ...b, kick: pulseAt(t, BEATS, 7), down: pulseAt(t, DB, 3), wave: (t - lastDown) * .8 }; }
const uni = (s, t, c) => ({ uT: t, uBeat: c.kick, uBar: c.barPhase, uP: sectionAt(t, S).p, ...s.u(t, c) });

// ---------- text
const F = (size, w = 900) => `${w} ${size}px Nunito`;
function wrap(text, size, w, maxW) { o.font = F(size, w); const lines = [];
  for (const para of text.split('\n')) { let cur = '';
    for (const word of para.split(' ')) { const nx = cur ? cur + ' ' + word : word; if (o.measureText(nx).width > maxW && cur) { lines.push(cur); cur = word; } else cur = nx; }
    lines.push(cur); }
  return lines; }
// крупная подпись: слова выпрыгивают по очереди, под строкой — маркер-подложка со сдвигом краски
function caption(text, t, t0, t1, y, { size = 92, maxW = 940, hl = C.butter, col = C.ink, k = 0, stagger = .08 } = {}) {
  if (t < t0 - .05 || t > t1 + .05) return 0;
  const lines = wrap(text, size, 900, maxW), lh = size * 1.14, fade = 1 - ramp(t, t1 - .25, t1);
  let wi = 0;
  lines.forEach((ln, li) => { o.font = F(size); const lw = o.measureText(ln).width, yy = y + li * lh, a0 = ramp(t, t0 + wi * stagger, t0 + wi * stagger + .25);
    const PA = o.globalAlpha; o.save(); o.globalAlpha = PA * fade * a0; o.translate(540, yy); o.rotate((li % 2 ? .012 : -.01)); o.scale(1 + .015 * k, 1 + .015 * k);
    o.fillStyle = hl; o.globalAlpha *= .92; o.fill(rr(-lw / 2 - 26, -size * .58, lw + 52, size * 1.08, size * .3));
    o.globalAlpha = PA * fade * a0 * .5; o.strokeStyle = C.ink; o.lineWidth = 3; o.stroke(rr(-lw / 2 - 22, -size * .55, lw + 52, size * 1.08, size * .3));
    o.restore();
    let x = 540 - lw / 2;
    for (const word of ln.split(' ')) { const s = t0 + wi * stagger, a = ramp(t, s, s + .22), pop = 1 + .25 * (1 - ramp(t, s, s + .3)) * a, ww = o.measureText(word + ' ').width;
      o.save(); o.globalAlpha = PA * fade * a; o.translate(x + o.measureText(word).width / 2, yy + 10 * (1 - a)); o.scale(pop, pop); o.rotate(li % 2 ? .012 : -.01);
      o.font = F(size); o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = col; o.fillText(word, 0, 2); o.restore();
      x += ww; wi++; }
  });
  return lines.length * lh;
}
const textAt = (s, x, y, size, col = C.ink, w = 800, align = 'left') => { o.font = F(size, w); o.fillStyle = col; o.textAlign = align; o.textBaseline = 'middle'; o.fillText(s, x, y); };

// ---------- illustration, result card, phone
function illo(t, k, x, y, s, st = {}) { o.save(); o.translate(x, y); o.scale(s, s); ILLOS[V.illo](o, t, k, st); o.restore(); }
const healed = { heal: 1, clean: 1 };
function resultComp(t, t0, top, k, a = 1) {
  if (a <= 0) return; o.save(); o.globalAlpha *= a;
  const p = t0 < -1 ? 1 : ramp(t, t0, t0 + .35), sc = .86 + .14 * p + .012 * k;
  o.translate(540, top + 470); o.scale(sc, sc); o.translate(-540, -(top + 470)); o.globalAlpha *= p;
  illo(t, k, 540, top + 160, .5, healed);
  const cy = top + 330, cw = 900, ch = 560, cx = 90;
  ink(o, rr(cx, cy, cw, ch, 44), C.paper, { shade: .25, dir: [18, 14] });
  textAt(V.result.title, 540, cy + 72, 58, C.ink, 900, 'center');
  o.fillStyle = C.peach; o.fill(rr(380, cy + 112, 320, 8, 4));
  V.result.rows.forEach(([g, txt, sub], i) => { const ry = cy + 200 + i * 140, ra = t0 < -1 ? 1 : ramp(t, t0 + .2 + i * .15, t0 + .45 + i * .15);
    o.save(); o.globalAlpha *= ra; o.translate(30 * (1 - ra), 0);
    badge(o, cx + 82, ry, 44, g, g === '✗' ? C.coral : g === '!' ? C.coral : i % 2 ? C.sageD : C.terra);
    textAt(txt, cx + 150, ry - 22, 48, C.ink, 900); textAt(sub, cx + 150, ry + 30, 38, '#8a6a55', 700);
    o.restore(); });
  o.restore();
}
let HS = 0;   // размер хука: считается после загрузки шрифтов, максимум 3 строки
function hookComp(t, k, a = 1, t0 = -9) {
  o.save(); o.globalAlpha *= a; caption(V.hook, t, t0, 1e9, 170, { size: HS, maxW: 960, k, stagger: t0 < -1 ? 0 : .05 }); o.restore();
  resultComp(t, t0, 520, k, a);
}

const PH = { x: 150, y: 470, w: 780, h: 975 };
function phoneFrame(dy, a) {
  o.save(); o.globalAlpha *= a; o.translate(0, dy);
  ink(o, rr(PH.x, PH.y, PH.w, PH.h, 78), '#5a4034', { shade: .3, dir: [20, 16], lw: 6 });
  o.fillStyle = '#fbf2e3'; o.fill(rr(PH.x + 20, PH.y + 20, PH.w - 40, PH.h - 40, 60));
  o.fillStyle = '#5a4034'; o.fill(rr(540 - 70, PH.y + 30, 140, 30, 15));
  o.restore();
}
const screen = () => { const p = new Path2D(); p.roundRect(PH.x + 20, PH.y + 20, PH.w - 40, PH.h - 40, 60); return p; };

function camera(t, k, dy) {
  o.save(); o.translate(0, dy); o.clip(screen());
  o.fillStyle = '#f3e3cc'; o.fillRect(PH.x, PH.y, PH.w, PH.h);
  illo(t, k, 540, 920, 1.0);
  const z = 1 - .04 * ramp(t, T.flash - .4, T.flash);
  o.strokeStyle = C.paper; o.lineWidth = 10; o.lineCap = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = 540 + sx * 300 * z, cy = 930 + sy * 360 * z; o.beginPath(); o.moveTo(cx, cy - sy * 70); o.lineTo(cx, cy); o.lineTo(cx - sx * 70, cy); o.stroke(); }
  ink(o, el(540, 1360, 46, 46), C.paper, { shade: 0, lw: 6 }); o.fillStyle = C.coral; o.fill(el(540, 1360, 32 - 6 * pulseAt(t, [T.flash], 6), 32 - 6 * pulseAt(t, [T.flash], 6)));
  o.restore();
}

function bubble(x, y, w, h, user) { ink(o, rr(x, y, w, h, 34), user ? '#f9cdb2' : '#fffdf8', { shade: .18, dir: [10, 8], lw: 4 }); }
function chat(t, k, dy) {
  o.save(); o.translate(0, dy); o.clip(screen());
  o.fillStyle = '#fbf2e3'; o.fillRect(PH.x, PH.y, PH.w, PH.h);
  const L = PH.x + 50, R = PH.x + PH.w - 50, top0 = PH.y + 130, bottom = PH.y + PH.h - 40;
  // messages layout (fixed sizes, so nothing jumps)
  const FS = 40, LH = 52, pad = 26, maxW = 560;
  const pl = wrap(V.prompt, FS, 800, maxW), pw = Math.min(maxW, Math.max(...pl.map(l => (o.font = F(FS, 800), o.measureText(l).width)))) + pad * 2, phh = pl.length * LH + pad * 2 - 6;
  const al = V.answer.map((s, i) => wrap(s, FS, i ? 900 : 800, 600)), ah = al.reduce((s, l) => s + l.length, 0) * LH + (al.length - 1) * 10 + pad * 2;
  const m1 = 0, m2 = V.noPhoto ? 0 : m1 + 300 + 24, m3 = m2 + phh + 24;
  const s1 = Math.max(0, m2 + phh - (bottom - top0)), s2 = Math.max(0, m3 + ah - (bottom - top0));
  const scroll = s1 * ramp(t, T.ask + .2, T.ask + 1) + (s2 - s1) * ramp(t, T.ans, T.ans + .8);
  o.save(); o.translate(0, top0 - scroll);
  // m1: photo
  const pa = V.noPhoto ? 0 : ramp(t, T.ask - .1, T.ask + .3); o.save(); o.globalAlpha *= pa; o.translate(R - 330 + 40 * (1 - pa), m1);
  bubble(0, 0, 330, 290, true); o.save(); o.clip(rr(14, 14, 302, 262, 24)); o.fillStyle = '#f3e3cc'; o.fillRect(0, 0, 330, 290); illo(t, 0, 165, 150, .42); o.restore(); o.restore();
  // m2: prompt, typed
  const ta = ramp(t, T.ask + .4, T.ask + .6); if (ta > 0) { o.save(); o.globalAlpha *= ta; bubble(R - pw, m2, pw, phh, true);
    const total = V.prompt.length, shown = Math.floor(total * clamp((t - T.ask - .5) / 2.6)); let n = 0;
    pl.forEach((ln, i) => { const part = ln.slice(0, clamp(shown - n, 0, ln.length)); n += ln.length + 1; textAt(part, R - pw + pad, m2 + pad + LH / 2 + i * LH - 3, FS, C.ink, 800); });
    o.restore(); }
  // m3: answer (typing dots, then lines)
  if (t > T.ans - .1) { const aa = ramp(t, T.ans - .1, T.ans + .2), dotsEnd = T.ans + .8; o.save(); o.globalAlpha *= aa;
    textAt('ИИ', L + 6, m3 - 4, 26, C.sageD, 900);
    if (t < dotsEnd) { bubble(L, m3 + 14, 170, 80, false); for (let i = 0; i < 3; i++) { o.fillStyle = C.sageD; const b = Math.sin(t * 9 - i) * 6; o.fill(el(L + 50 + i * 36, m3 + 54 + b, 10, 10)); } }
    else { bubble(L, m3 + 14, 680, ah, false); let y = m3 + 14 + pad + LH / 2 - 3, wcount = 0;
      al.forEach((lines, i) => { const st = dotsEnd + wcount * .3, a = ramp(t, st, st + .3); wcount += V.answer[i].split(' ').length;
        lines.forEach(ln => { o.save(); o.globalAlpha *= a; const bad = ln.startsWith('✗');
          textAt(ln, L + pad + 8 * (1 - a), y, FS, bad ? '#c4553f' : i ? '#3f5f3e' : C.ink, i ? 900 : 800); o.restore(); y += LH; });
        y += 10; }); }
    o.restore(); }
  o.restore();
  if (t < T.ask + .4) { o.save(); o.globalAlpha *= 1 - ramp(t, T.ask, T.ask + .4);                      // пустой чат: поле ввода с курсором
    ink(o, rr(L, bottom - 110, R - L, 84, 42), C.paper, { shade: 0, lw: 4 }); textAt('Сообщение…', L + 36, bottom - 68, 36, '#b59a85', 800);
    if (Math.floor(t * 2.4) % 2 === 0) { o.fillStyle = C.ink; o.fillRect(L + 34, bottom - 92, 4, 48); }
    illo(t, k, 540, PH.y + 470, .62); o.restore(); }
  // header
  o.fillStyle = '#f4e6d0'; o.fillRect(PH.x, PH.y, PH.w, 120); ink(o, el(PH.x + 92, PH.y + 85, 24, 24), C.sage, { shade: 0, lw: 3 });
  textAt('Чат с ИИ', PH.x + 132, PH.y + 86, 36, C.ink, 900); o.fillStyle = 'rgba(74,52,40,.15)'; o.fillRect(PH.x, PH.y + 120, PH.w, 3);
  o.restore();
}

function promptCard(t, t0, k) {
  const a = ramp(t, t0, t0 + .4), lines = wrap(V.save, 56, 800, 790), h = 150 + lines.length * 72 + 50, y0 = 1010 - h / 2 + 60;
  o.save(); o.globalAlpha *= a * (1 - ramp(t, T.save - .2, T.save)); o.translate(540, y0 + h / 2); o.rotate(-.015); o.scale(.9 + .1 * a + .01 * k, .9 + .1 * a + .01 * k); o.translate(-540, -(y0 + h / 2));
  ink(o, rr(80, y0, 920, h, 36), C.paper, { shade: .25, dir: [18, 14] });
  o.save(); o.globalAlpha *= .75; o.fillStyle = C.butter; o.translate(540, y0); o.rotate(.03); o.fillRect(-90, -24, 180, 48); o.restore();
  textAt('Промпт:', 140, y0 + 92, 54, C.coral, 900);
  ink(o, rr(856, y0 + 60, 50, 60, 10), C.cream, { shade: 0, lw: 4 }); ink(o, rr(876, y0 + 76, 50, 60, 10), C.cream, { shade: 0, lw: 4 });   // «скопировать»
  lines.forEach((ln, i) => { const la = ramp(t, t0 + .3 + i * .25, t0 + .6 + i * .25); o.save(); o.globalAlpha *= la; textAt(ln, 140, y0 + 180 + i * 72, 56, C.ink, 800); o.restore(); });
  o.restore();
}

function finale(t, k) {
  const t0 = T.save;
  const ba = ramp(t, t0, t0 + .35);                                   // bookmark glyph
  o.save(); o.globalAlpha *= ba; o.translate(540, 250 - 14 * pulseAt(t, DB, 4)); o.scale(.7 + .3 * ba, .7 + .3 * ba);
  ink(o, poly([-55, -80], [55, -80], [55, 80], [0, 45], [-55, 80]), C.coral, { shade: .3 }); o.restore();
  caption('Сохрани, чтобы не потерять', t, t0 + .1, DUR, 430, { size: 100, k, hl: C.butter });
  const sa = ramp(t, t0 + .7, t0 + 1.1), lines = wrap(V.share, 62, 900, 800), h = lines.length * 80 + 90, y0 = 760;
  o.save(); o.globalAlpha *= sa; o.translate(540, y0 + h / 2); o.scale(.9 + .1 * sa, .9 + .1 * sa); o.translate(-540, -(y0 + h / 2));
  ink(o, rr(110, y0, 860, h, 48), '#f9cdb2', { shade: .25 }); ink(o, poly([230, y0 + h - 4], [210, y0 + h + 60], [300, y0 + h - 4]), '#f9cdb2', { shade: 0, lw: 4 });
  lines.forEach((ln, i) => textAt(ln, 540, y0 + 82 + i * 80, 62, C.ink, 900, 'center'));
  o.restore();
  illo(t, k, 540, 1250 - 10 * k, .42, healed);
}

// ---------- frame
window.frame = async t => {
  const c = ctxAt(t), i = S.findIndex(s => t >= s.start && t < s.end), kx = i < 0 ? S.length - 1 : i, s = S[kx], nx = S[kx + 1];
  const state = { a: { scene: s.name, u: uni(s, t, c) }, post: { bloom: .12, ca: .0006 + .0012 * c.down, grain: .03, vig: .22, exposure: 1, tonemap: 0,
    flash: .55 * pulseAt(t, [T.flash], 5) } };
  if (nx && s.tr && t > s.end - s.tr[1]) { state.b = { scene: nx.name, u: uni(nx, t, c) }; state.trans = { kind: s.tr[0], m: clamp((t - (s.end - s.tr[1])) / s.tr[1]) }; }
  E.render(state);
  o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(glc, 0, 0, W, H); o.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const k = c.kick;
  if (t < T.sit) hookComp(t, k, 1 - ramp(t, T.sit - .2, T.sit));
  else if (t < T.photo + .6) {                                        // ситуация
    const out = ramp(t, T.photo, T.photo + .5);
    illo(t, k, 540, 1000 + 240 * out, 1.22 - .2 * out, {});
    caption(V.situation[0], t, T.sit, T.photo, 210, { k, hl: C.butter });
    caption(V.situation[1], t, T.sit2, T.photo, 210 + wrap(V.situation[0], 92, 900, 940).length * 105 + 40, { k, hl: '#f9cdb2', size: 84 });
  }
  if (t >= T.photo && t < T.res + .6) {                               // демонстрация
    const dy = (1 - ramp(t, T.photo, T.photo + .6)) * 1500 + ramp(t, T.res, T.res + .5) * 1500;
    phoneFrame(dy, 1);
    if (t < T.ask && !V.noPhoto) camera(t, k, dy); else chat(t, k, dy);
    caption(V.step1, t, T.photo + .2, T.ask, 260, { k });
    caption('Спроси ИИ', t, T.ask, T.ans, 260, { k, hl: '#f9cdb2' });
    caption('Ответ за секунды', t, T.ans, T.res, 260, { k, hl: '#cfe0c4' });
  }
  if (t >= T.res && t < T.sum) { caption('Готово!', t, T.res + .2, T.sum, 300, { k, size: 110 }); resultComp(t, T.res + .3, 470, k, 1 - ramp(t, T.sum - .25, T.sum)); }
  if (t >= T.sum && t < T.save) { caption('И всё это — за минуту', t, T.sum + .1, T.save, 230, { k, size: 96 }); promptCard(t, T.sum + .6, k); }
  if (t >= T.save) { const la = ramp(t, T.loop, DUR - .05); o.save(); o.globalAlpha *= 1 - la; finale(t, k); o.restore();
    if (la > 0) { o.save(); o.globalAlpha *= la; o.fillStyle = 'rgba(253,246,234,.6)'; o.fillRect(0, 0, 1080, 1920); o.restore(); hookComp(t, k, la); } }
};

// ---------- cover: 3–5 words + illustration
window.cover = async () => {
  const c = ctxAt(0); E.render({ a: { scene: 'riso', u: uni(S[0], 2.2, c) }, post: { bloom: .1, ca: .001, grain: .03, vig: .2, exposure: 1, tonemap: 0, flash: 0 } });
  o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(glc, 0, 0, W, H); o.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  let cs = 132; o.font = F(cs); const fits = () => { const L = wrap(V.cover, cs, 900, 880); return L.length <= 3 && L.every(l => (o.font = F(cs), o.measureText(l).width <= 880)); };
  while (!fits() && cs > 80) cs -= 4;
  const tb = 250 + wrap(V.cover, cs, 900, 880).length * cs * 1.14;
  caption(V.cover, 5, 0, 1e9, 250, { size: cs, maxW: 880 });
  const sc = Math.min(1.2, (1560 - tb) / 640); illo(1.0, 0, 540, tb + 30 + 300 * sc, sc, {});
  o.save(); o.translate(540, 1640); o.rotate(-.02); ink(o, rr(-250, -48, 500, 96, 48), C.paper, { shade: .2 }); textAt('@ailisa.ai.daily', 0, 2, 44, C.ink, 900, 'center'); o.restore();
};

for (const w of [600, 800, 900]) for (const sub of ['latin', 'cyrillic']) {
  const f = new FontFace('Nunito', `url(fonts/nunito-${sub}-${w}-normal.woff2)`, { weight: String(w), unicodeRange: sub === 'latin' ? 'U+0000-00FF,U+2000-206F,U+20BD,U+2713,U+2717' : 'U+0400-04FF' });
  document.fonts.add(await f.load());
}
HS = 104; while (wrap(V.hook, HS, 900, 960).length > 3 && HS > 70) HS -= 4;
window.ready = true;

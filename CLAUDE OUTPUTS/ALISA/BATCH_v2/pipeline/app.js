// Ролик @ailisa.ai.daily, партия v2: шейдерный фон из Code-Video kit (lib/gl.js + тёплые сцены) + Canvas2D-иллюстрации и кинетический текст.
// Каркас 38 с: хук + результат → «обычно так» → Шаг 1/2/3 в телефоне (что вводим → что получаем) → результат → схема → репост и кольцо на хук.
// Кадр — чистая функция времени: window.frame(t). Ролик выбирается параметром ?v=<id>, обложка — window.cover().
import { createEngine } from './lib/gl.js';
import { clamp, ramp, pulseAt, beatInfo, sectionAt } from './lib/time.js';
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
const ST = [qb(5), qb(13.33), qb(21.66)];
const T = { pain: 1.5, pain2: qb(3.1), step: ST, res: qb(30), scheme: qb(33), share: qb(35.6), loop: DUR - .45 };
const stepEnd = i => i < 2 ? ST[i + 1] : T.res;
const ink2 = V.ink;
const S = [
  { name: 'riso', start: 0, end: T.pain, tr: [0, .3], u: (t, c) => ({ uA: [56, .004 + .01 * c.down, .7, .75], uB: ink2 }) },
  { name: 'stained', start: T.pain, end: ST[0], tr: [1, .8], u: (t, c) => ({ uA: [c.wave, 1.4 * c.down, 1, 3.2], uB: [0, 0, 0, 0] }) },
  { name: 'riso', start: ST[0], end: T.res, tr: [2, .7], u: (t, c) => ({ uA: [48, .003 + .008 * c.down, .45, .45], uB: ink2 }) },
  { name: 'silk', start: T.res, end: T.share, tr: [0, .5], u: (t, c) => ({ uA: [.6, .45, 1, 1.4], uB: [0, 0, 0, 0] }) },
  { name: 'riso', start: T.share, end: DUR + 1, u: (t, c) => ({ uA: [56, .004 + .01 * c.down, .7, .75], uB: ink2 }) },
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
const healed = { heal: 1 };
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

// ---------- phone with the chain of steps
const PH = { x: 140, y: 440, w: 800, h: 990 };                       // низ телефона — 1430 px, выше линии 75 % (1440)
function phoneFrame(dy) {
  o.save(); o.translate(0, dy);
  ink(o, rr(PH.x, PH.y, PH.w, PH.h, 78), '#5a4034', { shade: .3, dir: [20, 16], lw: 6 });
  o.fillStyle = '#fbf2e3'; o.fill(rr(PH.x + 20, PH.y + 20, PH.w - 40, PH.h - 40, 60));
  o.restore();
}
const screen = () => rr(PH.x + 20, PH.y + 20, PH.w - 40, PH.h - 40, 60);
function bubble(x, y, w, h, user) { ink(o, rr(x, y, w, h, 34), user ? '#f9cdb2' : '#fffdf8', { shade: .18, dir: [10, 8], lw: 4 }); }
const FS = 38, LH = 52, PAD = 26, BW = 720;                          // шрифт и ширина облачков в телефоне

// what the AI returns on a step: height + drawing, p = reveal progress 0..1
const OUT = {
  lines: { h: q => q.lines.reduce((s, l) => s + wrap(l, FS, 900, BW - 70).length, 0) * LH + PAD * 2,
    draw(q, x, y, p) { let yy = y + PAD + LH / 2 - 3;
      q.lines.forEach((s, i) => { const a = ramp(p, i / q.lines.length * .8, i / q.lines.length * .8 + .25);
        for (const ln of wrap(s, FS, 900, BW - 70)) { o.save(); o.globalAlpha *= a; textAt(ln, x + PAD + 8 * (1 - a), yy, FS, i ? '#3f5f3e' : C.ink, i ? 900 : 800); o.restore(); yy += LH; } }); } },
  pie: { h: () => 400,
    draw(q, x, y, p) { const cx = x + 175, cy = y + 200, cols = [C.coral, C.butter, C.terra, C.sage, C.sky]; let a0 = -Math.PI / 2;
      q.parts.forEach(([n, v], i) => { const a1 = a0 + v / 100 * Math.PI * 2, e = a0 + (a1 - a0) * clamp(p * 1.6 - i * .12), s = new Path2D();
        if (e > a0) { s.moveTo(cx, cy); s.arc(cx, cy, 150, a0, e); s.closePath(); ink(o, s, cols[i], { shade: .25, lw: 3 }); } a0 = a1; });
      ink(o, el(cx, cy, 62, 62), '#fffdf8', { shade: 0, lw: 3 }); textAt('₽', cx, cy + 2, 46, C.ink, 900, 'center');
      q.parts.forEach(([n, v, sum], i) => { const a = ramp(p, .2 + i * .1, .45 + i * .1), ry = y + 62 + i * 70; o.save(); o.globalAlpha *= a;
        o.fillStyle = cols[i]; o.fill(el(x + 372, ry, 15, 15)); textAt(n, x + 398, ry, 34, C.ink, 800); textAt(v + '%', x + BW - 26, ry, 36, C.ink, 900, 'right'); o.restore(); }); } },
  table: { h: q => 36 + (q.rows.length + 1) * 72,
    draw(q, x, y, p) { const rh = 72, x0 = x + 18, x1 = x + BW - 18;
      o.save(); o.fillStyle = 'rgba(246,207,98,.75)'; o.fill(rr(x0, y + 18, x1 - x0, rh - 6, 16)); o.restore();
      textAt(q.head[0], x0 + 20, y + 18 + rh / 2 - 4, 32, C.ink, 900); textAt(q.head[1], x1 - 20, y + 18 + rh / 2 - 4, 32, C.ink, 900, 'right');
      q.rows.forEach((r, i) => { const a = ramp(p, i * .18, i * .18 + .3), ry = y + 18 + (i + 1) * rh, last = i === q.rows.length - 1; o.save(); o.globalAlpha *= a;
        if (last) { o.fillStyle = 'rgba(233,120,95,.18)'; o.fill(rr(x0, ry + 2, x1 - x0, rh - 8, 16)); } else { o.fillStyle = 'rgba(74,52,40,.12)'; o.fillRect(x0 + 10, ry + rh - 4, x1 - x0 - 20, 2); }
        textAt(r[0], x0 + 20 + 14 * (1 - a), ry + rh / 2 - 2, 36, C.ink, last ? 900 : 800); textAt(r[1], x1 - 20, ry + rh / 2 - 2, 36, last ? '#c4553f' : '#3f5f3e', 900, 'right'); o.restore(); }); } },
  image: { h: () => 430,
    draw(q, x, y, p, t, k) { const a = ramp(p, 0, .5); o.save(); o.globalAlpha *= a; o.save(); o.clip(rr(x + 18, y + 18, BW - 36, 394, 26));
      o.fillStyle = '#f3e3cc'; o.fillRect(x, y, BW, 430); o.translate(x + BW / 2, y + 215); const s = .62 * (1.06 - .06 * ramp(p, 0, 1)); o.scale(s, s);
      ILLOS[q.illo](o, t, k, { heal: q.heal }); o.restore();
      const sw = ramp(p, .1, .9); o.save(); o.clip(rr(x + 18, y + 18, BW - 36, 394, 26)); o.globalAlpha *= .35 * Math.sin(sw * Math.PI); o.fillStyle = '#fff';   // блик «проявки»
      o.fill(poly([x + sw * BW * 1.4 - 160, y], [x + sw * BW * 1.4 - 60, y], [x + sw * BW * 1.4 - 220, y + 430], [x + sw * BW * 1.4 - 320, y + 430])); o.restore(); o.restore(); } },
  song: { h: () => 300,
    draw(q, x, y, p, t, k) { const a = ramp(p, 0, .4); o.save(); o.globalAlpha *= a;
      ink(o, el(x + 100, y + 105, 58, 58), C.coral, { shade: .3, lw: 4 }); o.fillStyle = C.paper; o.fill(poly([x + 82, y + 75], [x + 82, y + 135], [x + 130, y + 105]));
      textAt(q.title, x + 190, y + 82, 46, C.ink, 900); textAt('песня · ' + q.len, x + 190, y + 134, 32, '#8a6a55', 800);
      const n = 34, play = clamp((p - .5) * 1.2); for (let i = 0; i < n; i++) { const bx = x + 44 + i * 19, hh = 14 + 46 * Math.abs(Math.sin(i * 1.7 + 1) * Math.sin(i * .37 + 2)) * (1 + .35 * k * (i / n < play ? 1 : 0)) * ramp(p, i / n * .5, i / n * .5 + .2);
        o.fillStyle = i / n < play ? C.coral : C.grey; o.fill(rr(bx, y + 222 - hh / 2, 11, hh, 5)); } o.restore(); } },
  links: { h: q => 30 + q.rows.length * 82,
    draw(q, x, y, p) { q.rows.forEach(([s, pr], i) => { const a = ramp(p, i * .18, i * .18 + .3), ry = y + 56 + i * 82, last = i === q.rows.length - 1; o.save(); o.globalAlpha *= a;
      if (last) { o.fillStyle = 'rgba(233,120,95,.18)'; o.fill(rr(x + 18, ry - 34, BW - 36, 68, 16)); }
      else { o.save(); o.translate(x + 50, ry); o.rotate(-.7); o.strokeStyle = C.sageD; o.lineWidth = 6; o.stroke(rr(-22, -10, 26, 20, 10)); o.stroke(rr(-4, -10, 26, 20, 10)); o.restore(); }
      textAt(s, x + (last ? 40 : 90), ry, 33, last ? C.ink : '#3a6a8a', last ? 900 : 800); textAt(pr, x + BW - 30, ry, 34, last ? '#c4553f' : C.ink, 900, 'right'); o.restore(); }); } },
  sched: { h: () => 250,
    draw(q, x, y, p, t, k) { const a = ramp(p, 0, .4); o.save(); o.globalAlpha *= a;
      ink(o, rr(x + 34, y + 40, 96, 96, 22), C.coral, { shade: .3, lw: 4 }); o.fillStyle = C.paper; o.fill(rr(x + 48, y + 72, 68, 52, 8)); o.fillStyle = C.coral; for (let i = 0; i < 6; i++) o.fill(rr(x + 54 + (i % 3) * 21, y + 80 + Math.floor(i / 3) * 22, 14, 14, 3));
      textAt(q.when, x + 160, y + 70, 36, '#c4553f', 900); textAt(q.what, x + 160, y + 120, 34, C.ink, 800);
      const on = ramp(p, .35, .6); ink(o, rr(x + BW - 140, y + 170, 100, 54, 27), on > .5 ? C.sageD : C.grey, { shade: 0, lw: 3 }); ink(o, el(x + BW - 113 + 46 * on, y + 197, 21, 21), C.paper, { shade: 0, lw: 3 });
      o.save(); o.globalAlpha *= ramp(p, .55, .8); textAt('✓ Задача создана', x + 40, y + 197, 34, '#3f5f3e', 900); o.restore(); o.restore(); } },
  notify: { h: q => q.cards.length * 215,
    draw(q, x, y, p, t, k) { q.cards.forEach(([tm, s], i) => { const a = ramp(p, i * .4, i * .4 + .3), cy = y + i * 215; o.save(); o.globalAlpha *= a; o.translate(0, -60 * (1 - a));
      ink(o, rr(x, cy, BW, 195, 34), '#fffdf8', { shade: .2, lw: 4 }); ink(o, el(x + 62, cy + 62, 32, 32), C.butter, { shade: .2, lw: 3 });
      o.fillStyle = C.ink; o.fill(poly([x + 48, cy + 74], [x + 52, cy + 50], [x + 62, cy + 44], [x + 72, cy + 50], [x + 76, cy + 74])); o.fill(el(x + 62, cy + 80, 5, 5));
      textAt(tm, x + 114, cy + 62, 32, '#c4553f', 900); wrap(s, 34, 800, BW - 70).slice(0, 2).forEach((ln, j) => textAt(ln, x + 34, cy + 120 + j * 44, 34, C.ink, 800)); o.restore(); }); } },
};

function stepTimes(i) { const t0 = T.step[i], s = V.steps[i], typed = s.prompt ? Math.min(2.1, .4 + s.prompt.length * .03) : 0, att = s.file || s.photo ? .45 : 0;
  const tp = t0 + .4 + att, tpEnd = tp + typed, dots = s.prompt ? tpEnd + .15 : t0 + .6, oT = dots + .6;
  return { t0, t1: stepEnd(i), tp, tpEnd, dots, oT }; }

function chatStep(t, k, i, dy) {
  const s = V.steps[i], st = stepTimes(i), L = PH.x + 40, R = PH.x + PH.w - 40, top0 = PH.y + 150, avail = PH.h - 190;
  const fa = ramp(t, st.t0, st.t0 + .3) * (1 - ramp(t, st.t1 - .3, st.t1));
  if (fa <= 0) return;
  o.save(); o.translate(0, dy); o.clip(screen()); o.globalAlpha *= fa;
  o.fillStyle = '#fbf2e3'; o.fillRect(PH.x, PH.y, PH.w, PH.h);
  // layout
  const pl = s.prompt ? wrap(s.prompt, FS, 800, 540) : [], pw = pl.length ? Math.max(...pl.map(l => (o.font = F(FS, 800), o.measureText(l).width))) + PAD * 2 : 0, ph = pl.length ? pl.length * LH + PAD * 2 - 6 : 0;
  const attH = s.file ? 110 : s.photo ? 300 : 0, m2 = attH ? attH + 20 : 0, m3 = m2 + ph + (ph ? 30 : 0), oh = OUT[s.out.type].h(s.out), total = m3 + 46 + oh;
  const scroll = Math.max(0, total - avail) * ramp(t, st.oT, st.oT + .7);
  o.save(); o.translate(0, top0 - scroll);
  if (s.file) { const a = ramp(t, st.t0 + .2, st.t0 + .5), w = 520; o.save(); o.globalAlpha *= a; o.translate(R - w + 40 * (1 - a), 0);       // файл
    bubble(0, 0, w, 96, true); ink(o, rr(22, 16, 52, 64, 8), C.paper, { shade: 0, lw: 3 }); o.fillStyle = C.sageD; o.fill(rr(30, 50, 36, 20, 4));
    textAt('CSV', 48, 61, 15, C.paper, 900, 'center'); textAt(s.file, 92, 48, 32, C.ink, 900); o.restore(); }
  if (s.photo) { const a = ramp(t, st.t0 + .2, st.t0 + .5); o.save(); o.globalAlpha *= a; o.translate(R - 360 + 40 * (1 - a), 0);              // фото
    bubble(0, 0, 360, 286, true); o.save(); o.clip(rr(14, 14, 332, 258, 24)); o.fillStyle = '#f3e3cc'; o.fillRect(0, 0, 360, 286); o.translate(180, 143); o.scale(.44, .44); ILLOS[V.illo](o, t, 0, {}); o.restore(); o.restore(); }
  if (s.prompt && t > st.tp - .2) { const a = ramp(t, st.tp - .2, st.tp); o.save(); o.globalAlpha *= a; bubble(R - pw, m2, pw, ph, true);          // промпт печатается
    const shown = Math.floor(s.prompt.length * clamp((t - st.tp) / (st.tpEnd - st.tp))); let n = 0;
    pl.forEach((ln, j) => { textAt(ln.slice(0, clamp(shown - n, 0, ln.length)), R - pw + PAD, m2 + PAD + LH / 2 + j * LH - 3, FS, C.ink, 800); n += ln.length + 1; }); o.restore(); }
  if (t > st.dots) { const a = ramp(t, st.dots, st.dots + .25); o.save(); o.globalAlpha *= a;                                                    // ответ
    if (s.out.type !== 'notify') textAt('ИИ', L + 6, m3 + 14, 28, C.sageD, 900);
    if (t < st.oT) { bubble(L, m3 + 40, 170, 80, false); for (let j = 0; j < 3; j++) { o.fillStyle = C.sageD; o.fill(el(L + 50 + j * 36, m3 + 80 + Math.sin(t * 9 - j) * 6, 10, 10)); } }
    else { const p = clamp((t - st.oT) / 1.6); if (s.out.type !== 'notify') bubble(L, m3 + 40, BW, oh, false); OUT[s.out.type].draw(s.out, L, m3 + 40, p, t, k); }
    o.restore(); }
  o.restore();
  // header: which tool this step uses
  o.fillStyle = '#f4e6d0'; o.fillRect(PH.x, PH.y, PH.w, 124); ink(o, el(PH.x + 92, PH.y + 86, 24, 24), C.sage, { shade: 0, lw: 3 });
  textAt(s.tool, PH.x + 132, PH.y + 88, 36, C.ink, 900); o.fillStyle = 'rgba(74,52,40,.15)'; o.fillRect(PH.x, PH.y + 124, PH.w, 3);
  o.restore();
}

function stepTitle(t, k, i) {
  const st = stepTimes(i), a = ramp(t, st.t0, st.t0 + .3) * (1 - ramp(t, st.t1 - .25, st.t1)); if (a <= 0) return;
  o.save(); o.globalAlpha *= a; o.translate(540, 100); o.rotate(-.02); const sc = 1 + .08 * pulseAt(t, [st.t0], 5) + .02 * k; o.scale(sc, sc);
  ink(o, rr(-120, -42, 240, 84, 42), C.coral, { shade: .25, lw: 4 }); textAt('Шаг ' + (i + 1), 0, 2, 52, C.paper, 900, 'center'); o.restore();
  let ts = 84; while (wrap(V.steps[i].title, ts, 900, 940).length > 2 && ts > 60) ts -= 4;
  caption(V.steps[i].title, t, st.t0 + .15, st.t1, 225, { k, size: ts, hl: [C.butter, '#f9cdb2', '#cfe0c4'][i] });
}

function schemeCard(t, t0, k) {
  const a = ramp(t, t0, t0 + .4), y0 = 400, rows = V.scheme.map(s => wrap(s, 50, 900, 640)), h = 70 + rows.reduce((s, r) => s + r.length * 62 + 56, 0);
  o.save(); o.globalAlpha *= a * (1 - ramp(t, T.share - .2, T.share)); o.translate(540, y0 + h / 2); o.rotate(-.012); o.scale(.9 + .1 * a + .01 * k, .9 + .1 * a + .01 * k); o.translate(-540, -(y0 + h / 2));
  ink(o, rr(70, y0, 940, h, 40), C.paper, { shade: .25, dir: [18, 14] });
  ink(o, poly([880, y0 - 20], [960, y0 - 20], [960, y0 + 110], [920, y0 + 80], [880, y0 + 110]), C.coral, { shade: .3 });   // закладка
  let y = y0 + 70;
  rows.forEach((r, i) => { const ra = ramp(t, t0 + .3 + i * .3, t0 + .6 + i * .3); o.save(); o.globalAlpha *= ra;
    badge(o, 150, y + 28, 40, String(i + 1), [C.terra, C.sageD, C.coral][i]);
    r.forEach((ln, j) => textAt(ln, 215, y + 28 + j * 62, 50, C.ink, 900)); o.restore(); y += r.length * 62 + 56; });
  o.restore();
  return y0 + h;
}

function finale(t, k) {
  const t0 = T.share, sa = ramp(t, t0, t0 + .4), lines = wrap(V.share, 70, 900, 820), h = lines.length * 90 + 90, y0 = 330;
  o.save(); o.globalAlpha *= sa; o.translate(540, y0 + h / 2); o.scale(.9 + .1 * sa + .01 * k, .9 + .1 * sa + .01 * k); o.translate(-540, -(y0 + h / 2));
  ink(o, rr(90, y0, 900, h, 48), '#f9cdb2', { shade: .25 }); ink(o, poly([230, y0 + h - 4], [210, y0 + h + 60], [300, y0 + h - 4]), '#f9cdb2', { shade: 0, lw: 4 });
  lines.forEach((ln, i) => textAt(ln, 540, y0 + 90 + i * 90, 70, C.ink, 900, 'center'));
  o.restore();
  o.save(); o.globalAlpha *= sa; illo(t, k, 540, 1130 - 10 * k, .62, { heal: 1 }); o.restore();
}

// ---------- frame
window.frame = async t => {
  const c = ctxAt(t), i = S.findIndex(s => t >= s.start && t < s.end), kx = i < 0 ? S.length - 1 : i, s = S[kx], nx = S[kx + 1];
  const state = { a: { scene: s.name, u: uni(s, t, c) }, post: { bloom: .12, ca: .0006 + .0012 * c.down, grain: .022, vig: .22, exposure: 1, tonemap: 0,
    flash: .4 * pulseAt(t, ST, 6) } };
  if (nx && s.tr && t > s.end - s.tr[1]) { state.b = { scene: nx.name, u: uni(nx, t, c) }; state.trans = { kind: s.tr[0], m: clamp((t - (s.end - s.tr[1])) / s.tr[1]) }; }
  E.render(state);
  o.setTransform(1, 0, 0, 1, 0, 0); o.drawImage(glc, 0, 0, W, H); o.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const k = c.kick;
  if (t < T.pain) hookComp(t, k, 1 - ramp(t, T.pain - .2, T.pain));
  else if (t < ST[0] + .6) {                                          // «обычно делают так»
    const out = ramp(t, ST[0], ST[0] + .5);
    illo(t, k, 540, 1020 + 260 * out, 1.1 - .2 * out, {});
    caption(V.pain[0], t, T.pain, ST[0], 200, { k, hl: C.butter, size: 88 });
    caption(V.pain[1], t, T.pain2, ST[0], 200 + wrap(V.pain[0], 88, 900, 940).length * 100 + 40, { k, hl: '#f9cdb2', size: 80 });
  }
  if (t >= ST[0] && t < T.res + .6) {                                 // цепочка шагов
    const dy = (1 - ramp(t, ST[0], ST[0] + .6)) * 1500 + ramp(t, T.res, T.res + .5) * 1500;
    phoneFrame(dy); for (let j = 0; j < 3; j++) if (t >= ST[j] - .05 && t < stepEnd(j) + .05) { chatStep(t, k, j, dy); stepTitle(t, k, j); }
  }
  if (t >= T.res && t < T.scheme) { caption('Результат', t, T.res + .2, T.scheme, 290, { k, size: 110 }); resultComp(t, T.res + .3, 470, k, 1 - ramp(t, T.scheme - .25, T.scheme)); }
  if (t >= T.scheme && t < T.share) { caption('Сохрани схему', t, T.scheme + .1, T.share, 230, { k, size: 104 }); const yb = schemeCard(t, T.scheme + .4, k);
    o.save(); o.globalAlpha *= ramp(t, T.scheme + .8, T.scheme + 1.2) * (1 - ramp(t, T.share - .2, T.share)); illo(t, k, 540, Math.min(1250, yb + 190), .36, { heal: 1 }); o.restore(); }
  if (t >= T.share) { const la = ramp(t, T.loop, DUR - .05); o.save(); o.globalAlpha *= 1 - la; finale(t, k); o.restore();
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

// Иллюстрации в технике «ризограф от руки»: плоская заливка + полутоновая тень + контур со сдвигом краски.
// Всё рисуется Canvas2D-путями, без картинок. Координаты — квадрат -300..300, центр (0,0).
// draw(o, t, k, st): t — время, k — удар на долю (0..1), st.heal — «после» (новая комната, нарядная открытка).
export const C = {
  ink: '#4a3428', cream: '#fdf6ea', paper: '#fffaf1', peach: '#f5b08e', coral: '#e9785f', sage: '#9cb58f', sageD: '#5f8a5d',
  butter: '#f6cf62', terra: '#df8a64', kraft: '#e3b98a', rose: '#eaa5a6', sky: '#a9cbc7', brownL: '#a9785a', grey: '#d9cdbd',
};
const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const el = (x, y, rx, ry, a = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); return p; };
const poly = (...pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
const blob = (x, y, r, seed, wob = .18, n = 9) => { const p = new Path2D(), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, h = Math.sin(seed * 12.9 + i * 78.2) * 43758.5; pts.push([x + Math.cos(a) * r * (1 + wob * (h - Math.floor(h) - .5) * 2), y + Math.sin(a) * r * (1 + wob * (h - Math.floor(h) - .5) * 2)]); }
  for (let i = 0; i <= n; i++) { const a = pts[i % n], b = pts[(i + 1) % n], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; i ? p.quadraticCurveTo(a[0], a[1], m[0], m[1]) : p.moveTo(m[0], m[1]); }
  p.closePath(); return p; };
export { rr, el, poly, blob };

let HT = null;
function halftone(o) { if (!HT) { const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d');
  x.fillStyle = 'rgba(74,52,40,.55)'; x.beginPath(); x.arc(6, 6, 2.6, 0, 7); x.fill(); HT = c; } return o.createPattern(HT, 'repeat'); }

// fill + halftone crescent shadow + misregistered outline
export function ink(o, path, fill, { shade = .5, dir = [16, 12], line = true, lw = 5, alpha = 1 } = {}) {
  o.save(); const A = o.globalAlpha * alpha; o.globalAlpha = A; o.fillStyle = fill; o.fill(path);
  if (shade > 0) { o.save(); o.clip(path); const q = new Path2D(); q.rect(-3000, -3000, 6000, 6000); q.addPath(path, new DOMMatrix().translate(-dir[0], -dir[1]));
    o.clip(q, 'evenodd'); o.globalAlpha = A * shade; o.fillStyle = halftone(o); o.fillRect(-3000, -3000, 6000, 6000); o.restore(); }
  if (line) { o.translate(3, 2.5); o.globalAlpha = A * .85; o.strokeStyle = C.ink; o.lineWidth = lw; o.lineJoin = 'round'; o.lineCap = 'round'; o.stroke(path); }
  o.restore();
}
const line = (o, pts, w = 5, col = C.ink, a = .85) => { o.save(); o.globalAlpha *= a; o.strokeStyle = col; o.lineWidth = w; o.lineCap = 'round'; o.lineJoin = 'round';
  o.beginPath(); pts.forEach(([x, y], i) => i ? o.lineTo(x, y) : o.moveTo(x, y)); o.stroke(); o.restore(); };
const bars = (o, x, y, w, n, gap = 22, col = C.grey, seed = 1) => { for (let i = 0; i < n; i++) { const f = .55 + .45 * Math.abs(Math.sin(seed * 3.1 + i * 1.7));
  o.fillStyle = col; o.fill(rr(x, y + i * gap, w * f, 9, 4.5)); } };
const label = (o, text, x, y, size, col = C.ink, w = 900, align = 'center') => { o.save(); o.font = `${w} ${size}px Nunito`; o.fillStyle = col; o.textAlign = align; o.textBaseline = 'middle'; o.fillText(text, x, y); o.restore(); };
const shadow = (o, y, rx) => { o.fillStyle = 'rgba(74,52,40,.13)'; o.fill(el(0, y, rx, rx * .09)); };

// ---------- партия v2: выписка, домашка, подарок-песня, отпуск, комната, неделя
function bank(o, t, k) {
  shadow(o, 292, 250);
  o.save(); o.rotate(-.06); o.translate(-90, 0);                                       // лист выписки
  ink(o, rr(-190, -280, 340, 520, 14), C.paper, { shade: .3 });
  label(o, 'ВЫПИСКА', -20, -236, 32);
  for (let i = 0; i < 9; i++) { const y = -180 + i * 44;
    bars(o, -160, y - 4, 170, 1, 0, i === 3 || i === 6 ? 'rgba(233,120,95,.85)' : C.grey, i + 2);
    label(o, i % 3 ? '-' + (240 + i * 130) : '-' + (1200 + i * 50), 120, y, 22, i === 3 || i === 6 ? C.coral : C.ink, 800, 'right'); }
  o.restore();
  o.save(); o.translate(150, 60 - 5 * k);                                             // круговая диаграмма
  const parts = [[.38, C.coral], [.21, C.butter], [.14, C.sage], [.09, C.peach], [.18, C.sky]]; let a0 = -Math.PI / 2;
  ink(o, el(0, 0, 118, 118), C.paper, { shade: .3 });
  for (const [v, c] of parts) { const p = new Path2D(); p.moveTo(0, 0); p.arc(0, 0, 105, a0, a0 + v * Math.PI * 2); p.closePath(); o.fillStyle = c; o.fill(p); a0 += v * Math.PI * 2; }
  ink(o, el(0, 0, 46, 46), C.paper, { shade: 0, lw: 4 }); label(o, '₽', 0, 2, 40);
  o.restore();
  for (const [x, y, r] of [[170, 230, 34], [215, 250, 28], [120, 255, 26]]) { ink(o, el(x, y, r, r * .42), C.butter, { shade: .35, lw: 4 }); }
}

function homework(o, t, k) {
  shadow(o, 292, 250);
  o.save(); o.rotate(-.04);
  ink(o, rr(-230, -250, 460, 500, 16), '#fffdf6', { shade: .3 });
  o.strokeStyle = 'rgba(169,203,199,.7)'; o.lineWidth = 2;
  for (let x = -210; x < 230; x += 28) { o.beginPath(); o.moveTo(x, -230); o.lineTo(x, 230); o.stroke(); }
  for (let y = -230; y < 240; y += 28) { o.beginPath(); o.moveTo(-220, y); o.lineTo(220, y); o.stroke(); }
  line(o, [[-170, -250], [-170, 250]], 3, C.coral, .7);
  label(o, 'Задача 5', -140, -190, 34, C.ink, 900, 'left');
  label(o, 'Было 12 яблок,', -140, -120, 30, '#5a4a40', 800, 'left');
  label(o, 'отдали 5.', -140, -76, 30, '#5a4a40', 800, 'left');
  label(o, 'Сколько осталось?', -140, -32, 30, '#5a4a40', 800, 'left');
  label(o, '12 - 5 = ?', -140, 60, 46, C.sageD, 900, 'left');
  o.restore();
  o.save(); o.translate(150, 150 + 4 * k); o.rotate(-.7);                              // карандаш
  ink(o, rr(-24, -170, 48, 240, 8), C.butter, { shade: .35, lw: 4 }); ink(o, poly([-24, 70], [24, 70], [0, 120]), C.kraft, { shade: .2, lw: 4 });
  o.fillStyle = C.ink; o.fill(poly([-7, 108], [7, 108], [0, 120])); ink(o, rr(-24, -200, 48, 34, 8), C.rose, { shade: .2, lw: 4 });
  o.restore();
  for (let i = 0; i < 3; i++) { const ph = (t * .7 + i * .33) % 1; o.save(); o.globalAlpha *= Math.sin(ph * Math.PI); label(o, '?', 200 + i * 30, -170 - ph * 80, 50 + i * 6, C.coral, 900); o.restore(); }
}

function gift(o, t, k, st) {
  const fancy = st.heal ?? 0;
  shadow(o, 292, 230);
  if (fancy) { ink(o, rr(-280, -290, 560, 570, 30), '#fbe6d4', { shade: .2 }); for (let i = 0; i < 7; i++) ink(o, blob(-210 + i * 70, -230 + (i % 2) * 40, 22, i, .3), [C.sage, C.peach, C.butter][i % 3], { shade: 0, lw: 3 }); }
  ink(o, rr(-170, 60, 340, 210, 26), C.peach, { shade: .4 });                        // нижний ярус торта
  ink(o, rr(-130, -60, 260, 140, 24), '#fff3df', { shade: .35 });
  for (let i = 0; i < 6; i++) ink(o, el(-140 + i * 56, 74, 22, 14), C.paper, { shade: 0, lw: 3 });
  label(o, '60', 0, 12, 76, C.coral, 900);
  for (const x of [-60, 0, 60]) { ink(o, rr(x - 9, -130, 18, 72, 6), x ? C.sky : C.rose, { shade: .2, lw: 3 });
    const f = 1 + .15 * Math.sin(t * 12 + x); ink(o, el(x, -150, 12 * f, 20 * f), C.butter, { shade: 0, lw: 3 }); }
  for (let i = 0; i < 3; i++) { const ph = (t * .5 + i / 3) % 1, x = 190 + 30 * Math.sin(ph * 6 + i), y = -60 - ph * 220;          // ноты
    o.save(); o.globalAlpha *= Math.sin(ph * Math.PI); o.translate(x - i * 90 * (i % 2), y); o.scale(1 + .2 * k, 1 + .2 * k);
    ink(o, el(0, 0, 18, 13, -.4), C.sageD, { shade: 0, lw: 3 }); line(o, [[16, -4], [16, -64], [40, -52]], 6, C.ink, .9); o.restore(); }
  if (fancy) { o.save(); o.translate(-215, 210); ink(o, el(0, 0, 50, 40), C.grey, { shade: .3 }); ink(o, poly([-40, -20], [-30, -58], [-12, -30]), C.grey, { shade: 0, lw: 3 });
    ink(o, poly([40, -20], [30, -58], [12, -30]), C.grey, { shade: 0, lw: 3 }); o.fillStyle = C.ink; o.fill(el(-15, -5, 5, 6)); o.fill(el(15, -5, 5, 6)); o.restore(); }
}

function trip(o, t, k) {
  shadow(o, 292, 250);
  o.save(); o.translate(-60, 40 - 4 * k);                                              // чемодан
  ink(o, rr(-150, -150, 300, 400, 36), C.coral, { shade: .45 });
  line(o, [[-60, -150], [-60, -210], [60, -210], [60, -150]], 12, C.ink, .85);
  for (const x of [-75, 0, 75]) line(o, [[x, -120], [x, 220]], 6, '#c45d47', .6);
  ink(o, rr(-110, -40, 120, 70, 12), C.butter, { shade: .2, lw: 4 }); label(o, 'KZN', -50, -4, 34);
  ink(o, el(-100, 262, 20, 20), C.ink, { shade: 0, lw: 3 }); ink(o, el(100, 262, 20, 20), C.ink, { shade: 0, lw: 3 });
  o.restore();
  o.save(); o.translate(170, -150); o.rotate(.18);                                     // билет
  ink(o, rr(-110, -60, 220, 120, 14), C.paper, { shade: .3 }); line(o, [[40, -60], [40, 60]], 3, C.grey, 1);
  label(o, 'МСК', -40, -20, 28, C.ink, 900); label(o, 'КЗН', -40, 22, 28, C.sageD, 900); label(o, '18:40', 76, 0, 22, C.coral, 900);
  o.restore();
  const ph = (t * .25) % 1; o.save(); o.translate(-260 + ph * 520, -250 - Math.sin(ph * Math.PI) * 30); o.rotate(.1);   // самолётик
  ink(o, poly([-40, 0], [40, -6], [50, 0], [40, 6]), C.paper, { shade: .2, lw: 3 }); ink(o, poly([0, -2], [-14, -34], [8, -2]), C.sky, { shade: 0, lw: 3 }); o.restore();
  for (const [x, y] of [[200, 120], [250, 30]]) { ink(o, el(x, y, 40, 40), C.sky, { shade: .3, lw: 4 }); line(o, [[x - 20, y], [x + 20, y]], 4, C.paper, 1); }
}

function room(o, t, k, st) {
  const nw = st.heal ?? 0;
  const wall = nw ? '#f6ecdc' : '#c9c0b0', wall2 = nw ? '#efe0c9' : '#b7ad9c', floor = nw ? '#d9a877' : '#9d9488';
  ink(o, poly([-290, -280], [0, -230], [0, 160], [-290, 250]), wall, { shade: .25, dir: [-12, 10] });
  ink(o, poly([0, -230], [290, -280], [290, 250], [0, 160]), wall2, { shade: .3 });
  ink(o, poly([-290, 250], [0, 160], [290, 250], [0, 300]), floor, { shade: .3 });
  if (nw) for (let i = 1; i < 6; i++) line(o, [[-290 + i * 58, 250 - i * 18 + 0], [i * 58, 300 - i * 18]], 2, '#b98756', .5);
  ink(o, poly([60, -170], [200, -190], [200, -10], [60, 10]), nw ? '#dff0ee' : '#d6dedd', { shade: .2 });   // окно
  line(o, [[130, -180], [130, 0]], 4, C.ink, .6); line(o, [[60, -80], [200, -100]], 4, C.ink, .6);
  if (!nw) { ink(o, rr(-230, 120, 120, 90, 6), C.kraft, { shade: .4 }); ink(o, rr(-180, 60, 100, 70, 6), '#d8ad7c', { shade: .4 });   // коробки
    line(o, [[-60, -150], [-20, -40]], 4, '#8a8172', .7); line(o, [[-200, -60], [-150, 30]], 4, '#8a8172', .7);
    o.save(); o.translate(160, 170); o.rotate(-.3); ink(o, rr(-12, -100, 24, 110, 6), C.brownL, { shade: .2, lw: 3 }); ink(o, rr(-50, -150, 100, 54, 16), C.butter, { shade: .3, lw: 4 }); o.restore(); }
  else { ink(o, rr(-250, 110, 230, 80, 26), C.sage, { shade: .35 }); ink(o, rr(-250, 70, 230, 60, 22), '#b5cba8', { shade: .2, lw: 4 });   // диван
    ink(o, poly([180, 210], [240, 210], [228, 150], [192, 150]), C.terra, { shade: .4, lw: 4 });
    for (let i = 0; i < 4; i++) ink(o, el(210 + (i - 1.5) * 22, 120 - i % 2 * 30, 14, 34, (i - 1.5) * .4), '#6f9e5e', { shade: .3, lw: 3 });
    ink(o, rr(-210, -150, 150, 100, 8), C.peach, { shade: .2, lw: 4 }); ink(o, blob(-135, -100, 30, 4, .2), C.butter, { shade: 0, lw: 3 });
    for (const [x, y] of [[-40, -60], [240, -230], [-120, 40]]) { o.save(); o.globalAlpha *= .5 + .5 * Math.sin(t * 3 + x); o.translate(x, y); o.fillStyle = C.butter; o.fill(poly([0, -18], [5, -5], [18, 0], [5, 5], [0, 18], [-5, 5], [-18, 0], [-5, -5])); o.restore(); } }
}

function week(o, t, k) {
  shadow(o, 292, 240);
  o.save(); o.rotate(-.05); o.translate(-60, 0);
  ink(o, rr(-200, -230, 400, 470, 26), C.paper, { shade: .3 });
  ink(o, rr(-200, -230, 400, 110, 26), C.coral, { shade: .3 }); for (const x of [-110, 110]) ink(o, rr(x - 12, -262, 24, 64, 12), C.ink, { shade: 0, lw: 2 });
  label(o, 'ПЯТНИЦА', 0, -172, 44, C.paper, 900);
  label(o, '17:00', 0, -40, 96, C.ink, 900);
  ink(o, rr(-150, 50, 300, 54, 14), C.butter, { shade: .2, lw: 3 }); label(o, 'меню + покупки', 0, 78, 30, C.ink, 900);
  ink(o, rr(-150, 125, 300, 54, 14), '#cfe0c4', { shade: .2, lw: 3 }); label(o, 'ДР у Лены', 0, 153, 30, C.ink, 900);
  o.restore();
  o.save(); o.translate(190, 150); o.rotate(Math.sin(t * 14) * .12 * (.4 + k));            // колокольчик
  ink(o, poly([-70, 40], [-56, -30], [-30, -70], [30, -70], [56, -30], [70, 40]), C.butter, { shade: .4 }); ink(o, rr(-80, 34, 160, 22, 11), '#e9b449', { shade: .2, lw: 4 });
  ink(o, el(0, 70, 18, 18), C.terra, { shade: 0, lw: 3 }); ink(o, el(0, -78, 12, 12), C.terra, { shade: 0, lw: 3 });
  o.restore();
  for (const s of [-1, 1]) { o.save(); o.translate(190 + s * 110, 120); o.globalAlpha *= .5 + .5 * k; line(o, [[0, -30], [s * 20, -50]], 6, C.coral, 1); line(o, [[s * 6, 0], [s * 32, -6]], 6, C.coral, 1); o.restore(); }
}

export const ILLOS = { bank, homework, gift, trip, room, week };

// small drawn glyphs for result rows: check, cross, or text badge
export function badge(o, x, y, r, g, col) {
  ink(o, el(x, y, r, r), col, { shade: .3, lw: 4 });
  if (g === '✓') line(o, [[x - r * .42, y + 2], [x - r * .1, y + r * .35], [x + r * .45, y - r * .35]], r * .22, C.paper, 1);
  else if (g === '✗') { line(o, [[x - r * .35, y - r * .35], [x + r * .35, y + r * .35]], r * .22, C.paper, 1); line(o, [[x + r * .35, y - r * .35], [x - r * .35, y + r * .35]], r * .22, C.paper, 1); }
  else label(o, g, x, y + 2, r * 1.05, C.paper, 900);
}

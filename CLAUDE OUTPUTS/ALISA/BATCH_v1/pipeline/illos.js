// Иллюстрации в технике «ризограф от руки»: плоская заливка + полутоновая тень + контур со сдвигом краски.
// Всё рисуется Canvas2D-путями, без картинок. Координаты — квадрат -300..300, центр (0,0).
// draw(o, t, k, st): t — время, k — удар на долю (0..1), st — состояние сцены (heal/clean 0..1).
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

function fridge(o, t, k) {
  shadow(o, 292, 240);
  ink(o, rr(-200, -300, 400, 590, 42), '#fffdf7', { shade: .35 });
  ink(o, poly([-200, -290], [-318, -250], [-318, 240], [-200, 282]), '#f6eddd', { shade: .3, dir: [-12, 10] });
  for (const y of [-170, -40, 90]) line(o, [[-305, y + 10], [-212, y]], 6, C.brownL, .6);
  ink(o, rr(-292, -232, 26, 62, 9), C.sage, { shade: .3, lw: 4 }); ink(o, rr(-258, -238, 26, 68, 9), C.peach, { shade: .3, lw: 4 });
  ink(o, rr(-290, -102, 50, 60, 10), C.butter, { shade: .3, lw: 4 });
  const g = o.createRadialGradient(0, -250, 10, 0, -200, 420); g.addColorStop(0, '#fff7d8'); g.addColorStop(1, '#fbe9c8');
  ink(o, rr(-172, -272, 344, 534, 26), g, { shade: 0, lw: 4 });
  for (const y of [-112, 38, 168]) ink(o, rr(-172, y, 344, 12, 6), '#ead9bb', { shade: 0, lw: 3 });
  const b = -5 * k;
  o.save(); o.translate(0, b);
  ink(o, poly([-150, -112], [-150, -210], [-118, -238], [-86, -210], [-86, -112]), '#fffdf6', { shade: .45 });       // milk
  ink(o, rr(-150, -190, 64, 40, 4), C.sky, { shade: 0, line: false });
  ink(o, rr(-56, -178, 74, 66, 16), '#fffaf0', { shade: .4 }); ink(o, rr(-62, -194, 86, 22, 9), C.peach, { shade: .2, lw: 4 });   // sour cream
  ink(o, poly([42, -112], [156, -112], [146, -176]), C.butter, { shade: .4 });                                         // cheese
  for (const [x, y, r] of [[110, -132, 8], [130, -150, 6], [88, -122, 5]]) { o.fillStyle = '#e9b449'; o.fill(el(x, y, r, r)); }
  o.restore(); o.save(); o.translate(0, -b * .6);
  ink(o, rr(-160, 14, 176, 26, 8), C.kraft, { shade: .3, lw: 4 });
  for (let i = 0; i < 4; i++) ink(o, el(-132 + i * 40, 2, 17, 22), '#fff6e6', { shade: .35, lw: 4 });                   // eggs
  for (const [x, r] of [[56, 30], [112, 27], [160, 24]]) { ink(o, el(x, 38 - r, r, r * .92), C.coral, { shade: .45 });
    line(o, [[x - 9, 38 - 2 * r + 4], [x, 38 - 2 * r + 9], [x + 9, 38 - 2 * r + 3]], 6, C.sageD, 1); }
  o.restore(); o.save(); o.translate(0, b * .8);
  ink(o, el(-78, 140, 96, 24, -.08), C.sageD, { shade: .4 }); ink(o, el(-168, 147, 10, 12), '#c9d6a0', { shade: 0, lw: 3 });  // zucchini
  for (let i = 0; i < 5; i++) ink(o, el(70 + i * 20, 118 - (i % 2) * 14, 16, 46, -.5 + i * .25), i % 2 ? C.sage : '#7fa86f', { shade: .3, lw: 4 });   // greens
  o.restore();
  ink(o, rr(-160, 186, 320, 66, 18), 'rgba(169,203,199,.55)', { shade: .25, lw: 4 });
  for (const [x, c] of [[-100, '#e9c27d'], [-40, '#d99a6c'], [40, '#e9c27d']]) ink(o, blob(x, 222, 24, x, .12), c, { shade: .3, lw: 3 });
}

function plant(o, t, k, st) {
  const heal = st.heal ?? 0, sway = Math.sin(t * 1.3) * .025 + k * .02;
  shadow(o, 292, 190);
  ink(o, el(0, 284, 150, 18), '#d77c57', { shade: .3 });
  o.save(); o.rotate(sway);
  const leaves = [[-150, -150, -.9, 110, .9], [150, -120, .9, 105, .2], [-60, -250, -.25, 105, .1], [70, -260, .3, 100, .5], [-170, -20, -1.35, 95, 1], [165, 10, 1.3, 90, .7], [0, -150, 0, 80, .3]];
  for (const [x, y, a, len, sick] of leaves) {
    const droop = sick * (1 - heal) * .35;
    o.save(); o.translate(0, 80); line(o, [[0, 0], [x * .35, (y - 80) * .5], [x * .82, y - 80 + droop * 60]], 7, C.sageD, .95); o.restore();
    o.save(); o.translate(x, y + droop * 60); o.rotate(a + droop * Math.sign(x || 1));
    const s = sick * (1 - heal), col = s > .6 ? '#d8c25a' : s > .25 ? '#a8b866' : '#6f9e5e';
    const leaf = new Path2D(); leaf.moveTo(0, len * .55); leaf.bezierCurveTo(len * .55, len * .2, len * .45, -len * .5, 0, -len * .62); leaf.bezierCurveTo(-len * .45, -len * .5, -len * .55, len * .2, 0, len * .55);
    ink(o, leaf, col, { shade: .35, lw: 4 });
    if (s > .2) { o.save(); o.clip(leaf); o.fillStyle = '#a5683f'; o.globalAlpha *= Math.min(1, s * 1.2); o.fill(blob(0, -len * .62, len * .28, x, .4)); o.fill(blob(len * .32, -len * .05, len * .12, y, .5)); o.restore(); }
    line(o, [[0, len * .5], [0, -len * .5]], 3, '#3f6e45', .5);
    o.restore();
  }
  o.restore();
  ink(o, poly([-128, 120], [128, 120], [100, 280], [-100, 280]), C.terra, { shade: .45 });
  ink(o, rr(-142, 92, 284, 44, 14), '#ea9d78', { shade: .3 });
  ink(o, el(0, 96, 122, 14), '#6b4a3a', { shade: 0, lw: 3 });
  for (let i = 0; i < 3; i++) line(o, [[-80 + i * 60, 170], [-70 + i * 60, 178]], 5, '#f6c7a8', .8);
}

function resume(o, t, k) {
  shadow(o, 292, 260);
  o.save(); o.rotate(-.07); o.translate(-120, 0);
  ink(o, rr(-170, -270, 320, 470, 16), C.paper, { shade: .3 });
  label(o, 'РЕЗЮМЕ', -10, -225, 34);
  ink(o, el(-95, -140, 42, 42), C.sage, { shade: .3, lw: 4 }); o.fillStyle = C.cream; o.fill(el(-95, -152, 15, 16)); o.fill(el(-95, -112, 28, 16));
  bars(o, -35, -170, 160, 4, 22, C.grey, 2);
  label(o, 'Опыт', -112, -60, 26, C.ink, 800, 'left'); bars(o, -120, -38, 250, 4, 22, C.grey, 5);
  label(o, 'Навыки', -112, 70, 26, C.ink, 800, 'left'); bars(o, -120, 92, 240, 3, 22, C.grey, 9);
  o.restore();
  o.save(); o.rotate(.06); o.translate(140, 30 - 4 * k);
  ink(o, rr(-150, -250, 300, 420, 16), '#fff3df', { shade: .3 });
  label(o, 'ВАКАНСИЯ', 0, -205, 32, C.coral);
  label(o, 'Администратор', 0, -160, 26, C.ink, 800);
  for (let i = 0; i < 6; i++) { o.fillStyle = C.coral; o.fill(el(-112, -100 + i * 40, 6, 6)); bars(o, -95, -105 + i * 40, 200, 1, 0, i % 2 ? C.grey : 'rgba(246,207,98,.95)', i + 3); }
  o.restore();
  o.save(); o.translate(20, 230); o.rotate(-.5); ink(o, rr(-120, -10, 220, 20, 10), C.coral, { shade: .3, lw: 4 }); ink(o, poly([100, -10], [134, 0], [100, 10]), C.cream, { shade: 0, lw: 3 }); o.restore();
}

function menu(o, t, k) {
  shadow(o, 292, 270);
  o.save(); o.rotate(-.05); o.translate(-95, 0);
  ink(o, rr(-180, -260, 330, 480, 18), C.paper, { shade: .3 });
  for (let i = 0; i < 7; i++) { ink(o, el(-180, -220 + i * 64, 10, 10), C.cream, { shade: 0, lw: 3 }); }
  label(o, 'МЕНЮ', -15, -218, 34);
  const D = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  D.forEach((d, i) => { const y = -165 + i * 52; label(o, d, -130, y, 26, i % 2 ? C.sageD : C.coral, 900, 'left');
    bars(o, -78, y - 5, 190, 1, 0, i === 2 ? 'rgba(246,207,98,.95)' : C.grey, i * 2 + 1); line(o, [[-150, y + 24], [128, y + 24]], 2, C.grey, .7); });
  o.restore();
  o.save(); o.translate(170, 70 + 3 * k);
  ink(o, rr(-30, -250, 34, 230, 16, .3), '#e7b467', { shade: .4, lw: 4 });                                           // baguette
  ink(o, poly([40, -150], [70, -150], [55, -20]), '#ef8f4e', { shade: .3, lw: 4 }); line(o, [[50, -150], [44, -190]], 6, C.sageD, 1); line(o, [[60, -150], [70, -186]], 6, C.sageD, 1);
  ink(o, el(-60, -40, 34, 32), C.coral, { shade: .4, lw: 4 }); line(o, [[-60, -72], [-55, -86]], 5, C.ink, .9);
  ink(o, poly([-120, -40], [120, -40], [100, 200], [-100, 200]), C.kraft, { shade: .45 });
  line(o, [[-50, -40], [-40, -95], [40, -95], [50, -40]], 6, C.brownL, .8);
  o.restore();
  o.save(); o.translate(80, 200); o.rotate(.12); ink(o, rr(-80, -32, 170, 64, 14), C.butter, { shade: .25 }); label(o, '5000 ₽', 5, 1, 36); o.restore();
}

function doc(o, t, k) {
  shadow(o, 292, 250);
  o.save(); o.rotate(-.04); o.translate(-60, 0);
  ink(o, rr(-200, -280, 400, 530, 14), C.paper, { shade: .3 });
  label(o, 'ДОГОВОР', 0, -232, 38);
  bars(o, -160, -185, 320, 7, 24, C.grey, 4);
  o.fillStyle = 'rgba(246,207,98,.85)'; o.fill(rr(-166, -10, 300, 24, 6)); bars(o, -160, -3, 280, 1, 0, '#b89a7a', 8);
  bars(o, -160, 40, 320, 4, 24, C.grey, 12);
  for (let i = 0; i < 4; i++) bars(o, -160, 150 + i * 14, 320, 1, 0, '#e3d6c4', 20 + i);
  o.restore();
  o.save(); o.translate(-20, 150); o.rotate(.5 * Math.sin(t * .8) * .1);
  ink(o, el(0, 0, 70, 70), 'rgba(255,255,255,.85)', { shade: 0, lw: 10 });
  o.save(); o.clip(el(0, 0, 66, 66)); o.fillStyle = C.coral; o.fill(rr(-60, -18, 120, 14, 7)); o.fillStyle = '#b89a7a'; o.fill(rr(-60, 8, 90, 12, 6)); o.restore();
  ink(o, rr(48, 48, 26, 100, 12, .6), C.brownL, { shade: .3, lw: 4 });
  o.restore();
  o.save(); o.translate(205, 205);
  ink(o, el(0, 60, 80, 16), C.cream, { shade: .3, lw: 4 });
  ink(o, poly([-58, -20], [58, -20], [44, 58], [-44, 58]), C.sage, { shade: .4 });
  o.save(); o.lineWidth = 9; o.strokeStyle = C.ink; o.globalAlpha *= .8; o.beginPath(); o.arc(62, 14, 22, -1.3, 1.3); o.stroke(); o.restore();
  for (let i = 0; i < 3; i++) { const ph = t * 1.2 + i; line(o, [[-20 + i * 20, -40], [-28 + i * 20 + 8 * Math.sin(ph), -70], [-20 + i * 20, -100 - 6 * Math.sin(ph)]], 5, C.brownL, .45); }
  o.restore();
}

function stain(o, t, k, st) {
  const clean = st.clean ?? 0;
  shadow(o, 292, 220);
  line(o, [[0, -290], [0, -262]], 7, C.brownL, 1);
  o.save(); o.lineWidth = 7; o.strokeStyle = C.brownL; o.beginPath(); o.arc(0, -300, 16, Math.PI * .1, Math.PI * 1.15, true); o.stroke(); o.restore();
  line(o, [[-170, -200], [0, -262], [170, -200]], 8, C.brownL, 1);
  o.save(); o.rotate(Math.sin(t * 1.1) * .02 + k * .015);
  const tee = poly([-90, -215], [-262, -140], [-205, -40], [-150, -72], [-150, 255], [150, 255], [150, -72], [205, -40], [262, -140], [90, -215], [50, -195], [-50, -195]);
  ink(o, tee, '#fffdf8', { shade: .35 });
  ink(o, el(0, -205, 52, 20), C.cream, { shade: 0, lw: 4 });
  ink(o, rr(-22, -186, 44, 26, 5), C.sky, { shade: 0, lw: 3 }); label(o, '100%', 0, -173, 14, C.ink, 900);
  if (clean < 1) { o.save(); o.globalAlpha *= 1 - clean; o.fillStyle = '#a5714c'; o.fill(blob(-40, 40, 62, 3.7, .35, 11)); o.fillStyle = '#8b5a3a'; o.fill(blob(-48, 36, 34, 1.2, .4, 9));
    for (const [x, y, r] of [[38, 0, 14], [30, 96, 10], [-110, 100, 9], [10, 120, 6]]) o.fill(blob(x, y, r, x + y, .3, 7)); o.restore(); }
  if (clean > .5) for (const [x, y] of [[-40, 40], [40, -20], [-90, 120]]) { const a = (clean - .5) * 2; o.save(); o.globalAlpha *= a; o.translate(x, y); o.rotate(t);
    o.fillStyle = C.butter; o.fill(poly([0, -22], [6, -6], [22, 0], [6, 6], [0, 22], [-6, 6], [-22, 0], [-6, -6])); o.restore(); }
  o.restore();
  o.save(); o.translate(215, 230); o.rotate(.15);
  ink(o, poly([-42, -40], [42, -40], [32, 40], [-32, 40]), C.peach, { shade: .4 }); o.save(); o.lineWidth = 8; o.strokeStyle = C.ink; o.globalAlpha *= .8; o.beginPath(); o.arc(46, 0, 18, -1.3, 1.3); o.stroke(); o.restore();
  o.restore();
}

export const ILLOS = { fridge, plant, resume, menu, doc, stain };

// small drawn glyphs for result rows: check, cross, or text badge
export function badge(o, x, y, r, g, col) {
  ink(o, el(x, y, r, r), col, { shade: .3, lw: 4 });
  if (g === '✓') line(o, [[x - r * .42, y + 2], [x - r * .1, y + r * .35], [x + r * .45, y - r * .35]], r * .22, C.paper, 1);
  else if (g === '✗') { line(o, [[x - r * .35, y - r * .35], [x + r * .35, y + r * .35]], r * .22, C.paper, 1); line(o, [[x + r * .35, y - r * .35], [x - r * .35, y + r * .35]], r * .22, C.paper, 1); }
  else label(o, g, x, y + 2, r * 1.05, C.paper, 900);
}

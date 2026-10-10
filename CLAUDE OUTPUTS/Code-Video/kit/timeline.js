// The clip itself: sections, transitions, uniforms and lyrics — all as functions of t.
// Edit this file to make a new video; scenes/ and lib/ are the reusable library.
import { createEngine } from './lib/gl.js';
import { clamp, ramp, keyed, pulseAt, beatInfo, sectionAt, window_ } from './lib/time.js';
import stained from './scenes/stained.js';
import silk from './scenes/silk.js';
import tunnel from './scenes/tunnel.js';
import riso from './scenes/riso.js';
import stars from './scenes/stars.js';

const qs = new URLSearchParams(location.search), SCALE = +(qs.get('scale') ?? 1);
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const timing = await (await fetch('assets/timing.json')).json();
const BEATS = timing.beats, DB = BEATS.filter((_, i) => i % 4 === 0);
const LYRICS = await (await fetch('assets/lyrics.json')).json();

const glc = Object.assign(document.createElement('canvas'), { width: W, height: H });
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');
const E = createEngine(glc, W, H);
for (const [n, s] of Object.entries({ stained, silk, tunnel, riso, stars })) E.addScene(n, s);

// sections: scene + uniforms(t, ctx). TR = transition into the next section: kind 0 fade, 1 burn, 2 iris, 3 glitch
const S = [
  { name: 'stained', start: 0, end: 5.0, tr: [1, .9], u: (t, c) => ({ uA: [c.wave, 2.2 * c.down, .25 + 1.1 * ramp(t, 0, 3.5), 5], uB: [0, 0, 0, 0] }) },
  { name: 'silk', start: 5.0, end: 10.0, tr: [3, .5], u: (t, c) => ({ uA: [1, keyed(t, [[5, 0], [10, .35]]), 1.1, 1.6], uB: [0, 0, 0, 0] }) },
  { name: 'tunnel', start: 10.0, end: 15.0, tr: [2, .8], u: (t, c) => ({ uA: [2.2 + 1.5 * ramp(t, 12, 15), 1, 1.2, .55], uB: [0, 0, 0, 0] }) },
  { name: 'riso', start: 15.0, end: 19.0, tr: [0, .35], u: (t, c) => ({ uA: [70, .006 + .02 * c.down, 1.8, .95], uB: [0, 0, 0, 0] }) },
  { name: 'stained', start: 19.0, end: 21.0, tr: [0, .7], u: (t, c) => ({ uA: [c.wave, 2.5 * c.down, 1.35, 4], uB: [clamp((t - 19.5) / 1.4), 0, 0, 0] }) },
  { name: 'stars', start: 21.0, end: timing.duration, u: (t, c) => ({ uA: [ramp(t, 21.5, 22.5), ramp(t, 21.8, 23.5), 6, 1], uB: [0, 0, 0, 0] }) },
];

function ctxAt(t) {
  const b = beatInfo(t, BEATS), lastDown = DB.filter(d => d <= t).at(-1) ?? -9;
  return { ...b, kick: pulseAt(t, BEATS, 7), down: pulseAt(t, DB, 2.5), wave: (t - lastDown) * .9 };
}
const uni = (s, t, c) => ({ uT: t, uBeat: c.kick, uBar: c.barPhase, uP: sectionAt(t, S).p, ...s.u(t, c) });

// kinetic type: each letter rises and un-blurs with a small stagger; the line breathes on the kick
function lyric(t, c) {
  const L = LYRICS.find(([s, e]) => t >= s - .1 && t < e + .3); if (!L) return;
  const [s, e, text, style = 'serif'] = L, size = 96 * SCALE;
  o.save(); o.textBaseline = 'middle';
  const ink = style === 'ink';
  o.font = style === 'mono' ? `700 ${size * .8}px "JetBrains Mono", monospace` : `italic 600 ${size}px "Cormorant Garamond", serif`;
  const chars = [...text], widths = chars.map(ch => o.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
  let x = W / 2 - total / 2; const y = H * .80;
  chars.forEach((ch, i) => {
    const a = window_(t, s + i * .025, e + .3, .35), rise = (1 - ramp(t, s + i * .025, s + i * .025 + .5)) * 26 * SCALE;
    o.globalAlpha = a; o.shadowColor = ink ? 'rgba(255,60,140,.35)' : 'rgba(255,170,90,.7)'; o.shadowBlur = (18 + 20 * c.kick) * SCALE;
    o.fillStyle = ink ? '#1d1a3a' : '#fff4de'; o.fillText(ch, x, y + rise); o.shadowBlur = 0; o.fillText(ch, x, y + rise); x += widths[i];
  });
  o.restore();
}

window.frame = async t => {
  const c = ctxAt(t), i = S.findIndex(s => t >= s.start && t < s.end), k = i < 0 ? S.length - 1 : i, s = S[k], nx = S[k + 1];
  const state = { a: { scene: s.name, u: uni(s, t, c) }, post: {
    bloom: .8 + .5 * c.kick, ca: .002 + .006 * c.down, grain: .05, vig: .85, exposure: .85 * ramp(t, 0, .6) * (1 - ramp(t, timing.duration - 1, timing.duration)),
    flash: .25 * pulseAt(t, [19.0], 4) } };
  if (nx && s.tr && t > s.end - s.tr[1]) {                             // transition straddles the cut
    state.b = { scene: nx.name, u: uni(nx, t, c) }; state.trans = { kind: s.tr[0], m: clamp((t - (s.end - s.tr[1])) / s.tr[1]) };
  }
  E.render(state);
  o.drawImage(glc, 0, 0); lyric(t, c);
};
await document.fonts.load(`italic 600 40px "Cormorant Garamond"`).catch(() => {});
window.ready = true;

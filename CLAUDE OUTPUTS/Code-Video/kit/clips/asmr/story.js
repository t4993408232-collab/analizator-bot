// The story as data — shared by the picture (clip.js, browser) and the sound (sound.mjs, node),
// so every key click, slam and crack lands on the same frame as its sample.
export const BPM = 120, SPB = 60 / BPM, BAR = 4 * SPB, DURATION = 32;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// typed lines: each char gets its own time (human jitter, a pause after spaces) -> one key click per char
function typed(text, start, cps, seed) {
  let t = start; const times = [];
  for (let i = 0; i < text.length; i++) { times.push(+t.toFixed(4)); t += (1 / cps) * (.55 + .9 * hash(seed + i * 1.7)) * (text[i] === ' ' ? 1.6 : 1); }
  return { text, start, times, end: t };
}
export const TYPED = [
  typed('> claude, сделай видео', .45, 9, 1),
  typed('claude code', 29.0, 11, 7),
];
export const ENTER = 3.3;                                             // the big satisfying return key

// story beats (seconds). 120 BPM: a beat is .5 s, a bar 2 s; the drop is on bar 5 (t = 8)
export const SLAMS = [[4.0, 'без графики'], [5.0, 'без монтажа'], [6.0, 'только код']];
export const DROP = 8, SHATTER = 24, OUTRO = 26;
export const SECTIONS = [
  { scene: 'void', start: 0, end: DROP, tr: [1, .5] },
  { scene: 'stained', start: DROP, end: 12, tr: [3, .4], code: 'voronoi(p)', label: 'витраж' },
  { scene: 'silk', start: 12, end: 16, tr: [2, .5], code: 'fbm(p + 4.*fbm(p))', label: 'шёлк' },
  { scene: 'tunnel', start: 16, end: 20, tr: [3, .35], code: '.35 / length(p)', label: 'тоннель' },
  { scene: 'riso', start: 20, end: SHATTER, tr: [0, .25], code: 'halftone(p, ink)', label: 'печать' },
  { scene: 'stained', start: SHATTER, end: OUTRO, tr: [0, .6], code: 'shatter = 1.', label: 'и звук — тоже код' },
  { scene: 'stars', start: OUTRO, end: DURATION },
];
// each section's code caption types itself in fast (one soft click per char)
export const captionTimes = sec => [...(sec.code ?? '')].map((_, i) => +(sec.start + .12 + i * .035).toFixed(4));
export const OUTRO_LINES = [[26.6, '0 кадров графики'], [27.4, '0 склеек'], [28.2, 'только код']];

// beat grid of the generated track (it is exact — the music is written, not detected)
export const BEATS = [...Array(Math.round(DURATION / SPB))].map((_, i) => +(i * SPB).toFixed(3));
export const timing = { duration: DURATION, bpm: BPM, beats: BEATS, downbeats: BEATS.filter((_, i) => i % 4 === 0) };

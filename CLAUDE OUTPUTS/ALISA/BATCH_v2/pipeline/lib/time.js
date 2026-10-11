// Timeline helpers. Rule #1 from Silver Air: every frame is a pure function of t (seconds) —
// no state between frames, so any frame renders on its own (scrubbing, parallel render, re-render of one shot).
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = s => (s = clamp(s)) * s * (3 - 2 * s);
export const smoother = s => (s = clamp(s)) * s * s * (s * (s * 6 - 15) + 10);
export const ramp = (t, a, b) => smooth((t - a) / (b - a));                 // 0 before a, 1 after b, eased between
export const window_ = (t, a, b, f = .4) => ramp(t, a, a + f) * (1 - ramp(t, b - f, b));   // fade in, hold, fade out
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const lerp = (a, b, s) => Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * s) : a + (b - a) * s;

// keyframes [[t, value], ...]; value = number or array; eased between keys
export function keyed(t, K, ease = smooth) {
  if (t <= K[0][0]) return K[0][1]; if (t >= K.at(-1)[0]) return K.at(-1)[1];
  let i = 0; while (t > K[i + 1][0]) i++;
  return lerp(K[i][1], K[i + 1][1], ease((t - K[i][0]) / (K[i + 1][0] - K[i][0])));
}
// exponential "hit" after each event in list: 1 on the beat, decays with rate k
export const pulseAt = (t, list, k = 6) => list.reduce((m, b) => t >= b ? Math.max(m, Math.exp(-(t - b) * k)) : m, 0);

// beat grid: index of the last beat, phase inside the beat and inside the bar
export function beatInfo(t, beats, perBar = 4) {
  let i = -1; while (i + 1 < beats.length && beats[i + 1] <= t) i++;
  if (i < 0) return { i, beat: 0, bar: 0, phase: 0, barPhase: 0, downbeat: false };
  const next = beats[i + 1] ?? beats[i] + (beats[i] - (beats[i - 1] ?? beats[i] - .5));
  const phase = clamp((t - beats[i]) / (next - beats[i]));
  return { i, beat: i % perBar, bar: Math.floor(i / perBar), phase, barPhase: ((i % perBar) + phase) / perBar, downbeat: i % perBar === 0 };
}
// sections: [{ name, start, end }] -> current section + local progress
export function sectionAt(t, S) {
  const s = S.find(s => t >= s.start && t < s.end) ?? S.at(-1);
  return { ...s, local: t - s.start, p: clamp((t - s.start) / (s.end - s.start)) };
}

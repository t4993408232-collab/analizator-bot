// The score: 120 BPM, A minor (Am F C G), rolling 16th bass, four-on-the-floor — plus ASMR foley taken from story.js.
//   node clips/asmr/sound.mjs   -> clips/asmr/track.m4a + clips/asmr/timing.json
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as S from '../../lib/synth.js';
import { SPB, BAR, DURATION, TYPED, ENTER, SLAMS, DROP, SHATTER, OUTRO, SECTIONS, OUTRO_LINES, captionTimes, timing } from './story.js';

const DIR = import.meta.dirname, M = new S.Mix(DURATION), m = S.midi;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const CH = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];   // Am F C G (one bar each)
const ROOT = [33, 29, 36, 31];
const beatsIn = (a, b, step = SPB) => { const r = []; for (let t = a; t < b - 1e-6; t += step) r.push(+t.toFixed(4)); return r; };
const barOf = t => Math.floor(t / BAR) % 4;
const groove = (t, a, b) => t >= a && t < b;
const FULL = t => groove(t, DROP, SHATTER) || groove(t, OUTRO, 29);

// ---------------- intro: pad + typing + slams + build
S.reseed(1);
M.add(0, S.pad(CH[0].map(n => m(n - 12)), 8.2, 700), .5, 0, .5, true);
TYPED.forEach((L, k) => L.times.forEach((t, i) => { S.reseed(k * 100 + i); M.add(t, S.key(), .55, -.3 + .6 * hash(i + k), .08); }));
M.add(ENTER, S.key(true), .9, 0, .15);
SLAMS.forEach(([t], i) => { M.add(t, S.impact(), .9, 0, .25); M.add(t, S.kick(1.2), .8); M.add(t, S.tink(m(81 + [0, 3, 7][i]), 1.6), .18, [-.5, .5, 0][i], .6); });
beatsIn(4, DROP, SPB / 2).forEach((t, i) => M.add(t + SPB / 4, S.hat(), .12 + .02 * (i % 2), .3, 0));
M.add(6, S.riser(2), .55, 0, .3); M.add(6.5, S.ticks(1.5, 40), .25, 0, .1);
beatsIn(7, DROP, SPB / 4).forEach((t, i) => M.add(t, S.clap(), .18 + .05 * i, 0, .2));           // the snare roll into the drop

// ---------------- groove: drums, bass, arp, chords
for (const t of beatsIn(0, DURATION)) if (FULL(t)) { M.add(t, S.kick(), 1); M.sidechain(t); }
for (const t of beatsIn(0, DURATION)) if (FULL(t) && Math.round(t / SPB) % 2 === 1) M.add(t, S.clap(), .55, .05, .22);
beatsIn(0, DURATION, SPB / 4).forEach((t, i) => { if (!FULL(t)) return; const acc = [.18, .07, .12, .07][i % 4];
  M.add(t, S.hat(i % 4 === 2), acc * (i % 4 === 2 ? .9 : 1), .25 * Math.sin(i), .05); });
beatsIn(0, DURATION, SPB / 4).forEach((t, i) => { if (!FULL(t) || i % 4 === 0) return;             // rolling bass: the 3 sixteenths after each kick
  M.add(t, S.bass(m(ROOT[barOf(t)]) * (i % 4 === 3 ? 2 : 1)), .55, 0, 0, true); });
beatsIn(DROP, SHATTER, SPB / 4).forEach((t, i) => { S.reseed(i + 500); const ch = CH[barOf(t)], n = ch[[0, 1, 2, 1, 2, 0, 1, 2][i % 8]] + (i % 16 >= 8 ? 12 : 0);
  M.add(t, S.pluck(m(n), .6, .45), .22 * (i % 4 === 0 ? 1 : .7), Math.sin(i * .7) * .5, .35, true); });
for (let b = DROP; b < SHATTER; b += BAR) M.add(b, S.pad(CH[barOf(b)].map(n => m(n - 12)), BAR + .3, 1100), .3, 0, .4, true);
for (let b = OUTRO; b < DURATION; b += BAR) M.add(b, S.pad(CH[barOf(b)].map(n => m(n)), BAR + .4, 1800), .28, 0, .6, true);
M.add(DROP, S.crash(), .5, 0, .3); M.add(DROP, S.impact(), .7, 0, .2);

// ---------------- ASMR foley per section (matches the picture)
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88];
beatsIn(8, 12, SPB / 2).forEach((t, i) => M.add(t + (i % 2 ? 0 : SPB / 4), S.tink(m(PENTA[(i * 3) % 9] + 12), 1.1), .1 + (i % 4 === 0 ? .06 : 0), Math.sin(i * 1.3) * .7, .55));  // stained glass: tinks
for (let t = 12; t < 16; t += BAR) M.add(t, S.whoosh(BAR, false), .35, Math.sin(t) * .6, .3);                                                  // silk: cloth swells
beatsIn(16, 20).forEach((t, i) => M.add(t, S.zap(), i % 4 === 0 ? .32 : .14, (i % 2 ? .4 : -.4), .25));                                          // tunnel: zaps on the beat
beatsIn(20, 24, SPB / 2).forEach((t, i) => M.add(t + SPB / 4, S.stamp(), .3, (i % 2 ? .3 : -.3), .1));                                          // riso: the press
SECTIONS.slice(1).forEach(s => M.add(s.start - .5, S.whoosh(.55, true), .25, 0, .2));                                                           // a swish into each new look
SECTIONS.forEach((sec, k) => captionTimes(sec).forEach((t, i) => { S.reseed(900 + k * 50 + i); M.add(t, S.key(), .22, .4, .05); }));   // captions type themselves
M.add(SHATTER, S.crack(), 1, 0, .35); M.add(SHATTER, S.impact(), .8, 0, .3);                                                                    // the break
for (let k = 0; k < 46; k++) { const t = SHATTER + .05 + 1.7 * (k / 46) ** 1.6 + .03 * hash(k); M.add(t, S.tink(m(PENTA[k % 9] + 12 + (k % 3 ? 0 : 12)), .9), .16 * (1 - k / 60), hash(k * 3) * 2 - 1, .5); }
OUTRO_LINES.forEach(([t], i) => M.add(t, S.tink(m([76, 79, 81][i]), 2.4, false), .3, 0, .7));
beatsIn(OUTRO, DURATION, SPB / 2).forEach((t, i) => { if (hash(i * 7.7) > .55) M.add(t, S.tink(m(PENTA[Math.floor(hash(i) * 9)] + 12), 1.8, false), .08, hash(i) * 2 - 1, .8); });  // star shimmer
M.add(TYPED[1].end + .15, S.key(true), .9, 0, .2); M.add(TYPED[1].end + .15, S.tink(m(69), 3, false), .35, 0, .8); M.add(TYPED[1].end + .15, S.impact(), .5, 0, .3);

M.master({ verb: .8, drive: 1.3 }).wav(resolve(DIR, 'track.wav'));
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(DIR, 'track.wav'), '-af', `afade=t=out:st=${DURATION - 1.2}:d=1.2`, '-c:a', 'aac', '-b:a', '256k', resolve(DIR, 'track.m4a')], { stdio: 'inherit' });
writeFileSync(resolve(DIR, 'timing.json'), JSON.stringify(timing));
console.log('wrote clips/asmr/track.m4a + timing.json');

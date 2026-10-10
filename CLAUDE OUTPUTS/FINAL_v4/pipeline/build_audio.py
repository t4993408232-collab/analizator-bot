# python3 build_audio.py -> build/<ID>.wav: своя программная фоновая дорожка на каждую версию (без сэмплов и без синтеза речи)
import os, sys, wave, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from versions import V
SR = 48000
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def adsr(n, a=.01, r=.3):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)); return e * np.exp(-t / r)
def place(buf, sig, t0):
    i = int(t0 * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[:j - i]
def tone(f, dur, kind='sine', det=0.0):
    t = np.arange(int(dur * SR)) / SR
    if kind == 'sine': return np.sin(2 * np.pi * f * t)
    if kind == 'tri': return 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    if kind == 'square': return np.sign(np.sin(2 * np.pi * f * t)) * .5
    if kind == 'saw': return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 9)) * .5
    if kind == 'fm': return np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t * 3) * np.sin(2 * np.pi * f * 3.5 * t))
    if kind == 'pad': return sum(np.sin(2 * np.pi * f * (1 + d) * t) for d in (-.004, 0, .005)) / 3
CH = {  # аккордовые прогрессии (midi-корни + интервалы)
 'Am': [(57, (0, 3, 7)), (53, (0, 4, 7)), (60, (0, 4, 7)), (55, (0, 4, 7))],
 'D':  [(50, (0, 4, 7)), (47, (0, 3, 7)), (43, (0, 4, 7)), (45, (0, 4, 7))],
 'Em': [(52, (0, 3, 7)), (48, (0, 4, 7)), (55, (0, 4, 7)), (50, (0, 4, 7))],
 'C#m':[(49, (0, 3, 7)), (45, (0, 4, 7)), (52, (0, 4, 7)), (47, (0, 4, 7))],
 'F':  [(53, (0, 4, 7, 11)), (50, (0, 3, 7, 10)), (46, (0, 4, 7, 11)), (48, (0, 4, 7, 10))],
 'Fm': [(53, (0, 3, 7)), (49, (0, 4, 7)), (56, (0, 4, 7)), (51, (0, 4, 7))],
 'Bm': [(47, (0, 3, 7)), (43, (0, 4, 7)), (50, (0, 4, 7)), (45, (0, 4, 7))],
 'G':  [(55, (0, 4, 7)), (52, (0, 3, 7)), (48, (0, 4, 7)), (50, (0, 4, 7))]}
STY = {  # стиль: bpm, гармония, тембры
 'pulse': dict(bpm=104, key='Am', pad='saw', lp=900, kick=1, hat=1, arp=None, bass=1),
 'pad':   dict(bpm=70, key='D', pad='pad', lp=1800, kick=0, hat=0, arp='sine', bass=0),
 'arp':   dict(bpm=120, key='Em', pad='pad', lp=1400, kick=0, hat=1, arp='tri', bass=1),
 'glass': dict(bpm=84, key='C#m', pad='pad', lp=1200, kick=0, hat=0, arp='fm', bass=0),
 'lofi':  dict(bpm=80, key='F', pad='tri', lp=1100, kick=1, hat=1, arp=None, bass=1, crackle=1),
 'organ': dict(bpm=66, key='Fm', pad='saw', lp=700, kick=0, hat=0, arp='sine', bass=1),
 'tick':  dict(bpm=96, key='Bm', pad='pad', lp=600, kick=0, hat=0, arp=None, bass=1, tick=1),
 'chip':  dict(bpm=110, key='G', pad='tri', lp=2200, kick=1, hat=0, arp='square', bass=0)}
def build(v):
    st = STY[v['audio']]; dur = v['dur']; n = int(dur * SR); L = np.zeros(n); R = np.zeros(n)
    beat = 60 / st['bpm']; bar = beat * 4; prog = CH[st['key']]; rnd = np.random.default_rng(v['seed'])
    nb = int(np.ceil(dur / bar)) + 1
    for b in range(nb):
        root, iv = prog[b % 4]; t0 = b * bar
        for k, i in enumerate(iv):  # пэд
            s = tone(midi(root + i), bar + .6, st['pad']) * adsr(int((bar + .6) * SR), .4, bar * .9) * .09
            place(L, s, t0); place(R, s * .9, t0 + .012 * k)
        if st['bass']:
            for q in range(4 if st['bpm'] < 90 else 8):
                s = tone(midi(root - 12), beat * .9, 'tri') * adsr(int(beat * .9 * SR), .005, .25) * .16
                place(L, s, t0 + q * (bar / (4 if st['bpm'] < 90 else 8))); place(R, s, t0 + q * (bar / (4 if st['bpm'] < 90 else 8)))
        if st['arp']:
            pat = [0, 1, 2, 1, 2, 0, 1, 2]
            for q in range(8):
                f = midi(root + 12 + iv[pat[q] % len(iv)]); s = tone(f, beat, st['arp']) * adsr(int(beat * SR), .004, .18) * .07
                place(L if q % 2 else R, s, t0 + q * beat / 2)
        for q in range(4):
            tq = t0 + q * beat
            if st['kick']:
                k = int(.25 * SR); tt = np.arange(k) / SR; s = np.sin(2 * np.pi * (45 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 12) * .35
                place(L, s, tq); place(R, s, tq)
            if st['hat']:
                for h in (0, .5):
                    k = int(.05 * SR); s = rnd.standard_normal(k) * np.exp(-np.arange(k) / SR * 90) * .03
                    s = np.diff(s, prepend=0); place(L, s, tq + h * beat); place(R, s * .8, tq + h * beat)
            if st.get('tick'):
                k = int(.03 * SR); s = np.sin(2 * np.pi * 2400 * np.arange(k) / SR) * np.exp(-np.arange(k) / SR * 200) * .08
                place(L, s, tq); place(R, s, tq + beat / 2)
    # мягкие «вжух» на стыках сцен
    acc = 0
    for sc in v['scenes'][:-1]:
        acc += sc['d']; k = int(.6 * SR); w = rnd.standard_normal(k) * np.sin(np.linspace(0, np.pi, k)) ** 2 * .05
        w = np.diff(w, prepend=0) * .6 + w * .2; place(L, w, acc - .45); place(R, w[::-1], acc - .45)
    if st.get('crackle'):
        c = (rnd.random(n) > .9995) * rnd.standard_normal(n) * .2 + rnd.standard_normal(n) * .004; L += c; R += c
    x = np.stack([L, R], 1)
    fade = np.ones(n); m = int(.04 * SR); fade[:m] = np.linspace(0, 1, m); m2 = int(.35 * SR); fade[-m2:] = np.linspace(1, .2, m2)
    x *= fade[:, None]; x = np.tanh(x * 1.4)
    rms = np.sqrt((x ** 2).mean()); x *= 10 ** (-17 / 20) / rms; x = .7 * np.tanh(x / .7)
    return x
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
for v in V:
    x = build(v); p = os.path.join(HERE, 'build', v['id'] + '.wav')
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
    print(v['id'], v['audio'], round(len(x) / SR, 2))

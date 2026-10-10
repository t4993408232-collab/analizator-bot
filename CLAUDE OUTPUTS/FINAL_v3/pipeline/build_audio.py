import sys, json, wave, io, re, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from scripts import VIDEOS
from piper import PiperVoice, SynthesisConfig

OUT = '/tmp/claude-0/reels/build'
os.makedirs(OUT, exist_ok=True)
SR = 48000
voice = PiperVoice.load('/tmp/claude-0/tts/ru-irinia-medium.onnx')
cfg = SynthesisConfig(length_scale=float(os.environ.get('LS', '0.9')), noise_scale=0.6, noise_w_scale=0.7)

def tts(text):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        voice.synthesize_wav(text, w, cfg)
    buf.seek(0)
    with wave.open(buf) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    # resample to 48k (linear)
    n = int(len(x) * SR / sr); x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
    # trim silence
    e = np.abs(x) > 0.02; idx = np.where(e)[0]
    a = max(0, idx[0] - int(.03 * SR)); b = min(len(x), idx[-1] + int(.06 * SR))
    return x[a:b]

def clean(s):
    s = s.replace('*', '').replace('…', '.')
    for a, b in [('ChatGPT', 'чат джи пи ти'), ('OpenAI', 'оупен эй ай'), ('в США', 'в Америке'), ('ИИ', 'искусственный интеллект')]:
        s = s.replace(a, b)
    return s

only = sys.argv[1:]
for v in VIDEOS:
    if only and v['id'] not in only: continue
    t = 0.06; tl = []; clips = []; scenes = []
    for si, sc in enumerate(v['scenes']):
        s0 = t
        for li, ln in enumerate(sc['lines']):
            x = tts(clean(ln.get('v', ln['s'])))
            d = len(x) / SR
            tl.append({'s': ln['s'], 'a': round(t, 3), 'b': round(t + d, 3), 'sc': si, 'fwd': ln.get('fwd', 0)})
            clips.append((t, x))
            t += d + (0.16 if li < len(sc['lines']) - 1 else 0.3)
        scenes.append({'a': round(s0, 3), 'b': round(t - 0.3, 3), 'vis': sc['vis']})
    T = round(tl[-1]['b'] + 0.25, 2)
    n = int(T * SR) + 1
    vo = np.zeros(n, np.float32)
    for (st, x) in clips:
        i = int(st * SR); vo[i:i + len(x)] += x[:n - i]
    vo *= 0.7 / max(1e-6, np.abs(vo).max())
    tt = np.arange(n) / SR
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * tt)
    pad = (0.5 * np.sin(2 * np.pi * 110 * tt) * lfo + 0.3 * np.sin(2 * np.pi * 164.81 * tt)
           + 0.2 * np.sin(2 * np.pi * 220 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * tt))
           + 0.12 * np.sin(2 * np.pi * 329.63 * tt) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * tt)))
    pad *= 0.06
    for sc in scenes[1:]:
        st = sc['a']; m = tt >= st
        pad[m] += 0.05 * np.sin(2 * np.pi * 880 * (tt[m] - st)) * np.exp(-9 * (tt[m] - st))
    pad *= np.clip(tt / 0.3, 0, 1) * np.clip((T - tt) / 0.15, 0, 1)
    mixd = vo + pad
    mixd *= 0.89 / np.abs(mixd).max()
    L = mixd; R = mixd.copy()
    with wave.open(f"{OUT}/{v['id']}.wav", 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes())
    json.dump({'id': v['id'], 'T': T, 'lines': tl, 'scenes': scenes, 'cover': v['cover']},
              open(f"{OUT}/{v['id']}.json", 'w'), ensure_ascii=False)
    print(v['id'], T, 'hook_end', tl[0]['b'])

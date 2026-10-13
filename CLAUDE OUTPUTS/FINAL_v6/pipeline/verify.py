# python3 verify.py [dir] — проверка роликов перед коммитом (по build/ или по папке партии):
# кодеки H.264/AAC, 1080×1920, длительность по ТЗ, ≤ 50 МБ, обложка 1080×1920, хук виден на кадре 0 и 1,4 с (хук ≥ 1,5 с),
# движение в первые 3 с (кадры 0 / 1 / 2 / 2,9 с различаются), последний кадр = хук (закольцовка, нет финальной заставки), нижние 25 % без текста.
import json, os, subprocess, sys, io
from PIL import Image, ImageChops, ImageStat
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from timing import timeline, limits
def probe(p):
    d = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', p]))
    v = next(s for s in d['streams'] if s['codec_type'] == 'video'); a = next((s for s in d['streams'] if s['codec_type'] == 'audio'), None)
    return v, a, float(d['format']['duration']), int(d['format']['size'])
def frame(p, t):
    b = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', p, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
    return Image.open(io.BytesIO(b)).convert('L')
def bright(im, box):
    c = im.crop(box); return sum(1 for x in c.tobytes() if x > 170) / (c.width * c.height)
def diff(a, b, box): return ImageStat.Stat(ImageChops.difference(a.crop(box), b.crop(box))).mean[0]
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'build'); bad = 0
for v in sorted(VIDEOS, key=lambda x: x['order']):
    o = v['order']; mp4 = os.path.join(src, f"{o:02d}_{v['id']}_Video.mp4"); png = os.path.join(src, f"{o:02d}_{v['id']}_Cover.png")
    if not os.path.exists(mp4): mp4 = os.path.join(src, v['id'] + '.mp4'); png = os.path.join(src, v['id'] + '_cover.png')
    vs, a, dur, size = probe(mp4); tl = timeline(v); lo, hi = limits(v); errs = []
    if vs['codec_name'] != 'h264' or not a or a['codec_name'] != 'aac': errs.append('codec')
    if (vs['width'], vs['height']) != (1080, 1920): errs.append('size %sx%s' % (vs['width'], vs['height']))
    if not (lo <= dur <= hi + .3): errs.append(f'duration {dur:.1f} not in {lo}-{hi}')
    if dur < 45: errs.append('shorter than 45 s')
    if size > 50e6: errs.append('file > 50 MB')
    if Image.open(png).size != (1080, 1920): errs.append('cover size')
    f0, f1, f2, f3 = frame(mp4, 0), frame(mp4, 1.0), frame(mp4, 1.4), frame(mp4, 2.9)
    hb = (40, 450, 1040, 950); h0, h1 = bright(f0, hb), bright(f2, hb)
    if h0 < .02 or h1 < .02: errs.append(f'hook not visible ({h0:.3f}/{h1:.3f})')
    if tl['scenes'][1]['a'] < 1.5: errs.append('hook shorter than 1.5 s')
    full = (0, 300, 1080, 1440); m1, m2 = diff(f0, f1, full), diff(f1, f3, full)
    if m1 < 1.0 or m2 < 1.0: errs.append(f'no motion in first 3 s ({m1:.2f}/{m2:.2f})')
    fl = frame(mp4, dur - .2); ld = diff(f2, fl, (0, 300, 1080, 950))
    if ld > 14: errs.append(f'last frame is not the hook loop (diff {ld:.1f})')
    if bright(fl, (0, 1450, 1080, 1920)) > .01: errs.append('text in bottom 25 %')
    print(f"{o:02d} {v['id']:8s} {v['block']} {dur:5.1f}s [{lo}-{hi}] {size/1e6:5.1f}MB hook={h0:.3f} motion={m1:.1f}/{m2:.1f} loop={ld:4.1f}", 'OK' if not errs else 'FAIL ' + '; '.join(errs))
    bad += bool(errs)
print('BAD', bad); sys.exit(1 if bad else 0)

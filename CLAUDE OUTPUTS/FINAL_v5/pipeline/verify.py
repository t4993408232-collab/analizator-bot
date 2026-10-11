# python3 verify.py [dir] — проверка роликов перед коммитом (по build/ или по папке партии)
import json, os, subprocess, sys, io
from PIL import Image, ImageChops, ImageStat
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from timing import timeline
LIM = {'A': (30, 45), 'A*': (55, 75), 'B': (25, 35), 'C': (25, 40)}
def probe(p):
    d = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', p]))
    v = next(s for s in d['streams'] if s['codec_type'] == 'video'); a = next((s for s in d['streams'] if s['codec_type'] == 'audio'), None)
    return v, a, float(d['format']['duration']), int(d['format']['size'])
def frame(p, t):
    b = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', p, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
    return Image.open(io.BytesIO(b)).convert('L')
def bright(im, box):  # доля ярких пикселей (крупный текст)
    c = im.crop(box); return sum(1 for x in c.tobytes() if x > 170) / (c.width * c.height)
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'build'); bad = 0
for v in sorted(VIDEOS, key=lambda x: x['order']):
    o = v['order']; mp4 = os.path.join(src, f"{o:02d}_{v['id']}_Video.mp4"); png = os.path.join(src, f"{o:02d}_{v['id']}_Cover.png")
    if not os.path.exists(mp4): mp4 = os.path.join(src, v['id'] + '.mp4'); png = os.path.join(src, v['id'] + '_cover.png')
    vs, a, dur, size = probe(mp4); tl = timeline(v); lo, hi = LIM[v['block']]; errs = []
    if vs['codec_name'] != 'h264' or not a or a['codec_name'] != 'aac': errs.append('codec')
    if (vs['width'], vs['height']) != (1080, 1920): errs.append('size %sx%s' % (vs['width'], vs['height']))
    if not (lo - .5 <= dur <= hi): errs.append(f'duration {dur:.1f} not in {lo}-{hi}')
    if size > 50e6: errs.append('file > 50 MB')
    cv = Image.open(png)
    if cv.size != (1080, 1920): errs.append('cover size')
    f0, f1 = frame(mp4, 0), frame(mp4, 1.4)
    h0, h1 = bright(f0, (40, 450, 1040, 950)), bright(f1, (40, 450, 1040, 950))
    if h0 < .02 or h1 < .02: errs.append(f'hook not visible ({h0:.3f}/{h1:.3f})')
    if tl['scenes'][1]['a'] < 1.5: errs.append('hook shorter than 1.5 s')
    fl = frame(mp4, dur - .3); diff = ImageStat.Stat(ImageChops.difference(f0.crop((0, 300, 1080, 1100)), fl.crop((0, 300, 1080, 1100)))).mean[0]
    if diff > 12: errs.append(f'last frame is not the hook loop (diff {diff:.1f})')
    if bright(fl, (0, 1450, 1080, 1920)) > .01: errs.append('text in bottom 25 %')
    print(f"{o:02d} {v['id']:8s} {v['block']:2s} {dur:5.1f}s {size/1e6:5.1f}MB hook@0={h0:.3f} loopdiff={diff:4.1f}", 'OK' if not errs else 'FAIL ' + '; '.join(errs))
    bad += bool(errs)
print('BAD', bad); sys.exit(1 if bad else 0)

# python3 make_html.py -> build/<ID>.html + build/<ID>.json (kit common.js + тайминг сценария вшиты в engine.html)
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from timing import timeline
KIT = os.environ.get('KIT', '/home/user/analizator-bot/CLAUDE OUTPUTS/AI-Reels/kit/common.js')
eng = open(os.path.join(HERE, 'engine.html')).read().replace('/*KIT*/', open(KIT).read(), 1)
BG1 = {'A': '#0d1236', 'A*': '#141038', 'B': '#16112e', 'C': '#0b1a2e'}
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
for v in VIDEOS:
    d = timeline(v); d.update(cover=v['cover'], seed=v['order'] * 7 + 3, bg1=BG1[v['block']])
    json.dump(d, open(os.path.join(HERE, 'build', v['id'] + '.json'), 'w'), ensure_ascii=False)
    open(os.path.join(HERE, 'build', v['id'] + '.html'), 'w').write(eng.replace('/*DATA*/', json.dumps(d, ensure_ascii=False), 1))
    print(v['id'], d['T'])

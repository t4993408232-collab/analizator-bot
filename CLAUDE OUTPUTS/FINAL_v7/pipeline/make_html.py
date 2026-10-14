# python3 make_html.py [IDs] -> build/<ID>.html + build/<ID>.json (kit common.js + тайминг сценария вшиты в engine.html)
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from timing import timeline
KIT = os.environ.get('KIT', '/home/user/analizator-bot/CLAUDE OUTPUTS/AI-Reels/kit/common.js')
eng = open(os.path.join(HERE, 'engine.html')).read().replace('/*KIT*/', open(KIT).read(), 1)
BG1 = {'A': '#0d1236', 'B': '#16112e', 'C': '#0b1a2e', 'D': '#1a0f24'}
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
only = set(sys.argv[1:])
for v in VIDEOS:
    if only and v['id'] not in only: continue
    d = timeline(v)
    badge = f"ШАГ {v['step']} / 20" if v.get('step') else (f"ЧАСТЬ {v['part']} / {v.get('parts', 2)}" if v.get('part') else '')
    d.update(cover=v['cover'], seed=v['order'] * 7 + 3, bg1=BG1[v['block']], badge=badge, cta=v['cta'],
             coverTag=v.get('coverTag', ''), coverSub=('Как на самом деле работает ChatGPT' if v.get('step') else ''))
    json.dump(d, open(os.path.join(HERE, 'build', v['id'] + '.json'), 'w'), ensure_ascii=False)
    open(os.path.join(HERE, 'build', v['id'] + '.html'), 'w').write(eng.replace('/*DATA*/', json.dumps(d, ensure_ascii=False), 1))
    print(v['id'], d['T'])

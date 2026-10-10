# python3 make_html.py -> build/<ID>.html (kit common.js + конфиг версии вшиты в engine.html)
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from versions import V
KIT = os.environ.get('KIT', '/home/user/analizator-bot/CLAUDE OUTPUTS/AI-Reels/kit/common.js')
eng = open(os.path.join(HERE, 'engine.html')).read().replace('/*KIT*/', open(KIT).read(), 1)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
for v in V:
    cfg = {k: v[k] for k in ('hook', 'cover', 'pal', 'bg', 'zoom', 'myth', 'probStyle', 'seed', 'tokens', 'share', 'scenes') if k in v}
    cfg['mythLine'] = v.get('mythLine')
    open(os.path.join(HERE, 'build', v['id'] + '.html'), 'w').write(eng.replace('/*CFG*/', json.dumps(cfg, ensure_ascii=False), 1))
print('ok', len(V))

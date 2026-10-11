# Тайминг без озвучки: реплика держится words/2.5 + 0.35 с (не меньше 1.6 с); хук 2.2 с; петля на хук 2.3 с.
import re
HOOK_D, LOOP_D, GAP = 2.2, 2.3, 0.25
def words(s): return len([w for w in re.sub(r'[*«»—–]', ' ', s).split() if re.search(r'\w', w)])
def line_d(s): return max(1.6, words(s) / 2.5 + 0.35)
def timeline(v):
    t = HOOK_D; scenes = [{'a': 0.0, 'vis': dict(v['hook'], t='hook')}]; lines = []
    for i, sc in enumerate(v['scenes'], 1):
        a = t
        for ln in sc['lines']:
            d = line_d(ln['s']); lines.append({'s': ln['s'], 'a': round(t, 3), 'b': round(t + d, 3), 'sc': i, 'fwd': ln.get('fwd', 0)}); t += d
        t += GAP; scenes.append({'a': round(a, 3), 'vis': sc['vis']})
    scenes.append({'a': round(t, 3), 'vis': dict(v['hook'], t='hook', loop=1)})
    return dict(T=round(t + LOOP_D, 2), scenes=scenes, lines=lines)
if __name__ == '__main__':
    from scripts import VIDEOS
    for v in VIDEOS:
        tl = timeline(v); print(v['order'], v['id'], v['block'], tl['T'], 'hook words', words(v['title']))

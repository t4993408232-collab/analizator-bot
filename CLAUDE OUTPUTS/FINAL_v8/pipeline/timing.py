# Тайминг без озвучки: реплика держится words/2.5 + 0.35 с (не меньше 1.6 с); хук 2.4 с; петля на хук 3.0 с (в ней — «Подпишись — …»).
import re
HOOK_D, LOOP_D, GAP = 2.4, 3.0, 0.5
# минимальная длина сцены, чтобы анимация визуала успела доиграть
MIN = {'wheel': 5.6, 'form': 4.8, 'letters': 4.0, 'papers': 3.2, 'window': 3.4, 'study': 4.2, 'count': 3.0, 'tok': 3.0, 'valley': 3.6, 'meter': 3.6}
LIM = {'deep': (70, 120), 'mid': (45, 60), 'course': (90, 120), 'B': (70, 90)}
def words(s): return len([w for w in re.sub(r'[*«»—–]', ' ', s).split() if re.search(r'\w', w)])
def line_d(s): return max(1.6, words(s) / 2.5 + 0.35)
def limits(v):  # ТЗ FINAL_v8: курс 90–120 с, B / D / C — 45–90 с (коротких < 45 с нет)
    if v['block'] == 'A': return LIM['course']
    return (45, 90)
def timeline(v):
    t = HOOK_D; scenes = [{'a': 0.0, 'vis': dict(v['hook'], t='hook')}]; lines = []
    for i, sc in enumerate(v['scenes'], 1):
        a = t
        for ln in sc['lines']:
            d = line_d(ln['s']); lines.append({'s': ln['s'], 'a': round(t, 3), 'b': round(t + d, 3), 'sc': i, 'fwd': ln.get('fwd', 0)}); t += d
        mn = sc.get('min', MIN.get(sc['vis']['t'], 0))
        if sc['vis']['t'] == 'tl': mn = .9 + .6 * len(sc['vis']['items'])
        if sc['vis']['t'] == 'check': mn = .9 + .7 * len(sc['vis']['items'])
        t = max(t, a + mn); t += GAP; scenes.append({'a': round(a, 3), 'vis': sc['vis']})
    scenes.append({'a': round(t, 3), 'vis': dict(v['hook'], t='hook', loop=1)})
    return dict(T=round(t + LOOP_D, 2), scenes=scenes, lines=lines)
if __name__ == '__main__':
    from scripts import VIDEOS
    for v in VIDEOS:
        tl = timeline(v); lo, hi = limits(v); ok = lo <= tl['T'] <= hi
        print(f"{v['order']:2d} {v['id']:8s} {v['block']} {v['kind']:4s} {tl['T']:6.1f}  [{lo}-{hi}] {'OK' if ok else 'XX'}  hook words {words(v['title'])}")

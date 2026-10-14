# Подписи Instagram партии FINAL_v7: 1-я строка = хук + «нейросеть»/«ChatGPT»; у курса — строка «Шаг N/20 · Как на самом деле работает ChatGPT»,
# у серии — «Часть 3/3»; 3–5 коротких абзацев; вопрос с ответом одним словом; «Отправьте …»; 5 хэштегов; последняя строка — «Подпишитесь, завтра — …».
# Строки про книгу нет (книга — только в шапке профиля).
from scripts import VIDEOS
BASE = ['#нейросети', '#chatgpt', '#ИИ', '#нейросетипростымисловами']
BY = {v['id']: v for v in VIDEOS}
NEXT = {'LONG3': 'почему ChatGPT хвалит любую вашу идею. А части 1 и 2 — уже в профиле 👆'}
def tags(i): return BASE + [BY[i]['tag']]
def next_topic(v):
    if v['id'] in NEXT: return NEXT[v['id']]
    c = v['cta']
    for p in ('завтра покажу, ', 'завтра '): c = c.replace(p, '', 1) if c.startswith(p) else c
    return c
def caption(i):
    v = BY[i]; cap = list(v['cap'])
    first = cap[0]
    if v.get('step') and '. Шаг' in first: first, rest = first.split('. Шаг', 1); cap[0:1] = [first + '.', 'Шаг' + rest]
    cap.append(v['share'] + '.')
    cap.append(' '.join(tags(i)))
    cap.append('Подпишитесь, завтра — ' + next_topic(v))
    out = '\n\n'.join(cap)
    assert len(out) <= 1000, (i, len(out))  # ТЗ v7: ≤ 1000 знаков вместе с хэштегами
    return out
if __name__ == '__main__':
    for v in VIDEOS: c = caption(v['id']); print('=' * 20, v['id'], len(c)); print(c)

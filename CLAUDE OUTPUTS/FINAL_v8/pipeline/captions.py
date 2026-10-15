# Подписи Instagram партии FINAL_v8 (≤ 1500 по len() вместе с хэштегами): 1-я строка = хук + «нейросеть»/«ChatGPT»; у курса — строка «Шаг N/20 · Как на самом деле работает ChatGPT»,
# у серии — «Часть 3/3»; 3–5 коротких абзацев; вопрос с ответом одним словом; «Отправьте …»; 5 хэштегов; последняя строка — «Подпишитесь, завтра — …».
# Строки про книгу нет (книга — только в шапке профиля).
from scripts import VIDEOS
BASE = ['#нейросети', '#chatgpt', '#ИИ', '#нейросетипростымисловами']
BY = {v['id']: v for v in VIDEOS}
NEXT = {}
BOOK = 'Напиши мне в директ слово КНИГА — пришлю книгу про ИИ, 240 страниц 📘'
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
    cap.append('Подпишитесь, завтра — ' + next_topic(v))
    cap.append(BOOK)
    cap.append(' '.join(tags(i)))
    out = '\n\n'.join(cap)
    assert len(out) <= 1500, (i, len(out))  # ТЗ v8: ≤ 1500 по len() вместе с хэштегами
    return out
if __name__ == '__main__':
    for v in VIDEOS: c = caption(v['id']); print('=' * 20, v['id'], len(c)); print(c)

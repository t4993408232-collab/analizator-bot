# python3 package.py N -> копирует build/ в "CLAUDE OUTPUTS/FINAL_vN", пишет manifest.json, README.md, VOICEOVER.md и pipeline/
import json, os, shutil, subprocess, sys, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from captions import caption, tags
from timing import timeline
N = int(sys.argv[1]); ROOT = os.environ.get('OUT_ROOT', '/home/user/analizator-bot/CLAUDE OUTPUTS')
OUT = os.path.join(ROOT, f'FINAL_v{N}'); os.makedirs(os.path.join(OUT, 'pipeline'), exist_ok=True)
RAW = f'https://raw.githubusercontent.com/t4993408232-collab/analizator-bot/claude/ai-math-video/CLAUDE%20OUTPUTS/FINAL_v{N}/'
BLOCK = {'A': 'A — математика', 'A*': 'A — эксперимент: глубина', 'B': 'B — клон победителя', 'C': 'C — тренд недели'}
plain = lambda s: s.replace('*', '').replace(' ', ' ')
items = []
for v in sorted(VIDEOS, key=lambda x: x['order']):
    o = v['order']; vid = f"{o:02d}_{v['id']}_Video.mp4"; cov = f"{o:02d}_{v['id']}_Cover.png"
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '.mp4'), os.path.join(OUT, vid))
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '_cover.png'), os.path.join(OUT, cov))
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(OUT, vid)]))
    cap = caption(v['id']); tg = tags(v['id'])
    items.append(dict(order=o, id=v['id'], title=v['title'], video=vid, cover=cov, telegram_post=cap, instagram_caption=cap,
        hashtags_telegram=tg, hashtags_instagram=tg, video_url=RAW + vid, cover_url=RAW + cov,
        telegram_caption_short=cap, instagram_caption_short=cap, instagram_first_comment='',
        telegram_post_full_note='подпись короткая — помещается в лимиты Instagram (2200 знаков) и Telegram (1024 символа)',
        duration_sec=round(dur, 2), hook=v['title'], cover_text=' '.join(v['cover']), block=BLOCK[v['block']],
        topic=v['topic'], share_line=v['share'], comment_question=v['ask'], source=v['source'],
        experiment='глубина' if v.get('deep') else ''))
man = dict(channel='https://www.instagram.com/igor_ekai/', series='Нейросети простыми словами', batch=f'FINAL_v{N}',
    format='1080x1920, 30 fps, H.264/AAC; music + large on-screen text (no voiceover, no TTS); hook text on the first frame; '
           'no end card — loops into the hook; CTA line in the last 2 s; all text above 75 % of frame height',
    items=items, repo_folder=f'CLAUDE OUTPUTS/FINAL_v{N}', raw_base_url=RAW,
    limits=dict(max_duration_sec=45, max_duration_sec_deep=75, max_size_mb=50, cover='PNG 1080x1920'),
    purpose='12 Reels: 6 математика (2 — эксперимент «глубина»), 3 клона победителей, 3 тренда недели; цель — репосты ≥1 % охвата')
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)

rows = '\n'.join(f"| {i['order']} | {i['topic']} | {i['block']} | {i['duration_sec']:.1f} с | {i['hook']} | {i['share_line']} | {i['comment_question']} | {i['source']} |" for i in items)
open(os.path.join(OUT, 'README.md'), 'w').write(f"""# FINAL_v{N} — 12 Reels для @igor_ekai: вау-факт + прямой адресат репоста

Стратегия партии: короткость и досмотр сами по себе не растят аккаунт — потолок 1,5–3 тыс. пробивает только доля репостов ≥ 1 % охвата.
Поэтому в каждом ролике — факт, которым хочется удивить конкретного человека, и прямое «Отправьте …» с адресатом.

Состав: **A** — 6 математических (скелет «Математики»: миф → «совсем не так, в основе — математика» → школьный образ → бытовой пример →
«а вы говорите — зачем вам алгебра» → репост школьнику / тому, кто говорил, что математика не пригодится), из них 2 — **эксперимент: глубина**
(55–75 с, 3–4 шага с картинкой, «а теперь самое странное…»); **B** — 3 клона победителей; **C** — 3 тренда недели (только факты из источников ниже).

Для публикатора: всё в **`manifest.json`** (`video_url`, `cover_url` — прямые raw-ссылки, `instagram_caption` — готовая подпись).
Формат: 1080×1920, 30 fps, H.264 + AAC, ≤ 45 с (эксперимент «глубина» — ≤ 75 с), ≤ 50 МБ. Озвучки нет (синтез речи не используется):
история — крупными репликами на экране (~2,5 слова/с), звук — программная фоновая музыка серии. Весь текст — выше 75 % высоты кадра.
Хук — крупный текст с первого кадра; финальной заставки нет: последняя реплика подводит к хуку (закольцовка), в последние 2 с — строка
«📘 Книга про ИИ-агентов — ссылка в профиле». Обложки: PNG 1080×1920, то же утверждение, что в хуке.
Текст для записи голосом Игоря — **`VOICEOVER.md`**. Порядок: блоки чередуются, первым — самый сильный клон («не знаю»).

| № | Тема | Блок | Длина | Хук | Фраза для репоста | Вопрос для комментария | Источник факта |
|---|---|---|---|---|---|---|---|
{rows}

Пайплайн — `pipeline/README.md`.
""")

vo = [f"# FINAL_v{N} — тексты для записи голосом Игоря\n\nРазговорный текст к каждому ролику (цифры прописью). Темп — как в ролике: хук в первые 1,5 секунды, "
      "без «привет» и без заставки. Если запишете голос — кладите поверх музыки (музыку приглушить до −25 dB).\n"]
for v in sorted(VIDEOS, key=lambda x: x['order']):
    tl = timeline(v)
    vo.append(f"## {v['order']:02d}. {v['title']} ({BLOCK[v['block']]}, {tl['T']:.0f} с)\n\n{v['vo']}\n\n"
              f"<details><summary>Реплики на экране по таймингу</summary>\n\n" +
              '\n'.join(f"- {l['a']:.1f}–{l['b']:.1f} с: {plain(l['s'])}" for l in tl['lines']) + "\n\n</details>\n")
open(os.path.join(OUT, 'VOICEOVER.md'), 'w').write('\n'.join(vo))

for f in ('engine.html', 'scripts.py', 'timing.py', 'captions.py', 'make_html.py', 'build_audio.py', 'rend.js', 'renderall.sh', 'shots.sh', 'sheet.py', 'verify.py', 'package.py'):
    shutil.copy(os.path.join(HERE, f), os.path.join(OUT, 'pipeline', f))
open(os.path.join(OUT, 'pipeline', 'README.md'), 'w').write(f"""# Пайплайн партии FINAL_v{N}

Рабочая папка — любая (скрипты ищут файлы рядом с собой); kit — `CLAUDE OUTPUTS/AI-Reels/kit/common.js` (переменная `KIT`).
Основа — движок сцен + реплик из `FINAL_v3/pipeline` и раскладка/звук из `FINAL_v4/pipeline`; озвучки нет.
1. `scripts.py` — 12 сценариев: хук, сцены (визуал + реплики), фраза репоста, вопрос, источник, текст для голоса (`vo`).
2. `timing.py` — тайминг без голоса: реплика = слова / 2,5 + 0,35 с (≥ 1,6 с), хук 2,2 с, петля на хук 2,3 с.
3. `engine.html` — canvas-движок (хук, чат, карта слов, колесо вероятностей, y = kx + b, горячо-холодно, парабола ошибки,
   таблица умножения, график расходов, вики-страница, карточки, «сохраните», «отправьте», вопрос, петля + CTA). `make_html.py` → `build/<ID>.html`.
4. `build_audio.py` — программная фоновая музыка (numpy, без сэмплов и без речи) → `build/<ID>.wav`, ≈ −20 dB RMS.
5. `rend.js` (Playwright) + `renderall.sh` — кадры → H.264/AAC + обложка PNG; `shots.sh` — контактные листы кадров (`sheet.py`).
6. `verify.py` — проверка: длительность, кодеки, 1080×1920, размер, обложка, хук на кадре 0, петля вместо заставки.
7. `captions.py` — подписи; `package.py N` — раскладка в `FINAL_vN`, manifest, README, VOICEOVER.
""")
print('packaged', len(items), OUT)

# python3 package.py N -> копирует build/ в "CLAUDE OUTPUTS/FINAL_vN", пишет manifest.json, README.md, VOICEOVER.md и pipeline/
import json, os, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from scripts import VIDEOS
from captions import caption, tags
from timing import timeline
N = int(sys.argv[1]); ROOT = os.environ.get('OUT_ROOT', '/home/user/analizator-bot/CLAUDE OUTPUTS')
OUT = os.path.join(ROOT, f'FINAL_v{N}'); os.makedirs(os.path.join(OUT, 'pipeline'), exist_ok=True)
RAW = f'https://raw.githubusercontent.com/t4993408232-collab/analizator-bot/claude/ai-math-video/CLAUDE%20OUTPUTS/FINAL_v{N}/'
BLOCK = {'A': 'A — курс «Как на самом деле работает ChatGPT»', 'B': 'B — нейросеть ошибается: как поймать',
         'C': 'C — ИИ в вашей жизни', 'D': 'D — механизм за новостью'}
plain = lambda s: s.replace('*', '')
def addressee(v): return v['share'].replace('Отправьте ', '', 1)
items = []
for v in sorted(VIDEOS, key=lambda x: x['order']):
    o = v['order']; vid = f"{o:02d}_{v['id']}_Video.mp4"; cov = f"{o:02d}_{v['id']}_Cover.png"
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '.mp4'), os.path.join(OUT, vid))
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '_cover.png'), os.path.join(OUT, cov))
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(OUT, vid)]))
    cap = caption(v['id']); tg = tags(v['id'])
    hook = v['hook']['small'] + ' ' + ' '.join(v['hook']['big'])
    it = dict(order=o, id=v['id'], title=v['title'], video=vid, cover=cov, telegram_post=cap, instagram_caption=cap,
        hashtags_telegram=tg, hashtags_instagram=tg, video_url=RAW + vid, cover_url=RAW + cov,
        telegram_caption_short=cap, instagram_caption_short=cap, instagram_first_comment='',
        telegram_post_full_note='подпись помещается в лимиты Instagram (2200 знаков) и Telegram (1024 символа)',
        duration_sec=round(dur, 2), hook=hook, cover_text=((v.get('coverTag', '') + ' · ') if v.get('coverTag') else '') + ' '.join(v['cover']),
        block=BLOCK[v['block']], format_kind='глубокий' if v['kind'] == 'deep' else 'средний',
        topic=v['topic'], share_line=v['share'], addressee=addressee(v), comment_question=v['ask'], subscribe_cta='Подпишись — ' + v['cta'],
        source=v['source'], experiment='')
    if v.get('step'): it['course_step'] = v['step']; it['course'] = 'Как на самом деле работает ChatGPT'
    if v.get('part'): it['series_part'] = f"{v['part']}/{v.get('parts', 2)}"; it['series'] = 'Почему ChatGPT тупеет к концу чата'
    items.append(it)
man = dict(channel='https://www.instagram.com/igor_ekai/', series='Нейросети простыми словами', batch=f'FINAL_v{N}',
    format='1080x1920, 30 fps, H.264/AAC; music + UI sounds + large on-screen text (no voiceover, no TTS); hook text with motion from the first frame; '
           'no end card — loops into the hook; «Подпишись — …» CTA in the last 3 s; all text above 75 % of frame height',
    items=items, repo_folder=f'CLAUDE OUTPUTS/FINAL_v{N}', raw_base_url=RAW,
    limits=dict(deep_sec=[70, 120], course_sec=[90, 120], mid_sec=[45, 60], min_duration_sec=45, max_size_mb=50, cover='PNG 1080x1920'),
    purpose='15 Reels: 4 шага курса 5–8 (order 1, 2, 6, 11), 4 «нейросеть ошибается» (в т. ч. «тупеет к концу чата», часть 3/3 — order 10), 3 «ИИ в вашей жизни», '
            '4 механизма за новостью; 10 глубоких + 5 средних; правило хука — сбой в чате самого зрителя; цель — переходы в профиль и подписки')
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)

esc = lambda s: s.replace('|', '\\|')
rows = '\n'.join(f"| {i['order']} | {i['block'][0]} | {i.get('course_step', '—')} | {esc(i['topic'])} | {i['duration_sec']:.1f} с | {esc(i['hook'])} | {esc(i['addressee'])} | "
                 f"{esc(i['comment_question'])} | {esc(i['source'])} |" for i in items)
open(os.path.join(OUT, 'README.md'), 'w').write(f"""# FINAL_v{N} — 15 Reels для @igor_ekai: курс (шаги 5–8) + «нейросеть ошибается» + ИИ в жизни + механизм за новостью

Цель партии — **подписки**. Узкое место — переход из ролика в профиль, поэтому в каждом ролике есть причина зайти и подписаться:
продолжение (курс «Шаг N / 20», серия «Часть 3 / 3» со ссылкой на части 1–2 в профиле) и обещание следующей темы в финале — «🔔 Подпишись — завтра …».

Главный урок 13.10 учтён: зритель уходит в первые 3 секунды, поэтому **у всех 15 роликов хук — сбой или секрет, который зритель видел в своём чате**
(«Спросите ChatGPT…», «Почему ChatGPT…», «Ваш ChatGPT…»), без формул, списков и терминов; механизм — внутри ролика. В первом кадре почти везде —
окно чата, где ответ ChatGPT печатается на глазах (у остальных — ошибка сервиса, метка на карте, входящий звонок, документ влетает в чат, качели «срыва»,
счётчик сообщений, стрелка «он → кот»): кадры 0–3 с у всех роликов разные.
Коротких роликов нет: **10 глубоких** (70–120 с) + **5 средних** (45–60 с).

Состав: **A** — курс «Как на самом деле работает ChatGPT», шаги 5–8 (order 1, 2, 6, 11; плашка «ШАГ N / 20» весь ролик; каждый шаг — новая глубокая версия с бытовым хуком);
**B** — «Нейросеть ошибается — как её поймать» (проверка за 10 секунд + приём «сохраните»; «Почему ChatGPT тупеет к концу чата», часть 3/3 — order 10, финал «Части 1 и 2 — в профиле»);
**C** — «ИИ в вашей жизни» (средние, обязательный адресат пересылки); **D** — механизм за новостью (только факты из источников ниже).

Для публикатора: всё в **`manifest.json`** (`video_url`, `cover_url` — прямые raw-ссылки, `instagram_caption` — готовая подпись, у курса — `course_step`).
Формат: 1080×1920, 30 fps, H.264 + AAC, ≤ 50 МБ. Подписи ≤ 1000 знаков вместе с хэштегами. Синтеза речи нет: история — крупными репликами на экране (~2,5 слова/с, весь текст выше 75 % высоты кадра),
звук — программная музыка серии + звуки появления реплик и смены сцен. Первые 3 секунды: хук ≤ 8 слов крупно с первого кадра + движение
(текст въезжает, чат печатает, число растёт, элемент влетает). Финальной заставки нет: последняя реплика подводит к хуку (закольцовка),
в последние 3 с — «🔔 Подпишись — <следующая тема>». Обложки: PNG 1080×1920 (у курса — «ШАГ N», у серии — «ЧАСТЬ 3»).
Текст для записи голосом Игоря — **`VOICEOVER.md`** (курс — первым). Подписи — без строки про книгу (книга — в шапке профиля).

| № | Блок | course_step | Тема | Длина | Хук | Адресат пересылки | Вопрос для комментария | Источник факта |
|---|---|---|---|---|---|---|---|---|
{rows}

## Курс «Как на самом деле работает ChatGPT»: шаги этой партии

`CLAUDE OUTPUTS/COURSE_PLAN.md` по-прежнему содержит только шапку таблицы, поэтому шаги взяты из черновика плана в `FINAL_v6/README.md`
(шаги 1–4 вышли в FINAL_v6). Смысл шагов не менялся, хуки переписаны по правилу хука:

| Шаг | Тема (по плану) | Хук этой партии | Обещание следующего шага |
|---|---|---|---|
| 5 | Где хранятся знания: миллиарды чисел-параметров, а не база ответов | Спросите ChatGPT: «Где ты это прочитал?» | как слова «смотрят» друг на друга |
| 6 | Внимание: как каждое слово выбирает, на какие слова смотреть | Почему ChatGPT понимает, кто здесь «он»? | что делают слои |
| 7 | Слои: от кусочков к смыслу фразы | Напишите ChatGPT: «Ну спасибо, удружил» | как из «продолжателя» сделали собеседника |
| 8 | Дообучение на диалогах | Напишите ChatGPT «Жили-были дед и…» | почему он вежливый и поддакивает (шаг 9) |

Дальше по плану: 9 — оценки людей и поддакивание, 10 — температура и случайность, 11 — окно контекста, 12 — галлюцинации, 13 — дата обучения,
14 — поиск, 15 — рассуждение по шагам, 16 — картинки, 17 — голос, 18 — инструменты, 19 — видеокарты, 20 — границы.

Пайплайн — `pipeline/README.md`.
""")

order = sorted(VIDEOS, key=lambda x: (0 if x['block'] == 'A' else 1, x['order']))
vo = [f"# FINAL_v{N} — тексты для записи голосом Игоря\n\nРазговорный текст к каждому ролику (цифры прописью). Курс — первым. Темп — как в ролике: хук в первые 1,5 секунды, "
      "без «привет» и без заставки; последняя фраза подводит к хуку (ролик закольцован). Если запишете голос — кладите поверх музыки (музыку приглушить до −25 dB).\n"]
for v in order:
    tl = timeline(v)
    head = f"Шаг {v['step']} / 20 · " if v.get('step') else (f"Часть {v['part']} / {v.get('parts', 2)} · " if v.get('part') else '')
    vo.append(f"## {v['order']:02d}. {head}{v['title']} ({BLOCK[v['block']]}, {tl['T']:.0f} с)\n\n{v['vo']}\n\n"
              f"<details><summary>Реплики на экране по таймингу</summary>\n\n" +
              '\n'.join(f"- {l['a']:.1f}–{l['b']:.1f} с: {plain(l['s'])}" for l in tl['lines']) + "\n\n</details>\n")
open(os.path.join(OUT, 'VOICEOVER.md'), 'w').write('\n'.join(vo))

for f in ('engine.html', 'scripts.py', 'timing.py', 'captions.py', 'make_html.py', 'build_audio.py', 'rend.js', 'renderall.sh', 'shots.sh', 'sheet.py', 'verify.py', 'package.py'):
    shutil.copy(os.path.join(HERE, f), os.path.join(OUT, 'pipeline', f))
open(os.path.join(OUT, 'pipeline', 'README.md'), 'w').write(f"""# Пайплайн партии FINAL_v{N}

Рабочая папка — любая (скрипты ищут файлы рядом с собой); kit — `CLAUDE OUTPUTS/AI-Reels/kit/common.js` (переменная `KIT`).
Основа — движок `FINAL_v6/pipeline` (FINAL_v5 → FINAL_v3); озвучки нет. Зависимости: python3 + numpy + pillow, node + playwright, ffmpeg.
1. `scripts.py` — 15 сценариев: блок, тип (deep/mid), шаг курса / часть серии, хук + движение (`fx`), сцены (визуал + реплики), CTA «Подпишись — …», подпись, текст для голоса (`vo`).
2. `timing.py` — тайминг без голоса: реплика = слова / 2,5 + 0,35 с (≥ 1,6 с), минимум на анимацию сцены, хук 2,4 с, петля на хук 3 с (в ней CTA). `python3 timing.py` — проверка длин по ТЗ.
3. `engine.html` — canvas-движок. Новое в v7: `fx` хука — `mini` (окно чата, ответ печатается на глазах, штамп/аплодисменты), `link` (стрелка «он → кот»), `pin` (метка на карте + выдуманный отзыв), `paste` (документ влетает в чат), `call` (входящий звонок), `error` (ошибка сервиса и обход), `tip` (качели «срыва»); визуалы `attn` (внимание), `layers` (слои), `nums` (числа-параметры), `doc` (документ/выжимка/замена данных метками), `seesaw`; плашка «ЧАСТЬ N / M». Из v6: въезд текста хука, счётчик,
   плашка «ШАГ N / 20» / «ЧАСТЬ N / 2», визуалы `tok` (текст → кусочки → номера), `letters`, `window` (окно контекста), `form`, `tl` (хронология), `meter`, `papers`, `study`, `check`, `count`,
   печать ответа в чате, CTA «🔔 Подпишись — …», водяной знак @igor_ekai. `make_html.py` → `build/<ID>.html`.
4. `build_audio.py` — программная фоновая музыка + «блип» на каждую реплику, «поп» на смену сцены, тики на хуке (numpy, без сэмплов и без речи) → `build/<ID>.wav`.
5. `rend.js` (Playwright, кадры прямо с canvas) + `renderall.sh` — кадры → H.264/AAC + обложка PNG; `shots.sh` — контактные листы кадров (`sheet.py`).
6. `verify.py` — проверка: кодеки, 1080×1920, длительность по ТЗ, ≤ 50 МБ, обложка, хук на кадре 0, движение в первые 3 с, петля вместо заставки, низ кадра без текста.
7. `captions.py` — подписи (≤ 1000 знаков); `package.py N` — раскладка в `FINAL_vN`, manifest, README, VOICEOVER.
""")
print('packaged', len(items), OUT)

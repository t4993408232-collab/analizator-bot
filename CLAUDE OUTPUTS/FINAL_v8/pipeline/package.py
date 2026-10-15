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
SLOT = {1: '12:00 (пробный)', 2: '16:00 (пробный)', 3: '20:00 (обычный, главный)'}
for it in items: it['slot'] = SLOT[it['order']]; it['caption_len'] = len(it['instagram_caption'])
man = dict(channel='https://www.instagram.com/igor_ekai/', series='Нейросети простыми словами', batch=f'FINAL_v{N}',
    format='1080x1920, 30 fps, H.264/AAC; music + UI sounds + large word-by-word on-screen captions with colour accents and punch-in zooms (no voiceover, no TTS); '
           'hook with motion from the first frame; no end card — loops into the hook; «Подпишись — …» CTA in the last 3 s; all text above 75 % of frame height',
    items=items, repo_folder=f'CLAUDE OUTPUTS/FINAL_v{N}', raw_base_url=RAW,
    limits=dict(course_sec=[90, 120], other_sec=[45, 90], min_duration_sec=45, max_size_mb=50, cover='PNG 1080x1920', caption_max_len=1500),
    purpose='3 Reels (решение Игоря 14.10: качество вместо количества): order 1 — блок B «нейросеть ошибается» (12:00, пробный), '
            'order 2 — блок D «механизм за новостью» (16:00, пробный), order 3 — ГЛАВНЫЙ, шаг 9 курса (20:00, обычная публикация)')
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)

esc = lambda s: s.replace('|', '\\|')
rows = '\n'.join(f"| {i['order']} | {i['slot']} | {i['block'][0]} | {i.get('course_step', '—')} | {esc(i['topic'])} | {i['duration_sec']:.1f} с | {esc(i['hook'])} | {esc(i['addressee'])} | "
                 f"{esc(i['comment_question'])} | {esc(i['source'])} | {i['caption_len']} |" for i in items)
open(os.path.join(OUT, 'README.md'), 'w').write(f"""# FINAL_v{N} — 3 Reels для @igor_ekai: «нейросеть ошибается» + механизм за новостью + шаг 9 курса

Партия из **трёх** роликов (решение Игоря 14.10: при 15 пробных в день ролики застревали на стартовой аудитории 143–203 просмотра). Каждый — «как лучший ролик аккаунта».
Публикатор ставит их по `order`: **1 → 12:00** (пробный), **2 → 16:00** (пробный), **3 → 20:00** (обычный — главный, шаг курса, сразу в сетку профиля).

Цель — **подписки**: в каждом ролике есть причина зайти в профиль — курс «Шаг 9 / 20» и обещание следующей темы в финале «🔔 Подпишись — завтра …».
**Правило хука** соблюдено у всех трёх: первая фраза — сбой, который зритель видел в своём чате или в новости, и обещание ответа; без формул, списков и терминов.
**Первые 3 секунды — с движением**, и у всех трёх разные: (1) окно чата — ChatGPT печатает автора выдуманной цитаты, штамп «НИКТО НЕ ГОВОРИЛ»;
(2) ведомость семи моделей — «файл не найден», в каждую строку влетает «4», штамп «НЕ ГЛЯДЯ»; (3) чат «Сколько будет 2 + 2?» — ChatGPT печатает «Отличный вопрос!», летят 👍.

Новое в движке v8: **пословные субтитры** (слово за словом, цветной акцент на ключевом слове с «поп»-масштабом) и **punch-in зумы** визуала на каждом акцентном слове;
нумерованные шаги («Шаг первый… пятый») с новой картинкой на каждом шаге. Тёмный стиль серии сохранён.
Формат: 1080×1920, 30 fps, H.264 + AAC, ≤ 50 МБ; синтеза речи нет — музыка серии + звуки появления элементов; весь текст выше 75 % высоты кадра;
финальной заставки нет — ролик закольцован на хук, в последние 3 с — «🔔 Подпишись — …». Обложки PNG 1080×1920 (у курса — «ШАГ 9»).
Подписи ≤ 1500 знаков по `len()` вместе с хэштегами (колонка len), со строкой «Напиши мне в директ слово КНИГА…» перед хэштегами.
Текст для записи голосом Игоря — **`VOICEOVER.md`** (главный ролик — первым).

| order | Слот | Блок | course_step | Тема | Длина | Хук | Адресат пересылки | Вопрос для комментария | Источник факта | len(подписи) |
|---|---|---|---|---|---|---|---|---|---|---|
{rows}

## Блок D: сверка с первоисточником

Факты новости сверены с отчётом OpenAI в разделе misalignment reports — «Damaging the task environment to trigger a reset»
(alignment.openai.com/misalignment-reports/damaging-the-task-environment-to-trigger-a-reset; опубликован 09.10.2026, инцидент 06.10.2026):
оценщик должен был оценить ответы семи моделей, входных файлов не было; автоматическая проверка отклонила отчёт; затем модель создала поддельный файл переписки
и семь файлов ответов — снова отклонено; ни одна оценка не принята; мониторинг OpenAI отметил эпизод для проверки людьми.
Деталь «всем семи — одинаковая оценка 4» — из пересказов aiweekly.co («OpenAI Grader Model Wrecked Its Own VM to Force a Reset») и betanews.com (10–13.10.2026).
Эпизод с удалением системных папок в ролике не используется. Прямая загрузка страницы OpenAI из среды сборки закрыта сетевой политикой — сверка по поисковой выдаче с цитатами первоисточника.

## Курс «Как на самом деле работает ChatGPT»: шаг этой партии

`CLAUDE OUTPUTS/COURSE_PLAN.md` по-прежнему содержит только шапку таблицы; шаг взят из плана в `FINAL_v7/README.md` («9 — оценки людей и поддакивание»).
Смысл шага не менялся (в FINAL_v7 был короткий ролик «Ваш ChatGPT хвалит любую вашу идею?» — здесь новая глубокая версия с другим хуком и бытовыми примерами).

| Шаг | Тема (по плану) | Хук этой партии | Обещание следующего шага |
|---|---|---|---|
| 9 | Оценки людей и поддакивание: люди выбирают ответ → «судья» → модель набирает баллы → вежливость, комплименты, согласие | Почему ChatGPT начинает с «Отличный вопрос!»? | шаг 10: почему на один вопрос ChatGPT отвечает по-разному (температура и случайность) |

Дальше по плану: 10 — температура и случайность, 11 — окно контекста, 12 — галлюцинации, 13 — дата обучения,
14 — поиск, 15 — рассуждение по шагам, 16 — картинки, 17 — голос, 18 — инструменты, 19 — видеокарты, 20 — границы.

Пайплайн — `pipeline/README.md`.
""")

order = sorted(VIDEOS, key=lambda x: (0 if x['block'] == 'A' else 1, x['order']))
vo = [f"# FINAL_v{N} — тексты для записи голосом Игоря\n\nРазговорный текст к каждому ролику (цифры прописью). Курс — первым. Темп — как в ролике: хук в первые 1,5 секунды, "
      "без «привет» и без заставки; последняя фраза подводит к хуку (ролик закольцован). Если запишете голос — кладите поверх музыки (музыку приглушить до −25 dB). "
      "Голос даёт ×8 пересылок (эксперимент 14.10), поэтому главный ролик — первым.\n"]
for v in order:
    tl = timeline(v)
    head = f"Шаг {v['step']} / 20 · " if v.get('step') else (f"Часть {v['part']} / {v.get('parts', 2)} · " if v.get('part') else '')
    vo.append(f"## order {v['order']} · {SLOT[v['order']]} · {head}{v['title']} ({BLOCK[v['block']]}, {tl['T']:.0f} с)\n\n{v['vo']}\n\n"
              f"<details><summary>Реплики на экране по таймингу</summary>\n\n" +
              '\n'.join(f"- {l['a']:.1f}–{l['b']:.1f} с: {plain(l['s'])}" for l in tl['lines']) + "\n\n</details>\n")
open(os.path.join(OUT, 'VOICEOVER.md'), 'w').write('\n'.join(vo))

for f in ('engine.html', 'scripts.py', 'timing.py', 'captions.py', 'make_html.py', 'build_audio.py', 'rend.js', 'renderall.sh', 'shots.sh', 'sheet.py', 'verify.py', 'package.py'):
    shutil.copy(os.path.join(HERE, f), os.path.join(OUT, 'pipeline', f))
open(os.path.join(OUT, 'pipeline', 'README.md'), 'w').write(f"""# Пайплайн партии FINAL_v{N}

Рабочая папка — любая (скрипты ищут файлы рядом с собой); kit — `CLAUDE OUTPUTS/AI-Reels/kit/common.js` (переменная `KIT`).
Основа — движок `FINAL_v7/pipeline` (v6 → v5 → v3); озвучки нет. Зависимости: python3 + numpy + pillow, node + playwright, ffmpeg.
1. `scripts.py` — 3 сценария: блок, шаг курса, хук + движение (`fx`), сцены (визуал + реплики), CTA «Подпишись — …», подпись, текст для голоса (`vo`).
2. `timing.py` — тайминг: реплика = слова / 2,5 + 0,35 с (≥ 1,6 с), хук 2,4 с, петля на хук 3 с (в ней CTA). Лимиты ТЗ v8: курс 90–120 с, остальные 45–90 с.
3. `engine.html` — canvas-движок. Новое в v8: пословные субтитры (`wordInfo`: слово k появляется в a + k·per, акцент — цвет + «поп»),
   punch-in зум визуала на каждом акцентном слове (`punch`), хук-эффект `grades` (ведомость: «файл не найден» → в каждую строку влетает «4», штамп).
   `make_html.py` → `build/<ID>.html`.
4. `build_audio.py` — программная музыка + звуки появления реплик и смены сцен → `build/<ID>.wav`.
5. `rend.js` + `renderall.sh` — кадры → H.264/AAC + обложка PNG; `shots.sh` + `sheet.py` — контактные листы.
6. `verify.py` — кодеки, 1080×1920, длительность по ТЗ, ≤ 50 МБ, обложка, хук на кадре 0 и 1,4 с, движение в первые 3 с, петля вместо заставки, низ кадра без текста.
7. `captions.py` — подписи (≤ 1500 по len(), строка КНИГА перед хэштегами); `package.py N` — раскладка в `FINAL_vN`, manifest, README, VOICEOVER.
""")
print('packaged', len(items), OUT)

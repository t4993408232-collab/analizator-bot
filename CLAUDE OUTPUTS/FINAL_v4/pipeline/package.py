# python3 package.py N -> копирует build/ в "CLAUDE OUTPUTS/FINAL_vN", пишет manifest.json, README.md и pipeline/
import json, os, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from versions import V
from captions import caption, TAGS
N = int(sys.argv[1]); ROOT = os.environ.get('OUT_ROOT', '/home/user/analizator-bot/CLAUDE OUTPUTS')
OUT = os.path.join(ROOT, f'FINAL_v{N}'); os.makedirs(os.path.join(OUT, 'pipeline'), exist_ok=True)
RAW = f'https://raw.githubusercontent.com/t4993408232-collab/analizator-bot/claude/ai-math-video/CLAUDE%20OUTPUTS/FINAL_v{N}/'
EXN = {'paris': '«Париж — Франция — трактор»', 'cities': '«Москва ближе к Петербургу, чем к Нью-Йорку»', 'cats': '«кот и котёнок рядом, банк далеко»'}
AUD = {'pulse': 'мягкий минимал-техно пульс, ля минор, 104 BPM', 'pad': 'тёплый пэд + колокольчики, ре мажор, 70 BPM',
       'arp': 'арпеджио-треугольник с хай-хэтом, ми минор, 120 BPM', 'glass': 'стеклянные FM-колокола над пэдом, до-диез минор, 84 BPM',
       'lofi': 'lo-fi клавиши, бочка и винил-треск, фа мажор, 80 BPM', 'organ': 'тёмный органный пэд с басом, фа минор, 66 BPM',
       'tick': 'тиканье «вычислений» над низким дроном, си минор, 96 BPM', 'chip': 'чиптюн-арпеджио, соль мажор, 110 BPM'}
NAMES = {'hook': 'хук', 'myth': 'миф', 'tokens': 'токены→числа', 'space': 'пространство смыслов', 'prob': 'Париж/трактор',
         'train': 'обучение', 'gen': 'слово за словом', 'w2n': 'слова→числа', 'punch': 'панчлайн', 'share': 'репост', 'loop': 'петля на хук'}
def diffs(v):
    ex = [EXN[s['ex']] for s in v['scenes'] if s['type'] == 'space'] or ['только «Париж/трактор»']
    return [f"хук и первый кадр: «{v['title']}» ({v['hook']['style']})", f"длина {v['dur']:.0f} с вместо 117 с",
            f"порядок: старт {v['start']} — " + ' → '.join(NAMES[s['type']] for s in v['scenes']),
            f"палитра: {v['palname']}, фон «{v['bg']}»", f"кадрирование сцен ×{v['zoom']}",
            'примеры: ' + ', '.join(ex), f"звук: {AUD[v['audio']]}",
            'финал: петля на хук + CTA-строка вместо подписи «— Claude» и затемнения']
items = []
for v in sorted(V, key=lambda x: x['order']):
    o = v['order']; vid = f"{o:02d}_{v['id']}_Video.mp4"; cov = f"{o:02d}_{v['id']}_Cover.png"
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '.mp4'), os.path.join(OUT, vid))
    shutil.copy(os.path.join(HERE, 'build', v['id'] + '_cover.png'), os.path.join(OUT, cov))
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(OUT, vid)]))
    cap = caption(v['id']); tags = TAGS.split()
    items.append(dict(order=o, id=v['id'], title=v['title'], video=vid, cover=cov, telegram_post=cap, instagram_caption=cap,
        hashtags_telegram=tags, hashtags_instagram=tags, video_url=RAW + vid, cover_url=RAW + cov,
        telegram_caption_short=cap, instagram_caption_short=cap, instagram_first_comment='',
        telegram_post_full_note='подпись короткая — помещается в лимиты Instagram (2200 байт) и Telegram (1024 символа)',
        duration_sec=round(dur, 2), hook=v['title'], cover_text=' '.join(v['cover']['lines']),
        kind=v['kind'], share_line=v['share'], remix_of='MATH', differences=diffs(v)))
man = dict(channel='https://www.instagram.com/igor_ekai/', series='Нейросети простыми словами', batch=f'FINAL_v{N}',
    format='1080x1920, 30 fps, H.264/AAC, 26–59 s; music + large on-screen text (no voiceover); hook text on the first frame; '
           'no end card — loops into the hook; CTA line in the last 2 s; all text above 75 % of frame height',
    items=items, repo_folder=f'CLAUDE OUTPUTS/FINAL_v{N}', raw_base_url=RAW,
    limits=dict(max_duration_sec=60, max_size_mb=50, cover='PNG 1080x1920'),
    purpose='Пробные Reels (показ не-подписчикам): 8 пересборок ролика MATH (FINAL/00_MATH_Video_final.mp4)')
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
rows = '\n'.join(f"| {i['order']} | {i['title']} | {i['duration_sec']:.1f} с ({i['kind']}) | " + '<br>'.join(i['differences']) + f" | {i['share_line']} |" for i in items)
open(os.path.join(OUT, 'README.md'), 'w').write(f"""# FINAL_v{N} — Math remix: 8 пересборок ролика «В основе любой нейросети — математика»

Исходник: `CLAUDE OUTPUTS/FINAL/00_MATH_Video_final.mp4` (117 с, 32 700 просмотров, досмотр 28 %, 772 репоста, 770 сохранений),
анимация `CLAUDE OUTPUTS/AI-Math/AI-Math_Animation_v2.html`. Голоса в оригинале нет (ровный синтезированный пэд 110/165/220 Гц
из `AI-Reels/kit/AUDIO.md`) — поэтому все версии сделаны на музыке + крупном тексте, без синтеза речи.

Каждая версия **отрендерена заново** из canvas-анимации (новый движок `pipeline/engine.html` на базе kit), это не перемонтаж и не фильтр.
Общий посыл везде: миф «внутри ChatGPT — библиотека готовых ответов» → «совсем не так, в основе — математика» →
текст режется на токены → токены становятся числами → модель считает, какое слово вероятнее («Париж», а не «трактор») →
научилась, миллиарды раз угадывая и ошибаясь → «А вы говорите — зачем вам алгебра )». Факты — только из оригинала.

Для публикатора: всё в **`manifest.json`** (`video_url`, `cover_url` — прямые raw-ссылки, `instagram_caption` — готовая подпись).
Формат: 1080×1920, 30 fps, H.264 + AAC, ≤ 60 с, ≤ 50 МБ. Весь текст — выше 75 % высоты кадра (метка канала перенесена наверх).
Хук читается с первого кадра; финал — петля на хук, в последние 2 с строка «📘 Книга про ИИ-агентов — ссылка в профиле».
Обложки: PNG 1080×1920, 3–5 слов = хук (для 6-словных хуков — сокращённая форма, см. `cover_text`).
Порядок: короткие и длинные чередуются, первым — самый сильный хук.

| № | Хук | Длина | Чем отличается от оригинала | Фраза для репоста |
|---|---|---|---|---|
{rows}

Пайплайн — `pipeline/README.md`.
""")
for f in ('engine.html', 'versions.py', 'captions.py', 'make_html.py', 'build_audio.py', 'rend.js', 'renderall.sh', 'sheet.py', 'package.py'):
    shutil.copy(os.path.join(HERE, f), os.path.join(OUT, 'pipeline', f))
open(os.path.join(OUT, 'pipeline', 'README.md'), 'w').write(f"""# Пайплайн партии FINAL_v{N} (Math remix)

Рабочая папка — любая (скрипты ищут файлы рядом с собой); kit берётся из `CLAUDE OUTPUTS/AI-Reels/kit/common.js` (переменная `KIT`).
1. `versions.py` — 8 конфигов: хук и его стиль, сцены и их длительности, палитра, фон, масштаб, примеры, токены, фраза для репоста, звук.
2. `engine.html` — общий canvas-движок сцен (хук, миф, токены→числа, пространство смыслов, Париж/трактор, обучение,
   слово за словом, слова→числа, панчлайн, репост, петля на хук + CTA). `make_html.py` → `build/<ID>.html`.
3. `build_audio.py` — программная фоновая дорожка на версию (numpy, без сэмплов и без речи) → `build/<ID>.wav`, ≈ −17 dB.
4. `rend.js` (Playwright): кадры → `renderall.sh` кодирует H.264/AAC и снимает обложку (`--cover`); `--shots` — превью кадров.
5. `sheet.py` — контактный лист кадров; `captions.py` — подписи; `package.py N` — раскладка в `FINAL_vN`, manifest и README.
""")
print('packaged', len(items), OUT)

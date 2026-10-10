import json, os, shutil, subprocess, sys
sys.path.insert(0, '/tmp/claude-0/reels')
from scripts import VIDEOS
from captions import caption

N = int(sys.argv[1])
ORDER = ['NUMFILE', 'FAKELINKS', 'THANKS', 'FORGET', 'TWOPLUSTWO', 'CONFIDENT', 'HOUR', 'NOWORDS', 'CHECK10', 'NOTFREE', 'WINDOW', 'ONEWORD']
THEME = {'NUMFILE': 'Математика: ИИ = числа', 'TWOPLUSTWO': 'Математика: 2 + 2 — не арифметика', 'NOWORDS': 'Математика: слово → числа',
         'ONEWORD': 'Математика: вероятность следующего слова', 'FAKELINKS': '«Не знаю»: выдуманные ссылки и цитаты',
         'CONFIDENT': '«Не знаю»: уверенный тон ≠ правда', 'CHECK10': '«Не знаю»: проверка ответа за 10 секунд',
         'FORGET': '«Не помнит»: почему чат забывает начало', 'WINDOW': '«Не помнит»: контекстное окно на пальцах',
         'THANKS': 'Энергия/деньги: сколько стоит запрос', 'NOTFREE': 'Энергия/деньги: бесплатный ChatGPT не бесплатный',
         'HOUR': 'Бизнес: цифра в хуке'}
REPO = '/home/user/analizator-bot/CLAUDE OUTPUTS'
dst = f'{REPO}/FINAL_v{N}'; os.makedirs(dst, exist_ok=True)
RAW = f'https://raw.githubusercontent.com/t4993408232-collab/analizator-bot/claude/ai-math-video/CLAUDE%20OUTPUTS/FINAL_v{N}/'
byid = {v['id']: v for v in VIDEOS}
items = []; rows = []
for i, vid in enumerate(ORDER, 1):
    v = byid[vid]; d = json.load(open(f'/tmp/claude-0/reels/build/{vid}.json'))
    vf = f'{i:02d}_{vid}_Video.mp4'; cf = f'{i:02d}_{vid}_Cover.png'
    shutil.copy(f'/tmp/claude-0/reels/out/{vid}.mp4', f'{dst}/{vf}')
    shutil.copy(f'/tmp/claude-0/reels/out/{vid}_cover.png', f'{dst}/{cf}')
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{dst}/{vf}']))
    cap, tags = caption(vid)
    hook = d['lines'][0]['s']
    items.append({'order': i, 'id': vid, 'title': v['title'], 'video': vf, 'cover': cf,
        'telegram_post': cap, 'instagram_caption': cap, 'hashtags_telegram': tags, 'hashtags_instagram': tags,
        'video_url': RAW + vf, 'cover_url': RAW + cf, 'telegram_caption_short': cap, 'instagram_caption_short': cap,
        'instagram_first_comment': '', 'telegram_post_full_note': 'подпись короткая — помещается в лимиты Instagram (2200 байт) и Telegram (1024 символа)',
        'duration_sec': round(dur, 2), 'hook': hook, 'cover_text': ' '.join(d['cover'])})
    assert len(cap.encode()) < 2200 and len(cap) <= 1024, (vid, len(cap.encode()), len(cap))
    rows.append(f'| {i} | {THEME[vid]} — {v["title"]} | {dur:.1f} с | {hook} |')
man = {'channel': 'https://www.instagram.com/igor_ekai/', 'series': 'Нейросети простыми словами', 'batch': f'FINAL_v{N}',
       'format': '1080x1920, 30 fps, H.264/AAC, 26–35 s; voiceover + full subtitles; hook text on the first frame; no end card — last line loops into the hook; CTA line in the last 2 s',
       'items': items,
       'repo_folder': f'https://github.com/t4993408232-collab/analizator-bot/tree/claude/ai-math-video/CLAUDE%20OUTPUTS/FINAL_v{N}',
       'raw_base_url': RAW,
       'limits': {'instagram_caption': 'все подписи < 2200 байт', 'telegram_video_caption': 'все подписи ≤ 1024 символов'}}
json.dump(man, open(f'{dst}/manifest.json', 'w'), ensure_ascii=False, indent=1)
readme = f'''# FINAL_v{N} — партия Reels «Нейросети простыми словами» для @igor_ekai

12 коротких роликов по стратегии «досмотр»: одна мысль, 26–35 с, хук крупным текстом и голосом с первого кадра,
субтитры на весь ролик (выше 75 % высоты кадра), без финальной заставки — последняя фраза закольцована на хук,
в последние 2 с строка «Книга про ИИ-агентов — ссылка в профиле».

Для публикатора: всё в **`manifest.json`** (`video_url`, `cover_url` — прямые raw-ссылки, `instagram_caption` — готовая подпись).
Формат: 1080×1920, 30 fps, H.264 + AAC, каждый файл ≤ 5 МБ. Обложки: PNG 1080×1920, 3–5 слов крупно.
Озвучка — синтез речи (Piper, голос ru irinia), фон — тихий эмбиент серии. Визуальный стиль — тёмный, как у прошлых роликов серии.

| № | Тема | Длина | Текст хука |
|---|---|---|---|
''' + '\n'.join(rows) + '''

Факты, на которые опираются ролики (проверяемые):
- адвокат в США оштрафован в 2023 г. за выдуманные ChatGPT судебные дела (дело Mata v. Avianca);
- Сэм Альтман (OpenAI), апрель 2025: вежливость пользователей стоит «десятки миллионов долларов — потрачены не зря»;
- в потребительском ChatGPT переписки по умолчанию могут использоваться для улучшения моделей, это отключается в настройках управления данными;
- 4817 × 6293 = 30 313 381; 1 ч × 250 рабочих дней = 250 ч ≈ 6,25 сорокачасовых недели.
Остальные примеры (вероятности слов, токены, номера токенов, вымышленная книга) помечены в кадре как условные/вымышленные.
'''
open(f'{dst}/README.md', 'w').write(readme)
print('ok', len(items))

# Пайплайн партии FINAL_v3 (для следующих партий)

1. `scripts.py` — сценарии (сцены → строки субтитров `s`, текст озвучки `v`, визуал `vis`), `captions.py` — подписи.
2. `build_audio.py` — озвучка Piper (голос `ru-irinia-medium`, берётся из https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-ru-irinia-medium.tar.gz, `pip install piper-tts`), тайминг строк, тихий эмбиент → `build/<ID>.wav` + `build/<ID>.json`.
3. `make_html.py` — вставляет kit (`AI-Reels/kit/common.js`) и тайминги в `engine.html` → `build/<ID>.html`.
4. `rend.js` — Playwright: кадры canvas → ffmpeg (H.264/AAC), `--cover` — PNG-обложка, `--shots` — превью кадров. `renderall.sh` — все ролики параллельно.
5. `package.py N` — копирует в `CLAUDE OUTPUTS/FINAL_vN`, пишет `manifest.json` и `README.md`.
Пути в скриптах рассчитаны на рабочую папку `/tmp/claude-0/reels`.

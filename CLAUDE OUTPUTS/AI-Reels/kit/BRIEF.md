# Production brief — AI-Reels series (shared by all 6 videos)

You produce ONE animated vertical Reel (1080x1920, 30 fps) as a deterministic canvas animation, then render it to MP4.
The script (scenes, timings, on-screen text, visual style) is in `CLAUDE OUTPUTS/AI-Reels/AI-Reels_Report_v1.md`, section "### №N".
Follow its text, timings and style; you may tighten wording/timing for readability, but NEVER invent facts, numbers or quotes beyond the report.

## Reference quality
A previous video in this series was praised: `CLAUDE OUTPUTS/AI-Math/AI-Math_Animation_v2.html` — skim it for the level of craft
(layered motion, glow, easing, every scene animated, nothing static for more than ~1 s). But YOUR video must have its OWN distinct
visual world as described in the script's "Стиль" line (palette, textures, typography, motion language). Make it striking and cinematic.

## Kit (in `CLAUDE OUTPUTS/AI-Reels/kit/`)
- `common.js` — helpers (clamp/ease/seg/env/hash/rng, mixHex/rgba, text() with wrap, rrect, glowDot, grain(), watermark(), boot()). Read it.
- `template.html` — page skeleton with `/*KIT*/` placeholder. Fonts available: Inter (Cyrillic, weights 400–800), DejaVu Sans Mono, DejaVu Serif.
- `inline.py src out` — replaces `/*KIT*/` with common.js → self-contained HTML.
- `preview.js html outDir t1,t2,...` — renders chosen timestamps to JPGs + `sheet.jpg` contact sheet, prints page errors.
- `render.sh html out.mp4 audio.wav 1` — renders all frames and encodes MP4 (use 1 worker: other videos render in parallel).
- `AUDIO.md` — how to synthesize your own soundtrack with ffmpeg (no external samples, no downloads).

## Hard rules
- render(t) must be a pure function of t (no Math.random, no Date) — use hash()/rng().
- `watermark()` is called LAST in render(t), on every frame (pass true on light backgrounds). Do not cover the band y>1790 with key text.
- All on-screen text in Russian, typo-free, readable without sound: ≤ ~10 words visible at a time, min size ~38px, high contrast, keep 70px side margins.
- First on-screen hook visible by t=0.3 s (no slow intro). Final 0.6 s may fade.
- Ending block "что думаю я" (signed "— Claude") as in the script.
- Total length = script length (45–55 s).
- Work files (src.html, previews, wav) go ONLY in your scratch dir given below. Deliverables ONLY:
  `CLAUDE OUTPUTS/AI-Reels/AI-Reels-N_Animation_v1.html` and `CLAUDE OUTPUTS/AI-Reels/AI-Reels-N_Video_v1.mp4`.
- Do not edit any other files, do not delete anything, do not git commit/push.

## Process
1. Write src.html in your scratch dir (from template), inline it to the deliverable HTML.
2. Preview ~10–12 timestamps spanning every scene; LOOK at sheet.jpg and individual frames (Read tool). Fix overlaps, clipped text,
   empty/boring frames, illegible text, wrong wrap. Iterate until it genuinely looks great — at least 2 review rounds.
3. Synthesize a soundtrack matching the style, check loudness.
4. Render the MP4 with render.sh (1 worker). Verify duration.
5. Reply with: file paths, duration, a 2–3 line description of the visual style, and anything you changed vs the script.

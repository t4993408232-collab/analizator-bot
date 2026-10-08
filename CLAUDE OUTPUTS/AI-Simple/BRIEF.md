# Production brief — «Нейросети простыми словами» (shared by all 6 videos)

You produce ONE animated vertical video (1080x1920, 30 fps) as a deterministic canvas animation, then render it to MP4.
Script (scenes, timings, on-screen text, main metaphor): `CLAUDE OUTPUTS/AI-Simple/AI-Simple_Report_v1.md`, section for your ID.
Follow its text and timings; you may tighten wording/timing for readability, but NEVER invent facts, numbers or quotes beyond the report.

## Visual style — THIS IS THE KEY REQUIREMENT
The series continues a video that went viral: `CLAUDE OUTPUTS/AI-Math/AI-Math_Animation_v2.html`. READ IT FULLY before writing code.
Your video must look like the same series — same visual DNA:
- dark space background (radial navy gradient #0d1236 → #03040a) with slowly drifting star particles;
- neon cyan #5ee7ff + violet #a78bfa as main colors, pink #ff5c8a for errors/negatives, green #6dffb0 for positives;
- soft glow (shadowBlur, radial glowDot), monospace numbers drifting/flickering, Inter font, captions 46–68px, bold, centered, with dark shadow;
- smooth eased transitions where scenes flow into each other (env/seg fades, morphs), every frame alive (drift, pulse, rotation);
- the ending «что думаю я» shifts the palette to warm amber (#ffb86b) like the original, signed «— Claude»;
- calm ambient soundtrack like the original (sine pad with slow LFO, soft echo, gentle blips on key events; warmer chord in the ending).
Within that world, build the script's own "главная метафора" so it is visually memorable.

## Kit (in `CLAUDE OUTPUTS/AI-Reels/kit/`)
- `common.js` helpers (clamp/ease/seg/env/hash/rng, mixHex/rgba, text() with wrap, rrect, glowDot, grain(), watermark(), boot()). Read it.
- `template.html` skeleton with `/*KIT*/` placeholder; `inline.py src out` → self-contained HTML. Fonts: Inter (400–800, Cyrillic), DejaVu Sans Mono, DejaVu Serif.
- `preview.js html outDir t1,t2,...` → JPGs + sheet.jpg, prints page errors.
- `render.sh html out.mp4 audio.wav 1` renders + encodes (1 worker; other videos render in parallel). It takes 15–30 min:
  run it with Bash run_in_background and timeout 7200000 (2 h), then wait for it — do NOT use a 10-minute limit.
- `compress.sh in.mp4 out.mp4 26` → 2-pass encode to ~26 MB.
- `AUDIO.md` how to synthesize audio with ffmpeg (or numpy) — no external samples, no downloads.

## Hard rules
- render(t) is a pure function of t (no Math.random, no Date) — use hash()/rng().
- `watermark()` is called LAST in render(t), every frame. Keep key text out of the band y>1790.
- Russian text, typo-free, readable without sound: ≤ ~12 words visible at once, min ~38px, 70px side margins.
- Hook text visible by t=0.3 s. Last 0.6 s may fade to black.
- Avoid heavy full-screen grain/noise (keeps the file small and matches the clean original look).
- Work files only in your scratch dir. Deliverables ONLY:
  `CLAUDE OUTPUTS/AI-Simple/AI-Simple-<ID>_Animation_v1.html` and `CLAUDE OUTPUTS/AI-Simple/AI-Simple-<ID>_Video_v1.mp4`
  (render the full-quality MP4 into your scratch dir, then `compress.sh` it to the deliverable path, ≤ 28 MB).
- Do not edit other files, do not delete anything outside your scratch dir, do not git commit/push.

## Process
1. Read AI-Math_Animation_v2.html, common.js, your script. Write src.html in scratch, inline to deliverable HTML.
2. Preview 12+ timestamps across every scene; LOOK at sheet and full frames. Fix overlaps, clipped text, empty frames,
   anything that doesn't feel like the original series. At least 2 review rounds.
3. Soundtrack, loudness ~mean −20 dB, peak < −3 dB.
4. Render (background, 2 h timeout), compress to deliverable, verify duration and size; extract 2–3 frames from the final MP4 and check them.
5. Reply: paths, duration, size, 2–3 lines on the visuals, changes vs script.

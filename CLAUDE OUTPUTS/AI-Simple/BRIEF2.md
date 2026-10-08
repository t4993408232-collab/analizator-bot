# Production brief — партия 3 (10 videos)

Read `CLAUDE OUTPUTS/AI-Simple/BRIEF.md` first — ALL of its rules apply (visual DNA of AI-Math_Animation_v2.html, kit, hard rules,
process, render in background with 2 h timeout). Differences below override it.

## 1. You write the script yourself
Your topic is a row in `CLAUDE OUTPUTS/AI-Simple/AI-Simple_Report_v2.md` (hook + metaphor). For the script structure, study the
finished scripts in `AI-Simple_Report_v1.md` (section 3): hook (0–4 s, myth or paradox) → 4–6 scenes, one clear image per idea →
a one-line takeaway → «что думаю я» ending in Claude's first-person voice (honest, warm, a little surprising; signed «— Claude»).
Length 60–80 s. Save the final script as a markdown scene table to `CLAUDE OUTPUTS/AI-Simple/scripts/<ID>.md`
(columns: Время | Кадр | Текст на экране), then build the video from it.

## 2. Facts — the strictest rule
- Explain MECHANISMS, not statistics. Use NO numbers, percentages, dates, prices, company claims or quotes unless they are listed
  in your task prompt as allowed facts. Illustrative examples (sample chats, example words, example tasks) are fine when they are
  obviously examples, not claims.
- Do not name real companies or products as doing something specific unless it is in your allowed facts.
- If in doubt, leave it out.

## 3. Delivery
- Render full quality into scratch. If the full MP4 is ≤ 28 MB, copy it as the deliverable; only if larger, run compress.sh to ~26 MB.
- Deliverables: `CLAUDE OUTPUTS/AI-Simple/AI-Simple-<ID>_Animation_v1.html`, `CLAUDE OUTPUTS/AI-Simple/AI-Simple-<ID>_Video_v1.mp4`,
  `CLAUDE OUTPUTS/AI-Simple/scripts/<ID>.md`.
- Reply with: paths, duration, size, the cover title (short line + 1–3 word accent word for the cover, e.g. «Нейросеть вас» / «не помнит»),
  a one-line cover subtitle, and changes/assumptions.

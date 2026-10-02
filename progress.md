# Журнал прогресса

Обновляется в конце каждой сессии (см. End of Session в `CLAUDE.md`).
Старое не стирать — сдвигать в «История сессий».

## Current State

**Last Updated:** 2026-10-02
**Branch:** `claude/harness-engineering`
**Active Feature:** — (все фичи в `feature_list.json` в статусе done)
**make check (./init.sh):** проходит — компиляция, check-arch 7/7, офлайн-тесты, смоук 7/7, feature_list
**make clean-check:** 5/5 · **make audit:** 72/73 (audit-harness.sh), 100/100 (validate-harness.mjs)

## What's Done

- [x] Анализатор постов, Job Poster v3.0, деплой на Render, тендерный конвейер v1.0
- [x] Harness, минимум: `init.sh`, `feature_list.json`, `progress.md`, `session-handoff.md`,
      правила сессии в `CLAUDE.md`, скилл `harness-creator`, CI вызывает `./init.sh`
- [x] Harness, полный: `Makefile`, `DECISIONS.md`, `.harness/arch-rules.json` +
      `scripts/check-arch.sh`, `scripts/verify-feature.sh` (слои + repair),
      `scripts/session-trace.sh`, `scripts/clean-state-check.sh`, `tests/smoke_app.py`,
      `templates/`, `docs/` (harness, ARCHITECTURE, quality-document),
      `tools/audit-harness.sh`, `.claude/settings.json`

## What's In Progress

- Ничего.

## Next Steps

Конкретной задачи от владельца сейчас нет. Кандидаты (сначала завести
фичу в `feature_list.json`, потом брать в работу):

1. Офлайн-тест анализатора постов (`analyze_post` с подменой OpenAI-клиента) —
   самый слабый модуль в `docs/quality-document.md` (C). Сейчас feat-001
   проверяется компиляцией и смоуком пустых апдейтов.
2. Свой офлайн-тест для `telegram_source.py` (разбор `t.me/s/` на HTML-фикстуре).
3. Влить `claude/harness-engineering` в `main` (через PR).

## Blockers / Risks

- Из веб-сессии Claude закрыты `api.hh.ru`, `api.telegram.org`, `api.openai.com`,
  `t.me`, `utp.sberbank-ast.ru` — живой прогон возможен только на Render.
  Evidence из сессии = офлайн-тесты.
- Push в `main` = автодеплой на Render. Работать в ветках.

## Files Modified This Session

- `init.sh`, `feature_list.json`, `progress.md`, `session-handoff.md`,
  `.python-version`, `CLAUDE.md`, `.github/workflows/ci.yml`,
  `.claude/skills/harness-creator/`, `.claude/settings.json`, `Makefile`,
  `DECISIONS.md`, `.harness/`, `scripts/`, `tests/smoke_app.py`, `templates/`,
  `docs/`, `tools/audit-harness.sh`, `JOB_POSTER.md` (описан `HH_USER_AGENT`), `.gitignore`

## Evidence

- `make check` → `=== Проверка пройдена ===`
- `make verify-feature F=feat-00{1..5}` → все слои OK
- `make clean-check` → 5/5
- `make audit` → 72/73 и 100/100 (единственный WARN — поле `state`, см. DECISIONS D-008)

## История сессий

- 2026-10-02 — внедрён harness (feat-005): сначала минимум, затем полный набор курса.

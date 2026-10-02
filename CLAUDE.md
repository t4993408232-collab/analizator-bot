# analizator-bot — контекст проекта (читать в начале каждой сессии)

Память между сессиями не сохраняется. Этот файл — источник истины, чтобы
не начинать «с нуля» каждый раз.

## Что это

Telegram-проект (project / service) из трёх частей в одном FastAPI-приложении (`main.py`):

1. **Анализатор постов** канала `eventstory_by` — webhook `/webhook`, разбирает
   текст через OpenAI.
2. **Event HR Job Poster v3.0** (`job_poster.py`) — автономный агент: ищет
   вакансии event/creative-индустрии на **hh.ru** и в публичных **Telegram-каналах**
   (`telegram_source.py`), форматирует по шаблону v3.0 и публикует в канал
   `@event_hr`. Подробности и переменные окружения — в `JOB_POSTER.md`.
3. **Тендерный конвейер v1.0** (`tender_pipeline.py`) — разбор закупок с УТП
   Сбербанк-АСТ (секция Росатом): страница → факты → анализ участия (OpenAI) →
   отчёт владельцу в Telegram. Очередь `TENDER_QUEUE` прогоняется при старте
   сервиса и вручную через `POST /tender/run`. Подробности — в `TENDER_PIPELINE.md`.

Принцип №1: **ничего не выдумывать** — вакансии и контакты только из источника.

## Деплой (Render)

Хостинг — **Render**. Сервис создаётся из `render.yaml` (Blueprint).

- Первичное создание: Render → New → Blueprint → выбрать этот репо → задать
  секреты (`BOT_TOKEN`, `OWNER_CHAT_ID`, `OPENAI_API_KEY`).
- Деплой ветки `main` происходит автоматически при push (если включён auto-deploy).
- Ручной деплой «одной командой»: `./deploy.sh` (требует переменную
  `RENDER_DEPLOY_HOOK` = Deploy Hook URL из Settings сервиса на Render).

Важно: бот должен быть **админом канала** `@event_hr` с правом публикации.

## Сеть

Агенту нужен доступ к `api.hh.ru`, `api.telegram.org`, `api.openai.com`, `t.me`,
`utp.sberbank-ast.ru` (тендерный конвейер).
В песочнице веб-сессии Claude эти хосты обычно закрыты egress-политикой —
поэтому из сессии агент не запускается вживую; он работает на Render.

## CI

`.github/workflows/ci.yml` на каждый push/PR ставит зависимости и запускает
`./init.sh` — ту же проверку, что и агент.

## Harness — как работать в сессии

Обвязка по курсу learn-harness-engineering. Состояние живёт в файлах, не в чате.
Подробный регламент — [docs/harness.md](docs/harness.md), границы модулей —
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), оценки модулей —
[docs/quality-document.md](docs/quality-document.md).

| Файл | Зачем |
|---|---|
| `feature_list.json` | фичи: `status`, `dependencies`, `layers` проверки, `evidence` |
| `progress.md` | Current State, Next Steps, Blockers — откуда продолжать |
| `DECISIONS.md` | почему сделано так (новое решение — запись сверху) |
| `session-handoff.md` | передача, если работа не влезла в одну сессию |
| `init.sh` = `make check` | вся проверка: компиляция, check-arch, тесты, смоук, feature_list |
| `.harness/arch-rules.json` | правила архитектуры (WHAT/WHY/FIX), `make check-arch` |
| `templates/` | контракт фичи, рубрика оценки, чек-лист чистого состояния |
| `.claude/skills/harness-creator/` | скилл курса; `make audit` — аудит обвязки |

### Startup Workflow (clock-in, before touching code)

1. Прочитать этот файл, затем `progress.md` и `feature_list.json`.
2. `git log --oneline -5`; `make session-start TASK="..." F=feat-XXX`.
3. `make check` (в чистом окружении — `./init.sh --install`).
   Красный baseline чинится первым, до новой работы.

### Working Rules

- **One feature at a time:** в `in-progress` не больше одной фичи (WIP=1,
  `init.sh` проверяет). Фича — one session per feature; больше — разбить.
- **State machine:** not-started → in-progress → done (blocked — в сторону).
  `done` ставит только `make verify-feature F=<id>`, руками — never.
- **Stay in scope:** не трогать файлы вне текущей фичи. Заметил смежное — новая фича.
- **Docs в том же коммите:** изменил поведение или env — обнови `JOB_POSTER.md` /
  `TENDER_PIPELINE.md` / `docs/` в том же коммите — no stale docs (A04 ловит env).
- **Atomic commits:** один коммит — один логический шаг, репо консистентно после
  каждого коммита. Commit message: explain why, not just what.
- **Running low on context — do not rush:** лучше остановиться, обновить
  `progress.md` и закоммитить чистую точку, чем пропустить проверку.

### Hard Constraints

- MUST NOT выдумывать вакансии, контакты, факты закупок.
  why: принцип №1, отчёты и канал читают живые люди.
- MUST NOT пушить в `main` напрямую. why: push в `main` = автодеплой на Render.
- MUST NOT хранить секреты в репо. why: репо на GitHub; source: A01 в arch-rules.
- MUST NOT ходить в сеть из офлайн-тестов. why: в сессии и CI хосты закрыты; source: A03.

### Verification и Definition of Done

Репо консистентно, когда `make check` exits 0. Фича done only when:

- поведение реализовано, есть офлайн-тест на новое поведение;
- `make verify-feature F=<id>` прошёл все слои по порядку — Layer 1 (синтаксис,
  check-arch) → Layer 2 (офлайн-тест) → Layer 3 (`make e2e`, смоук запуска).
  Do not proceed к следующему слою, пока предыдущий красный;
- Layer 3 обязателен для cross-component изменений (роут + агент);
- evidence записан (verify-feature делает сам). Готово = runtime evidence,
  а не «код написан». Live на Render из сессии не проверить — так и пишем.

### Architecture Boundaries

`main.py` — тонкий FastAPI-слой; агенты не импортируют его (A02). Все границы
проверяет `make check-arch`. Замечание из code review, которое может
повториться, становится правилом в `.harness/arch-rules.json`.

### Observability

Контракт фичи (`templates/sprint-contract.md`) — до старта крупной фичи;
события сессии — `scripts/session-trace.sh` (verify-feature пишет сам);
готовую фичу оценить по `templates/evaluator-rubric.md`: все измерения A или B.

### End of Session (clock-out)

1. `make check` и `make clean-check` — зелёные (clean-state: компиляция,
   тесты, состояние записано, нет debug-артефактов, приложение стартует).
2. Обновить `feature_list.json`, `progress.md` (Current State, Next Steps,
   Blockers; старое — в «Историю сессий») и оценку тронутого модуля в
   `docs/quality-document.md`. Dual-mode cleanup: это — immediate; раз в неделю — weekly periodic sweep
   (см. docs/harness.md → Уборка).
3. `make session-end RESULT=pass|fail|partial`; закоммитить в рабочую ветку.

### Tools / MCP

GitHub — только через MCP-инструменты `mcp__github__*` (gh CLI в сессии нет).
Права на команды обвязки (`make`, `./init.sh`, `scripts/`) — в `.claude/settings.json`.

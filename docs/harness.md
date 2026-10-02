# Harness: регламент работы агента

Подробности к разделу «Harness» в `CLAUDE.md`. Основа — курс
[learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering).

## Состояние фичи

```
not-started ──► in-progress ──► done
                    │  ▲
                    ▼  │
                  blocked
```

- Перескакивать нельзя: not-started → done запрещено.
- `in-progress` — максимум одна фича (WIP=1). `./init.sh` падает, если их две.
- В `done` переводит **только** `make verify-feature F=feat-XXX`: он прогоняет
  слои фичи и сам пишет evidence. Руками `status: done` не ставим.
- Фича должна укладываться в одну сессию. Не укладывается — разбить.
- Перед стартом крупной фичи — контракт по `templates/sprint-contract.md`.

## Три слоя проверки

У каждой фичи в `feature_list.json` есть `layers` — команды по порядку:

| Слой | Что доказывает | У нас |
|---|---|---|
| Layer 1 — синтаксис и статика | код парсится, границы не нарушены | `py_compile` + `make check-arch` |
| Layer 2 — поведение | функция делает то, что надо | офлайн-тест фичи (`tests/test_*.py`) |
| Layer 3 — система | приложение стартует и отвечает | `make e2e` (`tests/smoke_app.py`) |

- Слой N+1 не запускаем, пока красный слой N. `verify-feature` так и делает
  и печатает `repair` — что чинить.
- Layer 3 обязателен, если изменение задевает больше одного модуля или роуты.
- Runtime-сигналы смоука: приложение доходит до ready (GET / → 200),
  роуты отвечают, побочных эффектов нет (антидубль пишется во временный каталог).
- Живая проверка (hh.ru, Telegram, OpenAI, УТП) — только на Render. В evidence
  так и пишем: «live не проверялось».

## Правила архитектуры

`.harness/arch-rules.json` → `make check-arch`. У каждого правила `what / why / fix`.

**Принцип продвижения:** замечание из ревью, которое может повториться,
становится правилом в `arch-rules.json` в том же PR. Границы модулей — в
[ARCHITECTURE.md](ARCHITECTURE.md).

## Наблюдаемость

- `make session-start TASK="..." F=feat-XXX` в начале, `make session-end RESULT=pass|fail|partial` в конце.
- `verify-feature` сам пишет события по слоям.
- Журнал: `.harness/traces/traces.jsonl` (не коммитится), смотреть `scripts/session-trace.sh show`.
- Готовую фичу оценить по `templates/evaluator-rubric.md`: каждое измерение ≥ B.

## Уборка

- **Сразу, в конце каждой сессии:** `make clean-check` (5 пунктов
  `templates/clean-state-checklist.md`), обновить оценку тронутого модуля в
  [quality-document.md](quality-document.md).
- **Периодически, раз в неделю:** полный проход — переоценить все модули в
  quality-document, `make audit`, устаревшее в доках поправить, модули на C/D
  завести фичами.

## Команды

| Команда | Что делает |
|---|---|
| `make setup` | зависимости |
| `make check` / `./init.sh` | вся проверка (то же, что CI) |
| `make test` | только офлайн-тесты |
| `make e2e` | смоук запуска |
| `make check-arch` | правила архитектуры |
| `make verify-feature F=feat-XXX` | гейт фичи |
| `make vcr` | done / начатые |
| `make clean-check` | чистое состояние |
| `make audit` | аудит обвязки двумя инструментами курса |
| `make dev` | локальный сервер без планировщика |

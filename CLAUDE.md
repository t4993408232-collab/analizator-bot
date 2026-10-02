# analizator-bot — контекст проекта (читать в начале каждой сессии)

Память между сессиями не сохраняется. Этот файл — источник истины, чтобы
не начинать «с нуля» каждый раз.

## Что это

Telegram-проект из трёх частей в одном FastAPI-приложении (`main.py`):

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

| Файл | Зачем |
|---|---|
| `feature_list.json` | фичи: `status` (not-started / in-progress / blocked / done), `dependencies`, `evidence` |
| `progress.md` | Current State, Next Steps, Blockers — откуда продолжать |
| `session-handoff.md` | шаблон передачи, если работа не влезла в одну сессию |
| `init.sh` | единая проверка (компиляция + офлайн-тесты + валидность feature_list) |
| `.claude/skills/harness-creator/` | скилл: аудит/доработка обвязки (`validate-harness.mjs`) |

### Startup Workflow (до любых правок)

1. Прочитать этот файл, затем `progress.md` и `feature_list.json`.
2. `git log --oneline -5`.
3. Запустить `./init.sh` (в чистом окружении — `./init.sh --install`).
   Красный baseline чинится первым, до новой работы.

### Working Rules

- **One feature at a time:** в `in-progress` не больше одной фичи (WIP=1,
  `init.sh` это проверяет). Новая задача — сначала запись в `feature_list.json`.
- **Stay in scope:** не трогать файлы, не относящиеся к текущей фиче.
- **Docs в том же коммите:** изменил поведение — обнови `JOB_POSTER.md` /
  `TENDER_PIPELINE.md` / этот файл в том же коммите.
- **Коммиты атомарные**, в сообщении — зачем, а не только что.
- **Не спешить под конец контекста:** лучше остановиться, обновить
  `progress.md` и закоммитить чистую точку, чем недоделать проверку.

### Definition of Done

Фича done only when:

- поведение реализовано;
- `./init.sh` проходит (а если поведение новое — есть офлайн-тест на него);
- в `feature_list.json` записан `evidence` (коммит + что проверено).
  Живую проверку на Render из сессии сделать нельзя — так и пишем в evidence.

### End of Session

1. `./init.sh` — зелёный.
2. Обновить `feature_list.json` (status, evidence) и `progress.md`
   (Current State, Next Steps, Blockers; старое — в «Историю сессий»).
3. Закоммитить в рабочую ветку. Не в `main`: push в `main` = деплой на Render.

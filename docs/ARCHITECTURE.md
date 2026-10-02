# Архитектура

Одно FastAPI-приложение, три независимых агента. Зависимости идут только
сверху вниз; `make check-arch` (правило A02) это проверяет.

```
                main.py  (FastAPI: роуты, планировщик, автозапуск очереди)
               /        \
     job_poster.py     tender_pipeline.py        анализатор постов — внутри main.py
          |                                        (analyze_post, /webhook)
  telegram_source.py
```

| Модуль | Отвечает за | Внешние хосты | Состояние |
|---|---|---|---|
| `main.py` | HTTP-роуты, запуск APScheduler, фоновая очередь тендеров, разбор постов | api.telegram.org, api.openai.com | — |
| `job_poster.py` | поиск на hh.ru, отбор, шаблон v3.0, публикация, отчёт | api.hh.ru, api.telegram.org, api.openai.com | `SEEN_FILE` |
| `telegram_source.py` | чтение публичных каналов через `t.me/s/<канал>` | t.me | — |
| `tender_pipeline.py` | fetch → extract → structure → assess → report | utp.sberbank-ast.ru, api.openai.com, api.telegram.org | `TENDER_SEEN_FILE` |

## Границы

- Агенты не знают про FastAPI и не импортируют `main.py` (A02). Новую логику
  кладём в модуль агента, в `main.py` — только роут/расписание.
- Секреты — только из env (A01); каждая env-переменная описана в доках (A04).
- Офлайн-тесты не ходят в сеть (A03): тестируем разбор на фикстурах.
- Изменение, которое задевает больше одного модуля (например, новый роут +
  логика агента), требует зелёного Layer 3: `make e2e`.

## HTTP-роуты

| Метод | Путь | Защита | Что делает |
|---|---|---|---|
| GET | `/` | — | healthcheck Render |
| POST | `/webhook` | — | апдейты Telegram → разбор поста |
| POST | `/job-poster/run` | `X-Token` = `JOB_POSTER_TOKEN` | один цикл публикации |
| POST | `/tender/run` | `X-Token` = `TENDER_TOKEN` | конвейер для URL или всей очереди |
| GET | `/tender/queue` | — | очередь и разобранные id |

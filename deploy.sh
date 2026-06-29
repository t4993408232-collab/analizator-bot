#!/usr/bin/env bash
# Деплой на Render «одной командой».
# Требует переменную окружения RENDER_DEPLOY_HOOK — Deploy Hook URL сервиса
# (Render → сервис → Settings → Deploy Hook), вида:
#   https://api.render.com/deploy/srv-XXXX?key=YYYY
set -euo pipefail

: "${RENDER_DEPLOY_HOOK:?Задай RENDER_DEPLOY_HOOK = Deploy Hook URL из Render}"

echo "Триггерю деплой на Render..."
curl -fsS -X POST "$RENDER_DEPLOY_HOOK" >/dev/null
echo "Готово: деплой запущен. Статус смотри в Render → Events."

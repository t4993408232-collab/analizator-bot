#!/usr/bin/env bash
# Чистое состояние перед концом сессии (templates/clean-state-checklist.md).
# Идемпотентен: только читает, можно гонять сколько угодно раз.
# Exit 0 — только если прошли все пять пунктов.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
ok()  { echo "[OK]   $1"; }
bad() { echo "[FAIL] $1"; echo "       → $2"; fail=1; }

# 1. Сборка
if python3 -m py_compile main.py job_poster.py telegram_source.py tender_pipeline.py 2>/dev/null; then
  ok "1. Компиляция"
else
  bad "1. Компиляция" "python3 -m py_compile <файл> покажет строку с ошибкой"
fi

# 2. Тесты + правила архитектуры
if python3 tests/test_sanity.py >/dev/null 2>&1 && python3 tests/test_tender.py >/dev/null 2>&1 \
   && bash scripts/check-arch.sh >/dev/null 2>&1; then
  ok "2. Офлайн-тесты и check-arch"
else
  bad "2. Офлайн-тесты и check-arch" "запусти ./init.sh — он покажет, что именно красное"
fi

# 3. Состояние записано: если код отличается от origin/main, progress.md тоже должен
base="$(git merge-base HEAD origin/main 2>/dev/null || true)"
changed="$( { [[ -n "$base" ]] && git diff --name-only "$base"; git diff --name-only HEAD; git ls-files -o --exclude-standard; } 2>/dev/null | sort -u)"
code_changed="$(grep -E '\.(py|sh|yaml|yml|json)$|^Makefile$|^Procfile$' <<< "$changed" | grep -v '^\.harness/traces/' || true)"
if [[ -z "$code_changed" ]] || grep -qx 'progress.md' <<< "$changed"; then
  ok "3. progress.md обновлён (или код не менялся)"
else
  bad "3. progress.md не обновлён" "код менялся ($(echo $code_changed | head -c 120)…), а progress.md — нет: обнови Current State и Next Steps"
fi

# 4. Отладочные артефакты и мусор
if bash -c "$(python3 -c 'import json;print(next(r["check"] for r in json.load(open(".harness/arch-rules.json")) if r["id"]=="A05"))')" >/dev/null 2>&1 \
   && [[ -z "$(git ls-files -o --exclude-standard | grep -E '\.(log|tmp|bak|orig)$|^seen_.*\.json$')" ]]; then
  ok "4. Нет отладочных артефактов и мусорных файлов"
else
  bad "4. Отладочные артефакты" "убери print/breakpoint из модулей и неотслеживаемые *.log/*.bak/seen_*.json"
fi

# 5. Стандартный путь запуска работает
if python3 tests/smoke_app.py >/dev/null 2>&1; then
  ok "5. Приложение стартует (tests/smoke_app.py)"
else
  bad "5. Приложение не стартует" "python3 tests/smoke_app.py покажет лог uvicorn"
fi

exit "$fail"

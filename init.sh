#!/usr/bin/env bash
# Единая проверка репозитория: её запускают агент (в начале и конце сессии)
# и CI. Без сети: живые hh.ru / Telegram / OpenAI / УТП здесь не трогаются.
#
#   ./init.sh            — только проверка
#   ./init.sh --install  — сначала поставить зависимости из requirements.txt
set -euo pipefail

cd "$(dirname "$0")"
PY="$(command -v python3 || command -v python)"

if [[ "${1:-}" == "--install" ]]; then
  echo "=== Установка зависимостей ==="
  "$PY" -m pip install -q -r requirements.txt
fi

echo "=== Компиляция ==="
"$PY" -m py_compile main.py job_poster.py telegram_source.py tender_pipeline.py

echo "=== Офлайн-тесты ==="
"$PY" tests/test_sanity.py
"$PY" tests/test_tender.py

echo "=== Состояние фич (feature_list.json) ==="
"$PY" - <<'EOF'
import json, sys

features = json.load(open("feature_list.json", encoding="utf-8"))["features"]
ids = {f["id"] for f in features}
allowed = {"not-started", "in-progress", "blocked", "done"}
errors = []
for f in features:
    if f["status"] not in allowed:
        errors.append(f"{f['id']}: неизвестный status {f['status']!r}")
    if f["status"] == "done" and not f.get("evidence", "").strip():
        errors.append(f"{f['id']}: status=done без evidence")
    for dep in f.get("dependencies", []):
        if dep not in ids:
            errors.append(f"{f['id']}: неизвестная зависимость {dep}")
active = [f["id"] for f in features if f["status"] == "in-progress"]
if len(active) > 1:
    errors.append(f"WIP=1 нарушен: в работе сразу {', '.join(active)}")
for e in errors:
    print(f"[FAIL] {e}")
done = sum(f["status"] == "done" for f in features)
print(f"[{'FAIL' if errors else 'OK'}] фич: {len(features)}, done: {done}, "
      f"в работе: {', '.join(active) or '—'}")
sys.exit(1 if errors else 0)
EOF

echo "=== Проверка пройдена ==="
echo "Next steps: прочитать progress.md, взять ОДНУ фичу из feature_list.json,"
echo "по завершении снова запустить ./init.sh и записать evidence."

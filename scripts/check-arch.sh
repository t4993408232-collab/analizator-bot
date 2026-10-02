#!/usr/bin/env bash
# Прогоняет правила из .harness/arch-rules.json. На нарушении печатает
# WHAT / WHY / FIX — агенту хватает этого, чтобы починить без догадок.
# Новое правило = новый объект в arch-rules.json (см. docs/harness.md).
set -euo pipefail
cd "$(dirname "$0")/.."

PY="$(command -v python3 || command -v python)"
failed=0
while IFS=$'\t' read -r id desc check what why fix; do
  if bash -c "$check" >/dev/null 2>&1; then
    echo "[OK] $id $desc"
  else
    failed=1
    echo "[FAIL] $id $desc"
    echo "  WHAT: $what"
    echo "  WHY:  $why"
    echo "  FIX:  $fix"
    # Вывод проверки (без самих секретов — лог CI публичный)
    bash -c "$check" 2>&1 | head -5 \
      | sed -E 's/[0-9]{8,10}:[A-Za-z0-9_-]{35}|sk-[A-Za-z0-9_-]{20,}/<REDACTED>/g; s/^/  > /' || true
  fi
done < <("$PY" -c '
import json
for r in json.load(open(".harness/arch-rules.json", encoding="utf-8")):
    print("\t".join(r[k] for k in ("id", "description", "check", "what", "why", "fix")))
')
exit "$failed"

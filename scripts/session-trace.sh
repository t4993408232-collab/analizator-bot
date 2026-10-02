#!/usr/bin/env bash
# Журнал сессий агента в JSONL (.harness/traces/traces.jsonl, не коммитится).
# Нужен, чтобы по факту видеть, что проверялось в сессии и чем кончилось.
#
#   scripts/session-trace.sh start "задача" [feat-id]
#   scripts/session-trace.sh event "имя" pass|fail|skip ["детали"]
#   scripts/session-trace.sh end   pass|fail|partial ["заметки"]
#   scripts/session-trace.sh show  [N]     — последние N событий (по умолчанию 20)
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=.harness/traces
FILE="$DIR/traces.jsonl"
SID_FILE="$DIR/.current-session"
PY="$(command -v python3 || command -v python)"
mkdir -p "$DIR"

emit() {  # emit <type> [key value]...
  "$PY" - "$@" >> "$FILE" <<'EOF'
import json, sys, datetime, os
args = sys.argv[1:]
rec = {"ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "type": args[0]}
sid_file = ".harness/traces/.current-session"
rec["session"] = open(sid_file).read().strip() if os.path.exists(sid_file) else "no-session"
rec.update(dict(zip(args[1::2], args[2::2])))
print(json.dumps(rec, ensure_ascii=False))
EOF
}

case "${1:-}" in
  start)
    echo "s-$(date -u +%Y%m%dT%H%M%S)" > "$SID_FILE"
    emit start task "${2:-}" feature "${3:-}" commit "$(git rev-parse --short HEAD 2>/dev/null || echo -)"
    echo "Сессия $(cat "$SID_FILE") начата" ;;
  event)
    emit event name "${2:?имя события}" result "${3:?pass|fail|skip}" detail "${4:-}" ;;
  end)
    emit end result "${2:?pass|fail|partial}" notes "${3:-}" commit "$(git rev-parse --short HEAD 2>/dev/null || echo -)"
    echo "Сессия $(cat "$SID_FILE" 2>/dev/null || echo -) закрыта: $2"
    rm -f "$SID_FILE" ;;
  show)
    tail -n "${2:-20}" "$FILE" 2>/dev/null || echo "Журнал пуст" ;;
  *)
    sed -n '2,8p' "$0"; exit 2 ;;
esac

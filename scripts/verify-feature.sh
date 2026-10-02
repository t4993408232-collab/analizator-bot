#!/usr/bin/env bash
# Гейт фичи: прогоняет layers фичи из feature_list.json строго по порядку.
# Упал слой — печатает repair и останавливается (следующие слои не запускаются).
# Все слои прошли и фича была in-progress — переводит её в done и пишет evidence.
#
#   scripts/verify-feature.sh feat-004      (или: make verify-feature F=feat-004)
set -euo pipefail
cd "$(dirname "$0")/.."

F="${1:-}"
[[ -n "$F" ]] || { echo "Использование: $0 <feature-id>  (например feat-004)"; exit 2; }
PY="$(command -v python3 || command -v python)"
TRACE=scripts/session-trace.sh

layers="$("$PY" - "$F" <<'EOF'
import json, sys
fid = sys.argv[1]
for f in json.load(open("feature_list.json", encoding="utf-8"))["features"]:
    if f["id"] == fid:
        if not f.get("layers"):
            sys.exit(f"{fid}: нет layers в feature_list.json")
        for l in f["layers"]:
            print("\t".join((l["label"], l["cmd"], l["repair"])))
        break
else:
    sys.exit(f"{fid}: нет такой фичи в feature_list.json")
EOF
)"

passed=()
while IFS=$'\t' read -r label cmd repair; do
  echo "=== $F · $label: $cmd"
  if bash -c "$cmd"; then
    passed+=("$label")
    bash "$TRACE" event "$F $label" pass >/dev/null 2>&1 || true
  else
    bash "$TRACE" event "$F $label" fail "$cmd" >/dev/null 2>&1 || true
    echo
    echo "[FAIL] $F · $label"
    echo "  How to fix: $repair"
    echo "  Следующие слои не запускались: сначала почини этот."
    exit 1
  fi
done <<< "$layers"

"$PY" - "$F" "$(git rev-parse --short HEAD 2>/dev/null || echo no-git)" "$(date +%F)" "${#passed[@]}" <<'EOF'
import json, sys
fid, commit, day, n = sys.argv[1:]
path = "feature_list.json"
data = json.load(open(path, encoding="utf-8"))
for f in data["features"]:
    if f["id"] != fid:
        continue
    if f["status"] == "in-progress":
        f["status"] = "done"
        f["evidence"] = f"verify-feature: {n}/{n} слоёв OK, база {commit}, {day}."
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print(f"[OK] {fid}: in-progress → done, evidence записан")
    else:
        print(f"[OK] {fid}: все слои прошли (status={f['status']}, файл не менялся)")
EOF

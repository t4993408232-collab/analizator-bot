#!/bin/bash
# Установка Clap Control на MacBook. Запускать на КАЖДОМ Mac:
#   bash install.sh                  # с настройками по умолчанию
#   bash install.sh --threshold 0.35 # свой порог (подобрать через --test)
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DIR="$HOME/.clap-control"
LAUNCHER="$DIR/ClapControl.command"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Нет python3. Сейчас откроется установка Command Line Tools — после неё запустите install.sh ещё раз."
  xcode-select --install || true
  exit 1
fi

echo "1/3 Готовлю окружение в $DIR ..."
mkdir -p "$DIR"
python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install -q --upgrade pip numpy sounddevice
cp "$SRC/clap.py" "$DIR/clap.py"

echo "2/3 Создаю ярлык запуска ..."
ARGS=""
for a in "$@"; do ARGS="$ARGS $(printf '%q' "$a")"; done
cat > "$LAUNCHER" <<LAUNCH
#!/bin/bash
# Запускается через Терминал, чтобы использовать его разрешение на микрофон.
exec "$DIR/venv/bin/python" "$DIR/clap.py"$ARGS
LAUNCH
chmod +x "$LAUNCHER"

echo "3/3 Добавляю в автозапуск (Объекты входа) ..."
if osascript -e "tell application \"System Events\" to make login item at end with properties {path:\"$LAUNCHER\", hidden:true}" >/dev/null 2>&1; then
  echo "   готово: запустится сам при входе в систему"
else
  echo "   не получилось автоматически. Добавьте вручную:"
  echo "   Системные настройки -> Основные -> Объекты входа -> «+» -> $LAUNCHER"
fi

echo
echo "Запускаю. Если macOS спросит доступ Терминала к микрофону — нажмите «Разрешить»."
open "$LAUNCHER"

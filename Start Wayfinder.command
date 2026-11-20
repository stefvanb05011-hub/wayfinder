#!/bin/bash
# Wayfinder launcher — serves the game from this folder on your own Mac only (nothing goes online),
# so your browser lets you install it as an app. Close this window to stop it.
cd "$(dirname "$0")" || exit 1
PORT=8642
URL="http://localhost:$PORT/index.html"

if curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  echo "Wayfinder is already running — opening it."
  open "$URL"; exit 0
fi

serve() {
  echo ""
  echo "  Wayfinder is running at $URL"
  echo "  Keep this window open while you play. Close it to stop."
  echo ""
  (sleep 1; open "$URL") &
}

if command -v python3 >/dev/null 2>&1 && { [ "$(command -v python3)" != "/usr/bin/python3" ] || xcode-select -p >/dev/null 2>&1; }; then
  serve; exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v ruby >/dev/null 2>&1; then
  serve; exec ruby -run -e httpd . -p "$PORT" -b 127.0.0.1
elif command -v php >/dev/null 2>&1; then
  serve; exec php -S "127.0.0.1:$PORT"
else
  echo "Couldn't find Python on this Mac."
  echo "Install it by running this in Terminal, then try again:   xcode-select --install"
  read -r -p "Press Enter to close."
fi

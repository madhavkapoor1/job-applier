#!/bin/bash
# Job Applier — macOS launcher. Double-click this file to start the app.
# It sets up everything the first time (no admin password needed) and opens
# the app in your browser. Keep the window that appears open while you use it.

set -u
cd "$(dirname "$0")" || exit 1

PORT=3000
NODE_PIN="v22.11.0"          # bundled Node version (used only if Node isn't already installed)
NODE_MAJOR_MIN=18
RUNTIME_DIR="$PWD/.runtime/node"

echo "==============================================="
echo "   Job Applier — starting up"
echo "==============================================="
echo

pause_on_exit() { echo; echo "Press Return to close this window."; read -r _; }

have_good_node() {
  command -v node >/dev/null 2>&1 || return 1
  local major
  major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || return 1
  [ "${major:-0}" -ge "$NODE_MAJOR_MIN" ] 2>/dev/null
}

# 1) Ensure Node.js is available. Prefer an existing install; otherwise download
#    a private copy into this folder (does not touch the rest of your Mac).
if have_good_node; then
  echo "Using the Node.js already on your Mac ($(node --version))."
else
  if [ ! -x "$RUNTIME_DIR/bin/node" ]; then
    echo "First-time setup: downloading Node.js (~30 MB)…"
    case "$(uname -m)" in
      arm64)  plat="darwin-arm64" ;;
      x86_64) plat="darwin-x64" ;;
      *) echo "Sorry, unsupported Mac type: $(uname -m)"; pause_on_exit; exit 1 ;;
    esac
    mkdir -p "$PWD/.runtime"
    url="https://nodejs.org/dist/$NODE_PIN/node-$NODE_PIN-$plat.tar.gz"
    if ! curl -fL "$url" -o "$PWD/.runtime/node.tar.gz"; then
      echo "Could not download Node.js. Please check your internet connection and try again."
      pause_on_exit; exit 1
    fi
    tar -xzf "$PWD/.runtime/node.tar.gz" -C "$PWD/.runtime" || { echo "Could not unpack Node.js."; pause_on_exit; exit 1; }
    rm -f "$PWD/.runtime/node.tar.gz"
    mv "$PWD/.runtime/node-$NODE_PIN-$plat" "$RUNTIME_DIR"
  fi
  export PATH="$RUNTIME_DIR/bin:$PATH"
  echo "Using bundled Node.js ($(node --version))."
fi
echo

# 2) Create the .env file (for the optional Reed API key) if it's missing.
[ -f .env ] || { [ -f .env.example ] && cp .env.example .env; }

# 3) Install the app's pieces (first time only), incl. the browser used for
#    PDF CVs + assisted apply.
if [ ! -d node_modules ]; then
  echo "Installing the app (first time only — this can take a few minutes)…"
  npm install || { echo "Install failed — see the messages above."; pause_on_exit; exit 1; }
  echo "Setting up the application browser…"
  npx playwright install chromium >/dev/null 2>&1 || echo "  (browser setup skipped — assisted apply may be unavailable)"
  echo
fi

# 4) Build the app (first time, or after an update).
if [ ! -d .next ]; then
  echo "Preparing the app (first time only)…"
  npm run build || { echo "Build failed — see the messages above."; pause_on_exit; exit 1; }
  echo
fi

# 5) Start the server, wait for it, open the browser.
echo "Starting Job Applier…"
npm run start -- -p "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 90); do
  curl -s "http://localhost:$PORT/" >/dev/null 2>&1 && break
  sleep 1
done
open "http://localhost:$PORT/" 2>/dev/null || true

echo
echo "==============================================="
echo "  Job Applier is running."
echo "  In your browser:  http://localhost:$PORT"
echo
echo "  To STOP it: just close this window."
echo "==============================================="

# Keep running until the server stops (or the window is closed).
wait "$SERVER_PID"

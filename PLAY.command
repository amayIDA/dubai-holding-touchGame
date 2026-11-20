#!/bin/bash
# Double-click on a Mac to set up, build and launch Glow Tap in fullscreen.
# First launch needs internet: it downloads a private Node.js 24 LTS runtime
# (into .runtime/, nothing is installed system-wide) and the game dependencies.
# If double-clicking is blocked, open Terminal and run:  bash /path/to/PLAY.command

cd "$(dirname "$0")" || exit 1
PROJECT_ROOT="$(pwd)"
RUNTIME_ROOT="$PROJECT_ROOT/.runtime"
NODE_HOME="$RUNTIME_ROOT/node-mac"

fail() {
  echo
  echo "ERROR: $1"
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
}

green() { printf '\033[32m%s\033[0m\n' "$1"; }

# Keep this script executable for next time (harmless if it already is).
chmod +x "$0" 2>/dev/null

# 1. Private Node.js runtime -------------------------------------------------
case "$(uname -m)" in
  arm64) ARCH=arm64 ;;
  x86_64) ARCH=x64 ;;
  *) fail "Unsupported Mac processor: $(uname -m)" ;;
esac

if [ ! -x "$NODE_HOME/bin/node" ] || [ ! -f "$NODE_HOME/lib/node_modules/npm/bin/npm-cli.js" ]; then
  green "Preparing a private Node.js runtime (first launch needs internet)..."
  mkdir -p "$RUNTIME_ROOT" || fail "Could not create $RUNTIME_ROOT"
  BASE="https://nodejs.org/dist/latest-v24.x/"
  SUMS="$(curl -fsSL "${BASE}SHASUMS256.txt")" || fail "Could not reach nodejs.org. Check the internet connection and try again."
  LINE="$(printf '%s\n' "$SUMS" | grep -E "  node-v24\.[0-9.]+-darwin-${ARCH}\.tar\.gz$" | head -1)"
  [ -n "$LINE" ] || fail "Could not find a Node.js 24 download for this Mac."
  EXPECTED="${LINE%% *}"
  FILE="${LINE##* }"
  ARCHIVE="$RUNTIME_ROOT/$FILE"
  curl -fL --progress-bar -o "$ARCHIVE" "${BASE}${FILE}" || fail "Node.js download failed. Try again."
  ACTUAL="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
  [ "$ACTUAL" = "$EXPECTED" ] || { rm -f "$ARCHIVE"; fail "Node.js download checksum mismatch. Please try again."; }
  rm -rf "$NODE_HOME" "$RUNTIME_ROOT/${FILE%.tar.gz}"
  tar -xzf "$ARCHIVE" -C "$RUNTIME_ROOT" || fail "Could not unpack Node.js."
  mv "$RUNTIME_ROOT/${FILE%.tar.gz}" "$NODE_HOME" || fail "Could not set up Node.js."
  rm -f "$ARCHIVE"
fi

export PATH="$NODE_HOME/bin:$PATH"
# Electron must run as a desktop app, even if launched from a Node-based editor.
unset ELECTRON_RUN_AS_NODE
NPM="$NODE_HOME/bin/npm"

# 2. Dependencies (reinstalled if the lockfile changed, or if node_modules
#    came from another computer such as the Windows laptop) ------------------
MARKER="node_modules/.glowtap-installed-mac"
FINGERPRINT="$(shasum -a 256 package-lock.json | awk '{print $1}')-darwin-$ARCH"
INSTALLED="$(cat "$MARKER" 2>/dev/null)"
if [ "$INSTALLED" != "$FINGERPRINT" ] || [ ! -d node_modules/electron/dist/Electron.app ]; then
  green "Installing Three.js, Electron and game dependencies (this can take a few minutes)..."
  "$NPM" ci --no-audit --no-fund || fail "Dependency installation failed. Check the internet connection and try again."
  printf '%s' "$FINGERPRINT" > "$MARKER"
fi

# 3. Build and launch --------------------------------------------------------
green "Building the game..."
"$NPM" run build || fail "The build failed. Read the error above."

green "Starting the game in fullscreen (press Esc to leave fullscreen, Cmd+Q to quit)..."
"$NPM" start || fail "The game exited with an error. Read the message above."

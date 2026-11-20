#!/bin/bash
# Double-click on a Mac to build and launch Glow Tap.
cd "$(dirname "$0")" || exit 1

fail() {
  echo
  echo "$1"
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
}

# Finder-launched shells often miss Homebrew/nvm paths
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$PATH"

command -v npm >/dev/null 2>&1 || fail "Node.js is not installed. Install it from https://nodejs.org and try again."

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install || fail "npm install failed."
fi

echo "Building..."
npm run build || fail "The build failed. Read the error above."

echo "Starting the game..."
npm start || fail "The game could not start."

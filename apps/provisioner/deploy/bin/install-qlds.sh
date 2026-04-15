#!/usr/bin/env bash
set -euo pipefail

QLDS_DIR="${QLDS_DIR:-/opt/qltracker-qlds}"
TMP_DIR="$(mktemp -d)"
STEAMCMD_DIR="${STEAMCMD_DIR:-/opt/steamcmd}"
STEAMCMD_BIN="${STEAMCMD_BIN:-${STEAMCMD_DIR}/steamcmd.sh}"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$QLDS_DIR"
mkdir -p "$STEAMCMD_DIR"

if [[ ! -x "$STEAMCMD_BIN" ]]; then
  curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz -o "$TMP_DIR/steamcmd_linux.tar.gz"
  tar -xzf "$TMP_DIR/steamcmd_linux.tar.gz" -C "$STEAMCMD_DIR"
fi

login_args=(anonymous)
if [[ -n "${STEAM_USERNAME:-}" ]]; then
  login_args=("$STEAM_USERNAME" "${STEAM_PASSWORD:-}")
fi

"$STEAMCMD_BIN" +force_install_dir "$QLDS_DIR" +login "${login_args[@]}" +app_update 349090 validate +quit

git clone https://github.com/MinoMino/minqlx.git "$TMP_DIR/minqlx"
make -C "$TMP_DIR/minqlx"
cp -R "$TMP_DIR/minqlx/bin/." "$QLDS_DIR/"

if [[ ! -d "$QLDS_DIR/minqlx-plugins" ]]; then
  git clone https://github.com/MinoMino/minqlx-plugins.git "$QLDS_DIR/minqlx-plugins"
else
  git config --global --add safe.directory "$QLDS_DIR/minqlx-plugins"
  git -C "$QLDS_DIR/minqlx-plugins" pull --ff-only
fi

if python3 -m pip install --help 2>&1 | grep -q -- "--break-system-packages"; then
  python3 -m pip install --break-system-packages -r "$QLDS_DIR/minqlx-plugins/requirements.txt"
else
  python3 -m pip install -r "$QLDS_DIR/minqlx-plugins/requirements.txt"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOM_PLUGIN_DIR="$(cd "$SCRIPT_DIR/../plugins" && pwd)"
CUSTOM_FACTORY_DIR="$(cd "$SCRIPT_DIR/../factories" && pwd)"
CUSTOM_BASEQ3_DIR="$(cd "$SCRIPT_DIR/../baseq3" && pwd)"
mkdir -p "$QLDS_DIR/minqlx-plugins"
mkdir -p "$QLDS_DIR/baseq3/scripts"
cp "$CUSTOM_PLUGIN_DIR"/*.py "$QLDS_DIR/minqlx-plugins/"
cp "$CUSTOM_FACTORY_DIR"/*.factories "$QLDS_DIR/baseq3/scripts/"
cp "$CUSTOM_BASEQ3_DIR"/*.txt "$QLDS_DIR/baseq3/"
cp "$CUSTOM_BASEQ3_DIR"/*.json "$QLDS_DIR/baseq3/"
"$SCRIPT_DIR/sync-workshop-maps.sh"

chown -R qltracker:qltracker "$QLDS_DIR"

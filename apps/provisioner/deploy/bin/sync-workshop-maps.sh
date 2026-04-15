#!/usr/bin/env bash
set -euo pipefail

QLDS_DIR="${QLDS_DIR:-/opt/qltracker-qlds}"
BASEQ3_DIR="${BASEQ3_DIR:-$QLDS_DIR/baseq3}"
STEAMCMD_DIR="${STEAMCMD_DIR:-/opt/steamcmd}"
STEAMCMD_BIN="${STEAMCMD_BIN:-${STEAMCMD_DIR}/steamcmd.sh}"
WORKSHOP_FILE="${WORKSHOP_FILE:-$BASEQ3_DIR/workshop.txt}"
WORKSHOP_APP_ID="${WORKSHOP_APP_ID:-282440}"
APP_USER="${APP_USER:-qltracker}"
APP_GROUP="${APP_GROUP:-$APP_USER}"

if [[ ! -f "$WORKSHOP_FILE" ]]; then
  echo "[workshop-sync] workshop file not found: $WORKSHOP_FILE" >&2
  exit 0
fi

mkdir -p "$QLDS_DIR" "$BASEQ3_DIR" "$STEAMCMD_DIR"

if [[ ! -x "$STEAMCMD_BIN" ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz -o "$tmp_dir/steamcmd_linux.tar.gz"
  tar -xzf "$tmp_dir/steamcmd_linux.tar.gz" -C "$STEAMCMD_DIR"
fi

login_args=(anonymous)
if [[ -n "${STEAM_USERNAME:-}" ]]; then
  login_args=("$STEAM_USERNAME" "${STEAM_PASSWORD:-}")
fi

mapfile -t workshop_ids < <(sed -e 's/#.*$//' -e '/^[[:space:]]*$/d' "$WORKSHOP_FILE")

if [[ "${#workshop_ids[@]}" -eq 0 ]]; then
  echo "[workshop-sync] no workshop ids configured"
  exit 0
fi

for workshop_id in "${workshop_ids[@]}"; do
  echo "[workshop-sync] downloading workshop item ${workshop_id}"
  "$STEAMCMD_BIN" \
    +force_install_dir "$QLDS_DIR" \
    +login "${login_args[@]}" \
    +workshop_download_item "$WORKSHOP_APP_ID" "$workshop_id" validate \
    +quit
done

for workshop_id in "${workshop_ids[@]}"; do
  item_dir="$QLDS_DIR/steamapps/workshop/content/$WORKSHOP_APP_ID/$workshop_id"
  if [[ ! -d "$item_dir" ]]; then
    echo "[workshop-sync] workshop item directory missing: $item_dir" >&2
    continue
  fi

  shopt -s nullglob
  item_pk3s=("$item_dir"/*.pk3)
  shopt -u nullglob
  if [[ "${#item_pk3s[@]}" -eq 0 ]]; then
    echo "[workshop-sync] no pk3 files found in $item_dir" >&2
    continue
  fi

  for pk3 in "${item_pk3s[@]}"; do
    install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$pk3" "$BASEQ3_DIR/$(basename "$pk3")"
  done
done

chown -R "$APP_USER:$APP_GROUP" "$QLDS_DIR"

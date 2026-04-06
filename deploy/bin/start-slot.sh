#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <slot-id>" >&2
  exit 1
fi

slot_id="$1"
env_file="/var/lib/qltracker-provisioner/slots/slot-${slot_id}/slot.env"

if [[ ! -f "$env_file" ]]; then
  echo "missing slot env file: $env_file" >&2
  exit 1
fi

set -a
source "$env_file"
set +a

mkdir -p "$FS_HOMEPATH" "$LOG_DIR"

exec "${QLDS_BASE_DIR}/run_server_x64_minqlx.sh" \
  +set fs_homepath "$FS_HOMEPATH" \
  +set net_port "$GAME_PORT" \
  +exec "$SERVER_CFG"

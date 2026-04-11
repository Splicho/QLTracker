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

args=(
  +set fs_homepath "$FS_HOMEPATH"
  +set net_ip "$PUBLIC_IP"
  +set net_port "$GAME_PORT"
  +set zmq_stats_enable "${ZMQ_STATS_ENABLE:-1}"
  +set zmq_stats_ip "$ZMQ_STATS_IP"
  +set zmq_stats_port "$ZMQ_STATS_PORT"
  +exec "$SERVER_CFG"
)

if [[ -n "${ZMQ_STATS_PASSWORD:-}" ]]; then
  args=(
    +set fs_homepath "$FS_HOMEPATH"
    +set net_ip "$PUBLIC_IP"
    +set net_port "$GAME_PORT"
    +set zmq_stats_enable "${ZMQ_STATS_ENABLE:-1}"
    +set zmq_stats_ip "$ZMQ_STATS_IP"
    +set zmq_stats_port "$ZMQ_STATS_PORT"
    +set zmq_stats_password "$ZMQ_STATS_PASSWORD"
    +exec "$SERVER_CFG"
  )
fi

exec "${QLDS_BASE_DIR}/run_server_x64_minqlx.sh" "${args[@]}"

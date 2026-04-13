#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/qltracker}"
APP_DIR="${APP_DIR:-$ROOT_DIR/apps/provisioner}"
APP_USER="${APP_USER:-qltracker}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
REPO_URL="${REPO_URL:-https://github.com/Splicho/qltracker.git}"
BRANCH="${1:-${BRANCH:-main}}"
QLDS_DIR="${QLDS_DIR:-/opt/qltracker-qlds}"
PLUGIN_DIR="${PLUGIN_DIR:-$QLDS_DIR/minqlx-plugins}"
BASEQ3_DIR="${BASEQ3_DIR:-$QLDS_DIR/baseq3}"
SLOTS_GLOB="${SLOTS_GLOB:-qltracker-ql@*.service}"
PROVISIONER_SERVICE="${PROVISIONER_SERVICE:-qltracker-provisioner.service}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SYNC_NGINX="${SYNC_NGINX:-0}"
NGINX_SITE_TARGET="${NGINX_SITE_TARGET:-/etc/nginx/sites-available/qltracker-provisioner}"
FORCE_ACTIVE_SLOT_DEPLOY="${FORCE_ACTIVE_SLOT_DEPLOY:-0}"
HEALTH_RETRIES="${HEALTH_RETRIES:-15}"
HEALTH_RETRY_DELAY_SECONDS="${HEALTH_RETRY_DELAY_SECONDS:-2}"
REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR:-20}"
PNPM_VERSION="${PNPM_VERSION:-10.15.0}"

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] error: %s\n' "$*" >&2
  exit 1
}

as_app_user() {
  if [[ "$(id -un)" == "$APP_USER" ]]; then
    "$@"
    return
  fi

  runuser -u "$APP_USER" -- "$@"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "run this script as root"
  fi
}

ensure_supported_node() {
  local node_version
  local node_major

  if ! node_version="$(as_app_user node --version 2>/dev/null)"; then
    die "node is not installed for $APP_USER"
  fi

  node_major="${node_version#v}"
  node_major="${node_major%%.*}"

  if [[ -z "$node_major" || "$node_major" != "$REQUIRED_NODE_MAJOR" ]]; then
    die "unsupported node version ${node_version}; qltracker-provisioner requires Node ${REQUIRED_NODE_MAJOR}.x because zeromq@5.3.1 does not build on Node 22"
  fi
}

pnpm_cmd() {
  local escaped_root
  local escaped_args
  escaped_root="$(printf '%q' "$ROOT_DIR")"
  printf -v escaped_args '%q ' "$@"
  as_app_user bash -lc "cd ${escaped_root} && env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm ${escaped_args}"
}

ensure_repo_checkout() {
  if [[ -d "$ROOT_DIR/.git" ]]; then
    return
  fi

  log "cloning $REPO_URL into $ROOT_DIR"
  install -d -o "$APP_USER" -g "$APP_GROUP" "$(dirname "$ROOT_DIR")"
  as_app_user git clone --branch "$BRANCH" "$REPO_URL" "$ROOT_DIR"
}

ensure_slots_idle() {
  local active_slots

  active_slots="$(systemctl list-units "$SLOTS_GLOB" --state=active,activating,reloading,deactivating --no-legend --plain || true)"
  if [[ -z "$active_slots" || "$FORCE_ACTIVE_SLOT_DEPLOY" == "1" ]]; then
    return
  fi

  printf '%s\n' "$active_slots" >&2
  die "refusing to deploy while pickup slots are active; set FORCE_ACTIVE_SLOT_DEPLOY=1 to override"
}

sync_repo() {
  log "syncing repo to origin/$BRANCH"
  as_app_user git -C "$ROOT_DIR" fetch --prune origin
  as_app_user git -C "$ROOT_DIR" checkout "$BRANCH"
  as_app_user git -C "$ROOT_DIR" reset --hard "origin/$BRANCH"
  as_app_user git -C "$ROOT_DIR" clean -fdx -e apps/provisioner/.env
}

build_app() {
  log "installing workspace dependencies"
  as_app_user env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack prepare "pnpm@${PNPM_VERSION}" --activate
  pnpm_cmd install --frozen-lockfile
  log "building shared packages required by provisioner"
  pnpm_cmd --filter @qltracker/config build
  pnpm_cmd --filter @qltracker/contracts build
  pnpm_cmd --filter @qltracker/crypto build
  log "building provisioner"
  pnpm_cmd --filter @qltracker/provisioner build
}

sync_runtime_assets() {
  log "syncing runtime assets"
  chmod 755 "$APP_DIR"/deploy/bin/*.sh

  install -d -o "$APP_USER" -g "$APP_GROUP" "$PLUGIN_DIR" "$BASEQ3_DIR" "$BASEQ3_DIR/scripts"
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/plugins/*.py "$PLUGIN_DIR"/
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/factories/*.factories "$BASEQ3_DIR/scripts"/
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/baseq3/*.txt "$BASEQ3_DIR"/
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/baseq3/*.json "$BASEQ3_DIR"/

  install -m 0440 "$APP_DIR/deploy/sudoers/qltracker-provisioner" /etc/sudoers.d/qltracker-provisioner
  visudo -cf /etc/sudoers.d/qltracker-provisioner >/dev/null

  install -m 0644 "$APP_DIR/deploy/systemd/qltracker-provisioner.service" "$SYSTEMD_DIR/qltracker-provisioner.service"
  install -m 0644 "$APP_DIR/deploy/systemd/qltracker-ql@.service" "$SYSTEMD_DIR/qltracker-ql@.service"

  if [[ "$SYNC_NGINX" == "1" ]]; then
    install -m 0644 "$APP_DIR/deploy/nginx/provision.qltracker.com.conf" "$NGINX_SITE_TARGET"
    nginx -t
    systemctl reload nginx
  fi

  systemctl daemon-reload
}

verify_health() {
  local port
  local attempt

  port="$(awk -F= '$1=="PORT"{print $2}' "$APP_DIR/.env" | tr -d '\r' | tail -n 1)"
  if [[ -z "$port" ]]; then
    port="7070"
  fi

  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt += 1)); do
    if curl --fail --silent "http://127.0.0.1:${port}/healthz" >/dev/null 2>/dev/null; then
      return
    fi

    sleep "$HEALTH_RETRY_DELAY_SECONDS"
  done

  curl --fail --silent --show-error "http://127.0.0.1:${port}/healthz" >/dev/null || true
  die "health check failed after ${HEALTH_RETRIES} attempts"
}

restart_services() {
  log "restarting $PROVISIONER_SERVICE"
  systemctl restart "$PROVISIONER_SERVICE"
  systemctl is-active --quiet "$PROVISIONER_SERVICE" || die "$PROVISIONER_SERVICE failed to start"
  verify_health
}

main() {
  require_root
  ensure_slots_idle
  ensure_repo_checkout
  sync_repo
  ensure_supported_node
  build_app
  sync_runtime_assets
  restart_services
  log "deploy complete"
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/qltracker-provisioner/app}"
APP_USER="${APP_USER:-qltracker}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
REPO_URL="${REPO_URL:-https://github.com/Splicho/qltracker-provisioner.git}"
BRANCH="${1:-${BRANCH:-master}}"
QLDS_DIR="${QLDS_DIR:-/opt/qltracker-qlds}"
PLUGIN_DIR="${PLUGIN_DIR:-$QLDS_DIR/minqlx-plugins}"
BASEQ3_DIR="${BASEQ3_DIR:-$QLDS_DIR/baseq3}"
SLOTS_GLOB="${SLOTS_GLOB:-qltracker-ql@*.service}"
PROVISIONER_SERVICE="${PROVISIONER_SERVICE:-qltracker-provisioner.service}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SYNC_NGINX="${SYNC_NGINX:-0}"
NGINX_SITE_TARGET="${NGINX_SITE_TARGET:-/etc/nginx/sites-available/qltracker-provisioner}"
FORCE_ACTIVE_SLOT_DEPLOY="${FORCE_ACTIVE_SLOT_DEPLOY:-0}"

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

ensure_repo_checkout() {
  if [[ -d "$APP_DIR/.git" ]]; then
    return
  fi

  log "cloning $REPO_URL into $APP_DIR"
  install -d -o "$APP_USER" -g "$APP_GROUP" "$(dirname "$APP_DIR")"
  as_app_user git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
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
  as_app_user git -C "$APP_DIR" fetch --prune origin
  as_app_user git -C "$APP_DIR" checkout "$BRANCH"
  as_app_user git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  as_app_user git -C "$APP_DIR" clean -fdx -e .env
}

build_app() {
  log "installing node dependencies"
  as_app_user npm --prefix "$APP_DIR" ci
  log "building provisioner"
  as_app_user npm --prefix "$APP_DIR" run build
}

sync_runtime_assets() {
  log "syncing runtime assets"
  chmod 755 "$APP_DIR"/deploy/bin/*.sh

  install -d -o "$APP_USER" -g "$APP_GROUP" "$PLUGIN_DIR" "$BASEQ3_DIR" "$BASEQ3_DIR/scripts"
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/plugins/*.py "$PLUGIN_DIR"/
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/factories/*.factories "$BASEQ3_DIR/scripts"/
  install -o "$APP_USER" -g "$APP_GROUP" -m 0644 "$APP_DIR"/deploy/baseq3/*.txt "$BASEQ3_DIR"/

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

  port="$(awk -F= '$1=="PORT"{print $2}' "$APP_DIR/.env" | tail -n 1)"
  if [[ -z "$port" ]]; then
    port="7070"
  fi

  curl --fail --silent --show-error "http://127.0.0.1:${port}/healthz" >/dev/null
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
  build_app
  sync_runtime_assets
  restart_services
  log "deploy complete"
}

main "$@"

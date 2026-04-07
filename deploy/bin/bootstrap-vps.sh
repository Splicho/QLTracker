#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
APP_DIR="${APP_DIR:-/opt/qltracker-provisioner/app}"
REPO_URL="${REPO_URL:-https://github.com/Splicho/qltracker-provisioner.git}"
BRANCH="${BRANCH:-master}"

apt-get update
apt-get -y --fix-broken install
apt-get install -y software-properties-common curl ca-certificates gnupg

add-apt-repository -y multiverse
dpkg --add-architecture i386
apt-get update

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
fi

apt-get install -y \
  build-essential \
  certbot \
  gcc \
  git \
  lib32gcc-s1 \
  lib32stdc++6 \
  make \
  nginx \
  nodejs \
  python3 \
  python3-certbot-nginx \
  python3-dev \
  python3-pip \
  redis-server

if ! id qltracker >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash qltracker
fi

mkdir -p /opt/qltracker-provisioner /opt/qltracker-qlds /var/lib/qltracker-provisioner/slots
chown -R qltracker:qltracker /opt/qltracker-provisioner /opt/qltracker-qlds /var/lib/qltracker-provisioner

if [[ ! -d "$APP_DIR/.git" ]]; then
  mkdir -p "$(dirname "$APP_DIR")"
  chown -R qltracker:qltracker "$(dirname "$APP_DIR")"
  runuser -u qltracker -- git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

if [[ -d "$APP_DIR/deploy/bin" ]]; then
  chmod 755 "$APP_DIR"/deploy/bin/*.sh
fi

systemctl enable nginx redis-server
systemctl start nginx redis-server

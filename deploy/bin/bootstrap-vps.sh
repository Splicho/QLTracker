#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

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

systemctl enable nginx redis-server
systemctl start nginx redis-server

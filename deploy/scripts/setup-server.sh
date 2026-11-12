#!/usr/bin/env bash
# Lightsail(Ubuntu 24.04 LTS) 최초 1회 초기화 스크립트. sudo 로 실행한다.
#   sudo bash setup-server.sh <배포-사용자명>   (예: ubuntu)
# 하는 일: Docker 설치, 2GB 스왑, 자동 보안 업데이트, /opt/yar-mirror 생성, 백업 cron 등록.
set -euo pipefail

DEPLOY_USER="${1:-ubuntu}"
APP_DIR=/opt/yar-mirror

# 1) Docker Engine + compose 플러그인
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$DEPLOY_USER"

# 2) 스왑 2GB — JVM 과 PostGIS 를 2GB RAM 에 같이 올리므로 OOM 완충용
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
fi

# 3) 자동 보안 업데이트
apt-get update -y
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# 4) 앱 디렉터리
mkdir -p "$APP_DIR/scripts"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# 5) 백업 cron: 매일 04:00 KST (= 19:00 UTC)
CRON_LINE="0 19 * * * $APP_DIR/scripts/backup.sh >> $APP_DIR/backup.log 2>&1"
( crontab -u "$DEPLOY_USER" -l 2> /dev/null | grep -v 'scripts/backup.sh' || true; echo "$CRON_LINE" ) \
  | crontab -u "$DEPLOY_USER" -

echo "done. 다시 로그인한 뒤 $APP_DIR/.env 를 채우고 첫 배포를 실행하세요."

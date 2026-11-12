#!/usr/bin/env bash
# 서버에서 실행하는 배포 스크립트. GitHub Actions가 SSH로 호출한다.
#   사용법: scripts/deploy.sh <image-tag>
# 1) .env 의 IMAGE_TAG 를 새 태그로 바꾸고  2) 이미지를 pull 해 재기동한 뒤
# 3) Caddy 를 거쳐 앱이 응답하는지 확인하고, 실패하면 이전 태그로 되돌린다.
set -euo pipefail

NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

env_get() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }
set_tag() {
  if grep -qE '^IMAGE_TAG=' .env; then
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$1|" .env
  else
    echo "IMAGE_TAG=$1" >> .env
  fi
}

# Spring이 떠 있으면 / 요청에 401 등 4xx를 돌려준다. 502/503/000이면 아직 앱이 응답하지 않는 상태다.
healthy() {
  local domain code
  domain="$(env_get API_DOMAIN)"
  for _ in $(seq 1 36); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
      --resolve "${domain}:443:127.0.0.1" "https://${domain}/" || true)"
    if [[ "$code" =~ ^[234][0-9][0-9]$ ]]; then
      echo "health check OK (HTTP $code)"
      return 0
    fi
    echo "waiting for app... (HTTP ${code:-000})"
    sleep 5
  done
  return 1
}

[[ -f .env ]] || { echo ".env not found in $APP_DIR" >&2; exit 1; }

PREV_TAG="$(env_get IMAGE_TAG)"
echo "deploy: ${PREV_TAG:-<none>} -> $NEW_TAG"

set_tag "$NEW_TAG"
docker compose pull app
docker compose up -d --remove-orphans

if healthy; then
  docker image prune -f > /dev/null
  echo "deploy succeeded: $NEW_TAG"
  exit 0
fi

echo "health check failed for $NEW_TAG" >&2
docker compose logs --tail 100 app >&2 || true

if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$NEW_TAG" ]]; then
  echo "rolling back to $PREV_TAG" >&2
  set_tag "$PREV_TAG"
  docker compose up -d app
  healthy || echo "rollback also failed — check the server manually" >&2
fi
exit 1

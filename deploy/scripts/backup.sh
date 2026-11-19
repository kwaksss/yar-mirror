#!/usr/bin/env bash
# PostGIS DB 를 덤프해 R2 비공개 버킷에 올린다. (사진은 이미 R2 에 있으므로 따로 백업하지 않는다)
# cron으로 하루 1회 실행한다 (scripts/setup-server.sh 가 등록).
# 오래된 백업 삭제는 R2 버킷의 Object lifecycle 규칙(예: 30일)으로 처리한다.
#
# 복구 예시:
#   docker compose exec -T db pg_restore -U <user> -d <db> --clean --if-exists --no-owner < yarmirror-XXXX.dump
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

env_get() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }

DB_NAME="$(env_get POSTGRES_DB)"
DB_USER="$(env_get POSTGRES_USER)"
ENDPOINT="$(env_get BACKUP_R2_ENDPOINT)"
BUCKET="$(env_get BACKUP_R2_BUCKET)"
KEY_ID="$(env_get BACKUP_R2_ACCESS_KEY_ID)"
SECRET="$(env_get BACKUP_R2_SECRET_ACCESS_KEY)"
: "${ENDPOINT:?BACKUP_R2_ENDPOINT missing}" "${BUCKET:?BACKUP_R2_BUCKET missing}"
: "${KEY_ID:?BACKUP_R2_ACCESS_KEY_ID missing}" "${SECRET:?BACKUP_R2_SECRET_ACCESS_KEY missing}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# -Fc: 압축된 custom 포맷. pg_restore 로 복구한다.
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner \
  > "$WORK_DIR/yarmirror-$STAMP.dump"

# awscli 를 서버에 설치하지 않고 컨테이너로 실행한다.
# checksum 옵션: 최신 awscli 의 기본 체크섬 헤더를 R2 와 호환되게 필요할 때만 보낸다.
upload() {
  docker run --rm \
    -v "$WORK_DIR:/backup:ro" \
    -e AWS_ACCESS_KEY_ID="$KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$SECRET" \
    -e AWS_DEFAULT_REGION=auto \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    amazon/aws-cli s3 cp "/backup/$1" "s3://$BUCKET/$2/$1" --endpoint-url "$ENDPOINT" --only-show-errors
}

upload "yarmirror-$STAMP.dump" db

echo "$(date -u +%FT%TZ) backup uploaded: $STAMP"

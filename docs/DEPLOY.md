# 배포 계획 (MVP)

> 기반 문서: [docs/PLAN.md](./PLAN.md) — "인프라: 단일 서버 배포 (Docker)"
> 선택 근거 상세: [docs/DEPLOY-DECISION.md](./DEPLOY-DECISION.md)
> 목표: **익숙한 AWS + GitHub Actions 스택으로, 구성은 최소(EC2 1대)·비용은 월 약 $20**로 MVP/베타를 운영한다.

## 1. 결론

**EC2 1대 + Docker Compose(Caddy + Spring Boot + PostGIS)**, 사진은 **S3**, CI/CD는 **GitHub Actions**, 웹은 **Cloudflare Pages**, 모바일은 **EAS Build** 무료 티어.
ECS / ALB / RDS는 MVP 단계에서 쓰지 않는다 (7. 확장 단계 참고).

```
GitHub Actions
 ├ PR        : ./gradlew test
 └ main push : arm64 이미지 빌드 → ECR push → SSM Run Command로 EC2 배포 (OIDC 인증)

[모바일 앱 / 웹(Cloudflare Pages)]
      │ HTTPS (API)                  │ HTTPS (사진 PUT / GET)
      ▼                              ▼
 ┌──── EC2 t4g.small (Docker Compose) ────┐     ┌──────── S3 ────────┐
 │ Caddy (자동 HTTPS, 리버스 프록시)        │     │ photos 버킷 spots/* │
 │   └─▶ Spring Boot (prod 프로필, :8080) ─┼────▶│  (presign, HEAD)    │
 │         └─▶ PostGIS 컨테이너 (EBS 볼륨) ─┼────▶│ backups 버킷        │
 └─────────────────────────────────────────┘     │  (pg_dump, 비공개)   │
                                                 └─────────────────────┘
```

| 항목 | 선택 | 월 비용(대략) |
|---|---|---|
| 서버 | EC2 t4g.small (2vCPU/2GB, ARM, `ap-northeast-2`) | 약 $15 |
| 디스크 | EBS gp3 20GB | 약 $2 |
| 공인 IP | 퍼블릭 IPv4 (Elastic IP) | 약 $3.6 |
| DB | 같은 EC2의 PostGIS 컨테이너 (`postgis/postgis:16-3.4`) | 0원 |
| 사진 저장소 | S3 (presigned PUT, `spots/*` 공개 읽기) | 1달러 미만 (수 GB 기준) |
| 백업 | S3 별도 버킷 (비공개, 수명 주기로 오래된 덤프 삭제) | 1달러 미만 |
| 이미지 레지스트리 | ECR (500MB까지 프리티어, 오래된 이미지 수명 주기 삭제) | 0원~ |
| CI/CD | GitHub Actions | 0원 (무료 한도 내) |
| HTTPS / 도메인 | Caddy 자동 인증서 + 유료 도메인 (Route 53 또는 Cloudflare DNS) | 연 1~2만 원 |
| 웹 프론트 | `npx expo export -p web` → Cloudflare Pages | 0원 |
| 모바일 빌드 | EAS Build 무료 티어 → TestFlight / 내부 테스트 APK | 0원 |
| **합계** | | **약 $20** |

> 가격·무료 한도는 변동될 수 있으므로 가입 시 재확인한다. 신규 계정은 프리티어 크레딧으로 초기 비용이 더 낮을 수 있다.

## 2. 선택 근거

요약만 적는다. 대안 비교와 상세 근거는 [DEPLOY-DECISION.md](./DEPLOY-DECISION.md)에 있다.

1. **익숙한 스택** — GitHub Actions + AWS(EC2/S3/IAM) 경험이 있다. 새 플랫폼을 배우는 데 드는 시간이 월 2만 원보다 비싸다고 판단했다.
2. **필요한 만큼만** — 오토스케일링·롤링 배포(ECS + ALB)와 관리형 DB(RDS)는 트래픽이 생긴 뒤에 필요하다. 이 조합(ECS + ALB + RDS)이면 MVP에서 월 $50~70이 든다.
3. **PostGIS 필수** — `SpotRepository.findConfirmedWithin`이 `ST_DWithin`/`ST_Distance` 네이티브 쿼리를 쓴다. 같은 EC2의 컨테이너로 띄우는 게 가장 싸다. 로컬 `docker-compose.yml`과 구성이 거의 같다.
4. **사진은 S3** — 업로드 flow(presign → 클라이언트 직접 PUT → `confirm-upload` 존재 확인)가 원래 S3를 전제로 설계됐다. 사진 바이트가 서버를 거치지 않아 EC2는 DB 볼륨만 가진 상태가 된다.
5. **JVM 특성** — Spring Boot는 메모리 300~500MB를 쓴다. PostGIS와 같이 올리려면 RAM이 2GB 이상이어야 한다. 그래서 t4g.small을 골랐다.
6. **HTTPS 필수** — 카카오 OAuth 운영 redirect URI, 웹용 카카오 JS 키 도메인, iOS ATS 때문이다. Caddy가 Let's Encrypt 인증서를 자동으로 발급·갱신한다.
7. **되돌리기 쉬움** — S3와 R2는 같은 SDK를 쓴다. 앱 이미지는 그대로 ECS로 옮길 수 있고, DB는 `pg_dump`로 RDS에 복원하면 된다.

### 검토했으나 제외한 대안

| 대안 | 제외 이유 |
|---|---|
| ECS Fargate + ALB + RDS | MVP 기준 월 $50~70, 아직 쓰지 않는 기능에 대한 비용 |
| Oracle Cloud Free + Cloudflare R2 | 가장 저렴(월 0원)하나 ARM 재고 부족·유휴 회수 위험, 낯선 플랫폼 학습 비용 |
| VM 디스크에 사진 저장 (`LocalFileObjectStorageAdapter`) | GET 서빙 미구현, presign 서명 검증 없음, 디스크 장애 시 유실·백업 부담 |
| Render / Railway 무료 티어 | 슬립 + 콜드 스타트, 휘발성 디스크 |
| Cloud Run 등 서버리스 | JVM 콜드 스타트, DB 별도 비용 |
| AWS Lightsail $5 (1GB) | 앱 + PostGIS 동시 운영 시 메모리 부족 우려 |

## 3. 배포 전 작업 체크리스트

### 3.1 백엔드 코드
- [ ] AWS SDK v2 `s3` 의존성 추가
- [ ] `S3ObjectStorageAdapter implements ObjectStoragePort`
  - `presignUpload`: `S3Presigner`로 PUT URL 발급 (Content-Type 서명 포함, TTL = `presigned-url-ttl-seconds`)
  - `publicUrl`: `https://<버킷>.s3.ap-northeast-2.amazonaws.com/<objectKey>` (CloudFront 도입 시 그 도메인)
  - `objectExistsAtUrl`: `headObject`
  - 자격증명은 `DefaultCredentialsProvider` → EC2 인스턴스 역할 사용 (Access Key를 `.env`에 두지 않음)
- [ ] `LocalFileObjectStorageAdapter`, `LocalStorageUploadController`는 `@Profile("local")`로 분리. `prod`에서는 `/local-storage/**` permitAll 규칙도 빠지게 한다
- [ ] `StorageProperties`에 `region`(필요 시 `endpoint`) 추가

### 3.2 배포 산출물
- [ ] `backend/Dockerfile` — 멀티스테이지(`./gradlew bootJar` → JRE 17 런타임). **arm64** 베이스 이미지
- [ ] `docker-compose.prod.yml` — `app`, `db`, `caddy` 3개 서비스
  - `app` 이미지는 ECR에서 pull (서버에서 빌드하지 않음)
  - DB 포트(5432/5433)는 **외부 노출 금지** (compose 내부 네트워크만)
  - 볼륨: `pgdata`, `caddy_data`
  - `db` healthcheck 통과 후 `app` 기동 (`depends_on: condition: service_healthy`)
  - Docker 로그 로테이션(`max-size`, `max-file`)
- [ ] `Caddyfile` — `api.<도메인> { reverse_proxy app:8080 }`
- [ ] 백업 스크립트 — `pg_dump | gzip` → `aws s3 cp`로 backups 버킷 업로드 (cron 하루 1회)
- [ ] 운영 `.env.example` 항목 정리 (실제 `.env`는 서버에만 두고 커밋 금지)

### 3.3 GitHub Actions
- [ ] `ci.yml` — PR마다 `./gradlew test`
- [ ] `deploy.yml` — `main` push 시
  1. `aws-actions/configure-aws-credentials`로 **OIDC** 인증 (GitHub용 IAM 역할 assume)
  2. `docker buildx`로 `linux/arm64` 이미지 빌드 → ECR push (태그: 커밋 SHA)
  3. `aws ssm send-command`로 EC2에서 `docker compose pull app && docker compose up -d` 실행
  4. 헬스 체크 실패 시 이전 태그로 롤백

### 3.4 AWS 리소스
- [ ] S3 버킷 2개
  - `yar-mirror-photos`: `spots/*` 공개 읽기 버킷 정책, **CORS**(PUT/GET, 웹 오리진 허용)
  - `yar-mirror-backups`: 퍼블릭 액세스 차단 유지, 수명 주기(예: 30일 후 삭제)
- [ ] ECR 리포지토리 + 수명 주기(최근 N개 이미지만 보관)
- [ ] IAM
  - EC2 인스턴스 역할: photos 버킷 `PutObject`/`GetObject`(HEAD), backups 버킷 `PutObject`, ECR pull, `AmazonSSMManagedInstanceCore`
  - GitHub OIDC 역할: ECR push, 해당 인스턴스 대상 `ssm:SendCommand`만 허용 (레포·브랜치 조건)
- [ ] 보안그룹: **80/443만 인바운드 허용** (22 닫음, 접속은 SSM Session Manager)

### 3.5 운영 환경변수 (`prod` 프로필)
| 변수 | 값 |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `JWT_SECRET` | 충분히 긴 랜덤 값 (로컬 기본값 사용 금지) |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `jdbc:postgresql://db:5432/yarmirror` / 강력한 비밀번호 |
| `STORAGE_BUCKET` | `yar-mirror-photos` |
| `STORAGE_PUBLIC_BASE_URL` | `https://yar-mirror-photos.s3.ap-northeast-2.amazonaws.com` |
| `STORAGE_PRESIGN_TTL` | `600` (기본값) |
| `CORS_ALLOWED_ORIGINS` | `https://<웹 도메인>` (기본값은 `localhost:8081`뿐) |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / `KAKAO_REDIRECT_URI` | 운영 도메인 기준으로 카카오 개발자 콘솔에도 등록 |

> S3 자격증명은 환경변수가 아니라 EC2 인스턴스 역할로 주입한다.

### 3.6 모바일 / 웹
- [ ] `EXPO_PUBLIC_API_BASE_URL=https://api.<도메인>` 으로 빌드
- [ ] 업로드 전 클라이언트 리사이즈 (`expo-image-manipulator`, 긴 변 1080px, JPEG 0.7) — 저장·전송 비용 절감
- [ ] 카카오 개발자 콘솔: 웹 플랫폼 도메인, 앱 플랫폼(번들 ID / 키 해시) 등록
- [ ] 웹 토큰 저장(localStorage, XSS 노출) 재검토 — `todo-0922.md` 항목

## 4. 배포 절차

### 최초 1회
1. AWS 리소스 생성 (3.4): S3 버킷, ECR, IAM 역할, 보안그룹
2. EC2 생성 — Ubuntu LTS arm64, t4g.small, EBS gp3 20GB, 인스턴스 역할 연결, Elastic IP 할당
3. SSM Session Manager로 접속 → Docker / Docker Compose / AWS CLI 설치
4. 도메인 A 레코드 `api.<도메인>` → Elastic IP
5. 서버에 `docker-compose.prod.yml`, `Caddyfile`, 운영 `.env` 배치
6. 첫 배포 실행 (GitHub Actions `deploy.yml` 수동 실행 또는 `main` push)
7. Flyway가 기동 시 스키마 마이그레이션 수행 → 로그 확인
8. 백업 cron 등록 후 한 번 수동 실행해 S3 업로드 확인
9. 스모크 테스트: 카카오 로그인 → 스팟 등록(S3 사진 업로드 + confirm) → 주변 조회 → 상세(사진 표시)
10. 웹 빌드를 Cloudflare Pages에 배포, 모바일은 EAS로 베타 빌드 배포

### 이후 업데이트
`main`에 머지하면 GitHub Actions가 빌드 → ECR push → SSM 배포까지 자동으로 수행한다.
재기동하는 동안 수 초~수십 초 다운타임이 생긴다 (MVP 단계에서는 허용).

## 5. 운영

- **백업** (단일 서버라 필수): cron으로 하루 1회 `pg_dump`를 backups 버킷에 업로드. 사진은 S3에 있으므로 별도 백업 불필요. **복구 절차를 한 번은 실제로 리허설한다.**
- **로그**: `docker compose logs`, Docker 로그 로테이션으로 디스크 고갈 방지
- **모니터링**: UptimeRobot 등 무료 헬스 체크 (필요 시 Spring Actuator `health` 노출), AWS Budgets로 월 비용 알림
- **보안 업데이트**: `unattended-upgrades` 활성화

## 6. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 단일 서버 장애 → 전체 중단 | 일일 S3 백업 + 복구 리허설, EBS 스냅샷(선택), MVP 단계에선 허용 |
| 배포 시 짧은 다운타임 | MVP 단계에선 허용, 배포 빈도 증가 시 ECS로 이전 |
| 메모리 부족 | JVM `-Xmx` 제한, `DB_POOL_SIZE` 조정, 스왑 설정, 필요 시 t4g.medium |
| 예상치 못한 비용 증가 | AWS Budgets 알림, ECR·백업 수명 주기 정책 |
| S3 egress 증가 | 월 100GB 무료 초과 시 CloudFront 또는 Cloudflare R2 전환 |

## 7. 확장 단계 (트리거 기반)

| 신호 | 대응 |
|---|---|
| 다운타임에 대한 사용자 불만, 배포 빈도 증가 | ECS(Fargate) + ALB로 이전 — 같은 ECR 이미지 사용 |
| DB 부하 증가, 백업·복구 운영 부담 | RDS for PostgreSQL(PostGIS 확장)로 `pg_dump` 이전 |
| 사진 조회 트래픽이 월 100GB를 넘음 | CloudFront 도입 또는 Cloudflare R2로 전환 (S3 SDK 동일, endpoint만 변경) |
| 메모리·CPU 부족 | 인스턴스 타입 상향 (t4g.medium) |

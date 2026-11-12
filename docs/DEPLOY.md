# 배포 계획 (MVP)

> 기반 문서: [docs/PLAN.md](./PLAN.md) — "인프라: 단일 서버 배포 (Docker)"
> 이전 결정 기록: [docs/DEPLOY-DECISION.md](./DEPLOY-DECISION.md) (EC2 + S3안). 이 문서는 그 결정을 **Lightsail + Cloudflare**로 바꾼 최신 계획이다.
> 목표: 도메인을 사서 **웹앱(PWA 느낌) + 모바일 앱**을 운영하되, **월 약 $12**, 배포는 `main` 머지 한 번으로 끝낸다.
> Cloudflare 설정 상세: [docs/CLOUDFLARE.md](./CLOUDFLARE.md)

## 0. 진행 상황 (2026-11-12 기준)

실제 도메인: 웹 `yarmirror.com.de` · API `api.yarmirror.com.de` · 사진 `photos.yarmirror.com.de`

### 완료
- [x] 배포 파일 작성: `backend/Dockerfile`, `deploy/` (compose, Caddyfile, 스크립트), `.github/workflows/` (ci, deploy)
- [x] 로컬 검증: 이미지 빌드, PostGIS 연결 + Flyway 마이그레이션, prod 프로필 기동
- [x] R2 어댑터 구현 (`app.storage.type=s3`), 백엔드 테스트 102개 통과
- [x] 도메인 `yarmirror.com.de` 구매, Cloudflare 네임서버 연결
- [x] R2 `yar-mirror-photos` 버킷 + 커스텀 도메인 + CORS + API 토큰
- [x] 로컬 → 실제 R2 스모크 테스트 통과 (업로드, 서명 검증, CORS, 공개 URL 조회)

### ▶ 다음에 여기서 시작
1. **로컬 `backend/.env` 정리** — `STORAGE_TYPE` 줄 뒤의 인라인 주석을 지운다 (`STORAGE_TYPE=s3` 또는 줄 삭제). 지금 상태로는 로컬 서버가 기동에 실패한다.
2. **커밋** — 배포 파일과 R2 어댑터 작업이 아직 커밋되지 않았다 (`dev` 브랜치).
3. **R2 백업 버킷과 토큰** — 생성 여부를 확인하고, 없으면 만든다 → [CLOUDFLARE.md 3장](./CLOUDFLARE.md#3-r2--백업-버킷-yar-mirror-backups-확인-필요)
4. **Lightsail 서버 준비** → [4.2](#42-서버-lightsail)
5. **GitHub `production` 환경 + 시크릿, 첫 배포** → [4.3](#43-github)
6. **Cloudflare Pages 웹앱 연결** → [4.4](#44-웹앱-cloudflare-pages)
7. **스모크 테스트** → [4.5](#45-스모크-테스트)

> 4.1(도메인/Cloudflare)은 백업 버킷을 제외하고 끝났다.

## 1. 결론

```
도메인·DNS : Cloudflare Registrar / DNS
웹앱       : example.com      → Cloudflare Pages (Expo web export, git push 자동 배포)
API        : api.example.com  → Lightsail 서울 2GB 1대 (Docker Compose: Caddy + Spring Boot + PostGIS)
사진       : Cloudflare R2 (photos.example.com, presigned PUT)
DB 백업    : 매일 pg_dump → R2 비공개 버킷
CI/CD      : GitHub Actions → GHCR → SSH 로 deploy.sh 실행
모바일     : EAS Build 무료 티어 → TestFlight / 내부 테스트
```

```
 [브라우저 / 모바일 앱]
   │ example.com (정적)          │ api.example.com            │ photos.example.com
   ▼                             ▼                            ▼
 Cloudflare Pages      ┌─ Lightsail 2GB (Docker Compose) ─┐   Cloudflare R2
                       │ Caddy (자동 HTTPS)                │   ├ yar-mirror-photos  (공개 읽기)
                       │  └▶ Spring Boot :8080 (prod) ────┼─▶ │  (presign / HEAD)
                       │       └▶ PostGIS (볼륨) ─ 백업 ───┼─▶ └ yar-mirror-backups (비공개)
                       └──────────────────────────────────┘
```

| 항목 | 선택 | 비용(대략) |
|---|---|---|
| 서버 | Lightsail Linux 2GB (2vCPU, SSD 60GB, 트래픽 3TB, IPv4 포함, 서울) | 월 $12 |
| 스냅샷 (선택) | Lightsail 자동 스냅샷 | 월 $1~3 |
| DB | 같은 서버의 PostGIS 컨테이너 (`postgis/postgis:16-3.4`) | 0원 |
| 사진 / 백업 | Cloudflare R2 (10GB 무료, egress 무료) | 0원~ |
| 웹앱 | Cloudflare Pages | 0원 |
| 이미지 레지스트리 | GHCR (비공개 패키지) | 0원 |
| CI/CD | GitHub Actions | 0원 (무료 한도 내) |
| 도메인 | Cloudflare Registrar (원가, `.com` 기준) | 연 $10~11 |
| **합계** | | **월 약 $12 + 도메인** |

> 가격·무료 한도는 바뀔 수 있으니 가입할 때 다시 확인한다.

## 2. 선택 근거

1. **Lightsail은 같은 AWS인데 EC2보다 싸고 단순하다.** EC2 t4g.small은 인스턴스, EBS, 퍼블릭 IPv4 요금이 따로 붙어 월 약 $20이다. Lightsail 2GB는 IPv4, 디스크, 트래픽을 포함해 월 $12 정액이다. VPC, 보안그룹, EBS, Elastic IP를 따로 다룰 필요 없이 콘솔 한 화면에서 끝난다. x86이라 arm64 크로스 빌드도 필요 없다.
2. **메모리 2GB가 필요하다.** Spring Boot JVM(300~500MB)과 PostGIS를 같이 올리므로 $5·$7 플랜은 부족하다. 스왑 2GB를 완충용으로 둔다.
3. **PostGIS는 같은 서버의 컨테이너로 둔다.** `findConfirmedWithin`이 `ST_DWithin`/`ST_Distance`를 쓴다. PostGIS를 지원하는 관리형 DB는 유료이거나, 무료 티어는 슬립·용량 제한이 있다. 로컬 `docker-compose.yml`과 구성이 거의 같다.
4. **Cloudflare 하나로 도메인·웹·사진을 묶는다.** Registrar는 원가 판매라 갱신 가격이 오를 걱정이 없다. DNS, Pages, R2 커스텀 도메인이 같은 대시보드에서 연결된다.
5. **웹앱은 정적 호스팅이 가장 싸고 간단하다.** Pages는 저장소만 연결하면 push할 때마다 빌드·배포되고, PR마다 미리보기 URL이 생긴다. API 서버가 재기동되는 동안에도 웹 화면은 뜬다.
6. **사진은 R2가 유리하다.** 거울샷 앱은 사진 조회 트래픽이 대부분인데, R2는 egress 요금이 없다. S3 API와 호환되므로 AWS SDK v2에 `endpointOverride`만 주면 기존 presign → PUT → HEAD 흐름을 그대로 쓴다.
7. **CI/CD는 ECR·OIDC·SSM 없이 GHCR + SSH로 한다.** 1인 MVP에서는 AWS 권한 설정이 가장 시간을 많이 잡아먹는다. GHCR은 `GITHUB_TOKEN`으로 push/pull할 수 있어 별도 키가 필요 없다.
8. **HTTPS는 필수이고 Caddy가 처리한다.** 카카오 OAuth redirect URI, 카카오 JS 키 도메인, iOS ATS, 그리고 브라우저 위치 API(secure context)가 HTTPS를 요구한다.

### 검토했으나 제외한 대안

| 대안 | 월 비용 | 제외 이유 |
|---|---|---|
| EC2 + S3 + ECR/SSM (이전 계획) | 약 $20 | 같은 일을 하는데 더 비싸고 설정할 것이 많다 |
| ECS Fargate + ALB + RDS | $50~70 | 아직 쓰지 않는 오토스케일링·관리형 DB 비용 |
| Oracle Cloud Free + R2 | $0 | 무료 인스턴스 재고 부족, 유휴 회수 위험 |
| Fly.io / Railway + Neon(PostGIS) | $5~15 | 업체가 3~4곳으로 나뉘고, DB 콜드 스타트와 사용량 과금을 예측하기 어렵다 |
| Render 무료 | $0 | 슬립 후 JVM 재기동에 수십 초 |
| Hetzner 등 해외 VPS | $4~6 | 한국에서 지연이 크다 (유럽 250ms 안팎) |

## 3. 저장소의 배포 파일

| 파일 | 역할 |
|---|---|
| `backend/Dockerfile` | 멀티스테이지 빌드 (`bootJar` → `eclipse-temurin:17-jre`), non-root 실행 |
| `backend/.dockerignore` | `.env`, 빌드 산출물 제외 |
| `deploy/docker-compose.yml` | 운영 Compose: `db`, `app`, `caddy`. DB 포트 비노출, 메모리 상한, 로그 로테이션 |
| `deploy/Caddyfile` | `{$API_DOMAIN}` → `app:8080` 리버스 프록시, 자동 HTTPS |
| `deploy/.env.example` | 운영 환경변수 목록 (서버의 `/opt/yar-mirror/.env`로 복사) |
| `deploy/scripts/setup-server.sh` | 서버 최초 1회: Docker, 스왑 2GB, 자동 보안 업데이트, 백업 cron |
| `deploy/scripts/deploy.sh` | `IMAGE_TAG` 교체 → pull → 재기동 → 헬스 체크 → 실패 시 이전 태그로 롤백 |
| `deploy/scripts/backup.sh` | `pg_dump -Fc`를 R2 비공개 버킷에 업로드 |
| `.github/workflows/ci.yml` | PR: 백엔드 테스트, 모바일 타입체크·테스트 |
| `.github/workflows/deploy.yml` | `main` push(백엔드·배포 파일 변경): 테스트 → 이미지 빌드 → GHCR → 서버 배포 |

서버 디렉터리 구조:

```
/opt/yar-mirror/
├ docker-compose.yml   ← 배포 때마다 GitHub Actions 가 덮어씀
├ Caddyfile            ← 〃
├ scripts/*.sh         ← 〃
├ .env                 ← 서버에만 존재 (직접 작성, 커밋 금지)
└ backup.log
```

## 4. 최초 배포 절차

### 4.1 도메인 / Cloudflare — ✅ 완료 (백업 버킷만 확인 필요, 상세는 [CLOUDFLARE.md](./CLOUDFLARE.md))
1. Cloudflare에 가입하고 Registrar에서 도메인을 산다.
   - `.kr`은 Cloudflare에서 살 수 없다. `.kr`을 원하면 가비아 등에서 사고 네임서버만 Cloudflare로 바꾼다.
2. R2 버킷 2개를 만든다.
   - `yar-mirror-photos`: 커스텀 도메인 `photos.<도메인>` 연결(공개 읽기). CORS에 `PUT`, `GET`, 웹 오리진 허용.
   - `yar-mirror-backups`: 비공개 유지. Object lifecycle 규칙으로 30일 지난 객체 삭제.
3. R2 API 토큰을 만든다. 백업용 토큰은 backups 버킷에만 쓰기 권한을 준다.

### 4.2 서버 (Lightsail)
1. Lightsail에서 인스턴스를 만든다. 리전 서울, Ubuntu 24.04 LTS, Linux 2GB 플랜.
2. 고정 IP(Static IP)를 만들어 붙인다. 인스턴스에 붙어 있는 동안은 무료다.
3. 네트워킹(방화벽)에서 **22, 80, 443**만 연다. 443은 TCP와 UDP(HTTP/3) 둘 다 연다.
4. 자동 스냅샷을 켠다 (선택이지만 권장).
5. Cloudflare DNS에 A 레코드 `api` → 고정 IP를 추가한다. **프록시는 끈다(DNS only).** Caddy가 직접 인증서를 받아야 하기 때문이다.
6. 배포 전용 SSH 키를 만든다. 공개키는 서버의 `~/.ssh/authorized_keys`에 넣고, 개인키는 GitHub Secret으로 등록한다.
   ```bash
   ssh-keygen -t ed25519 -f yar-mirror-deploy -N "" -C "github-actions"
   ```
7. 서버를 초기화한다.
   ```bash
   scp deploy/scripts/setup-server.sh ubuntu@<IP>:~
   ssh ubuntu@<IP> 'sudo bash ~/setup-server.sh ubuntu'
   ```
   이 스크립트는 SSH 비밀번호 로그인을 건드리지 않는다. Lightsail Ubuntu는 기본적으로 키 인증만 허용하므로 그대로 둔다.
8. `.env`를 작성한다. `deploy/.env.example`을 참고해 `/opt/yar-mirror/.env`를 만들고 `chmod 600`을 건다.
   ```bash
   openssl rand -base64 32   # POSTGRES_PASSWORD
   openssl rand -base64 48   # JWT_SECRET
   ```

### 4.3 GitHub
1. Settings → Environments에서 `production` 환경을 만들고 시크릿 3개를 등록한다.
   - `SSH_HOST` (고정 IP), `SSH_USER` (`ubuntu`), `SSH_PRIVATE_KEY`
2. Actions에서 `Deploy backend`를 수동 실행(workflow_dispatch)하거나 `main`에 머지한다.
3. 첫 기동 때 Flyway가 스키마 마이그레이션을 수행한다. 서버에서 로그를 확인한다.
   ```bash
   cd /opt/yar-mirror && docker compose logs -f app
   ```
4. 백업을 한 번 수동으로 돌려 R2에 업로드되는지 확인한다.
   ```bash
   /opt/yar-mirror/scripts/backup.sh
   ```

### 4.4 웹앱 (Cloudflare Pages)
1. Pages → Git 저장소 연결.
   - Production branch: `main`
   - Root directory: `mobile`
   - Build command: `npx expo export -p web`
   - Output directory: `dist`
2. 환경변수 (Production / Preview 각각):
   - `EXPO_PUBLIC_API_BASE_URL=https://api.<도메인>`
   - `EXPO_PUBLIC_KAKAO_JS_KEY`, `EXPO_PUBLIC_KAKAO_REST_API_KEY`, (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`)
   - `NODE_VERSION=22`
3. Custom domains에 `<도메인>`(와 `www`)을 연결한다.
4. 서버 `.env`의 `CORS_ALLOWED_ORIGINS`에 웹 도메인이 들어 있는지 확인한다.
5. 카카오 개발자 콘솔에 웹 플랫폼 도메인과 운영 redirect URI를 등록한다.

### 4.5 스모크 테스트
카카오 로그인 → 스팟 등록(사진 업로드 + confirm) → 주변 조회 → 상세(사진 표시)를 웹과 모바일에서 각각 확인한다.

## 5. 이후 배포

| 변경 | 동작 |
|---|---|
| `backend/**`, `deploy/**` 변경이 `main`에 머지됨 | `deploy.yml`: 테스트 → 이미지(`:<sha>`, `:latest`) push → 서버에 파일 복사 → `deploy.sh <sha>` |
| `mobile/**` 변경이 `main`에 머지됨 | Cloudflare Pages가 웹을 자동으로 빌드·배포 |
| 모바일 앱 | 필요할 때 `eas build` → TestFlight / 내부 테스트 |

- 재기동하는 동안 수 초~수십 초 다운타임이 생긴다 (MVP에서는 허용).
- `deploy.sh`는 Caddy를 거쳐 `https://api.<도메인>/`에 요청해 2xx~4xx 응답이 오면 성공으로 본다(인증이 필요한 경로라 정상이면 401). 3분 안에 응답하지 않으면 이전 이미지 태그로 되돌리고 워크플로를 실패 처리한다.
- 수동 롤백: 서버에서 `./scripts/deploy.sh <이전 커밋 SHA>`를 실행한다. 이전 이미지는 서버에 남아 있다. 서버에서 직접 pull이 필요하면 `read:packages` 권한 PAT로 `docker login ghcr.io`를 한다.

## 6. 배포 전 남은 작업

### 6.1 백엔드: 사진 저장소 (완료)
`app.storage.type`으로 저장소 구현을 고른다.

| 값 | 쓰는 곳 | 구현 |
|---|---|---|
| `local` (기본) | 로컬 개발 | `LocalFileObjectStorageAdapter` + `/local-storage/**` 엔드포인트 (permitAll도 이때만) |
| `s3` | `prod` 프로필 기본값 | `S3ObjectStorageAdapter` (AWS SDK v2 → R2) |

- presign: `Content-Type`을 서명에 포함한 PUT URL. 클라이언트는 같은 `Content-Type` 헤더로 버킷에 직접 PUT한다. 체크섬 헤더는 요구하지 않는다.
- 공개 URL: `STORAGE_PUBLIC_BASE_URL`(커스텀 도메인) + 오브젝트 키.
- 업로드 확인: `HEAD`. 10MB를 넘는 오브젝트는 삭제하고 "업로드 없음"(409)으로 처리한다. presigned PUT으로는 크기를 막을 수 없기 때문이다.
- 필수 설정(`STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` 등)이 비어 있으면 기동할 때 실패한다.

남은 일:
- [ ] 실제 R2 버킷으로 업로드 → confirm → 공개 URL 조회 스모크 테스트
- [ ] (선택) 업로드되었지만 confirm되지 않은 고아 파일 정리 — 확정된 사진도 같은 `spots/` 아래에 있으므로 R2 lifecycle은 쓸 수 없다. PENDING 스팟 정리 작업에서 같이 지운다

### 6.2 웹앱 / 모바일
- [ ] PWA 설정: 웹 manifest(`name`, `short_name`, `display: standalone`, `theme_color`, 아이콘 192/512)와 iOS용 `apple-touch-icon` 추가. 홈 화면에 추가하면 앱처럼 열린다
- [ ] 업로드 전 클라이언트 리사이즈 (`expo-image-manipulator`, 긴 변 1080px, JPEG 0.7)
- [ ] 카카오 개발자 콘솔: 웹 도메인, 앱 플랫폼(번들 ID / 키 해시) 등록
- [ ] 웹 토큰 저장(localStorage, XSS 노출) 재검토 — `todo-0922.md` 항목

## 7. 운영

- **백업**: 매일 04:00 KST에 `backup.sh`가 cron으로 실행된다. 결과는 `/opt/yar-mirror/backup.log`에 남는다. **복구를 한 번은 실제로 리허설한다.**
  ```bash
  docker compose exec -T db pg_restore -U yarmirror -d yarmirror --clean --if-exists --no-owner < yarmirror-XXXX.dump
  ```
- **로그**: `docker compose logs`로 본다. 컨테이너마다 10MB × 3개로 로테이션된다.
- **모니터링**: UptimeRobot 등 무료 서비스로 `https://api.<도메인>/`와 웹 도메인을 감시한다. AWS Budgets로 월 비용 알림을 건다.
- **보안**: `unattended-upgrades` 활성화, SSH 키 인증만 허용, DB 포트 비노출.
- **디스크**: 배포가 성공하면 dangling 이미지를 정리한다. 가끔 `docker system df`로 확인한다.

## 8. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 서버 1대 장애 → 전체 중단 | 일일 R2 백업 + Lightsail 스냅샷, 복구 리허설. MVP에서는 허용 |
| 배포 시 짧은 다운타임 | MVP에서는 허용. 헬스 체크 실패 시 자동 롤백 |
| 메모리 부족 | 컨테이너별 `mem_limit`, JVM `MaxRAMPercentage=75`, 스왑 2GB. 부족하면 4GB 플랜($24) |
| 22번 포트 노출 | 키 인증만 허용. 필요하면 Lightsail 방화벽에서 소스 IP 제한 |
| 비용 증가 | AWS Budgets, R2 사용량 알림, 백업 수명 주기 규칙 |

## 9. 확장 단계 (트리거 기반)

| 신호 | 대응 |
|---|---|
| 메모리·CPU 부족 | Lightsail 스냅샷으로 상위 플랜 인스턴스를 만들어 교체 |
| 다운타임 불만, 배포가 잦아짐 | Lightsail 스냅샷을 EC2로 내보내거나 같은 GHCR 이미지로 ECS·Fly.io 등에 올림 |
| DB 부하, 백업·복구 운영 부담 | `pg_dump`로 관리형 PostgreSQL(PostGIS)로 이전 |
| API 트래픽 증가 | `api` 레코드를 Cloudflare 프록시로 전환(인증서는 Cloudflare Origin CA로 교체) |

# Cloudflare 설정 기록

> 관련 문서: [DEPLOY.md](./DEPLOY.md) (전체 배포 계획과 진행 상황)
> 마지막 갱신: 2026-11-12
>
> 이 문서에는 **비밀 값(API 토큰, Secret Access Key, account ID)을 적지 않는다.** 실제 값은 비밀번호 관리자와 각 `.env`에만 둔다.

## 한눈에 보기

| 항목 | 값 | 상태 |
|---|---|---|
| 도메인 (zone) | `yarmirror.com.de` | ✅ Cloudflare 네임서버 사용 중 |
| 웹앱 | `yarmirror.com.de` (+ `www`) → Cloudflare Pages | ⬜ 미설정 |
| API | `api.yarmirror.com.de` → Lightsail 고정 IP (A 레코드, DNS only) | ⬜ 미설정 (서버 생성 후) |
| 사진 버킷 | R2 `yar-mirror-photos` | ✅ 생성 |
| 사진 공개 도메인 | `photos.yarmirror.com.de` → `yar-mirror-photos` | ✅ Active / Access Enabled |
| 사진 버킷 API 토큰 | `yar-mirror-photos` 전용, Object Read & Write | ✅ 발급 (로컬 `backend/.env`에 입력) |
| 백업 버킷 | R2 `yar-mirror-backups` | ⬜ 확인 필요 |
| 백업 버킷 API 토큰 | `yar-mirror-backups` 전용, Object Read & Write | ⬜ 확인 필요 |

---

## 1. 도메인 / DNS

- zone: `yarmirror.com.de`
- 네임서버: `gabriel.ns.cloudflare.com`, `raquel.ns.cloudflare.com`
- `.com.de`는 `.de` 공식 2단계 도메인이 아니라 민간 업체가 운영하는 하위 도메인이다. 갱신 가격과 갱신일을 따로 챙긴다.

### DNS 레코드

| 이름 | 타입 | 값 | 프록시 | 상태 |
|---|---|---|---|---|
| `photos` | (R2 커스텀 도메인이 자동 생성) | R2 | 프록시됨 | ✅ |
| `api` | A | Lightsail 고정 IP | **DNS only (회색 구름)** | ⬜ |
| `@`, `www` | (Pages 커스텀 도메인이 자동 생성) | Pages | 프록시됨 | ⬜ |

- `api`는 **반드시 DNS only**로 둔다. 서버의 Caddy가 Let's Encrypt 인증서를 직접 받아야 하기 때문이다. 프록시로 바꾸려면 인증서를 Cloudflare Origin CA로 교체해야 한다 ([DEPLOY.md](./DEPLOY.md) 9장).

---

## 2. R2 — 사진 버킷 `yar-mirror-photos`

### 생성 옵션
| 옵션 | 선택 | 이유 |
|---|---|---|
| Location | Automatic (Asia Pacific) | 서울 서버·한국 사용자와 가깝다. Jurisdiction은 EU 같은 데이터 거주 규정용이라 불필요하고, 지정하면 endpoint가 달라진다 |
| Storage class | Standard | 사진은 자주 조회된다. Infrequent Access는 무료 한도가 적용되지 않고, 조회 요금과 30일 최소 보관 요금이 붙는다 |

### 공개 접근
| 설정 | 값 |
|---|---|
| Custom Domain | `photos.yarmirror.com.de` — Status `Active`, Access `Enabled` |
| Minimum TLS | 1.2 (1.0/1.1은 폐기된 버전, 1.3은 구형 Android 호환 문제) |
| Public Development URL (`r2.dev`) | **Disabled** 유지 (개발용, 요청 수 제한 있음) |

> Access가 `Enabled`가 아니면 R2가 "Object not found / not publicly accessible" 404 페이지를 돌려준다.

### CORS 정책
웹앱에서 업로드 URL로 직접 PUT하려면 필요하다. 네이티브 앱은 CORS의 영향을 받지 않는다.

```json
[
  {
    "AllowedOrigins": ["https://yarmirror.com.de", "https://www.yarmirror.com.de"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

- 로컬 웹(`expo start --web`, `http://localhost:8081`)에서 R2로 업로드를 테스트하려면 `AllowedOrigins`에 `http://localhost:8081`을 **임시로** 추가하고, 끝나면 뺀다.

### API 토큰
- 위치: R2 Overview → **Manage API tokens** → **Create Account API token**
- 이름: `yar-mirror-photos-app`, 권한 **Object Read & Write**, 대상 버킷 **`yar-mirror-photos`만**
- 발급 화면에 나오는 값과 용도:

| 값 | 용도 |
|---|---|
| Token value | 사용하지 않음 (Cloudflare API용) |
| Access Key ID | `STORAGE_ACCESS_KEY_ID` |
| Secret Access Key | `STORAGE_SECRET_ACCESS_KEY` (발급 화면에서만 보임) |
| S3 endpoint | `STORAGE_ENDPOINT` |

### 백엔드 환경변수

```
STORAGE_BUCKET=yar-mirror-photos
STORAGE_PUBLIC_BASE_URL=https://photos.yarmirror.com.de
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<Access Key ID>
STORAGE_SECRET_ACCESS_KEY=<Secret Access Key>
```

### 겪은 문제와 주의점
| 증상 | 원인 | 해결 |
|---|---|---|
| 업로드·HEAD는 성공하는데 공개 URL이 404 | 버킷 Settings의 "S3 API" 주소를 그대로 넣어 `STORAGE_ENDPOINT` 끝에 `/yar-mirror-photos`가 붙음 → 키가 `yar-mirror-photos/spots/…`로 저장됨 | endpoint는 **`https://<account-id>.r2.cloudflarestorage.com`까지만**. 이제는 경로가 붙어 있으면 기동 시 실패한다 |
| 공개 URL이 404 ("not publicly accessible") | 커스텀 도메인 Access 비활성 | Custom Domains에서 Access `Enabled` |
| 스토리지 빈이 하나도 등록되지 않음 | `.env`에 `STORAGE_TYPE=s3   # 주석`처럼 인라인 주석을 붙임 | `.env`는 값 뒤 주석·공백을 지원하지 않는다. 주석은 별도 줄에. 이제는 잘못된 값이면 기동 시 실패한다 |

### 검증 (2026-11-12, 로컬 → 실제 R2)
- 다른 Content-Type으로 PUT → 403 (서명 검증 동작)
- CORS preflight (`Origin: https://yarmirror.com.de`) → 204, `allow-origin` 일치
- presigned PUT → 200, HEAD 확인 → 존재
- `https://photos.yarmirror.com.de/spots/…` GET → 200, `image/jpeg`, 내용 일치
- 테스트 오브젝트 삭제 완료

---

## 3. R2 — 백업 버킷 `yar-mirror-backups` (확인 필요)

아직 생성 여부를 확인하지 않았다. 없으면 아래대로 만든다.

1. 버킷 생성: 이름 `yar-mirror-backups`, Location Automatic, Storage class **Standard**
   - 덤프가 수 MB라 무료 한도 안이다. IA는 30일 최소 보관 요금이 30일 삭제 규칙과 겹쳐 이득이 없다.
2. 공개 접근: **커스텀 도메인 연결 안 함, `r2.dev` Disabled** (비공개 유지)
3. Settings → **Object lifecycle rules**: 30일 지난 객체 삭제
4. API 토큰: 이름 `yar-mirror-backups-server`, Object Read & Write, 대상 버킷 `yar-mirror-backups`만
5. 서버 `/opt/yar-mirror/.env`에 입력:
   ```
   BACKUP_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   BACKUP_R2_BUCKET=yar-mirror-backups
   BACKUP_R2_ACCESS_KEY_ID=<Access Key ID>
   BACKUP_R2_SECRET_ACCESS_KEY=<Secret Access Key>
   ```

> 사진용과 백업용 토큰을 나누는 이유: 한쪽 키가 유출되어도 다른 버킷은 안전하다. 특히 앱 서버가 쓰는 사진 토큰으로 백업을 지울 수 없게 한다.

---

## 4. Cloudflare Pages — 웹앱 (미설정)

[DEPLOY.md](./DEPLOY.md) 4.4 절차를 따른다. 요약:

| 항목 | 값 |
|---|---|
| Production branch | `main` |
| Root directory | `mobile` |
| Build command | `npx expo export -p web` |
| Output directory | `dist` |
| 환경변수 | `EXPO_PUBLIC_API_BASE_URL=https://api.yarmirror.com.de`, `EXPO_PUBLIC_KAKAO_JS_KEY`, `EXPO_PUBLIC_KAKAO_REST_API_KEY`, `NODE_VERSION=22` |
| Custom domains | `yarmirror.com.de`, `www.yarmirror.com.de` |

연결 후 확인할 것:
- 서버 `.env`의 `CORS_ALLOWED_ORIGINS=https://yarmirror.com.de,https://www.yarmirror.com.de`
- 카카오 개발자 콘솔에 웹 도메인과 운영 redirect URI 등록

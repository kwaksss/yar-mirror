# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 프로젝트 개요

`yar-mirror` 백엔드 — 거울샷 스팟 탐색 앱의 Spring Boot REST API 서버. 소셜 로그인(MVP 기준
카카오 OAuth2 단일 확정, 구글 OAuth2는 P1에서 추가 예정)과 위치 기반 거울 스팟 등록/조회를
제공한다. 제품 배경은 `../docs/PRD.md` 참고.

이 디렉터리(`backend/`)는 모노레포의 한 모듈이며, 형제 디렉터리 `../mobile/`(Expo/React Native)가
클라이언트다. 컨트롤러의 응답 JSON 형태는 모바일 클라이언트가 직접 소비하므로 계약(contract)으로
취급한다.

# 코딩 규칙

- 변수명: camelCase
- 상수: UPPER_SNAKE_CASE
- 포매터 플러그인은 없다. 기존 파일 스타일(4-space 들여쓰기, import 정렬)을 그대로 따를 것.
- 주석은 한글로 작성하고 javadoc에서 가독성좋게 이해할 수 있도록 작성합니다.

# 금지 사항

- `.env` 파일 읽기 금지 (`backend/.env`, `../.env` 모두)
- 직접적인 DB 접근은 반드시 repository 계층을 통할 것
- 컨트롤러 계약 테스트(`*ContractTest`)의 JSON 단언을 근거 없이 완화하지 말 것 — 모바일 클라이언트가
  깨진다

# 빌드 · 실행 · 테스트

Gradle wrapper 사용 (Gradle 8.14.3, Java 17 toolchain). Windows에서는 `gradlew.bat` 또는 bash로
`./gradlew`.

```bash
./gradlew build                 # 컴파일 + 테스트 + 패키징
./gradlew test                  # 전체 테스트 (DB 불필요 — 아래 참고)
./gradlew bootRun               # 로컬 서버 기동 (DB 필요)

# 단일 테스트 클래스 / 메서드
./gradlew test --tests "com.yarmirror.backend.spot.SpotServiceTest"
./gradlew test --tests "com.yarmirror.backend.spot.SpotServiceTest.someMethod"
```

DB (PostgreSQL + PostGIS)는 레포 루트의 `docker-compose.yml`로 띄운다. 호스트 포트는 **5433**.

```bash
cd .. && cp .env.example .env && docker compose up -d   # 최초 1회
```

현재 테스트는 실행 중인 DB가 필요 없다: `ApplicationWiringTest`는 datasource/JPA/Flyway
autoconfiguration을 제외하고 부팅하고, 나머지는 `@WebMvcTest` 또는 순수 단위 테스트다.
`bootRun`과 실제 통합 테스트에는 DB와 환경변수(특히 `JWT_SECRET`, 프로필 `prod`에서는 `DB_*`)가
필요하다. 로컬 프로필에는 개발용 기본 시크릿이 있다.

# 아키텍처

## 패키지 구조 (feature slice 기준)

`com.yarmirror.backend` 아래:

- `auth/` — OAuth 로그인, JWT 발급/검증, 리프레시 토큰 회전. `auth/dto/`에 요청·응답 레코드.
- `spot/` — 스팟 등록/조회, 거리 계산. `spot/storage/`에 사진 오브젝트 스토리지 포트/어댑터,
  `spot/dto/`에 요청·응답 레코드.
- `domain/` — JPA 엔티티(`User`, `RefreshToken`, `Spot`)와 enum, `GeoPoints` 유틸.
- `repository/` — Spring Data JPA 리포지토리 인터페이스와 프로젝션.
- `config/` — 시큐리티 설정, `@ConfigurationProperties` 레코드, 공용 빈(`Clock`, `RestClient`).
- `common/` — `ErrorResponse`, `GlobalExceptionHandler`, 공용 예외.

컨트롤러·서비스는 기능 패키지 안에 두고, 엔티티는 `domain`, 리포지토리는 `repository`에 모은다.

## 인증 (auth)

- **Stateless JWT** (jjwt, HS256). `SecurityConfig`는 세션을 만들지 않고 CSRF/formLogin/httpBasic을
  끈다. `permitAll`: `/auth/login/**`, `/auth/refresh`, `/local-storage/**`, `/error`(에러 포워드가 401로
  가려지지 않도록). 그 외 전부 인증 필요.
  인증 실패는 `ErrorResponse` JSON + 401.
- `JwtAuthenticationFilter`가 `Authorization: Bearer` 헤더를 파싱해
  `AuthenticatedUser(id, nickname)` principal을 SecurityContext에 넣는다. 컨트롤러는
  `@AuthenticationPrincipal AuthenticatedUser`로 사용자를 받는다.
- **토큰 종류**: access + refresh. `JwtService`가 `typ` 클레임으로 둘을 구분하고 issuer를 강제
  검증한다. 리프레시 토큰은 원문을 저장하지 않고 SHA-256 해시(`TokenHasher`)로
  `refresh_tokens`에 저장한다. `/auth/refresh` 시 기존 토큰을 revoke하고 새 쌍을 발급(회전).
- **OAuth 로그인**: `POST /auth/login/{provider}` (provider = `kakao` | `google`). 요청 본문
  `LoginRequest`는 `authorizationCode`와 `accessToken` 중 **정확히 하나만** 담아야 한다
  (code면 서버가 토큰 교환, accessToken이면 그대로 사용).
- `OAuthProviderRegistry`가 `List<OAuthProviderAdapter>`를 주입받아 `AuthProvider` enum → 어댑터로
  매핑. `AbstractOAuthProviderAdapter`가 토큰 교환 + userinfo 호출(`RestClient`)을 담당하고,
  하위 클래스(`KakaoOAuthProviderAdapter`, `GoogleOAuthProviderAdapter`)는 응답 JSON 파싱과
  닉네임 매핑만 구현한다. 닉네임은 `users.nickname` 컬럼 한계인 50자로 잘린다.

## 스팟 & 지오공간 (spot)

- Postgres + **PostGIS**, `hibernate-spatial` + JTS. `Spot`은 `latitude`/`longitude`(double)와
  별도로 `location geography(Point,4326)` 컬럼을 가지며, `@PrePersist`/`@PreUpdate`의
  `syncLocation()`이 `GeoPoints.of(lat, lng)`로 항상 동기화한다. **PostGIS 좌표 순서는 (경도, 위도)**
  임에 주의.
- `GET /spots?lat=&lng=&radius=` — `SpotRepository.findConfirmedWithin`은 `ST_DWithin`/`ST_Distance`
  를 쓰는 **네이티브 쿼리**로, `CONFIRMED` 스팟만 거리순으로 반환한다. 결과는 프로젝션 인터페이스
  `SpotWithDistanceProjection`. `radius`는 `SpotProperties`의 기본/최대값으로 클램프된다.
- `GET /spots/{id}` — 상세. 쿼리 좌표가 있으면 거리를 Java(`GeoDistance.haversineMeters`)로 계산.

## 사진 업로드 (2단계 flow)

1. `POST /spots` — `Spot`을 `PENDING`으로 저장하고 presigned 업로드 URL을 발급
   (`ObjectStoragePort.presignUpload`). 응답 본문은 **평평한(flat)** 구조 — 중첩된 `spot` 객체 없음.
2. 클라이언트가 그 URL로 사진 바이트를 `PUT`.
3. `POST /spots/{id}/confirm-upload` — 오브젝트 존재(HEAD 상당)를 확인한 뒤 `CONFIRMED`로 전환.
   업로더 본인만 가능(`ForbiddenException`), 오브젝트 없으면 409(`UploadNotFoundException`).

`LocalFileObjectStorageAdapter`는 S3 대체용 로컬 파일 구현이고, `LocalStorageUploadController`가
`/local-storage/**`에서 바이트를 받고(PUT) 내려준다(GET, S3 공개 읽기 대체). 실제 S3 도입 시 두 클래스와 `permitAll` 규칙을 삭제할 것.
오브젝트 키는 `spots/{uuid}.{jpg|png|webp}` 형식이며 정규식으로 검증해 path traversal을 차단한다.

## 설정 & 스키마

- `BackendApplication`에 `@ConfigurationPropertiesScan`. `config/`의 프로퍼티 레코드
  (`JwtProperties`, `OAuthProperties`, `SpotProperties`, `StorageProperties`)가 `application.yml`의
  `app.*`에서 바인딩된다. `AppConfig`가 `Clock`(systemUTC)과 공용 `RestClient` 빈을 제공한다.
  시간이 관여하는 모든 곳에 `Clock`을 주입하고, 테스트는 고정 `Clock`으로 교체한다.
- `application.yml`은 multi-document. 프로필 `local`(기본)/`prod`. `.env`는
  `spring.config.import: optional:file:.env[.properties]`로 로드된다.
- **스키마는 Flyway가 소유** (`src/main/resources/db/migration/`). JPA `ddl-auto=validate`이므로
  엔티티 매핑은 마이그레이션과 정확히 일치해야 하고, 스키마 변경은 새 `V__*.sql` 파일로 한다.
- `OAuthConfigProbe`(local 전용)가 부팅 시 OAuth 자격증명 바인딩 여부를 안전하게(해시 접두어만)
  로그로 남긴다.
- `GlobalExceptionHandler`(`@RestControllerAdvice`)가 도메인 예외를 `ErrorResponse(code, message)`
  + HTTP 상태로 매핑한다. 새 예외를 만들면 여기에 핸들러를 추가할 것.

# 테스트 컨벤션

- 컨트롤러: `@WebMvcTest(XxxController.class)` + `@Import({SecurityConfig.class,
  JwtAuthenticationFilter.class})`, 협력자는 `@MockitoBean`. 인증은
  `SecurityMockMvcRequestPostProcessors.authentication(...)`으로 주입.
- 서비스/유틸: 순수 JUnit 5 + AssertJ + Mockito, 스프링 컨텍스트 없음.
- 결정성을 위해 고정 `Instant`/`Clock` 사용.
- given, when, then을 표시합니다.

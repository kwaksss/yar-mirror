# 거울샷 스팟 탐색 앱 프로젝트 계획

> 기반 문서: [docs/PRD.md](./PRD.md)
> 개발 방식: 1인 개발, P0(MVP) 우선 → P1 확장
> **수정 이력**: PM 리뷰 반영 — ① 위치 권한 거부 시 fallback ② refresh token 엔드포인트/정책 추가 ③ 사진 업로드 완료 검증 로직 추가

## 1. Requirements Summary

- **Why**: 혼자 활동하는 패션 인플루언서는 촬영 보조가 없어 거울샷으로 착용샷을 대체하지만, 찍기 좋은 스팟을 찾기 어려움 → 사용자 간 스팟 공유로 해결
- **Who**: 개인/소규모(팔로워 소수) 패션 인플루언서, 인플루언서 지망생
- **P0 범위 (MVP)**: 소셜 로그인(카카오, 구글 OAuth2 2종) + 세션 유지(refresh 포함), 위치 권한/현재 위치 조회(거부 시 fallback), 현재 위치 중심 지도, 주변 스팟 조회·마커 표시(지도 이동 시 재조회), 스팟 상세(사진·거리·주소), 스팟 등록(위치 지정 + 사진 1장, 업로드 검증 포함)
- **P1 범위 (확장)**: 로그아웃/탈퇴, 마이페이지, 검색, 즐겨찾기, 다중 사진, 리뷰/평점, 신고, 길찾기 딥링크, 인기 스팟 랭킹
- **범위 밖 (MVP 기준)**: 마커-리스트 연동 뷰, 사진 다중 업로드, 소셜 상호작용 기능 전반

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| Frontend | React Native (Expo), TypeScript |
| 지도 | 카카오맵 API |
| Backend | Spring Boot 3.x, Java 17, Jar 패키징, YAML(`application.yml`) 설정 |
| DB | PostgreSQL + PostGIS (위치 기반 조회용) |
| 인증 | OAuth2 소셜 로그인(카카오, 구글 2종) + 자체 JWT(access/refresh) 발급 |
| 스토리지 | 오브젝트 스토리지 (S3 or 호환, 스팟 사진 업로드, 업로드 완료 이벤트 연동) |
| 인프라 | 단일 서버 배포 (Docker), CI/CD는 후순위 |

> **주의**: 카카오맵은 공식 React Native SDK가 없음. WebView + 카카오맵 JS SDK 또는 커뮤니티 RN 라이브러리 중 선택 필요 → Phase 0에서 PoC로 검증.

## 3. 아키텍처 개요

```
[RN App] --REST(JWT: access+refresh)--> [Spring Boot API] --> [PostgreSQL+PostGIS]
                                                          \--> [Object Storage(사진) + 업로드 완료 이벤트/HEAD 검증]
                                                          \--> [Kakao OAuth / Google OAuth]
```

## 4. 데이터 모델 (초안)

- **User**: id, nickname, provider, providerId, createdAt
- **RefreshToken**: id, userId, tokenHash, expiresAt, revokedAt
- **Spot**: id, uploaderId, latitude, longitude, address, name, description, photoUrl, photoUploadStatus(`PENDING`/`CONFIRMED`), createdAt
- (P1) **Review**: id, spotId, userId, rating, comment
- (P1) **Favorite**: id, userId, spotId
- (P1) **Report**: id, spotId, reporterId, reason

## 5. API 설계 (초안)

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/auth/login/{provider}` | 소셜 로그인 → access/refresh JWT 발급 |
| POST | `/auth/refresh` | refresh token으로 access token 재발급 |
| GET | `/auth/me` | 내 프로필 조회 |
| GET | `/spots?lat=&lng=&radius=` | 주변 스팟 조회 (지도 영역 기준, `photoUploadStatus=CONFIRMED`만 노출) |
| GET | `/spots/{id}` | 스팟 상세 조회 |
| POST | `/spots` | 스팟 등록 요청 (메타데이터 + presigned URL 발급, 상태 `PENDING`) |
| POST | `/spots/{id}/confirm-upload` | 업로드 완료 확인 (HEAD 검증 후 상태 `CONFIRMED` 전환) |
| GET | `/spots/search?keyword=` | (P1) 키워드 검색 |
| POST | `/spots/{id}/favorite` | (P1) 즐겨찾기 |
| POST | `/spots/{id}/report` | (P1) 신고 |
| DELETE | `/auth/me` | (P1) 회원 탈퇴 |

## 6. Implementation Steps (마일스톤)

### Phase 0 — 준비 (1주)
- Expo 프로젝트 / Spring Boot 프로젝트 초기 세팅
- 카카오 디벨로퍼스 앱 등록 (로그인 키, 지도 키)
- Google Cloud Console OAuth 클라이언트 등록 (iOS/Android/Web 클라이언트 ID, 동의 화면 설정)
- 카카오맵 RN 연동 방식 PoC (WebView vs 라이브러리)
- DB 스키마 설계, PostGIS 세팅 (`spots` 테이블에 `geography(Point,4326)` 컬럼 + GiST 인덱스)
- 오브젝트 스토리지 버킷/자격증명 세팅, 업로드 완료 이벤트(or presigned HEAD 검증) 방식 결정
- **서비스 기본 중심 좌표(fallback location) 정의**

### Phase 1 — 인증 & 기본 지도 (2주)
- 카카오/구글 소셜 로그인 연동 (FE/BE), provider별 OAuth2 어댑터 설계
- **JWT 발급·검증 (access + refresh 이원화), refresh token 저장/폐기 로직**
- 로그인 세션 유지 (RN SecureStore/AsyncStorage + access 만료 시 자동 refresh 호출)
- 위치 권한 요청 및 현재 위치 조회
- **위치 권한 거부/실패 시 기본 중심 좌표로 지도 진입 + 권한 재요청 유도 UI**
- 현재 위치 중심 카카오맵 표시

### Phase 2 — 스팟 조회 (2주)
- 반경/영역 기반 스팟 조회 API (PostGIS `ST_DWithin` 쿼리, `CONFIRMED` 상태만 조회)
- 지도 마커 표시, 지도 이동(idle) 시 재조회 (debounce 적용)
- 스팟 상세 화면 (사진, 거리, 주소)
- 현재 위치-스팟 간 거리 계산 (`ST_Distance` 또는 Haversine)

### Phase 3 — 스팟 등록 (1.5주 → 2주)
- 사진 업로드 (presigned URL 방식, 용량/포맷 제한 적용)
- **업로드 완료 검증: 클라이언트 업로드 후 `/spots/{id}/confirm-upload` 호출 → 서버가 스토리지 HEAD 요청으로 실제 존재 확인 후 `CONFIRMED` 전환**
- **미확인(`PENDING`) 상태 스팟은 조회 API에서 제외, 일정 시간(예: 24h) 경과 시 배치로 정리**
- 위치 지정 (현재 위치 or 지도 탭)
- 스팟 등록 폼 (이름 필수, 설명 선택)
- 등록 후 지도 즉시 반영 (로컬 상태 optimistic update, 단 서버 확인 실패 시 롤백)

### Phase 4 — MVP 마감 & QA (1주)
- P0 기능 통합 테스트, 예외/로딩/에러 처리
- 베타 배포 (TestFlight / 내부 테스트 APK)

### Phase 5 이후 — P1 확장 (지속)
- 로그아웃/회원 탈퇴
- 마이페이지 (내 스팟 관리)
- 검색(지역/키워드), 즐겨찾기
- 스팟당 다중 사진 업로드
- 리뷰/평점, 신고 기능
- 길찾기 외부 딥링크, 인기 스팟 랭킹

## 7. Acceptance Criteria (테스트 가능한 완료 기준)

**Phase 1 — 인증 & 지도**
- [ ] 카카오/구글 로그인 버튼 각각을 통해 로그인 완료 시 access/refresh JWT가 발급되고, 앱을 종료 후 재실행해도 재로그인 없이 지도 화면으로 진입한다
- [ ] access token 만료 후 API 호출 시 자동으로 `/auth/refresh`가 호출되어 재로그인 없이 요청이 성공한다
- [ ] 동일 사용자가 카카오/구글 중 하나로 최초 가입 후, 다른 provider로는 별도 계정으로 처리된다 (계정 통합은 범위 밖)
- [ ] 위치 권한을 거부하면 권한 안내 UI가 표시되고, **기본 중심 좌표로 지도가 정상 진입한다**
- [ ] 위치 권한을 허용하면 5초 이내 현재 위경도가 조회되고 지도 중심이 갱신된다

**Phase 2 — 스팟 조회**
- [ ] 현재 위치 기준 반경 내 등록된 스팟이 모두 마커로 표시된다 (등록된 개수와 마커 개수 일치, `CONFIRMED` 상태만 포함)
- [ ] 지도를 이동/줌 변경한 뒤 일정 시간(예: 500ms debounce) 내 해당 영역 스팟으로 재조회된다
- [ ] 마커 탭 시 상세 화면에 사진, 주소, 현재 위치 대비 거리(m/km 단위)가 표시된다

**Phase 3 — 스팟 등록**
- [ ] 사진을 첨부하지 않으면 등록이 불가능하고 에러 메시지가 표시된다
- [ ] 사진 업로드 후 `confirm-upload` 호출 시 서버가 스토리지에서 실제 파일 존재를 확인한 경우에만 상태가 `CONFIRMED`로 전환된다
- [ ] 업로드 실패/미완료 스팟(`PENDING`)은 지도·조회 API에 노출되지 않는다
- [ ] 등록 성공 시 지도 화면으로 돌아왔을 때 신규 마커가 반영되어 있다
- [ ] 등록한 스팟은 DB에 위치(위경도)·사진 URL·이름이 정확히 저장된다

**Phase 4 — MVP 통합**
- [ ] 로그인 → 지도 탐색 → 스팟 상세 조회 → 스팟 등록 → 지도 재조회 전체 플로우가 중단 없이 완료된다
- [ ] 네트워크 오류/빈 결과(주변 스팟 0개) 상황에서 앱이 크래시 없이 적절한 안내를 표시한다

## 8. Risks and Mitigations

| 리스크 | 영향 | 완화 방안 |
|---|---|---|
| 카카오맵 RN 공식 SDK 부재 | 지도 렌더링 방식 자체가 불확실 → 일정 지연 | Phase 0에서 WebView/커뮤니티 라이브러리 PoC로 조기 검증 |
| 1인 개발로 인한 병목 | 전 영역(FE/BE/디자인) 직접 처리로 속도 저하 | P0 범위 엄수, 기능 추가 자제, 마일스톤별 버퍼 포함 |
| 반경 조회 성능 | 스팟 수 증가 시 응답 지연 | PostGIS GiST 인덱스 적용, 쿼리 `EXPLAIN ANALYZE`로 검증 |
| 이미지 업로드 관리 미흡 | 저장 비용/부적절한 콘텐츠 증가, 깨진 링크 스팟 등록 | 업로드 시 용량·포맷 제한 + confirm-upload 검증, 추후 신고 기능(P1)로 대응 |
| 소셜 로그인 정책 변경 (카카오/구글) | 인증 플로우 중단 | OAuth 연동을 인증 어댑터 계층으로 분리해 provider별 영향을 격리 |
| 구글 OAuth 동의 화면 심사 지연 | 앱 배포 전 구글 로그인 사용 불가 | Phase 0에서 조기에 동의 화면 등록/심사 신청, 심사 중에는 테스트 계정으로 개발 진행 |
| 위치 권한 미허용 사용자 이탈 | 지도 진입 자체 불가로 핵심 플로우 차단 | fallback 중심 좌표 + 재요청 유도 UI로 최소 기능 보장 |
| refresh token 탈취 | 세션 하이재킹 위험 | tokenHash 저장(평문 미저장), 폐기(revoke) API 및 만료 정책 적용 |

## 9. Verification Steps

- **Phase 0**: PoC 빌드에서 카카오맵이 RN 화면에 실제 렌더링되는지 실기기/시뮬레이터로 확인
- **Phase 1**: 실기기에서 카카오/구글 각각 로그인 → 앱 강제 종료 → 재실행 → 자동 로그인(세션 유지) 확인 + access 만료 강제 유발 후 자동 refresh 동작 확인
- **Phase 2**: `curl`/Postman으로 `/spots?lat=&lng=&radius=` 응답 검증 + `EXPLAIN ANALYZE`로 GiST 인덱스 사용 확인
- **Phase 3**: 실기기에서 사진 업로드 후 오브젝트 스토리지에 파일 존재 확인 + DB row 저장 확인 + `confirm-upload` 미호출/업로드 실패 시나리오에서 스팟이 노출되지 않음을 확인
- **Phase 4**: 체크리스트 기반 P0 전체 E2E 시나리오 수동 QA (로그인 → 탐색 → 상세 → 등록 → 재조회), 오류 상황(권한 거부, 네트워크 끊김) 별도 확인

## 10. 다음 단계
- Phase 0 착수: 프로젝트 초기 세팅 + 카카오 API 키 발급 + 구글 OAuth 클라이언트 등록
- 카카오맵 RN 연동 PoC 진행
- fallback 좌표 및 refresh token 정책 상세 스펙 확정
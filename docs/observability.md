# 에러·성능 모니터링 (관측성)

앱(iOS·Android)과 웹앱(app.rougether.com)에서 **무엇이 깨졌고 무엇이 느린지**를 어디서 보고, 새 코드를 쓸 때 무엇을 남겨야 하는지 정리한 문서입니다. 도입 배경은 #801(Sentry), #1376(에러 품질·성능 추적).

역할 분담은 하나로 고정합니다.

| 질문                                             | 도구                | 위치                                             |
| ------------------------------------------------ | ------------------- | ------------------------------------------------ |
| 무엇이 깨졌나(예외·크래시·렌더 오류)             | Sentry 이슈         | `triples.sentry.io` / `rougether-mobile`         |
| 무엇이 느린가(앱 시작·화면 전환·API 구간·프레임) | Sentry 성능(Traces) | 같은 프로젝트                                    |
| 얼마나 자주 실패하나·사용자가 무엇을 했나        | GA4 이벤트          | 앱 속성 `rougether-e56ae`, 웹 속성은 자동 수집만 |

## 1. 레인(environment)과 샘플링

`src/lib/error-reporting.ts`의 `resolveReportingLane`이 실행 중인 바이너리·호스트로 정합니다. Sentry 이슈·성능 화면 상단의 Environment 필터로 가릅니다.

| environment      | 조건                                  | 트레이스 샘플링 | 비고                                                               |
| ---------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------ |
| `production`     | 네이티브 채널 `production` 또는 `dev` | 20%             | `dev` 채널은 2026-09-16 재배선으로 스토어 레인(심사 제출 빌드 125) |
| `internal`       | 네이티브 채널 `internal`              | 100%            | 개발 레인 테스트 빌드                                              |
| `web-production` | 웹, 호스트 `app.rougether.com`        | 20%             |                                                                    |
| `web-dev`        | 웹, 그 외 호스트(로컬 8081 등)        | 100%            |                                                                    |
| `unknown`        | 채널 없음(개발 빌드·Expo Go)          | 100%            |                                                                    |

- 개발 모드(`__DEV__`)에서는 아무것도 보내지 않습니다.
- **에러는 샘플링하지 않습니다**(전량). 샘플링은 성능 트랜잭션에만 적용됩니다.
- 운영 20%의 근거: Sentry 무료(Developer) 플랜은 월 에러 5천·스팬 5백만. DAU 수십 명·세션당 수백 스팬이면 100%여도 월 100만 스팬대지만, 글로벌 출시(#1369)로 사용자가 열 배가 돼도 한도 안에 들도록 20%로 둡니다. 월 사용량은 Sentry Stats에서 확인하고, 스팬이 월 3백만을 넘기 시작하면 10%로 낮춥니다.

## 2. 무엇이 수집되나

**에러**

- 전역 JS 예외·처리 안 된 Promise 거부(네이티브), 브라우저 전역 에러(웹), 네이티브 크래시(iOS·Android SDK).
- **화면 렌더 예외**: 루트의 `AppErrorBoundary`가 잡아 이벤트(컴포넌트 스택 포함)로 보내고, 흰 화면 대신 "문제가 생겼어요 · 다시 시도" 화면을 띄웁니다.
- **react-query 최종 실패**(`src/lib/query-client.ts`): 5xx와 예상치 못한 예외만. 4xx·오프라인은 보내지 않습니다(아래 규칙).
- 코드에서 직접 남기는 것: `reportError(error, context)` 호출부(소셜 로그인 실패, 강제 로그아웃 등).

**성능**

- 화면 전환: Expo Router 내비게이션 컨테이너를 `registerNavigationContainer`로 등록(`src/app/_layout.tsx`). 트랜잭션 이름은 라우트 이름.
- 앱 시작 시간·느린/멈춘 프레임·JS 스톨: 네이티브만(웹은 해당 없음).
- API 구간: **우리 API(`API_BASE`) 요청만** 스팬으로. 이미지 CDN·소셜 SDK·개발 서버 요청은 제외.

**자동 컨텍스트**: OTA 업데이트 id·채널·런타임 버전(expo-updates, SDK 자동), 기기·OS, 릴리스.

## 3. 태그 사전

| 태그           | 값                                         | 붙는 곳                                     |
| -------------- | ------------------------------------------ | ------------------------------------------- |
| `channel`      | `production`·`dev`·`internal`·`web`·`none` | 초기화 시                                   |
| `platform`     | `ios`·`android`·`web`                      | 초기화 시, `reportError` 이벤트             |
| `app_language` | `ko`·`en`                                  | 언어 결정·변경 시(#1369)                    |
| user `id`      | 서버 회원 id                               | 로그인 시(`setErrorUser`), 로그아웃 시 해제 |

`reportError`의 `extra`에는 위치를 알 수 있는 짧은 값만: `source`(`query`·`mutation`), `key`(react-query 키의 **첫 요소만**), `reason`·`code`·`app_state`(강제 로그아웃).

## 4. 개인정보 처리

- `sendDefaultPii: false` — IP·기기 식별자 등 기본 PII를 수집하지 않습니다. 사용자 식별은 서버 회원 id만.
- **URL 정리**(`scrubUrl`): 스팬 설명·스팬 데이터(`url`·`http.url`)·브레드크럼 URL에서 쿼리·해시를 지우고 경로의 식별자(숫자 id·UUID·숫자가 섞인 6자 이상 영숫자)를 `{id}`로 바꿉니다. GA4 `api_error`의 endpoint와 버그 제보 진단 기록도 같은 함수(`normalizeDiagnosticsPath`)를 씁니다. 초대코드·날짜·회원 id가 Sentry로 가지 않게. `http.query`·`http.fragment`는 비웁니다.
- 요청·응답 본문, 토큰, 사용자 입력은 어디에도 싣지 않습니다. react-query 키는 첫 요소만.
- 세션 리플레이는 끕니다(마스킹 검증 전).

## 5. 트레이스 헤더 전파를 끈 이유

`tracePropagationTargets: []` — API 요청에 `sentry-trace`·`baggage` 헤더를 붙이지 않습니다.

1. 서버에 Sentry가 없어 이어 볼 곳이 없습니다.
2. **웹에서 API가 통째로 막힙니다.** 서버 CORS 허용 헤더가 `Authorization·Content-Type·Accept·Origin`뿐이라(rougether-server `SecurityConfig`), 브라우저가 커스텀 헤더에 대해 보내는 사전 요청(preflight)이 거부됩니다.
3. SDK 기본값은 네이티브에서 **모든 URL**(`/.*/`)에 헤더를 붙입니다 — 외부 서비스로도 트레이스 id가 나갑니다.

서버에 Sentry를 붙이면(후속) CORS 허용 헤더에 `sentry-trace`·`baggage`를 추가한 **뒤에** 대상 목록을 `API_BASE`로 좁혀 켭니다. 순서가 바뀌면 웹이 먼저 깨집니다.

## 6. 새 코드에서 에러를 남기는 규칙

| 상황                                      | 할 일                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 렌더 중 예외                              | 아무것도 안 해도 된다 — 경계가 잡는다. 화면 단위로 부분 복구가 필요하면 그 화면에 경계를 추가                      |
| react-query 훅의 실패                     | 아무것도 안 해도 된다 — 캐시 콜백이 규칙대로 보낸다                                                                |
| `try/catch`로 삼키고 토스트만 띄우는 예외 | **예상치 못한 예외면** `reportError(err, { where: '...' })`. 사용자 입력 오류·4xx 같은 정상 흐름이면 보내지 않는다 |
| 서버 4xx(없음·권한·검증 실패)             | Sentry로 보내지 않는다. 빈도는 GA4 `api_error`(엔드포인트·상태코드)가 센다                                         |
| 오프라인·네트워크 실패                    | Sentry로 보내지 않는다(GA4 `api_error` status 0)                                                                   |
| 사용자 흐름의 실패 비율을 보고 싶다       | GA4 이벤트(예: `login_failed`, `session_forced_logout`)                                                            |

## 7. 자주 보는 화면

- **새 이슈 분류**: Issues → Environment `production`·`web-production` → "For Review". OTA로 번진 이슈는 이벤트 컨텍스트의 update id로 어느 발행부터인지 확인.
- **릴리스 헬스**: Releases → 크래시 없는 세션 비율. 네이티브 빌드·OTA 발행 직후 확인.
- **느린 화면**: Insights(Performance) → 트랜잭션을 p75 기준 정렬. 화면 전환 트랜잭션 안의 `http.client` 스팬으로 느린 API를 찾는다.
- **강제 로그아웃(#1388)**: Sentry 이슈 `forced logout: refresh_rejected` + GA4 `session_forced_logout`(`reason`·`code`·`app_state` 측정기준).
- **API 실패 추이**: GA4 `api_error` 이벤트 상세 → `endpoint`·`status`.

## 8. 후속(범위 밖)

- **알림 규칙**(Sentry 콘솔): 운영 레인 신규 이슈, 크래시 없는 세션 비율 하락(예: 99% 미만), `forced logout` 이벤트 급증, 5xx 이슈 급증 → 메일 또는 Webex(서버 알림 채널과 통일).
- **서버 관측성**(rougether-server): Spring Sentry(에러·트레이스) + Micrometer 지표(p95 지연·DB 커넥션 풀·JVM). 붙인 뒤 5절 순서대로 트레이스 전파를 켜면 앱 요청과 서버 처리를 한 흐름으로 본다.
- **세션 리플레이**: 개인정보 마스킹 검증 후 에러 발생 세션만(무료 월 50회).

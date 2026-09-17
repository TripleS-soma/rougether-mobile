# 성능 추적을 켜면 웹 API가 통째로 막힐 뻔한 문제 — 트레이스 헤더 전파와 CORS

- 2026-09-16 / infra(관측성) / #1376
- 키워드: Sentry 성능 추적, 분산 트레이싱(sentry-trace·baggage), CORS preflight, React Native Web, Expo Router 계측, 개인정보(URL 정리)

## 배경

앱은 Sentry로 에러만 수집하고 성능 추적은 꺼져 있었다(`tracesSampleRate: 0`). 모니터링 고도화(#1376)로 iOS·Android·웹(app.rougether.com) 모두에 화면 전환·앱 시작·API 구간 추적을 켜기로 했다. 같은 코드베이스가 React Native Web으로 웹에도 나가므로, 네이티브에서 안전한 설정이 웹에서도 안전한지 따로 따져야 했다.

## 문제

"성능 추적을 켠다"는 한 줄 설정이 **웹앱의 모든 API 호출을 깨뜨릴 수 있었다.** 문서 예제대로 켜면 겉보기엔 아무 문제가 없고, 네이티브 테스트도 통과하며, 운영 웹에서만 로그인·데이터 조회가 일제히 실패하는 종류의 사고다.

## 원인 분석 (가설 → 검증)

1. 설치된 SDK 소스(`@sentry/react-native` 7.11 `tracing/reactnativetracing.js`)를 읽었다. 요청 계측은 `tracePropagationTargets`에 맞는 URL에 `sentry-trace`·`baggage` 헤더를 붙인다. 기본값이 **플랫폼마다 달랐다**: 네이티브는 `/.*/`(모든 URL — 외부 서비스 포함), 웹은 같은 출처만.
2. 우리 웹앱(app.rougether.com)과 API(CloudFront 도메인)는 출처가 다르다. 전파 대상에 API를 넣으면 브라우저는 커스텀 헤더 때문에 **사전 요청(preflight)** 을 보낸다.
3. 서버 저장소(rougether-server `SecurityConfig`)의 CORS 허용 헤더를 확인: `Authorization, Content-Type, Accept, Origin`뿐 → preflight 거부 → 브라우저가 본 요청을 보내지 않는다. 네이티브는 CORS가 없어 이 문제가 드러나지 않는다.
4. 게다가 서버에는 Sentry가 없어 헤더를 받아도 이어 볼 곳이 없다 — 전파의 이득은 0, 위험만 있다.

## 해결

- `tracePropagationTargets: []`로 전 플랫폼 전파를 끄고 **스팬만** 남긴다. 스팬은 `shouldCreateSpanForRequest`로 우리 API 요청에만 만든다(이미지 CDN·소셜 SDK 제외).
- 서버에 Sentry를 붙이는 후속 순서를 문서에 못 박음: **서버 CORS 허용 헤더 추가 → 그다음 전파 대상을 API로 좁혀 켜기.** 순서가 바뀌면 웹이 먼저 깨진다.
- 같은 김에 개인정보 경로를 막음: 스팬 설명·스팬 데이터·브레드크럼의 URL에서 쿼리·해시를 지우고 숫자 id를 `{id}`로(`beforeSendSpan`·`beforeBreadcrumb`). 초대코드가 쿼리에 실리는 요청이 있었다.
- Expo Router 계측: 설치된 7.11에는 최신 문서의 `expoRouterIntegration`이 없어(문서는 최신 SDK 기준) SDK 소스를 확인하고 `reactNavigationIntegration` + `useNavigationContainerRef` 등록 방식으로 구현.
- 레인별 environment·샘플링(운영 20%, 개발 100%)과 렌더 예외 복구 화면(ErrorBoundary), react-query 실패 중 5xx·예상치 못한 예외만 보고하는 필터를 함께 넣음.

## 결과 (수치)

- 전파 헤더 0개 → 웹 API preflight 영향 없음(설정 테스트로 고정).
- 운영 샘플링 20%: 무료 한도 월 5백만 스팬 대비, 사용자 10배 증가에도 한도 안(근거는 `docs/observability.md`).
- 관련 스위트 통과: error-reporting·query-client 13 tests, 오류 복구 화면 2 tests.

## 배운 점 / 재발 방지

- 크로스 플랫폼 SDK의 "기본값"은 플랫폼마다 다를 수 있다. 문서 예제가 아니라 **설치된 버전의 소스**를 읽어야 실제 동작을 안다(문서가 최신 SDK 기준이라 API 이름도 달랐다).
- 요청에 헤더를 추가하는 모든 계측은 웹에서 **CORS preflight**를 먼저 떠올린다. 네이티브 테스트로는 절대 안 잡힌다.
- 관측성 도구도 개인정보 경로다. URL·쿼리·키를 그대로 보내지 않게 수집 단계에서 정리한다.

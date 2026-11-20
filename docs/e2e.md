# 웹 E2E — 화면 크기별 배치 규칙

내보낸 웹 앱을 화면 크기가 다른 Chromium 프로젝트(폰·접힌 Duo·펼친 Duo·데스크톱)에서 열고,
요소의 위치와 크기를 **수치로** 단언합니다. 설계 배경은
[설계서](superpowers/specs/2026-11-19-foldable-e2e-design.md)를 보세요.

## 무엇을 검사하나

설계서의 배치 규칙 여섯 개입니다. 규칙 1·2·3·5·6은 `e2e/specs/layout-rules.e2e.ts`가 검사합니다(테스트
이름에 규칙 번호가 붙습니다). **규칙 4는 아직 도우미(`expectFillsWidth`, `e2e/support/layout.ts`)만
있고 테스트가 없습니다** — 펼친 화면 2단을 만드는 설계서 구현 순서 3에서 테스트와 함께 들어옵니다.

1. 조작 요소가 기기별 "가려지는 영역"(시스템 표시 영역, 탭 바)과 겹치지 않는다.
2. 열린 모달의 닫기 버튼이 화면 안에 있고 누를 수 있다.
3. 방·집 그림의 가로세로 비가 계약 값과 1% 안에서 같고 잘리지 않는다.
4. 펼친 화면에서 두 칸이 나란히 있고 내용 폭이 창 폭과 같다.
5. 각 탭의 핵심 내용이 첫 화면 안에 있다.
6. 가로 스크롤이 생기지 않는다.

스크린샷 비교는 쓰지 않습니다. 폰트·안티앨리어싱·애니메이션 타이밍 때문에 픽셀이 흔들려 가짜
실패가 잦고, 실패해도 "무엇이 어디서 어긋났는지"가 수치로 남지 않기 때문입니다. 수치 단언은
어긋난 값이 메시지에 그대로 나옵니다.

## 로컬 실행

```bash
npx --no-install expo export --platform web --output-dir web-build/app
npx --no-install playwright test -c playwright.e2e.config.ts
```

첫 줄은 앱 코드를 바꿀 때마다 다시 실행해야 합니다(테스트는 내보낸 결과물을 엽니다). 정적 서버는
설정이 6010 포트로 자동 기동합니다. 리포트와 트레이스는 이미 제외된 `web-build/` 아래에만 생기고,
`package.json` 스크립트는 네이티브 지문 입력이라 쓰지 않고 CLI를 직접 호출합니다.
특정 파일·프로젝트만: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/layout-rules.e2e.ts --project=duo-folded`.

## 화면 크기 프로젝트

| 프로젝트     | 뷰포트   | 터치 | 안전 영역 인셋(위·오른쪽·아래·왼쪽) |
| ------------ | -------- | ---- | ----------------------------------- |
| `phone`      | 402×874  | 켬   | 0 · 0 · 0 · 0                       |
| `duo-folded` | 466×678  | 켬   | 0 · 84 · 34 · 0                     |
| `duo-open`   | 951×669  | 켬   | 0 · 84 · 34 · 0                     |
| `desktop`    | 1280×800 | 끔   | 0 · 0 · 0 · 0                       |

Duo의 인셋은 iOS 27.2 시뮬레이터에서 `window.safeAreaInsets`로 잰 값입니다. 오른쪽 위에 보이는
시스템 표시 영역(카메라·시계·와이파이)은 접힘·펼침 모두 **오른쪽 84pt 전체 높이**의 인셋으로
나옵니다. 테스트는 이 값을 브라우저에 주입하고(`Emulation.setSafeAreaInsetsOverride` →
`env(safe-area-inset-*)`), 안전 영역 밖의 띠를 "가려지는 영역"으로 삼아 조작 요소가 겹치지
않는지 봅니다(`e2e/specs/safe-area.e2e.ts`).

값의 출처는 `e2e/devices.ts`입니다. 시계는 `2026-11-19T03:00:00Z`, 로캘 `ko-KR`, 시간대
`Asia/Seoul`로 고정합니다. 기준 폰(402×874)의 화면은 이 테스트로 바뀌지 않습니다.

## 테스트 쓰는 법과 네트워크 규칙

- 모든 스펙은 `@playwright/test`가 아니라 **`e2e/support/app`에서 `test`/`expect`를 가져옵니다**.
  Jest 테스트(`e2e/__tests__/network-guard.test.ts`)가 이를 강제합니다. 이 `test`가 로그인된 상태의
  `app` 픽스처와 네트워크 가드를 붙여 줍니다.
- 운영 서버로는 요청이 나가지 않습니다. `api/v1` 요청은 어느 호스트든 가로채고, 로컬 정적 서버 밖으로
  나가는 요청도 전부 가짜 응답(이미지는 투명 PNG, 나머지는 빈 204)으로 막습니다.
- 그 밖으로 새는 길은 그물(`networkGuard`)이 막습니다. 브라우저 컨텍스트에 걸려 있어 `window.open`
  팝업도 덮고, route가 못 보는 웹소켓은 서버에 잇지 않고 닫습니다. 그물에 걸린 요청(웹소켓은
  `WS ` 접두)은 테스트를 실패시킵니다(`e2e/specs/network-guard.e2e.ts`).
- **고정 응답이 없는 `api/v1` 요청은 테스트를 실패시킵니다.** 서버는 501 `E2E_UNMOCKED`로 답하고,
  테스트 끝에서 그 목록이 비어 있지 않으면 실패합니다.
- CI의 내보내기에는 로컬과 같은 저장소 `.env`(`EXPO_PUBLIC_API_URL`·`EXPO_PUBLIC_ASSET_URL`)가
  들어갑니다. 별도 시크릿은 없습니다. `src/api/config.ts`의 기본 주소(CloudFront)로 폴백해도
  결과가 같습니다 — 가로채기가 호스트를 가리지 않고 `/api/v1` 경로로 판정하기 때문입니다
  (`e2e/support/api-mock.ts`).

### 고정 응답을 추가하는 법

화면이 새 API를 부르기 시작하면 이 테스트가 `GET /foo` 같은 요청 이름과 함께 실패합니다.

1. 실패 메시지의 `'<METHOD> <경로>'`를 확인합니다(`api/v1` 뒤의 경로).
2. `e2e/fixtures/<도메인>.ts`에 같은 키로 응답 본문을 추가합니다. 리스트 응답은 앱이 기대하는
   `{ items: [...] }` 모양으로 감쌉니다. 도메인 파일은 `e2e/fixtures/index.ts`가 모읍니다.
3. 한 테스트에서만 다른 응답이 필요하면 `mockApi(page, overrides)`의 덮어쓰기를 씁니다.
4. 다시 실행해 요청 목록이 비는지 확인합니다.

## 실패 예상 테스트

배치 결함을 고치기 전에 그 결함을 `test.fail()`로 먼저 잠그는 방식입니다. 결함이 남아 있으면 "예상대로
실패"라 초록이고, 누군가 고치면 "예상과 달리 통과"로 빨갛게 바뀌어 `test.fail()`을 지우라고 알려 줍니다.
지금은 실패 예상 테스트가 없습니다 — 접힌 Duo의 결함 8건은 2026-11-20에 모두 고쳐져
`e2e/specs/foldable-folded.e2e.ts`의 일반 테스트가 됐습니다.

새로 쓸 때의 규칙 두 가지:

- 설정 단언(화면 열기, 요소 찾기)과 **측정**(`stableRect`로 규칙에 필요한 위치·크기를 전부 잼)은
  `test.fail()`보다 **앞**에 둡니다. 뒤에 두면 설정이나 측정이 깨져도(요소 없음, 위치가 안 멎음,
  여러 요소에 맞음) 예상된 실패에 가려집니다. `test.fail()` 뒤에서는 잰 값(`Rect`)을 규칙 도우미에
  넘겨 단언만 하고, 브라우저를 부르지 않습니다(도우미는 요소와 잰 값을 둘 다 받습니다).
- `test.fail()` 직전에 `app.expectNoUnmockedRequests()`를 부릅니다. 테스트 끝의 네트워크 검사는
  예상 실패에서는 실패해도 초록으로 보이므로, 가로채지 못한 요청은 이 호출로 미리 잡아야 합니다.

화면이 잰 값을 받아 한 번 더 그리는 곳(집 화면은 화면·머리·알약 줄을 잰 뒤 집 크기를 맞춘다)은
재기 전에 `app.dismissModals()`로 요청이 잦아들기를 기다리고, 맞춘 결과(집은 `max-width`)가 실릴
때까지 `expect.poll`로 기다립니다. 바로 재면 맞추기 전 크기를 읽습니다. 안전 영역 인셋도 웹에서는 한
박자 늦게 도착하므로 `app.open()`이 앱 프레임 여백이 인셋과 같아질 때까지 기다립니다. 로컬에서는
통과하고 느린 CI 러너에서만 깨지는 측정은 대개 이 둘입니다(#1795).

## 비율 상수는 손으로 맞춥니다

`layout-rules.e2e.ts`의 방·집 비율 리터럴은 앱 상수(`room-render-contract`,
`src/resources/house-frame.ts`)를 **복사한 값**입니다. E2E가 앱 소스를 가져오지 않으므로 앱 상수를
바꾸면 이 파일의 값도 직접 고쳐야 합니다.

## 실패했을 때 트레이스 보기

실패한 테스트는 트레이스(`trace: 'retain-on-failure'`)를 남깁니다. CI에서는 `e2e-web` 아티팩트의
`e2e-results/`에 있는 zip을, 로컬에서는 `web-build/e2e-results/`의 zip을 엽니다.

```bash
npx --no-install playwright show-trace web-build/e2e-results/<테스트 폴더>/trace.zip
npx --no-install playwright show-report web-build/e2e-report
```

## 린트 범위

`npm run lint`(`expo lint`)는 `e2e/`를 검사하지 않습니다(직접 확인: `e2e/`에 미사용 변수를 둬도
`npm run lint`는 통과하고 `npx --no-install eslint e2e/…`만 지적합니다). 그래서 E2E 코드는 아래 명령을
손으로 돌리고, E2E 워크플로도 내보내기 전에 같은 명령을 돌립니다.

```bash
npx --no-install eslint e2e playwright.e2e.config.ts
```

`eslint.config.js`의 `e2e/**`·`playwright.*.config.ts` 블록이 상위 상대경로 import를 허용하고(앱
번들 밖이라 `@/` 별칭이 없습니다) Playwright 픽스처의 `use`에 React 훅 규칙을 끕니다. 타입은
`npm run typecheck`가 `**/*.ts` 포함으로 검사하고, 포맷은 `format:check`가 봅니다.

## CI

워크플로 `E2E (web)`(`.github/workflows/e2e-web.yml`, 작업 `e2e-web`)가 `dev`·`main` 대상 PR에서
`src/**`·`e2e/**`·`assets/**`·`public/**`·`app.json`·`package.json`·`package-lock.json`·`.env`·
`metro.config.js`·`eslint.config.js`·`playwright.e2e.config.ts`·`.github/workflows/e2e-web.yml`이 바뀔
때 돕니다. 단계는 설치 → 브라우저 설치 → E2E 린트 → 웹 내보내기 → 테스트 순입니다.
**필수 체크가 아니고 룰셋에 넣지 않았습니다.** 2주간 흔들림(재시도 후 통과, 이유 없는 실패)이
없으면 필수로 올립니다. 리포트·트레이스는 `e2e-web` 아티팩트로 7일간 보관합니다.

## 실측 기준선

**로컬 측정**(macOS, 2026-11-20, `--reporter=list`, 전체 한 번 실행):

- 전체 소요: 약 26초(통과 73 — 실패 예상 8 포함, 건너뜀 51, 예상 밖 실패 0, 불안정 0)
- 프로젝트별 테스트(전체 / 실행 / 건너뜀): `phone` 31 / 23 / 8, `duo-folded` 31 / 18 / 13,
  `duo-open` 31 / 10 / 21, `desktop` 31 / 22 / 9 (프로젝트에 해당하지 않는 테스트는 건너뜁니다)
- 실패 예상(`test.fail()`): `duo-folded` 8건, 나머지 0건 (2026-11-20 이후 0건 — 위 "실패 예상 테스트" 참고)

**CI 측정**(GitHub Actions `ubuntu-latest`, 2026-11-20, PR #1790의 첫 실행 44678319893):

- 작업 `e2e-web` 전체 소요: 4분 54초(설치·브라우저 설치·린트·웹 내보내기 포함)
- 테스트 단계: 1.5분, 통과 73(실패 예상 8 포함), 건너뜀 51 — 로컬과 같은 판정
- 리눅스 러너의 글꼴에서도 배치 규칙 판정이 로컬과 달라지지 않았습니다(첫 실행 한 번 기준).

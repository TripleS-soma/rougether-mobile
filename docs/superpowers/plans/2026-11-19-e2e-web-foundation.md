# 웹 E2E 기반 (폴더블 설계 1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 크기별로 실제 앱을 띄워 배치 규칙을 수치로 검사하는 Playwright E2E를 만들고 PR마다 CI에서 돌린다. 접힌 Duo의 알려진 결함은 "실패가 예상되는 테스트"로 잠가 2단계의 출발점으로 삼는다.

**Architecture:** 웹앱을 정적으로 내보내 로컬 서버로 띄우고, Playwright가 화면 크기별 프로젝트로 접속한다. 서버는 전혀 치지 않는다. `**/api/v1/**` 요청을 전부 가로채 저장소의 고정 응답으로 답하고, 세션은 저장소 키를 미리 심어 로그인 상태로 시작한다. 배치 단언은 스크린샷이 아니라 요소의 위치·크기를 읽는 도우미 함수로 한다.

**Tech Stack:** `@playwright/test` 1.63.0(이미 devDependency), Expo SDK 55 웹 정적 내보내기(`app.json`의 `web.output: static`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-foldable-e2e-design.md` — 이 계획은 그 문서의 "구현 순서 1"만 다룬다. 2~7은 단계마다 따로 계획을 쓴다(뒤 단계는 앞 단계에서 잰 값에 의존한다).

## Global Constraints

- JS만 바꾼다. `app.json`, `package.json`의 `scripts`, `.gitignore`, `.fingerprintignore`, `plugins/`, `targets/`를 건드리지 않는다(런타임 지문이 바뀌어 OTA가 끊긴다). 명령은 전부 `npx --no-install …`로 직접 부른다.
- 산출물(내보낸 웹앱, 리포트, 트레이스)은 이미 무시되는 `web-build/` 아래에만 쓴다.
- 테스트는 운영 서버에 요청을 보내지 않는다. 가로채지 못한 `api/v1` 요청이 하나라도 있으면 그 테스트는 실패한다.
- 기준 폰(402×874)의 화면과 앱 코드 동작을 바꾸지 않는다. 앱 코드 변경은 테스트가 요소를 찾는 데 필요한 `testID` 추가까지만 허용한다.
- 날짜는 고정한다: 테스트 시계 `2026-11-19T03:00:00Z`(KST 정오), 로케일 `ko-KR`, 시간대 `Asia/Seoul`.
- 커밋 전 `npm run typecheck && npm run lint && npm run format:check && npm test`가 통과해야 한다. 브랜치는 `dev`에서 분기한 `feat/e2e-web-foundation`, PR은 `dev`로, 제목은 `test(infra): …`. 커밋 메시지 끝에 `Co-Authored-By: Claude <noreply@anthropic.com>`.
- 단일 Jest 파일은 `npm test -- <path>`로 돌린다(`npx jest`는 멈춘다).

## Review Focus

1. **고정 응답이 실제 서버 응답 모양에서 벗어난다** → 테스트는 통과하는데 실제 앱은 깨진다. 고정 응답은 `src/api/*.ts`의 응답 타입으로 `satisfies` 검사를 받는다(Task 2).
2. **앱이 새 API를 부르기 시작했는데 고정 응답이 없다** → 조용히 빈 화면으로 통과하면 안 된다. 가로채지 못한 요청은 실패로 만든다(Task 2).
3. **오늘 날짜에 따라 달력·출석 화면이 달라진다** → 시계를 고정하지 않은 테스트는 자정·월말에 흔들린다. 공용 픽스처가 시계를 고정한다(Task 2).
4. **애니메이션 중에 위치를 재서 값이 흔들린다** → 위치를 읽기 전에 두 번 연속 같은 값이 나올 때까지 기다린다(Task 3의 `stableRect`).
5. **"실패 예상" 테스트가 엉뚱한 이유로 실패해도 초록이다** → 요소를 못 찾아서 실패한 것과 규칙 위반으로 실패한 것을 구분한다. 요소 찾기는 `test.fail()` 범위 밖(준비 단계)에서 단언한다(Task 4).

---

### Task 1: Playwright E2E 설정과 화면 크기 프로젝트

**Files:**

- Create: `playwright.e2e.config.ts`
- Create: `e2e/devices.ts`
- Create: `e2e/specs/boot.e2e.ts`

**Interfaces:**

- Produces:
  ```ts
  // e2e/devices.ts
  export type Rect = { x: number; y: number; width: number; height: number };
  export type E2eDevice = {
    name: 'phone' | 'duo-folded' | 'duo-open' | 'desktop';
    viewport: { width: number; height: number };
    touch: boolean;
    /** 시스템이 그리는 영역 — 조작 요소가 겹치면 안 된다. 뷰포트 좌표. */
    obstructions: Rect[];
  };
  export const DEVICES: Record<E2eDevice['name'], E2eDevice>;
  ```
  값(설계서 실측):
  - `phone`: 402×874, touch, obstructions `[]`
  - `duo-folded`: 466×678, touch, obstructions `[{ x: 385, y: 20, width: 52, height: 133 }]`
  - `duo-open`: 951×669, touch, obstructions `[{ x: 881, y: 29, width: 42, height: 70 }]`
  - `desktop`: 1280×800, touch 아님, obstructions `[]`
  - 폴드8은 dp 값을 재기 전이라 이 계획에 넣지 않는다.
- Produces: Playwright 프로젝트 이름은 `DEVICES`의 키와 같다. 테스트는 `test.info().project.name`으로 기기를 찾는다.

- [ ] **Step 1: 실패하는 테스트 작성** — `e2e/specs/boot.e2e.ts`

```ts
import { expect, test } from '@playwright/test';

test('세션이 없으면 로그인 화면이 뜬다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Kakao로 시작하기' })).toBeVisible();
});
```

- [ ] **Step 2: 설정 없이 실행해 실패 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts`
Expected: 설정 파일이 없다는 오류로 실패.

- [ ] **Step 3: `e2e/devices.ts`와 `playwright.e2e.config.ts` 작성**

`playwright.visual.config.ts`와 같은 모양으로 쓴다. 정할 값:

- `testDir: 'e2e/specs'`, `testMatch: '**/*.e2e.ts'`, `outputDir: 'web-build/e2e-results'`, HTML 리포트 `web-build/e2e-report`.
- `fullyParallel: true`, `retries: process.env.CI ? 1 : 0`, `use.trace: 'retain-on-failure'`.
- `use`: `baseURL: 'http://127.0.0.1:6010'`, `locale: 'ko-KR'`, `timezoneId: 'Asia/Seoul'`.
- `projects`: `DEVICES`의 항목마다 하나. `viewport`, `hasTouch: touch`, `isMobile: touch`, `deviceScaleFactor: 1`. 브라우저는 전부 Chromium.
- `webServer`: 내보낸 폴더 `web-build/app`을 6010 포트로 서빙한다. 정적 내보내기는 경로마다 HTML 파일이 따로 나오므로(`/login` → `login.html`) 확장자 없는 경로를 풀어 주는 서버여야 한다. `npx --no-install expo serve`가 그렇게 동작하면 그것을 쓰고, 아니면 `e2e/support/static-server.mjs`(Node `http`만 사용, 60줄 이내)를 만든다. `reuseExistingServer: !process.env.CI`.
- 파일 머리 주석에 실행 순서를 적는다:
  `npx expo export --platform web --output-dir web-build/app` → `npx --no-install playwright test -c playwright.e2e.config.ts`.

- [ ] **Step 4: 내보내고 실행해 통과 확인**

Run: `npx expo export --platform web --output-dir web-build/app && npx --no-install playwright test -c playwright.e2e.config.ts`
Expected: `boot.e2e.ts`가 네 프로젝트에서 PASS(4 passed).

- [ ] **Step 5: Jest·린트가 새 폴더 때문에 깨지지 않는지 확인**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test -- --ci`
Expected: 전부 통과. Jest가 `*.e2e.ts`를 집지 않는다(집으면 `package.json`을 고치지 말고 파일 이름·위치로 해결한다).

- [ ] **Step 6: Commit**

```bash
git add playwright.e2e.config.ts e2e/
git commit -m "test(infra): Playwright 웹 E2E 설정과 화면 크기 프로젝트"
```

---

### Task 2: API 가로채기와 로그인 상태 픽스처

**Files:**

- Create: `e2e/support/api-mock.ts`
- Create: `e2e/support/app.ts`
- Create: `e2e/fixtures/*.ts` (엔드포인트 묶음별 고정 응답)
- Create: `e2e/specs/tabs.e2e.ts`

**Interfaces:**

- Consumes: Task 1의 `DEVICES`, 프로젝트 이름.
- Produces:
  ```ts
  // e2e/support/api-mock.ts
  export type MockOverrides = Record<string, unknown>; // 키: 'GET /today' 처럼 '<METHOD> <api/v1 뒤 경로 패턴>'
  /** api/v1 요청을 전부 가로챈다. 돌려주는 배열에 가로채지 못한 요청('GET /foo')이 쌓인다. */
  export function mockApi(page: Page, overrides?: MockOverrides): Promise<string[]>;

  // e2e/support/app.ts
  export type StartTab = 'myRoom' | 'calendar' | 'house' | 'feed' | 'myPage';
  export const test: TestType<
    {
      app: {
        device: E2eDevice;
        /** 세션을 심고 앱을 연다. 열린 뒤 자동으로 뜨는 모달은 그대로 둔다. */
        open(opts?: { tab?: StartTab; overrides?: MockOverrides }): Promise<void>;
        /** 화면에 떠 있는 모달을 닫기 버튼으로 전부 닫는다. */
        dismissModals(): Promise<void>;
      };
    },
    object
  >;
  export { expect } from '@playwright/test';
  ```
- `app` 픽스처는 테스트가 끝날 때 가로채지 못한 요청 목록이 비어 있는지 단언한다(Review Focus 2).

가로챌 요청(2026-11-19 실제 앱에서 수집한 목록, 전부 `/api/v1` 아래):

| 묶음        | 경로                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 회원        | `GET /me`, `PATCH /me`, `GET /me/wallets`, `GET /me/characters`, `GET /me/items`, `GET /me/houses`, `GET /me/join-requests`, `GET /onboarding`, `GET /goals`, `GET /characters`                         |
| 루틴·할 일  | `GET /categories`, `GET /routines`, `GET /todos`, `GET /today`, `GET /calendar/month`, `GET /recommendations`, `GET /reports/weekly`                                                                    |
| 방          | `GET /rooms/me`, `GET /items`                                                                                                                                                                           |
| 집          | `GET /houses/:id`, `GET /houses/:id/members`, `GET /houses/:id/missions`, `GET /houses/:id/join-requests`, `GET /houses/:id/members/:id/room`, `GET /houses/cover-images`, `POST /houses/:id/chat-room` |
| 피드        | `GET /feed/posts`, `GET /feed/images/:id`                                                                                                                                                               |
| 이벤트·알림 | `GET /events/attendance`, `GET /events/attendance/:id`, `GET /events/christmas`, `GET /notifications`                                                                                                   |

고정 응답의 내용:

- 사용자 1명(닉네임 `테스트`), 집 1채(구성원 4명, 2층), 방에 가구 3개, 카테고리 3개와 루틴·할 일 합쳐 6개, 피드 글 4개(사진 있는 글 2개), 오늘 출석 가능(자동으로 출석 모달이 뜬다).
- 응답 모양은 `src/api/*.ts`의 응답 타입을 가져와 `satisfies`로 검사한다(Review Focus 1). 목록 응답은 `{ items: [...] }` 봉투.
- 실제 사용자의 데이터나 토큰을 넣지 않는다. 토큰 값은 `e2e-access`·`e2e-refresh` 같은 가짜 문자열(앱은 토큰을 해석하지 않는다. 해석하는 코드가 있으면 만료가 먼 가짜 JWT로 바꾼다).
- 이미지 CDN(`d1eazfl0tw7r0v.cloudfront.net`)과 그 밖의 외부 호스트 요청은 1×1 투명 PNG 또는 빈 204로 답한다.

세션과 시계:

- `open()`은 `context.addInitScript`로 `localStorage`에 `rougether.auth.accessToken`, `rougether.auth.refreshToken`, `rougether.auth.userId`를 심고, `tab`이 있으면 `rougether.start-tab`도 심는다(키 이름은 `src/lib/start-tab.ts`의 `START_TAB_KEY`).
- `page.clock.install({ time: new Date('2026-11-19T03:00:00Z') })`를 `goto` 전에 건다(Review Focus 3).

- [ ] **Step 1: 실패하는 테스트 작성** — `e2e/specs/tabs.e2e.ts`

```ts
import { expect, test } from '../support/app';

const LANDMARKS = [
  { tab: 'myRoom', name: '방 꾸미기', role: 'button' },
  { tab: 'calendar', name: '2026년 11월', role: 'text' },
  { tab: 'house', name: '채팅', role: 'button' },
  { tab: 'feed', name: '내 글', role: 'text' },
  { tab: 'myPage', name: '프로필 편집', role: 'text' },
] as const;

for (const { tab, name, role } of LANDMARKS) {
  test(`${tab} 탭이 고정 응답만으로 그려진다`, async ({ app, page }) => {
    await app.open({ tab });
    await app.dismissModals();
    const target =
      role === 'button'
        ? page.getByRole('button', { name, exact: true })
        : page.getByText(name, { exact: true });
    await expect(target.first()).toBeVisible();
  });
}

test('오늘 출석이 가능하면 출석 모달이 자동으로 뜬다', async ({ app, page }) => {
  await app.open({ tab: 'myRoom' });
  await expect(page.getByRole('button', { name: '출석하기' })).toBeVisible();
});

test('고정 응답이 없는 요청은 테스트를 실패시킨다', async ({ page }) => {
  const { mockApi } = await import('../support/api-mock');
  const unmocked = await mockApi(page);
  await page.goto('/');
  await page.evaluate(() => fetch('/api/v1/__no_such_endpoint__').catch(() => undefined));
  expect(unmocked).toContain('GET /__no_such_endpoint__');
});
```

마지막 테스트의 요청 주소는 앱의 `API_BASE` 호스트로 보내야 가로채기에 걸린다 — 구현하면서 `page.evaluate`에 그 호스트를 넘기도록 고친다.

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/tabs.e2e.ts --project=phone`
Expected: `../support/app`을 찾지 못해 실패.

- [ ] **Step 3: `api-mock.ts`, 고정 응답, `app.ts` 구현**

경로 패턴의 `:id`는 숫자 한 토막과 맞춘다. 가로채지 못한 `api/v1` 요청은 501과 `{ code: 'E2E_UNMOCKED' }`로 답하고 목록에 넣는다.

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/tabs.e2e.ts --project=phone --project=desktop`
Expected: 7개 테스트 × 2 프로젝트 PASS. 접힌·펼친 Duo 프로젝트는 Task 4에서 다룬다.

- [ ] **Step 5: 같은 테스트를 3번 반복해 흔들림 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/tabs.e2e.ts --project=phone --repeat-each=3`
Expected: 21 passed, flaky 0.

- [ ] **Step 6: Commit**

```bash
git add e2e/
git commit -m "test(infra): E2E용 API 가로채기와 로그인 상태 픽스처"
```

---

### Task 3: 배치 규칙 도우미와 기준 폰 테스트

**Files:**

- Create: `e2e/support/layout.ts`
- Create: `e2e/specs/layout-rules.e2e.ts`
- Modify(필요할 때만): 테스트가 찾아야 하는 요소에 `testID` 추가 — `src/components/screens/**`

**Interfaces:**

- Consumes: Task 1의 `Rect`·`E2eDevice`, Task 2의 `test`·`app`.
- Produces (`e2e/support/layout.ts`):
  ```ts
  /** 연속 두 번 같은 값이 나올 때까지 기다린 뒤의 위치·크기. 2초 안에 안 멎으면 던진다. */
  export function stableRect(target: Locator): Promise<Rect>;
  /** 규칙 1: target이 zones 어느 것과도 겹치지 않는다. */
  export function expectClearOf(target: Locator, zones: Rect[]): Promise<void>;
  /** 규칙 2·5: target 전체가 뷰포트 안에 있고, bottomInset(탭 바 높이)만큼 아래는 제외한다. */
  export function expectInFirstScreen(
    page: Page,
    target: Locator,
    bottomInset?: number,
  ): Promise<void>;
  /** 규칙 3: 폭/높이가 ratio와 tolerance(기본 0.01) 안에서 같다. */
  export function expectAspectRatio(
    target: Locator,
    ratio: number,
    tolerance?: number,
  ): Promise<void>;
  /** 규칙 4: panes가 왼쪽부터 나란히 있고, 합친 폭이 뷰포트 폭과 2px 안에서 같다. */
  export function expectFillsWidth(page: Page, panes: Locator[]): Promise<void>;
  /** 규칙 6: 문서의 scrollWidth가 뷰포트 폭을 넘지 않는다. */
  export function expectNoHorizontalScroll(page: Page): Promise<void>;
  ```
- 방 그림은 `data-testid="room-canvas"`(`src/components/room/room.tsx`), 집 그림은 `data-testid="house-frame"`으로 찾는다. 방 비율은 `src/components/room/room-render-contract.v2.json`의 `room.aspectRatio`, 집 비율은 `src/resources/house-frame.ts`의 2층 값.

- [ ] **Step 1: 실패하는 테스트 작성** — `e2e/specs/layout-rules.e2e.ts`

`phone`과 `desktop` 프로젝트에서만 돈다(`test.skip(!['phone','desktop'].includes(app.device.name))`). 테스트 이름과 단언:

```ts
test('규칙 6: 다섯 탭 어디에도 가로 스크롤이 없다', …)      // 탭마다 expectNoHorizontalScroll
test('규칙 3: 방 그림이 계약 비율이고 잘리지 않는다', …)      // expectAspectRatio(roomCanvas, ROOM_RATIO) + expectInFirstScreen
test('규칙 3: 집 그림이 층수별 비율이다', …)                  // expectAspectRatio(houseFrame, HOUSE_RATIO_2F)
test('규칙 2: 출석 모달의 닫기 버튼이 화면 안에 있고 누르면 닫힌다', …)
test('규칙 5: 방 탭에서 할 일 첫 항목이 탭 바 위로 보인다', …)  // phone만
test('규칙 1: 탭 화면의 머리 버튼이 시스템 영역과 겹치지 않는다', …) // obstructions가 비어 통과하지만 호출 경로를 잠근다
```

규칙 1의 대상 버튼(이름으로 찾는다): 달력 `다음 달`, 집 `채팅`, 내 정보 `설정`. 접근성 이름이 다르면 실제 이름으로 고치고, 이름이 없으면 그 버튼에 `accessibilityLabel`이 아니라 `testID`를 추가한다(문구 변경 금지).

- [ ] **Step 2: 실행해 실패 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/layout-rules.e2e.ts --project=phone`
Expected: `../support/layout`을 찾지 못해 실패.

- [ ] **Step 3: `layout.ts` 구현**

각 함수는 실패할 때 기대값·실제값·기기 이름을 메시지에 담는다(예: `house-frame 비율 0.612, 기대 0.75±0.01 (duo-folded)`).

- [ ] **Step 4: 실행해 통과 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/layout-rules.e2e.ts --project=phone --project=desktop`
Expected: 전부 PASS. 기준 폰에서 실패하는 규칙이 있으면 앱을 고치지 말고 멈춰서 보고한다(이 계획은 폰 화면을 바꾸지 않는다).

- [ ] **Step 5: 4종 체크와 Commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test -- --ci`

```bash
git add e2e/ src/
git commit -m "test(infra): 배치 규칙 도우미와 기준 폰·데스크톱 테스트"
```

---

### Task 4: 접힌 Duo의 알려진 결함을 "실패 예상"으로 잠그기

**Files:**

- Create: `e2e/specs/foldable-known-gaps.e2e.ts`

**Interfaces:**

- Consumes: Task 2의 `app`, Task 3의 규칙 도우미, `DEVICES['duo-folded'].obstructions`.
- Produces: 2단계 계획이 `test.fail()`을 하나씩 지워 가며 고칠 목록.

웹에는 시스템 영역이 없으므로, 이 파일의 테스트는 "앱이 그 자리를 피하는가"를 좌표로만 본다(안전 영역 값 주입은 2단계에서 정한다).

- [ ] **Step 1: 테스트 작성**

`duo-folded` 프로젝트에서만 돈다. 테스트마다 준비 단계(화면 열기, 대상 요소가 보이는지 단언)를 먼저 하고, **그 뒤에** `test.fail()`을 부른 다음 규칙을 단언한다(Review Focus 5). 테스트 이름과 규칙:

```ts
test('출석 모달 닫기 버튼이 시스템 영역과 겹치지 않는다', …)      // 규칙 1 — 실패 예상
test('달력의 다음 달 버튼이 시스템 영역과 겹치지 않는다', …)      // 규칙 1 — 실패 예상
test('집의 채팅 버튼이 시스템 영역과 겹치지 않는다', …)          // 규칙 1 — 실패 예상
test('내 정보의 설정 버튼이 시스템 영역과 겹치지 않는다', …)      // 규칙 1 — 실패 예상
test('방 그림 높이가 화면 높이의 절반 이하다', …)                // 설계서 목표 2 — 실패 예상
test('방 탭에서 할 일 첫 항목이 탭 바 위로 보인다', …)           // 규칙 5 — 실패 예상
test('집 그림 전체가 첫 화면에 보인다', …)                      // 규칙 5 — 실패 예상
test('방 꾸미기에서 가구 목록 첫 줄이 적용하기 버튼 위로 보인다', …) // 규칙 5 — 실패 예상
```

- [ ] **Step 2: 실행해 "예상대로 실패" 확인**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts e2e/specs/foldable-known-gaps.e2e.ts --project=duo-folded`
Expected: 8개 모두 `expected failure`로 집계되고 종료 코드 0. 실제로 통과해 버리는 테스트가 있으면(Playwright가 "expected to fail, but passed"로 실패시킨다) 그 항목은 결함이 아니므로 `test.fail()`을 지우고, 설계서의 "지금 상태"와 다르다는 점을 PR 본문에 적는다.

- [ ] **Step 3: 나머지 스펙을 접힌·펼친 Duo에서도 돌려 본다**

Run: `npx --no-install playwright test -c playwright.e2e.config.ts --project=duo-folded --project=duo-open`
Expected: `boot`·`tabs`는 PASS. 여기서 새로 드러나는 실패는 고치지 말고 `foldable-known-gaps.e2e.ts`에 실패 예상 테스트로 추가한다.

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test(infra): 접힌 Duo의 알려진 배치 결함을 실패 예상 테스트로 고정"
```

---

### Task 5: CI 작업과 문서

**Files:**

- Create: `.github/workflows/e2e-web.yml`
- Create: `docs/e2e.md`
- Modify: `AGENTS.md` (작업 흐름 절에 한 줄)
- Modify: `README.md` (스크립트·CI 표에 한 줄. 표가 없으면 생략)

**Interfaces:**

- Consumes: Task 1의 실행 명령.

- [ ] **Step 1: 워크플로 작성**

- 이름 `E2E (web)`, 작업 이름 `e2e-web`. 트리거: `dev`·`main` 대상 `pull_request`, 경로 `src/**`, `e2e/**`, `assets/**`, `playwright.e2e.config.ts`, `package-lock.json`, 워크플로 파일 자신.
- 단계: checkout → Node 22 + `npm ci` → Playwright 브라우저 캐시(`ci.yml`과 같은 키) → `npx --no-install playwright install --with-deps chromium` → `npx expo export --platform web --output-dir web-build/app` → `npx --no-install playwright test -c playwright.e2e.config.ts` → `if: always()`로 `web-build/e2e-report`와 `web-build/e2e-results`를 7일 보관 아티팩트로 올린다.
- `concurrency`로 같은 PR의 이전 실행을 취소한다. `timeout-minutes: 20`.
- 룰셋의 필수 체크에는 넣지 않는다(설계서: 2주간 흔들림이 없으면 올린다).

- [ ] **Step 2: `docs/e2e.md` 작성**

담을 내용: 무엇을 검사하는가(규칙 6개, 설계서 링크), 로컬 실행 두 줄, 화면 크기 프로젝트 표, 고정 응답을 추가하는 법(가로채지 못한 요청으로 실패했을 때의 절차), 실패 예상 테스트의 의미와 지우는 시점, 실패했을 때 트레이스를 여는 법(`npx --no-install playwright show-trace <zip>`), 스크린샷 비교를 쓰지 않는 이유.

- [ ] **Step 3: `AGENTS.md`에 한 줄 추가**

작업 흐름 절의 "공용 UI는 스토리 필수" 항목 뒤에:
`- **화면 배치를 바꾸면 웹 E2E 확인** (2026-11-19): 화면의 크기·위치 계산을 고쳤으면 \`docs/e2e.md\`의 명령으로 화면 크기별 배치 규칙 테스트를 돌린다. 새 API를 부르게 했으면 \`e2e/fixtures\`에 고정 응답을 추가한다.`

- [ ] **Step 4: PR을 열어 워크플로가 도는지 확인**

Run: `git push -u origin feat/e2e-web-foundation && gh pr create --base dev --title "test(infra): 웹 E2E 기반 — 화면 크기별 배치 규칙 테스트" --body-file <본문>`
Expected: `e2e-web` 작업이 초록. 본문은 `## 요약`·`## 리뷰 포인트` 형식이고, 리뷰 포인트에 "지문 파일 변경 없음", "운영 서버 요청 없음", "실패 예상 8건의 의미", 소요 시간(분)을 적는다.

- [ ] **Step 5: CI 소요 시간과 결과를 기록하고 Commit**

`docs/e2e.md` 끝에 첫 실행의 실측값(전체 소요 시간, 테스트 수, 실패 예상 수)을 적는다 — 포트폴리오 사례의 기준선이다.

```bash
git add .github/workflows/e2e-web.yml docs/e2e.md AGENTS.md README.md
git commit -m "ci(infra): 웹 E2E 워크플로와 실행 문서"
```

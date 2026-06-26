# 테스트 전략

## 레이어

| 레이어        | 도구                                         | 무엇을                            |
| ------------- | -------------------------------------------- | --------------------------------- |
| 정적          | `tsc --noEmit` + ESLint                      | 타입·규약                         |
| 단위/컴포넌트 | **jest-expo + React Native Testing Library** | 컴포넌트 동작·로직                |
| 시각 확인     | **`/dev` 갤러리**                            | 컴포넌트를 디바이스/웹에서 눈으로 |
| (later) E2E   | Maestro 등 미도입                            | —                                 |

명령: `npm run typecheck` · `npm run lint` · `npm run format:check` · `npm test`. CI(`.github/workflows/ci.yml`)가 네 가지를 모두 돌린다.

## RNTL v14 — 반드시 알아야 할 것

이 저장소의 RNTL은 **v14**다. 이전 버전과 API가 다르다.

- **`render`와 `fireEvent`는 async** (내부에서 `await act`). **반드시 `await`** 한다.
  ```tsx
  const { getByText } = await render(<SampleButton label="Tap me" />);
  await fireEvent.press(getByText('Tap me'));
  ```
  `await`를 빠뜨리면 `render`가 Promise를 반환해 `getByText is not a function` / `render has not been called`로 깨진다.
- 렌더러 피어는 **`test-renderer`**(신규)다. 구 `react-test-renderer`가 아니다.
- 레퍼런스 테스트: [`sample-button.test.tsx`](../src/components/__tests__/sample-button.test.tsx).

## Jest 설정 메모 (`package.json`의 `jest`)

- preset: `jest-expo`.
- `moduleNameMapper`는 **순서가 중요** — `\.css$` → `jest/style-mock.js` 규칙이 `^@/` 별칭보다 **먼저** 와야 `@/global.css`가 실제 CSS로 해석되지 않는다.
- `transformIgnorePatterns`는 jest-expo 표준값.
- 타입: 루트 `declarations.d.ts`가 `/// <reference types="jest" />` + `*.css` 모듈 선언 제공 (TS6에서 `@types/jest` 자동 포함이 안 돼 명시).

## 무엇을 테스트하나

- 컴포넌트: 렌더 산출(라벨·상태)과 콜백(onPress 등), disabled 같은 분기.
- 로직/유틸: 순수 함수(날짜 KST 처리, asset-key 조합 등)는 별도 단위 테스트.
- 데이터 훅: 서버상태 도구 확정 후 모킹 전략 추가 ([state-and-data.md](state-and-data.md)).
- 스냅샷은 남용하지 않는다 — 의미 있는 동작 단언 우선.

## `/dev` 컴포넌트 갤러리

- 라우트 [`src/app/dev.tsx`](../src/app/dev.tsx)가 [`src/dev/registry.tsx`](../src/dev/registry.tsx)의 항목을 렌더.
- **새 컴포넌트를 만들면 registry에 항목을 추가**해 고립 상태로 눈 확인 (실제 화면 배선 전에).
- `npm start` → `w`(웹) / `i`·`a`(시뮬레이터)에서 `Dev` 탭.

## 열린 결정

- 데이터 훅 모킹 방식 (MSW vs 도구 내장 모킹).
- 커버리지 게이트 도입 여부/임계값.

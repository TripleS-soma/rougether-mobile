# React Native 컴포넌트를 브라우저 테스트 파이프라인에 올리기 — 스토리북 렌더·접근성·시각 회귀

- 2026-09-16 / design(디자인 시스템·CI) / 스토리북 개선 PR
- 키워드: Storybook 10, React Native Web, Vite, Vitest 브라우저 모드, Playwright 스크린샷 비교, axe 접근성 검사

## 배경

팀원이 도입한 스토리북(React Native Web + Vite)은 공용 UI 38개 중 10개만 다루고, CI는 정적 빌드만 했다. 스토리가 "보는 카탈로그"에 머물러 회귀를 잡지 못했다. 목표는 스토리를 그대로 테스트 입력으로 쓰는 것: 모든 스토리를 실제 브라우저에서 렌더하고, 상호작용(play)·접근성·시각 회귀를 CI에서 검사한다. 제약은 `package.json` scripts·`.gitignore`가 Expo 런타임 지문 입력이라 건드릴 수 없다는 것(스크립트 한 줄이 OTA를 끊은 사고 이력).

## 문제 (증상)

Vitest 애드온으로 스토리를 돌리자 네이티브 앱에서는 멀쩡한 컴포넌트들이 연달아 실패했다.

1. 기존 입력·토글 스토리: `Storybook preview hooks can only be called inside decorators and story functions`
2. 여러 스토리가 무작위로 `Cannot read properties of null (reading 'useContext')`
3. 하단 탭: `No safe area value available`
4. 하단 탭: `Failed to execute 'createElement' ... The tag name provided ('data:image/svg+xml,...') is not a valid name`

## 원인 분석 (가설 → 검증)

1. **훅 혼용**: 스토리 `render` 한 함수 안에서 Storybook의 `useArgs`와 React의 `useState/useEffect`를 섞었다. Storybook UI에서는 동작하지만 Vitest의 포터블 스토리 실행에서는 Storybook 훅 컨텍스트가 달라 실패한다.
2. **React 두 벌**: 로그에 `new dependencies optimized: react-native-gesture-handler ... reloading`과 `Vite unexpectedly reloaded a test`가 찍혀 있었다. 테스트 도중 Vite가 늦게 발견한 의존성을 다시 묶으면서 페이지가 재로딩되고, 이미 로드된 React와 새 번들의 React가 섞여 훅 디스패처가 null이 됐다. 무작위성은 어떤 스토리가 먼저 그 의존성을 끌어오느냐에 따른 것.
3. **Safe area**: 앱은 루트에 `SafeAreaProvider`가 있지만 스토리 데코레이터에는 없었다.
4. **SVG**: 앱은 Metro의 `react-native-svg-transformer`로 `.svg`를 **컴포넌트**로 가져온다. Vite는 같은 import를 URL 문자열로 해석해, 컴포넌트 자리에 data URL이 들어가 DOM 태그 이름으로 쓰였다.

## 해결

1. 스토리 `render`는 `useArgs`만 쓰고, 로컬 상태는 내부 컴포넌트로 분리했다(Controls 동기화 유지).
2. `.storybook/main.ts`의 `optimizeDeps.include`에 늦게 발견되는 네 의존성을 미리 묶어 테스트 중 재로딩을 없앴다.
3. 프리뷰 데코레이터에 인셋 0의 `SafeAreaProvider`를 두었다.
4. `vite-plugin-svgr`를 기본 export 컴포넌트 모드로 추가해 Metro 변환기와 계약을 맞췄다.
5. **시각 회귀는 크로스 OS 문제를 설계로 회피**했다. 폰트 래스터가 macOS·linux에서 달라 로컬에서 만든 기준 이미지는 CI에서 항상 틀린다. 그래서 기준 이미지는 linux(CI)에서만 생성·비교하고(파일명에 플랫폼 접미), 로컬은 건너뛴다. 없는 기준은 CI가 만들어 artifact로 올리고, 의도한 변경은 수동 워크플로로 갱신한다.
6. 스크립트 등록 없이 CI에서 CLI를 직접 호출하고, devDependencies만 추가해 런타임 지문을 바꾸지 않았다.

## 결과 (수치)

- 스토리: 47 → 82개(공용 UI 스토리 10 → 25개 컴포넌트), Vitest 브라우저 테스트 29 파일/82 테스트 통과
- 시각 회귀: 핵심 6 스토리 × 라이트/다크 = 12장, 재실행 비교 일치 확인
- 접근성: `error` 수준으로 돌리면 46 테스트 실패 — color-contrast 204건, aria-prohibited-attr 39건 등. 현재는 `todo`(경고)로 두고 목록화

## 배운 점 / 재발 방지

- "웹에서 네이티브 컴포넌트를 테스트한다"는 결국 **번들러 계약을 맞추는 일**이다(SVG 변환, 프로바이더, 의존성 사전 번들). Metro가 해주던 것을 하나씩 찾아 Vite에 옮겨야 한다.
- 무작위 `useContext` null은 React 중복 로딩을 먼저 의심한다. 번들러 로그의 "reloading"이 단서다.
- 스크린샷 비교는 기준 이미지를 만드는 OS를 하나로 고정해야 유지된다.
- 접근성 검사는 처음부터 차단으로 켜면 CI가 멈춘다. 경고로 켜고 위반을 목록으로 만든 뒤 줄여 가는 편이 도입 비용이 낮다.

## 후속

**기준 이미지 검수에서 캔버스 버그 발견** (같은 날, 스토리북 개선 PR 안에서 수정)

- 증상: 첫 CI가 만든 기준 이미지 12장을 열어 보니, 다크 모드 카드 스토리에서 캔버스 배경이 내용 높이(190px)까지만 칠해지고 나머지 뷰포트가 흰색이었다. 이대로 커밋했다면 **버그를 기준으로 고정**할 뻔했다.
- 원인: Playwright로 DOM 높이 체인을 측정 — `#storybook-root`는 900px인데 `display: block`이라 그 아래 `flex: 1` 래퍼(테마·세이프에어리어 프로바이더)가 늘어나지 않아 190px, 캔버스의 `minHeight: 100%`도 190px로 계산됐다. `html/body/root`에 높이만 주는 1차 시도는 효과가 없었고, 측정으로 원인이 "높이"가 아니라 "부모가 flex 컨테이너가 아님"임을 확인했다.
- 해결: `#storybook-root { display: flex; flex-direction: column }`. 로컬 재캡처로 전체 채움 확인 → 푸시 → CI가 기준 이미지를 다시 생성 → 검수 후 커밋 → 시각 회귀 스텝 통과.
- 배운 점: 스냅샷 테스트의 첫 기준 이미지는 "통과 조건"이 아니라 **검수 대상**이다. RN Web의 `flex: 1`은 부모가 flex일 때만 늘어난다(네이티브 Yoga는 루트가 기본 flex라 드러나지 않는 차이).

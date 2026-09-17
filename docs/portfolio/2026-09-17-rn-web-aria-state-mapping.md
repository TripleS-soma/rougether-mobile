# 웹에서 체크 상태·진행 값이 사라지는 접근성 버그 — RN Web이 옮기지 않는 accessibility 객체 props

- 2026-09-17 / design(접근성·디자인 시스템) / #1389
- 키워드: WAI-ARIA, axe-core, React Native Web 0.21, accessibilityState vs aria-*, Storybook a11y 테스트, 네이티브·웹 공용 컴포넌트

## 배경

스토리북 개선에서 모든 스토리에 axe 접근성 검사를 붙였지만, 기존 위반이 많아 경고(todo)로만 켜 두었다. 색 대비를 빼고도 ARIA 위반이 50건 이상이었다(aria-prohibited-attr 39, aria-required-attr 5, aria-progressbar-name 5, aria-allowed-attr 3, nested-interactive 1, aria-dialog-name 1).

## 문제 (증상)

- 곰 체크·토글: `role="checkbox"`/`role="switch"`인데 `aria-checked`가 없음 → 웹 스크린리더가 켜짐/꺼짐을 모름.
- 진행 바·로딩: `role="progressbar"`에 이름·값이 없음.
- 확인 다이얼로그: 열린 직후 `aria-modal`만 있고 `role`이 없는 div.
- 휠 피커: slider인데 현재 값 없음, 안에 버튼이 중첩.

## 원인 분석 (가설 → 검증 과정)

1. 컴포넌트 코드에는 `accessibilityState={{ checked }}`·`accessibilityValue={{ min, max, now }}`가 **이미 있었다**. 네이티브에서는 정상.
2. `react-native-web` 0.21.2 `createDOMProps`를 읽음: 매핑 대상 목록에 `aria-checked`·`aria-valuenow` 같은 **개별 aria props**와 deprecated `accessibilityChecked` 등은 있지만, **`accessibilityState`·`accessibilityValue` 객체는 없다** → 웹 DOM에서 조용히 사라짐.
3. 확인 다이얼로그: RN Web `Modal`은 `aria-modal`은 항상 붙이고 `role="dialog"`는 `onShow` 이후(`isActive`)에만 붙인다. 페이드 애니메이션 중 검사가 돌면 과도 상태를 잡는다. 바텀시트는 `animationType="none"`이라 즉시 활성이어서 이름만 빠져 있었다.
4. 휠 피커 중첩: 네이티브는 부모가 `accessible` adjustable이라 줄 버튼들이 하나로 합쳐지지만, 웹은 줄 버튼을 따로 포커스 가능하게 내보낸다 → 웹 한정.

## 해결

- 객체 props 대신 **RN 0.83 네이티브와 RN Web 모두 해석하는 개별 `aria-*` props**로 전환(`aria-checked`, `aria-valuemin/max/now/valuetext`, `aria-label`). 네이티브는 이를 기존 accessibilityState/Value로 합치므로 VoiceOver·TalkBack 동작은 유지.
- 진행 바·로딩·시트에 이름(기본 '진행률'·'불러오는 중'·'시트', ko/en), 다이얼로그 Modal에 제목을 이름으로.
- 다이얼로그 스토리는 `role="dialog"`가 붙을 때까지 기다린 뒤 검사(과도 상태를 규칙 예외로 덮지 않음).
- 휠 피커 nested-interactive만 사유를 적은 스토리 단위 예외.
- 스토리북 a11y를 color-contrast만 제외하고 `error`로 → 이후 ARIA 회귀는 CI가 막음.

## 결과 (수치)

- 비대비 ARIA 위반: 54건 → 0건(예외 1: 휠 피커 nested-interactive, 웹 한정). 스토리 테스트 82/82 통과(실패 20 → 0).
- 전체 jest 323 suites / 2,608 tests 통과.

## 배운 점 / 재발 방지

- 크로스 플랫폼 라이브러리는 "타입이 받아준다"와 "플랫폼이 해석한다"가 다르다. RN Web은 deprecated 객체 props를 경고 없이 버린다 — 공용 컴포넌트는 양쪽이 모두 읽는 `aria-*`를 쓴다.
- 접근성 검사를 CI 차단으로 올리려면 먼저 경고로 켜서 목록을 만들고, 원인별로(라이브러리 매핑·애니메이션 과도 상태·플랫폼 구조 차이) 나눠 고친다. 예외는 사유와 함께 스토리 단위로만.

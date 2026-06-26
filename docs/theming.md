# 테마 / 디자인 토큰

토큰의 진실 소스는 [`src/constants/theme.ts`](../src/constants/theme.ts)다. 색/폰트/간격을 코드에 직접 쓰지 않는다.

## 토큰

- **Colors** — `light` / `dark` 두 스킴. 키: `text`, `background`, `backgroundElement`, `backgroundSelected`, `textSecondary`. 새 색이 필요하면 두 스킴 모두에 추가한다 (한쪽만 추가 금지).
- **Spacing** — `half(2) · one(4) · two(8) · three(16) · four(24) · five(32) · six(64)`. 패딩/마진/라운드는 이 스케일을 쓴다.
- **Fonts** — `sans · serif · rounded · mono` (플랫폼별 시스템 폰트로 매핑).
- 기타: `BottomTabInset`, `MaxContentWidth`.

## 사용

- 텍스트: [`ThemedText`](../src/components/themed-text.tsx) — `type`(default/title/subtitle/small/smallBold/link/code 등) + `themeColor`로 색 지정. 생짜 `<Text>` 대신 사용.
- 컨테이너: [`ThemedView`](../src/components/themed-view.tsx) — `type`으로 배경 토큰 지정.
- 동적 색: `useTheme()`가 현재 스킴의 Colors 객체를 반환. `const theme = useTheme(); theme.backgroundSelected`.

```tsx
const theme = useTheme();
<View style={{ backgroundColor: theme.backgroundElement, padding: Spacing.three }}>
  <ThemedText type="smallBold">제목</ThemedText>
</View>;
```

## 다크모드

- `useColorScheme()`(`@/hooks/use-color-scheme`)로 현재 스킴을 읽고, 루트 `_layout.tsx`가 expo-router의 `ThemeProvider`에 light/dark 테마를 연결한다.
- **웹 하이드레이션 주의**: 정적 렌더링(SSG)이 켜져 있어 웹은 [`use-color-scheme.web.ts`](../src/hooks/use-color-scheme.web.ts)에서 마운트 후 1회 하이드레이션 플래그로 스킴을 확정한다. 이 패턴의 `set-state-in-effect` lint는 의도적으로 inline disable 돼 있다 — 건드리지 말 것.

## 프로토타입 토큰 이식

프로토타입(`../rougether-prototype`)의 `src/app/design-system/theme.ts`에 별도 디자인 토큰/테마가 있다.
이식 시 **프로토타입 토큰을 그대로 복붙하지 말고**, 위 `Colors`/`Spacing` 구조에 매핑해 흡수한다
(한옥 팔레트 등 신규 색은 두 스킴에 추가). 매핑 표는 첫 화면 이식 때 이 문서에 추가한다.

## 열린 결정

- 토큰 확장 방식: 단일 `theme.ts` 유지 vs 시맨틱 레이어(예: `colors.surface.*`) 도입.
- 프로토타입 한옥 팔레트의 light/dark 대응값.

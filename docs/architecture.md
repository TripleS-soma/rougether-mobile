# 아키텍처

## 런타임 스택

| 항목          | 값                             | 비고                           |
| ------------- | ------------------------------ | ------------------------------ |
| 프레임워크    | Expo SDK 56                    | `app.json`의 expo 설정         |
| 런타임        | React Native 0.85 · React 19.2 | New Architecture 기본          |
| 라우팅        | Expo Router (file-based)       | `experiments.typedRoutes` 켜짐 |
| 언어          | TypeScript (strict)            | `expo/tsconfig.base` 확장      |
| 패키지 매니저 | npm                            |                                |
| 컴파일러      | React Compiler                 | `experiments.reactCompiler`    |

버전을 바꾸기 전 항상 [Expo v56 문서](https://docs.expo.dev/versions/v56.0.0/)를 확인한다 (루트 `AGENTS.md`).

## `src/` 레이아웃

```
src/
├── app/                # Expo Router 라우트 (파일 = 화면)
│   ├── _layout.tsx     # 루트 레이아웃 (ThemeProvider + 탭 셸)
│   ├── index.tsx       # 홈 ("/")
│   ├── explore.tsx     # "/explore"
│   └── dev.tsx         # "/dev" — 컴포넌트 갤러리 (testing.md 참조)
├── components/         # 재사용 컴포넌트 (PascalCase export, kebab 파일)
│   ├── app-tabs.tsx    # 네이티브 탭 (NativeTabs)
│   ├── app-tabs.web.tsx# 웹 탭 (expo-router/ui)
│   ├── themed-text.tsx # 테마 인식 Text (theming.md)
│   └── themed-view.tsx
├── constants/theme.ts  # 디자인 토큰 (Colors/Spacing/Fonts)
├── hooks/              # use-theme, use-color-scheme(.web)
└── dev/registry.tsx    # 갤러리 등록부
```

경로 별칭: `@/*` → `src/*`, `@/assets/*` → `assets/*` (`tsconfig.json`).

## 라우팅 모델

- **파일 기반**: `src/app/<name>.tsx` = 라우트 `/<name>`. 디렉터리 = 중첩.
- **탭**: 루트 `_layout.tsx`가 탭 셸을 렌더. 탭은 **플랫폼별 2개 파일**로 분기한다.
  - 네이티브: [`app-tabs.tsx`](../src/components/app-tabs.tsx) — `expo-router/unstable-native-tabs`의 `NativeTabs`.
  - 웹: [`app-tabs.web.tsx`](../src/components/app-tabs.web.tsx) — `expo-router/ui`의 `Tabs`/`TabTrigger`.
  - **탭을 추가하면 두 파일 모두** 수정해야 한다 (한쪽만 고치면 해당 플랫폼에서 누락).
- **타입드 라우트**: 켜져 있어 `href`가 실제 라우트에 대해 타입 체크된다. 타입은 `.expo/types`에 생성되며 gitignore 대상 — CI에선 문자열로 graceful fallback (typecheck 통과).

## 플랫폼 분기

- 코드 분기: `Platform.OS` / `Platform.select`.
- 파일 분기: `foo.web.tsx`, `foo.ios.tsx`, `foo.android.tsx` (Metro가 자동 선택).
- 웹은 react-native-web으로 렌더되며 정적 렌더링(SSG)이 켜져 있다 — 하이드레이션 주의 (theming.md의 색상 스킴 참고).

## 열린 결정 (프론트 아키텍처)

- 디렉터리 컨벤션: 도메인별 폴더(`src/features/<domain>/`) 도입 여부 — 화면 이식이 본격화되면 재검토.
- 네비게이션: 탭 외 스택/모달 패턴 표준 — 첫 모달 화면 이식 시 확정.

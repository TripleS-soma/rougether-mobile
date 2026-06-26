# 코딩 규약

규약은 ESLint(eslint-config-expo) + Prettier로 강제되는 부분과, 도구가 못 잡는 합의로 나뉜다.
도구가 잡는 건 [testing.md](testing.md)의 명령으로 확인하고, 아래는 사람이 지켜야 하는 합의다.

## 파일 / 네이밍

- 파일명: **kebab-case** (`sample-button.tsx`, `use-theme.ts`). 템플릿 기준을 따른다.
- 컴포넌트 export: **PascalCase** named export (`export function SampleButton`). default export는 라우트(`src/app/*`)에서만.
- 훅: `use-*.ts`, 함수는 `useX`.
- 테스트: 대상 옆 `__tests__/<name>.test.tsx`.

## 컴포넌트 형태

[`SampleButton`](../src/components/sample-button.tsx)이 레퍼런스다. 새 컴포넌트는 이 형태를 복사한다.

- 함수 컴포넌트 + 명시적 `Props` 타입 export.
- 색/폰트/간격은 직접 쓰지 말고 **토큰**으로 ([theming.md](theming.md)): `useTheme()`, `ThemedText`, `ThemedView`, `Spacing`, `Fonts`.
- 스타일은 파일 하단 `StyleSheet.create`. 인라인 스타일은 동적 값(테마/상태)만.
- 네이티브 모듈/플랫폼 API 의존은 가능하면 화면 레벨로 밀어 컴포넌트를 순수하게 유지 (테스트 용이, 갤러리 등록 가능).
- 접근성: 인터랙션 요소엔 `accessibilityRole`/`accessibilityState`를 단다.

## import 순서 (Prettier가 정렬 안 함 — 수동 합의)

1. 외부 패키지 (`react`, `react-native`, `expo-*`)
2. 빈 줄
3. 내부 `@/...` 별칭

상대경로 import는 같은 폴더 한정. 그 외엔 `@/` 별칭.

## TypeScript

- `strict` 켜짐. `any` 지양 — 불가피하면 주석으로 사유.
- Props/도메인 타입은 명시. spec API 응답 타입은 [state-and-data.md](state-and-data.md) 참조 (spec 계약과 일치).
- 라우트 `href`는 타입드 라우트의 도움을 받되, 동적 경로는 헬퍼로.

## 스타일 / 레이아웃

- Flexbox/Grid 우선, 절대 위치는 필요할 때만 (프로토타입 가이드라인과 동일 정신).
- 매직 넘버 대신 `Spacing` 토큰. 색은 `theme.*` 키.
- 파일이 커지면 헬퍼/하위 컴포넌트를 별도 파일로 분리.

## 언어

- 코드/식별자/주석 기술용어는 영어, 설명 주석은 한국어 가능. 사용자 노출 문자열은 ko-KR (프로토타입과 동일).

## 열린 결정

- import 자동 정렬(eslint-plugin-import / simple-import-sort) 도입 여부.
- 절대경로 별칭 외 배럴(`index.ts`) 사용 정책.

---
name: add-component
description: 재사용 가능한 RN 컴포넌트를 컴포넌트 + 갤러리 등록 + 테스트 한 묶음으로 추가한다. 사용자가 새 UI 컴포넌트를 만들려 할 때 사용.
---

# 컴포넌트 추가

새 재사용 컴포넌트를 **항상 3종 세트**로 만든다. 규범은 `docs/conventions.md`·`docs/theming.md`·`docs/testing.md`, 레퍼런스는 `src/components/sample-button.tsx`.

## 산출물

1. `src/components/<name>.tsx`
   - 함수 컴포넌트 + 명시적 `Props` 타입 export, 파일명 kebab-case.
   - 색/간격/폰트는 토큰만 (`useTheme`/`ThemedText`/`ThemedView`/`Spacing`).
   - 가능하면 순수 컴포넌트, 스타일은 하단 `StyleSheet.create`, 접근성 속성 포함.
2. `src/dev/registry.tsx`에 갤러리 항목 추가 (대표 variant들).
3. `src/components/__tests__/<name>.test.tsx`
   - 렌더 + 콜백 + 주요 분기. **RNTL v14 → `await render` / `await fireEvent` 필수** (`docs/testing.md`).

## 절차

1. 컴포넌트 이름·props·variant를 사용자와 확정.
2. `component-builder` 서브에이전트에 위임하거나 직접 3종을 작성.
3. `npm run typecheck && npm run lint && npm test`로 그린 확인. `/dev` 갤러리로 눈 확인을 권한다.

## 산출 보고

만든 파일과 검증 결과(통과/실패)를 사실대로 요약한다.

# Expo는 바뀌었습니다

코드를 작성하기 전에 반드시 정확한 버전 문서(https://docs.expo.dev/versions/v55.0.0/)를 확인하세요.

# Rougether 모바일

루틴/습관 트래커 + 방 꾸미기 게임. **Expo SDK 55** + React Native 0.83 + Expo Router(파일 기반 라우팅), React 19, TypeScript(strict). 이 저장소는 **개발/테스트 하니스**입니다. `rougether-prototype` 웹 프로토타입(Figma Make)의 화면을 하나씩 포팅하고, 실제 라우트에 연결하기 전에 각각을 독립적으로 미리보기합니다.

프로젝트 개요·스크립트 표·CI는 `README.md`를 참고하세요. 이 문서는 코드를 수정할 때 따라야 할 규칙을 다룹니다.

## 구조

- `src/app/` — Expo Router 라우트. `(tabs)/`는 앱 셸(Home / Explore / Dev)이고, `_layout.tsx`는 루트 Stack(MSW 부팅도 여기서 함). 인증 라우트: `login.tsx`, `signup.tsx`.
- `src/components/screens/` — 프로토타입에서 포팅한 전체 화면. 각 화면은 **순수하고 prop 기반**인 컴포넌트(내부에 라우팅/전역 상태 없음)이며, 형제 테스트 파일이 함께 있습니다.
- `src/components/` — 공용/리프 컴포넌트. `ui/`에는 프리미티브(`field`, `collapsible`)가 있습니다. 네이티브와 웹이 갈라지는 곳에는 `.web.tsx` 변형이 존재합니다(`app-tabs`, `animated-icon`).
- `src/constants/theme.ts` — **디자인 토큰**(단일 출처): `Themes`(cozy / forest / hanok 시맨틱 컬러), `Typography`, `Spacing`, `Radius`, `FontWeight`. 그 외 `characters.ts`, `routines.ts`.
- `src/hooks/` — `useTokens()`(활성 브랜드 테마), `useTheme()`(템플릿 라이트/다크 크롬).
- `src/resources/` — 이미지/에셋 레이어. `assetSource(key)`가 `*_key`를 `<Image>` source로 변환합니다(실제 CDN이 생기기 전까지는 더미 플레이스홀더). `furniture.ts`는 가구 카탈로그입니다.
- `src/api/` — 비즈니스 API 클라이언트. `API_BASE`(`/api/v1` 접두사, 리스트 응답은 `{ items: [...] }`로 감쌈)에 대해 `apiGet` / `apiGetList` 사용.
- `src/mocks/` — MSW 핸들러 + 픽스처. 개발 환경에서만 `startMockServer()`로 시작됩니다.
- `src/dev/registry.tsx` — `/dev` 탭에 표시되는 컴포넌트 갤러리.

## 규칙

- **임포트 별칭**: `@/*` → `src/*`, `@/assets/*` → `assets/*`. 상대 경로(`../../`) 대신 별칭을 사용하세요.
- **스타일링**: `StyleSheet.create` + 토큰. 색은 `useTokens()`(`const t = useTokens()`)에서, 크기는 `Spacing`/`Radius`에서, 텍스트는 `Typography`에서 가져옵니다. 화면에 hex 색상이나 매직 넘버를 하드코딩하지 말고 토큰을 추가/확장하세요.
- **화면은 순수하게**: 데이터와 콜백을 prop으로 받고(예: `onChangeTheme`, `onLogout`) 합리적인 기본값을 둡니다. 라우팅·데이터 패칭·전역 상태는 별도로 연결합니다.
- **UI 문구는 한국어**, 코드·주석·식별자는 영어.
- **아이콘**은 현재 이모지 플레이스홀더이며, 실제 스프라이트/CDN 아트는 추후 포팅합니다.
- 파일명은 kebab-case, 컴포넌트는 PascalCase named export.

## 작업 흐름

- 컴포넌트를 만든 뒤에는 **`src/dev/registry.tsx`에 등록**해 Dev 탭에 노출시키고, 형제 `__tests__/*.test.tsx`를 작성하세요(React Native Testing Library; 스냅샷이 아니라 `getByText` / `getByLabelText`로 단언). `SampleButton`이 참고 패턴입니다.
- 커밋 전: `npm run typecheck && npm run lint && npm run format:check && npm test` 실행. CI가 `main` 푸시와 모든 PR에서 이 네 가지를 돌리므로, 항상 통과 상태로 유지하세요.
- 기능 하나당 `feat/<기능>` 브랜치, `main`으로 PR(기존 히스토리 규칙과 동일).
- Expo/React Native API와 관련된 부분을 건드릴 때는 먼저 SDK 55 문서(상단 참고)로 확인하세요. 최근 SDK 사이에 API가 바뀌었습니다.

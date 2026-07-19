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

- **작업 시작 전 스펙 확인**: 기능 작업을 시작하기 전에 상위 폴더의 공유 계약 저장소 `../rougether-spec`를 읽으세요 — 루트의 `product.md` / `erd.md` / `api.md` / `open-questions.md`와 해당 도메인의 `domains/<도메인>/{prd,features,api}.md`(member / routine-todo / room / shop / gacha / house). 스웨거는 "지금 서버에 있는 것", 스펙은 "팀이 합의한 의도"입니다.
- 컴포넌트를 만든 뒤에는 **`src/dev/registry.tsx`에 등록**해 Dev 탭에 노출시키고, 형제 `__tests__/*.test.tsx`를 작성하세요(React Native Testing Library; 스냅샷이 아니라 `getByText` / `getByLabelText`로 단언). `SampleButton`이 참고 패턴입니다.
- 커밋 전: `npm run typecheck && npm run lint && npm run format:check && npm test` 실행. CI가 `main` 푸시와 모든 PR에서 이 네 가지를 돌리므로, 항상 통과 상태로 유지하세요.
- 기능 하나당 `feat/<기능>` 브랜치, **`dev`로 PR** (2026-07-19부터 — main 직행 금지). **PR 스택 금지** — 브랜치는 항상 `dev`에서 직접 분기하세요(중간 브랜치가 먼저 머지되면 자식 PR이 표류합니다).
- **`dev` 머지 = 자동 배포 트리거**: CI(`.github/workflows/eas-deploy.yml`)가 네이티브 지문을 비교해 JS-only면 preview 채널 OTA, 네이티브 변경이면 EAS 빌드(+iOS TestFlight 자동 제출)를 실행합니다. `main`은 안정 릴리스 지점 — 검증된 `dev`를 주기적으로 승격(dev→main)합니다.
- **PR 본문 컨벤션**: 모든 PR은 아래 두 섹션을 포함하세요.
  - `## 요약` — 작업사항 요약: 무엇을 왜 바꿨는지(사용자 관점 변화 + 주요 구현 결정). 관련 이슈는 `Closes #N`으로 연결.
  - `## 리뷰 포인트` — 리뷰어에게 요구하는 것: 집중해서 봐줬으면 하는 부분(위험한 변경, 설계 판단, 트레이드오프)과 직접 확인하는 방법. 수행한 검증(4종 체크, dev 서버 스모크 등)도 여기에 적어 리뷰 범위를 줄여주세요.
- Expo/React Native API와 관련된 부분을 건드릴 때는 먼저 SDK 55 문서(상단 참고)로 확인하세요. 최근 SDK 사이에 API가 바뀌었습니다.

## 이슈 · 프로젝트 보드

업무는 GitHub Issues + 조직 프로젝트 보드(**TripleS-soma 프로젝트 #2**)로 관리합니다.

- **이슈 먼저**: 기능/버그 작업은 이슈를 만들고 시작합니다. 라벨: `api`(서버 연동) / `ux` / `backend-blocked`(서버 엔드포인트 대기) / `native-build`(OTA 불가, 네이티브 빌드 필요). 담당자는 GitHub Actions가 자동으로 `evan7484`를 지정합니다(`.github/workflows/auto-assign-issues.yml`).
- **보드 등록**: 새 이슈는 프로젝트 #2에 추가하고 Status(`Todo → In Progress → Done`)와 Priority(`P0 지금 / P1 다음 / P2 대기`)를 지정합니다.
  ```sh
  gh project item-add 2 --owner TripleS-soma --url <이슈 URL>
  gh project item-edit --project-id PVT_kwDOEMVke84BcZqA --id <item-id> \
    --field-id <field-id> --single-select-option-id <option-id>
  # Status 필드: PVTSSF_lADOEMVke84BcZqAzhXCx0s (Todo f75ad846 / In Progress 47fc9ee4 / Done 98236657)
  # Priority 필드: PVTSSF_lADOEMVke84BcZqAzhXIviY (P0 6711a274 / P1 267d66c3 / P2 473596d8)
  ```
- **PR 연결**: PR 본문에 `Closes #N`을 넣어 머지 시 이슈가 자동으로 닫히고 보드가 Done으로 이동하게 합니다.
- **코드 리뷰**: 모든 PR에 Claude 자동 리뷰가 달립니다(`.github/workflows/claude-code-review.yml`). 머지 전에 리뷰 지적 사항을 확인하고 반영하거나 근거를 남기세요.
- **미연동 API 추적**: 스웨거(`/v3/api-docs`)에 새 엔드포인트가 생기면 연동 이슈를 만들어 보드에 올립니다. 서버에 없는 기능은 화면에서 `ui/PendingNotice`("서버 준비 중")로 정직하게 표시합니다.

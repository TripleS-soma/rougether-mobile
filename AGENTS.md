# Expo는 바뀌었습니다

코드를 작성하기 전에 반드시 정확한 버전 문서(https://docs.expo.dev/versions/v55.0.0/)를 확인하세요.

# Rougether 모바일

루틴/습관 트래커 + 방 꾸미기 게임. **Expo SDK 55** + React Native 0.83 + Expo Router(파일 기반 라우팅), React 19, TypeScript(strict). **iOS App Store·Google Play(비공개 테스트)에 출시된 앱**입니다 — 화면은 `rougether-prototype` 웹 프로토타입(Figma Make)에서 포팅됐고, 새 컴포넌트는 지금도 Dev 탭 갤러리로 독립 미리보기하며 개발합니다.

프로젝트 개요·스크립트 표·CI는 `README.md`를 참고하세요. 이 문서는 코드를 수정할 때 따라야 할 규칙을 다룹니다.

## 구조

- `src/app/` — Expo Router 라우트. `(tabs)/`는 앱 셸(Home / Explore / Dev)이고, `_layout.tsx`는 루트 Stack. 인증 라우트: `login.tsx`, `signup.tsx`.
- `src/components/screens/` — 프로토타입에서 포팅한 전체 화면. 각 화면은 **순수하고 prop 기반**인 컴포넌트(내부에 라우팅/전역 상태 없음)이며, 형제 테스트 파일이 함께 있습니다.
- `src/components/` — 공용/리프 컴포넌트. `ui/`에는 프리미티브(`field`)가 있습니다. 네이티브와 웹이 갈라지는 곳에는 `.web.tsx` 변형이 존재합니다(`app-tabs`, `animated-icon`).
- `src/constants/theme.ts` — **디자인 토큰**(단일 출처): `Themes`(cozy / forest / hanok 시맨틱 컬러), `Typography`, `Spacing`, `Radius`, `FontWeight`, 폰트 선택 토큰(`FONT_OPTIONS` / `typographyFor`, #382). 그 외 `characters.ts`, `routines.ts`.
- `src/hooks/` — `useTokens()`(활성 브랜드 테마), `useTypography()`(선택 폰트가 반영된 타입 스케일 — 컴포넌트 안에서 `const Typography = useTypography()`로 사용), `useFontEmphasis()`(임의 굵기 강조), `useTheme()`(템플릿 라이트/다크 크롬).
- `src/resources/` — 이미지/에셋 레이어. `assetSource(key)`가 `*_key`를 `<Image>` source로 변환합니다(실제 CDN이 생기기 전까지는 더미 플레이스홀더). `furniture.ts`는 가구 카탈로그입니다.
- `src/api/` — 비즈니스 API 클라이언트. `API_BASE`(`/api/v1` 접두사, 리스트 응답은 `{ items: [...] }`로 감쌈)에 대해 `apiGet` / `apiGetList` 사용.
- `src/mocks/` — 컴포넌트 기본 prop용 **픽스처만** 남아 있습니다(`fixtures.ts`). MSW는 제거됐습니다 — **개발 웹/앱은 항상 실서버(`src/config/shared-endpoints.json`의 CloudFront)를 봅니다.** 화면을 웹으로 확인하면 그건 실데이터입니다.
- `src/dev/registry.tsx` — `/dev` 탭에 표시되는 컴포넌트 갤러리.

## 규칙

- **임포트 별칭**: `@/*` → `src/*`, `@/assets/*` → `assets/*`. 상대 경로(`../../`) 대신 별칭을 사용하세요.
- **스타일링**: `StyleSheet.create` + 토큰. 색은 `useTokens()`(`const t = useTokens()`)에서, 크기는 `Spacing`/`Radius`에서, 텍스트는 `useTypography()`의 타입 스케일에서 가져옵니다. 화면에 hex 색상이나 매직 넘버를 하드코딩하지 말고 토큰을 추가/확장하세요. **`fontWeight`를 스타일에 직접 쓰지 마세요** — 커스텀 폰트(#382)는 weight별 파일이라 가짜 볼드가 생깁니다. 굵기 강조는 `useFontEmphasis()`로. **반대로 `fontSize`만 적고 패밀리를 안 주면 그 텍스트는 선택 폰트를 영영 안 따릅니다** — 로컬 스타일에 크기만 두려면 `emph('normal')`을 같이 붙이세요(시스템 폰트에서는 무해한 `fontWeight`로 떨어집니다). `src/constants/__tests__/font-hygiene.test.ts`가 이걸 강제합니다.
- **화면은 순수하게**: 데이터와 콜백을 prop으로 받고(예: `onChangeTheme`, `onLogout`) 합리적인 기본값을 둡니다. 라우팅·데이터 패칭·전역 상태는 별도로 연결합니다.
- **서버 상태는 react-query로** (2026-09-01, #1027): **새로 만드는 데이터 훅은 `useQuery`/`useMutation`을 씁니다.** 기존 훅 23개는 `useState` + `useEffect`로 각자 캐시를 들고 있는데, 통째로 옮기지 않고 **그 파일을 만질 때 함께** 옮깁니다(전면 리라이트 PR은 리뷰가 불가능합니다). 무효화 규칙이 없어서 생긴 버그가 실재합니다 — 루틴 수정이 완료 기록을 옛 id에 남기는 #1028이 그것입니다.
  - 클라이언트 기본값은 `src/lib/query-client.ts`(staleTime 30초 · retry 1 · 포커스 재조회). RN 포커스 감지는 `subscribeAppStateFocus`가 배선합니다 — **온라인 감지(`onlineManager`)는 없습니다**(NetInfo가 네이티브 모듈이라 지문이 바뀝니다).
  - 훅이 돌려주는 객체는 **참조를 고정**하세요. `useMutation`이 주는 **객체는 매 렌더 새것**이라 의존성에 넣으면 나의 방 memo 경계(#539)가 뚫립니다 — `mutateAsync`만 꺼내 쓰고 중복 탭 가드는 `useLatestRef`로 읽습니다. `app-shell-render-stability.test.tsx`가 이걸 강제합니다.
  - 테스트는 `@/test-utils/query-wrapper`의 `queryWrapper()`(훅) 또는 `QueryProvider`(트리)로 감쌉니다. 캐시 반영은 `notifyManager`가 배칭하므로 **즉시 단언하지 말고 `waitFor`** 로 기다리세요.
- **UI 문구는 한국어**, 코드·주석·식별자는 영어.
- **아이콘**은 현재 이모지 플레이스홀더이며, 실제 스프라이트/CDN 아트는 추후 포팅합니다.
- 파일명은 kebab-case, 컴포넌트는 PascalCase named export.

## 작업 흐름

- **작업 시작 전 열린 PR·브랜치 확인** (2026-08-16): 기능에 착수하기 전에 `gh pr list --state open`과 원격 브랜치를 먼저 보세요. 스웨거에 새 엔드포인트가 있다고 해서 앱이 안 하고 있는 게 아닙니다 — 방 거미줄(서버 #277)은 팀원이 #781로 **4일 전부터 열어둔 상태**였는데, 스웨거만 보고 "미연동"이라 판단해 #832·#833·#834로 통째로 중복 구현했습니다. 되돌리는 비용보다 `gh pr list` 한 번이 훨씬 쌉니다.
- **작업 시작 전 스펙 확인**: 기능 작업을 시작하기 전에 상위 폴더의 공유 계약 저장소 `../rougether-spec`를 읽으세요 — 루트의 `product.md` / `erd.md` / `api.md` / `open-questions.md`와 해당 도메인의 `domains/<도메인>/{prd,features,api}.md`(member / routine-todo / room / shop / gacha / house). 스웨거는 "지금 서버에 있는 것", 스펙은 "팀이 합의한 의도"입니다.
- 컴포넌트를 만든 뒤에는 **`src/dev/registry.tsx`에 등록**해 Dev 탭에 노출시키고, 형제 `__tests__/*.test.tsx`를 작성하세요(React Native Testing Library; 스냅샷이 아니라 `getByText` / `getByLabelText`로 단언). `ui/bear-check.tsx`(+ 형제 테스트)가 참고 패턴입니다.
- 커밋 전: `npm run typecheck && npm run lint && npm run format:check && npm test` 실행. CI가 `main` 푸시와 모든 PR에서 이 네 가지를 돌리므로, 항상 통과 상태로 유지하세요.
- 기능 하나당 `feat/<기능>` 브랜치, **`dev`로 PR** (2026-07-19부터 — main 직행 금지, 2026-07-28부터 룰셋이 강제). **PR 스택 금지** — 브랜치는 항상 `dev`에서 직접 분기하세요(중간 브랜치가 먼저 머지되면 자식 PR이 표류합니다).
- **머지 규칙 (GitHub 룰셋으로 강제, 2026-07-28 정립)**:
  - **기능 PR은 squash 머지** — dev 히스토리가 PR당 1커밋이 되어 revert·OTA 롤백이 쉽습니다. squash 커밋 메시지에 **PR 제목이 그대로 쓰이므로** PR 제목을 커밋 컨벤션(`feat:`/`fix:`/`chore:`)으로 작성하세요. rebase 머지는 비활성.
  - **dev→main 승격 PR만 merge commit** (squash하면 dev 이력이 한 커밋으로 뭉개짐). 승격 PR 제목은 `release: dev → main (YYYY-MM-DD)` 형식.
  - **룰셋**: `dev`·`main` 둘 다 PR 필수 + CI(`check`·`prebuild`) 통과 필수, 직접 push 차단, **승인은 비필수**(2026-08-13 — main의 팀원 승인 1명 요구를 해제했습니다. 1인 개발 속도를 막는 대가가 컸고, Claude 자동 리뷰 확인은 프로세스로 유지합니다). `main`은 추가로 **merge commit만 허용**(squash 불가 — 승격 이력을 한 덩어리로 뭉개지 않게). bypass 없음: 비상시엔 Settings → Rules에서 룰셋을 잠깐 비활성화(명시적·감사 가능한 경로)하고 끝나면 복구.
  - **auto-merge(squash)** 는 CI 통과 대기 예약용으로 사용해도 됩니다. 단 **`native-build` 라벨 PR은 auto-merge 금지** — 머지 즉시 EAS 빌드가 트리거되고 몰아 머지의 런 취소 타이밍을 제어해야 하므로 수동 머지만 허용하며, 켜더라도 `native-build-guard` 워크플로가 자동 해제하고 코멘트를 남깁니다.
- **배포·릴리스·네이티브 빌드를 건드리기 전에 반드시 [`docs/release-ops.md`](docs/release-ops.md)를 먼저 읽으세요.** OTA 채널·네이티브 지문·EAS 쿼터·스토어 제출·핫픽스·몰아 머지 절차가 전부 그 문서에 있습니다 — 여기엔 매 작업에 필요한 최소만 남깁니다.
  - dev 머지는 자동 배포를 트리거합니다(JS-only면 preview OTA, 네이티브 변경이면 EAS 빌드). **지문이 바뀌는 PR에는 `native-build` 라벨**을 붙이고 auto-merge를 걸지 마세요 — 머지 타이밍·빌드 검증은 release-ops 절차를 따릅니다.
  - **`app.json`을 건드리면 네이티브 지문이 바뀌어** 기존 설치본의 OTA 수신이 끊깁니다. 이런 변경은 release-ops의 네이티브 윈도우에 몰아서.
- **기능을 제거·변경하면 `store/` 문구도 같이 고친다** (2026-08-14, #818): 스토어 리스팅 텍스트의 단일 출처는 `store/ko-KR/**`입니다. 콘솔에만 두면 코드에서 기능을 지워도 리스팅이 남습니다 — 사진 인증이 실제로 그랬고(#695에서 UI 제거, #797에서 인앱 도움말 제거, **스토어 설명만 남음**), App Store 심사 가이드 2.3(정확한 메타데이터) 위반 상태로 배포돼 있었습니다. `store/__tests__/metadata-limits.test.ts`가 글자 수 상한과 제거된 기능 언급을 막지만, **문구를 실제 콘솔에 반영하는 건 수동**이니 `store/README.md`의 동기화 표도 갱신하세요.
- **새 데이터·새 권한을 만지면 정책 문서도 고친다** (2026-08-19, #905): `store/` 규칙(위)은 **스토어 리스팅 텍스트만** 다룹니다. 개인정보처리방침·이용약관은 **다른 레포**에 있어 이 저장소 diff에 안 걸립니다 — 실제로 1.2.0의 기기 캘린더 읽기(#844)가 방침에 한 줄도 없이 심사 직전까지 갔습니다.
  - **실물 위치**: `TripleS-soma/rougether-landing` 의 `public/privacy.html` · `public/terms.html` (main 푸시 = 즉시 배포). `TripleS-soma/policy` 는 **리다이렉트 스텁만** 남아 있습니다 — 옛 주소로 나간 빌드를 살려두려는 것이니 내용을 고치지 마세요. 앱이 여는 주소는 `src/constants/policy.ts`.
  - **언제 고치나**: 새 권한을 요구하거나(`app.json`의 `*UsageDescription`·`permissions` 변경), 서버로 보내는 데이터 종류가 늘거나, 외부 서비스에 데이터를 넘기게 될 때.
  - **무엇을 적나**: 수집 항목·수집 방법·이용 목적. **"보내는 것"과 "저장하는 것"을 구분**할 것 — 캘린더 임포트는 겹침 안내를 위해 미리보기 단계에서 일정 제목 200건을 서버로 보내지만 저장하지는 않습니다(`POST /routines/similarity`). "고른 것만 보낸다"고 적었으면 거짓이 될 뻔했습니다.
  - **권한 문구·스토어 설명·방침 셋이 같은 말을 해야 합니다.** 심사자는 "읽기만 한다면서 쓰기 권한은 왜 있냐"를 봅니다.
  - **시행일**: 문서 10항이 "시행 최소 7일 전 고지"(중대 변경 30일)를 약속합니다. 아직 그 기능이 출시 전이라 영향받는 이용자가 없으면 즉시 시행해도 됩니다 — 판단 근거를 버전 이력에 남기세요.
  - **App Privacy(App Store Connect 설문)는 또 별개**입니다. 저장소에 사본이 없어 코드가 못 막습니다 — `store/README.md`의 해당 절 참고.
- **연관된 수정은 한 PR로 묶기**: 같은 화면·같은 관심사의 소규모 수정(문구, 스타일 미세 조정, 리뷰 반영 등)은 PR을 남발하지 말고 하나의 브랜치·PR로 묶으세요. 서로 무관한 기능·별개 도메인은 지금처럼 분리합니다 — 기준은 "리뷰어가 한 호흡에 볼 수 있는 단위".
- **PR 본문 컨벤션**: 모든 PR은 아래 두 섹션을 포함하세요.
  - `## 요약` — 작업사항 요약: 무엇을 왜 바꿨는지(사용자 관점 변화 + 주요 구현 결정). 관련 이슈는 `Closes #N`으로 연결.
  - `## 리뷰 포인트` — 리뷰어에게 요구하는 것: 집중해서 봐줬으면 하는 부분(위험한 변경, 설계 판단, 트레이드오프)과 직접 확인하는 방법. 수행한 검증(4종 체크, dev 서버 스모크 등)도 여기에 적어 리뷰 범위를 줄여주세요.
- Expo/React Native API와 관련된 부분을 건드릴 때는 먼저 SDK 55 문서(상단 참고)로 확인하세요. 최근 SDK 사이에 API가 바뀌었습니다.

## 이슈 · 프로젝트 보드

업무는 GitHub Issues + 조직 프로젝트 보드(**TripleS-soma 프로젝트 #2**)로 관리합니다.

- **이슈 먼저**: 기능/버그 작업은 이슈를 만들고 시작합니다. 라벨: `api`(서버 연동) / `ux` / `backend-blocked`(서버 엔드포인트 대기) / `native-build`(OTA 불가, 네이티브 빌드 필요) / `on-hold`(기획 보류 — 착수 금지). 담당자는 GitHub Actions가 자동으로 `evan7484`를 지정합니다(`.github/workflows/auto-assign-issues.yml`).
- **도메인 라벨 필수(2026-08-01 전수 백필 완료)**: 모든 이슈에 `domain:*` 라벨을 정확히 1개 붙입니다 — `room`(꾸미기·가구·위젯 방) / `routine-todo`(루틴·투두·달력) / `house`(집·미션·초대·응원) / `member`(계정·프로필·온보딩·캐릭터·설정) / `shop-gacha` / `notification`(푸시·알림) / `design`(토큰·폰트·UI 공통·제스처 손맛) / `infra`(CI·EAS·OTA·수평 리팩터). 닫힌 이슈 포함 전체가 분류돼 있어 `is:issue label:domain:room` 식으로 과거 작업을 회고할 수 있습니다. 보드에도 같은 값의 `Domain` 단일선택 필드를 지정합니다. **이슈 제목도 같은 도메인 접두**를 붙입니다(2026-08-01 전수 리네이밍 완료) — `room: 가구 스케일 상한 3.5`처럼 `<도메인>: <제목>` 형식. 라벨과 중복이지만 목록·검색·알림에서 한눈에 스캔하기 위한 것.
- **보드 등록**: 새 이슈는 프로젝트 #2에 추가하고 Status(`Todo → In Progress → Done`)와 Priority(`P0 지금 / P1 다음 / P2 대기`)를 지정합니다.
  ```sh
  gh project item-add 2 --owner TripleS-soma --url <이슈 URL>
  gh project item-edit --project-id PVT_kwDOEMVke84BcZqA --id <item-id> \
    --field-id <field-id> --single-select-option-id <option-id>
  # Status 필드: PVTSSF_lADOEMVke84BcZqAzhXCx0s (Todo f75ad846 / In Progress 47fc9ee4 / Done 98236657)
  # Priority 필드: PVTSSF_lADOEMVke84BcZqAzhXIviY (P0 6711a274 / P1 267d66c3 / P2 473596d8)
  # Domain 필드: PVTSSF_lADOEMVke84BcZqAzhZaPNM (room db8b218f / routine-todo 4c9688ca / house f4a3fe41
  #   / member 7f6cd448 / shop-gacha d757997c / notification d1f73111 / design cb4e8679 / infra 29ed7431)
  ```
- **PR 연결**: PR 본문에 `Closes #N`을 넣어 머지 시 이슈가 자동으로 닫히고 보드가 Done으로 이동하게 합니다.
- **코드 리뷰**: 모든 PR에 Claude 자동 리뷰가 달립니다(`.github/workflows/claude-code-review.yml`). 머지 전에 리뷰 지적 사항을 확인하고 반영하거나 근거를 남기세요.
- **미연동 API 추적**: 스웨거(`/v3/api-docs`)에 새 엔드포인트가 생기면 연동 이슈를 만들어 보드에 올립니다. 서버에 없는 기능은 화면에서 `ui/PendingNotice`("서버 준비 중")로 정직하게 표시합니다.

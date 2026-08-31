# rougether-mobile

**루틴·습관 트래커 + 방 꾸미기 게임 [Rougether](https://rougether.com)** 의 모바일 앱.

루틴을 지키면 재화를 얻고, 그 재화로 자기 방을 꾸밉니다. 친구·가족과 "집"을 만들어 서로의
루틴을 응원하는 소셜 레이어가 위에 얹혀 있습니다. iOS App Store 출시 중이며 Android는
Google Play 비공개 테스트 단계입니다.

[Expo SDK 55](https://docs.expo.dev/versions/v55.0.0/) · React Native 0.83 · React 19 ·
Expo Router(파일 기반 라우팅) · TypeScript(strict).

## 시작하기

```bash
npm install
npm start        # Expo dev 서버 — i / a / w 로 iOS / Android / web
```

> **개발 빌드는 실서버를 봅니다.** 목 서버(MSW)는 제거됐습니다 — 웹으로 화면을 확인하면
> 그건 실데이터입니다. 접속 주소는 `src/config/shared-endpoints.json`.

## 구조

| 경로                                                | 역할                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`src/app/`](src/app)                               | Expo Router 라우트. `(tabs)/`가 앱 셸, `_layout.tsx`가 루트 Stack                             |
| [`src/components/screens/`](src/components/screens) | 화면 컴포넌트. **순수·prop 기반**(라우팅·전역 상태 없음) + 형제 테스트                        |
| [`src/components/ui/`](src/components/ui)           | 공용 프리미티브                                                                               |
| [`src/constants/theme.ts`](src/constants/theme.ts)  | **디자인 토큰 단일 출처** — `Themes`(cozy/forest/hanok) · `Typography` · `Spacing` · `Radius` |
| [`src/api/`](src/api)                               | 비즈니스 API 클라이언트 (`/api/v1`)                                                           |
| [`src/hooks/`](src/hooks)                           | `useTokens()` · `useTypography()` · `useFontEmphasis()` · `useTheme()`                        |
| [`src/resources/`](src/resources)                   | 이미지·카탈로그 데이터 (가구·캐릭터)                                                          |
| [`src/widgets/`](src/widgets)                       | 홈 화면 위젯 (RemoteViews — 앱 폰트 사용 불가)                                                |

**컴포넌트 갤러리** — `Dev` 탭(`/dev` 라우트)이 [`src/dev/registry.tsx`](src/dev/registry.tsx)에
등록된 컴포넌트를 격리 상태로 렌더합니다. 새 컴포넌트를 만들면 여기 등록하세요.

## 스크립트

| 명령                              | 하는 일                                         |
| --------------------------------- | ----------------------------------------------- |
| `npm start`                       | Expo dev 서버                                   |
| `npm run ios` / `android` / `web` | 플랫폼별 실행                                   |
| `npm run typecheck`               | `tsc --noEmit`                                  |
| `npm run lint`                    | `expo lint`                                     |
| `npm run format` / `format:check` | Prettier write / check                          |
| `npm test` / `test:watch`         | Jest (jest-expo + React Native Testing Library) |
| `npm run gen:api-types`           | 스웨거에서 API 타입 생성                        |
| `npm run build:characters`        | 캐릭터 스프라이트 시트 빌드                     |

커밋 전에 **typecheck · lint · format:check · test** 네 가지를 통과시키세요.
[`ci.yml`](.github/workflows/ci.yml)이 모든 PR에서 같은 것을 돌립니다.

## 배포

기본 브랜치는 **`dev`** 입니다. 기능은 `feat/<기능>` 브랜치에서 `dev`로 PR(squash 머지),
릴리스는 `dev → main` 승격 PR(merge commit)로 갑니다.

`dev` 머지는 [`eas-deploy`](.github/workflows/eas-deploy.yml)를 트리거해 네이티브 지문을
비교합니다 — JS만 바뀌었으면 preview 채널 OTA, 네이티브가 바뀌었으면 EAS 빌드.
**`main` 승격은 아무것도 발행하지 않습니다** — production OTA는 `eas-release` 워크플로를
main에서 수동 실행할 때만 나갑니다.

## 기여

**[`AGENTS.md`](AGENTS.md)에 코딩 규칙·브랜치 전략·배포 절차·이슈 관리가 전부 있습니다.**
코드를 건드리기 전에 읽어주세요. 특히:

- 색은 `useTokens()`, 크기는 `Spacing`/`Radius`, 텍스트는 `useTypography()` — **hex·매직 넘버 금지**
- **`fontWeight`를 스타일에 직접 쓰지 마세요** (커스텀 폰트가 weight별 파일이라 가짜 볼드가 납니다).
  굵기는 `useFontEmphasis()`로 — `font-hygiene.test.ts`가 강제합니다
- UI 문구는 한국어, 코드·주석·식별자는 영어
- 파일명 kebab-case, 컴포넌트 PascalCase named export

## 라이선스

MIT — [`LICENSE`](LICENSE)

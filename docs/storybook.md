# 디자인 컴포넌트 Storybook

앱에서 사용하는 React Native 컴포넌트를 브라우저에서 직접 렌더하는 디자인 카탈로그입니다.
색상·글꼴과 컴포넌트 상태를 바꾸면서 디자인을 검토하고, Controls와 Actions로 props와
콜백을 확인합니다. 구현은 `src/components/ui/`에서 가져오며, 스토리에 앱 UI를 복제하지 않습니다.

## 실행과 빌드

프로젝트 루트에서 실행합니다. CI와 같은 Node.js 22 환경을 권장합니다.

```bash
npm ci
npx --no-install storybook dev -p 6006 --host 127.0.0.1 --no-open
```

[로컬 Storybook](http://127.0.0.1:6006)을 엽니다. Expo 개발 서버와 별도로 실행되며,
스토리에 지정한 예시 데이터와 콜백으로 공용 컴포넌트를 확인합니다.

```bash
npx --no-install storybook build --output-dir web-build/storybook
```

정적 결과물은 `web-build/storybook/`에 생성됩니다. 빌드 명령은 파일 생성까지만 수행합니다.
호스팅이나 공개 배포는 별도 작업입니다.

이 저장소는 `package.json`의 실행 스크립트와 `.gitignore`도 Expo 네이티브 지문에 포함합니다.
개발 도구 때문에 기존 설치본의 OTA 런타임이 달라지지 않도록 Storybook은 로컬 CLI를 직접
호출하고, 출력물은 이미 제외된 `web-build/` 아래에 둡니다. 앱 OTA와 Sentry가 사용하는
`dist/`와도 분리됩니다. 디버그 로그가 필요하면 `--logfile web-build/storybook.log`를 추가하세요.

## 카탈로그 사용법

왼쪽 목록의 **디자인 토큰**에서 색상·타이포그래피 등 공통 기준을 확인하고,
**컴포넌트**에서 버튼·입력 필드·배지·카드·토글 등의 상태별 예시를 선택합니다.

상단 도구 모음은 모든 스토리에 공통으로 적용됩니다.

| 항목   | 선택지                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------ |
| 테마   | 포근(`cozy`), 라떼(`latte`), 시트러스 그로브(`citrus`), 파스텔 캔디(`pastel`), 인디고 타이드(`indigo`) |
| 화면   | 라이트, 다크                                                                                           |
| 글꼴   | 나눔스퀘어라운드, 프리텐다드, 주아 혼합, SUIT, 시스템 기본                                             |
| 언어   | 한국어, English                                                                                        |
| 뷰포트 | 소형 폰 320, iPhone 390, 웹 폰 컬럼 480, 웹 2단 시작 960, 웹 2단 최대 1200                             |

**언어**는 앱과 같은 i18n 인스턴스의 언어만 바꿉니다. 앱의 언어 저장값이나 계측에는 흔적을 남기지 않습니다. 영어 문구 길이로 잘리는 곳은 언어를 English로, 뷰포트를 320으로 두고 확인하세요.

**뷰포트**는 앱이 실제로 그려지는 폭입니다. 480·960·1200은 웹 앱 프레임 경계(`use-app-frame`)라 바텀시트 폭(폰 480 / 2단 640)도 여기서 확인합니다. 뷰포트를 고르면 캔버스 기본 폭 제한(420)이 풀립니다.

테마와 글꼴 목록은 앱의 `THEME_OPTIONS`와 `FONT_OPTIONS`를 사용합니다. 폰트 파일은
저장소의 `assets/fonts/`에서 로딩하므로 외부 폰트 서비스가 필요 없습니다. 선택은
`BrandThemePreview` 하위 트리에 적용되며 앱의 저장된 테마 설정을 변경하지 않습니다.

- **Controls**: 문구·변형·비활성 여부 같은 props를 변경합니다.
- **Actions**: 버튼 누르기나 입력 변경으로 호출된 콜백과 인자를 확인합니다.
- **Docs**: 컴포넌트 설명, props, 상태별 스토리를 함께 확인합니다.

입력 필드·토글·곰 체크처럼 값이 바뀌는 스토리는 `useArgs()`로 화면과 Controls 값을
동기화합니다. 예를 들어 토글을 누르면 `value`가 함께 바뀌고 `fn()` 콜백은 Actions에 기록됩니다.

## 파일 구조

| 경로                                                            | 역할                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`.storybook/main.ts`](../.storybook/main.ts)                   | React Native Web + Vite 프레임워크, 애드온(docs·a11y·vitest), svgr, import 별칭 |
| [`.storybook/preview.tsx`](../.storybook/preview.tsx)           | 테마·밝기·글꼴·언어 도구, 뷰포트 프리셋, 캔버스 decorator                       |
| [`vitest.config.ts`](../vitest.config.ts)                       | 스토리 테스트(Chromium 렌더·play·a11y)                                          |
| [`playwright.visual.config.ts`](../playwright.visual.config.ts) | 시각 회귀 설정, 기준 이미지 `stories/__visual__/__screenshots__/`               |
| [`.storybook/fonts.css`](../.storybook/fonts.css)               | 앱 폰트의 웹 로딩                                                               |
| [`stories/foundations/`](../stories/foundations)                | 디자인 토큰 스토리                                                              |
| [`stories/components/`](../stories/components)                  | 실제 공용 컴포넌트의 상태별 스토리                                              |
| [`src/constants/theme.ts`](../src/constants/theme.ts)           | 앱과 Storybook이 공유하는 디자인 토큰                                           |

스토리는 Expo Router의 `src/app/` 밖에 둡니다. 새 파일은
`stories/**/*.stories.tsx` 패턴으로 자동 검색됩니다.

## 스토리 추가하기

`stories/components/`에 kebab-case 이름의 `*.stories.tsx` 파일을 추가합니다. `Meta`와
`StoryObj`는 `@storybook/react-native-web-vite`에서, 콜백은 `storybook/test`의 `fn()`을
사용합니다. `id`는 고유하고 안정적인 ASCII 문자열로 지정하고, `title`과 스토리 `name`은
한국어로 작성합니다. `tags: ['autodocs']`를 추가하면 Docs 페이지도 생성됩니다.

다음은 값 변경과 콜백 기록을 함께 처리하는 패턴입니다. 기존 토글 스토리는
[`toggle-switch.stories.tsx`](../stories/components/toggle-switch.stories.tsx)를 참고하세요.

```tsx
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { ToggleSwitch, type ToggleSwitchProps } from '@/components/ui/toggle-switch';

const meta = {
  id: 'components-toggle-example',
  title: '컴포넌트/토글 예시',
  component: ToggleSwitch,
  tags: ['autodocs'],
  args: {
    value: false,
    accessibilityLabel: '루틴 알림',
    onToggle: fn(),
  },
  argTypes: {
    value: { control: 'boolean' },
    onToggle: { control: false },
  },
  render: function Render(args) {
    const [{ value }, updateArgs] = useArgs<ToggleSwitchProps>();
    return (
      <ToggleSwitch
        {...args}
        value={value}
        onToggle={() => {
          args.onToggle();
          updateArgs({ value: !value });
        }}
      />
    );
  },
} satisfies Meta<typeof ToggleSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
export const On: Story = { name: '켜짐', args: { value: true } };
```

표시 전용 스토리에는 `render`나 `useArgs()` 없이 `args`만 지정해도 됩니다. 장식용
레이아웃을 만들 때도 앱과 같은 `useTokens()`·`useTypography()`·`Spacing`·`Radius`를
사용합니다. 설명에는 사용 목적과 상태 차이를 적고, 예시 데이터에는 개인정보나 실서버 호출을
넣지 않습니다.

새 **앱 컴포넌트**를 만들면 [AGENTS.md](../AGENTS.md)에 따라
`src/dev/registry.tsx` 등록과 형제 테스트를 함께 작성합니다. Storybook 캔버스나 예시를 위한
도우미만 추가하는 경우에는 Dev 갤러리 등록이 필요 없습니다.

## 기기 확인과 검증

기존 **Dev 탭**(`/dev`, `src/dev/registry.tsx`)도 계속 사용합니다. Storybook은 브라우저에서
색상·레이아웃·문구·상태 전환을 빠르게 비교하는 곳이고, 실제 기기의 햅틱과 네이티브 제스처,
플랫폼별 렌더링(iOS 26 리퀴드 글래스 등)은 Dev 갤러리와 앱에서 확인합니다.

### 웹에서 그리지 못하거나 제한되는 것

- **글래스 표면**: 브라우저는 항상 `fallbackColor` 폴백 모습입니다(글래스 질감은 iOS 기기).
- **하단 탭 문지르기·바텀시트 끌어내리기**: 제스처 손맛은 기기에서. 스토리는 탭·클릭만 확인합니다.
- Modal 기반(바텀시트·확인 다이얼로그)은 캔버스 밖 body에 붙으므로 Docs 페이지 인라인 대신 개별 스토리로 봅니다.
- 네이티브 모듈에 의존하는 화면 단위 컴포넌트(action-bar, pager-scroll-view, paw-refresh-scroll, flying-coin, coach-mark 등)는 아직 스토리가 없습니다. 추가할 때 이 목록에서 뺍니다.

### 스토리 테스트 (렌더 · play · 접근성)

모든 스토리를 실제 Chromium에서 렌더하고, `play` 함수와 addon-a11y 검사를 실행합니다.

```bash
npx --no-install playwright install chromium   # 처음 한 번
npx --no-install vitest run --project=storybook
```

- 설정은 `vitest.config.ts`(스토리북 전용 — 앱 단위 테스트는 jest 그대로).
- 스토리 `render`에서 Storybook 훅(`useArgs`)과 React 훅(`useState` 등)을 **한 함수에 섞지 마세요**. Vitest 포터블 스토리에서 오류가 납니다 — 로컬 상태는 내부 컴포넌트로 분리합니다(`field`·`toggle-switch` 스토리 참고).
- 접근성 검사는 현재 `a11y: { test: 'todo' }`(경고)입니다. 2026-09-16 기준 `error`로 올리면 46건 실패 — 대부분 색 대비(color-contrast), 그다음 RN Web이 내보내는 ARIA 속성(aria-prohibited-attr, 진행률 이름 등). 정리하면 `.storybook/preview.tsx`에서 `error`로 올립니다.

### 시각 회귀 (스크린샷 비교)

핵심 스토리(버튼·카드·바텀시트·하단 탭·색상 토큰) × 라이트/다크를 Playwright로 찍어 기준 이미지와 비교합니다(`stories/__visual__/core.visual.ts`, `playwright.visual.config.ts`).

- **기준 이미지는 linux(CI)에서만** 만들고 비교합니다. OS마다 폰트 래스터가 달라 macOS에서 만든 이미지로는 CI가 항상 실패하기 때문입니다. 로컬 macOS에서는 테스트가 건너뛰어집니다(확인만 하려면 `VISUAL_FORCE=1`, 생긴 `*-darwin.png`는 커밋하지 않습니다).
- CI는 기준 이미지가 없는 스토리를 `--update-snapshots=missing`으로 새로 만들어 `storybook-visual` artifact에 올립니다. **받아서 `stories/__visual__/__screenshots__/`에 커밋**하면 다음 PR부터 비교합니다.
- 의도한 디자인 변경으로 비교가 실패하면: Actions → **storybook-visual-baseline** 워크플로를 그 PR 브랜치에서 실행 → artifact의 스크린샷을 받아 커밋. 실패 diff는 `storybook-visual` artifact의 `visual-report`(HTML)에서 봅니다.

### 공유 (CI artifact)

CI가 매 PR·main 푸시에서 정적 빌드를 `storybook-static` artifact(보존 7일)로 올립니다. PR의 Checks → CI 실행 → Artifacts에서 받아 압축을 풀고 `npx http-server storybook-static`(또는 `python3 -m http.server`)으로 엽니다. 공개 호스팅은 하지 않습니다.

### 변경 후 검증

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npx --no-install storybook build --output-dir web-build/storybook
npx --no-install vitest run --project=storybook
```

`ci.yml`이 위에 더해 시각 회귀와 artifact 업로드까지 실행합니다. 통과가 브라우저 상호작용 확인을 대신하지 않으므로, 수정한 스토리를 열어 Controls·Actions·테마·언어 전환을 직접 확인합니다.

## 참고 문서

- [Storybook React Native Web + Vite 공식 문서](https://storybook.js.org/docs/get-started/frameworks/react-native-web-vite)
- [Expo SDK 55 레퍼런스](https://docs.expo.dev/versions/v55.0.0/)

# 디자인 컴포넌트 Storybook

앱에서 사용하는 React Native 컴포넌트를 브라우저에서 직접 렌더하는 디자인 카탈로그입니다.
색상·글꼴과 컴포넌트 상태를 바꾸면서 디자인을 검토하고, Controls와 Actions로 props와
콜백을 확인합니다. 구현은 `src/components/ui/`에서 가져오며, 스토리에 앱 UI를 복제하지 않습니다.

## 실행과 빌드

프로젝트 루트에서 실행합니다. CI와 같은 Node.js 22 환경을 권장합니다.

```bash
npm ci
npm run storybook
```

[로컬 Storybook](http://127.0.0.1:6006)을 엽니다. Expo 개발 서버와 별도로 실행되며,
스토리에 지정한 예시 데이터와 콜백으로 공용 컴포넌트를 확인합니다.

```bash
npm run build-storybook
```

정적 결과물은 `storybook-static/`에 생성됩니다. 빌드 명령은 파일 생성까지만 수행합니다.
호스팅이나 공개 배포는 별도 작업입니다.

## 카탈로그 사용법

왼쪽 목록의 **디자인 토큰**에서 색상·타이포그래피 등 공통 기준을 확인하고,
**컴포넌트**에서 버튼·입력 필드·배지·카드·토글 등의 상태별 예시를 선택합니다.

상단 도구 모음은 모든 스토리에 공통으로 적용됩니다.

| 항목 | 선택지                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 테마 | 포근(`cozy`), 라떼(`latte`), 시트러스 그로브(`citrus`), 파스텔 캔디(`pastel`), 인디고 타이드(`indigo`) |
| 화면 | 라이트, 다크                                                                                           |
| 글꼴 | 나눔스퀘어라운드, 프리텐다드, 주아 혼합, SUIT, 시스템 기본                                             |

테마와 글꼴 목록은 앱의 `THEME_OPTIONS`와 `FONT_OPTIONS`를 사용합니다. 폰트 파일은
저장소의 `assets/fonts/`에서 로딩하므로 외부 폰트 서비스가 필요 없습니다. 선택은
`BrandThemePreview` 하위 트리에 적용되며 앱의 저장된 테마 설정을 변경하지 않습니다.

- **Controls**: 문구·변형·비활성 여부 같은 props를 변경합니다.
- **Actions**: 버튼 누르기나 입력 변경으로 호출된 콜백과 인자를 확인합니다.
- **Docs**: 컴포넌트 설명, props, 상태별 스토리를 함께 확인합니다.

입력 필드·토글·곰 체크처럼 값이 바뀌는 스토리는 `useArgs()`로 화면과 Controls 값을
동기화합니다. 예를 들어 토글을 누르면 `value`가 함께 바뀌고 `fn()` 콜백은 Actions에 기록됩니다.

## 파일 구조

| 경로                                                  | 역할                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| [`.storybook/main.ts`](../.storybook/main.ts)         | React Native Web + Vite 프레임워크, 스토리 검색 경로, import 별칭 |
| [`.storybook/preview.tsx`](../.storybook/preview.tsx) | 공통 테마·밝기·글꼴 도구 모음과 캔버스 decorator                  |
| [`.storybook/fonts.css`](../.storybook/fonts.css)     | 앱 폰트의 웹 로딩                                                 |
| [`stories/foundations/`](../stories/foundations)      | 디자인 토큰 스토리                                                |
| [`stories/components/`](../stories/components)        | 실제 공용 컴포넌트의 상태별 스토리                                |
| [`src/constants/theme.ts`](../src/constants/theme.ts) | 앱과 Storybook이 공유하는 디자인 토큰                             |

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
플랫폼별 렌더링은 Dev 갤러리와 앱에서 확인합니다. 웹에서 보이는 결과만으로 iOS·Android
동작을 검증했다고 판단하지 않습니다.

변경 후에는 아래 검증을 실행합니다.

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build-storybook
```

[`ci.yml`](../.github/workflows/ci.yml)도 기존 네 가지 검사에 이어 Storybook 정적 빌드를
실행합니다. 정적 빌드 통과는 브라우저 상호작용이나 네이티브 동작 확인을 대신하지 않으므로,
수정한 스토리를 열어 Controls·Actions·테마 전환을 직접 확인합니다.

## 참고 문서

- [Storybook React Native Web + Vite 공식 문서](https://storybook.js.org/docs/get-started/frameworks/react-native-web-vite)
- [Expo SDK 55 레퍼런스](https://docs.expo.dev/versions/v55.0.0/)

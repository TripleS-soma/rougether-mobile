import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { IconButton } from '@/components/ui/icon-button';

const meta = {
  id: 'components-icon-button',
  title: '컴포넌트/아이콘 버튼',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '헤더와 도구 모음에 사용하는 원형 버튼입니다. 아이콘의 동작을 설명하는 accessibilityLabel을 함께 지정합니다.',
      },
    },
  },
  args: {
    name: 'back',
    accessibilityLabel: '뒤로 가기',
    variant: 'muted',
    size: 40,
    disabled: false,
    onPress: fn(),
  },
  argTypes: {
    name: { control: 'select', options: ['back', 'close', 'add', 'edit', 'bell', 'settings'] },
    accessibilityLabel: { control: 'text', description: '스크린 리더에 전달할 동작 설명' },
    variant: { control: 'inline-radio', options: ['muted', 'primary', 'ghost'] },
    size: { control: { type: 'range', min: 32, max: 64, step: 4 } },
    disabled: { control: 'boolean' },
    onPress: { control: false },
    style: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Muted: Story = { name: '기본' };

export const Primary: Story = {
  name: '강조',
  args: { name: 'add', accessibilityLabel: '루틴 추가', variant: 'primary' },
};

export const Ghost: Story = {
  name: '배경 없음',
  args: { name: 'close', accessibilityLabel: '닫기', variant: 'ghost' },
};

export const Disabled: Story = {
  name: '비활성',
  args: { name: 'edit', accessibilityLabel: '편집', disabled: true },
};

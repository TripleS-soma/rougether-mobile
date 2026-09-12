import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { Button } from '@/components/ui/button';

const meta = {
  id: 'components-button',
  title: '컴포넌트/버튼',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '저장·추가·삭제 같은 주요 동작에 사용하는 공용 버튼입니다. 눌러서 Actions에서 콜백을 확인할 수 있습니다.',
      },
    },
  },
  args: {
    label: '저장하기',
    variant: 'primary',
    disabled: false,
    onPress: fn(),
  },
  argTypes: {
    label: { control: 'text', description: '버튼에 표시할 문구' },
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'danger'] },
    disabled: { control: 'boolean' },
    leftIcon: {
      control: 'select',
      options: [undefined, 'add', 'check', 'edit', 'trash', 'gift', 'leaf'],
    },
    onPress: { control: false },
    style: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { name: '기본' };

export const Secondary: Story = {
  name: '보조 동작',
  args: { label: '다음에 할게요', variant: 'secondary' },
};

export const Danger: Story = {
  name: '삭제 동작',
  args: { label: '삭제하기', variant: 'danger', leftIcon: 'trash' },
};

export const WithIcon: Story = {
  name: '아이콘 포함',
  args: { label: '루틴 추가하기', leftIcon: 'add' },
};

export const Disabled: Story = {
  name: '비활성',
  args: { label: '저장하기', disabled: true },
};

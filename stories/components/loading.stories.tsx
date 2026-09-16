import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { Loading } from '@/components/ui/loading';

const meta = {
  id: 'components-loading',
  title: '컴포넌트/로딩',
  component: Loading,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '앱 공용 로딩 표시입니다. 기본 250ms 지연 뒤에 나타나 빠른 응답에서 깜빡이지 않습니다. 스토리는 지연 없이 보여 줍니다.',
      },
    },
  },
  args: { size: 'large', delayMs: 0, fill: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'large'] },
    delayMs: { control: { type: 'number', min: 0, step: 50 } },
    fill: { control: 'boolean' },
    style: { control: false, table: { disable: true } },
  },
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = { name: '큰 표시' };
export const Small: Story = { name: '작은 표시', args: { size: 'small' } };

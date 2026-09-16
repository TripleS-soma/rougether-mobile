import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn } from 'storybook/test';

import { RetryState } from '@/components/ui/retry-state';

const meta = {
  id: 'components-retry-state',
  title: '컴포넌트/불러오기 실패',
  component: RetryState,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '데이터를 불러오지 못했을 때의 공통 블록입니다. 다시 시도 버튼 문구를 생략하면 현재 언어의 기본 문구를 씁니다.',
      },
    },
  },
  args: { message: '루틴을 불러오지 못했어요.', onRetry: fn() },
  argTypes: {
    message: { control: 'text' },
    detail: { control: 'text' },
    retryLabel: { control: 'text' },
    onRetry: { control: false },
  },
} satisfies Meta<typeof RetryState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '기본',
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
export const WithDetail: Story = {
  name: '보조 설명',
  args: { message: '연결이 불안정해요', detail: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.' },
};
export const NoRetry: Story = { name: '버튼 없음', args: { onRetry: undefined } };

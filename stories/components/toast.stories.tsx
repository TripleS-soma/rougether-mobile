import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, screen } from 'storybook/test';

import { Button } from '@/components/ui/button';
import { ToastProvider, type ToastType, useToast } from '@/components/ui/toast';

function ToastDemo({ message, type }: { message: string; type: ToastType }) {
  const toast = useToast();
  return <Button label="토스트 띄우기" onPress={() => toast.show(message, type)} />;
}

function ToastPlayground({ message, type }: { message: string; type: ToastType }) {
  return (
    <ToastProvider>
      <View style={{ minHeight: 320, justifyContent: 'flex-start' }}>
        <ToastDemo message={message} type={type} />
      </View>
    </ToastProvider>
  );
}

const meta = {
  id: 'components-toast',
  title: '컴포넌트/토스트',
  component: ToastPlayground,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '앱 전역 일시 안내입니다. 루트의 ToastProvider 아래 어디서든 `useToast().show(message, type)`로 띄우고, 2.5초 뒤 내려갑니다. 버튼을 눌러 확인하세요.',
      },
    },
  },
  args: { message: '저장했어요', type: 'success' },
  argTypes: { type: { control: 'inline-radio', options: ['info', 'success', 'error'] } },
} satisfies Meta<typeof ToastPlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  name: '성공',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: '토스트 띄우기' }));
    await expect(await screen.findByText(args.message)).toBeVisible();
  },
};
export const Error: Story = {
  name: '오류',
  args: { message: '네트워크 연결을 확인해 주세요', type: 'error' },
};
export const Info: Story = { name: '안내', args: { message: '새 소식이 있어요', type: 'info' } };

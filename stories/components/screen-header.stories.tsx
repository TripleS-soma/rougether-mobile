import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';

import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';

const meta = {
  id: 'components-screen-header',
  title: '컴포넌트/화면 헤더',
  component: ScreenHeader,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '서브 화면 상단에 떠 있는 뒤로가기 원 + 제목 알약입니다. 레이아웃 높이가 없는 오버레이라 실제 화면은 헤더 높이만큼 상단 여백을 둡니다. 언어 도구로 영어 제목 길이를 확인하세요.',
      },
    },
  },
  args: { title: '알림', onBack: fn() },
  argTypes: {
    title: { control: 'text' },
    backLabel: { control: 'text' },
    onBack: { control: false },
    right: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    return (
      <View style={{ minHeight: 120 }}>
        <ScreenHeader {...args} />
      </View>
    );
  },
} satisfies Meta<typeof ScreenHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBack: Story = {
  name: '뒤로가기',
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button')[0]);
    await expect(args.onBack).toHaveBeenCalled();
  },
};
export const LongTitle: Story = {
  name: '긴 제목',
  args: { title: 'Notification settings and quiet hours' },
};
export const WithRight: Story = {
  name: '오른쪽 슬롯',
  args: { title: '뽑기 상점', right: <Pill label="1,250" /> },
};
export const NoBack: Story = { name: '뒤로가기 없음', args: { onBack: undefined } };

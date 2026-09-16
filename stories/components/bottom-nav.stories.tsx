import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';

import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';

const meta = {
  id: 'components-bottom-nav',
  title: '컴포넌트/하단 탭',
  component: BottomNav,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '방·달력·집·내 정보 네 탭의 떠 있는 하단 바입니다. 좁은 화면에서는 라벨을 함께 줄이고(하한 0.8배), 내 정보 탭에 미출석 점을 띄웁니다. 문지르기 제스처와 iOS 26 글래스는 기기에서 확인하세요.',
      },
    },
    canvasWidth: 480,
  },
  args: { active: 'myRoom', onChange: fn(), badges: {} },
  argTypes: {
    active: { control: 'inline-radio', options: ['myRoom', 'calendar', 'house', 'myPage'] },
    onChange: { control: false },
    badges: { control: 'object' },
  },
  render: function Render(args) {
    const [active, setActive] = useState<NavTab>(args.active);
    return (
      <View style={{ minHeight: 140, justifyContent: 'flex-end' }}>
        <BottomNav
          {...args}
          active={active}
          onChange={(tab) => {
            setActive(tab);
            args.onChange(tab);
          }}
        />
      </View>
    );
  },
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = {
  name: '방 탭',
  play: async ({ canvas, args, userEvent }) => {
    const tabs = canvas.queryAllByRole('tab');
    await userEvent.click((tabs.length ? tabs : canvas.getAllByRole('button'))[1]);
    await expect(args.onChange).toHaveBeenCalled();
  },
};
export const WithBadge: Story = {
  name: '내 정보 점',
  args: { active: 'house', badges: { myPage: true } },
};

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { expect, fn } from 'storybook/test';

import type { NavTab } from '@/components/ui/bottom-nav';
import { NavRail } from '@/components/ui/nav-rail';

const meta = {
  id: 'components-nav-rail',
  title: '컴포넌트/세로 탭 줄',
  component: NavRail,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '넓은 창(펼친 폴더블·태블릿·데스크톱 웹)에서 아래 탭 바를 대신하는 왼쪽 세로 줄입니다. 레이아웃에 자리를 차지하는 칸이라 탭 화면이 높이를 다 씁니다. 탭 목록·아이콘·미출석 점은 아래 탭 바와 같습니다.',
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
      <View style={{ height: 420, flexDirection: 'row' }}>
        <NavRail
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
} satisfies Meta<typeof NavRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Room: Story = {
  name: '방 탭',
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getAllByRole('button')[1]);
    await expect(args.onChange).toHaveBeenCalledWith('calendar');
  },
};
export const WithBadge: Story = {
  name: '내 정보 점',
  args: { active: 'house', badges: { myPage: true } },
};

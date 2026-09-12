import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';

const meta = {
  id: 'components-list-row',
  title: '컴포넌트/목록 행',
  component: ListRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '설정·내 정보에서 사용하는 메뉴 행입니다. 마지막 행은 last로 아래 구분선을 제거합니다.',
      },
    },
  },
  args: { icon: 'profile', label: '내 정보', last: false, onPress: fn() },
  argTypes: {
    icon: {
      control: 'select',
      options: ['profile', 'bell', 'palette', 'lock', 'help', 'bug', 'settings'],
    },
    label: { control: 'text' },
    last: { control: 'boolean', description: '목록의 마지막 행에서 아래 구분선 숨김' },
    onPress: { control: false },
  },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };

export const Last: Story = {
  name: '마지막 행',
  args: { icon: 'help', label: '도움말', last: true },
};

export const InCard: Story = {
  name: '설정 목록 조합',
  render: (args) => (
    <Card>
      <ListRow {...args} last={false} />
      <ListRow icon="bell" label="알림 설정" onPress={args.onPress} />
      <ListRow icon="palette" label="테마와 폰트" onPress={args.onPress} last />
    </Card>
  ),
};

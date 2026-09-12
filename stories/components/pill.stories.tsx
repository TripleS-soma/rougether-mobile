import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, View } from 'react-native';

import { Pill } from '@/components/ui/pill';
import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

const meta = {
  id: 'components-pill',
  title: '컴포넌트/정보 칩',
  component: Pill,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: '레벨·보유 재화·인원 수 같은 짧은 정보를 아이콘과 함께 표시합니다.',
      },
    },
  },
  args: { label: 'Lv. 7' },
  argTypes: {
    label: { control: 'text' },
    icon: { control: 'select', options: [undefined, 'coin', 'star', 'members', 'leaf', 'flame'] },
    background: { control: 'color' },
    color: { control: 'color' },
    style: { control: false, table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <View style={styles.row}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Pill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Level: Story = { name: '텍스트' };

export const Coins: Story = {
  name: '보유 코인',
  args: { label: '1,240', icon: 'coin' },
};

export const Members: Story = {
  name: '집 인원',
  args: { label: '4명', icon: 'members' },
};

export const Streak: Story = {
  name: '연속 달성',
  args: { label: '7일 연속', icon: 'flame' },
  render: function StreakPill(args) {
    const t = useTokens();
    return (
      <Pill
        {...args}
        background={args.background ?? t.warningSoft}
        color={args.color ?? t.warningText}
      />
    );
  },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
});

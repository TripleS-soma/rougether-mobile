import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

const meta = {
  id: 'components-badge',
  title: '컴포넌트/배지',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '소유·유형·상태를 짧게 표시하는 배지입니다. 기본 색상은 활성 브랜드 테마를 따릅니다.',
      },
    },
  },
  args: { label: 'MY' },
  argTypes: {
    label: { control: 'text' },
    background: { control: 'color', description: '지정하지 않으면 테마의 primary 사용' },
    color: { control: 'color', description: '지정하지 않으면 테마의 onPrimary 사용' },
  },
  decorators: [
    (Story) => (
      <View style={styles.row}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ownership: Story = { name: '소유 표시' };

export const Todo: Story = {
  name: '유형 표시',
  args: { label: '투두' },
};

export const Soft: Story = {
  name: '은은한 강조',
  args: { label: '진행 중' },
  render: function SoftBadge(args) {
    const t = useTokens();
    return (
      <Badge
        {...args}
        background={args.background ?? t.primarySoft}
        color={args.color ?? t.primaryText}
      />
    );
  },
};

export const Warning: Story = {
  name: '주의 표시',
  args: { label: '마감 임박' },
  render: function WarningBadge(args) {
    const t = useTokens();
    return (
      <Badge
        {...args}
        background={args.background ?? t.warningSoft}
        color={args.color ?? t.warningText}
      />
    );
  },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});

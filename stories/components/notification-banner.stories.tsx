import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { NotificationBanner } from '@/components/ui/notification-banner';

const meta = {
  title: '컴포넌트/알림 배너',
  component: NotificationBanner,
  args: {
    title: '주간회고가 도착했어요',
    body: '지난주 루틴을 돌아보고 이번 주 조정 제안을 확인해 보세요',
    type: 'WEEKLY_REPORT',
    visibleMs: 0,
    onPress: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof NotificationBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const HideThisWeek: Story = {
  args: { secondaryAction: { label: '이번 주 다시 보지 않기', onPress: fn() } },
};

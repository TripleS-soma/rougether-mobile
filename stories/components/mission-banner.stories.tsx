import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { MissionBanner } from '@/components/ui/mission-banner';

const meta = {
  id: 'components-mission-banner',
  title: '컴포넌트/미션 배너',
  component: MissionBanner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '온보딩 미션 진행 배너입니다. 탭하면 미션 화면으로 가고, 튜토리얼 다시 보기에서만 건너뛰기가 보입니다(확인 다이얼로그를 거칩니다).',
      },
    },
  },
  args: {
    stepIndex: 0,
    totalSteps: 4,
    label: '오늘 루틴 1개 완료하기',
    canSkip: false,
    onPress: fn(),
    onSkip: fn(),
  },
  argTypes: {
    stepIndex: { control: { type: 'number', min: 0, max: 3 } },
    totalSteps: { control: { type: 'number', min: 1 } },
    label: { control: 'text' },
    canSkip: { control: 'boolean' },
    onPress: { control: false },
    onSkip: { control: false },
  },
} satisfies Meta<typeof MissionBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = { name: '첫 미션' };
export const WithSkip: Story = {
  name: '건너뛰기 노출',
  args: { stepIndex: 2, label: '방 꾸미기', canSkip: true },
};

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';

import { WalletPills } from '@/components/ui/wallet-pills';

const meta = {
  id: 'components-wallet-pills',
  title: '컴포넌트/재화 알약',
  component: WalletPills,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '코인·다이아 잔액 표시입니다. 네 자리를 넘으면 9999+로 줄이고, 탭하면 재화 내역을 엽니다. 좁은 헤더에서는 compact로 코인만 보입니다.',
      },
    },
  },
  args: { coin: 1250, diamond: 30, compact: false, onOpenHistory: fn() },
  argTypes: {
    coin: { control: { type: 'number', min: 0 } },
    diamond: { control: { type: 'number', min: 0 } },
    compact: { control: 'boolean' },
    onOpenHistory: { control: false },
  },
} satisfies Meta<typeof WalletPills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
export const Capped: Story = { name: '상한 표기 (9999+)', args: { coin: 65034, diamond: 101205 } };
export const Compact: Story = { name: '좁은 헤더', args: { compact: true } };
export const Zero: Story = { name: '잔액 없음', args: { coin: 0, diamond: 0 } };

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn, screen } from 'storybook/test';
import { SettingsScreen } from '@/components/screens/settings-screen';

const meta = {
  id: 'screens-settings-withdrawal',
  title: '화면/설정/탈퇴 사유',
  component: SettingsScreen,
  args: { onWithdraw: fn() },
} satisfies Meta<typeof SettingsScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OptionalReason: Story = {
  name: '사유를 고르거나 건너뛰기',
  play: async ({ args, userEvent }) => {
    await userEvent.click(await screen.findByRole('button', { name: '회원탈퇴' }));
    await screen.findByRole('dialog');
    const option = await screen.findByRole('radio', { name: '사용이 불편해요' });
    await userEvent.click(option);
    await expect(option).toHaveAttribute('aria-checked', 'true');
    await expect(args.onWithdraw).not.toHaveBeenCalled();
  },
};

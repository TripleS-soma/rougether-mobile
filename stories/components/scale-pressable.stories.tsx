import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, Text } from 'react-native';
import { expect, fn } from 'storybook/test';

import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const meta = {
  id: 'components-scale-pressable',
  title: '컴포넌트/눌림 스케일',
  component: ScalePressable,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '누르는 동안 살짝 작아지는 공용 Pressable입니다. 스케일은 transform이라 레이아웃이 흔들리지 않습니다.',
      },
    },
  },
  args: {
    pressScale: 0.96,
    onPress: fn(),
    accessibilityRole: 'button',
    accessibilityLabel: '눌러 보기',
  },
  argTypes: {
    pressScale: { control: { type: 'range', min: 0.8, max: 1, step: 0.01 } },
    onPress: { control: false },
    style: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    const t = useTokens();
    const Typography = useTypography();
    return (
      <ScalePressable
        {...args}
        style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[Typography.label, { color: t.text }]}>길게 눌러 보세요</Text>
      </ScalePressable>
    );
  },
} satisfies Meta<typeof ScalePressable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '기본',
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '눌러 보기' }));
    await expect(args.onPress).toHaveBeenCalled();
  },
};
export const Strong: Story = { name: '강한 눌림', args: { pressScale: 0.88 } };

const styles = StyleSheet.create({
  box: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});

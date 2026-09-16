import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { WheelPicker, type WheelItem } from '@/components/ui/wheel-picker';

const HOURS: WheelItem<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
  accessibilityLabel: `${i + 1}시`,
}));

const meta = {
  id: 'components-wheel-picker',
  title: '컴포넌트/휠 피커',
  component: WheelPicker<number>,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '44px 줄에 맞춰 멈추는 세로 휠입니다. 스와이프하거나 줄을 탭해 고릅니다. 가운데 선택 띠는 부모가 그립니다.',
      },
    },
  },
  args: { items: HOURS, value: 7, accessibilityLabel: '시 선택', onChange: fn() },
  argTypes: {
    items: { control: false },
    onChange: { control: false },
    testID: { table: { disable: true } },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <WheelPicker
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    );
  },
} satisfies Meta<typeof WheelPicker<number>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hours: Story = { name: '시 선택' };

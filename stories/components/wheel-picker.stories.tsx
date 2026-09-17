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
    // nested-interactive 예외(웹 한정): 휠은 네이티브 adjustable(스크린리더 증감 동작) 안에 탭할 수 있는
    // 줄을 둔다. 네이티브는 부모가 accessible이라 줄들이 하나로 합쳐져 중첩이 없지만, RN Web은 줄 버튼을
    // 따로 포커스 가능하게 내보내 axe가 중첩으로 본다. 줄을 비활성화하면 마우스·터치 선택이 사라진다.
    // 전역 규칙 목록을 덮어쓰므로 color-contrast 제외(#1389 잔여)도 함께 적는다.
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: false },
          { id: 'nested-interactive', enabled: false },
        ],
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

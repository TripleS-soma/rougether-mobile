import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { Calendar } from '@/components/ui/calendar';

// 고정 날짜 — 실행 날짜에 따라 스토리·시각 회귀 결과가 바뀌지 않게.
const TODAY = '2026-09-16';

const meta = {
  id: 'components-calendar',
  title: '컴포넌트/달력',
  component: Calendar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '월 달력입니다. 오늘에서 벗어나면 헤더에 "오늘" 칩이 생기고, markedDates에 점을, progressByDate로 달성도를 표시합니다. 데이터는 부모가 넘기고 달력은 패칭하지 않습니다.',
      },
    },
  },
  args: {
    value: TODAY,
    today: TODAY,
    onSelect: fn(),
    onVisibleMonthChange: fn(),
    markedDates: new Set(['2026-09-08', '2026-09-09', '2026-09-21']),
  },
  argTypes: {
    value: { control: 'text' },
    today: { control: 'text' },
    min: { control: 'text' },
    max: { control: 'text' },
    monthSwipe: { control: 'boolean' },
    glass: { control: 'boolean' },
    onSelect: { control: false },
    onVisibleMonthChange: { control: false },
    markedDates: { control: false },
    progressByDate: { control: false },
    headerAccessory: { control: false, table: { disable: true } },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <Calendar
        {...args}
        value={value}
        onSelect={(date, source) => {
          setValue(date);
          args.onSelect(date, source);
        }}
      />
    );
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month: Story = { name: '월 달력' };
export const OffToday: Story = { name: '다른 날 선택(오늘 칩)', args: { value: '2026-09-02' } };
export const Bounded: Story = {
  name: '선택 범위 제한',
  args: { min: '2026-09-10', max: '2026-09-25', markedDates: undefined },
};

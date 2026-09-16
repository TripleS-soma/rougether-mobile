import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { SheetHandle } from '@/components/ui/sheet-handle';

const meta = {
  id: 'components-sheet-handle',
  title: '컴포넌트/시트 손잡이',
  component: SheetHandle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: '바텀시트 상단의 끌어내리기 손잡이입니다. 장식 요소라 스크린 리더에서 숨깁니다.',
      },
    },
  },
} satisfies Meta<typeof SheetHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };

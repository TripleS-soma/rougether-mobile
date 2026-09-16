import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { PendingNotice } from '@/components/ui/pending-notice';

const meta = {
  id: 'components-pending-notice',
  title: '컴포넌트/서버 준비 중 안내',
  component: PendingNotice,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '서버 엔드포인트가 아직 없는 기능을 화면에서 정직하게 알리는 경고 배너입니다(AGENTS 미연동 API 규칙).',
      },
    },
  },
  args: { text: '서버 준비 중이에요. 곧 사용할 수 있어요.' },
  argTypes: { text: { control: 'text' }, style: { control: false, table: { disable: true } } },
} satisfies Meta<typeof PendingNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
export const Long: Story = {
  name: '긴 문구',
  args: {
    text: '집 탐색 필터는 서버 준비 중이에요. 지금은 전체 목록만 볼 수 있고, 가입 여부로 거르는 기능은 다음 업데이트에서 열려요.',
  },
};

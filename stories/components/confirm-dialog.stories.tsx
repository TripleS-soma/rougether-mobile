import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn, screen } from 'storybook/test';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const meta = {
  id: 'components-confirm-dialog',
  title: '컴포넌트/확인 다이얼로그',
  component: ConfirmDialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '[취소 | 확정] 두 버튼의 공용 확인 창입니다. 삭제·로그아웃처럼 되돌리기 어려운 동작은 destructive로 위험 색을 씁니다. Modal이라 Docs 페이지보다 개별 스토리에서 확인하세요.',
      },
      story: { inline: false, height: '420px' },
    },
  },
  args: {
    visible: true,
    title: '루틴을 삭제할까요?',
    body: '지난 완료 기록도 함께 사라져요.',
    confirmLabel: '삭제',
    cancelLabel: '취소',
    destructive: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
  argTypes: {
    visible: { control: 'boolean' },
    destructive: { control: 'boolean' },
    onConfirm: { control: false },
    onCancel: { control: false },
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * RN Web Modal은 페이드 애니메이션이 끝나 onShow가 불린 뒤에야 `role="dialog"`를 붙인다 — 그 전엔
 * `aria-modal`만 있는 div라 접근성 검사가 aria-allowed-attr로 실패한다(실제 화면엔 곧 붙는 과도 상태).
 * 검사가 열린 상태를 보도록 다이얼로그 역할이 붙을 때까지 기다린다.
 */
const waitForDialog = () => screen.findByRole('dialog', undefined, { timeout: 3000 });

export const Destructive: Story = {
  name: '위험 동작',
  play: async ({ args, userEvent }) => {
    await waitForDialog();
    // Modal은 캔버스 밖(body)에 붙으므로 screen으로 찾는다.
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};
export const Neutral: Story = {
  name: '일반 확인',
  args: {
    title: '로그아웃할까요?',
    body: '다시 로그인하면 이어서 쓸 수 있어요.',
    confirmLabel: '로그아웃',
    destructive: false,
  },
  play: async () => {
    await waitForDialog();
  },
};
export const ConfirmOnly: Story = {
  name: '안내형(확인만)',
  args: {
    title: '저장했어요',
    body: '방 꾸미기가 적용됐어요.',
    confirmLabel: '확인',
    cancelLabel: null,
    destructive: false,
  },
  play: async () => {
    await waitForDialog();
  },
};

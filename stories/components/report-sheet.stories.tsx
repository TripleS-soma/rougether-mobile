import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn, screen } from 'storybook/test';

import { ReportSheet } from '@/components/ui/report-sheet';

const meta = {
  id: 'components-report-sheet',
  title: '컴포넌트/신고 시트',
  component: ReportSheet,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '피드 게시물·댓글과 거래소 가구를 신고하는 바텀시트입니다(#1428, App Store 1.2). 사유 7종 중 하나를 골라야 신고하기가 켜지고, 설명은 선택(최대 500자)입니다. 열릴 때마다 입력을 비웁니다. Modal이라 Docs 페이지보다 개별 스토리에서 확인하세요.',
      },
      story: { inline: false, height: '720px' },
    },
  },
  args: {
    visible: true,
    targetLabel: '게시물',
    submitting: false,
    onSubmit: fn(),
    onClose: fn(),
  },
  argTypes: {
    visible: { control: 'boolean' },
    submitting: { control: 'boolean' },
    targetLabel: { control: 'text' },
    onSubmit: { control: false },
    onClose: { control: false },
  },
} satisfies Meta<typeof ReportSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickReason: Story = {
  name: '사유 고르고 신고',
  play: async ({ args, userEvent }) => {
    // 시트는 Modal이라 캔버스 밖(body)에 붙는다 — screen으로 찾는다.
    await userEvent.click(await screen.findByRole('radio', { name: '욕설·괴롭힘' }));
    await userEvent.click(await screen.findByRole('button', { name: '신고하기' }));
    await expect(args.onSubmit).toHaveBeenCalledWith('ABUSE', undefined);
  },
};

export const Comment: Story = {
  name: '댓글 신고',
  args: { targetLabel: '댓글' },
};

export const Submitting: Story = {
  name: '보내는 중',
  args: { submitting: true },
};

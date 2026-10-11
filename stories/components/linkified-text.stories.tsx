import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn, screen } from 'storybook/test';

import { LinkifiedText } from '@/components/ui/linkified-text';

const meta = {
  id: 'components-linkified-text',
  title: '컴포넌트/링크 인식 글',
  component: LinkifiedText,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '본문 속 http(s)://·www. 주소를 밑줄 링크로 그립니다(채팅 말풍선·피드 글·댓글, #1507). 링크를 누르면 도메인을 보여 주는 확인 창을 거쳐 앱 안 브라우저로 엽니다. 문장 끝 구두점은 주소에서 뺍니다.',
      },
      story: { inline: false, height: '420px' },
    },
  },
  args: {
    children: '이 영상 봐요 https://www.youtube.com/watch?v=abc. 그리고 www.rougether.com 도!',
    openLink: fn(),
  },
  argTypes: { openLink: { control: false } },
} satisfies Meta<typeof LinkifiedText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLinks: Story = {
  name: '링크 두 개',
  play: async ({ args, userEvent, canvas }) => {
    await userEvent.click(await canvas.findByRole('link', { name: '링크 www.rougether.com' }));
    // 확인 창(Modal)은 캔버스 밖(body)에 붙으므로 screen으로 찾는다.
    await screen.findByRole('dialog', undefined, { timeout: 3000 });
    await userEvent.click(await screen.findByRole('button', { name: '열기' }));
    await expect(args.openLink).toHaveBeenCalledWith('https://www.rougether.com');
  },
};

export const PlainText: Story = {
  name: '링크 없음',
  args: { children: '오늘도 루틴 완료! 다들 화이팅' },
};

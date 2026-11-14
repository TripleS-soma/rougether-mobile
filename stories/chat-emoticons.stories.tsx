import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';

import { ChatEmoticonsPreview } from '@/dev/chat-emoticons-preview';

const meta = {
  id: 'house-chat-emoticons',
  title: '화면/집 채팅/루양이 이모티콘',
  component: ChatEmoticonsPreview,
  parameters: { layout: 'fullscreen', canvasWidth: '100%' },
  render: () => (
    <View style={{ height: 700 }}>
      <ChatEmoticonsPreview />
    </View>
  ),
} satisfies Meta<typeof ChatEmoticonsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = { name: '선택하고 보내기, 로컬 미리보기' };

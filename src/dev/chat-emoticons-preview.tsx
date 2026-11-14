import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HouseChatScreen, type ChatMessageView } from '@/components/screens/house-chat-screen';
import type { ChatPhotoDraft } from '@/lib/pick-chat-photo';
import type { ChatEmoticonKey } from '@/resources/chat-emoticons';

/** Interactive local fixture: never opens a socket or sends an API request. */
export function ChatEmoticonsPreview() {
  const [messages, setMessages] = useState<ChatMessageView[]>([
    { key: 's1', messageId: 1, sequence: 1, senderUserId: 2, senderNickname: '이웃', content: '오늘 루틴 완료했어요!', createdAt: '2026-11-14T13:00:00Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    { key: 's2', messageId: 2, sequence: 2, senderUserId: 2, senderNickname: '이웃', content: '이모티콘을 보냈어요', messageType: 'EMOTICON', emoticonKey: 'ruyang_done', createdAt: '2026-11-14T13:00:05Z', unreadCount: 0, status: 'sent' }, // prettier-ignore
    { key: 's3', messageId: 3, sequence: 3, senderUserId: 1, content: '수고했어요! 내일도 같이 해요', createdAt: '2026-11-14T13:01:00Z', unreadCount: 1, status: 'sent' }, // prettier-ignore
  ]);
  const [photos, setPhotos] = useState<ChatPhotoDraft[]>([]);
  const append = (content: string, emoticonKey?: ChatEmoticonKey) => {
    setMessages((prev) => {
      const id = prev.length + 1;
      return [
        ...prev,
        {
          key: `s${id}`,
          messageId: id,
          sequence: id,
          senderUserId: 1,
          content,
          caption: emoticonKey && content ? content : undefined,
          emoticonKey,
          messageType: emoticonKey ? 'EMOTICON' : 'TEXT',
          createdAt: '2026-11-14T13:02:00Z',
          unreadCount: 1,
          status: 'sent',
        },
      ];
    });
  };
  return (
    <View style={styles.screen}>
      <HouseChatScreen
        messages={messages}
        myUserId={1}
        houseName="루양이네 집"
        onSend={(text) => {
          append(text);
          setPhotos([]);
        }}
        onSendEmoticon={(key, text) => append(text, key)}
        photos={photos}
        onPickPhoto={() =>
          setPhotos([
            {
              uri: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%2387a88c"/%3E%3C/svg%3E',
              name: 'preview.svg',
              type: 'image/svg+xml',
            },
          ])
        }
        onRemovePhoto={(at) => setPhotos((prev) => prev.filter((_, i) => i !== at))}
        onReact={() => {}}
        onReport={() => {}}
        onCopy={() => {}}
        onBack={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, alignSelf: 'stretch' } });

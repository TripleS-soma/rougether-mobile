import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ChatEmoticonLayout, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { chatEmoticonOf, type ChatEmoticonKey } from '@/resources/chat-emoticons';

/** 대화 영역 안에서 입력창 위에 겹쳐 뜨는 전송 전 미리보기. 목록 높이는 바꾸지 않음. */
export function ChatEmoticonPreview({
  selected,
  onCancel,
}: {
  selected: ChatEmoticonKey;
  onCancel: () => void;
}) {
  const t = useTokens();
  const tr = useT();
  const emoticon = chatEmoticonOf(selected);
  if (!emoticon) return null;
  return (
    <View pointerEvents="box-none" style={styles.anchor} testID="chat-emoticon-preview">
      <View style={[styles.card, { backgroundColor: withAlpha(t.surface, 'A6') }]}>
        <Image
          source={emoticon.source}
          resizeMode="contain"
          style={styles.image}
          accessibilityLabel={tr('house.chat.emoticons.preview', {
            name: tr(`house.chat.emoticons.labels.${emoticon.labelKey}`),
          })}
        />
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={tr('house.chat.emoticons.cancel')}
          style={styles.close}>
          <Icon name="close" size={18} color={t.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', bottom: Spacing.two, left: 0, right: 0, alignItems: 'center' },
  card: {
    width: ChatEmoticonLayout.previewCard,
    padding: Spacing.three,
    borderRadius: Radius.xl,
    alignItems: 'center',
  },
  image: { width: ChatEmoticonLayout.preview, height: ChatEmoticonLayout.preview },
  close: { position: 'absolute', top: 0, right: 0, padding: Spacing.three },
});

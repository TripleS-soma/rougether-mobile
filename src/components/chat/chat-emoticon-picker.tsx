import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pressedStyle } from '@/components/ui/press-feedback';
import { ChatEmoticonLayout, Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { CHAT_EMOTICONS, type ChatEmoticonKey } from '@/resources/chat-emoticons';

export function ChatEmoticonPicker({
  selected,
  onSelect,
  bottomInset,
}: {
  selected?: ChatEmoticonKey;
  onSelect: (key: ChatEmoticonKey) => void;
  bottomInset: number;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <View
      testID="chat-emoticon-picker"
      style={[styles.panel, { borderTopColor: t.border, paddingBottom: bottomInset }]}>
      <View style={styles.heading}>
        <Image source={CHAT_EMOTICONS[0].source} style={styles.packIcon} resizeMode="contain" />
        <Text style={[Typography.label, { color: t.text }]}>{tr('house.chat.emoticons.pack')}</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="always" style={styles.scroll}>
        <View style={styles.grid}>
          {CHAT_EMOTICONS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={tr('house.chat.emoticons.choose', {
                name: tr(`house.chat.emoticons.labels.${item.labelKey}`),
              })}
              accessibilityState={{ selected: selected === item.key }}
              onPress={() => onSelect(item.key)}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: selected === item.key ? t.surfaceMuted : undefined },
                pressed && pressedStyle('dim', t),
              ]}>
              <Image source={item.source} style={styles.image} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.two },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.one },
  packIcon: { width: ChatEmoticonLayout.packIcon, height: ChatEmoticonLayout.packIcon },
  scroll: { maxHeight: ChatEmoticonLayout.pickerMaxHeight },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', aspectRatio: 1, padding: Spacing.one, borderRadius: Radius.md },
  image: { width: '100%', height: '100%' },
});

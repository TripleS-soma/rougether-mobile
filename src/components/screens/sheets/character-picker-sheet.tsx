import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OwnedCharacterGrid, type OwnedCharacter } from '@/components/member/owned-character-grid';
import { BottomSheet, SheetDragExclude } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { pressedStyle } from '@/components/ui/press-feedback';

export type { OwnedCharacter } from '@/components/member/owned-character-grid';

export type CharacterPickerSheetProps = {
  visible: boolean;
  /** Owned characters, master order. Empty = still loading / none owned. */
  characters: OwnedCharacter[];
  /** Wear the tapped character (already-selected taps are ignored upstream). */
  onSelect: (serverId: number) => void;
  onClose: () => void;
};

/**
 * "캐릭터 교체" bottom sheet: the owned-character grid from GET /me/characters.
 * Tapping an unworn character calls onSelect (PUT …/select) and closes.
 * The app opens the full-screen chooser from profile edit; this sheet remains for existing previews.
 */
export function CharacterPickerSheet({
  visible,
  characters,
  onSelect,
  onClose,
}: CharacterPickerSheetProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <View style={[styles.head, { borderBottomColor: t.border }]}>
        <Text style={[Typography.h3, { color: t.text }]}>{tr('app.characterPicker.title')}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('app.characterPicker.close')}
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: t.surfaceMuted },
            pressed && pressedStyle('dim', t),
          ]}>
          <Icon name="close" size={16} color={t.text} />
        </Pressable>
      </View>

      <SheetDragExclude>
        <ScrollView contentContainerStyle={styles.body}>
          <OwnedCharacterGrid
            characters={characters}
            onSelect={(id) => {
              if (!characters.find((c) => c.serverId === id)?.selected) onSelect(id);
              onClose();
            }}
          />
        </ScrollView>
      </SheetDragExclude>
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderCurve: 'continuous',
    maxHeight: '92%',
    paddingBottom: Spacing.four,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.four },
});

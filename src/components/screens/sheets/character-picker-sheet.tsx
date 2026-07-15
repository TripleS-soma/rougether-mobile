import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { Icon } from '@/components/ui/icon';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

/** One owned character (server GET /me/characters), mapped to local sprite art. */
export type OwnedCharacter = {
  /** Server character id — the PUT /me/characters/select payload. */
  serverId: number;
  id: CharacterId;
  name: string;
  /** Currently worn (exactly one per account). */
  selected: boolean;
};

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
 * Tapping an unworn character calls onSelect (PUT …/select) and closes; new
 * characters come only from onboarding's free pick or the character gacha.
 */
export function CharacterPickerSheet({
  visible,
  characters,
  onSelect,
  onClose,
}: CharacterPickerSheetProps) {
  const t = useTokens();
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.screen }]}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[Typography.h3, { color: t.text }]}>캐릭터 교체</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={[styles.close, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="close" size={16} color={t.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {characters.length === 0 ? (
            <Text style={[Typography.supporting, styles.empty, { color: t.textMuted }]}>
              보유한 캐릭터가 없어요. 뽑기 상점에서 새 친구를 만나보세요!
            </Text>
          ) : (
            <View style={styles.grid}>
              {characters.map((c) => {
                const meta = CHARACTER_OPTIONS.find((o) => o.id === c.id);
                return (
                  <Pressable
                    key={c.serverId}
                    onPress={() => {
                      if (!c.selected) onSelect(c.serverId);
                      onClose();
                    }}
                    accessibilityRole="button"
                    // The avatar art inside already carries the bare name label.
                    accessibilityLabel={`${c.name} 착용`}
                    accessibilityState={{ selected: c.selected }}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: t.surface,
                        borderColor: c.selected ? t.primary : 'transparent',
                      },
                    ]}>
                    <View style={[styles.avatar, { backgroundColor: meta?.bg ?? t.surfaceMuted }]}>
                      <CharacterAvatar characterId={c.id} size={56} />
                    </View>
                    <Text style={[Typography.label, { color: t.text }]}>{c.name}</Text>
                    {c.selected ? (
                      <View style={[styles.badge, { backgroundColor: t.primary }]}>
                        <Icon name="check" size={10} color={t.onPrimary} />
                        <Text style={[styles.badgeText, { color: t.onPrimary }]}>착용 중</Text>
                      </View>
                    ) : (
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>
                        {meta?.description ?? ''}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.four,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

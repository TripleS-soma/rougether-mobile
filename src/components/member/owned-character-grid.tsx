import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { Icon } from '@/components/ui/icon';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import { useT } from '@/i18n';
import { pressedStyle } from '@/components/ui/press-feedback';

/** One owned character (server GET /me/characters). */
export type OwnedCharacter = {
  /** Server character id — the PUT /me/characters/select payload. */
  serverId: number;
  id: CharacterId;
  name: string;
  /** CDN art key (baseAssetKey); local sprite fallback when absent/invalid. */
  assetKey?: string;
  /** 탭 순환 프레임 (#735) — 서버 poses[] 순서, 없으면 레거시 animations에서. */
  frames?: string[];
  /** Currently worn (exactly one per account). */
  selected: boolean;
};

/** 보유 캐릭터만 표시한다. 빈 칸도 같은 열을 차지해 마지막 카드가 늘어나지 않는다. */
export function OwnedCharacterGrid({
  characters,
  onSelect,
}: {
  characters: OwnedCharacter[];
  onSelect: (serverId: number) => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const rows = Array.from({ length: Math.ceil(characters.length / 3) }, (_, index) =>
    characters.slice(index * 3, index * 3 + 3),
  );
  if (characters.length === 0)
    return (
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('app.characterPicker.empty')}
      </Text>
    );
  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((c) => {
            const meta = CHARACTER_OPTIONS.find((o) => o.id === c.id);
            return (
              <View key={c.serverId} style={styles.slot}>
                <Pressable
                  onPress={() => {
                    onSelect(c.serverId);
                  }}
                  accessibilityRole="button"
                  // The avatar art inside already carries the bare name label.
                  accessibilityLabel={tr('app.characterPicker.wearA11y', { name: c.name })}
                  accessibilityState={{ selected: c.selected }}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      backgroundColor: t.surface,
                      borderColor: c.selected ? t.primary : 'transparent',
                    },
                    pressed && pressedStyle('card', t),
                  ]}>
                  <View style={[styles.avatar, { backgroundColor: meta?.bg ?? t.surfaceMuted }]}>
                    {/* Server CDN art first; the bundled sprite is the fallback. */}
                    {isCdnKey(c.assetKey) ? (
                      <Image
                        source={assetSource(c.assetKey)}
                        style={styles.cdnArt}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        accessibilityLabel={c.name}
                        testID="cdn-art"
                      />
                    ) : (
                      <CharacterAvatar characterId={c.id} size={56} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={[Typography.label, { color: t.text }]}>
                    {c.name}
                  </Text>
                  {/* 이름과 착용 표시만 — 종마다 붙던 한 줄 소개는 뺐다(11/9). */}
                  <View style={styles.badgeSlot}>
                    {c.selected ? (
                      <View style={[styles.badge, { backgroundColor: t.primary }]}>
                        <Icon name="check" size={10} color={t.onPrimary} />
                        <Text
                          style={[Typography.caption, emph('semibold'), { color: t.onPrimary }]}>
                          {tr('app.characterPicker.wearing')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
          {Array.from({ length: 3 - row.length }, (_, index) => (
            <View key={`empty-${index}`} style={styles.slot} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'stretch' },
  slot: { flex: 1, minWidth: 0 },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cdnArt: { width: 56, height: 56 },
  badgeSlot: { height: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
  },
});

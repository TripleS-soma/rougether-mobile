import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DrawResult, GachaDrawCount } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import type { Rarity } from '@/resources/furniture';

/** Local fixtures only: previewing never calls the draw API or spends coins. */
export function previewRewards(
  count: GachaDrawCount,
  rarity: Rarity,
  character: boolean,
): DrawResult[] {
  return Array.from({ length: count }, (_, i) => ({
    ...(character ? { characterId: i + 1 } : { itemId: i + 1 }),
    assetKey:
      i === 0
        ? character
          ? ROOM_RENDER_CONTRACT.referenceFixture.character.animations.idle
          : ROOM_RENDER_CONTRACT.referenceFixture.furniture.assetKey
        : undefined,
    name: character
      ? ['고양이', '강아지', '판다', '곰', '수달', '양'][i]
      : ['바다 창문', '별빛 선반', '포근한 의자', '작은 화분', '구름 러그', '달빛 창문'][i],
    rarity: character ? undefined : i === 0 ? rarity : i % 2 ? '일반' : '희귀',
    converted: i === 3,
    refundCurrencyType: character ? 'COIN' : 'DIAMOND',
    refundAmount: character ? 100 : 3,
  }));
}

export function GachaPreview({ machines }: { machines: GachaMachine[] }) {
  const t = useTokens();
  const Typography = useTypography();
  const [rarity, setRarity] = useState<Rarity>('전설');
  return (
    <View style={styles.root}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        연출 미리보기 · 실제 재화는 사용하지 않아요
      </Text>
      <View style={styles.options}>
        {(['일반', '희귀', '전설'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setRarity(value)}
            accessibilityRole="button"
            accessibilityLabel={`${value} 연출`}
            accessibilityState={{ selected: value === rarity }}
            style={[styles.option, { backgroundColor: value === rarity ? t.primary : t.surface }]}>
            <Text style={[Typography.label, { color: value === rarity ? t.onPrimary : t.text }]}>
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.screen}>
        <GachaScreen
          gachas={machines}
          coinBalance={5600}
          onDraw={async (id, count) =>
            previewRewards(count, rarity, machines.find((m) => m.id === id)?.kind === 'character')
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: Spacing.two },
  options: { flexDirection: 'row', gap: Spacing.two },
  option: { padding: Spacing.two, borderRadius: Radius.pill },
  screen: { height: 700 },
});

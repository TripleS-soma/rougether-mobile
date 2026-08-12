import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';

export type RewardRowProps = {
  /** 목록 행 식별자 — 테스트가 잡는 testID의 꼬리. */
  rowId: string | number;
  name?: string;
  /** 등급 색 — 폴백 아이콘 색. */
  rarityColor: string;
  /** CDN 실아트 키. 없거나 더미면 기프트 아이콘으로 폴백. */
  assetKey?: string;
  /** 캐릭터 보상이면 오른쪽에 '캐릭터' 라벨. */
  isCharacter: boolean;
  owned?: boolean;
};

/**
 * 보상 목록 한 줄 (#620, #773에서 memo 컴포넌트로 분리).
 * SectionList의 `renderItem`이 매 스크롤 프레임 불리므로, 행이 가벼워야 한다.
 */
function RewardRowBase({ rowId, name, rarityColor, assetKey, isCharacter, owned }: RewardRowProps) {
  const t = useTokens();
  const Typography = useTypography();

  return (
    <View style={[styles.rewardRow, { backgroundColor: t.surface }]} testID={`reward-row-${rowId}`}>
      {/* 아이템 썸네일 (#721) — 결과 공개 카드와 같은 패턴: CDN 실아트가
          있으면 이미지, 없으면 기프트 폴백. */}
      <View style={[styles.rewardThumb, { backgroundColor: t.surfaceMuted }]}>
        {isCdnKey(assetKey) ? (
          <Image
            source={assetSource(assetKey)}
            style={styles.rewardThumbImg}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={String(rowId)}
            transition={120}
          />
        ) : (
          <Icon name="gift" size={18} color={rarityColor} />
        )}
      </View>
      <Text numberOfLines={1} style={[Typography.body, styles.rewardName, { color: t.text }]}>
        {name ?? '이름 없는 보상'}
      </Text>
      {isCharacter ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>캐릭터</Text>
      ) : null}
      {owned ? (
        <View style={[styles.ownedPill, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>보유</Text>
        </View>
      ) : null}
    </View>
  );
}

export const RewardRow = memo(RewardRowBase);

const styles = StyleSheet.create({
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rewardThumb: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rewardThumbImg: {
    width: '100%',
    height: '100%',
  },
  rewardName: {
    flex: 1,
  },
  ownedPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
});

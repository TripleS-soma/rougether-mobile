import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import type { FeedMinigameRecord } from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { getMinigameDefinition } from '@/constants/minigames';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { i18n, useT } from '@/i18n';

/** 게임 아이콘 자리 — 목록 카드의 캐릭터 아바타(`minigames-screen`)와 같은 크기. */
const AVATAR_SIZE = Spacing.six;
/** 이 앱 버전이 모르는 게임(나중에 생긴 게임)의 기본 포즈. */
const FALLBACK_POSE = 1;

/** 게임 이름 — 카탈로그(`MINIGAME_DEFINITIONS`)에 없는 게임은 "미니게임". */
export function feedRecordGameName(gameCode: string): string {
  return getMinigameDefinition(gameCode)?.name ?? i18n.t('feed.record.unknownGame');
}

/**
 * 기록 글의 본문 초안 — "🐱 고양이 탑 쌓기 1,240점, 전체 3위 달성!". 카드를 그리지 못하는 옛
 * 앱 버전은 본문만 보이므로 숫자를 본문에도 담는다. 내 점수·내 순위만(다른 사람 이름 없음).
 */
export function feedRecordDraftText(
  record: Pick<FeedMinigameRecord, 'gameCode' | 'score' | 'rank'>,
) {
  const params = {
    game: feedRecordGameName(record.gameCode),
    score: record.score.toLocaleString(),
  };
  return record.rank != null
    ? i18n.t('feed.record.draftWithRank', { ...params, rank: record.rank.toLocaleString() })
    : i18n.t('feed.record.draft', params);
}

export type FeedMinigameRecordCardProps = {
  record: FeedMinigameRecord;
  /** [나도 도전하기] — 그 게임 화면을 바로 연다. 없거나 모르는 게임이면 버튼이 없다. */
  onChallenge?: (gameCode: string) => void;
  /** 작성 화면의 카드 빼기(✕). 없으면 버튼이 없다. */
  onRemove?: () => void;
  removeDisabled?: boolean;
  testID?: string;
};

/**
 * 미니게임 기록 카드 (서버 feat/feed-minigame-record) — 게임 아이콘·이름, 큰 점수, "전체 N위"
 * (순위 없으면 생략), 새 최고 기록 배지, [나도 도전하기]. 이미지가 아니라 네이티브 카드라
 * 테마(라이트·다크)와 글꼴을 그대로 따른다. 순수·prop 기반.
 */
export function FeedMinigameRecordCard({
  record,
  onChallenge,
  onRemove,
  removeDisabled = false,
  testID = 'feed-minigame-record',
}: FeedMinigameRecordCardProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const definition = getMinigameDefinition(record.gameCode);
  const name = definition?.name ?? tr('feed.record.unknownGame');
  const score = tr('feed.record.score', { score: record.score.toLocaleString() });
  const rank =
    record.rank != null ? tr('feed.record.rank', { rank: record.rank.toLocaleString() }) : null;
  const summary = [name, score, rank, record.personalBest ? tr('feed.record.personalBest') : null]
    .filter(Boolean)
    .join(', ');
  return (
    <View
      style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border }]}
      testID={testID}>
      <View style={styles.row} accessible accessibilityLabel={tr('feed.record.a11y', { summary })}>
        <View style={[styles.avatar, { backgroundColor: t.primarySoft }]}>
          <CharacterAvatar
            characterId="cat"
            pose={definition?.pose ?? FALLBACK_POSE}
            size={AVATAR_SIZE}
          />
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Icon name="gamepad" size={16} color={t.icon} />
            <Text
              style={[Typography.supporting, styles.shrink, { color: t.textMuted }]}
              numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text style={[Typography.display2, { color: t.text }]} numberOfLines={1}>
            {score}
          </Text>
          {rank || record.personalBest ? (
            <View style={styles.metaRow}>
              {rank ? (
                <Text style={[Typography.label, { color: t.primaryText }]}>{rank}</Text>
              ) : null}
              {record.personalBest ? (
                <View
                  style={[styles.badge, { backgroundColor: t.warningSoft }]}
                  testID={`${testID}-best`}>
                  <Icon name="star" size={12} color={t.warningText} />
                  <Text style={[Typography.supporting, { color: t.warningText }]}>
                    {tr('feed.record.personalBest')}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      {onChallenge && definition ? (
        <Pressable
          onPress={() => onChallenge(definition.gameCode)}
          accessibilityRole="button"
          accessibilityLabel={tr('feed.record.challengeA11y', { game: name })}
          style={({ pressed }) => [
            styles.challenge,
            { backgroundColor: pressed ? t.primaryActive : t.primary },
          ]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {tr('feed.record.challenge')}
          </Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={removeDisabled}
          accessibilityRole="button"
          accessibilityLabel={tr('feed.record.removeA11y')}
          accessibilityState={{ disabled: removeDisabled }}
          hitSlop={Spacing.two}
          style={[styles.remove, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="close" size={14} color={t.icon} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    overflow: 'hidden',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    borderRadius: Radius.pill,
    padding: Spacing.one,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // 오른쪽 위 ✕와 겹치지 않게.
    paddingRight: Spacing.four,
  },
  shrink: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  challenge: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  remove: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * 목록 줄 오른쪽의 기록 타일 — 썸네일 자리에 게임 아이콘과 점수만 작게. 카드 전체(순위·배지·
 * [나도 도전하기])는 상세에서 본다. 장식이라 스크린리더는 줄의 라벨로 읽는다.
 */
export function FeedRecordThumb({ record, size }: { record: FeedMinigameRecord; size: number }) {
  const t = useTokens();
  const Typography = useTypography();
  const definition = getMinigameDefinition(record.gameCode);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.thumb, { width: size, height: size, backgroundColor: t.primarySoft }]}>
      <CharacterAvatar characterId="cat" pose={definition?.pose ?? FALLBACK_POSE} size={size / 2} />
      <Text style={[Typography.supporting, { color: t.primaryText }]} numberOfLines={1}>
        {record.score.toLocaleString()}
      </Text>
    </View>
  );
}

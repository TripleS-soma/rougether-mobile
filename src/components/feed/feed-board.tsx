import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedBoardFilter, FeedBoardType } from '@/components/screens/feed/types';
import { Badge } from '@/components/ui/badge';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 게시판 이름 키 — 필터 탭·작성 선택·배지가 같은 이름을 쓴다. */
export const FEED_BOARD_LABEL_KEY: Record<FeedBoardFilter, string> = {
  ALL: 'feed.board.all',
  FREE: 'feed.board.free',
  VERIFICATION: 'feed.board.verification',
  MINE: 'feed.board.mine',
};

/** 피드 목록 필터 순서 — 전체 / 자유 / 인증 / 내 글. */
export const FEED_BOARD_FILTERS: readonly FeedBoardFilter[] = [
  'ALL',
  'FREE',
  'VERIFICATION',
  'MINE',
];
/** 작성 화면의 게시판 선택지 — 자유 / 인증. */
export const FEED_BOARD_TYPES: readonly FeedBoardType[] = ['FREE', 'VERIFICATION'];

export type FeedBoardTabsProps<K extends FeedBoardFilter> = {
  options: readonly K[];
  value: K;
  onChange?: (value: K) => void;
  /** 잠금(작성 중 등) — 누를 수 없고 흐리게. */
  disabled?: boolean;
  /** 이 선택지만 잠근다 — 수정 창에서 사진 없는 글의 인증게시판(서버 #430). */
  disabledOptions?: readonly K[];
  testID?: string;
};

/**
 * 게시판 알약 세그먼트 (서버 #428) — 알림 화면 [알림 | 새 소식](#1320)과 같은 모양.
 * 목록 필터(전체/자유/인증)와 작성 화면 게시판 선택(자유/인증)이 같이 쓴다.
 */
export function FeedBoardTabs<K extends FeedBoardFilter>({
  options,
  value,
  onChange,
  disabled = false,
  disabledOptions,
  testID,
}: FeedBoardTabsProps<K>) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  return (
    <View style={styles.row} testID={testID}>
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.segment}>
        {options.map((key) => {
          const active = value === key;
          const label = tr(FEED_BOARD_LABEL_KEY[key]);
          const off = disabled || !!disabledOptions?.includes(key);
          return (
            <Pressable
              key={key}
              onPress={() => onChange?.(key)}
              disabled={off}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: off }}
              accessibilityLabel={tr('feed.board.tabA11y', { label })}
              testID={testID ? `${testID}-${key}` : undefined}
              style={[styles.item, active && { backgroundColor: t.surfaceMuted }]}>
              <Text
                style={[
                  Typography.label,
                  { color: active ? t.primaryText : off ? t.textDisabled : t.textMuted },
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

/** 게시물의 게시판 배지 — 카드·상세의 작성자 줄 오른쪽. */
export function FeedBoardBadge({ board }: { board: FeedBoardType }) {
  const t = useTokens();
  const tr = useT();
  const free = board === 'FREE';
  return (
    <View testID={`feed-board-badge-${board}`}>
      <Badge
        label={tr(FEED_BOARD_LABEL_KEY[board])}
        background={free ? t.surfaceMuted : t.primarySoft}
        color={free ? t.textMuted : t.primaryText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  item: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});

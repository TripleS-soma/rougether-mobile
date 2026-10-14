import { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FEED_BOARD_FILTERS, FeedBoardTabs } from '@/components/feed/feed-board';
import { FeedRecordThumb, feedRecordDraftText } from '@/components/feed/feed-minigame-record';
import { feedAuthorName, feedTimeLabel } from '@/components/feed/feed-parts';
import { FeedRoutineBadge } from '@/components/feed/feed-routine';
import { FeedPhoto } from '@/components/feed/feed-photo';
import type { FeedBoardFilter, FeedImageLoader, FeedPost } from '@/components/screens/feed/types';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Loading } from '@/components/ui/loading';
import { PagerScrollView } from '@/components/ui/pager-scroll-view';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius, Spacing } from '@/constants/theme';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import type { ScrollRestoreProps } from '@/hooks/use-scroll-restore';
import { useBottomNavInset, useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useConstant } from '@/hooks/use-stable-value';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const NO_POSTS: FeedPost[] = [];
const COMPOSE_SIZE = 56;
/** 목록 카드 본문 줄 수 — 사진 없는 자유글은 글이 주인공이라 더 길게 보인다. */
/** 목록 줄의 본문 미리보기 줄 수(에브리타임과 같은 세 줄). */
const ROW_LINES = 3;
/** 오른쪽 썸네일 한 변 — 본문 세 줄 + 메타 줄 높이에 맞춘다. */
const THUMB_SIZE = Spacing.six * 2;

export type FeedScreenProps = {
  posts?: FeedPost[];
  /** 게시판 필터 (서버 #428) — 전체(통합)·자유·인증. */
  board?: FeedBoardFilter;
  /** 주면 목록 위에 [전체 | 자유 | 인증] 세그먼트를 그린다. */
  onChangeBoard?: (board: FeedBoardFilter) => void;
  /** 첫 페이지를 받는 중. */
  loading?: boolean;
  /** 첫 페이지 실패 — 빈 상태로 위장하지 않고 재시도를 보인다. */
  loadError?: boolean;
  onRetry?: () => void;
  /** 당겨서 새로고침 — Promise면 끝날 때까지 인디케이터를 둔다. */
  onRefresh?: () => Promise<void> | void;
  hasNext?: boolean;
  loadingMore?: boolean;
  /** 목록 끝 근처 — 다음 페이지. 중복 호출 가드는 훅이 한다. */
  onLoadMore?: () => void;
  onOpenPost?: (postId: number) => void;
  onCompose?: () => void;
  /** 인증 사진 로더 — 셸이 `fetchFeedImage`를 넘긴다. */
  loadImage?: FeedImageLoader;
  /** 테스트·갤러리용 기준 시각. */
  now?: Date;
} & ScrollRestoreProps;

type RowProps = {
  post: FeedPost;
  loadImage?: FeedImageLoader;
  onOpenPost?: (postId: number) => void;
  /** 목록의 첫·마지막 줄 — 묶음의 위·아래 모서리만 둥글게. */
  first: boolean;
  last: boolean;
  now?: Date;
};

/**
 * 목록 한 줄 — 에브리타임처럼 왼쪽에 본문 세 줄과 메타(시각 · 작성자 · ♡ · 💬), 오른쪽에 첫
 * 사진 정사각형 썸네일(기록 글은 게임 타일). 줄 전체를 누르면 상세에서 사진을 크게 보고
 * 좋아요·댓글·[나도 도전하기]를 한다. 목록에선 좋아요를 누르지 않는다(숫자만).
 */
const FeedPostRow = memo(function FeedPostRow({
  post,
  loadImage,
  onOpenPost,
  first,
  last,
  now,
}: RowProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const photo = post.images[0];
  const name = feedAuthorName(post.author, tr('feed.anonymous'));
  const time = feedTimeLabel(post.createdAt, now);
  // 본문이 비어 있는 옛 기록 글도 줄이 비지 않게 — 기록 요약을 본문 자리에.
  const text =
    post.content || (post.minigameRecord ? feedRecordDraftText(post.minigameRecord) : '');
  return (
    <Pressable
      onPress={onOpenPost ? () => onOpenPost(post.postId) : undefined}
      accessibilityRole="button"
      accessibilityLabel={tr('feed.openPostA11y', { name })}
      testID={`feed-post-${post.postId}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? t.surfaceMuted : t.surface, borderColor: t.border },
        first && styles.rowFirst,
        last && styles.rowLast,
        !last && styles.rowDivider,
      ]}>
      <View style={styles.rowText}>
        {text ? (
          <Text style={[Typography.body, { color: t.text }]} numberOfLines={ROW_LINES}>
            {text}
          </Text>
        ) : null}
        {post.boardType === 'VERIFICATION' && post.routine ? (
          <FeedRoutineBadge routine={post.routine} />
        ) : null}
        <View style={styles.meta}>
          {time ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
              {time}
            </Text>
          ) : null}
          <Text
            style={[Typography.supporting, styles.metaName, { color: t.textMuted }]}
            numberOfLines={1}>
            {name}
          </Text>
          {post.likeCount > 0 ? (
            <View
              style={styles.count}
              accessible
              accessibilityLabel={tr('feed.likeCount', { count: post.likeCount })}>
              <Icon
                name={post.likedByMe ? 'heart' : 'heart-outline'}
                size={13}
                color={post.likedByMe ? t.danger : t.textMuted}
              />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>{post.likeCount}</Text>
            </View>
          ) : null}
          {post.commentCount > 0 ? (
            <View
              style={styles.count}
              accessible
              accessibilityLabel={tr('feed.commentCount', { count: post.commentCount })}>
              <Icon name="comment" size={13} color={t.textMuted} />
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {post.commentCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {photo ? (
        <View>
          <FeedPhoto
            image={photo}
            loader={loadImage}
            contentFit="cover"
            accessibilityLabel={tr('feed.imageA11y', { index: 1, total: post.images.length })}
            style={[styles.thumb, { width: THUMB_SIZE, height: THUMB_SIZE }]}
          />
          {post.images.length > 1 ? (
            <View style={[styles.countBadge, { backgroundColor: t.surface }]}>
              <Text style={[Typography.supporting, { color: t.text }]}>
                {tr('feed.imageCount', { count: post.images.length - 1 })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : post.minigameRecord ? (
        <FeedRecordThumb record={post.minigameRecord} size={THUMB_SIZE} />
      ) : null}
    </Pressable>
  );
});

/**
 * 공개 피드 탭 (#1409) — 전체 공개 게시물 최신순. 순수·prop 기반: 데이터·좋아요·이동은
 * 셸(`use-feed-pages`)이 넘긴다. 하단 탭 페이저 안에 살아서 스크롤은 PagerScrollView로
 * 페이저와 방향을 나눈다(iOS).
 */
export function FeedScreen({
  posts = NO_POSTS,
  board = 'ALL',
  onChangeBoard,
  loading = false,
  loadError = false,
  onRetry,
  onRefresh,
  hasNext = false,
  loadingMore = false,
  onLoadMore,
  onOpenPost,
  onCompose,
  loadImage,
  now,
  getInitialScrollY,
  onScrollY,
}: FeedScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  const navInset = useBottomNavInset();
  const [refreshing, setRefreshing] = useState(false);

  // 서브화면(상세·작성)에 다녀오면 페이저가 다시 마운트된다 — 셸이 기억한 위치로 (#763).
  const listRef = useRef<FlatList<FeedPost>>(null);
  const initialY = useConstant(() => Math.max(0, getInitialScrollY?.() ?? 0));
  const restored = useRef(initialY === 0);
  const handleContentSize = useCallback(
    (_w: number, h: number) => {
      if (restored.current || h < initialY) return;
      restored.current = true;
      listRef.current?.scrollToOffset({ offset: initialY, animated: false });
    },
    [initialY],
  );
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => onScrollY?.(e.nativeEvent.contentOffset.y),
    [onScrollY],
  );

  // 게시판을 바꾸면 새 목록의 맨 위부터 — 이전 게시판의 스크롤 위치를 끌고 가지 않는다.
  const handleChangeBoard = useCallback(
    (next: FeedBoardFilter) => {
      if (next === board) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      onChangeBoard?.(next);
    },
    [board, onChangeBoard],
  );

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const lastIndex = posts.length - 1;
  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <FeedPostRow
        post={item}
        loadImage={loadImage}
        onOpenPost={onOpenPost}
        first={index === 0}
        last={index === lastIndex}
        now={now}
      />
    ),
    [loadImage, onOpenPost, lastIndex, now],
  );

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('feed.title')} />
      <FlatList
        ref={listRef}
        testID="feed-list"
        data={posts}
        keyExtractor={(p) => String(p.postId)}
        renderItem={renderItem}
        renderScrollComponent={(props) => <PagerScrollView {...props} />}
        contentOffset={{ x: 0, y: initialY }}
        onContentSizeChange={handleContentSize}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onEndReached={hasNext ? onLoadMore : undefined}
        onEndReachedThreshold={0.6}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={t.primary}
              colors={[t.primary]}
              progressViewOffset={headerInset}
            />
          ) : undefined
        }
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
          { paddingBottom: Spacing.four + navInset + COMPOSE_SIZE },
        ]}
        ListHeaderComponent={
          onChangeBoard ? (
            // 줄 묶음과 붙지 않게 — 줄 사이 간격을 없애면서(#1559) 탭 아래 간격도 사라졌다.
            <View style={styles.listHeader}>
              <FeedBoardTabs
                options={FEED_BOARD_FILTERS}
                value={board}
                onChange={handleChangeBoard}
                testID="feed-board-filter"
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.state}>
              <Loading />
            </View>
          ) : loadError ? (
            <View style={styles.state}>
              <RetryState message={tr('feed.loadError')} onRetry={onRetry} />
            </View>
          ) : (
            <Text style={[Typography.body, styles.state, styles.empty, { color: t.textMuted }]}>
              {board === 'FREE'
                ? tr('feed.emptyFree')
                : board === 'MINE'
                  ? tr('feed.emptyMine')
                  : tr('feed.empty')}
            </Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer} accessibilityLabel={tr('feed.loadingMore')}>
              <Loading delayMs={0} />
            </View>
          ) : null
        }
      />
      {onCompose ? (
        <Pressable
          onPress={onCompose}
          accessibilityRole="button"
          accessibilityLabel={tr('feed.composeA11y')}
          testID="feed-compose"
          style={[styles.compose, { bottom: navInset + Spacing.three }]}>
          <GlassSurface style={styles.composeFace} fallbackColor={t.primary} tintColor={t.primary}>
            <Icon name="add" size={28} color={t.onPrimary} />
          </GlassSurface>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
  },
  listHeader: {
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  rowFirst: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  rowLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaName: {
    flexShrink: 1,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  thumb: {
    borderRadius: Radius.lg,
  },
  countBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
  },
  state: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
  },
  footer: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  compose: {
    position: 'absolute',
    right: Spacing.four,
  },
  composeFace: {
    width: COMPOSE_SIZE,
    height: COMPOSE_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

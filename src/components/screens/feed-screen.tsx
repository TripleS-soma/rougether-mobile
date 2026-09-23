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

import { FeedActionRow, FeedAuthorRow, feedAuthorName } from '@/components/feed/feed-parts';
import { FeedPhoto, feedImageAspect } from '@/components/feed/feed-photo';
import type { FeedImageLoader, FeedPost } from '@/components/screens/feed/types';
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

export type FeedScreenProps = {
  posts?: FeedPost[];
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
  onToggleLike?: (postId: number) => void;
  onOpenPost?: (postId: number) => void;
  onCompose?: () => void;
  /** 인증 사진 로더 — 셸이 `fetchFeedImage`를 넘긴다. */
  loadImage?: FeedImageLoader;
  /** 테스트·갤러리용 기준 시각. */
  now?: Date;
} & ScrollRestoreProps;

type CardProps = {
  post: FeedPost;
  loadImage?: FeedImageLoader;
  onToggleLike?: (postId: number) => void;
  onOpenPost?: (postId: number) => void;
  now?: Date;
};

/** 목록 카드 — 첫 사진 + 본문 세 줄 + 좋아요·댓글. 사진·본문을 누르면 상세. */
const FeedPostCard = memo(function FeedPostCard({
  post,
  loadImage,
  onToggleLike,
  onOpenPost,
  now,
}: CardProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const first = post.images[0];
  const open = onOpenPost ? () => onOpenPost(post.postId) : undefined;
  return (
    <View style={[styles.card, { backgroundColor: t.surface }]} testID={`feed-post-${post.postId}`}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={tr('feed.openPostA11y', {
          name: feedAuthorName(post.author, tr('feed.anonymous')),
        })}
        style={styles.cardBody}>
        <FeedAuthorRow
          author={post.author}
          createdAt={post.createdAt}
          edited={post.updatedAt !== post.createdAt}
          now={now}
        />
        {first ? (
          <View>
            <FeedPhoto
              image={first}
              loader={loadImage}
              accessibilityLabel={tr('feed.imageA11y', { index: 1, total: post.images.length })}
              style={[styles.photo, { aspectRatio: feedImageAspect(first) }]}
            />
            {post.images.length > 1 ? (
              <View style={[styles.countBadge, { backgroundColor: t.surface }]}>
                <Text style={[Typography.supporting, { color: t.text }]}>
                  {tr('feed.imageCount', { count: post.images.length - 1 })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {post.content ? (
          <Text style={[Typography.body, { color: t.text }]} numberOfLines={3}>
            {post.content}
          </Text>
        ) : null}
      </Pressable>
      <FeedActionRow
        liked={post.likedByMe}
        likeCount={post.likeCount}
        commentCount={post.commentCount}
        onToggleLike={onToggleLike ? () => onToggleLike(post.postId) : undefined}
        onOpenComments={open}
      />
    </View>
  );
});

/**
 * 공개 피드 탭 (#1409) — 전체 공개 게시물 최신순. 순수·prop 기반: 데이터·좋아요·이동은
 * 셸(`use-feed-pages`)이 넘긴다. 하단 탭 페이저 안에 살아서 스크롤은 PagerScrollView로
 * 페이저와 방향을 나눈다(iOS).
 */
export function FeedScreen({
  posts = NO_POSTS,
  loading = false,
  loadError = false,
  onRetry,
  onRefresh,
  hasNext = false,
  loadingMore = false,
  onLoadMore,
  onToggleLike,
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

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        loadImage={loadImage}
        onToggleLike={onToggleLike}
        onOpenPost={onOpenPost}
        now={now}
      />
    ),
    [loadImage, onToggleLike, onOpenPost, now],
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
              {tr('feed.empty')}
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
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardBody: {
    gap: Spacing.two,
  },
  photo: {
    borderRadius: Radius.lg,
  },
  countBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
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

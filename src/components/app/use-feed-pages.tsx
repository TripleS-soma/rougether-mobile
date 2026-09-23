import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { fetchFeedImage } from '@/api/feed';
import { type Screen } from '@/components/app/navigation';
import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import type { FeedScreenProps } from '@/components/screens/feed-screen';
import { useToast } from '@/components/ui/toast';
import { FEED_ENABLED, FEED_MAX_IMAGES } from '@/constants/feed';
import { useFeed } from '@/hooks/use-feed';
import { useFeedCompose } from '@/hooks/use-feed-compose';
import { useFeedPost } from '@/hooks/use-feed-post';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { track } from '@/lib/analytics';
import { pickLibraryImages } from '@/lib/pick-image';

/**
 * 피드 페이지 배선 (#1409) — 피드 탭과 서브화면 2종(게시물 상세·작성)의 훅·콜백·JSX를
 * 소유한다(use-house-pages와 같은 결). 셸은 `tabProps`를 `<FeedScreen {...tabProps} />`로
 * 스프레드하고 `subScreen`을 렌더만 한다. FEED_ENABLED가 꺼져 있으면 아무것도 요청하지 않는다.
 */
export function useFeedPages({
  nav,
}: {
  nav: { screen: Screen; setScreen: Dispatch<SetStateAction<Screen>> };
}) {
  const { screen, setScreen } = nav;
  const { show: toast } = useToast();
  const showError = useCallback((message: string) => toast(message, 'error'), [toast]);

  // 셸에 상주하므로 피드 탭을 처음 열기 전에는 받지 않는다 — 앱 시작 요청을 늘리지 않게.
  const [visited, setVisited] = useState(false);
  useEffect(() => {
    if (!FEED_ENABLED) return;
    if (screen === 'feed') {
      setVisited(true);
      track('feed_view');
    }
  }, [screen]);

  const feed = useFeed({ enabled: FEED_ENABLED && visited, onError: showError });

  // 상세는 연 글 id를 기억한다 — 떠나는 전환(#1094) 동안에도 같은 글을 그리게 비우지 않는다.
  const [postId, setPostId] = useState<number | null>(null);
  const openPost = useCallback(
    (id: number) => {
      setPostId(id);
      setScreen('feedPost');
    },
    [setScreen],
  );
  const detail = useFeedPost(FEED_ENABLED ? postId : null, { onError: showError });

  // 알림에서 연 글이 이미 지워졌으면 안내 후 피드로 (spec: 삭제 안내 후 피드로 돌아간다).
  useEffect(() => {
    if (screen !== 'feedPost' || !detail.notFound) return;
    toast(i18n.t('feed.toast.postGone'));
    setScreen('feed');
  }, [screen, detail.notFound, toast, setScreen]);

  const compose = useFeedCompose({ onError: showError });
  const openCompose = useCallback(() => setScreen('feedCompose'), [setScreen]);

  // 작성 화면을 어떤 경로로든(뒤로 버튼·하드웨어 백·엣지 백) 떠나면 초안을 버린다 — 올려 둔
  // 사진도 서버에서 취소해 미사용 업로드 30장 한도를 잡아먹지 않게.
  const prevScreen = useRef(screen);
  const discardRef = useLatestRef(compose.discard);
  useEffect(() => {
    if (prevScreen.current === 'feedCompose' && screen !== 'feedCompose') discardRef.current();
    prevScreen.current = screen;
  }, [screen, discardRef]);

  const imageCountRef = useLatestRef(compose.images.length);
  const addImages = compose.addImages;
  const pickImages = useCallback(async () => {
    const picked = await pickLibraryImages(FEED_MAX_IMAGES - imageCountRef.current);
    if (picked.length) addImages(picked);
  }, [addImages, imageCountRef]);

  const submit = compose.submit;
  const handleSubmit = useCallback(async () => {
    const post = await submit();
    if (!post) return;
    toast(i18n.t('feed.toast.posted'), 'success');
    setScreen('feed');
  }, [submit, toast, setScreen]);

  const deletePost = detail.deletePost;
  const handleDeletePost = useCallback(
    async (id: number) => {
      if (!(await deletePost(id))) return;
      toast(i18n.t('feed.toast.deleted'));
      setScreen('feed');
    },
    [deletePost, toast, setScreen],
  );

  const toggleLike = feed.toggleLike;
  const handleToggleLike = useCallback((id: number) => void toggleLike(id), [toggleLike]);
  const deleteComment = detail.deleteComment;
  const handleDeleteComment = useCallback(
    (commentId: number) => void deleteComment(commentId),
    [deleteComment],
  );

  /** 탭 페이저의 피드 페이지 prop — 참조 고정(#539). */
  const tabProps: FeedScreenProps = useMemo(
    () => ({
      posts: feed.posts,
      loading: feed.loading,
      loadError: feed.error,
      onRetry: feed.refresh,
      onRefresh: feed.refresh,
      hasNext: feed.hasNext,
      loadingMore: feed.loadingMore,
      onLoadMore: feed.loadMore,
      onToggleLike: handleToggleLike,
      onOpenPost: openPost,
      onCompose: openCompose,
      loadImage: fetchFeedImage,
    }),
    [feed, handleToggleLike, openPost, openCompose],
  );

  // TODO(#1409): 알림함·푸시의 FEED_COMMENT(refId = postId) 탭을 openPost로 잇는다 — 지금 알림
  // 목록은 종류별 이동이 없고(행 탭 = 읽음), 푸시 탭은 use-my-room-pages가 알림함으로 보낸다.
  const subScreen =
    screen === 'feedPost' ? (
      <FeedPostScreen
        post={detail.post}
        loading={detail.loading}
        loadError={detail.error}
        notFound={detail.notFound}
        onRetry={detail.retry}
        comments={detail.comments}
        commentsLoading={detail.commentsLoading}
        commentsError={detail.commentsError}
        hasMoreComments={detail.hasMoreComments}
        onLoadMoreComments={detail.loadMoreComments}
        onAddComment={detail.addComment}
        onDeleteComment={handleDeleteComment}
        onToggleLike={handleToggleLike}
        onDeletePost={(id) => void handleDeletePost(id)}
        onEditPost={detail.editPost}
        onBack={() => setScreen('feed')}
        loadImage={fetchFeedImage}
      />
    ) : screen === 'feedCompose' ? (
      <FeedComposeScreen
        images={compose.images}
        content={compose.content}
        onChangeContent={compose.setContent}
        onPickImages={() => void pickImages()}
        onRemoveImage={compose.removeImage}
        onRetryImage={compose.retryImage}
        onSubmit={() => void handleSubmit()}
        submitting={compose.submitting}
        onBack={() => setScreen('feed')}
      />
    ) : null;

  return { tabProps, subScreen, openPost };
}

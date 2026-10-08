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
import type { ReportReason } from '@/api/types';
import { type Screen } from '@/components/app/navigation';
import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import type { FeedBoardFilter } from '@/components/screens/feed/types';
import type { FeedScreenProps } from '@/components/screens/feed-screen';
import { useToast } from '@/components/ui/toast';
import { FEED_ENABLED, FEED_MAX_IMAGES } from '@/constants/feed';
import { useFeed } from '@/hooks/use-feed';
import { useFeedCompose } from '@/hooks/use-feed-compose';
import { useFeedPost } from '@/hooks/use-feed-post';
import { useModeration } from '@/hooks/use-moderation';
import { useRecentRoutineCompletions } from '@/hooks/use-recent-routine-completions';
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
  nav: {
    screen: Screen;
    setScreen: Dispatch<SetStateAction<Screen>>;
    /** 셸의 뒤로가기 — 서브화면 뒤로 버튼이 뒤로 맵(BACK_SCREEN)을 다시 적지 않게 (장부 6번). */
    goBack: () => void;
  };
}) {
  const { screen, setScreen, goBack } = nav;
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

  // 게시판 필터 (서버 #428) — 셸에 두어 상세·작성에 다녀와도 보던 게시판이 유지된다.
  const [board, setBoard] = useState<FeedBoardFilter>('ALL');
  const feed = useFeed({ enabled: FEED_ENABLED && visited, board, onError: showError });

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
  // 자유·인증 게시판을 보다가 쓰면 그 게시판으로 시작한다(전체·내 글이면 기본 자유).
  const boardRef = useLatestRef(board);
  const setComposeBoard = compose.setBoard;
  const openCompose = useCallback(() => {
    const current = boardRef.current;
    if (current === 'FREE' || current === 'VERIFICATION') setComposeBoard(current);
    setScreen('feedCompose');
  }, [boardRef, setComposeBoard, setScreen]);

  // 작성 화면을 어떤 경로로든(뒤로 버튼·하드웨어 백·엣지 백) 떠나면 초안을 버린다 — 올려 둔
  // 사진도 서버에서 취소해 미사용 업로드 30장 한도를 잡아먹지 않게.
  const prevScreen = useRef(screen);
  const discardRef = useLatestRef(compose.discard);
  useEffect(() => {
    if (prevScreen.current === 'feedCompose' && screen !== 'feedCompose') discardRef.current();
    prevScreen.current = screen;
  }, [screen, discardRef]);

  // 인증글 루틴 고르기 (#1456) — 작성에서 인증게시판을 골랐거나 내 글 수정 창이 열린 동안만
  // 최근 7일 /calendar를 받는다. 다른 화면으로 가면 수정 창 상태도 접는다.
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    if (screen !== 'feedPost') setEditOpen(false);
  }, [screen]);
  const routinePicker = useRecentRoutineCompletions({
    enabled:
      FEED_ENABLED &&
      ((screen === 'feedCompose' && compose.board === 'VERIFICATION') ||
        (screen === 'feedPost' && editOpen)),
  });

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

  // 신고·차단 (#1428). 신고는 접수 안내만 — 서버가 자동으로 숨기지 않는다(운영자 검토).
  const { report, block } = useModeration({ onError: showError });
  const handleReportPost = useCallback(
    async (id: number, reason: ReportReason, detail?: string) => {
      const ok = await report({ kind: 'post', postId: id }, reason, detail);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );
  const handleReportComment = useCallback(
    async (id: number, commentId: number, reason: ReportReason, detail?: string) => {
      const ok = await report({ kind: 'comment', postId: id, commentId }, reason, detail);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );
  // 보고 있던 글의 작성자를 차단하면 그 글은 곧 404가 된다 — 피드로 돌아간다.
  const detailAuthorRef = useLatestRef(detail.post?.author.userId);
  const handleBlockUser = useCallback(
    async (userId: number, via: 'post' | 'comment') => {
      if (!(await block(userId, via))) return;
      toast(i18n.t('member.moderation.toast.blocked'), 'success');
      if (detailAuthorRef.current === userId) setScreen('feed');
    },
    [block, toast, detailAuthorRef, setScreen],
  );

  /** 탭 페이저의 피드 페이지 prop — 참조 고정(#539). */
  const tabProps: FeedScreenProps = useMemo(
    () => ({
      board,
      onChangeBoard: setBoard,
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
    [board, feed, handleToggleLike, openPost, openCompose],
  );

  // 알림함의 FEED_COMMENT 카드(refId = postId)는 셸이 openPost로 잇는다(2026-10-08).
  // TODO(#1409): 푸시 탭은 아직 use-my-room-pages가 알림함으로 보낸다 — 같은 목적지 표로 잇기.
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
        onEditOpenChange={setEditOpen}
        routinePicker={routinePicker}
        onReportPost={handleReportPost}
        onReportComment={handleReportComment}
        onBlockUser={(userId, via) => void handleBlockUser(userId, via)}
        onBack={goBack}
        loadImage={fetchFeedImage}
      />
    ) : screen === 'feedCompose' ? (
      <FeedComposeScreen
        board={compose.board}
        onChangeBoard={compose.setBoard}
        routine={compose.routine}
        onChangeRoutine={compose.setRoutine}
        routinePicker={routinePicker}
        images={compose.images}
        content={compose.content}
        onChangeContent={compose.setContent}
        onPickImages={() => void pickImages()}
        onRemoveImage={compose.removeImage}
        onRetryImage={compose.retryImage}
        onSubmit={() => void handleSubmit()}
        submitting={compose.submitting}
        onBack={goBack}
      />
    ) : null;

  return { tabProps, subScreen, openPost };
}

import {
  type Dispatch,
  type ReactNode,
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
import {
  HouseNotificationBell,
  useHouseNotifications,
} from '@/components/app/use-house-notifications';
import { FeedComposeScreen } from '@/components/screens/feed-compose-screen';
import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import { FeedScreen } from '@/components/screens/feed-screen';
import type {
  FeedBoardFilter,
  FeedComposeScope,
  FeedRepliesRenderer,
  FeedRepliesState,
} from '@/components/screens/feed/types';
import type { House } from '@/components/screens/house/types';
import { useToast } from '@/components/ui/toast';
import { FEED_ENABLED, FEED_MAX_IMAGES } from '@/constants/feed';
import { useFeed } from '@/hooks/use-feed';
import { useFeedCompose } from '@/hooks/use-feed-compose';
import { useFeedPost, useFeedReplies } from '@/hooks/use-feed-post';
import { useModeration } from '@/hooks/use-moderation';
import { useRecentRoutineCompletions } from '@/hooks/use-recent-routine-completions';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { pickLibraryImages } from '@/lib/pick-image';

/** 집 피드의 게시판 탭 — 공개 피드의 '내 글'은 두지 않는다. */
const HOUSE_FEED_BOARDS: readonly FeedBoardFilter[] = ['ALL', 'FREE', 'VERIFICATION'];
const HOUSE_FEED_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'houseFeed',
  'houseFeedPost',
  'houseFeedCompose',
]);

/** 이 집 방장의 userId — 목록 줄의 '방장' 배지용. 좌석에 id가 없으면(데모) undefined. */
export function houseOwnerUserId(house: House | undefined): number | undefined {
  for (const floor of house?.floors ?? []) {
    for (const room of floor.rooms) {
      if (room.isOwner && !room.vacant && room.userId != null) return room.userId;
    }
  }
  return undefined;
}

/** 데이터 연결부 — 화면은 순수 prop 기반으로 유지한다(공개 피드와 같은 결). */
function HouseFeedRepliesQuery({
  postId,
  rootId,
  children,
}: {
  postId: number;
  rootId: number;
  children: (state: FeedRepliesState) => ReactNode;
}) {
  return children(useFeedReplies(postId, rootId));
}

/**
 * 집 피드 배선 — 집 화면 레일의 '집 피드'에서 여는 서브화면 3종(목록·상세·작성). 공개 피드
 * (`use-feed-pages`)와 화면 컴포넌트·데이터 훅은 같이 쓰되, 화면 키·게시판 상태·작성 초안을 따로
 * 둬서 공개 피드의 동작을 건드리지 않는다. 목록은 `houseId`로 묻고 쿼리 키도 달라 캐시가 섞이지
 * 않는다.
 *
 * 공개 피드와 다른 점: 글은 늘 지금 보는 집에 올라가고(올릴 곳 고정), 상세에 '입주 신청'과 기록
 * 카드 도전이 없고, 방장은 남의 글·댓글을 지울 수 있다(서버 `deletable`). FEED_ENABLED가 꺼져
 * 있으면 요청도 화면도 없다.
 */
export function useHouseFeedPages({
  nav,
  currentHouse,
  houses,
  housesLoading,
  setHouseIndex,
  onClosed,
}: {
  nav: {
    screen: Screen;
    setScreen: Dispatch<SetStateAction<Screen>>;
    goBack: () => void;
  };
  /** 집 스위처가 가리키는 집 — 집 피드는 이 집의 글을 보여 준다. */
  currentHouse: House | undefined;
  /** 스위처 순서의 내 집 목록 — 푸시로 들어올 때 그 집을 고른다. */
  houses: readonly House[];
  housesLoading: boolean;
  setHouseIndex: (index: number) => void;
  /** 이 집 피드를 더 볼 수 없다(나감·강퇴·해체) — 셸이 집 목록을 새로 받는다. */
  onClosed?: () => void;
}) {
  const { screen, setScreen, goBack } = nav;
  const { show: toast } = useToast();
  const showError = useCallback((message: string) => toast(message, 'error'), [toast]);

  const houseId = FEED_ENABLED ? (currentHouse?.houseId ?? null) : null;
  const houseName = currentHouse?.name ?? '';
  const active = houseId != null && HOUSE_FEED_SCREENS.has(screen);

  // 집을 바꾸면 게시판·스크롤을 처음으로 — 다른 집의 보던 자리를 끌고 가지 않는다.
  const [board, setBoard] = useState<FeedBoardFilter>('ALL');
  const scrollY = useRef(0);
  useEffect(() => {
    setBoard('ALL');
    scrollY.current = 0;
  }, [houseId]);
  useEffect(() => {
    if (screen === 'house') scrollY.current = 0;
  }, [screen]);

  const feed = useFeed({ enabled: active, board, houseId, onError: showError });

  const open = useCallback(() => setScreen('houseFeed'), [setScreen]);

  // 상세는 연 글 id를 기억한다 — 떠나는 전환 동안에도 같은 글을 그리게 비우지 않는다.
  const [postId, setPostId] = useState<number | null>(null);
  const openPost = useCallback(
    (id: number) => {
      setPostId(id);
      setScreen('houseFeedPost');
    },
    [setScreen],
  );
  const detail = useFeedPost(houseId != null ? postId : null, { onError: showError });

  /**
   * 새 글 푸시(HOUSE_FEED_POST) — 그 집을 고른 뒤 글 상세로. 모르는 집이면(나간 집 등) 집 탭.
   * 꺼진 앱을 푸시로 켜면 집 목록이 아직 없다 — 집·글 id를 기억했다가 목록이 오면 연다
   * (집 채팅 푸시와 같은 패턴, #1511).
   */
  const housesRef = useLatestRef(houses);
  const housesLoadingRef = useLatestRef(housesLoading);
  const [pending, setPending] = useState<{ houseId: number; postId?: number } | null>(null);
  const openPostFor = useCallback(
    (targetHouseId?: number, targetPostId?: number) => {
      if (!FEED_ENABLED || targetHouseId == null) {
        setScreen('house');
        return;
      }
      if (housesLoadingRef.current) {
        setPending({ houseId: targetHouseId, postId: targetPostId });
        setScreen('house');
        return;
      }
      const idx = housesRef.current.findIndex((h) => h.houseId === targetHouseId);
      if (idx < 0) {
        setScreen('house');
        return;
      }
      setHouseIndex(idx);
      if (targetPostId != null) {
        setPostId(targetPostId);
        setScreen('houseFeedPost');
      } else {
        setScreen('houseFeed');
      }
    },
    [housesRef, housesLoadingRef, setHouseIndex, setScreen],
  );
  useEffect(() => {
    if (pending == null || housesLoading) return;
    setPending(null);
    openPostFor(pending.houseId, pending.postId);
  }, [pending, housesLoading, openPostFor]);

  // 집이 사라졌거나(마지막 집 나가기 등) 피드가 꺼진 설치본이면 집 탭으로.
  useEffect(() => {
    if (HOUSE_FEED_SCREENS.has(screen) && houseId == null && !housesLoading) setScreen('house');
  }, [screen, houseId, housesLoading, setScreen]);

  // 목록을 물었더니 구성원이 아니거나 집이 없다 — 안내하고 집 탭으로, 집 목록도 새로.
  const onClosedRef = useLatestRef(onClosed);
  const closed = feed.closed;
  useEffect(() => {
    if (!closed || !HOUSE_FEED_SCREENS.has(screen)) return;
    toast(i18n.t('feed.houseFeed.closed'), 'error');
    onClosedRef.current?.();
    setScreen('house');
  }, [closed, screen, toast, onClosedRef, setScreen]);

  // 푸시로 연 글이 이미 지워졌거나 볼 수 없으면(나간 집도 404) 안내 후 목록으로.
  useEffect(() => {
    if (screen !== 'houseFeedPost' || !detail.notFound) return;
    toast(i18n.t('feed.houseFeed.postGone'));
    setScreen('houseFeed');
  }, [screen, detail.notFound, toast, setScreen]);

  const compose = useFeedCompose({ onError: showError, lockedHouseId: houseId });
  // 자유·인증 게시판을 보다가 쓰면 그 게시판으로 시작한다(전체면 기본 자유).
  const boardRef = useLatestRef(board);
  const setComposeBoard = compose.setBoard;
  const openCompose = useCallback(() => {
    const current = boardRef.current;
    if (current === 'FREE' || current === 'VERIFICATION') setComposeBoard(current);
    setScreen('houseFeedCompose');
  }, [boardRef, setComposeBoard, setScreen]);

  // 작성 화면을 어떤 경로로든 떠나면 초안을 버린다 — 올려 둔 사진도 서버에서 취소한다.
  const prevScreen = useRef(screen);
  const discardRef = useLatestRef(compose.discard);
  useEffect(() => {
    if (prevScreen.current === 'houseFeedCompose' && screen !== 'houseFeedCompose') {
      discardRef.current();
    }
    prevScreen.current = screen;
  }, [screen, discardRef]);

  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    if (screen !== 'houseFeedPost') setEditOpen(false);
  }, [screen]);
  const routinePicker = useRecentRoutineCompletions({
    enabled:
      houseId != null &&
      ((screen === 'houseFeedCompose' && compose.board === 'VERIFICATION') ||
        (screen === 'houseFeedPost' && editOpen)),
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
    setScreen('houseFeed');
  }, [submit, toast, setScreen]);

  const deletePost = detail.deletePost;
  const handleDeletePost = useCallback(
    async (id: number) => {
      if (!(await deletePost(id))) return;
      toast(i18n.t('feed.toast.deleted'));
      setScreen('houseFeed');
    },
    [deletePost, toast, setScreen],
  );

  const toggleLike = detail.toggleLike;
  const handleToggleLike = useCallback((id: number) => void toggleLike(id), [toggleLike]);
  const deleteComment = detail.deleteComment;
  const handleDeleteComment = useCallback(
    (commentId: number) => void deleteComment(commentId),
    [deleteComment],
  );

  const { report, block } = useModeration({ onError: showError });
  const handleReportPost = useCallback(
    async (id: number, reason: ReportReason, detailText?: string) => {
      const ok = await report({ kind: 'post', postId: id }, reason, detailText);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );
  const handleReportComment = useCallback(
    async (id: number, commentId: number, reason: ReportReason, detailText?: string) => {
      const ok = await report({ kind: 'comment', postId: id, commentId }, reason, detailText);
      if (ok) toast(i18n.t('member.moderation.toast.reported'), 'success');
      return ok;
    },
    [report, toast],
  );
  // 차단한 구성원의 글·댓글은 집 안에서도 숨는다 — 보던 글의 작성자면 목록으로 돌아간다.
  const detailAuthorRef = useLatestRef(detail.post?.author.userId);
  const handleBlockUser = useCallback(
    async (userId: number, via: 'post' | 'comment') => {
      if (!(await block(userId, via))) return;
      toast(i18n.t('member.moderation.toast.blocked'), 'success');
      if (detailAuthorRef.current === userId) setScreen('houseFeed');
    },
    [block, toast, detailAuthorRef, setScreen],
  );

  const renderReplies = useCallback<FeedRepliesRenderer>(
    (root, render) => (
      <HouseFeedRepliesQuery postId={root.postId} rootId={root.commentId}>
        {render}
      </HouseFeedRepliesQuery>
    ),
    [],
  );

  const notifications = useHouseNotifications({
    houseId: houseId ?? undefined,
    enabled: active,
  });

  const emptyMessages = useMemo(
    () => ({
      ALL: i18n.t('feed.houseFeed.empty'),
      FREE: i18n.t('feed.houseFeed.emptyFree'),
      VERIFICATION: i18n.t('feed.houseFeed.emptyVerification'),
    }),
    [],
  );
  const ownerUserId = houseOwnerUserId(currentHouse);
  const scope: FeedComposeScope | undefined = useMemo(
    () =>
      houseId != null
        ? { houseId, houses: [{ houseId, name: houseName }], locked: true }
        : undefined,
    [houseId, houseName],
  );

  const subScreen =
    houseId == null ? null : screen === 'houseFeed' ? (
      <>
        <FeedScreen
          key={houseId}
          title={i18n.t('feed.houseFeed.title', { name: houseName })}
          onBack={goBack}
          headerRight={
            <HouseNotificationBell muted={notifications.allMuted} onPress={notifications.open} />
          }
          boardOptions={HOUSE_FEED_BOARDS}
          scopeNote={i18n.t('feed.houseFeed.scopeNote')}
          emptyMessages={emptyMessages}
          authorFirst
          ownerUserId={ownerUserId}
          board={board}
          onChangeBoard={setBoard}
          posts={feed.posts}
          loading={feed.loading}
          loadError={feed.error}
          onRetry={feed.refresh}
          onRefresh={feed.refresh}
          hasNext={feed.hasNext}
          loadingMore={feed.loadingMore}
          onLoadMore={feed.loadMore}
          onOpenPost={openPost}
          onCompose={openCompose}
          loadImage={fetchFeedImage}
          getInitialScrollY={() => scrollY.current}
          onScrollY={(y) => {
            scrollY.current = y;
          }}
        />
        {notifications.sheet}
      </>
    ) : screen === 'houseFeedPost' ? (
      // 집 글에는 입주 신청(onOpenAuthorHouses)·기록 카드 도전(onChallenge)이 없다.
      <FeedPostScreen
        key={postId}
        renderReplies={renderReplies}
        commentsRefreshing={detail.commentsRefreshing}
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
    ) : screen === 'houseFeedCompose' ? (
      <FeedComposeScreen
        scope={scope}
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

  return {
    /** 레일 '집 피드' — 피드가 꺼졌거나 houseId 없는 집이면 undefined(버튼을 그리지 않는다). */
    open: houseId != null ? open : undefined,
    subScreen,
    /** 새 글 푸시 탭 — 그 집을 골라 글 상세로. */
    openPostFor,
  };
}

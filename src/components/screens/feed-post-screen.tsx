import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ReportReason } from '@/api/types';
import {
  FeedActionRow,
  FeedAuthorRow,
  FeedAvatar,
  feedAuthorName,
  feedTimeLabel,
} from '@/components/feed/feed-parts';
import { FeedPhoto, feedImageAspect } from '@/components/feed/feed-photo';
import type { FeedComment, FeedImageLoader, FeedPost } from '@/components/screens/feed/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Icon } from '@/components/ui/icon';
import { Loading } from '@/components/ui/loading';
import { ReportSheet } from '@/components/ui/report-sheet';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { RetryState } from '@/components/ui/retry-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { FEED_MAX_COMMENT, FEED_MAX_CONTENT } from '@/constants/feed';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useAndroidKeyboardHeight } from '@/hooks/use-android-keyboard-height';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

const NO_COMMENTS: FeedComment[] = [];
const SEND_SIZE = 40;
const MENU_ICON_SIZE = 40;

/** 남의 글·댓글 더보기 메뉴의 대상 (#1428). */
type ModerationTarget =
  { kind: 'post'; authorId: number } | { kind: 'comment'; commentId: number; authorId: number };

type ReportResult = Promise<boolean> | boolean;

export type FeedPostScreenProps = {
  post?: FeedPost | null;
  loading?: boolean;
  loadError?: boolean;
  /** 삭제·탈퇴로 사라진 글(404) — 안내만 보인다. */
  notFound?: boolean;
  onRetry?: () => void;
  comments?: FeedComment[];
  commentsLoading?: boolean;
  commentsError?: boolean;
  hasMoreComments?: boolean;
  onLoadMoreComments?: () => void;
  /** 댓글 달기 — 앞뒤 공백을 뗀 본문. true를 돌려주면 입력칸을 비운다. */
  onAddComment?: (content: string) => Promise<boolean> | boolean;
  onDeleteComment?: (commentId: number) => void;
  onToggleLike?: (postId: number) => void;
  /** 내 글 삭제(확인 다이얼로그 뒤). */
  onDeletePost?: (postId: number) => void;
  /** 내 글 본문 수정 — true면 편집 창을 닫는다. */
  onEditPost?: (postId: number, content: string) => Promise<boolean> | boolean;
  /**
   * 남의 글 신고 (#1428) — true를 돌려주면 신고 시트를 닫는다. 없으면 메뉴에 신고가 없다.
   * 결과 안내(토스트)는 셸 몫.
   */
  onReportPost?: (postId: number, reason: ReportReason, detail?: string) => ReportResult;
  /** 남의 댓글 신고 (#1428) — true면 시트를 닫는다. */
  onReportComment?: (
    postId: number,
    commentId: number,
    reason: ReportReason,
    detail?: string,
  ) => ReportResult;
  /**
   * 작성자 차단 (#1428) — 확인 다이얼로그를 통과했을 때만 호출된다. `via`는 글·댓글 중
   * 어디서 차단했는지(계측용).
   */
  onBlockUser?: (userId: number, via: 'post' | 'comment') => void;
  onBack?: () => void;
  loadImage?: FeedImageLoader;
  now?: Date;
};

/** 사진 여러 장 — 가로로 한 장씩 넘긴다. 높이는 가장 세로로 긴 장에 맞춘다. */
function PhotoPager({ post, loadImage }: { post: FeedPost; loadImage?: FeedImageLoader }) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const total = post.images.length;
  const aspect = Math.min(...post.images.map(feedImageAspect));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          width > 0 && setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={[styles.pager, { aspectRatio: aspect }]}>
        {post.images.map((image, i) => (
          <FeedPhoto
            key={image.imageId}
            image={image}
            loader={loadImage}
            accessibilityLabel={tr('feed.imageA11y', { index: i + 1, total })}
            style={{ width: width || undefined, height: '100%' }}
          />
        ))}
      </ScrollView>
      {total > 1 ? (
        <View style={[styles.pageBadge, { backgroundColor: t.surface }]}>
          <Text style={[Typography.supporting, { color: t.text }]}>{`${index + 1}/${total}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** 본문 수정 창 — 사진은 바꿀 수 없고 본문만(빈 문자열 허용). */
function EditPostDialog({
  visible,
  initial,
  onCancel,
  onSave,
}: {
  visible: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (content: string) => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const [draft, setDraft] = useState(initial);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      onShow={() => setDraft(initial)}
      aria-label={tr('feed.post.editTitle')}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { backgroundColor: Overlay.dim }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.dialog, { backgroundColor: t.screen }]}>
          <Text style={[Typography.h3, { color: t.text }]}>{tr('feed.post.editTitle')}</Text>
          <TextInput
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, FEED_MAX_CONTENT))}
            multiline
            maxLength={FEED_MAX_CONTENT}
            placeholder={tr('feed.post.editPlaceholder')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('feed.post.editTitle')}
            style={[
              Typography.body,
              styles.editInput,
              { backgroundColor: t.surfaceMuted, color: t.text },
            ]}
          />
          <Text style={[Typography.supporting, styles.counter, { color: t.textMuted }]}>
            {tr('feed.compose.counter', { count: draft.length, max: FEED_MAX_CONTENT })}
          </Text>
          <View style={styles.dialogBtns}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: t.text }]}>{tr('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(draft)}
              accessibilityRole="button"
              style={[styles.dialogBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>{tr('feed.post.save')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * 피드 게시물 상세 (#1409) — 사진 전체·본문·좋아요, 오래된 순 댓글과 입력칸. 내 글이면
 * 헤더에서 본문 수정·삭제, 내 댓글은 삭제할 수 있다. 남의 글·댓글은 더보기(…)에서 신고·
 * 작성자 차단(#1428, App Store 1.2). 순수·prop 기반.
 */
export function FeedPostScreen({
  post = null,
  loading = false,
  loadError = false,
  notFound = false,
  onRetry,
  comments = NO_COMMENTS,
  commentsLoading = false,
  commentsError = false,
  hasMoreComments = false,
  onLoadMoreComments,
  onAddComment,
  onDeleteComment,
  onToggleLike,
  onDeletePost,
  onEditPost,
  onReportPost,
  onReportComment,
  onBlockUser,
  onBack,
  loadImage,
  now,
}: FeedPostScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const column = useResponsiveColumn();
  const headerInset = useHeaderContentInset();
  const androidKeyboard = useAndroidKeyboardHeight(Platform.OS === 'android');
  const bareScreen = useScreenStyle([]);
  const screenWithBottom = useScreenStyle(['bottom']);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmComment, setConfirmComment] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  // 신고·차단 (#1428) — 더보기 메뉴 → 신고 시트 / 차단 확인.
  const [menuTarget, setMenuTarget] = useState<ModerationTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<ModerationTarget | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockTarget, setBlockTarget] = useState<ModerationTarget | null>(null);
  const canReportPost = !!onReportPost;
  const canReportComment = !!onReportComment;
  const canBlock = !!onBlockUser;
  const menuCanReport = menuTarget?.kind === 'post' ? canReportPost : canReportComment;

  const submitReport = async (reason: ReportReason, detail?: string) => {
    if (!post || !reportTarget || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const ok =
        reportTarget.kind === 'post'
          ? await onReportPost?.(post.postId, reason, detail)
          : await onReportComment?.(post.postId, reportTarget.commentId, reason, detail);
      if (ok) setReportTarget(null);
    } finally {
      setReportSubmitting(false);
    }
  };

  const trimmed = draft.trim();
  const canSend = !!post && !!onAddComment && trimmed.length > 0 && !sending;
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const ok = await onAddComment(trimmed);
      if (ok) setDraft('');
    } finally {
      setSending(false);
    }
  };

  const header = (
    <ScreenHeader
      title={tr('feed.post.title')}
      onBack={onBack}
      right={
        post?.mine ? (
          <View style={styles.headerActions}>
            {onEditPost ? (
              <Pressable
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                accessibilityLabel={tr('feed.post.editA11y')}
                style={[styles.headerBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {tr('feed.post.edit')}
                </Text>
              </Pressable>
            ) : null}
            {onDeletePost ? (
              <Pressable
                onPress={() => setConfirmPost(true)}
                accessibilityRole="button"
                accessibilityLabel={tr('feed.post.deletePostA11y')}
                style={[styles.headerBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.danger }]}>
                  {tr('feed.post.deletePost')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : post && (canReportPost || canBlock) ? (
          <Pressable
            onPress={() => setMenuTarget({ kind: 'post', authorId: post.author.userId })}
            accessibilityRole="button"
            accessibilityLabel={tr('member.moderation.postMenuA11y')}
            hitSlop={Spacing.one}
            style={[styles.menuBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="kebab" size={20} color={t.text} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (!post) {
    return (
      <View style={[styles.screen, bareScreen]}>
        {header}
        <View style={[styles.state, { paddingTop: headerInset + Spacing.six }]}>
          {notFound ? (
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              {tr('feed.post.notFound')}
            </Text>
          ) : loadError ? (
            <RetryState message={tr('feed.post.loadError')} onRetry={onRetry} />
          ) : loading ? (
            <Loading />
          ) : null}
        </View>
      </View>
    );
  }

  const postBody = (
    <View style={styles.postBody}>
      <FeedAuthorRow
        author={post.author}
        createdAt={post.createdAt}
        edited={post.updatedAt !== post.createdAt}
        now={now}
      />
      {post.images.length > 0 ? <PhotoPager post={post} loadImage={loadImage} /> : null}
      {post.content ? (
        <Text selectable style={[Typography.body, { color: t.text }]}>
          {post.content}
        </Text>
      ) : null}
      <FeedActionRow
        liked={post.likedByMe}
        likeCount={post.likeCount}
        commentCount={post.commentCount}
        onToggleLike={onToggleLike ? () => onToggleLike(post.postId) : undefined}
      />
      <Text style={[Typography.label, { color: t.text }]}>{tr('feed.post.comments')}</Text>
    </View>
  );

  return (
    <View style={[styles.screen, screenWithBottom]}>
      {header}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={comments}
          keyExtractor={(c) => String(c.commentId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.body,
            column,
            headerInset ? { paddingTop: headerInset } : null,
          ]}
          ListHeaderComponent={postBody}
          ListEmptyComponent={
            commentsLoading ? (
              <Loading />
            ) : commentsError ? (
              <RetryState message={tr('feed.post.commentsLoadError')} onRetry={onRetry} />
            ) : (
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('feed.post.noComments')}
              </Text>
            )
          }
          ListFooterComponent={
            hasMoreComments && comments.length > 0 ? (
              <Pressable
                onPress={onLoadMoreComments}
                accessibilityRole="button"
                style={[styles.more, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {tr('feed.post.moreComments')}
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item: c }) => (
            <View style={styles.comment} testID={`feed-comment-${c.commentId}`}>
              <FeedAvatar author={c.author} size={28} />
              <View style={styles.flex}>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {[feedAuthorName(c.author, tr('feed.anonymous')), feedTimeLabel(c.createdAt, now)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text selectable style={[Typography.body, { color: t.text }]}>
                  {c.content}
                </Text>
              </View>
              {c.mine && onDeleteComment ? (
                <Pressable
                  onPress={() => setConfirmComment(c.commentId)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('feed.post.deleteCommentA11y')}
                  hitSlop={Spacing.two}>
                  <Text style={[Typography.supporting, { color: t.danger }]}>
                    {tr('feed.post.deleteComment')}
                  </Text>
                </Pressable>
              ) : null}
              {!c.mine && (canReportComment || canBlock) ? (
                <Pressable
                  onPress={() =>
                    setMenuTarget({
                      kind: 'comment',
                      commentId: c.commentId,
                      authorId: c.author.userId,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={tr('member.moderation.commentMenuA11y')}
                  hitSlop={Spacing.two}>
                  <Icon name="kebab" size={18} color={t.textMuted} />
                </Pressable>
              ) : null}
            </View>
          )}
        />
        {onAddComment ? (
          <View
            style={[
              styles.inputBar,
              column,
              { borderTopColor: t.border, backgroundColor: t.screen },
              androidKeyboard ? { marginBottom: androidKeyboard } : null,
            ]}>
            <TextInput
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, FEED_MAX_COMMENT))}
              maxLength={FEED_MAX_COMMENT}
              multiline
              placeholder={tr('feed.post.commentPlaceholder')}
              placeholderTextColor={t.textMuted}
              accessibilityLabel={tr('feed.post.commentA11y')}
              style={[
                Typography.body,
                styles.input,
                { backgroundColor: t.surfaceMuted, color: t.text },
              ]}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={tr('feed.post.send')}
              accessibilityState={{ disabled: !canSend }}
              style={[styles.send, { backgroundColor: canSend ? t.primary : t.disabledBg }]}>
              <Icon name="send" size={18} color={canSend ? t.onPrimary : t.textDisabled} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmPost}
        title={tr('feed.post.deletePostTitle')}
        body={tr('feed.post.deletePostBody')}
        confirmLabel={tr('feed.post.deletePost')}
        confirmAccessibilityLabel={tr('feed.post.deletePostA11y')}
        destructive
        onCancel={() => setConfirmPost(false)}
        onConfirm={() => {
          setConfirmPost(false);
          onDeletePost?.(post.postId);
        }}
      />
      <ConfirmDialog
        visible={confirmComment != null}
        title={tr('feed.post.deleteCommentTitle')}
        body={tr('feed.post.deleteCommentBody')}
        confirmLabel={tr('feed.post.deleteComment')}
        destructive
        onCancel={() => setConfirmComment(null)}
        onConfirm={() => {
          const id = confirmComment;
          setConfirmComment(null);
          if (id != null) onDeleteComment?.(id);
        }}
      />
      <BottomSheet
        visible={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
        accessibilityLabel={tr('member.moderation.menuTitle')}
        nativeDrag
        cardStyle={[styles.menuSheet, { backgroundColor: t.screen }]}>
        <SheetHandle />
        {menuCanReport ? (
          <Pressable
            onPress={() => {
              const target = menuTarget;
              setMenuTarget(null);
              if (target) setReportTarget(target);
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('member.moderation.menu.report')}
            style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="flag" size={18} color={t.text} />
            </View>
            <Text style={[Typography.body, { color: t.text }]}>
              {tr('member.moderation.menu.report')}
            </Text>
          </Pressable>
        ) : null}
        {canBlock ? (
          <Pressable
            onPress={() => {
              const target = menuTarget;
              setMenuTarget(null);
              if (target) setBlockTarget(target);
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('member.moderation.menu.block')}
            style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="block" size={18} color={t.danger} />
            </View>
            <Text style={[Typography.body, { color: t.danger }]}>
              {tr('member.moderation.menu.block')}
            </Text>
          </Pressable>
        ) : null}
      </BottomSheet>
      <ReportSheet
        visible={reportTarget !== null}
        targetLabel={
          reportTarget?.kind === 'comment'
            ? tr('member.moderation.target.comment')
            : tr('member.moderation.target.post')
        }
        submitting={reportSubmitting}
        onSubmit={(reason, detail) => void submitReport(reason, detail)}
        onClose={() => setReportTarget(null)}
      />
      <ConfirmDialog
        visible={blockTarget !== null}
        title={tr('member.moderation.block.title')}
        body={tr('member.moderation.block.body')}
        confirmLabel={tr('member.moderation.block.confirm')}
        confirmAccessibilityLabel={tr('member.moderation.block.confirmA11y')}
        destructive
        onCancel={() => setBlockTarget(null)}
        onConfirm={() => {
          const target = blockTarget;
          setBlockTarget(null);
          if (target) onBlockUser?.(target.authorId, target.kind);
        }}
      />
      {onEditPost ? (
        <EditPostDialog
          visible={editing}
          initial={post.content}
          onCancel={() => setEditing(false)}
          onSave={(content) => {
            void Promise.resolve(onEditPost(post.postId, content)).then((ok) => {
              if (ok) setEditing(false);
            });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  state: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  postBody: {
    gap: Spacing.three,
  },
  pager: {
    width: '100%',
    borderRadius: Radius.lg,
  },
  pageBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  menuBtn: {
    width: MENU_ICON_SIZE,
    height: MENU_ICON_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  menuIcon: {
    width: MENU_ICON_SIZE,
    height: MENU_ICON_SIZE,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  more: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editInput: {
    minHeight: 120,
    maxHeight: 280,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
  },
  dialogBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});

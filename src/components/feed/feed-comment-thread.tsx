import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FeedAvatar, feedAuthorName, feedTimeLabel } from '@/components/feed/feed-parts';
import type {
  FeedComment,
  FeedRepliesRenderer,
  FeedRepliesState,
} from '@/components/screens/feed/types';
import { Icon } from '@/components/ui/icon';
import { LinkifiedText } from '@/components/ui/linkified-text';
import { Loading } from '@/components/ui/loading';
import { RetryState } from '@/components/ui/retry-state';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

type CommentActions = {
  onReply?: (comment: FeedComment) => void;
  onDelete?: (commentId: number) => void;
  onMenu?: (comment: FeedComment) => void;
  replyDisabled?: boolean;
  now?: Date;
};

function CommentRow({
  comment,
  target,
  onReply,
  onDelete,
  onMenu,
  replyDisabled,
  now,
}: CommentActions & {
  comment: FeedComment;
  target?: FeedComment;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  if (comment.deleted) {
    return (
      <Text
        testID={`feed-comment-${comment.commentId}`}
        style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('feed.post.deletedComment')}
      </Text>
    );
  }
  const name = feedAuthorName(comment.author, tr('feed.anonymous'));
  return (
    <View style={styles.row} testID={`feed-comment-${comment.commentId}`}>
      <FeedAvatar author={comment.author} size={28} />
      <View style={styles.content}>
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {[name, feedTimeLabel(comment.createdAt, now)].filter(Boolean).join(' · ')}
        </Text>
        {target && !target.deleted ? (
          <Text style={[Typography.supporting, { color: t.primaryText }]}>
            @{feedAuthorName(target.author, tr('feed.anonymous'))}
          </Text>
        ) : null}
        <LinkifiedText
          selectable
          style={[Typography.body, { color: t.text }]}
          linkColor={t.primaryText}>
          {comment.content}
        </LinkifiedText>
        {onReply ? (
          <Pressable
            onPress={() => onReply(comment)}
            disabled={replyDisabled}
            accessibilityRole="button"
            accessibilityLabel={tr('feed.post.replyA11y', { name })}
            accessibilityState={{ disabled: !!replyDisabled }}
            hitSlop={Spacing.two}
            style={styles.action}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('feed.post.reply')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {comment.mine && onDelete ? (
        <Pressable
          onPress={() => onDelete(comment.commentId)}
          accessibilityRole="button"
          accessibilityLabel={tr('feed.post.deleteCommentA11y')}
          hitSlop={Spacing.two}>
          <Text style={[Typography.supporting, { color: t.danger }]}>
            {tr('feed.post.deleteComment')}
          </Text>
        </Pressable>
      ) : null}
      {!comment.mine && onMenu ? (
        <Pressable
          onPress={() => onMenu(comment)}
          accessibilityRole="button"
          accessibilityLabel={tr('member.moderation.commentMenuA11y')}
          hitSlop={Spacing.two}>
          <Icon name="kebab" size={18} color={t.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ReplyList({
  root,
  state,
  ...actions
}: CommentActions & {
  root: FeedComment;
  state: FeedRepliesState;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const byId = new Map([root, ...state.comments].map((c) => [c.commentId, c]));
  return (
    <View
      style={[styles.replies, { borderLeftColor: t.border }]}
      testID={`feed-replies-${root.commentId}`}>
      {state.comments.map((comment) => (
        <CommentRow
          key={comment.commentId}
          comment={comment}
          {...actions}
          target={comment.replyToCommentId != null ? byId.get(comment.replyToCommentId) : undefined}
        />
      ))}
      {state.loading ? <Loading /> : null}
      {state.error ? (
        <RetryState message={tr('feed.post.repliesLoadError')} onRetry={state.onRetry} />
      ) : null}
      {!state.loading && !state.error && state.comments.length === 0 ? (
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {tr('feed.post.noReplies')}
        </Text>
      ) : null}
      {state.hasMore ? (
        <Pressable
          onPress={state.onLoadMore}
          disabled={state.loadingMore}
          accessibilityRole="button"
          accessibilityState={{ disabled: state.loadingMore }}
          style={styles.action}>
          <Text style={[Typography.label, { color: t.primaryText }]}>
            {tr('feed.post.moreReplies')}
          </Text>
        </Pressable>
      ) : null}
      {state.loadingMore ? <Loading /> : null}
    </View>
  );
}

/** 원댓글과 답글은 항상 한 단계만 들여쓴다. 조회는 펼칠 때 주입한 연결부가 맡는다. */
export function FeedCommentThread({
  root,
  renderReplies,
  ...actions
}: CommentActions & {
  root: FeedComment;
  renderReplies?: FeedRepliesRenderer;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();
  const reply = actions.onReply;
  const onReply = reply
    ? (comment: FeedComment) => {
        setExpanded(true);
        reply(comment);
      }
    : undefined;
  return (
    <View style={styles.thread}>
      <CommentRow comment={root} {...actions} onReply={onReply} />
      {renderReplies && (root.replyCount > 0 || expanded) ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={Spacing.two}
          style={styles.toggle}>
          <Text style={[Typography.supporting, { color: t.primaryText }]}>
            {expanded
              ? tr('feed.post.hideReplies')
              : tr('feed.post.showReplies', { count: root.replyCount })}
          </Text>
        </Pressable>
      ) : null}
      {expanded && renderReplies
        ? renderReplies(root, (state) => (
            <ReplyList root={root} state={state} {...actions} onReply={onReply} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  content: { flex: 1, gap: Spacing.half },
  action: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  toggle: { alignSelf: 'flex-start', marginLeft: Spacing.four, paddingVertical: Spacing.one },
  replies: {
    marginLeft: Spacing.four,
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
});

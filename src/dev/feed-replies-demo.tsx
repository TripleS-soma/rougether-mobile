import { useState } from 'react';

import { FeedPostScreen } from '@/components/screens/feed-post-screen';
import type { FeedComment } from '@/components/screens/feed/types';
import { DEMO_FEED_COMMENTS, DEMO_FEED_TEXT_POST } from '@/mocks/fixtures';

const ROOT: FeedComment = {
  ...DEMO_FEED_COMMENTS[0],
  postId: 4,
  mine: true,
  content: '오늘 산책 다녀왔어?',
  replyCount: 2,
};
const REPLIES: FeedComment[] = [
  {
    ...DEMO_FEED_COMMENTS[1],
    postId: 4,
    commentId: 401,
    parentCommentId: ROOT.commentId,
    replyToCommentId: ROOT.commentId,
    mine: false,
    author: { userId: 8, nickname: '이웃', profileImageKey: null },
    content: '응 ㅋㅋ 날씨 좋더라',
  },
  {
    ...DEMO_FEED_COMMENTS[1],
    postId: 4,
    commentId: 402,
    parentCommentId: ROOT.commentId,
    replyToCommentId: 401,
    content: '나도 나갈걸 ㅠ',
  },
];

/** 명시적인 로컬 픽스처. 실서버 로그인·조회·쓰기를 하지 않는다. */
export function FeedRepliesDemo() {
  const [comments, setComments] = useState([ROOT, ...REPLIES]);
  const roots = comments
    .filter((c) => c.parentCommentId == null)
    .map((root) => ({
      ...root,
      replyCount: comments.filter((c) => c.parentCommentId === root.commentId).length,
    }))
    .filter((root) => !root.deleted || root.replyCount > 0);
  return (
    <FeedPostScreen
      post={{
        ...DEMO_FEED_TEXT_POST,
        content: '날씨 좋아서 산책 다녀옴 ☀️',
        commentCount: comments.filter((c) => !c.deleted).length,
      }}
      comments={roots}
      onAddComment={(content, targetId) => {
        const target = comments.find((c) => c.commentId === targetId);
        const id = Math.max(...comments.map((c) => c.commentId), 500) + 1;
        setComments((all) => [
          ...all,
          {
            ...DEMO_FEED_COMMENTS[1],
            postId: 4,
            commentId: id,
            content,
            parentCommentId: target ? (target.parentCommentId ?? target.commentId) : null,
            replyToCommentId: targetId ?? null,
          },
        ]);
        return true;
      }}
      onDeleteComment={(id) =>
        setComments((all) =>
          all.flatMap((c) =>
            c.commentId !== id
              ? [c]
              : c.parentCommentId != null
                ? []
                : [
                    {
                      ...c,
                      deleted: true,
                      content: '',
                      mine: false,
                      author: { userId: 0, nickname: null, profileImageKey: null },
                    },
                  ],
          ),
        )
      }
      renderReplies={(root, render) =>
        render({
          comments: comments.filter((c) => c.parentCommentId === root.commentId),
          loading: false,
          error: false,
          hasMore: false,
          loadingMore: false,
          onLoadMore: () => {},
          onRetry: () => {},
        })
      }
    />
  );
}

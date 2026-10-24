import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FeedCommentThread } from '@/components/feed/feed-comment-thread';
import type { FeedComment, FeedRepliesState } from '@/components/screens/feed/types';
import { DEMO_FEED_COMMENTS } from '@/mocks/fixtures';

const ROOT = { ...DEMO_FEED_COMMENTS[0], replyCount: 2 };
const REPLY: FeedComment = {
  ...DEMO_FEED_COMMENTS[1],
  commentId: 401,
  parentCommentId: 301,
  replyToCommentId: 301,
};
const SECOND: FeedComment = { ...REPLY, commentId: 402, replyToCommentId: 401, content: '나도!' };
const state = (over: Partial<FeedRepliesState> = {}): FeedRepliesState => ({
  comments: [REPLY, SECOND],
  loading: false,
  error: false,
  hasMore: false,
  loadingMore: false,
  onLoadMore: jest.fn(),
  onRetry: jest.fn(),
  ...over,
});

it('펼칠 때만 대댓글을 받고 답글의 답글도 같은 들여쓰기 안에 그린다', async () => {
  const onReply = jest.fn();
  const renderReplies = jest.fn((_root, show) => show(state()));
  const ui = await render(
    <FeedCommentThread root={ROOT} onReply={onReply} renderReplies={renderReplies} />,
  );
  expect(renderReplies).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByText('답글 2개 보기'));
  const container = ui.getByTestId('feed-replies-301');
  expect(StyleSheet.flatten(container.props.style).marginLeft).toBeGreaterThan(0);
  expect(within(container).getByTestId('feed-comment-401')).toBeTruthy();
  expect(within(container).getByTestId('feed-comment-402')).toBeTruthy();
  expect(within(container).getByText('@나')).toBeTruthy();
  // 둘은 같은 스레드의 형제 행. 답글에 다시 답해도 깊이를 추가하지 않는다.
  expect(within(ui.getByTestId('feed-comment-401')).queryByTestId('feed-comment-402')).toBeNull();
  await fireEvent.press(within(ui.getByTestId('feed-comment-401')).getByLabelText('나에게 답글'));
  expect(onReply).toHaveBeenCalledWith(REPLY);
  await fireEvent.press(ui.getByText('답글 접기'));
  expect(ui.queryByTestId('feed-replies-301')).toBeNull();
});

it('삭제된 원댓글은 작성자·삭제·더보기·답글 동작 없이 남은 답글을 보존한다', async () => {
  const ui = await render(
    <FeedCommentThread
      root={{ ...ROOT, deleted: true, mine: true }}
      onReply={jest.fn()}
      onDelete={jest.fn()}
      onMenu={jest.fn()}
      renderReplies={(_root, show) => show(state())}
    />,
  );
  expect(ui.getByText('삭제된 댓글이에요.')).toBeTruthy();
  expect(ui.queryByText(ROOT.content)).toBeNull();
  expect(ui.queryByLabelText('이웃에게 답글')).toBeNull();
  expect(ui.queryByLabelText('내 댓글 삭제')).toBeNull();
  expect(ui.queryByLabelText('댓글 더보기')).toBeNull();
  await fireEvent.press(ui.getByText('답글 2개 보기'));
  expect(ui.getByText(SECOND.content)).toBeTruthy();
  expect(ui.queryByText('@이웃')).toBeNull();
});

it('없는 대상 id는 작성자를 추측하지 않고, 페이지 오류·재시도·더보기를 제공한다', async () => {
  const replies = state({
    comments: [{ ...REPLY, replyToCommentId: 999 }],
    error: true,
    hasMore: true,
  });
  const ui = await render(
    <FeedCommentThread root={ROOT} renderReplies={(_root, show) => show(replies)} />,
  );
  await fireEvent.press(ui.getByText('답글 2개 보기'));
  expect(ui.queryByText(/^@/)).toBeNull();
  expect(ui.getByText('답글을 불러오지 못했어요.')).toBeTruthy();
  await fireEvent.press(ui.getByText('다시 시도'));
  expect(replies.onRetry).toHaveBeenCalledTimes(1);
  await fireEvent.press(ui.getByText('답글 더 보기'));
  expect(replies.onLoadMore).toHaveBeenCalledTimes(1);
});

it('답글을 불러오는 동안 비어 있다는 안내를 먼저 띄우지 않는다', async () => {
  const ui = await render(
    <FeedCommentThread
      root={ROOT}
      renderReplies={(_root, show) => show(state({ comments: [], loading: true }))}
    />,
  );
  await fireEvent.press(ui.getByText('답글 2개 보기'));
  expect(ui.queryByText('아직 답글이 없어요.')).toBeNull();
});

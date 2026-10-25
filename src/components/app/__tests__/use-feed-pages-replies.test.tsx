import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  createFeedComment,
  deleteFeedComment,
  fetchFeedComments,
  fetchFeedPost,
  fetchFeedReplies,
} from '@/api/feed';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import type { FeedComment } from '@/components/screens/feed/types';
import { DEMO_FEED_COMMENTS, DEMO_FEED_TEXT_POST } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: true,
}));
jest.mock('@/api/auth', () => ({
  getSessionUserId: () => 7,
  getAccessToken: () => null,
  onSessionCleared: () => () => {},
  refreshSession: async () => false,
}));
jest.mock('@/api/feed', () => ({
  fetchFeedPosts: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(),
  fetchFeedReplies: jest.fn(),
  createFeedComment: jest.fn(),
  deleteFeedComment: jest.fn(),
  fetchFeedImage: jest.fn(async () => null),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const ROOT: FeedComment = { ...DEMO_FEED_COMMENTS[0], postId: 4, replyCount: 1, mine: true };
const REPLY: FeedComment = {
  ...DEMO_FEED_COMMENTS[1],
  postId: 4,
  commentId: 401,
  parentCommentId: 301,
  replyToCommentId: 301,
  mine: false,
};
function Harness() {
  const [screen, setScreen] = useState<Screen>('feed');
  const pages = useFeedPages({ nav: { screen, setScreen, goBack: () => setScreen('feed') } });
  return (
    <View>
      <Pressable accessibilityLabel="상세 열기" onPress={() => pages.tabProps.onOpenPost?.(4)} />
      {pages.subScreen}
    </View>
  );
}

it('실제 앱 연결부: 답글 펼치기 → 대댓글에 답글 작성 → 재조회 → 삭제 시 남은 대화 유지', async () => {
  let root = ROOT;
  const replies = [REPLY];
  jest.mocked(fetchFeedPost).mockImplementation(async () => ({
    ...DEMO_FEED_TEXT_POST,
    commentCount: (root.deleted ? 0 : 1) + replies.length,
  }));
  jest.mocked(fetchFeedComments).mockImplementation(async () => ({
    items: [{ ...root, replyCount: replies.length }],
    hasNext: false,
  }));
  jest
    .mocked(fetchFeedReplies)
    .mockImplementation(async () => ({ items: [...replies], hasNext: false }));
  jest.mocked(createFeedComment).mockImplementation(async (_post, input) => {
    const comment = {
      ...REPLY,
      commentId: 402,
      mine: true,
      content: input.content,
      replyToCommentId: input.replyToCommentId ?? null,
    };
    replies.push(comment);
    return comment;
  });
  jest.mocked(deleteFeedComment).mockImplementation(async () => {
    root = {
      ...ROOT,
      mine: false,
      content: '',
      deleted: true,
      author: { userId: 0, nickname: null, profileImageKey: null },
    };
  });
  const client = createTestQueryClient();
  try {
    const ui = await render(<Harness />, { wrapper: queryWrapper(client) });
    await fireEvent.press(ui.getByLabelText('상세 열기'));
    await waitFor(() => expect(ui.getByText('답글 1개 보기')).toBeTruthy());
    expect(fetchFeedReplies).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByText('답글 1개 보기'));
    await waitFor(() => expect(ui.getByTestId('feed-comment-401')).toBeTruthy());
    await fireEvent.press(within(ui.getByTestId('feed-comment-401')).getByLabelText('나에게 답글'));
    await fireEvent.changeText(ui.getByLabelText('댓글 입력'), '나도 같이 할래');
    await fireEvent.press(ui.getByLabelText('보내기'));
    expect(createFeedComment).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ replyToCommentId: 401, content: '나도 같이 할래' }),
    );
    await waitFor(() => expect(ui.getByText('나도 같이 할래')).toBeTruthy());
    expect(ui.queryByLabelText('답글 취소')).toBeNull();
    await fireEvent.press(
      within(ui.getByTestId('feed-comment-301')).getByLabelText('내 댓글 삭제'),
    );
    const confirm = ui.getAllByText('삭제');
    await fireEvent.press(confirm[confirm.length - 1]);
    await waitFor(() => expect(ui.getByText('삭제된 댓글이에요.')).toBeTruthy());
    expect(ui.getByText('나도 같이 할래')).toBeTruthy();
    expect(fetchFeedComments).toHaveBeenCalledWith(4, {
      size: 20,
      cursor: undefined,
      topLevelOnly: true,
    });
    expect(fetchFeedReplies).toHaveBeenCalledWith(4, 301, { size: 20, cursor: undefined });
  } finally {
    client.clear();
  }
});

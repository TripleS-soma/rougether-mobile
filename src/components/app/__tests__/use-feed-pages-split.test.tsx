import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { fetchFeedPost, fetchFeedPosts } from '@/api/feed';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import type { AppFrame } from '@/hooks/use-app-frame';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

// 2단 피드 탭 — 글 상세가 서브화면이 아니라 피드 탭의 오른쪽 칸(`detailPane`)에 열린다.
const PHONE: AppFrame = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false, split: false }; // prettier-ignore
const SPLIT: AppFrame = { ...PHONE, width: 951, height: 669, framed: true, split: true, splitFill: true }; // prettier-ignore
let mockFrame: AppFrame = PHONE;
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));
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
  fetchFeedImage: jest.fn(async () => null),
  fetchFeedPosts: jest.fn(),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const [FIRST, SECOND] = DEMO_FEED_POSTS;

function Harness({ start = 'feed' }: { start?: Screen }) {
  const [screen, setScreen] = useState<Screen>(start);
  const pages = useFeedPages({ nav: { screen, setScreen, goBack: () => setScreen('feed') } });
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Text testID="selected">{String(pages.tabProps.selectedPostId ?? 'none')}</Text>
      <Pressable accessibilityLabel="둘째 글 열기" onPress={() => pages.openPost(SECOND.postId)} />
      <View testID="pane">{pages.detailPane}</View>
      <View testID="sub">{pages.subScreen}</View>
    </View>
  );
}

const clients: ReturnType<typeof createTestQueryClient>[] = [];
const mount = async (start?: Screen) => {
  const client = createTestQueryClient();
  clients.push(client);
  return render(<Harness start={start} />, { wrapper: queryWrapper(client) });
};
beforeEach(() => {
  jest.mocked(fetchFeedPosts).mockResolvedValue({ items: [FIRST, SECOND], hasNext: false });
  jest
    .mocked(fetchFeedPost)
    .mockImplementation(async (id) => (id === SECOND.postId ? SECOND : FIRST));
});
afterEach(() => {
  mockFrame = PHONE;
  clients.splice(0).forEach((client) => client.clear());
});

it('한 칸(폰)은 종전대로 — 글을 열면 서브화면으로 넘어가고 오른쪽 칸은 없다', async () => {
  const ui = await mount();
  expect(ui.getByTestId('pane').children).toHaveLength(0);
  expect(ui.getByTestId('selected').props.children).toBe('none');
  await fireEvent.press(ui.getByLabelText('둘째 글 열기'));
  expect(ui.getByTestId('screen').props.children).toBe('feedPost');
  await waitFor(() => expect(ui.getByTestId('sub').children.length).toBeGreaterThan(0));
});

it('2단은 목록의 첫 글을 고른 채로 시작하고, 다른 글을 열어도 피드 탭에 머문다', async () => {
  mockFrame = SPLIT;
  const ui = await mount();
  await waitFor(() => expect(ui.getByTestId('selected').props.children).toBe(String(FIRST.postId)));
  expect(ui.getByTestId('pane').children.length).toBeGreaterThan(0);
  await fireEvent.press(ui.getByLabelText('둘째 글 열기'));
  expect(ui.getByTestId('screen').props.children).toBe('feed');
  expect(ui.getByTestId('selected').props.children).toBe(String(SECOND.postId));
  expect(ui.getByTestId('sub').children).toHaveLength(0);
  // 오른쪽 칸의 상세에는 뒤로 버튼이 없다 — 돌아갈 화면이 없다.
  expect(ui.queryByLabelText('뒤로')).toBeNull();
});

it('2단에서 다른 화면(알림 등)에서 글을 열면 피드 탭의 오른쪽 칸으로 간다', async () => {
  mockFrame = SPLIT;
  const ui = await mount('myRoom');
  await fireEvent.press(ui.getByLabelText('둘째 글 열기'));
  expect(ui.getByTestId('screen').props.children).toBe('feed');
  await waitFor(() =>
    expect(ui.getByTestId('selected').props.children).toBe(String(SECOND.postId)),
  );
});

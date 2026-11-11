import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createFeedPost, fetchFeedPost } from '@/api/feed';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/constants/feed', () => ({
  ...jest.requireActual('@/constants/feed'),
  FEED_ENABLED: true,
}));
jest.mock('@/api/auth', () => ({
  getSessionUserId: () => 4,
  getAccessToken: () => null,
  onSessionCleared: () => () => {},
  refreshSession: async () => false,
}));
jest.mock('@/api/feed', () => ({
  fetchFeedImage: jest.fn(async () => null),
  fetchFeedPosts: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
  createFeedPost: jest.fn(),
  uploadFeedImage: jest.fn(),
  deleteFeedImage: jest.fn(),
  clearFeedImageCache: jest.fn(),
}));
jest.mock('@/api/feed-houses', () => ({
  fetchFeedAuthorHouses: jest.fn(),
  joinFeedAuthorHouse: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const HOUSES = [
  { houseId: 3, name: '아침을 여는 집' },
  // houseId 없는 집(데모·로컬)은 올릴 곳이 될 수 없다.
  { name: '데모 집' },
];

function Harness({ houses }: { houses?: { houseId?: number; name: string }[] }) {
  const [screen, setScreen] = useState<Screen>('feedCompose');
  const pages = useFeedPages({
    nav: { screen, setScreen, goBack: () => setScreen('feed') },
    houses,
  });
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Pressable accessibilityLabel="게시물 열기" onPress={() => pages.openPost(900)} />
      {pages.subScreen}
    </View>
  );
}

const clients: ReturnType<typeof createTestQueryClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

async function mount(houses?: { houseId?: number; name: string }[]) {
  const client = createTestQueryClient();
  clients.push(client);
  return render(<Harness houses={houses} />, { wrapper: queryWrapper(client) });
}

beforeEach(() => {
  jest.mocked(createFeedPost).mockReset().mockResolvedValue(DEMO_FEED_POSTS[1]);
});

describe('공개 피드 글쓰기의 올릴 곳 (집 피드)', () => {
  it('내 집이 없으면 선택 자체가 없고, 종전대로 전체 공개로 올린다', async () => {
    const ui = await mount([]);
    expect(ui.queryByTestId('feed-scope')).toBeNull();
    await fireEvent.changeText(ui.getByLabelText('본문'), '모두에게');
    await fireEvent.press(ui.getByLabelText('올리기'));
    await waitFor(() => expect(createFeedPost).toHaveBeenCalled());
    expect(jest.mocked(createFeedPost).mock.calls[0][0]).not.toHaveProperty('houseId');
  });

  it('내 집이 있으면 기본은 전체 공개 — 그대로 올리면 houseId가 없다', async () => {
    const ui = await mount(HOUSES);
    expect(ui.getByText('전체 공개')).toBeTruthy();
    await fireEvent.changeText(ui.getByLabelText('본문'), '모두에게');
    await fireEvent.press(ui.getByLabelText('올리기'));
    await waitFor(() => expect(createFeedPost).toHaveBeenCalled());
    expect(jest.mocked(createFeedPost).mock.calls[0][0]).not.toHaveProperty('houseId');
  });

  it('집을 고르면 그 집에만 올린다 — houseId 없는 집은 선택지에 없다', async () => {
    jest.mocked(createFeedPost).mockResolvedValue({ ...DEMO_FEED_POSTS[1], houseId: 3 });
    const ui = await mount(HOUSES);
    await fireEvent.press(ui.getByTestId('feed-scope'));
    expect(await ui.findByTestId('feed-scope-option-3')).toBeTruthy();
    expect(ui.queryByText('데모 집')).toBeNull();
    await fireEvent.press(ui.getByTestId('feed-scope-option-3'));
    await waitFor(() => expect(ui.getByText('아침을 여는 집에만 올려요')).toBeTruthy());
    await fireEvent.changeText(ui.getByLabelText('본문'), '우리 집에만');
    await fireEvent.press(ui.getByLabelText('올리기'));
    await waitFor(() => expect(createFeedPost).toHaveBeenCalled());
    expect(jest.mocked(createFeedPost).mock.calls[0][0]).toEqual(
      expect.objectContaining({ houseId: 3, content: '우리 집에만' }),
    );
    await waitFor(() => expect(ui.getByTestId('screen').props.children).toBe('feed'));
  });

  it("댓글 알림 등으로 공개 상세에서 연 집 글에는 '입주 신청'을 보이지 않는다", async () => {
    jest
      .mocked(fetchFeedPost)
      .mockResolvedValue({ ...DEMO_FEED_POSTS[0], postId: 900, houseId: 3, mine: false });
    const ui = await mount(HOUSES);
    await fireEvent.press(ui.getByLabelText('게시물 열기'));
    await waitFor(() => expect(fetchFeedPost).toHaveBeenCalledWith(900));
    await waitFor(() => expect(ui.getByText(/오늘 아침 루틴 완료/)).toBeTruthy());
    expect(ui.queryByText('입주 신청')).toBeNull();
  });
});

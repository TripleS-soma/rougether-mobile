import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createFeedPost, fetchFeedPost, fetchFeedPosts } from '@/api/feed';
import { ApiError } from '@/api/http';
import type { Screen } from '@/components/app/navigation';
import { houseOwnerUserId, useHouseFeedPages } from '@/components/app/use-house-feed-pages';
import type { House } from '@/components/screens/house/types';
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
  fetchFeedPosts: jest.fn(),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
  createFeedPost: jest.fn(),
  uploadFeedImage: jest.fn(),
  deleteFeedImage: jest.fn(),
  clearFeedImageCache: jest.fn(),
  fetchHouseFeedNotification: jest.fn(async (houseId: number) => ({
    houseId,
    freePostPush: true,
    verificationPostPush: false,
  })),
  updateHouseFeedNotification: jest.fn(),
}));
jest.mock('@/api/chat', () => ({
  ensureHouseChatRoom: jest.fn(async () => ({ roomId: 70, lastSequence: 0, readers: [] })),
  fetchChatNotification: jest.fn(async () => ({ roomId: 70, muted: false })),
  updateChatNotification: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const house = (houseId: number, name: string, ownerUserId: number): House => ({
  name,
  houseId,
  myRole: ownerUserId === 4 ? 'OWNER' : 'MEMBER',
  floors: [
    {
      level: '1F',
      rooms: [
        { name: '나', color: '#fff', isMine: true, userId: 4, isOwner: ownerUserId === 4 },
        { name: '솜이', color: '#fff', userId: 7, isOwner: ownerUserId === 7 },
      ],
    },
  ],
});
const HOUSES = [house(3, '아침을 여는 집', 7), house(8, '밤 산책 모임', 4)];
const HOUSE_POST = { ...DEMO_FEED_POSTS[0], postId: 900, houseId: 3 };

function Harness({
  houses = HOUSES,
  housesLoading = false,
  onClosed,
  push,
}: {
  houses?: House[];
  housesLoading?: boolean;
  onClosed?: () => void;
  push?: { houseId?: number; postId?: number };
}) {
  const [screen, setScreen] = useState<Screen>('house');
  const [houseIndex, setHouseIndex] = useState(0);
  const pages = useHouseFeedPages({
    nav: {
      screen,
      setScreen,
      goBack: () => setScreen(screen === 'houseFeed' ? 'house' : 'houseFeed'),
    },
    currentHouse: houses[houseIndex],
    houses,
    housesLoading,
    setHouseIndex,
    onClosed,
  });
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Text testID="house-index">{houseIndex}</Text>
      {pages.open ? <Pressable accessibilityLabel="집 피드 열기" onPress={pages.open} /> : null}
      <Pressable
        accessibilityLabel="푸시 탭"
        onPress={() => pages.openPostFor(push?.houseId, push?.postId)}
      />
      {pages.subScreen}
    </View>
  );
}

const clients: ReturnType<typeof createTestQueryClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

async function mount(props: Parameters<typeof Harness>[0] = {}) {
  const client = createTestQueryClient();
  clients.push(client);
  const ui = await render(<Harness {...props} />, { wrapper: queryWrapper(client) });
  const screenOf = () => ui.getByTestId('screen').props.children as Screen;
  return { ui, screenOf };
}

beforeEach(() => {
  jest
    .mocked(fetchFeedPosts)
    .mockReset()
    .mockResolvedValue({ items: [HOUSE_POST], hasNext: false });
  jest.mocked(fetchFeedPost).mockReset().mockResolvedValue(HOUSE_POST);
  jest.mocked(createFeedPost).mockReset().mockResolvedValue(HOUSE_POST);
});

describe('houseOwnerUserId', () => {
  it('방장 좌석의 userId, 없으면 undefined', () => {
    expect(houseOwnerUserId(HOUSES[0])).toBe(7);
    expect(houseOwnerUserId(HOUSES[1])).toBe(4);
    expect(houseOwnerUserId(undefined)).toBeUndefined();
  });
});

describe('useHouseFeedPages (집 피드)', () => {
  it('집 화면에 있는 동안에는 요청하지 않고, 열면 그 집의 글만 묻는다', async () => {
    const { ui, screenOf } = await mount();
    expect(fetchFeedPosts).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText('집 피드 열기'));
    expect(screenOf()).toBe('houseFeed');
    await waitFor(() =>
      expect(fetchFeedPosts).toHaveBeenCalledWith(expect.objectContaining({ houseId: 3 })),
    );
    expect(ui.getByText('아침을 여는 집 피드')).toBeTruthy();
    expect(ui.getByText('이 집 구성원만 볼 수 있어요')).toBeTruthy();
    // 집 피드에는 '내 글' 탭이 없다.
    expect(ui.queryByLabelText('내 글 게시판')).toBeNull();
    // 작성자를 앞세운 줄 — 방장(userId 7)의 글에 배지.
    await waitFor(() => expect(ui.getByTestId('feed-post-author-900')).toBeTruthy());
    expect(ui.getByText('방장')).toBeTruthy();
  });

  it('글쓰기는 그 집으로 고정 — 올리면 houseId를 싣고 목록으로 돌아온다', async () => {
    const { ui, screenOf } = await mount();
    await fireEvent.press(ui.getByLabelText('집 피드 열기'));
    await fireEvent.press(ui.getByLabelText('게시물 쓰기'));
    expect(screenOf()).toBe('houseFeedCompose');
    expect(ui.getByText('아침을 여는 집에 올려요')).toBeTruthy();
    expect(ui.queryByText('바꾸기')).toBeNull();
    await fireEvent.changeText(ui.getByLabelText('본문'), '우리 집에만');
    await fireEvent.press(ui.getByLabelText('올리기'));
    await waitFor(() => expect(createFeedPost).toHaveBeenCalled());
    expect(jest.mocked(createFeedPost).mock.calls[0][0]).toEqual(
      expect.objectContaining({ houseId: 3, content: '우리 집에만', boardType: 'FREE' }),
    );
    await waitFor(() => expect(screenOf()).toBe('houseFeed'));
  });

  it("상세에는 '입주 신청'이 없고, 뒤로 가면 집 피드 목록", async () => {
    const { ui, screenOf } = await mount();
    await fireEvent.press(ui.getByLabelText('집 피드 열기'));
    await fireEvent.press(await ui.findByLabelText('루틴친구의 게시물 보기'));
    expect(screenOf()).toBe('houseFeedPost');
    await waitFor(() => expect(fetchFeedPost).toHaveBeenCalledWith(900));
    expect(ui.queryByText('입주 신청')).toBeNull();
    await fireEvent.press(ui.getByLabelText('뒤로 가기'));
    expect(screenOf()).toBe('houseFeed');
  });

  it('종 버튼은 이 집 알림 시트를 연다', async () => {
    const { ui } = await mount();
    await fireEvent.press(ui.getByLabelText('집 피드 열기'));
    await fireEvent.press(ui.getByLabelText('이 집 알림 설정'));
    expect(await ui.findByText('이 집 알림')).toBeTruthy();
    expect(ui.getByLabelText('자유글 알림')).toBeTruthy();
    expect(ui.getByLabelText('인증글 알림')).toBeTruthy();
  });

  it('새 글 푸시 — 그 집을 고르고 글 상세로', async () => {
    const { ui, screenOf } = await mount({ push: { houseId: 8, postId: 900 } });
    await fireEvent.press(ui.getByLabelText('푸시 탭'));
    expect(ui.getByTestId('house-index').props.children).toBe(1);
    expect(screenOf()).toBe('houseFeedPost');
    await waitFor(() => expect(fetchFeedPost).toHaveBeenCalledWith(900));
  });

  it('푸시 — 모르는 집(나간 집)이면 집 탭에 머문다', async () => {
    const { ui, screenOf } = await mount({ push: { houseId: 99, postId: 900 } });
    await fireEvent.press(ui.getByLabelText('푸시 탭'));
    expect(screenOf()).toBe('house');
    expect(fetchFeedPost).not.toHaveBeenCalled();
  });

  it('푸시 — 집 목록이 아직 없으면 기억했다가 목록이 오면 연다', async () => {
    const { ui, screenOf } = await mount({
      houses: [],
      housesLoading: true,
      push: { houseId: 8, postId: 900 },
    });
    await fireEvent.press(ui.getByLabelText('푸시 탭'));
    expect(screenOf()).toBe('house');
    await ui.rerender(<Harness push={{ houseId: 8, postId: 900 }} />);
    await waitFor(() => expect(screenOf()).toBe('houseFeedPost'));
    expect(ui.getByTestId('house-index').props.children).toBe(1);
  });

  it('푸시로 연 글이 지워졌거나 볼 수 없으면(404) 안내 후 집 피드 목록으로', async () => {
    jest
      .mocked(fetchFeedPost)
      .mockRejectedValue(
        new ApiError(
          404,
          'GET',
          '/feed/posts/900',
          JSON.stringify({ code: 'FEED_POST_NOT_FOUND' }),
        ),
      );
    const { ui, screenOf } = await mount({ push: { houseId: 3, postId: 900 } });
    await fireEvent.press(ui.getByLabelText('푸시 탭'));
    await waitFor(() => expect(screenOf()).toBe('houseFeed'));
  });

  it('구성원이 아니게 된 집(403)은 집 탭으로 돌려보내고 집 목록을 새로 받게 한다', async () => {
    jest
      .mocked(fetchFeedPosts)
      .mockRejectedValue(
        new ApiError(403, 'GET', '/feed/posts', JSON.stringify({ code: 'HOUSE_NOT_MEMBER' })),
      );
    const onClosed = jest.fn();
    const { ui, screenOf } = await mount({ onClosed });
    await fireEvent.press(ui.getByLabelText('집 피드 열기'));
    await waitFor(() => expect(screenOf()).toBe('house'));
    expect(onClosed).toHaveBeenCalled();
  });

  it('houseId가 없는 집(데모)에서는 진입로가 없다', async () => {
    const demo: House = { ...HOUSES[0], houseId: undefined };
    const { ui } = await mount({ houses: [demo] });
    expect(ui.queryByLabelText('집 피드 열기')).toBeNull();
  });
});

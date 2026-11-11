import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { fetchFeedPost } from '@/api/feed';
import { fetchFeedAuthorHouses, joinFeedAuthorHouse } from '@/api/feed-houses';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
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
  fetchFeedImage: jest.fn(async () => null),
  fetchFeedPosts: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
}));
jest.mock('@/api/feed-houses', () => ({
  fetchFeedAuthorHouses: jest.fn(),
  joinFeedAuthorHouse: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

function Harness({ onOpenHouse }: { onOpenHouse: (id: number) => void }) {
  const [screen, setScreen] = useState<Screen>('feed');
  const pages = useFeedPages({
    nav: { screen, setScreen, goBack: () => setScreen('feed') },
    onOpenHouse,
  });
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Pressable
        accessibilityLabel="게시물 열기"
        onPress={() => pages.openPost(DEMO_FEED_POSTS[0].postId)}
      />
      {pages.subScreen}
    </View>
  );
}

const clients: ReturnType<typeof createTestQueryClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it.each([false, true])(
  '바로 입주 설정=%s일 때 실제 참여 응답에 따라 집 이동 또는 승인 대기를 처리한다',
  async (immediate) => {
    jest.mocked(fetchFeedPost).mockResolvedValue({ ...DEMO_FEED_POSTS[0], mine: false });
    jest.mocked(fetchFeedAuthorHouses).mockResolvedValue([
      {
        houseId: 20,
        name: '이웃 집',
        coverImageKey: null,
        level: 0,
        displayMode: 'DIORAMA',
        isPublic: false,
        requiresApproval: !immediate,
        currentMemberCount: 1,
        maxMembers: 4,
        isMember: false,
        isFull: false,
        myMembershipStatus: null,
        myJoinRequestStatus: null,
        canJoin: true,
      },
    ]);
    jest.mocked(joinFeedAuthorHouse).mockResolvedValue({
      houseId: 20,
      membershipId: immediate ? 31 : null,
      status: immediate ? 'ACTIVE' : null,
      pendingApproval: !immediate,
      joinRequestId: immediate ? null : 30,
    });
    const onOpenHouse = jest.fn();
    const client = createTestQueryClient();
    clients.push(client);
    const ui = await render(<Harness onOpenHouse={onOpenHouse} />, {
      wrapper: queryWrapper(client),
    });
    await fireEvent.press(ui.getByLabelText('게시물 열기'));
    await waitFor(() => expect(ui.getByText('입주 신청')).toBeTruthy());
    expect(fetchFeedAuthorHouses).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByText('입주 신청'));
    await waitFor(() => expect(ui.getByLabelText('이웃 집, 입주 신청')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('이웃 집, 입주 신청'));
    await waitFor(() =>
      expect(joinFeedAuthorHouse).toHaveBeenCalledWith(DEMO_FEED_POSTS[0].postId, 20),
    );
    if (immediate) await waitFor(() => expect(onOpenHouse).toHaveBeenCalledWith(20));
    else {
      await waitFor(() => expect(ui.queryByText('어느 집에 입주할까요?')).toBeNull());
      expect(onOpenHouse).not.toHaveBeenCalled();
      expect(ui.getByTestId('screen').props.children).toBe('feedPost');
    }
  },
);

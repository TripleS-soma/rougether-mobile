import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createFeedPost, uploadFeedImage } from '@/api/feed';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

// 채팅 사진 크게 보기의 [피드에 올리기] → 피드 작성 (2026-11-11). 피드가 켜진 빌드를 본다.
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
  createFeedPost: jest.fn(),
  deleteFeedImage: jest.fn(async () => undefined),
  uploadFeedImage: jest.fn(),
  fetchFeedImage: jest.fn(async () => null),
  fetchFeedPosts: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const PHOTO_URI = `data:image/jpeg;base64,${'A'.repeat(400)}`;

function Harness() {
  // 집 채팅에서 사진을 크게 보다가 누른다.
  const [screen, setScreen] = useState<Screen>('houseChat');
  const pages = useFeedPages({
    nav: { screen, setScreen, goBack: () => setScreen('feed') },
    openGame: jest.fn(),
  });
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Pressable
        accessibilityLabel="피드에 올리기 테스트"
        onPress={() => pages.sharePhoto(PHOTO_URI)}
      />
      {pages.subScreen}
    </View>
  );
}

const clients: ReturnType<typeof createTestQueryClient>[] = [];
function wrapper() {
  const client = createTestQueryClient();
  clients.push(client);
  return queryWrapper(client);
}

beforeEach(() => {
  jest.mocked(uploadFeedImage).mockReset().mockResolvedValue({ imageId: 501 });
  jest.mocked(createFeedPost).mockReset().mockResolvedValue(DEMO_FEED_POSTS[0]);
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it('[피드에 올리기]는 그 사진을 올려 붙인 자유게시판 작성을 열고, 직접 올려야 게시된다', async () => {
  const ui = await render(<Harness />, { wrapper: wrapper() });
  await fireEvent.press(ui.getByLabelText('피드에 올리기 테스트'));
  expect(ui.getByTestId('screen').props.children).toBe('feedCompose');
  expect(ui.getByLabelText('자유 게시판').props.accessibilityState).toMatchObject({
    selected: true,
  });
  // 메모리의 사진을 파일 꼴로 바꿔 피드 업로드로 올린다 — 형식·이름은 data URI에서 읽는다.
  await waitFor(() => expect(uploadFeedImage).toHaveBeenCalledTimes(1));
  expect(jest.mocked(uploadFeedImage).mock.calls[0][0]).toEqual({
    uri: PHOTO_URI,
    name: 'chat-photo.jpg',
    type: 'image/jpeg',
  });
  // 자동으로 게시하지 않는다.
  expect(createFeedPost).not.toHaveBeenCalled();

  await waitFor(() =>
    expect(ui.getByLabelText('올리기').props.accessibilityState).toMatchObject({ disabled: false }),
  );
  await fireEvent.press(ui.getByLabelText('올리기'));
  await waitFor(() => expect(ui.getByTestId('screen').props.children).toBe('feed'));
  await act(async () => {});
  const [body] = jest.mocked(createFeedPost).mock.calls[0];
  expect(body).toMatchObject({ boardType: 'FREE', imageIds: [501] });
});

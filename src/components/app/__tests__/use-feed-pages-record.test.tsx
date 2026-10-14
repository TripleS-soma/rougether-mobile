import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createFeedPost } from '@/api/feed';
import type { Screen } from '@/components/app/navigation';
import { useFeedPages } from '@/components/app/use-feed-pages';
import { DEMO_FEED_RECORD_POST, DEMO_MINIGAME_RECORD_DRAFT } from '@/mocks/fixtures';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';

// 미니게임 [자랑하기] → 피드 작성 (서버 feat/feed-minigame-record). 피드가 켜진 빌드를 본다.
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
  deleteFeedImage: jest.fn(),
  uploadFeedImage: jest.fn(),
  fetchFeedImage: jest.fn(async () => null),
  fetchFeedPosts: jest.fn(async () => ({ items: [], hasNext: false })),
  fetchFeedPost: jest.fn(),
  fetchFeedComments: jest.fn(async () => ({ items: [], hasNext: false })),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const DRAFT_TEXT = '🐱 고양이 탑 쌓기 1,240점, 전체 3위 달성!';

let lastTabProps: object = {};
function Harness({ openGame }: { openGame: (gameCode: string) => void }) {
  const [screen, setScreen] = useState<Screen>('minigameRunner');
  const pages = useFeedPages({
    nav: { screen, setScreen, goBack: () => setScreen('feed') },
    openGame,
  });
  lastTabProps = pages.tabProps;
  return (
    <View>
      <Text testID="screen">{screen}</Text>
      <Pressable
        accessibilityLabel="자랑하기 테스트"
        onPress={() => pages.shareRecord(DEMO_MINIGAME_RECORD_DRAFT)}
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
  jest.mocked(createFeedPost).mockReset().mockResolvedValue(DEMO_FEED_RECORD_POST);
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it('[자랑하기]는 자유게시판·본문 초안·기록 카드로 작성을 열고, 올리면 runId를 싣는다', async () => {
  const ui = await render(<Harness openGame={jest.fn()} />, { wrapper: wrapper() });
  await fireEvent.press(ui.getByLabelText('자랑하기 테스트'));
  expect(ui.getByTestId('screen').props.children).toBe('feedCompose');
  expect(ui.getByDisplayValue(DRAFT_TEXT)).toBeTruthy();
  expect(ui.getByText('1,240점')).toBeTruthy();
  expect(ui.getByLabelText('자유 게시판').props.accessibilityState).toMatchObject({
    selected: true,
  });
  // 자동으로 올리지 않는다.
  expect(createFeedPost).not.toHaveBeenCalled();

  await fireEvent.press(ui.getByLabelText('올리기'));
  await waitFor(() => expect(ui.getByTestId('screen').props.children).toBe('feed'));
  await act(async () => {});
  const [body] = jest.mocked(createFeedPost).mock.calls[0];
  expect(body).toMatchObject({
    boardType: 'FREE',
    content: DRAFT_TEXT,
    minigameRecord: { runId: 'demo-run-1' },
  });
});

// 목록은 줄만 보여 준다(에브리타임식) — [나도 도전하기]는 상세의 기록 카드에서만(상세 배선은
// feed-minigame-record.test가 본다). 목록 props에 도전 콜백이 다시 생기지 않게 잠근다.
it('피드 목록에는 도전·좋아요 콜백을 넘기지 않는다', async () => {
  const ui = await render(<Harness openGame={jest.fn()} />, { wrapper: wrapper() });
  expect(ui.getByTestId('screen')).toBeTruthy();
  expect(lastTabProps).not.toHaveProperty('onChallenge');
  expect(lastTabProps).not.toHaveProperty('onToggleLike');
});

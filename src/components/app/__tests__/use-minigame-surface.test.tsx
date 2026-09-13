import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { Screen } from '@/components/app/navigation';
import { MINIGAME_DEFINITIONS, PLAYABLE_MINIGAMES } from '@/constants/minigames';
import type { MinigamePlayerProps } from '@/components/app/minigame-player';
import { MinigameActiveContext, useMinigameSurface } from '@/components/app/use-minigame-surface';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import {
  fetchMinigames,
  fetchMinigameLeaderboard,
  startMinigameRun,
  finishMinigameRun,
} from '@/api/minigames';

jest.mock('@/api/minigames');
jest.mock('@/api/auth', () => ({ getSessionUserId: () => 7 }));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/components/app/minigame-player', () => {
  const { Text, View, Pressable } = jest.requireActual('react-native');
  return {
    MinigamePlayer: ({ gameCode, active, onFinish }: MinigamePlayerProps) => (
      <View>
        <Text testID="runner-active">{String(active)}</Text>
        <Text testID="selected-player">{gameCode}</Text>
        <Pressable
          accessibilityLabel="테스트 게임 완료"
          onPress={() =>
            onFinish(
              gameCode === 'room-runner'
                ? { ticks: 120, jumpTicks: [30] }
                : { ticks: 120, actions: [{ tick: 30, direction: 'LEFT' }] },
            )
          }>
          <Text>테스트 게임 완료</Text>
        </Pressable>
      </View>
    ),
  };
});

const catalog = jest.mocked(fetchMinigames);
const ranking = jest.mocked(fetchMinigameLeaderboard);
const start = jest.mocked(startMinigameRun);
const finish = jest.mocked(finishMinigameRun);
const clients: ReturnType<typeof createTestQueryClient>[] = [];

function Harness({ retainOutgoing = false }: { retainOutgoing?: boolean }) {
  const [screen, setScreen] = useState<Screen>('minigames');
  const { subScreen, activeSessionId } = useMinigameSurface({ screen, setScreen });
  const outgoing = useRef<ReactNode>(null);
  if (screen === 'minigameRunner') outgoing.current = subScreen;
  return (
    <MinigameActiveContext.Provider value={screen === 'minigameRunner' ? activeSessionId : null}>
      <View>{subScreen}</View>
      {retainOutgoing && screen !== 'minigameRunner' ? (
        <View testID="outgoing">{outgoing.current}</View>
      ) : null}
    </MinigameActiveContext.Provider>
  );
}

async function setup(retainOutgoing = false) {
  const client = createTestQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { retry: false, gcTime: Infinity },
  });
  clients.push(client);
  return render(<Harness retainOutgoing={retainOutgoing} />, { wrapper: queryWrapper(client) });
}

beforeEach(() => {
  jest.clearAllMocks();
  catalog.mockResolvedValue(PLAYABLE_MINIGAMES);
  ranking.mockResolvedValue({ items: [], myEntry: null, totalPlayers: 0 });
  start.mockImplementation(async (gameCode) => ({
    runId: `${gameCode}-run-1`,
    gameCode,
    rulesVersion: 2,
    seed: 42,
    maxTicks: gameCode === 'cat-stairs' ? 7200 : 18000,
    expiresAt: '2030-01-01T00:00:00Z',
  }));
  finish.mockResolvedValue({
    runId: 'saved-run',
    score: 20,
    bestScore: 20,
    personalBest: true,
    rank: 1,
  });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it('navigates catalog to runner and starts an authenticated run only on an explicit challenge', async () => {
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
  expect(start).not.toHaveBeenCalled();
  expect(ranking).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
  expect(ui.getByText('탭해서 점프')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('랭킹 도전'));
  await waitFor(() => expect(ui.getByTestId('runner-active').props.children).toBe('true'));
  expect(start).toHaveBeenCalledWith('room-runner', 2);
  expect(finish).not.toHaveBeenCalled();
});

it('logs where the leaderboard was opened from — the picker or a finished game (#1315)', async () => {
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('루틴 러너 랭킹')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('루틴 러너 랭킹'));
  expect(mockTrack).toHaveBeenLastCalledWith('minigame_leaderboard_view', {
    game: 'room-runner',
    via: 'picker',
  });
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));

  await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
  await fireEvent.press(ui.getByLabelText('랭킹 도전'));
  await waitFor(() => expect(ui.getByLabelText('테스트 게임 완료')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
  await waitFor(() => expect(ui.getByLabelText('전체 유저 랭킹 보기')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('전체 유저 랭킹 보기'));
  expect(mockTrack).toHaveBeenLastCalledWith('minigame_leaderboard_view', {
    game: 'cat-stairs',
    via: 'result',
  });
});

it('keeps a retained outgoing runner inactive and starts fresh when returning', async () => {
  const ui = await setup(true);
  await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
  await fireEvent.press(ui.getByLabelText('연습하기 · 랭킹 미기록'));
  expect(ui.getByTestId('runner-active').props.children).toBe('true');
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await waitFor(() => expect(ui.getByTestId('runner-active').props.children).toBe('false'));
  await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
  expect(ui.queryByTestId('runner-active')).toBeNull();
  expect(ui.getByText('탭해서 점프')).toBeTruthy();
  expect(start).not.toHaveBeenCalled();
  expect(finish).not.toHaveBeenCalled();
});

it('loads real leaderboard data on navigation and returns to the catalog', async () => {
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('루틴 러너 랭킹')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('루틴 러너 랭킹'));
  await waitFor(() => expect(ui.getByText('총 0명 참여')).toBeTruthy());
  expect(ranking).toHaveBeenCalledWith('room-runner');
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await act(async () => {});
  expect(ui.getByText('미니게임')).toBeTruthy();
});

it.each(['cat-stairs', 'cat-merge'] as const)(
  'starts %s using its own instructions, renderer, and server session',
  async (gameCode) => {
    const definition = MINIGAME_DEFINITIONS[gameCode];
    const ui = await setup();
    await waitFor(() => expect(ui.getByLabelText(`${definition.name} 시작`)).toBeTruthy());
    await fireEvent.press(ui.getByLabelText(`${definition.name} 시작`));
    expect(ui.getByText(definition.instructions)).toBeTruthy();
    expect(ui.queryByText(MINIGAME_DEFINITIONS['room-runner'].instructions)).toBeNull();
    await fireEvent.press(ui.getByLabelText('랭킹 도전'));
    await waitFor(() => expect(ui.getByTestId('selected-player').props.children).toBe(gameCode));
    expect(start).toHaveBeenCalledWith(gameCode, 2);
    await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
    await waitFor(() =>
      expect(finish).toHaveBeenCalledWith(gameCode, `${gameCode}-run-1`, {
        ticks: 120,
        actions: [{ tick: 30, direction: 'LEFT' }],
      }),
    );
    await waitFor(() => expect(ui.getByText('최고 기록')).toBeTruthy());
    expect(ui.queryByTestId('runner-active')).toBeNull();
  },
);

it('preserves a failed stair replay while another game is played and retries only that stair run', async () => {
  finish.mockRejectedValueOnce(new Error('offline'));
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('고양이 계단 시작')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
  await fireEvent.press(ui.getByLabelText('랭킹 도전'));
  await waitFor(() => expect(ui.getByTestId('selected-player')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
  await waitFor(() => expect(ui.getByText('기록을 저장하지 못했어요')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await fireEvent.press(ui.getByLabelText('고양이 합치기 시작'));
  expect(ui.queryByText('기록을 저장하지 못했어요')).toBeNull();
  await fireEvent.press(ui.getByLabelText('연습하기 · 랭킹 미기록'));
  expect(ui.getByTestId('selected-player').props.children).toBe('cat-merge');
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
  expect(ui.getByText('기록을 저장하지 못했어요')).toBeTruthy();
  expect(ui.getByTestId('runner-active').props.children).toBe('false');
  await fireEvent.press(ui.getByLabelText('다시 저장'));
  await waitFor(() => expect(finish).toHaveBeenCalledTimes(2));
  expect(finish.mock.calls[1]).toEqual(finish.mock.calls[0]);
  expect(start).toHaveBeenCalledTimes(1);
});

it('uses separate leaderboard queries when switching games', async () => {
  ranking.mockImplementation(async (gameCode) => ({
    items: [{ rank: 1, userId: 5, nickname: `${gameCode} 1등`, score: 25 }],
    myEntry: null,
    totalPlayers: 1,
  }));
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('고양이 계단 랭킹')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('고양이 계단 랭킹'));
  await waitFor(() => expect(ui.getByText('cat-stairs 1등')).toBeTruthy());
  await fireEvent.press(ui.getByLabelText('뒤로 가기'));
  await fireEvent.press(ui.getByLabelText('고양이 합치기 랭킹'));
  await waitFor(() => expect(ui.getByText('cat-merge 1등')).toBeTruthy());
  expect(ui.queryByText('cat-stairs 1등')).toBeNull();
  expect(ranking).toHaveBeenCalledWith('cat-stairs');
  expect(ranking).toHaveBeenCalledWith('cat-merge');
});

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRef, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';

import type { Screen } from '@/components/app/navigation';
import type { FeedMinigameRecordDraft } from '@/components/screens/feed/types';
import {
  CURRENT_MINIGAME_RULES_VERSION,
  MINIGAME_DEFINITIONS,
  PLAYABLE_MINIGAMES,
} from '@/constants/minigames';
import type { MinigamePlayerProps } from '@/components/app/minigame-player';
import { MinigameActiveContext, useMinigameSurface } from '@/components/app/use-minigame-surface';
import { createTestQueryClient, queryWrapper } from '@/test-utils/query-wrapper';
import {
  fetchMinigames,
  fetchMinigameLeaderboard,
  startMinigameRun,
  finishMinigameRun,
} from '@/api/minigames';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 750, height: 1334, scale: 2, fontScale: 1 })),
}));
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
              gameCode === 'room-runner' || gameCode === 'cat-tower'
                ? { ticks: 120, jumpTicks: [30] }
                : gameCode === 'cat-yarn'
                  ? { ticks: 3, picks: [0, 4, 4] }
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

type HarnessProps = {
  retainOutgoing?: boolean;
  onShareRecord?: (record: FeedMinigameRecordDraft) => void;
  feedEnabled?: boolean;
};

function Harness({ retainOutgoing = false, onShareRecord, feedEnabled = true }: HarnessProps) {
  const [screen, setScreen] = useState<Screen>('minigames');
  const { subScreen, activeSessionId } = useMinigameSurface({
    screen,
    setScreen,
    onShareRecord,
    feedEnabled,
  });
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

async function setup(retainOutgoing = false, share: Omit<HarnessProps, 'retainOutgoing'> = {}) {
  const client = createTestQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    mutations: { retry: false, gcTime: Infinity },
  });
  clients.push(client);
  return render(<Harness retainOutgoing={retainOutgoing} {...share} />, {
    wrapper: queryWrapper(client),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  catalog.mockResolvedValue(PLAYABLE_MINIGAMES);
  ranking.mockResolvedValue({ items: [], myEntry: null, totalPlayers: 0 });
  start.mockImplementation(async (gameCode) => ({
    runId: `${gameCode}-run-1`,
    gameCode,
    rulesVersion: CURRENT_MINIGAME_RULES_VERSION,
    seed: 42,
    maxTicks: gameCode === 'cat-stairs' ? 7200 : gameCode === 'cat-yarn' ? 2000 : 18000,
    expiresAt: '2030-01-01T00:00:00Z',
  }));
  finish.mockResolvedValue({
    runId: 'saved-run',
    score: 20,
    bestScore: 20,
    personalBest: true,
    rank: 1,
    playCount: 1,
  });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

it('navigates catalog to runner and starts an authenticated run only on an explicit challenge', async () => {
  const ui = await setup();
  await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
  expect(start).not.toHaveBeenCalled();
  // 목록 카드의 내 최고 기록 (#1425) — 게임별 랭킹을 한 번씩 읽는다(랭킹 화면과 같은 캐시).
  await waitFor(() => expect(ranking).toHaveBeenCalledTimes(5));
  expect(new Set(ranking.mock.calls.map(([code]) => code))).toEqual(
    new Set(['room-runner', 'cat-stairs', 'cat-merge', 'cat-tower', 'cat-yarn']),
  );
  await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
  expect(ui.getByText('탭해서 점프')).toBeTruthy();
  await fireEvent.press(ui.getByLabelText('랭킹 도전'));
  await waitFor(() => expect(ui.getByTestId('runner-active').props.children).toBe('true'));
  expect(start).toHaveBeenCalledWith('room-runner', CURRENT_MINIGAME_RULES_VERSION);
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
  // Idle runner (before a game starts) is neither the picker nor a result.
  await fireEvent.press(ui.getByLabelText('전체 유저 랭킹 보기'));
  expect(mockTrack).toHaveBeenLastCalledWith('minigame_leaderboard_view', {
    game: 'cat-stairs',
    via: 'runner',
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

it.each(['cat-stairs', 'cat-merge', 'cat-tower', 'cat-yarn'] as const)(
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
    expect(start).toHaveBeenCalledWith(gameCode, CURRENT_MINIGAME_RULES_VERSION);
    await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
    await waitFor(() =>
      expect(finish).toHaveBeenCalledWith(
        gameCode,
        `${gameCode}-run-1`,
        // 탑 쌓기는 떨어뜨린 틱을 러너의 jumpTicks 필드로, 털실 정리는 집은 더미를 picks로 보낸다.
        gameCode === 'cat-tower'
          ? { ticks: 120, jumpTicks: [30] }
          : gameCode === 'cat-yarn'
            ? { ticks: 3, picks: [0, 4, 4] }
            : { ticks: 120, actions: [{ tick: 30, direction: 'LEFT' }] },
      ),
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

describe('세로 폰의 루틴 러너는 가로 무대로 (#1458)', () => {
  beforeEach(() => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  });
  afterEach(() => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width: 750, height: 1334, scale: 2, fontScale: 1 });
  });

  it('판 동안만 무대에 띄우고, 끝나면 내려 결과는 세로 화면이 받는다', async () => {
    const ui = await setup();
    await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
    await fireEvent.press(ui.getByLabelText('랭킹 도전'));
    await waitFor(() => expect(ui.getByTestId('landscape-stage')).toBeTruthy());
    expect(ui.getByTestId('runner-active').props.children).toBe('true');

    await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
    await waitFor(() => expect(ui.getByLabelText('전체 유저 랭킹 보기')).toBeTruthy());
    expect(ui.queryByTestId('landscape-stage')).toBeNull();
  });

  it('무대의 그만하기는 미니게임 목록으로 돌아간다', async () => {
    const ui = await setup();
    await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('루틴 러너 시작'));
    await fireEvent.press(ui.getByLabelText('랭킹 도전'));
    await waitFor(() => expect(ui.getByLabelText('게임 그만하기')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('게임 그만하기'));
    await waitFor(() => expect(ui.getByLabelText('루틴 러너 시작')).toBeTruthy());
    expect(ui.queryByTestId('landscape-stage')).toBeNull();
  });

  it('세로 판인 계단은 무대를 쓰지 않는다', async () => {
    const ui = await setup();
    await waitFor(() => expect(ui.getByLabelText('고양이 계단 시작')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('고양이 계단 시작'));
    await fireEvent.press(ui.getByLabelText('랭킹 도전'));
    await waitFor(() => expect(ui.getByTestId('runner-active').props.children).toBe('true'));
    expect(ui.queryByTestId('landscape-stage')).toBeNull();
  });
});

describe('새 최고 기록 피드 자랑 제안 (2026-10-14)', () => {
  const PROMPT = '새 기록이에요! 피드에 기록을 자랑할까요?';
  const saved = (patch: Partial<Awaited<ReturnType<typeof finishMinigameRun>>> = {}) => ({
    runId: 'cat-tower-run-1',
    score: 1240,
    bestScore: 1240,
    personalBest: true,
    rank: 3,
    playCount: 10,
    ...patch,
  });

  async function playTower(share: Omit<HarnessProps, 'retainOutgoing'>) {
    const ui = await setup(false, share);
    await waitFor(() => expect(ui.getByLabelText('고양이 탑 쌓기 시작')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('고양이 탑 쌓기 시작'));
    await fireEvent.press(ui.getByLabelText('랭킹 도전'));
    await waitFor(() => expect(ui.getByLabelText('테스트 게임 완료')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
    await waitFor(() => expect(ui.getByText('1,240점')).toBeTruthy());
    return ui;
  }

  it('랭킹전 새 최고 기록 + 10판 이상이면 묻고, [자랑하기]는 기록 초안을 넘긴다', async () => {
    finish.mockResolvedValue(saved());
    const onShareRecord = jest.fn();
    const ui = await playTower({ onShareRecord });
    expect(ui.getByText(PROMPT)).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith('minigame_share_prompt', {
      game: 'cat-tower',
      action: 'shown',
    });
    await fireEvent.press(ui.getByLabelText('피드에 새 기록 자랑하기'));
    expect(onShareRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'cat-tower-run-1',
        gameCode: 'cat-tower',
        score: 1240,
        rank: 3,
        personalBest: true,
      }),
    );
    expect(mockTrack).toHaveBeenCalledWith('minigame_share_prompt', {
      game: 'cat-tower',
      action: 'accepted',
    });
    expect(ui.queryByText(PROMPT)).toBeNull();
  });

  it('[괜찮아요]로 닫은 판은 결과 화면에 돌아와도 다시 묻지 않는다', async () => {
    finish.mockResolvedValue(saved());
    const onShareRecord = jest.fn();
    const ui = await playTower({ onShareRecord });
    await fireEvent.press(ui.getByText('괜찮아요'));
    expect(ui.queryByText(PROMPT)).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('minigame_share_prompt', {
      game: 'cat-tower',
      action: 'dismissed',
    });
    // 랭킹에 다녀와 같은 판의 결과를 다시 연다.
    await fireEvent.press(ui.getByLabelText('전체 유저 랭킹 보기'));
    await fireEvent.press(ui.getByLabelText('뒤로 가기'));
    await fireEvent.press(ui.getByLabelText('고양이 탑 쌓기 시작'));
    expect(ui.getByText('1,240점')).toBeTruthy();
    expect(ui.queryByText(PROMPT)).toBeNull();
    expect(onShareRecord).not.toHaveBeenCalled();
    expect(
      mockTrack.mock.calls.filter(
        ([event, props]) => event === 'minigame_share_prompt' && props.action === 'shown',
      ),
    ).toHaveLength(1);
  });

  it.each([
    ['9판째', saved({ playCount: 9 }), true],
    ['최고 기록이 아닌 판', saved({ personalBest: false }), true],
    ['playCount가 없는 옛 서버(0)', saved({ playCount: 0 }), true],
    ['피드가 꺼진 빌드', saved(), false],
  ])('%s에는 묻지 않는다', async (_label, result, feedEnabled) => {
    finish.mockResolvedValue(result);
    const ui = await playTower({ onShareRecord: jest.fn(), feedEnabled });
    expect(ui.queryByText(PROMPT)).toBeNull();
  });

  it('연습 판에는 묻지 않는다', async () => {
    finish.mockResolvedValue(saved());
    const ui = await setup(false, { onShareRecord: jest.fn() });
    await waitFor(() => expect(ui.getByLabelText('고양이 탑 쌓기 시작')).toBeTruthy());
    await fireEvent.press(ui.getByLabelText('고양이 탑 쌓기 시작'));
    await fireEvent.press(ui.getByLabelText('연습하기 · 랭킹 미기록'));
    await fireEvent.press(ui.getByLabelText('테스트 게임 완료'));
    await act(async () => {});
    expect(finish).not.toHaveBeenCalled();
    expect(ui.queryByText(PROMPT)).toBeNull();
  });
});

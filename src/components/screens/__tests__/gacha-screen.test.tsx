import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult, GachaRewardResponse } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { ToastProvider } from '@/components/ui/toast';

const videoMock = jest.requireActual('expo-video') as {
  __emitVideoEvent: (event: string, payload?: unknown) => void;
  __getLastVideoPlayer: () => unknown;
  __resetVideoPlayerMock: () => void;
};

const machine: GachaMachine = {
  id: 103,
  code: 'furniture_gacha',
  category: 'FURNITURE',
  name: '가구 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 25,
  drawCount: 1,
  icon: 'croissant',
  accent: '#F7E6C8',
  kind: 'furniture',
};
const wallpaperMachine: GachaMachine = {
  ...machine,
  id: 101,
  code: 'wallpaper_gacha',
  category: 'WALLPAPER',
  name: '벽지 뽑기',
};
const floorMachine: GachaMachine = {
  ...machine,
  id: 102,
  code: 'floor_gacha',
  category: 'FLOOR',
  name: '바닥 뽑기',
};
const machines = [wallpaperMachine, floorMachine, machine];
const reward: DrawResult = { itemId: 7, name: '허브 화분', rarity: '희귀', converted: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// RNTL 14 exposes host instances, while Pressable keeps onPress on its React fiber.
// Resolve the same handler as fireEvent, then batch collision events in one act.
function pressHandler(element: TestInstance): () => void {
  let fiber: TestInstance['unstable_fiber'] | null = element.unstable_fiber;
  while (fiber) {
    const handler = fiber.memoizedProps?.onPress;
    if (typeof handler === 'function') return handler;
    fiber = fiber.return;
  }
  throw new Error('Expected a press handler on the selected action');
}

describe('GachaScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    videoMock.__resetVideoPlayerMock();
  });

  it('renders the title and real wallet balance', async () => {
    const { getByText } = await render(<GachaScreen coinBalance={5600} />);
    expect(getByText('뽑기')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('shows three category tabs and starts on furniture regardless of API order', async () => {
    const legacy: GachaMachine = {
      ...machine,
      id: 88,
      code: 'bakery_morning',
      category: undefined,
      name: '작은 베이커리 아침 뽑기',
    };
    const { getAllByRole, getByLabelText, queryByLabelText } = await render(
      <GachaScreen gachas={[legacy, ...machines]} coinBalance={5600} />,
    );
    expect(getAllByRole('tab')).toHaveLength(3);
    expect(getByLabelText('벽지 뽑기')).not.toBeSelected();
    expect(getByLabelText('바닥 뽑기')).not.toBeSelected();
    expect(getByLabelText('가구 뽑기')).toBeSelected();
    expect(queryByLabelText(legacy.name)).toBeNull();
  });

  it.each([
    ['벽지 뽑기', 101],
    ['바닥 뽑기', 102],
    ['가구 뽑기', 103],
  ] as const)('selecting %s draws from its real API machine id %i', async (label, id) => {
    const onDraw = jest.fn().mockResolvedValue([reward]);
    const { getByLabelText, getByText } = await render(
      <GachaScreen gachas={machines} coinBalance={5600} onDraw={onDraw} reducedMotion />,
    );
    await fireEvent.press(getByLabelText(label));
    expect(getByLabelText(label)).toBeSelected();
    await fireEvent.press(getByText('1회 뽑기'));
    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onDraw).toHaveBeenCalledWith(id, 1);
    expect(getByText(reward.name!)).toBeTruthy();
  });

  it('does not draw from a legacy theme machine before the category catalog is ready', async () => {
    const onDraw = jest.fn();
    const legacy = { ...machine, category: undefined, code: 'bakery_morning' };
    const { queryByText, queryAllByRole } = await render(
      <GachaScreen gachas={[legacy]} coinBalance={5600} onDraw={onDraw} />,
    );
    expect(queryByText('1회 뽑기')).toBeNull();
    expect(queryAllByRole('tab')).toHaveLength(0);
    expect(onDraw).not.toHaveBeenCalled();
  });

  it('requests six results from the selected machine for its actual five-pull price', async () => {
    const onDraw = jest.fn().mockResolvedValue([reward]);
    const { getByLabelText } = await render(
      <GachaScreen
        gachas={[wallpaperMachine, { ...floorMachine, costAmount: 37 }, machine]}
        coinBalance={5600}
        onDraw={onDraw}
        reducedMotion
      />,
    );
    await fireEvent.press(getByLabelText('바닥 뽑기'));
    expect(getByLabelText('1회 뽑기, 37 코인')).toBeTruthy();
    await fireEvent.press(getByLabelText('5+1회 뽑기, 185 코인'));
    expect(onDraw).toHaveBeenCalledWith(102, 6);
  });

  it('explains an unaffordable pull without making a draw request', async () => {
    const onDraw = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <GachaScreen gachas={[machine]} coinBalance={24} onDraw={onDraw} />
      </ToastProvider>,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText('잔액이 부족해요')).toBeTruthy();
    expect(onDraw).not.toHaveBeenCalled();
  });

  it('guards two taps in one render and locks the draw while the API is pending', async () => {
    const response = deferred<DrawResult[] | null>();
    const onDraw = jest.fn(() => response.promise);
    const { getByLabelText, getByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} reducedMotion />,
    );
    const press = pressHandler(getByLabelText('1회 뽑기, 25 코인'));
    // Native events may arrive before React commits the disabled state.
    await act(() => {
      press();
      press();
    });
    expect(onDraw).toHaveBeenCalledTimes(1);
    await act(() => response.resolve([reward]));
    expect(getByText(reward.name!)).toBeTruthy();
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('recovers from a rejected draw and permits a fresh request', async () => {
    const onDraw = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([reward]);
    const { getByText, queryByLabelText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} reducedMotion />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText('뽑기에 실패했어요.')).toBeTruthy();
    expect(queryByLabelText('확인')).toBeNull();
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText(reward.name!)).toBeTruthy();
    expect(onDraw).toHaveBeenCalledTimes(2);
  });

  it.each([null, []])(
    'treats an unsuccessful %p result as a recoverable failure',
    async (result) => {
      const onResultsConfirmed = jest.fn();
      const { getByText, queryByLabelText } = await render(
        <GachaScreen
          gachas={[machine]}
          coinBalance={5600}
          onDraw={jest.fn().mockResolvedValue(result)}
          onResultsConfirmed={onResultsConfirmed}
          reducedMotion
        />,
      );
      await fireEvent.press(getByText('1회 뽑기'));
      expect(getByText('뽑기에 실패했어요.')).toBeTruthy();
      expect(queryByLabelText('확인')).toBeNull();
      expect(onResultsConfirmed).not.toHaveBeenCalled();
    },
  );

  it('skipping a pending draw reveals its eventual response without issuing another draw', async () => {
    const response = deferred<DrawResult[]>();
    const onDraw = jest.fn(() => response.promise);
    const { getByText, getByLabelText, queryByLabelText, queryByTestId } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    await fireEvent.press(getByLabelText('뽑기 연출 건너뛰기'));
    await fireEvent.press(getByLabelText('뽑기 연출 건너뛰기'));
    expect(queryByLabelText('확인')).toBeNull();
    expect(onDraw).toHaveBeenCalledTimes(1);
    await act(() => response.resolve([reward]));
    expect(getByText(reward.name!)).toBeTruthy();
    expect(queryByTestId('gacha-reveal-video-rare')).toBeNull();
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('moves from cinematic playback to results when the video completes', async () => {
    const onResultsConfirmed = jest.fn();
    const { getByText, getByLabelText, findByTestId, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue([reward])}
        onResultsConfirmed={onResultsConfirmed}
      />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(await findByTestId('gacha-reveal-video-rare', {}, { timeout: 3000 })).toBeTruthy();
    expect(queryByLabelText('확인')).toBeNull();
    expect(onResultsConfirmed).not.toHaveBeenCalled();
    await act(() => videoMock.__emitVideoEvent('playToEnd'));
    expect(getByLabelText('확인')).toBeTruthy();
    expect(getByText(reward.name!)).toBeTruthy();
    expect(onResultsConfirmed).not.toHaveBeenCalled();
  });

  it('reduced motion reveals an arbitrary API artwork without mounting video', async () => {
    const result: DrawResult = {
      rewardType: 'ITEM',
      itemId: 4001,
      name: '별빛 원목 수납장',
      assetKey: 'items/themes/starlight/furniture/cabinet-v42.png',
      rarity: '전설',
      converted: false,
    };
    const { getByText, getByTestId } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue([result])}
        reducedMotion
      />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText(result.name!)).toBeTruthy();
    expect(getByTestId('gacha-reward-art-0')).toBeTruthy();
    expect(videoMock.__getLastVideoPlayer()).toBeNull();
  });

  it('shows the dynamic refund when a currency result has no original artwork or name', async () => {
    const onDraw = jest.fn().mockResolvedValue([
      {
        rewardType: 'CURRENCY',
        converted: true,
        refundCurrencyType: 'DIAMOND',
        refundAmount: 3,
        rarity: '일반',
      },
    ]);
    const { getByText, queryByTestId } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} reducedMotion />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(getByText('다이아 환급')).toBeTruthy();
    expect(getByText('중복 · 다이아 +3')).toBeTruthy();
    expect(queryByTestId('gacha-reward-art-0')).toBeNull();
  });

  it('shows all six API results including a duplicate in reduced motion', async () => {
    const results: DrawResult[] = Array.from({ length: 6 }, (_, index) => ({
      itemId: index + 1,
      name: `새로운 가구 ${index + 1}`,
      rarity: index === 5 ? '전설' : '일반',
      converted: index === 3,
      ...(index === 3 ? { refundCurrencyType: 'DIAMOND' as const, refundAmount: 3 } : {}),
    }));
    const { getByText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue(results)}
        reducedMotion
      />,
    );
    await fireEvent.press(getByText('5+1회 뽑기'));
    for (const result of results) expect(getByText(result.name!)).toBeTruthy();
    expect(getByText('중복 · 다이아 +3')).toBeTruthy();
  });

  it('lets the user flip a multi-pull card immediately after skipping the cinematic', async () => {
    const results: DrawResult[] = [reward, { name: '나무 의자', rarity: '일반', converted: false }];
    const { getByText, getByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue(results)}
      />,
    );
    await fireEvent.press(getByText('5+1회 뽑기'));
    await fireEvent.press(getByLabelText('뽑기 연출 건너뛰기'));
    expect(getByLabelText('2번째 카드 뒤집기')).toBeTruthy();
    await fireEvent.press(getByLabelText('1번째 카드 뒤집기'));
    expect(getByText(reward.name!)).toBeTruthy();
  });

  it('confirms a result once even when its close action is pressed twice', async () => {
    const onResultsConfirmed = jest.fn();
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue([reward])}
        onResultsConfirmed={onResultsConfirmed}
        reducedMotion
      />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(onResultsConfirmed).not.toHaveBeenCalled();
    const confirm = pressHandler(getByLabelText('확인'));
    await act(() => {
      confirm();
      confirm();
    });
    expect(onResultsConfirmed).toHaveBeenCalledTimes(1);
    expect(queryByLabelText('확인')).toBeNull();
  });

  it('opens all six cards without drawing again and resets the count on the next pull', async () => {
    jest.useFakeTimers();
    try {
      const results = Array.from({ length: 6 }, (_, index) => ({
        itemId: index + 1,
        name: `묶음 선물 ${index + 1}`,
        rarity: '일반',
        converted: false,
      }));
      const onDraw = jest.fn().mockResolvedValue(results);
      const screen = await render(
        <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} />,
      );
      await fireEvent.press(screen.getByText('5+1회 뽑기'));
      await fireEvent.press(screen.getByLabelText('뽑기 연출 건너뛰기'));
      expect(screen.getByText('카드를 눌러 열어보세요 · 0 / 6')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('1번째 카드 뒤집기'));
      expect(screen.getByText('카드를 눌러 열어보세요 · 1 / 6')).toBeTruthy();
      const openAll = pressHandler(screen.getByLabelText('한 번에 열기'));
      await act(() => {
        openAll();
        openAll();
      });
      expect(screen.getByText('선물을 모두 열었어요!')).toBeTruthy();
      expect(screen.queryByLabelText('한 번에 열기')).toBeNull();
      for (const result of results) expect(screen.getByText(result.name)).toBeTruthy();
      await act(() => jest.advanceTimersByTime(5000));
      expect(screen.getByText('선물을 모두 열었어요!')).toBeTruthy();
      expect(onDraw).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByLabelText('확인'));
      await fireEvent.press(screen.getByText('5+1회 뽑기'));
      await fireEvent.press(screen.getByLabelText('뽑기 연출 건너뛰기'));
      expect(screen.getByText('카드를 눌러 열어보세요 · 0 / 6')).toBeTruthy();
      expect(onDraw).toHaveBeenCalledTimes(2);
      await screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('passes only new placeable rewards to decor and confirms the results once', async () => {
    const onDraw = jest
      .fn()
      .mockResolvedValue([
        reward,
        { itemId: 9, name: '중복 의자', rarity: '일반', converted: true, refundAmount: 3 },
      ]);
    const onGoPlace = jest.fn();
    const onResultsConfirmed = jest.fn();
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={onDraw}
        placeableItemIds={['7', '9']}
        onGoPlace={onGoPlace}
        onResultsConfirmed={onResultsConfirmed}
        reducedMotion
      />,
    );
    await fireEvent.press(getByText('5+1회 뽑기'));
    await fireEvent.press(getByLabelText('방 꾸미러 가기'));
    expect(onGoPlace).toHaveBeenCalledWith([expect.objectContaining({ itemId: 7 })]);
    expect(onResultsConfirmed).toHaveBeenCalledTimes(1);
    expect(queryByLabelText('확인')).toBeNull();
  });

  it('does not offer decor when every reward is already owned', async () => {
    const { getByText, queryByLabelText } = await render(
      <GachaScreen
        gachas={[machine]}
        coinBalance={5600}
        onDraw={jest.fn().mockResolvedValue([{ ...reward, converted: true, refundAmount: 3 }])}
        placeableItemIds={['7']}
        onGoPlace={jest.fn()}
        reducedMotion
      />,
    );
    await fireEvent.press(getByText('1회 뽑기'));
    expect(queryByLabelText('방 꾸미러 가기')).toBeNull();
  });

  it('shows catalog failure and a retry action', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText } = await render(
      <GachaScreen gachas={[]} loadError onRetry={onRetry} />,
    );
    expect(getByText('뽑기 목록을 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('loads rewards for the selected category and shows rarity groups and ownership', async () => {
    const onLoadRewards = jest.fn().mockResolvedValue([
      { rewardType: 'ITEM', itemId: 7, name: '구름 소파', rarity: '일반', owned: true },
      { rewardType: 'ITEM', itemId: 8, name: '한옥 자개 침대', rarity: '전설', owned: false },
      { rewardType: 'ITEM', itemId: 9, name: '달빛 책장', rarity: '희귀', owned: false },
    ]);
    const { getByLabelText, getByText, findByText } = await render(
      <GachaScreen gachas={machines} coinBalance={5600} onLoadRewards={onLoadRewards} />,
    );
    await fireEvent.press(getByLabelText('나올 수 있는 보상 보기'));
    expect(onLoadRewards).toHaveBeenCalledWith(103);
    expect(await findByText('한옥 자개 침대')).toBeTruthy();
    expect(getByText('전설')).toBeTruthy();
    expect(getByText('달빛 책장')).toBeTruthy();
    expect(getByText('보유')).toBeTruthy();
  });

  it('keeps the newer category rewards when an older response arrives last', async () => {
    const oldResponse = deferred<GachaRewardResponse[]>();
    const newResponse = deferred<GachaRewardResponse[]>();
    const onLoadRewards = jest
      .fn()
      .mockImplementationOnce(() => oldResponse.promise)
      .mockImplementationOnce(() => newResponse.promise);
    const { getByLabelText, getByText, queryByText } = await render(
      <GachaScreen gachas={machines} coinBalance={5600} onLoadRewards={onLoadRewards} />,
    );
    await act(() => {
      void pressHandler(getByLabelText('나올 수 있는 보상 보기'))();
    });
    expect(onLoadRewards).toHaveBeenCalledWith(103);
    await fireEvent.press(getByLabelText('시트 닫기'));
    await fireEvent.press(getByLabelText('벽지 뽑기'));
    await act(() => {
      void pressHandler(getByLabelText('나올 수 있는 보상 보기'))();
    });
    expect(onLoadRewards.mock.calls).toEqual([[103], [101]]);
    await act(() =>
      newResponse.resolve([{ rewardType: 'ITEM', itemId: 70, name: '새 벽지', rarity: '일반' }]),
    );
    expect(getByText('새 벽지')).toBeTruthy();
    await act(() =>
      oldResponse.resolve([{ rewardType: 'ITEM', itemId: 7, name: '늦은 소파', rarity: '일반' }]),
    );
    expect(getByText('새 벽지')).toBeTruthy();
    expect(queryByText('늦은 소파')).toBeNull();
  });

  it('renders reward thumbnail rows for CDN art and fallback items', async () => {
    const onLoadRewards = jest.fn().mockResolvedValue([
      {
        rewardType: 'ITEM',
        itemId: 7,
        name: '구름 소파',
        rarity: '일반',
        assetKey: 'items/sofa.png',
      },
      { rewardType: 'ITEM', itemId: 8, name: '이름만 보상', rarity: '일반' },
    ]);
    const { getByLabelText, findByTestId } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onLoadRewards={onLoadRewards} />,
    );
    await fireEvent.press(getByLabelText('나올 수 있는 보상 보기'));
    expect(await findByTestId('reward-row-7')).toBeTruthy();
    expect(await findByTestId('reward-row-8')).toBeTruthy();
  });

  it('virtualizes a large reward pool instead of mounting every thumbnail', async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      rewardType: 'ITEM' as const,
      itemId: index + 1,
      name: `보상 ${index + 1}`,
      rarity: '일반',
      assetKey: `items/r${index + 1}.png`,
    }));
    const { getByLabelText, findByTestId, queryByTestId } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onLoadRewards={async () => many} />,
    );
    await fireEvent.press(getByLabelText('나올 수 있는 보상 보기'));
    expect(await findByTestId('reward-row-1')).toBeTruthy();
    expect(queryByTestId('reward-row-60')).toBeNull();
  });

  it.each(['null', 'rejected'])('allows reward-list retry after a %s response', async (failure) => {
    const onLoadRewards = jest.fn();
    if (failure === 'null') onLoadRewards.mockResolvedValueOnce(null);
    else onLoadRewards.mockRejectedValueOnce(new Error('offline'));
    onLoadRewards.mockResolvedValueOnce([
      { rewardType: 'ITEM', itemId: 7, name: '구름 소파', rarity: '일반' },
    ]);
    const { getByLabelText, getByText, findByText } = await render(
      <GachaScreen gachas={[machine]} coinBalance={5600} onLoadRewards={onLoadRewards} />,
    );
    await fireEvent.press(getByLabelText('나올 수 있는 보상 보기'));
    expect(await findByText('보상 목록을 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByText('다시 시도'));
    expect(await findByText('구름 소파')).toBeTruthy();
    expect(onLoadRewards.mock.calls).toEqual([[103], [103]]);
  });
});

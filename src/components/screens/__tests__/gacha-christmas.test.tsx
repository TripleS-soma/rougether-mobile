import { act, fireEvent, render } from '@testing-library/react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import christmasVideo from '@/assets/videos/gacha-reveal-christmas.mp4';
import christmasMultiVideo from '@/assets/videos/gacha-reveal-christmas-multi.mp4';

const video = jest.requireActual('expo-video') as {
  __getLastVideoPlayer: () => {
    source: unknown;
    __emit: (name: string, payload?: unknown) => void;
  } | null;
  __resetVideoPlayerMock: () => void;
};
const furniture: GachaMachine = {
  id: 103,
  code: 'furniture_gacha',
  category: 'FURNITURE',
  name: '가구 뽑기',
  costCurrencyType: 'COIN',
  costAmount: 25,
  drawCount: 1,
  icon: 'gift',
  accent: '#fff',
  kind: 'furniture',
};
const christmas: GachaMachine = {
  ...furniture,
  id: 812,
  code: 'christmas_2026',
  category: undefined,
  name: '크리스마스',
  costAmount: 47,
};
const seasonal = { machine: christmas, title: '크리스마스', endsLabel: '12.25까지', hero: null };
const result: DrawResult = {
  rewardType: 'ITEM',
  itemId: 9,
  name: '서버가 선택한 기존 가구',
  rarity: '희귀',
  converted: false,
};

beforeEach(() => {
  jest.useFakeTimers();
  video.__resetVideoPlayerMock();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('uses the actual event ID and price, then keeps its Christmas reveal when the catalogue expires', async () => {
  const onDraw = jest.fn().mockResolvedValue([result]);
  const screen = await render(
    <GachaScreen
      gachas={[furniture, christmas]}
      seasonalGacha={seasonal}
      coinBalance={1000}
      onDraw={onDraw}
    />,
  );
  await fireEvent.press(screen.getByLabelText('크리스마스'));
  expect(screen.getByText('배치한 크리스마스 가구 종류마다 코인 +10%')).toBeTruthy();
  expect(screen.queryByText('루틴·할 일 완료 보상 · 중복·벽지·바닥 제외')).toBeNull();
  await fireEvent.press(screen.getByLabelText('1회 뽑기, 47 코인'));
  expect(onDraw).toHaveBeenCalledTimes(1);
  expect(onDraw).toHaveBeenCalledWith(812, 1);
  const player = video.__getLastVideoPlayer()!;
  expect(player.source).toBe(christmasVideo);
  await screen.rerender(<GachaScreen gachas={[furniture]} coinBalance={953} onDraw={onDraw} />);
  expect(video.__getLastVideoPlayer()).toBe(player);
  await act(() => player.__emit('playToEnd'));
  expect(screen.getByText(result.name!)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('확인'));
  expect(onDraw).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

it('skips a pending event reveal without retrying the paid request or inventing a reward', async () => {
  let resolve!: (results: DrawResult[]) => void;
  const onDraw = jest.fn(
    () =>
      new Promise<DrawResult[]>((done) => {
        resolve = done;
      }),
  );
  const screen = await render(
    <GachaScreen
      gachas={[christmas]}
      seasonalGacha={seasonal}
      coinBalance={1000}
      onDraw={onDraw}
    />,
  );
  await fireEvent.press(screen.getByLabelText('1회 뽑기, 47 코인'));
  await fireEvent.press(screen.getByLabelText('뽑기 연출 건너뛰기'));
  expect(video.__getLastVideoPlayer()).toBeNull();
  await act(() => resolve([result]));
  expect(screen.getByText(result.name!)).toBeTruthy();
  expect(video.__getLastVideoPlayer()).toBeNull();
  expect(onDraw).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

it('reveals the six server results through the Christmas multi shell after one 5+1 request', async () => {
  const results = Array.from({ length: 6 }, (_, index) => ({
    ...result,
    itemId: 100 + index,
    name: `실제 보상 ${index + 1}`,
  }));
  const onDraw = jest.fn().mockResolvedValue(results);
  const screen = await render(
    <GachaScreen
      gachas={[christmas]}
      seasonalGacha={seasonal}
      coinBalance={1000}
      onDraw={onDraw}
    />,
  );
  await fireEvent.press(screen.getByLabelText('5+1회 뽑기, 235 코인'));
  expect(onDraw).toHaveBeenCalledWith(812, 6);
  expect(onDraw).toHaveBeenCalledTimes(1);
  const player = video.__getLastVideoPlayer()!;
  expect(player.source).toBe(christmasMultiVideo);
  await act(() => player.__emit('playToEnd'));
  for (const reward of results) expect(screen.getByText(reward.name)).toBeTruthy();
  expect(onDraw).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

it('shows the actual event reward immediately under reduced motion without creating a player', async () => {
  const onDraw = jest.fn().mockResolvedValue([result]);
  const screen = await render(
    <GachaScreen
      gachas={[christmas]}
      seasonalGacha={seasonal}
      coinBalance={1000}
      onDraw={onDraw}
      reducedMotion
    />,
  );
  await fireEvent.press(screen.getByLabelText('1회 뽑기, 47 코인'));
  expect(video.__getLastVideoPlayer()).toBeNull();
  expect(screen.getByText(result.name!)).toBeTruthy();
  expect(onDraw).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

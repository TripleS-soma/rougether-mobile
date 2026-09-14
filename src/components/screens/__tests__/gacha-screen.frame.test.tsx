import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { GachaMachine } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { ToastProvider } from '@/components/ui/toast';
import { APP_FRAME_MAX_WIDTH, type AppFrame } from '@/hooks/use-app-frame';

let mockFrame: AppFrame = {
  width: 390,
  height: 844,
  scale: 2,
  fontScale: 1,
  split: false,
  framed: false,
};
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));

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
const reward: DrawResult = { itemId: 7, name: '허브 화분', rarity: '희귀', converted: false };

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style].flat(Infinity) as object[]).filter(Boolean));

/**
 * 연출·결과 레이어는 세로 폰 좌표를 전제하므로 넓은 창(2단 프레임·웹 데스크톱)에서는 폰 폭
 * 컬럼으로 가둔다 (2026-09-14) — 안 그러면 포스터가 가로 폭 기준으로 커져 보상 그림이 잘렸다.
 */
describe('GachaScreen — 연출 레이어 폰 폭 프레임', () => {
  afterEach(() => {
    mockFrame = { ...mockFrame, split: false, width: 390 };
  });

  async function drawToResult() {
    const onDraw = jest.fn().mockResolvedValue([reward]);
    const ui = await render(
      <ToastProvider>
        <GachaScreen gachas={[machine]} coinBalance={5600} onDraw={onDraw} reducedMotion />
      </ToastProvider>,
    );
    await fireEvent.press(ui.getByText('1회 뽑기'));
    await waitFor(() => expect(ui.getByText(reward.name!)).toBeTruthy());
    return ui;
  }

  it('폰 폭에서는 프레임이 전체 폭 그대로다', async () => {
    const ui = await drawToResult();
    const style = flat(ui.getByTestId('gacha-stage-frame').props.style);
    expect(style.width).toBe('100%');
    expect(style.maxWidth).toBeUndefined();
  });

  it('넓은 창(split)에서는 폰 최대 폭으로 가두고 바깥을 레터박스로 둔다', async () => {
    mockFrame = { ...mockFrame, split: true, width: 1200 };
    const ui = await drawToResult();
    const style = flat(ui.getByTestId('gacha-stage-frame').props.style);
    expect(style.maxWidth).toBe(APP_FRAME_MAX_WIDTH);
    expect(style.alignSelf).toBe('center');
  });
});

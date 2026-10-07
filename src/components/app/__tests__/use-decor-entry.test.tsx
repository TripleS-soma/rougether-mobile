import { act, renderHook } from '@testing-library/react-native';

import type { Screen } from '@/components/app/navigation';
import { useDecorEntry } from '@/components/app/use-decor-entry';
import { track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// 꾸미기 진입 (#630·#897·#1043) — 앱 셸에서 옮긴 동작을 직접 고정한다(장부 5번).
const catalogue = {
  furniture: [{ id: 'f1' }, { id: 'f2' }] as never[],
  wallpapers: [{ id: 'w1' }, { id: 'w2' }] as never[],
};

async function setup(initial: Screen = 'gacha') {
  const setScreen = jest.fn();
  const view = await renderHook(
    ({ screen }: { screen: Screen }) => useDecorEntry({ screen, setScreen, catalogue }),
    { initialProps: { screen: initial } },
  );
  return { setScreen, ...view };
}

describe('useDecorEntry', () => {
  it('뽑기 결과로 가면 NEW 강조·가장 많은 종류의 탭을 열고 꾸미기로 보낸다', async () => {
    const { result, setScreen } = await setup();
    await act(async () => {
      result.current.goPlaceDrawn([{ itemId: 'w1' }, { itemId: 'w2' }, { itemId: 'f1' }] as never);
    });
    expect(result.current.newDecorItemIds).toEqual(['w1', 'w2', 'f1']);
    expect(result.current.decorInitialTab).toBe('wallpaper');
    expect(setScreen).toHaveBeenCalledWith('decor');
    expect(result.current.placeableFurnitureIds).toEqual(['f1', 'f2']);
  });

  it('꾸미기 진입을 경로별로 세고, 떠나면 강조·탭을 비운다', async () => {
    const { result, rerender } = await setup();
    await act(async () => {
      result.current.goPlaceDrawn([{ itemId: 'f1' }] as never);
    });
    await rerender({ screen: 'decor' });
    expect(track).toHaveBeenLastCalledWith('decor_open', { from: 'gacha' });

    await rerender({ screen: 'myRoom' });
    expect(result.current.newDecorItemIds).toEqual([]);
    expect(result.current.decorInitialTab).toBeUndefined();

    await rerender({ screen: 'decor' });
    expect(track).toHaveBeenLastCalledWith('decor_open', { from: 'direct' });
  });

  it('거래소 상세·내 주문으로 갔다 오면 연 탭을 기억한다 (#1427)', async () => {
    const { result, rerender } = await setup('decor');
    await act(async () => result.current.setDecorInitialTab('market'));
    await rerender({ screen: 'marketAsset' });
    expect(result.current.decorInitialTab).toBe('market');
  });
});

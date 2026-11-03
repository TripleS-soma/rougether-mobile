import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useFeatureTour } from '@/hooks/use-feature-tour';
import { loadSeenTours, markTourSeen } from '@/lib/feature-tour-store';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
let mockUserId: number | undefined = 7;
jest.mock('@/api/auth', () => ({
  ...jest.requireActual('@/api/auth'),
  getSessionUserId: () => mockUserId,
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockTrack.mockClear();
  mockUserId = 7;
});

describe('useFeatureTour', () => {
  it('처음 진입하면 0단계부터 띄우고, 다음으로 끝까지 가면 계정에 기록한다', async () => {
    const { result } = await renderHook(() => useFeatureTour('market', 3, true));
    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.index).toBe(0);
    await act(async () => result.current.next());
    await act(async () => result.current.next());
    expect(result.current.index).toBe(2);
    await act(async () => result.current.next());
    expect(result.current.visible).toBe(false);
    await waitFor(async () => expect((await loadSeenTours(7)).has('market')).toBe(true));
    expect(mockTrack).toHaveBeenCalledWith('feature_tour', {
      tour: 'market',
      action: 'complete',
      step: 3,
    });
  });

  it('건너뛰면 그 단계 번호로 기록하고 다시 자동으로 뜨지 않는다', async () => {
    const { result, unmount } = await renderHook(() => useFeatureTour('market', 3, true));
    await waitFor(() => expect(result.current.visible).toBe(true));
    await act(async () => result.current.next());
    await act(async () => result.current.skip());
    expect(mockTrack).toHaveBeenCalledWith('feature_tour', {
      tour: 'market',
      action: 'skip',
      step: 2,
    });
    unmount();
    await waitFor(async () => expect((await loadSeenTours(7)).has('market')).toBe(true));
    const again = await renderHook(() => useFeatureTour('market', 3, true));
    await act(async () => {});
    expect(again.result.current.visible).toBe(false);
  });

  it('비활성(다른 화면·온보딩 중)이면 띄우지 않고, 활성이 되면 띄운다', async () => {
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useFeatureTour('market', 3, active),
      { initialProps: { active: false } },
    );
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    rerender({ active: true });
    await waitFor(() => expect(result.current.visible).toBe(true));
  });

  it('본 계정이어도 다시 보기는 처음부터, 다른 계정은 처음 진입으로 본다', async () => {
    await markTourSeen(7, 'market');
    const { result } = await renderHook(() => useFeatureTour('market', 3, true));
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    await act(async () => result.current.replay());
    expect(result.current.visible).toBe(true);
    expect(result.current.index).toBe(0);

    mockUserId = 8;
    const other = await renderHook(() => useFeatureTour('market', 3, true));
    await waitFor(() => expect(other.result.current.visible).toBe(true));
  });

  it('함수 참조는 렌더가 바뀌어도 그대로다 (#539 memo 경계)', async () => {
    const { result } = await renderHook(() => useFeatureTour('market', 3, true));
    const { replay, skip } = result.current;
    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(result.current.replay).toBe(replay);
    expect(result.current.skip).toBe(skip);
  });

  it('투어 id가 바뀌면(게임 A → B) 앞 투어의 진행을 버리고 새로 판단한다', async () => {
    await markTourSeen(7, 'minigame:b');
    const { result, rerender, unmount } = await renderHook(
      ({ id }: { id: string }) => useFeatureTour(id, 1, true),
      { initialProps: { id: 'minigame:a' } },
    );
    await waitFor(() => expect(result.current.visible).toBe(true));
    await rerender({ id: 'minigame:b' });
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    await unmount();
  });
});

describe('useFeatureTour 계정·저장 경계', () => {
  it('세션 계정을 모르면 띄우지 않다가, 계정이 붙으면 띄운다', async () => {
    mockUserId = undefined;
    const { result, rerender, unmount } = await renderHook(
      ({ tick }: { tick: number }) => (void tick, useFeatureTour('market', 3, true)),
      { initialProps: { tick: 0 } },
    );
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    mockUserId = 7;
    await rerender({ tick: 1 });
    await waitFor(() => expect(result.current.visible).toBe(true));
    await unmount();
  });

  it('다른 투어를 동시에 기록해도 둘 다 남는다', async () => {
    await Promise.all([markTourSeen(7, 'a'), markTourSeen(7, 'b'), markTourSeen(7, 'c')]);
    expect([...(await loadSeenTours(7))].sort()).toEqual(['a', 'b', 'c']);
  });
});

import { act, renderHook } from '@testing-library/react-native';

import type { Screen } from '@/components/app/navigation';
import { usePagerLock } from '@/components/app/use-pager-lock';

describe('usePagerLock', () => {
  it('주간 보기에선 탭 페이저를 잠근다 — 좌우 스와이프는 주 이동이다 (2026-11-04)', async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ screen }: { screen: Screen }) => usePagerLock(screen),
      { initialProps: { screen: 'calendar' as Screen } },
    );
    expect(result.current.lock.value).toBe(false);
    await rerender({ screen: 'calendarWeek' });
    expect(result.current.lock.value).toBe(true);
    await rerender({ screen: 'calendar' });
    expect(result.current.lock.value).toBe(false);
    await unmount();
  });

  it('집 잠금은 집 탭에서만, 튜토리얼 잠금은 어디서나', async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ screen }: { screen: Screen }) => usePagerLock(screen),
      { initialProps: { screen: 'house' as Screen } },
    );
    await act(async () => result.current.setHouseLocked(true));
    expect(result.current.lock.value).toBe(true);
    await rerender({ screen: 'myRoom' });
    expect(result.current.lock.value).toBe(false);
    await act(async () => result.current.setTutorialLocked(true));
    expect(result.current.lock.value).toBe(true);
    await unmount();
  });
});

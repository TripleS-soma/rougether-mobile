import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useWidgetPresence } from '@/hooks/use-widget-presence';
import { refreshWidgets } from '@/widgets/rougether-widgets';
import { loadWidgetLastActive, saveWidgetLastActive } from '@/widgets/widget-data';

jest.mock('@/widgets/rougether-widgets', () => ({ refreshWidgets: jest.fn() }));

// 마지막 접속 기록 (#1122) — 포그라운드가 될 때만 남기고 위젯을 다시 그린다.
describe('useWidgetPresence', () => {
  it('마운트 시 active면 즉시 기록하고, 다시 active가 되면 또 기록한다', async () => {
    let listener: ((s: string) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      cb: (s: string) => void,
    ) => {
      listener = cb;
      return { remove };
    }) as never);
    (AppState as { currentState: string }).currentState = 'active';

    const { unmount } = await renderHook(() => useWidgetPresence());
    await waitFor(async () => expect(await loadWidgetLastActive()).toBeTruthy());
    expect(refreshWidgets).toHaveBeenCalled();

    // 배경으로 갔다 돌아오면 새 시각으로 갱신된다.
    await saveWidgetLastActive('2020-01-01T00:00:00.000Z');
    listener?.('background');
    listener?.('active');
    await waitFor(async () =>
      expect(await loadWidgetLastActive()).not.toBe('2020-01-01T00:00:00.000Z'),
    );
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});

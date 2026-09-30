import { act, render } from '@testing-library/react-native';
import { createRef } from 'react';
import type { View } from 'react-native';

import {
  RewardOverlay,
  type RewardOverlayHandle,
} from '@/components/screens/my-room/reward-overlay';

describe('RewardOverlay (성능 장부 R4)', () => {
  it('show()로 보상 알약을 띄우고, 이어 오면 코인을 합산한다', async () => {
    const ref = createRef<RewardOverlayHandle>();
    const rootRef = createRef<View>();
    const ui = await render(<RewardOverlay ref={ref} rootRef={rootRef} streakDays={3} top={0} />);
    expect(ui.queryByText('+10')).toBeNull();

    await act(async () => ref.current?.show(10, null));
    expect(ui.getByText('+10')).toBeTruthy();

    await act(async () => ref.current?.show(5, null));
    expect(ui.getByText('+15')).toBeTruthy();
  });
});

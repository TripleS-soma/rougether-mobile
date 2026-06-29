import { render } from '@testing-library/react-native';

import { AppShell } from '@/components/app/app-shell';

describe('AppShell', () => {
  it('opens on the my-room screen with the bottom nav', async () => {
    const { getByText, getByLabelText } = await render(<AppShell />);
    expect(getByText('준서의 방')).toBeTruthy(); // MyRoomScreen default
    expect(getByText('오늘의 루틴')).toBeTruthy();
    // Bottom nav tabs present.
    expect(getByLabelText('나의 방')).toBeTruthy();
    expect(getByLabelText('집')).toBeTruthy();
    expect(getByLabelText('설정')).toBeTruthy();
  });
});

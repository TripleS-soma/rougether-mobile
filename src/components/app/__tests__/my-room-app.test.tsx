import { render } from '@testing-library/react-native';

import { MyRoomApp } from '@/components/app/my-room-app';

describe('MyRoomApp', () => {
  it('opens on the my-room screen with the sample routines', async () => {
    const { getByText } = await render(<MyRoomApp />);
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('오늘의 루틴')).toBeTruthy();
  });
});

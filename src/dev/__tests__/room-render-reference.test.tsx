import { render } from '@testing-library/react-native';

import { RoomRenderReference } from '@/dev/room-render-reference';

describe('RoomRenderReference', () => {
  it('renders the shared contract fixture with the real animated character asset', async () => {
    const { getByLabelText, getByTestId } = await render(<RoomRenderReference />);

    expect(getByLabelText('Room renderer contract v1 기준 화면')).toBeTruthy();
    expect(getByLabelText('바다 창문')).toBeTruthy();
    expect(getByTestId('cdn-animation')).toBeTruthy();
  });
});

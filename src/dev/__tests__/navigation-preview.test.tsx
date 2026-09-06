import { act, fireEvent, render } from '@testing-library/react-native';

import { NavigationPreview } from '@/dev/navigation-preview';

describe('NavigationPreview', () => {
  it('connects the real bar to the pager and allows bar navigation while the house is locked', async () => {
    const ui = await render(<NavigationPreview />);
    expect(ui.getByTestId('navigation-status').props.children.join('')).toBe('나의 방 · 전환 0회');
    await act(async () => fireEvent.press(ui.getByRole('button', { name: '집' })));
    await act(async () => fireEvent.press(ui.getByRole('button', { name: '집 확대 잠금 재현' })));
    await act(async () => fireEvent.press(ui.getByRole('button', { name: '마이페이지' })));
    expect(ui.getByTestId('navigation-status').props.children.join('')).toBe(
      '마이페이지 · 전환 2회',
    );
  });
});

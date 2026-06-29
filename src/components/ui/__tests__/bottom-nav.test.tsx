import { fireEvent, render } from '@testing-library/react-native';

import { BottomNav } from '@/components/ui/bottom-nav';

describe('BottomNav', () => {
  it('renders the tabs and fires onChange with the selected tab', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<BottomNav active="myRoom" onChange={onChange} />);
    expect(getByText('나의 방')).toBeTruthy();
    expect(getByText('집')).toBeTruthy();
    expect(getByText('설정')).toBeTruthy();

    fireEvent.press(getByText('집'));
    expect(onChange).toHaveBeenCalledWith('house');
  });
});

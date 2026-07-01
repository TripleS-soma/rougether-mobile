import { fireEvent, render } from '@testing-library/react-native';

import { SoundSettingsScreen } from '@/components/screens/sound-settings-screen';

describe('SoundSettingsScreen', () => {
  it('renders the title and toggle rows', async () => {
    const { getAllByText, getByText } = await render(<SoundSettingsScreen />);
    // '효과음' is both the header title and the first row label.
    expect(getAllByText('효과음')).toHaveLength(2);
    expect(getByText('배경 음악')).toBeTruthy();
    expect(getByText('햅틱 진동')).toBeTruthy();
  });

  it('reports a change when a toggle is pressed', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(<SoundSettingsScreen onChange={onChange} />);

    await fireEvent.press(getByLabelText('배경 음악'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ music: true }));
  });
});

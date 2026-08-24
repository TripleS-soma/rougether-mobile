import { fireEvent, render } from '@testing-library/react-native';

import {
  DEFAULT_SOUND_SETTINGS,
  SoundSettingsScreen,
} from '@/components/screens/sound-settings-screen';

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

  describe('햅틱 세기 (#974)', () => {
    const selectedLabel = (getAllByRole: (r: string) => { props: Record<string, unknown> }[]) =>
      getAllByRole('radio')
        .filter((n) => (n.props.accessibilityState as { selected?: boolean })?.selected)
        .map((n) => n.props.accessibilityLabel);

    it('네 단계를 모두 그리고, 현재 값만 선택 상태다', async () => {
      const { getByLabelText, getAllByRole } = await render(
        <SoundSettingsScreen
          initialSettings={{ ...DEFAULT_SOUND_SETTINGS, hapticStrength: 'heavy' }}
        />,
      );
      for (const label of ['햅틱 끄기', '햅틱 약', '햅틱 보통', '햅틱 강']) {
        expect(getByLabelText(label)).toBeTruthy();
      }
      expect(selectedLabel(getAllByRole)).toEqual(['햅틱 강']);
    });

    it('칩을 누르면 그 세기로 보고한다', async () => {
      const onChange = jest.fn();
      const { getByLabelText } = await render(<SoundSettingsScreen onChange={onChange} />);

      await fireEvent.press(getByLabelText('햅틱 약'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hapticStrength: 'light' }));

      await fireEvent.press(getByLabelText('햅틱 끄기'));
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hapticStrength: 'off' }));
    });

    it('세기를 바꿔도 다른 설정은 건드리지 않는다', async () => {
      const onChange = jest.fn();
      const { getByLabelText } = await render(
        <SoundSettingsScreen
          initialSettings={{ effects: false, music: true, hapticStrength: 'medium' }}
          onChange={onChange}
        />,
      );
      await fireEvent.press(getByLabelText('햅틱 강'));
      expect(onChange).toHaveBeenCalledWith({
        effects: false,
        music: true,
        hapticStrength: 'heavy',
      });
    });

    it('누른 뒤 선택 표시가 그 칩으로 옮겨간다', async () => {
      const { getByLabelText, getAllByRole } = await render(<SoundSettingsScreen />);
      expect(selectedLabel(getAllByRole)).toEqual(['햅틱 보통']);
      await fireEvent.press(getByLabelText('햅틱 약'));
      expect(selectedLabel(getAllByRole)).toEqual(['햅틱 약']);
    });
  });
});

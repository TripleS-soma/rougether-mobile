import { fireEvent, render } from '@testing-library/react-native';

import { CharacterPickerSheet } from '@/components/screens/sheets/character-picker-sheet';

const CHARACTERS = [
  { serverId: 1, id: 'cat' as const, name: '고양이', selected: true },
  { serverId: 4, id: 'panda' as const, name: '판다', selected: false },
];

describe('CharacterPickerSheet', () => {
  it('renders the owned grid with the worn badge', async () => {
    const { getByText, getByLabelText } = await render(
      <CharacterPickerSheet visible characters={CHARACTERS} onSelect={jest.fn()} onClose={jest.fn()} />, // prettier-ignore
    );
    expect(getByText('캐릭터 교체')).toBeTruthy();
    expect(getByText('착용 중')).toBeTruthy();
    expect(getByLabelText('고양이 착용').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('판다 착용').props.accessibilityState.selected).toBe(false);
  });

  it('selects an unworn character and closes; worn taps only close', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <CharacterPickerSheet visible characters={CHARACTERS} onSelect={onSelect} onClose={onClose} />, // prettier-ignore
    );

    await fireEvent.press(getByLabelText('판다 착용'));
    expect(onSelect).toHaveBeenCalledWith(4);
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByLabelText('고양이 착용'));
    expect(onSelect).toHaveBeenCalledTimes(1); // no re-select of the worn one
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders CDN art when the asset key is valid, local sprite otherwise', async () => {
    const mixed = [
      { serverId: 1, id: 'cat' as const, name: '고양이', assetKey: 'characters/cat_sitting.png', selected: true }, // prettier-ignore
      { serverId: 4, id: 'panda' as const, name: '판다', selected: false }, // no key → local sprite
    ];
    const { queryAllByTestId } = await render(
      <CharacterPickerSheet visible characters={mixed} onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryAllByTestId('cdn-art')).toHaveLength(1);
  });

  it('shows the empty hint and hides entirely when not visible', async () => {
    const empty = await render(
      <CharacterPickerSheet visible characters={[]} onSelect={jest.fn()} onClose={jest.fn()} />,
    );
    expect(empty.getByText(/보유한 캐릭터가 없어요/)).toBeTruthy();

    const hidden = await render(
      <CharacterPickerSheet
        visible={false}
        characters={CHARACTERS}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(hidden.queryByText('캐릭터 교체')).toBeNull();
  });
});

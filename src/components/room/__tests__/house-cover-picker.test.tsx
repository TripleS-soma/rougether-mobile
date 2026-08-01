import { fireEvent, render } from '@testing-library/react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';

const COVERS: HouseCover[] = [
  {
    code: 'cloud_balloon',
    name: '구름 풍선 집',
    coverImageKey: 'house/cloud-balloon/frame.png',
  },
  {
    code: 'coral_aquarium',
    name: '산호 수족관 집',
    coverImageKey: 'house/coral-aquarium/frame.png',
  },
];

describe('HouseCoverPicker', () => {
  it('renders a CDN thumbnail per cover and reports the tapped key', async () => {
    const onSelect = jest.fn();
    const { getByLabelText, queryAllByTestId } = await render(
      <HouseCoverPicker covers={COVERS} onSelect={onSelect} />,
    );

    expect(queryAllByTestId('cover-art')).toHaveLength(2);
    await fireEvent.press(getByLabelText('산호 수족관 집 커버'));
    expect(onSelect).toHaveBeenCalledWith('house/coral-aquarium/frame.png');
  });

  it('marks the selected cover and renders nothing while the catalog is empty', async () => {
    const selected = await render(
      <HouseCoverPicker
        covers={COVERS}
        selectedKey="house/cloud-balloon/frame.png"
        onSelect={jest.fn()}
      />,
    );
    expect(selected.getByLabelText('구름 풍선 집 커버').props.accessibilityState.selected).toBe(
      true,
    );

    const empty = await render(<HouseCoverPicker covers={[]} onSelect={jest.fn()} />);
    expect(empty.queryAllByTestId('cover-art')).toHaveLength(0);
  });
});

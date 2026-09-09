import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { HouseCoverPicker } from '@/components/room/house-cover-picker';
import { DEFAULT_HOUSE_COVER_KEY } from '@/resources/house-frame';

describe('stacked frame consumers', () => {
  it.each([
    DEFAULT_HOUSE_COVER_KEY,
    'house/night-observatory/house-unified-night-observatory-frame-v3.png',
  ])('shows six rooms and restores matching legacy geometry after %s fails', async (coverKey) => {
    const ui = await render(
      <HousePreviewFrame
        coverImageKey={coverKey}
        enabled
        maxMembers={6}
        memberCount={6}
        name="여섯 집"
      />,
    );
    expect(ui.getAllByTestId('preview-room')).toHaveLength(6);
    expect(ui.getByLabelText('여섯 집 집 미리보기').props.contentFit).toBe('fill');
    expect(StyleSheet.flatten(ui.getByTestId('house-preview-frame').props.style).aspectRatio).toBe(
      (1024 / 1576) * (5 / 6),
    );
    await fireEvent(ui.getByLabelText('여섯 집 집 미리보기'), 'error', {
      nativeEvent: { error: 'unavailable' },
    });
    expect(StyleSheet.flatten(ui.getByTestId('house-preview-frame').props.style).aspectRatio).toBe(
      (5 / 6) * (33 / 37),
    );
    expect(ui.getByLabelText('여섯 집 집 미리보기').props.recyclingKey).toBe(coverKey);
    // A different capacity gets its own image attempt, not a permanently broken flag.
    await ui.rerender(
      <HousePreviewFrame
        coverImageKey={coverKey}
        enabled
        maxMembers={2}
        memberCount={2}
        name="둘"
      />,
    );
    expect(ui.getAllByTestId('preview-room')).toHaveLength(2);
    expect(ui.getByLabelText('둘 집 미리보기').props.recyclingKey).toContain('-2p-frame.webp');
  });

  it.each([
    ['구름', DEFAULT_HOUSE_COVER_KEY],
    ['밤', 'house/night-observatory/house-unified-night-observatory-frame-v3.png'],
  ])('%s renders staged art but selects only the original server key', async (name, coverKey) => {
    const onSelect = jest.fn();
    const ui = await render(
      <HouseCoverPicker
        enabled
        maxMembers={2}
        covers={[{ code: name, name, coverImageKey: coverKey }]}
        onSelect={onSelect}
      />,
    );
    expect(ui.getByTestId('cover-art').props.recyclingKey).toContain('-2p-frame.webp');
    await fireEvent.press(ui.getByLabelText(`${name} 커버`));
    expect(onSelect).toHaveBeenCalledWith(coverKey);
    await fireEvent(ui.getByTestId('cover-art'), 'error', {
      nativeEvent: { error: 'unavailable' },
    });
    expect(ui.getByTestId('cover-art').props.recyclingKey).toBe(coverKey);
  });
});

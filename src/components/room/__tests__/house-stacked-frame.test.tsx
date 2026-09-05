import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { HouseCoverPicker } from '@/components/room/house-cover-picker';
import { DEFAULT_HOUSE_COVER_KEY, FRAME_ASPECT } from '@/resources/house-frame';

describe('stacked frame consumers', () => {
  it('shows six separate rooms and falls back with matching geometry when the frame fails', async () => {
    const ui = await render(
      <HousePreviewFrame enabled maxMembers={6} memberCount={6} name="여섯 집" />,
    );
    expect(ui.getAllByTestId('preview-room')).toHaveLength(6);
    expect(StyleSheet.flatten(ui.getByTestId('house-preview-frame').props.style).aspectRatio).toBe(
      1024 / 1576,
    );
    await fireEvent(ui.getByLabelText('여섯 집 집 미리보기'), 'error', {
      nativeEvent: { error: 'unavailable' },
    });
    expect(StyleSheet.flatten(ui.getByTestId('house-preview-frame').props.style).aspectRatio).toBe(
      FRAME_ASPECT,
    );
    expect(ui.getByLabelText('여섯 집 집 미리보기').props.recyclingKey).toBe(
      DEFAULT_HOUSE_COVER_KEY,
    );
    // A different capacity gets its own image attempt, not a permanently broken flag.
    await ui.rerender(<HousePreviewFrame enabled maxMembers={2} memberCount={2} name="둘" />);
    expect(ui.getAllByTestId('preview-room')).toHaveLength(2);
    expect(ui.getByLabelText('둘 집 미리보기').props.recyclingKey).toContain('-2p-frame.webp');
  });

  it('renders staged art but selects only the original server key', async () => {
    const onSelect = jest.fn();
    const ui = await render(
      <HouseCoverPicker
        enabled
        maxMembers={2}
        covers={[{ code: 'cloud_balloon', name: '구름', coverImageKey: DEFAULT_HOUSE_COVER_KEY }]}
        onSelect={onSelect}
      />,
    );
    expect(ui.getByTestId('cover-art').props.recyclingKey).toContain('-2p-frame.webp');
    await fireEvent.press(ui.getByLabelText('구름 커버'));
    expect(onSelect).toHaveBeenCalledWith(DEFAULT_HOUSE_COVER_KEY);
    await fireEvent(ui.getByTestId('cover-art'), 'error', {
      nativeEvent: { error: 'unavailable' },
    });
    expect(ui.getByTestId('cover-art').props.recyclingKey).toBe(DEFAULT_HOUSE_COVER_KEY);
  });
});

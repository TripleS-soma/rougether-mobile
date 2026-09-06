import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HouseCoverArt } from '@/components/room/house-cover-art';
import { HouseCoverPicker } from '@/components/room/house-cover-picker';
import { DEFAULT_HOUSE_COVER_KEY, FRAME_ASPECT } from '@/resources/house-frame';

it('respects thumbnail fit and falls back atomically on image failure', async () => {
  const ui = await render(
    <HouseCoverArt name="집" testID="art" enabled maxMembers={6} legacyContentFit="cover" />,
  );
  expect(ui.getByTestId('art').props.contentFit).toBe('cover');
  expect(ui.getByTestId('art').props.recyclingKey).toContain('-6p-frame.webp');
  await fireEvent(ui.getByTestId('art'), 'error', { nativeEvent: { error: 'offline' } });
  expect(ui.getByTestId('art').props.recyclingKey).toBe(DEFAULT_HOUSE_COVER_KEY);
  expect(StyleSheet.flatten(ui.getByTestId('art').props.style).aspectRatio).toBe(FRAME_ASPECT);
});

it('keeps supported and legacy covers in an equal-height picker grid', async () => {
  const ui = await render(
    <HouseCoverPicker
      enabled
      maxMembers={6}
      onSelect={() => {}}
      covers={[
        { code: 'cloud', name: '구름', coverImageKey: DEFAULT_HOUSE_COVER_KEY },
        { code: 'night', name: '밤', coverImageKey: 'house/night-observatory/legacy.png' },
      ]}
    />,
  );
  for (const art of ui.getAllByTestId('cover-art'))
    expect(StyleSheet.flatten(art.props.style).aspectRatio).toBe(FRAME_ASPECT);
});

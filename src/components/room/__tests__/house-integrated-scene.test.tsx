import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { HouseRoomAperture } from '@/components/room/house-room-aperture';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { HOUSE_SCENE_MANIFEST } from '@/resources/house-scene';
import { DEFAULT_HOUSE_COVER_KEY, STACKED_HOUSE_THEMES } from '@/resources/house-frame';

const ROOM = {
  characterId: 'cat' as const,
  wallpaperId: 'white',
  placements: [{ furnitureId: 'bed', x: 0.25, y: 0.78, z: 2, scale: 1.2, rotation: 10 }],
};
const HOUSE: House = {
  houseId: 44,
  name: '장면 검증',
  maxMembers: 2,
  coverImageKey: DEFAULT_HOUSE_COVER_KEY,
  missions: [],
  floors: [
    {
      level: '1층',
      rooms: [
        { name: '지민', color: 'transparent', membershipId: 81 },
        { name: '빈방', color: 'transparent', vacant: true },
      ],
    },
  ],
};

describe('opaque scene consumers', () => {
  it('draws rooms above local opaque art, keeps canonical furniture placements, and falls back atomically twice', async () => {
    const ui = await render(
      <HousePreviewFrame maxMembers={2} rooms={[ROOM]} name="테스트" integratedEnabled />,
    );
    const image = ui.getByLabelText('테스트 집 미리보기');
    expect(image.props.source).not.toHaveProperty('uri');
    expect(StyleSheet.flatten(ui.getByTestId('house-artwork-layer').props.style).zIndex).toBe(0);
    expect(ui.getAllByTestId('preview-room')).toHaveLength(1);
    expect(ui.getAllByTestId('preview-vacant')).toHaveLength(1);
    expect(ui.getAllByTestId('house-room-aperture')).toHaveLength(2);
    expect(ui.getAllByTestId('house-aperture-shade')[0].props.pointerEvents).toBe('none');
    const furniture = ui.getByTestId('room-furniture-bed');
    expect(parseFloat(StyleSheet.flatten(furniture.props.style).left)).toBeCloseTo(11);
    await fireEvent(image, 'error', { nativeEvent: { error: 'broken local image' } });
    expect(ui.queryByTestId('house-room-aperture')).toBeNull();
    expect(ui.getByLabelText('테스트 집 미리보기').props.recyclingKey).toContain('-2p-frame.webp');
    expect(StyleSheet.flatten(ui.getByTestId('house-artwork-layer').props.style).zIndex).toBe(2);
    await fireEvent(ui.getByLabelText('테스트 집 미리보기'), 'error', {
      nativeEvent: { error: 'offline' },
    });
    expect(ui.getByLabelText('테스트 집 미리보기').props.recyclingKey).toBe(
      DEFAULT_HOUSE_COVER_KEY,
    );
  });

  it('keeps 5:6 sprites under uniform cover even when an aperture is slightly wider', async () => {
    const rect = { x: 0, y: 0, width: 300, height: 350, radius: 24 };
    const ui = await render(
      <HouseRoomAperture rect={rect}>
        <View />
      </HouseRoomAperture>,
    );
    const canvas = StyleSheet.flatten(ui.getByTestId('house-room-canvas').props.style);
    const width = (parseFloat(canvas.width as string) / 100) * rect.width;
    const height = (parseFloat(canvas.height as string) / 100) * rect.height;
    expect(width / height).toBeCloseTo(5 / 6);
    expect(width).toBeGreaterThanOrEqual(rect.width);
    expect(height).toBeGreaterThanOrEqual(rect.height);
    await fireEvent(ui.getByTestId('house-room-aperture'), 'layout', {
      nativeEvent: { layout: { width: 150, height: 175 } },
    });
    expect(StyleSheet.flatten(ui.getByTestId('house-room-aperture').props.style).borderRadius).toBe(
      12,
    );
  });

  it('uses the actual screen seat visit and suppresses the separate background', async () => {
    const visit = jest.fn();
    const ui = await render(
      <HouseScreen
        houses={[HOUSE]}
        roomPreviews={{ 81: ROOM }}
        integratedEnabled
        onVisitFriend={visit}
      />,
    );
    expect(ui.queryByTestId('house-background')).toBeNull();
    expect(ui.getByTestId('house-frame').props.recyclingKey).toContain('bundled-house-scene/');
    await fireEvent.press(ui.getByLabelText('지민'));
    expect(visit).toHaveBeenCalledWith(expect.objectContaining({ houseId: 44, membershipId: 81 }));
    await fireEvent.press(ui.getByLabelText('빈방'));
    expect(visit).toHaveBeenCalledTimes(1);
    await fireEvent(ui.getByTestId('house-frame'), 'error', { nativeEvent: { error: 'missing' } });
    expect(ui.getByTestId('house-background')).toBeTruthy();
  });
});

describe.each(HOUSE_SCENE_MANIFEST.scenes)('$themeId $capacity person screen', (scene) => {
  it('keeps all membership identities in bottom-to-top rooms and the last member visit', async () => {
    const theme = STACKED_HOUSE_THEMES.find((entry) => entry.id === scene.themeId)!;
    const house: House = {
      ...HOUSE,
      coverImageKey: theme.legacyKey!,
      maxMembers: scene.capacity,
      floors: Array.from({ length: scene.capacity / 2 }, (_, row) => ({
        level: `${row + 1}층`,
        rooms: Array.from({ length: 2 }, (_, col) => ({
          name: `좌석 ${row * 2 + col + 1}`,
          color: 'transparent',
          membershipId: row * 2 + col + 1,
        })),
      })).reverse(),
    };
    const visit = jest.fn();
    const ui = await render(
      <HouseScreen houses={[house]} integratedEnabled onVisitFriend={visit} />,
    );
    expect(ui.getAllByTestId(/^house-window-/)).toHaveLength(scene.capacity);
    expect(ui.getByTestId('house-frame').props.recyclingKey).toBe(
      `bundled-house-scene/${scene.file}`,
    );
    for (let member = 1; member <= scene.capacity; member++)
      expect(ui.getByRole('button', { name: `좌석 ${member}` })).toBeTruthy();
    await fireEvent.press(ui.getByRole('button', { name: `좌석 ${scene.capacity}` }));
    expect(visit).toHaveBeenCalledWith(expect.objectContaining({ membershipId: scene.capacity }));
  });
});

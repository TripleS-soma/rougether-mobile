import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { type PanGesture, PointerType, State } from 'react-native-gesture-handler';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import { HouseRoomAperture } from '@/components/room/house-room-aperture';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { HOUSE_SCENE_MANIFEST } from '@/resources/house-scene';
import { DEFAULT_HOUSE_COVER_KEY, STACKED_HOUSE_THEMES } from '@/resources/house-frame';
import { HouseSceneGroundColors } from '@/constants/theme';

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
    expect(ui.queryByTestId('house-scene-ground-fade')).toBeNull();
  });
});

describe('responsive scene lifecycle', () => {
  it.each(['house-frame', 'house-scene-backdrop'])(
    'falls back art and geometry together when %s fails',
    async (image) => {
      const ui = await render(<HouseScreen houses={[HOUSE]} />);
      await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } },
      });
      await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 200, width: 393, height: 0 } },
      });
      expect(ui.getByTestId('house-scene-uniform-art')).toBeTruthy();
      await fireEvent(ui.getByTestId(image), 'error', {
        nativeEvent: { error: 'missing bundled image' },
      });
      expect(ui.queryByTestId('house-scene-uniform-art')).toBeNull();
      expect(ui.queryByTestId('house-scene-backdrop')).toBeNull();
      expect(ui.queryByTestId('house-room-aperture')).toBeNull();
      expect(ui.getByTestId('house-frame').props.recyclingKey).toContain('-2p-frame.webp');
      expect(ui.getByTestId('house-scroll').props.scrollEnabled).toBe(true);
    },
  );

  it.each(['theme', 'capacity', 'header', 'viewport'])(
    'resets zoom, clears old scroll, and releases pager lock after %s changes',
    async (change) => {
      const lock = jest.fn();
      const scroll = jest.fn();
      const props = {
        houses: [HOUSE],
        onPagerLockChange: lock,
        onScrollY: scroll,
        initialScrollY: 480,
      };
      const ui = await render(<HouseScreen {...props} />);
      const measure = (width = 393, height = 852) =>
        fireEvent(ui.getByTestId('house-scroll'), 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width, height } },
        });
      const header = (y: number) =>
        fireEvent(ui.getByTestId('house-header-end'), 'layout', {
          nativeEvent: { layout: { x: 0, y, width: 393, height: 0 } },
        });
      await measure();
      await header(200);
      const camera = getByGestureTestId('house-camera-pan') as PanGesture;
      const manager = {
        handlerTag: camera.handlerTag,
        begin: jest.fn(),
        activate: jest.fn(),
        fail: jest.fn(),
        end: jest.fn(),
      };
      const touches = (distance: number) => {
        const allTouches = [100, 100 + distance].map((x, id) => ({
          id,
          x,
          y: 100,
          absoluteX: x,
          absoluteY: 100,
        }));
        return {
          handlerTag: camera.handlerTag,
          state: State.BEGAN,
          eventType: 2 as const,
          numberOfTouches: 2,
          pointerType: PointerType.TOUCH,
          allTouches,
          changedTouches: allTouches,
        };
      };
      await act(async () => {
        camera.handlers.onTouchesDown?.(touches(100), manager);
        camera.handlers.onTouchesMove?.(touches(100), manager);
        camera.handlers.onTouchesMove?.(touches(160), manager);
      });
      expect(lock).toHaveBeenLastCalledWith(true);
      expect(ui.getByLabelText('확대 종료')).toBeTruthy();
      if (change === 'header') await header(244);
      else if (change === 'viewport') await measure(768, 1024);
      else
        await ui.rerender(
          <HouseScreen
            {...props}
            houses={[
              {
                ...HOUSE,
                ...(change === 'capacity'
                  ? { maxMembers: 6 }
                  : {
                      coverImageKey: STACKED_HOUSE_THEMES.find(
                        (theme) => theme.id === 'mushroom-forest',
                      )!.legacyKey,
                    }),
              },
            ]}
          />,
        );
      expect(ui.queryByLabelText('확대 종료')).toBeNull();
      expect(lock).toHaveBeenLastCalledWith(false);
      expect(scroll).toHaveBeenLastCalledWith(0);
      expect(ui.getByTestId('house-scroll').props.contentOffset).toEqual({ x: 0, y: 0 });
    },
  );

  it('keeps pull-to-refresh at the fixed overview and disables it during a seat drag', async () => {
    const refresh = jest.fn(() => Promise.resolve());
    const ui = await render(<HouseScreen houses={[HOUSE]} onRefresh={refresh} />);
    expect(ui.getByTestId('house-scroll').props.scrollEnabled).toBe(false);
    const pull = async () =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('house-refresh-pan'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, translationY: 0 },
          { state: State.ACTIVE, translationY: 0 },
          { state: State.ACTIVE, translationY: 140 },
          { state: State.END, translationY: 140 },
        ]),
      );
    await pull();
    expect(refresh).toHaveBeenCalledTimes(1);
    await fireEvent(ui.getByLabelText('지민'), 'longPress');
    await pull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('cancels a lifted seat when its measured hit regions move', async () => {
    const lock = jest.fn();
    const swap = jest.fn();
    const ui = await render(
      <HouseScreen houses={[HOUSE]} onPagerLockChange={lock} onSwapSeats={swap} />,
    );
    await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } },
    });
    await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 200, width: 393, height: 0 } },
    });
    await fireEvent(ui.getByLabelText('지민'), 'longPress');
    expect(lock).toHaveBeenLastCalledWith(true);
    await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 250, width: 393, height: 0 } },
    });
    expect(lock).toHaveBeenLastCalledWith(false);
    expect(swap).not.toHaveBeenCalled();
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
    expect(StyleSheet.flatten(ui.getByTestId('house-screen').props.style).backgroundColor).toBe(
      HouseSceneGroundColors[scene.themeId][scene.capacity],
    );
    expect(ui.getByTestId('house-scene-ground-fade').props.pointerEvents).toBe('none');
    // Preserve the roof, garden and rooms inside measured controls and navigation.
    for (const [width, height] of [
      [393, 852],
      [393, 1100],
      [320, 568],
      [768, 1024],
    ]) {
      await fireEvent(ui.getByTestId('house-scroll'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width, height } },
      });
      await fireEvent(ui.getByTestId('house-header-end'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 200, width, height: 0 } },
      });
      const canvas = StyleSheet.flatten(ui.getByTestId('house-scene-camera').props.style);
      expect(canvas.width).toBe(width);
      expect(canvas.height).toBe(height);
      expect(canvas.marginLeft ?? 0).toBe(0);
      const core = StyleSheet.flatten(ui.getByTestId('house-scene-protected-region').props.style);
      const scale = core.width / scene.protectedRect.width;
      expect(core.top).toBeGreaterThanOrEqual(208 - 0.001);
      expect(core.top + core.height).toBeLessThanOrEqual(height - 92 + 0.001);
      expect(ui.getByTestId('house-scroll').props.scrollEnabled).toBe(false);
      expect(ui.getByTestId('house-scroll').props.contentOffset).toEqual({ x: 0, y: 0 });
      expect(ui.getByTestId('house-scene-backdrop').props.contentFit).toBe('cover');
      scene.roomRects.forEach((rect, index) => {
        const slot = StyleSheet.flatten(ui.getByTestId(`house-window-${index}`).props.style);
        expect(slot.left).toBeCloseTo(core.left + (rect.x - scene.protectedRect.x) * scale);
        expect(slot.top).toBeCloseTo(core.top + (rect.y - scene.protectedRect.y) * scale);
        expect(slot.width).toBeCloseTo(rect.width * scale);
        const seat = (scene.capacity / 2 - 1 - Math.floor(index / 2)) * 2 + (index % 2);
        const name = ui.queryByTestId(`seat-meta-${seat}`);
        if (slot.width < 64) expect(name).toBeNull();
        else {
          expect(name).not.toBeNull();
          const badge = StyleSheet.flatten(name!.props.style);
          expect(badge.top).toBe(4);
          expect(badge.bottom).toBe('auto');
        }
        expect(slot.top + slot.height).toBeLessThanOrEqual(height - 92 + 0.001);
      });
    }
    for (let member = 1; member <= scene.capacity; member++)
      expect(ui.getByRole('button', { name: `좌석 ${member}` })).toBeTruthy();
    await fireEvent.press(ui.getByRole('button', { name: `좌석 ${scene.capacity}` }));
    expect(visit).toHaveBeenCalledWith(expect.objectContaining({ membershipId: scene.capacity }));
  });
});

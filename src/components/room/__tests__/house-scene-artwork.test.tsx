import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HouseSceneArtwork } from '@/components/room/house-scene-artwork';
import { HOUSE_SCENE_MANIFEST, resolveHouseScene } from '@/resources/house-scene';
import { layoutHouseScene } from '@/resources/house-scene-layout';
import { HOUSE_SCENE_BACKDROPS } from '@/resources/house-scenes/backdrops/sources';
import { HOUSE_SCENE_DISPLAY_SOURCES } from '@/resources/house-scenes/display/sources';

it('registers an alpha display image for exactly the twelve original scenes', () => {
  expect(Object.keys(HOUSE_SCENE_DISPLAY_SOURCES).sort()).toEqual(
    HOUSE_SCENE_MANIFEST.scenes.map((scene) => scene.file).sort(),
  );
});

it.each(HOUSE_SCENE_MANIFEST.scenes)(
  'renders $themeId $capacity through visible Expo images at the shared uniform coordinates',
  async (entry) => {
    const scene = resolveHouseScene(entry.themeId, entry.capacity)!;
    const layout = layoutHouseScene(
      scene,
      { width: 320, height: 568 },
      { x: 8, y: 180, width: 304, height: 288 },
    )!;
    const error = jest.fn();
    const ui = await render(
      <HouseSceneArtwork
        scene={scene}
        layout={layout}
        assetKey={scene.file}
        backgroundSource={HOUSE_SCENE_BACKDROPS[scene.themeId]}
        label="House"
        onError={error}
        testID="visible-house"
      />,
    );
    const art = StyleSheet.flatten(ui.getByLabelText('House').props.style);
    expect(art).toMatchObject({
      left: layout.imageRect.x,
      top: layout.imageRect.y,
      width: layout.imageRect.width,
      height: layout.imageRect.height,
    });
    expect(art.width / art.height).toBeCloseTo(scene.width / scene.height);
    const foreground = ui.getByTestId('visible-house');
    expect(foreground.props.source).toEqual([HOUSE_SCENE_DISPLAY_SOURCES[scene.file]]);
    expect(foreground.props.source).not.toEqual([scene.source]);
    expect(foreground.props.contentFit).toBe('contain');
    expect(foreground.props.allowDownscaling).toBe(false);
    expect(foreground.props.cachePolicy).toBe('memory-disk');
    expect(StyleSheet.flatten(foreground.props.style).opacity).not.toBe(0);
    const backdrop = ui.getByTestId('house-scene-backdrop');
    expect(backdrop.props.source).toEqual([HOUSE_SCENE_BACKDROPS[scene.themeId]]);
    expect(backdrop.props.contentFit).toBe('cover');
    expect(ui.getAllByRole('image')).toHaveLength(1);
    expect(
      ui.getByTestId('house-scene-uniform-art').queryAll((node) => /RNSVG/.test(node.type)),
    ).toHaveLength(0);
    await fireEvent(foreground, 'error', { nativeEvent: { error: 'missing display image' } });
    expect(error).toHaveBeenCalledTimes(1);
    await fireEvent(backdrop, 'error', { nativeEvent: { error: 'missing background' } });
    expect(error).toHaveBeenCalledTimes(2);
  },
);

it('rejects an unregistered display image instead of leaving floating rooms', async () => {
  const source = resolveHouseScene('night-observatory', 6)!;
  const scene = { ...source, file: 'missing-display.webp' };
  const layout = layoutHouseScene(
    scene,
    { width: 393, height: 852 },
    { x: 8, y: 220, width: 377, height: 510 },
  )!;
  const error = jest.fn();
  const ui = await render(
    <HouseSceneArtwork
      scene={scene}
      layout={layout}
      assetKey={scene.file}
      backgroundSource={HOUSE_SCENE_BACKDROPS[scene.themeId]}
      label="House"
      onError={error}
      testID="visible-house"
    />,
  );
  expect(error).toHaveBeenCalledTimes(1);
  expect(ui.queryByTestId('visible-house')).toBeNull();
});

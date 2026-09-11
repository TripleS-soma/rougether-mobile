import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { HouseFrameArtwork } from '@/components/room/house-frame-artwork';
import { resolveHouseFrame, STACKED_HOUSE_THEMES } from '@/resources/house-frame';

import { HouseSceneArtwork } from '@/components/room/house-scene-artwork';
import { resolveHouseScene } from '@/resources/house-scene';
import { layoutHouseScene } from '@/resources/house-scene-layout';
import { HOUSE_SCENE_BACKDROPS } from '@/resources/house-scenes/backdrops/sources';

it('keeps the protected art opaque, feathers only its surroundings, and never stretches it', async () => {
  const scene = resolveHouseScene('night-observatory', 6)!;
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
      label="밤의 천문대 집"
      onError={error}
      testID="source-probe"
    />,
  );
  const art = StyleSheet.flatten(ui.getByLabelText('밤의 천문대 집').props.style);
  expect(art.width / art.height).toBeCloseTo(scene.width / scene.height);
  expect(ui.getByTestId('source-probe').props.source).toEqual([scene.source]);
  expect(ui.getByTestId('house-scene-backdrop').props.source).toEqual([
    HOUSE_SCENE_BACKDROPS[scene.themeId],
  ]);
  expect(ui.getByTestId('house-scene-backdrop').props.contentFit).toBe('cover');
  const gradients = ui
    .getByTestId('house-scene-uniform-art')
    .queryAll((node) => Array.isArray(node.props.gradient));
  expect(gradients).toHaveLength(2);
  for (const [index, gradient] of gradients.entries()) {
    const values: number[] = gradient.props.gradient;
    const stops = [0, 2, 4, 6].map((index) => ({
      offset: values[index],
      alpha: values[index + 1] >>> 24,
    }));
    expect(stops.map((stop) => stop.alpha)).toEqual([0, 255, 255, 0]);
    const origin = index === 0 ? scene.protectedRect.x : scene.protectedRect.y;
    const size = index === 0 ? scene.protectedRect.width : scene.protectedRect.height;
    const total = index === 0 ? scene.width : scene.height;
    expect(stops[1].offset * total).toBeCloseTo(origin);
    expect(stops[2].offset * total).toBeCloseTo(origin + size);
    expect((stops[1].offset - stops[0].offset) * total * layout.scale).toBeLessThanOrEqual(24.001);
    expect((stops[3].offset - stops[2].offset) * total * layout.scale).toBeLessThanOrEqual(24.001);
  }
  await fireEvent(ui.getByTestId('source-probe'), 'error', {
    nativeEvent: { error: 'missing scene' },
  });
  await fireEvent(ui.getByTestId('house-scene-backdrop'), 'error', {
    nativeEvent: { error: 'missing background' },
  });
  expect(error).toHaveBeenCalledTimes(2);
});

it.each(['silent failure', 'loaded', 'unmounted'])(
  'handles visible SVG %s independently from the Expo probe',
  async (status) => {
    jest.useFakeTimers();
    try {
      const scene = resolveHouseScene('night-observatory', 6)!;
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
          label="Scene"
          onError={error}
          testID="source-probe"
        />,
      );
      await fireEvent(ui.getByTestId('source-probe'), 'load', {
        source: { width: scene.width, height: scene.height },
      });
      if (status === 'loaded')
        await fireEvent(ui.getByTestId('house-scene-visible-image'), 'load', {
          nativeEvent: { source: { width: scene.width, height: scene.height } },
        });
      if (status === 'unmounted') await ui.unmount();
      await act(async () => jest.advanceTimersByTime(15001));
      expect(error).toHaveBeenCalledTimes(status === 'silent failure' ? 1 : 0);
      if (status !== 'unmounted') await ui.unmount();
    } finally {
      jest.useRealTimers();
    }
  },
);

it('isolates each asset watchdog from a stale previous image load and a return visit', async () => {
  jest.useFakeTimers();
  try {
    const error = jest.fn();
    const frameFor = (id: string) =>
      resolveHouseFrame(STACKED_HOUSE_THEMES.find((theme) => theme.id === id)!.legacyKey, {
        maxMembers: 6,
        integratedEnabled: true,
      });
    const a = frameFor('mushroom-forest');
    const b = frameFor('cloud-balloon');
    const renderFrame = (frame: ReturnType<typeof frameFor>) => (
      <HouseFrameArtwork
        frame={frame}
        sceneLayout={layoutHouseScene(
          frame.scene!,
          { width: 393, height: 852 },
          { x: 8, y: 220, width: 377, height: 510 },
        )!}
        label="Scene"
        onError={error}
      />
    );
    const ui = await render(renderFrame(a));
    const staleALoad = ui.getByTestId('house-scene-visible-image').props.onLoad;
    await act(async () => staleALoad({ nativeEvent: {} }));
    await ui.rerender(renderFrame(b));
    await act(async () => staleALoad({ nativeEvent: {} }));
    await act(async () => jest.advanceTimersByTime(15001));
    expect(error).toHaveBeenCalledTimes(1);
    await ui.rerender(renderFrame(a));
    await act(async () => jest.advanceTimersByTime(15001));
    expect(error).toHaveBeenCalledTimes(2);
    await ui.unmount();
  } finally {
    jest.useRealTimers();
  }
});

import { Image } from 'expo-image';
import { useEffect, useId, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

import type { HouseScene } from '@/resources/house-scene';
import type { HouseSceneLayout } from '@/resources/house-scene-layout';

/** Uniform house art blends into matching background art; the protected core stays opaque. */
export function HouseSceneArtwork({
  scene,
  layout,
  assetKey,
  backgroundSource,
  label,
  onError,
  testID,
}: {
  scene: HouseScene;
  layout: HouseSceneLayout;
  assetKey: string;
  backgroundSource: number;
  label: string;
  onError: () => void;
  testID?: string;
}) {
  const id = useId().replace(/:/g, '');
  const loadedAsset = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const error = useRef(onError);
  error.current = onError;
  // Expo and SVG use separate decoders. Require success from the visible SVG too.
  useEffect(() => {
    timeout.current = setTimeout(() => {
      if (loadedAsset.current !== assetKey) error.current();
    }, 15000);
    return () => clearTimeout(timeout.current);
  }, [assetKey]);
  const visibleArtLoaded = () => {
    loadedAsset.current = assetKey;
    clearTimeout(timeout.current);
  };
  const roi = scene.protectedRect;
  const feather = Math.min(64, 24 / layout.scale);
  const xStops = [
    Math.max(0, roi.x - feather) / scene.width,
    roi.x / scene.width,
    (roi.x + roi.width) / scene.width,
    Math.min(scene.width, roi.x + roi.width + feather) / scene.width,
  ];
  const yStops = [
    Math.max(0, roi.y - feather) / scene.height,
    roi.y / scene.height,
    (roi.y + roi.height) / scene.height,
    Math.min(scene.height, roi.y + roi.height + feather) / scene.height,
  ];
  const opacity = [0, 1, 1, 0];
  return (
    <>
      {backgroundSource ? (
        <Image
          source={backgroundSource}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`house-backdrop/${scene.themeId}`}
          onError={onError}
          accessible={false}
          testID="house-scene-backdrop"
        />
      ) : null}
      {/* SVG Image has no error callback. Probe the exact local source with Expo Image. */}
      <Image
        source={scene.source}
        style={styles.probe}
        onError={onError}
        cachePolicy="memory-disk"
        recyclingKey={assetKey}
        accessible={false}
        testID={testID}
      />
      <View
        style={{
          position: 'absolute',
          left: layout.imageRect.x,
          top: layout.imageRect.y,
          width: layout.imageRect.width,
          height: layout.imageRect.height,
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        testID="house-scene-uniform-art">
        <Svg width="100%" height="100%" viewBox={`0 0 ${scene.width} ${scene.height}`}>
          <Defs>
            <LinearGradient id={`${id}-x`} x1="0" y1="0" x2="1" y2="0">
              {xStops.map((offset, index) => (
                <Stop key={index} offset={offset} stopColor="white" stopOpacity={opacity[index]} />
              ))}
            </LinearGradient>
            <LinearGradient id={`${id}-y`} x1="0" y1="0" x2="0" y2="1">
              {yStops.map((offset, index) => (
                <Stop key={index} offset={offset} stopColor="white" stopOpacity={opacity[index]} />
              ))}
            </LinearGradient>
            <Mask
              id={`${id}-vertical`}
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              maskUnits="userSpaceOnUse"
              style={{ maskType: 'alpha' }}>
              <Rect width={scene.width} height={scene.height} fill={`url(#${id}-y)`} />
            </Mask>
            <Mask
              id={`${id}-edge`}
              x={0}
              y={0}
              width={scene.width}
              height={scene.height}
              maskUnits="userSpaceOnUse"
              style={{ maskType: 'alpha' }}>
              <Rect
                width={scene.width}
                height={scene.height}
                fill={`url(#${id}-x)`}
                mask={`url(#${id}-vertical)`}
              />
            </Mask>
          </Defs>
          <SvgImage
            href={scene.source}
            onLoad={visibleArtLoaded}
            testID="house-scene-visible-image"
            x={0}
            y={0}
            width={scene.width}
            height={scene.height}
            preserveAspectRatio="xMidYMid meet"
            mask={`url(#${id}-edge)`}
          />
        </Svg>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  probe: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

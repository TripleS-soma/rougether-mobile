import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import type { HouseScene } from '@/resources/house-scene';
import type { HouseSceneLayout } from '@/resources/house-scene-layout';
import { HOUSE_SCENE_DISPLAY_SOURCES } from '@/resources/house-scenes/display/sources';

/** Precomputed alpha keeps the protected house opaque without runtime masking. */
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
  const foregroundSource = HOUSE_SCENE_DISPLAY_SOURCES[scene.file];
  useEffect(() => {
    if (foregroundSource == null || backgroundSource == null) onError();
  }, [foregroundSource, backgroundSource, onError]);
  if (foregroundSource == null || backgroundSource == null) return null;
  return (
    <>
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
        <Image
          source={foregroundSource}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          allowDownscaling={false}
          cachePolicy="memory-disk"
          recyclingKey={assetKey}
          onError={onError}
          accessible={false}
          testID={testID}
        />
      </View>
    </>
  );
}

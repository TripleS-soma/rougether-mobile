import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { HouseSceneColors, Spacing } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import type { HouseFrame } from '@/resources/house-frame';
import { HouseSceneArtwork } from '@/components/room/house-scene-artwork';
import { HOUSE_SCENE_BACKDROPS } from '@/resources/house-scenes/backdrops/sources';
import type { HouseSceneLayout } from '@/resources/house-scene-layout';

export function HouseFrameArtwork({
  frame,
  label,
  onError,
  testID,
  groundColor,
  sceneLayout,
}: {
  frame: HouseFrame;
  label: string;
  onError: () => void;
  testID?: string;
  groundColor?: string;
  sceneLayout?: HouseSceneLayout;
}) {
  const groundFadeId = useId().replace(/:/g, '');
  const scheme = useResolvedScheme();
  const integrated = frame.kind === 'integrated';
  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: integrated ? 0 : 2 }]}
      pointerEvents="none"
      testID="house-artwork-layer">
      {sceneLayout ? (
        <View
          testID="house-scene-protected-region"
          style={{
            position: 'absolute',
            left: sceneLayout.protectedRect.x,
            top: sceneLayout.protectedRect.y,
            width: sceneLayout.protectedRect.width,
            height: sceneLayout.protectedRect.height,
          }}
          pointerEvents="none"
        />
      ) : null}
      {integrated && sceneLayout ? (
        <HouseSceneArtwork
          key={frame.assetKey}
          scene={frame.scene!}
          layout={sceneLayout}
          assetKey={frame.assetKey}
          backgroundSource={HOUSE_SCENE_BACKDROPS[frame.scene!.themeId]}
          label={label}
          onError={onError}
          testID={testID}
        />
      ) : (
        <Image
          key={frame.assetKey}
          source={frame.scene?.source ?? assetSource(frame.assetKey)}
          style={StyleSheet.absoluteFill}
          contentFit="fill"
          transition={frame.kind === 'legacy' ? 120 : 0}
          onError={onError}
          recyclingKey={frame.assetKey}
          cachePolicy="memory-disk"
          accessibilityLabel={label}
          testID={testID}
        />
      )}
      {integrated && groundColor && !sceneLayout ? (
        <View style={styles.groundFade} testID="house-scene-ground-fade" pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={groundFadeId} x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={groundColor} stopOpacity="0" />
                <Stop offset="1" stopColor={groundColor} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${groundFadeId})`} />
          </Svg>
        </View>
      ) : null}
      {integrated && scheme === 'dark' ? (
        <View style={[StyleSheet.absoluteFill, styles.nightTint]} testID="house-scene-dark-tint" />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  nightTint: { backgroundColor: HouseSceneColors.nightTint },
  groundFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: Spacing.four },
});

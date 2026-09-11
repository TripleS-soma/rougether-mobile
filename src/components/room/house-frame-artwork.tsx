import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { HouseSceneColors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import type { HouseFrame } from '@/resources/house-frame';

export function HouseFrameArtwork({
  frame,
  label,
  onError,
  testID,
}: {
  frame: HouseFrame;
  label: string;
  onError: () => void;
  testID?: string;
}) {
  const scheme = useResolvedScheme();
  const integrated = frame.kind === 'integrated';
  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: integrated ? 0 : 2 }]}
      pointerEvents="none"
      testID="house-artwork-layer">
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
      {integrated && scheme === 'dark' ? (
        <View style={[StyleSheet.absoluteFill, styles.nightTint]} testID="house-scene-dark-tint" />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ nightTint: { backgroundColor: HouseSceneColors.nightTint } });

import { Image } from 'expo-image';
import { houseDioramaTheme, HOUSE_DIORAMA_ASPECT } from '@/resources/house-diorama';
import type { StyleProp, ImageStyle } from 'react-native';

import { useHouseFrame } from '@/hooks/use-house-frame';
import { assetSource } from '@/resources/asset';
import type { HouseFrameOptions } from '@/resources/house-frame';

type Props = HouseFrameOptions & {
  coverImageKey?: string;
  name: string;
  style?: StyleProp<ImageStyle>;
  testID?: string;
  legacyContentFit?: 'cover' | 'contain';
};

/** Display-only thumbnail: the picker still submits the server's original key. */
export function HouseCoverArt({
  coverImageKey,
  name,
  style,
  testID,
  legacyContentFit = 'contain',
  ...options
}: Props) {
  const { frame, onFrameError } = useHouseFrame(coverImageKey, options);
  const diorama = houseDioramaTheme(coverImageKey, options.enabled);
  return (
    <Image
      key={diorama?.id ?? frame.assetKey}
      source={diorama?.source ?? assetSource(frame.assetKey)}
      style={[{ aspectRatio: diorama ? HOUSE_DIORAMA_ASPECT : frame.sourceAspectRatio }, style]}
      contentFit={legacyContentFit}
      transition={0}
      cachePolicy="memory-disk"
      recyclingKey={diorama?.id ?? frame.assetKey}
      onError={diorama ? undefined : onFrameError}
      accessibilityLabel={name}
      testID={testID}
    />
  );
}

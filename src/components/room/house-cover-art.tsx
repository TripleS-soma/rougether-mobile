import { Image } from 'expo-image';
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
  return (
    <Image
      key={frame.assetKey}
      source={assetSource(frame.assetKey)}
      style={[{ aspectRatio: frame.aspectRatio }, style]}
      contentFit={frame.kind === 'stacked' ? 'contain' : legacyContentFit}
      transition={frame.kind === 'stacked' ? 0 : 120}
      cachePolicy="memory-disk"
      recyclingKey={frame.assetKey}
      onError={onFrameError}
      accessibilityLabel={name}
      testID={testID}
    />
  );
}

import { Image } from 'expo-image';
import { type ImageStyle, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { PawPictogram } from '@/components/ui/pictograms';
import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';

import bear1 from '@/assets/images/characters/bear-1.webp';
import bear2 from '@/assets/images/characters/bear-2.webp';
import bear3 from '@/assets/images/characters/bear-3.webp';
import bear4 from '@/assets/images/characters/bear-4.webp';
import cat1 from '@/assets/images/characters/cat-1.webp';
import cat2 from '@/assets/images/characters/cat-2.webp';
import cat3 from '@/assets/images/characters/cat-3.webp';
import cat4 from '@/assets/images/characters/cat-4.webp';
import dog1 from '@/assets/images/characters/dog-1.webp';
import dog2 from '@/assets/images/characters/dog-2.webp';
import dog3 from '@/assets/images/characters/dog-3.webp';
import dog4 from '@/assets/images/characters/dog-4.webp';
import horse1 from '@/assets/images/characters/horse-1.webp';
import horse2 from '@/assets/images/characters/horse-2.webp';
import horse3 from '@/assets/images/characters/horse-3.webp';
import horse4 from '@/assets/images/characters/horse-4.webp';
import otter1 from '@/assets/images/characters/otter-1.webp';
import otter2 from '@/assets/images/characters/otter-2.webp';
import otter3 from '@/assets/images/characters/otter-3.webp';
import otter4 from '@/assets/images/characters/otter-4.webp';
import panda1 from '@/assets/images/characters/panda-1.webp';
import panda2 from '@/assets/images/characters/panda-2.webp';
import panda3 from '@/assets/images/characters/panda-3.webp';
import panda4 from '@/assets/images/characters/panda-4.webp';
import sheep1 from '@/assets/images/characters/sheep-1.webp';
import sheep2 from '@/assets/images/characters/sheep-2.webp';
import sheep3 from '@/assets/images/characters/sheep-3.webp';
import sheep4 from '@/assets/images/characters/sheep-4.webp';
import tiger1 from '@/assets/images/characters/tiger-1.webp';
import tiger2 from '@/assets/images/characters/tiger-2.webp';
import tiger3 from '@/assets/images/characters/tiger-3.webp';
import tiger4 from '@/assets/images/characters/tiger-4.webp';

/** Static pose frames per character (index 0–3). */
const FRAMES: Record<CharacterId, number[]> = {
  bear: [bear1, bear2, bear3, bear4],
  cat: [cat1, cat2, cat3, cat4],
  dog: [dog1, dog2, dog3, dog4],
  horse: [horse1, horse2, horse3, horse4],
  otter: [otter1, otter2, otter3, otter4],
  panda: [panda1, panda2, panda3, panda4],
  sheep: [sheep1, sheep2, sheep3, sheep4],
  tiger: [tiger1, tiger2, tiger3, tiger4],
};

/** Number of poses available per character. */
export const POSE_COUNT = 4;

export type CharacterAvatarProps = {
  characterId: CharacterId;
  /** Which pose frame to show (0–3); wraps if out of range. Defaults to 0. */
  pose?: number;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Renders a character as a static pose frame via `expo-image`. `pose` selects the
 * frame (the room in 나의 방 cycles it on tap; elsewhere it stays at 0). Falls back
 * to the emoji glyph if the frame is missing. Shared by the room and any
 * single-character display.
 */
export function CharacterAvatar({ characterId, pose = 0, size = 96, style }: CharacterAvatarProps) {
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const frames = FRAMES[characterId];
  const source = frames?.[((pose % POSE_COUNT) + POSE_COUNT) % POSE_COUNT];

  if (!source) {
    // No frame art for this character yet — a neutral paw mark stands in.
    return (
      <View
        style={[{ width: size, height: size }, styles.center, style as StyleProp<ViewStyle>]}
        accessibilityLabel={character.name}>
        <PawPictogram size={size * 0.55} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel={character.name}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

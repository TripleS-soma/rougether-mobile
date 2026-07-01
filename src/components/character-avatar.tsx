import { Image } from 'expo-image';
import {
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { CHARACTER_OPTIONS, type CharacterId } from '@/constants/characters';

import bear from '@/assets/images/characters/bear.webp';
import cat from '@/assets/images/characters/cat.webp';
import dog from '@/assets/images/characters/dog.webp';
import horse from '@/assets/images/characters/horse.webp';
import otter from '@/assets/images/characters/otter.webp';
import panda from '@/assets/images/characters/panda.webp';
import sheep from '@/assets/images/characters/sheep.webp';
import tiger from '@/assets/images/characters/tiger.webp';

/** Animated sprite (looping WebP) per character. */
const SPRITES: Record<CharacterId, number> = {
  bear,
  cat,
  dog,
  horse,
  otter,
  panda,
  sheep,
  tiger,
};

export type CharacterAvatarProps = {
  characterId: CharacterId;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Renders a character as its looping animated sprite via `expo-image` (auto-plays
 * animated WebP). Falls back to the emoji glyph if the sprite is missing. Shared
 * by the room and any single-character display.
 */
export function CharacterAvatar({ characterId, size = 96, style }: CharacterAvatarProps) {
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const source = SPRITES[characterId];

  if (!source) {
    return (
      <View style={[{ width: size, height: size }, styles.center, style as StyleProp<ViewStyle>]}>
        <Text style={{ fontSize: size * 0.6 }} accessibilityLabel={character.name}>
          {character.emoji}
        </Text>
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

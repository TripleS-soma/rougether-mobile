import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import type { MemberRoomPreview } from '@/components/room/room';
import type { CharacterId } from '@/constants/characters';
import { Radius } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { dioramaMemberBoxes, selectDioramaFurniture } from '@/resources/house-diorama';
import type { FurnitureItem } from '@/resources/furniture';

type Props = {
  side: 0 | 1;
  preview?: MemberRoomPreview;
  furniture?: FurnitureItem[];
  characterId: CharacterId;
  sharp?: boolean;
};

export const HouseDioramaMember = memo(function HouseDioramaMember({
  side,
  preview,
  furniture,
  characterId,
  sharp = false,
}: Props) {
  const t = useTokens();
  const selected = useMemo(
    () => selectDioramaFurniture(preview?.placements, furniture),
    [preview?.placements, furniture],
  );
  const boxes = useMemo(() => dioramaMemberBoxes(side), [side]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="diorama-member">
      {boxes.map((box) => {
        const entry = box.kind === 'hero' ? selected[0] : selected[1];
        if (box.kind !== 'character' && !entry) return null;
        return (
          <View
            key={box.kind}
            testID={`diorama-${box.kind}`}
            style={[
              styles.object,
              {
                left: `${(box.x / 369) * 100}%`,
                top: `${(box.y / 300) * 100}%`,
                width: `${(box.width / 369) * 100}%`,
                height: `${(box.height / 300) * 100}%`,
              },
            ]}>
            <View style={[styles.shadow, { backgroundColor: t.text }]} />
            {box.kind === 'character' ? (
              <CharacterAvatar
                characterId={characterId}
                style={styles.art}
                sharp={sharp}
                contentPosition="bottom"
              />
            ) : (
              <Image
                source={assetSource(entry!.item.assetKey)}
                style={[styles.art, entry!.flipped && styles.flipped]}
                contentFit="contain"
                contentPosition="bottom"
                cachePolicy="memory-disk"
                allowDownscaling={!sharp}
                accessible={false}
                accessibilityLabel=""
              />
            )}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  object: { position: 'absolute' },
  art: { width: '100%', height: '100%' },
  flipped: { transform: [{ scaleX: -1 }] },
  shadow: {
    position: 'absolute',
    left: '20%',
    bottom: 0,
    width: '60%',
    height: '4%',
    opacity: 0.12,
    borderRadius: Radius.sm,
  },
});

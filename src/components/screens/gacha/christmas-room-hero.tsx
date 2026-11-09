import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle } from 'react-native';

import { useT } from '@/i18n';
import assets from '@/resources/christmas-gacha-assets.json';
import { CHRISTMAS_GACHA_ART } from '@/resources/christmas-gacha';

const POSITIONS = [
  { slug: 'winter-rug', x: 54, foot: 98, width: 53 },
  { slug: 'snowy-window', x: 20, foot: 48, width: 28 },
  { slug: 'christmas-wreath', x: 53, foot: 38, width: 15 },
  { slug: 'stocking-fireplace', x: 53, foot: 78, width: 32 },
  { slug: 'christmas-tree', x: 83, foot: 80, width: 31 },
  { slug: 'plaid-sofa', x: 22, foot: 91, width: 43 },
  { slug: 'gift-stack', x: 85, foot: 97, width: 20 },
  { slug: 'cocoa-table', x: 54, foot: 94, width: 33 },
] as const;

export function ChristmasRoomHero() {
  const tr = useT();
  return (
    <View
      style={styles.room}
      accessible
      accessibilityLabel={tr('roomShop.gacha.christmas.heroA11y')}>
      <Image
        source={CHRISTMAS_GACHA_ART['snowflake-wallpaper']}
        contentFit="cover"
        contentPosition="bottom"
        style={styles.wallpaper}
      />
      <Image
        source={CHRISTMAS_GACHA_ART['honey-winter-floor']}
        contentFit="cover"
        contentPosition="top"
        style={styles.floor}
      />
      {POSITIONS.map((position) => {
        const asset = assets.find((candidate) => candidate.slug === position.slug)!;
        // Hero is 4:3. Anchor each opaque foot, rather than its padded canvas,
        // inside the floor (starts at 63%) so the fireplace and tree never float.
        const height = position.width * (4 / 3) * (asset.height / asset.width);
        const style: ImageStyle = {
          position: 'absolute',
          left: `${position.x - position.width / 2}%`,
          top: `${position.foot - asset.bottom * height}%`,
          width: `${position.width}%`,
          height: `${height}%`,
        };
        return (
          <Image
            key={asset.slug}
            source={CHRISTMAS_GACHA_ART[position.slug]}
            contentFit="contain"
            style={style}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { width: '100%', height: '100%', overflow: 'hidden' },
  wallpaper: { position: 'absolute', left: 0, top: 0, width: '100%', height: '63%' },
  floor: { position: 'absolute', left: 0, top: '63%', width: '100%', height: '37%' },
});

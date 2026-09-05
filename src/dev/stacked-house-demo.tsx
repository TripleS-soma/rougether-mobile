import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import type { MemberRoomPreview } from '@/components/room/room';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { STACKED_HOUSE_THEMES } from '@/resources/house-frame';
import { FURNITURE_ITEMS, WALLPAPERS, VACANT_FLOOR, type Wallpaper } from '@/resources/furniture';
import { DEFAULT_CHARACTER_ID } from '@/constants/characters';

const DEMO_WALLS: Wallpaper[] = [
  {
    ...WALLPAPERS[0],
    id: 'demo-wall',
    assetKey: 'items/forest-sage/wallpaper/forest-sage-wallpaper-basic-1205x964.webp',
  },
];
const DEMO_FLOORS: Wallpaper[] = [
  {
    ...VACANT_FLOOR[0],
    id: 'demo-floor',
    assetKey: 'items/forest-sage/floor/forest-sage-floor-1205x482.webp',
  },
];
const DEMO_FURNITURE = [
  { ...FURNITURE_ITEMS[0], assetKey: 'items/forest-sage/furniture/forest-sage-bed.png' },
];
const DEMO_ROOMS: MemberRoomPreview[] = Array.from({ length: 6 }, () => ({
  wallpaperId: 'demo-wall',
  floorId: 'demo-floor',
  characterId: DEFAULT_CHARACTER_ID,
  placements: [{ furnitureId: FURNITURE_ITEMS[0].id, x: 0.28, y: 0.8, z: 1 }],
}));
const DEMO_PREVIEWS = Object.fromEntries(DEMO_ROOMS.map((room, index) => [index + 1, room]));

/** Fixture-only harness: no API calls, catalog mutation, or seat persistence. */
export function StackedHouseDemo() {
  const t = useTokens();
  const Typography = useTypography();
  const [themeIndex, setThemeIndex] = useState(0);
  const [capacity, setCapacity] = useState(6);
  const [enabled, setEnabled] = useState(true);
  const [detail, setDetail] = useState(false);
  const [visited, setVisited] = useState('');
  const theme = STACKED_HOUSE_THEMES[themeIndex];
  const rooms = useMemo(() => DEMO_ROOMS.slice(0, capacity), [capacity]);
  const houses = useMemo<House[]>(
    () => [
      {
        name: theme.name,
        maxMembers: capacity,
        memberCount: capacity,
        coverImageKey: theme.legacyKey ?? undefined,
        missions: [],
        floors: Array.from({ length: Math.ceil(capacity / 2) }, (_, row) => ({
          level: `${row + 1}층`,
          rooms: Array.from({ length: Math.min(2, capacity - row * 2) }, (_, col) => ({
            name: `멤버 ${row * 2 + col + 1}`,
            color: t.surfaceMuted,
            membershipId: row * 2 + col + 1,
          })),
        })).reverse(),
      },
    ],
    [theme, capacity, t.surfaceMuted],
  );
  return (
    <View style={styles.root}>
      <Text style={[Typography.supporting, { color: t.text }]}>
        {themeIndex + 1}/10 · {theme.name} · {capacity}인 · {enabled ? '세로형 ON' : '기존형 OFF'}
      </Text>
      <View style={styles.controls}>
        <Button
          label="다음 테마"
          onPress={() => setThemeIndex((i) => (i + 1) % STACKED_HOUSE_THEMES.length)}
        />
        {[2, 3, 4, 6].map((n) => (
          <Button
            key={n}
            label={`${n}인`}
            variant={capacity === n ? 'primary' : 'secondary'}
            onPress={() => setCapacity(n)}
          />
        ))}
        <Button label="기존/세로 전환" onPress={() => setEnabled((value) => !value)} />
        <Button label="미리보기/실제 화면" onPress={() => setDetail((value) => !value)} />
      </View>
      {visited ? (
        <Text style={[Typography.supporting, { color: t.text }]}>{visited} 방문 클릭 확인</Text>
      ) : null}
      {detail ? (
        <View style={styles.screen}>
          <HouseScreen
            houses={houses}
            roomPreviews={DEMO_PREVIEWS}
            wallpapers={DEMO_WALLS}
            floors={DEMO_FLOORS}
            furniture={DEMO_FURNITURE}
            enabled={enabled}
            previewTheme={theme.id}
            onVisitFriend={(friend) => setVisited(friend.name)}
          />
        </View>
      ) : (
        <HousePreviewFrame
          coverImageKey={theme.legacyKey ?? undefined}
          name={theme.name}
          maxMembers={capacity}
          rooms={rooms}
          wallpapers={DEMO_WALLS}
          floors={DEMO_FLOORS}
          furniture={DEMO_FURNITURE}
          enabled={enabled}
          previewTheme={theme.id}
        />
      )}
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        검증용 방 데이터입니다. 공개 카탈로그·저장 키·가구 좌표는 변경하지 않습니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: Spacing.two },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  screen: { height: 760, width: '100%' },
});

import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HousePreviewFrame } from '@/components/room/house-preview-frame';
import type { MemberRoomPreview } from '@/components/room/room';
import { ROOM_RENDER_CONTRACT } from '@/components/room/room-render-contract';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { STACKED_HOUSE_THEMES } from '@/resources/house-frame';
import { HOUSE_SCENE_MANIFEST } from '@/resources/house-scene';

const THEMES = STACKED_HOUSE_THEMES.filter((theme) => theme.group === 1);
const CAPACITIES = [2, 4, 6] as const;
const reference = ROOM_RENDER_CONTRACT.referenceFixture;
const DEMO_ROOMS: MemberRoomPreview[] = Array.from({ length: 6 }, (_, index) => ({
  characterId: reference.character.id,
  wallpaperId: reference.surfaces.wallpaper.id,
  floorId: reference.surfaces.floor.id,
  placements: [
    { furnitureId: reference.furniture.id, x: 0.22 + (index % 2) * 0.55, y: 0.25, z: 1, scale: 1 },
    { furnitureId: 'scene-demo-bed', x: 0.22, y: 0.74, z: 2, scale: 1.1 },
  ],
}));
const WALLS = [{ ...reference.surfaces.wallpaper, color: 'transparent', price: 0 }];
const FLOORS = [{ ...reference.surfaces.floor, color: 'transparent', price: 0 }];
const FURNITURE = [
  { ...reference.furniture, category: '장식' as const, price: 0 },
  {
    id: 'scene-demo-bed',
    name: '초록 숲 침대',
    slot: 'bottomLeft' as const,
    category: '장식' as const,
    price: 0,
    assetKey: 'items/forest-sage/furniture/forest-sage-bed.png',
    defaultScale: 1.1,
  },
];
const PREVIEWS = Object.fromEntries(DEMO_ROOMS.map((room, index) => [index + 1, room]));

/** Actual RN renderer and local fixtures only: no user APIs or persistence. */
export function IntegratedHouseScenesDemo({
  viewportOnly = false,
  initialThemeIndex = 0,
  initialCapacity = 2,
}: { viewportOnly?: boolean; initialThemeIndex?: number; initialCapacity?: 2 | 4 | 6 } = {}) {
  const t = useTokens();
  const Typography = useTypography();
  const [themeIndex, setThemeIndex] = useState(initialThemeIndex);
  const [capacity, setCapacity] = useState<2 | 4 | 6>(initialCapacity);
  const [vacant, setVacant] = useState(false);
  const [integrated, setIntegrated] = useState(true);
  const [screen, setScreen] = useState(false);
  const [visited, setVisited] = useState('');
  const theme = THEMES[themeIndex];
  const count = capacity - (vacant ? 1 : 0);
  const houses = useMemo<House[]>(
    () => [
      {
        houseId: 9001,
        name: theme.name,
        maxMembers: capacity,
        memberCount: count,
        coverImageKey: theme.legacyKey ?? undefined,
        missions: [],
        floors: Array.from({ length: capacity / 2 }, (_, row) => ({
          level: `${row + 1}층`,
          rooms: Array.from({ length: 2 }, (_, col) => {
            const member = row * 2 + col + 1;
            return {
              name: member > count ? '빈방' : `멤버 ${member}`,
              color: t.surfaceMuted,
              membershipId: member,
              vacant: member > count,
            };
          }),
        })).reverse(),
      },
    ],
    [theme, capacity, count, t.surfaceMuted],
  );
  const houseScreen = (
    <HouseScreen
      houses={houses}
      roomPreviews={PREVIEWS}
      wallpapers={WALLS}
      floors={FLOORS}
      furniture={FURNITURE}
      integratedEnabled={integrated}
      onVisitFriend={(friend) => setVisited(`${friend.membershipId}번 ${friend.name} 방문`)}
    />
  );
  if (viewportOnly) return houseScreen;
  const registered = HOUSE_SCENE_MANIFEST.scenes.some(
    (entry) => entry.themeId === theme.id && entry.capacity === capacity,
  );
  return (
    <View style={styles.root} testID="integrated-house-gallery">
      <Text style={[Typography.h3, { color: t.text }]}>
        {theme.name} · {capacity}인
      </Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {HOUSE_SCENE_MANIFEST.scenes.length}/12 장면 ·{' '}
        {registered ? '통합 이미지 등록됨' : '이미지 준비 중 · 기존형 표시'}
      </Text>
      <View style={styles.controls}>
        {THEMES.map((item, index) => (
          <Button
            key={item.id}
            label={item.name}
            variant={themeIndex === index ? 'primary' : 'secondary'}
            onPress={() => setThemeIndex(index)}
          />
        ))}
        {CAPACITIES.map((value) => (
          <Button
            key={value}
            label={`${value}인`}
            variant={capacity === value ? 'primary' : 'secondary'}
            onPress={() => setCapacity(value)}
          />
        ))}
        <Button
          label={screen ? '탐색 미리보기 보기' : '실제 집 화면 보기'}
          onPress={() => setScreen((value) => !value)}
        />
        <Button
          label={vacant ? '빈자리 채우기' : '마지막 자리 비우기'}
          onPress={() => setVacant((value) => !value)}
        />
        <Button
          label={integrated ? '기존 프레임 보기' : '통합 장면 보기'}
          onPress={() => setIntegrated((value) => !value)}
        />
      </View>
      {screen ? (
        <View style={styles.screen}>{houseScreen}</View>
      ) : (
        <HousePreviewFrame
          name={theme.name}
          coverImageKey={theme.legacyKey ?? undefined}
          maxMembers={capacity}
          rooms={DEMO_ROOMS.slice(0, count)}
          wallpapers={WALLS}
          floors={FLOORS}
          furniture={FURNITURE}
          integratedEnabled={integrated}
        />
      )}
      <Text style={[Typography.supporting, { color: t.text }]} accessibilityLiveRegion="polite">
        {visited ||
          '아래층부터 가입 순서대로 배치합니다. 실제 화면에서 방을 눌러 방문 연결을 확인하세요.'}
      </Text>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        검증용 공개 에셋·가구 좌표 fixture입니다. 개인 데이터 조회·좌석 저장·배포는 하지 않습니다.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { width: '100%', gap: Spacing.two },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  screen: { width: '100%', aspectRatio: 390 / 844 },
});

/** URL-selectable, full-device fixture for responsive viewport QA. */
export function IntegratedHouseScenesViewport() {
  const { theme, capacity } = useLocalSearchParams<{ theme?: string; capacity?: string }>();
  const themeIndex = Math.max(
    0,
    THEMES.findIndex((entry) => entry.id === theme),
  );
  const seats = capacity === '6' ? 6 : capacity === '4' ? 4 : 2;
  return (
    <IntegratedHouseScenesDemo
      key={`${themeIndex}-${seats}`}
      viewportOnly
      initialThemeIndex={themeIndex}
      initialCapacity={seats}
    />
  );
}

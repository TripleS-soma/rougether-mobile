import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { HouseScreen, type House } from '@/components/screens/house-screen';
import { Room, type MemberRoomPreview } from '@/components/room/room';
import { Button } from '@/components/ui/button';
import { HOUSE_DIORAMA_THEMES } from '@/resources/house-diorama';
import type { FurnitureItem } from '@/resources/furniture';
import fixture from '@/dev/fixtures/house-diorama.json';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { Spacing } from '@/constants/theme';

const furniture = fixture.furniture as FurnitureItem[];
const rooms = fixture.rooms as MemberRoomPreview[];
export function HouseDioramaDemo() {
  const t = useTokens();
  const Typography = useTypography();
  const [themeIndex, setThemeIndex] = useState(4);
  const [count, setCount] = useState(4);
  const [empty, setEmpty] = useState(false);
  const [visited, setVisited] = useState<number | null>(null);
  const theme = HOUSE_DIORAMA_THEMES[themeIndex];
  const previews = Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      i + 1,
      { ...rooms[i % 4], placements: empty ? [] : rooms[i % 4].placements },
    ]),
  );
  const house: House = {
    name: '함께 사는 우리 집',
    houseId: 1,
    myRole: 'OWNER',
    memberCount: count,
    maxMembers: count,
    coverImageKey: theme.coverImageKey,
    floors: Array.from({ length: Math.ceil(count / 2) }, (_, row) => ({
      level: String(row),
      rooms: Array.from({ length: Math.min(2, count - row * 2) }, (_, col) => {
        const i = row * 2 + col;
        return {
          name: ['나', '도담', '소이', '모아'][i % 4],
          color: t.surface,
          membershipId: i + 1,
          userId: i + 1,
          isMine: i === 0,
          isOwner: i === 0,
        };
      }),
    })).reverse(),
  };
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
      <View style={[styles.root, { backgroundColor: t.surface }]}>
        <View style={styles.controls}>
          <Button
            label="이전 테마"
            variant="secondary"
            onPress={() => setThemeIndex((themeIndex + 5) % 6)}
          />
          <Button label="다음 테마" onPress={() => setThemeIndex((themeIndex + 1) % 6)} />
          {[1, 4, 8, 10].map((n) => (
            <Button
              key={n}
              label={`${n}명`}
              variant={count === n ? 'primary' : 'secondary'}
              onPress={() => setCount(n)}
            />
          ))}
          <Button
            label={empty ? '가구 표시' : '가구 숨기기'}
            variant="secondary"
            onPress={() => setEmpty(!empty)}
          />
          <Text style={[Typography.supporting, { color: t.text }]}>
            {theme.id} · 실제 앱 컴포넌트 / 배치는 샘플
          </Text>
        </View>
        {visited != null ? (
          <View style={styles.visit}>
            <Button label="집으로 돌아가기" onPress={() => setVisited(null)} />
            <Text style={[Typography.h3, { color: t.text }]}>
              {['나', '도담', '소이', '모아'][visited % 4]}의 원래 방
            </Text>
            <Room {...previews[visited + 1]} furniture={furniture} style={styles.room} />
          </View>
        ) : (
          <View style={styles.screen}>
            <HouseScreen
              houses={[house]}
              furniture={furniture}
              roomPreviews={previews}
              userName="나"
              onVisitMyRoom={() => setVisited(0)}
              onVisitFriend={(friend) => setVisited((friend.membershipId ?? 1) - 1)}
            />
          </View>
        )}
      </View>
    </SafeAreaInsetsContext.Provider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, padding: Spacing.two },
  screen: { flex: 1, minHeight: 600 },
  visit: { padding: Spacing.three, gap: Spacing.three },
  room: { maxWidth: 440, alignSelf: 'center', width: '100%' },
});

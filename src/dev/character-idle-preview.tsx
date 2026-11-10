import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/room/character-avatar';
import { CharacterIdle } from '@/components/room/character-idle';
import { CHARACTER_OPTIONS } from '@/constants/characters';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 캐릭터 대기 동작 비교 (2026-11-09) — 같은 그림을 정지 / 숨쉬기로 나란히. 오른쪽 칸을 누르면
 * 포즈가 넘어가며 한 번 눌렸다 튄다(나의 방과 같은 반응).
 */
export function CharacterIdlePreview() {
  const t = useTokens();
  const Typography = useTypography();
  const [poses, setPoses] = useState<Record<string, number>>({});
  return (
    <View style={styles.list}>
      <View style={styles.row}>
        <Text style={[Typography.supporting, styles.cell, { color: t.textMuted }]}>정지</Text>
        <Text style={[Typography.supporting, styles.cell, { color: t.textMuted }]}>
          숨쉬기·탭 반응
        </Text>
      </View>
      {CHARACTER_OPTIONS.map((c) => {
        const pose = poses[c.id] ?? 0;
        return (
          <View key={c.id} style={styles.row}>
            <View style={styles.cell}>
              <CharacterAvatar characterId={c.id} pose={pose} size={88} />
            </View>
            <Pressable
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} 포즈 넘기기`}
              onPress={() => setPoses((p) => ({ ...p, [c.id]: pose + 1 }))}>
              <CharacterIdle pulseKey={pose}>
                <CharacterAvatar characterId={c.id} pose={pose} size={88} />
              </CharacterIdle>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three },
  cell: { flex: 1, alignItems: 'center' },
});

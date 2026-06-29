import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Room } from '@/components/room/room';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { type Routine } from '@/constants/routines';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { formatTime } from '@/utils/datetime';

/** Cheer reactions a visitor can leave on a friend's room. */
export type CheerType = 'great' | 'support' | 'best';

const CHEERS: { type: CheerType; emoji: string; label: string }[] = [
  { type: 'great', emoji: '👍', label: '잘하고 있어!' },
  { type: 'support', emoji: '💛', label: '응원하기' },
  { type: 'best', emoji: '✨', label: '오늘도 최고!' },
];

const DEFAULT_ROUTINES: Routine[] = [
  { id: 'friend-1', title: '아침 기상', completed: true, alarmEnabled: true, time: '07:00' },
  { id: 'friend-2', title: '독서 30분', completed: true, photoVerify: true },
  { id: 'friend-3', title: '운동 인증', completed: true, photoVerify: true },
  { id: 'friend-4', title: '영어 공부', completed: true, alarmEnabled: true, time: '20:00' },
  { id: 'friend-5', title: '하루 회고', completed: false, alarmEnabled: true, time: '23:00' },
];

export type FriendRoomScreenProps = {
  friendName?: string;
  streakDays?: number;
  characterId?: CharacterId;
  wallpaperId?: string;
  placedFurnitureIds?: string[];
  routines?: Routine[];
  onBack?: () => void;
  onCheer?: (type: CheerType) => void;
};

/**
 * Friend's room screen, ported from the prototype `FriendRoomScreen`: a
 * read-only view of a friend's <Room /> and today's routines, plus cheer
 * buttons. Pure + prop-driven. Spec domain: rougether-spec domains/room.
 */
export function FriendRoomScreen({
  friendName = '친구',
  streakDays = 7,
  characterId = DEFAULT_CHARACTER_ID,
  wallpaperId,
  placedFurnitureIds,
  routines = DEFAULT_ROUTINES,
  onBack,
  onCheer,
}: FriendRoomScreenProps) {
  const t = useTokens();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const completedCount = routines.filter((r) => r.completed).length;
  const progress = routines.length > 0 ? completedCount / routines.length : 0;

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.backGlyph, { color: t.text }]}>‹</Text>
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: character.bg }]}>
          <Text style={styles.avatarEmoji}>{character.emoji}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[Typography.h3, { color: t.text }]} numberOfLines={1}>
            {friendName}의 방
          </Text>
          <Text style={[Typography.supporting, { color: t.warning }]}>🔥 {streakDays}일</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.roomWrap}>
          <Room
            characterId={characterId}
            wallpaperId={wallpaperId}
            placedFurnitureIds={placedFurnitureIds}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[Typography.h2, { color: t.text }]}>{friendName}의 루틴</Text>
            <Text style={[Typography.label, { color: t.primary }]}>
              {completedCount} / {routines.length}
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: t.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>

          <View style={styles.rows}>
            {routines.map((routine) => (
              <View
                key={routine.id}
                style={[styles.row, { backgroundColor: t.surface, borderLeftColor: t.primary }]}>
                <Text
                  style={[styles.check, { color: routine.completed ? t.primary : t.textDisabled }]}>
                  {routine.completed ? '☑' : '☐'}
                </Text>
                {routine.emoji ? <Text style={styles.rowEmoji}>{routine.emoji}</Text> : null}
                <View style={styles.flex}>
                  <Text
                    style={[
                      Typography.body,
                      routine.completed
                        ? { color: t.textMuted, textDecorationLine: 'line-through' }
                        : { color: t.text },
                    ]}>
                    {routine.title}
                  </Text>
                  {(routine.alarmEnabled && routine.time) || routine.photoVerify ? (
                    <View style={styles.badges}>
                      {routine.alarmEnabled && routine.time ? (
                        <Text style={[styles.badge, { color: t.textMuted }]}>
                          🔔 {formatTime(routine.time)}
                        </Text>
                      ) : null}
                      {routine.photoVerify ? (
                        <Text style={[styles.badge, { color: t.textMuted }]}>📷 사진 인증</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.cheers}>
            {CHEERS.map((cheer, idx) => (
              <Pressable
                key={cheer.type}
                onPress={() => onCheer?.(cheer.type)}
                accessibilityRole="button"
                accessibilityLabel={cheer.label}
                style={[
                  styles.cheerBtn,
                  { backgroundColor: idx === 0 ? t.primary : t.surfaceMuted },
                ]}>
                <Text style={[Typography.label, { color: idx === 0 ? t.onPrimary : t.text }]}>
                  {cheer.emoji} {cheer.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 26,
    lineHeight: 28,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  roomWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  section: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
  },
  check: {
    fontSize: 22,
  },
  rowEmoji: {
    fontSize: 18,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  badge: {
    fontSize: 11,
  },
  cheers: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cheerBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});

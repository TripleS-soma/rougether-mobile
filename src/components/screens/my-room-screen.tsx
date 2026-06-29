import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Room } from '@/components/room/room';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { ROUTINE_CATEGORIES, type Routine, type RoutineCategoryMeta } from '@/constants/routines';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useTokens } from '@/hooks/use-tokens';
import { formatTime } from '@/utils/datetime';

export type MyRoomScreenProps = {
  /** Room occupant's display name (header title becomes "{userName}의 방"). */
  userName?: string;
  /** Consecutive-day streak shown in the header. */
  streakDays?: number;
  /** Reward leaves offered by the reward card. */
  rewardLeaves?: number;
  // Room rendering (forwarded to <Room />).
  characterId?: CharacterId;
  wallpaperId?: string;
  placedFurnitureIds?: string[];
  // Routine list.
  routines?: Routine[];
  categories?: RoutineCategoryMeta[];
  // Callbacks (wired separately).
  onEdit?: () => void;
  onAddRoutine?: () => void;
  onToggleRoutine?: (id: string) => void;
  onOpenGacha?: () => void;
  onClaimReward?: () => void;
};

/**
 * "My room" (zoomed) screen, ported from the prototype `MyRoomZoomScreen`:
 * header (character + streak), the shared <Room /> view with a gacha shortcut,
 * today's routines grouped by category with a progress bar, and a reward card.
 * Pure + prop-driven; the web-only "save room photo" (SVG/canvas) is dropped and
 * inline routine editing (kebab menu / quick-add) is deferred. Spec domain:
 * rougether-spec domains/room.
 */
export function MyRoomScreen({
  userName = '준서',
  streakDays = 7,
  rewardLeaves = 120,
  characterId = DEFAULT_CHARACTER_ID,
  wallpaperId = DEFAULT_WALLPAPER_ID,
  placedFurnitureIds,
  routines = [],
  categories = ROUTINE_CATEGORIES,
  onEdit,
  onAddRoutine,
  onToggleRoutine,
  onOpenGacha,
  onClaimReward,
}: MyRoomScreenProps) {
  const t = useTokens();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const knownIds = categories.map((c) => c.id);
  const completedCount = routines.filter((r) => r.completed).length;
  const progress = routines.length > 0 ? completedCount / routines.length : 0;

  return (
    <View style={[styles.screen, { backgroundColor: t.screen }]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: character.bg }]}>
            <Text style={styles.avatarEmoji}>{character.emoji}</Text>
          </View>
          <View>
            <Text style={[Typography.h3, { color: t.text }]}>{userName}의 방</Text>
            <Text style={[Typography.supporting, { color: t.warning }]}>🔥 {streakDays}일</Text>
          </View>
        </View>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="방 편집"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.iconGlyph, { color: t.text }]}>✎</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.roomWrap}>
          <Room
            characterId={characterId}
            wallpaperId={wallpaperId}
            placedFurnitureIds={placedFurnitureIds}
          />
          <Pressable
            onPress={onOpenGacha}
            accessibilityRole="button"
            accessibilityLabel="뽑기 상점"
            style={[styles.gachaBtn, { backgroundColor: t.surface }]}>
            <Text style={styles.gachaGlyph}>🎁</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[Typography.h2, { color: t.text }]}>오늘의 루틴</Text>
            <View style={styles.sectionHeadRight}>
              <Text style={[Typography.label, { color: t.primary }]}>
                {completedCount} / {routines.length}
              </Text>
              <Pressable
                onPress={onAddRoutine}
                accessibilityRole="button"
                accessibilityLabel="루틴 추가"
                style={[styles.addBtn, { backgroundColor: t.primary }]}>
                <Text style={[styles.addGlyph, { color: t.onPrimary }]}>＋</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: t.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>

          {categories.map((cat, idx) => {
            const isFallback = idx === categories.length - 1;
            const items = routines.filter((r) => {
              if (r.category === cat.id) return true;
              return isFallback && (!r.category || !knownIds.includes(r.category));
            });
            if (items.length === 0) return null;
            const doneInCat = items.filter((r) => r.completed).length;

            return (
              <View key={cat.id} style={styles.group}>
                <View style={styles.catHeader}>
                  <View style={[styles.catDot, { backgroundColor: `${cat.color}33` }]}>
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  </View>
                  <Text style={[Typography.label, { color: cat.color }]}>{cat.label}</Text>
                  <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                    {doneInCat}/{items.length}
                  </Text>
                </View>

                <View style={styles.rows}>
                  {items.map((routine) => (
                    <Pressable
                      key={routine.id}
                      onPress={() => onToggleRoutine?.(routine.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: routine.completed }}
                      accessibilityLabel={routine.title}
                      style={[
                        styles.row,
                        { backgroundColor: t.surface, borderLeftColor: cat.color },
                      ]}>
                      <Text
                        style={[
                          styles.check,
                          { color: routine.completed ? t.primary : t.textDisabled },
                        ]}>
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
                              <Text style={[styles.badge, { color: t.textMuted }]}>
                                📷 사진 인증
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={[styles.rewardCard, { backgroundColor: t.primary }]}>
            <View style={styles.rewardTop}>
              <View style={styles.flex}>
                <Text style={[Typography.h3, { color: t.onPrimary }]}>오늘의 보상</Text>
                <Text style={[Typography.supporting, styles.rewardSub, { color: t.onPrimary }]}>
                  루틴을 완료하고 보상을 받아보세요!
                </Text>
              </View>
              <Text style={styles.rewardStar}>⭐</Text>
            </View>
            <Text style={[Typography.h2, { color: t.onPrimary }]}>🍃 +{rewardLeaves} 잎사귀</Text>
            <Pressable
              onPress={onClaimReward}
              accessibilityRole="button"
              accessibilityLabel="보상 받기"
              style={[styles.claimBtn, { backgroundColor: t.surface }]}>
              <Text style={[Typography.label, { color: t.primary }]}>보상 받기</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="방 편집하기"
            style={[styles.editBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[Typography.label, { color: t.text }]}>✎ 방 편집</Text>
          </Pressable>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  roomWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  gachaBtn: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gachaGlyph: {
    fontSize: 20,
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
  sectionHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGlyph: {
    fontSize: 18,
    lineHeight: 20,
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
  group: {
    gap: Spacing.two,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  catDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: {
    fontSize: 14,
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
  rewardCard: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rewardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rewardSub: {
    marginTop: Spacing.half,
  },
  rewardStar: {
    fontSize: 28,
  },
  claimBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  editBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
  },
});

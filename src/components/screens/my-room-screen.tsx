import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Room } from '@/components/room/room';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { ROUTINE_CATEGORIES, type Routine, type RoutineCategoryMeta } from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { captureVerificationPhoto } from '@/lib/photo-verify';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useScreenStyle } from '@/hooks/use-screen-style';
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
  /** Quick-add a title-only todo to a category (the + on a category header). */
  onQuickAddRoutine?: (category: string, title: string) => void;
  /** Open the full edit screen for a routine (kebab → 수정). */
  onEditRoutine?: (routine: Routine) => void;
  /** Delete a routine (kebab → 삭제). */
  onDeleteRoutine?: (id: string) => void;
  /**
   * Capture a verification photo when completing a 인증사진형 routine; resolves to
   * the photo URI, or null to cancel the completion. Defaults to the device
   * camera (expo-image-picker); inject a stub in tests.
   */
  onRequestPhoto?: () => Promise<string | null>;
};

/**
 * "My room" (zoomed) screen, ported from the prototype `MyRoomZoomScreen`:
 * header (character + streak), the shared <Room /> view with a gacha shortcut,
 * today's routines grouped by category with a progress bar, and a reward card.
 * Each category header has a + to quick-add a todo, and each routine has a kebab
 * menu (수정 / 삭제). Pure + prop-driven; the web-only "save room photo"
 * (SVG/canvas) is dropped. Spec domain: rougether-spec domains/room.
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
  onQuickAddRoutine,
  onEditRoutine,
  onDeleteRoutine,
  onRequestPhoto = captureVerificationPhoto,
}: MyRoomScreenProps) {
  const t = useTokens();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const knownIds = categories.map((c) => c.id);
  const completedCount = routines.filter((r) => r.completed).length;
  const progress = routines.length > 0 ? completedCount / routines.length : 0;

  // Which category's quick-add input is open, the in-progress todo text, and
  // which routine's kebab menu is open.
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const commitTodo = (categoryId: string) => {
    const title = newTodo.trim();
    if (title) onQuickAddRoutine?.(categoryId, title);
    setNewTodo('');
    setAddingCategory(null);
  };

  // Completing a 인증사진형 routine first requires a camera photo; if none is
  // captured (cancelled / denied), the completion is aborted. Kept sync on the
  // common (non-photo) path; only the photo path awaits the camera.
  const handleToggle = (routine: Routine) => {
    if (routine.photoVerify && !routine.completed) {
      void onRequestPhoto().then((uri) => {
        if (uri) onToggleRoutine?.(routine.id);
      });
      return;
    }
    onToggleRoutine?.(routine.id);
  };

  return (
    <View style={[styles.screen, useScreenStyle()]}>
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
          <Icon name="edit" size={18} color={t.text} />
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
            <Icon name="gift" size={20} color={t.text} />
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
                  <View style={styles.flex} />
                  <Pressable
                    onPress={() => {
                      setNewTodo('');
                      setAddingCategory((prev) => (prev === cat.id ? null : cat.id));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${cat.label} 할 일 추가`}
                    style={[styles.catAdd, { backgroundColor: cat.color }]}>
                    <Text style={styles.catAddGlyph}>＋</Text>
                  </Pressable>
                </View>

                <View style={styles.rows}>
                  {items.map((routine) => {
                    const menuOpen = menuOpenId === routine.id;
                    return (
                      <View key={routine.id}>
                        <View
                          style={[
                            styles.routineRow,
                            { backgroundColor: t.surface, borderLeftColor: cat.color },
                          ]}>
                          <Pressable
                            onPress={() => handleToggle(routine)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: routine.completed }}
                            accessibilityLabel={routine.title}
                            style={styles.rowMain}>
                            <Text
                              style={[
                                styles.check,
                                { color: routine.completed ? t.primary : t.textDisabled },
                              ]}>
                              {routine.completed ? '☑' : '☐'}
                            </Text>
                            {routine.emoji ? (
                              <Text style={styles.rowEmoji}>{routine.emoji}</Text>
                            ) : null}
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
                          <Pressable
                            onPress={() => setMenuOpenId(menuOpen ? null : routine.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${routine.title} 메뉴`}
                            style={styles.kebab}>
                            <Text style={[styles.kebabGlyph, { color: t.textDisabled }]}>⋮</Text>
                          </Pressable>
                        </View>

                        {menuOpen ? (
                          <View
                            style={[
                              styles.menu,
                              { backgroundColor: t.surface, borderColor: t.border },
                            ]}>
                            <Pressable
                              onPress={() => {
                                setMenuOpenId(null);
                                onEditRoutine?.(routine);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`${routine.title} 수정`}
                              style={styles.menuItem}>
                              <Text style={[Typography.body, { color: t.text }]}>✎ 수정하기</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setMenuOpenId(null);
                                onDeleteRoutine?.(routine.id);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`${routine.title} 삭제`}
                              style={[
                                styles.menuItem,
                                { borderTopWidth: 1, borderTopColor: t.border },
                              ]}>
                              <Text style={[Typography.body, { color: t.danger }]}>🗑 삭제하기</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {addingCategory === cat.id ? (
                    <View
                      style={[
                        styles.routineRow,
                        { backgroundColor: t.surface, borderLeftColor: cat.color },
                      ]}>
                      <Text style={[styles.check, { color: t.textDisabled }]}>☐</Text>
                      <TextInput
                        autoFocus
                        value={newTodo}
                        onChangeText={setNewTodo}
                        onSubmitEditing={() => commitTodo(cat.id)}
                        onBlur={() => {
                          if (!newTodo.trim()) setAddingCategory(null);
                        }}
                        placeholder="할 일 입력 후 완료"
                        placeholderTextColor={t.textMuted}
                        style={[styles.flex, styles.todoInput, { color: t.text }]}
                      />
                    </View>
                  ) : null}
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
  catAdd: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catAddGlyph: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  rows: {
    gap: Spacing.two,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    paddingLeft: Spacing.three,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  kebab: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  kebabGlyph: {
    fontSize: 20,
  },
  menu: {
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  todoInput: {
    fontSize: 16,
    paddingVertical: Spacing.three,
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

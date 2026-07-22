import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CharacterAvatar, type CharacterAnimationSet } from '@/components/character-avatar';
import { Room } from '@/components/room/room';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { type Routine } from '@/constants/routines';
import { BearCheck } from '@/components/ui/bear-check';
import { Icon } from '@/components/ui/icon';
import { PendingNotice } from '@/components/ui/pending-notice';
import { BookOpenPictogram, Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { Radius, Spacing } from '@/constants/theme';
import { type FurnitureItem, type PlacedFurniture, type Wallpaper } from '@/resources/furniture';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { formatTime } from '@/utils/datetime';

/** Cheer reactions a visitor can leave on a friend's room. */
export type CheerType = 'great' | 'support' | 'best';

const CHEERS: { type: CheerType; icon: PictogramName; label: string }[] = [
  { type: 'great', icon: 'thumb-up', label: '잘하고 있어!' },
  { type: 'support', icon: 'heart', label: '응원하기' },
  { type: 'best', icon: 'sparkle', label: '오늘도 최고!' },
];

const DEFAULT_ROUTINES: Routine[] = [
  { id: 'friend-1', title: '아침 기상', completed: true, alarmEnabled: true, time: '07:00' },
  { id: 'friend-2', title: '독서 30분', completed: true, photoVerify: true },
  { id: 'friend-3', title: '운동 인증', completed: true, photoVerify: true },
  { id: 'friend-4', title: '영어 공부', completed: true, alarmEnabled: true, time: '20:00' },
  { id: 'friend-5', title: '하루 회고', completed: false, alarmEnabled: true, time: '23:00' },
];

/** One day of a friend's completion history (server GET …/routine-completions). */
export type FriendActivityDay = {
  /** "YYYY-MM-DD" — list key. */
  date: string;
  /** Display date, e.g. "7월 8일". */
  label: string;
  /** Completed routine titles on that day (server order). */
  titles: string[];
};

/** One guestbook note on this room (server GET /rooms/{id}/guestbooks). */
export type GuestbookEntry = {
  id: string;
  author: string;
  content: string;
  /** Display date, e.g. "7월 7일". */
  date: string;
};

const DEFAULT_GUESTBOOK: GuestbookEntry[] = [
  { id: 'g1', author: '임채영', content: '방 예쁘다! 오늘도 루틴 화이팅', date: '7월 6일' },
  { id: 'g2', author: '장진형', content: '기상 인증 대단해요', date: '7월 5일' },
];

/** 1~500 chars (server GuestbookCreateRequest). */
const GUESTBOOK_MAX = 500;

export type FriendRoomScreenProps = {
  friendName?: string;
  streakDays?: number;
  characterId?: CharacterId;
  /** Friend's CDN animation keys (forwarded to <Room />). */
  characterAnimations?: CharacterAnimationSet;
  wallpaperId?: string;
  floorId?: string | null;
  backgroundId?: string | null;
  placedFurnitureIds?: string[];
  /** 자유 배치(FREE_V1, #327) — 주어지면 슬롯 대신 정규화 좌표로 렌더. */
  placements?: PlacedFurniture[] | null;
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
  /** Friend's routines+todos for today; omit for the demo preview list. */
  routines?: Routine[];
  /**
   * Recent completion history (last 14 days, HOUSE/PUBLIC categories), date
   * desc. Omit to hide the 최근 활동 section (unwired/demo); [] shows an
   * empty-state line.
   */
  recentActivity?: FriendActivityDay[];
  /** True while the friend's room/routines are loading from the server. */
  loading?: boolean;
  /** Guestbook notes (newest first); defaults to a demo list when unwired. */
  guestbook?: GuestbookEntry[];
  guestbookLoading?: boolean;
  /** More pages exist server-side (shows 더보기). */
  guestbookHasNext?: boolean;
  onBack?: () => void;
  onCheer?: (type: CheerType) => void;
  /** Post a guestbook note via the API. */
  onWriteGuestbook?: (content: string) => void;
  onLoadMoreGuestbook?: () => void;
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
  characterAnimations,
  wallpaperId,
  floorId,
  backgroundId,
  placedFurnitureIds,
  placements = null,
  furniture,
  wallpapers,
  floors,
  backgrounds,
  routines,
  recentActivity,
  loading = false,
  guestbook,
  guestbookLoading = false,
  guestbookHasNext = false,
  onBack,
  onCheer,
  onWriteGuestbook,
  onLoadMoreGuestbook,
}: FriendRoomScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const headerInset = useHeaderInsetStyle();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  // No routines prop = unwired demo preview (dev gallery); the notice says so.
  const preview = routines === undefined;
  const routineList = routines ?? DEFAULT_ROUTINES;
  const completedCount = routineList.filter((r) => r.completed).length;
  const progress = routineList.length > 0 ? completedCount / routineList.length : 0;

  // Guestbook: server list when wired; a local demo list otherwise.
  const [localNotes, setLocalNotes] = useState<GuestbookEntry[]>(DEFAULT_GUESTBOOK);
  const [draft, setDraft] = useState('');
  const notes = guestbook ?? localNotes;
  const { show: toast } = useToast();
  const canSend = draft.trim().length > 0;
  const sendNote = () => {
    const content = draft.trim();
    // Blocked tap explains itself instead of a dead gray button.
    if (!content) return toast('방명록 내용을 입력해주세요', 'error');
    if (onWriteGuestbook) onWriteGuestbook(content);
    else setLocalNotes((prev) => [{ id: `local-${prev.length}`, author: '나', content, date: '오늘' }, ...prev]); // prettier-ignore
    setDraft('');
  };

  // Keyboard handling for the guestbook input (bottom of the scroll): Android
  // (edge-to-edge) overlays the keyboard without resizing the window, so add
  // its height as bottom padding while the input is focused and keep the input
  // in view — the same fix as the 투두 quick-add (#113).
  const scrollRef = useRef<ScrollView>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardPad(e.endCoordinates?.height ?? 320),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // Re-align once the keyboard is up AND the extra padding has been committed.
  useEffect(() => {
    if (!inputFocused || keyboardPad === 0) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [inputFocused, keyboardPad]);

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: character.bg }]}>
          <CharacterAvatar characterId={characterId} size={36} />
        </View>
        <View style={styles.flex}>
          {/* Narrow phones: shrink the font (≥75%) first; if the title still
              overflows, middle-ellipsize so the 의 방 suffix stays visible. */}
          <Text
            style={[Typography.h3, { color: t.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {friendName}의 방
          </Text>
          {/* Same rule as 나의 방: a 0-day streak hides the flame badge. */}
          {streakDays > 0 ? (
            <View style={styles.streak}>
              <Icon name="flame" size={14} color={t.warningText} />
              <Text style={[Typography.supporting, { color: t.warningText }]}>{streakDays}일</Text>
            </View>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.body,
            inputFocused && keyboardPad > 0 ? { paddingBottom: keyboardPad + 120 } : null,
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.roomWrap}>
            <Room
              characterId={characterId}
              characterAnimations={characterAnimations}
              wallpaperId={wallpaperId}
              floorId={floorId}
              backgroundId={backgroundId}
              placedFurnitureIds={placedFurnitureIds}
              placements={placements}
              furniture={furniture}
              wallpapers={wallpapers}
              floors={floors}
              backgrounds={backgrounds}
            />
          </View>

          {preview ? (
            <PendingNotice
              style={styles.pendingNotice}
              text="친구 방 꾸미기·루틴 데이터는 서버 준비 중이라 미리보기로 보여드려요."
            />
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[Typography.h2, { color: t.text }]}>{friendName}의 루틴</Text>
              {loading ? null : (
                <Text style={[Typography.label, { color: t.primaryText }]}>
                  {completedCount} / {routineList.length}
                </Text>
              )}
            </View>

            <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: t.primary, width: `${progress * 100}%` },
                ]}
              />
            </View>

            {loading ? (
              <View style={styles.listState}>
                <ActivityIndicator color={t.primary} />
              </View>
            ) : routineList.length === 0 ? (
              <Text style={[Typography.supporting, styles.listState, { color: t.textMuted }]}>
                오늘 예정된 루틴이 없어요.
              </Text>
            ) : null}

            <View style={styles.rows}>
              {routineList.map((routine) => (
                <View key={routine.id} style={styles.row}>
                  <BearCheck checked={!!routine.completed} size={22} />
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
                          <View style={styles.badge}>
                            <Icon name="bell" size={11} color={t.textMuted} />
                            <Text style={[styles.badgeText, { color: t.textMuted }]}>
                              {formatTime(routine.time)}
                            </Text>
                          </View>
                        ) : null}
                        {routine.photoVerify ? (
                          <View style={styles.badge}>
                            <Icon name="camera" size={11} color={t.textMuted} />
                            <Text style={[styles.badgeText, { color: t.textMuted }]}>
                              사진 인증
                            </Text>
                          </View>
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
                  {/* On the filled first button the mark follows the text ink. */}
                  <Pictogram
                    name={cheer.icon}
                    size={16}
                    color={idx === 0 ? t.onPrimary : undefined}
                  />
                  <Text style={[Typography.label, { color: idx === 0 ? t.onPrimary : t.text }]}>
                    {cheer.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {recentActivity ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[Typography.h2, { color: t.text }]}>최근 활동</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  최근 14일 · 공개 루틴 기준
                </Text>
              </View>
              {recentActivity.length === 0 ? (
                <Text style={[Typography.supporting, styles.listState, { color: t.textMuted }]}>
                  최근 2주간 완료한 공개 루틴이 없어요.
                </Text>
              ) : (
                <View style={styles.activityList}>
                  {recentActivity.map((day) => (
                    <View
                      key={day.date}
                      style={[styles.activityRow, { backgroundColor: t.surfaceMuted }]}>
                      <View style={styles.activityRowHead}>
                        <Text style={[Typography.label, { color: t.text }]}>{day.label}</Text>
                        <Text style={[Typography.supporting, { color: t.primaryText }]}>
                          {day.titles.length}개 완료
                        </Text>
                      </View>
                      <Text
                        style={[Typography.supporting, { color: t.textMuted }]}
                        numberOfLines={2}>
                        {day.titles.join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.gbTitleRow}>
                <BookOpenPictogram size={18} />
                <Text style={[Typography.h2, { color: t.text }]}>방명록</Text>
              </View>
            </View>

            <View style={styles.gbInputRow}>
              <TextInput
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, GUESTBOOK_MAX))}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="따뜻한 한마디를 남겨보세요"
                placeholderTextColor={t.textMuted}
                accessibilityLabel="방명록 입력"
                style={[styles.gbInput, { backgroundColor: t.surfaceMuted, color: t.text }]}
              />
              <Pressable
                onPress={sendNote}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                accessibilityLabel="방명록 남기기"
                style={[styles.gbSendBtn, { backgroundColor: canSend ? t.primary : t.disabledBg }]}>
                <Text style={[Typography.label, { color: canSend ? t.onPrimary : t.textMuted }]}>
                  남기기
                </Text>
              </Pressable>
            </View>

            {guestbookLoading && notes.length === 0 ? (
              <View style={styles.gbState}>
                <ActivityIndicator color={t.primary} />
              </View>
            ) : notes.length === 0 ? (
              <Text style={[Typography.supporting, styles.gbState, { color: t.textMuted }]}>
                아직 방명록이 없어요. 첫 인사를 남겨보세요!
              </Text>
            ) : (
              <View style={styles.gbList}>
                {notes.map((note) => (
                  <View key={note.id} style={[styles.gbRow, { backgroundColor: t.surfaceMuted }]}>
                    <View style={styles.gbRowHead}>
                      <Text style={[Typography.label, { color: t.text }]}>{note.author}</Text>
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>
                        {note.date}
                      </Text>
                    </View>
                    <Text style={[Typography.body, { color: t.text }]}>{note.content}</Text>
                  </View>
                ))}
                {guestbookHasNext ? (
                  <Pressable
                    onPress={onLoadMoreGuestbook}
                    accessibilityRole="button"
                    accessibilityLabel="방명록 더보기"
                    style={[styles.gbMore, { backgroundColor: t.surfaceMuted }]}>
                    <Text style={[Typography.label, { color: t.primaryText }]}>더보기</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pendingNotice: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  gbInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gbInput: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  gbSendBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  gbState: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  listState: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: Spacing.three,
  },
  gbTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  activityList: {
    gap: Spacing.two,
  },
  activityRow: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  activityRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gbList: {
    gap: Spacing.two,
  },
  gbRow: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  gbRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gbMore: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
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
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    // 부제 줄 유무와 무관한 고정 행 리듬 (#392) — 나의 방 리스트와 동일.
    minHeight: 48,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeText: {
    fontSize: 11,
  },
  cheers: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cheerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});

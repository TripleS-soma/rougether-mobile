import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

import { GestureDetector } from 'react-native-gesture-handler';

import { CharacterAvatar, type CharacterAnimationSet } from '@/components/character-avatar';
import { Room } from '@/components/room/room';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { type Routine, type RoutineCategoryMeta, UNCATEGORIZED_META } from '@/constants/routines';
import { BearCheck } from '@/components/ui/bear-check';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { horizontalFlingGesture } from '@/utils/gesture';
import { PendingNotice } from '@/components/ui/pending-notice';
import { RetryState } from '@/components/ui/retry-state';
import { BookOpenPictogram, Pictogram, type PictogramName } from '@/components/ui/pictograms';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { type FurnitureItem, type PlacedFurniture, type Wallpaper } from '@/resources/furniture';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { formatTime } from '@/utils/datetime';
import { hapticSuccess } from '@/utils/haptics';

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
  /**
   * 방 캔버스 좌우 플링 (#644) — 같은 집의 다른 멤버 방으로 순회. 'left'
   * 플링 = 다음 멤버. 방문 가능한 친구가 1명뿐이면 부모가 생략한다.
   */
  onSwipeFriend?: (dir: 'left' | 'right') => void;
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
   * 그날 루틴·투두의 공개 카테고리 메타 (#528, 서버 #237) — 있으면 루틴
   * 목록을 본인 화면처럼 카테고리 그룹으로 보여준다. 비공개 카테고리 항목은
   * 미분류 묶음으로 흘러간다.
   */
  categories?: RoutineCategoryMeta[];
  /**
   * Recent completion history (last 14 days, HOUSE/PUBLIC categories), date
   * desc. Omit to hide the 최근 활동 section (unwired/demo); [] shows an
   * empty-state line.
   */
  recentActivity?: FriendActivityDay[];
  /** True while the friend's room/routines are loading from the server. */
  loading?: boolean;
  /** True when the visit load failed entirely (#549) — 빈 방 대신 실패+다시 시도. */
  loadError?: boolean;
  /** Re-run the failed visit load (다시 시도 button). */
  onRetry?: () => void;
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
  onSwipeFriend,
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
  categories,
  recentActivity,
  loading = false,
  loadError = false,
  onRetry,
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
  // 카테고리 그룹 (#528) — 서버가 준 공개 카테고리 순서대로 묶고, 매칭 안
  // 되는 항목(비공개·미분류)은 마지막 미분류 묶음으로. 카테고리 정보가 없으면
  // (데모 미리보기·구서버) 기존 플랫 목록 그대로.
  const categoryGroups = useMemo(() => {
    if (!categories || categories.length === 0) return null;
    const groups = categories
      .map((meta) => ({ meta, items: routineList.filter((r) => r.category === meta.id) }))
      .filter((g) => g.items.length > 0);
    const known = new Set(categories.map((c) => c.id));
    const rest = routineList.filter((r) => !r.category || !known.has(r.category));
    if (rest.length > 0) groups.push({ meta: UNCATEGORIZED_META, items: rest });
    return groups.length > 0 ? groups : null;
  }, [categories, routineList]);
  const completedCount = routineList.filter((r) => r.completed).length;
  const progress = routineList.length > 0 ? completedCount / routineList.length : 0;

  // 응원 재요청 확인 (#427) — 이번 방문에서 전송한 타입을 기억하고, 같은
  // 타입 재탭이면 바로 보내지 않고 확인 모달을 거친다. 세션 한정 기억이라
  // 앱 재시작 후 중복은 기존 서버 409 토스트가 방어한다.
  const [cheeredTypes, setCheeredTypes] = useState<CheerType[]>([]);
  const [confirmCheer, setConfirmCheer] = useState<CheerType | null>(null);
  // 응원 발사 (#450) — 탭마다 해당 이모지가 버튼에서 떠올라 사라진다.
  const burstSeq = useRef(0);
  const [bursts, setBursts] = useState<{ id: number; type: CheerType }[]>([]);
  const playCheerFx = (type: CheerType) => {
    hapticSuccess();
    const id = burstSeq.current++;
    setBursts((prev) => [...prev, { id, type }]);
  };
  // 연타 윈도우 (#491) — 첫 탭부터 5초는 자유 연타(연출만) 후 딱 1회 전송.
  // 서버 cheer는 count 없는 원탭 + 같은 타입 하루 5회 한도(V23, 초과 409)라 연타를 모아
  // 보낼 수 없다: 연타 = 연출, 전송 = 윈도우당 1회. 전송이 끝난 타입을
  // 다시 누르면 기존 재전송 확인 모달(#427)로 이어진다.
  const CHEER_SEND_DELAY_MS = 5000;
  const pendingCheers = useRef<Map<CheerType, ReturnType<typeof setTimeout>>>(new Map());
  const onCheerRef = useRef(onCheer);
  onCheerRef.current = onCheer;
  const fireCheer = (type: CheerType) => {
    pendingCheers.current.delete(type);
    setCheeredTypes((prev) => (prev.includes(type) ? prev : [...prev, type]));
    onCheerRef.current?.(type);
  };
  // 재전송(확인 모달 통과)은 지금처럼 즉시 — 사용자가 명시적으로 확인했다.
  const sendCheer = (type: CheerType) => {
    setCheeredTypes((prev) => (prev.includes(type) ? prev : [...prev, type]));
    playCheerFx(type);
    onCheer?.(type);
  };
  const requestCheer = (type: CheerType) => {
    // 윈도우 진행 중인 타입 — 연출만 (자유 연타 구간).
    if (pendingCheers.current.has(type)) return playCheerFx(type);
    if (cheeredTypes.includes(type)) return setConfirmCheer(type);
    playCheerFx(type);
    pendingCheers.current.set(
      type,
      setTimeout(() => fireCheer(type), CHEER_SEND_DELAY_MS),
    );
  };
  // 윈도우가 끝나기 전에 화면을 나가면 미전송 응원을 즉시 flush —
  // 누른 응원이 조용히 사라지지 않게.
  useEffect(
    () => () => {
      for (const [type, timer] of pendingCheers.current) {
        clearTimeout(timer);
        onCheerRef.current?.(type);
      }
      pendingCheers.current.clear();
    },
    [],
  );

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
  // 멤버 순회 플링 (#644) — 최신 핸들러는 ref로 읽어 제스처를 재생성하지
  // 않는다(#539 계약). 방 캔버스에만 부착해 세로 스크롤·다른 탭을 살린다.
  const swipeFriendRef = useRef<(dir: 'left' | 'right') => void>(() => {});
  swipeFriendRef.current = (dir) => onSwipeFriend?.(dir);
  const friendFling = useRef(
    horizontalFlingGesture('friend-room-fling', (dir) => swipeFriendRef.current(dir)),
  ).current;
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

  const screenStyle = useScreenStyle([]);

  // 방문 실패 (#549) — 방·루틴·기록이 전부 실패하면 빈 방으로 위장하지 않고
  // 실패 상태 + 다시 시도를 보여준다 (부분 실패는 성공한 데이터로 렌더).
  if (loadError) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="back" size={26} color={t.text} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={[Typography.h3, { color: t.text }]} numberOfLines={1}>
              {friendName}의 방
            </Text>
          </View>
        </View>
        <View style={styles.errorWrap}>
          <RetryState
            message="친구 방을 불러오지 못했어요"
            detail="네트워크 상태를 확인하고 다시 시도해 주세요."
            onRetry={onRetry}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, screenStyle]}>
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
          <GestureDetector gesture={friendFling}>
            <View style={styles.roomWrap} collapsable={false}>
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
          </GestureDetector>

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

            {(() => {
              const renderRow = (routine: Routine) => (
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
                    {routine.alarmEnabled && routine.time ? (
                      <View style={styles.badges}>
                        {routine.alarmEnabled && routine.time ? (
                          <View style={styles.badge}>
                            <Icon name="bell" size={11} color={t.textMuted} />
                            <Text style={[styles.badgeText, { color: t.textMuted }]}>
                              {formatTime(routine.time)}
                            </Text>
                          </View>
                        ) : null}
                        {/* 인증사진형 잠시 내림 (#499) — 복구 시 사진 인증 배지를 되살릴 것.
                        {routine.photoVerify ? (
                          <View style={styles.badge}>
                            <Icon name="camera" size={11} color={t.textMuted} />
                            <Text style={[styles.badgeText, { color: t.textMuted }]}>
                              사진 인증
                            </Text>
                          </View>
                        ) : null} */}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
              // 카테고리 메타가 있으면 본인 화면처럼 그룹으로 (#528).
              return categoryGroups ? (
                <View style={styles.groups}>
                  {categoryGroups.map((g) => (
                    <View key={g.meta.id || 'uncat'} style={styles.group}>
                      <View style={styles.catHeader}>
                        <View style={[styles.catDot, { backgroundColor: `${g.meta.color}33` }]}>
                          <CategoryIcon name={g.meta.icon} color={g.meta.color} size={16} />
                        </View>
                        <Text
                          style={[Typography.label, styles.flex, { color: t.text }]}
                          numberOfLines={1}>
                          {g.meta.name}
                        </Text>
                        <Text style={[Typography.supporting, { color: t.textMuted }]}>
                          {g.items.filter((r) => r.completed).length}/{g.items.length}
                        </Text>
                      </View>
                      <View style={styles.rows}>{g.items.map(renderRow)}</View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.rows}>{routineList.map(renderRow)}</View>
              );
            })()}

            <View style={styles.cheers}>
              {bursts.map((b) => (
                <CheerBurst
                  key={b.id}
                  type={b.type}
                  onDone={() => setBursts((prev) => prev.filter((x) => x.id !== b.id))}
                />
              ))}
              {CHEERS.map((cheer, idx) => (
                <ScalePressable
                  key={cheer.type}
                  onPress={() => requestCheer(cheer.type)}
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
                </ScalePressable>
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
              <ScalePressable
                onPress={sendNote}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                accessibilityLabel="방명록 남기기"
                style={[styles.gbSendBtn, { backgroundColor: canSend ? t.primary : t.disabledBg }]}>
                <Text style={[Typography.label, { color: canSend ? t.onPrimary : t.textMuted }]}>
                  남기기
                </Text>
              </ScalePressable>
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

      {confirmCheer ? (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: t.surface }]}>
            <Text style={[Typography.h3, { color: t.text }]}>응원 다시 보내기</Text>
            <Text style={[Typography.body, styles.modalBody, { color: t.textMuted }]}>
              오늘은 이미 보낸 응원이에요. 그래도 보낼까요?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmCheer(null)}
                accessibilityRole="button"
                accessibilityLabel="응원 다시 보내기 취소"
                style={[styles.modalBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  sendCheer(confirmCheer);
                  setConfirmCheer(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="응원 다시 보내기 확인"
                style={[styles.modalBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>보내기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** 전송된 응원이 버튼 줄 위로 떠올라 사라지는 버스트 (#450). */
function CheerBurst({ type, onDone }: { type: CheerType; onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const icon = CHEERS.find((c) => c.type === type)?.icon ?? 'heart';
  const idx = Math.max(
    CHEERS.findIndex((c) => c.type === type),
    0,
  );
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회 발사
  }, []);
  // 버튼 3개가 세로 스택이라 해당 버튼 높이 근처(y)에서 떠오른다.
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cheerBurst,
        {
          top: idx * 56 + 8,
          opacity: p.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -84] }) },
            { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, -6] }) },
            { scale: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.7, 1.25, 1] }) },
            { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '10deg'] }) },
          ],
        },
      ]}>
      <Pictogram name={icon} size={26} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 방문 실패 상태 (#549).
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.six,
    gap: Spacing.two,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  modalBody: {
    marginTop: Spacing.two,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
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
    fontSize: 16,
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
  groups: {
    gap: Spacing.three,
  },
  group: {
    gap: Spacing.one,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  catDot: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
  },
  cheers: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    // 응원 버스트(#450)의 좌표 기준.
    position: 'relative',
  },
  cheerBurst: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
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

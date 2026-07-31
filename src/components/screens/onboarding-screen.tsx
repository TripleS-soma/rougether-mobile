import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { CharacterAvatar, type CharacterAnimationSet } from '@/components/character-avatar';
import { Icon } from '@/components/ui/icon';
import {
  CHARACTER_OPTIONS,
  CHARACTER_SELECTION_ENABLED,
  type CharacterId,
  DEFAULT_CHARACTER_ID,
} from '@/constants/characters';
import { Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';

type Slide = { image: number; title: string; description: string };

/**
 * 인트로 5장 (#412, design-sync A안): 비주얼은 계정 4로 촬영한 실제 앱 화면
 * 캡처(라이트, 390×844 → 560px 최적화). UI가 크게 바뀌면 재촬영해 교체한다.
 */
const SLIDES: Slide[] = [
  {
    image: require('@/assets/images/onboarding/my-room.png'),
    title: '매일의 루틴이\n포근한 방이 되는 곳',
    description: '루게더에 오신 걸 환영해요',
  },
  {
    image: require('@/assets/images/onboarding/routines.png'),
    title: '오늘의 루틴을\n곰 체크로 완료해요',
    description: '카테고리로 모아 보고, 알림·사진 인증까지',
  },
  {
    image: require('@/assets/images/onboarding/decor.png'),
    title: '모은 보상으로\n내 방을 꾸며요',
    description: '가구·벽지·바닥을 원하는 자리에 자유 배치',
  },
  {
    image: require('@/assets/images/onboarding/house.png'),
    title: '친구들과 한 집에서\n함께 자라요',
    description: '방 구경 · 응원 보내기 · 공동 미션으로 집 레벨 업',
  },
  {
    image: require('@/assets/images/onboarding/calendar.png'),
    title: '기록은 달력으로,\n보상은 뽑기로',
    description: '지난 완료를 돌아보고 캐릭터·가구를 모아요',
  },
];

export type OnboardingGoal = { id: string; label: string };

/** 목표 선택 상한 — 집 생성의 서버 제약(goalIds ≤ 3)과 맞춘다 (#598 후속). */
export const MAX_GOALS = 3;

/** 닉네임 길이 상한 (#635) — 헤더·타일 등 표시 공간과 합의된 값. */
export const NICKNAME_MAX = 12;

const GOALS: OnboardingGoal[] = [
  { id: 'exercise', label: '운동' },
  { id: 'study', label: '공부' },
  { id: 'sleep', label: '수면' },
  { id: 'reading', label: '독서' },
  { id: 'organizing', label: '정리' },
  { id: 'career', label: '취업 준비' },
  { id: 'habit', label: '생활 습관' },
];

export type OnboardingScreenProps = {
  onDone?: (goals: string[], characterId: CharacterId, nickname: string) => void;
  /** Goal options from the server master; falls back to the local list while empty. */
  goals?: OnboardingGoal[];
  /** Previously selected goal ids — a replay starts as an edit of these. */
  initialGoals?: string[];
  /** 다시 보기 때 기존 닉네임 프리필 (#635) — 없으면 빈 입력. */
  initialNickname?: string;
  /**
   * 캐릭터 선택 캐러셀 노출 — MVP는 고양이 단일이라 기본 꺼짐(#637). 갤러리·
   * 테스트가 보존된 UI를 계속 돌릴 수 있게 prop으로 열어둔다.
   */
  characterSelectEnabled?: boolean;
  /** Previously chosen character — preselected on replay. */
  initialCharacterId?: CharacterId;
  /**
   * 캐릭터별 서버 CDN 애니메이션 키 (#589, 마스터 /characters). 활성 카드가
   * wave를 재생하는 데 쓴다 — 없으면(오프라인 등) 번들 정적 포즈로 폴백.
   */
  characterAnimations?: Partial<Record<CharacterId, CharacterAnimationSet>>;
};

/** 받침 유무에 따른 '이랑/랑' — CTA "OO(이)랑 함께하기" (#589). */
export function withRang(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 > 0;
  return `${name}${hasFinal ? '이랑' : '랑'}`;
}

/**
 * Onboarding flow, ported from the prototype `OnboardingScreen`: intro slides →
 * goal survey → character select. Theme tokens + type scale; emoji stand in for
 * the icon set and character sprites (TODO).
 */
export function OnboardingScreen({
  onDone,
  initialNickname,
  characterSelectEnabled = CHARACTER_SELECTION_ENABLED,
  goals,
  initialGoals,
  initialCharacterId,
  characterAnimations,
}: OnboardingScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const { width: windowW } = useWindowDimensions();
  const characterScrollRef = useRef<ScrollView>(null);
  // RN-web은 momentum-end를 쏘지 않는다 — 스크롤 유휴로 정착시킨다
  // (wheel-picker와 같은 패턴).
  const characterWebSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 이전 선택(다시 보기)이 첫 카드가 되도록 회전 배치 — 스크롤 위치 복원은
  // 플랫폼별로 신뢰할 수 없어(iOS 전용 contentOffset, RN-web scrollTo 불능
  // 실측) 순서를 데이터에서 해결한다. 시각과 선택 상태가 항상 일치.
  const [characterOrder] = useState(() => {
    const first = initialCharacterId ?? DEFAULT_CHARACTER_ID;
    const i = CHARACTER_OPTIONS.findIndex((c) => c.id === first);
    return i <= 0
      ? CHARACTER_OPTIONS
      : [...CHARACTER_OPTIONS.slice(i), ...CHARACTER_OPTIONS.slice(0, i)];
  });
  // Pinned bottom action buttons → pad both edges so the notch / home indicator
  // don't clip the top title or the bottom buttons.
  const screenStyle = useScreenStyle(['top', 'bottom']);
  const goalOptions = goals && goals.length > 0 ? goals : GOALS;
  const [index, setIndex] = useState(0);
  const [showGoalSurvey, setShowGoalSurvey] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  // 닉네임 단계 (#635) — 캐릭터 다음, 시작 직전. 신규 계정의 서버 닉네임이
  // 비어 화면 데모 기본값이 노출되던 문제의 근본 해결.
  const [showNicknameStep, setShowNicknameStep] = useState(false);
  const [nickname, setNickname] = useState(initialNickname ?? '');
  // Seed from the previous selections (온보딩 다시 보기 edits rather than starts
  // over); ids that no longer exist in the option list are dropped so a stale
  // id can't hold the 시작하기 button open with nothing visibly checked.
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() =>
    (initialGoals ?? []).filter((id) => goalOptions.some((g) => g.id === id)).slice(0, MAX_GOALS),
  );
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(
    initialCharacterId ?? DEFAULT_CHARACTER_ID,
  );

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const { show: toast } = useToast();
  const toggleGoal = (id: string) =>
    setSelectedGoals((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id);
      // 상한 도달 시 차단하고 이유를 말한다 — 집 생성 서버 제약과 동일.
      if (prev.length >= MAX_GOALS) {
        toast(`목표는 ${MAX_GOALS}개까지 고를 수 있어요`);
        return prev;
      }
      return [...prev, id];
    });

  // 카드 지오메트리 — 폭의 78% 카드 + 좌우 피크. 훅/이펙트에서도 쓰므로
  // 분기 밖에서 계산한다.
  const cardW = Math.round(windowW * 0.78);
  const cardGap = Spacing.three;
  const sidePad = Math.max(0, (windowW - cardW) / 2);
  const snap = cardW + cardGap;

  // RN-web의 ScrollView.scrollTo는 이 트리에서 동작하지 않는다(실측) —
  // 웹은 DOM 노드 scrollLeft 직접 대입으로 우회하고, 네이티브는 scrollTo.
  const jumpTo = (x: number, animated: boolean) => {
    const sv = characterScrollRef.current;
    if (!sv) return;
    if (Platform.OS === 'web') {
      const node = (
        sv as unknown as { getScrollableNode?: () => { scrollLeft: number } }
      ).getScrollableNode?.();
      if (node) {
        node.scrollLeft = x;
        return;
      }
    }
    sv.scrollTo({ x, animated });
  };

  // --- Character select (#589) --- 풀스크린 카드 캐러셀: 카드 하나당 캐릭터
  // 하나, 다음 카드가 살짝 보이는 피크 + 도트로 스와이프를 암시한다. 활성
  // 카드만 wave(CDN webp)를 재생 — "초점을 주면 인사한다"가 애착 연출이고,
  // 로딩 지연도 정적 포즈 폴백 뒤에 숨는다.
  // --- Nickname (#635) --- 캐릭터 다음, 시작 직전. 서버 닉네임이 비어
  // 데모 기본값('준서')이 노출되던 신규 계정 문제의 근본 해결 — 필수 입력.
  if (showNicknameStep) {
    const active = characterOrder.find((c) => c.id === selectedCharacter) ?? characterOrder[0];
    const trimmed = nickname.trim();
    const canStart = trimmed.length > 0;
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.intro}>
          <Text style={[Typography.h1, { color: t.text }]}>어떻게 불러드릴까요?</Text>
          <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
            {active.name}가 부를 내 이름을 정해주세요.
          </Text>
        </View>
        <View style={styles.nicknameBody}>
          <CharacterAvatar
            characterId={selectedCharacter}
            animations={characterAnimations?.[selectedCharacter]}
            size={120}
          />
          <TextInput
            value={nickname}
            onChangeText={(v) => setNickname(v.slice(0, NICKNAME_MAX))}
            placeholder="닉네임 (12자까지)"
            placeholderTextColor={t.textDisabled}
            autoFocus
            autoCorrect={false}
            maxLength={NICKNAME_MAX}
            accessibilityLabel="닉네임 입력"
            style={[
              styles.nicknameInput,
              Typography.h3,
              { backgroundColor: t.surface, color: t.text, borderColor: t.border },
            ]}
          />
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            label="시작하기"
            disabled={!canStart}
            blockedMessage="닉네임을 입력해주세요"
            onPress={() => onDone?.(selectedGoals, selectedCharacter, trimmed)}
          />
          <TextButton label="이전" onPress={() => setShowNicknameStep(false)} />
        </View>
      </View>
    );
  }

  if (showCharacterSelect) {
    const activeIndex = Math.max(
      0,
      characterOrder.findIndex((c) => c.id === selectedCharacter),
    );
    const active = characterOrder[activeIndex];
    const settleAt = (x: number) => {
      const i = Math.min(characterOrder.length - 1, Math.max(0, Math.round(x / snap)));
      const opt = characterOrder[i];
      if (opt) setSelectedCharacter(opt.id);
    };
    const focusCharacter = (i: number) => {
      const opt = characterOrder[i];
      if (!opt) return;
      setSelectedCharacter(opt.id);
      jumpTo(i * snap, true);
    };
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.intro}>
          <Text style={[Typography.h1, { color: t.text }]}>함께할 캐릭터를 골라주세요</Text>
          <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
            옆으로 넘기며 마음에 드는 친구를 만나보세요.
          </Text>
        </View>
        <ScrollView
          ref={characterScrollRef}
          horizontal
          style={styles.flex}
          showsHorizontalScrollIndicator={false}
          snapToInterval={snap}
          decelerationRate="fast"
          contentContainerStyle={[
            styles.characterRail,
            { paddingHorizontal: sidePad, gap: cardGap },
          ]}
          onMomentumScrollEnd={(e) => settleAt(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
          onScroll={
            Platform.OS === 'web'
              ? (e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  if (characterWebSettle.current) clearTimeout(characterWebSettle.current);
                  characterWebSettle.current = setTimeout(() => settleAt(x), 160);
                }
              : undefined
          }
          testID="character-carousel">
          {characterOrder.map((c, i) => {
            const isActive = selectedCharacter === c.id;
            const wave = characterAnimations?.[c.id]?.wave;
            return (
              <Pressable
                key={c.id}
                onPress={() => focusCharacter(i)}
                accessibilityRole="radio"
                accessibilityLabel={`${c.name} — ${c.description}`}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.characterSlide,
                  { width: cardW, backgroundColor: t.surface },
                  { borderColor: isActive ? t.primary : t.border },
                ]}>
                <View style={[styles.characterStage, { backgroundColor: c.bg }]}>
                  <CharacterAvatar
                    characterId={c.id}
                    size={Math.min(Math.round(cardW * 0.55), 220)}
                    // 활성 카드만 wave 키를 넘긴다 — CharacterAvatar는 유효한
                    // CDN 키가 있으면 그 webp를, 없으면 번들 정적 포즈를 그린다.
                    animations={isActive && wave ? { wave } : undefined}
                  />
                </View>
                <View style={styles.characterMeta}>
                  <Text style={[Typography.h2, { color: t.text }]}>{c.name}</Text>
                  <Text
                    style={[Typography.body, styles.center, { color: t.textMuted }]}
                    numberOfLines={2}>
                    {c.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.dots}>
          {characterOrder.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => focusCharacter(i)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name} 카드로 이동`}
              style={[
                styles.dot,
                i === activeIndex
                  ? { width: 24, backgroundColor: t.primary }
                  : { width: 8, backgroundColor: t.border },
              ]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            label={`${withRang(active.name)} 함께하기`}
            onPress={() => setShowNicknameStep(true)}
          />
          <TextButton label="이전" onPress={() => setShowCharacterSelect(false)} />
        </View>
      </View>
    );
  }

  // --- Goal survey ---
  if (showGoalSurvey) {
    const canStart = selectedGoals.length > 0;
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.intro}>
          <Text style={[Typography.h1, { color: t.text }]}>관심 있는 목표를 골라주세요</Text>
          <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
            선택한 목표를 기반으로 루틴 제안과 미션을 더 잘 맞출 수 있어요. 최대 3개까지 고를 수
            있어요.
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {goalOptions.map((g) => {
            const selected = selectedGoals.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => toggleGoal(g.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[
                  styles.goalCard,
                  { backgroundColor: t.surface, borderColor: selected ? t.primary : 'transparent' },
                ]}>
                <Text style={[Typography.label, { color: t.text }]}>{g.label}</Text>
                {selected ? (
                  <View style={styles.goalCheck}>
                    <Check tint={t.primary} on={t.onPrimary} small />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.actions}>
          <PrimaryButton
            label="시작하기"
            disabled={!canStart}
            blockedMessage="목표를 하나 이상 선택해주세요"
            onPress={() =>
              canStart &&
              // MVP 고양이 단일 (#637) — 캐러셀을 건너뛰고 닉네임으로 직행.
              (characterSelectEnabled ? setShowCharacterSelect(true) : setShowNicknameStep(true))
            }
          />
          <TextButton label="이전" onPress={() => setShowGoalSurvey(false)} />
        </View>
      </View>
    );
  }

  // --- Intro slides ---
  // Advance / go back by swiping the slide horizontally (in addition to the
  // 다음 button and the dots). Left = next (or on to the goal survey on the
  // last slide), right = previous.
  const goNext = () => (isLast ? setShowGoalSurvey(true) : setIndex((i) => i + 1));
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const SWIPE_THRESHOLD = 48;
  const slidePan = PanResponder.create({
    // Claim the gesture only for a deliberate horizontal drag, so taps and
    // vertical scrolls still work.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => {
      if (g.dx <= -SWIPE_THRESHOLD) goNext();
      else if (g.dx >= SWIPE_THRESHOLD) goPrev();
    },
  });

  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable onPress={() => setShowGoalSurvey(true)} accessibilityRole="button">
            <Text style={[Typography.supporting, { color: t.textMuted }]}>건너뛰기</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.slideBody} {...slidePan.panHandlers}>
        <Text style={[Typography.h2, styles.center, { color: t.text }]}>{slide.title}</Text>
        <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
          {slide.description}
        </Text>
        {/* 실제 앱 화면 캡처 — 폰 프레임 카드 (#412). 390:844 비율 유지. */}
        <View style={[styles.captureFrame, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Image
            source={slide.image}
            style={styles.captureImage}
            contentFit="cover"
            transition={150}
            accessibilityLabel={slide.title.replace('\n', ' ')}
          />
        </View>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => setIndex(i)}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}번째 슬라이드로 이동`}
            style={[
              styles.dot,
              i === index
                ? { width: 24, backgroundColor: t.primary }
                : { width: 8, backgroundColor: t.border },
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isLast ? '목표 선택하기' : '다음'}
          onPress={() => (isLast ? setShowGoalSurvey(true) : setIndex((i) => i + 1))}
        />
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  blockedMessage,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** When set, a disabled tap stays live and explains itself with this toast. */
  blockedMessage?: string;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const { show: toast } = useToast();
  return (
    <Pressable
      onPress={disabled && blockedMessage ? () => toast(blockedMessage, 'error') : onPress}
      disabled={disabled && !blockedMessage}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled ? t.disabledBg : t.primary },
        pressed && !disabled && { backgroundColor: t.primaryActive },
      ]}>
      <Text style={[Typography.label, { color: disabled ? t.textMuted : t.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.textBtn}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function Check({ tint, on, small }: { tint: string; on: string; small?: boolean }) {
  const size = small ? 22 : 28;
  return (
    <View
      style={[
        styles.checkCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
      ]}>
      <Icon name="check" size={small ? 14 : 16} color={on} />
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
  center: {
    textAlign: 'center',
  },
  intro: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  introBody: {
    marginTop: Spacing.half,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  // 캐릭터 카드 캐러셀 (#589) — 카드가 세로 공간을 꽉 채우고, 이웃 카드는
  // 좌우 피크로 살짝 보인다.
  characterRail: {
    alignItems: 'stretch',
    paddingBottom: Spacing.two,
  },
  characterSlide: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  characterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterMeta: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  goalCard: {
    width: '47%',
    minHeight: 64,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
    justifyContent: 'center',
  },
  goalCheck: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
  },
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipRow: {
    height: 44,
    paddingHorizontal: Spacing.four,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  slideBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  captureFrame: {
    // 캡처 원본(390×844) 비율의 폰 프레임 카드 — 세로 공간에 맞춰 줄어든다.
    width: 210,
    aspectRatio: 390 / 844,
    maxHeight: 460,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: Spacing.two,
    elevation: 3,
    shadowColor: '#4A403A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  captureImage: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  // 닉네임 단계 (#635).
  nicknameBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.five,
  },
  nicknameInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  primaryBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  textBtn: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});

import { Image } from 'expo-image';
import { useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { Icon } from '@/components/ui/icon';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
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
  onDone?: (goals: string[], characterId: CharacterId) => void;
  /** Goal options from the server master; falls back to the local list while empty. */
  goals?: OnboardingGoal[];
  /** Previously selected goal ids — a replay starts as an edit of these. */
  initialGoals?: string[];
  /** Previously chosen character — preselected on replay. */
  initialCharacterId?: CharacterId;
};

/**
 * Onboarding flow, ported from the prototype `OnboardingScreen`: intro slides →
 * goal survey → character select. Theme tokens + type scale; emoji stand in for
 * the icon set and character sprites (TODO).
 */
export function OnboardingScreen({
  onDone,
  goals,
  initialGoals,
  initialCharacterId,
}: OnboardingScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  // Pinned bottom action buttons → pad both edges so the notch / home indicator
  // don't clip the top title or the bottom buttons.
  const screenStyle = useScreenStyle(['top', 'bottom']);
  const goalOptions = goals && goals.length > 0 ? goals : GOALS;
  const [index, setIndex] = useState(0);
  const [showGoalSurvey, setShowGoalSurvey] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  // Seed from the previous selections (온보딩 다시 보기 edits rather than starts
  // over); ids that no longer exist in the option list are dropped so a stale
  // id can't hold the 시작하기 button open with nothing visibly checked.
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() =>
    (initialGoals ?? []).filter((id) => goalOptions.some((g) => g.id === id)),
  );
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(
    initialCharacterId ?? DEFAULT_CHARACTER_ID,
  );

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const toggleGoal = (id: string) =>
    setSelectedGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  // --- Character select ---
  if (showCharacterSelect) {
    return (
      <View style={[styles.screen, screenStyle]}>
        <View style={styles.intro}>
          <Text style={[Typography.h1, { color: t.text }]}>함께할 캐릭터를 골라주세요</Text>
          <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
            선택한 친구가 나의 방에 나타나고, 루틴을 함께 키워가요.
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {CHARACTER_OPTIONS.map((c) => {
            const selected = selectedCharacter === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCharacter(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.characterCard,
                  { backgroundColor: t.surface, borderColor: selected ? t.primary : 'transparent' },
                ]}>
                <View style={[styles.characterAvatar, { backgroundColor: c.bg }]}>
                  <CharacterAvatar characterId={c.id} size={48} />
                </View>
                <View style={styles.flex}>
                  <Text style={[Typography.label, { color: t.text }]}>{c.name}</Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>
                    {c.description}
                  </Text>
                </View>
                {selected ? <Check tint={t.primary} on={t.onPrimary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.actions}>
          <PrimaryButton
            label="캐릭터 선택하기"
            onPress={() => onDone?.(selectedGoals, selectedCharacter)}
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
            선택한 목표를 기반으로 루틴 제안과 미션을 더 잘 맞출 수 있어요.
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
            onPress={() => canStart && setShowCharacterSelect(true)}
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
  list: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  characterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  characterAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
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

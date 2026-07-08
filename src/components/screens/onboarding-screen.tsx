import { useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterAvatar } from '@/components/character-avatar';
import { Icon } from '@/components/ui/icon';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

type Slide = { emoji: string; bg: string; title: string; description: string };

const SLIDES: Slide[] = [
  {
    emoji: '🌱',
    bg: '#F1E7D6',
    title: '루게더에 오신 걸 환영해요',
    description:
      '매일의 작은 루틴이 모여 나만의 마을을 만들어가요.\n캐릭터 친구와 함께 시작해볼까요?',
  },
  {
    emoji: '✅',
    bg: '#E4F0DC',
    title: '오늘의 루틴을 완료해요',
    description: '기상, 독서, 운동 같은 루틴을 만들고\n매일 체크하며 보상을 받아보세요.',
  },
  {
    emoji: '🏠',
    bg: '#F5D8C8',
    title: '방을 꾸미고 캐릭터를 키워요',
    description: '루틴을 완료할수록 캐릭터가 성장하고\n보상으로 방을 더 따뜻하게 채워가요.',
  },
  {
    emoji: '👫',
    bg: '#D8E4F0',
    title: '친구들과 함께 집을 만들어요',
    description: '친구의 방을 구경하고 그룹 미션을 함께\n성공하며 마을을 더 생기있게 만들어보세요.',
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
};

/**
 * Onboarding flow, ported from the prototype `OnboardingScreen`: intro slides →
 * goal survey → character select. Theme tokens + type scale; emoji stand in for
 * the icon set and character sprites (TODO).
 */
export function OnboardingScreen({ onDone, goals }: OnboardingScreenProps) {
  const t = useTokens();
  // Pinned bottom action buttons → pad both edges so the notch / home indicator
  // don't clip the top title or the bottom buttons.
  const screenStyle = useScreenStyle(['top', 'bottom']);
  const [index, setIndex] = useState(0);
  const [showGoalSurvey, setShowGoalSurvey] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(DEFAULT_CHARACTER_ID);

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
    const goalOptions = goals && goals.length > 0 ? goals : GOALS;
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
        <View style={[styles.slideCircle, { backgroundColor: slide.bg }]}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
        </View>
        <Text style={[Typography.h2, styles.center, { color: t.text }]}>{slide.title}</Text>
        <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
          {slide.description}
        </Text>
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
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
  slideCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  slideEmoji: {
    fontSize: 88,
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

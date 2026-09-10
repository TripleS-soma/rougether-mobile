import { useRef, useState } from 'react';
import {
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

import { useAppFrame } from '@/hooks/use-app-frame';
import { CharacterAvatar } from '@/components/room/character-avatar';
import { IntroScreen } from '@/components/screens/intro-screen';
import { PrimaryButton, TextButton } from '@/components/screens/onboarding/onboarding-buttons';
import { Icon } from '@/components/ui/icon';
import {
  STARTER_CHARACTER_OPTIONS,
  CHARACTER_SELECTION_ENABLED,
  type CharacterId,
  DEFAULT_CHARACTER_ID,
} from '@/constants/characters';
import { NICKNAME_MAX } from '@/constants/profile';
import { Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type OnboardingGoal = { id: string; label: string; code?: string };

/** 목표 선택 상한 — 집 생성의 서버 제약(goalIds ≤ 3)과 맞춘다 (#598 후속). */
export const MAX_GOALS = 3;

/** 닉네임 길이 상한 (#635) — 헤더·타일 등 표시 공간과 합의된 값. */

/**
 * 온보딩만 공용 상한보다 좁게 묶는다 (#725) — 폰 목업이 가운데 서는
 * 레이아웃이라 넓으면 허전하다. 상한 자체는 `useResponsiveColumn`이 관리한다.
 */
const CONTENT_MAX_W = 480;

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
   * 캐릭터별 서버 등록 포즈 프레임 (#589·#735, 마스터 /characters). 활성 카드가
   * 첫 포즈를 재생하는 데 쓴다 — 없으면(오프라인 등) 번들 정적 포즈로 폴백.
   */
  characterFrames?: Partial<Record<CharacterId, string[]>>;
  /**
   * 설정 → '튜토리얼 다시 보기'로 들어왔는가 (#1023). 첫 실행과 다시 보기는
   * 앱 상태가 똑같아서(`app-root`가 `onboarded`만 false로 되돌린다) 화면이
   * 스스로는 구분할 수 없어 명시적으로 받는다. 다시 보기만 소개 슬라이드부터
   * 시작한다 — 첫 실행의 소개는 로그인 전으로 옮겼다 (#1282).
   */
  replay?: boolean;
  /**
   * 다시 보기에서 건너뛰기 (#1023) — 목표 설문으로 넘어가는 게 아니라 온보딩을
   * 끝내고 앱으로 돌아간다. 이미 저장된 목표·닉네임은 건드리지 않는다.
   * `replay`가 아닐 때는 버튼 자체가 없으므로 호출되지 않는다.
   */
  onSkip?: () => void;
};

/** 받침 유무에 따른 '이랑/랑' — CTA "OO(이)랑 함께하기" (#589). */
export function withRang(name: string): string {
  const code = name.charCodeAt(name.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 > 0;
  return `${name}${hasFinal ? '이랑' : '랑'}`;
}

/**
 * Onboarding flow, ported from the prototype `OnboardingScreen`: goal survey →
 * character select → nickname. Theme tokens + type scale; emoji stand in for
 * the icon set and character sprites (TODO).
 *
 * 다시 보기(`replay`)만 소개 슬라이드가 앞에 붙는다 — 첫 실행의 소개는 로그인
 * 전으로 옮겼다 (#1282).
 */
export function OnboardingScreen({
  onDone,
  initialNickname,
  characterSelectEnabled = CHARACTER_SELECTION_ENABLED,
  goals,
  initialGoals,
  initialCharacterId,
  characterFrames,
  replay = false,
  onSkip,
}: OnboardingScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  // 카드 폭은 앱 프레임 기준(웹 데스크톱 중앙 컬럼).
  const { width: windowW } = useAppFrame();
  const characterScrollRef = useRef<ScrollView>(null);
  // RN-web은 momentum-end를 쏘지 않는다 — 스크롤 유휴로 정착시킨다
  // (wheel-picker와 같은 패턴).
  const characterWebSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 이전 선택(다시 보기)이 첫 카드가 되도록 회전 배치 — 스크롤 위치 복원은
  // 플랫폼별로 신뢰할 수 없어(iOS 전용 contentOffset, RN-web scrollTo 불능
  // 실측) 순서를 데이터에서 해결한다. 시각과 선택 상태가 항상 일치.
  const [characterOrder] = useState(() => {
    const first = initialCharacterId ?? DEFAULT_CHARACTER_ID;
    const i = STARTER_CHARACTER_OPTIONS.findIndex((c) => c.id === first);
    return i <= 0
      ? STARTER_CHARACTER_OPTIONS
      : [...STARTER_CHARACTER_OPTIONS.slice(i), ...STARTER_CHARACTER_OPTIONS.slice(0, i)];
  });
  // Pinned bottom action buttons → pad both edges so the notch / home indicator
  // don't clip the top title or the bottom buttons.
  const screenStyle = useScreenStyle(['top', 'bottom']);
  const goalOptions = goals && goals.length > 0 ? goals : GOALS;
  // 첫 실행은 목표 설문부터 (#1282) — 소개는 로그인 전에 이미 봤다.
  const [showGoalSurvey, setShowGoalSurvey] = useState(!replay);
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
        {/* 이 단계만 ScrollView가 아니라 고정 레이아웃이라, 다른 입력 화면이
            쓰는 keyboardShouldPersistTaps가 통하지 않는다 (#923). 키보드를
            내리는 배경 탭은 Pressable로 직접 걸고, autoFocus로 곧장 올라온
            키보드가 '시작하기'를 덮지 않게 KeyboardAvoidingView로 감싼다. */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.intro}>
            <Text style={[Typography.h1, { color: t.text }]}>어떻게 불러드릴까요?</Text>
            <Text style={[Typography.supporting, styles.introBody, { color: t.textMuted }]}>
              {active.name}가 부를 내 이름을 정해주세요.
            </Text>
          </View>
          {/* accessible={false} — 배경을 스크린리더 대상으로 만들지 않는다. */}
          <Pressable style={styles.nicknameBody} onPress={Keyboard.dismiss} accessible={false}>
            <CharacterAvatar
              characterId={selectedCharacter}
              frames={characterFrames?.[selectedCharacter]}
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
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={[
                styles.nicknameInput,
                Typography.h3,
                { backgroundColor: t.surface, color: t.text, borderColor: t.border },
              ]}
            />
          </Pressable>
          <View style={styles.actions}>
            <PrimaryButton
              label="시작하기"
              disabled={!canStart}
              blockedMessage="닉네임을 입력해주세요"
              onPress={() => onDone?.(selectedGoals, selectedCharacter, trimmed)}
            />
            <TextButton label="이전" onPress={() => setShowNicknameStep(false)} />
          </View>
        </KeyboardAvoidingView>
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
            const frames = characterFrames?.[c.id];
            return (
              <Pressable
                key={c.id}
                onPress={() => focusCharacter(i)}
                accessibilityRole="radio"
                accessibilityLabel={`${c.name}. ${c.description}`}
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
                    // 활성 카드만 서버 프레임을 넘긴다 — CharacterAvatar는 유효한
                    // CDN 키가 있으면 그 webp를, 없으면 번들 정적 포즈를 그린다.
                    frames={isActive ? frames : undefined}
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
          {/* 첫 실행엔 돌아갈 소개가 없다 — 소개는 로그인 전에 끝났다 (#1282). */}
          {replay ? <TextButton label="이전" onPress={() => setShowGoalSurvey(false)} /> : null}
        </View>
      </View>
    );
  }

  // --- Intro slides (다시 보기 전용) --- 첫 실행의 소개는 로그인 전으로 옮겼다
  // (#1282, src/app/login.tsx). 설정 → 튜토리얼 다시 보기로 들어온 사람만 여기서
  // 소개를 다시 보고, 건너뛰기로 나가거나 목표 수정으로 이어진다.
  return (
    <IntroScreen
      doneLabel="목표 선택하기"
      onDone={() => setShowGoalSurvey(true)}
      onSkip={replay ? onSkip : undefined}
    />
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    width: '100%',
    maxWidth: CONTENT_MAX_W,
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    width: '100%',
    maxWidth: CONTENT_MAX_W,
    alignSelf: 'center',
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
});
